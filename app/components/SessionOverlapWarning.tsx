'use client';

import { AlertIcon } from './Icons';
import { formatTime12 } from '../lib/time';
import type { SessionOverlap } from '../lib/sessionOverlap';

/** Shown when a session would share a hall and time with another session. */
export default function SessionOverlapWarning({
  overlaps,
  onBack,
  onSaveAnyway,
}: {
  overlaps: SessionOverlap[];
  onBack: () => void;
  onSaveAnyway: () => void;
}) {
  return (
    <div role="alert" className="space-y-2 rounded-xl border border-danger-line bg-danger-tint p-3">
      <p className="flex items-center gap-2 text-sm font-semibold text-danger-strong">
        <AlertIcon width={16} height={16} /> This hall is already booked at that time.
      </p>
      <ul className="space-y-1">
        {overlaps.map((o, i) => (
          <li key={i} className="rounded-lg border border-danger-line bg-white px-2.5 py-1.5 text-sm text-danger-strong">
            <strong>{o.code}</strong> {o.name} <span className="tnum">({o.hall}, {formatTime12(o.start)} – {formatTime12(o.end)})</span>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-9 items-center rounded-lg border border-field bg-white px-4 text-sm font-medium text-ink hover:bg-slate-50"
        >
          Go back and fix
        </button>
        <button
          type="button"
          onClick={onSaveAnyway}
          className="inline-flex h-9 items-center rounded-lg bg-danger px-4 text-sm font-medium text-white hover:bg-danger-strong"
        >
          Save anyway
        </button>
      </div>
    </div>
  );
}
