// Native clients and trusted server calls do not send an Origin header.
// Browser origins must match exactly; credentials are never enabled with a wildcard.
export function allowedOrigin(origin: string | null, configured: string | undefined) {
  if (!origin) return true;
  const origins = (configured || 'http://localhost:8081,http://localhost:8082,http://127.0.0.1:8081,http://127.0.0.1:8082,http://0.0.0.0:8081,http://0.0.0.0:8082')
    .split(',').map(value => value.trim()).filter(Boolean);
  return origins.includes(origin);
}

export async function secureResponse(req: Request, handler: (req: Request) => Response | Promise<Response>, configured?: string) {
  const origin = req.headers.get('Origin');
  const permitted = allowedOrigin(origin, configured);
  const headers = new Headers({
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer', 'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  });
  if (origin && permitted) headers.set('Access-Control-Allow-Origin', origin);
  let response: Response;
  if (!permitted) response = new Response(JSON.stringify({ error: 'This browser origin is not permitted.' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  else if (req.method === 'OPTIONS') response = new Response(null, { status: 204 });
  else {
    try { response = await handler(req); }
    catch { response = new Response(JSON.stringify({ error: 'Unable to complete this request.' }), { status: 500, headers: { 'Content-Type': 'application/json' } }); }
  }
  const merged = new Headers(response.headers);
  merged.delete('Access-Control-Allow-Origin');
  merged.delete('Access-Control-Allow-Credentials');
  headers.forEach((value, key) => merged.set(key, value));
  return new Response(response.body, { status: response.status, headers: merged });
}

export function serveRequest(handler: (req: Request) => Response | Promise<Response>) {
  return Deno.serve(req => secureResponse(req, handler, Deno.env.get('ALLOWED_WEB_ORIGINS')));
}

export async function readLimitedText(req: Request, maximum: number) {
  const advertised = req.headers.get('Content-Length');
  if (advertised && Number(advertised) > maximum) throw new Error('body_too_large');
  const reader = req.body?.getReader();
  if (!reader) return '';
  const parts: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximum) { await reader.cancel(); throw new Error('body_too_large'); }
      parts.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let at = 0;
  for (const part of parts) { bytes.set(part, at); at += part.byteLength; }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}
