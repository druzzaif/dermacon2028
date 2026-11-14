'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeftIcon } from './Icons';

export default function BackButton() {
  const router = useRouter();

  function goBack() {
    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.push('/sessions');
  }

  return (
    <button
      type="button"
      onClick={goBack}
      aria-label="Go back"
      title="Go back"
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-white/20 bg-white/10 text-slate-200 transition-colors hover:bg-white/20 sm:w-auto sm:px-2.5"
    >
      <ArrowLeftIcon />
      <span className="hidden text-sm font-medium sm:inline">Back</span>
    </button>
  );
}
