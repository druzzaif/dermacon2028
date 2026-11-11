import * as XLSX from 'xlsx';
import { supabase } from '../supabase';

// Reads every row (PostgREST caps a single request at 1000 rows)
async function fetchAll(table: string, select: string, order?: string): Promise<any[]> {
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    let q: any = supabase.from(table).select(select).range(from, from + 999);
    if (order) q = q.order(order, { ascending: true });
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

const IST = 'Asia/Kolkata';
export function istParts(d = new Date()) {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: IST, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d);
  const g = (t: string) => f.find((p) => p.type === t)?.value || '';
  const hh = g('hour') === '24' ? '00' : g('hour');
  return { date: `${g('year')}-${g('month')}-${g('day')}`, time: `${hh}${g('minute')}`, clock: `${hh}:${g('minute')}` };
}
const fmtDT = (v: any) =>
  v ? new Date(v).toLocaleString('en-GB', { timeZone: IST, dateStyle: 'medium', timeStyle: 'short' }) : '';
const t5 = (v: any) => (v ? String(v).slice(0, 5) : '');
const isTbd = (f: any) => !f || f.faculty_id === 'FAC000' || /^TBD/i.test(f.canonical_name || '');

function sheet(wb: XLSX.WorkBook, name: string, rows: any[], empty: string) {
  const data = rows.length ? rows : [{ Info: empty }];
  const ws = XLSX.utils.json_to_sheet(data);
  const keys = Object.keys(data[0]);
  ws['!cols'] = keys.map((k) => ({
    wch: Math.min(60, Math.max(k.length + 2, ...data.slice(0, 200).map((r: any) => String(r[k] ?? '').length + 2))),
  }));
  ws['!freeze'] = { xSplit: 0, ySplit: 1 } as any;
  XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
}

export async function buildBackupWorkbook() {
  const [faculty, sessions, topics, ft, coords] = await Promise.all([
    fetchAll('faculty', '*', 'canonical_name'),
    fetchAll('conference_sessions', '*', 'session_date'),
    fetchAll('session_topics', '*', 'id'),
    fetchAll('faculty_topics', '*'),
    fetchAll('session_coordinators', '*'),
  ]);
  const fById = new Map(faculty.map((f) => [f.id, f]));
  const sById = new Map(sessions.map((s) => [s.id, s]));
  const tById = new Map(topics.map((t) => [t.id, t]));

  const wb = XLSX.utils.book_new();
  const now = istParts();

  const speakers = ft.filter((r) => r.role !== 'Chairperson');
  const chairs = ft.filter((r) => r.role === 'Chairperson');
  const topicsWithSpeaker = new Set(speakers.filter((r) => !isTbd(fById.get(r.faculty_id))).map((r) => r.topic_id));
  const confirmed = ft.filter((r) => r.confirmed);

  sheet(wb, 'Summary', [
    { Item: 'Backup taken (IST)', Value: `${now.date} ${now.clock}` },
    { Item: 'Faculty', Value: faculty.length },
    { Item: 'Sessions', Value: sessions.length },
    { Item: 'Topics', Value: topics.length },
    { Item: 'Faculty–topic assignments (all roles)', Value: ft.length },
    { Item: 'Chairperson assignments', Value: chairs.length },
    { Item: 'Confirmed assignments', Value: confirmed.length },
    { Item: 'Faculty emailed', Value: faculty.filter((f) => f.email_sent).length },
    { Item: 'Topics without a speaker', Value: topics.filter((t) => !topicsWithSpeaker.has(t.id)).length },
  ], '');

  sheet(wb, 'Faculty', faculty.map((f) => ({
    'Faculty ID': f.faculty_id, Name: f.canonical_name, Email: f.email || '', Phone: f.phone || '',
    Country: f.country || '', Type: f.person_type || '',
    'Topics (all roles)': ft.filter((r) => r.faculty_id === f.id).length,
    'Confirmed topics': ft.filter((r) => r.faculty_id === f.id && r.confirmed).length,
    'Email sent': f.email_sent ? 'Yes' : 'No', 'Email sent on': fmtDT(f.email_sent_date),
    'Reminder sent': f.reminder_sent ? 'Yes' : 'No',
  })), 'No faculty');

  sheet(wb, 'Sessions', sessions.map((s) => ({
    Code: s.session_code, Name: s.session_name, Type: s.session_type || '', Date: s.session_date || '',
    Start: t5(s.start_time), End: t5(s.end_time), Hall: s.hall || '',
    Topics: topics.filter((t) => t.session_id === s.id).length,
    Coordinators: coords.filter((c) => c.session_id === s.id && !isTbd(fById.get(c.faculty_id)))
      .map((c) => `${fById.get(c.faculty_id)?.canonical_name} (${c.role})`).join('; '),
  })), 'No sessions');

  const topicRows = topics.map((t) => {
    const s = sById.get(t.session_id);
    const sp = speakers.filter((r) => r.topic_id === t.id).map((r) => `${fById.get(r.faculty_id)?.canonical_name} (${r.role || 'Speaker'})`);
    const ch = chairs.filter((r) => r.topic_id === t.id).map((r) => fById.get(r.faculty_id)?.canonical_name);
    return {
      Session: s?.session_code || '', Date: s?.session_date || '', Hall: s?.hall || '', '#': t.sequence_no ?? '',
      Start: t5(t.start_time), End: t5(t.end_time), Topic: t.topic_title,
      Speakers: sp.join('; '), Chairpersons: ch.join('; '),
    };
  }).sort((a, b) => (a.Date + a.Session + String(a['#']).padStart(4, '0')).localeCompare(b.Date + b.Session + String(b['#']).padStart(4, '0')));
  sheet(wb, 'Topics', topicRows, 'No topics');

  sheet(wb, 'Faculty-Topics', ft.map((r) => {
    const t = tById.get(r.topic_id); const s = t ? sById.get(t.session_id) : null;
    return {
      Faculty: fById.get(r.faculty_id)?.canonical_name || '', Role: r.role || 'Speaker',
      Session: s?.session_code || '', Topic: t?.topic_title || '', Date: s?.session_date || '',
      Start: t5(t?.start_time), End: t5(t?.end_time),
      Confirmed: r.confirmed ? 'Yes' : 'No', 'Confirmed at': fmtDT(r.confirmed_at),
    };
  }).sort((a, b) => a.Faculty.localeCompare(b.Faculty)), 'No assignments');

  sheet(wb, 'Chairpersons', chairs.map((r) => {
    const t = tById.get(r.topic_id); const s = t ? sById.get(t.session_id) : null;
    return {
      Chairperson: fById.get(r.faculty_id)?.canonical_name || '', Session: s?.session_code || '',
      Topic: t?.topic_title || '', Date: s?.session_date || '', Start: t5(t?.start_time), End: t5(t?.end_time),
      Confirmed: r.confirmed ? 'Yes' : 'No',
    };
  }), 'No chairpersons assigned');

  sheet(wb, 'Coordinators', coords.filter((c) => !isTbd(fById.get(c.faculty_id))).map((c) => {
    const f = fById.get(c.faculty_id); const s = sById.get(c.session_id);
    return { Session: s?.session_code || '', 'Session name': s?.session_name || '', Role: c.role,
      Coordinator: f?.canonical_name, Email: f?.email || '', Phone: f?.phone || '' };
  }), 'No coordinators');

  sheet(wb, 'Confirmations', confirmed.map((r) => {
    const t = tById.get(r.topic_id); const s = t ? sById.get(t.session_id) : null;
    return { Faculty: fById.get(r.faculty_id)?.canonical_name || '', Role: r.role || 'Speaker',
      Session: s?.session_code || '', Topic: t?.topic_title || '', 'Confirmed at': fmtDT(r.confirmed_at) };
  }), 'Nothing confirmed yet');

  const missing: any[] = [];
  topics.forEach((t) => {
    if (!topicsWithSpeaker.has(t.id)) missing.push({ Session: sById.get(t.session_id)?.session_code || '', Issue: 'Topic has no speaker', Detail: t.topic_title });
  });
  sessions.forEach((s) => {
    if (!topics.some((t) => t.session_id === s.id)) missing.push({ Session: s.session_code, Issue: 'Session has no topics', Detail: s.session_name });
    if (!coords.some((c) => c.session_id === s.id && !isTbd(fById.get(c.faculty_id))))
      missing.push({ Session: s.session_code, Issue: 'No coordinators', Detail: s.session_name });
  });
  sheet(wb, 'Missing data', missing, 'Nothing missing');

  return wb;
}

