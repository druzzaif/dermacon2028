'use client';

import { Suspense, useEffect, useState } from 'react';
import { supabase } from '../supabase';
import EditSessionModal from '../components/EditSessionModal';
import AddTopicModal from '../components/AddTopicModal';
import EditCoordinatorsModal from '../components/EditCoordinatorsModal';
import { useSearchParams } from 'next/navigation';

const ROLE_LETTER: Record<string, string> = {
  Faculty: 'F', Chairperson: 'C', Moderator: 'M', Panel: 'P', Panelist: 'P', Demo: 'D', QA: 'Q', Coordinator: 'C',
};

function RoleBadge({ role, confirmed }: { role: string; confirmed?: boolean | null }) {
  return (
    <span
      className="inline-flex items-center gap-1 shrink-0"
      title={`${role}${confirmed ? ' · confirmed' : ' · not confirmed'}`}
    >
      <span
        className={`w-6 h-6 rounded-md grid place-items-center text-xs font-bold ${
          confirmed ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-700'
        }`}
      >
        {ROLE_LETTER[role] || role?.[0]?.toUpperCase() || '?'}
      </span>
      <svg viewBox="0 0 16 16" className={`w-4 h-4 ${confirmed ? 'text-emerald-600' : 'invisible'}`} aria-hidden="true">
        <path d="M3 8.5l3.2 3.2L13 4.8" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="sr-only">{role}{confirmed ? ', confirmed' : ', not confirmed'}</span>
    </span>
  );
}

function MailIcon({ on, title }: { on?: boolean | null; title: string }) {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" role="img" aria-label={title}>
      <title>{title}</title>
      <rect x="2" y="5" width="20" height="14" rx="2.5" fill={on ? '#2563eb' : 'none'} stroke={on ? '#2563eb' : '#9ca3af'} strokeWidth="1.6" />
      <path d="M3 7.5l9 6.5 9-6.5" fill="none" stroke={on ? '#fff' : '#9ca3af'} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function WhatsAppIcon({ on, title }: { on?: boolean | null; title: string }) {
  const c = on ? '#25D366' : '#9ca3af';
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" role="img" aria-label={title}>
      <title>{title}</title>
      <path d="M12 2.5a9.5 9.5 0 0 0-8.1 14.4L2.5 21.5l4.7-1.3A9.5 9.5 0 1 0 12 2.5z" fill={on ? c : 'none'} stroke={c} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M8.7 7.8c.3-.4.7-.3.9.1l.7 1.5c.1.3 0 .5-.2.7l-.5.6c.8 1.5 1.9 2.4 3.3 3l.6-.7c.2-.2.4-.3.7-.2l1.5.7c.4.2.4.6.2 1-.5.9-1.4 1.3-2.4 1.1-2.5-.6-4.5-2.4-5.3-4.9-.2-.8 0-1.5.5-2.1z" fill={on ? '#fff' : c} />
    </svg>
  );
}

