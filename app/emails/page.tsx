'use client';

import { useEffect, useState } from 'react';
import { getEmailsOverview, markFacultyReviewed, unmarkFacultyReviewed } from '../actions';
import SendEmailsDialog from '../components/SendEmailsDialog';
import SyncButton from '../components/SyncButton';
import { SearchIcon, MailIcon } from '../components/Icons';
import { inputCls } from '../components/Field';
import { Button, EmptyState, LoadingBlock, Notice, PageHeader, PageShell, PersonLink, Tabs, cardCls } from '../components/ui';
import FacultyProfileHost from '../components/FacultyProfileHost';

type Tab = 'first' | 'changes' | 'reminders' | 'today' | 'reviewed';

const TAB_HELP: Record<Tab, string> = {
  first: 'Faculty who have not been emailed yet. Their first email shows the current schedule, with the PDF and the confirm button.',
  changes: 'Faculty who were already emailed and whose schedule has changed since. The email lists what changed.',
  reminders: 'Faculty who were emailed but have not fully confirmed: nothing confirmed after 5 days, or some topics still unconfirmed.',
  today: 'Everyone who was emailed today (India time), newest first. Select people to send them another email.',
  reviewed: 'Faculty marked as reviewed without sending anything. They are hidden from First email and Schedule changes; undo puts them back.',
};

