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

  useEffect(() => {
    setIsMounted(true);
    async function fetchFaculty() {
      const { data, error } = await supabase
        .from('faculty')
        .select(`*, faculty_topic_counts ( topic_count )`)
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
    return faculty.filter((doc) => {
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        !q ||
        doc.canonical_name?.toLowerCase().includes(q) ||
        doc.email?.toLowerCase().includes(q) ||
        doc.faculty_id?.toLowerCase().includes(q);
      if (!matchesSearch) return false;
      const topicCount = doc.faculty_topic_counts?.[0]?.topic_count || 0;
      return matchesCount(topicCount, countFilter);
    });
  }, [faculty, searchTerm, countFilter]);

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
                <th className="px-6 py-3 font-semibold">Doctor</th>
                <th className="px-6 py-3 font-semibold">Email</th>
                <th className="px-6 py-3 font-semibold">Phone</th>
                
                <th className="px-6 py-3 font-semibold text-center">Topics</th>
                <th className="px-6 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-500 text-sm">
                    Loading directory...
                  </td>
                </tr>
              ) : filteredFaculty.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-500 text-sm">
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
                      className="hover:bg-slate-50 cursor-pointer transition-colors group"
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
                      </td>

                      <td className="px-6 py-3">
                        {doc.phone ? (
                          <div className="text-sm text-slate-700">{doc.phone}</div>
                        ) : (
                          <div className="text-sm text-slate-400">--</div>
                        )}
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
