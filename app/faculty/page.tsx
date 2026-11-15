'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabase';
import dynamic from 'next/dynamic';
// Modals load only when opened
const EditFacultyModal = dynamic(() => import('../components/EditFacultyModal'));
const FacultyProfileModal = dynamic(() => import('../components/FacultyProfileModal'));
import Badge, { roleTone } from '../components/Badge';
import SyncButton from '../components/SyncButton';
import { DownloadIcon, SearchIcon } from '../components/Icons';
import { Button, EmptyState, PageHeader, PageShell, SkeletonLines, buttonCls, cardCls, thCls, theadRowCls } from '../components/ui';
import { inputCls } from '../components/Field';
import { roleName } from '../lib/topicPeople';
import { SHARED_VENUE_MAP_PATH } from '../lib/venueRooms.mjs';

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

export default function FacultyDirectoryPage() {
  const [faculty, setFaculty] = useState<FacultyRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingFaculty, setEditingFaculty] = useState<FacultyRow | null>(null);
  const [viewingProfile, setViewingProfile] = useState<FacultyRow | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [countFilter, setCountFilter] = useState<CountFilter>('all');
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

  // One PDF per faculty, one page per session
  const handleViewPDF = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(`/api/generate-pdf?id=${id}`, '_blank');
  };

  const filteredFaculty = useMemo(() => {
    return faculty.filter((doc) => {
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        !q ||
        doc.canonical_name?.toLowerCase().includes(q) ||
        doc.email?.toLowerCase().includes(q);
      if (!matchesSearch) return false;
      return matchesCount(assignmentCountOf(doc), countFilter);
    });
  }, [faculty, searchTerm, countFilter]);

  const filtersActive = Boolean(searchTerm.trim()) || countFilter !== 'all';
  function clearFilters() {
    setSearchTerm('');
    setCountFilter('all');
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

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[16rem] flex-1 sm:max-w-md">
            <label htmlFor="faculty-search" className="sr-only">
              Search faculty by name or email
            </label>
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              id="faculty-search"
              type="search"
              placeholder="Search name or email"
              className={`${inputCls} pl-9`}
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
              className={`${inputCls} w-auto pr-8`}
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
          {filtersActive && (
            <Button variant="quiet" onClick={clearFilters}>Clear filters</Button>
          )}
          <p role="status" aria-live="polite" className="tnum ml-auto text-sm text-muted">
            {loading ? 'Loading faculty…' : `Showing ${filteredFaculty.length} of ${faculty.length}`}
          </p>
        </div>

        <div className={`overflow-x-auto ${cardCls}`}>
          <table className="w-full min-w-[760px] border-collapse text-left">
            <caption className="sr-only">
              Faculty directory. Select a name to view the profile.
            </caption>
            <thead>
              <tr className={theadRowCls}>
                <th scope="col" className={`${thCls} w-[35%] px-3 lg:px-5`}>Name</th>
                <th scope="col" className={`${thCls} w-[47%] px-3 lg:px-5`}>Roles · session assignments</th>
                <th scope="col" className={`${thCls} w-[18%] px-3 lg:px-5 text-right`}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line" aria-busy={loading}>
              {loading ? (
                <tr>
                  <td className="px-5 py-4" colSpan={3}>
                    <SkeletonLines rows={6} />
                  </td>
                </tr>
              ) : filteredFaculty.length === 0 ? (
                <tr>
                  <td colSpan={3}>
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
                                className="whitespace-nowrap rounded text-left font-medium text-ink hover:text-accent hover:underline"
                                title={doc.canonical_name}
                              >
                                {doc.canonical_name}
                              </button>
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
                          <ul className="flex flex-nowrap gap-3 overflow-x-auto py-0.5">
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
                                  {fullyConfirmed && (
                                    <span className="mt-0.5 block pl-1 text-[11px] leading-4 text-emerald-700">
                                      Confirmed
                                    </span>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </td>

                      <td className="px-3 py-2.5 lg:px-5 text-right">
                        <div className="flex justify-end gap-1">
                          <a
                            href={SHARED_VENUE_MAP_PATH}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className={buttonCls('quiet', 'sm')}
                            title="Open shared venue map"
                            aria-label="Open shared venue map"
                          >
                            Map
                          </a>
                          <Button
                            variant="quiet"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); setEditingFaculty(doc); }}
                            aria-label={`Edit ${doc.canonical_name}`}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="quiet"
                            size="sm"
                            onClick={(e) => handleViewPDF(doc.id, e)}
                            aria-label={`Open PDF for ${doc.canonical_name}`}
                          >
                            PDF
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
