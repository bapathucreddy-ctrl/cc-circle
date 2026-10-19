import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import { readLimitedText } from './http.ts';

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
function required(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new HttpError(503, 'Payment service is not configured.');
  return value;
}
export function environment() {
  const value = required('CASHFREE_ENVIRONMENT');
  if (value !== 'sandbox' && value !== 'production') throw new HttpError(503, 'Invalid payment environment.');
  return value;
}
export function adminClient() {
  return createClient(required('SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false, autoRefreshToken: false } });
}
export async function authenticate(req: Request) {
  const token = req.headers.get('Authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) throw new HttpError(401, 'Sign in to continue.');
  const admin = adminClient();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'Your session has expired.');
  let sessionId: string;
  try { sessionId = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).session_id; }
  catch { throw new HttpError(401, 'Your session has expired.'); }
  if (typeof sessionId !== 'string' || !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(sessionId)) throw new HttpError(401, 'Your session has expired.');
  const { data: allowed, error: checkError } = await admin.rpc('app_session_allowed', { p_user_id: data.user.id, p_session_id: sessionId });
  if (checkError) throw new HttpError(503, 'Unable to verify your session. Please try again.');
  if (allowed !== true) throw new HttpError(401, 'You signed in on another device. Please sign in again.');
  return { admin, user: data.user };
}
export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
export async function body(req: Request) {
  if (req.method !== 'POST') throw new HttpError(405, 'Use POST.');
  let raw: string;
  try { raw = await readLimitedText(req, 8192); }
  catch (error) { throw new HttpError(error instanceof Error && error.message === 'body_too_large' ? 413 : 400, 'Invalid or oversized request.'); }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('object_required');
    return parsed as Record<string, unknown>;
  } catch { throw new HttpError(400, 'Invalid request.'); }
}
export function uuid(value: unknown) {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new HttpError(400, 'Invalid booking ID.');
  return value;
}
export async function cashfree(path: string, method = 'GET', payload?: unknown, idempotencyKey?: string) {
  const base = environment() === 'production' ? 'https://api.cashfree.com/pg' : 'https://sandbox.cashfree.com/pg';
  const response = await fetch(`${base}${path}`, {
    method, signal: AbortSignal.timeout(15000), headers: {
      'Content-Type': 'application/json', 'x-client-id': required('CASHFREE_CLIENT_ID'),
      'x-client-secret': required('CASHFREE_CLIENT_SECRET'), 'x-api-version': Deno.env.get('CASHFREE_API_VERSION') || '2025-01-01',
      'x-request-id': crypto.randomUUID(), ...(idempotencyKey ? { 'x-idempotency-key': idempotencyKey } : {}),
    }, ...(payload ? { body: JSON.stringify(payload) } : {}),
  });
  if (!response.ok) {
    // Never return gateway payloads or credentials in a client error.
    throw new HttpError(response.status === 404 ? 404 : 502, 'Unable to communicate with the payment provider.');
  }
  return await response.json();
}
export async function reconcileOrder(orderId: string) {
  const admin = adminClient();
  const { data: local, error } = await admin.from('payment_orders').select('*').eq('order_id', orderId).single();
  if (error || !local) throw new HttpError(404, 'Payment order not found.');
  if (local.environment !== environment()) throw new HttpError(409, 'Payment environment mismatch.');
  if (local.paid_at) return true;
  const { data: booking, error: bookingError } = await admin.from('bookings').select('client_id').eq('id', local.booking_id).single();
  if (bookingError) throw new HttpError(500, 'Unable to verify booking.');
  const order = await cashfree(`/orders/${encodeURIComponent(orderId)}`);
  if (order.order_status !== 'PAID') return false;
  if (order.order_id !== orderId || order.order_currency !== 'INR' || Math.round(Number(order.order_amount) * 100) !== local.amount_paise || order.customer_details?.customer_id !== booking.client_id) throw new HttpError(409, 'Payment order does not match the booking.');
  const payments = await cashfree(`/orders/${encodeURIComponent(orderId)}/payments`);
  if (!Array.isArray(payments)) throw new HttpError(502, 'Unable to verify payment.');
  const payment = payments.find(item => item.payment_status === 'SUCCESS' && item.payment_currency === 'INR' && Math.round(Number(item.payment_amount) * 100) === local.amount_paise);
  if (!payment?.cf_payment_id) return false;
  const { error: confirmError } = await admin.rpc('confirm_payment', { p_order_id: orderId, p_payment_id: String(payment.cf_payment_id), p_amount_paise: local.amount_paise });
  if (confirmError) throw new HttpError(500, 'Payment confirmation is pending.');
  return true;
}
export function handleError(error: unknown) {
  return error instanceof HttpError ? json({ error: error.message }, error.status) : json({ error: 'Unable to complete the payment request.' }, 500);
}
export async function rateLimit(admin: ReturnType<typeof adminClient>, userId: string) {
  const { data, error } = await admin.rpc('claim_payment_operation', { p_user_id: userId });
  if (error) throw new HttpError(503, 'Service is temporarily unavailable.');
  if (!data) throw new HttpError(429, 'Too many requests. Please wait a minute.');
}
