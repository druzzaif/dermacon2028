import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Missing data' };

export default function RouteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
