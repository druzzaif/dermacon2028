'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import AssignFacultyModal from '../components/AssignFacultyModal';

export default function MissingDataPage() {
  const [groupedData, setGroupedData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigningTopic, setAssigningTopic] = useState<any | null>(null);

  async function fetchMissingData() {
    setLoading(true);
    const { data: sessions } = await supabase.from('conference_sessions').select(`
      id, session_code, session_name, session_date, start_time, hall,
      session_topics ( 
        id, topic_title, sequence_no, 
        faculty_topics ( faculty ( faculty_id, canonical_name ) ) 
      ),
      session_coordinators ( role, faculty ( faculty_id, canonical_name ) )
    `).order('session_date', { ascending: true }).order('start_time', { ascending: true });

    if (sessions) {
      const issuesBySession: any[] = [];

      sessions.forEach(s => {
        const missingTopics: any[] = [];
        const realCoordinators = s.session_coordinators?.filter((c: any) => 
          c.faculty?.faculty_id !== 'FAC000' && c.faculty?.canonical_name !== 'TBD (To Be Determined)'
        ) || [];
        const hasCoordinators = realCoordinators.length > 0;
        const isEmpty = !s.session_topics || s.session_topics.length === 0;

        if (s.session_topics) {
          s.session_topics.forEach((t: any) => {
            const realFaculty = t.faculty_topics?.filter((ft: any) => 
              ft.faculty?.faculty_id !== 'FAC000' && ft.faculty?.canonical_name !== 'TBD (To Be Determined)'
            ) || [];

            if (realFaculty.length === 0) {
              missingTopics.push(t);
            }
          });
        }

        if (isEmpty || missingTopics.length > 0 || !hasCoordinators) {
          issuesBySession.push({ ...s, isEmpty, hasCoordinators, missingTopics });
        }
      });

      setGroupedData(issuesBySession);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchMissingData();
  }, []);

  if (loading) return <div className="p-8 text-center text-gray-500 text-lg">Scanning database for missing data...</div>;

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900 font-sans flex flex-col">
      <header className="bg-white border-b border-gray-200 h-20 flex items-center justify-between px-8 shrink-0 sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-8">
          <span className="text-2xl font-bold text-blue-600">DERMACON 2028</span>
          <nav className="flex gap-6 items-center h-20 text-base font-medium">
            <a href="/" className="text-gray-600 hover:text-blue-600">Faculty</a>
            <a href="/sessions" className="text-gray-600 hover:text-blue-600">Master Schedule</a>
            <a href="/overlaps" className="text-gray-600 hover:text-red-600">Overlaps</a>
            <a href="/missing" className="text-red-600 border-b-4 border-red-600 h-full flex items-center pt-1 font-bold">Missing Data</a>
          </nav>
        </div>
      </header>

      <main className="flex-1 p-8 max-w-5xl mx-auto w-full">
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">To-Do Checklist</h1>
          <p className="text-gray-500 text-lg">Sessions and topics that require your attention.</p>
        </div>

        {groupedData.length === 0 ? (
          <div className="bg-green-50 text-green-700 p-10 rounded-2xl border border-green-200 text-center shadow-sm">
            <div className="text-5xl mb-4">🎉</div>
            <div className="text-2xl font-bold">Everything is Perfect!</div>
          </div>
        ) : (
          <div className="space-y-8">
            {groupedData.map((session) => (
              <div key={session.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                
                {/* Header with Clickable Session Code */}
                <div className="bg-gray-50 border-b border-gray-200 p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <a 
                        href={`/sessions?code=${session.session_code}`}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg font-bold text-sm tracking-wide transition-colors flex items-center gap-1 group"
                        title={`Go to ${session.session_code}`}
                      >
                        {session.session_code}
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity">↗</span>
                      </a>
                      <h2 className="text-xl font-bold text-gray-900">{session.session_name || 'Untitled Session'}</h2>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600 mt-2">
                      <span>📅 {session.session_date || 'No Date'}</span>
                      <span>⏰ {session.start_time?.slice(0,5) || 'No Time'}</span>
                      <span>📍 {session.hall || 'No Hall'}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {session.missingTopics.length > 0 && <span className="bg-red-100 text-red-800 border border-red-200 px-3 py-1 rounded-full text-xs font-bold uppercase">{session.missingTopics.length} Missing Faculty</span>}
                  </div>
                </div>

                {session.missingTopics.length > 0 && (
                  <div className="p-6">
                    <div className="space-y-3">
                      {session.missingTopics.map((topic: any) => (
                        <div key={topic.id} className="flex items-center justify-between p-4 rounded-xl bg-red-50 border border-red-100">
                          <div className="flex items-start gap-4">
                            <div className="bg-white text-red-600 font-bold px-3 py-1 rounded-lg border border-red-200 shadow-sm text-sm shrink-0">
                              Seq {topic.sequence_no || '?'}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <a 
                                  href={`/sessions?code=${session.session_code}`}
                                  className="text-blue-600 hover:text-blue-800 hover:underline font-bold text-sm transition-colors"
                                  title={`Go to ${session.session_code}`}
                                >
                                  {session.session_code} ↗
                                </a>
                              </div>
                              <div className="text-base font-semibold text-gray-900">{topic.topic_title || <span className="text-red-500 italic">(Blank Topic Title)</span>}</div>
                              <div className="text-sm text-red-600 mt-1 font-medium flex items-center gap-1">⚠️ Needs a speaker</div>
                            </div>
                          </div>
                          <button 
                            onClick={() => setAssigningTopic(topic)}
                            className="bg-white border border-red-200 text-red-600 hover:bg-red-100 px-4 py-2 rounded-lg font-bold text-sm shadow-sm transition-colors"
                          >
                            + Assign
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {assigningTopic && (
        <AssignFacultyModal 
          topic={assigningTopic} 
          onClose={() => setAssigningTopic(null)} 
          onSaved={fetchMissingData} 
        />
      )}
    </div>
  );
}
