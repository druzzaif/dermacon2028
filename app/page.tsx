'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';
import EditFacultyModal from './components/EditFacultyModal';
import FacultyProfileModal from './components/FacultyProfileModal';

type CountFilter = 'all' | '0' | '1' | '2' | '3+' | '4+' | '5+';

export default function Dashboard() {
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
      case 'all':
        return true;
      case '0':
        return topicCount === 0;
      case '1':
        return topicCount === 1;
      case '2':
        return topicCount === 2;
      case '3+':
        return topicCount >= 3;
      case '4+':
        return topicCount >= 4;
      case '5+':
        return topicCount >= 5;
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
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      <main className="p-8 md:p-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Faculty Directory</h1>
            <p className="text-gray-500 mt-1 text-base">
              Click any doctor to view their full profile and schedule.
            </p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <input
              type="text"
              placeholder="Search by name, email, or ID..."
              className="w-72 border border-gray-300 rounded-lg px-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <select
              value={countFilter}
              onChange={(e) => setCountFilter(e.target.value as CountFilter)}
              className="border border-gray-300 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
              title="Filter by number of topics"
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
              className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg font-bold text-base shadow-sm transition-colors flex items-center gap-2 whitespace-nowrap"
            >
              Export to Excel
            </a>
          </div>
        </div>

        <div className="mb-4 text-sm text-gray-500">
          Showing <span className="font-semibold text-gray-700">{filteredFaculty.length}</span> of{' '}
          {faculty.length} faculty
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-gray-600 text-sm uppercase tracking-wider">
                <th className="px-6 py-4 font-bold">Doctor</th>
                <th className="px-6 py-4 font-bold">Contact Info</th>
                <th className="px-6 py-4 font-bold text-center">Type</th>
                <th className="px-6 py-4 font-bold text-center">Topics</th>
                <th className="px-6 py-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-gray-500 text-lg">
                    Loading directory...
                  </td>
                </tr>
              ) : filteredFaculty.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-gray-500 text-lg">
                    No faculty found matching "{searchTerm || countFilter}"
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
                      className="hover:bg-blue-50/50 cursor-pointer transition-colors group"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div
                            className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs shadow-sm shrink-0 ${
                              doc.is_active
                                ? 'bg-gradient-to-br from-blue-500 to-blue-700 text-white'
                                : 'bg-gray-200 text-gray-500'
                            }`}
                          >
                            {initials}
                          </div>
                          <div>
                            <div className="font-bold text-gray-900 text-base">
                              {doc.canonical_name}
                            </div>
                            {doc.faculty_id ? (
                              doc.phone ? (
                                <a
                                  href={`tel:${phoneDigits}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-xs text-blue-600 hover:text-blue-800 hover:underline font-mono mt-0.5 inline-block"
                                  title={`Call ${doc.phone}`}
                                >
                                  {doc.faculty_id}
                                </a>
                              ) : (
                                <div className="text-xs text-gray-500 font-mono mt-0.5">
                                  {doc.faculty_id}
                                </div>
                              )
                            ) : null}
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        {doc.email ? (
                          <a
                            href={`mailto:${doc.email}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-sm text-blue-600 hover:text-blue-800 hover:underline block truncate max-w-[240px]"
                            title={doc.email}
                          >
                            {doc.email}
                          </a>
                        ) : (
                          <div className="text-sm text-gray-400">--</div>
                        )}
                        {doc.phone && <div className="text-xs text-gray-500 mt-1">{doc.phone}</div>}
                      </td>

                      <td className="px-6 py-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          {doc.is_faculty && (
                            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase border border-blue-200">
                              Faculty
                            </span>
                          )}
                          {doc.is_coordinator && (
                            <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase border border-purple-200">
                              Coordinator
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4 text-center">
                        <div
                          className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm border ${
                            topicCount > 0
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-gray-50 text-gray-400 border-gray-200'
                          }`}
                        >
                          {topicCount}
                        </div>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingFaculty(doc);
                            }}
                            className="px-3 py-1.5 text-xs font-semibold text-gray-600 hover:text-blue-700 hover:bg-blue-50 border border-gray-200 rounded transition-colors"
                            title="Edit Faculty"
                          >
                            Edit
                          </button>
                          <button
                            onClick={(e) => handleViewPDF(doc.id, e)}
                            className="px-3 py-1.5 text-xs font-semibold text-gray-600 hover:text-red-700 hover:bg-red-50 border border-gray-200 rounded transition-colors"
                            title="View PDF"
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
