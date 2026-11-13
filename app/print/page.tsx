'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabase';
import { formatTime12 } from '../lib/time';
import { inputCls } from '../components/Field';

type Sess = {
  id: string;
  session_code: string;
  session_name: string | null;
  session_date: string | null;
  start_time: string | null;
  end_time: string | null;
  hall: string | null;
};

function dayLabel(d: string | null) {
  if (!d) return 'No date';
  const dt = new Date(`${d}T00:00:00`);
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

const primaryBtn = 'inline-flex h-11 items-center justify-center rounded-lg bg-accent px-5 text-sm font-medium text-white hover:bg-accent-strong disabled:opacity-50';
const secondaryBtn = 'inline-flex h-11 items-center justify-center rounded-lg border border-field bg-white px-4 text-sm font-medium text-ink hover:bg-slate-50 disabled:opacity-50';

function Check({ checked, onChange, title, desc, disabled }: { checked: boolean; onChange: (v: boolean) => void; title: string; desc?: string; disabled?: boolean }) {
  return (
    <label className={`flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-white p-3 hover:bg-slate-50 ${disabled ? 'opacity-50' : ''}`}>
      <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="block text-sm font-medium text-ink">{title}</span>
        {desc && <span className="block text-xs text-ink-2">{desc}</span>}
      </span>
    </label>
  );
}

// POST to /api/print, download the PDF, return a URL to open it again
async function fetchPdf(body: any, fileName: string) {
  const res = await fetch('/api/print', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error || 'The PDF could not be made.');
  }
  const skipped = decodeURIComponent(res.headers.get('X-Skipped') || '');
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileName}_${new Date().toISOString().slice(0, 10)}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  return { url, skipped };
}

function PdfResult({ url, error, note }: { url: string | null; error: string | null; note?: string }) {
  return (
    <>
      <div role="status" aria-live="polite">
        {url && (
          <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800">
            PDF downloaded.{' '}
            <a href={url} target="_blank" rel="noreferrer" className="font-semibold underline">Open to print<span className="sr-only"> (opens in a new tab)</span></a>
          </p>
        )}
        {url && note && <p className="mt-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">{note}</p>}
      </div>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    </>
  );
}

export default function PrintPage() {
  const [mode, setMode] = useState<'sessions' | 'faculty'>('sessions');
  const tab = (on: boolean) =>
    `inline-flex h-11 items-center border-b-2 px-4 text-sm font-medium ${on ? 'border-accent text-accent' : 'border-transparent text-ink-2 hover:text-ink'}`;
  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-canvas text-ink">
      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-6xl p-4 outline-none sm:p-8">
        <h1 className="text-3xl font-semibold">Print</h1>
        <p className="mb-5 mt-1.5 max-w-prose text-ink-2">
          Everything comes out as one PDF, with the date, time and hall highlighted.
        </p>
        <div role="tablist" aria-label="Print by" className="mb-6 flex gap-2 border-b border-line">
          <button type="button" role="tab" aria-selected={mode === 'sessions'} className={tab(mode === 'sessions')} onClick={() => setMode('sessions')}>By session</button>
          <button type="button" role="tab" aria-selected={mode === 'faculty'} className={tab(mode === 'faculty')} onClick={() => setMode('faculty')}>By faculty</button>
        </div>
        {mode === 'sessions' ? <SessionPrint /> : <FacultyPrint />}
      </main>
    </div>
  );
}

type Fac = { id: string; faculty_id: string | null; canonical_name: string; email: string | null; topics: number; coords: number };

