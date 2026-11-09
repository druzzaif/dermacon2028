'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

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

    const { error } = await supabase.from('faculty_topics').insert({
      faculty_id: selectedFaculty.id,
      topic_id: topic.id,
      role: 'Faculty'
    });

    if (error) {
      alert("Error assigning faculty: " + error.message);
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
      alert("Error creating faculty: " + createError?.message);
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
      alert("Faculty created, but failed to link to topic: " + linkError.message);
      setIsSaving(false);
      return;
    }

    setIsSaving(false);
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-5 border-b bg-gray-50 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Assign Faculty</h2>
            <p className="text-sm text-gray-500 truncate max-w-[300px]">{topic.topic_title}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl">&times;</button>
        </div>

        <div className="flex border-b border-gray-200 shrink-0">
          <button 
            onClick={() => setMode('search')} 
            className={`flex-1 py-3 font-bold text-sm ${mode === 'search' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            Search Existing
          </button>
          <button 
            onClick={() => setMode('create')} 
            className={`flex-1 py-3 font-bold text-sm ${mode === 'create' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            + Create New
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {mode === 'search' ? (
            <>
              <label className="block text-sm font-bold text-gray-700 mb-2">Search Doctor</label>
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="Type name or email..." 
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 mb-2 focus:outline-none focus:border-blue-500"
                  value={searchFaculty}
                  onChange={(e) => setSearchFaculty(e.target.value)}
                />
                
                {searchFaculty.length > 0 && !selectedFaculty && (
                  <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {filteredFaculty.length === 0 ? (
                      <div className="p-3 text-sm text-gray-500">No faculty found</div>
                    ) : (
                      filteredFaculty.map(f => (
                        <button
                          key={f.id}
                          onClick={() => { setSelectedFaculty(f); setSearchFaculty(''); }}
                          className="w-full text-left p-3 border-b border-gray-100 hover:bg-blue-50 text-sm transition-colors"
                        >
                          <div className="font-semibold text-gray-900">{f.canonical_name}</div>
                          <div className="text-xs text-gray-500">{f.email}</div>
                        </button>
                      ))
                    )}
                  </div>
                )}

                {selectedFaculty && (
                  <div className="flex items-center justify-between bg-blue-50 border border-blue-200 p-3 rounded-lg mt-2">
                    <div>
                      <div className="font-semibold text-blue-900">{selectedFaculty.canonical_name}</div>
                      <div className="text-xs text-blue-700">{selectedFaculty.email}</div>
                    </div>
                    <button onClick={() => setSelectedFaculty(null)} className="text-sm text-red-600 hover:underline">Remove</button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <form id="create-faculty-form" onSubmit={handleCreateAndAssign} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Full Name *</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Dr. John Doe"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Email *</label>
                <input 
                  type="email" 
                  required
                  placeholder="john@example.com"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Phone *</label>
                <div className="flex gap-2">
                  <select 
                    className="w-32 border border-gray-300 rounded-lg px-2 py-2 focus:outline-none focus:border-blue-500 bg-white text-sm"
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                  >
                    {COUNTRY_CODES.map(c => (
                      <option key={c.code} value={c.code}>{c.country} ({c.code})</option>
                    ))}
                  </select>
                  <input 
                    type="tel" 
                    required
                    placeholder="98765 43210"
                    className="flex-1 border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Alt Email (Optional)</label>
                <input 
                  type="email" 
                  placeholder="alt@example.com"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                  value={newAltEmail}
                  onChange={(e) => setNewAltEmail(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Country (Optional)</label>
                <input 
                  type="text" 
                  placeholder="e.g. IN"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
                  value={newCountry}
                  onChange={(e) => setNewCountry(e.target.value)}
                />
              </div>
            </form>
          )}
        </div>

        <div className="p-5 border-t bg-gray-50 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-5 py-2.5 border border-gray-300 rounded-lg font-medium hover:bg-gray-100 bg-white">Cancel</button>
          
          {mode === 'search' ? (
            <button onClick={handleAssign} disabled={isSaving || !selectedFaculty} className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
              {isSaving ? 'Saving...' : 'Assign Existing'}
            </button>
          ) : (
            <button type="submit" form="create-faculty-form" disabled={isSaving || !newName || !newEmail || !phoneNumber} className="px-5 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50">
              {isSaving ? 'Creating...' : 'Create & Assign'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
