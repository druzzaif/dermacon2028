import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildVenueRoutePath,
  collectVenueRooms,
  mapScheduledHall,
  parseUnmappedHallLabels,
  parseVenueRoomIds,
} from './venueRooms.mjs';

test('maps schedule hall labels to the matching layout room', () => {
  assert.equal(mapScheduledHall('1'), 'hall-a');
  assert.equal(mapScheduledHall('Hall B-2'), 'hall-b-2');
  assert.equal(mapScheduledHall('C6'), 'sig-1');
  assert.equal(mapScheduledHall('E-3'), 'workshop-3');
  assert.equal(mapScheduledHall('Workshop Hall E-4'), 'workshop-4');
  assert.equal(mapScheduledHall('SIG/Sister Hall-1'), 'sig-1');
  assert.equal(mapScheduledHall('Hall 10'), null);
});

test('collects unique mapped rooms in schedule order and retains unknown halls', () => {
  assert.deepEqual(
    collectVenueRooms(['B1', 'B2', 'B1', 'Unlisted Hall', null]),
    {
      roomIds: ['hall-b', 'hall-b-2'],
      unmappedHalls: ['Unlisted Hall', 'Hall not assigned'],
    },
  );
});

test('builds a route path for mapped and unmapped scheduled halls', () => {
  assert.deepEqual(buildVenueRoutePath(['Hall B-2', 'Unknown Hall', 'Hall B-2']), {
    path: '/venue',
    roomIds: ['hall-b-2'],
    unmappedHalls: ['Unknown Hall'],
  });
  assert.equal(buildVenueRoutePath([]).path, '/venue');
  assert.equal(buildVenueRoutePath(['Hall A']).path, buildVenueRoutePath(['Hall C-2']).path);
});

test('accepts only known route IDs and sanitizes unmapped labels', () => {
  assert.deepEqual(parseVenueRoomIds(['hall-b,hall-b-2', 'invalid', 'hall-b']), ['hall-b', 'hall-b-2']);
  assert.deepEqual(parseUnmappedHallLabels(['Hall <unsafe>', 'Hall <unsafe>', 'Hall\u0000 3']), [
    'Hall <unsafe>',
    'Hall  3',
  ]);
});
