export function canReadRoom(status: string | null): boolean {
  return status === 'approved';
}

export function canEditAvailability(actorId: string, targetId: string, status: string | null): boolean {
  return canReadRoom(status) && actorId === targetId;
}

export function canEditTrip(actorId: string, creatorId: string, ownerId: string, status: string | null): boolean {
  return canReadRoom(status) && (actorId === creatorId || actorId === ownerId);
}
