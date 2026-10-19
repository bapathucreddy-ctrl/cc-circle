const { withGradleProperties } = require('expo/config-plugins');

// Keep both phone ABIs. Shrink release Java/resources without dropping device support.
module.exports = function withReleaseOptimization(config) {
  return withGradleProperties(config, config => {
    const values = {
      'android.enableMinifyInReleaseBuilds': 'true',
      'android.enableShrinkResourcesInReleaseBuilds': 'true',
      'android.enableBundleCompression': 'true',
      reactNativeArchitectures: 'armeabi-v7a,arm64-v8a',
    };
    for (const [key, value] of Object.entries(values)) {
      config.modResults = config.modResults.filter(item => item.type !== 'property' || item.key !== key);
      config.modResults.push({ type: 'property', key, value });
    }
    return config;
  });
};
