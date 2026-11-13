'use client';

import { useState } from 'react';
import Modal from './Modal';
import { Button, Notice } from './ui';

/** Asks "are you sure?" before something is deleted or removed. */
export default function ConfirmDeleteDialog({
  title,
  description,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  busyLabel = 'Deleting...',
  onConfirm,
  onCancel,
}: {
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  busyLabel?: string;
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err: any) {
      setError(err?.message || 'Delete failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={title}
      size="sm"
      busy={busy}
      onClose={onCancel}
      footer={
        <>
          <Button onClick={onCancel} disabled={busy}>{cancelLabel}</Button>
          <Button variant="danger" onClick={handleConfirm} busy={busy}>
            {busy ? busyLabel : confirmLabel}
          </Button>
        </>
      }
    >
      <div className="text-sm text-ink-2">{description}</div>
      {error && <Notice tone="danger" className="mt-3">{error}</Notice>}
    </Modal>
  );
}
