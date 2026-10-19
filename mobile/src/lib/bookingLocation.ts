import type { TrackingLocation } from '../domain';

export function latestBookingLocation(bookingId: string, remote: TrackingLocation | null, own: TrackingLocation | null): TrackingLocation | null {
  const candidates = [remote, own].filter((point): point is TrackingLocation =>
    Boolean(point && point.booking_id === bookingId && Number.isFinite(Date.parse(point.updated_at))));
  return candidates.reduce<TrackingLocation | null>((latest, point) =>
    !latest || Date.parse(point.updated_at) > Date.parse(latest.updated_at) ? point : latest, null);
}
