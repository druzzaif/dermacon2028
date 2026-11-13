'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import SendEmailsDialog from './SendEmailsDialog';
import Badge, { roleTone } from './Badge';
import { Button, LoadingBlock } from './ui';
import { CloseIcon } from './Icons';
import { roleName } from '../lib/topicPeople';
import ConfirmDeleteDialog from './ConfirmDeleteDialog';
import { removeConfirmation } from '../actions';

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

export default function FacultyProfileModal({
  faculty,
  onClose,
  onChanged,
}: {
  faculty: any;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const [speakingSessions, setSpeakingSessions] = useState<any[]>([]);
  const [coordinatingSessions, setCoordinatingSessions] = useState<any[]>([]);
  // Sessions this person chairs as a whole (not a single topic)
  const [chairSessions, setChairSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSend, setShowSend] = useState(false);
  const [unconfirming, setUnconfirming] = useState<any | null>(null);

  async function handleRemoveConfirmation() {
    const s = unconfirming;
    const res = await removeConfirmation(faculty.id, s.topic_id);
    if (!res.success) throw new Error(res.message);
    setSpeakingSessions((prev) =>
      prev.map((x) => (x.topic_id === s.topic_id ? { ...x, confirmed: false } : x))
    );
    setUnconfirming(null);
    onChanged?.();
  }

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  useEffect(() => {
    async function fetchProfileData() {
      const { data: topicsData } = await supabase
        .from('faculty_topics')
        .select(
          `
          topic_id,
          role,
          confirmed,
          session_topics (
            topic_title,
            start_time,
            end_time,
            conference_sessions ( session_code, session_name, session_date, hall )
          )
        `
        )
        .eq('faculty_id', faculty.id);

      if (topicsData) {
        const sortedTopics = topicsData.sort((a: any, b: any) => {
          const dateA = a.session_topics?.conference_sessions?.session_date || '';
          const dateB = b.session_topics?.conference_sessions?.session_date || '';
          return dateA.localeCompare(dateB);
        });
        setSpeakingSessions(sortedTopics);
      }

      const { data: coordData } = await supabase
        .from('session_coordinators')
        .select(
          `
          role,
          conference_sessions ( session_code, session_name, session_date, hall )
        `
        )
        .eq('faculty_id', faculty.id);

      if (coordData) {
        const sortedCoords = coordData.sort((a: any, b: any) => {
          const dateA = a.conference_sessions?.session_date || '';
          const dateB = b.conference_sessions?.session_date || '';
          return dateA.localeCompare(dateB);
        });
        setCoordinatingSessions(sortedCoords);
      }

      const { data: chairData } = await supabase
        .from('session_chairs')
        .select(`confirmed, conference_sessions ( session_code, session_name, session_date, hall, start_time, end_time )`)
        .eq('faculty_id', faculty.id);
      if (chairData) {
        setChairSessions(
          [...(chairData as any[])]
            .filter((c) => c.conference_sessions)
            .sort((a, b) => String(a.conference_sessions.session_date || '').localeCompare(String(b.conference_sessions.session_date || ''))),
        );
      }

      setLoading(false);
    }
    fetchProfileData();
  }, [faculty.id]);

  const initials = faculty.canonical_name
    ?.replace('Dr. ', '')
    .replace('Dr ', '')
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const email = faculty.email || '';
  const phone = faculty.phone || '';
  const phoneDigits = phone.replace(/[^0-9+]/g, '');

  // Already emailed before -> send a schedule update; otherwise the first full email
  const kind = faculty.email_sent ? 'update' : 'first';

  // Topics grouped under a heading per role: Chairperson, Moderator, Panelist, Debater, Faculty (speaker)
  const TOPIC_ROLE_ORDER = ['Chairperson', 'Moderator', 'Panelist', 'Debater', 'Faculty'];
  const roleGroups = new Map<string, any[]>();
  for (const s of speakingSessions) {
    const r = roleName(s.role);
    roleGroups.set(r, [...(roleGroups.get(r) || []), s]);
  }
  const orderedRoleGroups = [...roleGroups.entries()].sort(
    ([a], [b]) =>
      (TOPIC_ROLE_ORDER.indexOf(a) === -1 ? 99 : TOPIC_ROLE_ORDER.indexOf(a)) -
      (TOPIC_ROLE_ORDER.indexOf(b) === -1 ? 99 : TOPIC_ROLE_ORDER.indexOf(b)),
  );
  const headingFor = (role: string) => (role === 'Faculty' ? 'Speaker' : role);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/50"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={(e) => { if (e.key === 'Escape' && !showSend && !unconfirming) onClose(); }}
    >
      <div role="dialog" aria-modal="true" aria-label={`Profile of ${faculty.canonical_name}`} className="modal-in flex h-full w-full max-w-md flex-col bg-white shadow-pop">
        <div className="flex items-start justify-between gap-3 border-b border-line bg-canvas p-5">
          <div className="flex min-w-0 items-center gap-3.5">
            <div aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent-tint text-base font-semibold text-accent ring-1 ring-inset ring-indigo-200">
              {initials}
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold text-ink">{faculty.canonical_name}</h2>
              <p className="tnum font-mono text-sm text-muted">{faculty.faculty_id}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            autoFocus
            aria-label="Close profile"
            title="Close"
            className="-mr-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-ink-2 transition-colors hover:bg-danger hover:text-white"
          >
            <CloseIcon width={24} height={24} strokeWidth={2.25} />
          </button>
        </div>

        <div className="space-y-4 border-b border-line bg-white p-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
                Email
              </div>
              {email ? (
                <a
                  href={`mailto:${email}`}
                  className="text-sm text-accent hover:underline truncate block"
                  title={email}
                >
                  {email}
                </a>
              ) : (
                <div className="text-sm text-muted">Not set</div>
              )}
            </div>
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
                Phone
              </div>
              {phone ? (
                <a
                  href={`tel:${phoneDigits}`}
                  className="text-sm text-accent hover:underline"
                >
                  {phone}
                </a>
              ) : (
                <div className="text-sm text-muted">Not set</div>
              )}
            </div>
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
                Country
              </div>
              <div className="text-sm text-ink">{faculty.country || 'Not set'}</div>
            </div>
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
                Type
              </div>
              <div className="text-sm text-ink">{faculty.person_type || 'Not set'}</div>
            </div>
          </div>

          <div className="border-t border-line pt-4">
            <Button
              variant="primary"
              className="w-full"
              onClick={() => setShowSend(true)}
              disabled={loading || (speakingSessions.length === 0 && chairSessions.length === 0)}
            >
              {kind === 'update' ? 'Email schedule update…' : 'Email schedule…'}
            </Button>
            <p className="mt-1.5 text-center text-xs text-muted">
              You will see exactly what is sent before anything goes out.
            </p>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain bg-canvas p-5">
          {loading && <LoadingBlock>Loading roles…</LoadingBlock>}

          {!loading && coordinatingSessions.length === 0 && speakingSessions.length === 0 && chairSessions.length === 0 && (
            <p className="rounded-xl border border-dashed border-field bg-white p-6 text-center text-sm text-ink-2">
              No sessions or topics assigned yet.
            </p>
          )}

          {coordinatingSessions.length > 0 && (
            <section aria-labelledby="role-coordinator">
              <h3 id="role-coordinator" className="mb-2.5 flex items-center justify-between border-b border-line pb-2 text-sm font-semibold text-ink">
                Coordinator
                <span className="tnum rounded-full bg-slate-200 px-2 py-0.5 text-xs text-ink-2">{coordinatingSessions.length}</span>
              </h3>
              <div className="space-y-2.5">
                {coordinatingSessions.map((c, i) => {
                  const session = c.conference_sessions;
                  return (
                    <a
                      key={i}
                      href={`/sessions?code=${session?.session_code}`}
                      className="block rounded-xl border border-line bg-white p-3.5 shadow-sm transition-colors hover:border-accent"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-sm font-semibold text-ink">
                          <span className="tnum text-accent">{session?.session_code}</span> · {session?.session_name}
                        </div>
                        <Badge tone={roleTone(c.role)}>{c.role}</Badge>
                      </div>
                      <div className="mt-2 flex justify-between gap-2 text-xs text-ink-2">
                        <span className="tnum">{formatDateDdMmYyyy(session?.session_date)}</span>
                        <span>Hall {session?.hall || 'not set'}</span>
                      </div>
                    </a>
                  );
                })}
              </div>
            </section>
          )}

          {chairSessions.length > 0 && (
            <section aria-labelledby="role-session-chair">
              <h3 id="role-session-chair" className="mb-2.5 flex items-center justify-between border-b border-line pb-2 text-sm font-semibold text-ink">
                Session chair
                <span className="tnum rounded-full bg-slate-200 px-2 py-0.5 text-xs text-ink-2">{chairSessions.length}</span>
              </h3>
              <div className="space-y-2.5">
                {chairSessions.map((c, i) => {
                  const session = c.conference_sessions;
                  return (
                    <a
                      key={i}
                      href={`/sessions?code=${session?.session_code}`}
                      className="block rounded-xl border border-line bg-white p-3.5 shadow-sm transition-colors hover:border-accent"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-sm font-semibold text-ink">
                          <span className="tnum text-accent">{session?.session_code}</span> · {session?.session_name}
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          {c.confirmed && <Badge tone="success">Confirmed</Badge>}
                          <Badge tone="orange">Chairperson</Badge>
                        </div>
                      </div>
                      <div className="tnum mt-2 flex justify-between gap-2 border-t border-line pt-2 text-xs text-ink-2">
                        <span>{formatDateDdMmYyyy(session?.session_date)}</span>
                        <span className="whitespace-nowrap">
                          {formatTimeAmPm(session?.start_time)} – {formatTimeAmPm(session?.end_time)}
                        </span>
                        <span>Hall {session?.hall || 'not set'}</span>
                      </div>
                    </a>
                  );
                })}
              </div>
            </section>
          )}

          {orderedRoleGroups.map(([role, list]) => (
            <section key={role} aria-labelledby={`role-${role}`}>
              <h3 id={`role-${role}`} className="mb-2.5 flex items-center justify-between border-b border-line pb-2 text-sm font-semibold text-ink">
                {headingFor(role)}
                <span className="tnum rounded-full bg-slate-200 px-2 py-0.5 text-xs text-ink-2">{list.length}</span>
              </h3>
              <div className="space-y-2.5">
                {list.map((s, i) => {
                  const topic = s.session_topics;
                  const session = topic?.conference_sessions;
                  return (
                    <a
                      key={i}
                      href={`/sessions?code=${session?.session_code}`}
                      className="block rounded-xl border border-line bg-white p-3.5 shadow-sm transition-colors hover:border-accent"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="text-sm font-semibold text-ink">
                          <span className="tnum text-accent">{session?.session_code}</span>
                          {session?.session_name ? <> · {session.session_name}</> : null}
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                          {s.confirmed && <Badge tone="success">Confirmed</Badge>}
                          <Badge tone={roleTone(s.role)}>{roleName(s.role)}</Badge>
                        </div>
                      </div>
                      <div className="mt-1.5 text-sm leading-snug text-ink">{topic?.topic_title}</div>
                      <div className="tnum mt-2 flex justify-between gap-2 border-t border-line pt-2 text-xs text-ink-2">
                        <span>{formatDateDdMmYyyy(session?.session_date)}</span>
                        <span className="whitespace-nowrap">
                          {formatTimeAmPm(topic?.start_time)} – {formatTimeAmPm(topic?.end_time)}
                        </span>
                        <span>Hall {session?.hall || 'not set'}</span>
                      </div>
                      {s.confirmed && (
                        <div className="mt-2 flex justify-end">
                          <Button
                            variant="danger-quiet"
                            size="sm"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setUnconfirming(s);
                            }}
                          >
                            Remove confirmation
                          </Button>
                        </div>
                      )}
                    </a>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </div>

      {showSend && (
        <SendEmailsDialog
          items={[{ facultyId: faculty.id, kind }]}
          onClose={() => setShowSend(false)}
        />
      )}

      {unconfirming && (
        <ConfirmDeleteDialog
          title="Remove confirmation?"
          description={
            <>
              <p>
                <strong>{faculty.canonical_name}</strong> will be shown as <strong>not confirmed</strong> for{' '}
                <strong>
                  {unconfirming.session_topics?.conference_sessions?.session_code} –{' '}
                  {unconfirming.session_topics?.topic_title}
                </strong>.
              </p>
              <p className="mt-2 text-gray-500">
                This changes your PC only, so it is instant. The next <strong>Sync confirmations</strong> also
                removes it from the Google sheet. If they confirm again on the form after that, it comes back.
              </p>
            </>
          }
          confirmLabel="Remove confirmation"
          busyLabel="Removing..."
          onConfirm={handleRemoveConfirmation}
          onCancel={() => setUnconfirming(null)}
        />
      )}
    </div>
  );
}
