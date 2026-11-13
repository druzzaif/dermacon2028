// @ts-nocheck

'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import Badge from '../components/Badge';
import { AlertIcon, ClockIcon, PinIcon } from '../components/Icons';
import { EmptyState, LoadingBlock, PageHeader, PageShell, Tabs, cardCls } from '../components/ui';

function formatDateDdMmYyyy(dateStr: string | null | undefined): string {
  if (!dateStr) return '--';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
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

function isTbdFacultyName(name: string | null | undefined): boolean {
  if (!name) return false;
  const n = name.trim().toUpperCase();
  if (n === '') return false;
  // Match any variant of "TBD ..." (e.g. "TBD (To Be Determined)")
  if (n === 'TBD' || n.startsWith('TBD ') || n.startsWith('TBD(')) return true;
  // Match empty faculty_id fallback used by the seed importer
  if (n === 'FAC000') return true;
  return false;
}

function isRealHallForOverlap(hall: string | null | undefined): boolean {
  if (!hall) return false;
  const t = hall.trim().toLowerCase();
  if (t === '')     return false;
  if (t === 'tbd')  return false;
  if (t === 'null') return false;
  return true;
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

      const { data: topics } = await (supabase.from('session_topics').select(`
        id, topic_title, start_time, end_time,
        conference_sessions ( session_code, session_name, session_date, hall ),
        faculty_topics ( faculty ( canonical_name ) )
      `) as any);

      if (!topics) {
        setLoading(false);
        return;
      }

      // FACULTY OVERLAPS
      const facultyIssues: any[] = [];
      const facultySchedules: Record<string, any[]> = {};

      topics.forEach((t) => {
        // Skip topics that are in TBD or blank halls entirely for faculty overlaps
        if (!isRealHallForOverlap((t.conference_sessions as any)?.hall)) return;

        t.faculty_topics?.forEach((ft: any) => {
          const name = ft.faculty?.canonical_name;
          if (!name) return;
          // 1A: TBD placeholder is not a real person - never count it as
          // a faculty overlap (otherwise TBD vs TBD floods the report).
          if (isTbdFacultyName(name)) return;
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
        if (!isRealHallForOverlap(hall)) return;
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

  function SessionCard({ t, showHall }: { t: any; showHall?: boolean }) {
    const cs = t.conference_sessions;
    return (
      <div className="rounded-lg bg-canvas p-4 ring-1 ring-inset ring-line">
        <a
          href={`/sessions?code=${encodeURIComponent(cs.session_code)}`}
          className="tnum inline-flex h-7 items-center rounded-md bg-accent px-2 text-sm font-semibold text-white hover:bg-accent-strong"
          title={`Open session ${cs.session_code}`}
        >
          {cs.session_code}
        </a>
        <div className="mt-2 font-medium text-ink">{cs.session_name}</div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-2">
          <span className="tnum inline-flex items-center gap-1.5">
            <ClockIcon /> <span className="sr-only">Time:</span>
            {formatTimeAmPm(t.start_time)} – {formatTimeAmPm(t.end_time)}
          </span>
          {showHall && (
            <span className="inline-flex items-center gap-1.5">
              <PinIcon /> <span className="sr-only">Hall:</span>
              {cs.hall}
            </span>
          )}
        </div>
        {showHall && t.topic_title && (
          <p className="mt-3 border-t border-line pt-3 text-sm italic text-ink">“{t.topic_title}”</p>
        )}
      </div>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Conflicts"
        description="Faculty booked in two places at once, and halls booked twice at the same time. Checked automatically; sessions without a hall are skipped."
      />

      <Tabs
        label="Conflict type"
        idPrefix="conflict"
        items={[
          { key: 'faculty' as const, label: 'Faculty double-booked', count: loading ? undefined : overlaps.length },
          { key: 'hall' as const, label: 'Hall double-booked', count: loading ? undefined : hallOverlaps.length },
        ]}
        value={activeTab}
        onChange={setActiveTab}
      />

      {loading ? (
        <LoadingBlock>Checking the whole schedule for clashes…</LoadingBlock>
      ) : (
        <>
          <div id="conflict-panel-faculty" role="tabpanel" aria-labelledby="conflict-faculty" hidden={activeTab !== 'faculty'} className="space-y-4">
            {overlaps.length === 0 ? (
              <div className={cardCls}>
                <EmptyState tone="success" title="No faculty member is double-booked">
                  Nobody is scheduled in two sessions at the same time.
                </EmptyState>
              </div>
            ) : (
              overlaps.map((issue, idx) => (
                <article key={idx} className={`border-l-4 border-l-danger p-5 ${cardCls}`}>
                  <h2 className="mb-4 flex flex-wrap items-center gap-2 text-lg font-semibold text-ink">
                    <AlertIcon className="text-danger" width={20} height={20} />
                    {issue.name}
                    <span className="text-sm font-normal text-ink-2">is booked twice</span>
                  </h2>
                  <div className="grid gap-4 md:grid-cols-2">
                    <SessionCard t={issue.a} showHall />
                    <SessionCard t={issue.b} showHall />
                  </div>
                </article>
              ))
            )}
          </div>

          <div id="conflict-panel-hall" role="tabpanel" aria-labelledby="conflict-hall" hidden={activeTab !== 'hall'} className="space-y-4">
            {hallOverlaps.length === 0 ? (
              <div className={cardCls}>
                <EmptyState tone="success" title="No hall is double-booked">
                  No two sessions use the same hall at the same time.
                </EmptyState>
              </div>
            ) : (
              hallOverlaps.map((issue, idx) => (
                <article key={idx} className={`border-l-4 border-l-orange-600 p-5 ${cardCls}`}>
                  <h2 className="mb-4 flex flex-wrap items-center gap-2 text-lg font-semibold text-ink">
                    <AlertIcon className="text-orange-700" width={20} height={20} />
                    Hall {issue.hall}
                    <Badge tone="orange" className="tnum">{formatDateDdMmYyyy(issue.date)}</Badge>
                  </h2>
                  <div className="grid gap-4 md:grid-cols-2">
                    <SessionCard t={issue.a} />
                    <SessionCard t={issue.b} />
                  </div>
                </article>
              ))
            )}
          </div>
        </>
      )}
    </PageShell>
  );
}
