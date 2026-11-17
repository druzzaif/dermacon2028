// @ts-nocheck

'use server';
function fmtDateForEmail(d: string | null | undefined): string {
  if (!d) return '--';
  const dt = new Date(d + 'T00:00:00');
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}


function fmt12hForEmail(t: string | null | undefined): string {
  if (!t) return '--:--';
  const [hs, ms] = t.split(':');
  let h = parseInt(hs, 10);
  const m = ms ? ms.substring(0, 2) : '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${m} ${ampm}`;
}


import { getSupabaseServer, isDemoMode } from './supabaseServer';
import puppeteer from 'puppeteer';
import { renderCommitmentHTML, renderCommitmentDocument, isWorkshopSession } from './lib/commitmentPdfHtml';
import { sortCoordinators } from './lib/coordOrder';
import { isPanelRole, panelGroups, sortTopicPeople, type PanelGroups } from './lib/topicPeople';
import {
  WHATSAPP_TEMPLATE,
  maskPhone,
  normalizeWhatsAppPhone,
  renderWhatsAppTemplate,
  whatsappName,
  type WhatsAppPreviewRow,
} from './lib/whatsapp';
import fs from 'fs';
import path from 'path';

// One PDF per faculty, one page per session (a session's topics share its page).
// Used by the Faculty page "PDF" button, the Add/Edit topic windows and the email attachment.
// Every topic a person has, grouped later by the picker (Scientific sessions / Workshops)
export async function getFacultyTopicChoices(facultyId: string) {
  try {
    const { data: faculty } = await getSupabaseServer().from('faculty').select('*').eq('id', facultyId).single();
    if (!faculty) return { success: false, message: 'Faculty not found.', choices: [] as any[] };
    const p = await buildFacultyPayload(faculty, { coordinators: false });
    return { success: true, choices: p.choices as any[] };
  } catch (e: any) {
    return { success: false, message: e?.message || 'Could not load the topics.', choices: [] as any[] };
  }
}

export async function generatePDFData(facultyId: string, filter: TopicFilter = {}) {
  try {
    const { data: faculty, error: facError } = await getSupabaseServer()
      .from('faculty').select('*').eq('id', facultyId).single();
    if (facError || !faculty) throw new Error("Faculty not found.");

    const payload = await buildFacultyPayload(faculty, filter);
    const pdfBuffer = await renderPdfBuffer(renderCommitmentHTML(payload.pdfInput));

    const fileName = `Commitment_${safeFileName(faculty.canonical_name)}_${Date.now()}.pdf`;
    const dir = path.join(process.cwd(), 'public', 'pdfs');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, fileName), pdfBuffer);

    return { success: true, url: `/api/pdfs/${fileName}` };
  } catch (error: any) {
    console.error("!!! PDF GENERATION FAILED !!!", error);
    return { success: false, message: error.message || 'Unknown error' };
  }
}

