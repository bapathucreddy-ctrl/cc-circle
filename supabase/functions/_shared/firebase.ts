type ServiceAccount = { project_id: string; client_email: string; private_key: string };
let cached: { token: string; expiresAt: number } | undefined;
const encode = (value: Uint8Array) => btoa(String.fromCharCode(...value)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
const part = (value: unknown) => encode(new TextEncoder().encode(JSON.stringify(value)));
export function firebaseAccount(raw: string): ServiceAccount {
  const account = JSON.parse(raw);
  if (!/^[a-z0-9-]+$/.test(account.project_id) || typeof account.client_email !== 'string' || !account.client_email.endsWith('.iam.gserviceaccount.com') || typeof account.private_key !== 'string') throw new Error('Invalid Firebase configuration');
  return account;
}
export async function firebaseAccessToken(account: ServiceAccount) {
  if (cached && cached.expiresAt > Date.now() + 60000) return cached.token;
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${part({ alg: 'RS256', typ: 'JWT' })}.${part({ iss: account.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })}`;
  const pem = account.private_key.replace(/-----[^-]+-----|\s/g, '');
  const key = await crypto.subtle.importKey('pkcs8', Uint8Array.from(atob(pem), c => c.charCodeAt(0)), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${encode(new Uint8Array(signature))}` }), signal: AbortSignal.timeout(10000) });
  const body = await response.json();
  if (!response.ok || typeof body.access_token !== 'string') throw new Error('Firebase authentication unavailable');
  cached = { token: body.access_token, expiresAt: Date.now() + Math.min(Number(body.expires_in) || 3600, 3600) * 1000 };
  return cached.token;
}
export function firebaseMessage(token: string, notificationId: string, title: string) {
  return { message: { token, notification: { title: `Circle · ${title}`, body: 'Open Circle for the latest update.' }, data: { notification_id: notificationId }, android: { priority: 'high', ttl: '3600s', notification: { channel_id: 'circle-activity', tag: notificationId, visibility: 'PRIVATE', default_sound: true } } } };
}
export function firebaseResult(status: number, body: { error?: { details?: { errorCode?: string }[] } }): 'sent' | 'invalid' | 'retry' | 'failed' {
  if (status >= 200 && status < 300) return 'sent';
  if (body.error?.details?.some(detail => detail.errorCode === 'UNREGISTERED')) return 'invalid';
  // INVALID_ARGUMENT may indicate a payload error; never delete a valid device for it.
  return status === 429 || status >= 500 || status === 401 || status === 403 ? 'retry' : 'failed';
}
