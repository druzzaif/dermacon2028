'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AlertTriangle, CalendarDays, Users } from 'lucide-react';

import { cn } from '@/lib/utils';

const links = [
  { href: '/', label: 'Faculty', icon: Users },
  { href: '/sessions', label: 'Master Schedule', icon: CalendarDays },
  { href: '/overlaps', label: 'Overlaps', icon: AlertTriangle },
];

export default function TopNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 h-(--topbar-h) border-b border-border bg-background">
      <div className="mx-auto flex h-full max-w-screen-2xl items-center gap-8 px-6">
        <Link href="/" className="text-lg font-bold tracking-tight text-primary">
          DERMACON 2028
        </Link>
        <nav aria-label="Main" className="flex h-full items-center gap-1">
          {links.map(({ href, label, icon: Icon }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex h-11 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active
                    ? 'bg-muted text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
