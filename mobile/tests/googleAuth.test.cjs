const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { randomBytes, createHash } = require('node:crypto');
const ts = require('typescript');
const source = ts.transpileModule(fs.readFileSync(require.resolve('../src/lib/googleAuth.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;

function harness({ native = false, pro = false, enabled = true, browserResult = 'success', tokenOK = true, secure = true } = {}) {
  const storage = new Map(); const requests = []; const sessions = []; const redirects = []; const history = [];
  const redirect = native ? `${pro ? 'cccircle-pro' : 'cccircle'}://auth/callback` : 'http://localhost:8081/auth/callback';
  const endpoint = 'https://fixture.supabase.co/auth/v1';
  const exports = {};
  const supabase = { auth: { setSession: async tokens => { sessions.push(tokens); return { error: null }; } } };
  const modules = {
    'react-native': { Platform: { OS: native ? 'android' : 'web' }, Linking: { getInitialURL: async () => null } },
    'expo-crypto': { getRandomBytes: () => { throw Error('Do not use the dev-mode random fallback for OAuth'); }, getRandomBytesAsync: async size => randomBytes(size), CryptoDigestAlgorithm: { SHA256: 'SHA-256' }, CryptoEncoding: { BASE64: 'base64' }, digestStringAsync: async (_, value) => createHash('sha256').update(value).digest('base64') },
    'expo-web-browser': { openAuthSessionAsync: async (url, callback) => { redirects.push(url); assert.equal(callback, redirect); return browserResult === 'success' ? { type: 'success', url: `${callback}?code=native-code` } : { type: browserResult }; } },
    '../appVariant': { isProfessionalApp: pro },
    './sessionStorage': { sessionStorage: { getItem: async key => storage.get(key), setItem: async (key, value) => storage.set(key, value), removeItem: async key => storage.delete(key) } },
    './supabase': { authEndpoint: endpoint, authPublishableKey: 'public-fixture', authStorageKey: pro ? 'professional' : 'customer', backendConfigured: true, supabase },
  };
  vm.runInNewContext(source, { exports, URL, console, window: { isSecureContext: secure, location: { origin: 'http://localhost:8081', assign: url => redirects.push(url) }, history: { replaceState: (...args) => history.push(args) } }, fetch: async (url, options) => {
    requests.push({ url, options });
    return url.endsWith('/settings') ? { ok: true, json: async () => ({ external: { google: enabled } }) } : { ok: tokenOK, json: async () => ({ access_token: 'access-fixture', refresh_token: 'refresh-fixture' }) };
  }, require: name => { if (!(name in modules)) throw Error(name); return modules[name]; } });
  return { ...exports, storage, requests, sessions, redirects, history, redirect };
}

test('Google web auth uses S256 PKCE, verifies the callback once and clears its verifier', async () => {
  const h = harness(); await h.signInWithGoogle();
  const authorize = new URL(h.redirects[0]); const pending = JSON.parse([...h.storage.values()][0]);
  assert.equal(authorize.searchParams.get('provider'), 'google');
  assert.equal(authorize.searchParams.get('code_challenge_method'), 's256');
  assert.equal(authorize.searchParams.get('code_challenge'), createHash('sha256').update(pending.verifier).digest('base64url'));
  assert.equal(authorize.searchParams.get('redirect_to'), h.redirect);
  await Promise.all([h.completeGoogleSignIn(`${h.redirect}?code=web-code`), h.completeGoogleSignIn(`${h.redirect}?code=web-code`)]);
  assert.equal(h.requests.filter(request => request.url.includes('/token')).length, 1);
  assert.equal(JSON.parse(h.requests[1].options.body).code_verifier, pending.verifier);
  assert.equal(h.sessions.length, 1); assert.equal(h.storage.size, 0);
  assert.equal(h.history[0][2], '/');
});

test('native Google auth uses each app scheme and cleans up when cancelled', async () => {
  for (const pro of [false, true]) { const h = harness({ native: true, pro }); await h.signInWithGoogle(); assert.equal(h.sessions.length, 1); assert.equal(h.storage.size, 0); }
  const cancelled = harness({ native: true, browserResult: 'cancel' }); await cancelled.signInWithGoogle(); assert.equal(cancelled.sessions.length, 0); assert.equal(cancelled.storage.size, 0);
});

test('disabled Google and insecure browser origins do not start auth', async () => {
  const disabled = harness({ enabled: false }); await assert.rejects(disabled.signInWithGoogle, /not available yet/); assert.equal(disabled.redirects.length, 0);
  const insecure = harness({ secure: false }); await assert.rejects(insecure.signInWithGoogle, /needs HTTPS/); assert.equal(insecure.requests.length, 0);
});

test('foreign, expired, denied and failed callbacks never establish sessions', async () => {
  const foreign = harness(); assert.equal(await foreign.completeGoogleSignIn('cccircle-pro://auth/callback?code=foreign'), false); assert.equal(foreign.requests.length, 0);
  const expired = harness(); await expired.signInWithGoogle(); const key = [...expired.storage.keys()][0]; const pending = JSON.parse(expired.storage.get(key)); pending.createdAt -= 16 * 60000; expired.storage.set(key, JSON.stringify(pending));
  await assert.rejects(() => expired.completeGoogleSignIn(`${expired.redirect}?code=old`), /expired/); assert.equal(expired.sessions.length, 0); assert.equal(expired.storage.size, 0);
  const denied = harness(); await denied.signInWithGoogle(); await assert.rejects(() => denied.completeGoogleSignIn(`${denied.redirect}?error=access_denied`), /cancelled/); assert.equal(denied.storage.size, 0);
  const failed = harness({ tokenOK: false }); await failed.signInWithGoogle(); await assert.rejects(() => failed.completeGoogleSignIn(`${failed.redirect}?code=bad`), /could not be verified/); assert.equal(failed.sessions.length, 0); assert.equal(failed.storage.size, 0);
});
