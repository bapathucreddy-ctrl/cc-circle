import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

// LAN development uses HTTP, where browsers omit randomUUID but still allow
// cryptographically secure random values. Keep the same UUID v4 format.
export function createRequestId(): string {
  if (Platform.OS !== 'web' || typeof globalThis.crypto.randomUUID === 'function') return Crypto.randomUUID();
  const bytes = Crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
