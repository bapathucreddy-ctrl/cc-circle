import type { Coordinate } from '../domain';
import { liveLocationAddress } from './liveLocation';
export type DeviceLocationSource = 'gps' | 'manual';

export function coordinateLocationLabel(point: Coordinate, accuracy?: number | null) {
  return `${point[1].toFixed(5)}, ${point[0].toFixed(5)}${accuracy != null && accuracy > 100 ? ' · approximate area' : ''}`;
}

export async function deviceLocationLabel(point: Coordinate, accuracy?: number | null, signal?: AbortSignal) {
  const fallback = coordinateLocationLabel(point, accuracy);
  if (signal?.aborted) return fallback;
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  const deadline = setTimeout(abort, 8000);
  try {
    const approximate = accuracy != null && accuracy > 100;
    const address = await liveLocationAddress(point[0], point[1], approximate, controller.signal);
    return address ? `${address}${approximate ? ' · approximate area' : ''}` : fallback;
  } catch { return fallback; }
  finally { clearTimeout(deadline); signal?.removeEventListener('abort', abort); }
}
