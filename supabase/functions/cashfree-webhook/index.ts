import { serveRequest } from '../_shared/http.ts';
import { handleError, HttpError, json, reconcileOrder } from '../_shared/payments.ts';
import { readLimitedText } from '../_shared/http.ts';

serveRequest(async req => {
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Use POST.');
    const signature = req.headers.get('x-webhook-signature');
    const timestamp = req.headers.get('x-webhook-timestamp');
    const secret = Deno.env.get('CASHFREE_CLIENT_SECRET');
    if (!signature || !timestamp || !secret) throw new HttpError(401, 'Invalid webhook.');
    let raw: string;
    try { raw = await readLimitedText(req, 65536); } catch { throw new HttpError(413, 'Invalid or oversized webhook.'); }
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    let bytes: Uint8Array<ArrayBuffer>;
    try { bytes = Uint8Array.from(atob(signature), c => c.charCodeAt(0)); } catch { throw new HttpError(401, 'Invalid webhook.'); }
    const valid = await crypto.subtle.verify('HMAC', key, bytes, new TextEncoder().encode(timestamp + raw));
    if (!valid) throw new HttpError(401, 'Invalid webhook.');
    const event = JSON.parse(raw);
    if (event.type === 'PAYMENT_SUCCESS_WEBHOOK') {
      const orderId = event.data?.order?.order_id;
      if (typeof orderId !== 'string' || !/^cc_[0-9a-f-]{36}$/i.test(orderId)) throw new HttpError(400, 'Invalid order ID.');
      // Reconfirm using the API. Repeated deliveries are idempotent in Postgres.
      if (!await reconcileOrder(orderId)) throw new HttpError(503, 'Payment is not yet confirmed.');
    }
    return json({ received: true });
  } catch (error) { return handleError(error); }
});
