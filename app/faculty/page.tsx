'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabase';
import EditFacultyModal from '../components/EditFacultyModal';
import FacultyProfileModal from '../components/FacultyProfileModal';
import Badge from '../components/Badge';
import SyncButton from '../components/SyncButton';
import { CheckIcon, SearchIcon } from '../components/Icons';
import { inputCls } from '../components/Field';

type CountFilter = 'all' | '0' | '1' | '2' | '3+' | '4+' | '5+';

const FACULTY_SELECT = `*, faculty_topic_counts ( topic_count ), faculty_topics ( confirmed )`;

// Every assignment counts: speaker, moderator, panelist and chairperson
function topicCountOf(doc: any): number {
  return doc.faculty_topics?.length ?? doc.faculty_topic_counts?.[0]?.topic_count ?? 0;
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

  // Row actions stay visible on touch and when anything in the row has keyboard focus
  const actionBtn =
    'inline-flex h-11 items-center rounded-lg px-3 text-sm font-medium text-ink-2 transition-colors hover:bg-accent-tint hover:text-accent';

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-canvas text-ink">
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-7xl p-4 outline-none sm:p-8">
        <div className="mb-8 flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <h1 className="text-3xl font-semibold text-ink">Faculty directory</h1>
            <p className="mt-1.5 max-w-prose text-ink-2">
              Browse, filter and manage everyone speaking or coordinating at the conference.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <SyncButton onSynced={refreshFaculty} />
            <div className="relative">
              <label htmlFor="faculty-search" className="sr-only">
                Search faculty by name, email or ID
              </label>
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                id="faculty-search"
                type="search"
                placeholder="Search name, email or ID"
                className={`${inputCls} w-full pl-9 sm:w-72`}
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
            <a
              href="/api/export"
              className="inline-flex h-11 items-center whitespace-nowrap rounded-lg bg-accent px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-accent-strong"
            >
              Export to Excel
            </a>
          </div>
        </div>

        <p role="status" aria-live="polite" className="tnum mb-3 text-sm text-muted">
          {loading ? 'Loading faculty…' : `Showing ${filteredFaculty.length} of ${faculty.length} faculty`}
        </p>

        <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-card">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <caption className="sr-only">
              Faculty directory. Select a name to view the profile.
            </caption>
            <thead>
              <tr className="border-b border-line bg-slate-50/70 text-xs text-muted">
                <th scope="col" className="px-5 py-3 font-semibold">Doctor</th>
                <th scope="col" className="px-5 py-3 font-semibold">Email</th>
                <th scope="col" className="hidden px-5 py-3 font-semibold lg:table-cell">Phone</th>
                <th scope="col" className="px-5 py-3 text-center font-semibold">Topics</th>
                <th scope="col" className="px-5 py-3 text-right font-semibold">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line" aria-busy={loading}>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} aria-hidden="true">
                    <td className="px-5 py-4" colSpan={5}>
                      <div className="h-6 animate-pulse rounded-md bg-slate-100" />
                    </td>
                  </tr>
                ))
              ) : filteredFaculty.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-14 text-center text-ink-2">
                    No faculty match these filters.
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
                  const confirmedCount = (doc.faculty_topics || []).filter((ft: any) => ft.confirmed).length;
                  const allConfirmed = topicCount > 0 && confirmedCount === topicCount;
                  const partlyConfirmed = confirmedCount > 0 && !allConfirmed;

                  return (
                    <tr
                      key={doc.id}
                      onClick={() => setViewingProfile(doc)}
                      className="group cursor-pointer transition-colors hover:bg-slate-50/80"
                    >
                      <td className="px-5 py-2.5">
                        <div className="flex items-center gap-3">
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

                      <td className="px-5 py-2.5">
                        {doc.email ? (
                          <a
                            href={`mailto:${doc.email}`}
                            onClick={(e) => e.stopPropagation()}
                            className="block max-w-[240px] truncate text-sm text-ink-2 hover:text-accent hover:underline"
                            title={doc.email}
                          >
                            {doc.email}
                          </a>
                        ) : (
                          <span className="text-sm text-muted">
                            <span aria-hidden="true">–</span>
                            <span className="sr-only">No email</span>
                          </span>
                        )}
                      </td>

                      <td className="hidden px-5 py-2.5 lg:table-cell">
                        {doc.phone ? (
                          <a
                            href={`tel:${phoneDigits}`}
                            onClick={(e) => e.stopPropagation()}
                            className="tnum text-sm text-ink-2 hover:text-accent hover:underline"
                          >
                            {doc.phone}
                          </a>
                        ) : (
                          <span className="text-sm text-muted">
                            <span aria-hidden="true">–</span>
                            <span className="sr-only">No phone</span>
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-2.5 text-center">
                        <span
                          className={`tnum inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-sm font-semibold ${
                            topicCount > 0 ? 'bg-slate-100 text-ink' : 'text-muted'
                          }`}
                        >
                          {topicCount}
                          <span className="sr-only"> {topicCount === 1 ? 'topic' : 'topics'}</span>
                        </span>
                      </td>

                      <td className="px-5 py-2.5 text-right">
                        <div className="flex justify-end gap-1 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:transition-opacity [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setEditingFaculty(doc); }}
                            aria-label={`Edit ${doc.canonical_name}`}
                            className={actionBtn}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleViewPDF(doc.id, e)}
                            aria-label={`Open PDF for ${doc.canonical_name}`}
                            className={actionBtn}
                          >
                            PDF
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </main>

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
        />
      )}
    </div>
  );
}
