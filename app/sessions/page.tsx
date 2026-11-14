'use client';
import { resequenceSession } from '../actions';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../supabase';
import dynamic from 'next/dynamic';
// Modals are only needed when opened, so they load on demand (smaller first page load)
const EditSessionModal = dynamic(() => import('../components/EditSessionModal'));
const AddSessionModal = dynamic(() => import('../components/AddSessionModal'));
const AddTopicModal = dynamic(() => import('../components/AddTopicModal'));
const EditCoordinatorsModal = dynamic(() => import('../components/EditCoordinatorsModal'));
const EditChairpersonsModal = dynamic(() => import('../components/EditChairpersonsModal'));
const CoordinatorReportDialog = dynamic(() => import('../components/CoordinatorReportDialog'));
const EditTopicModal = dynamic(() => import('../components/EditTopicModal'));
import { DEFAULT_PRINT_OPTIONS, PrintOptionsDialog, SessionPrintSheet, type PrintOptions } from '../components/SessionPrint';
import SyncButton from '../components/SyncButton';
import { sortCoordinators } from '../lib/coordOrder';
import { sortTopicPeople, roleName } from '../lib/topicPeople';
import { useSearchParams } from 'next/navigation';
import DeleteTopicDialog from '../components/DeleteTopicDialog';
import CloseGapDialog from '../components/CloseGapDialog';
import { findEmptySlots, type EmptySlot } from '../lib/slots';
import { formatTime12, toMinutes } from '../lib/time';
import Badge, { roleTone } from '../components/Badge';
import { inputCls } from '../components/Field';
import { AlertIcon, CalendarIcon, CheckIcon, ClockIcon, MailIcon, MenuIcon, PencilIcon, PinIcon, PlusIcon, PrinterIcon, SearchIcon, TrashIcon } from '../components/Icons';
import { Button, EmptyState, IconButton, LoadingBlock, PersonLink, SkeletonLines, thCls, theadRowCls } from '../components/ui';
import FacultyProfileHost from '../components/FacultyProfileHost';
import HallOverview from '../components/HallOverview';

