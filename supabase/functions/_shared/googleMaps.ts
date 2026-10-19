import { HttpError } from './payments.ts';

type Point = [number, number];
function point(value: unknown): Point {
  if (!Array.isArray(value) || value.length !== 2 || !value.every(n => typeof n === 'number' && Number.isFinite(n)) || Math.abs(value[0]) > 180 || Math.abs(value[1]) > 90) throw new HttpError(400, 'Choose valid map coordinates.');
  return [value[0], value[1]];
}
function session(value: unknown) {
  if (typeof value !== 'string' || !/^[a-z0-9_-]{1,36}$/i.test(value)) throw new HttpError(400, 'Reopen location search and try again.');
  return value;
}
async function google(url: string, key: string, fieldMask: string, payload?: unknown) {
  const response = await fetch(url, { method: payload ? 'POST' : 'GET', signal: AbortSignal.timeout(12000),
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': fieldMask },
    ...(payload ? { body: JSON.stringify(payload) } : {}) });
  if (!response.ok) throw new HttpError(response.status === 429 ? 429 : 503, response.status === 429
    ? 'Google Maps is busy. Try again shortly.' : 'Google Maps is unavailable. Check API configuration or use a map pin.');
  return response.json();
}
export async function suggestPlaces(query: unknown, proximity: unknown, token: unknown, key: string) {
  if (typeof query !== 'string' || query.trim().length < 3 || query.trim().length > 256 || /[\u0000-\u001f]/.test(query)) throw new HttpError(400, 'Search with 3 to 256 characters.');
  const [longitude, latitude] = point(proximity);
  const data = await google('https://places.googleapis.com/v1/places:autocomplete', key,
    'suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat,suggestions.placePrediction.text',
    { input: query.trim(), sessionToken: session(token), languageCode: 'en', includedRegionCodes: ['in'], includeQueryPredictions: false,
      locationBias: { circle: { center: { latitude, longitude }, radius: 50000 } } });
  return (Array.isArray(data.suggestions) ? data.suggestions : []).flatMap((row: any) => {
    const p = row?.placePrediction;
    if (typeof p?.placeId !== 'string' || !p.placeId || typeof p.text?.text !== 'string') return [];
    return [{ id: p.placeId, name: p.structuredFormat?.mainText?.text || p.text.text, address: p.text.text }];
  }).slice(0, 5);
}
export async function resolvePlace(id: unknown, token: unknown, key: string) {
  if (typeof id !== 'string' || !/^[a-z0-9_-]{1,256}$/i.test(id)) throw new HttpError(400, 'Choose a valid Google place.');
  const params = new URLSearchParams({ sessionToken: session(token) });
  const data = await google(`https://places.googleapis.com/v1/places/${encodeURIComponent(id)}?${params}`, key, 'id,location');
  if (data.id !== id || typeof data.location?.longitude !== 'number' || typeof data.location?.latitude !== 'number') throw new HttpError(424, 'Google did not return a precise location. Choose its entrance on the map.');
  return point([data.location.longitude, data.location.latitude]);
}
