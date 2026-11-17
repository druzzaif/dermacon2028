'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabase';
import dynamic from 'next/dynamic';
// Modals load only when opened
const EditFacultyModal = dynamic(() => import('../components/EditFacultyModal'));
const FacultyProfileModal = dynamic(() => import('../components/FacultyProfileModal'));
const PdfOptionsDialog = dynamic(() => import('../components/PdfOptionsDialog'));
const FacultyListPrintDialog = dynamic(() => import('../components/FacultyListPrintDialog'));
const SendEmailsDialog =dynamic(() => import('../components/SendEmailsDialog'));
const SendWhatsAppDialog = dynamic(() => import('../components/SendWhatsAppDialog'));
import Badge, { roleTone } from '../components/Badge';
import SyncButton from '../components/SyncButton';
import { DownloadIcon, MailIcon, SearchIcon, WhatsAppIcon } from '../components/Icons';
import { Button, EmptyState, PageHeader, PageShell, SkeletonLines, buttonCls, cardCls, thCls, theadRowCls } from '../components/ui';
import { inputCls } from '../components/Field';
import { roleName } from '../lib/topicPeople';
import { sendThankYouToFaculty } from '../actions';

type CountFilter = 'all' | '0' | '1' | '2' | '3+' | '4+' | '5+';

const FACULTY_SELECT = `
  *,
  faculty_topics ( role, confirmed, session_topics ( conference_sessions ( session_code, session_date, hall ) ) ),
  session_chairs ( confirmed, conference_sessions ( session_code, session_date, hall ) )
`;

type SessionCodeRelation = {
  session_code: string | null;
  session_date?: string | null;
  hall?: string | null;
} | null;
type FacultyRow = {
  id: string;
  canonical_name: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string | null;
  designation: string | null;
  is_active: boolean | null;
  faculty_id: string | null;
  country: string | null;
  alt_email: string | null;
  sessions_as_faculty: number | null;
  person_type: string | null;
  is_faculty: boolean | null;
  is_coordinator: boolean | null;
  google_confirmed: boolean | null;
  google_form_sync_date: string | null;
  google_email: string | null;
  google_phone: string | null;
  email_sent: boolean | null;
  email_sent_date: string | null;
  reminder_sent: boolean | null;
  whatsapp_sent: boolean | null;
  faculty_topics?: {
    role: string | null;
    confirmed: boolean;
    session_topics?: { conference_sessions?: SessionCodeRelation } | null;
  }[] | null;
  session_chairs?: {
    confirmed: boolean;
    conference_sessions?: SessionCodeRelation;
  }[] | null;
};

const ROLE_ORDER = ['Faculty', 'Moderator', 'Panelist', 'Debater', 'Chairperson', 'Session chair'];
function roleSessionBreakdown(doc: FacultyRow): { role: string; sessionCode: string; total: number; confirmed: number }[] {
  const m = new Map<string, { role: string; sessionCode: string; total: number; confirmed: number }>();
  for (const ft of doc.faculty_topics || []) {
    const role = roleName(ft.role);
    const sessionCode = ft.session_topics?.conference_sessions?.session_code || '—';
    const key = `${role}|${sessionCode}`;
    const e = m.get(key) || { role, sessionCode, total: 0, confirmed: 0 };
    e.total += 1;
    if (ft.confirmed) e.confirmed += 1;
    m.set(key, e);
  }
  for (const c of doc.session_chairs || []) {
    const role = 'Session chair';
    const sessionCode = c.conference_sessions?.session_code || '—';
    const key = `${role}|${sessionCode}`;
    const e = m.get(key) || { role, sessionCode, total: 0, confirmed: 0 };
    e.total += 1;
    if (c.confirmed) e.confirmed += 1;
    m.set(key, e);
  }
  return [...m.values()].sort((a, b) =>
    (ROLE_ORDER.indexOf(a.role) === -1 ? 99 : ROLE_ORDER.indexOf(a.role)) -
      (ROLE_ORDER.indexOf(b.role) === -1 ? 99 : ROLE_ORDER.indexOf(b.role)) ||
    a.sessionCode.localeCompare(b.sessionCode, undefined, { numeric: true }));
}

