'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../supabase';
import { generatePDFData, generatePDFForSession } from '../actions';
import Modal from './Modal';
import Field, { inputCls } from './Field';
import { AlertIcon, CheckIcon } from './Icons';
import { sendScheduleUpdateToFaculty } from '../actions';

type FacultyLite = { id: string; canonical_name: string; email: string | null };

type FacultyLink = {
  faculty_id: string;
  faculty: FacultyLite;
  role: string;
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
  if (t === '')     return false;
  if (t === 'tbd')  return false;
  if (t === 'null') return false;
  return true;
}

function formatTimeAmPm(timeStr: string | null | undefined): string {
  if (!timeStr) return '--:--';
  const [hStr, mStr] = timeStr.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr || '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${m} ${ampm}`;
}

function formatDateDdMmYyyy(dateStr: string | null | undefined): string {
  if (!dateStr) return '--';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${d.getFullYear()}`;
}


/* ------------------------------------------------------------------
   TimePicker lives at module level. It used to be declared inside
   AddTopicModal, which gave it a new identity on every render, so the
   inputs remounted and lost focus after each keystroke.
   ------------------------------------------------------------------ */
function TimePicker({
  label,
  h,
  m,
  ampm,
  onChange,
}: {
  label: string;
  h: number;
  m: number;
  ampm: string;
  onChange: (h: number, m: number, ampm: string) => void;
}) {
  const clamp = (v: string, lo: number, hi: number, fallback: number) => {
    let n = parseInt(v, 10);
    if (isNaN(n)) n = fallback;
    return Math.min(hi, Math.max(lo, n));
  };
  const seg = 'h-11 w-14 rounded-lg border border-field bg-white text-center text-lg font-semibold text-ink tnum [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';

  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-ink">{label}</legend>
      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          min={1}
          max={12}
          aria-label={`${label} hour`}
          value={String(h).padStart(2, '0')}
          onChange={(e) => onChange(clamp(e.target.value, 1, 12, 12), m, ampm)}
          className={seg}
        />
        <span aria-hidden="true" className="text-lg font-semibold text-muted">:</span>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={59}
          aria-label={`${label} minutes`}
          value={String(m).padStart(2, '0')}
          onChange={(e) => onChange(h, clamp(e.target.value, 0, 59, 0), ampm)}
          className={seg}
        />
        <div role="group" aria-label={`${label} AM or PM`} className="ml-1 flex overflow-hidden rounded-lg border border-field">
          {['AM', 'PM'].map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={ampm === v}
              onClick={() => onChange(h, m, v)}
              className={`h-11 w-12 text-sm font-semibold transition-colors ${
                ampm === v ? 'bg-accent text-white' : 'bg-white text-ink-2 hover:bg-slate-50'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
    </fieldset>
  );
}

