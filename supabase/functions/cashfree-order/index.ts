import { serveRequest } from '../_shared/http.ts';
import { authenticate, body, cashfree, environment, handleError, HttpError, json, rateLimit, uuid } from '../_shared/payments.ts';

serveRequest(async req => {
  if (req.method === 'OPTIONS') return json({});
  try {
    const input = await body(req);
    const bookingId = uuid(input.booking_id);
    const { admin, user } = await authenticate(req);
    await rateLimit(admin, user.id);
    const { data: booking, error } = await admin.from('bookings').select('*').eq('id', bookingId).eq('client_id', user.id).single();
    if (error || !booking) throw new HttpError(404, 'Booking not found.');
    if (booking.paid_at) return json({ paid: true });
    if (booking.billing_mode === 'hourly' && (booking.status !== 'completed' || !booking.billing_finalised_at)) throw new HttpError(409, 'Your wedding invoice is calculated after end-service OTP verification. Pay after service completion.');
    // Completed unpaid bookings from the previous policy may still settle.
    if (!['accepted', 'en_route', 'arrived', 'completed'].includes(booking.status)) throw new HttpError(409, 'Payment is available after the professional accepts. Pay before the journey and service.');
    const phone = user.phone?.replace(/^\+?91/, '');
    if (!phone || !/^[6-9]\d{9}$/.test(phone)) throw new HttpError(400, 'Verify an Indian mobile number before paying.');
    const env = environment();
    const orderId = `cc_${booking.id}`;
    const { error: insertError } = await admin.from('payment_orders').upsert({ booking_id: booking.id,
      order_id: orderId, amount_paise: booking.amount_paise, environment: env }, { onConflict: 'booking_id', ignoreDuplicates: true });
    if (insertError) throw new HttpError(500, 'Unable to save payment order.');
    const { data: stored, error: storedError } = await admin.from('payment_orders').select('*').eq('booking_id', booking.id).single();
    if (storedError || stored.environment !== env || stored.amount_paise !== booking.amount_paise) throw new HttpError(409, 'Payment order configuration mismatch.');
    let order;
    try {
      order = await cashfree(`/orders/${encodeURIComponent(orderId)}`);
    } catch (e) {
      if (!(e instanceof HttpError) || e.status !== 404) throw e;
      try {
        order = await cashfree('/orders', 'POST', {
          order_id: orderId, order_amount: booking.amount_paise / 100, order_currency: 'INR',
          customer_details: { customer_id: user.id, customer_phone: phone },
          order_meta: { notify_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/cashfree-webhook` },
          order_note: 'Circle booking',
        }, booking.id);
      } catch {
        // A concurrent request or an interrupted response may already have created it.
        order = await cashfree(`/orders/${encodeURIComponent(orderId)}`);
      }
    }
    if (order.order_status === 'PAID') return json({ paid: false, needs_verification: true, order_id: orderId });
    if (order.order_status !== 'ACTIVE' || !order.payment_session_id) throw new HttpError(409, 'This payment session has expired. Contact support for a new session.');
    return json({ order_id: orderId, payment_session_id: order.payment_session_id, environment: env });
  } catch (error) { return handleError(error); }
});
