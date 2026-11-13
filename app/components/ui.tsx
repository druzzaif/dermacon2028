// Shared design system: one place for buttons, page layout, cards, tabs,
// messages, empty states and loading placeholders. Presentation only: nothing
// in this file reads or writes data.

import type { ButtonHTMLAttributes, KeyboardEvent, ReactNode } from 'react';
import { AlertIcon, CheckIcon } from './Icons';

/* ------------------------------ Buttons ------------------------------ */

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger' | 'danger-quiet';
export type ButtonSize = 'md' | 'sm';

const buttonBase =
  'inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50';

const buttonSizes: Record<ButtonSize, string> = {
  md: 'h-11 px-4 text-sm',
  sm: 'h-9 px-3 text-sm',
};

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-white shadow-sm hover:bg-accent-strong',
  secondary: 'border border-field bg-white text-ink hover:bg-slate-50',
  quiet: 'text-accent hover:bg-accent-tint',
  danger: 'bg-danger text-white shadow-sm hover:bg-danger-strong',
  'danger-quiet': 'text-danger hover:bg-danger-tint',
};

/** Class string for anything that should look like a button (links, labels). */
export function buttonCls(variant: ButtonVariant = 'secondary', size: ButtonSize = 'md', extra = '') {
  return `${buttonBase} ${buttonSizes[size]} ${buttonVariants[variant]} ${extra}`.trim();
}

export function Button({
  variant = 'secondary',
  size = 'md',
  busy = false,
  className = '',
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner and blocks clicks */
  busy?: boolean;
}) {
  return (
    <button type={type} disabled={disabled || busy} className={buttonCls(variant, size, className)} {...rest}>
      {busy && <Spinner />}
      {children}
    </button>
  );
}

/** A person's name that opens their profile when clicked */
export function PersonLink({
  name,
  onOpen,
  className = '',
}: {
  name: ReactNode;
  onOpen: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      title="Open profile"
      className={`rounded text-left font-medium text-ink decoration-accent/50 underline-offset-2 transition-colors hover:text-accent hover:underline ${className}`}
    >
      {name}
    </button>
  );
}

/* ------------------------------ Loading ------------------------------ */

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width={16}
      height={16}
      fill="none"
      className={`animate-spin ${className}`}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** Centred "working on it" message with a spinner */
export function LoadingBlock({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div role="status" className={`flex items-center justify-center gap-2.5 py-14 text-sm text-ink-2 ${className}`}>
      <Spinner className="text-accent" />
      {children}
    </div>
  );
}

/** Grey placeholder bars shown while a list is loading */
export function SkeletonLines({ rows = 4, className = '' }: { rows?: number; className?: string }) {
  return (
    <div aria-hidden="true" className={`space-y-3 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-6 animate-pulse rounded-md bg-slate-100" />
      ))}
    </div>
  );
}

/* ------------------------------- Layout ------------------------------ */

/** Standard page frame: same width and padding on every screen */
export function PageShell({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-canvas text-ink">
      <main
        id="main-content"
        tabIndex={-1}
        className={`mx-auto w-full ${wide ? 'max-w-7xl' : 'max-w-6xl'} px-4 py-6 outline-none sm:px-8 sm:py-8`}
      >
        {children}
      </main>
    </div>
  );
}

/** Page title, one-line description, and the page's actions on the right */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold text-ink sm:text-[1.75rem]">{title}</h1>
        {description && <p className="mt-1.5 max-w-prose text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5">{actions}</div>}
    </div>
  );
}

/** White panel used for every grouped block of content */
export const cardCls = 'rounded-xl border border-line bg-white shadow-card';

/** Table header row and header cell */
export const theadRowCls = 'border-b border-line bg-slate-50 text-xs uppercase tracking-wide text-muted';
export const thCls = 'px-4 py-3 font-semibold';

/* -------------------------------- Tabs ------------------------------- */

export type TabItem<K extends string> = { key: K; label: ReactNode; count?: number };

/** Underlined tabs. Left/Right/Home/End move between them. */
export function Tabs<K extends string>({
  items,
  value,
  onChange,
  label,
  idPrefix = 'tab',
  className = '',
}: {
  items: TabItem<K>[];
  value: K;
  onChange: (key: K) => void;
  /** Read by screen readers, e.g. "Conflict type" */
  label: string;
  idPrefix?: string;
  className?: string;
}) {
  function onKey(e: KeyboardEvent) {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    const i = items.findIndex((t) => t.key === value);
    const next =
      e.key === 'Home' ? 0
      : e.key === 'End' ? items.length - 1
      : (i + (e.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length;
    onChange(items[next].key);
    document.getElementById(`${idPrefix}-${items[next].key}`)?.focus();
  }
  return (
    <div role="tablist" aria-label={label} onKeyDown={onKey} className={`mb-5 flex gap-1 overflow-x-auto border-b border-line ${className}`}>
      {items.map((t) => {
        const on = t.key === value;
        return (
          <button
            key={t.key}
            id={`${idPrefix}-${t.key}`}
            type="button"
            role="tab"
            aria-selected={on}
            aria-controls={`${idPrefix}-panel-${t.key}`}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(t.key)}
            className={`-mb-px inline-flex h-11 shrink-0 items-center gap-2 border-b-2 px-3.5 text-sm font-medium transition-colors ${
              on ? 'border-accent text-accent' : 'border-transparent text-ink-2 hover:border-field hover:text-ink'
            }`}
          >
            {t.label}
            {typeof t.count === 'number' && (
              <span
                className={`tnum inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold ${
                  on ? 'bg-accent text-white' : 'bg-slate-200 text-ink-2'
                }`}
              >
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------ Messages ----------------------------- */

export type NoticeTone = 'success' | 'warning' | 'danger' | 'info';

const noticeTones: Record<NoticeTone, string> = {
  success: 'border-success-line bg-success-tint text-success',
  warning: 'border-warning-line bg-warning-tint text-warning',
  danger: 'border-danger-line bg-danger-tint text-danger-strong',
  info: 'border-line bg-canvas text-ink',
};

/** Coloured message box. Errors are announced immediately, the rest politely. */
export function Notice({
  tone = 'info',
  title,
  children,
  className = '',
}: {
  tone?: NoticeTone;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={`flex items-start gap-2.5 rounded-lg border p-3 text-sm ${noticeTones[tone]} ${className}`}
    >
      {tone === 'success' ? (
        <CheckIcon className="mt-0.5 shrink-0" width={16} height={16} strokeWidth={2.5} />
      ) : tone === 'info' ? null : (
        <AlertIcon className="mt-0.5 shrink-0" width={16} height={16} />
      )}
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? 'mt-0.5' : ''}>{children}</div>}
      </div>
    </div>
  );
}

/** Shown where a list would be, when there is nothing to list */
export function EmptyState({
  title,
  children,
  action,
  tone = 'neutral',
  className = '',
}: {
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  /** "success" for good news such as "no conflicts" */
  tone?: 'neutral' | 'success';
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center px-6 py-12 text-center ${className}`}>
      {tone === 'success' && (
        <span className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-success-tint text-success ring-1 ring-inset ring-success-line">
          <CheckIcon width={22} height={22} strokeWidth={2.5} />
        </span>
      )}
      <p className="font-semibold text-ink">{title}</p>
      {children && <div className="mt-1 max-w-md text-sm text-ink-2">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
