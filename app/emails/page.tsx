'use client';

import { useEffect, useState } from 'react';
import { getEmailsOverview } from '../actions';
import SendEmailsDialog from '../components/SendEmailsDialog';
import SyncButton from '../components/SyncButton';
import { SearchIcon, MailIcon } from '../components/Icons';
import { inputCls } from '../components/Field';
import { Button, EmptyState, LoadingBlock, Notice, PageHeader, PageShell, PersonLink, Tabs, cardCls } from '../components/ui';
import FacultyProfileHost from '../components/FacultyProfileHost';

type Tab = 'first' | 'changes' | 'reminders';

const TAB_HELP: Record<Tab, string> = {
  first: 'Faculty who have not been emailed yet. Their first email shows the current schedule, with the PDF and the confirm button.',
  changes: 'Faculty who were already emailed and whose schedule has changed since. The email lists what changed.',
  reminders: 'Faculty who were emailed but have not fully confirmed: nothing confirmed after 5 days, or some topics still unconfirmed.',
};

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

  const tabs = [
    { key: 'first' as Tab, label: 'First email', count: data.first?.length || 0 },
    { key: 'changes' as Tab, label: 'Schedule changes', count: data.changes?.length || 0 },
    { key: 'reminders' as Tab, label: 'Reminders', count: data.reminders?.length || 0 },
  ];

  return (
    <>
      <PageShell>
        <PageHeader
          title="Emails"
          description="Nothing is sent automatically. Choose who should receive an email, check the list, then confirm."
          actions={<SyncButton onSynced={load} />}
        />

        <Tabs
          label="Email type"
          idPrefix="emailtab"
          items={tabs}
          value={tab}
          onChange={(k) => { setTab(k); setSelected(new Set()); }}
        />
        <p className="-mt-2 mb-4 max-w-3xl text-sm text-ink-2">{TAB_HELP[tab]}</p>

        <div id={`emailtab-panel-${tab}`} role="tabpanel" aria-labelledby={`emailtab-${tab}`} className={`overflow-hidden ${cardCls}`}>
          <div className="flex flex-wrap items-center gap-3 border-b border-line bg-slate-50 p-3 sm:px-4">
            <label className="flex min-h-9 items-center gap-2.5 text-sm font-medium text-ink">
              <input
                type="checkbox"
                checked={allSelected}
                disabled={sendable.length === 0}
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
            <div className="relative order-last w-full sm:order-none sm:ml-2 sm:w-72">
              <label htmlFor="email-search" className="sr-only">Search by name or email</label>
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                id="email-search"
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name or email"
                className={`${inputCls} h-10 pl-9`}
              />
            </div>
            <div className="ml-auto flex items-center gap-3">
              <span role="status" aria-live="polite" className="tnum text-sm text-ink-2">
                <strong className="text-ink">{selected.size}</strong> selected
              </span>
              <Button variant="primary" disabled={selected.size === 0} onClick={() => setSending(true)}>
                <MailIcon /> Review &amp; send…
              </Button>
            </div>
          </div>

          {loading ? (
            <LoadingBlock>Loading the email lists…</LoadingBlock>
          ) : rows.length === 0 ? (
            <EmptyState
              title={q ? `Nobody here matches “${query}”` : 'Nobody in this list'}
              tone={q ? 'neutral' : 'success'}
              action={q ? <Button onClick={() => setQuery('')}>Clear search</Button> : undefined}
            >
              {!q && tab === 'changes' && firstWithChanges > 0 ? (
                <>
                  {firstWithChanges} faculty with schedule changes have not had their first email yet, so they are listed under{' '}
                  <button type="button" onClick={() => { setTab('first'); setSelected(new Set()); }} className="font-semibold text-accent underline">
                    First email
                  </button>
                  . Their first email already shows the updated schedule.
                </>
              ) : !q ? 'Nothing needs sending here right now.' : undefined}
            </EmptyState>
          ) : (
            <ul className="divide-y divide-line">
              {rows.map((r) => (
                <li
                  key={r.id}
                  className={`flex items-start gap-3 p-4 transition-colors ${selected.has(r.id) ? 'bg-accent-tint' : 'hover:bg-slate-50'}`}
                >
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
                      {r.hasEmail ? r.email : <span className="font-medium text-danger">No valid email</span>} ·{' '}
                      {r.topicCount} topic{r.topicCount === 1 ? '' : 's'} · {r.confirmedCount} confirmed
                      {r.sentAt && <> · first emailed {new Date(r.sentAt).toLocaleDateString('en-GB')}</>}
                    </p>
                    {r.lines && (
                      <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-sm text-ink-2">
                        {r.lines.map((l: string, i: number) => <li key={i}>{l}</li>)}
                      </ul>
                    )}
                    {r.note && <Notice tone="warning" className="mt-2">{r.note}</Notice>}
                    {r.pendingLines?.length > 0 && (
                      <Notice tone="warning" className="mt-2" title="Changed since added (the first email already shows the new schedule):">
                        <ul className="list-disc pl-5">
                          {r.pendingLines.map((l: string, i: number) => <li key={i}>{l}</li>)}
                        </ul>
                      </Notice>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PageShell>

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
    </>
  );
}
