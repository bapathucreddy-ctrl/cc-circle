const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { randomBytes } = require('node:crypto');
const { runInNewContext } = require('node:vm');
const ts = require('typescript');

const source = ts.transpileModule(readFileSync(require.resolve('../src/lib/requestId.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;

function load(platform, crypto) {
  const exports = {};
  runInNewContext(source, { exports, crypto, require: name => {
    if (name === 'react-native') return { Platform: { OS: platform } };
    if (name === 'expo-crypto') return { randomUUID: () => 'platform-uuid', getRandomValues: bytes => { bytes.set(randomBytes(bytes.length)); return bytes; } };
    throw Error(`Unexpected import: ${name}`);
  } });
  return exports.createRequestId;
}

test('HTTP LAN browsers generate distinct valid UUID v4 booking IDs without randomUUID', () => {
  const create = load('web', {});
  const ids = Array.from({ length: 1000 }, () => create());
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test('secure browsers and native devices retain the platform UUID implementation', () => {
  assert.equal(load('web', { randomUUID() {} })(), 'platform-uuid');
  assert.equal(load('android', undefined)(), 'platform-uuid');
  assert.equal(load('ios', undefined)(), 'platform-uuid');
});
