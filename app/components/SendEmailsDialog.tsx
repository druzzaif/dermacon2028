'use client';

import { useEffect, useRef, useState } from 'react';
import Modal from './Modal';
import Badge from './Badge';
import { AlertIcon, CheckIcon } from './Icons';
import { Button, LoadingBlock, Notice } from './ui';
import { previewEmails, sendEmailToFaculty } from '../actions';

type Kind = 'first' | 'update' | 'reminder';
export type SendItem = { facultyId: string; kind: Kind };

const KIND_LABEL: Record<Kind, string> = {
  first: 'First email: full schedule, PDF attached, confirm button',
  update: 'Schedule update: what changed, full schedule, PDF attached',
  reminder: 'Reminder: asks the faculty to confirm',
};

// Seconds to wait between two emails, so Google never sees a burst.
const DELAY_SECONDS = 6;

type Status = { state: 'waiting' | 'sending' | 'ok' | 'failed' | 'skipped'; message?: string };

/**
 * Shows exactly what is about to happen (who gets which email, about which topics,
 * what is attached, how many emails are left today). Nothing is sent until
 * "Send" is clicked. Emails then go one at a time with a pause between them.
 */
export default function SendEmailsDialog({
  items,
  onClose,
  onDone,
}: {
  items: SendItem[];
  onClose: () => void;
  onDone?: () => void;
}) {
  const [phase, setPhase] = useState<'loading' | 'preview' | 'sending' | 'done'>('loading');
  const [rows, setRows] = useState<any[]>([]);
  const [quota, setQuota] = useState(0);
  const [reserve, setReserve] = useState(5);
  const [quotaProblem, setQuotaProblem] = useState('');
  const [loadError, setLoadError] = useState('');
  const [status, setStatus] = useState<Record<string, Status>>({});
  const stopRef = useRef(false);
  const [stopped, setStopped] = useState(false);
  // Second step: after clicking Send, the user must confirm once more before anything is emailed
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    let alive = true;
    previewEmails(items).then((r: any) => {
      if (!alive) return;
      if (!r.success) { setLoadError(r.message || 'Could not prepare the emails.'); setPhase('preview'); return; }
      setRows(r.rows);
      setQuota(r.quota);
      setReserve(r.reserve);
      setQuotaProblem(r.quotaOk ? '' : r.quotaMessage || 'Could not read the daily email limit.');
      setPhase('preview');
    }).catch((e) => { if (alive) { setLoadError(e?.message || 'Could not prepare the emails.'); setPhase('preview'); } });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendable = rows.filter((r) => !r.problem);
  const usable = Math.max(0, quota - reserve);
  const notEnough = !quotaProblem && sendable.length > usable;
  const minutes = Math.max(1, Math.round((sendable.length * (DELAY_SECONDS + 6)) / 60));

  async function run() {
    setPhase('sending');
    stopRef.current = false;
    const init: Record<string, Status> = {};
    rows.forEach((r) => { init[r.facultyId] = r.problem ? { state: 'skipped', message: r.problem } : { state: 'waiting' }; });
    setStatus(init);

    const queue = rows.filter((r) => !r.problem);
    for (let i = 0; i < queue.length; i++) {
      if (stopRef.current) break;
      const r = queue[i];
      setStatus((s) => ({ ...s, [r.facultyId]: { state: 'sending' } }));
      const res: any = await sendEmailToFaculty(r.facultyId, r.kind);
      setStatus((s) => ({ ...s, [r.facultyId]: { state: res.success ? 'ok' : 'failed', message: res.message } }));
      if (!res.success && /left today|limit|Unauthorized|unexpected reply/i.test(res.message || '')) {
        stopRef.current = true;           // a limit or setup problem would fail every remaining email
        break;
      }
      if (i < queue.length - 1 && !stopRef.current) {
        await new Promise((resolve) => setTimeout(resolve, DELAY_SECONDS * 1000));
      }
    }
    setStopped(stopRef.current);
    setPhase('done');
    onDone?.();
  }

  const okCount = Object.values(status).filter((s) => s.state === 'ok').length;
  const failCount = Object.values(status).filter((s) => s.state === 'failed').length;
  const notSent = Object.values(status).filter((s) => s.state === 'waiting' || s.state === 'sending').length;

  const sendWord = `${sendable.length} email${sendable.length === 1 ? '' : 's'}`;

  let footer;
  if (phase === 'preview' && confirming) {
    footer = (
      <>
        <Button onClick={() => setConfirming(false)}>Go back</Button>
        <Button variant="primary" onClick={run}>Yes, send {sendWord}</Button>
      </>
    );
  } else if (phase === 'preview') {
    footer = (
      <>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" onClick={() => setConfirming(true)} disabled={sendable.length === 0 || notEnough || !!loadError}>
          Send {sendWord}…
        </Button>
      </>
    );
  } else if (phase === 'sending') {
    footer = (
      <Button onClick={() => { stopRef.current = true; }}>
        Stop after the current email
      </Button>
    );
  } else if (phase === 'done') {
    footer = <Button variant="primary" onClick={onClose}>Close</Button>;
  }

  return (
    <Modal
      title={phase === 'done' ? 'Finished' : phase === 'sending' ? 'Sending…' : 'Check before sending'}
      subtitle={phase === 'preview' ? 'Nothing is sent until you click Send.' : undefined}
      size="lg"
      busy={phase === 'sending'}
      onClose={onClose}
      footer={footer}
    >
      {phase === 'loading' && <LoadingBlock>Preparing the list…</LoadingBlock>}

      {phase === 'preview' && loadError && (
        <Notice tone="danger">{loadError}</Notice>
      )}

      {phase === 'preview' && !loadError && (
        <div className="space-y-4">
          {confirming && (
            <Notice tone="warning" title={`You are about to send ${sendWord}`}>
              Real emails will go to the addresses listed below, each with a PDF attached. Sent emails cannot be recalled.
              Click <strong>Yes, send {sendWord}</strong> to start, or <strong>Go back</strong> to change the list.
            </Notice>
          )}
          <div className="rounded-xl bg-canvas p-4 text-sm text-ink ring-1 ring-inset ring-line">
            <p className="font-semibold">
              {sendable.length} email{sendable.length === 1 ? '' : 's'} will be sent from the Google account that runs your script.
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-2">
              <li>One email at a time, with a {DELAY_SECONDS}-second pause between emails (about {minutes} minute{minutes === 1 ? '' : 's'} in total).</li>
              <li>Each email has one PDF attached, with one page per session.</li>
              <li>No coordinator or committee member receives anything.</li>
            </ul>
            <p className="mt-3">
              Emails left today: <strong className="tnum">{quotaProblem ? 'unknown' : quota}</strong>
              {!quotaProblem && <> ({reserve} are kept free for confirmation thank-you emails, so <strong className="tnum">{usable}</strong> can be used now).</>}
            </p>
          </div>

          {quotaProblem && (
            <p role="alert" className="flex items-start gap-2 rounded-lg border border-warning-line bg-warning-tint p-3 text-sm text-warning">
              <AlertIcon className="mt-0.5 shrink-0" width={16} height={16} />
              {quotaProblem} You can still send, but the limit could not be checked first.
            </p>
          )}
          {notEnough && (
            <p role="alert" className="flex items-start gap-2 rounded-lg border border-danger-line bg-danger-tint p-3 text-sm text-danger-strong">
              <AlertIcon className="mt-0.5 shrink-0" width={16} height={16} />
              Only {usable} email{usable === 1 ? '' : 's'} can be sent today but you selected {sendable.length}. Select fewer faculty, or wait for the daily limit to reset.
            </p>
          )}

          <ul className="space-y-3">
            {rows.map((r) => (
              <li key={r.facultyId} className={`rounded-xl border p-3.5 ${r.problem ? 'border-danger-line bg-danger-tint' : 'border-line bg-white'}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="min-w-0">
                    <span className="font-semibold text-ink">{r.name}</span>
                    <span className="ml-2 break-all text-sm text-muted">{r.email || 'no email'}</span>
                  </div>
                  <Badge tone={r.kind === 'update' ? 'warning' : r.kind === 'reminder' ? 'neutral' : 'accent'}>
                    {r.kind === 'first' ? 'First email' : r.kind === 'update' ? 'Schedule update' : 'Reminder'}
                  </Badge>
                </div>
                {r.problem ? (
                  <p className="mt-2 text-sm font-medium text-danger-strong">Will be skipped: {r.problem}</p>
                ) : (
                  <>
                    <p className="mt-1 text-xs text-muted">{KIND_LABEL[r.kind as Kind]}</p>
                    {r.changes?.length > 0 && (
                      <div className="mt-2 rounded-lg bg-warning-tint p-2.5 text-sm text-warning">
                        <p className="font-semibold">What changed (shown at the top of the email)</p>
                        <ul className="mt-1 list-disc space-y-0.5 pl-5">
                          {r.changes.map((c: string, i: number) => <li key={i}>{c}</li>)}
                        </ul>
                      </div>
                    )}
                    <ul className="mt-2 space-y-1">
                      {r.topics.map((t: any) => (
                        <li key={t.topicId} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                          <span className="tnum font-medium text-accent">{t.session}</span>
                          <span className="text-ink">{t.title}</span>
                          <span className="tnum text-muted">{t.time}</span>
                          <Badge tone={t.role === 'Chairperson' ? 'orange' : 'blue'}>{t.role}</Badge>
                          {t.isNew && <Badge tone="warning">new / changed</Badge>}
                          {t.confirmed && <Badge tone="success"><CheckIcon width={12} height={12} strokeWidth={3} /> already confirmed</Badge>}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {(phase === 'sending' || phase === 'done') && (
        <div className="space-y-3">
          {phase === 'done' && (
            <p role="status" className="rounded-lg bg-canvas p-3 text-sm text-ink ring-1 ring-inset ring-line">
              <strong>{okCount}</strong> sent{failCount > 0 && <>, <strong className="text-danger">{failCount}</strong> failed</>}
              {stopped && notSent > 0 && <>, <strong>{notSent}</strong> not sent (stopped)</>}.
            </p>
          )}
          <ul className="divide-y divide-line rounded-xl border border-line bg-white">
            {rows.map((r) => {
              const st = status[r.facultyId] || { state: 'waiting' as const };
              return (
                <li key={r.facultyId} className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 text-sm">
                  <span className="font-medium text-ink">{r.name}</span>
                  <span className={
                    st.state === 'ok' ? 'text-success' : st.state === 'failed' ? 'text-danger' : 'text-ink-2'
                  }>
                    {st.state === 'waiting' && 'Waiting'}
                    {st.state === 'sending' && 'Sending…'}
                    {st.state === 'skipped' && `Skipped: ${st.message}`}
                    {(st.state === 'ok' || st.state === 'failed') && st.message}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Modal>
  );
}
