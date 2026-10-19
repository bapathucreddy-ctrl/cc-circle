import { serveRequest } from '../_shared/http.ts';
import { adminClient, HttpError } from '../_shared/payments.ts';
import { callbackUrl, crypt, digest, providerJson, secret, type Provider } from '../_shared/portfolio.ts';

serveRequest(async req => {
  const admin = adminClient(); let importId: string | undefined;
  let message = 'Instagram account verified. Return to Circle.'; let succeeded = false;
  try {
    if (req.method !== 'GET') throw new HttpError(405, 'Use GET.');
    const url = new URL(req.url); const state = url.searchParams.get('state');
    if (!state || !/^[a-f0-9]{64}$/.test(state)) throw new HttpError(400, 'Invalid portfolio connection state.');
    const { data: job, error } = await admin.from('portfolio_imports').update({ status: 'processing' }).eq('state_hash', await digest(state)).eq('status', 'pending').gt('expires_at', new Date().toISOString()).select('*').maybeSingle();
    if (error || !job) throw new HttpError(400, 'This portfolio connection has expired or was already used. Start again in Circle.');
    importId = job.id;
    if (url.searchParams.get('error')) throw new HttpError(400, 'Connection was cancelled. Your existing portfolio was kept.');
    const code = url.searchParams.get('code'); if (!code) throw new HttpError(400, 'The provider did not return an authorization code.');
    const provider = job.provider as Provider;
    if (provider !== 'instagram') throw new HttpError(400, 'Use Instagram for account verification. Upload samples in Circle.');
    let token: string; let providerUserId: string; let expires: number;
    if (provider === 'instagram') {
      const form = new URLSearchParams({ client_id: secret('INSTAGRAM_CLIENT_ID'), client_secret: secret('INSTAGRAM_CLIENT_SECRET'), grant_type: 'authorization_code', redirect_uri: callbackUrl(), code });
      const raw = await providerJson('https://api.instagram.com/oauth/access_token', { method: 'POST', body: form }, 'Instagram code exchange');
      const short = raw.data?.[0] || raw;
      if (!short.access_token || !short.user_id) throw new HttpError(502, 'Instagram did not authorize a professional account.');
      const extended = await providerJson(`https://graph.instagram.com/access_token?${new URLSearchParams({ grant_type: 'ig_exchange_token', client_secret: secret('INSTAGRAM_CLIENT_SECRET'), access_token: short.access_token })}`, undefined, 'Instagram token exchange');
      token = extended.access_token; expires = Number(extended.expires_in || 3600);
      if (!token) throw new HttpError(502, 'Instagram did not return account access.');
      const profile = await providerJson(`https://graph.instagram.com/${Deno.env.get('INSTAGRAM_API_VERSION') || 'v25.0'}/me?fields=user_id`, { headers: { Authorization: `Bearer ${token}` } });
      if (!profile.user_id || (typeof profile.user_id === 'number' && !Number.isSafeInteger(profile.user_id)) || !/^[0-9]+$/.test(String(profile.user_id))) throw new HttpError(502, 'Unable to verify the connected Instagram account.');
      providerUserId = String(profile.user_id);
    }
    if (!token) throw new HttpError(502, 'The provider did not return access to your media.');
    const cipher = await crypt(token);
    const { error: connectionError } = await admin.from('portfolio_connections').upsert({ professional_id: job.professional_id, provider, token_cipher: cipher, provider_user_id: providerUserId, expires_at: new Date(Date.now() + expires * 1000).toISOString(), updated_at: new Date().toISOString() });
    if (connectionError) throw new HttpError(500, 'Unable to save account verification. Please reconnect.');
    message = 'Instagram account verified. Return to Circle.';
    await admin.from('portfolio_imports').update({ status: 'complete', message }).eq('id', job.id); succeeded = true;
  } catch (error) {
    message = error instanceof HttpError ? error.message : 'Portfolio import did not complete. Return to Circle and try again.';
    if (importId) await admin.from('portfolio_imports').update({ status: 'failed', message }).eq('id', importId);
  }
  const safe = message.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
  return new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Circle portfolio</title><style>body{font:16px system-ui;background:#fafafa;color:#171b22;max-width:460px;margin:15vh auto;padding:24px;line-height:1.6}</style><h1>Circle</h1><p>${safe}</p>`, { status: succeeded ? 200 : 400, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'" } });
});
