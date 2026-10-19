export type ApnsAccount = { keyId: string; teamId: string; privateKey: string };
export type ApnsEnvironment = 'sandbox' | 'production';
let cached: { identity: string; token: string; expiresAt: number } | undefined;
const encode = (value: Uint8Array) => btoa(String.fromCharCode(...value)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
const part = (value: unknown) => encode(new TextEncoder().encode(JSON.stringify(value)));
export function apnsAccount(keyId: string, teamId: string, privateKey: string): ApnsAccount {
  if (!/^[A-Z0-9]{10}$/.test(keyId) || !/^[A-Z0-9]{10}$/.test(teamId) || !privateKey.includes('-----BEGIN PRIVATE KEY-----')) throw new Error('Invalid APNs configuration');
  return { keyId, teamId, privateKey };
}
export async function apnsAuthorization(account: ApnsAccount) {
  const identity = account.keyId + ':' + account.teamId;
  if (cached?.identity === identity && cached.expiresAt > Date.now()) return cached.token;
  const unsigned = part({ alg: 'ES256', kid: account.keyId }) + '.' + part({ iss: account.teamId, iat: Math.floor(Date.now() / 1000) });
  const pem = account.privateKey.replace(/-----[^-]+-----|\s/g, '');
  const key = await crypto.subtle.importKey('pkcs8', Uint8Array.from(atob(pem), c => c.charCodeAt(0)), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const signature = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(unsigned)));
  if (signature.length !== 64) throw new Error('Invalid APNs signature');
  const token = unsigned + '.' + encode(signature);
  cached = { identity, token, expiresAt: Date.now() + 50 * 60000 };
  return token;
}
export function apnsRequest(token: string, environment: ApnsEnvironment, variant: string, notificationId: string, title: string, authorization: string) {
  if (!/^[a-f0-9]{32,512}$/i.test(token) || token.length % 2 || !['sandbox', 'production'].includes(environment) || !['customer', 'professional'].includes(variant)) throw new Error('Invalid APNs device');
  return {
    url: `https://${environment === 'sandbox' ? 'api.sandbox.push.apple.com' : 'api.push.apple.com'}/3/device/${token}`,
    options: {
      method: 'POST',
      headers: { authorization: `bearer ${authorization}`, 'content-type': 'application/json', 'apns-topic': `com.cccircle.${variant}`, 'apns-push-type': 'alert', 'apns-priority': '10', 'apns-expiration': String(Math.floor(Date.now() / 1000) + 3600), 'apns-collapse-id': notificationId },
      body: JSON.stringify({ aps: { alert: { title: `Circle · ${title}`, body: 'Open Circle for the latest update.' }, sound: 'default' }, notification_id: notificationId }),
      signal: AbortSignal.timeout(10000),
    },
  };
}
export function apnsResult(status: number, reason?: string): 'sent' | 'invalid' | 'retry' | 'failed' {
  if (status >= 200 && status < 300) return 'sent';
  if (status === 410 && reason === 'Unregistered') return 'invalid';
  if (reason === 'ExpiredProviderToken') cached = undefined;
  // BadDeviceToken can mean an environment/topic mismatch: preserve the device.
  return status === 429 || status >= 500 || status === 401 || status === 403 ? 'retry' : 'failed';
}
