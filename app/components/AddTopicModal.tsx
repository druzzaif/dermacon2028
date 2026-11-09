'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { generatePDFData, generatePDFForSession } from '../actions';

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

  const [showAddNew, setShowAddNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [addingFaculty, setAddingFaculty] = useState(false);

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

  // Calculate default end time (10 mins after start)
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

  const scrollH = (e: React.WheelEvent, current: number, setter: (v: number) => void) => {
    if (e.deltaY < 0) setter(current === 12 ? 1 : current + 1);
    else setter(current === 1 ? 12 : current - 1);
  };
  const scrollM = (e: React.WheelEvent, current: number, setter: (v: number) => void) => {
    if (e.deltaY < 0) setter(current === 59 ? 0 : current + 1);
    else setter(current === 0 ? 59 : current - 1);
  };

  // Sync End Time automatically when Start Time changes
  const handleStartChange = (h: number, m: number, ampm: string) => {
    setStartH(h);
    setStartM(m);
    setStartAmPm(ampm);
    
    const newEnd = calcEndTime(h, m, ampm);
    setEndH(newEnd.h);
    setEndM(newEnd.m);
    setEndAmPm(newEnd.ampm);
  };

  function TimePicker({
    label,
    h,
    setH,
    m,
    setM,
    ampm,
    setAmPm,
    onChangeOverride,
  }: {
    label: string;
    h: number;
    setH: (v: number) => void;
    m: number;
    setM: (v: number) => void;
    ampm: string;
    setAmPm: (v: string) => void;
    onChangeOverride?: (h: number, m: number, ampm: string) => void;
  }) {
    const triggerChange = (newH: number, newM: number, newAmPm: string) => {
      if (onChangeOverride) onChangeOverride(newH, newM, newAmPm);
      else {
        setH(newH);
        setM(newM);
        setAmPm(newAmPm);
      }
    };

    return (
      <div>
        <label className="block text-sm font-bold text-gray-700 mb-1">{label}</label>
        <div className="flex items-center gap-2 border border-gray-300 rounded-lg p-1 bg-white focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500 shadow-sm">
          <div className="flex flex-col items-center">
            <button type="button" onClick={() => {
              const newH = h === 12 ? 1 : h + 1;
              triggerChange(newH, m, ampm);
            }} className="text-gray-400 hover:text-blue-600 px-2 text-[10px]">▲</button>
            <input
              type="number"
              min={1}
              max={12}
              value={String(h).padStart(2, '0')}
              onChange={(e) => {
                let val = parseInt(e.target.value);
                if (isNaN(val)) val = 12;
                if (val > 12) val = 12;
                if (val < 1) val = 1;
                triggerChange(val, m, ampm);
              }}
              onWheel={(e) => {
                if (e.deltaY < 0) triggerChange(h === 12 ? 1 : h + 1, m, ampm);
                else triggerChange(h === 1 ? 12 : h - 1, m, ampm);
              }}
              className="w-8 text-center text-lg font-bold focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button type="button" onClick={() => {
              const newH = h === 1 ? 12 : h - 1;
              triggerChange(newH, m, ampm);
            }} className="text-gray-400 hover:text-blue-600 px-2 text-[10px]">▼</button>
          </div>
          
          <span className="text-lg font-bold text-gray-400">:</span>
          
          <div className="flex flex-col items-center">
            <button type="button" onClick={() => {
              const newM = m === 59 ? 0 : m + 1;
              triggerChange(h, newM, ampm);
            }} className="text-gray-400 hover:text-blue-600 px-2 text-[10px]">▲</button>
            <input
              type="number"
              min={0}
              max={59}
              value={String(m).padStart(2, '0')}
              onChange={(e) => {
                let val = parseInt(e.target.value);
                if (isNaN(val)) val = 0;
                if (val > 59) val = 59;
                if (val < 0) val = 0;
                triggerChange(h, val, ampm);
              }}
              onWheel={(e) => {
                if (e.deltaY < 0) triggerChange(h, m === 59 ? 0 : m + 1, ampm);
                else triggerChange(h, m === 0 ? 59 : m - 1, ampm);
              }}
              className="w-10 text-center text-lg font-bold focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button type="button" onClick={() => {
              const newM = m === 0 ? 59 : m - 1;
              triggerChange(h, newM, ampm);
            }} className="text-gray-400 hover:text-blue-600 px-2 text-[10px]">▼</button>
          </div>

          <div className="flex flex-col border-l border-gray-200 ml-1 pl-1">
            <button
              type="button"
              onClick={() => triggerChange(h, m, 'AM')}
              className={`px-2 py-0.5 text-xs font-bold rounded ${ampm === 'AM' ? 'bg-blue-100 text-blue-700' : 'text-gray-400 hover:bg-gray-50'}`}
            >
              AM
            </button>
            <button
              type="button"
              onClick={() => triggerChange(h, m, 'PM')}
              className={`px-2 py-0.5 text-xs font-bold rounded ${ampm === 'PM' ? 'bg-blue-100 text-blue-700' : 'text-gray-400 hover:bg-gray-50'}`}
            >
              PM
            </button>
          </div>
        </div>
      </div>
    );
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
      setError('Name is required');
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

    const parsedStart = to24Hour(startH, startM, startAmPm);
    const parsedEnd = to24Hour(endH, endM, endAmPm);

    const conflictsFound = await checkConflicts(parsedStart, parsedEnd);
    if (conflictsFound.length > 0) {
      setConflicts(conflictsFound);
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

    setIsSaving(false);
    setShowSuccessPrompt(true);
  }

  function finalizeAndClose() {
    setShowSuccessPrompt(false);
    onSaved();
    onClose();
  }

  function forceSaveAnyway() {
    setConflicts([]);
    const form = document.getElementById('add-topic-form') as HTMLFormElement | null;
    if (form) form.requestSubmit();
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden max-h-[92vh] flex flex-col">
        <div className="flex justify-between items-center p-5 border-b bg-gray-50 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Add Topic</h2>
            <p className="text-sm text-gray-500">
              {session.session_code} - {session.session_name}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl leading-none">
            ×
          </button>
        </div>

        <form id="add-topic-form" onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Topic Title</label>
            <input
              required
              value={topicTitle}
              onChange={(e) => setTopicTitle(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="e.g., Anatomy Discussion"
            />
          </div>

          <div className="grid grid-cols-2 gap-4 items-end">
            <TimePicker 
              label="Start Time" 
              h={startH} setH={setStartH} 
              m={startM} setM={setStartM} 
              ampm={startAmPm} setAmPm={setStartAmPm} 
              onChangeOverride={handleStartChange}
            />
            <TimePicker 
              label="End Time" 
              h={endH} setH={setEndH} 
              m={endM} setM={setEndM} 
              ampm={endAmPm} setAmPm={setEndAmPm} 
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">Sequence number will be automatically calculated based on start time.</p>

          <hr className="my-4 border-gray-200" />

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-bold text-gray-700">Assign Faculty</label>
              <button
                type="button"
                onClick={() => setShowAddNew(!showAddNew)}
                className="text-xs font-bold text-blue-600 hover:text-blue-800"
              >
                + Add new faculty
              </button>
            </div>

            {showAddNew && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3 space-y-2">
                <input
                  placeholder="Full name (e.g., Dr. Jane Doe)"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    placeholder="Email (optional)"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                  />
                  <input
                    placeholder="Phone (optional)"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowAddNew(false)}
                    className="text-xs px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAddNewFaculty}
                    disabled={addingFaculty}
                    className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {addingFaculty ? 'Adding...' : 'Add & Attach'}
                  </button>
                </div>
              </div>
            )}

            {facultyLinks.length > 0 && (
              <div className="space-y-2 mb-3">
                {facultyLinks.map((l) => (
                  <div
                    key={l.faculty_id}
                    className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg p-2"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-gray-900 truncate">
                        {l.faculty.canonical_name}
                      </div>
                      <div className="text-xs text-gray-500 truncate">{l.faculty.email || '—'}</div>
                    </div>
                    <select
                      value={l.role}
                      onChange={(e) => updateRole(l.faculty_id, e.target.value)}
                      className="text-xs border border-gray-300 rounded px-2 py-1 bg-white"
                    >
                      <option value="Faculty">Faculty</option>
                      <option value="Panel">Panel</option>
                      <option value="Moderator">Moderator</option>
                      <option value="Coordinator">Coordinator</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => removeFaculty(l.faculty_id)}
                      className="text-xs text-red-600 hover:underline font-semibold"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}

            <input
              type="text"
              placeholder="Search by name or email to add faculty..."
              value={searchFaculty}
              onChange={(e) => setSearchFaculty(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            {searchFaculty.length > 0 && (
              <div className="mt-1 border border-gray-200 rounded-lg max-h-40 overflow-y-auto bg-white shadow-sm">
                {filteredFaculty.length === 0 ? (
                  <div className="p-3 text-sm text-gray-500">No faculty found</div>
                ) : (
                  filteredFaculty.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => addFaculty(f)}
                      className="w-full text-left p-2.5 border-b border-gray-100 hover:bg-blue-50 text-sm"
                    >
                      <div className="font-semibold text-gray-900">{f.canonical_name}</div>
                      <div className="text-xs text-gray-500">{f.email || '—'}</div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {conflicts.length > 0 && (
            <div className="bg-red-50 border border-red-300 rounded-lg p-3 space-y-2">
              <div className="font-bold text-red-800 text-sm">
                Overlap warning — this faculty is already booked:
              </div>
              {conflicts.map((c, i) => (
                <div key={i} className="text-xs text-red-800 bg-white rounded p-2 border border-red-200">
                  <strong>{c.facultyName}</strong> also on <em>{c.otherSession}</em> ({c.otherTopic}) on{' '}
                  {formatDateDdMmYyyy(c.otherDate)}, {formatTimeAmPm(c.otherStart)} –{' '}
                  {formatTimeAmPm(c.otherEnd)}
                </div>
              ))}
              <div className="flex gap-2 justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setConflicts([])}
                  className="text-xs px-3 py-1.5 border border-gray-300 rounded bg-white hover:bg-gray-50"
                >
                  Go back and fix
                </button>
                <button
                  type="button"
                  onClick={forceSaveAnyway}
                  className="text-xs px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Save anyway
                </button>
              </div>
            </div>
          )}

          {error && <p className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</p>}

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 border border-gray-300 rounded-lg font-medium hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Topic'}
            </button>
          </div>
        </form>

                {showSuccessPrompt && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
              <h3 className="text-lg font-bold text-gray-900">Topic saved</h3>
              <p className="text-sm text-gray-700">
                Faculty assignments updated. You can now generate a PDF for the
                newly added faculty, the whole session, or just close.
              </p>
              {pdfError && <p className="text-xs text-red-600 bg-red-50 p-2 rounded">{pdfError}</p>}
              {pdfUrl && (
                <p className="text-xs text-green-700 bg-green-50 p-2 rounded">
                  PDF ready:{' '}
                  <a href={pdfUrl} target="_blank" rel="noreferrer" className="underline font-semibold">
                    Open / download
                  </a>
                </p>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={pdfBusy}
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
                    if (ok.length === 0) setPdfError('No PDFs generated.');
                    else setPdfUrl((ok[0] as any).url);
                  }}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {pdfBusy ? 'Rendering…' : 'PDF for new faculty'}
                </button>
                <button
                  type="button"
                  disabled={pdfBusy}
                  onClick={async () => {
                    setPdfBusy(true); setPdfError(null);
                    const r = await generatePDFForSession(session.id);
                    setPdfBusy(false);
                    if (r.success) setPdfUrl((r as any).url);
                    else setPdfError((r as any).message || 'PDF failed');
                  }}
                  className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                >
                  {pdfBusy ? 'Rendering…' : 'PDF for whole session'}
                </button>
              </div>
              <div className="flex justify-end pt-2 border-t">
                <button
                  onClick={finalizeAndClose}
                  className="px-4 py-2 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
