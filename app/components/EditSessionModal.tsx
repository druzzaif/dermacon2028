'use client';

import { useState } from 'react';
import { supabase } from '../supabase';
import Modal from './Modal';
import Field, { inputCls } from './Field';
import TimeField, { DurationNote } from './TimeField';

export const SESSION_TYPES = ['MasterClass', 'Workshop', 'Plenary', 'Panel'];

const secondaryBtn =
  'inline-flex h-11 items-center justify-center rounded-lg border border-field bg-white px-5 text-sm font-medium text-ink hover:bg-slate-50 disabled:opacity-50';
const primaryBtn =
  'inline-flex h-11 items-center justify-center rounded-lg bg-accent px-5 text-sm font-medium text-white hover:bg-accent-strong disabled:opacity-50';

export default function EditSessionModal({
  session,
  onClose,
  onSaved,
}: {
  session: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState<string>(session.session_name || '');
  const [type, setType] = useState<string>(session.session_type || 'Workshop');
  const [hall, setHall] = useState<string>(session.hall || '');
  const [date, setDate] = useState<string>(session.session_date || '');
  const [startTime, setStartTime] = useState<string>(session.start_time || '');
  const [endTime, setEndTime] = useState<string>(session.end_time || '');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError('Enter the session name.');
    if (!date) return setError('Choose the session date.');
    if (!startTime || !endTime) return setError('Set the start and end time.');
    if (endTime <= startTime) return setError('The end time must be after the start time.');

    setIsSaving(true);
    const { error: updateError } = await supabase
      .from('conference_sessions')
      .update({
        session_name: name.trim(),
        session_type: type,
        session_date: date,
        hall: hall.trim() || null,
        start_time: startTime,
        end_time: endTime,
      })
      .eq('id', session.id);
    setIsSaving(false);

    if (updateError) return setError(updateError.message);
    onSaved(); // the Sessions page reloads the session and closes this dialog
  }

  return (
    <Modal
      title="Edit session"
      subtitle={session.session_code}
      size="md"
      onClose={onClose}
      busy={isSaving}
      footer={
        <>
          <p className="mr-auto max-w-[15rem] text-xs text-muted">
            Saving does not email anyone. Use <strong>Emails</strong> to tell faculty about changes.
          </p>
          <button type="button" onClick={onClose} disabled={isSaving} className={secondaryBtn}>Cancel</button>
          <button type="submit" form="edit-session-form" disabled={isSaving} className={primaryBtn}>
            {isSaving ? 'Saving…' : 'Save changes'}
          </button>
        </>
      }
    >
      <form id="edit-session-form" onSubmit={handleSubmit} className="space-y-6">
        <Field label="Session name" required>
          {(p) => (
            <input
              {...p}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`${inputCls} text-base font-medium`}
            />
          )}
        </Field>

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
          <div className="mt-3 border-t border-line pt-3">
            <DurationNote start={startTime} end={endTime} />
          </div>
        </section>

        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      </form>
    </Modal>
  );
}