function formatDateLabel(dateStr: string | null): string {
  if (!dateStr) return 'No date';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
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

type SessionViewSnapshot = {
  hallView: boolean;
  filterHall: string;
  filterDate: string;
  sessionCode: string | null;
  sessionScrollTop: number;
  hallScrollTop: number;
};

type SessionHistoryState = Record<string, unknown> & {
  __dermaconSessionView?: SessionViewSnapshot;
};

export default function SessionsPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSession, setSelectedSession] = useState<any | null>(null);
  const [coordinators, setCoordinators] = useState<any[]>([]);
  const [sessionChairs, setSessionChairs] = useState<any[]>([]);
  const [topics, setTopics] = useState<any[]>([]);
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
  const [isEditingChairs, setIsEditingChairs] = useState(false);
  const [isSendingReport, setIsSendingReport] = useState(false);
  const [editingTopic, setEditingTopic] = useState<any | null>(null);
  const [deletingTopic, setDeletingTopic] = useState<any | null>(null);
  const [closingSlot, setClosingSlot] = useState<EmptySlot | null>(null);
  // Person whose profile panel is open (clicked on a name anywhere on this screen)
  const [profileId, setProfileId] = useState<string | null>(null);
  // Which session the topic list on screen belongs to (placeholders show only while a different one loads)
  const [detailsFor, setDetailsFor] = useState<string | null>(null);
  // The topic that was just added or saved: scrolled into view and highlighted for a moment
  const [focusTopic, setFocusTopic] = useState<string | null>(null);
  // The session on screen, remembered outside React state so a reload of the list never changes it
  const selectedId = useRef<string | null>(null);
  const lastTarget = useRef<string | null | undefined>(undefined);
  const loadedOnce = useRef(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Choosing a hall fills the body with every session of that hall and its topics
  const [hallView, setHallView] = useState(false);
  const [hallScrollRestore, setHallScrollRestore] = useState<{ request: number; top: number } | null>(null);
  const hallScrollRestoreRequest = useRef(0);
  const hallScrollTop = useRef(0);
  const scheduleScrollRef = useRef<HTMLDivElement>(null);
  const pendingSessionScroll = useRef<number | null>(null);
  const [printOpen, setPrintOpen] = useState(false);
  const [printOptions, setPrintOptions] = useState<PrintOptions>(DEFAULT_PRINT_OPTIONS);

  const searchParams = useSearchParams();
  const targetCode = searchParams.get('code');

  function rememberCurrentView() {
    const historyState = (window.history.state || {}) as SessionHistoryState;
    window.history.replaceState(
      {
        ...historyState,
        __dermaconSessionView: {
          hallView,
          filterHall,
          filterDate,
          sessionCode: selectedSession?.session_code || null,
          sessionScrollTop: scheduleScrollRef.current?.scrollTop || 0,
          hallScrollTop: hallScrollTop.current,
        } satisfies SessionViewSnapshot,
      },
      '',
      window.location.href
    );
  }

  useEffect(() => {
    // The address bar was updated by picking a session here: the list is already loaded
    // and the session on screen must stay as it is.
    if (loadedOnce.current && lastTarget.current === targetCode) return;
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

        // Order of preference: the session named in the address, else the one already on screen, else the first
        const wanted = targetCode ? sortedData.find((s) => s.session_code === targetCode) : null;
        const current = selectedId.current ? sortedData.find((s) => s.id === selectedId.current) : null;
        const next = wanted || current || sortedData[0] || null;
        if (next && next.id !== selectedId.current) {
          selectedId.current = next.id;
          setSelectedSession(next);
        }
      }
      lastTarget.current = targetCode;
      loadedOnce.current = true;
      setLoading(false);
    }
    fetchSessions();
  }, [targetCode]);

  useEffect(() => {
    function restoreHistoryView(event: PopStateEvent) {
      const historyState = event.state as SessionHistoryState | null;
      const snapshot = historyState?.__dermaconSessionView;
      if (!snapshot) {
        setHallView(false);
        setFilterHall('');
        setFilterDate('');
        pendingSessionScroll.current = null;
        setHallScrollRestore(null);
        return;
      }

      setHallView(snapshot.hallView);
      setFilterHall(snapshot.filterHall);
      setFilterDate(snapshot.filterDate);
      hallScrollTop.current = snapshot.hallScrollTop;
      lastTarget.current = snapshot.sessionCode;
      pendingSessionScroll.current = snapshot.hallView ? null : snapshot.sessionScrollTop;
      setHallScrollRestore(snapshot.hallView
        ? { request: ++hallScrollRestoreRequest.current, top: snapshot.hallScrollTop }
        : null);

      const previousSession = sessions.find((session) => session.session_code === snapshot.sessionCode);
      if (previousSession) {
        selectedId.current = previousSession.id;
        setSelectedSession(previousSession);
      }
    }

    window.addEventListener('popstate', restoreHistoryView);
    return () => window.removeEventListener('popstate', restoreHistoryView);
  }, [sessions]);

  // Pick a session from the list. The address bar remembers it, so refreshing the
  // browser comes back to the same session.
  function chooseSession(s: any) {
    if (hallView || targetCode !== s.session_code) {
      rememberCurrentView();
      window.history.pushState(null, '', `/sessions?code=${encodeURIComponent(s.session_code)}`);
    }
    selectedId.current = s.id;
    lastTarget.current = s.session_code;
    setSelectedSession(s);
    setHallView(false);
    setSidebarOpen(false);
  }

  async function refreshDetails(): Promise<any[]> {
    if (!selectedSession) return [];
    const forId = selectedSession.id;
    setLoadingDetails(true);

    // Both queries run at the same time instead of one after the other
    const coordPromise = supabase
      .from('session_coordinators')
      .select(`role, coord_id, faculty_id, faculty ( id, canonical_name, phone, email, faculty_id )`)
      .eq('session_id', selectedSession.id);

    const topicPromise = supabase
      .from('session_topics')
      .select(
        `
        id, topic_title, start_time, end_time, sequence_no,
        faculty_topics ( role, confirmed, sort_order, faculty ( id, canonical_name, phone, email, faculty_id ) )
      `
      )
      .eq('session_id', selectedSession.id)
      .order('sequence_no', { ascending: true })
      .order('topic_title', { ascending: true });

    const chairPromise = supabase
      .from('session_chairs')
      .select(`sort_order, faculty ( id, canonical_name, phone, email, faculty_id )`)
      .eq('session_id', selectedSession.id);

    const [{ data: coordData }, { data: topicData }, { data: chairData }] = await Promise.all([coordPromise, topicPromise, chairPromise]);
    setSessionChairs(((chairData || []) as any[]).filter((c) => c.faculty).sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999)));

    if (coordData) {
      setCoordinators(sortCoordinators(coordData));
    }

    if (topicData) setTopics(topicData);
    setDetailsFor(forId);
    setLoadingDetails(false);
    return topicData || [];
  }

  // After a save: bring the saved topic into view and highlight it briefly
  useEffect(() => {
    if (!focusTopic) return;
    document.getElementById(`topic-${focusTopic}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const timer = setTimeout(() => setFocusTopic(null), 4000);
    return () => clearTimeout(timer);
  }, [focusTopic]);

  useEffect(() => {
    refreshDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSession]);

  useEffect(() => {
    if (
      hallView ||
      loadingDetails ||
      !selectedSession ||
      detailsFor !== selectedSession.id ||
      pendingSessionScroll.current === null
    ) return;

    const scrollTop = pendingSessionScroll.current;
    pendingSessionScroll.current = null;
    const frame = window.requestAnimationFrame(() => {
      if (scheduleScrollRef.current) scheduleScrollRef.current.scrollTop = scrollTop;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selectedSession, hallView, loadingDetails, detailsFor]);

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
      <LoadingBlock className="h-[calc(100vh-3.5rem)]">Loading sessions…</LoadingBlock>
    );

  const sel = selectedSession;
  // Placeholders only while another session's topics are loading. A reload of the
  // same session keeps the rows in place, so the page does not jump.
  const showPlaceholders = loadingDetails && detailsFor !== sel?.id;
  const emptySlots = sel && detailsFor === sel.id ? findEmptySlots(topics, sel) : [];
  const slotsShown = new Set<string>();
  const trailingSlot = emptySlots.find((g) => g.beforeTopicId === null) || null;

  const slotRow = (g: EmptySlot) => {
    const later = topics.filter((t) => (toMinutes(t.start_time) ?? -1) >= (toMinutes(g.end) ?? 0)).length;
    return (
      <tr key={`slot-${g.start}`} className="bg-danger-tint align-top">
        <td className="px-4 py-3.5 text-center text-danger"><AlertIcon className="inline" width={18} height={18} /></td>
        <td className="tnum px-4 py-3.5 text-sm font-semibold text-danger-strong">
          <div className="whitespace-nowrap">{formatTime12(g.start)}</div>
          <div className="whitespace-nowrap">{formatTime12(g.end)}</div>
        </td>
        <td className="px-4 py-3.5">
          <p className="text-[15px] font-semibold text-danger-strong">Empty slot · {g.minutes} minute{g.minutes === 1 ? '' : 's'}</p>
          <p className="mt-0.5 text-sm text-danger-strong">
            {later > 0
              ? 'No topic is scheduled in this time. Add a topic here, or close the gap to move the later topics up.'
              : 'No topic is scheduled up to the end of the session. Add a topic here, or change the session end time in Edit session.'}
          </p>
        </td>
        <td className="whitespace-nowrap px-4 py-3 print:hidden">
          <Button size="sm" onClick={() => setIsAddingTopic(true)}><PlusIcon /> Topic</Button>
          {later > 0 && (
            <Button variant="danger-quiet" size="sm" className="ml-1" onClick={() => setClosingSlot(g)}>Close gap</Button>
          )}
        </td>
        <td className="px-1 py-3" />
      </tr>
    );
  };

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
        <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-line pl-4 pr-3">
          <h2 className="text-base font-semibold text-ink">Sessions</h2>
          <Button size="sm" onClick={() => setIsAddingSession(true)}>
            <PlusIcon /> Add session
          </Button>
        </div>

        <div className="space-y-2 border-b border-line p-3">
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
          <select id="filter-session" className={inputCls} value={filterSessionCode} onChange={(e) => {
            setFilterSessionCode(e.target.value);
            // Picking a session takes you straight to it
            const picked = sessions.find((x) => x.session_code === e.target.value);
            if (picked) chooseSession(picked);
          }}>
            <option value="">All sessions</option>
            {sessionOptions.map((opt) => (
              <option key={opt.code} value={opt.code}>{opt.code} – {opt.name}</option>
            ))}
          </select>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="filter-hall" className="sr-only">Filter by hall</label>
              <select id="filter-hall" className={inputCls} value={filterHall} onChange={(e) => {
                const nextHall = e.target.value;
                setFilterHall(nextHall);
                setHallView(!!nextHall);
                setSidebarOpen(false);
                hallScrollTop.current = 0;
                setHallScrollRestore(nextHall
                  ? { request: ++hallScrollRestoreRequest.current, top: 0 }
                  : null);
              }}>
                <option value="">All halls</option>
                {distinctHalls.map((h) => (
                  <option key={h} value={h}>Hall {h}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="filter-date" className="sr-only">Filter by date</label>
              <select id="filter-date" className={inputCls} value={filterDate} onChange={(e) => {
                setFilterDate(e.target.value);
                if (hallView) {
                  hallScrollTop.current = 0;
                  setHallScrollRestore({ request: ++hallScrollRestoreRequest.current, top: 0 });
                }
              }}>
                <option value="">All dates</option>
                {distinctDates.map((d) => (
                  <option key={d} value={d}>{formatDateLabel(d)}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex min-h-9 items-center justify-between text-sm text-muted">
            <span role="status" aria-live="polite" className="tnum">
              Showing <span className="font-semibold text-ink">{filteredSessions.length}</span> of {sessions.length}
            </span>
            {hasActiveFilter && (
              <Button variant="quiet" size="sm" onClick={clearFilters}>Clear filters</Button>
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {filteredSessions.length === 0 ? (
            <EmptyState
              title="No sessions match"
              action={hasActiveFilter ? <Button size="sm" onClick={clearFilters}>Clear filters</Button> : undefined}
            >
              Try a different search or filter.
            </EmptyState>
          ) : (
            <ul>
              {filteredSessions.map((s) => {
                const active = sel?.id === s.id;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      aria-current={active ? 'true' : undefined}
                      onClick={() => chooseSession(s)}
                      className={`flex min-h-14 w-full flex-col justify-center border-b border-l-4 border-b-line py-2 pl-3 pr-4 text-left transition-colors ${
                        active ? 'border-l-accent bg-accent-tint' : 'border-l-transparent hover:bg-slate-50'
                      }`}
                    >
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="tnum text-sm font-semibold text-accent">{s.session_code}</span>
                        <span className="tnum text-xs text-muted">{formatDateLabel(s.session_date)}</span>
                      </span>
                      <span className={`truncate text-sm text-ink ${active ? 'font-medium' : ''}`}>{s.session_name}</span>
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
        {filterHall && (
          <div className={`${hallView ? 'flex' : 'hidden'} min-h-0 flex-1`}>
            <HallOverview
              sessions={filteredSessions}
              hall={filterHall}
              active={hallView}
              onOpen={chooseSession}
              onClose={() => setHallView(false)}
              restoreScroll={hallScrollRestore}
              onScrollPositionChange={(top) => { hallScrollTop.current = top; }}
            />
          </div>
        )}
        {hallView && filterHall ? null : sel ? (
          <>
            <SessionPrintSheet session={sel} topics={topics} coordinators={coordinators} sessionChairs={sessionChairs} options={printOptions} />
            <div className="session-header z-10 shrink-0 border-b border-line bg-white px-4 py-3 sm:px-6 print:hidden">
              <Button
                size="sm"
                onClick={() => setSidebarOpen(true)}
                aria-expanded={sidebarOpen}
                aria-controls="session-list"
                className="mb-2 lg:hidden print:hidden"
              >
                <MenuIcon /> All sessions
              </Button>

              <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                <div className="min-w-0 flex-1 basis-96">
                  <h1 className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xl font-semibold leading-snug text-ink sm:text-2xl">
                    <span className="tnum inline-flex h-7 items-center rounded-lg bg-accent px-2.5 text-sm font-semibold text-white">{sel.session_code}</span>
                    <span>{sel.session_name}</span>
                  </h1>
                  <dl className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-2">
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
                      <dd>{sel.hall ? `Hall ${sel.hall}` : 'Hall not set'}</dd>
                    </div>
                  </dl>
                </div>

                <div className="flex shrink-0 items-center gap-1 print:hidden">
                  <SyncButton onSynced={() => refreshDetails()} />
                  <IconButton label="Print session…" onClick={() => setPrintOpen(true)}><PrinterIcon /></IconButton>
                  <IconButton label="Edit session" onClick={() => setIsEditingSession(true)}><PencilIcon /></IconButton>
                  <Button variant="primary" size="sm" className="ml-1" onClick={() => setIsAddingTopic(true)}>
                    <PlusIcon /> Topic
                  </Button>
                </div>
              </div>

              <div className="coordinator-strip mt-2.5 divide-y divide-line rounded-lg bg-canvas ring-1 ring-inset ring-line">
                {sessionChairs.length > 0 && (
                  <div className="flex items-center gap-x-3 px-3 py-1.5">
                    <h2 className="w-20 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-muted">Chairs</h2>
                    <ul className="flex min-w-0 flex-1 flex-wrap gap-x-4 gap-y-0.5">
                      {sessionChairs.map((c, i) => (
                        <li key={i} className="flex items-center gap-1.5">
                          <span className="tnum text-sm text-muted">{i + 1}.</span>
                          <PersonLink className="text-sm" name={c.faculty?.canonical_name} onOpen={() => c.faculty?.id && setProfileId(c.faculty.id)} />
                        </li>
                      ))}
                    </ul>
                    <IconButton size="sm" label="Edit session chairs (in Edit session)" onClick={() => setIsEditingSession(true)}><PencilIcon width={14} height={14} /></IconButton>
                  </div>
                )}

                <div className="flex items-center gap-x-3 px-3 py-1.5">
                  <h2 className="w-20 shrink-0 text-[11px] font-semibold uppercase tracking-wide text-muted">Coordinators</h2>
                  {coordinators.length === 0 ? (
                    <div className="flex min-w-0 flex-1 items-center">
                      <Button variant="quiet" size="sm" className="!h-7 !px-2 text-xs" onClick={() => setIsEditingCoordinators(true)}>
                        <PlusIcon width={13} height={13} /> Coordinator
                      </Button>
                    </div>
                  ) : (
                    <ul className="flex min-w-0 flex-1 flex-wrap gap-x-4 gap-y-0.5">
                      {coordinators.map((c, i) => (
                        <li key={i} className="flex items-center gap-1.5">
                          <span className="tnum text-sm text-muted">{i + 1}.</span>
                          <PersonLink className="text-sm" name={c.faculty?.canonical_name} onOpen={() => c.faculty?.id && setProfileId(c.faculty.id)} />
                          <Badge tone={roleTone(c.role)}>{c.role}</Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="flex shrink-0 items-center gap-0.5 print:hidden">
                    <Button variant="quiet" size="sm" className="!h-7 !px-2 text-xs" onClick={() => setIsEditingChairs(true)}>Topic chairs</Button>
                    {coordinators.length > 0 && (
                      <>
                        <IconButton size="sm" label="Edit coordinators" onClick={() => setIsEditingCoordinators(true)}><PencilIcon width={14} height={14} /></IconButton>
                        <IconButton size="sm" label="Email report to coordinators…" onClick={() => setIsSendingReport(true)}><MailIcon width={14} height={14} /></IconButton>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div ref={scheduleScrollRef} className="min-h-0 flex-1 overflow-auto p-4 sm:p-6 print:hidden">
              <div role="status" aria-live="polite" className="sr-only">
                {loadingDetails ? 'Loading schedule' : `${topics.length} topics loaded${emptySlots.length ? `, ${emptySlots.length} empty slot${emptySlots.length === 1 ? '' : 's'}` : ''}`}
              </div>
              <div className="overflow-x-auto rounded-xl border border-line bg-white shadow-card print:border-0 print:shadow-none">
                <table className="w-full min-w-[800px] table-fixed border-collapse text-left print:min-w-0">
                  <caption className="sr-only">
                    Topics in session {sel.session_code}, in running order
                  </caption>
                  <colgroup>
                    <col className="w-14" />
                    <col className="w-44" />
                    <col />
                    <col className="w-56" />
                    <col className="w-12" />
                  </colgroup>
                  <thead>
                    <tr className={theadRowCls}>
                      <th scope="col" className={`${thCls} text-center`}>No.</th>
                      <th scope="col" className={thCls}>Time</th>
                      <th scope="col" className={thCls}>Topic</th>
                      <th scope="col" className={thCls}>Faculty and role</th>
                      <th scope="col" className={thCls}><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line" aria-busy={loadingDetails}>
                    {showPlaceholders ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-4"><SkeletonLines rows={4} /></td>
                      </tr>
                    ) : topics.length === 0 ? (
                      <tr>
                        <td colSpan={5}>
                          <EmptyState
                            title="No topics yet"
                            action={<Button variant="primary" onClick={() => setIsAddingTopic(true)}><PlusIcon /> Add topic</Button>}
                          >
                            Add the first topic to start building this session’s programme.
                          </EmptyState>
                        </td>
                      </tr>
                    ) : (
                      topics.map((t) => {
                        const allLinks = t.faculty_topics || [];
                        const facultyList = sortTopicPeople(allLinks.filter((ft: any) => ft.role !== 'Chairperson'));
                        const chairList = allLinks.filter((ft: any) => ft.role === 'Chairperson');
                        // An empty slot sits just before the first topic that starts when the slot ends
                        const slotBefore = emptySlots.find((g) =>
                          g.beforeTopicId !== null && !slotsShown.has(g.start) && toMinutes(g.end) === toMinutes(t.start_time));
                        if (slotBefore) slotsShown.add(slotBefore.start);
                        const justSaved = focusTopic === t.id;
                        const startMinutes = toMinutes(t.start_time);
                        const endMinutes = toMinutes(t.end_time);
                        const duration = startMinutes != null && endMinutes != null && endMinutes > startMinutes
                          ? endMinutes - startMinutes
                          : null;
                        return (
                          <Fragment key={t.id}>
                          {slotBefore && slotRow(slotBefore)}
                          <tr
                            id={`topic-${t.id}`}
                            data-just-saved={justSaved || undefined}
                            className={`align-top transition-colors duration-700 ${justSaved ? 'bg-accent-tint' : 'hover:bg-slate-50/70'}`}
                          >
                            <td className="tnum px-4 py-3.5 text-center text-sm font-semibold text-muted">{t.sequence_no}</td>
                            <td className="tnum whitespace-nowrap px-4 py-3.5 text-sm font-medium leading-5 text-ink-2">
                              <div>{formatTimeAmPm(t.start_time)} – {formatTimeAmPm(t.end_time)}</div>
                              <div className="mt-0.5 text-xs font-normal leading-4 text-muted">({duration != null ? `${duration} min` : '—'})</div>
                            </td>
                            <th scope="row" className="px-4 py-3.5 text-left text-[15px] font-medium leading-snug text-ink">
                              {t.topic_title}
                            </th>
                            <td className="px-4 py-3.5">
                              {facultyList.length === 0 && chairList.length === 0 ? (
                                <Badge tone="warning">No speaker yet</Badge>
                              ) : (
                                <ul className="space-y-2">
                                  {facultyList.map((ft: any, i: number) => (
                                    <li key={i} className="grid min-w-0 gap-y-1">
                                      <div className="flex min-w-0 items-start gap-1.5">
                                        {facultyList.length > 1 && <span className="shrink-0 text-sm font-semibold text-ink-2">{i + 1}.</span>}
                                        <PersonLink className="min-w-0 break-words text-sm leading-5" name={ft.faculty?.canonical_name} onOpen={() => ft.faculty?.id && setProfileId(ft.faculty.id)} />
                                      </div>
                                      <div className="flex flex-wrap items-center gap-1">
                                        <Badge tone={roleTone(ft.role || 'Faculty')}>{roleName(ft.role)}</Badge>
                                        {ft.confirmed && (
                                          <Badge tone="success">
                                            <CheckIcon width={12} height={12} strokeWidth={3} />
                                            Confirmed
                                          </Badge>
                                        )}
                                      </div>
                                    </li>
                                  ))}
                                  {facultyList.length === 0 && (
                                    <li><Badge tone="warning">No speaker yet</Badge></li>
                                  )}
                                </ul>
                              )}
                              {chairList.length > 0 && (
                                <div className="mt-2 border-t border-line pt-2">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">Chair</p>
                                  <ul className="mt-1 space-y-2">
                                    {chairList.map((ft: any, i: number) => (
                                      <li key={i} className="grid min-w-0 gap-y-1">
                                        <PersonLink className="min-w-0 break-words text-sm leading-5" name={ft.faculty?.canonical_name} onOpen={() => ft.faculty?.id && setProfileId(ft.faculty.id)} />
                                        <div className="flex flex-wrap items-center gap-1">
                                          <Badge tone={roleTone('Chairperson')}>Chairperson</Badge>
                                          {ft.confirmed && (
                                            <Badge tone="success">
                                              <CheckIcon width={12} height={12} strokeWidth={3} />
                                              Confirmed
                                            </Badge>
                                          )}
                                        </div>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </td>
                            <td className="px-1 py-3.5 print:hidden">
                              <div className="flex flex-col items-center gap-0.5">
                                <IconButton size="sm" label={`Edit topic ${t.sequence_no}: ${t.topic_title}`} onClick={() => setEditingTopic(t)}>
                                  <PencilIcon width={15} height={15} />
                                </IconButton>
                                <IconButton size="sm" tone="danger" label={`Delete topic ${t.sequence_no}: ${t.topic_title}`} onClick={() => setDeletingTopic(t)}>
                                  <TrashIcon width={15} height={15} />
                                </IconButton>
                              </div>
                            </td>
                          </tr>
                          </Fragment>
                        );
                      })
                    )}
                    {!showPlaceholders && topics.length > 0 && trailingSlot && slotRow(trailingSlot)}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <EmptyState
            className="flex-1 justify-center"
            title={sessions.length === 0 ? 'No sessions yet' : 'Select a session'}
            action={sessions.length === 0 ? <Button variant="primary" onClick={() => setIsAddingSession(true)}><PlusIcon /> Add session</Button> : undefined}
          >
            {sessions.length === 0 ? 'Add the first session to start the programme.' : 'Choose a session from the list to see its topics.'}
          </EmptyState>
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
              const before = new Set(topics.map((t) => t.id));
              await resequenceSession(sel.id);
              const fresh = await refreshDetails();
              setIsAddingTopic(false);
              const added = fresh.find((t) => !before.has(t.id));
              if (added) setFocusTopic(added.id);
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
        {isEditingChairs && sel && (
          <EditChairpersonsModal
            session={sel}
            onClose={() => setIsEditingChairs(false)}
            onSaved={async () => {
              await refreshDetails();
              setIsEditingChairs(false);
            }}
          />
        )}
        {printOpen && sel && (
          <PrintOptionsDialog
            initial={printOptions}
            onCancel={() => setPrintOpen(false)}
            onPrint={(o) => {
              setPrintOptions(o);
              setPrintOpen(false);
              // let the dialog close and the print sheet re-render before printing
              setTimeout(() => window.print(), 150);
            }}
          />
        )}
        {isSendingReport && sel && (
          <CoordinatorReportDialog session={sel} onClose={() => setIsSendingReport(false)} />
        )}
        {editingTopic && sel && (
          <EditTopicModal
            topic={editingTopic}
            session={sel}
            sessionTopics={topics}
            onClose={() => setEditingTopic(null)}
            onSaved={async () => {
              // Time may have moved -> resequence the whole session
              const savedId = editingTopic.id;
              await resequenceSession(sel.id);
              const fresh = await refreshDetails();
              setEditingTopic(null);
              if (fresh.some((t) => t.id === savedId)) setFocusTopic(savedId);
            }}
          />
        )}

        {deletingTopic && sel && (
          <DeleteTopicDialog
            topic={deletingTopic}
            session={sel}
            topics={topics}
            facultyCount={deletingTopic.faculty_topics?.length || 0}
            onCancel={() => setDeletingTopic(null)}
            onDeleted={async () => {
              setDeletingTopic(null);
              await refreshDetails();
            }}
          />
        )}

        {profileId && (
          <FacultyProfileHost
            facultyId={profileId}
            onClose={() => setProfileId(null)}
            onChanged={() => { refreshDetails(); }}
          />
        )}

        {closingSlot && sel && (
          <CloseGapDialog
            slot={closingSlot}
            session={sel}
            topics={topics}
            onCancel={() => setClosingSlot(null)}
            onDone={async () => {
              setClosingSlot(null);
              await refreshDetails();
            }}
          />
        )}
      </main>
    </div>
  );
}
