import type { Booking } from '../domain';

export function bookingChatOpen(booking: Pick<Booking, 'status' | 'paid_at' | 'service_ended_at'>) {
  return Boolean(booking.paid_at) && ['accepted', 'en_route', 'arrived'].includes(booking.status) && !booking.service_ended_at;
}
