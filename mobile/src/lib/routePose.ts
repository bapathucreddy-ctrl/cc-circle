import type { Coordinate } from '../domain';
import { bearingBetween } from './navigationHeading';

// Match only small GPS offsets to the displayed road. Keep the measured position
// when it is far from the route; this never changes the GPS sent to the server.
export function routePose(point: Coordinate, route?: Coordinate[] | null) {
  let nearest = point, distance = Infinity, heading: number | null = null;
  const scaleX = 111320 * Math.cos(point[1] * Math.PI / 180), scaleY = 111320;
  for (let i = 1; i < (route?.length || 0); i++) {
    const a = route![i - 1], b = route![i];
    if (!a || !b) continue;
    const ax = (a[0] - point[0]) * scaleX, ay = (a[1] - point[1]) * scaleY;
    const dx = (b[0] - a[0]) * scaleX, dy = (b[1] - a[1]) * scaleY;
    const length = dx * dx + dy * dy;
    if (!length) continue;
    const t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / length));
    const gap = Math.hypot(ax + t * dx, ay + t * dy);
    if (gap < distance) {
      distance = gap;
      nearest = [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
      heading = bearingBetween(a, b);
      for (let j = i + 1; heading === null && j < route!.length; j++) {
        const ahead = route![j];
        if (ahead) heading = bearingBetween(a, ahead);
      }
    }
  }
  return distance <= 35 ? { point: nearest, heading, matched: true } : { point, heading: null, matched: false };
}
