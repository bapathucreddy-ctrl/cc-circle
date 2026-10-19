import { useEffect, useRef, useState } from 'react';
import type { Coordinate } from '../domain';
import { bearingBetween, nextNavigationHeading } from '../lib/navigationHeading';

export function useNavigationHeading(point: Coordinate, reported?: number | null, route?: Coordinate[] | null) {
  const last = useRef<Coordinate | null>(null);
  const value = useRef(0);
  const resolved = useRef(false);
  const [heading, setHeading] = useState(0);
  useEffect(() => {
    const routePoint = !resolved.current ? route?.find(p => bearingBetween(point, p) !== null) : undefined;
    const initialBearing = reported ?? (routePoint ? bearingBetween(point, routePoint) : undefined);
    const validBearing = initialBearing != null && Number.isFinite(initialBearing) && initialBearing >= 0 && initialBearing < 360;
    const movement = last.current ? bearingBetween(last.current, point) : null;
    // Accept the first delayed GPS/route bearing while stationary, but still
    // collect positions so movement can resolve direction without either API.
    value.current = nextNavigationHeading(!resolved.current && validBearing ? null : last.current, point, initialBearing, value.current);
    if (validBearing || movement !== null) resolved.current = true;
    if (!last.current || movement !== null) last.current = point;
    setHeading(value.current);
  }, [point[0], point[1], reported, route]);
  return heading;
}
