import type { Booking } from '../domain';

export function customerActivity(bookings: Booking[], reviewed: ReadonlySet<string> | null) {
  const active = bookings.filter(booking => ['requested', 'accepted', 'en_route', 'arrived'].includes(booking.status));
  const priority = (booking: Booking) => booking.status === 'en_route' || booking.status === 'arrived' ? 0 : booking.status === 'accepted' ? 1 : 2;
  active.sort((a, b) => priority(a) - priority(b) || new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
  // Unknown review state must never resurrect a completed booking reminder.
  return active[0] || bookings.find(booking=>booking.status==='completed'&&booking.billing_mode==='hourly'&&!booking.paid_at) || (reviewed ? bookings.find(booking => booking.status === 'completed' && !reviewed.has(booking.id)) : null) || null;
}
