'use client';

import { useEffect, useState } from 'react';
import { getEmailsOverview } from '../actions';
import SendEmailsDialog from '../components/SendEmailsDialog';
import SyncButton from '../components/SyncButton';
import { SearchIcon } from '../components/Icons';
import { inputCls } from '../components/Field';
import { PersonLink } from '../components/ui';
import FacultyProfileHost from '../components/FacultyProfileHost';

type Tab = 'first' | 'changes' | 'reminders';

export default function EmailsPage() {
  const [data, setData] = useState<any>({ first: [], changes: [], reminders: [] });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('first');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const r: any = await getEmailsOverview();
    setData(r);
    setSelected(new Set());
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  const [query, setQuery] = useState('');
  const allRows: any[] = data[tab] || [];
  const q = query.trim().toLowerCase();
  const rows = q
    ? allRows.filter((r) => `${r.name} ${r.email}`.toLowerCase().includes(q))
    : allRows;
  const kind = tab === 'first' ? 'first' : tab === 'changes' ? 'update' : 'reminder';
  const sendable = rows.filter((r) => r.hasEmail);
  const allSelected = sendable.length > 0 && sendable.every((r) => selected.has(r.id));
  // Faculty with changes who are still waiting for their FIRST email
  const firstWithChanges = (data.first || []).filter((r: any) => r.pendingLines?.length).length;

  const toggle = (id: string) =>
    setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const tabs: { key: Tab; label: string }[] = [
    { key: 'first', label: `First email (${data.first?.length || 0})` },
    { key: 'changes', label: `Schedule changes (${data.changes?.length || 0})` },
    { key: 'reminders', label: `Reminders (${data.reminders?.length || 0})` },
  ];

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-canvas text-ink">
      <main className="mx-auto w-full max-w-5xl p-4 sm:p-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold">Emails</h1>
            <p className="mt-1.5 text-ink-2">
              Nothing is sent automatically. Tick the faculty you want, then review before sending.
            </p>
          </div>
          <SyncButton onSynced={load} />
        </div>

        <div role="tablist" className="mb-4 flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => { setTab(t.key); setSelected(new Set()); }}
              className={`h-10 rounded-lg border px-4 text-sm font-medium ${
                tab === t.key ? 'border-accent bg-accent text-white' : 'border-line bg-white text-ink-2 hover:bg-slate-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-slate-50/70 p-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={() =>
                  setSelected((prev) => {
                    const n = new Set(prev);
                    if (allSelected) sendable.forEach((r) => n.delete(r.id));
                    else sendable.forEach((r) => n.add(r.id));
                    return n;
                  })
                }
              />
              {q ? `Select all shown (${sendable.length})` : `Select all (${sendable.length})`}
            </label>
            <div className="relative order-last w-full sm:order-none sm:w-72">
              <label htmlFor="email-search" className="sr-only">Search by name or email</label>
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                id="email-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name or email"
                className={`${inputCls} pl-9`}
              />
            </div>
            <button
              disabled={selected.size === 0}
              onClick={() => setSending(true)}
              className="h-10 rounded-lg bg-accent px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              Review &amp; send selected ({selected.size})
            </button>
          </div>

          {loading ? (
            <p className="p-8 text-center text-ink-2">Loading…</p>
          ) : rows.length === 0 ? (
            <div className="p-8 text-center text-ink-2">
              <p>{q ? `Nobody here matches “${query}”.` : 'Nobody in this list.'}</p>
              {tab === 'changes' && !q && firstWithChanges > 0 && (
                <p className="mx-auto mt-2 max-w-md text-sm">
                  {firstWithChanges} faculty with schedule changes have not had their first email yet, so they are listed under{' '}
                  <button type="button" onClick={() => { setTab('first'); setSelected(new Set()); }} className="font-semibold text-accent underline">
                    First email
                  </button>
                  . Their first email already shows the updated schedule.
                </p>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {rows.map((r) => (
                <li key={r.id} className="flex items-start gap-3 p-4">
                  <input
                    type="checkbox"
                    className="mt-1"
                    disabled={!r.hasEmail}
                    checked={selected.has(r.id)}
                    onChange={() => toggle(r.id)}
                    aria-label={`Select ${r.name}`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold"><PersonLink name={r.name} onOpen={() => setProfileId(r.id)} className="font-semibold" /></p>
                    <p className="text-sm text-ink-2">
                      {r.hasEmail ? r.email : <span className="text-red-700">No valid email</span>} ·{' '}
                      {r.topicCount} topic{r.topicCount === 1 ? '' : 's'} · {r.confirmedCount} confirmed
                      {r.sentAt && <> · first emailed {new Date(r.sentAt).toLocaleDateString('en-GB')}</>}
                    </p>
                    {r.lines && (
                      <ul className="mt-1 list-disc pl-5 text-sm text-ink-2">
                        {r.lines.map((l: string, i: number) => <li key={i}>{l}</li>)}
                      </ul>
                    )}
                    {r.note && <p className="mt-1 text-sm font-medium text-amber-900">{r.note}</p>}
                    {r.pendingLines?.length > 0 && (
                      <div className="mt-1.5 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-inset ring-amber-200">
                        <p className="font-medium">Changed since added (the first email already shows the new schedule):</p>
                        <ul className="mt-0.5 list-disc pl-5">
                          {r.pendingLines.map((l: string, i: number) => <li key={i}>{l}</li>)}
                        </ul>
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>

      {profileId && (
        <FacultyProfileHost facultyId={profileId} onClose={() => setProfileId(null)} onChanged={load} />
      )}

      {sending && (
        <SendEmailsDialog
          items={Array.from(selected)
            .filter((id) => allRows.some((r) => r.id === id && r.hasEmail))
            .map((facultyId) => ({ facultyId: facultyId as string, kind: kind as any }))}
          onClose={() => setSending(false)}
          onDone={() => { setSending(false); load(); }}
        />
      )}
    </div>
  );
}
