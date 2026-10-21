import type { ExpoConfig } from 'expo/config';

const variant = process.env.CC_APP_VARIANT || 'customer';
if (variant !== 'customer' && variant !== 'professional') throw new Error('CC_APP_VARIANT must be customer or professional.');
if (process.env.EXPO_PUBLIC_APP_VARIANT && process.env.EXPO_PUBLIC_APP_VARIANT !== variant) throw new Error('App build and JavaScript variants must match. Use the app launcher or matching EAS profile.');
const professional = variant === 'professional';
const easProjectId = (professional ? process.env.EAS_PROFESSIONAL_PROJECT_ID : process.env.EAS_CUSTOMER_PROJECT_ID) || process.env.EAS_BUILD_PROJECT_ID;
const googleServicesFile = (professional ? process.env.GOOGLE_SERVICES_PROFESSIONAL_JSON : process.env.GOOGLE_SERVICES_CUSTOMER_JSON) || process.env.GOOGLE_SERVICES_JSON;
const iosPushConfigured = process.env.IOS_PUSH_ENABLED === 'true';
const name = 'Circle';
const config: ExpoConfig = {
  name,
  icon: professional ? './assets/brand/app-icon-professional.png' : './assets/brand/app-icon-customer.png',
  slug: professional ? 'circle-profession' : 'circle',
  version: professional ? '0.1.19' : '0.1.14',
  orientation: 'portrait',
  scheme: professional ? 'cccircle-pro' : 'cccircle',
  extra: { appVariant: variant, androidPushConfigured: Boolean(googleServicesFile), iosPushConfigured, ...(easProjectId ? { eas: { projectId: easProjectId } } : {}) },
  userInterfaceStyle: 'automatic',
  web: { bundler: 'metro', output: 'single', name },
  ios: {
    bundleIdentifier: professional ? 'com.cccircle.professional' : 'com.cccircle.customer',
    supportsTablet: true,
    infoPlist: {
      LSApplicationQueriesSchemes: ['phonepe', 'tez', 'paytm', 'paytmmp', 'bhim', 'upi', 'comgooglemaps'],
    },
  },
  android: { softwareKeyboardLayoutMode: 'resize', package: professional ? 'com.cccircle.professional' : 'com.cccircle.customer', versionCode: professional ? 20 : 15,
    ...(googleServicesFile ? { googleServicesFile } : {}),
    permissions: ['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION', ...(professional ? ['RECEIVE_BOOT_COMPLETED'] : [])] },
  plugins: [
    './plugins/withReleaseOptimization.cjs',
    ['expo-image-picker', { photosPermission: 'Choose your own photos and videos for your professional portfolio.', cameraPermission: false, microphonePermission: false }],
    'expo-video',
    ['expo-notifications', { icon: './assets/brand/mark-white.png', color: '#000000', defaultChannel: 'circle-activity' }],
    ['expo-splash-screen', { image: './assets/brand/launch-transparent.png', imageWidth: 110, resizeMode: 'contain', backgroundColor: '#f0f0f0', dark: { image: './assets/brand/launch-transparent.png', backgroundColor: '#282828' } }],
    'expo-web-browser',
    '@rnmapbox/maps',
    'expo-secure-store',
    '@react-native-community/datetimepicker',
    ['expo-location', {
      isIosBackgroundLocationEnabled: professional,
      locationAlwaysAndWhenInUsePermission: 'While you are online, Circle shares your location with nearby customers even when the professional app is in the background. Going offline stops sharing.',
      locationWhenInUsePermission: 'Circle uses your location to find creative talent and share your journey during a confirmed booking.',
      isAndroidBackgroundLocationEnabled: professional,
      isAndroidForegroundServiceEnabled: professional,
    }],
  ],
};

export default config;
