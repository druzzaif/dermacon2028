'use client';

import { useEffect, useRef, useState } from 'react';
import Modal from './Modal';
import Badge from './Badge';
import { AlertIcon, CheckIcon } from './Icons';
import { Button, LoadingBlock, Notice } from './ui';
import TopicPicker from './TopicPicker';
import { previewEmails, sendEmailToFaculty } from '../actions';
import { allTopicIds, selectionToIds, suggestedSender, GROUP_LABEL, type TopicGroup } from '../lib/topicChoices';

type Kind = 'first' | 'update' | 'reminder';
export type SendItem = { facultyId: string; kind: Kind };
type EmailTopicPreview = {
  topicId: string;
  title: string;
  session: string;
  hall: string;
  time: string;
  role: string;
  group: TopicGroup;
  isNew?: boolean;
  confirmed: boolean;
};
type EmailPreviewRow = {
  facultyId: string;
  kind: Kind;
  name: string;
  email: string;
  problem: string;
  topics: EmailTopicPreview[];
  changes: string[];
  changeItems?: { line: string; topicId: string; session: string }[];
};
type EmailCounts = { emailed: number; today: number; faculty: number };
type EmailPreviewResponse = {
  success: boolean;
  message?: string;
  counts?: EmailCounts;
  rows: EmailPreviewRow[];
};
type SendEmailResponse = { success: boolean; message?: string };

const KIND_LABEL: Record<Kind, string> = {
  first: 'First email: full schedule, PDF attached, confirm button',
  update: 'Schedule update: what changed, full schedule, PDF attached',
  reminder: 'Reminder: asks the faculty to confirm',
};

