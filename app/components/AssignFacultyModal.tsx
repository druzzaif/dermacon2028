'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import Modal from './Modal';
import Field, { inputCls } from './Field';
import { Button, Notice, Tabs } from './ui';
import { CloseIcon } from './Icons';

const COUNTRY_CODES = [
  { code: '+91', country: 'India' },
  { code: '+1', country: 'USA/Canada' },
  { code: '+44', country: 'UK' },
  { code: '+971', country: 'UAE' },
  { code: '+966', country: 'Saudi Arabia' },
  { code: '+65', country: 'Singapore' },
  { code: '+61', country: 'Australia' },
  { code: '+49', country: 'Germany' },
  { code: '+33', country: 'France' },
  { code: '+39', country: 'Italy' },
  { code: '+34', country: 'Spain' },
  { code: '+7', country: 'Russia' },
  { code: '+86', country: 'China' },
  { code: '+81', country: 'Japan' },
  { code: '+82', country: 'South Korea' },
  { code: '+27', country: 'South Africa' },
  { code: '+55', country: 'Brazil' },
  { code: '+52', country: 'Mexico' },
  { code: '+92', country: 'Pakistan' },
  { code: '+880', country: 'Bangladesh' },
  { code: '+94', country: 'Sri Lanka' },
  { code: '+977', country: 'Nepal' },
];

