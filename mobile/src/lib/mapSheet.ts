/** Snap positions are relative to the actual map viewport, including split-screen. */
export function mapSheetStops(height: number) {
  const room = Math.max(160, height);
  return [Math.min(116, room * .32), room * .43, room * .84];
}
export function clampMapSheet(value: number, height: number) {
  const stops = mapSheetStops(height);
  return Math.max(stops[0]!, Math.min(stops[2]!, value));
}
export function snapMapSheet(value: number, height: number, velocity = 0) {
  const stops = mapSheetStops(height);
  const projected = clampMapSheet(value - velocity * 90, height);
  return stops.reduce((best, stop) => Math.abs(stop - projected) < Math.abs(best - projected) ? stop : best);
}

/** Leave room for the route, its margins and close-up navigation padding. */
export function mapCameraInsets(height: number, top: number, bottom: number) {
  const budget = Math.max(0, height - 150);
  const total = Math.max(0, top) + Math.max(0, bottom);
  const scale = total > budget ? budget / total : 1;
  return { top: Math.max(0, top) * scale, bottom: Math.max(0, bottom) * scale };
}
