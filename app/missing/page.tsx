'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../supabase';
import AssignFacultyModal from '../components/AssignFacultyModal';
import { inputCls } from '../components/Field';
import { ArrowUpRightIcon, CalendarIcon, ChevronDownIcon, ClockIcon, PinIcon, PlusIcon } from '../components/Icons';
import { Button, EmptyState, LoadingBlock, PageHeader, PageShell, buttonCls, cardCls } from '../components/ui';
import { formatTime12 } from '../lib/time';
import { findEmptySlots } from '../lib/slots';
import { PROGRAMME_LABEL, programmeOf, type Programme } from '../lib/sessionGroup';
import { LEAD_COORDINATOR_ROLE } from '../lib/coordOrder';

const NONE = '__none';

// One quiet row per thing to fix: plain white, a thin marker on the left, and a small button
const ROW = 'flex flex-col justify-between gap-3 border-l-2 border-l-blue-300 py-3 pl-4 pr-1 sm:flex-row sm:items-center';

function dateLabel(d: string | null | undefined) {
  if (!d) return null;
  const dt = new Date(`${d}T00:00:00`);
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// A placeholder row in the faculty table ("TBD (To Be Determined)", FAC000) is not a real assignment
function isTbd(f: FacultyRef) {
  if (!f) return true;
  return f.faculty_id === 'FAC000' || /^TBD/i.test(String(f.canonical_name || '').trim());
}

function listText(items: string[]) {
  if (items.length <= 1) return items[0] || '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

// Each gap is one thing to fix, so a session is listed while it has any of them
type IssueKey = 'topics' | 'coordinator' | 'lead' | 'schedule';
type IssueFilter = 'all' | IssueKey | 'speaker';
type SortKey = 'date' | 'fixes' | 'code' | 'name';

type FacultyRef = { faculty_id: string | null; canonical_name: string | null } | null;
type Coordinator = { role: string | null; faculty: FacultyRef };
type Topic = {
  id: string;
  topic_title: string | null;
  sequence_no: number | null;
  faculty_topics: { role: string | null; faculty: FacultyRef }[] | null;
};

type SessionRow = {
  id: string;
  session_code: string;
  session_name: string | null;
  session_date: string | null;
  start_time: string | null;
  end_time: string | null;
  hall: string | null;
  session_topics: Topic[];
  isEmpty: boolean;
  hasCoordinators: boolean;
  hasLead: boolean;
  missingTopics: Topic[];
  people: string[];
  programme: Programme;
  issues: Set<IssueKey>;
  scheduleGaps: string[];
  fixes: number;
  haystack: string;
};

// One row of the conference_sessions query, exactly as Supabase returns it
type RawSession = {
  id: string;
  session_code: string;
  session_name: string | null;
  session_date: string | null;
  start_time: string | null;
  end_time: string | null;
  hall: string | null;
  session_topics: Topic[] | null;
  session_coordinators: Coordinator[] | null;
  session_chairs: { faculty: FacultyRef }[] | null;
};

const ISSUE_OPTIONS: { value: IssueFilter; label: string }[] = [
  { value: 'all', label: 'All issues' },
  { value: 'topics', label: 'No topics' },
  { value: 'speaker', label: 'Missing a speaker' },
  { value: 'coordinator', label: 'No coordinator' },
  { value: 'lead', label: 'No lead coordinator' },
  { value: 'schedule', label: 'Incomplete schedule' },
];

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'date', label: 'Date' },
  { value: 'fixes', label: 'Most to fix first' },
  { value: 'code', label: 'Code' },
  { value: 'name', label: 'Session name' },
];

