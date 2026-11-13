'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import Modal from './Modal';
import Badge, { roleTone } from './Badge';
import { inputCls } from './Field';
import { CloseIcon, GripIcon } from './Icons';
import { Button, Notice } from './ui';

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
      size="md"
      busy={isSaving}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} busy={isSaving}>
            {isSaving ? 'Saving…' : 'Save coordinators'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <section aria-labelledby="coord-current">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <h3 id="coord-current" className="text-sm font-semibold text-ink">Current coordinators</h3>
            {coordinators.length > 1 && <p className="text-xs text-muted">Drag a row to change the order</p>}
          </div>
          {coordinators.length === 0 ? (
            <p className="rounded-lg border border-dashed border-field bg-canvas p-4 text-center text-sm text-ink-2">
              No coordinators yet. Search below to add one.
            </p>
          ) : (
            <ol className="space-y-1.5">
              {coordinators.map((c, i) => (
                <li
                  key={c.faculty_id || c.faculty?.id || i}
                  draggable={!isSaving}
                  onDragStart={(e) => { setDragIndex(i); e.dataTransfer.effectAllowed = 'move'; }}
                  onDragOver={(e) => { e.preventDefault(); dragOver(i); }}
                  onDragEnd={() => setDragIndex(null)}
                  onDrop={(e) => { e.preventDefault(); setDragIndex(null); }}
                  className={`flex items-center gap-2 rounded-lg border bg-white py-1.5 pl-1.5 pr-2 transition-colors ${
                    dragIndex === i ? 'border-accent bg-accent-tint shadow-card' : 'border-line'
                  }`}
                >
                  <span className="flex h-8 w-6 shrink-0 cursor-grab items-center justify-center text-muted active:cursor-grabbing" title="Drag to reorder" aria-hidden="true">
                    <GripIcon />
                  </span>
                  <span className="tnum w-5 shrink-0 text-center text-sm font-semibold text-ink-2">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">{c.faculty?.canonical_name}</span>
                  </span>
                  <Badge tone={roleTone(c.role)}>{c.role}</Badge>
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
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-2 transition-colors hover:bg-danger hover:text-white"
                  >
                    <CloseIcon width={18} height={18} />
                  </button>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section aria-labelledby="coord-add" className="border-t border-line pt-4">
          <h3 id="coord-add" className="mb-2 text-sm font-semibold text-ink">Add a coordinator</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="coord-role" className="mb-1.5 block text-sm font-medium text-ink">Role</label>
              <select id="coord-role" value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)} className={inputCls}>
                <option value="National">National</option>
                <option value="Lead Coordinator">Lead Coordinator</option>
                <option value="Local">Local</option>
              </select>
            </div>
            <div className="relative sm:col-span-2">
              <label htmlFor="coord-search" className="mb-1.5 block text-sm font-medium text-ink">Search faculty</label>
              <input
                id="coord-search"
                type="search"
                placeholder="Type a name or email"
                className={inputCls}
                value={searchFaculty}
                onChange={(e) => setSearchFaculty(e.target.value)}
              />
              {searchFaculty.length > 0 && (
                <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-line bg-white shadow-pop">
                  {filteredFaculty.length === 0 ? (
                    <p className="p-3 text-sm text-ink-2">No faculty found.</p>
                  ) : (
                    filteredFaculty.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => handleAddCoordinator(f)}
                        className="block w-full border-b border-line px-3 py-2 text-left text-sm last:border-b-0 hover:bg-accent-tint"
                      >
                        <span className="block font-medium text-ink">{f.canonical_name}</span>
                        <span className="block text-xs text-muted">{f.email}</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </section>

        {error && <Notice tone="danger">{error}</Notice>}
      </div>
    </Modal>
  );
}
