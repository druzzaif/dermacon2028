'use client';

import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import EditFacultyModal from './components/EditFacultyModal';
import FacultyProfileModal from './components/FacultyProfileModal';

export default function Dashboard() {
  const [faculty, setFaculty] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);
  
  const [editingFaculty, setEditingFaculty] = useState<any | null>(null);
  const [viewingProfile, setViewingProfile] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

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
    // Just open the API route in a new tab
    window.open(`/api/generate-pdf?id=${id}`, '_blank');
  };

  const filteredFaculty = faculty.filter(doc => 
    doc.canonical_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.faculty_id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isMounted) return null;

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900 font-sans">
      <aside className="w-72 bg-white border-r border-gray-200 flex flex-col shrink-0">
        <div className="h-20 flex items-center px-8 border-b border-gray-200 bg-gray-800">
          <span className="text-2xl font-bold text-white tracking-wide">DERMACON 2028</span>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <a href="/" className="block px-4 py-3 bg-blue-50 text-blue-700 rounded-lg font-bold text-lg">Faculty</a>
          <a href="/sessions" className="block px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-lg font-medium text-lg">Master Schedule</a>
          <a href="/overlaps" className="block px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg font-medium text-lg">Overlaps</a>
        </nav>
      </aside>

      <main className="flex-1 p-8 md:p-10 overflow-y-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Faculty Directory</h1>
            <p className="text-gray-500 mt-1 text-base">Click any doctor to view their full profile and schedule.</p>
          </div>
          
          <div className="flex items-center gap-4">
            <input 
              type="text" 
              placeholder="Search by name, email, or ID..." 
              className="w-80 border border-gray-300 rounded-lg px-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
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
                <tr><td colSpan={5} className="text-center py-12 text-gray-500 text-lg">Loading directory...</td></tr>
              ) : filteredFaculty.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12 text-gray-500 text-lg">No faculty found matching "{searchTerm}"</td></tr>
              ) : (
                filteredFaculty.map((doc) => {
                  const initials = doc.canonical_name?.replace('Dr. ', '').replace('Dr ', '').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
                  const topicCount = doc.faculty_topic_counts?.[0]?.topic_count || 0;

                  return (
                    <tr 
                      key={doc.id} 
                      onClick={() => setViewingProfile(doc)}
                      className="hover:bg-blue-50/50 cursor-pointer transition-colors group"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs shadow-sm shrink-0 ${doc.is_active ? 'bg-gradient-to-br from-blue-500 to-blue-700 text-white' : 'bg-gray-200 text-gray-500'}`}>
                            {initials}
                          </div>
                          <div>
                            <div className="font-bold text-gray-900 text-base">{doc.canonical_name}</div>
                            <div className="text-xs text-gray-500 font-mono mt-0.5">{doc.faculty_id}</div>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-800">{doc.email}</div>
                        {doc.phone && <div className="text-xs text-gray-500 mt-1">{doc.phone}</div>}
                      </td>

                      <td className="px-6 py-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          {doc.is_faculty && <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase border border-blue-200">Faculty</span>}
                          {doc.is_coordinator && <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase border border-purple-200">Coordinator</span>}
                        </div>
                      </td>

                      <td className="px-6 py-4 text-center">
                        <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm border ${topicCount > 0 ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>
                          {topicCount}
                        </div>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditingFaculty(doc); }}
                            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit Faculty"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={(e) => handleViewPDF(doc.id, e)}
                            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="View PDF"
                          >
                            📄
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
