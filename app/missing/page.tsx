'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import AssignFacultyModal from '../components/AssignFacultyModal';
import Badge from '../components/Badge';
import { AlertIcon, ArrowUpRightIcon, CalendarIcon, CheckIcon, ClockIcon, PinIcon, PlusIcon } from '../components/Icons';

export default function MissingDataPage() {
  const [groupedData, setGroupedData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigningTopic, setAssigningTopic] = useState<any | null>(null);
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setOpenIds((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  async function fetchMissingData() {
    setLoading(true);
    const { data: sessions } = await supabase.from('conference_sessions').select(`
      id, session_code, session_name, session_date, start_time, hall,
      session_topics ( 
        id, topic_title, sequence_no, 
        faculty_topics ( role, faculty ( faculty_id, canonical_name ) ) 
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
              ft.role !== 'Chairperson' && ft.faculty?.faculty_id !== 'FAC000' && ft.faculty?.canonical_name !== 'TBD (To Be Determined)'
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

  if (loading) {
    return (
      <div role="status" className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-canvas text-ink-2">
        Scanning the database for missing data…
      </div>
    );
  }

  const goBtn =
    'inline-flex h-11 items-center gap-1.5 whitespace-nowrap rounded-lg border bg-white px-4 text-sm font-medium transition-colors';

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-canvas text-ink">
      <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-5xl p-4 outline-none sm:p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-semibold">To-do checklist</h1>
          <p className="mt-1.5 text-ink-2">Sessions and topics that still need your attention.</p>
        </div>

        {groupedData.length === 0 ? (
          <div className="rounded-2xl border border-green-200 bg-green-50 p-10 text-center text-green-800 shadow-card">
            <CheckIcon width={36} height={36} className="mx-auto mb-3" />
            <p className="text-xl font-semibold">Everything is in place</p>
            <p className="mt-1 text-sm">All sessions have topics, faculty and coordinators assigned.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {groupedData.map((session) => (
              <section
                key={session.id}
                aria-labelledby={`session-${session.id}`}
                className="overflow-hidden rounded-2xl border border-line bg-white shadow-card"
              >
                <button
                  type="button"
                  onClick={() => toggle(String(session.id))}
                  aria-expanded={openIds.has(String(session.id))}
                  className="flex w-full flex-wrap items-center gap-3 bg-slate-50/70 p-4 text-left transition-colors hover:bg-slate-100 sm:px-6"
                >
                  <span className="tnum inline-flex h-9 items-center rounded-lg bg-accent px-3 text-sm font-semibold text-white">
                    {session.session_code}
                  </span>
                  <h2 id={`session-${session.id}`} className="min-w-0 flex-1 text-base font-semibold text-ink">
                    {session.session_name || 'Untitled session'}
                  </h2>
                  <Badge tone="danger">
                    {(session.isEmpty ? 1 : 0) + session.missingTopics.length + (session.hasCoordinators ? 0 : 1)} missing
                  </Badge>
                  <span aria-hidden="true" className="text-muted">{openIds.has(String(session.id)) ? '▲' : '▼'}</span>
                </button>
                {openIds.has(String(session.id)) && (
                  <div className="border-t border-line px-5 pt-4 text-sm text-ink-2 sm:px-6">
                    <span className="tnum">{session.session_date || 'No date'}</span> · <span className="tnum">{session.start_time?.slice(0, 5) || 'No time'}</span> · {session.hall || <span className="font-semibold text-red-700">No hall</span>}
                    {' · '}
                    <a href={`/sessions?code=${session.session_code}`} className="font-medium text-accent hover:underline">Open session</a>
                  </div>
                )}

                {openIds.has(String(session.id)) && (
                <ul className="space-y-3 p-5 sm:p-6">
                  {session.isEmpty && (
                    <li className="flex flex-col justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center">
                      <div className="flex items-start gap-3">
                        <AlertIcon className="mt-0.5 shrink-0 text-red-800" width={20} height={20} />
                        <div>
                          <p className="font-semibold text-ink">This session has no topics yet</p>
                          <p className="mt-0.5 text-sm text-red-900">Add topics to build the programme.</p>
                        </div>
                      </div>
                      <a href={`/sessions?code=${session.session_code}`} className={`${goBtn} border-red-300 text-red-800 hover:bg-red-100`}>
                        Go to session <ArrowUpRightIcon width={14} height={14} />
                      </a>
                    </li>
                  )}

                  {!session.hasCoordinators && (
                    <li className="flex flex-col justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center">
                      <div className="flex items-start gap-3">
                        <AlertIcon className="mt-0.5 shrink-0 text-amber-900" width={20} height={20} />
                        <div>
                          <p className="font-semibold text-ink">No coordinators assigned</p>
                          <p className="mt-0.5 text-sm text-amber-900">Assign a lead, national or local coordinator.</p>
                        </div>
                      </div>
                      <a href={`/sessions?code=${session.session_code}`} className={`${goBtn} border-amber-300 text-amber-900 hover:bg-amber-100`}>
                        Edit coordinators <ArrowUpRightIcon width={14} height={14} />
                      </a>
                    </li>
                  )}

                  {session.missingTopics.map((topic: any) => (
                    <li key={topic.id} className="flex flex-col justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 sm:flex-row sm:items-center">
                      <div className="flex items-start gap-3">
                        <span className="tnum inline-flex h-8 min-w-8 shrink-0 items-center justify-center rounded-lg bg-white px-2 text-sm font-semibold text-red-800 ring-1 ring-inset ring-red-200">
                          <span className="sr-only">Number </span>{topic.sequence_no || '?'}
                        </span>
                        <div>
                          <p className="font-semibold text-ink">
                            {topic.topic_title || <span className="italic text-red-800">(Blank topic title)</span>}
                          </p>
                          <p className="mt-0.5 text-sm text-red-900">Needs a speaker</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAssigningTopic(topic)}
                        aria-label={`Assign a speaker to ${topic.topic_title || 'untitled topic'} in ${session.session_code}`}
                        className={`${goBtn} border-red-300 text-red-800 hover:bg-red-100`}
                      >
                        <PlusIcon width={14} height={14} /> Assign
                      </button>
                    </li>
                  ))}
                </ul>
                )}
              </section>
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
