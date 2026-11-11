import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Sessions' };

export default function RouteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
