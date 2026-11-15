export const VENUE_ROOM_LABELS: Readonly<{
  'hall-a': 'HALL A';
  'hall-b': 'HALL B-1';
  'hall-b-2': 'HALL B-2';
  'hall-b-3': 'HALL B-3';
  'hall-c': 'HALL C-1';
  'hall-c-2': 'HALL C-2';
  'hall-c-3': 'HALL C-3';
  'international-hall': 'INTERNATIONAL HALL';
  'sig-1': 'SIG / SISTER HALL 1';
  'sig-2': 'SIG / SISTER HALL 2';
  'sig-3': 'SIG / SISTER HALL 3';
  'industries-1': 'INDUSTRIES MEETING HALL 1';
  'industries-2': 'INDUSTRIES MEETING HALL 2';
  'industries-3': 'INDUSTRIES MEETING HALL 3';
  'ec-hall': 'EC HALL';
  'iadvl-hall': 'IADVL HALL';
  'workshop-1': 'WORKSHOP HALL E-1';
  'workshop-2': 'WORKSHOP HALL E-2';
  'workshop-3': 'WORKSHOP HALL E-3';
  'workshop-4': 'WORKSHOP HALL E-4';
  'workshop-5': 'WORKSHOP HALL E-5';
  'workshop-6': 'WORKSHOP HALL E-6';
}>;

export type VenueRoomId = keyof typeof VENUE_ROOM_LABELS;
export const VENUE_ROOM_IDS: readonly VenueRoomId[];
export const SHARED_VENUE_MAP_PATH: '/venue';

export function mapScheduledHall(hall: string | null | undefined): VenueRoomId | null;
export function collectVenueRooms(halls: readonly (string | null | undefined)[]): {
  roomIds: VenueRoomId[];
  unmappedHalls: string[];
};
export function buildVenueRoutePath(halls: readonly (string | null | undefined)[]): {
  path: string;
  roomIds: VenueRoomId[];
  unmappedHalls: string[];
};
export function parseVenueRoomIds(raw: string | string[] | undefined): VenueRoomId[];
export function parseUnmappedHallLabels(raw: string | string[] | undefined): string[];
