// @ts-nocheck
import { NextResponse } from 'next/server';
import { supabase } from '@/app/supabase';
import puppeteer from 'puppeteer';
import { renderCommitmentHTML } from '@/app/lib/pdfTemplate';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const facultyId = searchParams.get('id');
  if (!facultyId) return NextResponse.json({ error: 'Missing ID' }, { status: 400 });

  try {
    const { data: faculty, error: facError } = await supabase
      .from('faculty')
      .select('*')
      .eq('id', facultyId)
      .single();
    if (facError || !faculty) throw new Error('Faculty not found');

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
    if (!topics || topics.length === 0)
      throw new Error('This faculty member has no sessions assigned.');

    const sessionsMap: Record<string, any> = {};
    topics.forEach((t: any) => {
      const session = t.session_topics?.conference_sessions;
      if (!session) return;
      if (!sessionsMap[session.id]) {
        sessionsMap[session.id] = { session, topics: [], role: t.role };
      }
      sessionsMap[session.id].topics.push(t.session_topics);
    });

    const inputSessions = [];
    for (const s of Object.values(sessionsMap) as any[]) {
      const { data: coordData } = await supabase
        .from('session_coordinators')
        .select(`role, faculty ( canonical_name, phone, email )`)
        .eq('session_id', s.session.id)
        .eq('role', 'Lead Coordinator')
        .maybeSingle();
      const lead = coordData?.faculty as any;
      inputSessions.push({
        session: s.session,
        topics: s.topics,
        role: s.role || 'Faculty',
        coordinator: {
          name:  lead?.canonical_name || 'Scientific Committee',
          phone: lead?.phone || '+91 99981 84930',
          email: lead?.email || 'osdermacon@iadvl.org',
        },
      });
    }

    const html = renderCommitmentHTML({
      faculty: { canonical_name: faculty.canonical_name },
      sessions: inputSessions,
    });

    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      headless: true,
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' as any });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    await browser.close();

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