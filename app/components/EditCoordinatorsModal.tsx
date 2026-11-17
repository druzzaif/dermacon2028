'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import Modal from './Modal';
import { CloseIcon, GripIcon } from './Icons';
import { Button, Notice } from './ui';

const ROLE_CHOICES = ['National', 'Lead Coordinator', 'Local'];

const coordinatorInputCls =
  'block h-8 w-full min-w-0 rounded-md border border-field bg-white px-2 text-xs text-ink placeholder:text-muted';

export default function EditCoordinatorsModal({
  session,
  currentCoordinators,
  onClose,
  onSaved,
}: {
  session: any;
  currentCoordinators: any[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [facultyList, setFacultyList] = useState<any[]>([]);
  const [searchFaculty, setSearchFaculty] = useState('');
  const [selectedRole, setSelectedRole] = useState('National');
  const [coordinators, setCoordinators] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Row being dragged (its position in the list), for drag-and-drop reordering
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // While typing, keep the matching names in view (they sit in the page, above the Save bar)
  useEffect(() => {
    if (searchFaculty) resultsRef.current?.scrollIntoView({ block: 'nearest' });
  }, [searchFaculty]);

  useEffect(() => {
    async function loadFaculty() {
      const { data } = await supabase.from('faculty').select('id, canonical_name, email').order('canonical_name');
      if (data) setFacultyList(data);
    }
    loadFaculty();
    setCoordinators(currentCoordinators);
  }, [currentCoordinators]);

  const filteredFaculty = facultyList.filter(f => 
    f.canonical_name.toLowerCase().includes(searchFaculty.toLowerCase()) ||
    f.email?.toLowerCase().includes(searchFaculty.toLowerCase())
  ).slice(0, 5);

  async function handleAddCoordinator(faculty: any) {
    if (coordinators.find(c => c.faculty_id === faculty.id)) {
      setError(`${faculty.canonical_name} is already a coordinator for this session.`);
      return;
    }
    const newCoord = {
      session_id: session.id,
      faculty_id: faculty.id,
      role: selectedRole,
      faculty: faculty
    };
    setError(null);
    setCoordinators([...coordinators, newCoord]);
    setSearchFaculty('');
  }

  // Change the role of someone already in the list (National / Lead Coordinator / Local)
  function changeRole(faculty_id: string, role: string) {
    setCoordinators(coordinators.map((c) => ((c.faculty_id || c.faculty?.id) === faculty_id ? { ...c, role } : c)));
  }

  async function handleRemoveCoordinator(faculty_id: string) {
    setCoordinators(coordinators.filter(c => c.faculty_id !== faculty_id));
  }

  function moveCoordinator(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= coordinators.length) return;
    const next = [...coordinators];
    [next[index], next[target]] = [next[target], next[index]];
    setCoordinators(next);
  }

  // Drag and drop: while a row is dragged over another, it takes that place
  function dragOver(index: number) {
    if (dragIndex === null || dragIndex === index) return;
    const next = [...coordinators];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(index, 0, moved);
    setCoordinators(next);
    setDragIndex(index);
  }

  async function handleSave() {
    setIsSaving(true);
    setError(null);

    await supabase.from('session_coordinators').delete().eq('session_id', session.id);

    if (coordinators.length > 0) {
      // coord_id stores the order the lead coordinator arranged (1, 2, 3 …)
      const payload = coordinators.map((c, i) => ({
        session_id: session.id,
        faculty_id: c.faculty.id || c.faculty_id,
        role: c.role,
        coord_id: i + 1
      }));

      const { error } = await supabase.from('session_coordinators').insert(payload);
      
      if (error) {
        setError('The coordinators could not be saved: ' + error.message);
        setIsSaving(false);
        return;
      }
    }

    setIsSaving(false);
    onSaved();
    onClose();
  }

  return (
    <Modal
      title="Edit coordinators"
      subtitle={`${session.session_code} – ${session.session_name}`}
      size="sm"
      dense
      busy={isSaving}
      onClose={onClose}
      footer={
        <>
          <Button size="sm" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button size="sm" variant="primary" onClick={handleSave} busy={isSaving}>
            {isSaving ? 'Saving…' : 'Save coordinators'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <section aria-labelledby="coord-current">
          <div className="mb-1 flex items-baseline justify-between gap-2">
            <h3 id="coord-current" className="text-xs font-semibold text-ink">Current coordinators</h3>
            {coordinators.length > 1 && <p className="text-[11px] text-muted">Drag to reorder</p>}
          </div>
          {coordinators.length === 0 ? (
            <p className="rounded-md border border-dashed border-field bg-canvas p-2 text-center text-xs text-ink-2">
              No coordinators yet. Add one below.
            </p>
          ) : (
            <ol className="space-y-1">
              {coordinators.map((c, i) => (
                <li
                  key={c.faculty_id || c.faculty?.id || i}
                  draggable={!isSaving}
                  onDragStart={(e) => { setDragIndex(i); e.dataTransfer.effectAllowed = 'move'; }}
                  onDragOver={(e) => { e.preventDefault(); dragOver(i); }}
                  onDragEnd={() => setDragIndex(null)}
                  onDrop={(e) => { e.preventDefault(); setDragIndex(null); }}
                  className={`flex items-center gap-1 rounded-md border bg-white py-1 pl-1 pr-1.5 transition-colors ${
                    dragIndex === i ? 'border-accent bg-accent-tint shadow-card' : 'border-line'
                  }`}
                >
                  <span className="flex h-6 w-5 shrink-0 cursor-grab items-center justify-center text-muted active:cursor-grabbing" title="Drag to reorder" aria-hidden="true">
                    <GripIcon width={14} height={14} />
                  </span>
                  <span className="tnum w-4 shrink-0 text-center text-xs font-semibold text-ink-2">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-ink">{c.faculty?.canonical_name}</span>
                  </span>
                  <select
                    value={c.role}
                    onChange={(e) => changeRole(c.faculty_id || c.faculty?.id, e.target.value)}
                    aria-label={`Role of ${c.faculty?.canonical_name}`}
                    title="Change role"
                    className="h-7 w-[7.5rem] shrink-0 rounded-md border border-field bg-white px-1 text-[11px] text-ink"
                  >
                    {ROLE_CHOICES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <span className="flex shrink-0 flex-col">
                    <button type="button" onClick={() => moveCoordinator(i, -1)} disabled={i === 0}
                      aria-label={`Move ${c.faculty?.canonical_name} up`} title="Move up"
                      className="flex h-4 w-6 items-center justify-center rounded text-[10px] leading-none text-ink-2 hover:bg-accent-tint hover:text-accent disabled:opacity-25">▲</button>
                    <button type="button" onClick={() => moveCoordinator(i, 1)} disabled={i === coordinators.length - 1}
                      aria-label={`Move ${c.faculty?.canonical_name} down`} title="Move down"
                      className="flex h-4 w-6 items-center justify-center rounded text-[10px] leading-none text-ink-2 hover:bg-accent-tint hover:text-accent disabled:opacity-25">▼</button>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveCoordinator(c.faculty_id || c.faculty.id)}
                    aria-label={`Remove ${c.faculty?.canonical_name}`}
                    title="Remove"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-2 transition-colors hover:bg-danger hover:text-white"
                  >
                    <CloseIcon width={15} height={15} />
                  </button>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section aria-labelledby="coord-add" className="border-t border-line pt-2">
          <h3 id="coord-add" className="mb-1 text-xs font-semibold text-ink">Add coordinator</h3>
          <div className="flex min-w-0 gap-2">
            <div className="w-32 shrink-0">
              <label htmlFor="coord-role" className="sr-only">Coordinator role</label>
              <select id="coord-role" title="Coordinator role" value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)} className={coordinatorInputCls}>
                {ROLE_CHOICES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="relative min-w-0 flex-1">
              <label htmlFor="coord-search" className="sr-only">Search faculty by name or email</label>
              <input
                id="coord-search"
                type="search"
                placeholder="Name or email"
                className={coordinatorInputCls}
                value={searchFaculty}
                onChange={(e) => setSearchFaculty(e.target.value)}
              />
            </div>
          </div>
          {searchFaculty.length > 0 && (
            <div ref={resultsRef} role="listbox" aria-label="Matching faculty" className="mt-1.5 max-h-48 overflow-y-auto rounded-md border border-line bg-white">
              {filteredFaculty.length === 0 ? (
                <p className="p-2 text-xs text-ink-2">No faculty found.</p>
              ) : (
                filteredFaculty.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => handleAddCoordinator(f)}
                    className="block w-full border-b border-line px-2 py-1.5 text-left text-xs last:border-b-0 hover:bg-accent-tint"
                  >
                    <span className="block font-medium text-ink">{f.canonical_name}</span>
                    <span className="block text-[11px] text-muted">{f.email}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </section>

        {error && <Notice tone="danger">{error}</Notice>}
      </div>
    </Modal>
  );
}
