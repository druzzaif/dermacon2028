'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabase';
import EditSessionModal from '../components/EditSessionModal';
import AddTopicModal from '../components/AddTopicModal';
import EditCoordinatorsModal from '../components/EditCoordinatorsModal';
import EditTopicModal from '../components/EditTopicModal';
import { useSearchParams } from 'next/navigation';
import { resequenceSession, deleteTopic } from '../actions';
import ConfirmDeleteDialog from '../components/ConfirmDeleteDialog';

function formatDateLabel(dateStr: string | null): string {
  if (!dateStr) return 'No date';
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${d.getFullYear()}`;
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

function roleBadgeClasses(role: string | null | undefined): string {
  const r = (role || '').trim().toLowerCase();
  if (r === 'national') return 'bg-purple-100 text-purple-800 border-purple-200';
  if (r === 'lead coordinator' || r === 'lead') return 'bg-amber-100 text-amber-800 border-amber-200';
  if (r === 'local') return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (r === 'faculty') return 'bg-blue-50 text-blue-700 border-blue-200';
  return 'bg-gray-100 text-gray-800 border-gray-200';
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSession, setSelectedSession] = useState<any | null>(null);
  const [coordinators, setCoordinators] = useState<any[]>([]);
  const [topics, setTopics] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterHall, setFilterHall] = useState<string>('');
  const [filterDate, setFilterDate] = useState<string>('');
  const [filterSessionCode, setFilterSessionCode] = useState<string>('');

  const [isEditingSession, setIsEditingSession] = useState(false);
  const [isAddingTopic, setIsAddingTopic] = useState(false);
  const [isEditingCoordinators, setIsEditingCoordinators] = useState(false);
  const [editingTopic, setEditingTopic] = useState<any | null>(null);
  const [deletingTopic, setDeletingTopic] = useState<any | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const searchParams = useSearchParams();
  const targetCode = searchParams.get('code');

  useEffect(() => {
    async function fetchSessions() {
      const { data } = await supabase.from('conference_sessions').select('*');

      if (data) {
        // Sort: 1. MC vs WS, 2. Natural Code Order (MC1, MC2, MC10)
        const sortedData = data.sort((a, b) => {
          const codeA = (a.session_code || '').toUpperCase();
          const codeB = (b.session_code || '').toUpperCase();

          const prefixA = codeA.replace(/[0-9]/g, '');
          const prefixB = codeB.replace(/[0-9]/g, '');

          // Group MC first, then WS
          if (prefixA !== prefixB) {
            if (prefixA === 'MC') return -1;
            if (prefixB === 'MC') return 1;
            return prefixA.localeCompare(prefixB);
          }

          // Natural numeric sort within the group (MC1, MC2, MC10)
          return codeA.localeCompare(codeB, undefined, { numeric: true, sensitivity: 'base' });
        });

        setSessions(sortedData);

        if (targetCode) {
          const found = sortedData.find((s) => s.session_code === targetCode);
          if (found) setSelectedSession(found);
          else if (sortedData.length > 0) setSelectedSession(sortedData[0]);
        } else if (sortedData.length > 0) {
          setSelectedSession(sortedData[0]);
        }
      }
      setLoading(false);
    }
    fetchSessions();
  }, [targetCode]);

  async function refreshDetails() {
    if (!selectedSession) return;
    setLoadingDetails(true);

    const { data: coordData } = await supabase
      .from('session_coordinators')
      .select(`role, faculty_id, faculty ( id, canonical_name, phone )`)
      .eq('session_id', selectedSession.id);

    if (coordData) {
      const rolePriority: Record<string, number> = {
        National: 1,
        'Lead Coordinator': 2,
        Local: 3,
      };
      const sortedCoords = coordData.sort(
        (a, b) => (rolePriority[a.role] || 99) - (rolePriority[b.role] || 99)
      );
      setCoordinators(sortedCoords);
    }

    const { data: topicData } = await supabase
      .from('session_topics')
      .select(
        `
        id, topic_title, start_time, end_time, sequence_no,
        faculty_topics ( role, faculty ( id, canonical_name, phone, email ) )
      `
      )
      .eq('session_id', selectedSession.id)
      .order('sequence_no', { ascending: true })
      .order('topic_title', { ascending: true });

    if (topicData) setTopics(topicData);
    setLoadingDetails(false);
  }

  useEffect(() => {
    refreshDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSession]);

  const distinctHalls = useMemo(() => {
    const set = new Set<string>();
    sessions.forEach((s) => {
      const h = (s.hall || '').trim();
      if (h) set.add(h);
    });
    return Array.from(set).sort();
  }, [sessions]);

  const distinctDates = useMemo(() => {
    const set = new Set<string>();
    sessions.forEach((s) => {
      if (s.session_date) set.add(s.session_date);
    });
    return Array.from(set).sort();
  }, [sessions]);

  const sessionOptions = useMemo(() => {
    const map = new Map<string, { code: string; name: string }>();
    sessions.forEach((s) => {
      if (!s.session_code) return;
      if (!map.has(s.session_code)) {
        map.set(s.session_code, {
          code: s.session_code,
          name: s.session_name || '',
        });
      }
    });
    return Array.from(map.values()); // already sorted from state
  }, [sessions]);

  const filteredSessions = sessions.filter((s) => {
    const q = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !q ||
      s.session_code?.toLowerCase().includes(q) ||
      s.session_name?.toLowerCase().includes(q);
    const matchesHall = !filterHall || (s.hall || '') === filterHall;
    const matchesDate = !filterDate || s.session_date === filterDate;
    const matchesCode = !filterSessionCode || s.session_code === filterSessionCode;
    return matchesSearch && matchesHall && matchesDate && matchesCode;
  });

  const hasActiveFilter = Boolean(
    filterHall || filterDate || filterSessionCode || searchTerm.trim()
  );

  function clearFilters() {
    setSearchTerm('');
    setFilterHall('');
    setFilterDate('');
    setFilterSessionCode('');
  }

  if (loading)
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50 text-gray-500 text-xl">
        Loading Master Schedule...
      </div>
    );

  return (
    <div className="flex h-screen print:h-auto bg-gray-100 text-gray-900 font-sans overflow-hidden print:overflow-visible">
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col shrink-0 print:hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
          <p className="text-sm font-bold text-gray-700">Master Schedule</p>
          <a href="/faculty" className="text-xs text-blue-600 hover:underline">Faculty</a>
        </div>

        <div className="p-3 border-b border-gray-200 space-y-2">
          <input
            type="text"
            placeholder="Search sessions..."
            className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <select
            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:border-blue-500"
            value={filterSessionCode}
            onChange={(e) => setFilterSessionCode(e.target.value)}
          >
            <option value="">All sessions</option>
            {sessionOptions.map((opt) => (
              <option key={opt.code} value={opt.code}>
                {opt.code} - {opt.name}
              </option>
            ))}
          </select>

          <select
            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:border-blue-500"
            value={filterHall}
            onChange={(e) => setFilterHall(e.target.value)}
          >
            <option value="">All halls</option>
            {distinctHalls.map((h) => (
              <option key={h} value={h}>
                Hall {h}
              </option>
            ))}
          </select>

          <select
            className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:border-blue-500"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
          >
            <option value="">All dates</option>
            {distinctDates.map((d) => (
              <option key={d} value={d}>
                {formatDateLabel(d)}
              </option>
            ))}
          </select>

          <div className="flex items-center justify-between pt-1 text-xs text-gray-500">
            <span>
              Showing <span className="font-semibold text-gray-700">{filteredSessions.length}</span> of{' '}
              {sessions.length}
            </span>
            {hasActiveFilter && (
              <button
                onClick={clearFilters}
                className="text-blue-600 hover:text-blue-800 font-semibold"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filteredSessions.length === 0 ? (
            <div className="p-4 text-xs text-gray-500 italic text-center">
              No sessions match your filters.
            </div>
          ) : (
            filteredSessions.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedSession(s)}
                className={`w-full text-left px-3 py-2 border-b border-gray-100 transition-colors flex flex-col ${
                  selectedSession?.id === s.id
                    ? 'bg-blue-50 border-l-4 border-blue-600'
                    : 'hover:bg-gray-50'
                }`}
              >
                <span className="font-bold text-blue-800 text-xs">{s.session_code}</span>
                <span className="text-sm font-medium text-gray-800 truncate leading-tight">
                  {s.session_name}
                </span>
                <span className="text-[11px] text-gray-500 mt-0.5">
                  {formatDateLabel(s.session_date)}
                </span>
              </button>
            ))
          )}
        </div>
      </aside>

      <main className="flex-1 flex flex-col h-full overflow-hidden bg-gray-50 relative print:overflow-visible print:h-auto">
        {selectedSession ? (
          <>
            <div className="session-header bg-white border-b border-gray-200 px-6 py-5 shrink-0 shadow-sm z-10 print:border-0 print:shadow-none print:px-0 print:py-2">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-3xl font-bold text-gray-900 flex items-center gap-3 flex-wrap">
                    {selectedSession.session_code}
                    <span className="text-xl font-normal text-gray-600 border-l-2 border-gray-300 pl-3">
                      {selectedSession.session_name}
                    </span>
                  </h2>
                  <div className="flex gap-6 mt-3 text-sm text-gray-700 flex-wrap">
                    <span>
                      <strong className="text-gray-900">Date:</strong>{' '}
                      {formatDateLabel(selectedSession.session_date)}
                    </span>
                    <span>
                      <strong className="text-gray-900">Time:</strong>{' '}
                      {formatTimeAmPm(selectedSession.start_time)} -{' '}
                      {formatTimeAmPm(selectedSession.end_time)}
                    </span>
                    <span>
                      <strong className="text-gray-900">Hall:</strong>{' '}
                      {selectedSession.hall || 'TBD'}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0 print:hidden">
                  <button
                    onClick={() => window.print()}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 shadow-sm"
                    title="Print this schedule (Ctrl+P)"
                  >
                    Print
                  </button>
                  <button
                    onClick={() => setIsEditingSession(true)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 shadow-sm"
                  >
                    Edit Session
                  </button>
                  <button
                    onClick={() => setIsAddingTopic(true)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm"
                  >
                    + Add Topic
                  </button>
                </div>
              </div>

              <div className="coordinator-strip bg-blue-50 rounded-lg p-2.5 border border-blue-100 flex items-center gap-3 print:bg-white print:border-gray-300">
                <h3 className="text-[10px] font-bold text-blue-900 uppercase tracking-wider shrink-0">
                  Coordinators
                </h3>

                <div className="flex gap-1.5 flex-wrap flex-1">
                  {coordinators.length === 0 ? (
                    <span className="text-xs text-gray-500 italic">No coordinators assigned.</span>
                  ) : (
                    coordinators.map((c, i) => (
                      <div
                        key={i}
                        className="bg-white px-1.5 py-0.5 rounded border border-blue-200 flex items-center gap-1 shadow-sm"
                      >
                        <span className="font-semibold text-gray-900 text-[11px]">
                          {c.faculty?.canonical_name}
                        </span>
                        <span className="text-[8px] font-bold text-blue-700 bg-blue-100 px-1 py-0.5 rounded uppercase">
                          {c.role}
                        </span>
                      </div>
                    ))
                  )}
                </div>

                <button
                  onClick={() => setIsEditingCoordinators(true)}
                  className="ml-auto text-[11px] text-blue-600 hover:text-blue-800 font-bold px-2 py-1 bg-white border border-blue-200 rounded shadow-sm shrink-0 print:hidden"
                >
                  Edit Coordinators
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-6 print:overflow-visible print:p-0">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <table className="w-full text-left border-collapse table-fixed">
                  <colgroup>
                    <col className="w-10" />
                    <col className="w-32" />
                    <col />
                    <col className="w-36" />
                    <col className="w-24" />
                    <col className="w-36" />
                    <col className="w-20" />
                    <col className="w-20" />
                  </colgroup>
                  <thead>
                    <tr className="bg-gray-100 border-b border-gray-300 text-gray-800 text-[11px] uppercase tracking-wider">
                      <th className="px-1 py-2 font-bold text-center">Seq</th>
                      <th className="px-1 py-2 font-bold">Time</th>
                      <th className="px-2 py-2 font-bold">Topic</th>
                      <th className="px-1 py-2 font-bold">Faculty</th>
                      <th className="px-1 py-2 font-bold">Phone</th>
                      <th className="px-1 py-2 font-bold">Email</th>
                      <th className="px-1 py-2 font-bold text-center">Role</th>
                      <th className="px-1 py-2 font-bold text-center print:hidden">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {loadingDetails ? (
                      <tr>
                        <td colSpan={8} className="text-center py-10 text-gray-500 text-sm">
                          Loading schedule...
                        </td>
                      </tr>
                    ) : topics.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center py-10 text-gray-500 italic text-sm">
                          No topics assigned yet.
                        </td>
                      </tr>
                    ) : (
                      topics.map((t) => {
                        const facultyList = t.faculty_topics || [];
                        return (
                          <tr
                            key={t.id}
                            className="hover:bg-blue-50/40 transition-colors align-top"
                          >
                            <td className="px-1 py-1.5 text-sm text-gray-600 text-center font-bold bg-gray-50">
                              {t.sequence_no}
                            </td>
                            <td className="px-1 py-1.5 text-xs text-blue-800 font-semibold whitespace-nowrap">
                              {formatTimeAmPm(t.start_time)} - {formatTimeAmPm(t.end_time)}
                            </td>
                            <td
                              className="px-2 py-1.5 text-sm font-medium text-gray-900 leading-snug"
                              title={t.topic_title}
                            >
                              {t.topic_title}
                            </td>

                            {facultyList.length === 0 ? (
                              <>
                                <td colSpan={4} className="px-1 py-1.5 text-sm text-gray-400 italic">
                                  Unassigned
                                </td>
                                <td className="px-1 py-1.5 text-center whitespace-nowrap">
                                  <button
                                    onClick={() => setEditingTopic(t)}
                                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline mr-2"
                                    title="Edit Topic"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => { setDeleteError(null); setDeletingTopic(t); }}
                                    className="text-xs font-semibold text-red-600 hover:text-red-800 hover:underline"
                                    title="Delete Topic"
                                  >
                                    Delete
                                  </button>
                                </td>
                              </>
                            ) : (
                              <>
                                <td className="px-1 py-1.5 text-sm">
                                  {facultyList.map((ft: any, i: number) => (
                                    <div
                                      key={i}
                                      className="font-semibold text-gray-900 mb-1 truncate"
                                      title={ft.faculty?.canonical_name || ''}
                                    >
                                      {ft.faculty?.canonical_name}
                                    </div>
                                  ))}
                                </td>
                                <td className="px-1 py-1.5 text-xs text-gray-700">
                                  {facultyList.map((ft: any, i: number) => (
                                    <div
                                      key={i}
                                      className="mb-1 truncate"
                                      title={ft.faculty?.phone || ''}
                                    >
                                      {ft.faculty?.phone || '--'}
                                    </div>
                                  ))}
                                </td>
                                <td className="px-1 py-1.5 text-xs text-gray-700">
                                  {facultyList.map((ft: any, i: number) => (
                                    <div
                                      key={i}
                                      className="mb-1 truncate"
                                      title={ft.faculty?.email || ''}
                                    >
                                      {ft.faculty?.email || '--'}
                                    </div>
                                  ))}
                                </td>
                                <td className="px-1 py-1.5 text-sm">
                                  {facultyList.map((ft: any, i: number) => (
                                    <div key={i} className="mb-1">
                                      <span
                                        className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold border leading-tight ${roleBadgeClasses(
                                          ft.role
                                        )}`}
                                      >
                                        {ft.role || 'Faculty'}
                                      </span>
                                    </div>
                                  ))}
                                </td>
                                <td className="px-1 py-1.5 text-center whitespace-nowrap">
                                  <button
                                    onClick={() => setEditingTopic(t)}
                                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline mr-2"
                                    title="Edit Topic"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => { setDeleteError(null); setDeletingTopic(t); }}
                                    className="text-xs font-semibold text-red-600 hover:text-red-800 hover:underline"
                                    title="Delete Topic"
                                  >
                                    Delete
                                  </button>
                                </td>
                              </>
                            )}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500 text-xl">
            Select a session to view.
          </div>
        )}

        {isEditingSession && selectedSession && (
          <EditSessionModal
            session={selectedSession}
            onClose={() => setIsEditingSession(false)}
            onSaved={async () => {
              // Re-fetch this session so name/date/time/hall updates flow in
              const { data } = await supabase
                .from('conference_sessions')
                .select('*')
                .eq('id', selectedSession.id)
                .single();
              if (data) setSelectedSession(data);
              // Resequence in case times changed relative to other topics
              await resequenceSession(selectedSession.id);
              await refreshDetails();
              setIsEditingSession(false);
            }}
          />
        )}
        {isAddingTopic && selectedSession && (
          <AddTopicModal
            session={selectedSession}
            onClose={() => setIsAddingTopic(false)}
            onSaved={async () => {
              // Server-side auto-resequence by start_time, then reload topics
              await resequenceSession(selectedSession.id);
              await refreshDetails();
              setIsAddingTopic(false);
            }}
          />
        )}
        {isEditingCoordinators && selectedSession && (
          <EditCoordinatorsModal
            session={selectedSession}
            currentCoordinators={coordinators}
            onClose={() => setIsEditingCoordinators(false)}
            onSaved={async () => {
              await refreshDetails();
              setIsEditingCoordinators(false);
            }}
          />
        )}
        {editingTopic && selectedSession && (
          <EditTopicModal
            topic={editingTopic}
            session={selectedSession}
            onClose={() => setEditingTopic(null)}
            onSaved={async () => {
              // Time may have moved -> resequence the whole session
              await resequenceSession(selectedSession.id);
              await refreshDetails();
              setEditingTopic(null);
            }}
          />
        )}

        {deletingTopic && selectedSession && (
          <ConfirmDeleteDialog
            title="Delete this topic?"
            description={
              <div className="space-y-2">
                <div className="bg-gray-50 border border-gray-200 rounded p-2 text-xs">
                  <div className="font-semibold text-gray-900">{deletingTopic.topic_title}</div>
                  <div className="text-gray-600 mt-1">
                    Seq {deletingTopic.sequence_no ?? '?'}
                    {(deletingTopic.faculty_topics?.length || 0) > 0 && (
                      <> &middot; {deletingTopic.faculty_topics.length} faculty link(s) will be removed</>
                    )}
                  </div>
                </div>
                <div>This cannot be undone. Remaining topics in this session will renumber automatically.</div>
                {deleteError && <div className="text-xs text-red-700 bg-red-50 p-2 rounded">{deleteError}</div>}
              </div>
            }
            confirmLabel="Delete Topic"
            busyLabel="Deleting..."
            onCancel={() => setDeletingTopic(null)}
            onConfirm={async () => {
              if (!selectedSession) return;
              setDeleteBusy(true);
              setDeleteError(null);
              const res = await deleteTopic(deletingTopic.id, selectedSession.id);
              setDeleteBusy(false);
              if (!res.success) {
                setDeleteError(res.message);
                return;
              }
              setDeletingTopic(null);
              await refreshDetails();
            }}
          />
        )}
      </main>
    </div>
  );
}
