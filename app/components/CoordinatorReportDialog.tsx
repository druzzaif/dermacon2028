'use client';

import { useEffect, useState } from 'react';
import Modal from './Modal';
import Badge, { roleTone } from './Badge';
import { AlertIcon, CheckIcon } from './Icons';
import { Button, LoadingBlock, Notice, buttonCls } from './ui';
import { generatePDFForSession, previewCoordinatorReport, sendCoordinatorReport } from '../actions';

const roleLabel = (r: string) => (r === 'Lead Coordinator' ? 'Lead' : r);

/**
 * Sends the coordinators of ONE session a table of their whole session:
 * each topic, its faculty and chairs, and who has confirmed. Preview first.
 * You tick which coordinators receive it; each shows National / Lead / Local.
 */
export default function CoordinatorReportDialog({ session, onClose }: { session: any; onClose: () => void }) {
  const [data, setData] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);
  // Second step before anything is emailed
  const [confirming, setConfirming] = useState(false);

  // Separate from sending: only makes the session PDF, emails nobody
  async function makePdf() {
    setPdfBusy(true);
    setPdfError(null);
    setPdfUrl(null);
    const r: any = await generatePDFForSession(session.id);
    setPdfBusy(false);
    if (r.success) setPdfUrl(r.url);
    else setPdfError(r.message || 'The PDF could not be generated.');
  }

  useEffect(() => {
    let alive = true;
    previewCoordinatorReport(session.id).then((r: any) => {
      if (!alive) return;
      setData(r);
      // Everyone with an email is ticked to start with
      setPicked(new Set((r.allCoordinators || []).filter((c: any) => c.hasEmail).map((c: any) => c.id)));
    });
    return () => { alive = false; };
  }, [session.id]);

  async function send() {
    setConfirming(false);
    setBusy(true);
    const r: any = await sendCoordinatorReport(session.id, [...picked]);
    setResult({ ok: r.success, message: r.message });
    setBusy(false);
  }


  const people: any[] = data?.allCoordinators || [];
  const withEmail = people.filter((c) => c.hasEmail);
  const count = picked.size;
  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const selectRole = (role: string | null) =>
    setPicked(new Set(withEmail.filter((c) => role === null || c.roles.includes(role)).map((c) => c.id)));
  const chip = buttonCls('secondary', 'sm');

  return (
    <Modal
      title="Send report to coordinators"
      subtitle={`${session.session_code} – ${session.session_name}`}
      size="lg"
      busy={busy || pdfBusy}
      onClose={onClose}
      footer={
        result?.ok ? (
          <>
            <Button onClick={makePdf} busy={pdfBusy}>{pdfBusy ? 'Making PDF…' : 'Generate PDF'}</Button>
            <Button variant="primary" onClick={onClose}>Close</Button>
          </>
        ) : confirming ? (
          <>
            <Button onClick={() => setConfirming(false)}>Go back</Button>
            <Button variant="primary" onClick={send}>Yes, send to {count} coordinator{count === 1 ? '' : 's'}</Button>
          </>
        ) : (
          <>
            <Button variant="quiet" className="mr-auto" onClick={onClose} disabled={busy || pdfBusy}>Cancel</Button>
            <Button onClick={makePdf} busy={pdfBusy} disabled={busy}>{pdfBusy ? 'Making PDF…' : 'Generate PDF'}</Button>
            <Button
              variant="primary"
              onClick={() => setConfirming(true)}
              busy={busy}
              disabled={pdfBusy || !data?.success || count === 0}
            >
              {busy ? 'Sending…' : `Send to ${count} coordinator${count === 1 ? '' : 's'}…`}
            </Button>
          </>
        )
      }
    >
      {!data && <LoadingBlock>Preparing the report…</LoadingBlock>}
      {data && !data.success && (
        <p role="alert" className="rounded-lg border border-danger-line bg-danger-tint p-3 text-sm text-danger-strong">{data.message}</p>
      )}
      {data?.success && (
        <div className="space-y-4">
          {confirming && (
            <Notice tone="warning" title={`You are about to send the report to ${count} coordinator${count === 1 ? "" : "s"}`}>
              Real emails will be sent to the people ticked below. Sent emails cannot be recalled. Click{' '}
              <strong>Yes, send</strong> to continue, or <strong>Go back</strong> to change who receives it.
            </Notice>
          )}
          <fieldset className="rounded-xl bg-canvas p-4 text-sm text-ink ring-1 ring-inset ring-line">
            <legend className="sr-only">Who should receive the report</legend>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold">Send the table below to:</p>
              {withEmail.length > 1 && (
                <div className="flex flex-wrap gap-1.5" aria-label="Quick select">
                  <button type="button" className={chip} onClick={() => selectRole(null)}>All</button>
                  {['National', 'Lead Coordinator', 'Local'].filter((r) => withEmail.some((c) => c.roles.includes(r))).map((r) => (
                    <button key={r} type="button" className={chip} onClick={() => selectRole(r)}>Only {roleLabel(r)}</button>
                  ))}
                  <button type="button" className={chip} onClick={() => setPicked(new Set())}>None</button>
                </div>
              )}
            </div>
            {people.length === 0 ? (
              <p className="mt-2 text-danger-strong">This session has no coordinators yet. Add them with Edit coordinators first.</p>
            ) : (
              <ul className="mt-2 divide-y divide-line overflow-hidden rounded-lg border border-line bg-white">
                {people.map((c: any) => (
                  <li key={c.id}>
                    <label className={`flex min-h-12 items-center gap-3 px-3 py-2 ${c.hasEmail ? 'cursor-pointer hover:bg-slate-50' : 'opacity-70'}`}>
                      <input
                        type="checkbox"
                        className="h-4 w-4 shrink-0"
                        disabled={!c.hasEmail || !!result?.ok}
                        checked={picked.has(c.id)}
                        onChange={() => toggle(c.id)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-ink">{c.name}</span>
                        <span className="block truncate text-xs text-ink-2">
                          {c.hasEmail ? c.email : <span className="text-danger">No valid email: cannot receive it</span>}
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-wrap justify-end gap-1">
                        {c.roles.map((r: string) => <Badge key={r} tone={roleTone(r)}>{roleLabel(r)}</Badge>)}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-ink-2">
              One email each (no PDF attached). <strong>Generate PDF</strong> makes the session sheet on its own and emails nobody. Confirmation status is as of the last sync
              {data.syncedAt ? <> (<strong>{data.syncedAt}</strong>)</> : <> (<strong>never synced</strong>)</>}. Click <strong>Sync</strong> first if you want the latest.
            </p>
            {data.counts && <p className="mt-2 text-ink-2">Faculty emailed so far: <strong className="tnum">{data.counts.emailed}</strong> ({data.counts.today} today)</p>}
          </fieldset>

          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full min-w-[560px] border-collapse text-left text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs text-muted">
                  <th className="px-3 py-2 font-semibold">Time</th>
                  <th className="px-3 py-2 font-semibold">Topic</th>
                  <th className="px-3 py-2 font-semibold">Faculty / role</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.rows.map((r: any, i: number) => (
                  <tr key={i} className="align-top">
                    <td className="tnum whitespace-nowrap px-3 py-2 text-accent">{r.time}</td>
                    <td className="px-3 py-2 font-medium text-ink">{r.topic}</td>
                    <td className="px-3 py-2">
                      {r.people.length === 0 ? <span className="italic text-muted">no faculty yet</span> : (
                        <ul className="space-y-1">{r.people.map((p: any, j: number) => (
                          <li key={j}>{p.name} <span className="text-muted">({p.role})</span></li>
                        ))}</ul>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <ul className="space-y-1">{r.people.map((p: any, j: number) => (
                        <li key={j}>
                          {p.confirmed
                            ? <Badge tone="success"><CheckIcon width={12} height={12} strokeWidth={3} /> Confirmed</Badge>
                            : <Badge tone="warning">Pending</Badge>}
                        </li>
                      ))}</ul>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {pdfUrl && (
        <p role="status" className="mt-4 rounded-lg bg-success-tint p-3 text-sm text-success">
          PDF ready.{' '}
          <a href={pdfUrl} target="_blank" rel="noreferrer" className="font-semibold underline">
            Open or download<span className="sr-only"> (opens in a new tab)</span>
          </a>
        </p>
      )}
      {pdfError && <p role="alert" className="mt-4 rounded-lg border border-danger-line bg-danger-tint p-3 text-sm text-danger-strong">{pdfError}</p>}
      {result && (
        <p role={result.ok ? 'status' : 'alert'} className={`mt-4 rounded-lg p-3 text-sm ${result.ok ? 'bg-success-tint text-success' : 'border border-danger-line bg-danger-tint text-danger-strong'}`}>
          {result.message}
        </p>
      )}
    </Modal>
  );
}
