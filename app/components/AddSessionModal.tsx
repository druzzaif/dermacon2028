'use client';

import { useState } from 'react';
import { supabase } from '../supabase';

// Creates a new row in conference_sessions. After saving, the Sessions page
// reloads on the new session (via ?code=) so you can add topics and coordinators.
export default function AddSessionModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (sessionCode: string) => void;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputCls =
    'w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white';

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    const fd = new FormData(e.currentTarget);
    const code = String(fd.get('session_code') || '').trim().toUpperCase();
    const start = String(fd.get('start_time') || '');
    const end = String(fd.get('end_time') || '');

    if (!code) {
      setError('Session code is required (e.g. WS12).');
      setIsSaving(false);
      return;
    }
    if (start && end && end <= start) {
      setError('End time must be after start time.');
      setIsSaving(false);
      return;
    }

    // Session codes must be unique
    const { data: existing, error: dupError } = await supabase
      .from('conference_sessions')
      .select('id')
      .ilike('session_code', code)
      .limit(1);
    if (dupError) {
      setError(dupError.message);
      setIsSaving(false);
      return;
    }
    if (existing && existing.length > 0) {
      setError(`A session with code ${code} already exists.`);
      setIsSaving(false);
      return;
    }

    const { error: insertError } = await supabase.from('conference_sessions').insert({
      session_code: code,
      session_name: String(fd.get('session_name') || '').trim(),
      session_type: String(fd.get('session_type') || 'Workshop'),
      session_date: String(fd.get('session_date') || '') || null,
      hall: String(fd.get('hall') || '').trim() || null,
      start_time: start ? `${start}:00` : null,
      end_time: end ? `${end}:00` : null,
    });

    if (insertError) {
      setError(insertError.message);
      setIsSaving(false);
      return;
    }

    setIsSaving(false);
    onSaved(code);
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
        <div className="flex justify-between items-center p-5 border-b bg-gray-50">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Add Session</h2>
            <p className="text-sm text-gray-500">Create a new session, then add its topics.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-500 hover:text-gray-800 text-2xl">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Code</label>
              <input name="session_code" required placeholder="e.g. WS12" className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-bold text-gray-700 mb-1">Session Name</label>
              <input name="session_name" required className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Type</label>
              <select name="session_type" defaultValue="Workshop" className={inputCls}>
                <option value="MasterClass">MasterClass</option>
                <option value="Workshop">Workshop</option>
                <option value="Plenary">Plenary</option>
                <option value="Panel">Panel</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Hall</label>
              <input name="hall" placeholder="e.g. B1" className={inputCls} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Date</label>
            <input name="session_date" type="date" required className={inputCls} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Start Time</label>
              <input name="start_time" type="time" required className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">End Time</label>
              <input name="end_time" type="time" required className={inputCls} />
            </div>
          </div>

          {error && <p className="text-red-600 text-sm bg-red-50 p-2 rounded">{error}</p>}

          <div className="flex justify-end gap-3 pt-4 border-t mt-6">
            <button type="button" onClick={onClose} className="px-5 py-2.5 border border-gray-300 rounded-lg font-medium hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={isSaving} className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50">
              {isSaving ? 'Saving...' : 'Create Session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
