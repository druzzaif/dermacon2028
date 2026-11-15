export const VENUE_ROOM_LABELS = Object.freeze({
  'hall-a': 'HALL A',
  'hall-b': 'HALL B-1',
  'hall-b-2': 'HALL B-2',
  'hall-b-3': 'HALL B-3',
  'hall-c': 'HALL C-1',
  'hall-c-2': 'HALL C-2',
  'hall-c-3': 'HALL C-3',
  'international-hall': 'INTERNATIONAL HALL',
  'sig-1': 'SIG / SISTER HALL 1',
  'sig-2': 'SIG / SISTER HALL 2',
  'sig-3': 'SIG / SISTER HALL 3',
  'industries-1': 'INDUSTRIES MEETING HALL 1',
  'industries-2': 'INDUSTRIES MEETING HALL 2',
  'industries-3': 'INDUSTRIES MEETING HALL 3',
  'ec-hall': 'EC HALL',
  'iadvl-hall': 'IADVL HALL',
  'workshop-1': 'WORKSHOP HALL E-1',
  'workshop-2': 'WORKSHOP HALL E-2',
  'workshop-3': 'WORKSHOP HALL E-3',
  'workshop-4': 'WORKSHOP HALL E-4',
  'workshop-5': 'WORKSHOP HALL E-5',
  'workshop-6': 'WORKSHOP HALL E-6',
});

export const VENUE_ROOM_IDS = Object.freeze(Object.keys(VENUE_ROOM_LABELS));
export const SHARED_VENUE_MAP_PATH = '/venue';

const SESSION_HALL_TO_ROOM = new Map([
  ['1', 'hall-a'], ['a', 'hall-a'], ['halla', 'hall-a'], ['hall1', 'hall-a'], ['halla1', 'hall-a'], ['plenary', 'hall-a'],
  ['b', 'hall-b'], ['b1', 'hall-b'], ['hallb', 'hall-b'], ['hallb1', 'hall-b'],
  ['b2', 'hall-b-2'], ['hallb2', 'hall-b-2'],
  ['b3', 'hall-b-3'], ['hallb3', 'hall-b-3'],
  ['c', 'hall-c'], ['c1', 'hall-c'], ['hallc', 'hall-c'], ['hallc1', 'hall-c'],
  ['c2', 'hall-c-2'], ['hallc2', 'hall-c-2'],
  ['c3', 'hall-c-3'], ['hallc3', 'hall-c-3'],
  ['c4', 'sig-3'], ['sig3', 'sig-3'], ['sighall3', 'sig-3'], ['sisterhall3', 'sig-3'], ['sigsisterhall3', 'sig-3'],
  ['c5', 'sig-2'], ['sig2', 'sig-2'], ['sighall2', 'sig-2'], ['sisterhall2', 'sig-2'], ['sigsisterhall2', 'sig-2'],
  ['c6', 'sig-1'], ['sig1', 'sig-1'], ['sighall1', 'sig-1'], ['sisterhall1', 'sig-1'], ['sigsisterhall1', 'sig-1'],
  ['c7', 'international-hall'], ['internationalhall', 'international-hall'],
  ['b4', 'industries-3'], ['industries3', 'industries-3'], ['industriesmeetinghall3', 'industries-3'],
  ['b5', 'industries-2'], ['industries2', 'industries-2'], ['industriesmeetinghall2', 'industries-2'],
  ['b6', 'industries-1'], ['industries1', 'industries-1'], ['industriesmeetinghall1', 'industries-1'],
  ['b7', 'iadvl-hall'], ['iadvl', 'iadvl-hall'], ['iadvlhall', 'iadvl-hall'],
  ['b8', 'ec-hall'], ['ec', 'ec-hall'], ['eci', 'ec-hall'], ['echall', 'ec-hall'], ['ecihall', 'ec-hall'],
  ['e1', 'workshop-1'], ['workshop1', 'workshop-1'], ['workshophall1', 'workshop-1'], ['workshophalle1', 'workshop-1'], ['ws1', 'workshop-1'],
  ['e2', 'workshop-2'], ['workshop2', 'workshop-2'], ['workshophall2', 'workshop-2'], ['workshophalle2', 'workshop-2'], ['ws2', 'workshop-2'],
  ['e3', 'workshop-3'], ['workshop3', 'workshop-3'], ['workshophall3', 'workshop-3'], ['workshophalle3', 'workshop-3'], ['ws3', 'workshop-3'],
  ['e4', 'workshop-4'], ['workshop4', 'workshop-4'], ['workshophall4', 'workshop-4'], ['workshophalle4', 'workshop-4'], ['ws4', 'workshop-4'],
  ['e5', 'workshop-5'], ['workshop5', 'workshop-5'], ['workshophall5', 'workshop-5'], ['workshophalle5', 'workshop-5'], ['ws5', 'workshop-5'],
  ['e6', 'workshop-6'], ['workshop6', 'workshop-6'], ['workshophall6', 'workshop-6'], ['workshophalle6', 'workshop-6'], ['ws6', 'workshop-6'],
]);

const VALID_ROOM_IDS = new Set(Object.keys(VENUE_ROOM_LABELS));

function normalizeHall(hall) {
  return String(hall ?? '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function mapScheduledHall(hall) {
  return SESSION_HALL_TO_ROOM.get(normalizeHall(hall)) ?? null;
}

export function collectVenueRooms(halls) {
  const roomIds = [];
  const unmappedHalls = [];
  const seenRooms = new Set();
  const seenUnmapped = new Set();

  for (const value of halls) {
    const hall = String(value ?? '').trim();
    const roomId = mapScheduledHall(hall);

    if (roomId) {
      if (!seenRooms.has(roomId)) {
        seenRooms.add(roomId);
        roomIds.push(roomId);
      }
      continue;
    }

    const label = hall || 'Hall not assigned';
    if (!seenUnmapped.has(label)) {
      seenUnmapped.add(label);
      unmappedHalls.push(label);
    }
  }

  return { roomIds, unmappedHalls };
}

export function buildVenueRoutePath(halls) {
  const { roomIds, unmappedHalls } = collectVenueRooms(halls);
  return {
    path: SHARED_VENUE_MAP_PATH,
    roomIds,
    unmappedHalls,
  };
}

export function parseVenueRoomIds(raw) {
  const values = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const roomIds = [];
  const seen = new Set();

  for (const value of values) {
    for (const part of String(value).split(',')) {
      const roomId = part.trim();
      if (VALID_ROOM_IDS.has(roomId) && !seen.has(roomId)) {
        seen.add(roomId);
        roomIds.push(roomId);
      }
    }
  }

  return roomIds;
}

export function parseUnmappedHallLabels(raw) {
  const values = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const labels = [];
  const seen = new Set();

  for (const value of values) {
    const label = String(value)
      .replace(/[\u0000-\u001f\u007f]/g, ' ')
      .trim()
      .slice(0, 100);
    if (label && !seen.has(label)) {
      seen.add(label);
      labels.push(label);
    }
  }

  return labels;
}
