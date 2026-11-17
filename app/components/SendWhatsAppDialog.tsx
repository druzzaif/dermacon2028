'use client';

import { useEffect, useRef, useState } from 'react';
import Modal from './Modal';
import Badge from './Badge';
import { Button, LoadingBlock, Notice } from './ui';
import { previewWhatsAppReminders, sendWhatsAppReminderToFaculty } from '../actions';
import { WHATSAPP_TEMPLATE, type WhatsAppPreviewRow } from '../lib/whatsapp';

type WhatsAppCounts = { sent: number; faculty: number };
type PreviewResponse = {
  success: boolean;
  message?: string;
  testMode?: boolean;
  testToMasked?: string;
  sender?: string;
  templateName?: string;
  counts?: WhatsAppCounts;
  rows: WhatsAppPreviewRow[];
};
type SendResponse = { success: boolean; message?: string; fatal?: boolean; testMode?: boolean };

// Seconds between two messages. WhatsApp tolerates more than Gmail, but a pause
// keeps a 100-person run from looking like a burst.
const DELAY_CHOICES = [2, 3, 5, 10];

type Status = { state: 'waiting' | 'sending' | 'ok' | 'failed' | 'skipped'; message?: string };

/**
 * Shows exactly what will be sent (the approved template, the name used in
 * {{1}} and the masked number). Nothing goes out until "Send" is confirmed.
 * Messages then go one at a time with a pause between them.
 */
