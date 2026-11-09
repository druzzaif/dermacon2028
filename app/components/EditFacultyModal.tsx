'use client';

import { useState, useTransition } from 'react';
import { updateFaculty } from '../actions';

type Faculty = {
  id: string;
  canonical_name: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string | null;
  designation: string | null;
  is_active: boolean | null;
  faculty_id: string | null;
  country: string | null;
  alt_email: string | null;
  sessions_as_faculty: number | null;
  person_type: string | null;
  is_faculty: boolean | null;
  is_coordinator: boolean | null;
  google_confirmed: boolean | null;
  google_form_sync_date: string | null;
  google_email: string | null;
  google_phone: string | null;
  email_sent: boolean | null;
  email_sent_date: string | null;
  reminder_sent: boolean | null;
  whatsapp_sent: boolean | null;
};

export default function EditFacultyModal({
  faculty,
  onClose,
  onSaved,
}: {
  faculty: Faculty;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updateFaculty(formData);
      if (result.success) {
        onSaved();
        onClose();
      } else {
        setError(result.message ?? 'Update failed');
      }
    });
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-5 border-b sticky top-0 bg-white z-10">
          <h2 className="text-xl font-semibold">
            Edit Faculty {faculty.canonical_name ? `— ${faculty.canonical_name}` : ''}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-800 text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form action={handleSubmit} className="p-5 space-y-4">
          <input type="hidden" name="id" value={faculty.id} />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">First name</label>
              <input
                name="first_name"
                defaultValue={faculty.first_name ?? ''}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Last name</label>
              <input
                name="last_name"
                defaultValue={faculty.last_name ?? ''}
                className="w-full border rounded px-3 py-2"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              name="email"
              type="email"
              required
              defaultValue={faculty.email ?? ''}
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Phone</label>
              <input
                name="phone"
                defaultValue={faculty.phone ?? ''}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Country</label>
              <input
                name="country"
                defaultValue={faculty.country ?? ''}
                className="w-full border rounded px-3 py-2"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Designation</label>
            <input
              name="designation"
              defaultValue={faculty.designation ?? ''}
              className="w-full border rounded px-3 py-2"
            />
          </div>

          <div className="flex flex-wrap gap-6 pt-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="is_active" defaultChecked={!!faculty.is_active} />
              Active
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="is_faculty" defaultChecked={!!faculty.is_faculty} />
              Is Faculty
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="is_coordinator" defaultChecked={!!faculty.is_coordinator} />
              Is Coordinator
            </label>
          </div>

          <div className="pt-4 border-t">
            <button
              type="button"
              onClick={() => setShowAdvanced((s) => !s)}
              className="text-sm text-blue-600 hover:underline"
            >
              {showAdvanced ? '▾ Hide advanced fields' : '▸ Show advanced fields'}
            </button>

            {showAdvanced && (
              <div className="mt-4 space-y-4 bg-gray-50 p-4 rounded">
                <p className="text-xs text-gray-500">
                  System / sync fields — normally written by server actions. Only edit if you know what you're doing.
                </p>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Faculty ID</label>
                    <input
                      name="faculty_id"
                      defaultValue={faculty.faculty_id ?? ''}
                      placeholder="e.g. FAC304"
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Person type</label>
                    <input
                      name="person_type"
                      defaultValue={faculty.person_type ?? ''}
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Alt email</label>
                    <input
                      name="alt_email"
                      type="email"
                      defaultValue={faculty.alt_email ?? ''}
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Google email</label>
                    <input
                      name="google_email"
                      type="email"
                      defaultValue={faculty.google_email ?? ''}
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Google phone</label>
                    <input
                      name="google_phone"
                      defaultValue={faculty.google_phone ?? ''}
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Sessions as faculty</label>
                    <input
                      name="sessions_as_faculty"
                      type="number"
                      min={0}
                      defaultValue={faculty.sessions_as_faculty ?? ''}
                      className="w-full border rounded px-3 py-2"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-6">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="google_confirmed" defaultChecked={!!faculty.google_confirmed} />
                    Google confirmed
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="email_sent" defaultChecked={!!faculty.email_sent} />
                    Email sent
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="reminder_sent" defaultChecked={!!faculty.reminder_sent} />
                    Reminder sent
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="whatsapp_sent" defaultChecked={!!faculty.whatsapp_sent} />
                    WhatsApp sent
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs text-gray-500">
                  <div>
                    <div className="font-medium">Google form synced:</div>
                    <div>
                      {faculty.google_form_sync_date
                        ? new Date(faculty.google_form_sync_date).toLocaleString()
                        : '—'}
                    </div>
                  </div>
                  <div>
                    <div className="font-medium">Email sent date:</div>
                    <div>
                      {faculty.email_sent_date
                        ? new Date(faculty.email_sent_date).toLocaleString()
                        : '—'}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {error && (
            <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded p-2">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-2 border rounded hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {isPending ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}