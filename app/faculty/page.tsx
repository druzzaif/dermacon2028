'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabase';
import EditFacultyModal from '../components/EditFacultyModal';
import FacultyProfileModal from '../components/FacultyProfileModal';

type CountFilter = 'all' | '0' | '1' | '2' | '3+' | '4+' | '5+';

export default function FacultyDirectoryPage() {
  const [faculty, setFaculty] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  const [editingFaculty, setEditingFaculty] = useState<any | null>(null);
  const [viewingProfile, setViewingProfile] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [countFilter, setCountFilter] = useState<CountFilter>('all');
  const [sortBy, setSortBy] = useState<'name' | 'topics' | 'type'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [sessionCodesByFaculty, setSessionCodesByFaculty] = useState<Record<string, string[]>>({});

  useEffect(() => {
    setIsMounted(true);
    async function fetchFaculty() {
      const { data, error } = await supabase
        .from('faculty')
        .select(`*, faculty_topic_counts ( topic_count )`)
        .order('canonical_name');

      if (error) console.error(error);
      else setFaculty(data || []);

        try {
          const { data: linkRows } = await supabase
            .from('faculty_topics')
            .select(`
              faculty_id,
              session_topics!inner (
                conference_sessions!inner ( session_code )
              )
            `);
          if (linkRows) {
            const grouped: Record<string, Set<string>> = {};
            for (const row of linkRows as any[]) {
              const code = row.session_topics?.conference_sessions?.session_code;
              if (!code) continue;
              if (!grouped[row.faculty_id]) grouped[row.faculty_id] = new Set();
              grouped[row.faculty_id].add(code);
            }
            const normalized: Record<string, string[]> = {};
            for (const fid of Object.keys(grouped)) {
              normalized[fid] = Array.from(grouped[fid]).sort((a, b) =>
                a.localeCompare(b, undefined, { numeric: true })
              );
            }
            setSessionCodesByFaculty(normalized);
          }
        } catch (e) {
          console.warn('Could not load session codes for tooltip', e);
        }
      setLoading(false);
    }
    fetchFaculty();
  }, []);

  async function refreshFaculty() {
    const { data } = await supabase
      .from('faculty')
      .select(`*, faculty_topic_counts ( topic_count )`)
      .order('canonical_name');
    if (data) setFaculty(data);
  }

  const handleViewPDF = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    window.open(`/api/generate-pdf?id=${id}`, '_blank');
  };

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

  const filteredFaculty = useMemo(() => {
    const filtered = faculty.filter((doc) => {
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        !q ||
        doc.canonical_name?.toLowerCase().includes(q) ||
        doc.email?.toLowerCase().includes(q) ||
        doc.faculty_id?.toLowerCase().includes(q) ||
        doc.phone?.toLowerCase().includes(q);
      if (!matchesSearch) return false;
      const topicCount = doc.faculty_topic_counts?.[0]?.topic_count || 0;
      return matchesCount(topicCount, countFilter);
    });

    // Stable client-side sort
    const dir = sortDir === 'asc' ? 1 : -1;
    filtered.sort((a, b) => {
      if (sortBy === 'topics') {
        const ta = a.faculty_topic_counts?.[0]?.topic_count || 0;
        const tb = b.faculty_topic_counts?.[0]?.topic_count || 0;
        if (ta !== tb) return (ta - tb) * dir;
      } else if (sortBy === 'type') {
        const ta = (a.is_faculty ? 1 : 0) + (a.is_coordinator ? 1 : 0);
        const tb = (b.is_faculty ? 1 : 0) + (b.is_coordinator ? 1 : 0);
        if (ta !== tb) return (ta - tb) * dir;
      }
      // Default / tiebreaker: name
      return (a.canonical_name || '').localeCompare(b.canonical_name || '', undefined, {
        numeric: true,
        sensitivity: 'base',
      }) * dir;
    });
    return filtered;
  }, [faculty, searchTerm, countFilter, sortBy, sortDir]);

  if (!isMounted) return null;

  return (
    <div className="min-h-screen bg-white text-slate-800 font-sans">
      <main className="p-8 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Faculty Directory</h1>
            <p className="text-slate-500 mt-1 text-sm">
              Browse, filter, and manage all conference faculty and coordinators.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <input
              type="text"
              placeholder="Search by name, email, or ID..."
              className="w-72 border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <select
              value={countFilter}
              onChange={(e) => setCountFilter(e.target.value as CountFilter)}
              className="border border-slate-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
            >
              <option value="all">All counts</option>
              <option value="0">0 topics</option>
              <option value="1">1 topic</option>
              <option value="2">2 topics</option>
              <option value="3+">3+ topics</option>
              <option value="4+">4+ topics</option>
              <option value="5+">5+ topics</option>
            </select>
            <a
              href="/api/export"
              className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-md font-medium text-sm shadow-sm transition-colors whitespace-nowrap"
            >
              Export to Excel
            </a>
          </div>
        </div>

        <div className="mb-4 text-xs font-medium text-slate-500 uppercase tracking-wider">
          Showing {filteredFaculty.length} of {faculty.length} faculty
        </div>

        <div className="border border-slate-200 rounded-lg shadow-sm overflow-hidden bg-white">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-slate-500 text-xs uppercase tracking-wider">
                <th
                  className="px-6 py-3 font-semibold cursor-pointer select-none hover:text-slate-800"
                  onClick={() => {
                    if (sortBy === 'name') setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                    else { setSortBy('name'); setSortDir('asc'); }
                  }}
                >
                  Doctor {sortBy === 'name' && (sortDir === 'asc' ? '▲' : '▼')}
                </th>
                <th className="px-6 py-3 font-semibold">Contact Info</th>
                <th
                  className="px-6 py-3 font-semibold text-center cursor-pointer select-none hover:text-slate-800"
                  onClick={() => {
                    if (sortBy === 'type') setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                    else { setSortBy('type'); setSortDir('desc'); }
                  }}
                >
                  Type {sortBy === 'type' && (sortDir === 'asc' ? '▲' : '▼')}
                </th>
                <th
                  className="px-6 py-3 font-semibold text-center cursor-pointer select-none hover:text-slate-800"
                  onClick={() => {
                    if (sortBy === 'topics') setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                    else { setSortBy('topics'); setSortDir('desc'); }
                  }}
                >
                  Topics {sortBy === 'topics' && (sortDir === 'asc' ? '▲' : '▼')}
                </th>
                <th className="px-6 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-500 text-sm">
                    Loading directory...
                  </td>
                </tr>
              ) : filteredFaculty.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-slate-500 text-sm">
                    No faculty found matching your filters.
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
                  const topicCount = doc.faculty_topic_counts?.[0]?.topic_count || 0;
                  const phoneDigits = (doc.phone || '').replace(/[^0-9+]/g, '');

                  return (
                    <tr
                      key={doc.id}
                      onClick={() => setViewingProfile(doc)}
                      className={`hover:bg-slate-50 cursor-pointer transition-colors group ${doc.is_active === false ? 'opacity-60' : ''}`}
                    >
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-semibold text-xs shrink-0">
                            {initials}
                          </div>
                          <div>
                            <div className="font-medium text-slate-900 text-sm">
                              {doc.canonical_name}
                            </div>
                            {doc.faculty_id ? (
                              doc.phone ? (
                                <a
                                  href={`tel:${phoneDigits}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-xs text-slate-500 hover:text-blue-600 font-mono mt-0.5 inline-block transition-colors"
                                >
                                  {doc.faculty_id}
                                </a>
                              ) : (
                                <div className="text-xs text-slate-400 font-mono mt-0.5">
                                  {doc.faculty_id}
                                </div>
                              )
                            ) : null}
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-3">
                        {doc.email ? (
                          <a
                            href={`mailto:${doc.email}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-sm text-slate-700 hover:text-blue-600 transition-colors block truncate max-w-[240px]"
                            title={doc.email}
                          >
                            {doc.email}
                          </a>
                        ) : (
                          <div className="text-sm text-slate-400">--</div>
                        )}
                        {doc.phone && {doc.phone && (
                          <a
                            href={	el:}
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs text-slate-500 hover:text-blue-600 mt-0.5 inline-block transition-colors"
                            title="Call"
                          >
                            {doc.phone}
                          </a>
                        )}}
                      </td>

                      <td className="px-6 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          {doc.is_faculty && (
                            <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide">
                              Faculty
                            </span>
                          )}
                          {doc.is_coordinator && (
                            <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide">
                              Coordinator
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-3 text-center">
                        <div className={`inline-flex items-center justify-center w-7 h-7 rounded-md font-semibold text-xs ${
                          topicCount > 0 ? 'bg-slate-100 text-slate-700' : 'bg-slate-50 text-slate-400'
                        }`}>
                          {topicCount}
                        </div>
                      </td>

                      <td className="px-6 py-3 text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditingFaculty(doc); }}
                            className="text-xs font-medium text-slate-500 hover:text-blue-600 px-2 py-1 rounded transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={(e) => handleViewPDF(doc.id, e)}
                            className="text-xs font-medium text-slate-500 hover:text-blue-600 px-2 py-1 rounded transition-colors"
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
