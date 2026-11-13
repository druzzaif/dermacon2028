// Server-only: builds the HTML for the Print page's single PDF.
// Sections: session schedules (selected sessions), missing data, overlaps.
// Rules for "missing" and "overlap" match the Missing data and Overlaps pages.
import { supabase } from '../supabaseServer';
import { formatTime12 } from './time';
import { sortCoordinators } from './coordOrder';
import { sortTopicPeople } from './topicPeople';

export type PrintRequest = {
  sessionIds: string[];
  schedule: boolean;      // print the selected sessions
  missing: boolean;       // add the missing-data report
  overlaps: boolean;      // add the overlaps report
  scope: 'selected' | 'all'; // missing/overlaps: only selected sessions, or the whole programme
  chairs: boolean;        // show chairpersons in the schedule
  contacts: boolean;      // phone + email under every name
  confirmed: boolean;     // ✓ after people who confirmed
  pagePerSession: boolean;
};

const esc = (s: any) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const isTbd = (f: any) => {
  if (!f) return true;
  if (f.faculty_id === 'FAC000') return true;
  const n = String(f.canonical_name || '').trim().toUpperCase();
  return n === '' || n === 'TBD' || n.startsWith('TBD ') || n.startsWith('TBD(');
};
const realHall = (h: any) => {
  const t = String(h ?? '').trim().toLowerCase();
  return t !== '' && t !== 'tbd' && t !== 'null';
};
const roleLabel = (r: string | null | undefined) => {
  const x = r || 'Faculty';
  return x === 'Panel' ? 'Panelist' : x === 'Lead Coordinator' ? 'Lead coordinator' : x;
};
const realEmail = (e: string | null | undefined) => (e && !/@placeholder\.com$/i.test(e) ? e : '');

function fmtDate(d: string | null | undefined, long = true) {
  if (!d) return 'Date not set';
  const dt = new Date(`${d}T00:00:00`);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString('en-GB', long
    ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }
    : { weekday: 'short', day: 'numeric', month: 'short' });
}
const t12 = (t: string | null | undefined) => (t ? formatTime12(t) : '--:--');
const range = (a: any, b: any) => `${t12(a)} – ${t12(b)}`;
const hallText = (h: any) => (realHall(h) ? `Hall ${esc(h)}` : '<span class="bad">Hall not set</span>');

async function loadProgramme() {
  const person = 'id, faculty_id, canonical_name, phone, email';
  const { data, error } = await supabase
    .from('conference_sessions')
    .select(`id, session_code, session_name, session_type, session_date, hall, start_time, end_time,
      session_topics ( id, topic_title, sequence_no, start_time, end_time,
        faculty_topics ( role, confirmed, sort_order, faculty ( ${person} ) ) ),
      session_coordinators ( role, coord_id, faculty ( ${person} ) ),
      session_chairs ( sort_order, faculty ( ${person} ) )`)
    .order('session_date', { ascending: true })
    .order('start_time', { ascending: true });
  if (error) throw error;
  const sessions = (data || []) as any[];
  sessions.forEach((s) => {
    s.session_topics = (s.session_topics || []).sort((a: any, b: any) =>
      (a.sequence_no ?? 999) - (b.sequence_no ?? 999) || String(a.start_time || '').localeCompare(String(b.start_time || '')));
    s.session_coordinators = sortCoordinators(s.session_coordinators || []);
    s.session_chairs = (s.session_chairs || []).filter((c: any) => c.faculty)
      .sort((a: any, b: any) => (a.sort_order ?? 999) - (b.sort_order ?? 999));
  });
  sessions.sort((a, b) =>
    String(a.session_date || '9999').localeCompare(String(b.session_date || '9999')) ||
    String(a.start_time || '').localeCompare(String(b.start_time || '')) ||
    String(a.hall || '').localeCompare(String(b.hall || ''), undefined, { numeric: true }));
  return sessions;
}

