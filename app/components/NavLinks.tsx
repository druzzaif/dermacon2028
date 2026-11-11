'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/faculty', label: 'Faculty' },
  { href: '/sessions', label: 'Sessions' },
  { href: '/overlaps', label: 'Overlaps' },
  { href: '/missing', label: 'Missing data' },
  { href: '/emails', label: 'Emails' },
  { href: '/backup', label: 'Backup' },
];

export default function NavLinks() {
  const pathname = usePathname() || '';
  return (
    <nav aria-label="Primary" className="ml-2 flex min-w-0 items-center gap-0.5 overflow-x-auto sm:ml-6">
      {links.map((l) => {
        const active = pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? 'page' : undefined}
            className={`relative inline-flex h-11 shrink-0 items-center rounded-md px-3 text-sm font-medium transition-colors ${
              active ? 'text-white' : 'text-slate-300 hover:text-white'
            }`}
          >
            {l.label}
            {active && (
              <span aria-hidden="true" className="absolute inset-x-3 bottom-1.5 h-0.5 rounded-full bg-indigo-400" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
