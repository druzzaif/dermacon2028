'use client';

import { useCallback, useState } from 'react';
import VenueMap from './VenueMap';
import { Button } from './ui';
import { VENUE_ROOM_LABELS, type VenueRoomId } from '../lib/venueRooms.mjs';

type GuideStop = {
  id: 'registration' | 'preview-room' | VenueRoomId;
  title: string;
  description: string;
};

export default function VenueGuide({
  roomIds,
}: {
  roomIds: readonly VenueRoomId[];
}) {
  const [activeStep, setActiveStep] = useState(0);
  const [mapReady, setMapReady] = useState(false);
  const handleStepSelect = useCallback((step: number) => setActiveStep(step), []);
  const stops: GuideStop[] = [
    { id: 'registration', title: 'Registration', description: 'Collect your badge and conference kit at Registration Hall (Hall 12-A).' },
    { id: 'preview-room', title: 'Preview Room', description: 'Continue to the Preview Room in Hall A for your slide check.' },
    ...roomIds.map((id) => ({
      id,
      title: VENUE_ROOM_LABELS[id],
      description: `Lecture hall: ${VENUE_ROOM_LABELS[id]}.`,
    })),
  ];
  const currentStop = stops[activeStep];

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-3.5rem)] max-w-7xl flex-col gap-4 p-3 sm:p-5">
      <section className="rounded-xl border border-line bg-white p-4 shadow-card sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-ink">DERMACON 2027 venue map</h1>
            <p className="mt-1 text-sm text-ink-2">Explore the venue and choose a destination. The same map link can be shared with every attendee.</p>
          </div>
          <span className="tnum rounded-full bg-accent-tint px-3 py-1 text-sm font-semibold text-accent">
            Stop {activeStep + 1} of {stops.length}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2" aria-label="Route stops">
          {stops.map((stop, index) => (
            <button
              key={`${stop.id}-${index}`}
              type="button"
              onClick={() => setActiveStep(index)}
              aria-current={index === activeStep ? 'step' : undefined}
              className={`min-h-10 rounded-lg border px-3 py-2 text-sm font-medium ${
                index === activeStep
                  ? 'border-accent bg-accent text-white'
                  : 'border-line bg-white text-ink-2 hover:border-accent hover:text-accent'
              }`}
            >
              {index + 1}. {stop.title}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <div aria-live="polite">
            <h2 className="font-semibold text-ink">{currentStop.title}</h2>
            <p className="mt-0.5 text-sm text-ink-2">{currentStop.description}</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              disabled={!mapReady || activeStep === 0}
              onClick={() => setActiveStep((step) => Math.max(0, step - 1))}
            >
              Previous stop
            </Button>
            <Button
              variant="primary"
              disabled={!mapReady || activeStep === stops.length - 1}
              onClick={() => setActiveStep((step) => Math.min(stops.length - 1, step + 1))}
            >
              Next stop
            </Button>
          </div>
        </div>

      </section>

      <VenueMap
        roomIds={roomIds}
        activeStep={activeStep}
        onStepSelect={handleStepSelect}
        onReadyChange={setMapReady}
      />
    </main>
  );
}
