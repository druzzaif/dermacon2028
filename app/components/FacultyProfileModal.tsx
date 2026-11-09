'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export default function FacultyProfileModal({
  faculty,
  onClose,
}: {
  faculty: any;
  onClose: () => void;
}) {
  const [speakingSessions, setSpeakingSessions] = useState<any[]>([]);
  const [coordinatingSessions, setCoordinatingSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProfileData() {
      // 1. Fetch Speaking Topics
      const { data: topicsData } = await supabase
        .from('faculty_topics')
        .select(`
          role,
          session_topics (
            topic_title,
            start_time,
            end_time,
            conference_sessions ( session_code, session_name, session_date, hall )
          )
        `)
        .eq('faculty_id', faculty.id);

      if (topicsData) {
        const sortedTopics = topicsData.sort((a: any, b: any) => {
          const dateA = a.session_topics?.conference_sessions?.session_date || '';
          const dateB = b.session_topics?.conference_sessions?.session_date || '';
          return dateA.localeCompare(dateB);
        });
        setSpeakingSessions(sortedTopics);
      }

      // 2. Fetch Coordinating Sessions
      const { data: coordData } = await supabase
        .from('session_coordinators')
        .select(`
          role,
          conference_sessions ( session_code, session_name, session_date, hall )
        `)
        .eq('faculty_id', faculty.id);

      if (coordData) {
        const sortedCoords = coordData.sort((a: any, b: any) => {
          const dateA = a.conference_sessions?.session_date || '';
          const dateB = b.conference_sessions?.session_date || '';
          return dateA.localeCompare(dateB);
        });
        setCoordinatingSessions(sortedCoords);
      }

      setLoading(false);
    }
    fetchProfileData();
  }, [faculty.id]);

  const initials = faculty.canonical_name?.replace('Dr. ', '').replace('Dr ', '').split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="fixed inset-0 bg-black/40 flex justify-end z-50">
      <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col animate-slide-in">
        
        {/* Header */}
        <div className="p-6 border-b border-gray-200 bg-gray-50 flex justify-between items-start">
          <div className="flex gap-4 items-center">
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-white flex items-center justify-center font-bold text-lg shadow-sm tracking-tight">
              {initials}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{faculty.canonical_name}</h2>
              <p className="text-sm text-gray-500 font-mono mt-0.5">{faculty.faculty_id}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-800 text-3xl leading-none">&times;</button>
        </div>

        {/* Contact Details */}
        <div className="p-6 border-b border-gray-200 space-y-4 bg-white">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Email</div>
              <div className="text-sm text-gray-900 truncate" title={faculty.email}>{faculty.email || '—'}</div>
            </div>
            <div>
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Phone</div>
              <div className="text-sm text-gray-900">{faculty.phone || '—'}</div>
            </div>
            <div>
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Country</div>
              <div className="text-sm text-gray-900">{faculty.country || '—'}</div>
            </div>
            <div>
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Type</div>
              <div className="text-sm text-gray-900">{faculty.person_type || '—'}</div>
            </div>
          </div>
        </div>

        {/* Roles and Schedule */}
        <div className="flex-1 overflow-y-auto bg-gray-50 p-6 space-y-6">
          
          {/* Coordinating Sessions */}
          {coordinatingSessions.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-purple-800 uppercase tracking-wider mb-3 border-b border-purple-200 pb-2 flex items-center gap-2">
                <span>🎓</span> Coordinating Roles ({coordinatingSessions.length})
              </h3>
              <div className="space-y-3">
                {coordinatingSessions.map((c, i) => {
                  const session = c.conference_sessions;
                  return (
                    <a 
                      key={i} 
                      href={`/sessions?code=${session?.session_code}`}
                      className="block bg-white p-4 rounded-lg border-l-4 border-purple-500 shadow-sm hover:shadow-md hover:border-purple-600 transition-all cursor-pointer group"
                    >
                      <div className="flex justify-between items-start mb-1">
                        <div className="font-bold text-gray-900 text-sm group-hover:text-purple-700 transition-colors">{session?.session_code} - {session?.session_name}</div>
                        <div className="text-[10px] font-bold text-white bg-purple-600 px-2 py-0.5 rounded uppercase shadow-sm">{c.role}</div>
                      </div>
                      <div className="text-xs text-gray-500 mt-2 flex justify-between">
                        <span>{session?.session_date}</span>
                        <span>Hall {session?.hall || 'TBD'}</span>
                      </div>
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {/* Speaking Schedule */}
          <div>
            <h3 className="text-sm font-bold text-blue-800 uppercase tracking-wider mb-3 border-b border-blue-200 pb-2 flex items-center gap-2">
              <span>🎤</span> Speaking Schedule ({speakingSessions.length})
            </h3>
            
            {loading ? (
              <div className="text-center text-gray-500 text-sm py-4">Loading...</div>
            ) : speakingSessions.length === 0 ? (
              <div className="text-center text-gray-500 italic text-sm py-4 bg-white rounded-lg border border-gray-200">
                No speaking topics assigned yet.
              </div>
            ) : (
              <div className="space-y-3">
                {speakingSessions.map((s, i) => {
                  const topic = s.session_topics;
                  const session = topic?.conference_sessions;
                  
                  return (
                    <a 
                      key={i} 
                      href={`/sessions?code=${session?.session_code}`}
                      className="block bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md hover:border-blue-400 transition-all cursor-pointer group"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="font-bold text-blue-800 text-sm group-hover:text-blue-600 transition-colors">{session?.session_code}</div>
                        <div className="text-xs font-bold text-gray-600 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded">{s.role}</div>
                      </div>
                      <div className="text-sm font-medium text-gray-900 mb-2 leading-tight">{topic?.topic_title}</div>
                      <div className="flex justify-between text-xs text-gray-500 mt-2 pt-2 border-t border-gray-100">
                        <span>{session?.session_date}</span>
                        <span>{topic?.start_time?.slice(0,5)} - {topic?.end_time?.slice(0,5)}</span>
                        <span>Hall {session?.hall || 'TBD'}</span>
                      </div>
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
