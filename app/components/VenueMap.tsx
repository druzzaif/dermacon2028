'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { VenueRoomId } from '../lib/venueRooms.mjs';

type VenueStart = {
  id: string;
  name: string;
  at: readonly [number, number] | null;
};

type VenueRoom = {
  id: string;
  name: string;
  arrive: readonly [number, number];
};

type VenueInstance = {
  rooms: VenueRoom[];
  starts: VenueStart[];
  goTo: (id: string | null, options?: { from?: string; silent?: boolean }) => unknown;
  dispose: () => void;
};

type RouteStop = { id: 'registration' | 'preview-room' | VenueRoomId };

export default function VenueMap({
  roomIds,
  activeStep,
  onStepSelect,
  onReadyChange,
}: {
  roomIds: readonly VenueRoomId[];
  activeStep: number;
  onStepSelect: (step: number) => void;
  onReadyChange: (ready: boolean) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const venueRef = useRef<VenueInstance | null>(null);
  const activeStepRef = useRef(activeStep);
  const [loadError, setLoadError] = useState('');
  const [ready, setReady] = useState(false);
  const routeStops = useMemo<RouteStop[]>(() => [
    { id: 'registration' },
    { id: 'preview-room' },
    ...roomIds.map((id) => ({ id })),
  ], [roomIds]);

  useEffect(() => {
    activeStepRef.current = activeStep;
  }, [activeStep]);

  useEffect(() => {
    let active = true;
    let instance: VenueInstance | null = null;

    async function loadMap() {
      try {
        const { createVenue } = await import('../lib/dermacon-venue/dermacon-venue.mjs');
        if (!active || !containerRef.current) return;

        instance = createVenue(containerRef.current, {
          start: 'gate-g9',
          destination: 'registration',
          title: ['DERMACON', '2027'],
          subtitle: 'Helipad Exhibition Centre · Gandhinagar · 4–7 Feb 2027',
          onSelect: (room) => {
            if (!active || !room) return;
            const step = routeStops.findIndex((stop) => stop.id === room.id);
            if (step >= 0) {
              onStepSelect(step);
            } else {
              const currentStep = routeStops[activeStepRef.current];
              const previousStop = routeStops[activeStepRef.current - 1];
              if (currentStep) {
                venueRef.current?.goTo(currentStep.id, {
                  from: previousStop?.id ?? 'gate-g9',
                  silent: true,
                });
              }
            }
          },
        });
        venueRef.current = instance;

        const startSelect = containerRef.current.querySelector<HTMLSelectElement>('.dv3-panel select.small');
        const existingStarts = new Set(instance.starts.map((start) => start.id));
        for (const id of new Set(routeStops.map((stop) => stop.id))) {
          if (existingStarts.has(id)) continue;
          const room = instance.rooms.find((candidate) => candidate.id === id);
          if (!room) continue;

          const start: VenueStart = {
            id,
            name: `Previous stop: ${room.name}`,
            at: room.arrive,
          };
          instance.starts.push(start);
          existingStarts.add(id);

          if (startSelect) {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = start.name;
            startSelect.append(option);
          }
        }

        if (active) {
          setReady(true);
          onReadyChange(true);
        }
      } catch (error) {
        if (active) {
          setLoadError(error instanceof Error ? error.message : 'The venue map could not be loaded.');
          setReady(false);
          onReadyChange(false);
        }
      }
    }

    loadMap();
    return () => {
      active = false;
      instance?.dispose();
      venueRef.current = null;
    };
  }, [onReadyChange, onStepSelect, routeStops]);

  useEffect(() => {
    if (!ready || activeStep <= 0) return;
    const destination = routeStops[activeStep];
    const previousStop = routeStops[activeStep - 1];
    if (destination && previousStop) {
      venueRef.current?.goTo(destination.id, { from: previousStop.id, silent: true });
    }
  }, [activeStep, ready, routeStops]);

  return (
    <div className="relative min-h-[65vh] flex-1 overflow-hidden rounded-xl border border-line bg-slate-100">
      <div
        ref={containerRef}
        aria-label="Interactive 3D venue map"
        className="h-full min-h-[65vh] w-full"
      />
      {loadError && (
        <p role="alert" className="absolute inset-x-3 bottom-3 rounded-lg border border-danger-line bg-white p-3 text-sm text-danger-strong shadow-card">
          The interactive venue map could not be loaded: {loadError}
        </p>
      )}
    </div>
  );
}
