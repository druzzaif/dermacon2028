// app/lib/pdfTemplate.ts
//
// Generates the HTML for the per-faculty commitment letter PDF.
// Background: public/templates/template-bg.png, inlined as base64.

import fs from 'fs';
import path from 'path';

let cachedBg: string | null = null;

function getBackgroundBase64(): string {
  if (cachedBg) return cachedBg;
  const p = path.join(process.cwd(), 'public', 'templates', 'template-bg.png');
  if (!fs.existsSync(p)) {
    throw new Error(
      `Template background not found at ${p}. ` +
      `Place your A4 PNG at public/templates/template-bg.png.`
    );
  }
  cachedBg = fs.readFileSync(p).toString('base64');
  return cachedBg;
}

function fmt12h(t: string | null | undefined): string {
  if (!t) return '--:--';
  const [hs, ms] = t.split(':');
  let h = parseInt(hs, 10);
  const m = ms || '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${m} ${ampm}`;
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '--';
  const dt = new Date(d + 'T00:00:00');
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export type CommitmentInput = {
  faculty: { canonical_name: string };
  sessions: Array<{
    session: {
      id: string;
      session_code: string;
      session_name: string;
      session_date: string;
      hall: string | null;
      start_time: string | null;
      end_time: string | null;
    };
    topics: Array<{
      topic_title: string;
      start_time: string | null;
      end_time: string | null;
      sequence_no: number | null;
    }>;
    role: string;
    coordinator: {
      name: string;
      phone: string;
      email: string;
    };
  }>;
};

export function renderCommitmentHTML(input: CommitmentInput): string {
  const bg = getBackgroundBase64();
  const today = new Date().toLocaleDateString('en-GB');

  const pages = input.sessions.map((s) => {
    const topicsRows = s.topics
      .sort((a, b) => (a.sequence_no ?? 0) - (b.sequence_no ?? 0))
      .map(
        (t) => `
        <tr>
          <td>${escapeHtml(t.topic_title)}</td>
          <td style="white-space:nowrap;">${fmt12h(t.start_time)} &#8211; ${fmt12h(t.end_time)}</td>
        </tr>`
      )
      .join('');

    return `
      <div class="page">
        <div class="content">
          <div class="topline">DATE: ${today}</div>
          <div class="subject">SUBJECT: Faculty Scientific Commitment DERMACON International 2027</div>

          <p>Dear <strong>${escapeHtml(input.faculty.canonical_name)}</strong>,</p>
          <p>
            Greetings from the Scientific Committee of DERMACON International 2027.
            We are delighted to welcome you as <strong>${escapeHtml(s.role || 'Faculty')}</strong>
            and share the details of your scientific commitment.
          </p>

          <div class="section-title">CONFERENCE DETAILS</div>
          <div class="block">
            <strong>Conference:</strong> DERMACON International 2027<br/>
            <strong>Date:</strong> 4th &#8211; 7th February 2027<br/>
            <strong>Venue:</strong> Helipad Exhibition Centre (HEC), Sector 17, Gandhinagar, Gujarat<br/>
            <strong>Theme:</strong> Dermatology Beyond Borders: Science, Skills &amp; Scale &#8211; India Shining
          </div>

          <div class="section-title">SCIENTIFIC COMMITMENT:</div>
          <table>
            <thead><tr><th>TOPIC</th><th style="width:30%;">TIMING</th></tr></thead>
            <tbody>${topicsRows}</tbody>
          </table>

          <div class="section-title">SESSION DETAILS:</div>
          <table class="kv">
            <tr><th>NAME</th><td>Workshop &#8211; ${escapeHtml(s.session.session_code)} ${escapeHtml(s.session.session_name)}</td></tr>
            <tr><th>HALL</th><td>${escapeHtml(s.session.hall || 'TBD')}</td></tr>
            <tr><th>DATE</th><td>${fmtDate(s.session.session_date)}</td></tr>
            <tr><th>TIME</th><td>${fmt12h(s.session.start_time)} &#8211; ${fmt12h(s.session.end_time)}</td></tr>
          </table>

          <p class="small">
            For any query contact your session coordinator<br/>
            <strong>${escapeHtml(s.coordinator.name)}</strong> |
            ${escapeHtml(s.coordinator.phone)} |
            ${escapeHtml(s.coordinator.email)}
          </p>
          <p class="small">
            As per IADVL Policy, Conference Registration, Travel and Accommodation
            will have to be arranged by faculty and delegates themselves.
          </p>
          <p class="small">
            Thank you for contributing your time and expertise to the scientific
            programme. We look forward to your participation and to welcoming you
            to DERMACON International 2027.
          </p>
          <p class="small"><strong>Warm regards,</strong></p>
          <p class="small">
            <strong>Please confirm your attendance by clicking here:
            <a href="#">Click Here to Confirm</a></strong>
          </p>
        </div>
      </div>
    `;
  });

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 10.5pt;
    color: #111;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .page {
    position: relative;
    width: 210mm;
    height: 297mm;
    background-image: url('data:image/png;base64,${bg}');
    background-size: 210mm 297mm;
    background-repeat: no-repeat;
    page-break-after: always;
    overflow: hidden;
  }
  .page:last-child { page-break-after: auto; }

  .content {
    position: absolute;
    top: 42mm;
    left: 63mm;
    width: 132mm;
    height: 220mm;
  }

  .topline   { font-size: 10pt; margin-bottom: 4mm; }
  .subject   { font-weight: bold; margin-bottom: 6mm; }
  p          { margin: 0 0 3mm 0; line-height: 1.35; }
  .small     { font-size: 9pt; line-height: 1.3; }

  .section-title {
    font-weight: bold;
    text-transform: uppercase;
    margin: 4mm 0 2mm 0;
    color: #003366;
    font-size: 9.5pt;
  }
  .block {
    background: #f8f9fa;
    border: 1px solid #e2e5ea;
    padding: 3mm 4mm;
    font-size: 9.5pt;
    line-height: 1.45;
    margin-bottom: 2mm;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 3mm;
    font-size: 9pt;
  }
  th, td {
    border: 1px solid #ccc;
    padding: 1.6mm 2mm;
    text-align: left;
    vertical-align: top;
  }
  thead th { background: #003366; color: #fff; font-weight: bold; }
  table.kv th {
    background: #f2f4f7;
    color: #111;
    width: 22%;
    font-weight: bold;
  }

  a { color: #0b57d0; text-decoration: underline; }
</style>
</head>
<body>
${pages.join('')}
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}