import * as Location from 'expo-location';
import { Platform } from 'react-native';

export async function currentLocation() {
  if (Platform.OS === 'web' && !globalThis.isSecureContext) {
    throw new Error('Current location needs HTTPS on this browser. Use localhost on this computer, or choose your venue pin on the map.');
  }
  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) throw new Error('Allow location access to use your current location. You can also choose a venue pin on the map.');
  // Expo's web adapter otherwise accepts an indefinitely cached browser fix.
  return Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High,
    ...(Platform.OS === 'web' ? { maximumAge: 0, timeout: 15000 } : {}) });
}
