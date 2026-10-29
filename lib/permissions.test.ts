import assert from 'node:assert/strict';
import test from 'node:test';
import { canReadRoom, canEditTrip, canEditAvailability } from './permissions.ts';

test('only approved members read rooms', () => {
  assert.equal(canReadRoom('approved'), true);
  assert.equal(canReadRoom('pending'), false);
  assert.equal(canReadRoom(null), false);
});

test('members edit only their availability and trips, owners can remove trips', () => {
  assert.equal(canEditAvailability('a', 'a', 'approved'), true);
  assert.equal(canEditAvailability('a', 'b', 'approved'), false);
  assert.equal(canEditAvailability('a', 'a', 'pending'), false);
  assert.equal(canEditTrip('a', 'a', 'b', 'approved'), true);
  assert.equal(canEditTrip('a', 'b', 'a', 'approved'), true);
  assert.equal(canEditTrip('a', 'b', 'c', 'approved'), false);
});
