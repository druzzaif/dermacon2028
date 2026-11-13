'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabase';
import Modal from './Modal';
import Badge from './Badge';
import { inputCls } from './Field';
import { buttonCls } from './ui';

type FacultyLite = { id: string; canonical_name: string; email: string | null };
type Topic = {
  id: string;
  topic_title: string;
  start_time: string | null;
  end_time: string | null;
  sequence_no: number | null;
  speakers: FacultyLite[];
};

function fmtTime(t: string | null) {
  if (!t) return '--:--';
  const [hs, ms] = t.split(':');
  let h = parseInt(hs, 10);
  const ap = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12; else if (h > 12) h -= 12;
  return `${h}:${ms} ${ap}`;
}

/**
 * Choose the chairpersons of each topic in a session. A topic can have any number of
 * chairs. Chairs are stored in faculty_topics with role "Chairperson"; speakers are untouched.
 */
export default function EditChairpersonsModal({
  session,
  onClose,
  onSaved,
}: {
  session: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [everyone, setEveryone] = useState<FacultyLite[]>([]);
  const [original, setOriginal] = useState<Record<string, string[]>>({});
  const [chairs, setChairs] = useState<Record<string, FacultyLite[]>>({});
  const [search, setSearch] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Record<string, string>>({});

  useEffect(() => {
    let alive = true;
    (async () => {
      const [{ data: topicData, error: tErr }, { data: fac }] = await Promise.all([
        supabase
          .from('session_topics')
          .select('id, topic_title, start_time, end_time, sequence_no, faculty_topics ( role, faculty ( id, canonical_name, email, faculty_id ) )')
          .eq('session_id', session.id)
          .order('sequence_no', { ascending: true }),
        supabase.from('faculty').select('id, canonical_name, email').order('canonical_name'),
      ]);
      if (!alive) return;
      if (tErr) { setError(tErr.message); setLoading(false); return; }

      const ts: Topic[] = [];
      const orig: Record<string, string[]> = {};
      const cur: Record<string, FacultyLite[]> = {};
      (topicData || []).forEach((t: any) => {
        const links = t.faculty_topics || [];
        const isTbd = (f: any) => !f || f.faculty_id === 'FAC000' || /^TBD/i.test(f.canonical_name || '');
        const speakers = links.filter((l: any) => l.role !== 'Chairperson' && !isTbd(l.faculty)).map((l: any) => l.faculty);
        const chairList = links.filter((l: any) => l.role === 'Chairperson' && l.faculty).map((l: any) => l.faculty);
        ts.push({ id: t.id, topic_title: t.topic_title, start_time: t.start_time, end_time: t.end_time, sequence_no: t.sequence_no, speakers });
        orig[t.id] = chairList.map((f: any) => f.id);
        cur[t.id] = chairList;
      });
      setTopics(ts); setOriginal(orig); setChairs(cur);
      setEveryone(fac || []);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [session.id]);

  const speakerIds = useMemo(() => {
    const m: Record<string, Set<string>> = {};
    topics.forEach((t) => { m[t.id] = new Set(t.speakers.map((s) => s.id)); });
    return m;
  }, [topics]);

  function add(topicId: string, f: FacultyLite) {
    if (speakerIds[topicId]?.has(f.id)) {
      setNotice((n) => ({ ...n, [topicId]: `${f.canonical_name} is already a speaker on this topic and cannot also chair it. They can chair other topics.` }));
      return;
    }
    if ((chairs[topicId] || []).some((c) => c.id === f.id)) return;
    setChairs((c) => ({ ...c, [topicId]: [...(c[topicId] || []), f] }));
    setSearch((s) => ({ ...s, [topicId]: '' }));
    setNotice((n) => ({ ...n, [topicId]: '' }));
  }

  function remove(topicId: string, id: string) {
    setChairs((c) => ({ ...c, [topicId]: (c[topicId] || []).filter((x) => x.id !== id) }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      for (const t of topics) {
        const before = new Set(original[t.id] || []);
        const now = chairs[t.id] || [];
        const nowIds = new Set(now.map((f) => f.id));
        const removed = [...before].filter((id) => !nowIds.has(id));
        const added = now.filter((f) => !before.has(f.id));

        if (removed.length) {
          const { error: e } = await supabase.from('faculty_topics').delete()
            .eq('topic_id', t.id).eq('role', 'Chairperson').in('faculty_id', removed);
          if (e) throw e;
        }
        if (added.length) {
          const { error: e } = await supabase.from('faculty_topics')
            .insert(added.map((f) => ({ topic_id: t.id, faculty_id: f.id, role: 'Chairperson' })));
          if (e) throw e;
        }
      }
      onSaved();
    } catch (e: any) {
      setError(e?.message || 'Could not save the chairpersons.');
      setSaving(false);
    }
  }

  const secondary = buttonCls('secondary');
  const primary = buttonCls('primary');

  return (
    <Modal
      title="Chairpersons"
      subtitle={`${session.session_code} – ${session.session_name}`}
      size="lg"
      busy={saving}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={saving} className={secondary}>Cancel</button>
          <button type="button" onClick={save} disabled={saving || loading} className={primary}>{saving ? 'Saving…' : 'Save chairpersons'}</button>
        </>
      }
    >
      {loading ? (
        <p role="status" className="py-8 text-center text-ink-2">Loading topics…</p>
      ) : topics.length === 0 ? (
        <p className="py-8 text-center text-ink-2">This session has no topics yet. Add topics first, then choose their chairpersons.</p>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-ink-2">
            Search a faculty member under a topic to make them a chairperson of it. A topic can have as many chairs as you like.
            Saving does not email anyone: go to <strong>Emails → Schedule changes</strong> when you are ready to tell them.
          </p>
          <ul className="space-y-3">
            {topics.map((t) => {
              const q = (search[t.id] || '').trim().toLowerCase();
              const results = q
                ? everyone.filter((f) => f.canonical_name.toLowerCase().includes(q) || (f.email || '').toLowerCase().includes(q)).slice(0, 5)
                : [];
              const list = chairs[t.id] || [];
              return (
                <li key={t.id} className="rounded-xl border border-line bg-white p-4">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="tnum text-sm font-semibold text-accent">{fmtTime(t.start_time)} – {fmtTime(t.end_time)}</span>
                    <span className="font-medium text-ink">{t.topic_title}</span>
                  </div>
                  {t.speakers.length > 0 && (
                    <p className="mt-1 text-xs text-muted">Speakers: {t.speakers.map((s) => s.canonical_name).join(', ')}</p>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {list.length === 0 && <span className="text-sm italic text-muted">No chairperson yet</span>}
                    {list.map((c) => (
                      <span key={c.id} className="inline-flex items-center gap-1 rounded-full bg-orange-100 py-1 pl-3 pr-1 text-sm text-orange-900 ring-1 ring-inset ring-orange-200">
                        {c.canonical_name}
                        <button
                          type="button"
                          onClick={() => remove(t.id, c.id)}
                          aria-label={`Remove ${c.canonical_name} as chairperson`}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-orange-900 hover:bg-orange-200"
                        >×</button>
                      </span>
                    ))}
                    <Badge tone="orange">{list.length} chair{list.length === 1 ? '' : 's'}</Badge>
                  </div>

                  <div className="mt-3">
                    <label htmlFor={`chair-search-${t.id}`} className="sr-only">Search faculty to chair {t.topic_title}</label>
                    <input
                      id={`chair-search-${t.id}`}
                      type="search"
                      placeholder="Search faculty to add as chairperson"
                      value={search[t.id] || ''}
                      onChange={(e) => setSearch((s) => ({ ...s, [t.id]: e.target.value }))}
                      className={inputCls}
                    />
                    {q && (
                      <div className="mt-1.5 overflow-hidden rounded-xl border border-line bg-white shadow-card">
                        {results.length === 0 ? (
                          <p className="p-3 text-sm text-ink-2">No faculty found.</p>
                        ) : results.map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => add(t.id, f)}
                            className="block min-h-11 w-full border-b border-line px-3.5 py-2 text-left last:border-b-0 hover:bg-accent-tint"
                          >
                            <div className="text-sm font-medium text-ink">{f.canonical_name}</div>
                            <div className="text-xs text-muted">{f.email || '—'}</div>
                          </button>
                        ))}
                      </div>
                    )}
                    {notice[t.id] && <p role="alert" className="mt-1.5 text-sm text-warning">{notice[t.id]}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {error && <p role="alert" className="mt-4 rounded-lg border border-danger-line bg-danger-tint p-3 text-sm text-danger-strong">{error}</p>}
    </Modal>
  );
}