export default function SendWhatsAppDialog({
  facultyIds,
  onClose,
  onDone,
}: {
  facultyIds: string[];
  onClose: () => void;
  onDone?: () => void;
}) {
  const [phase, setPhase] = useState<'loading' | 'preview' | 'sending' | 'done'>('loading');
  const [rows, setRows] = useState<WhatsAppPreviewRow[]>([]);
  const [counts, setCounts] = useState<WhatsAppCounts | null>(null);
  const [testMode, setTestMode] = useState(false);
  const [testToMasked, setTestToMasked] = useState('');
  const [sender, setSender] = useState('Dermacon 2027');
  const [loadError, setLoadError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState<Record<string, Status>>({});
  const stopRef = useRef(false);
  const [stopped, setStopped] = useState(false);
  const [delaySeconds, setDelaySeconds] = useState(facultyIds.length > 5 ? 5 : 3);
  const [openPreview, setOpenPreview] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    previewWhatsAppReminders(facultyIds).then((r: PreviewResponse) => {
      if (!alive) return;
      if (!r.success) { setLoadError(r.message || 'Could not prepare the WhatsApp reminders.'); setPhase('preview'); return; }
      setRows(r.rows);
      setCounts(r.counts ?? null);
      setTestMode(!!r.testMode);
      setTestToMasked(r.testToMasked || '');
      setSender(r.sender || 'Dermacon 2027');
      setPhase('preview');
    }).catch((e) => {
      if (alive) { setLoadError(e?.message || 'Could not prepare the WhatsApp reminders.'); setPhase('preview'); }
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendable = rows.filter((r) => !r.problem);
  const sendWord = `${sendable.length} message${sendable.length === 1 ? '' : 's'}`;
  const minutes = Math.max(1, Math.round((sendable.length * (delaySeconds + 3)) / 60));

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
      const res: SendResponse = await sendWhatsAppReminderToFaculty(r.facultyId);
      setStatus((s) => ({ ...s, [r.facultyId]: { state: res.success ? 'ok' : 'failed', message: res.message } }));
      if (!res.success && res.fatal) { stopRef.current = true; break; } // auth/template/rate limit: the rest would fail too
      if (i < queue.length - 1 && !stopRef.current) {
        await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1000));
      }
    }
    setStopped(stopRef.current);
    setPhase('done');
    if (!testMode) onDone?.(); // a test send does not change the database
  }

  const okCount = Object.values(status).filter((s) => s.state === 'ok').length;
  const failCount = Object.values(status).filter((s) => s.state === 'failed').length;
  const notSent = Object.values(status).filter((s) => s.state === 'waiting' || s.state === 'sending').length;

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
        <Button variant="primary" onClick={() => setConfirming(true)} disabled={sendable.length === 0 || !!loadError}>
          Send {sendWord}…
        </Button>
      </>
    );
  } else if (phase === 'sending') {
    footer = <Button onClick={() => { stopRef.current = true; }}>Stop after the current message</Button>;
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

      {phase === 'preview' && loadError && <Notice tone="danger">{loadError}</Notice>}

      {phase === 'preview' && !loadError && (
        <div className="space-y-4">
          {confirming && (
            <Notice tone="warning" title={`You are about to send ${sendWord}`}>
              Real WhatsApp messages will go from {sender}. Sent messages cannot be recalled.
              Click <strong>Yes, send {sendWord}</strong> to start, or <strong>Go back</strong> to change the list.
            </Notice>
          )}

          {testMode && (
            <Notice tone="info" title="Test mode">
              Every message goes to <strong className="tnum">{testToMasked}</strong> instead of the faculty member,
              and nobody is marked as WhatsApp&apos;d. Remove <code className="rounded bg-white px-1">WHATSAPP_TEST_TO</code>{' '}
              from .env.local to send for real.
            </Notice>
          )}

          <div className="rounded-xl bg-canvas p-4 text-sm text-ink ring-1 ring-inset ring-line">
            <p className="font-semibold">
              {sendable.length} WhatsApp message{sendable.length === 1 ? '' : 's'} from {sender}.
            </p>
            <p className="mt-1 text-xs text-ink-2">
              Template <code className="rounded bg-white px-1">{WHATSAPP_TEMPLATE.name}</code> ({WHATSAPP_TEMPLATE.language}).
              Only the doctor&apos;s name changes; the rest of the text and the Confirm button are fixed by the approved template.
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-2">
              <li>
                One message at a time, with a{' '}
                <select
                  aria-label="Pause between messages"
                  value={delaySeconds}
                  disabled={confirming}
                  onChange={(e) => setDelaySeconds(Number(e.target.value))}
                  className="rounded-lg border border-line bg-white px-1.5 py-0.5 text-sm text-ink"
                >
                  {DELAY_CHOICES.map((s) => <option key={s} value={s}>{s} seconds</option>)}
                </select>{' '}
                pause between messages (about {minutes} minute{minutes === 1 ? '' : 's'}). Keep this window open while sending.
              </li>
              <li>This is the WhatsApp reminder only: no email or PDF is sent.</li>
            </ul>
            {counts && (
              <p className="mt-3">
                Faculty marked as WhatsApp&apos;d so far: <strong className="tnum">{counts.sent}</strong> of{' '}
                <span className="tnum">{counts.faculty}</span>.
              </p>
            )}
          </div>

          <ul className="space-y-3">

            {rows.map((r) => (
              <li key={r.facultyId} className={`rounded-xl border p-3.5 ${r.problem ? 'border-danger-line bg-danger-tint' : 'border-line bg-white'}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="min-w-0">
                    <span className="font-semibold text-ink">{r.name}</span>
                    <span className="tnum ml-2 text-sm text-muted">{r.phoneMasked || 'no phone'}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {r.alreadySent && <Badge tone="success">sent before</Badge>}
                    <Badge tone="neutral">Dear Dr. {r.parameter || '…'}</Badge>
                  </div>
                </div>

                {r.problem ? (
                  <p className="mt-2 text-sm font-medium text-danger-strong">Will be skipped: {r.problem}</p>
                ) : (
                  <>
                    {r.warnings.length > 0 && (
                      <ul className="mt-2 space-y-1 text-sm text-warning">
                        {r.warnings.map((w, i) => <li key={i}>{w}</li>)}
                      </ul>
                    )}
                    <div className="mt-2">
                      <Button
                        size="sm"
                        onClick={() => setOpenPreview(openPreview === r.facultyId ? null : r.facultyId)}
                        aria-expanded={openPreview === r.facultyId}
                      >
                        {openPreview === r.facultyId ? 'Hide message' : 'Show message'}
                      </Button>
                    </div>
                    {openPreview === r.facultyId && (
                      <div className="mt-2 rounded-xl border border-line bg-[#e5ddd5] p-3">
                        <div className="rounded-lg bg-white p-3 text-sm leading-relaxed text-ink shadow-sm">
                          <p className="whitespace-pre-line">{r.message}</p>
                          <a
                            href={WHATSAPP_TEMPLATE.button.url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-3 flex items-center justify-center rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-[#075e54] hover:bg-slate-50"
                          >
                            {WHATSAPP_TEMPLATE.button.text}
                          </a>
                        </div>
                        <p className="mt-1.5 text-[11px] text-ink-2">Preview of the approved template. The button opens the confirmation form.</p>
                      </div>
                    )}
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
                  <span className={st.state === 'ok' ? 'text-success' : st.state === 'failed' ? 'text-danger' : 'text-ink-2'}>
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

