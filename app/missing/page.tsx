'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabase';
import AssignFacultyModal from '../components/AssignFacultyModal';
import { inputCls } from '../components/Field';
import { ArrowUpRightIcon, CalendarIcon, ChevronDownIcon, ClockIcon, PinIcon, PlusIcon } from '../components/Icons';
import { Button, EmptyState, LoadingBlock, PageHeader, PageShell, buttonCls, cardCls } from '../components/ui';
import { formatTime12 } from '../lib/time';
import { findEmptySlots } from '../lib/slots';

function dateLabel(d: string | null | undefined) {
  if (!d) return null;
  const dt = new Date(`${d}T00:00:00`);
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function MissingDataPage() {
  const [view, setView] = useState<'todo' | 'empty'>('todo');
  const [groupedData, setGroupedData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigningTopic, setAssigningTopic] = useState<any | null>(null);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setOpenIds((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  async function fetchMissingData() {
    setLoading(true);
    const { data: sessions } = await supabase.from('conference_sessions').select(`
      id, session_code, session_name, session_date, start_time, hall,
      session_topics (
        id, topic_title, sequence_no,
        faculty_topics ( role, faculty ( faculty_id, canonical_name ) )
      ),
      session_coordinators ( role, faculty ( faculty_id, canonical_name ) ),
      session_chairs ( faculty ( faculty_id, canonical_name ) )
    `).order('session_date', { ascending: true }).order('start_time', { ascending: true });

    if (sessions) {
      const issuesBySession: any[] = [];

      sessions.forEach(s => {
        const missingTopics: any[] = [];
        const realCoordinators = s.session_coordinators?.filter((c: any) =>
          c.faculty?.faculty_id !== 'FAC000' && c.faculty?.canonical_name !== 'TBD (To Be Determined)'
        ) || [];
        const hasCoordinators = realCoordinators.length > 0;
        const isEmpty = !s.session_topics || s.session_topics.length === 0;

        if (s.session_topics) {
          s.session_topics.forEach((t: any) => {
            const realFaculty = t.faculty_topics?.filter((ft: any) =>
              ft.role !== 'Chairperson' && ft.faculty?.faculty_id !== 'FAC000' && ft.faculty?.canonical_name !== 'TBD (To Be Determined)'
            ) || [];

            if (realFaculty.length === 0) {
              missingTopics.push(t);
            }
          });
        }

        if (isEmpty || missingTopics.length > 0 || !hasCoordinators) {
          // Everyone already in this session (coordinators, session chairs, speakers), for the Faculty filter
          const people = new Set<string>();
          const add = (f: any) => {
            const n = String(f?.canonical_name || '').trim();
            if (n && f?.faculty_id !== 'FAC000' && !/^TBD/i.test(n)) people.add(n);
          };
          (s.session_coordinators || []).forEach((c: any) => add(c.faculty));
          ((s as any).session_chairs || []).forEach((c: any) => add(c.faculty));
          (s.session_topics || []).forEach((t: any) => (t.faculty_topics || []).forEach((ft: any) => add(ft.faculty)));
          issuesBySession.push({ ...s, isEmpty, hasCoordinators, missingTopics, people: [...people] });
        }
      });

      setGroupedData(issuesBySession);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchMissingData();
    // Returning (browser Back) from a session lands on the same view the user left
    if (new URLSearchParams(window.location.search).get('view') === 'empty') setView('empty');
  }, []);

  const changeView = (v: 'todo' | 'empty') => {
    setView(v);
    window.history.replaceState(null, '', v === 'empty' ? '?view=empty' : window.location.pathname);
    window.scrollTo(0, 0);
  };

  // ---- filters (all optional; they combine) ----
  const NONE = '__none';
  const [fDate, setFDate] = useState('');
  const [fHall, setFHall] = useState('');
  const [fSession, setFSession] = useState('');
  const [fFaculty, setFFaculty] = useState('');
  const filtering = !!(fDate || fHall || fSession.trim() || fFaculty.trim());
  const clearFilters = () => { setFDate(''); setFHall(''); setFSession(''); setFFaculty(''); };

  const dateOptions = useMemo(() => {
    const ds = [...new Set(groupedData.map((s) => s.session_date || ''))].sort((a, b) => (a || '9999').localeCompare(b || '9999'));
    return ds.map((d) => ({ value: d || NONE, label: d ? dateLabel(d) || d : 'No date' }));
  }, [groupedData]);
  const hallOptions = useMemo(() => {
    const hs = [...new Set(groupedData.map((s) => String(s.hall || '').trim()))]
      .sort((a, b) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b, undefined, { numeric: true })));
    return hs.map((h) => ({ value: h || NONE, label: !h ? 'No hall' : h.toLowerCase() === 'all' ? 'All halls (plenary)' : `Hall ${h}` }));
  }, [groupedData]);
  const sessionSuggestions = useMemo(
    () => groupedData.map((s) => `${s.session_code} – ${s.session_name || 'Untitled session'}`),
    [groupedData]);
  const facultySuggestions = useMemo(
    () => [...new Set<string>(groupedData.flatMap((s) => s.people as string[]))].sort((a, b) => a.localeCompare(b)),
    [groupedData]);

  const visible = useMemo(() => {
    const qs = fSession.trim().toLowerCase();
    const qf = fFaculty.trim().toLowerCase();
    return groupedData.filter((s) =>
      (!fDate || (s.session_date || NONE) === fDate) &&
      (!fHall || (String(s.hall || '').trim() || NONE) === fHall) &&
      (!qs || `${s.session_code} ${s.session_name || ''}`.toLowerCase().includes(qs)) &&
      (!qf || (s.people as string[]).some((n) => n.toLowerCase().includes(qf))));
  }, [groupedData, fDate, fHall, fSession, fFaculty]);

  if (loading) {
    return (
      <PageShell>
        <PageHeader title="To-do" description="Sessions and topics that still need your attention." />
        <LoadingBlock>Checking every session for missing information…</LoadingBlock>
      </PageShell>
    );
  }

  if (view === 'empty') return <EmptySlotsView onBack={() => changeView('todo')} />;

  const countFor = (s: any) => (s.isEmpty ? 1 : 0) + s.missingTopics.length + (s.hasCoordinators ? 0 : 1);
  const totalItems = visible.reduce((n, s) => n + countFor(s), 0);
  const allOpen = visible.length > 0 && visible.every((s) => openIds.has(String(s.id)));

  // One quiet row per thing to fix: plain white, a thin marker on the left, and a small button
  const row = 'flex flex-col justify-between gap-3 border-l-2 border-l-blue-300 py-3 pl-4 pr-1 sm:flex-row sm:items-center';

  return (
    <>
      <PageShell>
        <PageHeader
          title="To-do"
          description={
            groupedData.length === 0
              ? 'Sessions and topics that still need your attention.'
              : `${totalItems} thing${totalItems === 1 ? '' : 's'} to fix in ${visible.length} session${visible.length === 1 ? '' : 's'}: sessions without topics, topics without a speaker, and sessions without coordinators.`
          }
          actions={
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={() => changeView('empty')}>Empty slots</Button>
              {visible.length > 0 ? (
              <Button
                size="sm"
                onClick={() => setOpenIds(allOpen ? new Set() : new Set(visible.map((s) => String(s.id))))}
              >
                {allOpen ? 'Collapse all' : 'Expand all'}
              </Button>
              ) : null}
            </div>
          }
        />

        {groupedData.length === 0 ? (
          <div className={cardCls}>
            <EmptyState tone="success" title="Everything is in place">
              All sessions have topics, faculty and coordinators assigned.
            </EmptyState>
          </div>
        ) : (
          <>
          <section aria-label="Filter the to-do list" className={`${cardCls} mb-4 p-3 sm:p-4`}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label htmlFor="fdate" className="mb-1 block text-xs font-medium text-ink-2">Date</label>
                <select id="fdate" value={fDate} onChange={(e) => setFDate(e.target.value)} className={inputCls}>
                  <option value="">All dates</option>
                  {dateOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="fhall" className="mb-1 block text-xs font-medium text-ink-2">Hall</label>
                <select id="fhall" value={fHall} onChange={(e) => setFHall(e.target.value)} className={inputCls}>
                  <option value="">All halls</option>
                  {hallOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="fsession" className="mb-1 block text-xs font-medium text-ink-2">Session</label>
                <input id="fsession" type="search" list="fsession-list" placeholder="Code or name" value={fSession}
                  onChange={(e) => setFSession(e.target.value)} className={inputCls} autoComplete="off" />
                <datalist id="fsession-list">{sessionSuggestions.map((s) => <option key={s} value={s.split(' – ')[0]} label={s} />)}</datalist>
              </div>
              <div>
                <label htmlFor="ffaculty" className="mb-1 block text-xs font-medium text-ink-2">Faculty in the session</label>
                <input id="ffaculty" type="search" list="ffaculty-list" placeholder="Name" value={fFaculty}
                  onChange={(e) => setFFaculty(e.target.value)} className={inputCls} autoComplete="off" />
                <datalist id="ffaculty-list">{facultySuggestions.map((n) => <option key={n} value={n} />)}</datalist>
              </div>
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-2" role="status" aria-live="polite">
              <span>Showing <strong className="text-ink">{visible.length}</strong> of {groupedData.length} sessions</span>
              {filtering && <button type="button" onClick={clearFilters} className="font-medium text-accent hover:underline">Clear filters</button>}
            </div>
          </section>

          {visible.length === 0 ? (
            <div className={cardCls}>
              <EmptyState title="No sessions match" action={<Button onClick={clearFilters}>Clear filters</Button>}>
                Nothing to fix for this combination. Try removing a filter.
              </EmptyState>
            </div>
          ) : (
          <div className={`divide-y divide-line overflow-hidden ${cardCls}`}>
            {visible.map((session) => {
              const open = openIds.has(String(session.id));
              const date = dateLabel(session.session_date);
              return (
                <section key={session.id} aria-labelledby={`session-${session.id}`}>
                  <button
                    type="button"
                    onClick={() => toggle(String(session.id))}
                    aria-expanded={open}
                    className={`flex w-full flex-wrap items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-blue-50/70 sm:px-5 ${open ? 'bg-blue-50/70' : ''}`}
                  >
                    <span className="tnum inline-flex h-7 min-w-12 items-center justify-center rounded-md bg-blue-50 px-2 text-sm font-semibold text-blue-900 ring-1 ring-inset ring-blue-200">
                      {session.session_code}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span id={`session-${session.id}`} className="block text-[15px] font-semibold text-ink">
                        {session.session_name || 'Untitled session'}
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-sm text-ink-2">
                        <span className="tnum inline-flex items-center gap-1.5">
                          <CalendarIcon /> {date || <span className="font-medium text-danger">No date</span>}
                        </span>
                        <span className="tnum inline-flex items-center gap-1.5">
                          <ClockIcon /> {session.start_time ? formatTime12(session.start_time) : <span className="font-medium text-danger">No time</span>}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <PinIcon /> {session.hall ? `Hall ${session.hall}` : <span className="font-medium text-danger">No hall</span>}
                        </span>
                      </span>
                    </span>
                    <span className="tnum text-sm font-medium text-blue-900">{countFor(session)} to fix</span>
                    <ChevronDownIcon
                      className={`shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`}
                      width={20}
                      height={20}
                    />
                  </button>

                  {open && (
                    <div className="border-t border-blue-100 bg-white px-4 py-2 sm:px-5">
                      <ul className="divide-y divide-blue-100">
                        {session.isEmpty && (
                          <li className={row}>
                            <div>
                              <p className="font-medium text-ink">This session has no topics yet</p>
                              <p className="text-sm text-ink-2">Add topics to build the programme.</p>
                            </div>
                            <a href={`/sessions?code=${session.session_code}`} className={buttonCls('quiet', 'sm', 'border border-blue-200')}>
                              Go to session <ArrowUpRightIcon width={14} height={14} />
                            </a>
                          </li>
                        )}

                        {!session.hasCoordinators && (
                          <li className={row}>
                            <div>
                              <p className="font-medium text-ink">No coordinators assigned</p>
                              <p className="text-sm text-ink-2">Assign a lead, national or local coordinator.</p>
                            </div>
                            <a href={`/sessions?code=${session.session_code}`} className={buttonCls('quiet', 'sm', 'border border-blue-200')}>
                              Edit coordinators <ArrowUpRightIcon width={14} height={14} />
                            </a>
                          </li>
                        )}

                        {session.missingTopics.map((topic: any) => (
                          <li key={topic.id} className={row}>
                            <div className="flex min-w-0 items-start gap-3">
                              <span className="tnum mt-0.5 inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded bg-blue-50 px-1.5 text-xs font-semibold text-blue-900">
                                <span className="sr-only">Number </span>{topic.sequence_no || '?'}
                              </span>
                              <div className="min-w-0">
                                <p className="font-medium text-ink">
                                  {topic.topic_title || <span className="italic text-ink-2">(Blank topic title)</span>}
                                </p>
                                <p className="text-sm text-ink-2">Needs a speaker</p>
                              </div>
                            </div>
                            <Button
                              variant="quiet"
                              size="sm"
                              className="border border-blue-200"
                              onClick={() => setAssigningTopic(topic)}
                              aria-label={`Assign a speaker to ${topic.topic_title || 'untitled topic'} in ${session.session_code}`}
                            >
                              <PlusIcon /> Assign speaker
                            </Button>
                          </li>
                        ))}
                      </ul>
                      <div className="border-t border-line py-2.5">
                        <a href={`/sessions?code=${session.session_code}`} className="text-sm font-medium text-accent hover:underline">
                          Open session {session.session_code}
                        </a>
                      </div>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
          )}
          </>
        )}
      </PageShell>

      {assigningTopic && (
        <AssignFacultyModal
          topic={assigningTopic}
          onClose={() => setAssigningTopic(null)}
          onSaved={fetchMissingData}
        />
      )}
    </>
  );
}

type EmptySession = {
  id: string; session_code: string; session_name: string | null; session_date: string | null;
  start_time: string | null; end_time: string | null; hall: string | null;
  session_topics: { id: string; start_time: string | null; end_time: string | null }[];
};

function EmptySlotsView({ onBack }: { onBack: () => void }) {
  const [sessions, setSessions] = useState<(EmptySession & { slots: ReturnType<typeof findEmptySlots> })[]>([]);
  const [loading, setLoading] = useState(true);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');

  useEffect(() => {
    supabase.from('conference_sessions')
      .select('id, session_code, session_name, session_date, start_time, end_time, hall, session_topics(id, start_time, end_time)')
      .order('session_date', { ascending: true }).order('start_time', { ascending: true })
      .then(({ data }) => {
        setSessions(((data || []) as unknown as EmptySession[])
          .map((s) => ({ ...s, slots: findEmptySlots(s.session_topics || [], s) }))
          .filter((s) => s.slots.length > 0));
        setLoading(false);
        // Restore the scroll position from before the user opened a session
        try {
          const y = Number(sessionStorage.getItem('emptySlotsScroll') || 0);
          if (y) requestAnimationFrame(() => window.scrollTo(0, y));
        } catch {}
      });
  }, []);

  const rememberScroll = () => {
    try { sessionStorage.setItem('emptySlotsScroll', String(window.scrollY)); } catch {}
  };

  const allPicked = sessions.length > 0 && sessions.every((s) => picked.has(String(s.id)));
  const toggle = (id: string) => setPicked((old) => {
    const next = new Set(old);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });
  async function printSelected() {
    setBusy(true); setError(''); setPdfUrl('');
    try {
      const res = await fetch('/api/print', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'sessions', sessionIds: [...picked], schedule: false, missing: false, overlaps: false,
          emptySlotsReport: true, scope: 'selected', chairs: false, contacts: false, confirmed: false, pagePerSession: false }) });
      if (!res.ok) { const result = await res.json().catch(() => ({})); throw new Error(result.error || 'The PDF could not be made.'); }
      const url = URL.createObjectURL(await res.blob()); setPdfUrl(url);
      const a = document.createElement('a'); a.href = url; a.download = `DERMACON_Empty_slots_${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'The PDF could not be made.'); }
    finally { setBusy(false); }
  }

  const totalSlots = sessions.reduce((n, s) => n + s.slots.length, 0);
  return <PageShell>
    <PageHeader title="Empty slots" description={`${totalSlots} open time slot${totalSlots === 1 ? '' : 's'} in ${sessions.length} session${sessions.length === 1 ? '' : 's'}. Select the sessions to include in your printout.`}
      actions={<Button size="sm" onClick={onBack}>Back to To-do</Button>} />
    {loading ? <LoadingBlock>Checking the programme for empty slots…</LoadingBlock> : sessions.length === 0 ?
      <div className={cardCls}><EmptyState tone="success" title="No empty slots found">Every timed session is filled without any open gaps.</EmptyState></div> : <>
      <section className={`${cardCls} mb-4 flex flex-wrap items-center justify-between gap-3 p-3 sm:p-4`}>
        <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={allPicked}
          onChange={() => setPicked(allPicked ? new Set() : new Set(sessions.map((s) => String(s.id))))} /> Select all shown</label>
        <div className="flex items-center gap-3 text-sm text-ink-2"><span>{picked.size} of {sessions.length} sessions selected</span>
          <Button size="sm" variant="primary" disabled={!picked.size} busy={busy} onClick={printSelected}>Print selected</Button></div>
      </section>
      {error && <p role="alert" className="mb-3 text-sm text-danger">{error}</p>}
      {pdfUrl && <p className="mb-3 text-sm text-ink-2">PDF downloaded. <a className="font-medium text-accent underline" href={pdfUrl} target="_blank" rel="noreferrer">Open to print</a></p>}
      <div className={`divide-y divide-line overflow-hidden ${cardCls}`}>
        {sessions.map((s) => <div key={s.id} className="flex items-start gap-3 px-4 py-4 hover:bg-slate-50 sm:px-5">
          <input type="checkbox" aria-label={`Select ${s.session_code} for printing`} className="mt-1" checked={picked.has(String(s.id))} onChange={() => toggle(String(s.id))} />
          <a href={`/sessions?code=${encodeURIComponent(s.session_code)}`} onClick={rememberScroll} className="min-w-0 flex-1 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
            <span className="flex flex-wrap items-center gap-2"><span className="rounded-md bg-blue-50 px-2 py-0.5 text-sm font-semibold text-blue-900 ring-1 ring-inset ring-blue-200">{s.session_code}</span>
              <span className="font-semibold text-ink">{s.session_name || 'Untitled session'}</span></span>
            <span className="mt-1 block text-sm text-ink-2">{dateLabel(s.session_date) || 'No date'} · {s.start_time ? formatTime12(s.start_time) : 'No time'} · {s.hall ? `Hall ${s.hall}` : 'No hall'}</span>
            <span className="mt-2 flex flex-wrap gap-2">{s.slots.map((slot, i) => <span key={`${slot.start}-${i}`} className="rounded-md bg-amber-50 px-2 py-1 text-sm text-amber-900">{formatTime12(slot.start)}–{formatTime12(slot.end)} · {slot.minutes} min</span>)}</span>
          </a><span className="shrink-0 text-sm text-ink-2">{s.slots.length} gap{s.slots.length === 1 ? '' : 's'}</span>
        </div>)}
      </div>
    </>}
  </PageShell>;
}
