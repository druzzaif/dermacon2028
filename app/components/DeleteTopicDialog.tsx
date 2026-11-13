'use client';

import { useMemo, useState } from 'react';
import Modal from './Modal';
import { Button, Notice } from './ui';
import { deleteTopic } from '../actions';
import { effectOfDeleting } from '../lib/slots';
import { addMinutes, formatTime12 } from '../lib/time';
import { moveTopicsEarlier } from './slotActions';

type Choice = 'keep' | 'shift';

/**
 * Delete one topic. When deleting it would leave empty time before later topics,
 * the user must first choose: keep the slot empty, or move the later topics up.
 */
export default function DeleteTopicDialog({
  topic,
  session,
  topics,
  facultyCount,
  onCancel,
  onDeleted,
}: {
  topic: any;
  session: any;
  /** Every topic of this session (to work out what the delete leaves behind) */
  topics: any[];
  facultyCount: number;
  onCancel: () => void;
  onDeleted: () => void | Promise<void>;
}) {
  const [choice, setChoice] = useState<Choice | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effect = useMemo(() => effectOfDeleting(topic.id, topics), [topic.id, topics]);
  const later = topics.filter((t) => effect.laterIds.includes(String(t.id)));
  const leavesGap = effect.freed > 0 && later.length > 0;
  const lastLater = later.reduce<string | null>((m, t) => (!m || String(t.end_time) > m ? String(t.end_time) : m), null);

  async function confirm() {
    setBusy(true);
    setError(null);
    const res = await deleteTopic(topic.id, session.id);
    if (!res.success) {
      setError(res.message);
      setBusy(false);
      return;
    }
    if (leavesGap && choice === 'shift') {
      const moved = await moveTopicsEarlier(session.id, later, effect.freed);
      if (!moved.success) {
        // The topic is gone; only the move failed. Show why, then let the list reload.
        setError(`The topic was deleted, but the later topics could not all be moved. ${moved.message}`);
        setBusy(false);
        await onDeleted();
        return;
      }
    }
    setBusy(false);
    await onDeleted();
  }

  const option = (value: Choice, title: string, desc: string) => (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${
        choice === value ? 'border-accent bg-accent-tint' : 'border-line bg-white hover:bg-slate-50'
      }`}
    >
      <input type="radio" name="after-delete" className="mt-0.5" checked={choice === value} disabled={busy} onChange={() => setChoice(value)} />
      <span>
        <span className="block text-sm font-semibold text-ink">{title}</span>
        <span className="block text-sm text-ink-2">{desc}</span>
      </span>
    </label>
  );

  return (
    <Modal
      title="Delete this topic?"
      subtitle={`${session.session_code} – ${session.session_name}`}
      size="md"
      busy={busy}
      onClose={onCancel}
      footer={
        <>
          <Button onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button variant="danger" onClick={confirm} busy={busy} disabled={leavesGap && !choice}>
            {busy ? 'Deleting…' : 'Delete topic'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg border border-line bg-canvas p-3 text-sm">
          <p className="font-semibold text-ink">{topic.topic_title || '(no title)'}</p>
          <p className="tnum mt-1 text-ink-2">
            No. {topic.sequence_no ?? '?'}
            {topic.start_time && topic.end_time && <> · {formatTime12(topic.start_time)} – {formatTime12(topic.end_time)}</>}
            {facultyCount > 0 && <> · {facultyCount} faculty link{facultyCount === 1 ? '' : 's'} will be removed</>}
          </p>
        </div>

        {leavesGap ? (
          <>
            <Notice tone="warning" title={`This leaves ${effect.freed} minutes empty in the session`}>
              <span className="tnum">
                {formatTime12(effect.from)} – {formatTime12(effect.to)} will have no topic, and {later.length} topic
                {later.length === 1 ? ' follows' : 's follow'} it. Choose what to do with that time.
              </span>
            </Notice>
            <fieldset className="space-y-2">
              <legend className="sr-only">What to do with the empty time</legend>
              {option(
                'keep',
                'Keep the slot empty',
                'Nothing else moves. The empty slot shows in red in the topic list until you add a topic there or close it.',
              )}
              {option(
                'shift',
                `Move the later topics up by ${effect.freed} minutes`,
                `${later.length} topic${later.length === 1 ? '' : 's'} start${later.length === 1 ? 's' : ''} ${effect.freed} minutes earlier${
                  lastLater ? `, so the last one ends at ${formatTime12(addMinutes(lastLater, -effect.freed))}` : ''
                }. Their faculty get a changed time, so those already emailed will appear under Emails → Schedule changes.`,
              )}
            </fieldset>
            {!choice && <p className="text-sm text-ink-2">Choose one of the two options to continue.</p>}
          </>
        ) : (
          <p className="text-sm text-ink-2">
            {effect.freed === 0 && later.length > 0
              ? 'Another topic runs at the same time, so no empty slot is left. '
              : ''}
            Remaining topics in this session renumber automatically.
          </p>
        )}

        <p className="text-sm font-medium text-ink">This cannot be undone.</p>
        {error && <Notice tone="danger">{error}</Notice>}
      </div>
    </Modal>
  );
}
