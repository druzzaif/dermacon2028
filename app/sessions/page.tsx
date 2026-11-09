'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import EditSessionModal from '../components/EditSessionModal';
import AddTopicModal from '../components/AddTopicModal';
import EditCoordinatorsModal from '../components/EditCoordinatorsModal';
import { useSearchParams } from 'next/navigation';

export default function SessionsPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSession, setSelectedSession] = useState<any | null>(null);
  const [coordinators, setCoordinators] = useState<any[]>([]);
  const [topics, setTopics] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isEditingSession, setIsEditingSession] = useState(false);
  const [isAddingTopic, setIsAddingTopic] = useState(false);
  const [isEditingCoordinators, setIsEditingCoordinators] = useState(false);

  const searchParams = useSearchParams();
  const targetCode = searchParams.get('code');

  useEffect(() => {
    async function fetchSessions() {
      const { data } = await supabase
        .from('conference_sessions')
        .select('*')
        .order('session_date', { ascending: true })
        .order('start_time', { ascending: true });
      
      if (data) {
        setSessions(data);
        if (targetCode) {
          const found = data.find(s => s.session_code === targetCode);
          if (found) setSelectedSession(found);
          else if (data.length > 0) setSelectedSession(data[0]);
        } else if (data.length > 0) {
          setSelectedSession(data[0]);
        }
      }
      setLoading(false);
    }
    fetchSessions();
  }, [targetCode]);

  useEffect(() => {
    if (!selectedSession) return;

    async function fetchDetails() {
      setLoadingDetails(true);

      const { data: coordData } = await supabase
        .from('session_coordinators')
        .select(`role, faculty_id, faculty ( id, canonical_name, phone )`)
        .eq('session_id', selectedSession.id);
      
      if (coordData) {
        const rolePriority: Record<string, number> = { 'National': 1, 'Lead Coordinator': 2, 'Local': 3 };
        const sortedCoords = coordData.sort((a, b) => (rolePriority[a.role] || 99) - (rolePriority[b.role] || 99));
        setCoordinators(sortedCoords);
      }

      const { data: topicData } = await supabase
        .from('session_topics')
        .select(`
          id, topic_title, start_time, end_time, sequence_no,
          faculty_topics ( role, faculty ( canonical_name, phone, email ) )
        `)
        .eq('session_id', selectedSession.id)
        .order('sequence_no', { ascending: true });

      if (topicData) setTopics(topicData);
      setLoadingDetails(false);
    }
    fetchDetails();
  }, [selectedSession]);

  const filteredSessions = sessions.filter(s => 
    s.session_code?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.session_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="h-screen flex items-center justify-center bg-gray-50 text-gray-500 text-xl">Loading Master Schedule...</div>;

  return (
    <div className="flex h-screen bg-gray-100 text-gray-900 font-sans overflow-hidden">
      
      <aside className="w-80 bg-white border-r border-gray-200 flex flex-col shrink-0">
        <div className="p-5 border-b border-gray-200 bg-gray-800 text-white">
          <h1 className="text-xl font-bold tracking-wide">DERMACON 2028</h1>
          <p className="text-sm text-gray-300 mt-1">Master Schedule</p>
        </div>
        
        <div className="flex gap-4 p-4 bg-gray-50 border-b border-gray-200 text-sm font-semibold">
          <a href="/" className="text-gray-600 hover:text-blue-600">Faculty</a>
          <a href="/sessions" className="text-blue-600">Sessions</a>
          <a href="/overlaps" className="text-red-600 hover:text-red-700">Overlaps</a>
        </div>

        <div className="p-4 border-b border-gray-200">
          <input 
            type="text" 
            placeholder="Search sessions..." 
            className="w-full border border-gray-300 rounded-lg px-4 py-2 text-base focus:outline-none focus:border-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredSessions.map(s => (
            <button
              key={s.id}
              onClick={() => setSelectedSession(s)}
              className={`w-full text-left px-5 py-4 border-b border-gray-100 transition-colors flex flex-col ${
                selectedSession?.id === s.id ? 'bg-blue-50 border-l-4 border-blue-600' : 'hover:bg-gray-50'
              }`}
            >
              <span className="font-bold text-blue-800 text-base">{s.session_code}</span>
              <span className="text-base font-medium text-gray-800 truncate">{s.session_name}</span>
              <span className="text-sm text-gray-500 mt-1">{s.session_date}</span>
            </button>
          ))}
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-full overflow-hidden bg-gray-50 relative">
        {selectedSession ? (
          <>
            <div className="bg-white border-b border-gray-200 p-8 shrink-0 shadow-sm z-10">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-4xl font-bold text-gray-900 flex items-center gap-4">
                    {selectedSession.session_code} 
                    <span className="text-2xl font-normal text-gray-600 border-l-2 border-gray-300 pl-4">{selectedSession.session_name}</span>
                  </h2>
                  <div className="flex gap-8 mt-4 text-base text-gray-700">
                    <span><strong className="text-gray-900">Date:</strong> {selectedSession.session_date}</span>
                    <span><strong className="text-gray-900">Time:</strong> {selectedSession.start_time?.slice(0,5)} - {selectedSession.end_time?.slice(0,5)}</span>
                    <span><strong className="text-gray-900">Hall:</strong> {selectedSession.hall || 'TBD'}</span>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setIsEditingSession(true)} 
                    className="px-5 py-2.5 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 shadow-sm"
                  >
                    Edit Session
                  </button>
                  <button 
                    onClick={() => setIsAddingTopic(true)}
                    className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm"
                  >
                    + Add Topic
                  </button>
                </div>
              </div>

              {/* COMPACT COORDINATORS SECTION */}
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-100 flex items-center gap-4">
                <h3 className="text-xs font-bold text-blue-900 uppercase tracking-wider shrink-0 mt-0.5">Coordinators</h3>
                
                <div className="flex gap-2 flex-wrap flex-1">
                  {coordinators.length === 0 ? (
                    <span className="text-sm text-gray-500 italic">No coordinators assigned.</span>
                  ) : (
                    coordinators.map((c, i) => (
                      <div key={i} className="bg-white px-2 py-1 rounded border border-blue-200 flex items-center gap-1.5 shadow-sm">
                        <span className="font-semibold text-gray-900 text-xs">{c.faculty?.canonical_name}</span>
                        <span className="text-[9px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded uppercase">{c.role}</span>
                      </div>
                    ))
                  )}
                </div>

                <button 
                  onClick={() => setIsEditingCoordinators(true)} 
                  className="ml-auto text-xs text-blue-600 hover:text-blue-800 font-bold px-3 py-1.5 bg-white border border-blue-200 rounded shadow-sm shrink-0"
                >
                  Edit Coordinators
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-8">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full text-left border-collapse min-w-[1100px]">
                  <thead>
                    <tr className="bg-gray-100 border-b border-gray-300 text-gray-800 text-sm uppercase tracking-wider">
                      <th className="px-4 py-4 font-bold w-16 text-center">Seq</th>
                      <th className="px-4 py-4 font-bold w-28">Time</th>
                      <th className="px-4 py-4 font-bold w-full">Topic</th>
                      <th className="px-4 py-4 font-bold w-48">Faculty</th>
                      <th className="px-4 py-4 font-bold w-32">Phone</th>
                      <th className="px-4 py-4 font-bold w-44">Email</th>
                      <th className="px-4 py-4 font-bold w-24">Role</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {loadingDetails ? (
                      <tr><td colSpan={7} className="text-center py-12 text-gray-500 text-lg">Loading schedule...</td></tr>
                    ) : topics.length === 0 ? (
                      <tr><td colSpan={7} className="text-center py-12 text-gray-500 italic text-lg">No topics assigned yet.</td></tr>
                    ) : (
                      topics.map(t => {
                        const facultyList = t.faculty_topics || [];
                        return (
                          <tr key={t.id} className="hover:bg-blue-50/40 transition-colors">
                            <td className="px-4 py-4 text-base text-gray-600 text-center font-bold bg-gray-50">{t.sequence_no}</td>
                            <td className="px-4 py-4 text-base text-blue-800 font-semibold whitespace-nowrap">
                              {t.start_time?.slice(0,5)} - {t.end_time?.slice(0,5)}
                            </td>
                            <td className="px-4 py-4 text-base font-medium text-gray-900 leading-relaxed">{t.topic_title}</td>
                            
                            {facultyList.length === 0 ? (
                              <td colSpan={4} className="px-4 py-4 text-base text-gray-400 italic">Unassigned</td>
                            ) : (
                              <>
                                <td className="px-4 py-4 text-base">
                                  {facultyList.map((ft: any, i: number) => (
                                    <div key={i} className="font-semibold text-gray-900 mb-1.5">{ft.faculty?.canonical_name}</div>
                                  ))}
                                </td>
                                <td className="px-4 py-4 text-base text-gray-700">
                                  {facultyList.map((ft: any, i: number) => (
                                    <div key={i} className="mb-1.5">{ft.faculty?.phone || '—'}</div>
                                  ))}
                                </td>
                                <td className="px-4 py-4 text-base text-gray-700">
                                  {facultyList.map((ft: any, i: number) => (
                                    <div key={i} className="mb-1.5 truncate max-w-[200px]">{ft.faculty?.email}</div>
                                  ))}
                                </td>
                                <td className="px-4 py-4 text-base">
                                  {facultyList.map((ft: any, i: number) => (
                                    <div key={i} className="mb-1.5">
                                      <span className="bg-gray-100 text-gray-800 px-2.5 py-1 rounded-md text-xs font-semibold border border-gray-200">{ft.role}</span>
                                    </div>
                                  ))}
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500 text-xl">Select a session to view.</div>
        )}

        {isEditingSession && selectedSession && (
          <EditSessionModal session={selectedSession} onClose={() => setIsEditingSession(false)} onSaved={() => window.location.reload()} />
        )}
        {isAddingTopic && selectedSession && (
          <AddTopicModal session={selectedSession} onClose={() => setIsAddingTopic(false)} onSaved={() => window.location.reload()} />
        )}
        {isEditingCoordinators && selectedSession && (
          <EditCoordinatorsModal session={selectedSession} currentCoordinators={coordinators} onClose={() => setIsEditingCoordinators(false)} onSaved={() => window.location.reload()} />
        )}
      </main>
    </div>
  );
}