function FacultyPrint() {
  const [list, setList] = useState<Fac[]>([]);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [onlyAssigned, setOnlyAssigned] = useState(true);

  const [format, setFormat] = useState<'letterhead' | 'simple'>('simple');
  const [contacts, setContacts] = useState(true);
  const [confirmed, setConfirmed] = useState(true);
  const [pagePerFaculty, setPagePerFaculty] = useState(true);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [note, setNote] = useState('');

  useEffect(() => {
    supabase
      .from('faculty')
      .select('id, faculty_id, canonical_name, email, faculty_topic_counts ( topic_count ), session_coordinators ( session_id )')
      .order('canonical_name')
      .then(({ data }) => {
        const rows = (data || [])
          .filter((f: any) => f.faculty_id !== 'FAC000' && !/^TBD/i.test(String(f.canonical_name || '').trim()))
          .map((f: any) => ({
            id: String(f.id),
            faculty_id: f.faculty_id,
            canonical_name: f.canonical_name,
            email: f.email,
            topics: (Array.isArray(f.faculty_topic_counts) ? f.faculty_topic_counts[0]?.topic_count : f.faculty_topic_counts?.topic_count) || 0,
            coords: (f.session_coordinators || []).length,
          }));
        setList(rows);
        setLoading(false);
      });
  }, []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return list.filter((f) =>
      (!onlyAssigned || f.topics > 0 || f.coords > 0) &&
      (!q || f.canonical_name.toLowerCase().includes(q) || (f.email || '').toLowerCase().includes(q) || (f.faculty_id || '').toLowerCase().includes(q))
    );
  }, [list, search, onlyAssigned]);

  function toggle(ids: string[], on: boolean) {
    setPicked((prev) => {
      const n = new Set(prev);
      ids.forEach((id) => (on ? n.add(id) : n.delete(id)));
      return n;
    });
  }

  async function makePdf() {
    setBusy(true);
    setError(null);
    setNote('');
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setPdfUrl(null);
    try {
      // Keep alphabetical order in the PDF
      const ids = list.filter((f) => picked.has(f.id)).map((f) => f.id);
      const r = await fetchPdf({ kind: 'faculty', facultyIds: ids, format, contacts, confirmed, pagePerFaculty },
        format === 'letterhead' ? 'DERMACON_Letters' : 'DERMACON_Faculty');
      setPdfUrl(r.url);
      if (r.skipped) setNote(`Left out (no topics to put in a letter): ${r.skipped}`);
    } catch (e: any) {
      setError(e?.message || 'The PDF could not be made.');
    } finally {
      setBusy(false);
    }
  }

  const pickedList = list.filter((f) => picked.has(f.id));

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <section aria-label="Faculty" className="rounded-2xl border border-line bg-white p-4 shadow-card sm:p-5">
        <div className="mb-3 flex flex-wrap items-end gap-2">
          <div className="min-w-[12rem] flex-1">
            <label htmlFor="fsearch" className="mb-1 block text-xs font-medium text-ink-2">Search faculty</label>
            <input id="fsearch" type="search" placeholder="Name, email or ID" value={search} onChange={(e) => setSearch(e.target.value)} className={inputCls} />
          </div>
          <button type="button" className={secondaryBtn} onClick={() => toggle(visible.map((f) => f.id), true)}>Select shown</button>
          <button type="button" className={secondaryBtn} onClick={() => setPicked(new Set())} disabled={picked.size === 0}>Clear</button>
        </div>
        <label className="mb-3 flex items-center gap-2 text-sm text-ink-2">
          <input type="checkbox" className="h-4 w-4" checked={onlyAssigned} onChange={(e) => setOnlyAssigned(e.target.checked)} />
          Only faculty with topics or coordinator roles
        </label>
        <p className="mb-3 text-sm text-ink-2"><strong className="text-ink">{picked.size}</strong> selected · {visible.length} shown</p>

        {pickedList.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {pickedList.map((f) => (
              <button key={f.id} type="button" onClick={() => toggle([f.id], false)} aria-label={`Remove ${f.canonical_name}`}
                className="inline-flex items-center gap-1 rounded-full bg-accent-tint px-2.5 py-1 text-xs font-medium text-accent hover:bg-indigo-100">
                {f.canonical_name} <span aria-hidden="true">×</span>
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <p role="status" className="py-10 text-center text-ink-2">Loading faculty…</p>
        ) : visible.length === 0 ? (
          <p className="py-10 text-center text-ink-2">No faculty match.</p>
        ) : (
          <ul className="grid max-h-[65vh] gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2">
            {visible.map((f) => (
              <li key={f.id}>
                <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-2.5 ${picked.has(f.id) ? 'border-accent bg-accent-tint' : 'border-line bg-white hover:bg-slate-50'}`}>
                  <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0" checked={picked.has(f.id)} onChange={(e) => toggle([f.id], e.target.checked)} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink">{f.canonical_name}</span>
                    <span className="block text-xs text-ink-2">
                      {f.topics} topic{f.topics === 1 ? '' : 's'}{f.coords ? ` · coordinator of ${f.coords}` : ''}{f.faculty_id ? ` · ${f.faculty_id}` : ''}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </section>

      <aside aria-label="Print options" className="space-y-5 lg:sticky lg:top-20 lg:self-start">
        <fieldset className="space-y-2 rounded-2xl border border-line bg-white p-4 shadow-card">
          <legend className="sr-only">Format</legend>
          <h2 className="mb-1 text-sm font-semibold text-ink">Format</h2>
          {([
            ['simple', 'Simple PDF', 'Clean list of every topic and coordinator role, grouped by day.'],
            ['letterhead', 'On letterhead', 'The official commitment letter (same as the emailed PDF), one per session.'],
          ] as const).map(([v, title, desc]) => (
            <label key={v} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${format === v ? 'border-accent bg-accent-tint' : 'border-line bg-white hover:bg-slate-50'}`}>
              <input type="radio" name="fformat" className="mt-0.5 h-4 w-4 shrink-0" checked={format === v} onChange={() => setFormat(v)} />
              <span>
                <span className="block text-sm font-medium text-ink">{title}</span>
                <span className="block text-xs text-ink-2">{desc}</span>
              </span>
            </label>
          ))}
        </fieldset>

        {format === 'simple' && (
          <div className="space-y-2 rounded-2xl border border-line bg-white p-4 shadow-card">
            <h2 className="mb-1 text-sm font-semibold text-ink">Simple PDF options</h2>
            <Check checked={contacts} onChange={setContacts} title="Include contact details" desc="Faculty phone and email, and each session's lead coordinator." />
            <Check checked={confirmed} onChange={setConfirmed} title="Show confirmation status" desc="Confirmed / not confirmed per topic (as of the last sync)." />
            <Check checked={pagePerFaculty} onChange={setPagePerFaculty} title="Each faculty on a new page" />
          </div>
        )}
        {format === 'letterhead' && (
          <p className="rounded-2xl border border-line bg-white p-4 text-xs text-ink-2 shadow-card">
            Letters include the coordinator contact and the confirmation link, exactly like the emailed PDF. Faculty with no topics are left out. Many faculty at once can take a minute.
          </p>
        )}

        <div className="space-y-3 rounded-2xl border border-line bg-white p-4 shadow-card">
          <button type="button" onClick={makePdf} disabled={busy || picked.size === 0} className={`${primaryBtn} w-full`}>
            {busy ? 'Making PDF…' : `Make PDF${picked.size ? ` (${picked.size})` : ''}`}
          </button>
          {picked.size === 0 && <p className="text-xs text-ink-2">Select at least one faculty member.</p>}
          <PdfResult url={pdfUrl} error={error} note={note} />
        </div>
      </aside>
    </div>
  );
}

function SessionPrint() {
  const [sessions, setSessions] = useState<Sess[]>([]);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [hall, setHall] = useState('');

  const [schedule, setSchedule] = useState(true);
  const [missing, setMissing] = useState(false);
  const [overlaps, setOverlaps] = useState(false);
  const [scope, setScope] = useState<'selected' | 'all'>('selected');
  const [chairs, setChairs] = useState(true);
  const [contacts, setContacts] = useState(false);
  const [confirmed, setConfirmed] = useState(true);
  const [pagePerSession, setPagePerSession] = useState(true);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('conference_sessions')
      .select('id, session_code, session_name, session_date, start_time, end_time, hall')
      .order('session_date', { ascending: true })
      .order('start_time', { ascending: true })
      .then(({ data }) => {
        setSessions((data as Sess[]) || []);
        setLoading(false);
      });
  }, []);

  const halls = useMemo(
    () => [...new Set(sessions.map((s) => (s.hall || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    [sessions]
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sessions.filter((s) =>
      (!hall || (s.hall || '').trim() === hall) &&
      (!q || s.session_code.toLowerCase().includes(q) || (s.session_name || '').toLowerCase().includes(q))
    );
  }, [sessions, search, hall]);

  const byDay = useMemo(() => {
    const m = new Map<string, Sess[]>();
    visible.forEach((s) => {
      const k = s.session_date || '';
      m.set(k, [...(m.get(k) || []), s]);
    });
    return [...m.entries()].sort(([a], [b]) => (a || '9999').localeCompare(b || '9999'));
  }, [visible]);

  function toggle(ids: string[], on: boolean) {
    setPicked((prev) => {
      const n = new Set(prev);
      ids.forEach((id) => (on ? n.add(id) : n.delete(id)));
      return n;
    });
  }

  const nothingChosen = !schedule && !missing && !overlaps;
  const needsSessions = schedule && picked.size === 0 && !missing && !overlaps;

  async function makePdf() {
    setBusy(true);
    setError(null);
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setPdfUrl(null);
    try {
      const ordered = sessions.filter((s) => picked.has(String(s.id))).map((s) => String(s.id));
      const r = await fetchPdf({ kind: 'sessions', sessionIds: ordered, schedule, missing, overlaps, scope, chairs, contacts, confirmed, pagePerSession }, 'DERMACON_Print');
      setPdfUrl(r.url);
    } catch (e: any) {
      setError(e?.message || 'The PDF could not be made.');
    } finally {
      setBusy(false);
    }
  }

  return (
        <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
          {/* ---- sessions ---- */}
          <section aria-label="Sessions" className="rounded-2xl border border-line bg-white p-4 shadow-card sm:p-5">
            <div className="mb-3 flex flex-wrap items-end gap-2">
              <div className="min-w-[12rem] flex-1">
                <label htmlFor="psearch" className="mb-1 block text-xs font-medium text-ink-2">Search</label>
                <input id="psearch" type="search" placeholder="Code or name" value={search} onChange={(e) => setSearch(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label htmlFor="phall" className="mb-1 block text-xs font-medium text-ink-2">Hall</label>
                <select id="phall" value={hall} onChange={(e) => setHall(e.target.value)} className={`${inputCls} w-auto`}>
                  <option value="">All halls</option>
                  {halls.map((h) => <option key={h} value={h}>Hall {h}</option>)}
                </select>
              </div>
              <button type="button" className={secondaryBtn} onClick={() => toggle(visible.map((s) => String(s.id)), true)}>Select shown</button>
              <button type="button" className={secondaryBtn} onClick={() => setPicked(new Set())} disabled={picked.size === 0}>Clear</button>
            </div>
            <p className="mb-3 text-sm text-ink-2"><strong className="text-ink">{picked.size}</strong> of {sessions.length} sessions selected</p>

            {loading ? (
              <p role="status" className="py-10 text-center text-ink-2">Loading sessions…</p>
            ) : byDay.length === 0 ? (
              <p className="py-10 text-center text-ink-2">No sessions match.</p>
            ) : (
              <div className="space-y-5">
                {byDay.map(([day, list]) => {
                  const ids = list.map((s) => String(s.id));
                  const allOn = ids.every((id) => picked.has(id));
                  const someOn = !allOn && ids.some((id) => picked.has(id));
                  return (
                    <div key={day || 'none'}>
                      <label className="mb-2 flex cursor-pointer items-center gap-3 rounded-lg bg-amber-50 px-3 py-2 ring-1 ring-inset ring-amber-200">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={allOn}
                          ref={(el) => { if (el) el.indeterminate = someOn; }}
                          onChange={(e) => toggle(ids, e.target.checked)}
                        />
                        <span className="text-sm font-semibold text-amber-950">{dayLabel(day || null)}</span>
                        <span className="text-xs text-amber-900">{list.length} session{list.length === 1 ? '' : 's'}</span>
                      </label>
                      <ul className="grid gap-1.5 sm:grid-cols-2">
                        {list.map((s) => {
                          const id = String(s.id);
                          return (
                            <li key={id}>
                              <label className={`flex cursor-pointer items-start gap-3 rounded-lg border p-2.5 ${picked.has(id) ? 'border-accent bg-accent-tint' : 'border-line bg-white hover:bg-slate-50'}`}>
                                <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0" checked={picked.has(id)} onChange={(e) => toggle([id], e.target.checked)} />
                                <span className="min-w-0">
                                  <span className="block text-sm font-medium text-ink">
                                    <span className="tnum mr-1.5 rounded bg-accent px-1.5 py-0.5 text-xs font-semibold text-white">{s.session_code}</span>
                                    {s.session_name || 'Untitled session'}
                                  </span>
                                  <span className="tnum mt-0.5 block text-xs text-ink-2">
                                    {formatTime12(s.start_time)} – {formatTime12(s.end_time)} · {s.hall ? `Hall ${s.hall}` : <span className="font-semibold text-red-700">No hall</span>}
                                  </span>
                                </span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* ---- options ---- */}
          <aside aria-label="Print options" className="space-y-5 lg:sticky lg:top-20 lg:self-start">
            <div className="space-y-2 rounded-2xl border border-line bg-white p-4 shadow-card">
              <h2 className="mb-1 text-sm font-semibold text-ink">What to print</h2>
              <Check checked={schedule} onChange={setSchedule} title="Session schedules" desc="Each selected session: topics, times, faculty." />
              <Check checked={missing} onChange={setMissing} title="Missing data" desc="No hall or date, no coordinators, topics without a speaker, wrong times." />
              <Check checked={overlaps} onChange={setOverlaps} title="Overlaps" desc="Faculty booked twice and halls double-booked." />
              {(missing || overlaps) && (
                <fieldset className="mt-2 rounded-lg bg-canvas p-3">
                  <legend className="sr-only">Missing data and overlaps cover</legend>
                  <p className="mb-1.5 text-xs font-medium text-ink-2">Missing data and overlaps cover</p>
                  <label className="flex items-center gap-2 text-sm"><input type="radio" name="scope" checked={scope === 'selected'} onChange={() => setScope('selected')} /> Selected sessions only</label>
                  <label className="mt-1 flex items-center gap-2 text-sm"><input type="radio" name="scope" checked={scope === 'all'} onChange={() => setScope('all')} /> Whole programme</label>
                  {scope === 'selected' && picked.size === 0 && <p className="mt-1.5 text-xs text-ink-2">No session selected, so the whole programme is used.</p>}
                </fieldset>
              )}
            </div>

            <div className="space-y-2 rounded-2xl border border-line bg-white p-4 shadow-card">
              <h2 className="mb-1 text-sm font-semibold text-ink">Schedule options</h2>
              <Check checked={chairs} onChange={setChairs} disabled={!schedule} title="Include chairpersons" desc="A Chairperson column next to the faculty." />
              <Check checked={contacts} onChange={setContacts} disabled={!schedule} title="Include contact details" desc="Phone and email under every coordinator, faculty and chair." />
              <Check checked={confirmed} onChange={setConfirmed} disabled={!schedule} title="Show who has confirmed" desc="✓ after names (as of the last sync)." />
              <Check checked={pagePerSession} onChange={setPagePerSession} disabled={!schedule} title="Each session on a new page" />
            </div>

            <div className="space-y-3 rounded-2xl border border-line bg-white p-4 shadow-card">
              <button type="button" onClick={makePdf} disabled={busy || nothingChosen || needsSessions} className={`${primaryBtn} w-full`}>
                {busy ? 'Making PDF…' : 'Make PDF'}
              </button>
              {nothingChosen && <p className="text-xs text-ink-2">Choose at least one thing to print.</p>}
              {needsSessions && <p className="text-xs text-ink-2">Select at least one session.</p>}
              <PdfResult url={pdfUrl} error={error} />
            </div>
          </aside>
        </div>
  );
}