// ---------- pieces ----------
function sessionBanner(s: any) {
  return `
  <div class="banner">
    <div class="banner-top">
      <span class="code">${esc(s.session_code)}</span>
      <span class="sname">${esc(s.session_name || 'Untitled session')}</span>
      ${s.session_type ? `<span class="stype">${esc(s.session_type)}</span>` : ''}
    </div>
    <div class="facts">
      <div class="fact"><div class="lbl">Date</div><div class="val">${s.session_date ? esc(fmtDate(s.session_date)) : '<span class="bad">Date not set</span>'}</div></div>
      <div class="fact"><div class="lbl">Time</div><div class="val">${esc(range(s.start_time, s.end_time))}</div></div>
      <div class="fact"><div class="lbl">Hall</div><div class="val">${hallText(s.hall)}</div></div>
    </div>
  </div>`;
}

function personLine(f: any, extra: string, o: PrintRequest, confirmed?: boolean, prefix = '') {
  const tick = o.confirmed && confirmed ? ' <span class="tick">✓</span>' : '';
  const contact = o.contacts && !isTbd(f)
    ? [f.phone ? `Ph: ${esc(f.phone)}` : '', realEmail(f.email) ? esc(realEmail(f.email)) : ''].filter(Boolean).join(' · ')
    : '';
  return `<div class="person"><span class="pname">${esc(prefix)}${esc(f?.canonical_name || '—')}</span>${extra ? ` <span class="role">(${esc(extra)})</span>` : ''}${tick}${contact ? `<div class="contact">${contact}</div>` : ''}</div>`;
}

function sessionSchedule(s: any, o: PrintRequest, first: boolean) {
  const coords = s.session_coordinators.filter((c: any) => !isTbd(c.faculty));
  const coordHtml = coords.length
    ? `<div class="coords"><div class="coords-title">Coordinators</div>${coords.map((c: any, i: number) => personLine(c.faculty, roleLabel(c.role), o, undefined, `${i + 1}. `)).join('')}</div>`
    : `<div class="coords"><div class="coords-title">Coordinators</div><span class="bad">None assigned</span></div>`;

  // Chairpersons of the whole session: shown once here, not on each topic
  const chairHtml = s.session_chairs.length
    ? `<div class="coords"><div class="coords-title">Session chair</div>${s.session_chairs.map((c: any, i: number) => personLine(c.faculty, '', o, undefined, `${i + 1}. `)).join('')}</div>`
    : '';

  const rows = s.session_topics.map((t: any) => {
    const links = t.faculty_topics || [];
    const speakers = sortTopicPeople(links.filter((ft: any) => ft.role !== 'Chairperson'));
    const chairs = links.filter((ft: any) => ft.role === 'Chairperson');
    const spHtml = speakers.length
      ? speakers.map((ft: any, i: number) => personLine(ft.faculty, ft.role && ft.role !== 'Faculty' ? roleLabel(ft.role) : '', o, ft.confirmed, speakers.length > 1 ? `${i + 1}. ` : '')).join('')
      : '<span class="bad">No speaker</span>';
    const chHtml = chairs.length ? chairs.map((ft: any) => personLine(ft.faculty, '', o, ft.confirmed)).join('') : '<span class="muted">—</span>';
    return `<tr>
      <td class="c-no">${esc(t.sequence_no ?? '')}</td>
      <td class="c-time">${esc(t12(t.start_time))}<br>${esc(t12(t.end_time))}</td>
      <td class="c-topic">${esc(t.topic_title || '(no title)')}</td>
      <td>${spHtml}</td>
      ${o.chairs ? `<td>${chHtml}</td>` : ''}
    </tr>`;
  }).join('');

  const cols = o.chairs
    ? '<col style="width:5%"><col style="width:12%"><col style="width:35%"><col style="width:28%"><col style="width:20%">'
    : '<col style="width:5%"><col style="width:12%"><col style="width:43%"><col style="width:40%">';

  return `
  <section class="session ${o.pagePerSession && !first ? 'newpage' : ''}">
    ${sessionBanner(s)}
    ${chairHtml}
    ${coordHtml}
    ${s.session_topics.length ? `
    <table class="grid">
      <colgroup>${cols}</colgroup>
      <thead><tr><th>No.</th><th>Time</th><th>Topic</th><th>Faculty</th>${o.chairs ? '<th>Chairperson</th>' : ''}</tr></thead>
      <tbody>${rows}</tbody>
    </table>` : '<p class="bad">This session has no topics yet.</p>'}
  </section>`;
}

