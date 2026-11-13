'use client';

import { useRef, useState } from 'react';
import { supabase } from '../supabase';
import Modal from './Modal';
import Field, { inputCompactCls } from './Field';
import { TimeRange } from './TimeField';
import SessionOverlapWarning from './SessionOverlapWarning';
import SessionChairsPicker, { logSessionChairChanges, type ChairPerson } from './SessionChairsPicker';
import { SESSION_TYPES } from './EditSessionModal';
import { findSessionOverlaps, type SessionOverlap } from '../lib/sessionOverlap';
import { buttonCls } from './ui';

const secondaryBtn = buttonCls('secondary');
const primaryBtn = buttonCls('primary');

// Creates a new row in conference_sessions. After saving, the Sessions page
// reloads on the new session (via ?code=) so you can add topics and coordinators.
export default function AddSessionModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (sessionCode: string) => void;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overlaps, setOverlaps] = useState<SessionOverlap[]>([]);
  const skipOverlapCheck = useRef(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState('Workshop');
  const [hall, setHall] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [chairs, setChairs] = useState<ChairPerson[]>([]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setOverlaps([]);
    const c = code.trim().toUpperCase();
    if (!c) return setError('Session code is required (e.g. WS12).');
    if (!name.trim()) return setError('Enter the session name.');
    if (!date) return setError('Choose the session date.');
    if (!startTime || !endTime) return setError('Set the start and end time.');
    if (endTime <= startTime) return setError('The end time must be after the start time.');

    setIsSaving(true);
    // Session codes must be unique
    const { data: existing, error: dupError } = await supabase
      .from('conference_sessions')
      .select('id')
      .ilike('session_code', c)
      .limit(1);
    if (dupError) { setIsSaving(false); return setError(dupError.message); }
    if (existing && existing.length > 0) { setIsSaving(false); return setError(`A session with code ${c} already exists.`); }

    // Same hall + same date + overlapping time = warn. "Save anyway" skips the check once.
    const skip = skipOverlapCheck.current;
    skipOverlapCheck.current = false;
    if (!skip) {
      try {
        const found = await findSessionOverlaps({ hall, date, start: startTime, end: endTime });
        if (found.length > 0) {
          setOverlaps(found);
          setIsSaving(false);
          return;
        }
      } catch (err: any) {
        setIsSaving(false);
        return setError(err?.message || 'Could not check for overlapping sessions.');
      }
    }

    const { data: created, error: insertError } = await supabase.from('conference_sessions').insert({
      session_code: c,
      session_name: name.trim(),
      session_type: type,
      session_date: date,
      hall: hall.trim() || null,
      start_time: startTime,
      end_time: endTime,
    }).select('id').single();
    if (insertError) { setIsSaving(false); return setError(insertError.message); }

    if (chairs.length > 0 && created) {
      const { error: chairError } = await supabase.from('session_chairs')
        .insert(chairs.map((p, i) => ({ session_id: created.id, faculty_id: p.id, sort_order: i + 1 })));
      if (chairError) { setIsSaving(false); return setError('Session created, but the chairpersons were not saved: ' + chairError.message); }
      await logSessionChairChanges(c, [], chairs);
    }
    setIsSaving(false);
    onSaved(c);
  }

  function saveAnyway() {
    skipOverlapCheck.current = true;
    setOverlaps([]);
    (document.getElementById('add-session-form') as HTMLFormElement | null)?.requestSubmit();
  }

  return (
    <Modal
      title="Add session"
      size="lg"
      dense
      onClose={onClose}
      busy={isSaving}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={isSaving} className={secondaryBtn}>Cancel</button>
          <button type="submit" form="add-session-form" disabled={isSaving} className={primaryBtn}>
            {isSaving ? 'Saving…' : 'Create session'}
          </button>
        </>
      }
    >
      <form id="add-session-form" onSubmit={handleSubmit} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-[7rem_1fr]">
          <Field label="Code" required compact>
            {(p) => <input {...p} value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. WS12" className={`${inputCompactCls} uppercase`} />}
          </Field>
          <Field label="Session name" required compact>
            {(p) => <input {...p} value={name} onChange={(e) => setName(e.target.value)} className={`${inputCompactCls} font-medium`} />}
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Type" compact>
            {(p) => (
              <select {...p} value={type} onChange={(e) => setType(e.target.value)} className={inputCompactCls}>
                {SESSION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            )}
          </Field>
          <Field label="Hall" compact>
            {(p) => <input {...p} value={hall} onChange={(e) => setHall(e.target.value)} placeholder="e.g. B1" className={inputCompactCls} />}
          </Field>
          <Field label="Date" required compact>
            {(p) => <input {...p} type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCompactCls} />}
          </Field>
        </div>

        <TimeRange start={startTime} end={endTime} onStart={setStartTime} onEnd={setEndTime} defaultMinutes={60} />

        <SessionChairsPicker value={chairs} onChange={setChairs} />

        {overlaps.length > 0 && (
          <SessionOverlapWarning overlaps={overlaps} onBack={() => setOverlaps([])} onSaveAnyway={saveAnyway} />
        )}
        {error && <p role="alert" className="rounded-lg border border-danger-line bg-danger-tint p-2.5 text-sm text-danger-strong">{error}</p>}
      </form>
    </Modal>
  );
}
