'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { inputCompactCls } from './Field';

export type ChairPerson = { id: string; canonical_name: string; email: string | null };

// Records "added / removed as session chairperson" so the Emails page can send an update.
export async function logSessionChairChanges(
  sessionCode: string,
  before: ChairPerson[],
  after: ChairPerson[],
) {
  const rows = [
    ...after.filter((p) => !before.some((b) => b.id === p.id)).map((p) => ({ event_type: 'session_chair_added', p })),
    ...before.filter((p) => !after.some((a) => a.id === p.id)).map((p) => ({ event_type: 'session_chair_removed', p })),
  ].map(({ event_type, p }) => ({
    event_type, faculty_id: p.id, faculty_name: p.canonical_name, session_code: sessionCode,
    detail: 'Whole session', notify: true,
  }));
  if (rows.length) await supabase.from('change_log').insert(rows);
}

// Many chairpersons for a whole session, in the order shown (1, 2, 3 …).
// Used in the Add session and Edit session dialogs.
export default function SessionChairsPicker({
  value,
  onChange,
}: {
  value: ChairPerson[];
  onChange: (next: ChairPerson[]) => void;
}) {
  const [all, setAll] = useState<ChairPerson[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    supabase.from('faculty').select('id, canonical_name, email').order('canonical_name')
      .then(({ data }) => { if (data) setAll(data as ChairPerson[]); });
  }, []);

  const q = search.trim().toLowerCase();
  const matches = q
    ? all.filter((f) => !value.some((v) => v.id === f.id) &&
        (f.canonical_name.toLowerCase().includes(q) || (f.email || '').toLowerCase().includes(q))).slice(0, 6)
    : [];

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }

  return (
    <section aria-label="Chairpersons for the whole session" className="rounded-xl border border-line bg-canvas p-3">
      <h3 className="text-xs font-medium text-ink">Chairpersons for the whole session</h3>
      <p className="mb-2 text-xs text-muted">Shown once at the top of the session, not on each topic. Add as many as you need.</p>

      {value.length > 0 && (
        <ul className="mb-2 space-y-1.5">
          {value.map((p, i) => (
            <li key={p.id} className="flex items-center gap-2 rounded-lg border border-line bg-white py-1.5 pl-2 pr-1.5">
              <div className="flex shrink-0 flex-col">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} title="Move up" aria-label="Move up"
                  className="px-1 text-xs leading-none text-accent disabled:opacity-25">▲</button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === value.length - 1} title="Move down" aria-label="Move down"
                  className="px-1 text-xs leading-none text-accent disabled:opacity-25">▼</button>
              </div>
              <span className="w-5 shrink-0 text-center text-sm font-semibold text-ink-2">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-ink">{p.canonical_name}</div>
                <div className="truncate text-xs text-muted">{p.email || '—'}</div>
              </div>
              <button type="button" onClick={() => onChange(value.filter((v) => v.id !== p.id))}
                aria-label={`Remove ${p.canonical_name}`}
                className="inline-flex h-8 items-center rounded-lg px-2.5 text-xs font-medium text-danger hover:bg-danger-tint">
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <label className="sr-only" htmlFor="session-chair-search">Search faculty to add as chairperson</label>
      <input
        id="session-chair-search"
        type="search"
        placeholder="Search by name or email to add a chairperson"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className={inputCompactCls}
      />
      {q && (
        <div className="mt-1.5 max-h-44 overflow-y-auto rounded-lg border border-line bg-white shadow-card">
          {matches.length === 0 ? (
            <p className="p-2.5 text-sm text-ink-2">No faculty found.</p>
          ) : (
            <ul>
              {matches.map((f) => (
                <li key={f.id}>
                  <button type="button" onClick={() => { onChange([...value, f]); setSearch(''); }}
                    className="block w-full border-b border-line px-3 py-1.5 text-left last:border-b-0 hover:bg-accent-tint">
                    <span className="text-sm font-medium text-ink">{f.canonical_name}</span>
                    <span className="ml-2 text-xs text-muted">{f.email || '—'}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
