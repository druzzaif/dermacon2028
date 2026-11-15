export type VenueRoom = {
  id: string;
  name: string;
  arrive: readonly [number, number];
};

export type VenueStart = {
  id: string;
  name: string;
  at: readonly [number, number] | null;
};

export type VenueInstance = {
  rooms: VenueRoom[];
  starts: VenueStart[];
  goTo: (id: string | null, options?: { from?: string; silent?: boolean; keepView?: boolean }) => VenueRoom | null;
  dispose: () => void;
};

export function createVenue(
  container: HTMLElement,
  options?: {
    start?: string;
    destination?: string | null;
    title?: [string, string];
    subtitle?: string;
    onSelect?: (room: VenueRoom | null) => void;
  },
): VenueInstance;
