'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import AssignFacultyModal from '../components/AssignFacultyModal';
import { ArrowUpRightIcon, CalendarIcon, ChevronDownIcon, ClockIcon, PinIcon, PlusIcon } from '../components/Icons';
import { Button, EmptyState, LoadingBlock, PageHeader, PageShell, buttonCls, cardCls } from '../components/ui';
import { formatTime12 } from '../lib/time';

function dateLabel(d: string | null | undefined) {
  if (!d) return null;
  const dt = new Date(`${d}T00:00:00`);
  return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

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
      <PageShell>
        <PageHeader title="To-do" description="Sessions and topics that still need your attention." />
        <LoadingBlock>Checking every session for missing information…</LoadingBlock>
      </PageShell>
    );
  }

  const countFor = (s: any) => (s.isEmpty ? 1 : 0) + s.missingTopics.length + (s.hasCoordinators ? 0 : 1);
  const totalItems = groupedData.reduce((n, s) => n + countFor(s), 0);
  const allOpen = groupedData.length > 0 && groupedData.every((s) => openIds.has(String(s.id)));

  // One quiet row per thing to fix: plain white, a thin marker on the left, and a small button
  const row = 'flex flex-col justify-between gap-3 border-l-2 border-l-blue-300 py-3 pl-4 pr-1 sm:flex-row sm:items-center';

  return (
    <>
      <PageShell>
        <PageHeader
          title="To-do"
          description={
            groupedData.length === 0
              ? 'Sessions and topics that still need your attention.'
              : `${totalItems} thing${totalItems === 1 ? '' : 's'} to fix in ${groupedData.length} session${groupedData.length === 1 ? '' : 's'}: sessions without topics, topics without a speaker, and sessions without coordinators.`
          }
          actions={
            groupedData.length > 0 ? (
              <Button
                onClick={() => setOpenIds(allOpen ? new Set() : new Set(groupedData.map((s) => String(s.id))))}
              >
                {allOpen ? 'Collapse all' : 'Expand all'}
              </Button>
            ) : undefined
          }
        />

        {groupedData.length === 0 ? (
          <div className={cardCls}>
            <EmptyState tone="success" title="Everything is in place">
              All sessions have topics, faculty and coordinators assigned.
            </EmptyState>
          </div>
        ) : (
          <div className={`divide-y divide-line overflow-hidden ${cardCls}`}>
            {groupedData.map((session) => {
              const open = openIds.has(String(session.id));
              const date = dateLabel(session.session_date);
              return (
                <section key={session.id} aria-labelledby={`session-${session.id}`}>
                  <button
                    type="button"
                    onClick={() => toggle(String(session.id))}
                    aria-expanded={open}
                    className={`flex w-full flex-wrap items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-blue-50/70 sm:px-5 ${open ? 'bg-blue-50/70' : ''}`}
                  >
                    <span className="tnum inline-flex h-7 min-w-12 items-center justify-center rounded-md bg-blue-50 px-2 text-sm font-semibold text-blue-900 ring-1 ring-inset ring-blue-200">
                      {session.session_code}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span id={`session-${session.id}`} className="block text-[15px] font-semibold text-ink">
                        {session.session_name || 'Untitled session'}
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-sm text-ink-2">
                        <span className="tnum inline-flex items-center gap-1.5">
                          <CalendarIcon /> {date || <span className="font-medium text-danger">No date</span>}
                        </span>
                        <span className="tnum inline-flex items-center gap-1.5">
                          <ClockIcon /> {session.start_time ? formatTime12(session.start_time) : <span className="font-medium text-danger">No time</span>}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <PinIcon /> {session.hall ? `Hall ${session.hall}` : <span className="font-medium text-danger">No hall</span>}
                        </span>
                      </span>
                    </span>
                    <span className="tnum text-sm font-medium text-blue-900">{countFor(session)} to fix</span>
                    <ChevronDownIcon
                      className={`shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`}
                      width={20}
                      height={20}
                    />
                  </button>

                  {open && (
                    <div className="border-t border-blue-100 bg-white px-4 py-2 sm:px-5">
                      <ul className="divide-y divide-blue-100">
                        {session.isEmpty && (
                          <li className={row}>
                            <div>
                              <p className="font-medium text-ink">This session has no topics yet</p>
                              <p className="text-sm text-ink-2">Add topics to build the programme.</p>
                            </div>
                            <a href={`/sessions?code=${session.session_code}`} className={buttonCls('quiet', 'sm', 'border border-blue-200')}>
                              Go to session <ArrowUpRightIcon width={14} height={14} />
                            </a>
                          </li>
                        )}

                        {!session.hasCoordinators && (
                          <li className={row}>
                            <div>
                              <p className="font-medium text-ink">No coordinators assigned</p>
                              <p className="text-sm text-ink-2">Assign a lead, national or local coordinator.</p>
                            </div>
                            <a href={`/sessions?code=${session.session_code}`} className={buttonCls('quiet', 'sm', 'border border-blue-200')}>
                              Edit coordinators <ArrowUpRightIcon width={14} height={14} />
                            </a>
                          </li>
                        )}

                        {session.missingTopics.map((topic: any) => (
                          <li key={topic.id} className={row}>
                            <div className="flex min-w-0 items-start gap-3">
                              <span className="tnum mt-0.5 inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded bg-blue-50 px-1.5 text-xs font-semibold text-blue-900">
                                <span className="sr-only">Number </span>{topic.sequence_no || '?'}
                              </span>
                              <div className="min-w-0">
                                <p className="font-medium text-ink">
                                  {topic.topic_title || <span className="italic text-ink-2">(Blank topic title)</span>}
                                </p>
                                <p className="text-sm text-ink-2">Needs a speaker</p>
                              </div>
                            </div>
                            <Button
                              variant="quiet"
                              size="sm"
                              className="border border-blue-200"
                              onClick={() => setAssigningTopic(topic)}
                              aria-label={`Assign a speaker to ${topic.topic_title || 'untitled topic'} in ${session.session_code}`}
                            >
                              <PlusIcon /> Assign speaker
                            </Button>
                          </li>
                        ))}
                      </ul>
                      <div className="border-t border-line py-2.5">
                        <a href={`/sessions?code=${session.session_code}`} className="text-sm font-medium text-accent hover:underline">
                          Open session {session.session_code}
                        </a>
                      </div>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}
      </PageShell>

      {assigningTopic && (
        <AssignFacultyModal
          topic={assigningTopic}
          onClose={() => setAssigningTopic(null)}
          onSaved={fetchMissingData}
        />
      )}
    </>
  );
}
