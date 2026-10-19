import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import type { Coordinate } from '../domain';

// Interpolate only between received GPS fixes. Never extrapolate a journey.
export function useTrackingPoint(point: Coordinate, tracking: boolean): Coordinate {
  const [display, setDisplay] = useState<Coordinate>(point);
  const current = useRef(point);
  const reduced = useRef(true);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) reduced.current = value; }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', value => { reduced.current = value; });
    return () => { active = false; subscription.remove(); };
  }, []);
  useEffect(() => {
    const from = current.current;
    if (!tracking || reduced.current || Math.abs(from[0] - point[0]) + Math.abs(from[1] - point[1]) > .02) {
      current.current = point; setDisplay(point); return;
    }
    let frame = 0; let start: number | undefined;
    function step(time: number) {
      start ??= time;
      const t = Math.min(1, (time - start) / 850);
      current.current = [from[0] + (point[0] - from[0]) * t, from[1] + (point[1] - from[1]) * t];
      setDisplay(current.current);
      if (t < 1) frame = requestAnimationFrame(step);
    }
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [point[0], point[1], tracking]);
  return tracking ? display : point;
}
