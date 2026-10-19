import type { Coordinate } from '../domain';
export type DrivingRoute = { coordinates: Coordinate[]; durationSeconds: number; distanceMeters: number; instruction?: string; modifier?: string; stepDistanceMeters?: number };
export async function drivingRoute(from: Coordinate, to: Coordinate, signal?: AbortSignal): Promise<DrivingRoute | null> {
 const token = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
 if (!token) return null;
 const response = await fetch('https://api.mapbox.com/directions/v5/mapbox/driving/'+from.join(',')+';'+to.join(',')+'?'+new URLSearchParams({geometries:'geojson',overview:'full',steps:'true',access_token:token}),{signal});
 if (!response.ok) throw new Error('Unable to load the Mapbox driving route.');
 const route = (await response.json()).routes?.[0];
 if (!route) throw new Error('No driving route is available.');
 const step = route.legs?.[0]?.steps?.[0];
 return {coordinates:route.geometry.coordinates as Coordinate[],durationSeconds:route.duration,distanceMeters:route.distance,instruction:step?.maneuver?.instruction,modifier:step?.maneuver?.modifier,stepDistanceMeters:step?.distance};
}
