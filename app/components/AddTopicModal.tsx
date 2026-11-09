'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export default function AddTopicModal({
  session,
  onClose,
  onSaved,
}: {
  session: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [facultyList, setFacultyList] = useState<any[]>([]);
  const [searchFaculty, setSearchFaculty] = useState('');
  const [selectedFaculty, setSelectedFaculty] = useState<any | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load all faculty so we can search them
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
  ).slice(0, 5); // Only show top 5 results

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const topic_title = formData.get('topic_title') as string;
    const sequence_no = parseInt(formData.get('sequence_no') as string) || 1;
    const start_time = formData.get('start_time') as string;
    const end_time = formData.get('end_time') as string;
    const role = formData.get('role') as string;

    // 1. Insert the Topic
    const { data: newTopic, error: topicError } = await supabase
      .from('session_topics')
      .insert({
        session_id: session.id,
        topic_title,
        sequence_no,
        start_time,
        end_time
      })
      .select('id')
      .single();

    if (topicError) {
      setError(topicError.message);
      setIsSaving(false);
      return;
    }

    // 2. Link the Faculty (if one was selected)
    if (selectedFaculty && newTopic) {
      const { error: linkError } = await supabase
        .from('faculty_topics')
        .insert({
          topic_id: newTopic.id,
          faculty_id: selectedFaculty.id,
          role: role
        });
      
      if (linkError) {
        setError(linkError.message);
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
            <h2 className="text-xl font-bold text-gray-900">Add Topic</h2>
            <p className="text-sm text-gray-500">{session.session_code} - {session.session_name}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Topic Title</label>
            <input name="topic_title" required className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="e.g., Anatomy Discussion" />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Seq No.</label>
              <input name="sequence_no" type="number" required defaultValue={1} className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Start Time</label>
              <input name="start_time" type="time" required className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">End Time</label>
              <input name="end_time" type="time" required className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
            </div>
          </div>

          <hr className="my-4 border-gray-200" />

          <div className="relative">
            <label className="block text-sm font-bold text-gray-700 mb-1">Assign Faculty (Optional)</label>
            <input 
              type="text" 
              placeholder="Type to search by name or email..." 
              className="w-full border border-gray-300 rounded-lg px-4 py-2 mb-2 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              value={searchFaculty}
              onChange={(e) => setSearchFaculty(e.target.value)}
            />
            
            {/* Show search results */}
            {searchFaculty.length > 0 && !selectedFaculty && (
              <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {filteredFaculty.length === 0 ? (
                  <div className="p-4 text-sm text-gray-500">No faculty found</div>
                ) : (
                  filteredFaculty.map(f => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => {
                        setSelectedFaculty(f);
                        setSearchFaculty('');
                      }}
                      className="w-full text-left p-3 border-b border-gray-100 hover:bg-blue-50 text-sm transition-colors"
                    >
                      <div className="font-semibold text-gray-900">{f.canonical_name}</div>
                      <div className="text-xs text-gray-500">{f.email}</div>
                    </button>
                  ))
                )}
              </div>
            )}

            {/* Show selected faculty */}
            {selectedFaculty && (
              <div className="flex items-center justify-between bg-blue-50 border border-blue-200 p-3 rounded-lg">
                <div>
                  <div className="font-semibold text-blue-900">{selectedFaculty.canonical_name}</div>
                  <div className="text-xs text-blue-700">{selectedFaculty.email}</div>
                </div>
                <button type="button" onClick={() => setSelectedFaculty(null)} className="text-sm text-red-600 hover:underline font-medium">
                  Remove
                </button>
              </div>
            )}

            {selectedFaculty && (
              <div className="mt-3">
                <label className="block text-sm font-bold text-gray-700 mb-1">Role</label>
                <select name="role" className="w-full border border-gray-300 rounded-lg px-4 py-2 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none">
                  <option value="Faculty">Faculty</option>
                  <option value="Panel">Panel</option>
                  <option value="Moderator">Moderator</option>
                  <option value="Coordinator">Coordinator</option>
                </select>
              </div>
            )}
          </div>

          {error && <p className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</p>}

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 mt-6">
            <button type="button" onClick={onClose} className="px-5 py-2.5 border border-gray-300 rounded-lg font-medium hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={isSaving} className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
              {isSaving ? 'Saving...' : 'Save Topic'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
