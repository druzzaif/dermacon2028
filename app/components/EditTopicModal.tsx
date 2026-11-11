'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabase';
import { generatePDFData, generatePDFForSession, deleteTopic } from '../actions';
import ConfirmDeleteDialog from './ConfirmDeleteDialog';
import Modal from './Modal';
import Field, { inputCls } from './Field';
import { AlertIcon, CheckIcon } from './Icons';
import TimeField, { DurationNote } from './TimeField';
import { topicTitleCls } from './AddTopicModal';
import { addMinutes, formatTime12 as formatTimeAmPm, toMinutes } from '../lib/time';

type FacultyLite = { id: string; canonical_name: string; email: string | null };

type FacultyLink = {
  faculty_id: string;
  faculty: FacultyLite;
  role: string;
  isNew?: boolean;
};

type Conflict = {
  facultyName: string;
  otherTopic: string;
  otherSession: string;
  otherDate: string;
  otherStart: string;
  otherEnd: string;
};

function isTbdFacultyName(name: string | null | undefined): boolean {
  if (!name) return false;
  const n = name.trim().toUpperCase();
  if (n === '') return false;
  // Match any variant of "TBD ..." (e.g. "TBD (To Be Determined)")
  if (n === 'TBD' || n.startsWith('TBD ') || n.startsWith('TBD(')) return true;
  // Match empty faculty_id fallback used by the seed importer
  if (n === 'FAC000') return true;
  return false;
}

function isRealHallForOverlap(hall: string | null | undefined): boolean {
  if (!hall) return false;
  const t = hall.trim().toLowerCase();
  if (t === '') return false;
  if (t === 'tbd') return false;
  if (t === 'null') return false;
  return true;
}

