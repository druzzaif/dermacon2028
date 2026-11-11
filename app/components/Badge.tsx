import type { ReactNode } from 'react';

export type BadgeTone =
  | 'neutral' | 'accent' | 'success' | 'warning' | 'danger'
  | 'purple' | 'emerald' | 'blue' | 'orange';

// Every pair is >= 4.5:1. Minimum text size is 12px.
const tones: Record<BadgeTone, string> = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
  accent: 'bg-accent-tint text-accent ring-indigo-200',
  success: 'bg-green-100 text-green-800 ring-green-200',
  warning: 'bg-amber-100 text-amber-900 ring-amber-200',
  danger: 'bg-red-100 text-red-800 ring-red-200',
  purple: 'bg-purple-100 text-purple-800 ring-purple-200',
  emerald: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  blue: 'bg-blue-100 text-blue-800 ring-blue-200',
  orange: 'bg-orange-100 text-orange-800 ring-orange-200',
};

export function roleTone(role: string | null | undefined): BadgeTone {
  const r = (role || '').trim().toLowerCase();
  if (r === 'national') return 'purple';
  if (r === 'lead coordinator' || r === 'lead') return 'warning';
  if (r === 'local') return 'emerald';
  if (r === 'faculty') return 'blue';
  if (r === 'chairperson') return 'orange';
  return 'neutral';
}

export default function Badge({
  tone = 'neutral',
  children,
  className = '',
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold leading-5 ring-1 ring-inset ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
