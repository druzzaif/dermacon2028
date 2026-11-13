'use client';

import { useEffect, useState } from 'react';
import Modal from './Modal';
import { syncFromGoogle, getLastSync, getQueuedRemovalCount } from '../actions';
import { buttonCls } from './ui';

function whenLabel(iso: string | null) {
  if (!iso) return 'never';
  return new Date(iso).toLocaleString('en-GB', {
    timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

/**
 * The only way confirmations reach the database. Explains first, runs only on click,
 * then lists who confirmed which topics.
 */
export default function SyncButton({ onSynced, className = '' }: { onSynced?: () => void; className?: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [last, setLast] = useState<string | null>(null);
  const [queued, setQueued] = useState(0);

  useEffect(() => { getLastSync().then(setLast).catch(() => {}); }, []);
  useEffect(() => { if (open && !result) getQueuedRemovalCount().then(setQueued).catch(() => {}); }, [open, result]);

  async function run() {
    setBusy(true);
    const r = await syncFromGoogle();
    setResult(r);
    setBusy(false);
    getLastSync().then(setLast).catch(() => {});
    if (r.success) onSynced?.();
  }

  function close() {
    setOpen(false);
    setResult(null);
  }

  const secondary = buttonCls('secondary');
  const primary = buttonCls('primary');

  return (
    <>
      <span className={`inline-flex items-center gap-2 ${className}`}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-11 items-center rounded-lg border border-field bg-white px-4 text-sm font-medium text-ink hover:bg-slate-50"
        >
          Sync confirmations
        </button>
        <span className="hidden text-xs text-muted sm:inline">Last synced: {whenLabel(last)}</span>
      </span>

      {open && (
        <Modal
          title="Sync confirmations"
          size="md"
          busy={busy}
          onClose={close}
          footer={
            result ? (
              <button type="button" onClick={close} className={primary}>Close</button>
            ) : (
              <>
                <button type="button" onClick={close} disabled={busy} className={secondary}>Cancel</button>
                <button type="button" onClick={run} disabled={busy} className={primary}>{busy ? 'Syncing…' : 'Sync now'}</button>
              </>
            )
          }
        >
          {!result && (
            <div className="space-y-3 text-sm text-ink">
              <p className="font-semibold">This is what will happen:</p>
              <ol className="list-decimal space-y-1.5 pl-5 text-ink-2">
                {queued > 0 && (
                  <li>
                    <strong>{queued} confirmation{queued === 1 ? '' : 's'} you removed</strong> in the app {queued === 1 ? 'is' : 'are'} deleted from the Google sheet (one call).
                  </li>
                )}
                <li>The app asks your Google Script for the list of topics faculty have confirmed.</li>
                <li>Those topics are marked <strong>Confirmed</strong> in your database. Topics whose faculty later declined go back to unconfirmed.</li>
                <li><strong>No emails are sent</strong>{queued > 0 ? '.' : ' and nothing is changed in Google.'}</li>
              </ol>
              <p className="text-muted">Last synced: {whenLabel(last)}</p>
            </div>
          )}
          {result && !result.success && (
            <p role="alert" className="rounded-lg border border-danger-line bg-danger-tint p-3 text-sm text-danger-strong">{result.message}</p>
          )}
          {result?.success && (
            <div role="status" className="space-y-3 text-sm">
              {result.pushedRemovals > 0 && (
                <p className="text-ink-2">
                  {result.pushedRemovals} removed confirmation{result.pushedRemovals === 1 ? '' : 's'} sent to Google.
                </p>
              )}
              <p className="font-semibold text-ink">
                {result.count === 0 && !result.revokedCount ? 'Nothing new. You are up to date.' : result.count === 0 ? 'No new confirmations' : `${result.count} new topic confirmation${result.count === 1 ? '' : 's'}`}
              </p>
              {result.groups.length > 0 && (
                <ul className="space-y-2">
                  {result.groups.map((g: any, i: number) => (
                    <li key={i} className="rounded-lg border border-line bg-white p-3">
                      <p className="font-medium text-ink">{g.name}</p>
                      <ul className="mt-1 list-disc pl-5 text-ink-2">
                        {g.topics.map((t: string, j: number) => <li key={j}>{t}</li>)}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
              {result.revokedCount > 0 && (
                <>
                  <p className="font-semibold text-danger-strong">
                    {result.revokedCount} topic{result.revokedCount === 1 ? '' : 's'} un-confirmed (faculty declined)
                  </p>
                  <ul className="space-y-2">
                    {result.revoked.map((g: any, i: number) => (
                      <li key={i} className="rounded-lg border border-danger-line bg-danger-tint p-3">
                        <p className="font-medium text-ink">{g.name}</p>
                        <ul className="mt-1 list-disc pl-5 text-ink-2">
                          {g.topics.map((t: string, j: number) => <li key={j}>{t}</li>)}
                        </ul>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </Modal>
      )}
    </>
  );
}