const LABELS: Record<string, string> = {
  confirmed: 'Confirmed', faculty_assigned: 'Faculty added to topic', faculty_removed: 'Faculty removed from topic',
  role_changed: 'Role changed', chair_added: 'Chairperson added', chair_removed: 'Chairperson removed',
  topic_added: 'Topic added', topic_edited: 'Topic edited', topic_removed: 'Topic removed',
  session_added: 'Session added', session_edited: 'Session edited', sync: 'Synced from Google',
  email_sent: 'Email sent',
};

export async function buildChangeLogWorkbook() {
  const log = await fetchAll('change_log', '*', 'id');
  const byDay = new Map<string, any[]>();
  for (const c of log) {
    const day = istParts(new Date(c.created_at)).date;
    (byDay.get(day) || byDay.set(day, []).get(day)!).push(c);
  }
  const wb = XLSX.utils.book_new();
  const days = Array.from(byDay.keys()).sort();

  sheet(wb, 'Summary', days.length
    ? days.map((d) => ({ Day: d, Changes: byDay.get(d)!.length,
        Confirmations: byDay.get(d)!.filter((c) => c.event_type === 'confirmed').length }))
    : [], 'No changes recorded yet. Changes are recorded from the day migration_2_changes.sql was run.');

  for (const d of days) {
    sheet(wb, d, byDay.get(d)!.map((c) => ({
      Time: new Date(c.created_at).toLocaleTimeString('en-GB', { timeZone: IST, hour: '2-digit', minute: '2-digit' }),
      Event: LABELS[c.event_type] || c.event_type, Faculty: c.faculty_name || '',
      Session: c.session_code || '', Topic: c.topic_title || '', Detail: c.detail || '',
    })), '');
  }
  return wb;
}

export function workbookBuffer(wb: XLSX.WorkBook): Buffer {
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
