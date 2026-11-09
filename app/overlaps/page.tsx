'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../supabase';

function formatDateDdMmYyyy(dateStr: string | null | undefined): string {
  if (!dateStr) return '--';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${d.getFullYear()}`;
}

function formatTimeAmPm(timeStr: string | null | undefined): string {
  if (!timeStr) return '--:--';
  const [hStr, mStr] = timeStr.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr || '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${m} ${ampm}`;
}

function isRealHall(hall: string | null | undefined): boolean {
  if (!hall) return false;
  const trimmed = hall.trim();
  if (trimmed === '') return false;
  if (trimmed.toUpperCase() === 'TBD') return false;
  return true;
}

export default function OverlapsPage() {
  const [overlaps, setOverlaps] = useState<any[]>([]);
  const [hallOverlaps, setHallOverlaps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'faculty' | 'hall'>('faculty');

  useEffect(() => {
    async function checkOverlaps() {
      setLoading(true);

      const { data: topics } = await supabase.from('session_topics').select(`
        id, topic_title, start_time, end_time,
        conference_sessions ( session_code, session_name, session_date, hall ),
        faculty_topics ( faculty ( canonical_name ) )
      `);

      if (!topics) return;

      // FACULTY OVERLAPS
      const facultyIssues: any[] = [];
      const facultySchedules: Record<string, any[]> = {};

      topics.forEach((t) => {
        // Skip topics that are in TBD or blank halls entirely for faculty overlaps
        if (!isRealHall(t.conference_sessions?.hall)) return;

        t.faculty_topics?.forEach((ft: any) => {
          const name = ft.faculty?.canonical_name;
          if (!name) return;
          if (!facultySchedules[name]) facultySchedules[name] = [];
          facultySchedules[name].push({ ...t, faculty_name: name });
        });
      });

      Object.keys(facultySchedules).forEach((name) => {
        const schedule = facultySchedules[name];
        for (let i = 0; i < schedule.length; i++) {
          for (let j = i + 1; j < schedule.length; j++) {
            const a = schedule[i];
            const b = schedule[j];
            if (a.conference_sessions.session_date === b.conference_sessions.session_date) {
              if (a.start_time < b.end_time && b.start_time < a.end_time) {
                facultyIssues.push({ a, b, name });
              }
            }
          }
        }
      });

      // HALL OVERLAPS  (skip blank / TBD halls)
      const hallIssues: any[] = [];
      const sessionsMap = new Map<string, any[]>();
      topics.forEach((t) => {
        const hall = t.conference_sessions?.hall;
        if (!isRealHall(hall)) return;
        const key = `${hall.trim().toUpperCase()}-${t.conference_sessions.session_date}`;
        if (!sessionsMap.has(key)) sessionsMap.set(key, []);
        sessionsMap.get(key)!.push(t);
      });

      sessionsMap.forEach((schedule) => {
        for (let i = 0; i < schedule.length; i++) {
          for (let j = i + 1; j < schedule.length; j++) {
            const a = schedule[i];
            const b = schedule[j];
            if (a.conference_sessions.session_code !== b.conference_sessions.session_code) {
              if (a.start_time < b.end_time && b.start_time < a.end_time) {
                const exists = hallIssues.find(
                  (hi) =>
                    (hi.a.conference_sessions.session_code === a.conference_sessions.session_code &&
                      hi.b.conference_sessions.session_code === b.conference_sessions.session_code) ||
                    (hi.a.conference_sessions.session_code === b.conference_sessions.session_code &&
                      hi.b.conference_sessions.session_code === a.conference_sessions.session_code)
                );
                if (!exists)
                  hallIssues.push({
                    a,
                    b,
                    hall: a.conference_sessions.hall,
                    date: a.conference_sessions.session_date,
                  });
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
      <main className="flex-1 p-8 max-w-6xl mx-auto w-full">
        <h1 className="text-3xl font-bold mb-2">Schedule Conflicts</h1>
        <p className="text-gray-500 mb-8">
          Automatically detected clashes in faculty schedules and hall bookings.
        </p>

        <div className="flex gap-4 mb-6 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('faculty')}
            className={`px-4 py-3 font-medium border-b-2 transition-colors ${
              activeTab === 'faculty'
                ? 'border-red-500 text-red-600'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            Faculty Overlaps{' '}
            {overlaps.length > 0 && (
              <span className="ml-2 bg-red-100 text-red-600 px-2 py-0.5 rounded-full text-xs">
                {overlaps.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('hall')}
            className={`px-4 py-3 font-medium border-b-2 transition-colors ${
              activeTab === 'hall'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            Hall Overlaps{' '}
            {hallOverlaps.length > 0 && (
              <span className="ml-2 bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full text-xs">
                {hallOverlaps.length}
              </span>
            )}
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500 text-lg font-medium">
            Scanning schedule for conflicts...
          </div>
        ) : (
          <div className="space-y-4">
            {activeTab === 'faculty' &&
              (overlaps.length === 0 ? (
                <div className="bg-green-50 text-green-700 p-8 rounded-xl border border-green-200 text-center font-medium shadow-sm">
                  <div className="text-lg">No faculty members are double-booked.</div>
                </div>
              ) : (
                overlaps.map((issue, idx) => (
                  <div
                    key={idx}
                    className="bg-white border-l-4 border-red-500 rounded-lg shadow-sm p-5 flex flex-col gap-4"
                  >
                    <div className="font-bold text-lg text-red-700 flex items-center gap-2">
                      <span className="bg-red-100 px-2 py-0.5 rounded text-xs uppercase tracking-wide">
                        Warning
                      </span>
                      {issue.name}
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="bg-gray-50 p-4 rounded border border-gray-200">
                        <div className="font-bold text-blue-800 mb-2">
                          {issue.a.conference_sessions.session_code} -{' '}
                          {issue.a.conference_sessions.session_name}
                        </div>
                        <div className="text-gray-600 mb-1">
                          <strong>Time:</strong> {formatTimeAmPm(issue.a.start_time)} -{' '}
                          {formatTimeAmPm(issue.a.end_time)}
                        </div>
                        <div className="text-gray-600">
                          <strong>Hall:</strong> {issue.a.conference_sessions.hall}
                        </div>
                        <div className="mt-3 pt-3 border-t border-gray-200 text-gray-800 italic">
                          "{issue.a.topic_title}"
                        </div>
                      </div>
                      <div className="bg-gray-50 p-4 rounded border border-gray-200">
                        <div className="font-bold text-blue-800 mb-2">
                          {issue.b.conference_sessions.session_code} -{' '}
                          {issue.b.conference_sessions.session_name}
                        </div>
                        <div className="text-gray-600 mb-1">
                          <strong>Time:</strong> {formatTimeAmPm(issue.b.start_time)} -{' '}
                          {formatTimeAmPm(issue.b.end_time)}
                        </div>
                        <div className="text-gray-600">
                          <strong>Hall:</strong> {issue.b.conference_sessions.hall}
                        </div>
                        <div className="mt-3 pt-3 border-t border-gray-200 text-gray-800 italic">
                          "{issue.b.topic_title}"
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ))}

            {activeTab === 'hall' &&
              (hallOverlaps.length === 0 ? (
                <div className="bg-green-50 text-green-700 p-8 rounded-xl border border-green-200 text-center font-medium shadow-sm">
                  <div className="text-lg">No halls are double-booked.</div>
                </div>
              ) : (
                hallOverlaps.map((issue, idx) => (
                  <div
                    key={idx}
                    className="bg-white border-l-4 border-orange-500 rounded-lg shadow-sm p-5 flex flex-col gap-4"
                  >
                    <div className="font-bold text-lg text-orange-700 flex items-center gap-2">
                      <span className="bg-orange-100 px-2 py-0.5 rounded text-xs uppercase tracking-wide">
                        Warning
                      </span>
                      Hall {issue.hall} on {formatDateDdMmYyyy(issue.date)}
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="bg-gray-50 p-4 rounded border border-gray-200">
                        <div className="font-bold text-blue-800 mb-2">
                          {issue.a.conference_sessions.session_code} -{' '}
                          {issue.a.conference_sessions.session_name}
                        </div>
                        <div className="text-gray-600">
                          <strong>Time:</strong> {formatTimeAmPm(issue.a.start_time)} -{' '}
                          {formatTimeAmPm(issue.a.end_time)}
                        </div>
                      </div>
                      <div className="bg-gray-50 p-4 rounded border border-gray-200">
                        <div className="font-bold text-blue-800 mb-2">
                          {issue.b.conference_sessions.session_code} -{' '}
                          {issue.b.conference_sessions.session_name}
                        </div>
                        <div className="text-gray-600">
                          <strong>Time:</strong> {formatTimeAmPm(issue.b.start_time)} -{' '}
                          {formatTimeAmPm(issue.b.end_time)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ))}
          </div>
        )}
      </main>
    </div>
  );
}
