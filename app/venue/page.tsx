import type { Metadata } from 'next';
import VenueGuide from '../components/VenueGuide';
import { VENUE_ROOM_IDS } from '../lib/venueRooms.mjs';

export const metadata: Metadata = {
  title: 'Conference venue map',
  description: 'Explore the DERMACON 2027 conference venue and find registration, the Preview Room, and lecture halls.',
};

export default function VenuePage() {
  return (
    <VenueGuide
      roomIds={VENUE_ROOM_IDS}
    />
  );
}
