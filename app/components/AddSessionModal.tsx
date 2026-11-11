'use client';

import { useState } from 'react';
import { supabase } from '../supabase';
import Modal from './Modal';
import Field, { inputCls } from './Field';
import TimeField, { DurationNote } from './TimeField';
import { SESSION_TYPES } from './EditSessionModal';

const secondaryBtn =
  'inline-flex h-11 items-center justify-center rounded-lg border border-field bg-white px-5 text-sm font-medium text-ink hover:bg-slate-50 disabled:opacity-50';
const primaryBtn =
  'inline-flex h-11 items-center justify-center rounded-lg bg-accent px-5 text-sm font-medium text-white hover:bg-accent-strong disabled:opacity-50';

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
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState('Workshop');
  const [hall, setHall] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
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

    const { error: insertError } = await supabase.from('conference_sessions').insert({
      session_code: c,
      session_name: name.trim(),
      session_type: type,
      session_date: date,
      hall: hall.trim() || null,
      start_time: startTime,
      end_time: endTime,
    });
    setIsSaving(false);
    if (insertError) return setError(insertError.message);
    onSaved(c);
  }

  return (
    <Modal
      title="Add session"
      subtitle="Create a new session, then add its topics."
      size="md"
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
      <form id="add-session-form" onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-[8rem_1fr]">
          <Field label="Code" required>
            {(p) => <input {...p} value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. WS12" className={`${inputCls} uppercase`} />}
          </Field>
          <Field label="Session name" required>
            {(p) => <input {...p} value={name} onChange={(e) => setName(e.target.value)} className={`${inputCls} text-base font-medium`} />}
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Type">
            {(p) => (
              <select {...p} value={type} onChange={(e) => setType(e.target.value)} className={inputCls}>
                {SESSION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            )}
          </Field>
          <Field label="Hall">
            {(p) => <input {...p} value={hall} onChange={(e) => setHall(e.target.value)} placeholder="e.g. B1" className={inputCls} />}
          </Field>
          <Field label="Date" required>
            {(p) => <input {...p} type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />}
          </Field>
        </div>

        <section aria-label="Time" className="rounded-xl border border-line bg-canvas p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <TimeField label="Start time" required value={startTime} onChange={setStartTime} />
            <TimeField label="End time" required value={endTime} onChange={setEndTime} />
          </div>
          {startTime && endTime && (
            <div className="mt-3 border-t border-line pt-3">
              <DurationNote start={startTime} end={endTime} />
            </div>
          )}
        </section>

        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      </form>
    </Modal>
  );
}
