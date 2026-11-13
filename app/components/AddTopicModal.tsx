'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '../supabase';
import { generatePDFData, generatePDFForSession } from '../actions';
import Modal from './Modal';
import Field, { inputCompactCls } from './Field';
import { AlertIcon, CheckIcon, CloseIcon } from './Icons';
import { TimeRange } from './TimeField';
import { addMinutes, formatTime12 as formatTimeAmPm } from '../lib/time';

// The topic is the main thing in this form: bigger, easy-to-read text
const titleCls =
  'block w-full resize-none rounded-lg border border-field bg-white px-3 py-1.5 text-sm font-medium leading-snug text-ink placeholder:font-normal placeholder:text-muted';
export const topicTitleCls =
  'block w-full resize-y rounded-lg border border-field bg-white px-3.5 py-2.5 text-base font-medium leading-snug text-ink placeholder:font-normal placeholder:text-muted';

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

function formatDateDdMmYyyy(dateStr: string | null | undefined): string {
  if (!dateStr) return '--';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${d.getFullYear()}`;
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

  // Times are "HH:MM:00" (24-hour) strings. Until the user touches them they
  // default to "right after the last topic" (or the session start).
  const sessionStart = session.start_time || '09:00:00';
  const [newStart, setNewStart] = useState<string>(sessionStart);
  const [newEnd, setNewEnd] = useState<string>(addMinutes(sessionStart, 10));
  const [timeTouched, setTimeTouched] = useState(false);
  const [suggestedAfter, setSuggestedAfter] = useState<number | null>(null);

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

  // Suggest the slot right after the latest topic, unless the user already chose a time
  useEffect(() => {
    if (timeTouched || sessionTopics.length === 0) return;
    const last = [...sessionTopics]
      .filter((t) => t.end_time)
      .sort((a, b) => String(a.end_time).localeCompare(String(b.end_time)))
      .pop();
    if (!last?.end_time) return;
    setNewStart(last.end_time);
    setNewEnd(addMinutes(last.end_time, 10));
    setSuggestedAfter(last.sequence_no ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionTopics]);

  const invalidRange = !newStart || !newEnd || newEnd <= newStart;

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
    const updated = facultyLinks.map((l) => (l.faculty_id === id ? { ...l, role } : l));
    // A moderator goes to the top of the list (you can still move them)
    if (role === 'Moderator') {
      const mod = updated.find((l) => l.faculty_id === id)!;
      setFacultyLinks([mod, ...updated.filter((l) => l.faculty_id !== id)]);
    } else {
      setFacultyLinks(updated);
    }
  }

  function moveFaculty(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= facultyLinks.length) return;
    const next = [...facultyLinks];
    [next[index], next[target]] = [next[target], next[index]];
    setFacultyLinks(next);
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

    const parsedStart = newStart;
    const parsedEnd = newEnd;

    if (!topicTitle.trim()) {
      setError('Enter the topic title.');
      setIsSaving(false);
      return;
    }
    if (!parsedStart || !parsedEnd) {
      setError('Set the start and end time of this topic.');
      setIsSaving(false);
      return;
    }
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
        topic_title: topicTitle.trim(),
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
      const payload = facultyLinks.map((l, i) => ({
        topic_id: newTopic.id,
        faculty_id: l.faculty_id,
        role: l.role,
        sort_order: i + 1,
      }));
      const { error: linkError } = await supabase.from('faculty_topics').insert(payload);
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
    'inline-flex h-10 items-center justify-center rounded-lg border border-field bg-white px-5 text-sm font-medium text-ink hover:bg-slate-50 disabled:opacity-50';
  const primaryBtn =
    'inline-flex h-10 items-center justify-center rounded-lg bg-accent px-5 text-sm font-medium text-white hover:bg-accent-strong disabled:opacity-50';

  if (showSuccessPrompt) {
    return (
      <Modal title="Topic saved" size="md" onClose={finalizeAndClose} busy={pdfBusy}
        footer={<button type="button" onClick={finalizeAndClose} className={secondaryBtn}>Close</button>}
      >
        <div className="space-y-4">
          <p className="flex items-start gap-2 text-ink-2">
            <CheckIcon className="mt-1 shrink-0 text-success" width={18} height={18} />
            Faculty assignments are updated. You can generate a PDF for the new faculty, for the whole session, or just close.
          </p>
          <div role="status" aria-live="polite">
            {pdfBusy && <p className="text-sm text-ink-2">Rendering PDF…</p>}
            {pdfUrl && (
              <p className="rounded-lg bg-success-tint p-3 text-sm text-success">
                PDF ready.{' '}
                <a href={pdfUrl} target="_blank" rel="noreferrer" className="font-semibold underline">
                  Open or download<span className="sr-only"> (opens in a new tab)</span>
                </a>
              </p>
            )}
          </div>
          {pdfError && (
            <p role="alert" className="rounded-lg bg-danger-tint p-3 text-sm text-danger-strong">{pdfError}</p>
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
      size="xl"
      dense
      onClose={onClose}
      busy={isSaving}
      footer={
        <>
          <p className="mr-auto max-w-xs text-xs text-muted">
            Saving does not email anyone. Use <strong>Emails</strong> to tell faculty about changes.
          </p>
          <button type="button" onClick={onClose} disabled={isSaving} className={secondaryBtn}>Cancel</button>
          <button type="submit" form="add-topic-form" disabled={isSaving} className={primaryBtn}>
            {isSaving ? 'Saving…' : 'Save topic'}
          </button>
        </>
      }
    >
      <form id="add-topic-form" onSubmit={handleSubmit} className="space-y-3">
        <Field label="Topic" required compact>
          {(p) => (
            <textarea
              {...p}
              rows={2}
              value={topicTitle}
              onChange={(e) => setTopicTitle(e.target.value)}
              className={titleCls}
              placeholder="e.g. Upper face anatomy and injection points"
            />
          )}
        </Field>

        <div className="grid gap-4 md:grid-cols-[16.5rem_1fr]">
          {/* Left: time. Setting the start moves the end; the Minutes box sets the length. */}
          <section aria-label="Time" className="h-fit rounded-xl border border-line bg-canvas p-3">
            <TimeRange
              layout="stack"
              start={newStart}
              end={newEnd}
              onStart={(v) => { setTimeTouched(true); setNewStart(v); }}
              onEnd={(v) => { setTimeTouched(true); setNewEnd(v); }}
              defaultMinutes={10}
            />
            {!timeTouched && suggestedAfter != null && (
              <p className="mt-2 text-xs text-muted">Starts right after topic No. {suggestedAfter}.</p>
            )}
          </section>

          {/* Right: faculty and chairpersons. Search is at the top so its results are easy to see. */}
          <section aria-label="Faculty on this topic" className="min-w-0">
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <h3 className="text-xs font-medium text-ink">Faculty and chairpersons</h3>
              <button
                type="button"
                onClick={() => setShowAddNew(!showAddNew)}
                aria-expanded={showAddNew}
                className="inline-flex h-8 items-center rounded-lg px-2.5 text-xs font-medium text-accent hover:bg-accent-tint"
              >
                {showAddNew ? 'Hide new faculty form' : 'Add new faculty'}
              </button>
            </div>

            {showAddNew && (
              <div className="mb-2 space-y-2 rounded-xl bg-accent-tint p-3">
                <div className="grid gap-2 sm:grid-cols-3">
                  <Field label="Full name" required compact>
                    {(p) => <input {...p} placeholder="e.g. Dr. Jane Doe" value={newName} onChange={(e) => setNewName(e.target.value)} className={inputCompactCls} />}
                  </Field>
                  <Field label="Email (optional)" compact>
                    {(p) => <input {...p} type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className={inputCompactCls} />}
                  </Field>
                  <Field label="Phone (optional)" compact>
                    {(p) => <input {...p} type="tel" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} className={inputCompactCls} />}
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

            <Field label="Search faculty by name or email" srOnlyLabel>
              {(p) => (
                <input
                  {...p}
                  type="search"
                  placeholder="Search by name or email to add"
                  value={searchFaculty}
                  onChange={(e) => setSearchFaculty(e.target.value)}
                  className={inputCompactCls}
                />
              )}
            </Field>
            {searchFaculty.length > 0 && (
              <div className="mt-1 max-h-52 overflow-y-auto rounded-xl border border-line bg-white shadow-card">
                {filteredFaculty.length === 0 ? (
                  <p className="p-2.5 text-sm text-ink-2">No faculty found.</p>
                ) : (
                  <ul>
                    {filteredFaculty.map((f) => (
                      <li key={f.id}>
                        <button
                          type="button"
                          onClick={() => addFaculty(f)}
                          className="block w-full border-b border-line px-3 py-1.5 text-left last:border-b-0 hover:bg-accent-tint"
                        >
                          <span className="text-sm font-medium text-ink">{f.canonical_name}</span>
                          <span className="ml-2 text-xs text-muted">{f.email || '—'}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {facultyLinks.length > 0 ? (
              <ul className="mt-2 space-y-1.5" aria-label="Faculty on this topic">
                {facultyLinks.map((l, i) => (
                  <li key={l.faculty_id} className="flex items-center gap-2 rounded-lg border border-line bg-white py-1.5 pl-2 pr-1.5">
                    <div className="flex shrink-0 flex-col">
                      <button type="button" onClick={() => moveFaculty(i, -1)} disabled={i === 0} title="Move up" aria-label="Move up"
                        className="px-1 text-xs leading-none text-accent disabled:opacity-25">▲</button>
                      <button type="button" onClick={() => moveFaculty(i, 1)} disabled={i === facultyLinks.length - 1} title="Move down" aria-label="Move down"
                        className="px-1 text-xs leading-none text-accent disabled:opacity-25">▼</button>
                    </div>
                    <span className="w-5 shrink-0 text-center text-sm font-semibold text-ink-2">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-ink">{l.faculty.canonical_name}</span>
                      </div>
                      <div className="truncate text-xs text-muted">{l.faculty.email || '—'}</div>
                    </div>
                    <label className="sr-only" htmlFor={`erole-${l.faculty_id}`}>Role for {l.faculty.canonical_name}</label>
                    <select
                      id={`erole-${l.faculty_id}`}
                      value={l.role}
                      onChange={(e) => updateRole(l.faculty_id, e.target.value)}
                      className="h-8 w-auto rounded-lg border border-field bg-white px-2 text-sm text-ink"
                    >
                      <option value="Faculty">Faculty</option>
                      <option value="Chairperson">Chairperson</option>
                      <option value="Panel">Panel</option>
                      <option value="Debater">Debater</option>
                      <option value="Moderator">Moderator</option>
                      <option value="Coordinator">Coordinator</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => removeFaculty(l.faculty_id)}
                      aria-label={`Remove ${l.faculty.canonical_name}`}
                      title="Remove from this topic"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-2 transition-colors hover:bg-danger hover:text-white"
                    >
                      <CloseIcon width={20} height={20} strokeWidth={2.25} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm italic text-muted">No one on this topic yet.</p>
            )}
          </section>
        </div>

        {!overlapBlocked && topicOverlaps.length > 0 && (
          <div role="status" aria-live="polite" className="rounded-lg border border-warning-line bg-warning-tint p-3 text-sm text-warning">
            <p className="flex items-center gap-2 font-semibold">
              <AlertIcon width={16} height={16} />
              This time overlaps {topicOverlaps.length === 1 ? 'another topic' : `${topicOverlaps.length} other topics`} in this session.
            </p>
            <p className="mt-1">You can still save, and you’ll be asked to confirm.</p>
          </div>
        )}

        {(conflicts.length > 0 || (overlapBlocked && topicOverlaps.length > 0)) && (
          <div role="alert" className="space-y-3 rounded-xl border border-danger-line bg-danger-tint p-4">
            {overlapBlocked && topicOverlaps.length > 0 && (
              <div className="space-y-2">
                <p className="flex items-center gap-2 text-sm font-semibold text-danger-strong">
                  <AlertIcon width={18} height={18} /> This topic overlaps another topic in {session.session_code}.
                </p>
                <ul className="space-y-2">
                  {topicOverlaps.map((t) => {
                    const same = t.start_time === newStart && t.end_time === newEnd;
                    return (
                      <li key={t.id} className="rounded-lg border border-danger-line bg-white p-2.5 text-sm text-danger-strong">
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
              <p className="flex items-center gap-2 text-sm font-semibold text-danger-strong">
                <AlertIcon width={18} height={18} /> Overlap: this faculty is already booked at that time.
              </p>
            )}
            <ul className="space-y-2">
              {conflicts.map((c, i) => (
                <li key={i} className="rounded-lg border border-danger-line bg-white p-2.5 text-sm text-danger-strong">
                  <strong>{c.facultyName}</strong> is also in <em>{c.otherSession}</em> ({c.otherTopic}) on{' '}
                  <span className="tnum">{formatDateDdMmYyyy(c.otherDate)}, {formatTimeAmPm(c.otherStart)} – {formatTimeAmPm(c.otherEnd)}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => { setConflicts([]); setOverlapBlocked(false); }} className={secondaryBtn}>Go back and fix</button>
              <button type="button" onClick={forceSaveAnyway}
                className="inline-flex h-11 items-center rounded-lg bg-danger px-5 text-sm font-medium text-white hover:bg-danger-strong">
                Save anyway
              </button>
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-lg border border-danger-line bg-danger-tint p-3 text-sm text-danger-strong">{error}</p>
        )}
      </form>
    </Modal>
  );
}