// Every topic and whole-session chair assignment counts.
function assignmentCountOf(doc: FacultyRow): number {
  return (doc.faculty_topics?.length ?? 0) + (doc.session_chairs?.length ?? 0);
}

function matchesCount(assignmentCount: number, filter: CountFilter): boolean {
  switch (filter) {
    case 'all': return true;
    case '0': return assignmentCount === 0;
    case '1': return assignmentCount === 1;
    case '2': return assignmentCount === 2;
    case '3+': return assignmentCount >= 3;
    case '4+': return assignmentCount >= 4;
    case '5+': return assignmentCount >= 5;
  }
}

const isWorkshopCode = (code: string | null | undefined) => /^(WS|MC)/i.test(String(code || '').trim());

// Every session this person is linked to (topics and whole-session chairing)
function sessionsOf(doc: FacultyRow): { code: string; date: string; hall: string; confirmed: boolean }[] {
  const out: { code: string; date: string; hall: string; confirmed: boolean }[] = [];
  for (const ft of doc.faculty_topics || []) {
    const s = ft.session_topics?.conference_sessions;
    out.push({ code: s?.session_code || '', date: s?.session_date || '', hall: s?.hall || '', confirmed: !!ft.confirmed });
  }
  for (const c of doc.session_chairs || []) {
    const s = c.conference_sessions;
    out.push({ code: s?.session_code || '', date: s?.session_date || '', hall: s?.hall || '', confirmed: !!c.confirmed });
  }
  return out;
}