export default function AssignFacultyModal({
  topic,
  onClose,
  onSaved,
}: {
  topic: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [mode, setMode] = useState<'search' | 'create'>('search');
  const [facultyList, setFacultyList] = useState<any[]>([]);
  const [searchFaculty, setSearchFaculty] = useState('');
  const [selectedFaculty, setSelectedFaculty] = useState<any | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New Faculty Form State
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [countryCode, setCountryCode] = useState('+91');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [newAltEmail, setNewAltEmail] = useState('');
  const [newCountry, setNewCountry] = useState('');

  useEffect(() => {
    async function loadFaculty() {
      const { data } = await supabase.from('faculty').select('id, canonical_name, email').order('canonical_name');
      if (data) setFacultyList(data);
    }
    loadFaculty();
  }, []);

  const filteredFaculty = facultyList.filter(f =>
    f.canonical_name.toLowerCase().includes(searchFaculty.toLowerCase()) ||
    f.email?.toLowerCase().includes(searchFaculty.toLowerCase())
  ).slice(0, 5);

  async function handleAssign() {
    if (!selectedFaculty) return;
    setIsSaving(true);
    setError(null);

    const { error } = await supabase.from('faculty_topics').insert({
      faculty_id: selectedFaculty.id,
      topic_id: topic.id,
      role: 'Faculty'
    });

    if (error) {
      setError("Error assigning faculty: " + error.message);
      setIsSaving(false);
      return;
    }

    setIsSaving(false);
    onSaved();
    onClose();
  }

  async function handleCreateAndAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!newName || !newEmail || !phoneNumber) return;
    setIsSaving(true);
    setError(null);

    // Combine Country Code and Phone Number
    const fullPhone = `${countryCode} ${phoneNumber}`.trim();

    // Auto-generate Faculty ID
    const { data: allFac } = await supabase.from('faculty').select('faculty_id').like('faculty_id', 'FAC%');
    let maxNum = 0;
    if (allFac) {
      allFac.forEach(f => {
        const num = parseInt(f.faculty_id.replace('FAC', ''));
        if (!isNaN(num) && num > maxNum) maxNum = num;
      });
    }
    const newFacultyId = `FAC${String(maxNum + 1).padStart(3, '0')}`;

    // 1. Create the new Faculty member
    const { data: newFaculty, error: createError } = await supabase
      .from('faculty')
      .insert({
        faculty_id: newFacultyId,
        canonical_name: newName,
        email: newEmail,
        phone: fullPhone,
        alt_email: newAltEmail || null,
        country: newCountry || null,
        is_active: true,
        is_faculty: true
      })
      .select('id')
      .single();

    if (createError || !newFaculty) {
      setError("Error creating faculty: " + createError?.message);
      setIsSaving(false);
      return;
    }

    // 2. Assign them to the topic
    const { error: linkError } = await supabase.from('faculty_topics').insert({
      faculty_id: newFaculty.id,
      topic_id: topic.id,
      role: 'Faculty'
    });

    if (linkError) {
      setError("Faculty created, but failed to link to topic: " + linkError.message);
      setIsSaving(false);
      return;
    }

    setIsSaving(false);
    onSaved();
    onClose();
  }

  return (
    <Modal
      title="Assign a speaker"
      subtitle={topic.topic_title}
      size="md"
      busy={isSaving}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose} disabled={isSaving}>Cancel</Button>
          {mode === 'search' ? (
            <Button variant="primary" onClick={handleAssign} busy={isSaving} disabled={!selectedFaculty}>
              {isSaving ? 'Saving…' : 'Assign selected person'}
            </Button>
          ) : (
            <Button
              variant="primary"
              type="submit"
              form="create-faculty-form"
              busy={isSaving}
              disabled={!newName || !newEmail || !phoneNumber}
            >
              {isSaving ? 'Creating…' : 'Create and assign'}
            </Button>
          )}
        </>
      }
    >
      <Tabs
        label="How to find the speaker"
        idPrefix="assigntab"
        items={[
          { key: 'search' as const, label: 'Find existing faculty' },
          { key: 'create' as const, label: 'Add a new person' },
        ]}
        value={mode}
        onChange={(k) => { setMode(k); setError(null); }}
      />

      <div id={`assigntab-panel-${mode}`} role="tabpanel" aria-labelledby={`assigntab-${mode}`}>
        {mode === 'search' ? (
          <div>
            <label htmlFor="assign-search" className="mb-1.5 block text-sm font-medium text-ink">Search by name or email</label>
            <div className="relative">
              <input
                id="assign-search"
                type="search"
                placeholder="Type a name or email"
                className={inputCls}
                value={searchFaculty}
                onChange={(e) => setSearchFaculty(e.target.value)}
              />

              {searchFaculty.length > 0 && !selectedFaculty && (
                <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-line bg-white shadow-pop">
                  {filteredFaculty.length === 0 ? (
                    <p className="p-3 text-sm text-ink-2">No faculty found. Use “Add a new person” instead.</p>
                  ) : (
                    filteredFaculty.map(f => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => { setSelectedFaculty(f); setSearchFaculty(''); }}
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

            {selectedFaculty && (
              <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-indigo-200 bg-accent-tint p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{selectedFaculty.canonical_name}</p>
                  <p className="truncate text-xs text-ink-2">{selectedFaculty.email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedFaculty(null)}
                  aria-label={`Remove ${selectedFaculty.canonical_name}`}
                  title="Remove"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-2 transition-colors hover:bg-danger hover:text-white"
                >
                  <CloseIcon width={20} height={20} strokeWidth={2.25} />
                </button>
              </div>
            )}
            <p className="mt-3 text-sm text-ink-2">The person is added to this topic as a speaker. You can change their role later in Edit topic.</p>
          </div>
        ) : (
          <form id="create-faculty-form" onSubmit={handleCreateAndAssign} className="space-y-4">
            <Field label="Full name" required>
              {(p) => (
                <input {...p} type="text" placeholder="e.g. Dr. John Doe" className={inputCls} value={newName} onChange={(e) => setNewName(e.target.value)} />
              )}
            </Field>

            <Field label="Email" required>
              {(p) => (
                <input {...p} type="email" placeholder="john@example.com" className={inputCls} value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
              )}
            </Field>

            <div>
              <span className="mb-1.5 block text-sm font-medium text-ink">Phone <span className="font-normal text-muted">(required)</span></span>
              <div className="flex gap-2">
                <label className="sr-only" htmlFor="assign-code">Country code</label>
                <select
                  id="assign-code"
                  className={`${inputCls} w-44 shrink-0`}
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                >
                  {COUNTRY_CODES.map(c => (
                    <option key={c.code} value={c.code}>{c.country} ({c.code})</option>
                  ))}
                </select>
                <label className="sr-only" htmlFor="assign-phone">Phone number</label>
                <input
                  id="assign-phone"
                  type="tel"
                  required
                  placeholder="98765 43210"
                  className={inputCls}
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Alternative email">
                {(p) => (
                  <input {...p} type="email" placeholder="alt@example.com" className={inputCls} value={newAltEmail} onChange={(e) => setNewAltEmail(e.target.value)} />
                )}
              </Field>
              <Field label="Country">
                {(p) => (
                  <input {...p} type="text" placeholder="e.g. IN" className={inputCls} value={newCountry} onChange={(e) => setNewCountry(e.target.value)} />
                )}
              </Field>
            </div>
          </form>
        )}
      </div>

      {error && <Notice tone="danger" className="mt-4">{error}</Notice>}
    </Modal>
  );
}
