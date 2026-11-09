// @ts-nocheck

'use server';

import { supabase } from './supabase';
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

export async function generatePDFData(facultyId: string) {
  console.log("--- STARTING PDF GENERATION ---");
  try {
    console.log("1. Fetching Faculty Data for ID:", facultyId);
    const { data: faculty, error: facError } = await supabase
      .from('faculty')
      .select('*')
      .eq('id', facultyId)
      .single();

    if (facError || !faculty) throw new Error("Faculty not found in database.");

    console.log("2. Fetching Topics for Faculty:", faculty.canonical_name);
    const { data: topics, error: topError } = await supabase
      .from('faculty_topics')
      .select(`
        role,
        session_topics (
          topic_title,
          start_time,
          end_time,
          sequence_no,
          conference_sessions ( id, session_code, session_name, session_date, hall, start_time, end_time )
        )
      `)
      .eq('faculty_id', facultyId);

    if (topError) throw new Error("Error fetching topics: " + topError.message);
    if (!topics || topics.length === 0) throw new Error("This faculty member has no sessions assigned.");

    console.log("3. Building HTML...");
    const sessionsMap: Record<string, any> = {};
    topics.forEach(t => {
      const session = (t.session_topics as any)?.conference_sessions;
      if (!session) return;
      if (!sessionsMap[session.id]) {
        sessionsMap[session.id] = { session, topics: [] };
      }
      sessionsMap[session.id].topics.push(t.session_topics);
    });

    const uniqueSessions = Object.values(sessionsMap);
    let htmlPages = '';

    for (const s of uniqueSessions) {
      const { data: coordData } = await supabase
        .from('session_coordinators')
        .select(`role, faculty ( canonical_name, phone, email )`)
        .eq('session_id', s.session.id)
        .eq('role', 'Lead Coordinator')
        .single();

      const leadCoord = (coordData?.faculty as any);
      const coordName = (leadCoord as any)?.canonical_name || 'Scientific Committee';
      const coordPhone = (leadCoord as any)?.phone || '+91 99981 84930';
      const coordEmail = (leadCoord as any)?.email || 'osdermacon@iadvl.org';

      const d = new Date(s.session.session_date);
      const formattedDate = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

      htmlPages += `
        <div style="page-break-after: always; padding: 40px; font-family: Arial, sans-serif; font-size: 11pt;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h2 style="margin: 0; font-size: 14pt;">3rd International & 55th National Conference of Indian Association of Dermatologist, Venereologists & Pelopologists</h2>
            <div style="margin-top: 10px; font-size: 10pt;">
              <strong>Organizing Chairperson:</strong> Dr. Ranjan Rawal &nbsp;&nbsp;|&nbsp;&nbsp; 
              <strong>Organizing Secretary:</strong> Dr. Jagdish Sakhiya <br/>
              <strong>Scientific Chairperson:</strong> Dr. Krina Patel &nbsp;&nbsp;|&nbsp;&nbsp; 
              <strong>Treasurer:</strong> Dr. Kandarp Pandya
            </div>
            <hr style="margin-top: 15px; border: 1px solid #ccc;" />
          </div>

          <div style="font-size: 10pt; margin-bottom: 20px;">DATE: ${new Date().toLocaleDateString('en-GB')}</div>
          <h3 style="font-size: 12pt; margin-bottom: 20px;">SUBJECT: Faculty Scientific Commitment DERMACON International 2027</h3>
          <p>Dear <strong>${faculty.canonical_name}</strong>,</p>
          <p>Greetings from the Scientific Committee of DERMACON International 2027. We are delighted to welcome you as <strong>${topics[0].role || 'Faculty'}</strong> and share the details of your scientific commitment.</p>

          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; font-size: 10pt;">
            <h4 style="margin: 0 0 10px 0; color: #003366;">CONFERENCE DETAILS</h4>
            <strong>Conference:</strong> DERMACON International 2027<br/>
            <strong>Date:</strong> 4th - 7th February 2027<br/>
            <strong>Venue:</strong> Helipad Exhibition Centre (HEC), Sector 17, Gandhinagar, Gujarat<br/>
            <strong>Theme:</strong> Dermatology Beyond Borders: Science, Skills & Scale - India Shining
          </div>

          <h4 style="margin-bottom: 10px;">SCIENTIFIC COMMITMENT:</h4>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 10pt;">
            <tr style="background-color: #003366; color: white;">
              <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">TOPIC</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: left; width: 30%;">TIMING</th>
            </tr>
            ${s.topics.sort((a:any, b:any) => a.sequence_no - b.sequence_no).map((t: any) => `
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd;">${t.topic_title}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${t.start_time} - ${t.end_time}</td>
              </tr>
            `).join('')}
          </table>

          <h4 style="margin-bottom: 10px;">SESSION DETAILS:</h4>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 10pt;">
            <tr><td style="padding: 8px; border: 1px solid #ddd; width: 25%; background-color: #f8f9fa;"><strong>NAME</strong></td><td style="padding: 8px; border: 1px solid #ddd;">Workshop - ${s.session.session_code} ${s.session.session_name}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #ddd; background-color: #f8f9fa;"><strong>HALL</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${s.session.hall || 'TBD'}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #ddd; background-color: #f8f9fa;"><strong>DATE</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${formattedDate}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #ddd; background-color: #f8f9fa;"><strong>TIME</strong></td><td style="padding: 8px; border: 1px solid #ddd;">${s.session.start_time?.slice(0,5)} - ${s.session.end_time?.slice(0,5)}</td></tr>
          </table>

          <p style="font-size: 10pt;">For any queries, please contact:</p>
          <p style="font-size: 10pt;"><strong>${coordName}</strong> | ${coordPhone} | ${coordEmail}</p>
          <p style="font-size: 10pt; margin-top: 20px;">Thank you for contributing your time and expertise to the scientific programme. We look forward to your participation and welcoming you to DERMACON International 2027.</p>
          <p style="font-size: 10pt; margin-top: 15px;">Please confirm your attendance by clicking here.</p>

          <p style="font-size: 10pt; margin-top: 25px;">Warm regards,</p>
          <p style="font-size: 10pt;"><strong>Workshop Committee</strong></p>
          <p style="font-size: 9pt; color: #555;"><strong>Chairpersons:</strong> Dr. Aarti Shah, Dr. Janak Thakkar<br/><strong>Co-Chairs:</strong> Dr. Bhavesh Devani, Dr. Geeta Patel, Dr. Kirti Shah, Dr. Smita Nagpal</p>

          <div style="font-size: 8pt; color: #777; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 10px;">
            <strong>Treasurer Office:</strong> A 311, Radhekishan Commercial Complex Near Jayamala Cross Road Isanpur, Ahmedabad- 382443. M.: +91 99981 84930 E: trdermacon@iadvl.org<br/><br/>
            <strong>Conference Secretariat:</strong> Sakhiya Skin Clinic 202, 2nd Floor Shital Varsha Mall- 5 Shivranjani Cross Road Satellite, Ahmedabad- 380015. M.: +91 98250 84930 +91 92746 83869 +91 81559 00010 E: osdermacon@iadvl.org
          </div>
          <div style="text-align: center; margin-top: 20px; font-size: 10pt; color: #003366;">www.Dermacon202.com</div>
        </div>
      `;
    }

    const fullHtml = `<html><head><style>body { margin: 0; padding: 0; }</style></head><body>${htmlPages}</body></html>`;

    console.log("4. Launching Puppeteer...");
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'], headless: true });
    const page = await browser.newPage();
    await page.setContent(fullHtml, { waitUntil: 'networkidle0' as any });
    
    console.log("5. Generating PDF Buffer...");
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
    await browser.close();

    console.log("6. Saving PDF to file system...");
    const safeName = faculty.canonical_name.replace(/[^a-z0-9]/gi, '_');
    const fileName = `Commitment_${safeName}_${Date.now()}.pdf`;
    const filePath = path.join(process.cwd(), 'public', 'pdfs', fileName);
    
    fs.writeFileSync(filePath, pdfBuffer);
    console.log("7. PDF Saved Successfully:", fileName);

    return { success: true, url: `/pdfs/${fileName}` };

  } catch (error: any) {
    console.error("!!! PDF GENERATION FAILED !!!");
    console.error(error);
    // Return the exact error string so the alert box shows it
    return { success: false, message: error.message || "Unknown error occurred" };
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

// ─────────────────────────────────────────────────────────────────────
//  Task #4 additions — bulk PDF + session PDF
//  These wrap the existing generatePDFData() so the modals can trigger
//  PDF creation for a whole session or a list of faculty in one click.
// ─────────────────────────────────────────────────────────────────────

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
    const coordName  = lead?.canonical_name || 'Scientific Committee';
    const coordPhone = lead?.phone || '+91 99981 84930';
    const coordEmail = lead?.email || 'osdermacon@iadvl.org';

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
          <td style="padding:6px;border:1px solid #ddd;font-size:9pt;">${facultyStr || '—'}</td>
          <td style="padding:6px;border:1px solid #ddd;text-align:center;">${roleStr}</td>
          <td style="padding:6px;border:1px solid #ddd;white-space:nowrap;">
            ${t.start_time ? t.start_time.slice(0,5) : '—'} – ${t.end_time ? t.end_time.slice(0,5) : '—'}
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
        <h3 style="font-size:12pt;margin-bottom:12px;">${session.session_code} — ${session.session_name}</h3>

        <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:9pt;">
          <tr><td style="padding:6px;border:1px solid #ddd;background:#f8f9fa;width:22%;"><strong>DATE</strong></td>
              <td style="padding:6px;border:1px solid #ddd;">${formattedDate}</td></tr>
          <tr><td style="padding:6px;border:1px solid #ddd;background:#f8f9fa;"><strong>HALL</strong></td>
              <td style="padding:6px;border:1px solid #ddd;">${session.hall || 'TBD'}</td></tr>
          <tr><td style="padding:6px;border:1px solid #ddd;background:#f8f9fa;"><strong>TIME</strong></td>
              <td style="padding:6px;border:1px solid #ddd;">${session.start_time?.slice(0,5) || '—'} – ${session.end_time?.slice(0,5) || '—'}</td></tr>
          <tr><td style="padding:6px;border:1px solid #ddd;background:#f8f9fa;"><strong>TYPE</strong></td>
              <td style="padding:6px;border:1px solid #ddd;">${session.session_type || '—'}</td></tr>
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
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
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

    return { success: true, url: `/pdfs/${fileName}` };
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

// ─────────────────────────────────────────────────────────────────────
//  Task #7: auto-resequence by start_time
//  Call this after any insert/update/delete on session_topics.
//  Rebuilds sequence_no for the whole session atomically. Safe to call
//  repeatedly. Returns the updated numbering for diagnostics.
// ─────────────────────────────────────────────────────────────────────
export async function resequenceSession(sessionId: string) {
  const { data, error } = await supabase.rpc('resequence_session', {
    p_session_id: sessionId,
  });
  if (error) {
    return { success: false, message: error.message, rows: [] };
  }
  return { success: true, message: 'Resequenced.', rows: data ?? [] };
}
// ─────────────────────────────────────────────────────────────────────
//  Task #10: delete a topic, then resequence its session.
//  faculty_topics has ON DELETE CASCADE in the schema, so faculty links
//  to this topic are removed automatically - no orphans possible.
//  resequence_session() runs AFTER, so remaining topics renumber 1..N
//  with no gaps and no collisions.
// ─────────────────────────────────────────────────────────────────────
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