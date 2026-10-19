export const standardMapStyle = 'mapbox://styles/mapbox/standard';
export const mapLightPresets = ['dawn', 'day', 'dusk', 'night'] as const;
export type MapLightPreset = typeof mapLightPresets[number];
export const mapRouteColor = (preset: MapLightPreset) => preset === 'night' || preset === 'dusk' ? '#ffffff' : '#111111';
export function standardMapConfig(lightPreset: MapLightPreset) {
  return { lightPreset, show3dObjects: true, show3dBuildings: true, show3dTrees: true,
    show3dLandmarks: true, showPointOfInterestLabels: true, showRoadLabels: true, showPlaceLabels: true };
}
