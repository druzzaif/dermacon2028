'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabase';
import { formatTime12 } from '../lib/time';
import { sortTopicPeople, roleName } from '../lib/topicPeople';
import { LoadingBlock, EmptyState } from './ui';

// Every session of one hall (optionally one date), each with its topics underneath
export default function HallOverview({ sessions, hall, active, onOpen, onClose, restoreScroll, onScrollPositionChange }: {
  sessions: any[];
  hall: string;
  active: boolean;
  onOpen: (s: any) => void;
  onClose: () => void;
  restoreScroll: { request: number; top: number } | null;
  onScrollPositionChange: (scrollTop: number) => void;
}) {
  const [topics, setTopics] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const scrollContainer = useRef<HTMLDivElement>(null);
  const key = sessions.map((s) => s.id).join(',');

  useEffect(() => {
    if (!active) return;
    let live = true;
    setLoading(true);
    if (!sessions.length) { setTopics({}); setLoading(false); return; }
    supabase.from('session_topics')
      .select('id, session_id, topic_title, sequence_no, start_time, end_time, faculty_topics ( role, sort_order, faculty ( canonical_name ) )')
      .in('session_id', sessions.map((s) => s.id))
      .order('sequence_no', { ascending: true })
      .then(({ data }) => {
        if (!live) return;
        const by: Record<string, any[]> = {};
        (data || []).forEach((t: any) => { (by[t.session_id] ||= []).push(t); });
        setTopics(by);
        setLoading(false);
      });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, active]);

  useEffect(() => {
    if (active && !loading && restoreScroll && scrollContainer.current) {
      scrollContainer.current.scrollTop = restoreScroll.top;
    }
  }, [active, loading, restoreScroll, key]);

  const date = (d: string | null) => d ? new Date(`${d}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }) : 'No date';
  const sorted = [...sessions].sort((a, b) =>
    String(a.session_date || '9999').localeCompare(String(b.session_date || '9999')) ||
    String(a.start_time || '').localeCompare(String(b.start_time || '')));

  return (
    <div
      ref={scrollContainer}
      onScroll={(e) => onScrollPositionChange(e.currentTarget.scrollTop)}
      className="min-h-0 flex-1 overflow-auto p-4 sm:p-6"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-ink sm:text-2xl">Hall {hall} · all sessions</h1>
        <button type="button" onClick={onClose} className="text-sm font-medium text-accent hover:underline">Close hall view</button>
      </div>
      {loading ? <LoadingBlock>Loading the hall programme…</LoadingBlock> : sorted.length === 0 ? (
        <EmptyState title="No sessions">There are no sessions in this hall for the chosen date.</EmptyState>
      ) : (
        <div className="space-y-5">
          {sorted.map((s) => {
            const list = topics[s.id] || [];
            return (
              <section key={s.id} className="overflow-hidden rounded-xl border border-line bg-white shadow-card">
                <button type="button" onClick={() => onOpen(s)} className="flex w-full flex-wrap items-center gap-3 border-b border-line bg-accent-tint px-4 py-3 text-left hover:bg-slate-50">
                  <span className="tnum rounded-lg bg-accent px-2.5 py-0.5 text-sm font-semibold text-white">{s.session_code}</span>
                  <span className="min-w-0 flex-1 text-[15px] font-semibold text-ink">{s.session_name || 'Untitled session'}</span>
                  <span className="tnum text-sm text-ink-2">{date(s.session_date)} · {formatTime12(s.start_time)} – {formatTime12(s.end_time)}</span>
                </button>
                {list.length === 0 ? <p className="px-4 py-3 text-sm text-ink-2">No topics yet.</p> : (
                  <ul className="divide-y divide-line">
                    {list.map((t) => {
                      const people = sortTopicPeople((t.faculty_topics || []).filter((f: any) => f.role !== 'Chairperson'));
                      return (
                        <li key={t.id} className="flex gap-3 px-4 py-2.5">
                          <span className="tnum w-8 shrink-0 text-center text-sm font-semibold text-muted">{t.sequence_no}</span>
                          <span className="tnum w-36 shrink-0 text-sm text-ink-2">{formatTime12(t.start_time)} – {formatTime12(t.end_time)}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[15px] font-medium text-ink">{t.topic_title}</span>
                            <span className="block text-sm text-ink-2">
                              {people.length ? people.map((f: any) => `${f.faculty?.canonical_name}${f.role && f.role !== 'Faculty' ? ` (${roleName(f.role)})` : ''}`).join(', ') : 'No speaker yet'}
                            </span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
