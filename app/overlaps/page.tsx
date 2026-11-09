'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../supabase';

export default function OverlapsPage() {
  const [overlaps, setOverlaps] = useState<any[]>([]);
  const [hallOverlaps, setHallOverlaps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'faculty' | 'hall'>('faculty');

  useEffect(() => {
    async function checkOverlaps() {
      setLoading(true);

      // 1. Fetch all topics with their session and faculty info
      const { data: topics } = await supabase.from('session_topics').select(`
        id, topic_title, start_time, end_time,
        conference_sessions ( session_code, session_name, session_date, hall ),
        faculty_topics ( faculty ( canonical_name ) )
      `);

      if (!topics) return;

      // 2. Find Faculty Overlaps
      const facultyIssues: any[] = [];
      const facultySchedules: Record<string, any[]> = {};

      // Group all topics by faculty name
      topics.forEach(t => {
        t.faculty_topics?.forEach((ft: any) => {
          const name = ft.faculty?.canonical_name;
          if (!name) return;
          if (!facultySchedules[name]) facultySchedules[name] = [];
          facultySchedules[name].push({ ...t, faculty_name: name });
        });
      });

      // Check for time clashes in each faculty's schedule
      Object.keys(facultySchedules).forEach(name => {
        const schedule = facultySchedules[name];
        for (let i = 0; i < schedule.length; i++) {
          for (let j = i + 1; j < schedule.length; j++) {
            const a = schedule[i];
            const b = schedule[j];
            
            // Only check if on the same date
            if (a.conference_sessions.session_date === b.conference_sessions.session_date) {
              // Time overlap formula: (StartA < EndB) and (StartB < EndA)
              if (a.start_time < b.end_time && b.start_time < a.end_time) {
                facultyIssues.push({ a, b, name });
              }
            }
          }
        }
      });

      // 3. Find Hall Overlaps
      const hallIssues: any[] = [];
      const sessionsMap = new Map();
      topics.forEach(t => {
        if (t.conference_sessions?.hall) {
          const key = `${t.conference_sessions.hall}-${t.conference_sessions.session_date}`;
          if (!sessionsMap.has(key)) sessionsMap.set(key, []);
          sessionsMap.get(key).push(t);
        }
      });

      // Check for time clashes in each hall
      sessionsMap.forEach((schedule, key) => {
        for (let i = 0; i < schedule.length; i++) {
          for (let j = i + 1; j < schedule.length; j++) {
            const a = schedule[i];
            const b = schedule[j];
            if (a.conference_sessions.session_code !== b.conference_sessions.session_code) {
              if (a.start_time < b.end_time && b.start_time < a.end_time) {
                const exists = hallIssues.find(hi => 
                  (hi.a.conference_sessions.session_code === a.conference_sessions.session_code && hi.b.conference_sessions.session_code === b.conference_sessions.session_code) ||
                  (hi.a.conference_sessions.session_code === b.conference_sessions.session_code && hi.b.conference_sessions.session_code === a.conference_sessions.session_code)
                );
                if (!exists) hallIssues.push({ a, b, hall: a.conference_sessions.hall, date: a.conference_sessions.session_date });
              }
            }
          }
        }
      });

      setOverlaps(facultyIssues);
      setHallOverlaps(hallIssues);
      setLoading(false);
    }
    checkOverlaps();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-8 shrink-0">
        <div className="flex items-center gap-8">
          <span className="text-xl font-bold text-blue-600">DERMACON 2028</span>
          <nav className="flex gap-6 items-center h-16">
            <a href="/" className="text-gray-600 hover:text-blue-600 font-medium h-full flex items-center">Faculty</a>
            <a href="/sessions" className="text-gray-600 hover:text-blue-600 font-medium h-full flex items-center">Master Schedule</a>
            <a href="/overlaps" className="text-red-600 border-b-2 border-red-600 font-bold h-full flex items-center">Overlaps</a>
          </nav>
        </div>
      </header>

      <main className="flex-1 p-8 max-w-6xl mx-auto w-full">
        <h1 className="text-3xl font-bold mb-2">Schedule Conflicts</h1>
        <p className="text-gray-500 mb-8">Automatically detected clashes in faculty schedules and hall bookings.</p>

        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-gray-200">
          <button 
            onClick={() => setActiveTab('faculty')}
            className={`px-4 py-3 font-medium border-b-2 transition-colors ${activeTab === 'faculty' ? 'border-red-500 text-red-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
          >
            Faculty Overlaps {overlaps.length > 0 && <span className="ml-2 bg-red-100 text-red-600 px-2 py-0.5 rounded-full text-xs">{overlaps.length}</span>}
          </button>
          <button 
            onClick={() => setActiveTab('hall')}
            className={`px-4 py-3 font-medium border-b-2 transition-colors ${activeTab === 'hall' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
          >
            Hall Overlaps {hallOverlaps.length > 0 && <span className="ml-2 bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full text-xs">{hallOverlaps.length}</span>}
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500 text-lg font-medium">Scanning schedule for conflicts...</div>
        ) : (
          <div className="space-y-4">
            
            {/* FACULTY OVERLAPS TAB */}
            {activeTab === 'faculty' && (
              overlaps.length === 0 ? (
                <div className="bg-green-50 text-green-700 p-8 rounded-xl border border-green-200 text-center font-medium shadow-sm">
                  <div className="text-3xl mb-2">✅</div>
                  <div className="text-lg">No faculty members are double-booked.</div>
                </div>
              ) : (
                overlaps.map((issue, idx) => (
                  <div key={idx} className="bg-white border-l-4 border-red-500 rounded-lg shadow-sm p-5 flex flex-col gap-4">
                    <div className="font-bold text-lg text-red-700 flex items-center gap-2">
                      <span className="bg-red-100 p-1.5 rounded-md text-sm">⚠️</span> {issue.name}
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="bg-gray-50 p-4 rounded border border-gray-200">
                        <div className="font-bold text-blue-800 mb-2">{issue.a.conference_sessions.session_code} - {issue.a.conference_sessions.session_name}</div>
                        <div className="text-gray-600 mb-1"><strong>Time:</strong> {issue.a.start_time.slice(0,5)} - {issue.a.end_time.slice(0,5)}</div>
                        <div className="text-gray-600"><strong>Hall:</strong> {issue.a.conference_sessions.hall}</div>
                        <div className="mt-3 pt-3 border-t border-gray-200 text-gray-800 italic">"{issue.a.topic_title}"</div>
                      </div>
                      <div className="bg-gray-50 p-4 rounded border border-gray-200">
                        <div className="font-bold text-blue-800 mb-2">{issue.b.conference_sessions.session_code} - {issue.b.conference_sessions.session_name}</div>
                        <div className="text-gray-600 mb-1"><strong>Time:</strong> {issue.b.start_time.slice(0,5)} - {issue.b.end_time.slice(0,5)}</div>
                        <div className="text-gray-600"><strong>Hall:</strong> {issue.b.conference_sessions.hall}</div>
                        <div className="mt-3 pt-3 border-t border-gray-200 text-gray-800 italic">"{issue.b.topic_title}"</div>
                      </div>
                    </div>
                  </div>
                ))
              )
            )}

            {/* HALL OVERLAPS TAB */}
            {activeTab === 'hall' && (
              hallOverlaps.length === 0 ? (
                <div className="bg-green-50 text-green-700 p-8 rounded-xl border border-green-200 text-center font-medium shadow-sm">
                  <div className="text-3xl mb-2">✅</div>
                  <div className="text-lg">No halls are double-booked.</div>
                </div>
              ) : (
                hallOverlaps.map((issue, idx) => (
                  <div key={idx} className="bg-white border-l-4 border-orange-500 rounded-lg shadow-sm p-5 flex flex-col gap-4">
                    <div className="font-bold text-lg text-orange-700 flex items-center gap-2">
                      <span className="bg-orange-100 p-1.5 rounded-md text-sm">⚠️</span> Hall {issue.hall} on {issue.date}
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="bg-gray-50 p-4 rounded border border-gray-200">
                        <div className="font-bold text-blue-800 mb-2">{issue.a.conference_sessions.session_code} - {issue.a.conference_sessions.session_name}</div>
                        <div className="text-gray-600"><strong>Time:</strong> {issue.a.start_time.slice(0,5)} - {issue.a.end_time.slice(0,5)}</div>
                      </div>
                      <div className="bg-gray-50 p-4 rounded border border-gray-200">
                        <div className="font-bold text-blue-800 mb-2">{issue.b.conference_sessions.session_code} - {issue.b.conference_sessions.session_name}</div>
                        <div className="text-gray-600"><strong>Time:</strong> {issue.b.start_time.slice(0,5)} - {issue.b.end_time.slice(0,5)}</div>
                      </div>
                    </div>
                  </div>
                ))
              )
            )}

          </div>
        )}
      </main>
    </div>
  );
}
