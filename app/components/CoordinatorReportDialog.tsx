'use client';

import { useEffect, useState } from 'react';
import Modal from './Modal';
import Badge, { roleTone } from './Badge';
import { AlertIcon, CheckIcon } from './Icons';
import { previewCoordinatorReport, sendCoordinatorReport } from '../actions';

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
    setBusy(true);
    const r: any = await sendCoordinatorReport(session.id, [...picked]);
    setResult({ ok: r.success, message: r.message });
    setBusy(false);
  }

  const secondary = 'inline-flex h-11 items-center justify-center rounded-lg border border-field bg-white px-5 text-sm font-medium text-ink hover:bg-slate-50 disabled:opacity-50';
  const primary = 'inline-flex h-11 items-center justify-center rounded-lg bg-accent px-5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50';

  const people: any[] = data?.allCoordinators || [];
  const withEmail = people.filter((c) => c.hasEmail);
  const count = picked.size;
  const enough = data?.success && (data.quota - data.reserve >= count);
  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const selectRole = (role: string | null) =>
    setPicked(new Set(withEmail.filter((c) => role === null || c.roles.includes(role)).map((c) => c.id)));
  const chip = 'inline-flex h-9 items-center rounded-lg border border-field bg-white px-3 text-xs font-medium text-ink hover:bg-slate-50';

  return (
    <Modal
      title="Send report to coordinators"
      subtitle={`${session.session_code} – ${session.session_name}`}
      size="lg"
      busy={busy}
      onClose={onClose}
      footer={
        result?.ok ? (
          <button type="button" onClick={onClose} className={primary}>Close</button>
        ) : (
          <>
            <button type="button" onClick={onClose} disabled={busy} className={secondary}>Cancel</button>
            <button type="button" onClick={send} disabled={busy || !data?.success || count === 0 || !enough} className={primary}>
              {busy ? 'Sending…' : `Send to ${count} coordinator${count === 1 ? '' : 's'}`}
            </button>
          </>
        )
      }
    >
      {!data && <p role="status" className="py-8 text-center text-ink-2">Preparing the report…</p>}
      {data && !data.success && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{data.message}</p>
      )}
      {data?.success && (
        <div className="space-y-4">
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
              <p className="mt-2 text-red-800">This session has no coordinators yet. Add them with Edit coordinators first.</p>
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
                          {c.hasEmail ? c.email : <span className="text-red-700">No valid email: cannot receive it</span>}
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
              One email each, no PDF. Confirmation status is as of the last sync
              {data.syncedAt ? <> (<strong>{data.syncedAt}</strong>)</> : <> (<strong>never synced</strong>)</>}. Click <strong>Sync confirmations</strong> first if you want the latest.
            </p>
            <p className="mt-2 text-ink-2">Emails left today: <strong className="tnum">{data.quota}</strong></p>
          </fieldset>

          {!enough && count > 0 && (
            <p role="alert" className="flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
              <AlertIcon className="mt-0.5 shrink-0" width={16} height={16} /> Not enough emails left today to send this report.
            </p>
          )}

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
      {result && (
        <p role={result.ok ? 'status' : 'alert'} className={`mt-4 rounded-lg p-3 text-sm ${result.ok ? 'bg-green-50 text-green-800' : 'border border-red-200 bg-red-50 text-red-800'}`}>
          {result.message}
        </p>
      )}
    </Modal>
  );
}