function formatDateDdMmYyyy(dateStr: string | null | undefined): string {
  if (!dateStr) return '--';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${d.getFullYear()}`;
}

const secondaryBtn =
  'inline-flex h-11 items-center justify-center rounded-lg border border-field bg-white px-5 text-sm font-medium text-ink hover:bg-slate-50 disabled:opacity-50';
const primaryBtn =
  'inline-flex h-11 items-center justify-center rounded-lg bg-accent px-5 text-sm font-medium text-white hover:bg-accent-strong disabled:opacity-50';

export default function EditTopicModal({
  topic,
  session,
  onClose,
  onSaved,
}: {
  topic: any;
  session: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [facultyList, setFacultyList] = useState<FacultyLite[]>([]);
  const [searchFaculty, setSearchFaculty] = useState('');
  const [facultyLinks, setFacultyLinks] = useState<FacultyLink[]>([]);
  const [topicTitle, setTopicTitle] = useState(topic.topic_title || '');
  const [sequenceNo, setSequenceNo] = useState<string>(String(topic.sequence_no ?? 1));
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [showSuccessPrompt, setShowSuccessPrompt] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const skipConflictCheck = useRef(false);

  const [showAddNew, setShowAddNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [addingFaculty, setAddingFaculty] = useState(false);
  // Chairpersons are managed from the session's "Chairpersons" button and are left untouched here
  const [chairIds, setChairIds] = useState<string[]>([]);

  // "HH:MM:00" (24-hour) strings, shown as 12-hour time with AM/PM
  const [startTime, setStartTime] = useState<string>(topic.start_time || '');
  const [endTime, setEndTime] = useState<string>(topic.end_time || '');

  // Changing the start moves the end with it, keeping the same length
  function handleStartChange(v: string) {
    const len = (toMinutes(endTime) ?? 0) - (toMinutes(startTime) ?? 0);
    setStartTime(v);
    if (v) setEndTime(addMinutes(v, len > 0 ? len : 10));
  }

  useEffect(() => {
    async function loadFaculty() {
      const { data } = await supabase
        .from('faculty')
        .select('id, canonical_name, email')
        .order('canonical_name');
      if (data) setFacultyList(data);
    }
    loadFaculty();

    setChairIds((topic.faculty_topics || []).filter((ft: any) => ft.role === 'Chairperson').map((ft: any) => ft.faculty?.id || ft.faculty_id));
    const initialLinks: FacultyLink[] = (topic.faculty_topics || []).filter((ft: any) => ft.role !== 'Chairperson').map((ft: any) => ({
      faculty_id: ft.faculty?.id || ft.faculty_id,
      faculty: {
        id: ft.faculty?.id || ft.faculty_id,
        canonical_name: ft.faculty?.canonical_name || '',
        email: ft.faculty?.email || null,
      },
      role: ft.role || 'Faculty',
    }));
    setFacultyLinks(initialLinks);
  }, [topic]);

  const filteredFaculty = facultyList
    .filter(
      (f) =>
        f.canonical_name.toLowerCase().includes(searchFaculty.toLowerCase()) ||
        (f.email || '').toLowerCase().includes(searchFaculty.toLowerCase())
    )
    .slice(0, 6);

  function addFaculty(f: FacultyLite) {
    if (chairIds.includes(f.id)) {
      setError(`${f.canonical_name} is the chairperson of this topic and cannot also be a speaker. Remove them from Chairpersons first.`);
      setSearchFaculty('');
      return;
    }
    if (facultyLinks.find((l) => l.faculty_id === f.id)) {
      setSearchFaculty('');
      return;
    }
    setFacultyLinks([...facultyLinks, { faculty_id: f.id, faculty: f, role: 'Faculty', isNew: true }]);
    setSearchFaculty('');
  }

  function removeFaculty(id: string) {
    setFacultyLinks(facultyLinks.filter((l) => l.faculty_id !== id));
  }

  function updateRole(id: string, role: string) {
    setFacultyLinks(facultyLinks.map((l) => (l.faculty_id === id ? { ...l, role } : l)));
  }

  async function handleAddNewFaculty() {
    if (!newName.trim()) {
      setError('Enter a name for the new faculty member.');
      return;
    }
    setAddingFaculty(true);
    setError(null);

    const payload: any = {
      canonical_name: newName.trim(),
      email: newEmail.trim() || `no-email-${Date.now()}@placeholder.com`,
      phone: newPhone.trim() || null,
      is_active: true,
    };

    const { data, error: insertError } = await supabase
      .from('faculty')
      .insert(payload)
      .select('id, canonical_name, email')
      .single();

    if (insertError) {
      setError(insertError.message);
      setAddingFaculty(false);
      return;
    }

    setFacultyList([...facultyList, data]);
    addFaculty(data);
    setNewName('');
    setNewEmail('');
    setNewPhone('');
    setShowAddNew(false);
    setAddingFaculty(false);
  }

  async function checkConflicts(sTime: string | null, eTime: string | null): Promise<Conflict[]> {
    const facultyIds = facultyLinks.map((l) => l.faculty_id);
    if (facultyIds.length === 0) return [];
    if (!sTime || !eTime || !session?.session_date) return [];

    const { data: candidateTopics } = await supabase
      .from('session_topics')
      .select(
        `
        id, topic_title, start_time, end_time,
        conference_sessions ( session_code, session_date, hall ),
        faculty_topics ( faculty_id, faculty ( canonical_name ) )
      `
      )
      .neq('id', topic.id);

    if (!candidateTopics) return [];

    const found: Conflict[] = [];
    for (const t of candidateTopics as any[]) {
      const otherSession = t.conference_sessions;
      if (!otherSession) continue;
      // Sessions with blank / TBD / null hall are excluded from overlap checks
      if (!isRealHallForOverlap(otherSession.hall)) continue;
      if (otherSession.session_date !== session.session_date) continue;

      const overlap = sTime < (t.end_time || '') && (t.start_time || '') < eTime;
      if (!overlap) continue;

      for (const ft of t.faculty_topics || []) {
        if (!facultyIds.includes(ft.faculty_id)) continue;
        // TBD placeholder is not a real faculty conflict
        if (isTbdFacultyName(ft.faculty?.canonical_name)) continue;
        found.push({
          facultyName: ft.faculty?.canonical_name || 'Unknown',
          otherTopic: t.topic_title,
          otherSession: otherSession.session_code,
          otherDate: otherSession.session_date,
          otherStart: t.start_time,
          otherEnd: t.end_time,
        });
      }
    }
    return found;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setConflicts([]);

    if (!topicTitle.trim()) {
      setError('Enter the topic title.');
      setIsSaving(false);
      return;
    }
    if (!startTime || !endTime) {
      setError('Set the start and end time of this topic.');
      setIsSaving(false);
      return;
    }
    if (endTime <= startTime) {
      setError('The end time must be after the start time.');
      setIsSaving(false);
      return;
    }

    // "Save anyway" skips the check once; otherwise it would find the same overlap again
    const skip = skipConflictCheck.current;
    skipConflictCheck.current = false;
    const conflictsFound = skip ? [] : await checkConflicts(startTime, endTime);
    if (conflictsFound.length > 0) {
      setConflicts(conflictsFound);
      setIsSaving(false);
      return;
    }

    const { error: updateError } = await supabase
      .from('session_topics')
      .update({
        topic_title: topicTitle.trim(),
        sequence_no: parseInt(sequenceNo) || 1,
        start_time: startTime,
        end_time: endTime,
      })
      .eq('id', topic.id);

    if (updateError) {
      setError(updateError.message);
      setIsSaving(false);
      return;
    }

    // Remove only the faculty who were taken off this topic, then upsert the rest.
    // (Deleting everything and re-inserting would wipe the "confirmed" flag.)
    const keepIds = facultyLinks.map((l) => l.faculty_id);
    let removeQuery = supabase.from('faculty_topics').delete().eq('topic_id', topic.id).or('role.is.null,role.neq.Chairperson');
    if (keepIds.length > 0) removeQuery = removeQuery.not('faculty_id', 'in', `(${keepIds.join(',')})`);
    const { error: removeError } = await removeQuery;
    if (removeError) {
      setError(removeError.message);
      setIsSaving(false);
      return;
    }

    if (facultyLinks.length > 0) {
      const payload = facultyLinks.map((l) => ({
        topic_id: topic.id,
        faculty_id: l.faculty_id,
        role: l.role,
      }));
      const { error: linkError } = await supabase
        .from('faculty_topics')
        .upsert(payload, { onConflict: 'faculty_id,topic_id' });
      if (linkError) {
        setError(linkError.message);
        setIsSaving(false);
        return;
      }
    }

    setIsSaving(false);
    setShowSuccessPrompt(true);
  }

  function finalizeAndClose() {
    setShowSuccessPrompt(false);
    onSaved();
    onClose();
  }

  function forceSaveAnyway() {
    skipConflictCheck.current = true;
    setConflicts([]);
    const form = document.getElementById('edit-topic-form') as HTMLFormElement | null;
    if (form) form.requestSubmit();
  }

  if (showSuccessPrompt) {
    const newIds = facultyLinks.filter((l) => l.isNew).map((l) => l.faculty_id);
    return (
      <Modal title="Topic saved" size="md" onClose={finalizeAndClose} busy={pdfBusy}
        footer={<button type="button" onClick={finalizeAndClose} className={secondaryBtn}>Close</button>}
      >
        <div className="space-y-4">
          <p className="flex items-start gap-2 text-ink-2">
            <CheckIcon className="mt-1 shrink-0 text-green-700" width={18} height={18} />
            Changes saved. You can make a PDF for the faculty on this topic, for the whole session, or just close.
          </p>
          <div role="status" aria-live="polite">
            {pdfBusy && <p className="text-sm text-ink-2">Rendering PDF…</p>}
            {pdfUrl && (
              <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800">
                PDF ready.{' '}
                <a href={pdfUrl} target="_blank" rel="noreferrer" className="font-semibold underline">
                  Open or download<span className="sr-only"> (opens in a new tab)</span>
                </a>
              </p>
            )}
          </div>
          {pdfError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{pdfError}</p>}
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              disabled={pdfBusy || facultyLinks.length === 0}
              onClick={async () => {
                setPdfBusy(true); setPdfError(null);
                const ids = newIds.length ? newIds : facultyLinks.map((l) => l.faculty_id);
                const results = [];
                for (const id of ids) results.push(await generatePDFData(id));
                const ok = results.filter((r) => r.success);
                setPdfBusy(false);
                if (ok.length === 0) setPdfError('No PDFs were generated. Try again.');
                else setPdfUrl((ok[0] as any).url);
              }}
              className={primaryBtn}
            >
              {newIds.length ? 'PDF for new faculty' : 'PDF for this topic’s faculty'}
            </button>
            <button
              type="button"
              disabled={pdfBusy}
              onClick={async () => {
                setPdfBusy(true); setPdfError(null);
                const r = await generatePDFForSession(session.id);
                setPdfBusy(false);
                if (r.success) setPdfUrl((r as any).url);
                else setPdfError((r as any).message || 'The PDF could not be generated.');
              }}
              className={secondaryBtn}
            >
              PDF for whole session
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <>
    <Modal
      title="Edit topic"
      subtitle={`${session.session_code} – ${session.session_name}`}
      onClose={onClose}
      busy={isSaving}
      footer={
        <>
          <button
            type="button"
            onClick={() => { setDeleteError(null); setConfirmDelete(true); }}
            disabled={isSaving}
            className="mr-auto inline-flex h-11 items-center rounded-lg px-3 text-sm font-medium text-red-700 hover:bg-red-50"
          >
            Delete topic
          </button>
          <p className="hidden max-w-[15rem] text-xs text-muted md:block">
            Saving does not email anyone. Use <strong>Emails</strong> to tell faculty about changes.
          </p>
          <button type="button" onClick={onClose} disabled={isSaving} className={secondaryBtn}>Cancel</button>
          <button type="submit" form="edit-topic-form" disabled={isSaving} className={primaryBtn}>
            {isSaving ? 'Saving…' : 'Save changes'}
          </button>
        </>
      }
    >
      <form id="edit-topic-form" onSubmit={handleSubmit} className="space-y-6">
        <Field label="Topic" required>
          {(p) => (
            <textarea
              {...p}
              rows={2}
              value={topicTitle}
              onChange={(e) => setTopicTitle(e.target.value)}
              className={topicTitleCls}
            />
          )}
        </Field>

        <section aria-label="Time and order" className="rounded-xl border border-line bg-canvas p-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
            <TimeField label="Start time" required value={startTime} onChange={handleStartChange} />
            <TimeField label="End time" required value={endTime} onChange={setEndTime} hint="Moves with the start time." />
            <Field label="Order no." hint="Re-set from start time on save.">
              {(p) => (
                <input
                  {...p}
                  type="number"
                  min={1}
                  value={sequenceNo}
                  onChange={(e) => setSequenceNo(e.target.value)}
                  className={`${inputCls} tnum w-20`}
                />
              )}
            </Field>
          </div>
          <div className="mt-3 border-t border-line pt-3">
            <DurationNote start={startTime} end={endTime} />
          </div>
        </section>

        <div className="border-t border-line pt-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-sm font-medium text-ink">Faculty on this topic</h3>
            <button
              type="button"
              onClick={() => setShowAddNew(!showAddNew)}
              aria-expanded={showAddNew}
              className="inline-flex h-11 items-center rounded-lg px-3 text-sm font-medium text-accent hover:bg-accent-tint"
            >
              {showAddNew ? 'Hide new faculty form' : 'Add new faculty'}
            </button>
          </div>

          {showAddNew && (
            <div className="mb-4 space-y-3 rounded-xl bg-accent-tint p-4">
              <Field label="Full name" required>
                {(p) => <input {...p} placeholder="e.g. Dr. Jane Doe" value={newName} onChange={(e) => setNewName(e.target.value)} className={inputCls} />}
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Email (optional)">
                  {(p) => <input {...p} type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className={inputCls} />}
                </Field>
                <Field label="Phone (optional)">
                  {(p) => <input {...p} type="tel" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} className={inputCls} />}
                </Field>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setShowAddNew(false)} className={secondaryBtn}>Cancel</button>
                <button type="button" onClick={handleAddNewFaculty} disabled={addingFaculty} className={primaryBtn}>
                  {addingFaculty ? 'Adding…' : 'Add and attach'}
                </button>
              </div>
            </div>
          )}

          {facultyLinks.length > 0 && (
            <ul className="mb-4 space-y-2" aria-label="Faculty on this topic">
              {facultyLinks.map((l) => (
                <li key={l.faculty_id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-white p-2.5 pl-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-ink">{l.faculty.canonical_name}</div>
                    <div className="truncate text-xs text-muted">{l.faculty.email || '—'}</div>
                  </div>
                  <label className="sr-only" htmlFor={`erole-${l.faculty_id}`}>Role for {l.faculty.canonical_name}</label>
                  <select
                    id={`erole-${l.faculty_id}`}
                    value={l.role}
                    onChange={(e) => updateRole(l.faculty_id, e.target.value)}
                    className={`${inputCls} w-auto`}
                  >
                    <option value="Faculty">Faculty</option>
                    <option value="Panel">Panel</option>
                    <option value="Moderator">Moderator</option>
                    <option value="Coordinator">Coordinator</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => removeFaculty(l.faculty_id)}
                    aria-label={`Remove ${l.faculty.canonical_name}`}
                    className="inline-flex h-11 items-center rounded-lg px-3 text-sm font-medium text-red-700 hover:bg-red-50"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          <Field label="Search faculty by name or email" srOnlyLabel>
            {(p) => (
              <input
                {...p}
                type="search"
                placeholder="Search by name or email to add faculty"
                value={searchFaculty}
                onChange={(e) => setSearchFaculty(e.target.value)}
                className={inputCls}
              />
            )}
          </Field>
          {searchFaculty.length > 0 && (
            <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-line bg-white shadow-card">
              {filteredFaculty.length === 0 ? (
                <p className="p-3 text-sm text-ink-2">No faculty found.</p>
              ) : (
                <ul>
                  {filteredFaculty.map((f) => (
                    <li key={f.id}>
                      <button
                        type="button"
                        onClick={() => addFaculty(f)}
                        className="block min-h-11 w-full border-b border-line px-3.5 py-2 text-left last:border-b-0 hover:bg-accent-tint"
                      >
                        <div className="text-sm font-medium text-ink">{f.canonical_name}</div>
                        <div className="text-xs text-muted">{f.email || '—'}</div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {chairIds.length > 0 && (
            <p className="mt-3 text-xs text-muted">
              This topic has {chairIds.length} chairperson{chairIds.length === 1 ? '' : 's'}. Change them with the session’s <strong>Chairpersons</strong> button.
            </p>
          )}
        </div>

        {conflicts.length > 0 && (
          <div role="alert" className="space-y-3 rounded-xl border border-red-300 bg-red-50 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-red-900">
              <AlertIcon width={18} height={18} /> Overlap: this faculty is already booked at that time.
            </p>
            <ul className="space-y-2">
              {conflicts.map((c, i) => (
                <li key={i} className="rounded-lg border border-red-200 bg-white p-2.5 text-sm text-red-900">
                  <strong>{c.facultyName}</strong> is also in <em>{c.otherSession}</em> ({c.otherTopic}) on{' '}
                  <span className="tnum">{formatDateDdMmYyyy(c.otherDate)}, {formatTimeAmPm(c.otherStart)} – {formatTimeAmPm(c.otherEnd)}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => setConflicts([])} className={secondaryBtn}>Go back and fix</button>
              <button type="button" onClick={forceSaveAnyway}
                className="inline-flex h-11 items-center rounded-lg bg-red-700 px-5 text-sm font-medium text-white hover:bg-red-800">
                Save anyway
              </button>
            </div>
          </div>
        )}

        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      </form>

    </Modal>
      {confirmDelete && (
        <ConfirmDeleteDialog
          title="Delete this topic?"
          description={
            <div className="space-y-3">
              <div className="rounded-lg border border-line bg-canvas p-3 text-sm">
                <div className="font-semibold text-ink">{topic.topic_title}</div>
                <div className="mt-1 text-ink-2">
                  Number {topic.sequence_no ?? '?'}
                  {facultyLinks.length > 0 && <> &middot; {facultyLinks.length} faculty link(s) will be removed</>}
                </div>
              </div>
              <div>This cannot be undone. Remaining topics in this session will renumber automatically.</div>
              {deleteError && <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{deleteError}</div>}
            </div>
          }
          confirmLabel="Delete topic"
          busyLabel="Deleting…"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            setDeleteBusy(true);
            setDeleteError(null);
            const res = await deleteTopic(topic.id, session.id);
            setDeleteBusy(false);
            if (!res.success) { setDeleteError(res.message); return; }
            setConfirmDelete(false);
            onSaved();
            onClose();
          }}
        />
      )}
    </>
  );
}