export default function EmailsPage() {
  const [data, setData] = useState<any>({ first: [], changes: [], reminders: [], today: [], reviewed: [] });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('first');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [marking, setMarking] = useState(false);
  const [undoingId, setUndoingId] = useState<string | null>(null);
  const [undoingBatch, setUndoingBatch] = useState(false);
  const [lastMarked, setLastMarked] = useState<string[]>([]);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [confFilter, setConfFilter] = useState<'all' | 'confirmed' | 'none' | 'partial' | 'any'>('all');

  async function load() {
    setLoading(true);
    try {
      const r: any = await getEmailsOverview();
      setData(r);
      if (r?.success === false) window.alert(r?.message || 'Could not load the email lists.');
    } catch (e: any) {
      window.alert(e?.message || 'Could not load the email lists.');
    } finally {
      setSelected(new Set());
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  // Mark as reviewed without emailing: takes them off First email / Schedule changes.
  async function markReviewed() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (!window.confirm(`Mark ${ids.length} faculty as reviewed? No email will be sent to them.`)) return;
    setMarking(true);
    try {
      const r: any = await markFacultyReviewed({ facultyIds: ids, kind: tab === 'changes' ? 'changes' : 'first' });
      if (!r?.success) { window.alert(r?.message || 'Could not mark as reviewed.'); return; }
      setLastMarked(ids);
      await load(); // refreshes the lists and clears the selection
    } catch (e: any) {
      window.alert(e?.message || 'Could not mark as reviewed.');
    } finally {
      setMarking(false);
    }
  }

  // Undo the batch that was just marked, straight from the confirmation notice.
  async function undoMarked() {
    if (lastMarked.length === 0) return;
    if (!window.confirm(`Put ${lastMarked.length} back on the list? No email will be sent.`)) return;
    setUndoingBatch(true);
    try {
      const r: any = await unmarkFacultyReviewed(lastMarked);
      if (!r?.success) { window.alert(r?.message || 'Could not undo the review.'); return; }
      setLastMarked([]);
      await load();
    } catch (e: any) {
      window.alert(e?.message || 'Could not undo the review.');
    } finally {
      setUndoingBatch(false);
    }
  }

  // Undo from the Reviewed tab: puts them back on the First email / Schedule changes list.
  async function undoReview(id: string, name: string) {
    if (!window.confirm(`Put ${name} back on the list? No email will be sent.`)) return;
    setUndoingId(id);
    try {
      const r: any = await unmarkFacultyReviewed([id]);
      if (!r?.success) { window.alert(r?.message || 'Could not undo the review.'); return; }
      await load();
    } catch (e: any) {
      window.alert(e?.message || 'Could not undo the review.');
    } finally {
      setUndoingId(null);
    }
  }
  const allRows: any[] = data[tab] || [];
  const q = query.trim().toLowerCase();
  const rows = allRows
    .filter((r) => !q || `${r.name} ${r.email}`.toLowerCase().includes(q))
    .filter((r) => {
      if (tab !== 'today' || confFilter === 'all') return true;
      const full = r.topicCount > 0 && r.confirmedCount === r.topicCount;
      const partial = r.confirmedCount > 0 && r.confirmedCount < r.topicCount;
      if (confFilter === 'confirmed') return full;
      if (confFilter === 'none') return r.confirmedCount === 0;
      if (confFilter === 'partial') return partial;
      return full || partial; // any confirmation
    });
  // Re-sending to someone emailed today: a schedule update (changeable per person in the dialog)
  const kind = tab === 'first' ? 'first' : tab === 'reminders' ? 'reminder' : 'update';
  const sendable = rows.filter((r) => r.hasEmail);
  // On First email / Schedule changes, faculty without a valid email can be selected too:
  // "Mark as reviewed (no email)" does not need to send anything.
  const canMarkReviewed = tab === 'first' || tab === 'changes';
  const selectable = canMarkReviewed ? rows : sendable;
  const allSelected = selectable.length > 0 && selectable.every((r) => selected.has(r.id));
  const selectedWithEmail = sendable.filter((r) => selected.has(r.id)).length;
  // Faculty with changes who are still waiting for their FIRST email
  const firstWithChanges = (data.first || []).filter((r: any) => r.pendingLines?.length).length;

  const changedRows = tab === 'first' ? rows.filter((r: any) => r.pendingLines?.length) : [];

  const toggle = (id: string) =>
    setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const tabs = [
    { key: 'first' as Tab, label: 'First email', count: data.first?.length || 0 },
    { key: 'changes' as Tab, label: 'Schedule changes', count: data.changes?.length || 0 },
    { key: 'reminders' as Tab, label: 'Reminders', count: data.reminders?.length || 0 },
    { key: 'today' as Tab, label: 'Emailed today', count: data.today?.length || 0 },
    { key: 'reviewed' as Tab, label: 'Reviewed', count: data.reviewed?.length || 0 },
  ];

  return (
    <>
      <PageShell>
        <PageHeader
          title="Emails"
          description="Nothing is sent automatically. Choose who should receive an email, check the list, then confirm."
          actions={<SyncButton onSynced={load} />}
        />

        {data.counts && (
          <p className="mb-3 text-sm text-ink-2">
            Faculty emailed so far: <strong className="tnum text-ink">{data.counts.emailed}</strong> of <span className="tnum">{data.counts.faculty}</span>
            {' '}· today: <strong className="tnum text-ink">{data.counts.today}</strong>
          </p>
        )}

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
            {tab !== 'reviewed' && (
              <label className="flex min-h-9 items-center gap-2.5 text-sm font-medium text-ink">
                <input
                  type="checkbox"
                  checked={allSelected}
                  disabled={selectable.length === 0}
                  onChange={() =>
                    setSelected((prev) => {
                      const n = new Set(prev);
                      if (allSelected) selectable.forEach((r) => n.delete(r.id));
                      else selectable.forEach((r) => n.add(r.id));
                      return n;
                    })
                  }
                />
                {q ? `Select all shown (${selectable.length})` : `Select all (${selectable.length})`}
              </label>
            )}
            {tab === 'first' && (
              <Button
                disabled={changedRows.length === 0}
                onClick={() => setSelected(new Set(changedRows.map((r: any) => r.id)))}
              >
                Select changed ({changedRows.length})
              </Button>
            )}
            {tab === 'today' && (
              <select
                aria-label="Filter by confirmation"
                value={confFilter}
                onChange={(e) => setConfFilter(e.target.value as typeof confFilter)}
                className="h-8 rounded-md border border-field bg-white py-0 pl-2 pr-6 text-xs text-ink"
              >
                <option value="all">Any confirmation</option>
                <option value="confirmed">Confirmed (all topics)</option>
                <option value="none">Not confirmed</option>
                <option value="partial">Partially confirmed</option>
                <option value="any">Partial + confirmed</option>
              </select>
            )}
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
              {tab !== 'reviewed' && (
                <span role="status" aria-live="polite" className="tnum text-sm text-ink-2">
                  <strong className="text-ink">{selected.size}</strong> selected
                </span>
              )}
              {canMarkReviewed && (
                <Button disabled={selected.size === 0 || marking} onClick={markReviewed}>
                  {marking ? 'Saving…' : 'Mark as reviewed (no email)'}
                </Button>
              )}
              {tab !== 'reviewed' && (
                <Button variant="primary" disabled={selectedWithEmail === 0 || marking} onClick={() => setSending(true)}>
                  <MailIcon /> Review &amp; send…
                </Button>
              )}
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
) : !q ? (
                tab === 'reviewed'
                  ? 'Nobody is marked as reviewed. Use “Mark as reviewed (no email)” on the First email or Schedule changes list.'
                  : 'Nothing needs sending here right now. Everyone has been emailed or marked as reviewed.'
              ) : undefined}
            </EmptyState>
          ) : (
            <ul className="divide-y divide-line">
              {rows.map((r) => (
                <li
                  key={r.id}
                  className={`flex items-start gap-3 p-4 transition-colors ${selected.has(r.id) ? 'bg-accent-tint' : 'hover:bg-slate-50'}`}
                >
                  {tab === 'reviewed' ? (
                    <Button
                      className="mt-0.5 shrink-0"
                      disabled={undoingId === r.id}
                      onClick={() => undoReview(r.id, r.name)}
                      aria-label={`Undo review for ${r.name}`}
                    >
                      {undoingId === r.id ? 'Undoing…' : 'Undo'}
                    </Button>
                  ) : (
                    <input
                      type="checkbox"
                      className="mt-1"
                      disabled={!r.hasEmail && !canMarkReviewed}
                      checked={selected.has(r.id)}
                      onChange={() => toggle(r.id)}
                      aria-label={`Select ${r.name}`}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold"><PersonLink name={r.name} onOpen={() => setProfileId(r.id)} className="font-semibold" /></p>
                    <p className="text-sm text-ink-2">
                      {r.hasEmail ? r.email : <span className="font-medium text-danger">No valid email</span>} ·{' '}
                      {r.topicCount} topic{r.topicCount === 1 ? '' : 's'} · {r.confirmedCount} confirmed
                      {r.sentAt && (r.sentToday
                        ? <> · emailed at {new Date(r.sentAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</>
                        : <> · first emailed {new Date(r.sentAt).toLocaleDateString('en-GB')}</>)}
                      {r.reviewedAt && <> · reviewed {new Date(r.reviewedAt).toLocaleDateString('en-GB')}</>}
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
