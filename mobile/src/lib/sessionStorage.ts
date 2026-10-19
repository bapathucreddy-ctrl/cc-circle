import * as SecureStore from 'expo-secure-store';

// Native sessions are chunked because a token can exceed a single keychain value.
export const sessionStorage = {
  async getItem(key: string) {
    const count = Number(await SecureStore.getItemAsync(`${key}.count`) || 0);
    if (!count) return null;
    const chunks = await Promise.all(Array.from({ length: count }, (_, i) => SecureStore.getItemAsync(`${key}.${i}`)));
    return chunks.some(chunk => chunk === null) ? null : chunks.join('');
  },
  async setItem(key: string, value: string) {
    const previous = Number(await SecureStore.getItemAsync(`${key}.count`) || 0);
    const count = Math.ceil(value.length / 450);
    for (let i = 0; i < count; i++) await SecureStore.setItemAsync(`${key}.${i}`, value.slice(i * 450, (i + 1) * 450));
    await SecureStore.setItemAsync(`${key}.count`, String(count));
    for (let i = count; i < previous; i++) await SecureStore.deleteItemAsync(`${key}.${i}`);
  },
  async removeItem(key: string) {
    const count = Number(await SecureStore.getItemAsync(`${key}.count`) || 0);
    await SecureStore.deleteItemAsync(`${key}.count`);
    for (let i = 0; i < count; i++) await SecureStore.deleteItemAsync(`${key}.${i}`);
  },
};
