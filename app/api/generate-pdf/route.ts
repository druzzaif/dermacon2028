import { NextResponse } from 'next/server';
import { supabase } from '@/app/supabase';
import puppeteer from 'puppeteer';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const facultyId = searchParams.get('id');

  if (!facultyId) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

  try {
    // 1. Fetch Faculty Data
    const { data: faculty, error: facError } = await supabase
      .from('faculty')
      .select('*')
      .eq('id', facultyId)
      .single();

    if (facError || !faculty) throw new Error("Faculty not found");

    // 2. Fetch Topics
    const { data: topics } = await supabase
      .from('faculty_topics')
      .select(`
        role,
        session_topics (
          topic_title, start_time, end_time, sequence_no,
          conference_sessions ( id, session_code, session_name, session_date, hall, start_time, end_time )
        )
      `)
      .eq('faculty_id', facultyId);

    if (!topics || topics.length === 0) throw new Error("This faculty member has no sessions assigned.");

    const sessionsMap: Record<string, any> = {};
    topics.forEach(t => {
      const session = t.session_topics?.conference_sessions;
      if (!session) return;
      if (!sessionsMap[session.id]) sessionsMap[session.id] = { session, topics: [] };
      sessionsMap[session.id].topics.push(t.session_topics);
    });

    const uniqueSessions = Object.values(sessionsMap);
    let htmlPages = '';

    // 3. Build HTML
    for (const s of uniqueSessions) {
      const { data: coordData } = await supabase
        .from('session_coordinators')
        .select(`role, faculty ( canonical_name, phone, email )`)
        .eq('session_id', s.session.id)
        .eq('role', 'Lead Coordinator')
        .single();

      const leadCoord = coordData?.faculty;
      const coordName = leadCoord?.canonical_name || 'Scientific Committee';
      const coordPhone = leadCoord?.phone || '+91 99981 84930';
      const coordEmail = leadCoord?.email || 'osdermacon@iadvl.org';
      const formattedDate = new Date(s.session.session_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

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

    // 4. Generate PDF
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'], headless: true });
    const page = await browser.newPage();
    await page.setContent(fullHtml, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
    await browser.close();

    // 5. Return the PDF file directly
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="Commitment_${faculty.canonical_name.replace(/ /g, '_')}.pdf"`,
      },
    });

  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
