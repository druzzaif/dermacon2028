'use client';

import { useState, useTransition } from 'react';
import { updateFaculty } from '../actions';
import Modal from './Modal';
import Field, { inputCls } from './Field';

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

function Check({ name, label, checked }: { name: string; label: string; checked: boolean }) {
  return (
    <label className="flex min-h-11 items-center gap-2.5 text-sm text-ink">
      <input type="checkbox" name={name} defaultChecked={checked} className="h-5 w-5 rounded border-field accent-[var(--color-accent)]" />
      {label}
    </label>
  );
}

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
    <Modal
      title="Edit faculty"
      subtitle={faculty.canonical_name}
      onClose={onClose}
      busy={isPending}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="h-11 rounded-lg border border-field bg-white px-5 text-sm font-medium text-ink hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="edit-faculty-form"
            disabled={isPending}
            className="h-11 rounded-lg bg-accent px-5 text-sm font-medium text-white hover:bg-accent-strong disabled:opacity-50"
          >
            {isPending ? 'Saving…' : 'Save changes'}
          </button>
        </>
      }
    >
      <form id="edit-faculty-form" action={handleSubmit} className="space-y-4">
        <input type="hidden" name="id" value={faculty.id} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="First name">
            {(p) => <input {...p} name="first_name" defaultValue={faculty.first_name ?? ''} className={inputCls} />}
          </Field>
          <Field label="Last name">
            {(p) => <input {...p} name="last_name" defaultValue={faculty.last_name ?? ''} className={inputCls} />}
          </Field>
        </div>

        <Field label="Email" required>
          {(p) => <input {...p} name="email" type="email" defaultValue={faculty.email ?? ''} className={inputCls} />}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone">
            {(p) => <input {...p} name="phone" type="tel" defaultValue={faculty.phone ?? ''} className={inputCls} />}
          </Field>
          <Field label="Country">
            {(p) => <input {...p} name="country" defaultValue={faculty.country ?? ''} className={inputCls} />}
          </Field>
        </div>

        <Field label="Designation">
          {(p) => <input {...p} name="designation" defaultValue={faculty.designation ?? ''} className={inputCls} />}
        </Field>

        <fieldset>
          <legend className="sr-only">Status</legend>
          <div className="flex flex-wrap gap-x-6">
            <Check name="is_active" label="Active" checked={!!faculty.is_active} />
            <Check name="is_faculty" label="Is faculty" checked={!!faculty.is_faculty} />
            <Check name="is_coordinator" label="Is coordinator" checked={!!faculty.is_coordinator} />
          </div>
        </fieldset>

        <div className="border-t border-line pt-4">
          <button
            type="button"
            onClick={() => setShowAdvanced((s) => !s)}
            aria-expanded={showAdvanced}
            aria-controls="faculty-advanced"
            className="inline-flex min-h-11 items-center rounded-lg text-sm font-medium text-accent hover:underline"
          >
            {showAdvanced ? 'Hide advanced fields' : 'Show advanced fields'}
          </button>

          <div id="faculty-advanced" hidden={!showAdvanced}>
            {showAdvanced && (
              <div className="mt-3 space-y-4 rounded-xl bg-canvas p-4">
                <p className="text-sm text-ink-2">
                  System and sync fields, normally written by server actions. Edit only if you know what you are changing.
                </p>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Faculty ID">
                    {(p) => <input {...p} name="faculty_id" defaultValue={faculty.faculty_id ?? ''} placeholder="e.g. FAC304" className={inputCls} />}
                  </Field>
                  <Field label="Person type">
                    {(p) => <input {...p} name="person_type" defaultValue={faculty.person_type ?? ''} className={inputCls} />}
                  </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Alt email">
                    {(p) => <input {...p} name="alt_email" type="email" defaultValue={faculty.alt_email ?? ''} className={inputCls} />}
                  </Field>
                  <Field label="Google email">
                    {(p) => <input {...p} name="google_email" type="email" defaultValue={faculty.google_email ?? ''} className={inputCls} />}
                  </Field>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Google phone">
                    {(p) => <input {...p} name="google_phone" type="tel" defaultValue={faculty.google_phone ?? ''} className={inputCls} />}
                  </Field>
                  <Field label="Sessions as faculty">
                    {(p) => <input {...p} name="sessions_as_faculty" type="number" min={0} defaultValue={faculty.sessions_as_faculty ?? ''} className={inputCls} />}
                  </Field>
                </div>

                <fieldset>
                  <legend className="sr-only">Sync flags</legend>
                  <div className="flex flex-wrap gap-x-6">
                    <Check name="google_confirmed" label="Google confirmed" checked={!!faculty.google_confirmed} />
                    <Check name="email_sent" label="Email sent" checked={!!faculty.email_sent} />
                    <Check name="reminder_sent" label="Reminder sent" checked={!!faculty.reminder_sent} />
                    <Check name="whatsapp_sent" label="WhatsApp sent" checked={!!faculty.whatsapp_sent} />
                  </div>
                </fieldset>

                <dl className="grid grid-cols-2 gap-4 text-sm text-ink-2">
                  <div>
                    <dt className="font-medium text-ink">Google form synced</dt>
                    <dd className="tnum">
                      {faculty.google_form_sync_date ? new Date(faculty.google_form_sync_date).toLocaleString() : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-ink">Email sent</dt>
                    <dd className="tnum">
                      {faculty.email_sent_date ? new Date(faculty.email_sent_date).toLocaleString() : '—'}
                    </dd>
                  </div>
                </dl>
              </div>
            )}
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
