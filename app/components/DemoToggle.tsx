'use client';

import { MODE_COOKIE, type AppMode } from '../lib/mode';

// Header switch between your real data and the dummy "demo" data.
// Demo edits are saved in a separate database schema, so switching back
// always shows the original data untouched.
export default function DemoToggle({ mode }: { mode: AppMode }) {
  const demo = mode === 'demo';
  function toggle() {
    const next: AppMode = demo ? 'live' : 'demo';
    document.cookie = `${MODE_COOKIE}=${next}; path=/; max-age=31536000; SameSite=Lax`;
    window.location.reload();
  }
  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={demo}
      title={demo ? 'Back to your real data' : 'Show dummy faculty names for presentations'}
      className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3 text-xs font-semibold transition-colors ${
        demo
          ? 'border-amber-300 bg-amber-400 text-slate-900 hover:bg-amber-300'
          : 'border-white/20 bg-white/10 text-slate-200 hover:bg-white/20'
      }`}
    >
      <span aria-hidden="true" className={`h-2 w-2 rounded-full ${demo ? 'bg-slate-900' : 'bg-slate-400'}`} />
      {demo ? <>Demo mode ON<span className="hidden lg:inline"> — exit</span></> : 'Demo mode'}
    </button>
  );
}
