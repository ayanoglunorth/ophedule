export type Member = { id: string; name: string; budget: number | null };
export type Trip = { id: string; title: string; startDay: string; endDay: string; flightCost: number; spendCost: number; createdAt: number };
export type Availability = { userId: string; day: string; status: 'green' | 'yellow' | 'red' };
export type Rating = { tripId: string; userId: string; score: number };
export type PersonResult = Member & { reason: 'available' | 'conditional' | 'notInterested' | 'red' | 'unknown' | 'budgetMissing' | 'overBudget'; interest: number };
export type RankedTrip = Trip & { eligibleCount: number; interestTotal: number; greenCount: number; people: PersonResult[] };

export function daysBetween(start: string, end: string): string[] {
  const days: string[] = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  const last = new Date(`${end}T00:00:00Z`);
  while (cursor <= last && days.length < 190) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

export function rankTrips(trips: Trip[], members: Member[], availability: Availability[], ratings: Rating[]): RankedTrip[] {
  const statuses = new Map(availability.map(item => [`${item.userId}:${item.day}`, item.status]));
  const interest = new Map(ratings.map(item => [`${item.tripId}:${item.userId}`, item.score]));
  return trips.map(trip => {
    const days = daysBetween(trip.startDay, trip.endDay);
    const cost = trip.flightCost + trip.spendCost;
    const people = members.map(member => {
      const score = interest.get(`${trip.id}:${member.id}`) ?? 3;
      const states = days.map(day => statuses.get(`${member.id}:${day}`));
      let reason: PersonResult['reason'];
      if (score === 0) reason = 'notInterested';
      else if (states.includes('red')) reason = 'red';
      else if (states.some(state => !state)) reason = 'unknown';
      else if (member.budget === null) reason = 'budgetMissing';
      else if (member.budget < cost) reason = 'overBudget';
      else reason = states.includes('yellow') ? 'conditional' : 'available';
      return { ...member, reason, interest: score };
    });
    const eligible = people.filter(person => person.reason === 'available' || person.reason === 'conditional');
    return {
      ...trip,
      people,
      eligibleCount: eligible.length,
      interestTotal: eligible.reduce((sum, person) => sum + person.interest, 0),
      greenCount: eligible.filter(person => person.reason === 'available').length,
    };
  }).sort((a, b) => b.eligibleCount - a.eligibleCount || b.interestTotal - a.interestTotal || b.greenCount - a.greenCount || (a.flightCost + a.spendCost) - (b.flightCost + b.spendCost) || a.createdAt - b.createdAt);
}
