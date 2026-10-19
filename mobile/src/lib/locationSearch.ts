import type { Coordinate } from '../domain';
import { supabase } from './supabase';

export type LocationResult = { id: string; name: string; address: string; point?: Coordinate };
async function invoke(body: Record<string, unknown>, signal?: AbortSignal) {
  const { data, error } = await supabase.functions.invoke('location-search', { body, signal });
  if (error) {
    let message = 'Google Maps location search is unavailable. Use current location or choose a map pin.';
    try { const payload = await error.context?.json(); if (typeof payload?.error === 'string') message = payload.error; } catch { /* Generic errors do not expose upstream responses. */ }
    throw new Error(message);
  }
  return data;
}
export async function searchLocations(query: string, proximity: Coordinate, sessionToken: string, signal?: AbortSignal): Promise<LocationResult[]> {
  const text = query.trim();
  if (text.length < 3) return [];
  if (text.length > 256) throw new Error('Search with up to 256 characters. Add the area or city to narrow results.');
  const data = await invoke({ action: 'suggest', query: text, proximity, sessionToken }, signal);
  return Array.isArray(data?.locations) ? data.locations : [];
}
export async function resolveLocation(result: LocationResult, sessionToken: string, signal?: AbortSignal): Promise<Coordinate> {
  if (result.point) return result.point;
  const data = await invoke({ action: 'resolve', id: result.id, sessionToken }, signal);
  const point = data?.point;
  if (!Array.isArray(point) || point.length !== 2 || !point.every(Number.isFinite) || Math.abs(point[0]) > 180 || Math.abs(point[1]) > 90) throw new Error('Unable to locate this place. Choose its entrance on the map.');
  return [point[0], point[1]];
}
