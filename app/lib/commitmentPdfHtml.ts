import fs from 'fs';
import path from 'path';

type CommitmentInput = {
  faculty: { canonical_name: string; phone?: string | null };
  sessions: Array<{
    session: {
      session_code: string;
      session_name: string;
      session_date: string | null;
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
    coordinator: { name: string; phone: string; email: string };
  }>;
  formLink: string;
};

function getBackgroundDataUri(): string {
  const backgroundPath = path.join(process.cwd(), 'public', 'templates', 'template-bg.jpg');
  if (!fs.existsSync(backgroundPath)) {
    throw new Error(`Missing PDF background template at ${backgroundPath}`);
  }
  return `data:image/jpeg;base64,${fs.readFileSync(backgroundPath).toString('base64')}`;
}

function escapeHtml(value: string | null | undefined): string {
  return (value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatTime(value: string | null | undefined): string {
  if (!value) return '--:--';
  const [hoursText, minutes = '00'] = value.split(':');
  let hours = Number.parseInt(hoursText, 10);
  if (Number.isNaN(hours)) return escapeHtml(value);
  const period = hours >= 12 ? 'PM' : 'AM';
  if (hours === 0) hours = 12;
  else if (hours > 12) hours -= 12;
  return `${hours}:${minutes.slice(0, 2)} ${period}`;
}

function formatDate(value: string | null): string {
  if (!value) return '--';
  const date = new Date(`${value.split('T')[0]}T00:00:00`);
  if (Number.isNaN(date.getTime())) return escapeHtml(value);
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function renderCommitmentHTML(input: CommitmentInput): string {
  const background = getBackgroundDataUri();
  const today = new Date().toLocaleDateString('en-GB');

  const pages = input.sessions.map((sessionData) => {
    const { session, coordinator } = sessionData;
    const topicRows = [...sessionData.topics]
      .sort((a, b) => (a.sequence_no ?? 0) - (b.sequence_no ?? 0))
      .map((topic) => `
        <tr>
          <td>${escapeHtml(topic.topic_title)}</td>
          <td class="timing">${formatTime(topic.start_time)} &ndash; ${formatTime(topic.end_time)}</td>
        </tr>`)
      .join('');

    return `
      <section class="page">
        <main class="content">
          <div class="topline">DATE: ${today}</div>
          <div class="subject">SUBJECT: Faculty Scientific Commitment DERMACON International 2027</div>

          <p>Dear <strong>${escapeHtml(input.faculty.canonical_name)}</strong>,</p>
          <p>Greetings from the Scientific Committee of DERMACON International 2027. We are delighted to welcome you as <strong>${escapeHtml(sessionData.role || 'Faculty')}</strong> and share the details of your scientific commitment.</p>

          <h2>CONFERENCE DETAILS</h2>
          <div class="block">
            <strong>Conference:</strong> DERMACON International 2027<br/>
            <strong>Date:</strong> 4th &ndash; 7th February 2027<br/>
            <strong>Venue:</strong> Helipad Exhibition Centre (HEC), Sector 17, Gandhinagar, Gujarat<br/>
            <strong>Theme:</strong> Dermatology Beyond Borders: Science, Skills &amp; Scale &ndash; India Shining
          </div>

          <h2>SCIENTIFIC COMMITMENT:</h2>
          <table>
            <thead><tr><th>TOPIC</th><th class="timing">TIMING</th></tr></thead>
            <tbody>${topicRows || '<tr><td colspan="2">No topics assigned.</td></tr>'}</tbody>
          </table>

          <h2>SESSION DETAILS:</h2>
          <table class="session-details">
            <tbody>
              <tr><th>NAME</th><td>Workshop &ndash; ${escapeHtml(session.session_code)} ${escapeHtml(session.session_name)}</td></tr>
              <tr><th>HALL</th><td>${escapeHtml(session.hall || 'TBD')}</td></tr>
              <tr><th>DATE</th><td>${formatDate(session.session_date)}</td></tr>
              <tr><th>TIME</th><td>${formatTime(session.start_time)} &ndash; ${formatTime(session.end_time)}</td></tr>
            </tbody>
          </table>

          <p class="small">For any query contact your session coordinator<br/><strong>${escapeHtml(coordinator.name)}</strong> | ${escapeHtml(coordinator.phone)} | ${escapeHtml(coordinator.email)}</p>
          <p class="small">As per IADVL Policy, Conference Registration, Travel and Accommodation will have to be arranged by faculty and delegates themselves.</p>
          <p class="small">If you have not yet registered, you can register at the special faculty rate by <a href="https://dermacon27faculty.groupthink.events/">clicking here</a>.</p>
          <p class="small">Thank you for contributing your time and expertise to the scientific programme. We look forward to your participation and welcoming you to DERMACON International 2027.</p>
          <p class="small"><strong>Confirm your participation. <a href="${escapeHtml(input.formLink)}">Click Here to Confirm</a></strong></p>

          <div class="signature small">
            <p>Warm regards,</p>
            <p><strong>Workshop Committee</strong></p>
            <div class="signature-row"><em>Chairpersons:</em><span>Dr. Aarti Shah, Dr. Janak Thakkar</span></div>
            <div class="signature-row"><em>Co-Chairs:</em><span>Dr. Bhavesh Devani, Dr. Geeta Patel, Dr. Kirti Shah,<br/>Dr. Smita Nagpal</span></div>
          </div>
        </main>
      </section>`;
  });

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; color: #111; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { position: relative; width: 210mm; min-height: 297mm; background: url("${background}") center / 210mm 297mm no-repeat; page-break-after: always; }
  .page:last-child { page-break-after: auto; }
  .content { position: absolute; top: 42mm; left: 63mm; width: 132mm; padding-bottom: 48mm; }
  .topline { margin-bottom: 4mm; font-size: 9pt; }
  .subject { margin-bottom: 6mm; font-weight: bold; }
  p { margin: 0 0 3mm; line-height: 1.35; }
  .small { font-size: 8.5pt; line-height: 1.3; }
  h2 { margin: 4mm 0 2mm; color: #003366; font-size: 9pt; }
  .block { margin-bottom: 2mm; padding: 3mm 4mm; border: 1px solid #e2e5ea; background: #f8f9fa; font-size: 9pt; line-height: 1.4; }
  table { width: 100%; margin-bottom: 3mm; border-collapse: collapse; table-layout: fixed; font-size: 9pt; }
  th, td { padding: 1.6mm 2mm; border: 1px solid #ccc; color: #111; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
  thead th { background: #003366; color: #fff; font-weight: bold; }
  th.timing, td.timing { width: 30%; white-space: nowrap; }
  .session-details th { width: 22%; background: #f2f4f7; }
  .signature { margin-top: 4mm; }
  .signature p { margin-bottom: 1mm; }
  .signature-row { display: grid; grid-template-columns: 47mm 1fr; }
  a { color: #0b57d0; text-decoration: underline; font-weight: bold; }
</style>
</head>
<body>${pages.join('')}</body>
</html>`;
}