// ---------- missing data ----------
function missingFor(s: any) {
  const issues: string[] = [];
  if (!s.session_date) issues.push('Date not set');
  if (!realHall(s.hall)) issues.push('Hall not set');
  if (s.start_time && s.end_time && s.end_time <= s.start_time) issues.push(`Session ends before it starts (${t12(s.start_time)} – ${t12(s.end_time)})`);
  if (!s.session_coordinators.some((c: any) => !isTbd(c.faculty))) issues.push('No coordinators assigned');
  if (!s.session_topics.length) issues.push('No topics yet');
  s.session_topics.forEach((t: any) => {
    const real = (t.faculty_topics || []).filter((ft: any) => ft.role !== 'Chairperson' && !isTbd(ft.faculty));
    if (!real.length) issues.push(`No. ${t.sequence_no ?? '?'} – ${t.topic_title || '(no title)'}: needs a speaker`);
    if (t.start_time && t.end_time && t.end_time <= t.start_time) issues.push(`No. ${t.sequence_no ?? '?'} – ${t.topic_title || '(no title)'}: ends before it starts`);
  });
  return issues;
}

function missingSection(sessions: any[], scopeLabel: string) {
  const rows = sessions.map((s) => ({ s, issues: missingFor(s) })).filter((x) => x.issues.length);
  const total = rows.reduce((n, x) => n + x.issues.length, 0);
  const body = rows.length
    ? `<table class="grid">
        <colgroup><col style="width:30%"><col style="width:22%"><col style="width:48%"></colgroup>
        <thead><tr><th>Session</th><th>Date · Time · Hall</th><th>What is missing</th></tr></thead>
        <tbody>${rows.map(({ s, issues }) => `<tr>
          <td><span class="code-sm">${esc(s.session_code)}</span> ${esc(s.session_name || '')}</td>
          <td><span class="hl">${esc(fmtDate(s.session_date, false))}</span><br>${esc(range(s.start_time, s.end_time))}<br>${hallText(s.hall)}</td>
          <td><ul class="issues">${issues.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></td>
        </tr>`).join('')}</tbody>
      </table>`
    : '<p class="ok">Nothing missing. Every session has a date, hall, coordinators, topics and speakers.</p>';
  return `
  <section class="report newpage">
    <h1 class="rtitle">Missing data</h1>
    <p class="rsub">${esc(scopeLabel)} · ${rows.length} session${rows.length === 1 ? '' : 's'} with ${total} item${total === 1 ? '' : 's'} to fix</p>
    ${body}
  </section>`;
}

// ---------- overlaps ----------
function overlapsSection(all: any[], inScope: Set<string>, scopeLabel: string) {
  type Slot = { s: any; t: any };
  const topics: Slot[] = all.flatMap((s) => s.session_topics.map((t: any) => ({ s, t })));
  const clash = (a: Slot, b: Slot) =>
    a.s.session_date && a.s.session_date === b.s.session_date &&
    String(a.t.start_time || '') < String(b.t.end_time || '') && String(b.t.start_time || '') < String(a.t.end_time || '');
  const touches = (a: Slot, b: Slot) => inScope.has(a.s.id) || inScope.has(b.s.id);

  // Faculty booked twice (sessions with a real hall only, TBD ignored)
  const byPerson = new Map<string, { name: string; slots: any[] }>();
  topics.forEach((x) => {
    if (!realHall(x.s.hall)) return;
    (x.t.faculty_topics || []).forEach((ft: any) => {
      if (isTbd(ft.faculty)) return;
      const key = ft.faculty.id || ft.faculty.canonical_name;
      const e: { name: string; slots: any[] } = byPerson.get(key) || { name: ft.faculty.canonical_name, slots: [] };
      e.slots.push({ ...x, role: ft.role } as any);
      byPerson.set(key, e);
    });
  });
  const fac: { name: string; a: any; b: any }[] = [];
  byPerson.forEach(({ name, slots }) => {
    for (let i = 0; i < slots.length; i++)
      for (let j = i + 1; j < slots.length; j++)
        if (slots[i].t.id !== slots[j].t.id && clash(slots[i], slots[j]) && touches(slots[i], slots[j]))
          fac.push({ name, a: slots[i], b: slots[j] });
  });
  fac.sort((x, y) => String(x.a.s.session_date).localeCompare(String(y.a.s.session_date)) || x.name.localeCompare(y.name));

  // Same hall, same time, different sessions (one line per pair of sessions)
  const hall: { a: Slot; b: Slot }[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < topics.length; i++)
    for (let j = i + 1; j < topics.length; j++) {
      const a = topics[i], b = topics[j];
      if (a.s.id === b.s.id || !realHall(a.s.hall)) continue;
      if (String(a.s.hall).trim().toUpperCase() !== String(b.s.hall ?? '').trim().toUpperCase()) continue;
      if (!clash(a, b) || !touches(a, b)) continue;
      const key = [a.s.id, b.s.id].sort().join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      hall.push({ a, b });
    }

  const slotCell = (x: any) => `
    <div><span class="code-sm">${esc(x.s.session_code)}</span> ${esc(x.s.session_name || '')}</div>
    <div class="slot"><span class="hl">${esc(range(x.t.start_time, x.t.end_time))}</span> · ${hallText(x.s.hall)}${x.role ? ` · ${esc(roleLabel(x.role))}` : ''}</div>
    <div class="muted">“${esc(x.t.topic_title || '')}”</div>`;

  const facTable = fac.length
    ? `<table class="grid">
        <colgroup><col style="width:20%"><col style="width:14%"><col style="width:33%"><col style="width:33%"></colgroup>
        <thead><tr><th>Faculty</th><th>Date</th><th>Booked in</th><th>Also booked in</th></tr></thead>
        <tbody>${fac.map((r) => `<tr><td><strong>${esc(r.name)}</strong></td><td><span class="hl">${esc(fmtDate(r.a.s.session_date, false))}</span></td><td>${slotCell(r.a)}</td><td>${slotCell(r.b)}</td></tr>`).join('')}</tbody>
      </table>`
    : '<p class="ok">No faculty member is booked twice.</p>';

  const hallTable = hall.length
    ? `<table class="grid">
        <colgroup><col style="width:12%"><col style="width:14%"><col style="width:37%"><col style="width:37%"></colgroup>
        <thead><tr><th>Hall</th><th>Date</th><th>Session</th><th>Clashes with</th></tr></thead>
        <tbody>${hall.map((r) => `<tr><td><strong>Hall ${esc(r.a.s.hall)}</strong></td><td><span class="hl">${esc(fmtDate(r.a.s.session_date, false))}</span></td><td>${slotCell(r.a)}</td><td>${slotCell(r.b)}</td></tr>`).join('')}</tbody>
      </table>`
    : '<p class="ok">No hall is double-booked.</p>';

  return `
  <section class="report newpage">
    <h1 class="rtitle">Overlaps</h1>
    <p class="rsub">${esc(scopeLabel)} · Sessions without a hall are skipped</p>
    <h2 class="rh2">Faculty booked twice (${fac.length})</h2>
    ${facTable}
    <h2 class="rh2">Hall double-booked (${hall.length})</h2>
    ${hallTable}
  </section>`;
}

const CSS = `
  * { box-sizing: border-box; }
  body { font-family: "Segoe UI", Arial, sans-serif; color: #111; font-size: 10pt; margin: 0;
         -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .newpage { break-before: page; }
  .cover { border-bottom: 3px solid #4a2c6e; padding-bottom: 8px; margin-bottom: 14px; }
  .cover h1 { margin: 0; font-size: 18pt; color: #4a2c6e; }
  .cover p { margin: 4px 0 0; color: #444; font-size: 9.5pt; }
  .session { margin-bottom: 22px; }
  .banner { border: 2px solid #4a2c6e; border-radius: 6px; overflow: hidden; margin-bottom: 8px; break-inside: avoid; }
  .banner-top { background: #4a2c6e; color: #fff; padding: 7px 10px; display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
  .code { background: #fff; color: #4a2c6e; font-weight: 800; padding: 1px 8px; border-radius: 4px; font-size: 12pt; }
  .sname { font-size: 13pt; font-weight: 700; flex: 1; }
  .stype { font-size: 9pt; border: 1px solid rgba(255,255,255,.7); border-radius: 10px; padding: 0 8px; }
  .facts { display: flex; background: #fff3c4; }
  .fact { flex: 1; padding: 6px 10px; border-right: 1px solid #e2cf7d; }
  .fact:last-child { border-right: 0; }
  .lbl { font-size: 7.5pt; text-transform: uppercase; letter-spacing: .06em; color: #6b5300; font-weight: 700; }
  .val { font-size: 12pt; font-weight: 800; color: #111; }
  .coords { margin: 0 0 8px; padding: 6px 10px; background: #f4f0fa; border-left: 4px solid #4a2c6e; border-radius: 3px;
            display: flex; flex-wrap: wrap; gap: 4px 18px; align-items: baseline; break-inside: avoid; }
  .coords-title { font-weight: 800; font-size: 9pt; text-transform: uppercase; letter-spacing: .05em; color: #4a2c6e; width: 100%; }
  table.grid { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 9.5pt; }
  table.grid th { background: #e9e4f1; color: #2d1a47; text-align: left; padding: 5px 6px; border: 1px solid #b9b0c9; font-size: 8.5pt; text-transform: uppercase; letter-spacing: .04em; }
  table.grid td { border: 1px solid #c9c9c9; padding: 5px 6px; vertical-align: top; overflow-wrap: anywhere; }
  table.grid thead { display: table-header-group; }
  table.grid tr { break-inside: avoid; }
  table.grid tbody tr:nth-child(even) td { background: #fafafa; }
  .c-no { text-align: center; font-weight: 700; }
  .c-time { white-space: nowrap; font-variant-numeric: tabular-nums; font-weight: 600; }
  .c-topic { font-weight: 600; }
  .person { margin-bottom: 3px; }
  .person:last-child { margin-bottom: 0; }
  .pname { font-weight: 600; }
  .role { color: #555; }
  .tick { color: #137a2f; font-weight: 800; }
  .contact { font-size: 8.5pt; color: #333; }
  .bad { color: #b42318; font-weight: 700; }
  .ok { color: #137a2f; font-weight: 600; padding: 8px 10px; background: #ecf8ef; border: 1px solid #b7e2c2; border-radius: 4px; }
  .muted { color: #666; }
  .hl { background: #fff3c4; font-weight: 700; padding: 0 3px; border-radius: 2px; }
  .code-sm { background: #4a2c6e; color: #fff; font-weight: 700; padding: 0 5px; border-radius: 3px; font-size: 8.5pt; }
  .slot { margin: 2px 0; }
  .rtitle { margin: 0; font-size: 17pt; color: #4a2c6e; border-bottom: 3px solid #4a2c6e; padding-bottom: 4px; }
  .rsub { margin: 4px 0 12px; color: #444; }
  .rh2 { font-size: 12pt; margin: 16px 0 6px; color: #2d1a47; }
  ul.issues { margin: 0; padding-left: 16px; }
  ul.issues li { margin-bottom: 2px; }
  .legend { margin-top: 4px; font-size: 8.5pt; color: #444; }
`;

// ---------- by faculty (simple PDF) ----------
export type FacultyPrintRequest = {
  facultyIds: string[];
  contacts: boolean;       // faculty's own phone/email + lead coordinator contact per session
  confirmed: boolean;
  pagePerFaculty: boolean;
};

export async function buildFacultySimpleHtml(o: FacultyPrintRequest) {
  const all = await loadProgramme();
  const { data: people, error } = await supabase
    .from('faculty').select('id, faculty_id, canonical_name, phone, email, designation, country')
    .in('id', o.facultyIds);
  if (error) throw error;
  const byId = new Map((people || []).map((f: any) => [String(f.id), f]));

  const blocks = o.facultyIds.map((fid, idx) => {
    const f = byId.get(String(fid));
    if (!f) return '';
    // Every topic this person is on (any role), and every session they coordinate
    const rows: any[] = [];
    const coordOf: any[] = [];
    all.forEach((s) => {
      s.session_coordinators.forEach((c: any) => { if (String(c.faculty?.id) === String(fid)) coordOf.push({ s, role: c.role }); });
      s.session_topics.forEach((t: any) => (t.faculty_topics || []).forEach((ft: any) => {
        if (String(ft.faculty?.id) === String(fid)) rows.push({ s, t, role: ft.role, confirmed: ft.confirmed });
      }));
    });
    rows.sort((a, b) =>
      String(a.s.session_date || '9999').localeCompare(String(b.s.session_date || '9999')) ||
      String(a.t.start_time || '').localeCompare(String(b.t.start_time || '')));

    const leadOf = (s: any) => s.session_coordinators.find((c: any) => c.role === 'Lead Coordinator' && !isTbd(c.faculty))?.faculty;
    const nConf = rows.filter((r) => r.confirmed).length;

    const contactLine = o.contacts
      ? [f.phone ? `Ph: ${esc(f.phone)}` : '', realEmail(f.email) ? esc(realEmail(f.email)) : ''].filter(Boolean).join(' · ')
      : '';

    // Group the topics by day so each date stands out
    const days = new Map<string, any[]>();
    rows.forEach((r) => { const k = r.s.session_date || ''; days.set(k, [...(days.get(k) || []), r]); });

    const tables = [...days.entries()].map(([day, list]) => `
      <div class="dayhead">${day ? esc(fmtDate(day)) : '<span class="bad">Date not set</span>'}</div>
      <table class="grid">
        <colgroup><col style="width:13%"><col style="width:27%"><col style="width:10%"><col style="width:34%"><col style="width:16%"></colgroup>
        <thead><tr><th>Time</th><th>Session</th><th>Hall</th><th>Topic</th><th>Role</th></tr></thead>
        <tbody>${list.map((r) => {
          const lead = o.contacts ? leadOf(r.s) : null;
          return `<tr>
            <td class="c-time"><span class="hl">${esc(t12(r.t.start_time))}</span><br>${esc(t12(r.t.end_time))}</td>
            <td><span class="code-sm">${esc(r.s.session_code)}</span> ${esc(r.s.session_name || '')}
              <div class="muted">${esc(range(r.s.start_time, r.s.end_time))}</div>
              ${lead ? `<div class="contact">Coordinator: ${esc(lead.canonical_name)}${lead.phone ? ` · ${esc(lead.phone)}` : ''}</div>` : ''}</td>
            <td><strong>${realHall(r.s.hall) ? esc(r.s.hall) : '<span class="bad">Not set</span>'}</strong></td>
            <td class="c-topic">${esc(r.t.topic_title || '(no title)')}</td>
            <td>${esc(roleLabel(r.role))}${o.confirmed ? (r.confirmed ? '<div class="tick">✓ Confirmed</div>' : '<div class="muted">Not confirmed</div>') : ''}</td>
          </tr>`;
        }).join('')}</tbody>
      </table>`).join('');

    const coordHtml = coordOf.length ? `
      <h2 class="rh2">Session coordinator for (${coordOf.length})</h2>
      <table class="grid">
        <colgroup><col style="width:40%"><col style="width:24%"><col style="width:20%"><col style="width:16%"></colgroup>
        <thead><tr><th>Session</th><th>Date</th><th>Time</th><th>Hall · Role</th></tr></thead>
        <tbody>${coordOf.map(({ s, role }) => `<tr>
          <td><span class="code-sm">${esc(s.session_code)}</span> ${esc(s.session_name || '')}</td>
          <td><span class="hl">${esc(fmtDate(s.session_date, false))}</span></td>
          <td>${esc(range(s.start_time, s.end_time))}</td>
          <td>${hallText(s.hall)}<div class="muted">${esc(roleLabel(role))}</div></td>
        </tr>`).join('')}</tbody>
      </table>` : '';

    return `
    <section class="${o.pagePerFaculty && idx > 0 ? 'newpage' : 'fac-gap'}">
      <div class="banner">
        <div class="banner-top">
          ${f.faculty_id ? `<span class="code">${esc(f.faculty_id)}</span>` : ''}
          <span class="sname">${esc(f.canonical_name)}</span>
        </div>
        <div class="facts">
          <div class="fact"><div class="lbl">Topics</div><div class="val">${rows.length}</div></div>
          <div class="fact"><div class="lbl">Days</div><div class="val">${days.size}</div></div>
          ${o.confirmed ? `<div class="fact"><div class="lbl">Confirmed</div><div class="val">${nConf} of ${rows.length}</div></div>` : ''}
          ${contactLine ? `<div class="fact" style="flex:2"><div class="lbl">Contact</div><div class="val" style="font-size:10pt">${contactLine}</div></div>` : ''}
        </div>
      </div>
      ${rows.length ? tables : '<p class="muted">No topics assigned.</p>'}
      ${coordHtml}
    </section>`;
  }).join('');

  const now = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const n = o.facultyIds.length;
  const cover = `<div class="cover"><h1>DERMACON International 2027</h1><p>Faculty schedule · ${n} faculty · Printed ${esc(now)}</p></div>`;
  const extraCss = `.dayhead { margin: 12px 0 4px; font-weight: 800; font-size: 11pt; color: #2d1a47; background: #fff3c4; border-left: 5px solid #e0b100; padding: 4px 8px; break-after: avoid; }
    .fac-gap { margin-bottom: 26px; }`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>DERMACON faculty print</title><style>${CSS}${extraCss}</style></head><body>${cover}${blocks}</body></html>`;
}

export async function buildPrintHtml(o: PrintRequest) {
  const all = await loadProgramme();
  const selectedIds = new Set(o.sessionIds.map(String));
  const selected = all.filter((s) => selectedIds.has(String(s.id)));
  const scopeAll = o.scope === 'all' || selected.length === 0;
  const scoped = scopeAll ? all : selected;
  const scopeIds = new Set(scoped.map((s) => s.id));
  const scopeLabel = scopeAll ? 'Whole programme' : `${selected.length} selected session${selected.length === 1 ? '' : 's'}`;

  const parts: string[] = [];
  const what = [
    o.schedule && selected.length ? `${selected.length} session${selected.length === 1 ? '' : 's'}` : '',
    o.missing ? 'missing data' : '',
    o.overlaps ? 'overlaps' : '',
  ].filter(Boolean).join(' · ');
  const now = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  parts.push(`<div class="cover"><h1>DERMACON International 2027</h1><p>${esc(what)} · Printed ${esc(now)}${o.confirmed && o.schedule ? ' · ✓ = confirmed (as of the last sync)' : ''}</p></div>`);

  let firstBlock = true;
  if (o.schedule) {
    selected.forEach((s) => { parts.push(sessionSchedule(s, o, firstBlock)); firstBlock = false; });
  }
  if (o.missing) parts.push(missingSection(scoped, scopeLabel).replace('report newpage', firstBlock ? 'report' : 'report newpage'));
  if (o.missing) firstBlock = false;
  if (o.overlaps) parts.push(overlapsSection(all, scopeIds, scopeLabel).replace('report newpage', firstBlock ? 'report' : 'report newpage'));

  return `<!doctype html><html><head><meta charset="utf-8"><title>DERMACON print</title><style>${CSS}</style></head><body>${parts.join('\n')}</body></html>`;
}
