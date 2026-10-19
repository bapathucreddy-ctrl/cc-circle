const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function config(variant, publicVariant, environment = {}) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(require.resolve('../app.config.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(source, { exports, process: { env: { ...environment, CC_APP_VARIANT: variant, EXPO_PUBLIC_APP_VARIANT: publicVariant } } });
  return exports.default;
}

test('customer and professional builds have distinct install identities and fixed app variants', () => {
  const customer = config('customer'); const pro = config('professional');
  assert.equal(customer.extra.appVariant, 'customer'); assert.equal(pro.extra.appVariant, 'professional');
  assert.equal(customer.name, 'Circle'); assert.equal(pro.name, 'Circle');
  for (const key of ['slug', 'scheme']) assert.notEqual(customer[key], pro[key]);
  assert.notEqual(customer.android.package, pro.android.package);
  assert.notEqual(customer.ios.bundleIdentifier, pro.ios.bundleIdentifier);
  assert.equal(config(undefined).extra.appVariant, 'customer');
  assert.throws(() => config('combined'), /must be customer or professional/);
  assert.throws(() => config('customer', 'professional'), /variants must match/);
});

test('each release profile selects the intended app identity', () => {
  const { build } = JSON.parse(fs.readFileSync(require.resolve('../eas.json'), 'utf8'));
  for (const variant of ['customer', 'professional']) for (const type of ['development', 'preview', 'production']) {
    assert.equal(build[`${variant}-${type}`].env.CC_APP_VARIANT, variant);
    assert.equal(build[`${variant}-${type}`].env.EXPO_PUBLIC_APP_VARIANT, variant);
    assert.equal(build[`${variant}-${type}`].extends, type);
  }
});

test('EAS project links remain separate for customer and professional builds', () => {
  const environment = { EAS_CUSTOMER_PROJECT_ID: 'customer-project', EAS_PROFESSIONAL_PROJECT_ID: 'professional-project' };
  assert.equal(config('customer', 'customer', environment).extra.eas.projectId, 'customer-project');
  assert.equal(config('professional', 'professional', environment).extra.eas.projectId, 'professional-project');
  assert.equal(config('customer').extra.eas, undefined);
  assert.equal(config('customer',undefined,{EAS_BUILD_PROJECT_ID:'cloud-project'}).extra.eas.projectId,'cloud-project');
});

test('map rendering stays on Mapbox and Google credentials remain server-only',()=>{const app=config('customer',undefined,{GOOGLE_MAPS_ANDROID_KEY:'unused',GOOGLE_MAPS_SERVER_KEY:'server-secret'});assert.ok(app.plugins.includes('@rnmapbox/maps'));assert.ok(!app.plugins.some(p=>Array.isArray(p)&&p[0]==='react-native-maps'));assert.ok(!JSON.stringify(app).includes('server-secret'));});

test('background permissions belong only to the professional app',()=>{for(const v of ['customer','professional']){const app=config(v);const location=app.plugins.find(p=>Array.isArray(p)&&p[0]==='expo-location')[1];assert.equal(location.isAndroidBackgroundLocationEnabled,v==='professional');assert.equal(location.isAndroidForegroundServiceEnabled,v==='professional');assert.equal(location.isIosBackgroundLocationEnabled,v==='professional');}});

test('professional persisted location jobs declare the Android boot permission',()=>{
  const pro=config('professional'),customer=config('customer');
  assert.ok(pro.android.permissions.includes('RECEIVE_BOOT_COMPLETED'));
  assert.ok(!customer.android.permissions.includes('RECEIVE_BOOT_COMPLETED'));
  assert.equal(pro.version,'0.1.14');assert.equal(pro.android.versionCode,15);
  assert.equal(customer.version,'0.1.9');assert.equal(customer.android.versionCode,10);
});

test('Firebase configuration is optional and remains separate between app variants',()=>{
 const env={GOOGLE_SERVICES_CUSTOMER_JSON:'customer/google-services.json',GOOGLE_SERVICES_PROFESSIONAL_JSON:'professional/google-services.json',FCM_SERVICE_ACCOUNT_JSON:'private-key'};
 const customer=config('customer',undefined,env),pro=config('professional',undefined,env);
 assert.equal(customer.android.googleServicesFile,'customer/google-services.json');
 assert.equal(pro.android.googleServicesFile,'professional/google-services.json');
 assert.equal(customer.extra.androidPushConfigured,true);
 assert.equal(config('customer').extra.androidPushConfigured,false);
 assert.equal(config('customer').extra.iosPushConfigured,false);
 assert.equal(config('professional',undefined,{IOS_PUSH_ENABLED:'true'}).extra.iosPushConfigured,true);
 assert.ok(!JSON.stringify(config('customer',undefined,{APNS_PRIVATE_KEY:'apple-private-key'})).includes('apple-private-key'));
 assert.ok(!JSON.stringify(customer).includes('private-key'));
 const splash=customer.plugins.find(p=>Array.isArray(p)&&p[0]==='expo-splash-screen')[1];
 assert.equal(splash.image,'./assets/brand/launch-transparent.png');
 assert.equal(splash.dark.image,splash.image);
});

test('iOS simulator clients use separate identities without device signing profiles',()=>{
 const {build}=JSON.parse(fs.readFileSync(require.resolve('../eas.json'),'utf8'));
 for(const variant of ['customer','professional']){
  assert.equal(build[`${variant}-simulator`].extends,`${variant}-development`);
  assert.equal(build[`${variant}-simulator`].ios.simulator,true);
  assert.equal(build.development.developmentClient,true);
  assert.equal(build.preview.ios.simulator,false);
 }
});
