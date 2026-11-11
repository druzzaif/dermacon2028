'use client';

import { useId, type ReactNode } from 'react';

/** Shared look for text inputs / selects. 44px tall, 3:1 border, global focus ring. */
export const inputCls =
  'block h-11 w-full rounded-lg border border-field bg-white px-3 text-sm text-ink placeholder:text-muted disabled:bg-slate-50 disabled:text-muted';

type ControlProps = {
  id: string;
  required?: boolean;
  'aria-describedby'?: string;
};

/**
 * Connects <label> to its control (WCAG 1.3.1 / 3.3.2).
 * Usage: <Field label="Email" required>{(p) => <input {...p} name="email" className={inputCls} />}</Field>
 */
export default function Field({
  label,
  required,
  hint,
  srOnlyLabel,
  className = '',
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  srOnlyLabel?: boolean;
  className?: string;
  children: (p: ControlProps) => ReactNode;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className={className}>
      <label
        htmlFor={id}
        className={srOnlyLabel ? 'sr-only' : 'mb-1.5 block text-sm font-medium text-ink'}
      >
        {label}
        {required && <span className="font-normal text-muted"> (required)</span>}
      </label>
      {children({ id, required, 'aria-describedby': hintId })}
      {hint && (
        <p id={hintId} className="mt-1.5 text-xs text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}
