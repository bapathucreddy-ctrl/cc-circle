import { serveRequest } from '../_shared/http.ts';
import { authenticate, body, handleError, HttpError, json, rateLimit, reconcileOrder, uuid } from '../_shared/payments.ts';

serveRequest(async req => {
  if (req.method === 'OPTIONS') return json({});
  try {
    const input = await body(req);
    const bookingId = uuid(input.booking_id);
    const { admin, user } = await authenticate(req);
    await rateLimit(admin, user.id);
    const { data: booking, error } = await admin.from('bookings').select('id').eq('id', bookingId).eq('client_id', user.id).single();
    if (error || !booking) throw new HttpError(404, 'Booking not found.');
    const { data: order, error: orderError } = await admin.from('payment_orders').select('order_id').eq('booking_id', bookingId).single();
    if (orderError || order.order_id !== input.order_id) throw new HttpError(404, 'Payment order not found.');
    return json({ paid: await reconcileOrder(order.order_id) });
  } catch (error) { return handleError(error); }
});
