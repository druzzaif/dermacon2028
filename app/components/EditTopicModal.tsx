'use client';

import { sortTopicPeople } from '../lib/topicPeople';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../supabase';
import { generatePDFData, generatePDFForSession, removeConfirmation, resequenceSession } from '../actions';
import DeleteTopicDialog from './DeleteTopicDialog';
import ConfirmDeleteDialog from './ConfirmDeleteDialog';
import Badge from './Badge';
import Modal from './Modal';
import Field, { inputCompactCls } from './Field';
import { AlertIcon, CheckIcon, CloseIcon } from './Icons';
import { TimeRange } from './TimeField';
import { formatTime12 as formatTimeAmPm } from '../lib/time';

type FacultyLite = { id: string; canonical_name: string; email: string | null };

type FacultyLink = {
  sort_order?: number | null;
  faculty_id: string;
  faculty: FacultyLite;
  role: string;
  isNew?: boolean;
  confirmed?: boolean;
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
  'inline-flex h-10 items-center justify-center rounded-lg border border-field bg-white px-5 text-sm font-medium text-ink hover:bg-slate-50 disabled:opacity-50';
const primaryBtn =
  'inline-flex h-10 items-center justify-center rounded-lg bg-accent px-5 text-sm font-medium text-white hover:bg-accent-strong disabled:opacity-50';
const smallLinkBtn =
  'inline-flex h-8 items-center rounded-lg px-2.5 text-xs font-medium text-red-700 hover:bg-red-50';
const titleCls =
  'block w-full resize-none rounded-lg border border-field bg-white px-3 py-1.5 text-sm font-medium leading-snug text-ink placeholder:font-normal placeholder:text-muted';

export default function EditTopicModal({
  topic,
  session,
  onClose,
  onSaved,
  sessionTopics,
}: {
  /** Every topic of this session, so deleting can warn about the empty slot it leaves */
  sessionTopics?: any[];
  topic: any;
  session: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [facultyList, setFacultyList] = useState<FacultyLite[]>([]);
  const [searchFaculty, setSearchFaculty] = useState('');
  const [facultyLinks, setFacultyLinks] = useState<FacultyLink[]>([]);
  const [topicTitle, setTopicTitle] = useState(topic.topic_title || '');
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
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
  // "Remove confirmation" applies at once (not on Save). The session list is refreshed
  // when this window closes, so unsaved edits here are not wiped by a reload.
  const [unconfirming, setUnconfirming] = useState<FacultyLink | null>(null);
  const confirmationChanged = useRef(false);

  function handleClose() {
    if (confirmationChanged.current) onSaved();
    onClose();
  }

  async function handleRemoveConfirmation() {
    const l = unconfirming!;
    const res = await removeConfirmation(l.faculty_id, topic.id);
    if (!res.success) throw new Error(res.message);
    setFacultyLinks((prev) => prev.map((x) => (x.faculty_id === l.faculty_id ? { ...x, confirmed: false } : x)));
    confirmationChanged.current = true;
    setUnconfirming(null);
  }

  // "HH:MM:00" (24-hour) strings, shown as 12-hour time with AM/PM
  const [startTime, setStartTime] = useState<string>(topic.start_time || '');
  const [endTime, setEndTime] = useState<string>(topic.end_time || '');

  useEffect(() => {
    async function loadFaculty() {
      const { data } = await supabase
        .from('faculty')
        .select('id, canonical_name, email')
        .order('canonical_name');
      if (data) setFacultyList(data);
    }
    loadFaculty();

    // Chairpersons are in this list too: their role is "Chairperson"
    const initialLinks: FacultyLink[] = (topic.faculty_topics || []).map((ft: any) => ({
      faculty_id: ft.faculty?.id || ft.faculty_id,
      faculty: {
        id: ft.faculty?.id || ft.faculty_id,
        canonical_name: ft.faculty?.canonical_name || '',
        email: ft.faculty?.email || null,
      },
      role: ft.role || 'Faculty',
      confirmed: !!ft.confirmed,
      sort_order: ft.sort_order ?? null,
    }));
    setFacultyLinks(sortTopicPeople(initialLinks));
  }, [topic]);

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
    setFacultyLinks([...facultyLinks, { faculty_id: f.id, faculty: f, role: 'Faculty', isNew: true }]);
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
        start_time: startTime,
        end_time: endTime,
      })
      .eq('id', topic.id);

    if (updateError) {
      setError(updateError.message);
      setIsSaving(false);
      return;
    }

    // Remove only the people who were taken off this topic (chairpersons included), then upsert the rest.
    // (Deleting everything and re-inserting would wipe the "confirmed" flag.)
    const keepIds = facultyLinks.map((l) => l.faculty_id);
    let removeQuery = supabase.from('faculty_topics').delete().eq('topic_id', topic.id);
    if (keepIds.length > 0) removeQuery = removeQuery.not('faculty_id', 'in', `(${keepIds.join(',')})`);
    const { error: removeError } = await removeQuery;
    if (removeError) {
      setError(removeError.message);
      setIsSaving(false);
      return;
    }

    if (facultyLinks.length > 0) {
      // sort_order = the order arranged in this list (1, 2, 3 …)
      const payload = facultyLinks.map((l, i) => ({
        topic_id: topic.id,
        faculty_id: l.faculty_id,
        role: l.role,
        sort_order: i + 1,
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

    // The running-order number follows the start time automatically
    await resequenceSession(session.id);

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
      size="xl"
      dense
      onClose={handleClose}
      busy={isSaving}
      footer={
        <>
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            disabled={isSaving}
            className="mr-auto inline-flex h-10 items-center rounded-lg px-3 text-sm font-medium text-red-700 hover:bg-red-50"
          >
            Delete topic
          </button>
          <button type="button" onClick={handleClose} disabled={isSaving} className={secondaryBtn}>Cancel</button>
          <button type="submit" form="edit-topic-form" disabled={isSaving} className={primaryBtn}>
            {isSaving ? 'Saving…' : 'Save changes'}
          </button>
        </>
      }
    >
      <form id="edit-topic-form" onSubmit={handleSubmit} className="space-y-3">
        <Field label="Topic" required compact>
          {(p) => (
            <textarea
              {...p}
              rows={2}
              value={topicTitle}
              onChange={(e) => setTopicTitle(e.target.value)}
              className={titleCls}
            />
          )}
        </Field>

        <div className="grid gap-4 md:grid-cols-[16.5rem_1fr]">
          {/* Left: time. Minutes box moves the end time. */}
          <section aria-label="Time" className="h-fit rounded-xl border border-line bg-canvas p-3">
            <TimeRange
              layout="stack"
              start={startTime}
              end={endTime}
              onStart={setStartTime}
              onEnd={setEndTime}
              defaultMinutes={10}
            />
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
                        {l.confirmed && <Badge tone="success">Confirmed</Badge>}
                      </div>
                      <div className="truncate text-xs text-muted">{l.faculty.email || '—'}</div>
                    </div>
                    {l.confirmed && (
                      <button type="button" onClick={() => setUnconfirming(l)} className={smallLinkBtn}>
                        Unconfirm
                      </button>
                    )}
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

        {conflicts.length > 0 && (
          <div role="alert" className="space-y-2 rounded-xl border border-red-300 bg-red-50 p-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-red-900">
              <AlertIcon width={16} height={16} /> Overlap: this faculty is already booked at that time.
            </p>
            <ul className="space-y-1">
              {conflicts.map((c, i) => (
                <li key={i} className="rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-sm text-red-900">
                  <strong>{c.facultyName}</strong> is also in <em>{c.otherSession}</em> ({c.otherTopic}) on{' '}
                  <span className="tnum">{formatDateDdMmYyyy(c.otherDate)}, {formatTimeAmPm(c.otherStart)} – {formatTimeAmPm(c.otherEnd)}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => setConflicts([])} className={secondaryBtn}>Go back and fix</button>
              <button type="button" onClick={forceSaveAnyway}
                className="inline-flex h-10 items-center rounded-lg bg-red-700 px-5 text-sm font-medium text-white hover:bg-red-800">
                Save anyway
              </button>
            </div>
          </div>
        )}

        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-sm text-red-800">{error}</p>}
      </form>

    </Modal>
      {unconfirming && (
        <ConfirmDeleteDialog
          title="Remove confirmation?"
          description={
            <>
              <p>
                <strong>{unconfirming.faculty.canonical_name}</strong> will be shown as <strong>not confirmed</strong> for{' '}
                <strong>{topic.topic_title}</strong>.
              </p>
              <p className="mt-2 text-gray-500">
                This happens now, without clicking Save, and changes your PC only. The next{' '}
                <strong>Sync confirmations</strong> also removes it from the Google sheet.
              </p>
            </>
          }
          confirmLabel="Remove confirmation"
          busyLabel="Removing..."
          onConfirm={handleRemoveConfirmation}
          onCancel={() => setUnconfirming(null)}
        />
      )}
      {confirmDelete && (
        <DeleteTopicDialog
          topic={topic}
          session={session}
          topics={sessionTopics && sessionTopics.length ? sessionTopics : [topic]}
          facultyCount={facultyLinks.length}
          onCancel={() => setConfirmDelete(false)}
          onDeleted={() => {
            setConfirmDelete(false);
            onSaved();
            onClose();
          }}
        />
      )}
    </>
  );
}
