const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('release packaging preserves native classes, both phone architectures and unrelated Gradle settings', () => {
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(require.resolve('../plugins/withReleaseOptimization.cjs'), 'utf8'), {
    module, require: name => {
      assert.equal(name, 'expo/config-plugins');
      return { withGradleProperties: (config, apply) => apply(config) };
    },
  });
  let config = { modResults: [
    { type: 'comment', value: 'Retain signing configuration elsewhere' },
    { type: 'property', key: 'org.gradle.jvmargs', value: '-Xmx4096m' },
    { type: 'property', key: 'reactNativeArchitectures', value: 'arm64-v8a' },
  ] };
  config = module.exports(config);
  config = module.exports(config);
  const entries = config.modResults.filter(item => item.type === 'property');
  const properties = Object.fromEntries(entries.map(item => [item.key, item.value]));
  assert.equal(entries.length, Object.keys(properties).length);
  assert.equal(properties.reactNativeArchitectures, 'armeabi-v7a,arm64-v8a');
  assert.equal(properties['android.enableMinifyInReleaseBuilds'], 'false');
  assert.equal(properties['android.enableShrinkResourcesInReleaseBuilds'], 'false');
  assert.equal(properties['expo.useLegacyPackaging'], 'true');
  assert.equal(properties['org.gradle.jvmargs'], '-Xmx4096m');
  assert.ok(config.modResults.some(item => item.type === 'comment'));
});
