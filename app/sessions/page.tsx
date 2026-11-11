'use client';
import { resequenceSession, deleteTopic, syncTopicConfirmations } from '../actions';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabase';
import EditSessionModal from '../components/EditSessionModal';
import AddSessionModal from '../components/AddSessionModal';
import AddTopicModal from '../components/AddTopicModal';
import EditCoordinatorsModal from '../components/EditCoordinatorsModal';
import EditTopicModal from '../components/EditTopicModal';
import { useSearchParams } from 'next/navigation';
import ConfirmDeleteDialog from '../components/ConfirmDeleteDialog';
import Badge, { roleTone } from '../components/Badge';
import { inputCls } from '../components/Field';
import { CalendarIcon, CheckIcon, ClockIcon, MenuIcon, PinIcon, PlusIcon, SearchIcon } from '../components/Icons';

function formatDateLabel(dateStr: string | null): string {
  if (!dateStr) return 'No date';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${d.getFullYear()}`;
}

function formatTimeAmPm(timeStr: string | null | undefined): string {
  if (!timeStr) return '--:--';
  const [hStr, mStr] = timeStr.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr || '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${m} ${ampm}`;
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSession, setSelectedSession] = useState<any | null>(null);
  const [coordinators, setCoordinators] = useState<any[]>([]);
  const [topics, setTopics] = useState<any[]>([]);
  const [syncTick, setSyncTick] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterHall, setFilterHall] = useState<string>('');
  const [filterDate, setFilterDate] = useState<string>('');
  const [filterSessionCode, setFilterSessionCode] = useState<string>('');

  const [isEditingSession, setIsEditingSession] = useState(false);
  const [isAddingSession, setIsAddingSession] = useState(false);
  const [isAddingTopic, setIsAddingTopic] = useState(false);
  const [isEditingCoordinators, setIsEditingCoordinators] = useState(false);
  const [editingTopic, setEditingTopic] = useState<any | null>(null);
  const [deletingTopic, setDeletingTopic] = useState<any | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const searchParams = useSearchParams();
  const targetCode = searchParams.get('code');

  // Pull per-topic confirmations from the Google Sheet into the database,
  // then re-read the open session so the badges update.
  useEffect(() => {
    syncTopicConfirmations().then((r) => {
      if (r.updated > 0) setSyncTick((n) => n + 1);
    });
  }, []);


  useEffect(() => {
    async function fetchSessions() {
      const { data } = await supabase.from('conference_sessions').select('*');

      if (data) {
        // Sort: 1. MC vs WS, 2. Natural Code Order (MC1, MC2, MC10)
        const sortedData = data.sort((a, b) => {
          const codeA = (a.session_code || '').toUpperCase();
          const codeB = (b.session_code || '').toUpperCase();

          const prefixA = codeA.replace(/[0-9]/g, '');
          const prefixB = codeB.replace(/[0-9]/g, '');

          // Group MC first, then WS
          if (prefixA !== prefixB) {
            if (prefixA === 'MC') return -1;
            if (prefixB === 'MC') return 1;
            return prefixA.localeCompare(prefixB);
          }

          // Natural numeric sort within the group (MC1, MC2, MC10)
          return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
        });

        setSessions(sortedData);

        if (targetCode) {
          const found = sortedData.find((s) => s.session_code === targetCode);
          if (found) setSelectedSession(found);
          else if (sortedData.length > 0) setSelectedSession(sortedData[0]);
        } else if (sortedData.length > 0) {
          setSelectedSession(sortedData[0]);
        }
      }
      setLoading(false);
    }
    fetchSessions();
  }, [targetCode]);

  async function refreshDetails() {
    if (!selectedSession) return;
    setLoadingDetails(true);

    const { data: coordData } = await supabase
      .from('session_coordinators')
      .select(`role, faculty_id, faculty ( id, canonical_name, phone )`)
      .eq('session_id', selectedSession.id);

    if (coordData) {
      const rolePriority: Record<string, number> = {
        National: 1,
        'Lead Coordinator': 2,
        Local: 3,
      };
      const sortedCoords = coordData.sort(
        (a, b) => (rolePriority[a.role] || 99) - (rolePriority[b.role] || 99)
      );
      setCoordinators(sortedCoords);
    }

    const { data: topicData } = await supabase
      .from('session_topics')
      .select(
        `
        id, topic_title, start_time, end_time, sequence_no,
        faculty_topics ( role, confirmed, faculty ( id, canonical_name, phone, email ) )
      `
      )
      .eq('session_id', selectedSession.id)
      .order('sequence_no', { ascending: true })
      .order('topic_title', { ascending: true });

    if (topicData) setTopics(topicData);
    setLoadingDetails(false);
  }

  useEffect(() => {
    refreshDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSession, syncTick]);

  const distinctHalls = useMemo(() => {
    const set = new Set<string>();
    sessions.forEach((s) => {
      const h = (s.hall || '').trim();
      if (h) set.add(h);
    });
    return Array.from(set).sort();
  }, [sessions]);

  const distinctDates = useMemo(() => {
    const set = new Set<string>();
    sessions.forEach((s) => {
      if (s.session_date) set.add(s.session_date);
    });
    return Array.from(set).sort();
  }, [sessions]);

  const sessionOptions = useMemo(() => {
    const map = new Map<string, { code: string; name: string }>();
    sessions.forEach((s) => {
      if (!s.session_code) return;
      if (!map.has(s.session_code)) {
        map.set(s.session_code, {
          code: s.session_code,
          name: s.session_name || '',
        });
      }
    });
    return Array.from(map.values()); // already sorted from state
  }, [sessions]);

  const filteredSessions = sessions.filter((s) => {
    const q = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !q ||
      s.session_code?.toLowerCase().includes(q) ||
      s.session_name?.toLowerCase().includes(q);
    const matchesHall = !filterHall || (s.hall || '') === filterHall;
    const matchesDate = !filterDate || s.session_date === filterDate;
    const matchesCode = !filterSessionCode || s.session_code === filterSessionCode;
    return matchesSearch && matchesHall && matchesDate && matchesCode;
  });

  const hasActiveFilter = Boolean(
    filterHall || filterDate || filterSessionCode || searchTerm.trim()
  );

  function clearFilters() {
    setSearchTerm('');
    setFilterHall('');
    setFilterDate('');
    setFilterSessionCode('');
  }

  if (loading)
    return (
      <div role="status" className="flex h-[calc(100vh-3.5rem)] items-center justify-center text-ink-2">
        Loading master schedule…
      </div>
    );

  const sel = selectedSession;
  const btn =
    'inline-flex h-11 items-center gap-1.5 rounded-lg px-4 text-sm font-medium transition-colors';
  const rowBtn =
    'inline-flex h-11 items-center rounded-lg px-3 text-sm font-medium transition-colors';

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden bg-canvas text-ink print:h-auto print:overflow-visible">
      {sidebarOpen && (
        <div
          aria-hidden="true"
          className="fixed inset-x-0 bottom-0 top-14 z-30 bg-slate-950/40 lg:hidden print:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        id="session-list"
        aria-label="Sessions"
        className={`fixed bottom-0 left-0 top-14 z-40 flex w-80 max-w-[85vw] shrink-0 flex-col border-r border-line bg-white transition-transform lg:static lg:z-auto lg:w-72 print:hidden ${
          sidebarOpen ? 'translate-x-0' : 'invisible -translate-x-full lg:visible lg:translate-x-0'
        }`}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h2 className="text-base font-semibold text-ink">Master schedule</h2>
          <a href="/faculty" className="inline-flex h-11 items-center rounded-lg px-2 text-sm font-medium text-accent hover:underline">
            Faculty
          </a>
        </div>

        <div className="space-y-2 border-b border-line p-3">
          <button
            type="button"
            onClick={() => setIsAddingSession(true)}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-white hover:opacity-90"
          >
            <PlusIcon /> Add session
          </button>
          <div className="relative">
            <label htmlFor="session-search" className="sr-only">Search sessions by code or name</label>
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              id="session-search"
              type="search"
              placeholder="Search sessions"
              className={`${inputCls} pl-9`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <label htmlFor="filter-session" className="sr-only">Filter by session</label>
          <select id="filter-session" className={inputCls} value={filterSessionCode} onChange={(e) => setFilterSessionCode(e.target.value)}>
            <option value="">All sessions</option>
            {sessionOptions.map((opt) => (
              <option key={opt.code} value={opt.code}>{opt.code} – {opt.name}</option>
            ))}
          </select>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="filter-hall" className="sr-only">Filter by hall</label>
              <select id="filter-hall" className={inputCls} value={filterHall} onChange={(e) => setFilterHall(e.target.value)}>
                <option value="">All halls</option>
                {distinctHalls.map((h) => (
                  <option key={h} value={h}>Hall {h}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="filter-date" className="sr-only">Filter by date</label>
              <select id="filter-date" className={inputCls} value={filterDate} onChange={(e) => setFilterDate(e.target.value)}>
                <option value="">All dates</option>
                {distinctDates.map((d) => (
                  <option key={d} value={d}>{formatDateLabel(d)}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm text-muted">
            <span role="status" aria-live="polite" className="tnum">
              Showing <span className="font-semibold text-ink">{filteredSessions.length}</span> of {sessions.length}
            </span>
            {hasActiveFilter && (
              <button type="button" onClick={clearFilters} className="inline-flex h-11 items-center rounded-lg px-2 font-medium text-accent hover:underline">
                Clear filters
              </button>
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {filteredSessions.length === 0 ? (
            <p className="p-5 text-center text-sm text-ink-2">No sessions match your filters.</p>
          ) : (
            <ul>
              {filteredSessions.map((s) => {
                const active = sel?.id === s.id;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      aria-current={active ? 'true' : undefined}
                      onClick={() => { setSelectedSession(s); setSidebarOpen(false); }}
                      className={`flex min-h-14 w-full flex-col justify-center border-b border-line px-4 py-2 text-left transition-colors ${
                        active
                          ? 'border-l-4 border-l-accent bg-accent-tint pl-3'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <span className="tnum text-sm font-semibold text-accent">{s.session_code}</span>
                      <span className="truncate text-sm text-ink">{s.session_name}</span>
                      <span className="tnum text-xs text-muted">{formatDateLabel(s.session_date)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>

      <main
        id="main-content"
        tabIndex={-1}
        className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden outline-none print:h-auto print:overflow-visible"
      >
        {sel ? (
          <>
            <div className="session-header z-10 shrink-0 border-b border-line bg-white px-4 py-5 sm:px-6 print:border-0 print:px-0 print:py-2">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                aria-expanded={sidebarOpen}
                aria-controls="session-list"
                className={`${btn} mb-3 border border-field bg-white text-ink hover:bg-slate-50 lg:hidden print:hidden`}
              >
                <MenuIcon /> Sessions
              </button>

              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-3xl font-semibold text-ink">
                    <span className="tnum">{sel.session_code}</span>
                    <span className="text-xl font-normal text-ink-2">{sel.session_name}</span>
                  </h2>
                  <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1.5 text-sm text-ink-2">
                    <div className="flex items-center gap-1.5">
                      <dt className="flex items-center gap-1.5 text-muted"><CalendarIcon /><span className="sr-only">Date</span></dt>
                      <dd className="tnum">{formatDateLabel(sel.session_date)}</dd>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <dt className="flex items-center gap-1.5 text-muted"><ClockIcon /><span className="sr-only">Time</span></dt>
                      <dd className="tnum">{formatTimeAmPm(sel.start_time)} – {formatTimeAmPm(sel.end_time)}</dd>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <dt className="flex items-center gap-1.5 text-muted"><PinIcon /><span className="sr-only">Hall</span></dt>
                      <dd>{sel.hall ? `Hall ${sel.hall}` : 'Hall TBD'}</dd>
                    </div>
                  </dl>
                </div>

                <div className="flex shrink-0 flex-wrap gap-2 print:hidden">
                  <button type="button" onClick={() => window.print()} className={`${btn} border border-field bg-white text-ink hover:bg-slate-50`}>
                    Print
                  </button>
                  <button type="button" onClick={() => setIsEditingSession(true)} className={`${btn} border border-field bg-white text-ink hover:bg-slate-50`}>
                    Edit session
                  </button>
                  <button type="button" onClick={() => setIsAddingTopic(true)} className={`${btn} bg-accent text-white shadow-sm hover:bg-accent-strong`}>
                    <PlusIcon /> Add topic
                  </button>
                </div>
              </div>

              <div className="coordinator-strip mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl bg-canvas px-4 py-2.5 ring-1 ring-inset ring-line print:bg-white">
                <h3 className="shrink-0 text-sm font-semibold text-ink">Coordinators</h3>
                <ul className="flex min-w-0 flex-1 flex-wrap gap-x-4 gap-y-1.5">
                  {coordinators.length === 0 ? (
                    <li className="text-sm text-ink-2">None assigned yet.</li>
                  ) : (
                    coordinators.map((c, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <span className="text-sm font-medium text-ink">{c.faculty?.canonical_name}</span>
                        <Badge tone={roleTone(c.role)}>{c.role}</Badge>
                      </li>
                    ))
                  )}
                </ul>
                <button
                  type="button"
                  onClick={() => setIsEditingCoordinators(true)}
                  className={`${rowBtn} ml-auto shrink-0 text-accent hover:bg-accent-tint print:hidden`}
                >
                  Edit coordinators
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-6 print:overflow-visible print:p-0">
              <div role="status" aria-live="polite" className="sr-only">
                {loadingDetails ? 'Loading schedule' : `${topics.length} topics loaded`}
              </div>
              <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-card print:border-0 print:shadow-none">
                <table className="w-full min-w-[720px] border-collapse text-left print:min-w-0">
                  <caption className="sr-only">
                    Topics in session {sel.session_code}, in running order
                  </caption>
                  <thead>
                    <tr className="border-b border-line bg-slate-50/70 text-xs text-muted">
                      <th scope="col" className="w-14 px-3 py-3 text-center font-semibold">No.</th>
                      <th scope="col" className="w-40 px-3 py-3 font-semibold">Time</th>
                      <th scope="col" className="px-3 py-3 font-semibold">Topic</th>
                      <th scope="col" className="w-80 px-3 py-3 font-semibold">Faculty and role</th>
                      <th scope="col" className="w-44 px-3 py-3 text-right font-semibold print:hidden">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line" aria-busy={loadingDetails}>
                    {loadingDetails ? (
                      Array.from({ length: 4 }).map((_, i) => (
                        <tr key={i} aria-hidden="true">
                          <td colSpan={5} className="px-3 py-4"><div className="h-6 animate-pulse rounded-md bg-slate-100" /></td>
                        </tr>
                      ))
                    ) : topics.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-3 py-14 text-center text-ink-2">
                          No topics yet. Use “Add topic” to build this session’s programme.
                        </td>
                      </tr>
                    ) : (
                      topics.map((t) => {
                        const facultyList = t.faculty_topics || [];
                        return (
                          <tr key={t.id} className="align-top transition-colors hover:bg-slate-50/70">
                            <td className="tnum px-3 py-3 text-center text-sm font-semibold text-muted">{t.sequence_no}</td>
                            <td className="tnum whitespace-nowrap px-3 py-3 text-sm font-medium text-accent">
                              {formatTimeAmPm(t.start_time)} – {formatTimeAmPm(t.end_time)}
                            </td>
                            <th scope="row" className="px-3 py-3 text-left text-[15px] font-medium leading-snug text-ink">
                              {t.topic_title}
                            </th>
                            <td className="px-3 py-3">
                              {facultyList.length === 0 ? (
                                <span className="text-sm italic text-ink-2">Unassigned</span>
                              ) : (
                                <ul className="space-y-1.5">
                                  {facultyList.map((ft: any, i: number) => (
                                    <li key={i} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                      <span className="text-sm font-medium text-ink">{ft.faculty?.canonical_name}</span>
                                      <Badge tone={roleTone(ft.role || 'Faculty')}>{ft.role || 'Faculty'}</Badge>
                                      {ft.confirmed && (
                                        <Badge tone="success">
                                          <CheckIcon width={12} height={12} strokeWidth={3} />
                                          Confirmed
                                        </Badge>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </td>
                            <td className="whitespace-nowrap px-3 py-1.5 text-right print:hidden">
                              <button
                                type="button"
                                onClick={() => setEditingTopic(t)}
                                aria-label={`Edit topic ${t.sequence_no}: ${t.topic_title}`}
                                className={`${rowBtn} text-accent hover:bg-accent-tint`}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => { setDeleteError(null); setDeletingTopic(t); }}
                                aria-label={`Delete topic ${t.sequence_no}: ${t.topic_title}`}
                                className={`${rowBtn} text-red-700 hover:bg-red-50`}
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-ink-2">Select a session to view it.</div>
        )}

        {isAddingSession && (
          <AddSessionModal
            onClose={() => setIsAddingSession(false)}
            onSaved={(code) => {
              setIsAddingSession(false);
              // Reload the page on the new session so it is listed and selected
              window.location.assign(`/sessions?code=${encodeURIComponent(code)}`);
            }}
          />
        )}
        {isEditingSession && sel && (
          <EditSessionModal
            session={sel}
            onClose={() => setIsEditingSession(false)}
            onSaved={async () => {
              // Re-fetch this session so name/date/time/hall updates flow in
              const { data } = await supabase
                .from('conference_sessions')
                .select('*')
                .eq('id', sel.id)
                .single();
              if (data) setSelectedSession(data);
              // Resequence in case times changed relative to other topics
              await resequenceSession(sel.id);
              await refreshDetails();
              setIsEditingSession(false);
            }}
          />
        )}
        {isAddingTopic && sel && (
          <AddTopicModal
            session={sel}
            onClose={() => setIsAddingTopic(false)}
            onSaved={async () => {
              // Server-side auto-resequence by start_time, then reload topics
              await resequenceSession(sel.id);
              await refreshDetails();
              setIsAddingTopic(false);
            }}
          />
        )}
        {isEditingCoordinators && sel && (
          <EditCoordinatorsModal
            session={sel}
            currentCoordinators={coordinators}
            onClose={() => setIsEditingCoordinators(false)}
            onSaved={async () => {
              await refreshDetails();
              setIsEditingCoordinators(false);
            }}
          />
        )}
        {editingTopic && sel && (
          <EditTopicModal
            topic={editingTopic}
            session={sel}
            onClose={() => setEditingTopic(null)}
            onSaved={async () => {
              // Time may have moved -> resequence the whole session
              await resequenceSession(sel.id);
              await refreshDetails();
              setEditingTopic(null);
            }}
          />
        )}

        {deletingTopic && sel && (
          <ConfirmDeleteDialog
            title="Delete this topic?"
            description={
              <div className="space-y-3">
                <div className="rounded-lg border border-line bg-canvas p-3 text-sm">
                  <div className="font-semibold text-ink">{deletingTopic.topic_title}</div>
                  <div className="mt-1 text-ink-2">
                    Number {deletingTopic.sequence_no ?? '?'}
                    {(deletingTopic.faculty_topics?.length || 0) > 0 && (
                      <> &middot; {deletingTopic.faculty_topics.length} faculty link(s) will be removed</>
                    )}
                  </div>
                </div>
                <div>This cannot be undone. Remaining topics in this session will renumber automatically.</div>
                {deleteError && (
                  <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{deleteError}</div>
                )}
              </div>
            }
            confirmLabel="Delete topic"
            busyLabel="Deleting…"
            onCancel={() => setDeletingTopic(null)}
            onConfirm={async () => {
              if (!sel) return;
              setDeleteBusy(true);
              setDeleteError(null);
              const res = await deleteTopic(deletingTopic.id, sel.id);
              setDeleteBusy(false);
              if (!res.success) {
                setDeleteError(res.message);
                return;
              }
              setDeletingTopic(null);
              await refreshDetails();
            }}
          />
        )}
      </main>
    </div>
  );
}
