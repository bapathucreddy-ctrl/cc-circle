const { withGradleProperties } = require('expo/config-plugins');

// Preserve native classes and reflection behavior; reduce download size through packaging.
module.exports = function withReleaseOptimization(config) {
  return withGradleProperties(config, config => {
    const values = {
      'android.enableMinifyInReleaseBuilds': 'false',
      'android.enableShrinkResourcesInReleaseBuilds': 'false',
      'android.enableBundleCompression': 'true',
      'expo.useLegacyPackaging': 'true',
      reactNativeArchitectures: 'armeabi-v7a,arm64-v8a',
    };
    for (const [key, value] of Object.entries(values)) {
      config.modResults = config.modResults.filter(item => item.type !== 'property' || item.key !== key);
      config.modResults.push({ type: 'property', key, value });
    }
    return config;
  });
};
