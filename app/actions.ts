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


import { supabase } from './supabase';
import puppeteer from 'puppeteer';
import { renderCommitmentHTML } from './lib/commitmentPdfHtml';
import fs from 'fs';
import path from 'path';

// One PDF per faculty, one page per session (a session's topics share its page).
// Used by the Faculty page "PDF" button, the Add/Edit topic windows and the email attachment.
export async function generatePDFData(facultyId: string) {
  try {
    const { data: faculty, error: facError } = await supabase
      .from('faculty').select('*').eq('id', facultyId).single();
    if (facError || !faculty) throw new Error("Faculty not found.");

    const payload = await buildFacultyPayload(faculty);
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
    const { data: existing } = await supabase.from('faculty').select('canonical_name').eq('id', id).single();
    canonical_name = existing?.canonical_name;
    if (!canonical_name) return { success: false, message: 'Name is required.' };
  }
  const { error } = await supabase.from('faculty').update({
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

export async function generatePDFForSession(sessionId: string) {
  try {
    // 1. Load the session
    const { data: session, error: sErr } = await supabase
      .from('conference_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();
    if (sErr || !session) throw new Error('Session not found.');

    // 2. Load every topic + faculty link in that session
    const { data: topics, error: tErr } = await supabase
      .from('session_topics')
      .select(`
        id, topic_title, start_time, end_time, sequence_no,
        faculty_topics ( role, faculty ( canonical_name, phone, email ) )
      `)
      .eq('session_id', sessionId)
      .order('sequence_no', { ascending: true });
    if (tErr) throw new Error('Topics load failed: ' + tErr.message);

    // 3. Lead coordinator lookup (same logic as generatePDFData)
    const { data: leadCoordData } = await supabase
      .from('session_coordinators')
      .select('faculty ( canonical_name, phone, email )')
      .eq('session_id', sessionId)
      .eq('role', 'Lead Coordinator')
      .maybeSingle();
    const lead = leadCoordData?.faculty;
    const coordName  = lead?.canonical_name || '';
    const coordPhone = lead?.phone || '';
    const coordEmail = lead?.email || '';

    const d = new Date(session.session_date);
    const formattedDate = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    // 4. Build one combined HTML page
    const rowsHtml = (topics || []).map((t: any) => {
      const facultyStr = (t.faculty_topics || [])
        .map((ft: any) => ((ft.faculty) as any)?.canonical_name || '')
        .filter(Boolean)
        .join(', ');
      const roleStr = (t.faculty_topics || [])
        .map((ft: any) => ft.role || 'Faculty')
        .filter((v: any, i: number, a: any[]) => a.indexOf(v) === i)
        .join(' / ');
      return `
        <tr>
          <td style="padding:6px;border:1px solid #ddd;text-align:center;">${t.sequence_no ?? ''}</td>
          <td style="padding:6px;border:1px solid #ddd;">${t.topic_title}</td>
          <td style="padding:6px;border:1px solid #ddd;font-size:9pt;">${facultyStr || 'â€”'}</td>
          <td style="padding:6px;border:1px solid #ddd;text-align:center;">${roleStr}</td>
          <td style="padding:6px;border:1px solid #ddd;white-space:nowrap;">
            ${t.start_time ? t.start_time.slice(0,5) : 'â€”'} â€“ ${t.end_time ? t.end_time.slice(0,5) : 'â€”'}
          </td>
        </tr>`;
    }).join('');

    const html = `
      <html><head><style>
        body { margin:0; padding:0; font-family: Arial, sans-serif; font-size: 10pt; }
        .page { padding: 30px; page-break-after: always; }
      </style></head><body>
      <div class="page">
        <div style="text-align:center;margin-bottom:20px;">
          <h2 style="margin:0;font-size:13pt;">3rd International & 55th National Conference of IADVL</h2>
          <div style="margin-top:6px;font-size:9pt;">
            <strong>Organizing Chairperson:</strong> Dr. Ranjan Rawal &nbsp;|&nbsp;
            <strong>Organizing Secretary:</strong> Dr. Jagdish Sakhiya <br/>
            <strong>Scientific Chairperson:</strong> Dr. Krina Patel &nbsp;|&nbsp;
            <strong>Treasurer:</strong> Dr. Kandarp Pandya
          </div>
          <hr style="margin-top:10px;border:1px solid #ccc;" />
        </div>

        <div style="font-size:9pt;margin-bottom:8px;">DATE: ${new Date().toLocaleDateString('en-GB')}</div>
        <h3 style="font-size:12pt;margin-bottom:12px;">${session.session_code} â€” ${session.session_name}</h3>

        <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:9pt;">
          <tr><td style="padding:6px;border:1px solid #ddd;background:#f8f9fa;width:22%;"><strong>DATE</strong></td>
              <td style="padding:6px;border:1px solid #ddd;">${formattedDate}</td></tr>
          <tr><td style="padding:6px;border:1px solid #ddd;background:#f8f9fa;"><strong>HALL</strong></td>
              <td style="padding:6px;border:1px solid #ddd;">${session.hall || 'TBD'}</td></tr>
          <tr><td style="padding:6px;border:1px solid #ddd;background:#f8f9fa;"><strong>TIME</strong></td>
              <td style="padding:6px;border:1px solid #ddd;">${session.start_time?.slice(0,5) || 'â€”'} â€“ ${session.end_time?.slice(0,5) || 'â€”'}</td></tr>
          <tr><td style="padding:6px;border:1px solid #ddd;background:#f8f9fa;"><strong>TYPE</strong></td>
              <td style="padding:6px;border:1px solid #ddd;">${session.session_type || 'â€”'}</td></tr>
        </table>

        <h4 style="margin-bottom:6px;">PROGRAMME</h4>
        <table style="width:100%;border-collapse:collapse;font-size:9pt;">
          <tr style="background:#003366;color:white;">
            <th style="padding:6px;border:1px solid #ddd;text-align:center;width:6%;">Seq</th>
            <th style="padding:6px;border:1px solid #ddd;text-align:left;">Topic</th>
            <th style="padding:6px;border:1px solid #ddd;text-align:left;width:26%;">Faculty</th>
            <th style="padding:6px;border:1px solid #ddd;text-align:center;width:14%;">Role</th>
            <th style="padding:6px;border:1px solid #ddd;text-align:center;width:14%;">Time</th>
          </tr>
          ${rowsHtml}
        </table>

        <p style="font-size:9pt;margin-top:18px;">For any queries, please contact:</p>
        <p style="font-size:9pt;"><strong>${coordName}</strong> | ${coordPhone} | ${coordEmail}</p>
        <p style="font-size:9pt;margin-top:18px;">Warm regards,</p>
        <p style="font-size:9pt;"><strong>Workshop Committee</strong></p>

        <div style="font-size:8pt;color:#777;margin-top:25px;border-top:1px solid #ddd;padding-top:8px;">
          <strong>Treasurer Office:</strong> A 311, Radhekishan Commercial Complex, Isanpur, Ahmedabad-382443.
          M.: +91 99981 84930 E: trdermacon@iadvl.org<br/>
          <strong>Conference Secretariat:</strong> Sakhiya Skin Clinic, Shivranjani Cross Road, Ahmedabad-380015.
          M.: +91 98250 84930 E: osdermacon@iadvl.org
        </div>
        <div style="text-align:center;margin-top:12px;font-size:9pt;color:#003366;">www.Dermacon202.com</div>
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
    const { data: links } = await supabase
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
  const { data, error } = await supabase.rpc('resequence_session', {
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
  const { data: existing, error: lookupErr } = await supabase
    .from('session_topics')
    .select('id, session_id')
    .eq('id', topicId)
    .maybeSingle();

  if (lookupErr) return { success: false, message: lookupErr.message };
  if (!existing) return { success: false, message: 'Topic not found (already deleted?).' };
  if (existing.session_id !== sessionId) {
    return { success: false, message: 'Topic does not belong to this session.' };
  }

  const { error: delErr } = await supabase
    .from('session_topics')
    .delete()
    .eq('id', topicId);

  if (delErr) return { success: false, message: delErr.message };

  // Renumber the remaining topics in this session
  const { error: reseqErr } = await supabase.rpc('resequence_session', {
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
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyyImelai6B3iKTmQ4hdaCzZ8CLQ21IsRiWZi1UiTa5KNXy6mgYICZgZDEF0ZoVWfbA/exec";
const UNEXPECTED_REPLY =
  'The Google Script gave an unexpected reply. Open Apps Script > Deploy > Manage deployments > pencil > New version > Deploy, then try again.';

function scriptToken() {
  return process.env.SYNC_TOKEN || '';
}

async function callScript(body: any) {
  const res = await fetch(SCRIPT_URL, {
    method: 'POST',
    body: JSON.stringify({ ...body, token: scriptToken() }),
    cache: 'no-store',
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch { throw new Error(UNEXPECTED_REPLY); }
}

async function getFromScript(params: Record<string, string>) {
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
async function buildFacultyPayload(faculty: any, opts: { coordinators?: boolean } = {}) {
  const withCoord = opts.coordinators !== false;

  const { data: rows, error } = await supabase
    .from('faculty_topics')
    .select(`role, confirmed, session_topics ( id, topic_title, start_time, end_time, sequence_no, conference_sessions ( id, session_code, session_name, session_type, session_date, hall, start_time, end_time ) )`)
    .eq('faculty_id', faculty.id);
  if (error) throw error;

  const mine = (rows || []).filter((r: any) => r.session_topics?.conference_sessions);
  if (!mine.length) throw new Error("No session topics assigned to this faculty member.");

  // Speakers of the topics this person chairs (listed in their letter)
  const chairTopicIds = mine.filter((r: any) => r.role === 'Chairperson').map((r: any) => r.session_topics.id);
  const speakersByTopic: Record<string, string[]> = {};
  if (chairTopicIds.length) {
    const { data: sp } = await supabase
      .from('faculty_topics')
      .select('topic_id, role, faculty ( canonical_name, faculty_id )')
      .in('topic_id', chairTopicIds)
      .or('role.is.null,role.neq.Chairperson');
    (sp || []).forEach((x: any) => {
      if (isTbdPerson(x.faculty)) return;
      (speakersByTopic[x.topic_id] ||= []).push(x.faculty.canonical_name);
    });
  }

  // Lead coordinator once per session (shown in the letter as the contact)
  const sessionIds = [...new Set(mine.map((r: any) => r.session_topics.conference_sessions.id))] as string[];
  const coordBySession: Record<string, { name: string; phone: string; email: string }> = {};
  for (const sid of sessionIds) {
    let lead: any = null;
    if (withCoord) {
      const { data: coordData } = await supabase
        .from('session_coordinators')
        .select('faculty ( canonical_name, phone, email )')
        .eq('session_id', sid).eq('role', 'Lead Coordinator').maybeSingle();
      lead = coordData?.faculty;
    }
    coordBySession[sid] = { name: lead?.canonical_name || '', phone: lead?.phone || '', email: lead?.email || '' };
  }

  const items = mine.map((r: any) => {
    const topic = r.session_topics;
    const session = topic.conference_sessions;
    return { r, topic, session, role: r.role || 'Faculty', coord: coordBySession[session.id] };
  }).sort((a: any, b: any) =>
    String(a.session.session_date ?? '').localeCompare(String(b.session.session_date ?? '')) ||
    String(a.session.session_code ?? '').localeCompare(String(b.session.session_code ?? ''), undefined, { numeric: true }) ||
    (a.topic.sequence_no ?? 0) - (b.topic.sequence_no ?? 0) ||
    String(a.topic.start_time ?? '').localeCompare(String(b.topic.start_time ?? ''))
  );

  const roleText = [...new Set(items.map((i: any) => roleDisplay(i.role)))].join(' & ');
  const assignedSessionCodes = [...new Set(items.map((i: any) => i.session.session_code))].join(',');

  const sessionsData = items.map((i: any) => ({
    topic_id: i.topic.id,
    faculty_id: faculty.id,
    role: i.role,
    speakers: i.role === 'Chairperson' ? (speakersByTopic[i.topic.id] || []) : [],
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
      bySession.set(i.session.id, { session: i.session, topics: [], role: roleText, coordinator: i.coord });
    }
    bySession.get(i.session.id).topics.push({
      topic_title: i.topic.topic_title,
      start_time: i.topic.start_time,
      end_time: i.topic.end_time,
      sequence_no: i.topic.sequence_no,
      role: roleDisplay(i.role),
      speakers: i.role === 'Chairperson' ? (speakersByTopic[i.topic.id] || []) : [],
    });
  }
  const pdfInput = {
    faculty: { canonical_name: faculty.canonical_name, phone: faculty.phone || '' },
    sessions: [...bySession.values()],
    formLink: prefilledFormLink(faculty.canonical_name, faculty.phone || '', assignedSessionCodes),
  };

  const topics = items.map((i: any) => ({
    topicId: i.topic.id,
    title: i.topic.topic_title || '',
    session: i.session.session_code,
    time: `${fmt12hForEmail(i.topic.start_time)} - ${fmt12hForEmail(i.topic.end_time)}`,
    role: roleDisplay(i.role),
    confirmed: !!i.r.confirmed,
  }));

  return { sessionsData, pdfInput, assignedSessionCodes, role: roleText, topics };
}

// ─── Pending changes (written by database triggers into change_log) ───
function describeChange(c: any): string {
  const t = c.topic_title ? `"${c.topic_title}"` : '';
  const where = c.session_code ? ` (${c.session_code})` : '';
  switch (c.event_type) {
    case 'faculty_assigned': return `Added to ${t}${where}${c.detail ? ' – ' + c.detail : ''}`;
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
  const { data } = await supabase
    .from('change_log').select('*')
    .eq('faculty_id', facultyId).eq('notify', true).is('notified_at', null)
    .order('id', { ascending: true });
  const rows = netChanges(data || []);
  return { rows, lines: rows.map(describeChange), ids: (data || []).map((r: any) => r.id) as number[] };
}

// ─── Quota, preview (what WILL happen) ───
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
  const quota = await getEmailQuota();
  const rows: any[] = [];
  for (let i = 0; i < items.length; i += 8) {
    const batch = items.slice(i, i + 8);
    const res = await Promise.all(batch.map(async (it) => {
      const { data: faculty } = await supabase.from('faculty').select('*').eq('id', it.facultyId).single();
      if (!faculty) return { facultyId: it.facultyId, kind: it.kind, name: 'Unknown', email: '', problem: 'Faculty not found.', topics: [], changes: [] };
      const base = { facultyId: faculty.id, kind: it.kind, name: faculty.canonical_name, email: faculty.email || '', topics: [] as any[], changes: [] as string[], problem: '' };
      if (!validEmail(faculty.email)) return { ...base, problem: 'No valid email address.' };
      try {
        const p = await buildFacultyPayload(faculty, { coordinators: false });
        const pending = it.kind === 'update' ? await pendingChangesFor(faculty.id) : { rows: [], lines: [], ids: [] };
        const changedTopics = new Set(pending.rows.map((c: any) => c.topic_id).filter(Boolean));
        return {
          ...base,
          topics: p.topics.map((t: any) => ({ ...t, isNew: changedTopics.has(t.topicId) })),
          changes: pending.lines,
        };
      } catch (e: any) {
        return { ...base, problem: e?.message || 'Could not prepare this email.' };
      }
    }));
    rows.push(...res);
  }
  return { success: true, quota: quota.quota, reserve: quota.reserve, quotaOk: quota.success, quotaMessage: quota.message || '', rows };
}

// ─── Send ONE email (the dialog calls this once per faculty, with a delay between) ───
export async function sendEmailToFaculty(facultyId: string, kind: EmailKind) {
  try {
    const { data: faculty } = await supabase.from('faculty').select('*').eq('id', facultyId).single();
    if (!faculty) return { success: false, message: 'Faculty not found.' };
    if (!validEmail(faculty.email)) return { success: false, message: 'No valid email address.' };

    if (kind === 'reminder') {
      const p = await buildFacultyPayload(faculty, { coordinators: false });
      const r = await callScript({
        action: 'sendReminder', name: faculty.canonical_name, email: faculty.email,
        phone: faculty.phone || '', sessions: p.assignedSessionCodes,
      });
      if (r.status !== 'Success') return { success: false, message: r.message || 'Failed to send.', quotaLeft: r.quotaLeft };
      await supabase.from('faculty').update({ reminder_sent: true }).eq('id', faculty.id);
      return { success: true, message: 'Reminder sent.', quotaLeft: r.quotaLeft };
    }

    const p = await buildFacultyPayload(faculty);
    const pending = await pendingChangesFor(faculty.id);

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
      action: kind === 'update' ? 'sendScheduleUpdate' : 'sendFormLink',
      facultyId: faculty.id, name: faculty.canonical_name, email: faculty.email, phone: faculty.phone || '',
      role: p.role, sessions: p.assignedSessionCodes, sessionsData: p.sessionsData, pdfs,
      changes: kind === 'update' ? pending.lines : [],
    });
    if (r.status !== 'Success') return { success: false, message: r.message || 'Failed to send.', quotaLeft: r.quotaLeft };

    // Sent: remember it, and clear this faculty's pending changes (the letter now shows everything)
    await supabase.from('faculty').update({ email_sent: true, email_sent_date: new Date().toISOString() }).eq('id', faculty.id);
    if (pending.ids.length) {
      await supabase.from('change_log').update({ notified_at: new Date().toISOString() }).in('id', pending.ids);
    }
    const attached = typeof r.pdfsAttached === 'number' ? r.pdfsAttached : null;
    const pdfNote = pdfWarning || (attached === null ? ' (old Google Script version: PDF not confirmed)' : attached === pdfs.length ? ` with ${attached} PDF` : ' but the PDF was not attached');
    return { success: true, message: `Email sent${pdfNote}.`, quotaLeft: r.quotaLeft };
  } catch (e: any) {
    console.error('sendEmailToFaculty failed:', e);
    return { success: false, message: e?.message || 'Failed to connect to the Google Script.' };
  }
}

// ─── Emails page data ───
export async function getEmailsOverview() {
  const { data: fac, error } = await supabase
    .from('faculty')
    .select('id, canonical_name, email, email_sent, email_sent_date, reminder_sent, faculty_topics ( confirmed )')
    .order('canonical_name');
  if (error) return { success: false, message: error.message, first: [], changes: [], reminders: [] };

  const { data: pend } = await supabase
    .from('change_log').select('*')
    .eq('notify', true).is('notified_at', null).not('faculty_id', 'is', null)
    .order('id', { ascending: true });
  const pendByFaculty: Record<string, any[]> = {};
  (pend || []).forEach((c: any) => { (pendByFaculty[c.faculty_id] ||= []).push(c); });

  const first: any[] = [], changes: any[] = [], reminders: any[] = [];
  const cutoff = Date.now() - 5 * 24 * 3600 * 1000;
  for (const f of fac || []) {
    const topicCount = f.faculty_topics?.length || 0;
    if (!topicCount) {
      // Emailed before, now removed from every topic: the letter needs at least one
      // topic, so the app cannot send it. Show it so nobody is forgotten.
      const gone = f.email_sent ? netChanges(pendByFaculty[f.id] || []) : [];
      if (gone.length) {
        changes.push({
          id: f.id, name: f.canonical_name, email: f.email || '', hasEmail: false, topicCount: 0, confirmedCount: 0,
          lines: gone.map(describeChange),
          note: 'Removed from all topics. The app cannot email this; tell them directly.',
        });
      }
      continue;
    }
    const confirmedCount = (f.faculty_topics || []).filter((t: any) => t.confirmed).length;
    const base = { id: f.id, name: f.canonical_name, email: f.email || '', hasEmail: validEmail(f.email), topicCount, confirmedCount };
    const net = netChanges(pendByFaculty[f.id] || []);
    if (!f.email_sent) {
      // Not emailed yet: their first email shows the current schedule, so these
      // changes are already included. Listed so you can see them.
      first.push({ ...base, pendingLines: net.map(describeChange) });
    } else {
      if (net.length) changes.push({ ...base, lines: net.map(describeChange) });
      const sentAt = f.email_sent_date ? new Date(f.email_sent_date).getTime() : 0;
      if (!f.reminder_sent && confirmedCount === 0 && sentAt && sentAt < cutoff) {
        reminders.push({ ...base, sentAt: f.email_sent_date });
      }
    }
  }
  return { success: true, first, changes, reminders };
}

// ─── Sync: read confirmations from the Google Sheet into the database ───
export async function syncFromGoogle() {
  try {
    const data = await getFromScript({});
    if (data.error) return { success: false, message: data.error, count: 0, groups: [] };
    const pairs: { facultyId: string; topicId: string; confirmedAt: string | null }[] = data.topics || [];

    const { data: open, error } = await supabase
      .from('faculty_topics')
      .select('faculty_id, topic_id, role, faculty ( canonical_name ), session_topics ( topic_title, conference_sessions ( session_code ) )')
      .eq('confirmed', false);
    if (error) throw error;

    const byKey = new Map<string, any>();
    (open || []).forEach((r: any) => byKey.set(`${r.faculty_id}|${r.topic_id}`, r));
    const toUpdate = pairs.filter((p) => byKey.has(`${p.facultyId}|${p.topicId}`));

    for (let i = 0; i < toUpdate.length; i += 20) {
      await Promise.all(toUpdate.slice(i, i + 20).map((p) =>
        supabase.from('faculty_topics')
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

    await supabase.from('change_log').insert({
      event_type: 'sync',
      detail: toUpdate.length ? `${toUpdate.length} new topic confirmation(s) from ${groupMap.size} faculty` : 'No new confirmations',
      notify: false,
    });
    return { success: true, count: toUpdate.length, groups: [...groupMap.values()], message: '' };
  } catch (e: any) {
    console.error('syncFromGoogle failed:', e);
    return { success: false, message: e?.message || 'Sync failed.', count: 0, groups: [] };
  }
}

export async function getLastSync() {
  const { data } = await supabase
    .from('change_log').select('created_at').eq('event_type', 'sync')
    .order('id', { ascending: false }).limit(1).maybeSingle();
  return data?.created_at || null;
}

// ─── Coordinator report (a table in the email body, no PDF) ───
async function buildCoordinatorReport(sessionId: string) {
  const { data: session, error } = await supabase.from('conference_sessions').select('*').eq('id', sessionId).single();
  if (error || !session) throw new Error('Session not found.');

  const { data: topics } = await supabase
    .from('session_topics')
    .select('id, topic_title, start_time, end_time, sequence_no, faculty_topics ( role, confirmed, faculty ( canonical_name, faculty_id ) )')
    .eq('session_id', sessionId)
    .order('sequence_no', { ascending: true });

  const { data: coordRows } = await supabase
    .from('session_coordinators').select('role, faculty ( id, canonical_name, email, faculty_id )').eq('session_id', sessionId);
  // Everyone coordinating this session (one entry per person, all their roles),
  // so the dialog can show National / Lead / Local and let you tick who gets it.
  const rolePriority: Record<string, number> = { National: 1, 'Lead Coordinator': 2, Local: 3 };
  const byPerson = new Map<string, { id: string; name: string; email: string; roles: string[]; hasEmail: boolean }>();
  for (const c of (coordRows || []) as any[]) {
    const f = c.faculty;
    if (!f || isTbdPerson(f)) continue;
    const entry = byPerson.get(f.id) || { id: f.id, name: f.canonical_name, email: f.email || '', roles: [], hasEmail: validEmail(f.email) };
    if (c.role && !entry.roles.includes(c.role)) entry.roles.push(c.role);
    byPerson.set(f.id, entry);
  }
  const allCoordinators = [...byPerson.values()]
    .map((p) => ({ ...p, roles: p.roles.sort((a, b) => (rolePriority[a] || 9) - (rolePriority[b] || 9)) }))
    .sort((a, b) => (rolePriority[a.roles[0]] || 9) - (rolePriority[b.roles[0]] || 9) || a.name.localeCompare(b.name));
  const coordinators = allCoordinators
    .filter((p) => p.hasEmail)
    .map((p) => ({ id: p.id, name: p.name, email: p.email, role: p.roles.join(' & ') }));

  const rows = (topics || []).map((t: any) => {
    const people = (t.faculty_topics || [])
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
    const quota = await getEmailQuota();
    return { success: true, ...report, quota: quota.quota, reserve: quota.reserve };
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
