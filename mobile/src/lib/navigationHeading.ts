import type { Coordinate } from '../domain';

export function bearingBetween(from: Coordinate, to: Coordinate): number | null {
  const radians = Math.PI / 180;
  const a = from[1] * radians, b = to[1] * radians, delta = (to[0] - from[0]) * radians;
  const separation = Math.hypot((to[0] - from[0]) * Math.cos(a), to[1] - from[1]) * 111320;
  if (separation < 3) return null;
  return (Math.atan2(Math.sin(delta) * Math.cos(b), Math.cos(a) * Math.sin(b) - Math.sin(a) * Math.cos(b) * Math.cos(delta)) / radians + 360) % 360;
}

export function nextNavigationHeading(from: Coordinate | null, to: Coordinate, reported: number | null | undefined, previous: number): number {
  const movement = from ? bearingBetween(from, to) : null;
  if (from && movement === null) return previous;
  const next = reported != null && Number.isFinite(reported) && reported >= 0 && reported < 360 ? reported : movement;
  if (next == null) return previous;
  // Preserve the short turn when crossing north (359 -> 1 is two degrees).
  return previous + ((next - previous + 540) % 360 + 360) % 360 - 180;
}

// The road-plane scooter artwork faces north. Let the map project its bearing;
// rotating the old side-view illustration made its wheels turn upside down.
export function riderRotation(heading: number, mapBearing = 0) { return heading - mapBearing; }
