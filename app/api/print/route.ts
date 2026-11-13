import puppeteer from 'puppeteer';
import { buildPrintHtml, buildFacultySimpleHtml, type PrintRequest } from '@/app/lib/printReport';
import { facultyLetterheadHtml } from '@/app/actions';

// POST /api/print -> one A4 PDF.
//   By session: { kind: 'sessions', sessionIds, schedule, missing, overlaps, scope, chairs, contacts, confirmed, pagePerSession, emptySlots }
//   By faculty: { kind: 'faculty', facultyIds, format: 'letterhead' | 'simple', contacts, confirmed, pagePerFaculty }
export async function POST(req: Request) {
  let b: any;
  try {
    b = await req.json();
  } catch {
    return Response.json({ error: 'Bad request.' }, { status: 400 });
  }

  try {
    let html = '';
    let letterhead = false;
    let skipped: string[] = [];
    let name = 'Print';

    if (b.kind === 'faculty') {
      const facultyIds: string[] = Array.isArray(b.facultyIds) ? b.facultyIds.map(String) : [];
      if (!facultyIds.length) return Response.json({ error: 'Select at least one faculty member.' }, { status: 400 });
      name = 'Faculty';
      if (b.format === 'letterhead') {
        letterhead = true;
        const r = await facultyLetterheadHtml(facultyIds);
        if (!r.html) return Response.json({ error: 'None of the selected faculty has a topic assigned, so there is no letter to print.' }, { status: 400 });
        html = r.html;
        skipped = r.skipped;
      } else {
        html = await buildFacultySimpleHtml({ facultyIds, contacts: !!b.contacts, confirmed: !!b.confirmed, pagePerFaculty: !!b.pagePerFaculty });
      }
    } else {
      const body: PrintRequest = {
        sessionIds: Array.isArray(b.sessionIds) ? b.sessionIds.map(String) : [],
        schedule: !!b.schedule,
        missing: !!b.missing,
        overlaps: !!b.overlaps,
        scope: b.scope === 'all' ? 'all' : 'selected',
        chairs: !!b.chairs,
        contacts: !!b.contacts,
        confirmed: !!b.confirmed,
        pagePerSession: !!b.pagePerSession,
        emptySlots: !!b.emptySlots,
        coordinators: b.coordinators !== false,
        continuous: !!b.continuous,
      };
      if (!body.schedule && !body.missing && !body.overlaps) {
        return Response.json({ error: 'Choose at least one thing to print.' }, { status: 400 });
      }
      if (body.schedule && !body.missing && !body.overlaps && body.sessionIds.length === 0) {
        return Response.json({ error: 'Select at least one session.' }, { status: 400 });
      }
      html = await buildPrintHtml(body);
    }

    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'], headless: true });
    let pdf: Uint8Array;
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load', timeout: 120000 });
      pdf = letterhead
        ? await page.pdf({ format: 'A4', printBackground: true, margin: { top: 0, right: 0, bottom: 0, left: 0 }, timeout: 120000 })
        : await page.pdf({
            format: 'A4',
            printBackground: true,
            timeout: 120000,
            margin: { top: '12mm', right: '10mm', bottom: '14mm', left: '10mm' },
            displayHeaderFooter: true,
            headerTemplate: '<span></span>',
            footerTemplate:
              '<div style="width:100%;font-size:8px;color:#666;padding:0 10mm;display:flex;justify-content:space-between;font-family:Segoe UI,Arial,sans-serif;">' +
              '<span>DERMACON International 2027</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>',
          });
    } finally {
      await browser.close();
    }
    const stamp = new Date().toISOString().slice(0, 10);
    return new Response(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="DERMACON_${name}_${stamp}.pdf"`,
        'Cache-Control': 'no-store',
        // Faculty left out of a letterhead print (no topics); URI-encoded for the header
        'X-Skipped': encodeURIComponent(skipped.join(', ')),
      },
    });
  } catch (e: any) {
    console.error('print failed:', e);
    return Response.json({ error: e?.message || 'The PDF could not be made.' }, { status: 500 });
  }
}