function SessionsContent() {
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
          faculty_topics ( role, faculty ( canonical_name, phone, email, google_confirmed, email_sent, whatsapp_sent ) )
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

  if (loading) return <div className="h-[calc(100vh-var(--topbar-h))] flex items-center justify-center bg-gray-50 text-gray-500 text-xl">Loading Master Schedule...</div>;

  return (
    <div className="flex h-[calc(100vh-var(--topbar-h))] bg-gray-100 text-gray-900 font-sans overflow-hidden">
      
      <aside className="w-80 bg-white border-r border-gray-200 flex flex-col shrink-0">
        <div className="p-5 border-b border-gray-200 bg-gray-800 text-white">
          <h1 className="text-xl font-bold tracking-wide">DERMACON 2028</h1>
          <p className="text-sm text-gray-300 mt-1">Master Schedule</p>
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
            <div className="bg-white border-b border-gray-200 px-6 py-4 shrink-0 shadow-sm z-10 flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="bg-gray-800 text-white font-bold text-lg px-3 py-1 rounded-md">{selectedSession.session_code}</span>
                    <h2 className="text-2xl font-bold text-gray-900 leading-tight">{selectedSession.session_name}</h2>
                  </div>
                  <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-sm text-gray-700">
                    <span>{selectedSession.session_date}</span>
                    <span className="font-semibold">{selectedSession.start_time?.slice(0,5)} – {selectedSession.end_time?.slice(0,5)}</span>
                    {selectedSession.hall && <span>{selectedSession.hall}</span>}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsEditingSession(true)}
                    className="px-4 py-2.5 min-h-11 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-blue-600"
                  >
                    Edit session
                  </button>
                  <button
                    onClick={() => setIsAddingTopic(true)}
                    className="px-4 py-2.5 min-h-11 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                  >
                    + Add topic
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap border-t border-gray-100 pt-3">
                <h3 className="text-sm font-semibold text-gray-600 shrink-0">Coordinators</h3>
                <div className="flex gap-2 flex-wrap flex-1">
                  {coordinators.length === 0 ? (
                    <span className="text-sm text-gray-500 italic">None assigned</span>
                  ) : (
                    coordinators.map((c, i) => (
                      <div key={i} className="bg-blue-50 pl-2.5 pr-1.5 py-1 rounded-full border border-blue-100 flex items-center gap-1.5">
                        <span className="font-semibold text-gray-900 text-sm">{c.faculty?.canonical_name}</span>
                        <span className="text-xs font-semibold text-blue-800 bg-blue-100 px-1.5 py-0.5 rounded-full">{c.role}</span>
                      </div>
                    ))
                  )}
                </div>
                <button
                  onClick={() => setIsEditingCoordinators(true)}
                  className="text-sm text-blue-700 hover:text-blue-900 font-semibold px-3 min-h-11 shrink-0 focus-visible:outline-2 focus-visible:outline-blue-600"
                >
                  Edit coordinators
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-8">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full text-left border-collapse min-w-[900px]">
                  <thead>
                    <tr className="bg-gray-100 border-b border-gray-300 text-gray-700 text-sm">
                      <th className="px-3 py-3 font-semibold w-12 text-center">#</th>
                      <th className="px-3 py-3 font-semibold w-32">Time</th>
                      <th className="px-3 py-3 font-semibold">Topic</th>
                      <th className="px-3 py-3 font-semibold w-72">Faculty</th>
                      <th className="px-3 py-3 font-semibold w-44">Contact</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {loadingDetails ? (
                      <tr><td colSpan={5} className="text-center py-12 text-gray-500 text-lg">Loading schedule...</td></tr>
                    ) : topics.length === 0 ? (
                      <tr><td colSpan={5} className="text-center py-12 text-gray-500 italic text-lg">No topics assigned yet.</td></tr>
                    ) : (
                      topics.map(t => {
                        const facultyList = t.faculty_topics || [];
                        return (
                          <tr key={t.id} className="hover:bg-blue-50/40 transition-colors">
                            <td className="px-3 py-3 text-base text-gray-600 text-center font-bold bg-gray-50">{t.sequence_no}</td>
                            <td className="px-3 py-3 text-base text-blue-800 font-semibold whitespace-nowrap">
                              {t.start_time?.slice(0,5)} - {t.end_time?.slice(0,5)}
                            </td>
                            <td className="px-3 py-3 text-base font-medium text-gray-900 leading-snug">{t.topic_title}</td>
                            
                            {facultyList.length === 0 ? (
                              <td colSpan={2} className="px-3 py-3 text-base text-gray-400 italic">Unassigned</td>
                            ) : (
                              <>
                                <td className="px-3 py-3 text-base">
                                  {facultyList.map((ft: any, i: number) => (
                                    <div key={i} className="flex items-center gap-2 h-8">
                                      <RoleBadge role={ft.role} confirmed={ft.faculty?.google_confirmed} />
                                      <span className="font-semibold text-gray-900 truncate">{ft.faculty?.canonical_name}</span>
                                    </div>
                                  ))}
                                </td>
                                <td className="px-3 py-3 text-base text-gray-700">
                                  {facultyList.map((ft: any, i: number) => (
                                    <div key={i} className="flex items-center gap-2 h-8">
                                      <span className="w-28 tabular-nums">{ft.faculty?.phone || '—'}</span>
                                      <span title={ft.faculty?.email || undefined}>
                                        <MailIcon on={ft.faculty?.email_sent} title={ft.faculty?.email_sent ? 'Email sent' : 'Email not sent'} />
                                      </span>
                                      <WhatsAppIcon on={ft.faculty?.whatsapp_sent} title={ft.faculty?.whatsapp_sent ? 'WhatsApp sent' : 'WhatsApp not sent'} />
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

export default function SessionsPage() {
  return (
    <Suspense fallback={null}>
      <SessionsContent />
    </Suspense>
  );
}
