import Constants from 'expo-constants';

// Selected by the app build, never by a role switch in the signed-in UI.
export const appVariant: 'customer' | 'professional' = (process.env.EXPO_PUBLIC_APP_VARIANT || Constants.expoConfig?.extra?.appVariant) === 'professional' ? 'professional' : 'customer';
export const isProfessionalApp = appVariant === 'professional';
export const appName = 'Circle';
