'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import SendEmailsDialog from './SendEmailsDialog';
import Badge from './Badge';
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

  return (
    <div className="fixed inset-0 bg-black/40 flex justify-end z-50">
      <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col animate-slide-in">
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
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-800 text-3xl leading-none"
          >
            &times;
          </button>
        </div>

        <div className="p-6 border-b border-gray-200 space-y-4 bg-white">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                Email
              </div>
              {email ? (
                <a
                  href={`mailto:${email}`}
                  className="text-sm text-blue-600 hover:text-blue-800 hover:underline truncate block"
                  title={email}
                >
                  {email}
                </a>
              ) : (
                <div className="text-sm text-gray-400">--</div>
              )}
            </div>
            <div>
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                Phone
              </div>
              {phone ? (
                <a
                  href={`tel:${phoneDigits}`}
                  className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                >
                  {phone}
                </a>
              ) : (
                <div className="text-sm text-gray-400">--</div>
              )}
            </div>
            <div>
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                Country
              </div>
              <div className="text-sm text-gray-900">{faculty.country || '--'}</div>
            </div>
            <div>
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                Type
              </div>
              <div className="text-sm text-gray-900">{faculty.person_type || '--'}</div>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100">
            <button
              onClick={() => setShowSend(true)}
              disabled={speakingSessions.length === 0}
              className="w-full bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {kind === 'update' ? 'Email schedule update…' : 'Email schedule…'}
            </button>
            <p className="mt-1.5 text-center text-xs text-gray-500">
              You will see exactly what is sent before anything goes out.
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain bg-gray-50 p-6 space-y-6">
          {coordinatingSessions.length > 0 && (
            <div>
              <h3 className="text-sm font-bold text-purple-800 uppercase tracking-wider mb-3 border-b border-purple-200 pb-2">
                Coordinating Roles ({coordinatingSessions.length})
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
                        <div className="font-bold text-gray-900 text-sm group-hover:text-purple-700 transition-colors">
                          {session?.session_code} - {session?.session_name}
                        </div>
                        <div className="text-[10px] font-bold text-white bg-purple-600 px-2 py-0.5 rounded uppercase shadow-sm">
                          {c.role}
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 mt-2 flex justify-between">
                        <span>{formatDateDdMmYyyy(session?.session_date)}</span>
                        <span>Hall {session?.hall || 'TBD'}</span>
                      </div>
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <h3 className="text-sm font-bold text-blue-800 uppercase tracking-wider mb-3 border-b border-blue-200 pb-2">
              Schedule ({speakingSessions.length})
            </h3>

            {loading ? (
              <div className="text-center text-gray-500 text-sm py-4">Loading...</div>
            ) : speakingSessions.length === 0 ? (
              <div className="text-center text-gray-500 italic text-sm py-4 bg-white rounded-lg border border-gray-200">
                No topics assigned yet.
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
                        <div className="font-bold text-blue-800 text-sm group-hover:text-blue-600 transition-colors">
                          {session?.session_code}
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          {s.confirmed && <Badge tone="success">Confirmed</Badge>}
                          <div className="text-xs font-bold text-gray-600 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded">
                            {s.role}
                          </div>
                        </div>
                      </div>
                      <div className="text-sm font-medium text-gray-900 mb-2 leading-tight">
                        {topic?.topic_title}
                      </div>
                      <div className="flex justify-between text-xs text-gray-500 mt-2 pt-2 border-t border-gray-100 gap-2">
                        <span>{formatDateDdMmYyyy(session?.session_date)}</span>
                        <span className="whitespace-nowrap">
                          {formatTimeAmPm(topic?.start_time)} - {formatTimeAmPm(topic?.end_time)}
                        </span>
                        <span>Hall {session?.hall || 'TBD'}</span>
                      </div>
                      {s.confirmed && (
                        <div className="mt-2 flex justify-end">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setUnconfirming(s);
                            }}
                            className="text-xs font-medium text-red-700 border border-red-200 bg-red-50 hover:bg-red-100 px-2.5 py-1 rounded"
                          >
                            Remove confirmation
                          </button>
                        </div>
                      )}
                    </a>
                  );
                })}
              </div>
            )}
          </div>
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
