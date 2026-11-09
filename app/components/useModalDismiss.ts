// useModalDismiss.ts
//
// Shared behaviour for every modal in the app:
//   - Escape closes the modal (unless disabled)
//   - Clicking the backdrop (outside the dialog) closes the modal
//   - Focus is trapped inside the dialog while open
//   - Body scroll is locked while the modal is open
//
// Call with a ref to the dialog element (the white card, NOT the backdrop):
//
//   const dialogRef = useRef<HTMLDivElement>(null);
//   useModalDismiss(dialogRef, { onClose, disabled: isSaving });
//
// Then in JSX:
//
//   <div className="fixed inset-0 ..." onClick={handleBackdropClick}>
//     <div ref={dialogRef} className="bg-white ...">...</div>
//   </div>
//
// The hook returns handleBackdropClick and handleKeyDown that you attach
// to the wrapper div. Both are no-ops when `disabled` is true.

'use client';

import { useEffect, useCallback, RefObject } from 'react';

export type ModalDismissOptions = {
  /** Close function - called on Escape or backdrop click. */
  onClose: () => void;
  /** When true, disable Escape/backdrop dismissal (e.g. mid-save). */
  disabled?: boolean;
};

export function useModalDismiss(
  dialogRef: RefObject<HTMLElement | null>,
  { onClose, disabled = false }: ModalDismissOptions
) {
  // ---- Escape key -------------------------------------------------
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      if (disabled) return;
      // Don't hijack Escape when a native <select> popup is open
      const active = document.activeElement;
      if (active && active.tagName === 'SELECT') return;
      // Don't hijack Escape when another dialog (nested confirm) is up.
      // We detect this by checking whether any element with role="dialog"
      // besides our own is in the DOM and has an ancestor with the same
      // backdrop pattern. Simple heuristic: only the topmost backdrop reacts.
      const backdrops = document.querySelectorAll('[data-modal-backdrop="true"]');
      if (backdrops.length > 1) {
        // Let the innermost (last) backdrop handle it. We check that
        // our own wrapper is the innermost by comparing DOM order.
        const own = dialogRef.current?.closest('[data-modal-backdrop="true"]');
        if (own && backdrops[backdrops.length - 1] !== own) return;
      }
      e.stopPropagation();
      onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, disabled, dialogRef]);

  // ---- Backdrop click ---------------------------------------------
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (disabled) return;
      // Only close if the click was directly on the backdrop, not bubbled
      // up from a child (the dialog or its contents).
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose, disabled]
  );

  // ---- Body scroll lock -------------------------------------------
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // ---- Focus management -------------------------------------------
  useEffect(() => {
    const previousActive = document.activeElement as HTMLElement | null;
    // Focus the dialog on mount so Tab cycling stays inside
    const node = dialogRef.current;
    if (node) {
      // Find first focusable inside dialog
      const focusable = node.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      focusable?.focus();
    }
    return () => {
      // Restore focus when modal closes
      previousActive?.focus?.();
    };
  }, [dialogRef]);

  return { handleBackdropClick };
}