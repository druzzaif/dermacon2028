'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Menu names match the title shown on each page
const links = [
  { href: '/sessions', label: 'Sessions' },
  { href: '/faculty', label: 'Faculty' },
  { href: '/emails', label: 'Emails' },
  { href: '/missing', label: 'To-do' },
  { href: '/overlaps', label: 'Conflicts' },
  { href: '/print', label: 'Print' },
  { href: '/backup', label: 'Backup' },
];

export default function NavLinks() {
  const pathname = usePathname() || '';
  return (
    <nav aria-label="Primary" className="ml-3 flex min-w-0 items-center gap-1 overflow-x-auto px-1 sm:ml-8">
      {links.map((l) => {
        const active = pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? 'page' : undefined}
            className={`inline-flex h-9 shrink-0 items-center rounded-md px-3 text-sm font-medium transition-colors ${
              active ? 'bg-white/15 text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