export async function updateFaculty(formData: FormData) {
  const id = (formData.get('id') as string)?.trim();
  if (!id) return { success: false, message: 'Missing faculty id' };
  const getStr = (k: string) => (formData.get(k) as string)?.trim() || null;
  const getBool = (k: string) => formData.get(k) === 'on';
  const getInt = (k: string) => { const v = (formData.get(k) as string)?.trim(); return v ? parseInt(v, 10) : null; };
  const first_name = getStr('first_name') ?? ''; const last_name  = getStr('last_name')  ?? ''; const email = getStr('email');
  if (!email) return { success: false, message: 'Email is required.' };
  let canonical_name = [first_name, last_name].filter(Boolean).join(' ').trim();
  if (!canonical_name) {
    const { data: existing } = await getSupabaseServer().from('faculty').select('canonical_name').eq('id', id).single();
    canonical_name = existing?.canonical_name;
    if (!canonical_name) return { success: false, message: 'Name is required.' };
  }
  const { error } = await getSupabaseServer().from('faculty').update({
      first_name: first_name || null, last_name: last_name || null, canonical_name, email,
      phone: getStr('phone'), designation: getStr('designation'), country: getStr('country'),
      faculty_id: getStr('faculty_id'), alt_email: getStr('alt_email'), person_type: getStr('person_type'),
      google_email: getStr('google_email'), google_phone: getStr('google_phone'),
      sessions_as_faculty: getInt('sessions_as_faculty'), is_active: getBool('is_active'),
      is_faculty: getBool('is_faculty'), is_coordinator: getBool('is_coordinator'),
      google_confirmed: getBool('google_confirmed'), email_sent: getBool('email_sent'),
      reminder_sent: getBool('reminder_sent'), whatsapp_sent: getBool('whatsapp_sent'),
  }).eq('id', id);
  if (error) return { success: false, message: error.message };
  return { success: true, message: 'Faculty updated successfully.' };
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  Task #4 additions â€” bulk PDF + session PDF
//  These wrap the existing generatePDFData() so the modals can trigger
//  PDF creation for a whole session or a list of faculty in one click.
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// Print page, "By faculty" on letterhead: the same commitment letter as the emailed PDF,
// for several faculty in one document. Faculty with no topics are skipped (names returned).
export async function facultyLetterheadHtml(facultyIds: string[], filter: TopicFilter = {}) {
  const { data: list, error } = await getSupabaseServer().from('faculty').select('*').in('id', facultyIds);
  if (error) throw error;
  const byId = new Map((list || []).map((f: any) => [String(f.id), f]));
  const inputs: any[] = [];
  const skipped: string[] = [];
  for (const id of facultyIds) {
    const f = byId.get(String(id));
    if (!f) continue;
    try {
      inputs.push((await buildFacultyPayload(f, filter)).pdfInput);
    } catch {
      skipped.push(f.canonical_name);
    }
  }
  return { html: inputs.length ? renderCommitmentDocument(inputs) : '', skipped };
}

export async function generatePDFForSession(sessionId: string) {
  try {
    // 1. Load the session
    const { data: session, error: sErr } = await getSupabaseServer()
      .from('conference_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();
    if (sErr || !session) throw new Error('Session not found.');

    // 2. Load every topic + faculty link in that session
    const { data: topics, error: tErr } = await getSupabaseServer()
      .from('session_topics')
      .select(`
        id, topic_title, start_time, end_time, sequence_no,
        faculty_topics ( role, faculty ( canonical_name, phone, email ) )
      `)
      .eq('session_id', sessionId)
      .order('sequence_no', { ascending: true });
    if (tErr) throw new Error('Topics load failed: ' + tErr.message);

    // 3. Lead coordinators, in the order arranged in the Edit coordinators dialog
    const { data: leadCoordRows } = await getSupabaseServer()
      .from('session_coordinators')
      .select('role, coord_id, faculty ( canonical_name, phone, email )')
      .eq('session_id', sessionId)
      .eq('role', 'Lead Coordinator');
    const leads = sortCoordinators((leadCoordRows || []) as any[])
      .map((c: any) => c.faculty)
      .filter((f: any) => !isTbdPerson(f));

    const d = new Date(session.session_date);
    const formattedDate = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    const h = (v: any) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const time12 = (a: any, b: any) => `${fmt12hForEmail(a)} &ndash; ${fmt12hForEmail(b)}`;

    // 4. Build one combined HTML page
    const rowsHtml = (topics || []).map((t: any) => {
      const facultyStr = (t.faculty_topics || [])
        .map((ft: any) => ((ft.faculty) as any)?.canonical_name || '')
        .filter(Boolean)
        .map(h)
        .join(', ');
      const roleStr = (t.faculty_topics || [])
        .map((ft: any) => ft.role || 'Faculty')
        .filter((v: any, i: number, a: any[]) => a.indexOf(v) === i)
        .map(h)
        .join(' / ');
      return `
        <tr>
          <td style="padding:6px;border:1px solid #ddd;text-align:center;">${h(t.sequence_no)}</td>
          <td style="padding:6px;border:1px solid #ddd;">${h(t.topic_title)}</td>
          <td style="padding:6px;border:1px solid #ddd;font-size:9pt;">${facultyStr || '&mdash;'}</td>
          <td style="padding:6px;border:1px solid #ddd;text-align:center;">${roleStr}</td>
          <td style="padding:6px;border:1px solid #ddd;white-space:nowrap;">${time12(t.start_time, t.end_time)}</td>
        </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
      <html><head><meta charset="utf-8"/><style>
        body { margin:0; padding:0; font-family: Arial, sans-serif; font-size: 10pt; }
        .page { padding: 30px; page-break-after: always; }
      </style></head><body>
      <div class="page">
        <div style="text-align:center;margin-bottom:16px;">
          <h2 style="margin:0;font-size:13pt;">DERMACON International 2027</h2>
          <hr style="margin-top:10px;border:1px solid #ccc;" />
        </div>

        <div style="font-size:9pt;margin-bottom:8px;">DATE: ${new Date().toLocaleDateString('en-GB')}</div>
        <h3 style="font-size:12pt;margin-bottom:12px;">${h(session.session_code)} &ndash; ${h(session.session_name)}</h3>

        <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:9pt;">
          <tr><td style="padding:6px;border:1px solid #ddd;background:#f8f9fa;width:22%;"><strong>DATE</strong></td>
              <td style="padding:6px;border:1px solid #ddd;">${h(formattedDate)}</td></tr>
          <tr><td style="padding:6px;border:1px solid #ddd;background:#f8f9fa;"><strong>HALL</strong></td>
              <td style="padding:6px;border:1px solid #ddd;">${h(session.hall || 'TBD')}</td></tr>
          <tr><td style="padding:6px;border:1px solid #ddd;background:#f8f9fa;"><strong>TIME</strong></td>
              <td style="padding:6px;border:1px solid #ddd;">${time12(session.start_time, session.end_time)}</td></tr>
          <tr><td style="padding:6px;border:1px solid #ddd;background:#f8f9fa;"><strong>TYPE</strong></td>
              <td style="padding:6px;border:1px solid #ddd;">${h(session.session_type || '') || '&mdash;'}</td></tr>
        </table>

        <h4 style="margin-bottom:6px;">PROGRAMME</h4>
        <table style="width:100%;border-collapse:collapse;font-size:9pt;">
          <tr style="background:#003366;color:white;">
            <th style="padding:6px;border:1px solid #ddd;text-align:center;width:6%;">Seq</th>
            <th style="padding:6px;border:1px solid #ddd;text-align:left;">Topic</th>
            <th style="padding:6px;border:1px solid #ddd;text-align:left;width:24%;">Faculty</th>
            <th style="padding:6px;border:1px solid #ddd;text-align:center;width:13%;">Role</th>
            <th style="padding:6px;border:1px solid #ddd;text-align:center;width:22%;">Time</th>
          </tr>
          ${rowsHtml}
        </table>

        ${leads.length ? `<p style="font-size:9pt;margin-top:18px;">For any queries, please contact:</p>
        ${leads.map((lead: any) => `<p style="font-size:9pt;"><strong>${h(lead.canonical_name)}</strong>${lead.phone ? ` | ${h(lead.phone)}` : ''}${lead.email ? ` | ${h(lead.email)}` : ''}</p>`).join('')}` : ''}
        <p style="font-size:9pt;margin-top:18px;">Warm regards,</p>
        <p style="font-size:9pt;"><strong>Workshop Committee</strong></p>
      </div>
      </body></html>`;

    // 5. Render to PDF with Puppeteer
    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--allow-file-access-from-files'],
      headless: true,
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' as any });
    
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
    await browser.close();

    // 6. Save under /public/pdfs/
    const safeCode = (session.session_code || 'session').replace(/[^a-z0-9]/gi, '_');
    const fileName = `Session_${safeCode}_${Date.now()}.pdf`;
    const dir = path.join(process.cwd(), 'public', 'pdfs');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, fileName), pdfBuffer);

    return { success: true, url: `/api/pdfs/${fileName}` };
  } catch (error: any) {
    console.error('Session PDF failed:', error);
    return { success: false, message: error.message || 'Unknown error' };
  }
}

// Convenience wrapper: generate PDFs for every faculty member currently
// assigned to topics in this session. Returns the list of {facultyId,
// url} so the caller can show a "Download all" summary.
export async function generatePDFsForSessionFaculty(sessionId: string) {
  try {
    const { data: links } = await getSupabaseServer()
      .from('session_topics')
      .select(`faculty_topics ( faculty_id )`)
      .eq('session_id', sessionId);

    const facultyIds = Array.from(
      new Set(
        (links || [])
          .flatMap((t: any) => (t.faculty_topics || []).map((ft: any) => ft.faculty_id))
          .filter(Boolean)
      )
    ) as string[];

    // Chairpersons of the whole session get a PDF too
    const { data: chairLinks } = await getSupabaseServer().from('session_chairs').select('faculty_id').eq('session_id', sessionId);
    (chairLinks || []).forEach((c: any) => { if (c.faculty_id && !facultyIds.includes(c.faculty_id)) facultyIds.push(c.faculty_id); });

    const results: { facultyId: string; url?: string; error?: string }[] = [];
    for (const fid of facultyIds) {
      const r = await generatePDFData(fid);
      results.push({
        facultyId: fid,
        url: r.success ? r.url : undefined,
        error: r.success ? undefined : r.message,
      });
    }
    return { success: true, results };
  } catch (error: any) {
    return { success: false, message: error.message || 'Unknown error' };
  }
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  Task #7: auto-resequence by start_time
//  Call this after any insert/update/delete on session_topics.
//  Rebuilds sequence_no for the whole session atomically. Safe to call
//  repeatedly. Returns the updated numbering for diagnostics.
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function resequenceSession(sessionId: string) {
  const { data, error } = await getSupabaseServer().rpc('resequence_session', {
    p_session_id: sessionId,
  });
  if (error) {
    return { success: false, message: error.message, rows: [] };
  }
  return { success: true, message: 'Resequenced.', rows: data ?? [] };
}
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//  Task #10: delete a topic, then resequence its session.
//  faculty_topics has ON DELETE CASCADE in the schema, so faculty links
//  to this topic are removed automatically - no orphans possible.
//  resequence_session() runs AFTER, so remaining topics renumber 1..N
//  with no gaps and no collisions.
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function deleteTopic(topicId: string, sessionId: string) {
  if (!topicId)   return { success: false, message: 'Missing topic id.'   };
  if (!sessionId) return { success: false, message: 'Missing session id.' };

  // Defence in depth: confirm the topic belongs to the claimed session.
  const { data: existing, error: lookupErr } = await getSupabaseServer()
    .from('session_topics')
    .select('id, session_id')
    .eq('id', topicId)
    .maybeSingle();

  if (lookupErr) return { success: false, message: lookupErr.message };
  if (!existing) return { success: false, message: 'Topic not found (already deleted?).' };
  if (existing.session_id !== sessionId) {
    return { success: false, message: 'Topic does not belong to this session.' };
  }

  const { error: delErr } = await getSupabaseServer()
    .from('session_topics')
    .delete()
    .eq('id', topicId);

  if (delErr) return { success: false, message: delErr.message };

  // Renumber the remaining topics in this session
  const { error: reseqErr } = await getSupabaseServer().rpc('resequence_session', {
    p_session_id: sessionId,
  });
  if (reseqErr) {
    // The delete succeeded; only the resequence failed. Report it but
    // do NOT rollback - the caller will reload and see a clean state,
    // and the user can hit "Resequence All" from npm if needed.
    return { success: true, message: `Topic deleted, but resequence failed: ${reseqErr.message}` };
  }

  return { success: true, message: 'Topic deleted and session resequenced.' };
}

// ─────────────────────────────────────────────────────────────────────
//  Google Script integration
//  Rules: nothing is emailed automatically. Every send goes through the
//  confirmation dialog in the app, one faculty at a time, with a delay.
// ─────────────────────────────────────────────────────────────────────
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyqgZy0yQ2npUqS2BNwRuCML-SZTfj9yU0jsnoz-i0UmUnbuRTE17Ccuo6bGCDDSxlG/exec";
const UNEXPECTED_REPLY =
  'The Google Script gave an unexpected reply. Open Apps Script > Deploy > Manage deployments > pencil > New version > Deploy, then try again.';

function scriptToken() {
  return process.env.SYNC_TOKEN || '';
}

async function blockInDemo(what?: string) {
  if (await isDemoMode()) {
    throw new Error(what ? `Demo mode: ${what} is switched off.` : 'Demo mode: emails and Google sync are switched off.');
  }
}

async function callScript(body: any) {
  await blockInDemo();
  const res = await fetch(SCRIPT_URL, {
    method: 'POST',
    body: JSON.stringify({ ...body, token: scriptToken() }),
    cache: 'no-store',
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch { throw new Error(UNEXPECTED_REPLY); }
}

async function getFromScript(params: Record<string, string>) {
  await blockInDemo();
  const q = new URLSearchParams({ ...params, token: scriptToken() });
  const res = await fetch(`${SCRIPT_URL}?${q.toString()}`, { cache: 'no-store' });
  const text = await res.text();
  try { return JSON.parse(text); } catch { throw new Error(UNEXPECTED_REPLY); }
}

function safeFileName(name: string | null | undefined) {
  return String(name || 'Faculty').replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '');
}

function isTbdPerson(f: any) {
  return !f || f.faculty_id === 'FAC000' || /^TBD/i.test(String(f.canonical_name || '').trim());
}

function validEmail(e: string | null | undefined) {
  return !!e && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) && !/@placeholder\.com$/i.test(e);
}

function roleDisplay(role: string | null | undefined) {
  const r = role || 'Faculty';
  return r === 'Panel' ? 'Panelist' : r;
}

async function renderPdfBuffer(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: true,
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const buf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    return Buffer.from(buf);
  } finally {
    await browser.close();
  }
}

function prefilledFormLink(name: string, phone: string, sessionCodes: string) {
  return "https://docs.google.com/forms/d/e/1FAIpQLSdxz_5YnX30AkhVuTEBYiTjAU5Ps38Qa_-Fx-uQS3fbG1cWcg/viewform?usp=pp_url" +
    "&entry.640056832=" + encodeURIComponent(name || "") +
    "&entry.778392849=" + encodeURIComponent(phone || "") +
    "&entry.1359171350=" + encodeURIComponent(sessionCodes || "");
}

// Everything one faculty member is assigned to (speaker, moderator, panelist AND chair),
// shaped for the Google Script, the PDF and the preview dialog.
// Which of a person's topics go into a letter / PDF. Nothing set = everything.
// topicIds: exact topics (a whole-session chair row has the id "chair:<session id>").
// group: only workshops (session code WS.. / MC..) or only scientific sessions (all others).
type TopicFilter = { topicIds?: string[]; group?: 'scientific' | 'workshop' | 'all' | null };

function groupOfSession(code: string | null | undefined): 'workshop' | 'scientific' {
  return isWorkshopSession(code) ? 'workshop' : 'scientific';
}

async function buildFacultyPayload(faculty: any, opts: { coordinators?: boolean; materialize?: boolean } & TopicFilter = {}) {
  const withCoord = opts.coordinators !== false;

  const { data: rows, error } = await getSupabaseServer()
    .from('faculty_topics')
    .select(`role, confirmed, session_topics ( id, topic_title, start_time, end_time, sequence_no, all_faculty_panel, conference_sessions ( id, session_code, session_name, session_type, session_date, hall, start_time, end_time ) )`)
    .eq('faculty_id', faculty.id);
  if (error) throw error;

  const topicRows = (rows || []).filter((r: any) => r.session_topics?.conference_sessions);

  // Chairperson for a whole session: shown in the letter like a topic that covers the whole session.
  // (Its id is "chair:<session id>"; Sync uses it to find the confirmation.)
  const { data: chairRows } = await getSupabaseServer()
    .from('session_chairs')
    .select('confirmed, session_id, conference_sessions ( id, session_code, session_name, session_type, session_date, hall, start_time, end_time )')
    .eq('faculty_id', faculty.id);
  const wholeSessionRows = ((chairRows || []) as any[]).filter((r) => r.conference_sessions).map((r) => ({
    role: 'Chairperson', confirmed: !!r.confirmed, wholeSession: true,
    session_topics: {
      id: `chair:${r.session_id}`, topic_title: 'Chairperson for the whole session',
      start_time: r.conference_sessions.start_time, end_time: r.conference_sessions.end_time,
      sequence_no: 0, conference_sessions: r.conference_sessions,
    },
  }));

  // Panels marked "all faculty of the session": everyone with a topic in that session is a
  // panelist of it, even without a row of their own. Those get a "virtual" Panelist row here.
  const SESSION_COLS = 'id, session_code, session_name, session_type, session_date, hall, start_time, end_time';
  const roleIsSessionMember = (role: string | null | undefined) => role !== 'Chairperson' && role !== 'Coordinator';
  const memberSessionIds = [...new Set(topicRows.filter((r: any) => roleIsSessionMember(r.role)).map((r: any) => r.session_topics.conference_sessions.id))] as string[];
  const virtualRows: any[] = [];
  if (memberSessionIds.length) {
    const { data: flagged } = await getSupabaseServer()
      .from('session_topics')
      .select(`id, topic_title, start_time, end_time, sequence_no, all_faculty_panel, conference_sessions ( ${SESSION_COLS} )`)
      .eq('all_faculty_panel', true)
      .in('session_id', memberSessionIds);
    const have = new Set(topicRows.map((r: any) => r.session_topics.id));
    for (const t of (flagged || []) as any[]) {
      if (have.has(t.id) || !t.conference_sessions) continue;
      virtualRows.push({ role: 'Panelist', confirmed: false, virtual: true, session_topics: t });
    }
  }

  // When emailing (or previewing the email), make those panel rows real, so the person can confirm
  // the topic like any other and Sync can record it (confirmation is kept on faculty_topics).
  if (opts.materialize && virtualRows.length) {
    const { error: matErr } = await getSupabaseServer().from('faculty_topics').upsert(
      virtualRows.map((v: any) => ({ faculty_id: faculty.id, topic_id: v.session_topics.id, role: 'Panel' })),
      { onConflict: 'faculty_id,topic_id', ignoreDuplicates: true },
    );
    if (!matErr) virtualRows.forEach((v: any) => { v.virtual = false; });
  }

  const allMine = [...topicRows, ...virtualRows, ...wholeSessionRows];
  if (!allMine.length) throw new Error("No session topics assigned to this faculty member.");

  // Everything this person has, for the "which topics?" pickers (never filtered)
  const choices = allMine.map((r: any) => ({
    topicId: r.session_topics.id as string,
    session: r.session_topics.conference_sessions.session_code as string,
    title: (r.session_topics.topic_title || '') as string,
    role: roleDisplay(r.role || 'Faculty'),
    hall: r.session_topics.conference_sessions.hall || 'TBD',
    time: `${fmt12hForEmail(r.session_topics.start_time)} - ${fmt12hForEmail(r.session_topics.end_time)}`,
    group: groupOfSession(r.session_topics.conference_sessions.session_code),
    confirmed: !!r.confirmed,
  }));

  const wanted = opts.topicIds && opts.topicIds.length ? new Set(opts.topicIds) : null;
  const mine = allMine.filter((r: any) =>
    (!wanted || wanted.has(r.session_topics.id)) &&
    (!opts.group || opts.group === 'all' || groupOfSession(r.session_topics.conference_sessions.session_code) === opts.group));
  if (!mine.length) throw new Error('None of this person\'s topics match the selection.');

  // Speakers of the topics this person chairs (listed in their letter)
  // Also, for panels / debates: the moderator and the other panelists of the topics this person is on
  const chairTopicIds = mine.filter((r: any) => r.role === 'Chairperson' && !r.wholeSession).map((r: any) => r.session_topics.id);
  const panelTopicIds = mine.filter((r: any) => isPanelRole(r.role)).map((r: any) => r.session_topics.id);
  const speakersByTopic: Record<string, string[]> = {};
  const panelByTopic: Record<string, PanelGroups> = {};
  const lookupIds = [...new Set([...chairTopicIds, ...panelTopicIds])];
  if (lookupIds.length) {
    const { data: sp } = await getSupabaseServer()
      .from('faculty_topics')
      .select('topic_id, role, sort_order, faculty ( id, canonical_name, faculty_id )')
      .in('topic_id', lookupIds);
    const byTopic: Record<string, any[]> = {};
    sortTopicPeople((sp || []).filter((x: any) => !isTbdPerson(x.faculty))).forEach((x: any) => {
      (byTopic[x.topic_id] ||= []).push(x);
    });
    for (const tid of lookupIds) {
      const people = byTopic[tid] || [];
      speakersByTopic[tid] = people.filter((x) => x.role !== 'Chairperson').map((x) => x.faculty.canonical_name);
      // the reader of the letter is left out of "the others"
      panelByTopic[tid] = panelGroups(
        people.map((x) => ({ role: x.role, sort_order: x.sort_order, name: x.faculty.canonical_name, id: x.faculty.id })),
        faculty.id,
      );
    }

    // "All faculty of the session" panels: add everyone else who has a topic in that session as a panelist
    const allPanelRows = mine.filter((r: any) => r.session_topics.all_faculty_panel && lookupIds.includes(r.session_topics.id));
    const allPanelSessionIds = [...new Set(allPanelRows.map((r: any) => r.session_topics.conference_sessions.id))] as string[];
    if (allPanelSessionIds.length) {
      const { data: members } = await getSupabaseServer()
        .from('faculty_topics')
        .select('topic_id, role, faculty ( id, canonical_name, faculty_id ), session_topics!inner ( session_id )')
        .in('session_topics.session_id', allPanelSessionIds);
      const bySession: Record<string, Map<string, string>> = {};
      for (const m of (members || []) as any[]) {
        if (!roleIsSessionMember(m.role) || isTbdPerson(m.faculty)) continue;
        (bySession[m.session_topics.session_id] ||= new Map()).set(m.faculty.id, m.faculty.canonical_name);
      }
      for (const r of allPanelRows as any[]) {
        const tid = r.session_topics.id as string;
        const g = panelByTopic[tid];
        if (!g) continue;
        const named = new Set([...g.moderators, ...g.panelists, ...g.debaters]);
        const explicitIds = new Set((byTopic[tid] || []).map((x: any) => x.faculty.id));
        const extra = [...(bySession[r.session_topics.conference_sessions.id] || new Map<string, string>()).entries()]
          .filter(([id, name]) => id !== faculty.id && !explicitIds.has(id) && !named.has(name))
          .map(([, name]) => name)
          .sort((a, b) => a.localeCompare(b));
        g.panelists.push(...extra);
      }
    }
  }
  const panelFor = (i: any): PanelGroups | undefined => (isPanelRole(i.role) ? panelByTopic[i.topic.id] : undefined);

  // Lead coordinators once per session (shown in the letter as the contact).
  // A session can have more than one lead, so load them all in the order arranged in
  // the Edit coordinators dialog (session_coordinators.coord_id) instead of just one.
  const sessionIds = [...new Set(mine.map((r: any) => r.session_topics.conference_sessions.id))] as string[];
  const leadsBySession: Record<string, { name: string; phone: string; email: string }[]> = {};
  for (const sid of sessionIds) {
    let leads: { name: string; phone: string; email: string }[] = [];
    if (withCoord) {
      const { data: coordData } = await getSupabaseServer()
        .from('session_coordinators')
        .select('role, coord_id, faculty ( canonical_name, phone, email )')
        .eq('session_id', sid).eq('role', 'Lead Coordinator');
      leads = sortCoordinators((coordData || []) as any[])
        .map((c: any) => c.faculty)
        .filter((f: any) => !isTbdPerson(f))
        .map((f: any) => ({ name: f.canonical_name || '', phone: f.phone || '', email: f.email || '' }));
    }
    leadsBySession[sid] = leads;
  }
  // First lead stays the single contact used in the email body (Google Script template)
  const coordBySession: Record<string, { name: string; phone: string; email: string }> = {};
  for (const sid of sessionIds) {
    coordBySession[sid] = leadsBySession[sid][0] || { name: '', phone: '', email: '' };
  }

  const items = mine.map((r: any) => {
    const topic = r.session_topics;
    const session = topic.conference_sessions;
    return { r, topic, session, role: r.role || 'Faculty', coord: coordBySession[session.id], coords: leadsBySession[session.id] || [] };
  }).sort((a: any, b: any) =>
    String(a.session.session_date ?? '').localeCompare(String(b.session.session_date ?? '')) ||
    String(a.session.session_code ?? '').localeCompare(String(b.session.session_code ?? ''), undefined, { numeric: true }) ||
    (a.topic.sequence_no ?? 0) - (b.topic.sequence_no ?? 0) ||
    String(a.topic.start_time ?? '').localeCompare(String(b.topic.start_time ?? ''))
  );

  const roleText = [...new Set(items.map((i: any) => roleDisplay(i.role)))].join(' & ');
  const assignedSessionCodes = [...new Set(items.map((i: any) => i.session.session_code))].join(',');

  // Per-topic status, so the email and the form can show what is new and what is already
  // confirmed. Nothing is tagged until the faculty has confirmed at least one topic.
  // (Based on the last Sync, so press Sync before sending.)
  const anyConfirmed = items.some((i: any) => i.r.confirmed);
  const statusOf = (i: any): '' | 'confirmed' | 'new' => (i.r.virtual ? '' : i.r.confirmed ? 'confirmed' : anyConfirmed ? 'new' : '');
  const formSessions = items.filter((i: any) => !i.r.virtual).map((i: any) => {
    const st = statusOf(i);
    const tag = st === 'confirmed' ? ' (already confirmed)' : st === 'new' ? ' (new - please confirm)' : '';
    return `${i.session.session_code} - ${i.topic.topic_title || 'Topic'} (${roleDisplay(i.role)})${tag}`;
  }).join('\n');
  const pendingTopics = items.filter((i: any) => !i.r.confirmed && !i.r.virtual).map((i: any) =>
    `${i.session.session_code} - ${i.topic.topic_title || 'Topic'}`);

  const sessionsData = items.map((i: any) => ({
    status: statusOf(i),
    topic_id: i.topic.id,
    faculty_id: faculty.id,
    // Same text the form shows for this topic; the script uses it to see which lines the faculty deleted
    form_line: i.r.virtual ? '' : `${i.session.session_code} - ${i.topic.topic_title || 'Topic'}`,
    role: i.role,
    speakers: i.role === 'Chairperson' ? (speakersByTopic[i.topic.id] || []) : [],
    panel: panelFor(i),
    session_code: i.session.session_code,
    session_name: i.session.session_name,
    session_hall: i.session.hall || 'TBD',
    date: fmtDateForEmail(i.session.session_date),
    session_time: `${fmt12hForEmail(i.session.start_time)} - ${fmt12hForEmail(i.session.end_time)}`,
    topic: i.topic.topic_title || '',
    time: `${fmt12hForEmail(i.topic.start_time)} - ${fmt12hForEmail(i.topic.end_time)}`,
    coordName: i.coord.name, coordPhone: i.coord.phone, coordEmail: i.coord.email,
  }));

  // One PDF page per session
  const bySession = new Map<string, any>();
  for (const i of items) {
    if (!bySession.has(i.session.id)) {
      bySession.set(i.session.id, { session: i.session, topics: [], role: roleText, coordinator: i.coord, coordinators: i.coords });
    }
    bySession.get(i.session.id).topics.push({
      topic_title: i.topic.topic_title,
      start_time: i.topic.start_time,
      end_time: i.topic.end_time,
      sequence_no: i.topic.sequence_no,
      role: roleDisplay(i.role),
      speakers: i.role === 'Chairperson' ? (speakersByTopic[i.topic.id] || []) : [],
      panel: panelFor(i),
    });
  }
  const pdfInput = {
    faculty: { canonical_name: faculty.canonical_name, phone: faculty.phone || '' },
    sessions: [...bySession.values()],
    formLink: prefilledFormLink(faculty.canonical_name, faculty.phone || '', formSessions),
  };

  const topics = items.map((i: any) => ({
    topicId: i.topic.id,
    title: i.topic.topic_title || '',
    session: i.session.session_code,
    hall: i.session.hall || 'TBD',
    time: `${fmt12hForEmail(i.topic.start_time)} - ${fmt12hForEmail(i.topic.end_time)}`,
    role: roleDisplay(i.role),
    confirmed: !!i.r.confirmed,
  }));

  return { sessionsData, pdfInput, assignedSessionCodes, formSessions, pendingTopics, role: roleText, topics, choices, sentTopicIds: items.map((i: any) => i.topic.id as string), sentSessionCodes: [...new Set(items.map((i: any) => i.session.session_code as string))] };
}

// ─── Pending changes (written by database triggers into change_log) ───
function describeChange(c: any): string {
  const t = c.topic_title ? `"${c.topic_title}"` : '';
  const where = c.session_code ? ` (${c.session_code})` : '';
  switch (c.event_type) {
    case 'faculty_assigned': return `Added to ${t}${where}${c.detail ? ' – ' + c.detail : ''}`;
    case 'session_chair_added':   return `Added as Chairperson for the whole session${where}`;
    case 'session_chair_removed': return `Removed as Chairperson for the whole session${where}`;
    case 'chair_added':      return `Added as Chairperson for ${t}${where}`;
    case 'chair_removed':    return `Removed as Chairperson from ${t}${where}`;
    case 'faculty_removed':  return `Removed from ${t}${where}`;
    case 'role_changed':     return `Role changed for ${t}${where}: ${c.detail || ''}`;
    case 'topic_edited':     return `Updated ${t}${where}: ${c.detail || ''}`;
    case 'topic_removed':    return `Topic cancelled: ${t}${where}`;
    case 'session_edited':   return `Session ${c.session_code} updated: ${c.detail || ''}`;
    default:                 return c.detail || c.event_type;
  }
}

// Cancels "added then removed" pairs and drops duplicate lines
function netChanges(rows: any[]) {
  const out: any[] = [];
  for (const c of rows) {
    if (c.event_type === 'session_chair_removed') {
      const k = out.findIndex((o) => o.event_type === 'session_chair_added' && o.session_code === c.session_code);
      if (k >= 0) { out.splice(k, 1); continue; }
    }
    const isRemove = c.event_type === 'faculty_removed' || c.event_type === 'chair_removed';
    if (isRemove) {
      const idx = out.findIndex((o) => o.topic_id === c.topic_id && (o.event_type === 'faculty_assigned' || o.event_type === 'chair_added') &&
        (o.event_type === 'chair_added') === (c.event_type === 'chair_removed'));
      if (idx >= 0) { out.splice(idx, 1); continue; }
    }
    out.push(c);
  }
  const seen = new Set<string>();
  return out.filter((c) => {
    const line = describeChange(c);
    if (seen.has(line)) return false;
    seen.add(line);
    return true;
  });
}

async function pendingChangesFor(facultyId: string) {
  const { data } = await getSupabaseServer()
    .from('change_log').select('*')
    .eq('faculty_id', facultyId).eq('notify', true).is('notified_at', null)
    .order('id', { ascending: true });
  const rows = netChanges(data || []);
  return { rows, lines: rows.map(describeChange), ids: (data || []).map((r: any) => r.id) as number[], raw: data || [] };
}

// Only the pending changes that belong to the topics being sent are shown in the email and
// cleared afterwards; changes for topics left out stay pending for a later email.
function pendingForSelection(
  pending: { rows: any[]; lines: string[]; ids: number[] },
  sent: { topicIds: string[]; sessionCodes: string[] },
  filter: TopicFilter,
) {
  const restricted = !!(filter.topicIds && filter.topicIds.length) || (!!filter.group && filter.group !== 'all');
  if (!restricted) return pending;
  const topics = new Set(sent.topicIds);
  const sessions = new Set(sent.sessionCodes);
  const keep = (c: any) =>
    (c.topic_id && topics.has(c.topic_id)) ||
    (c.session_code && sessions.has(c.session_code)) ||
    (!!filter.group && filter.group !== 'all' && !!c.session_code && groupOfSession(c.session_code) === filter.group);
  const rows = pending.rows.filter(keep);
  // The `ids` list holds every raw row; clear only the raw rows whose own topic/session is part of this send
  const ids = (pending as any).raw ? (pending as any).raw.filter(keep).map((r: any) => r.id) : pending.ids;
  return { rows, lines: rows.map(describeChange), ids };
}

// ─── Quota, preview (what WILL happen) ───
// How many faculty have been emailed: in total and today (India time). Informational only, nothing is blocked.
export async function getEmailCounts() {
  try {
    const db = getSupabaseServer();
    const IST = 5.5 * 3600 * 1000;
    const nowIst = new Date(Date.now() + IST);
    const startOfTodayUtc = new Date(Date.UTC(nowIst.getUTCFullYear(), nowIst.getUTCMonth(), nowIst.getUTCDate()) - IST).toISOString();
    const [total, today, everyone] = await Promise.all([
      db.from('faculty').select('id', { count: 'exact', head: true }).eq('email_sent', true),
      db.from('faculty').select('id', { count: 'exact', head: true }).eq('email_sent', true).gte('email_sent_date', startOfTodayUtc),
      db.from('faculty').select('id', { count: 'exact', head: true }),
    ]);
    return { success: true, emailed: total.count ?? 0, today: today.count ?? 0, faculty: everyone.count ?? 0 };
  } catch (e: any) {
    return { success: false, emailed: 0, today: 0, faculty: 0, message: e?.message || 'Could not count the emails.' };
  }
}

export async function getEmailQuota() {
  try {
    const r = await getFromScript({ action: 'quota' });
    if (r.error) return { success: false, message: r.error, quota: 0, reserve: 5 };
    return { success: true, quota: Number(r.quota) || 0, reserve: Number(r.reserve) || 5 };
  } catch (e: any) {
    return { success: false, message: e?.message || 'Could not reach the Google Script.', quota: 0, reserve: 5 };
  }
}

type EmailKind = 'first' | 'update' | 'reminder';

export async function previewEmails(items: { facultyId: string; kind: EmailKind }[]) {
  const counts = await getEmailCounts();
  const rows: any[] = [];
  for (let i = 0; i < items.length; i += 8) {
    const batch = items.slice(i, i + 8);
    const res = await Promise.all(batch.map(async (it) => {
      const { data: faculty } = await getSupabaseServer().from('faculty').select('*').eq('id', it.facultyId).single();
      if (!faculty) return { facultyId: it.facultyId, kind: it.kind, name: 'Unknown', email: '', problem: 'Faculty not found.', topics: [], changes: [], changeItems: [] };
      const base = { facultyId: faculty.id, kind: it.kind, name: faculty.canonical_name, email: faculty.email || '', topics: [] as any[], changes: [] as string[], changeItems: [] as any[], problem: '' };
      if (!validEmail(faculty.email)) return { ...base, problem: 'No valid email address.' };
      try {
        const p = await buildFacultyPayload(faculty, { coordinators: false, materialize: true });
        // Always load pending changes (except reminders) so the dialog can switch first <-> update
        const pending = it.kind !== 'reminder' ? await pendingChangesFor(faculty.id) : { rows: [], lines: [], ids: [] };
        const changedTopics = new Set(pending.rows.map((c: any) => c.topic_id).filter(Boolean));
        return {
          ...base,
          topics: p.choices.map((t: any) => ({ ...t, isNew: changedTopics.has(t.topicId) })),
          changes: pending.lines,
          // each change with the topic/session it belongs to, so the dialog can hide changes for topics left out
          changeItems: pending.rows.map((c: any) => ({ line: describeChange(c), topicId: c.topic_id || '', session: c.session_code || '' })),
        };
      } catch (e: any) {
        return { ...base, problem: e?.message || 'Could not prepare this email.' };
      }
    }));
    rows.push(...res);
  }
  return { success: true, counts, rows };
}

// ─── Send ONE email (the dialog calls this once per faculty, with a delay between) ───
type SendOptions = TopicFilter & { sender?: 'workshop' | 'scientific' };

export async function sendEmailToFaculty(facultyId: string, kind: EmailKind, opts: SendOptions = {}) {
  try {
    const filter: TopicFilter = { topicIds: opts.topicIds, group: opts.group };
    const sender = opts.sender === 'scientific' ? 'scientific' : 'workshop';
    const { data: faculty } = await getSupabaseServer().from('faculty').select('*').eq('id', facultyId).single();
    if (!faculty) return { success: false, message: 'Faculty not found.' };
    if (!validEmail(faculty.email)) return { success: false, message: 'No valid email address.' };

    if (kind === 'reminder') {
      const p = await buildFacultyPayload(faculty, { coordinators: false, ...filter });
      const r = await callScript({
        action: 'sendReminder', sender, name: faculty.canonical_name, email: faculty.email,
        phone: faculty.phone || '', sessions: p.assignedSessionCodes, formSessions: p.formSessions,
        pendingTopics: p.pendingTopics, sessionsData: p.sessionsData,
      });
      if (r.status !== 'Success') return { success: false, message: r.message || 'Failed to send.', quotaLeft: r.quotaLeft };
      await getSupabaseServer().from('faculty').update({ reminder_sent: true }).eq('id', faculty.id);
      return { success: true, message: 'Reminder sent.', quotaLeft: r.quotaLeft };
    }

    const p = await buildFacultyPayload(faculty, { ...filter, materialize: true });
    const pending = pendingForSelection(
      await pendingChangesFor(faculty.id),
      { topicIds: p.sentTopicIds, sessionCodes: p.sentSessionCodes },
      filter,
    );

    // ONE PDF with one page per session. If it fails the email still goes, without it.
    let pdfs: { name: string; base64: string }[] = [];
    let pdfWarning = '';
    try {
      const buf = await renderPdfBuffer(renderCommitmentHTML(p.pdfInput));
      pdfs = [{ name: `DERMACON2027_${safeFileName(faculty.canonical_name)}.pdf`, base64: buf.toString('base64') }];
    } catch (pdfErr: any) {
      console.error('PDF generation failed:', pdfErr);
      pdfWarning = ` The PDF could not be attached (${pdfErr?.message || 'PDF generation failed'}).`;
    }

    const r = await callScript({
      action: kind === 'update' ? 'sendScheduleUpdate' : 'sendFormLink', sender,
      facultyId: faculty.id, name: faculty.canonical_name, email: faculty.email, phone: faculty.phone || '',
      role: p.role, sessions: p.assignedSessionCodes, formSessions: p.formSessions, sessionsData: p.sessionsData, pdfs,
      changes: kind === 'update' ? pending.lines : [],
    });
    if (r.status !== 'Success') return { success: false, message: r.message || 'Failed to send.', quotaLeft: r.quotaLeft };

    // Sent: remember it, and clear this faculty's pending changes (the letter now shows everything)
    await getSupabaseServer().from('faculty').update({ email_sent: true, email_sent_date: new Date().toISOString(), reminder_sent: false }).eq('id', faculty.id);
    // Emailed now, so no longer "reviewed without email" (separate call: must not block the line above)
    await getSupabaseServer().from('faculty').update({ reviewed_at: null }).eq('id', faculty.id);
    if (pending.ids.length) {
      await getSupabaseServer().from('change_log').update({ notified_at: new Date().toISOString() }).in('id', pending.ids);
    }
    const attached = typeof r.pdfsAttached === 'number' ? r.pdfsAttached : null;
    const pdfNote = pdfWarning || (attached === null ? ' (old Google Script version: PDF not confirmed)' : attached === pdfs.length ? ` with ${attached} PDF` : ' but the PDF was not attached');
    return { success: true, message: `Email sent${pdfNote}.`, quotaLeft: r.quotaLeft };
  } catch (e: any) {
    console.error('sendEmailToFaculty failed:', e);
    return { success: false, message: e?.message || 'Failed to connect to the Google Script.' };
  }
}

// ─── Thank-you: the "participation confirmed" letter, sent on demand for the topics this person has confirmed ───
export async function sendThankYouToFaculty(facultyId: string) {
  try {
    const { data: faculty } = await getSupabaseServer().from('faculty').select('*').eq('id', facultyId).single();
    if (!faculty) return { success: false, message: 'Faculty not found.' };
    if (!validEmail(faculty.email)) return { success: false, message: 'No valid email address.' };

    const all = await buildFacultyPayload(faculty, { coordinators: false });
    const confirmedIds = all.choices.filter((c: any) => c.confirmed).map((c: any) => c.topicId);
    if (confirmedIds.length === 0) return { success: false, message: 'Nothing is confirmed yet, so there is nothing to thank them for.' };

    const p = await buildFacultyPayload(faculty, { coordinators: false, topicIds: confirmedIds });
    let pdfs: { name: string; base64: string }[] = [];
    try {
      const buf = await renderPdfBuffer(renderCommitmentHTML(p.pdfInput));
      pdfs = [{ name: `DERMACON2027_${safeFileName(faculty.canonical_name)}.pdf`, base64: buf.toString('base64') }];
    } catch (pdfErr) { console.error('PDF generation failed:', pdfErr); }

    const r = await callScript({
      action: 'sendThankYou', facultyId: faculty.id, name: faculty.canonical_name, email: faculty.email,
      phone: faculty.phone || '', role: p.role, sessions: p.assignedSessionCodes, formSessions: p.formSessions,
      sessionsData: p.sessionsData, pdfs,
    });
    if (r.status === 'Error' && r.message === 'Unknown action') {
      return { success: false, message: 'The Google Script is an older version. Deploy the latest google-script/Code.js first.' };
    }
    if (r.status !== 'Success') return { success: false, message: r.message || 'Failed to send.' };
    return { success: true, message: `Thank-you sent to ${faculty.email}.` };
  } catch (e: any) {
    console.error('sendThankYouToFaculty failed:', e);
    return { success: false, message: e?.message || 'Failed to connect to the Google Script.' };
  }
}

// ─── Emails page data ───
// "Reviewed" = looked at by hand, no email needed. Only writes faculty.reviewed_at
// so it never contacts the Google Script. Pending change rows are left untouched:
// a newer schedule change brings the person back, and unmarkFacultyReviewed() undoes it.
export async function markFacultyReviewed({ facultyIds }: { facultyIds: string[]; kind?: 'first' | 'changes' }) {
  try {
    if (!facultyIds?.length) return { success: false, message: 'Nobody selected.' };
    const now = new Date().toISOString();
    const { error } = await getSupabaseServer().from('faculty').update({ reviewed_at: now }).in('id', facultyIds);
    if (error) {
      const missing = /reviewed_at/.test(error.message || '');
      return { success: false, message: missing ? 'The reviewed_at column is missing. Run scripts/add_faculty_reviewed_at.sql in Supabase.' : error.message };
    }
    return { success: true, message: `${facultyIds.length} marked as reviewed. No email was sent.` };
  } catch (e: any) {
    return { success: false, message: e?.message || 'Could not mark as reviewed.' };
  }
}

// Undo: remove the reviewed mark, so they show up in First email / Schedule changes again.
export async function unmarkFacultyReviewed(facultyIds: string[]) {
  try {
    if (!facultyIds?.length) return { success: false, message: 'Nobody selected.' };
    const { error } = await getSupabaseServer().from('faculty').update({ reviewed_at: null }).in('id', facultyIds);
    if (error) return { success: false, message: error.message };
    return { success: true, message: `${facultyIds.length} put back on the list.` };
  } catch (e: any) {
    return { success: false, message: e?.message || 'Could not undo the review.' };
  }
}

export async function getEmailsOverview() {
  const { data: fac, error } = await getSupabaseServer()
    .from('faculty')
    .select('id, canonical_name, email, email_sent, email_sent_date, reminder_sent, reviewed_at, faculty_topics ( confirmed ), session_chairs ( confirmed )')
    .order('canonical_name');
  if (error) {
    const missing = /reviewed_at/.test(error.message || '');
    return { success: false, message: missing ? 'The reviewed_at column is missing. Run scripts/add_faculty_reviewed_at.sql in Supabase.' : error.message, first: [], changes: [], reminders: [], today: [], reviewed: [], counts: await getEmailCounts() };
  }

  const { data: pend } = await getSupabaseServer()
    .from('change_log').select('*')
    .eq('notify', true).is('notified_at', null).not('faculty_id', 'is', null)
    .order('id', { ascending: true });
  const pendByFaculty: Record<string, any[]> = {};
  (pend || []).forEach((c: any) => { (pendByFaculty[c.faculty_id] ||= []).push(c); });

  const first: any[] = [], changes: any[] = [], reminders: any[] = [], today: any[] = [], reviewedList: any[] = [];
  // Start of today in India time: who was emailed since then
  const IST = 5.5 * 3600 * 1000;
  const nowIst = new Date(Date.now() + IST);
  const startOfToday = Date.UTC(nowIst.getUTCFullYear(), nowIst.getUTCMonth(), nowIst.getUTCDate()) - IST;
  const cutoff = Date.now() - 5 * 24 * 3600 * 1000;
  for (const f of fac || []) {
    if (f.email_sent && f.email_sent_date && new Date(f.email_sent_date).getTime() >= startOfToday) {
      const n = (f.faculty_topics?.length || 0) + (f.session_chairs?.length || 0);
      const c = [...(f.faculty_topics || []), ...(f.session_chairs || [])].filter((t: any) => t.confirmed).length;
      today.push({ id: f.id, name: f.canonical_name, email: f.email || '', hasEmail: validEmail(f.email), topicCount: n, confirmedCount: c, sentAt: f.email_sent_date, sentToday: true });
    }
    // Chairing a whole session counts like one more topic
    const topicCount = (f.faculty_topics?.length || 0) + (f.session_chairs?.length || 0);
    const confirmedCount = [...(f.faculty_topics || []), ...(f.session_chairs || [])].filter((t: any) => t.confirmed).length;
    // Reviewed = marked reviewed AFTER their most recent schedule change (a newer change brings them back)
    const latestChangeAt = Math.max(0, ...(pendByFaculty[f.id] || []).map((c: any) => new Date(c.created_at).getTime()));
    const reviewed = !!f.reviewed_at && new Date(f.reviewed_at).getTime() >= latestChangeAt;
    if (reviewed) {
      // Kept in its own list so the mark can be undone. Reviewed people stay out of
      // First email / Schedule changes; the Reminders list is unaffected.
      reviewedList.push({
        id: f.id, name: f.canonical_name, email: f.email || '', hasEmail: validEmail(f.email),
        topicCount, confirmedCount, reviewedAt: f.reviewed_at,
      });
    }
    if (!topicCount) {
      // Emailed before, now removed from every topic: the letter needs at least one
      // topic, so the app cannot send it. Show it so nobody is forgotten.
      const gone = f.email_sent ? netChanges(pendByFaculty[f.id] || []) : [];
      if (!reviewed && gone.length) {
        changes.push({
          id: f.id, name: f.canonical_name, email: f.email || '', hasEmail: false, topicCount: 0, confirmedCount: 0,
          lines: gone.map(describeChange),
          note: 'Removed from all topics. The app cannot email this; tell them directly.',
        });
      }
      continue;
    }
    const base = { id: f.id, name: f.canonical_name, email: f.email || '', hasEmail: validEmail(f.email), topicCount, confirmedCount };
    const net = netChanges(pendByFaculty[f.id] || []);
    if (!f.email_sent) {
      // Not emailed yet: their first email shows the current schedule, so these
      // changes are already included. Listed so you can see them.
      if (!reviewed) first.push({ ...base, pendingLines: net.map(describeChange) });
    } else {
      if (net.length && !reviewed) changes.push({ ...base, lines: net.map(describeChange) });
      const sentAt = f.email_sent_date ? new Date(f.email_sent_date).getTime() : 0;
      // Nothing confirmed after 5 days, or some topics still unconfirmed (e.g. 3/4 after a
      // topic was added). Only listed here; a reminder is sent when you choose to send it.
      const partial = confirmedCount > 0 && confirmedCount < topicCount;
      if (!f.reminder_sent && sentAt && ((confirmedCount === 0 && sentAt < cutoff) || partial)) {
        reminders.push({ ...base, sentAt: f.email_sent_date });
      }
    }
  }
  today.sort((a, b) => String(b.sentAt).localeCompare(String(a.sentAt)));
  reviewedList.sort((a, b) => String(b.reviewedAt).localeCompare(String(a.reviewedAt)));
  return { success: true, first, changes, reminders, today, reviewed: reviewedList, counts: await getEmailCounts() };
}

// ─── Sync: read confirmations from the Google Sheet into the database ───
// Confirmations removed in the app that the Google sheet does not know about yet
async function queuedRemovals() {
  const { data, error } = await getSupabaseServer()
    .from('change_log').select('id, faculty_id, topic_id, created_at')
    .eq('event_type', 'unconfirmed').is('notified_at', null)
    .order('id', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function getQueuedRemovalCount() {
  try { return (await queuedRemovals()).length; } catch { return 0; }
}

// Step 1 of Sync: one call that deletes every queued removal from the sheet
async function pushQueuedRemovals() {
  const queued = await queuedRemovals();
  if (!queued.length) return 0;
  const r = await callScript({
    action: 'removeConfirmations',
    items: queued.map((q: any) => ({ facultyId: q.faculty_id, topicId: q.topic_id, removedAt: q.created_at })),
  });
  if (r?.status !== 'Success') {
    throw new Error(r?.message === 'Unknown action'
      ? 'The Google Script is an older version. Paste the new google-script/Code.js into Apps Script and deploy a new version (Manage deployments → Edit → New version), then sync again.'
      : (r?.message || 'The Google Script did not accept the removed confirmations.'));
  }
  const ids = queued.map((q: any) => q.id);
  for (let i = 0; i < ids.length; i += 200) {
    const { error } = await getSupabaseServer().from('change_log')
      .update({ notified_at: new Date().toISOString() }).in('id', ids.slice(i, i + 200));
    if (error) throw error;
  }
  return queued.length;
}

export async function syncFromGoogle() {
  try {
    // Send removals first; if that fails, stop, or the read below would re-confirm them.
    const pushedRemovals = await pushQueuedRemovals();
    const data = await getFromScript({});
    if (data.error) return { success: false, message: data.error, count: 0, groups: [] };
    const allPairs: { facultyId: string; topicId: string; confirmedAt: string | null }[] = data.topics || [];
    // "chair:<session id>" = confirmation of chairing a whole session (kept in session_chairs)
    const isChairKey = (id: any) => String(id).startsWith('chair:');
    const pairs = allPairs.filter((p) => !isChairKey(p.topicId));
    const chairPairs = allPairs.filter((p) => isChairKey(p.topicId));

    const { data: open, error } = await getSupabaseServer()
      .from('faculty_topics')
      .select('faculty_id, topic_id, role, faculty ( canonical_name ), session_topics ( topic_title, conference_sessions ( session_code ) )')
      .eq('confirmed', false);
    if (error) throw error;

    const byKey = new Map<string, any>();
    (open || []).forEach((r: any) => byKey.set(`${r.faculty_id}|${r.topic_id}`, r));
    const toUpdate = pairs.filter((p) => byKey.has(`${p.facultyId}|${p.topicId}`));

    // The Google sheet is the source of truth: a topic that is Confirmed here but no longer
    // in the sheet's list (the faculty answered "No" afterwards) goes back to unconfirmed.
    const inSheet = new Set(pairs.map((p) => `${p.facultyId}|${p.topicId}`));
    const { data: done, error: doneErr } = await getSupabaseServer()
      .from('faculty_topics')
      .select('faculty_id, topic_id, role, faculty ( canonical_name ), session_topics ( topic_title, conference_sessions ( session_code ) )')
      .eq('confirmed', true);
    if (doneErr) throw doneErr;
    const toRevoke = Array.isArray(data.topics)
      ? (done || []).filter((r: any) => !inSheet.has(`${r.faculty_id}|${r.topic_id}`))
      : [];
    for (let i = 0; i < toRevoke.length; i += 20) {
      await Promise.all(toRevoke.slice(i, i + 20).map((r: any) =>
        getSupabaseServer().from('faculty_topics')
          .update({ confirmed: false, confirmed_at: null })
          .eq('faculty_id', r.faculty_id).eq('topic_id', r.topic_id)
      ));
    }
    const revokedMap = new Map<string, { name: string; topics: string[] }>();
    toRevoke.forEach((r: any) => {
      const g = revokedMap.get(r.faculty_id) || { name: r.faculty?.canonical_name || 'Unknown', topics: [] };
      g.topics.push(`${r.session_topics?.conference_sessions?.session_code || ''} – ${r.session_topics?.topic_title || ''}${r.role === 'Chairperson' ? ' (chair)' : ''}`);
      revokedMap.set(r.faculty_id, g);
    });

    for (let i = 0; i < toUpdate.length; i += 20) {
      await Promise.all(toUpdate.slice(i, i + 20).map((p) =>
        getSupabaseServer().from('faculty_topics')
          .update({ confirmed: true, confirmed_at: p.confirmedAt || new Date().toISOString() })
          .eq('faculty_id', p.facultyId).eq('topic_id', p.topicId)
      ));
    }

    const groupMap = new Map<string, { name: string; topics: string[] }>();
    toUpdate.forEach((p) => {
      const r = byKey.get(`${p.facultyId}|${p.topicId}`);
      const g = groupMap.get(p.facultyId) || { name: r.faculty?.canonical_name || 'Unknown', topics: [] };
      g.topics.push(`${r.session_topics?.conference_sessions?.session_code || ''} – ${r.session_topics?.topic_title || ''}${r.role === 'Chairperson' ? ' (chair)' : ''}`);
      groupMap.set(p.facultyId, g);
    });

    // Whole-session chairs: confirm those in the sheet, un-confirm those that are no longer in it
    let chairUp = 0, chairDown = 0;
    try {
      const { data: chairs } = await getSupabaseServer()
        .from('session_chairs')
        .select('session_id, faculty_id, confirmed, faculty ( canonical_name ), conference_sessions ( session_code )');
      for (const c of (chairs || []) as any[]) {
        const hit = chairPairs.find((p) => p.facultyId === c.faculty_id && p.topicId === `chair:${c.session_id}`);
        const label = `${c.conference_sessions?.session_code || ''} – Chairperson (whole session)`;
        if (hit && !c.confirmed) {
          await getSupabaseServer().from('session_chairs')
            .update({ confirmed: true, confirmed_at: hit.confirmedAt || new Date().toISOString() })
            .eq('session_id', c.session_id).eq('faculty_id', c.faculty_id);
          const g = groupMap.get(c.faculty_id) || { name: c.faculty?.canonical_name || 'Unknown', topics: [] };
          g.topics.push(label); groupMap.set(c.faculty_id, g); chairUp++;
        } else if (!hit && c.confirmed && Array.isArray(data.topics)) {
          await getSupabaseServer().from('session_chairs')
            .update({ confirmed: false, confirmed_at: null })
            .eq('session_id', c.session_id).eq('faculty_id', c.faculty_id);
          const g = revokedMap.get(c.faculty_id) || { name: c.faculty?.canonical_name || 'Unknown', topics: [] };
          g.topics.push(label); revokedMap.set(c.faculty_id, g); chairDown++;
        }
      }
    } catch (e) { console.error('session chair sync skipped:', e); }

    await getSupabaseServer().from('change_log').insert({
      event_type: 'sync',
      detail: ((toUpdate.length + chairUp) ? `${toUpdate.length + chairUp} new topic confirmation(s) from ${groupMap.size} faculty` : 'No new confirmations')
        + ((toRevoke.length + chairDown) ? `; ${toRevoke.length + chairDown} topic(s) un-confirmed (declined) for ${revokedMap.size} faculty` : '')
        + (pushedRemovals ? `; ${pushedRemovals} removed confirmation(s) sent to Google` : ''),
      notify: false,
    });
    return { success: true, count: toUpdate.length + chairUp, groups: [...groupMap.values()], revokedCount: toRevoke.length + chairDown, revoked: [...revokedMap.values()], pushedRemovals, message: '' };
  } catch (e: any) {
    console.error('syncFromGoogle failed:', e);
    return { success: false, message: e?.message || 'Sync failed.', count: 0, groups: [] };
  }
}

// ─── Remove one topic confirmation (Faculty profile button) ───
// Local only, so it is instant. The removal is queued as a change_log row
// (event_type 'unconfirmed', notified_at = null means "not sent to Google yet");
// the next Sync sends all queued removals to the Google sheet in one call
// before reading confirmations, so they are not brought back.
// (notify is false, so these rows never appear in faculty update emails.)
export async function removeConfirmation(facultyId: string, topicId: string) {
  try {
    if (!facultyId || !topicId) return { success: false, message: 'Missing faculty or topic.' };

    const { data: row, error } = await getSupabaseServer()
      .from('faculty_topics')
      .update({ confirmed: false, confirmed_at: null })
      .eq('faculty_id', facultyId).eq('topic_id', topicId)
      .select('role, faculty ( canonical_name ), session_topics ( topic_title, conference_sessions ( session_code ) )')
      .maybeSingle();
    if (error) throw error;

    await getSupabaseServer().from('change_log').insert({
      event_type: 'unconfirmed',
      faculty_id: facultyId,
      faculty_name: row?.faculty?.canonical_name || null,
      topic_id: topicId,
      topic_title: row?.session_topics?.topic_title || null,
      session_code: row?.session_topics?.conference_sessions?.session_code || null,
      detail: 'Confirmation removed in the app',
      notify: false,
      // Demo mode has no Google sync: nothing to send later.
      notified_at: (await isDemoMode()) ? new Date().toISOString() : null,
    });
    return { success: true, message: '' };
  } catch (e: any) {
    console.error('removeConfirmation failed:', e);
    return { success: false, message: e?.message || 'Could not remove the confirmation.' };
  }
}

export async function getLastSync() {
  const { data } = await getSupabaseServer()
    .from('change_log').select('created_at').eq('event_type', 'sync')
    .order('id', { ascending: false }).limit(1).maybeSingle();
  return data?.created_at || null;
}

// ─── Coordinator report (a table in the email body, no PDF) ───
async function buildCoordinatorReport(sessionId: string) {
  const { data: session, error } = await getSupabaseServer().from('conference_sessions').select('*').eq('id', sessionId).single();
  if (error || !session) throw new Error('Session not found.');

  const { data: topics } = await getSupabaseServer()
    .from('session_topics')
    .select('id, topic_title, start_time, end_time, sequence_no, faculty_topics ( role, confirmed, sort_order, faculty ( canonical_name, faculty_id ) )')
    .eq('session_id', sessionId)
    .order('sequence_no', { ascending: true });

  const { data: coordRows } = await getSupabaseServer()
    .from('session_coordinators').select('role, coord_id, faculty ( id, canonical_name, email, faculty_id )').eq('session_id', sessionId);
  // Everyone coordinating this session (one entry per person, all their roles),
  // so the dialog can show National / Lead / Local and let you tick who gets it.
  const rolePriority: Record<string, number> = { National: 1, 'Lead Coordinator': 2, Local: 3 };
  const byPerson = new Map<string, { id: string; name: string; email: string; roles: string[]; hasEmail: boolean }>();
  for (const c of sortCoordinators((coordRows || []) as any[])) {
    const f = c.faculty;
    if (!f || isTbdPerson(f)) continue;
    const entry = byPerson.get(f.id) || { id: f.id, name: f.canonical_name, email: f.email || '', roles: [], hasEmail: validEmail(f.email) };
    if (c.role && !entry.roles.includes(c.role)) entry.roles.push(c.role);
    byPerson.set(f.id, entry);
  }
  // Map keeps first-seen order, i.e. the order the lead coordinator arranged
  const allCoordinators = [...byPerson.values()]
    .map((p) => ({ ...p, roles: p.roles.sort((a, b) => (rolePriority[a] || 9) - (rolePriority[b] || 9)) }));
  const coordinators = allCoordinators
    .filter((p) => p.hasEmail)
    .map((p) => ({ id: p.id, name: p.name, email: p.email, role: p.roles.join(' & ') }));

  const rows = (topics || []).map((t: any) => {
    const people = sortTopicPeople((t.faculty_topics || []) as any[])
      .filter((x: any) => !isTbdPerson(x.faculty))
      .map((x: any) => ({ name: x.faculty.canonical_name, role: x.role || 'Faculty', confirmed: !!x.confirmed }))
      .sort((a: any, b: any) => Number(a.role === 'Chairperson') - Number(b.role === 'Chairperson'));
    return { time: `${fmt12hForEmail(t.start_time)} - ${fmt12hForEmail(t.end_time)}`, topic: t.topic_title || '', people };
  });

  const lastSync = await getLastSync();
  const syncedAt = lastSync
    ? new Date(lastSync).toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '';
  return {
    session: {
      code: session.session_code, name: session.session_name, hall: session.hall || 'TBD',
      date: fmtDateForEmail(session.session_date),
      time: `${fmt12hForEmail(session.start_time)} - ${fmt12hForEmail(session.end_time)}`,
    },
    coordinators, allCoordinators, rows, syncedAt,
  };
}

export async function previewCoordinatorReport(sessionId: string) {
  try {
    const report = await buildCoordinatorReport(sessionId);
    const counts = await getEmailCounts();
    return { success: true, ...report, counts };
  } catch (e: any) {
    return { success: false, message: e?.message || 'Could not build the report.' };
  }
}

// recipientIds: the faculty ids ticked in the dialog. Only they are emailed.
export async function sendCoordinatorReport(sessionId: string, recipientIds: string[]) {
  try {
    const report = await buildCoordinatorReport(sessionId);
    const chosen = new Set(recipientIds || []);
    const recipients = report.coordinators.filter((c) => chosen.has(c.id));
    if (!recipients.length) return { success: false, message: 'Tick at least one coordinator with an email address.' };
    const { allCoordinators: _all, ...rest } = report;
    const r = await callScript({ action: 'sendCoordinatorReport', ...rest, coordinators: recipients });
    if (r.status !== 'Success') return { success: false, message: r.message || 'Failed to send.' };
    return { success: true, message: `Report sent to ${r.sent} coordinator(s).`, quotaLeft: r.quotaLeft };
  } catch (e: any) {
    return { success: false, message: e?.message || 'Failed to connect to the Google Script.' };
  }
}

// ─── WhatsApp reminders (Meta template, sent through the 1automations CRM proxy) ───
// Same rule as the emails: nothing is sent automatically. The Faculty page and the
// profile panel open a dialog that shows every recipient first, then sends one
// message at a time with a pause between them.
//
// The approved template lives in app/lib/whatsapp.ts. It has ONE body variable,
// {{1}} = the doctor's name, and its "Confirm Now" button already points at the form.
// So the body is fixed; only the name changes per person.
const WHATSAPP_TIMEOUT_MS = 20000;

// Errors where every remaining message would fail too, so the dialog stops the run.
const WHATSAPP_FATAL_CODES = new Set([190, 130429, 131048, 131056, 132000, 132001, 132005]);

type WhatsAppConfig = ReturnType<typeof whatsappConfig>;
type WhatsAppPostResult = { ok: boolean; code?: number; fatal?: boolean; message: string; messageId?: string };
// The columns the WhatsApp actions read (the rest of the faculty row is not needed).
type WhatsAppFacultyRow = {
  id: string;
  canonical_name?: string | null;
  phone?: string | null;
  email_sent?: boolean | null;
  whatsapp_sent?: boolean | null;
  faculty_topics?: { confirmed?: boolean | null }[] | null;
  session_chairs?: { confirmed?: boolean | null }[] | null;
};
// Just enough of Meta's reply to tell success from an error.
type WhatsAppApiReply = {
  // The 1automations proxy answers 401 with { success: false, error: "unauthorized access" },
  // while Meta itself nests the details in an object.
  error?: { code?: number | string; message?: string } | string;
  messages?: { id?: string }[];
  message_id?: string;
  id?: string;
  success?: boolean;
  status?: string;
};

function whatsappConfig() {
  const base = String(process.env.WHATSAPP_API_URL || '').replace(/\/+$/, '');
  const version = String(process.env.WHATSAPP_API_VERSION || '').replace(/^\/+|\/+$/g, '');
  const token = String(process.env.WHATSAPP_TOKEN || '').trim();
  const phoneId = String(process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim();
  const template = String(process.env.WHATSAPP_TEMPLATE_NAME || WHATSAPP_TEMPLATE.name).trim();
  const language = String(process.env.WHATSAPP_TEMPLATE_LANG || WHATSAPP_TEMPLATE.language).trim();
  const sender = String(process.env.WHATSAPP_SENDER_DISPLAY || 'Dermacon 2027').trim();
  const rawTestTo = String(process.env.WHATSAPP_TEST_TO || '').trim();
  const testTo = rawTestTo ? normalizeWhatsAppPhone(rawTestTo) : null;
  const missing = [
    !base ? 'WHATSAPP_API_URL' : '',
    !version ? 'WHATSAPP_API_VERSION' : '',
    !token ? 'WHATSAPP_TOKEN' : '',
    !phoneId ? 'WHATSAPP_PHONE_NUMBER_ID' : '',
  ].filter(Boolean);
  return {
    base, version, token, phoneId, template, language, sender,
    // A stray WHATSAPP_TEST_TO is reported, never silently ignored.
    testTo: testTo?.ok ? testTo.e164 : '',
    testToProblem: testTo && !testTo.ok ? testTo.problem : '',
    missing,
    url: base && version && phoneId ? `${base}/${version}/${phoneId}/messages` : '',
  };
}

function whatsappErrorMessage(code: number, fallback?: string) {
  switch (code) {
    case 190: return 'The WhatsApp token is invalid or expired. Update WHATSAPP_TOKEN in .env.local and restart.';
    case 131026: return 'This phone number cannot receive WhatsApp messages.';
    case 131047: return 'This number has not messaged the business recently, so WhatsApp rejected the template.';
    case 131008: return 'A required template parameter is missing.';
    case 130429:
    case 131048:
    case 131056: return 'WhatsApp rate limit reached. Wait a few minutes, then send the rest.';
    case 132000: return 'The template expects a different set of variables. It needs exactly one body variable (the name).';
    case 132001: return 'The template is not available for this number (check the template name and language).';
    case 132005: return 'The name is too long for the template variable.';
    default: return fallback ? `${fallback}${code ? ` (code ${code})` : ''}` : 'WhatsApp could not send the message.';
  }
}

// The exact body Meta wants for /{phone-number-id}/messages with a template.
function whatsappPayload(to: string, parameter: string, cfg: { template: string; language: string }) {
  return {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'template',
    template: {
      name: cfg.template,
      language: { policy: 'deterministic', code: cfg.language },
      components: [{ type: 'body', parameters: [{ type: 'text', text: parameter }] }],
    },
  };
}

async function postWhatsAppMessage(cfg: WhatsAppConfig, payload: Record<string, unknown>): Promise<WhatsAppPostResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WHATSAPP_TIMEOUT_MS);
  try {
    const res = await fetch(cfg.url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      cache: 'no-store',
      signal: controller.signal,
    });
    const text = await res.text();
    let json: WhatsAppApiReply | null = null;
    try { json = JSON.parse(text) as WhatsAppApiReply; } catch { /* an HTML error page from a proxy */ }

    if (json?.error) {
      // A plain string comes from the CRM proxy (e.g. "unauthorized access"), not from Meta.
      if (typeof json.error === 'string') {
        const rejected = res.status === 401 || res.status === 403;
        return {
          ok: false,
          code: 0,
          fatal: rejected,
          message: rejected
            ? `The CRM rejected the token (${res.status}: ${json.error}). WHATSAPP_TOKEN must be the API key issued in the 1automations panel, not the account e-mail. Fix it in .env.local and restart.`
            : `The WhatsApp API said: ${json.error}`,
        };
      }
      const code = Number(json.error.code) || 0;
      return {
        ok: false,
        code,
        fatal: WHATSAPP_FATAL_CODES.has(code) || res.status === 401 || res.status === 403,
        message: whatsappErrorMessage(code, json.error.message),
      };
    }
    if (!res.ok || !json) {
      const snippet = String(text || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
      const rejected = res.status === 401 || res.status === 403;
      return {
        ok: false,
        code: 0,
        fatal: rejected,
        message: rejected
          ? `The CRM rejected the token (${res.status}). WHATSAPP_TOKEN is wrong or expired: put the API key from the 1automations panel in .env.local and restart.`
          : `The WhatsApp API returned ${res.status}${snippet ? `: ${snippet}` : '.'}`,
      };
    }
    // Meta answers with { messaging_product, contacts, messages: [{ id }] }
    const messageId = json.messages?.[0]?.id || json.message_id || json.id || '';
    const accepted = !!json.messages?.[0]?.id || json.success === true || /succe/i.test(String(json.status || ''));
    if (!accepted) {
      return { ok: false, code: 0, fatal: false, message: 'The WhatsApp API did not confirm that the message was accepted.' };
    }
    return { ok: true, messageId: String(messageId || ''), message: 'Sent.' };
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      return { ok: false, code: 0, fatal: false, message: 'The WhatsApp API did not answer in time.' };
    }
    return { ok: false, code: 0, fatal: false, message: e instanceof Error ? e.message : 'Could not reach the WhatsApp API.' };
  } finally {
    clearTimeout(timer);
  }
}


// What WILL be sent, per person: the name used in {{1}}, the masked number, and
// why somebody is skipped. Nothing is sent here.
export async function previewWhatsAppReminders(facultyIds: string[]) {
  const empty = {
    success: false,
    message: '',
    testMode: false,
    testToMasked: '',
    sender: 'Dermacon 2027',
    templateName: WHATSAPP_TEMPLATE.name,
    counts: { sent: 0, faculty: 0 },
    rows: [] as WhatsAppPreviewRow[],
  };
  try {
    if (await isDemoMode()) return { ...empty, message: 'Demo mode: WhatsApp sending is switched off.' };
    const cfg = whatsappConfig();
    if (cfg.missing.length) {
      return { ...empty, message: `WhatsApp is not configured. Add ${cfg.missing.join(', ')} to .env.local (see .env.example) and restart.` };
    }
    if (cfg.testToProblem) {
      return { ...empty, message: `WHATSAPP_TEST_TO is not a usable number: ${cfg.testToProblem}` };
    }

    const ids = [...new Set((facultyIds || []).filter(Boolean))];
    const db = getSupabaseServer();
    const { data, error } = await db
      .from('faculty')
      .select('id, canonical_name, phone, email_sent, whatsapp_sent, faculty_topics ( confirmed ), session_chairs ( confirmed )')
      .in('id', ids);
    if (error) return { ...empty, message: error.message };

    const byId = new Map<string, WhatsAppFacultyRow>(((data || []) as WhatsAppFacultyRow[]).map((f) => [f.id, f]));
    const rows: WhatsAppPreviewRow[] = ids.map((id) => {
      const f = byId.get(id);
      if (!f) {
        return { facultyId: id, name: 'Unknown', parameter: '', phoneMasked: '', message: '', warnings: [], problem: 'Faculty not found.', alreadySent: false };
      }
      const parameter = whatsappName(f.canonical_name);
      const phone = normalizeWhatsAppPhone(f.phone);
      const assignments = [...(f.faculty_topics || []), ...(f.session_chairs || [])];
      const unconfirmed = assignments.filter((a) => !a.confirmed).length;
      const warnings: string[] = [];
      let problem = '';
      if (!String(f.phone || '').trim()) problem = 'No phone number.';
      else if (!phone.ok) problem = phone.problem;
      else if (/^TBD/i.test(parameter)) problem = 'The name is still a placeholder (TBD).';
      else if (!parameter) problem = 'The name is empty once the title is removed.';
      else if (assignments.length === 0) problem = 'No session assignments.';

      if (!problem) {
        if (!f.email_sent) warnings.push('Not marked as emailed, but the template says their letter was sent.');
        if (unconfirmed === 0) warnings.push('Everything is already confirmed.');
        if (f.whatsapp_sent) warnings.push('Already sent a WhatsApp reminder before.');
      }

      return {
        facultyId: id,
        name: f.canonical_name || parameter || 'Unknown',
        parameter,
        phoneMasked: maskPhone(phone.e164),
        message: renderWhatsAppTemplate(parameter || '…'),
        warnings,
        problem,
        alreadySent: !!f.whatsapp_sent,
      };
    });

    const [sent, everyone] = await Promise.all([
      db.from('faculty').select('id', { count: 'exact', head: true }).eq('whatsapp_sent', true),
      db.from('faculty').select('id', { count: 'exact', head: true }),
    ]);

    return {
      success: true,
      testMode: !!cfg.testTo,
      testToMasked: cfg.testTo ? maskPhone(cfg.testTo) : '',
      sender: cfg.sender,
      templateName: cfg.template,
      counts: { sent: sent.count ?? 0, faculty: everyone.count ?? 0 },
      rows,
    };
  } catch (e) {
    return { ...empty, message: e instanceof Error ? e.message : 'Could not prepare the WhatsApp reminders.' };
  }
}

// Send ONE WhatsApp reminder. The dialog calls this once per person, with a pause.
// A real send marks whatsapp_sent; a test send (WHATSAPP_TEST_TO) never does.
export async function sendWhatsAppReminderToFaculty(facultyId: string) {
  try {
    await blockInDemo('WhatsApp sending');
    const cfg = whatsappConfig();
    if (cfg.missing.length) {
      return { success: false, fatal: true, message: `WhatsApp is not configured. Add ${cfg.missing.join(', ')} to .env.local (see .env.example) and restart.` };
    }
    if (cfg.testToProblem) {
      return { success: false, fatal: true, message: `WHATSAPP_TEST_TO is not a usable number: ${cfg.testToProblem}` };
    }

    const db = getSupabaseServer();
    const { data: facultyRow } = await db.from('faculty').select('id, canonical_name, phone').eq('id', facultyId).single();
    const faculty = facultyRow as WhatsAppFacultyRow | null;
    if (!faculty) return { success: false, fatal: false, message: 'Faculty not found.' };

    const parameter = whatsappName(faculty.canonical_name);
    if (/^TBD/i.test(parameter)) return { success: false, fatal: false, message: 'The name is still a placeholder (TBD).' };
    if (!parameter) return { success: false, fatal: false, message: 'The name is empty once the title is removed.' };
    const phone = normalizeWhatsAppPhone(faculty.phone);
    if (!phone.ok) return { success: false, fatal: false, message: phone.problem };

    const to = cfg.testTo || phone.e164;
    const r = await postWhatsAppMessage(cfg, whatsappPayload(to, parameter, cfg));
    if (!r.ok) return { success: false, fatal: !!r.fatal, message: r.message, code: r.code };

    if (!cfg.testTo) {
      const { error } = await db.from('faculty').update({ whatsapp_sent: true }).eq('id', facultyId);
      if (error) console.error('Could not mark whatsapp_sent:', error);
    }

    return {
      success: true,
      testMode: !!cfg.testTo,
      messageId: r.messageId || '',
      message: cfg.testTo
        ? `Test message sent to ${maskPhone(to)}. Nobody was marked as WhatsApp'd.`
        : `WhatsApp sent to ${maskPhone(to)}.`,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Could not send the WhatsApp message.';
    return { success: false, fatal: /Demo mode/i.test(message), message };
  }
}