function makeRow(s: RawSession): SessionRow {
  const coordinators = s.session_coordinators || [];
  const realCoordinators = coordinators.filter((c) => !isTbd(c.faculty));
  const hasCoordinators = realCoordinators.length > 0;
  const hasLead = realCoordinators.some((c) => c.role === LEAD_COORDINATOR_ROLE);

  const topics = s.session_topics || [];
  const isEmpty = topics.length === 0;
  // A topic needs somebody other than a chairperson: that is the speaker it is still missing
  const missingTopics = topics.filter((t) =>
    !(t.faculty_topics || []).some((ft) => ft.role !== 'Chairperson' && !isTbd(ft.faculty)));

  const scheduleGaps: string[] = [];
  if (!s.session_date) scheduleGaps.push('date');
  if (!s.start_time || !s.end_time) scheduleGaps.push('time');
  if (!s.hall) scheduleGaps.push('hall');

  // Everyone already in this session (coordinators, session chairs, speakers), for the Faculty filter
  const people = new Set<string>();
  const add = (f: FacultyRef) => {
    if (isTbd(f)) return;
    const n = String(f?.canonical_name || '').trim();
    if (n) people.add(n);
  };
  coordinators.forEach((c) => add(c.faculty));
  (s.session_chairs || []).forEach((c) => add(c.faculty));
  topics.forEach((t) => (t.faculty_topics || []).forEach((ft) => add(ft.faculty)));

  const issues = new Set<IssueKey>();
  if (isEmpty) issues.add('topics');
  if (!hasCoordinators) issues.add('coordinator');
  else if (!hasLead) issues.add('lead');
  if (scheduleGaps.length) issues.add('schedule');

  const fixes =
    (isEmpty ? 1 : 0) +
    (hasCoordinators ? 0 : 1) +
    (hasCoordinators && !hasLead ? 1 : 0) +
    (scheduleGaps.length ? 1 : 0) +
    missingTopics.length;

  return {
    id: s.id,
    session_code: s.session_code,
    session_name: s.session_name,
    session_date: s.session_date,
    start_time: s.start_time,
    end_time: s.end_time,
    hall: s.hall,
    session_topics: topics,
    isEmpty,
    hasCoordinators,
    hasLead,
    missingTopics,
    people: [...people],
    programme: programmeOf(s.session_code),
    issues,
    scheduleGaps,
    fixes,
    // The Session search also looks inside topic titles, so "Botox" finds its session
    haystack: `${s.session_code} ${s.session_name || ''} ${topics.map((t) => t.topic_title || '').join(' ')}`.toLowerCase(),
  };
}

function matchesIssue(s: SessionRow, issue: IssueFilter) {
  if (issue === 'all') return true;
  if (issue === 'speaker') return s.missingTopics.length > 0;
  return s.issues.has(issue);
}

