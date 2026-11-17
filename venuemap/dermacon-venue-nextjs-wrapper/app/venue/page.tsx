import { Suspense } from 'react';
import VenueMap from '@/components/VenueMap';

// Faculty link example: /venue?to=hall-b  -> opens HALL B-1 with the route drawn from the main gate.
export default function VenuePage() {
  return (
    <Suspense fallback={<div style={{ padding: 24 }}>Loading venue…</div>}>
      <VenueMap />
    </Suspense>
  );
}
