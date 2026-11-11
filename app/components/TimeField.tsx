'use client';

import { useEffect, useId, useRef, useState } from 'react';
import {
  type AmPm, formatClock, formatTime12, fromMinutes, joinTime, parseTimeText, splitTime, toMinutes,
} from '../lib/time';

// Suggestions offered in the dropdown: every 5 minutes, 7:00 AM to 9:00 PM
const SUGGESTIONS: string[] = (() => {
  const out: string[] = [];
  for (let t = 7 * 60; t <= 21 * 60; t += 5) out.push(formatTime12(fromMinutes(t)));
  return out;
})();

/**
 * One time box with its own AM/PM switch.
 * Type freely (930, 9:30, 2pm, 14:30); the time is read when you leave the
 * box or press Enter. A plain hour is read like a conference day (7-11 AM,
 * 12-6 PM); type "pm"/"am" or click the switch to change it.
 * ↑/↓ move 5 minutes. The dropdown suggests 5-minute steps.
 * Text that cannot be read is flagged, never silently changed into another time.
 */
export default function TimeField({
  label,
  value,
  onChange,
  required,
  hint,
}: {
  label: string;
  value: string; // "HH:MM:00" or ""
  onChange: (value: string) => void;
  required?: boolean;
  hint?: string;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const noteId = `${id}-note`;

  const [draft, setDraft] = useState(formatClock(value));
  const [ampm, setAmPm] = useState<AmPm>(splitTime(value)?.ampm ?? 'AM');
  const [invalid, setInvalid] = useState(false);
  const editing = useRef(false);

  // Follow outside changes (e.g. the end time moving with the start time)
  useEffect(() => {
    if (editing.current) return;
    setDraft(formatClock(value));
    const p = splitTime(value);
    if (p) setAmPm(p.ampm);
    setInvalid(false);
  }, [value]);

  // forced: the AM/PM switch was just clicked, so it wins over everything else
  function commit(text: string, forced?: AmPm) {
    if (!text.trim()) {
      setInvalid(!!required);
      if (!required && value) onChange('');
      return;
    }
    // Text not changed since it was shown: keep the current value (and its AM/PM)
    if (!forced && value && text.trim() === formatClock(value)) { setInvalid(false); return; }
    const r = parseTimeText(text, forced);
    if (!r) { setInvalid(true); return; }
    setInvalid(false);
    setAmPm(r.ampm);
    setDraft(formatClock(r.value));
    if (r.value !== value) onChange(r.value);
  }

  function pickAmPm(next: AmPm) {
    if (editing.current && draft.trim()) { commit(draft, next); return; }
    setAmPm(next);
    const p = splitTime(value);
    if (p) onChange(joinTime(p.h12, p.m, next));
  }

  function step(delta: number) {
    const typed = draft.trim() && draft.trim() !== formatClock(value) ? parseTimeText(draft)?.value : '';
    const base = toMinutes(typed || value) ?? 9 * 60;
    const next = base % 5 === 0 ? base + delta : delta > 0 ? Math.ceil(base / 5) * 5 : Math.floor(base / 5) * 5;
    const v = fromMinutes(next);
    setDraft(formatClock(v));
    setAmPm(splitTime(v)!.ampm);
    setInvalid(false);
    onChange(v);
  }

  const note = invalid
    ? draft.trim() ? `“${draft}” is not a time. Try 9:30, 930 or 2pm.` : 'Enter a time.'
    : hint ?? 'Type 930, 9:30 or 2pm. 7–11 = AM, 12–6 = PM.';

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
        {required && <span className="font-normal text-muted"> (required)</span>}
      </label>
      <div className="flex items-stretch gap-2">
        <input
          id={id}
          type="text"
          autoComplete="off"
          list={listId}
          placeholder="9:30"
          value={draft}
          aria-invalid={invalid || undefined}
          aria-describedby={note ? noteId : undefined}
          onFocus={(e) => { editing.current = true; e.currentTarget.select(); }}
          onChange={(e) => {
            const t = e.target.value;
            setDraft(t);
            setInvalid(false);
            // A pick from the dropdown ("9:30 AM") is complete: use it at once
            if (SUGGESTIONS.includes(t.trim().toUpperCase())) commit(t);
          }}
          onBlur={() => { editing.current = false; commit(draft); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commit(draft); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); step(5); }
            else if (e.key === 'ArrowDown') { e.preventDefault(); step(-5); }
          }}
          className={`tnum block h-11 w-28 rounded-lg border bg-white px-3 text-base text-ink placeholder:text-muted ${
            invalid ? 'border-red-600 ring-1 ring-red-600' : 'border-field'
          }`}
        />
        <datalist id={listId}>
          {SUGGESTIONS.map((s) => <option key={s} value={s} />)}
        </datalist>
        <div role="group" aria-label={`${label}: AM or PM`} className="flex overflow-hidden rounded-lg border border-field">
          {(['AM', 'PM'] as AmPm[]).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={ampm === v}
              // keep focus in the text box so a half-typed time is read with the new AM/PM
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pickAmPm(v)}
              className={`h-11 w-12 text-sm font-medium transition-colors ${
                ampm === v ? 'bg-accent text-white' : 'bg-white text-ink-2 hover:bg-slate-50'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
      {note && (
        <p id={noteId} role={invalid ? 'alert' : undefined} className={`mt-1.5 text-xs ${invalid ? 'text-red-700' : 'text-muted'}`}>
          {note}
        </p>
      )}
    </div>
  );
}

/** "9:30 AM – 9:45 AM · 15 min", or an error when the end is not after the start */
export function DurationNote({ start, end }: { start: string; end: string }) {
  const a = toMinutes(start);
  const b = toMinutes(end);
  if (a == null || b == null) return null;
  const d = b - a;
  if (d <= 0) {
    return <p role="alert" className="text-sm font-medium text-red-700">The end time must be after the start time.</p>;
  }
  const text = d >= 60 ? `${Math.floor(d / 60)} h${d % 60 ? ` ${d % 60} min` : ''}` : `${d} min`;
  return (
    <p className="tnum text-sm text-ink-2">
      {formatTime12(start)} – {formatTime12(end)} · <span className="font-medium text-ink">{text}</span>
    </p>
  );
}
