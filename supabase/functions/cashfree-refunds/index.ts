import { serveRequest } from '../_shared/http.ts';
import { adminClient, cashfree, environment, handleError, HttpError, json } from '../_shared/payments.ts';

// Invoke from a trusted scheduler. Never expose the worker secret in the mobile app.
serveRequest(async req => {
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Use POST.');
    const expected = Deno.env.get('CASHFREE_WORKER_SECRET');
    const supplied = req.headers.get('Authorization')?.replace(/^Bearer /, '');
    if (!expected || !supplied || expected.length < 32) throw new HttpError(401, 'Unauthorized.');
    // Compare hashes to avoid leaking the worker secret through string comparison timing.
    const hash = async (value: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
    const left = await hash(expected), right = await hash(supplied);
    let difference = 0; for (let i = 0; i < left.length; i++) difference |= left[i]! ^ right[i]!;
    if (difference) throw new HttpError(401, 'Unauthorized.');
    const admin = adminClient();
    const { data: requests, error } = await admin.from('refund_requests').select('booking_id,order_id').in('status', ['pending', 'processing']).lte('next_attempt_at', new Date().toISOString()).order('next_attempt_at').limit(2);
    if (error) throw new HttpError(500, 'Unable to load refund requests.');
    const results: { booking_id: string; status: string }[] = [];
    for (const item of requests || []) {
      try {
        const { data: order, error: orderError } = await admin.from('payment_orders').select('*').eq('booking_id', item.booking_id).single();
        const { data: booking, error: bookingError } = await admin.from('bookings').select('status').eq('id', item.booking_id).single();
        if (orderError || bookingError || !order.paid_at || order.environment !== environment() || !['cancelled', 'declined'].includes(booking.status)) throw new Error('Invalid refund state');
        const refundId = `rf_${item.booking_id}`;
        const base = `/orders/${encodeURIComponent(item.order_id)}/refunds`;
        let refund;
        try { refund = await cashfree(`${base}/${encodeURIComponent(refundId)}`); }
        catch (e) {
          if (!(e instanceof HttpError) || e.status !== 404) throw e;
          try { await cashfree(base, 'POST', { refund_id: refundId, refund_amount: order.amount_paise / 100, refund_note: 'Booking cancelled before service', refund_speed: 'STANDARD' }, item.booking_id); }
          catch { /* The first request may have succeeded. Reconcile using the same refund ID. */ }
          refund = await cashfree(`${base}/${encodeURIComponent(refundId)}`);
        }
        if (Array.isArray(refund)) refund = refund.find(row => row.refund_id === refundId);
        if (!refund || refund.refund_id !== refundId || refund.refund_currency !== 'INR' || Math.round(Number(refund.refund_amount) * 100) !== order.amount_paise) throw new Error('Invalid refund response');
        const status = refund.refund_status === 'SUCCESS' ? 'refunded' : refund.refund_status === 'FAILED' || refund.refund_status === 'CANCELLED' ? 'failed' : 'processing';
        const { error: updateError } = await admin.rpc('record_refund_status', { p_booking_id: item.booking_id, p_status: status });
        if (updateError) throw updateError;
        await admin.from('refund_requests').update({ next_attempt_at: new Date(Date.now() + 60000).toISOString() }).eq('booking_id', item.booking_id);
        results.push({ booking_id: item.booking_id, status });
      } catch {
        await admin.from('refund_requests').update({ next_attempt_at: new Date(Date.now() + 300000).toISOString() }).eq('booking_id', item.booking_id);
        results.push({ booking_id: item.booking_id, status: 'retry_pending' });
      }
    }
    return json({ results });
  } catch (error) { return handleError(error); }
});
