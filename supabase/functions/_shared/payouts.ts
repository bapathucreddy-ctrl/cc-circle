import { environment, HttpError } from './payments.ts';

export async function payouts(path: string, method = 'GET', payload?: unknown) {
  const id = Deno.env.get('CASHFREE_PAYOUT_CLIENT_ID'), secret = Deno.env.get('CASHFREE_PAYOUT_CLIENT_SECRET');
  if (!id || !secret) throw new HttpError(503, 'Payouts are not configured.');
  const base = environment() === 'production' ? 'https://api.cashfree.com/payout' : 'https://sandbox.cashfree.com/payout';
  const response = await fetch(`${base}${path}`, { method, signal: AbortSignal.timeout(15000),
    headers: { 'Content-Type': 'application/json', 'x-client-id': id, 'x-client-secret': secret,
      'x-api-version': '2024-01-01', 'x-request-id': crypto.randomUUID() }, ...(payload ? { body: JSON.stringify(payload) } : {}),
  });
  if (!response.ok) throw new HttpError(response.status === 404 ? 404 : 502, 'Unable to communicate with the payout provider.');
  return await response.json();
}
export async function requireWorker(req: Request) {
  if (req.method !== 'POST') throw new HttpError(405, 'Use POST.');
  const expected = Deno.env.get('CASHFREE_WORKER_SECRET');
  const supplied = req.headers.get('Authorization')?.replace(/^Bearer /, '');
  if (!expected || expected.length < 32 || !supplied) throw new HttpError(401, 'Unauthorized.');
  const hash = async (value: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
  const left = await hash(expected), right = await hash(supplied);
  let difference = 0; for (let i = 0; i < left.length; i++) difference |= left[i]! ^ right[i]!;
  if (difference) throw new HttpError(401, 'Unauthorized.');
}