export default function AddTopicModal({
  session,
  onClose,
  onSaved,
}: {
  session: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [facultyList, setFacultyList] = useState<FacultyLite[]>([]);
  const [searchFaculty, setSearchFaculty] = useState('');
  const [facultyLinks, setFacultyLinks] = useState<FacultyLink[]>([]);
  const [topicTitle, setTopicTitle] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [showSuccessPrompt, setShowSuccessPrompt] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const skipConflictCheck = useRef(false);

  // Topics already in this session, used to warn when the new topic's time overlaps one
  const [sessionTopics, setSessionTopics] = useState<
    { id: string; topic_title: string | null; sequence_no: number | null; start_time: string | null; end_time: string | null }[]
  >([]);
  const [overlapBlocked, setOverlapBlocked] = useState(false);

  const [showAddNew, setShowAddNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [addingFaculty, setAddingFaculty] = useState(false);
  const [emailOnSave, setEmailOnSave] = useState(true);
  const [emailReport, setEmailReport] = useState<{ name: string; ok: boolean; message?: string }[]>([]);

  // Parse initial session time
  const parseSessionTime = (timeStr: string | null | undefined) => {
    if (!timeStr) return { h: 9, m: 0, ampm: 'AM' };
    const [hStr, mStr] = timeStr.split(':');
    let h = parseInt(hStr, 10);
    const m = parseInt(mStr || '0', 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    if (h === 0) h = 12;
    else if (h > 12) h -= 12;
    return { h, m, ampm };
  };

  const initSessionTime = parseSessionTime(session.start_time);

  const [startH, setStartH] = useState(initSessionTime.h);
  const [startM, setStartM] = useState(initSessionTime.m);
  const [startAmPm, setStartAmPm] = useState(initSessionTime.ampm);

  // Default end time: 10 minutes after start
  const calcEndTime = (h: number, m: number, ampm: string) => {
    let endM = m + 10;
    let endH = h;
    let endAmPm = ampm;
    if (endM >= 60) {
      endM -= 60;
      endH += 1;
      if (endH === 12 && ampm === 'AM') endAmPm = 'PM';
      else if (endH === 12 && ampm === 'PM') endAmPm = 'AM';
      else if (endH > 12) endH -= 12;
    }
    return { h: endH, m: endM, ampm: endAmPm };
  };

  const initEnd = calcEndTime(initSessionTime.h, initSessionTime.m, initSessionTime.ampm);

  const [endH, setEndH] = useState(initEnd.h);
  const [endM, setEndM] = useState(initEnd.m);
  const [endAmPm, setEndAmPm] = useState(initEnd.ampm);

  const to24Hour = (h: number, m: number, ampm: string) => {
    let h24 = h;
    if (ampm === 'PM' && h24 < 12) h24 += 12;
    if (ampm === 'AM' && h24 === 12) h24 = 0;
    return `${String(h24).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
  };

  // Changing the start time moves the end time with it
  const handleStartChange = (h: number, m: number, ampm: string) => {
    setStartH(h);
    setStartM(m);
    setStartAmPm(ampm);
    const newEnd = calcEndTime(h, m, ampm);
    setEndH(newEnd.h);
    setEndM(newEnd.m);
    setEndAmPm(newEnd.ampm);
  };

  useEffect(() => {
    async function loadSessionTopics() {
      const { data } = await supabase
        .from('session_topics')
        .select('id, topic_title, sequence_no, start_time, end_time')
        .eq('session_id', session.id)
        .order('sequence_no', { ascending: true });
      if (data) setSessionTopics(data as any);
    }
    loadSessionTopics();
  }, [session.id]);

  const newStart = to24Hour(startH, startM, startAmPm);
  const newEnd = to24Hour(endH, endM, endAmPm);
  const invalidRange = newEnd <= newStart;

  // Overlap = the two time ranges share any minutes (touching ends do not count)
  const topicOverlaps = useMemo(() => {
    if (invalidRange) return [];
    return sessionTopics.filter(
      (t) => t.start_time && t.end_time && newStart < t.end_time && t.start_time < newEnd
    );
  }, [sessionTopics, newStart, newEnd, invalidRange]);

  useEffect(() => {
    async function loadFaculty() {
      const { data } = await supabase
        .from('faculty')
        .select('id, canonical_name, email')
        .order('canonical_name');
      if (data) setFacultyList(data);
    }
    loadFaculty();
  }, []);

  const filteredFaculty = facultyList
    .filter(
      (f) =>
        f.canonical_name.toLowerCase().includes(searchFaculty.toLowerCase()) ||
        (f.email || '').toLowerCase().includes(searchFaculty.toLowerCase())
    )
    .slice(0, 6);

  function addFaculty(f: FacultyLite) {
    if (facultyLinks.find((l) => l.faculty_id === f.id)) {
      setSearchFaculty('');
      return;
    }
    setFacultyLinks([...facultyLinks, { faculty_id: f.id, faculty: f, role: 'Faculty' }]);
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
      );

    if (!candidateTopics) return [];

    const found: Conflict[] = [];
    for (const t of candidateTopics as any[]) {
      const otherSession = t.conference_sessions;
      if (!otherSession) continue;
      // 2B: sessions with blank / TBD / null hall are excluded from all
      // overlap checks (faculty AND hall), per the project spec.
      if (!isRealHallForOverlap(otherSession.hall)) continue;
      if (otherSession.session_date !== session.session_date) continue;

      const overlap = sTime < (t.end_time || '') && (t.start_time || '') < eTime;
      if (!overlap) continue;

      for (const ft of t.faculty_topics || []) {
        if (!facultyIds.includes(ft.faculty_id)) continue;
        // 1A: TBD placeholder is not a real faculty conflict
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
    setOverlapBlocked(false);

    const parsedStart = to24Hour(startH, startM, startAmPm);
    const parsedEnd = to24Hour(endH, endM, endAmPm);

    if (parsedEnd <= parsedStart) {
      setError('The end time must be after the start time.');
      setIsSaving(false);
      return;
    }

    const skip = skipConflictCheck.current;
    skipConflictCheck.current = false;
    const conflictsFound = skip ? [] : await checkConflicts(parsedStart, parsedEnd);
    const overlapFound = !skip && topicOverlaps.length > 0;
    if (conflictsFound.length > 0 || overlapFound) {
      setConflicts(conflictsFound);
      setOverlapBlocked(overlapFound);
      setIsSaving(false);
      return;
    }

    // 1. Fetch existing topics to calculate new sequence number
    const { data: existingTopics } = await supabase
      .from('session_topics')
      .select('id, sequence_no, start_time')
      .eq('session_id', session.id)
      .order('sequence_no', { ascending: true });

        let newSeq = 1;
    if (existingTopics && existingTopics.length > 0) {
      // Group by numeric sequence so co-presented topics (same seq_no,
      // different faculty) only shift once, not N times.
      const seqMap = new Map<number, string[]>();
      existingTopics.forEach((t: any) => {
        const s = Number(t.sequence_no) || 0;
        if (!seqMap.has(s)) seqMap.set(s, []);
        seqMap.get(s)!.push(t.id);
      });
      const sortedSeqs = Array.from(seqMap.keys()).sort((a, b) => a - b);

      // Find the first topic whose start_time is strictly after our new start
      let insertIndex = -1;
      for (let i = 0; i < existingTopics.length; i++) {
        const st = existingTopics[i].start_time;
        if (st && parsedStart < st) { insertIndex = i; break; }
      }

      if (insertIndex === -1) {
        // Append at end
        newSeq = (sortedSeqs[sortedSeqs.length - 1] || 0) + 1;
      } else {
        // Insert before existingTopics[insertIndex] — shift by seq group
        const beforeSeq = Number(existingTopics[insertIndex].sequence_no) || (insertIndex + 1);
        newSeq = beforeSeq;
        // Bump every unique seq >= beforeSeq once
        for (const s of sortedSeqs) {
          if (s < beforeSeq) continue;
          const ids = seqMap.get(s)!;
          for (const id of ids) {
            await supabase
              .from('session_topics')
              .update({ sequence_no: s + 1 })
              .eq('id', id);
          }
        }
      }
    }

    // 2. Insert the new topic with the calculated sequence
    const { data: newTopic, error: topicError } = await supabase
      .from('session_topics')
      .insert({
        session_id: session.id,
        topic_title: topicTitle,
        sequence_no: newSeq,
        start_time: parsedStart,
        end_time: parsedEnd,
      })
      .select('id')
      .single();

    if (topicError) {
      setError(topicError.message);
      setIsSaving(false);
      return;
    }

    // 3. Link Faculty
    if (facultyLinks.length > 0 && newTopic) {
      const payload = facultyLinks.map((l) => ({
        topic_id: newTopic.id,
        faculty_id: l.faculty_id,
        role: l.role,
      }));
      const { error: linkError } = await supabase.from('faculty_topics').insert(payload);
      if (linkError) {
        setError(linkError.message);
        setIsSaving(false);
        return;
      }
    }

// Email the updated schedule to assigned faculty (only if the box is ticked)
if (emailOnSave) {
  const report: { name: string; ok: boolean; message?: string }[] = [];
  for (const link of facultyLinks) {
    const f = link.faculty;
    if (!f?.email) {
      report.push({ name: f?.canonical_name || 'Unknown', ok: false, message: 'No email on file' });
      continue;
    }
    const r = await sendScheduleUpdateToFaculty(f);
    report.push({ name: f.canonical_name, ok: r.success, message: r.message });
  }
  setEmailReport(report);
}

setIsSaving(false);
setShowSuccessPrompt(true);
  }

  function finalizeAndClose() {
    setShowSuccessPrompt(false);
    onSaved();
    onClose();
  }

  // FIX: "Save anyway" now skips the conflict check on the next submit.
  // Before, it re-ran the check, found the same conflicts, and could never save.
  function forceSaveAnyway() {
    skipConflictCheck.current = true;
    setConflicts([]);
    setOverlapBlocked(false);
    const form = document.getElementById('add-topic-form') as HTMLFormElement | null;
    if (form) form.requestSubmit();
  }

  const secondaryBtn =
    'inline-flex h-11 items-center justify-center rounded-lg border border-field bg-white px-5 text-sm font-medium text-ink hover:bg-slate-50 disabled:opacity-50';
  const primaryBtn =
    'inline-flex h-11 items-center justify-center rounded-lg bg-accent px-5 text-sm font-medium text-white hover:bg-accent-strong disabled:opacity-50';

  if (showSuccessPrompt) {
    return (
      <Modal title="Topic saved" size="md" onClose={finalizeAndClose} busy={pdfBusy}
        footer={<button type="button" onClick={finalizeAndClose} className={secondaryBtn}>Close</button>}
      >
        <div className="space-y-4">
          <p className="flex items-start gap-2 text-ink-2">
            <CheckIcon className="mt-1 shrink-0 text-green-700" width={18} height={18} />
            Faculty assignments are updated. You can generate a PDF for the new faculty, for the whole session, or just close.
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
          {pdfError && (
            <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{pdfError}</p>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              disabled={pdfBusy || facultyLinks.length === 0}
              onClick={async () => {
                setPdfBusy(true); setPdfError(null);
                const ids = facultyLinks.map(l => l.faculty_id);
                const results = [];
                for (const id of ids) {
                  const r = await generatePDFData(id);
                  results.push(r);
                }
                const ok = results.filter(r => r.success);
                setPdfBusy(false);
                if (ok.length === 0) setPdfError('No PDFs were generated. Try again.');
                else setPdfUrl((ok[0] as any).url);
              }}
              className={primaryBtn}
            >
              PDF for new faculty
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
    <Modal
      title="Add topic"
      subtitle={`${session.session_code} – ${session.session_name}`}
      onClose={onClose}
      busy={isSaving}
      footer={
        <>
          <label className="mr-auto flex cursor-pointer items-center gap-2 text-sm text-ink-2 select-none">
            <input
              type="checkbox"
              checked={emailOnSave}
              onChange={(e) => setEmailOnSave(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
            />
            📧 Email updated schedule to faculty
          </label>
          <button type="button" onClick={onClose} disabled={isSaving} className={secondaryBtn}>Cancel</button>
          <button type="submit" form="add-topic-form" disabled={isSaving} className={primaryBtn}>
            {isSaving ? 'Saving…' : 'Save topic'}
          </button>
        </>
      }
    >
      <form id="add-topic-form" onSubmit={handleSubmit} className="space-y-5">
        <Field label="Topic title" required>
          {(p) => (
            <input
              {...p}
              value={topicTitle}
              onChange={(e) => setTopicTitle(e.target.value)}
              className={inputCls}
              placeholder="e.g. Anatomy discussion"
            />
          )}
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <TimePicker label="Start time" h={startH} m={startM} ampm={startAmPm} onChange={handleStartChange} />
          <TimePicker
            label="End time"
            h={endH}
            m={endM}
            ampm={endAmPm}
            onChange={(h, m, a) => { setEndH(h); setEndM(m); setEndAmPm(a); }}
          />
        </div>
        <p className="-mt-2 text-sm text-muted">The running-order number is worked out from the start time.</p>

        {invalidRange && (
          <p role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            <AlertIcon className="mt-0.5 shrink-0" width={16} height={16} />
            The end time must be after the start time.
          </p>
        )}
        {!overlapBlocked && topicOverlaps.length > 0 && (
          <div role="status" aria-live="polite" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <p className="flex items-center gap-2 font-semibold">
              <AlertIcon width={16} height={16} />
              This time overlaps {topicOverlaps.length === 1 ? 'another topic' : `${topicOverlaps.length} other topics`} in this session.
            </p>
            <p className="mt-1">You can still save, and you’ll be asked to confirm.</p>
          </div>
        )}

        <div className="border-t border-line pt-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-sm font-medium text-ink">Assign faculty</h3>
            <button
              type="button"
              onClick={() => setShowAddNew(!showAddNew)}
              aria-expanded={showAddNew}
              aria-controls="add-new-faculty"
              className="inline-flex h-11 items-center rounded-lg px-3 text-sm font-medium text-accent hover:bg-accent-tint"
            >
              {showAddNew ? 'Hide new faculty form' : 'Add new faculty'}
            </button>
          </div>

          {showAddNew && (
            <div id="add-new-faculty" className="mb-4 space-y-3 rounded-xl bg-accent-tint p-4">
              <Field label="Full name" required>
                {(p) => (
                  <input {...p} placeholder="e.g. Dr. Jane Doe" value={newName} onChange={(e) => setNewName(e.target.value)} className={inputCls} />
                )}
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
            <ul className="mb-4 space-y-2" aria-label="Assigned faculty">
              {facultyLinks.map((l) => (
                <li key={l.faculty_id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-white p-2.5 pl-3.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-ink">{l.faculty.canonical_name}</div>
                    <div className="truncate text-xs text-muted">{l.faculty.email || '—'}</div>
                  </div>
                  <label className="sr-only" htmlFor={`role-${l.faculty_id}`}>Role for {l.faculty.canonical_name}</label>
                  <select
                    id={`role-${l.faculty_id}`}
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
              <p role="status" className="sr-only">{filteredFaculty.length} results</p>
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
        </div>

        {(conflicts.length > 0 || (overlapBlocked && topicOverlaps.length > 0)) && (
          <div role="alert" className="space-y-3 rounded-xl border border-red-300 bg-red-50 p-4">
            {overlapBlocked && topicOverlaps.length > 0 && (
              <div className="space-y-2">
                <p className="flex items-center gap-2 text-sm font-semibold text-red-900">
                  <AlertIcon width={18} height={18} /> This topic overlaps another topic in {session.session_code}.
                </p>
                <ul className="space-y-2">
                  {topicOverlaps.map((t) => {
                    const same = t.start_time === newStart && t.end_time === newEnd;
                    return (
                      <li key={t.id} className="rounded-lg border border-red-200 bg-white p-2.5 text-sm text-red-900">
                        <span className="tnum font-semibold">
                          {formatTimeAmPm(t.start_time)} – {formatTimeAmPm(t.end_time)}
                        </span>
                        {t.sequence_no != null && <> · No. {t.sequence_no}</>}
                        {' '}· {t.topic_title || 'Untitled topic'}
                        {same && <span className="block text-xs">Same time slot. This is fine for a co-presented topic.</span>}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
            {conflicts.length > 0 && (
              <p className="flex items-center gap-2 text-sm font-semibold text-red-900">
                <AlertIcon width={18} height={18} /> Overlap: this faculty is already booked at that time.
              </p>
            )}
            <ul className="space-y-2">
              {conflicts.map((c, i) => (
                <li key={i} className="rounded-lg border border-red-200 bg-white p-2.5 text-sm text-red-900">
                  <strong>{c.facultyName}</strong> is also in <em>{c.otherSession}</em> ({c.otherTopic}) on{' '}
                  <span className="tnum">{formatDateDdMmYyyy(c.otherDate)}, {formatTimeAmPm(c.otherStart)} – {formatTimeAmPm(c.otherEnd)}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => { setConflicts([]); setOverlapBlocked(false); }} className={secondaryBtn}>Go back and fix</button>
              <button type="button" onClick={forceSaveAnyway}
                className="inline-flex h-11 items-center rounded-lg bg-red-700 px-5 text-sm font-medium text-white hover:bg-red-800">
                Save anyway
              </button>
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>
        )}
      </form>
    </Modal>
  );
}