// Seconds to wait between two emails, so Google never sees a burst. Default is the shortest choice.
const DELAY_CHOICES = [6, 15, 30, 60, 120];

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
  const [rows, setRows] = useState<EmailPreviewRow[]>([]);
  const [counts, setCounts] = useState<EmailCounts | null>(null);
  const [loadError, setLoadError] = useState('');
  const [status, setStatus] = useState<Record<string, Status>>({});
  const stopRef = useRef(false);
  const [stopped, setStopped] = useState(false);
  // Second step: after clicking Send, the user must confirm once more before anything is emailed
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    let alive = true;
    previewEmails(items).then((r: EmailPreviewResponse) => {
      if (!alive) return;
      if (!r.success) { setLoadError(r.message || 'Could not prepare the emails.'); setPhase('preview'); return; }
      setRows(r.rows);
      setCounts(r.counts ?? null);
      setPhase('preview');
    }).catch((e) => { if (alive) { setLoadError(e?.message || 'Could not prepare the emails.'); setPhase('preview'); } });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // User can override first <-> update per faculty (reminders are not switchable)
  const [kindOverride, setKindOverride] = useState<Record<string, Kind>>({});
  const kindOf = (r: EmailPreviewRow): Kind => (r.kind === 'reminder' ? 'reminder' : kindOverride[r.facultyId] || r.kind);
  const setAllKinds = (k: Kind) => {
    const next: Record<string, Kind> = {};
    rows.forEach((r) => { if (r.kind !== 'reminder') next[r.facultyId] = k; });
    setKindOverride(next);
  };
  const canSwitch = rows.some((r) => r.kind !== 'reminder' && !r.problem);

  // Which topics each person's email (and PDF) will include. Default: everything.
  const [selection, setSelection] = useState<Record<string, Set<string>>>({});
  const [openPicker, setOpenPicker] = useState<string | null>(null);
  const selOf = (r: EmailPreviewRow) => selection[r.facultyId] ?? allTopicIds(r.topics);
  const setSel = (facultyId: string, next: Set<string>) => setSelection((s) => ({ ...s, [facultyId]: next }));
  const setEveryone = (group: TopicGroup | 'all') => {
    const next: Record<string, Set<string>> = {};
    rows.forEach((r) => {
      next[r.facultyId] = new Set(r.topics.filter((t) => group === 'all' || t.group === group).map((t) => t.topicId));
    });
    setSelection(next);
  };

  const effRows = rows.map((r) => {
    const sel = selOf(r);
    const kind = kindOf(r);
    // changes shown / sent only for the topics that are ticked
    const sessions = new Set(r.topics.filter((t) => sel.has(t.topicId)).map((t) => t.session));
    const all = sel.size === r.topics.length;
    const changes = r.changeItems
      ? r.changeItems.filter((c) => all || sel.has(c.topicId) || sessions.has(c.session)).map((c) => c.line)
      : r.changes;
    return { ...r, kind, sel, changes, problem: r.problem || (sel.size === 0 ? 'No topic is ticked.' : '') };
  });

  // Sender: Scientific Committee is suggested when only scientific topics are ticked; the user can override
  const [senderOverride, setSenderOverride] = useState<'workshop' | 'scientific' | null>(null);
  const tickedAll = effRows.filter((r) => !r.problem).flatMap((r) => r.topics.filter((t) => r.sel.has(t.topicId)));
  const sender = senderOverride ?? suggestedSender(tickedAll as any, new Set(tickedAll.map((t) => t.topicId)));

  const sendable = effRows.filter((r) => !r.problem);
  // Many emails: default to a longer pause so the account is not flagged for bursts
  const [delaySeconds, setDelaySeconds] = useState(items.length > 5 ? 30 : 6);
  const minutes = Math.max(1, Math.round((sendable.length * (delaySeconds + 6)) / 60));

  async function run() {
    setPhase('sending');
    stopRef.current = false;
    const init: Record<string, Status> = {};
    effRows.forEach((r) => { init[r.facultyId] = r.problem ? { state: 'skipped', message: r.problem } : { state: 'waiting' }; });
    setStatus(init);

    const queue = effRows.filter((r) => !r.problem);
    for (let i = 0; i < queue.length; i++) {
      if (stopRef.current) break;
      const r = queue[i];
      setStatus((s) => ({ ...s, [r.facultyId]: { state: 'sending' } }));
      const res: SendEmailResponse = await sendEmailToFaculty(r.facultyId, r.kind, { topicIds: selectionToIds(r.topics as any, r.sel), sender });
      setStatus((s) => ({ ...s, [r.facultyId]: { state: res.success ? 'ok' : 'failed', message: res.message } }));
      if (!res.success && /limit|too many times|Unauthorized|unexpected reply/i.test(res.message || '')) {
        stopRef.current = true;           // a limit or setup problem would fail every remaining email
        break;
      }
      if (i < queue.length - 1 && !stopRef.current) {
        await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1000));
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
        <Button variant="primary" onClick={() => setConfirming(true)} disabled={sendable.length === 0 || !!loadError}>
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
              Real emails will go to the addresses listed below, sent as {sender === 'scientific' ? 'Scientific Committee' : 'the Workshop Committee account'}, each with a PDF of the ticked topics attached. Sent emails cannot be recalled.
              Click <strong>Yes, send {sendWord}</strong> to start, or <strong>Go back</strong> to change the list.
            </Notice>
          )}
          <div className="rounded-xl bg-canvas p-4 text-sm text-ink ring-1 ring-inset ring-line">
            <p className="font-semibold">
              {sendable.length} email{sendable.length === 1 ? '' : 's'} will be sent from the Google account that runs your script.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <label htmlFor="send-from" className="font-medium">Send as:</label>
              <select
                id="send-from"
                value={sender}
                disabled={confirming}
                onChange={(e) => setSenderOverride(e.target.value as 'workshop' | 'scientific')}
                className="rounded-lg border border-line bg-white px-2 py-1 text-sm text-ink"
              >
                <option value="workshop">Workshop / DERMACON (default)</option>
                <option value="scientific">Scientific Committee &lt;scientific@dermacon2027.com&gt;</option>
              </select>
              {senderOverride === null && sender === 'scientific' && <span className="text-xs text-muted">Suggested: only scientific topics are ticked.</span>}
            </div>
            {sender === 'scientific' && (
              <p className="mt-1 text-xs text-ink-2">Shown as “Scientific Committee”; replies go to scientific@dermacon2027.com.</p>
            )}
            <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-2">
              <li>
                One email at a time, with a{' '}
                <select
                  aria-label="Pause between emails"
                  value={delaySeconds}
                  disabled={confirming}
                  onChange={(e) => setDelaySeconds(Number(e.target.value))}
                  className="rounded-lg border border-line bg-white px-1.5 py-0.5 text-sm text-ink"
                >
                  {DELAY_CHOICES.map((s) => <option key={s} value={s}>{s} seconds</option>)}
                </select>
                {' '}pause between emails (about {minutes} minute{minutes === 1 ? '' : 's'} in total). Keep this window open while sending.
              </li>
              <li>Each email has one PDF attached with the ticked topics only, one page per session.</li>
              <li>No coordinator or committee member receives anything.</li>
            </ul>
            {counts && (
              <p className="mt-3">
                Faculty emailed so far: <strong className="tnum">{counts.emailed}</strong> of <span className="tnum">{counts.faculty}</span>
                {' '}(<strong className="tnum">{counts.today}</strong> today). No limit is set by this app.
              </p>
            )}
          </div>

          {canSwitch && !confirming && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium text-ink">Send all as:</span>
              <Button onClick={() => setAllKinds('first')}>New email</Button>
              <Button onClick={() => setAllKinds('update')}>Schedule update</Button>
            </div>
          )}

          {!confirming && rows.some((r) => r.topics.length > 0) && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium text-ink">Include for everyone:</span>
              <Button onClick={() => setEveryone('all')}>Everything</Button>
              <Button onClick={() => setEveryone('workshop')}>{GROUP_LABEL.workshop} only</Button>
              <Button onClick={() => setEveryone('scientific')}>{GROUP_LABEL.scientific} only</Button>
            </div>
          )}

          <ul className="space-y-3">
            {effRows.map((r) => { const rr = r; return (
              <li key={r.facultyId} className={`rounded-xl border p-3.5 ${r.problem ? 'border-danger-line bg-danger-tint' : 'border-line bg-white'}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="min-w-0">
                    <span className="font-semibold text-ink">{r.name}</span>
                    <span className="ml-2 break-all text-sm text-muted">{r.email || 'no email'}</span>
                  </div>
                  {rr.kind !== 'reminder' && !r.problem && !confirming ? (
                    <select
                      aria-label={`Email type for ${r.name}`}
                      value={r.kind}
                      onChange={(e) => setKindOverride((o) => ({ ...o, [r.facultyId]: e.target.value as Kind }))}
                      className="rounded-lg border border-line bg-white px-2 py-1 text-sm text-ink"
                    >
                      <option value="first">New email</option>
                      <option value="update">Schedule update</option>
                    </select>
                  ) : (
                    <Badge tone={r.kind === 'update' ? 'warning' : r.kind === 'reminder' ? 'neutral' : 'accent'}>
                      {r.kind === 'first' ? 'New email' : r.kind === 'update' ? 'Schedule update' : 'Reminder'}
                    </Badge>
                  )}
                </div>
                {r.problem ? (
                  <p className="mt-2 text-sm font-medium text-danger-strong">Will be skipped: {r.problem}</p>
                ) : (
                  <>
                    <p className="mt-1 text-xs text-muted">{KIND_LABEL[r.kind as Kind]}</p>
                    {r.kind === 'update' && r.changes?.length > 0 && (
                      <div className="mt-2 rounded-lg bg-warning-tint p-2.5 text-sm text-warning">
                        <p className="font-semibold">What changed (shown at the top of the email)</p>
                        <ul className="mt-1 list-disc space-y-0.5 pl-5">
                          {r.changes.map((change, i) => <li key={i}>{change}</li>)}
                        </ul>
                      </div>
                    )}
                    {!confirming && (
                      <div className="mt-2">
                        <Button size="sm" onClick={() => setOpenPicker(openPicker === r.facultyId ? null : r.facultyId)} aria-expanded={openPicker === r.facultyId}>
                          Choose topics ({r.sel.size} of {r.topics.length})
                        </Button>
                      </div>
                    )}
                    {openPicker === r.facultyId && !confirming && (
                      <div className="mt-2">
                        <TopicPicker topics={r.topics as any} selected={r.sel} onChange={(next) => setSel(r.facultyId, next)} />
                      </div>
                    )}
                    <ul className="mt-2 space-y-1">
                      {r.topics.filter((t) => r.sel.has(t.topicId)).map((t) => (
                        <li key={t.topicId} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                          <span className="tnum font-medium text-accent">{t.session}</span>
                          <span className="text-ink">{t.title}</span>
                          <span className="text-muted">Hall {t.hall}</span>
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
            ); })}
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
            {effRows.map((r) => {
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
