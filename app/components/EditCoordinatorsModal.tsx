'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

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

  // Load all faculty and initialize current coordinators
  useEffect(() => {
    async function loadFaculty() {
      const { data } = await supabase.from('faculty').select('id, canonical_name, email').order('canonical_name');
      if (data) setFacultyList(data);
    }
    loadFaculty();
    // The currentCoordinators prop includes the faculty join, so we can use it directly
    setCoordinators(currentCoordinators);
  }, [currentCoordinators]);

  const filteredFaculty = facultyList.filter(f => 
    f.canonical_name.toLowerCase().includes(searchFaculty.toLowerCase()) ||
    f.email?.toLowerCase().includes(searchFaculty.toLowerCase())
  ).slice(0, 5);

  async function handleAddCoordinator(faculty: any) {
    if (coordinators.find(c => c.faculty_id === faculty.id)) {
      alert("This faculty is already a coordinator for this session.");
      return;
    }
    // Optimistically add to UI
    const newCoord = {
      session_id: session.id,
      faculty_id: faculty.id,
      role: selectedRole,
      faculty: faculty
    };
    setCoordinators([...coordinators, newCoord]);
    setSearchFaculty('');
  }

  async function handleRemoveCoordinator(faculty_id: string) {
    setCoordinators(coordinators.filter(c => c.faculty_id !== faculty_id));
  }

  async function handleSave() {
    setIsSaving(true);

    // 1. Delete all existing coordinators for this session
    await supabase.from('session_coordinators').delete().eq('session_id', session.id);

    // 2. Insert the new list of coordinators
    if (coordinators.length > 0) {
      const payload = coordinators.map(c => ({
        session_id: session.id,
        faculty_id: c.faculty.id || c.faculty_id, // Handle both fresh and existing
        role: c.role
      }));

      const { error } = await supabase.from('session_coordinators').insert(payload);
      
      if (error) {
        alert("Error saving coordinators: " + error.message);
        setIsSaving(false);
        return;
      }
    }

    setIsSaving(false);
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
        <div className="flex justify-between items-center p-5 border-b bg-gray-50">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Edit Coordinators</h2>
            <p className="text-sm text-gray-500">{session.session_code} - {session.session_name}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl">×</button>
        </div>

        <div className="p-6 space-y-6">
          {/* Current Coordinators List */}
          <div>
            <h3 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wider">Current Coordinators</h3>
            {coordinators.length === 0 ? (
              <p className="text-sm text-gray-500 italic bg-gray-50 p-4 rounded-lg border border-gray-200">No coordinators assigned yet.</p>
            ) : (
              <div className="space-y-2">
                {coordinators.map((c, i) => (
                  <div key={i} className="flex items-center justify-between bg-blue-50 border border-blue-200 p-3 rounded-lg">
                    <div>
                      <div className="font-semibold text-blue-900">{c.faculty?.canonical_name}</div>
                      <div className="text-xs font-bold text-blue-700 bg-blue-200 px-2 py-0.5 rounded inline-block mt-1 uppercase">{c.role}</div>
                    </div>
                    <button onClick={() => handleRemoveCoordinator(c.faculty_id || c.faculty.id)} className="text-sm text-red-600 hover:underline font-medium">
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <hr className="border-gray-200" />

          {/* Add New Coordinator */}
          <div>
            <h3 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wider">Add Coordinator</h3>
            
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="col-span-1">
                <label className="block text-xs font-bold text-gray-600 mb-1">Role</label>
                <select 
                  value={selectedRole} 
                  onChange={(e) => setSelectedRole(e.target.value)} 
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                >
                  <option value="National">National</option>
                  <option value="Lead Coordinator">Lead Coordinator</option>
                  <option value="Local">Local</option>
                </select>
              </div>
              <div className="col-span-2 relative">
                <label className="block text-xs font-bold text-gray-600 mb-1">Search Faculty</label>
                <input 
                  type="text" 
                  placeholder="Type name or email..." 
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                  value={searchFaculty}
                  onChange={(e) => setSearchFaculty(e.target.value)}
                />
                
                {/* Search Results Dropdown */}
                {searchFaculty.length > 0 && (
                  <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto mt-1">
                    {filteredFaculty.length === 0 ? (
                      <div className="p-3 text-sm text-gray-500">No faculty found</div>
                    ) : (
                      filteredFaculty.map(f => (
                        <button
                          key={f.id}
                          onClick={() => handleAddCoordinator(f)}
                          className="w-full text-left p-3 border-b border-gray-100 hover:bg-blue-50 text-sm transition-colors"
                        >
                          <div className="font-semibold text-gray-900">{f.canonical_name}</div>
                          <div className="text-xs text-gray-500">{f.email}</div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="p-5 border-t bg-gray-50 flex justify-end gap-3">
          <button onClick={onClose} className="px-5 py-2.5 border border-gray-300 rounded-lg font-medium hover:bg-gray-100 bg-white">Cancel</button>
          <button onClick={handleSave} disabled={isSaving} className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
            {isSaving ? 'Saving...' : 'Save Coordinators'}
          </button>
        </div>
      </div>
    </div>
  );
}
