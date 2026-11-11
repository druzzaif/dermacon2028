import type { Metadata } from 'next';
import { Suspense } from 'react';

export const metadata: Metadata = { title: 'Sessions' };

// The page reads ?query params via useSearchParams(), which needs a Suspense
// boundary for the production build to prerender the route.
export default function RouteLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}
