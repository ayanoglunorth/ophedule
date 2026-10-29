import assert from 'node:assert/strict';
import test from 'node:test';
import { rankTrips, type Member, type Trip } from './recommend.ts';

const members: Member[] = [
  { id: 'a', name: 'Ada', budget: 5000 },
  { id: 'b', name: 'Bora', budget: 3000 },
  { id: 'c', name: 'Cem', budget: null },
];
const availability = [
  { userId: 'a', day: '2026-12-15', status: 'green' as const },
  { userId: 'a', day: '2026-12-16', status: 'yellow' as const },
  { userId: 'b', day: '2026-12-15', status: 'green' as const },
  { userId: 'b', day: '2026-12-16', status: 'green' as const },
  { userId: 'c', day: '2026-12-15', status: 'green' as const },
  { userId: 'c', day: '2026-12-16', status: 'green' as const },
];
const trips: Trip[] = [
  { id: 'cheap', title: 'Uygun gezi', startDay: '2026-12-15', endDay: '2026-12-16', flightCost: 1000, spendCost: 1000, createdAt: 1 },
  { id: 'expensive', title: 'Pahalı gezi', startDay: '2026-12-15', endDay: '2026-12-16', flightCost: 4000, spendCost: 1000, createdAt: 2 },
];

test('ranks eligible people first and explains conditional and budget status', () => {
  const result = rankTrips(trips, members, availability, []);
  assert.equal(result[0].id, 'cheap');
  assert.equal(result[0].eligibleCount, 2);
  assert.equal(result[0].people.find(person => person.id === 'a')?.reason, 'conditional');
  assert.equal(result[0].people.find(person => person.id === 'c')?.reason, 'budgetMissing');
  assert.equal(result[1].people.find(person => person.id === 'b')?.reason, 'overBudget');
});

test('red or missing days and zero interest exclude a member', () => {
  const result = rankTrips([trips[0]], members, [
    ...availability.filter(item => item.userId !== 'a' && !(item.userId === 'b' && item.day === '2026-12-16')),
    { userId: 'a', day: '2026-12-15', status: 'red' as const },
  ], [{ tripId: 'cheap', userId: 'b', score: 0 }]);
  assert.equal(result[0].eligibleCount, 0);
  assert.equal(result[0].people.find(person => person.id === 'a')?.reason, 'red');
  assert.equal(result[0].people.find(person => person.id === 'b')?.reason, 'notInterested');
});

test('unrated interest is neutral and ties prefer stronger interest', () => {
  const alternatives = [trips[0], { ...trips[0], id: 'preferred', createdAt: 2 }];
  const result = rankTrips(alternatives, members.slice(0, 2), availability, [{ tripId: 'preferred', userId: 'b', score: 5 }]);
  assert.equal(result[0].id, 'preferred');
  assert.equal(result[1].interestTotal, 6);
});