export default function MissingDataPage() {
  const [view, setView] = useState<'todo' | 'empty'>('todo');
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigningTopic, setAssigningTopic] = useState<Topic | null>(null);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setOpenIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  // ---- filters (all optional; they combine) ----
  const [fProgramme, setFProgramme] = useState<'all' | Programme>('all');
  const [fIssue, setFIssue] = useState<IssueFilter>('all');
  const [fDate, setFDate] = useState('');
  const [fHall, setFHall] = useState('');
  const [fSession, setFSession] = useState('');
  const [fFaculty, setFFaculty] = useState('');
  // ---- how the list is ordered and laid out ----
  const [sort, setSort] = useState<SortKey>('date');
  const [grouped, setGrouped] = useState(false);

  const filtering = !!(fProgramme !== 'all' || fIssue !== 'all' || fDate || fHall || fSession.trim() || fFaculty.trim());
  const clearFilters = () => {
    setFProgramme('all');
    setFIssue('all');
    setFDate('');
    setFHall('');
    setFSession('');
    setFFaculty('');
  };

  async function fetchMissingData() {
    setLoading(true);
    const { data } = await supabase.from('conference_sessions').select(`
      id, session_code, session_name, session_date, start_time, end_time, hall,
      session_topics (
        id, topic_title, sequence_no,
        faculty_topics ( role, faculty ( faculty_id, canonical_name ) )
      ),
      session_coordinators ( role, faculty ( faculty_id, canonical_name ) ),
      session_chairs ( faculty ( faculty_id, canonical_name ) )
    `).order('session_date', { ascending: true }).order('start_time', { ascending: true });

    if (data) setSessions((data as unknown as RawSession[]).map(makeRow).filter((s) => s.fixes > 0));
    setLoading(false);
  }

  useEffect(() => {
    fetchMissingData();
    // Returning (browser Back) from a session lands on the same view, filters and order
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') === 'empty') setView('empty');
    const programme = params.get('programme');
    if (programme === 'workshop' || programme === 'scientific') setFProgramme(programme);
    const issue = params.get('issue');
    if (ISSUE_OPTIONS.some((o) => o.value === issue)) setFIssue(issue as IssueFilter);
    const sortParam = params.get('sort');
    if (SORT_OPTIONS.some((o) => o.value === sortParam)) setSort(sortParam as SortKey);
    setFDate(params.get('date') || '');
    setFHall(params.get('hall') || '');
    setFSession(params.get('session') || '');
    setFFaculty(params.get('faculty') || '');
    setGrouped(params.get('group') === '1');
  }, []);

  // Keep the address bar in step with the filters (replaceState, so Back still means "leave the page").
  // The first run is skipped: the URL already holds what the mount effect just read.
  const urlReady = useRef(false);
  useEffect(() => {
    if (!urlReady.current) { urlReady.current = true; return; }
    const params = new URLSearchParams();
    if (view === 'empty') params.set('view', 'empty');
    if (fProgramme !== 'all') params.set('programme', fProgramme);
    if (fIssue !== 'all') params.set('issue', fIssue);
    if (fDate) params.set('date', fDate);
    if (fHall) params.set('hall', fHall);
    if (fSession.trim()) params.set('session', fSession.trim());
    if (fFaculty.trim()) params.set('faculty', fFaculty.trim());
    if (sort !== 'date') params.set('sort', sort);
    if (grouped) params.set('group', '1');
    const qs = params.toString();
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname);
  }, [view, fProgramme, fIssue, fDate, fHall, fSession, fFaculty, sort, grouped]);

  const changeView = (v: 'todo' | 'empty') => {
    setView(v);
    window.scrollTo(0, 0);
  };

  const dateOptions = useMemo(() => {
    const ds = [...new Set(sessions.map((s) => s.session_date || ''))].sort((a, b) => (a || '9999').localeCompare(b || '9999'));
    return ds.map((d) => ({ value: d || NONE, label: d ? dateLabel(d) || d : 'No date' }));
  }, [sessions]);
  const hallOptions = useMemo(() => {
    const hs = [...new Set(sessions.map((s) => String(s.hall || '').trim()))]
      .sort((a, b) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b, undefined, { numeric: true })));
    return hs.map((h) => ({ value: h || NONE, label: !h ? 'No hall' : h.toLowerCase() === 'all' ? 'All halls (plenary)' : `Hall ${h}` }));
  }, [sessions]);
  const sessionSuggestions = useMemo(
    () => sessions.map((s) => `${s.session_code} – ${s.session_name || 'Untitled session'}`),
    [sessions]);
  const facultySuggestions = useMemo(
    () => [...new Set<string>(sessions.flatMap((s) => s.people))].sort((a, b) => a.localeCompare(b)),
    [sessions]);

  const visible = useMemo(() => {
    const qs = fSession.trim().toLowerCase();
    const qf = fFaculty.trim().toLowerCase();
    return sessions.filter((s) =>
      (fProgramme === 'all' || s.programme === fProgramme) &&
      matchesIssue(s, fIssue) &&
      (!fDate || (s.session_date || NONE) === fDate) &&
      (!fHall || (String(s.hall || '').trim() || NONE) === fHall) &&
      (!qs || s.haystack.includes(qs)) &&
      (!qf || s.people.some((n) => n.toLowerCase().includes(qf))));
  }, [sessions, fProgramme, fIssue, fDate, fHall, fSession, fFaculty]);

  const ordered = useMemo(() => {
    const byDate = (a: SessionRow, b: SessionRow) =>
      (a.session_date || '9999-12-31').localeCompare(b.session_date || '9999-12-31') ||
      (a.start_time || '99:99').localeCompare(b.start_time || '99:99') ||
      a.session_code.localeCompare(b.session_code, undefined, { numeric: true });
    const compare =
      sort === 'fixes' ? (a: SessionRow, b: SessionRow) => b.fixes - a.fixes || byDate(a, b) :
      sort === 'code' ? (a: SessionRow, b: SessionRow) => a.session_code.localeCompare(b.session_code, undefined, { numeric: true }) :
      sort === 'name' ? (a: SessionRow, b: SessionRow) => (a.session_name || '').localeCompare(b.session_name || '', undefined, { sensitivity: 'base' }) :
      byDate;
    return [...visible].sort(compare);
  }, [visible, sort]);

  // Group headings only make sense while both programmes are shown
  const groups = useMemo(() => {
    if (!grouped || fProgramme !== 'all') return [{ key: 'all', title: null as string | null, items: ordered }];
    return (['workshop', 'scientific'] as Programme[])
      .map((p) => ({ key: p, title: PROGRAMME_LABEL[p] as string | null, items: ordered.filter((s) => s.programme === p) }))
      .filter((g) => g.items.length > 0);
  }, [ordered, grouped, fProgramme]);

  if (loading) {
    return (
      <PageShell>
        <PageHeader title="To-do" description="Sessions and topics that still need your attention." />
        <LoadingBlock>Checking every session for missing information…</LoadingBlock>
      </PageShell>
    );
  }

  if (view === 'empty') return <EmptySlotsView onBack={() => changeView('todo')} />;

  const totalItems = visible.reduce((n, s) => n + s.fixes, 0);
  const allOpen = ordered.length > 0 && ordered.every((s) => openIds.has(String(s.id)));
  const showGroupToggle = fProgramme === 'all' && sessions.length > 1;

  return (
    <>
      <PageShell>
        <PageHeader
          title="To-do"
          description={
            sessions.length === 0
              ? 'Sessions and topics that still need your attention.'
              : `${totalItems} thing${totalItems === 1 ? '' : 's'} to fix in ${visible.length} session${visible.length === 1 ? '' : 's'}: topics without a speaker, sessions without coordinators or a lead, and incomplete schedules.`
          }
          actions={
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={() => changeView('empty')}>Empty slots</Button>
              {ordered.length > 0 ? (
              <Button
                size="sm"
                onClick={() => setOpenIds(allOpen ? new Set() : new Set(ordered.map((s) => String(s.id))))}
              >
                {allOpen ? 'Collapse all' : 'Expand all'}
              </Button>
              ) : null}
            </div>
          }
        />

        {sessions.length === 0 ? (
          <div className={cardCls}>
            <EmptyState tone="success" title="Everything is in place">
              All sessions have topics, faculty, coordinators and a complete schedule.
            </EmptyState>
          </div>
        ) : (
          <>
          <section aria-label="Filter the to-do list" className={`${cardCls} mb-4 p-3 sm:p-4`}>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label htmlFor="fprogramme" className="mb-1 block text-xs font-medium text-ink-2">Programme</label>
                <select id="fprogramme" value={fProgramme} onChange={(e) => setFProgramme(e.target.value as 'all' | Programme)} className={inputCls}>
                  <option value="all">All programmes</option>
                  <option value="workshop">Workshops (WS + MC)</option>
                  <option value="scientific">Scientific sessions</option>
                </select>
              </div>
              <div>
                <label htmlFor="fissue" className="mb-1 block text-xs font-medium text-ink-2">What&rsquo;s missing</label>
                <select id="fissue" value={fIssue} onChange={(e) => setFIssue(e.target.value as IssueFilter)} className={inputCls}>
                  {ISSUE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
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
                <input id="fsession" type="search" list="fsession-list" placeholder="Code, name or topic" value={fSession}
                  onChange={(e) => setFSession(e.target.value)} className={inputCls} autoComplete="off" />
                <datalist id="fsession-list">{sessionSuggestions.map((s) => <option key={s} value={s.split(' – ')[0]} label={s} />)}</datalist>
              </div>
              <div>
                <label htmlFor="ffaculty" className="mb-1 block text-xs font-medium text-ink-2">Faculty in the session</label>
                <input id="ffaculty" type="search" list="ffaculty-list" placeholder="Name" value={fFaculty}
                  onChange={(e) => setFFaculty(e.target.value)} className={inputCls} autoComplete="off" />
                <datalist id="ffaculty-list">{facultySuggestions.map((n) => <option key={n} value={n} />)}</datalist>
              </div>
              <div>
                <label htmlFor="fsort" className="mb-1 block text-xs font-medium text-ink-2">Sort</label>
                <select id="fsort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className={inputCls}>
                  {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-ink-2">
              <span role="status" aria-live="polite">
                Showing <strong className="text-ink">{visible.length}</strong> of {sessions.length} sessions
              </span>
              {showGroupToggle && (
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={grouped} onChange={(e) => setGrouped(e.target.checked)} />
                  Group by programme
                </label>
              )}
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
          <div className="space-y-4">
            {groups.map((group) => (
              <div key={group.key}>
                {group.title && (
                  <h2 className="mb-2 flex flex-wrap items-baseline gap-2 px-1 text-sm font-semibold text-ink">
                    {group.title}
                    <span className="tnum rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-ink-2 ring-1 ring-inset ring-line">
                      {group.items.length}
                    </span>
                    <span className="tnum text-xs font-normal text-muted">
                      {group.items.reduce((n, s) => n + s.fixes, 0)} to fix
                    </span>
                  </h2>
                )}
                <div className={`divide-y divide-line overflow-hidden ${cardCls}`}>
                  {group.items.map((session) => (
                    <SessionItem
                      key={session.id}
                      session={session}
                      open={openIds.has(String(session.id))}
                      onToggle={() => toggle(String(session.id))}
                      onAssign={(topic) => setAssigningTopic(topic)}
                    />
                  ))}
                </div>
              </div>
            ))}
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

function SessionItem({
  session,
  open,
  onToggle,
  onAssign,
}: {
  session: SessionRow;
  open: boolean;
  onToggle: () => void;
  onAssign: (topic: Topic) => void;
}) {
  const date = dateLabel(session.session_date);
  return (
    <section aria-labelledby={`session-${session.id}`}>
      <button
        type="button"
        onClick={onToggle}
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
        <span className="tnum text-sm font-medium text-blue-900">{session.fixes} to fix</span>
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
              <li className={ROW}>
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
              <li className={ROW}>
                <div>
                  <p className="font-medium text-ink">No coordinators assigned</p>
                  <p className="text-sm text-ink-2">Assign a lead, national or local coordinator.</p>
                </div>
                <a href={`/sessions?code=${session.session_code}`} className={buttonCls('quiet', 'sm', 'border border-blue-200')}>
                  Edit coordinators <ArrowUpRightIcon width={14} height={14} />
                </a>
              </li>
            )}

            {session.hasCoordinators && !session.hasLead && (
              <li className={ROW}>
                <div>
                  <p className="font-medium text-ink">No lead coordinator</p>
                  <p className="text-sm text-ink-2">Only a national or local coordinator is assigned.</p>
                </div>
                <a href={`/sessions?code=${session.session_code}`} className={buttonCls('quiet', 'sm', 'border border-blue-200')}>
                  Edit coordinators <ArrowUpRightIcon width={14} height={14} />
                </a>
              </li>
            )}

            {session.scheduleGaps.length > 0 && (
              <li className={ROW}>
                <div>
                  <p className="font-medium text-ink">Schedule incomplete</p>
                  <p className="text-sm text-ink-2">Missing {listText(session.scheduleGaps)}.</p>
                </div>
                <a href={`/sessions?code=${session.session_code}`} className={buttonCls('quiet', 'sm', 'border border-blue-200')}>
                  Fix schedule <ArrowUpRightIcon width={14} height={14} />
                </a>
              </li>
            )}

            {session.missingTopics.map((topic) => (
              <li key={topic.id} className={ROW}>
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
                  onClick={() => onAssign(topic)}
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
