import { Linking, Platform } from 'react-native';
import type { Coordinate } from '../domain';

export async function openGoogleMaps(destination: Coordinate) {
  const [longitude, latitude] = destination;
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || Math.abs(longitude) > 180 || Math.abs(latitude) > 90) {
    throw new Error('This booking does not have a valid destination location.');
  }
  const target = `${latitude},${longitude}`;
  const fallback = 'https://www.google.com/maps/dir/?' + new URLSearchParams({
    api: '1', destination: target, travelmode: 'driving', dir_action: 'navigate',
  });
  if (Platform.OS !== 'web') {
    const native = Platform.OS === 'android' ? `google.navigation:q=${target}&mode=d`
      : `comgooglemaps://?daddr=${encodeURIComponent(target)}&directionsmode=driving`;
    try { await Linking.openURL(native); return; } catch { /* Use browser directions if the app is absent. */ }
  }
  await Linking.openURL(fallback);
}
