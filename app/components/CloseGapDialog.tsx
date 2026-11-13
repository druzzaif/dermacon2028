'use client';

import { useState } from 'react';
import Modal from './Modal';
import { Button, Notice } from './ui';
import { formatTime12, toMinutes } from '../lib/time';
import type { EmptySlot } from '../lib/slots';
import { moveTopicsEarlier } from './slotActions';

/** Confirms closing an empty slot by moving every later topic up by its length. */
export default function CloseGapDialog({
  slot,
  session,
  topics,
  onCancel,
  onDone,
}: {
  slot: EmptySlot;
  session: any;
  topics: any[];
  onCancel: () => void;
  onDone: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const slotEnd = toMinutes(slot.end) ?? 0;
  const later = topics.filter((t) => (toMinutes(t.start_time) ?? -1) >= slotEnd);

  async function run() {
    setBusy(true);
    setError(null);
    const r = await moveTopicsEarlier(session.id, later, slot.minutes);
    setBusy(false);
    if (!r.success) {
      setError(r.message);
      return;
    }
    await onDone();
  }

  return (
    <Modal
      title="Close this empty slot?"
      subtitle={`${session.session_code} – ${session.session_name}`}
      size="md"
      busy={busy}
      onClose={onCancel}
      footer={
        <>
          <Button onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button variant="primary" onClick={run} busy={busy} disabled={later.length === 0}>
            {busy ? 'Moving…' : `Move ${later.length} topic${later.length === 1 ? '' : 's'} up`}
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm text-ink">
        <p className="tnum">
          The empty slot is <strong>{formatTime12(slot.start)} – {formatTime12(slot.end)}</strong> ({slot.minutes} minutes).
        </p>
        <p className="text-ink-2">
          Every topic after it ({later.length}) will start and end {slot.minutes} minutes earlier. Titles, faculty and
          confirmations do not change. Faculty who were already emailed will appear under Emails → Schedule changes,
          as with any time change.
        </p>
        {later.length > 0 && (
          <ul className="max-h-48 divide-y divide-line overflow-y-auto rounded-lg border border-line bg-white">
            {later.map((t) => (
              <li key={t.id} className="flex items-baseline gap-3 px-3 py-2">
                <span className="tnum shrink-0 text-ink-2">{formatTime12(t.start_time)}</span>
                <span className="min-w-0 truncate">{t.topic_title}</span>
              </li>
            ))}
          </ul>
        )}
        {error && <Notice tone="danger">{error}</Notice>}
      </div>
    </Modal>
  );
}
