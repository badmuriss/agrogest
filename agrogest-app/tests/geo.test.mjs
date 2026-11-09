import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  closeRing,
  distanceToRingM,
  isSimpleRing,
  openRing,
  outsideRing,
  parseCoordinates,
  pointInRing,
  ringAreaHa,
  ringCentroid,
  ringPerimeterM,
} from '../apps/mobile/src/domain/geo.ts';

// Quadrado de ~1 km de lado perto de Campo Grande (MS): ~100 ha.
const lat = -20.45;
const dLat = 1000 / 111_320;
const dLng = 1000 / (111_320 * Math.cos((lat * Math.PI) / 180));
const square = [[-54.6, lat], [-54.6 + dLng, lat], [-54.6 + dLng, lat + dLat], [-54.6, lat + dLat]];

test('area and perimeter match a 1 km square within 1%', () => {
  const ha = ringAreaHa(closeRing(square));
  assert.ok(Math.abs(ha - 100) < 1, `área ${ha}`);
  const m = ringPerimeterM(square);
  assert.ok(Math.abs(m - 4000) < 40, `perímetro ${m}`);
  // Sentido do desenho não muda a área.
  assert.ok(Math.abs(ringAreaHa([...square].reverse()) - ha) < 1e-9);
});

test('rings open and close without duplicating vertices', () => {
  const closed = closeRing(square);
  assert.equal(closed.length, 5);
  assert.deepEqual(closed[0], closed[4]);
  assert.deepEqual(closeRing(closed), closed);
  assert.equal(openRing(closed).length, 4);
});

test('self-intersecting, degenerate and out-of-range rings are rejected', () => {
  assert.equal(isSimpleRing(square), true);
  const bowtie = [square[0], square[2], square[1], square[3]];
  assert.equal(isSimpleRing(bowtie), false);
  assert.equal(isSimpleRing(square.slice(0, 2)), false);
  assert.equal(isSimpleRing([square[0], square[1], square[1], square[2]]), false);
  assert.equal(isSimpleRing([[0, 0], [1, 0], [0, 91]]), false);
  assert.equal(isSimpleRing([[0, 0], [1, 0], [2, 0]]), false);
});

test('centroid and point-in-polygon work for lot pins', () => {
  const c = ringCentroid(square);
  assert.ok(pointInRing(c, square));
  assert.equal(pointInRing([-54.7, lat], square), false);
});

test('a pasture point on the farm fence is not "outside"; one 50 m beyond it is', () => {
  const onFence = [-54.6 + dLng / 2, lat - 1e-7];
  assert.ok(distanceToRingM(onFence, square) < 0.05);
  assert.equal(outsideRing(onFence, square), false);
  const beyond = [-54.6 - 50 / (111_320 * Math.cos((lat * Math.PI) / 180)), lat + dLat / 2];
  assert.ok(Math.abs(distanceToRingM(beyond, square) - 50) < 0.5);
  assert.equal(outsideRing(beyond, square), true);
});

test('typed coordinates are read as latitude, longitude', () => {
  assert.deepEqual(parseCoordinates('-20.45, -54.6'), [-54.6, -20.45]);
  assert.deepEqual(parseCoordinates('-20,45 -54,6'), [-54.6, -20.45]);
  assert.deepEqual(parseCoordinates(' -19.75;-47.93 '), [-47.93, -19.75]);
  assert.equal(parseCoordinates('Uberaba, MG'), null);
  assert.equal(parseCoordinates('95, 10'), null);
});
