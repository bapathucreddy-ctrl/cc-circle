const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);
// Two app servers can run together without reusing the other app's transforms.
config.cacheVersion = `cc-circle-${process.env.CC_APP_VARIANT || 'customer'}`;
module.exports = config;
