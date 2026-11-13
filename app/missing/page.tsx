'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import AssignFacultyModal from '../components/AssignFacultyModal';
import Badge from '../components/Badge';
import { AlertIcon, ArrowUpRightIcon, CalendarIcon, ChevronDownIcon, ClockIcon, PinIcon, PlusIcon } from '../components/Icons';
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
          <div className="space-y-4">
            {groupedData.map((session) => {
              const open = openIds.has(String(session.id));
              const date = dateLabel(session.session_date);
              return (
                <section
                  key={session.id}
                  aria-labelledby={`session-${session.id}`}
                  className={`overflow-hidden ${cardCls}`}
                >
                  <button
                    type="button"
                    onClick={() => toggle(String(session.id))}
                    aria-expanded={open}
                    className="flex w-full flex-wrap items-center gap-3 p-4 text-left transition-colors hover:bg-slate-50 sm:px-5"
                  >
                    <span className="tnum inline-flex h-8 items-center rounded-lg bg-accent px-2.5 text-sm font-semibold text-white">
                      {session.session_code}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span id={`session-${session.id}`} className="block text-base font-semibold text-ink">
                        {session.session_name || 'Untitled session'}
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-sm text-ink-2">
                        <span className="inline-flex items-center gap-1.5 tnum">
                          <CalendarIcon /> {date || <span className="font-medium text-danger">No date</span>}
                        </span>
                        <span className="inline-flex items-center gap-1.5 tnum">
                          <ClockIcon /> {session.start_time ? formatTime12(session.start_time) : <span className="font-medium text-danger">No time</span>}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <PinIcon /> {session.hall ? `Hall ${session.hall}` : <span className="font-medium text-danger">No hall</span>}
                        </span>
                      </span>
                    </span>
                    <Badge tone="danger">{countFor(session)} to fix</Badge>
                    <ChevronDownIcon
                      className={`shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`}
                      width={20}
                      height={20}
                    />
                  </button>

                  {open && (
                    <div className="border-t border-line">
                      <ul className="space-y-2.5 p-4 sm:p-5">
                        {session.isEmpty && (
                          <li className="flex flex-col justify-between gap-3 rounded-lg border border-danger-line bg-danger-tint p-3.5 sm:flex-row sm:items-center">
                            <div className="flex items-start gap-3">
                              <AlertIcon className="mt-0.5 shrink-0 text-danger" width={20} height={20} />
                              <div>
                                <p className="font-semibold text-ink">This session has no topics yet</p>
                                <p className="mt-0.5 text-sm text-danger-strong">Add topics to build the programme.</p>
                              </div>
                            </div>
                            <a href={`/sessions?code=${session.session_code}`} className={buttonCls('secondary')}>
                              Go to session <ArrowUpRightIcon width={14} height={14} />
                            </a>
                          </li>
                        )}

                        {!session.hasCoordinators && (
                          <li className="flex flex-col justify-between gap-3 rounded-lg border border-warning-line bg-warning-tint p-3.5 sm:flex-row sm:items-center">
                            <div className="flex items-start gap-3">
                              <AlertIcon className="mt-0.5 shrink-0 text-warning" width={20} height={20} />
                              <div>
                                <p className="font-semibold text-ink">No coordinators assigned</p>
                                <p className="mt-0.5 text-sm text-warning">Assign a lead, national or local coordinator.</p>
                              </div>
                            </div>
                            <a href={`/sessions?code=${session.session_code}`} className={buttonCls('secondary')}>
                              Edit coordinators <ArrowUpRightIcon width={14} height={14} />
                            </a>
                          </li>
                        )}

                        {session.missingTopics.map((topic: any) => (
                          <li key={topic.id} className="flex flex-col justify-between gap-3 rounded-lg border border-danger-line bg-danger-tint p-3.5 sm:flex-row sm:items-center">
                            <div className="flex items-start gap-3">
                              <span className="tnum inline-flex h-8 min-w-8 shrink-0 items-center justify-center rounded-lg bg-white px-2 text-sm font-semibold text-danger-strong ring-1 ring-inset ring-danger-line">
                                <span className="sr-only">Number </span>{topic.sequence_no || '?'}
                              </span>
                              <div>
                                <p className="font-semibold text-ink">
                                  {topic.topic_title || <span className="italic text-danger-strong">(Blank topic title)</span>}
                                </p>
                                <p className="mt-0.5 text-sm text-danger-strong">Needs a speaker</p>
                              </div>
                            </div>
                            <Button
                              variant="primary"
                              onClick={() => setAssigningTopic(topic)}
                              aria-label={`Assign a speaker to ${topic.topic_title || 'untitled topic'} in ${session.session_code}`}
                            >
                              <PlusIcon /> Assign speaker
                            </Button>
                          </li>
                        ))}
                      </ul>
                      <div className="border-t border-line bg-canvas px-4 py-2.5 sm:px-5">
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