// Calendar day in India time, which is how the Emails page counts "today"
function istDay(iso: string | null | undefined): string {
  if (!iso) return '';
  return new Date(new Date(iso).getTime() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}
function formatDay(d: string): string {
  const dt = new Date(`${d}T00:00:00`);
  return Number.isNaN(dt.getTime()) ? d : dt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

// Compact filter dropdowns
const selCls = 'h-8 w-auto rounded-md border border-field bg-white py-0 pl-2 pr-6 text-xs text-ink';

type TypeFilter = 'all' | 'workshop' | 'scientific';
type ConfirmFilter = 'all' | 'all-confirmed' | 'some-unconfirmed' | 'none-confirmed' | 'partial' | 'any-confirmed';
type EmailFilter = 'all' | 'emailed' | 'not-emailed' | 'today';
type WhatsAppFilter = 'all' | 'sent' | 'not-sent';

export default function FacultyDirectoryPage() {
  const [faculty, setFaculty] = useState<FacultyRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingFaculty, setEditingFaculty] = useState<FacultyRow | null>(null);
  const [viewingProfile, setViewingProfile] = useState<FacultyRow | null>(null);
  const [pdfFor, setPdfFor] = useState<FacultyRow | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [countFilter, setCountFilter] = useState<CountFilter>('all');
  const [dayFilter, setDayFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [hallFilter, setHallFilter] = useState('all');
  const [confirmFilter, setConfirmFilter] = useState<ConfirmFilter>('all');
  const [emailFilter, setEmailFilter] = useState<EmailFilter>('all');
  const [whatsappFilter, setWhatsappFilter] = useState<WhatsAppFilter>('all');
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [emailing, setEmailing] = useState(false);
  const [whatsapping, setWhatsapping] = useState<string[] | null>(null);
  const [printing, setPrinting] = useState(false);
  const [revealedContacts, setRevealedContacts] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    async function fetchFaculty() {
      const { data, error } = await supabase
        .from('faculty')
        .select(FACULTY_SELECT)
        .order('canonical_name');

      if (error) console.error(error);
      else setFaculty(data || []);
      setLoading(false);
    }
    fetchFaculty();
  }, []);

  async function refreshFaculty() {
    const { data } = await supabase
      .from('faculty')
      .select(FACULTY_SELECT)
      .order('canonical_name');
    if (data) setFaculty(data);
  }

  const days = useMemo(() => [...new Set(faculty.flatMap((f) => sessionsOf(f).map((x) => x.date)).filter(Boolean))].sort(), [faculty]);
  const halls = useMemo(
    () => [...new Set(faculty.flatMap((f) => sessionsOf(f).map((x) => x.hall)).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    [faculty],
  );
  const today = istDay(new Date().toISOString());

  const filteredFaculty = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return faculty.filter((doc) => {
      const sessions = sessionsOf(doc);
      if (q) {
        const hay = [doc.canonical_name, doc.email, ...sessions.map((s) => s.code)].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (!matchesCount(assignmentCountOf(doc), countFilter)) return false;
      // day, type and hall must all hold for the SAME session
      if (dayFilter !== 'all' || typeFilter !== 'all' || hallFilter !== 'all') {
        const ok = sessions.some((s) =>
          (dayFilter === 'all' || s.date === dayFilter) &&
          (hallFilter === 'all' || s.hall === hallFilter) &&
          (typeFilter === 'all' || (typeFilter === 'workshop') === isWorkshopCode(s.code)));
        if (!ok) return false;
      }
      if (confirmFilter !== 'all') {
        const total = sessions.length;
        const done = sessions.filter((s) => s.confirmed).length;
        if (confirmFilter === 'all-confirmed' && !(total > 0 && done === total)) return false;
        if (confirmFilter === 'some-unconfirmed' && !(done < total)) return false;
        if (confirmFilter === 'none-confirmed' && !(total > 0 && done === 0)) return false;
        if (confirmFilter === 'partial' && !(done > 0 && done < total)) return false;
        if (confirmFilter === 'any-confirmed' && !(done > 0)) return false;
      }
      if (emailFilter === 'emailed' && !doc.email_sent) return false;
      if (emailFilter === 'not-emailed' && doc.email_sent) return false;
      if (emailFilter === 'today' && !(doc.email_sent && istDay(doc.email_sent_date) === today)) return false;
      if (whatsappFilter === 'sent' && !doc.whatsapp_sent) return false;
      if (whatsappFilter === 'not-sent' && doc.whatsapp_sent) return false;
      return true;
    });
  }, [faculty, searchTerm, countFilter, dayFilter, typeFilter, hallFilter, confirmFilter, emailFilter, whatsappFilter, today]);

  const filtersActive = Boolean(searchTerm.trim()) || countFilter !== 'all' || dayFilter !== 'all' || typeFilter !== 'all'
    || hallFilter !== 'all' || confirmFilter !== 'all' || emailFilter !== 'all' || whatsappFilter !== 'all';
  function clearFilters() {
    setSearchTerm('');
    setCountFilter('all');
    setDayFilter('all');
    setTypeFilter('all');
    setHallFilter('all');
    setConfirmFilter('all');
    setEmailFilter('all');
    setWhatsappFilter('all');
  }

  // A row can be ticked when there is at least one way to reach the person:
  // email for the email dialog, phone for the WhatsApp dialog.
  const selectable = filteredFaculty.filter((f) => (f.email || f.phone) && assignmentCountOf(f) > 0);
  const allShownSelected = selectable.length > 0 && selectable.every((f) => selected.has(f.id));
  function toggleSelected(id: string) {
    setSelected((cur) => { const n = new Set(cur); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }
  function toggleAllShown() {
    setSelected((cur) => {
      const n = new Set(cur);
      if (allShownSelected) selectable.forEach((f) => n.delete(f.id));
      else selectable.forEach((f) => n.add(f.id));
      return n;
    });
  }
  // Never-emailed faculty start as "new email", the rest as "schedule update"; the dialog lets you change each one
  const emailItems = faculty
    .filter((f) => selected.has(f.id) && f.email && assignmentCountOf(f) > 0)
    .map((f) => ({ facultyId: f.id, kind: (f.email_sent ? 'update' : 'first') as 'first' | 'update' }));
  // Only people with a phone get the WhatsApp reminder; the dialog checks the number again.
  const whatsappIds = faculty
    .filter((f) => selected.has(f.id) && f.phone && assignmentCountOf(f) > 0)
    .map((f) => f.id);

  const [thankingId, setThankingId] = useState<string | null>(null);
  async function thankYou(doc: FacultyRow) {
    if (!window.confirm(`Send the thank-you email to ${doc.canonical_name} (${doc.email})?\n\nIt lists the topics they have confirmed, with the PDF attached. Sent emails cannot be recalled.`)) return;
    setThankingId(doc.id);
    try {
      const r = await sendThankYouToFaculty(doc.id);
      window.alert(r.message || (r.success ? 'Sent.' : 'Could not send.'));
    } catch (e: any) {
      window.alert(e?.message || 'Could not send.');
    } finally {
      setThankingId(null);
    }
  }

  function toggleContact(id: string) {
    setRevealedContacts((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <>
      <PageShell wide>
        <PageHeader
          title="Faculty"
          description="Everyone speaking, chairing or coordinating at the conference. Select a name to see their roles and email them."
          actions={
            <>
              <SyncButton onSynced={refreshFaculty} />
              <a href="/api/export" className={buttonCls('secondary', 'sm')} title="Export to Excel" aria-label="Export to Excel">
                <DownloadIcon /> Excel
              </a>
            </>
          }
        />

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[16rem] flex-1 sm:max-w-md">
            <label htmlFor="faculty-search" className="sr-only">
              Search faculty by name or email
            </label>
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              id="faculty-search"
              type="search"
              placeholder="Search name or email"
              className={`${inputCls} h-8 pl-9 text-xs`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="faculty-count" className="sr-only">
              Filter by number of assignments
            </label>
            <select
              id="faculty-count"
              value={countFilter}
              onChange={(e) => setCountFilter(e.target.value as CountFilter)}
              className={selCls}
            >
              <option value="all">All assignment counts</option>
              <option value="0">0 assignments</option>
              <option value="1">1 assignment</option>
              <option value="2">2 assignments</option>
              <option value="3+">3+ assignments</option>
              <option value="4+">4+ assignments</option>
              <option value="5+">5+ assignments</option>
            </select>
          </div>
          <select aria-label="Filter by day" value={dayFilter} onChange={(e) => setDayFilter(e.target.value)} className={selCls}>
            <option value="all">All days</option>
            {days.map((d) => <option key={d} value={d}>{formatDay(d)}</option>)}
          </select>
          <select aria-label="Filter by session type" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as TypeFilter)} className={selCls}>
            <option value="all">Workshops + scientific</option>
            <option value="workshop">Workshops only</option>
            <option value="scientific">Scientific sessions only</option>
          </select>
          <select aria-label="Filter by hall" value={hallFilter} onChange={(e) => setHallFilter(e.target.value)} className={selCls}>
            <option value="all">All halls</option>
            {halls.map((h) => <option key={h} value={h}>Hall {h}</option>)}
          </select>
          <select aria-label="Filter by confirmation" value={confirmFilter} onChange={(e) => setConfirmFilter(e.target.value as ConfirmFilter)} className={selCls}>
            <option value="all">Any confirmation</option>
            <option value="all-confirmed">Fully confirmed</option>
            <option value="some-unconfirmed">Not fully confirmed</option>
            <option value="none-confirmed">Nothing confirmed</option>
            <option value="partial">Partially confirmed</option>
            <option value="any-confirmed">Partial + confirmed</option>
          </select>
          <select aria-label="Filter by email status" value={emailFilter} onChange={(e) => setEmailFilter(e.target.value as EmailFilter)} className={selCls}>
            <option value="all">Emailed or not</option>
            <option value="emailed">Emailed</option>
            <option value="not-emailed">Not emailed</option>
            <option value="today">Emailed today</option>
          </select>
          <select aria-label="Filter by WhatsApp status" value={whatsappFilter} onChange={(e) => setWhatsappFilter(e.target.value as WhatsAppFilter)} className={selCls}>
            <option value="all">WhatsApp: any</option>
            <option value="sent">WhatsApp sent</option>
            <option value="not-sent">WhatsApp not sent</option>
          </select>
          {filtersActive && (
            <Button variant="quiet" onClick={clearFilters}>Clear filters</Button>
          )}
          <p role="status" aria-live="polite" className="tnum ml-auto text-sm text-muted">
            {loading ? 'Loading faculty…' : `Showing ${filteredFaculty.length} of ${faculty.length}`}
          </p>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
          <label className="flex min-h-9 items-center gap-2 font-medium text-ink">
            <input type="checkbox" checked={allShownSelected} disabled={selectable.length === 0} onChange={toggleAllShown} />
            {filtersActive ? `Select all shown (${selectable.length})` : `Select all (${selectable.length})`}
          </label>
          <span role="status" aria-live="polite" className="tnum text-ink-2"><strong className="text-ink">{selected.size}</strong> selected</span>
          {selected.size > 0 && <Button variant="quiet" onClick={() => setSelected(new Set())}>Clear selection</Button>}
          <Button variant="primary" disabled={emailItems.length === 0} onClick={() => setEmailing(true)}>
            <MailIcon /> Email selected…
          </Button>
          <Button disabled={whatsappIds.length === 0} onClick={() => setWhatsapping(whatsappIds)} title="Send the approved WhatsApp reminder to the ticked people who have a phone number">
            <WhatsAppIcon /> WhatsApp selected…
          </Button>
          <Button onClick={() => setPrinting(true)} disabled={filteredFaculty.length === 0} title="Print the list as shown">
            Print list ({filteredFaculty.length})
          </Button>
        </div>

        <div className={`overflow-x-auto ${cardCls}`}>
          <table className="w-full min-w-[760px] table-fixed border-collapse text-left">
            <caption className="sr-only">
              Faculty directory. Select a name to view the profile.
            </caption>
            <thead>
              <tr className={theadRowCls}>
                <th scope="col" className={`${thCls} w-10 px-3`}><span className="sr-only">Select</span></th>
                <th scope="col" className={`${thCls} w-[30%] px-3 lg:px-5`}>Name</th>
                <th scope="col" className={`${thCls} w-[46%] px-3 lg:px-5`}>Roles · session assignments</th>
                <th scope="col" className={`${thCls} w-[20%] px-3 lg:px-5 text-right`}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line" aria-busy={loading}>
              {loading ? (
                <tr>
                  <td className="px-5 py-4" colSpan={4}>
                    <SkeletonLines rows={6} />
                  </td>
                </tr>
              ) : filteredFaculty.length === 0 ? (
                <tr>
                  <td colSpan={4}>
                    <EmptyState
                      title={faculty.length === 0 ? 'No faculty yet' : 'No faculty match'}
                      action={filtersActive ? <Button onClick={clearFilters}>Clear filters</Button> : undefined}
                    >
                      {faculty.length === 0 ? 'Faculty added to the database will be listed here.' : 'Try a different search or assignment count.'}
                    </EmptyState>
                  </td>
                </tr>
              ) : (
                filteredFaculty.map((doc) => {
                  const initials = doc.canonical_name
                    ?.replace('Dr. ', '')
                    .replace('Dr ', '')
                    .split(' ')
                    .map((n: string) => n[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase();
                  const phoneDigits = (doc.phone || '').replace(/[^0-9+]/g, '');
                  const contactRevealed = revealedContacts.has(doc.id);
                  const roleSessions = roleSessionBreakdown(doc);

                  return (
                    <tr
                      key={doc.id}
                      onClick={() => setViewingProfile(doc)}
                      className="cursor-pointer transition-colors hover:bg-slate-50"
                    >
                      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          disabled={(!doc.email && !doc.phone) || assignmentCountOf(doc) === 0}
                          checked={selected.has(doc.id)}
                          onChange={() => toggleSelected(doc.id)}
                          aria-label={`Select ${doc.canonical_name}`}
                        />
                      </td>
                      <td className="px-3 py-2.5 lg:px-5">
                        <div className="flex items-center gap-3">
                          <div
                            aria-hidden="true"
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-tint text-xs font-semibold text-accent"
                          >
                            {initials}
                          </div>
                          <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                            <div className="min-w-0">
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setViewingProfile(doc); }}
                                className="block max-w-full truncate rounded text-left font-medium text-ink hover:text-accent hover:underline"
                                title={doc.canonical_name}
                              >
                                {doc.canonical_name}
                              </button>
                              {doc.email_sent && (
                                <span className="mt-0.5 block text-[11px] leading-4 text-muted">
                                  {istDay(doc.email_sent_date) === today ? 'Emailed today' : `Emailed ${doc.email_sent_date ? new Date(doc.email_sent_date).toLocaleDateString('en-GB') : ''}`}
                                </span>
                              )}
                              {doc.whatsapp_sent && (
                                <span className="mt-0.5 block text-[11px] leading-4 text-muted">WhatsApp sent</span>
                              )}
                              {contactRevealed && (
                                <div className="mt-1 space-y-0.5 text-xs text-ink-2">
                                  {doc.email ? (
                                    <a
                                      href={`mailto:${doc.email}`}
                                      onClick={(e) => e.stopPropagation()}
                                      className="block max-w-[260px] truncate hover:text-accent hover:underline"
                                      title={doc.email}
                                    >
                                      {doc.email}
                                    </a>
                                  ) : (
                                    <span className="block text-muted">No email</span>
                                  )}
                                  {doc.phone ? (
                                    <a
                                      href={`tel:${phoneDigits}`}
                                      onClick={(e) => e.stopPropagation()}
                                      className="tnum block hover:text-accent hover:underline"
                                    >
                                      {doc.phone}
                                    </a>
                                  ) : (
                                    <span className="block text-muted">No phone</span>
                                  )}
                                </div>
                              )}
                            </div>
                            <Button
                              variant="quiet"
                              size="sm"
                              className="h-8 px-2 text-xs"
                              onClick={(e) => { e.stopPropagation(); toggleContact(doc.id); }}
                              aria-expanded={contactRevealed}
                              aria-label={`${contactRevealed ? 'Hide' : 'Show'} contact details for ${doc.canonical_name}`}
                            >
                              {contactRevealed ? 'Hide contact' : 'Show contact'}
                            </Button>
                          </div>
                        </div>
                      </td>

                      <td className="px-3 py-2.5 lg:px-5">
                        {roleSessions.length === 0 ? (
                          <span className="text-sm text-muted">No roles yet</span>
                        ) : (
                          <ul className="flex flex-wrap gap-x-3 gap-y-1.5 py-0.5">
                            {roleSessions.map((x) => {
                              const roleLabel = x.role === 'Moderator'
                                ? 'MOD'
                                : x.role === 'Panelist'
                                  ? 'PANEL'
                                  : x.role === 'Session chair' || x.role === 'Chairperson'
                                    ? 'CHAIR'
                                    : x.role;
                              const assignment = x.role === 'Session chair' ? 'session' : 'lecture';
                              const fullyConfirmed = x.confirmed === x.total;
                              const assignmentDescription = `${x.role} in session ${x.sessionCode}: ${x.total} ${assignment}${x.total === 1 ? '' : 's'}`;
                              return (
                                <li key={`${x.role}-${x.sessionCode}`} className="shrink-0">
                                  <Badge
                                    className="px-2"
                                    tone={roleTone(x.role)}
                                  >
                                    <span
                                      title={assignmentDescription}
                                      aria-label={assignmentDescription}
                                    >
                                      {roleLabel} {x.sessionCode} {x.total}
                                    </span>
                                  </Badge>
                                  {fullyConfirmed ? (
                                    
                                    <span className="mt-0.5 block rounded px-1 py-0.5 text-[14px] font-medium leading-4 text-green-600">
                                    Confirmed
                                    </span>
                                    
                                  ) : doc.email_sent ? (
                                    <span className="mt-0.5 block pl-1 text-[14px] font-medium leading-4 tracking-wide text-yellow-600">
  Emailed
</span>
                                  ) : null}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </td>

                      <td className="px-3 py-2.5 lg:px-5 text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="quiet"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); setPdfFor(doc); }}
                            title={`Generate PDF for ${doc.canonical_name}`}
                            aria-label={`Generate PDF for ${doc.canonical_name}`}
                          >
                            PDF
                          </Button>
                          <Button
                            variant="quiet"
                            size="sm"
                            disabled={!doc.phone}
                            onClick={(e) => { e.stopPropagation(); setWhatsapping([doc.id]); }}
                            title={doc.phone ? `Send the WhatsApp reminder to ${doc.canonical_name}` : `${doc.canonical_name} has no phone number`}
                            aria-label={doc.phone ? `Send WhatsApp reminder to ${doc.canonical_name}` : `No phone number for ${doc.canonical_name}`}
                          >
                            WhatsApp
                          </Button>
                          <Button
                            variant="quiet"
                            size="sm"
                            disabled={!doc.email || thankingId === doc.id}
                            onClick={(e) => { e.stopPropagation(); thankYou(doc); }}
                            title={`Send the thank-you (participation confirmed) email to ${doc.canonical_name}`}
                            aria-label={`Send thank-you to ${doc.canonical_name}`}
                          >
                            {thankingId === doc.id ? 'Sending…' : 'Thank you'}
                          </Button>
                          <Button
                            variant="quiet"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); setEditingFaculty(doc); }}
                            aria-label={`Edit ${doc.canonical_name}`}
                          >
                            Edit
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </PageShell>

      {editingFaculty && (
        <EditFacultyModal
          faculty={editingFaculty}
          onClose={() => setEditingFaculty(null)}
          onSaved={refreshFaculty}
        />
      )}

      {emailing && (
        <SendEmailsDialog
          items={emailItems}
          onClose={() => setEmailing(false)}
          onDone={() => { refreshFaculty(); }}
        />
      )}

      {whatsapping && (
        <SendWhatsAppDialog
          facultyIds={whatsapping}
          onClose={() => setWhatsapping(null)}
          onDone={() => { refreshFaculty(); }}
        />
      )}

      {printing && (
        <FacultyListPrintDialog
          rows={filteredFaculty.map((f) => ({
            name: f.canonical_name,
            email: f.email || '',
            phone: f.phone || '',
            roles: roleSessionBreakdown(f)
              .map((x) => `${x.role === 'Moderator' ? 'MOD' : x.role === 'Panelist' ? 'PANEL' : x.role === 'Session chair' || x.role === 'Chairperson' ? 'CHAIR' : x.role} ${x.sessionCode} (${x.total})`)
              .join(', '),
          }))}
          filterNote={filtersActive ? 'filtered list' : 'all faculty'}
          onClose={() => setPrinting(false)}
        />
      )}

      {pdfFor && (
        <PdfOptionsDialog facultyId={pdfFor.id} name={pdfFor.canonical_name} onClose={() => setPdfFor(null)} />
      )}

      {viewingProfile && (
        <FacultyProfileModal
          faculty={viewingProfile}
          onClose={() => setViewingProfile(null)}
          onChanged={refreshFaculty}
        />
      )}
    </>
  );
}
