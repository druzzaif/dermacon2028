'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabase';
import Modal from './Modal';
import Field, { inputCompactCls } from './Field';
import { TimeRange } from './TimeField';
import SessionOverlapWarning from './SessionOverlapWarning';
import SessionChairsPicker, { logSessionChairChanges, type ChairPerson } from './SessionChairsPicker';
import { findSessionOverlaps, type SessionOverlap } from '../lib/sessionOverlap';

export const SESSION_TYPES = ['MasterClass', 'Workshop', 'Plenary', 'Panel'];

const secondaryBtn =
  'inline-flex h-10 items-center justify-center rounded-lg border border-field bg-white px-5 text-sm font-medium text-ink hover:bg-slate-50 disabled:opacity-50';
const primaryBtn =
  'inline-flex h-10 items-center justify-center rounded-lg bg-accent px-5 text-sm font-medium text-white hover:bg-accent-strong disabled:opacity-50';

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
  const [overlaps, setOverlaps] = useState<SessionOverlap[]>([]);
  const skipOverlapCheck = useRef(false);
  const [name, setName] = useState<string>(session.session_name || '');
  const [type, setType] = useState<string>(session.session_type || 'Workshop');
  const [hall, setHall] = useState<string>(session.hall || '');
  const [date, setDate] = useState<string>(session.session_date || '');
  const [startTime, setStartTime] = useState<string>(session.start_time || '');
  const [endTime, setEndTime] = useState<string>(session.end_time || '');
  const [chairs, setChairs] = useState<ChairPerson[]>([]);
  const [chairsLoaded, setChairsLoaded] = useState(false);
  const initialChairs = useRef<ChairPerson[]>([]);

  useEffect(() => {
    supabase.from('session_chairs')
      .select('sort_order, faculty ( id, canonical_name, email )')
      .eq('session_id', session.id)
      .then(({ data }) => {
        const rows = ((data || []) as any[]).filter((r) => r.faculty)
          .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999));
        initialChairs.current = rows.map((r) => r.faculty as ChairPerson);
        setChairs(initialChairs.current);
        setChairsLoaded(true);
      });
  }, [session.id]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setOverlaps([]);
    if (!name.trim()) return setError('Enter the session name.');
    if (!date) return setError('Choose the session date.');
    if (!startTime || !endTime) return setError('Set the start and end time.');
    if (endTime <= startTime) return setError('The end time must be after the start time.');

    setIsSaving(true);

    // Same hall + same date + overlapping time = warn. "Save anyway" skips the check once.
    const skip = skipOverlapCheck.current;
    skipOverlapCheck.current = false;
    if (!skip) {
      try {
        const found = await findSessionOverlaps({ id: session.id, hall, date, start: startTime, end: endTime });
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

    if (updateError) { setIsSaving(false); return setError(updateError.message); }

    // Only rewrite the chairpersons once they have been loaded (never wipe them by accident)
    if (chairsLoaded) {
      // Keep the confirmation of people who stay; only remove who was taken off, then add / re-order the rest
      const keep = chairs.map((p) => p.id);
      let del = supabase.from('session_chairs').delete().eq('session_id', session.id);
      if (keep.length > 0) del = del.not('faculty_id', 'in', `(${keep.join(',')})`);
      await del;
      if (chairs.length > 0) {
        const { error: chairError } = await supabase.from('session_chairs')
          .upsert(chairs.map((p, i) => ({ session_id: session.id, faculty_id: p.id, sort_order: i + 1 })), { onConflict: 'session_id,faculty_id' });
        if (chairError) { setIsSaving(false); return setError('Chairpersons were not saved: ' + chairError.message); }
      }
      await logSessionChairChanges(session.session_code, initialChairs.current, chairs);
    }
    setIsSaving(false);
    onSaved(); // the Sessions page reloads the session and closes this dialog
  }

  function saveAnyway() {
    skipOverlapCheck.current = true;
    setOverlaps([]);
    (document.getElementById('edit-session-form') as HTMLFormElement | null)?.requestSubmit();
  }

  return (
    <Modal
      title="Edit session"
      subtitle={session.session_code}
      size="lg"
      dense
      onClose={onClose}
      busy={isSaving}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={isSaving} className={secondaryBtn}>Cancel</button>
          <button type="submit" form="edit-session-form" disabled={isSaving} className={primaryBtn}>
            {isSaving ? 'Saving…' : 'Save changes'}
          </button>
        </>
      }
    >
      <form id="edit-session-form" onSubmit={handleSubmit} className="space-y-3">
        <Field label="Session name" required compact>
          {(p) => (
            <input {...p} value={name} onChange={(e) => setName(e.target.value)} className={`${inputCompactCls} font-medium`} />
          )}
        </Field>

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
        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-sm text-red-800">{error}</p>}
      </form>
    </Modal>
  );
}
