import fs from 'fs';
import path from 'path';
import { isWorkshopSession } from './sessionGroup';

type CommitmentInput = {
  faculty: { canonical_name: string; phone?: string | null };
  sessions: Array<{
    session: {
      session_code: string;
      session_name: string;
      session_type?: string | null;
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
      role?: string | null;        // Faculty, Moderator, Panelist, Chairperson
      speakers?: string[];         // shown under topics the person chairs
      panel?: { moderators: string[]; panelists: string[]; debaters: string[] }; // the others on a panel / debate
    }>;
    role: string;
    coordinator: { name: string; phone: string; email: string };
    // All lead coordinators of the session, in the order arranged in the Edit coordinators
    // dialog. When present, the letter lists every one of them (not just the first).
    coordinators?: Array<{ name: string; phone: string; email: string }>;
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

// Phone numbers and email addresses in the letter are clickable (call / write)
function phoneLink(phone: string | null | undefined): string {
  const shown = String(phone ?? '').trim();
  const digits = shown.replace(/[^0-9+]/g, '');
  return digits ? `<a href="tel:${escapeHtml(digits)}">${escapeHtml(shown)}</a>` : escapeHtml(shown);
}

function emailLink(email: string | null | undefined): string {
  const shown = String(email ?? '').trim();
  return shown.includes('@') ? `<a href="mailto:${escapeHtml(shown)}">${escapeHtml(shown)}</a>` : escapeHtml(shown);
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

// Measured: rows up to ~32.5mm (a 5-row table, or 4 rows with a 3-line title) keep the signature block just above the signature scribbles (~248.7mm); anything longer continues on the next page.
const FIRST_PAGE_MM = 32.5;
const NEXT_PAGE_MM = 150;
// When a session needs more than one page, the greeting + table start on page 1 (no details block there,
// so it holds more rows) and the session details / coordinator / confirm link / signature go on the LAST page.
const FIRST_PAGE_OPEN_MM = 100;
const CLOSING_MM = 90;

// Estimated height of one topic row in mm (one text line = 3.75 mm, plus padding)
// "Moderator: A" / "Panelists: B, C" lines shown under a panel or debate topic
function panelLines(panel?: { moderators: string[]; panelists: string[]; debaters: string[] }): string[] {
  if (!panel) return [];
  const out: string[] = [];
  if (panel.moderators.length) out.push(`${panel.moderators.length > 1 ? 'Moderators' : 'Moderator'}: ${panel.moderators.join(', ')}`);
  if (panel.panelists.length) out.push(`Panelists: ${panel.panelists.join(', ')}`);
  if (panel.debaters.length) out.push(`Debaters: ${panel.debaters.join(', ')}`);
  return out;
}

function rowCostMm(topic: { topic_title: string; speakers?: string[]; panel?: { moderators: string[]; panelists: string[]; debaters: string[] } }, showRole: boolean): number {
  const titleLines = Math.max(1, Math.ceil(String(topic.topic_title || '').length / (showRole ? 37 : 50)));
  const speakerText = (topic.speakers || []).join(', ');
  const speakerLines = speakerText ? Math.ceil(`Speakers: ${speakerText}`.length / (showRole ? 40 : 54)) : 0;
  const panelLineCount = panelLines(topic.panel).reduce((n, l) => n + Math.ceil(l.length / (showRole ? 40 : 54)), 0);
  const extra = speakerLines + panelLineCount;
  return 2.4 + 3.75 * titleLines + (extra ? 0.8 + 3.4 * extra : 0);
}

export function renderCommitmentHTML(input: CommitmentInput): string {
  return renderCommitmentDocument([input]);
}

// Several faculty letters in one document (Print page). One letterhead background, set once in CSS.
export function renderCommitmentDocument(inputs: CommitmentInput[]): string {
  const background = getBackgroundDataUri();
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>${commitmentCss(background)}</style>
</head>
<body>${inputs.map(commitmentPages).join('')}</body>
</html>`;
}

// Workshops are the sessions whose code starts with WS or MC; every other session is a scientific session.
// The rule lives in ./sessionGroup so client pages share it; re-exported here for the server code.
export { isWorkshopSession };

function commitmentPages(input: CommitmentInput): string {
  const today = new Date().toLocaleDateString('en-GB');

  // One page per session. A session with many topics continues on extra pages
  // so nothing is cut off at the bottom of the letterhead.
  const pages = input.sessions.flatMap((sessionData) => {
    const { session, coordinator } = sessionData;
    // Show every lead coordinator of the session, in the order arranged (1, 2, 3 …).
    // Older data without the list falls back to the single coordinator.
    const leads = (sessionData.coordinators && sessionData.coordinators.length
      ? sessionData.coordinators
      : [coordinator]
    ).filter((c) => c && String(c.name || '').trim());
    const sorted = [...sessionData.topics].sort((a, b) => (a.sequence_no ?? 0) - (b.sequence_no ?? 0));
    const showRole = true; // role always sits in its own column, right after the topic
    const workshop = isWorkshopSession(session.session_code);
    // Split topics across pages by estimated height (measured from real renders):
    // the first page has about 26 mm for topic rows, later pages about 150 mm.
    const plan = (firstBudget: number, withClosing: boolean) => {
      const out: (typeof sorted)[] = [];
      let cur: typeof sorted = [];
      let used = 0;
      let budget = firstBudget;
      for (const topic of sorted) {
        const cost = rowCostMm(topic, showRole);
        if (cur.length > 0 && used + cost > budget) {
          out.push(cur);
          cur = [];
          used = 0;
          budget = NEXT_PAGE_MM;
        }
        cur.push(topic);
        used += cost;
      }
      out.push(cur);
      // the closing block needs room on the last page, otherwise it gets a page of its own
      if (withClosing && used + CLOSING_MM > budget) out.push([]);
      return out;
    };
    let chunks = plan(FIRST_PAGE_MM, false);
    // More than one page: details move to the last page, so nothing important sits on a bare "continued" page
    const closingOnLast = chunks.length > 1;
    if (closingOnLast) chunks = plan(FIRST_PAGE_OPEN_MM, true);

    const tableFor = (list: typeof sorted) => {
      const rows = list.map((topic) => `
        <tr>
          <td>${escapeHtml(topic.topic_title)}${(topic.speakers || []).length ? `<div class="speakers">Speakers: ${escapeHtml(topic.speakers!.join(', '))}</div>` : ''}${panelLines(topic.panel).map((l) => `<div class="speakers">${escapeHtml(l)}</div>`).join('')}</td>
          ${showRole ? `<td class="role">${escapeHtml(topic.role || 'Faculty')}</td>` : ''}
          <td class="timing">${formatTime(topic.start_time)} &ndash; ${formatTime(topic.end_time)}</td>
        </tr>`).join('');
      const cols = showRole ? 3 : 2;
      return `<table>
            <thead><tr><th>TOPIC</th>${showRole ? '<th class="role">ROLE</th>' : ''}<th class="timing">TIMING</th></tr></thead>
            <tbody>${rows || `<tr><td colspan="${cols}">No topics assigned.</td></tr>`}</tbody>
          </table>`;
    };

    const closingHtml = () => `
          <h2>SESSION DETAILS:</h2>
          <table class="session-details">
            <tbody>
              <tr><th>NAME</th><td>${workshop ? 'Workshop' : 'Scientific Session'} &ndash; ${escapeHtml(session.session_code)} ${escapeHtml(session.session_name)}</td></tr>
              <tr><th>HALL</th><td>${escapeHtml(session.hall || 'TBD')}</td></tr>
              <tr><th>DATE</th><td>${formatDate(session.session_date)}</td></tr>
              <tr><th>TIME</th><td>${formatTime(session.start_time)} &ndash; ${formatTime(session.end_time)}</td></tr>
            </tbody>
          </table>

          ${leads.length ? `<p class="small">For any query contact your session coordinator${leads.length > 1 ? 's' : ''}<br/>${leads
            .map((c) => `<strong>${escapeHtml(c.name)}</strong>${c.phone ? ` | ${phoneLink(c.phone)}` : ''}${c.email ? ` | ${emailLink(c.email)}` : ''}`)
            .join('<br/>')}</p>` : ''}
          <p class="small">As per IADVL Policy, Conference Registration, Travel and Accommodation will have to be arranged by faculty and delegates themselves.</p>
          <p class="small">If you have not yet registered, you can register at the special faculty rate by <a href="https://dermacon27faculty.groupthink.events/">clicking here</a>.</p>
          <p class="small">Thank you for contributing your time and expertise to the scientific programme. We look forward to your participation and welcoming you to DERMACON International 2027.</p>
          <p class="small"><strong>Confirm your participation. <a href="${escapeHtml(input.formLink)}">Click Here to Confirm</a></strong></p>

          <div class="signature small">
            <p>Warm regards,</p>
            ${workshop ? `<p><strong>Workshop Committee</strong></p>
            <div class="signature-row"><em>Chairpersons:</em><span>Dr. Aarti Shah, Dr. Janak Thakkar</span></div>
            <div class="signature-row"><em>Co-Chairs:</em><span>Dr. Bhavesh Devani, Dr. Geeta Patel, Dr. Kirti Shah,<br/>Dr. Smita Nagpal</span></div>` : '<p><strong>Scientific Committee</strong></p>'}
          </div>`;

    return chunks.map((list, index) => {
      const isLast = index === chunks.length - 1;
      if (index > 0) {
        return `
      <section class="page">
        <main class="content">
          <div class="topline">DATE: ${today}</div>
          <div class="subject">SUBJECT: Faculty Scientific Commitment DERMACON International 2027</div>
          ${list.length ? `<h2>SCIENTIFIC COMMITMENT (continued) &ndash; ${escapeHtml(session.session_code)} ${escapeHtml(session.session_name)}</h2>` : ''}
          ${list.length ? tableFor(list) : ''}
          ${closingOnLast && isLast ? closingHtml() : ''}
        </main>
      </section>`;
      }
      return `
      <section class="page">
        <main class="content">
          <div class="topline">DATE: ${today}</div>
          <div class="subject">SUBJECT: Faculty Scientific Commitment DERMACON International 2027</div>

          <p>Dear <strong>${escapeHtml(input.faculty.canonical_name)}</strong>,</p>
          <p>Greetings from the Scientific Committee of DERMACON International 2027. We are delighted to welcome you and share the details of your scientific commitment.</p>

          <h2>CONFERENCE DETAILS</h2>
          <div class="block">
            <strong>Conference:</strong> DERMACON International 2027<br/>
            <strong>Date:</strong> 4th &ndash; 7th February 2027<br/>
            <strong>Venue:</strong> Helipad Exhibition Centre (HEC), Sector 17, Gandhinagar, Gujarat<br/>
            <strong>Theme:</strong> Dermatology Beyond Borders: Science, Skills &amp; Scale &ndash; India Shining
          </div>

          <h2>SCIENTIFIC COMMITMENT:</h2>
          ${tableFor(list)}

          ${closingOnLast ? '' : closingHtml()}
        </main>
      </section>`;
    });
  });

  return pages.join('');
}

function commitmentCss(background: string): string {
  return `
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 9.5pt; color: #111; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { position: relative; width: 210mm; min-height: 297mm; background: url("${background}") center / 210mm 297mm no-repeat; page-break-after: always; }
  .page:last-child { page-break-after: auto; }
  .content { position: absolute; top: 42mm; left: 63mm; width: 132mm; padding-bottom: 48mm; }
  .topline { margin-bottom: 2.5mm; font-size: 9pt; }
  .subject { margin-bottom: 3.5mm; font-weight: bold; }
  p { margin: 0 0 2.2mm; line-height: 1.3; }
  .small { font-size: 8.5pt; line-height: 1.25; }
  h2 { margin: 2.8mm 0 1.6mm; color: #003366; font-size: 9pt; }
  .block { margin-bottom: 1.5mm; padding: 2mm 3mm; border: 1px solid #e2e5ea; background: #f8f9fa; font-size: 9pt; line-height: 1.4; }
  table { width: 100%; margin-bottom: 2mm; border-collapse: collapse; table-layout: fixed; font-size: 9pt; }
  th, td { padding: 1.1mm 2mm; border: 1px solid #ccc; color: #111; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
  thead th { background: #003366; color: #fff; font-weight: bold; }
  th.timing, td.timing { width: 28%; white-space: nowrap; }
  th.role, td.role { width: 17%; }
  .speakers { margin-top: 0.8mm; font-size: 8pt; font-style: italic; color: #444; }
  .session-details th { width: 22%; background: #f2f4f7; }
  .signature { margin-top: 2.5mm; }
  .signature p { margin-bottom: 1mm; }
  .signature-row { display: grid; grid-template-columns: 47mm 1fr; }
  a { color: #0b57d0; text-decoration: underline; font-weight: bold; }
  .small a[href^="tel:"], .small a[href^="mailto:"] { font-weight: normal; }
`;
}
