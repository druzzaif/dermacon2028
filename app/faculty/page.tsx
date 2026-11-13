'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabase';
import dynamic from 'next/dynamic';
// Modals load only when opened
const EditFacultyModal = dynamic(() => import('../components/EditFacultyModal'));
const FacultyProfileModal = dynamic(() => import('../components/FacultyProfileModal'));
import Badge from '../components/Badge';
import SyncButton from '../components/SyncButton';
import { CheckIcon, DownloadIcon, SearchIcon } from '../components/Icons';
import { Button, EmptyState, PageHeader, PageShell, SkeletonLines, buttonCls, cardCls, thCls, theadRowCls } from '../components/ui';
import { inputCls } from '../components/Field';
import { roleName } from '../lib/topicPeople';

type CountFilter = 'all' | '0' | '1' | '2' | '3+' | '4+' | '5+';

const FACULTY_SELECT = `*, faculty_topics ( role, confirmed ), session_chairs ( confirmed )`;

// How many topics this person has in each role, and how many of those are confirmed
const ROLE_ORDER = ['Faculty', 'Moderator', 'Panelist', 'Debater', 'Chairperson', 'Session chair'];
function roleBreakdown(doc: any): { role: string; total: number; confirmed: number }[] {
  const m = new Map<string, { role: string; total: number; confirmed: number }>();
  for (const ft of doc.faculty_topics || []) {
    const role = roleName(ft.role);
    const e = m.get(role) || { role, total: 0, confirmed: 0 };
    e.total += 1;
    if (ft.confirmed) e.confirmed += 1;
    m.set(role, e);
  }
  // Chairing a whole session
  for (const c of doc.session_chairs || []) {
    const e = m.get('Session chair') || { role: 'Session chair', total: 0, confirmed: 0 };
    e.total += 1;
    if (c.confirmed) e.confirmed += 1;
    m.set('Session chair', e);
  }
  return [...m.values()].sort((a, b) =>
    (ROLE_ORDER.indexOf(a.role) === -1 ? 99 : ROLE_ORDER.indexOf(a.role)) - (ROLE_ORDER.indexOf(b.role) === -1 ? 99 : ROLE_ORDER.indexOf(b.role)));
}

// Every assignment counts: speaker, moderator, panelist and chairperson
function topicCountOf(doc: any): number {
  return (doc.faculty_topics?.length ?? 0) + (doc.session_chairs?.length ?? 0);
}

function matchesCount(topicCount: number, filter: CountFilter): boolean {
  switch (filter) {
    case 'all': return true;
    case '0': return topicCount === 0;
    case '1': return topicCount === 1;
    case '2': return topicCount === 2;
    case '3+': return topicCount >= 3;
    case '4+': return topicCount >= 4;
    case '5+': return topicCount >= 5;
  }
}

