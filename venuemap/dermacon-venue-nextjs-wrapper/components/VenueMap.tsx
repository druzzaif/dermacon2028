'use client';

import { useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';

// Requires: npm i three@0.160.0
// Copy lib/dermacon-venue/dermacon-venue.mjs into your app (the built venue library).
// Usage: <VenueMap />  then open /venue?to=hall-b  (or ?to=hall-c-2, ?to=sig-1, ?to=faculty-lounge, ?to=workshop-3 ...)

type Venue = {
  goTo: (id: string | null, opts?: { silent?: boolean }) => unknown;
  dispose: () => void;
};

type Props = {
  /** Used when the URL has no ?to= parameter. */
  defaultHall?: string;
  /** Start point: gate id such as 'gate-g9' (default). */
  start?: string;
  className?: string;
  style?: React.CSSProperties;
};

export default function VenueMap({ defaultHall, start = 'gate-g9', className, style }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const venueRef = useRef<Venue | null>(null);
  const params = useSearchParams();
  const to = params.get('to') ?? defaultHall ?? null;

  // create the 3D venue once, on the client only
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!containerRef.current) return;
      const { createVenue } = await import('@/lib/dermacon-venue/dermacon-venue.mjs');
      if (cancelled || !containerRef.current) return;
      venueRef.current = createVenue(containerRef.current, {
        start,
        destination: to,
        title: ['DERMACON', '2027'],
        subtitle: 'Helipad Exhibition Centre, Gandhinagar · 4–7 Feb 2027',
      }) as Venue;
    })();
    return () => {
      cancelled = true;
      venueRef.current?.dispose();
      venueRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // follow ?to= changes without rebuilding the scene
  useEffect(() => {
    venueRef.current?.goTo(to, { silent: true });
  }, [to]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ position: 'relative', width: '100%', height: '100vh', overflow: 'hidden', ...style }}
    />
  );
}
