import { serveRequest } from '../_shared/http.ts';
import { authenticate, body, HttpError, json } from '../_shared/payments.ts';
import { resolvePlace, suggestPlaces } from '../_shared/googleMaps.ts';

// Per-worker burst protection; configure provider account quotas as well.
const windows = new Map<string, { at: number; count: number }>();
serveRequest(async req => {
  if (req.method === 'OPTIONS') return json({});
  try {
    const { user } = await authenticate(req);
    const input = await body(req);
    const now = Date.now();
    for (const [id, window] of windows) if (now - window.at >= 60000) windows.delete(id);
    const window = windows.get(user.id) || { at: now, count: 0 };
    if (++window.count > 60 || windows.size >= 5000 && !windows.has(user.id)) throw new HttpError(429, 'Wait a moment before searching again.');
    windows.set(user.id, window);
    const key = Deno.env.get('GOOGLE_MAPS_SERVER_KEY')?.trim();
    if (!key) throw new HttpError(503, 'Google Maps search is not configured yet. Use current location or choose a map pin.');
    if (input.action === 'suggest') return json({ locations: await suggestPlaces(input.query, input.proximity, input.sessionToken, key) });
    if (input.action === 'resolve') return json({ point: await resolvePlace(input.id, input.sessionToken, key) });
    throw new HttpError(400, 'Unknown location operation.');
  } catch (error) {
    return error instanceof HttpError ? json({ error: error.message }, error.status) : json({ error: 'Unable to load Google Maps data. Use current location or choose a map pin.' }, 503);
  }
});
