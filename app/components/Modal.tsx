'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { CloseIcon } from './Icons';

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

const sizes = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-2xl' } as const;

/**
 * Accessible modal: role="dialog", aria-modal, labelled by its title,
 * focus moves in, is trapped, Esc closes, focus returns to the opener,
 * background scroll is locked. Pass `busy` to block dismissal while saving.
 */
export default function Modal({
  title,
  subtitle,
  onClose,
  busy = false,
  size = 'lg',
  footer,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  busy?: boolean;
  size?: keyof typeof sizes;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const busyRef = useRef(busy);
  useEffect(() => {
    closeRef.current = onClose;
    busyRef.current = busy;
  });

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const opener = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const body = dialog.querySelector<HTMLElement>('[data-modal-body]');
    const first = body?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? dialog).focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (!busyRef.current) {
          e.stopPropagation();
          closeRef.current();
        }
        return;
      }
      if (e.key !== 'Tab' || !dialog) return;
      const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const a = document.activeElement as HTMLElement | null;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (!a || !dialog.contains(a)) {
        e.preventDefault();
        firstEl.focus();
      } else if (e.shiftKey && a === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && a === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      opener?.focus?.();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-[2px] sm:p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`modal-in flex max-h-[92vh] w-full ${sizes[size]} flex-col overflow-hidden rounded-2xl bg-white shadow-pop ring-1 ring-black/5`}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-6 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-semibold text-ink">
              {title}
            </h2>
            {subtitle && <p className="mt-0.5 truncate text-sm text-muted">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Close dialog"
            className="-mr-2 -mt-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-ink-2 transition-colors hover:bg-slate-100 hover:text-ink disabled:opacity-50"
          >
            <CloseIcon width={20} height={20} />
          </button>
        </div>

        <div data-modal-body className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">
          {children}
        </div>

        {footer && (
          <div className="flex shrink-0 flex-wrap justify-end gap-3 border-t border-line bg-canvas px-6 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