export default function FacultyDirectoryPage() {
  const [faculty, setFaculty] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingFaculty, setEditingFaculty] = useState<any | null>(null);
  const [viewingProfile, setViewingProfile] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [countFilter, setCountFilter] = useState<CountFilter>('all');
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
        doc.email?.toLowerCase().includes(q) ||
        doc.faculty_id?.toLowerCase().includes(q);
      if (!matchesSearch) return false;
      const topicCount = topicCountOf(doc);
      return matchesCount(topicCount, countFilter);
    });
  }, [faculty, searchTerm, countFilter]);

  const filtersActive = Boolean(searchTerm.trim()) || countFilter !== 'all';
  function clearFilters() {
    setSearchTerm('');
    setCountFilter('all');
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
              <a href="/api/export" className={buttonCls('secondary')}>
                <DownloadIcon /> Export to Excel
              </a>
            </>
          }
        />

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[16rem] flex-1 sm:max-w-md">
            <label htmlFor="faculty-search" className="sr-only">
              Search faculty by name, email or ID
            </label>
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              id="faculty-search"
              type="search"
              placeholder="Search name, email or ID"
              className={`${inputCls} pl-9`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="faculty-count" className="sr-only">
              Filter by number of topics
            </label>
            <select
              id="faculty-count"
              value={countFilter}
              onChange={(e) => setCountFilter(e.target.value as CountFilter)}
              className={`${inputCls} w-auto pr-8`}
            >
              <option value="all">All topic counts</option>
              <option value="0">0 topics</option>
              <option value="1">1 topic</option>
              <option value="2">2 topics</option>
              <option value="3+">3+ topics</option>
              <option value="4+">4+ topics</option>
              <option value="5+">5+ topics</option>
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
          <table className="w-full min-w-[600px] border-collapse text-left">
            <caption className="sr-only">
              Faculty directory. Select a name to view the profile.
            </caption>
            <thead>
              <tr className={theadRowCls}>
                <th scope="col" className={`${thCls} px-3 lg:px-5`}>Name</th>
                <th scope="col" className={`${thCls} px-3 lg:px-5`}>Email</th>
                <th scope="col" className={`${thCls} hidden px-5 lg:table-cell`}>Phone</th>
                <th scope="col" className={`${thCls} px-3 lg:px-5 text-center`}>Topics</th>
                <th scope="col" className={`${thCls} px-3 lg:px-5`}>Roles · confirmed</th>
                <th scope="col" className={`${thCls} px-3 lg:px-5 text-right`}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line" aria-busy={loading}>
              {loading ? (
                <tr>
                  <td className="px-5 py-4" colSpan={6}>
                    <SkeletonLines rows={6} />
                  </td>
                </tr>
              ) : filteredFaculty.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      title={faculty.length === 0 ? 'No faculty yet' : 'No faculty match'}
                      action={filtersActive ? <Button onClick={clearFilters}>Clear filters</Button> : undefined}
                    >
                      {faculty.length === 0 ? 'Faculty added to the database will be listed here.' : 'Try a different search or topic count.'}
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
                  const topicCount = topicCountOf(doc);
                  const phoneDigits = (doc.phone || '').replace(/[^0-9+]/g, '');
                  const confirmedCount = [...(doc.faculty_topics || []), ...(doc.session_chairs || [])].filter((ft: any) => ft.confirmed).length;
                  const allConfirmed = topicCount > 0 && confirmedCount === topicCount;
                  const partlyConfirmed = confirmedCount > 0 && !allConfirmed;

                  return (
                    <tr
                      key={doc.id}
                      onClick={() => setViewingProfile(doc)}
                      className="cursor-pointer transition-colors hover:bg-slate-50"
                    >
                      <td className="px-3 py-2.5 lg:px-5">
                        <div className="flex items-center gap-3 whitespace-nowrap">
                          <div
                            aria-hidden="true"
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-tint text-xs font-semibold text-accent"
                          >
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setViewingProfile(doc); }}
                                className="rounded text-left font-medium text-ink hover:text-accent hover:underline"
                              >
                                {doc.canonical_name}
                              </button>
                              {allConfirmed && (
                                <Badge tone="success">
                                  <CheckIcon width={12} height={12} strokeWidth={3} />
                                  Confirmed
                                </Badge>
                              )}
                              {partlyConfirmed && (
                                <Badge tone="warning">
                                  {confirmedCount}/{topicCount} topics confirmed
                                </Badge>
                              )}
                            </div>
                            {doc.faculty_id && (
                              <div className="tnum mt-0.5 font-mono text-xs text-muted">{doc.faculty_id}</div>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-3 py-2.5 lg:px-5">
                        {doc.email ? (
                          <a
                            href={`mailto:${doc.email}`}
                            onClick={(e) => e.stopPropagation()}
                            className="block max-w-[180px] truncate xl:max-w-[240px] text-sm text-ink-2 hover:text-accent hover:underline"
                            title={doc.email}
                          >
                            {doc.email}
                          </a>
                        ) : (
                          <span className="text-sm text-muted">No email</span>
                        )}
                      </td>

                      <td className="hidden px-3 py-2.5 lg:px-5 lg:table-cell">
                        {doc.phone ? (
                          <a
                            href={`tel:${phoneDigits}`}
                            onClick={(e) => e.stopPropagation()}
                            className="tnum text-sm text-ink-2 hover:text-accent hover:underline"
                          >
                            {doc.phone}
                          </a>
                        ) : (
                          <span className="text-sm text-muted">Not set</span>
                        )}
                      </td>

                      <td className="px-3 py-2.5 lg:px-5 text-center">
                        <span
                          className={`tnum inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-sm font-semibold ${
                            topicCount > 0 ? 'bg-slate-100 text-ink' : 'text-muted'
                          }`}
                        >
                          {topicCount}
                          <span className="sr-only"> {topicCount === 1 ? 'topic' : 'topics'}</span>
                        </span>
                      </td>

                      <td className="px-3 py-2.5 lg:px-5">
                        {roleBreakdown(doc).length === 0 ? (
                          <span className="text-sm text-muted">No roles yet</span>
                        ) : (
                          <ul className="flex flex-wrap gap-1.5">
                            {roleBreakdown(doc).map((x) => (
                              <li key={x.role}>
                                <Badge
                                  tone={x.confirmed === x.total ? 'success' : x.confirmed > 0 ? 'warning' : 'neutral'}
                                >
                                  <span title={`${x.confirmed} of ${x.total} confirmed as ${x.role}`}>
                                    {x.role} {x.confirmed}/{x.total}
                                  </span>
                                </Badge>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>

                      <td className="px-3 py-2.5 lg:px-5 text-right">
                        <div className="flex justify-end gap-1">
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
