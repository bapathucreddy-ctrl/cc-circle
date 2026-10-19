const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

test('professional profile availability switch persists one change and stops sharing when offline', async () => {
  const slots = []; let cursor = 0, writes = 0, stopped = 0, release;
  const profile = { id: 'pro', available_now: true, specialties: [] };
  const jsx = (type, props) => ({ type, props: props || {} });
  const react = { useState: initial => { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = value; }]; }, useRef: initial => { const i = cursor++; return slots[i] ||= { current: initial }; } };
  const ui = new Proxy({ useTheme: () => ({ styles: {}, colors: {} }) }, { get: (target, name) => target[name] || name });
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(require.resolve('../src/screens/Account.tsx'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, require: name => {
    if (name === 'react') return react;
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === 'react-native') return Object.fromEntries(['ScrollView', 'Switch', 'View', 'Text', 'RefreshControl'].map(key => [key, key]));
    if (name === '../ui') return ui;
    if (name === '../appVariant') return { isProfessionalApp: true };
    if (name === '../hooks') return { useResource: (fn, key, namespace) => ({ data: namespace === 'professional-profile' ? profile : [], refresh: async () => {} }), useAvailability: () => ({ data: { available_now: profile.available_now }, refresh: async () => {} }) };
    if (name === '../lib/professionalLocation') return { stopProfessionalLocation: async () => { stopped++; } };
    if (name === '../lib/supabase') return { supabase: { from: () => ({ update: patch => { writes++; return { eq: () => new Promise(resolve => { release = () => { profile.available_now = patch.available_now; resolve({ error: null }); }; }) }; } }) } };
    if (name === '../domain') return { errorText: error => String(error) };
    return new Proxy({}, { get: (_, key) => key });
  } });
  function walk(node) { if (Array.isArray(node)) return node.flatMap(walk); if (!node || typeof node !== 'object') return []; return [node, ...walk(node.props.children)]; }
  const nodes = () => { cursor = 0; const screen = exports.Account({ userId: 'pro' }); return walk(screen.type(screen.props)); };
  const control = () => nodes().find(node => node.type === 'ProfessionalProfileHeader');
  assert.equal(control().props.online, true);
  assert.ok(!nodes().some(node => node.type === 'ProfessionalLocationCard'));
  assert.ok(!nodes().some(node => node.props.title === 'My bookings'));
  control().props.onAvailabilityChange(false);
  assert.equal(control().props.availabilityBusy, true);
  control().props.onAvailabilityChange(false); assert.equal(writes, 1);
  release(); await new Promise(setImmediate);
  assert.equal(stopped, 1); assert.equal(control().props.online, false); assert.equal(control().props.availabilityBusy, false);
  control().props.onAvailabilityChange(true); release(); await new Promise(setImmediate);
  assert.equal(writes, 2); assert.equal(stopped, 1); assert.equal(control().props.online, true);
});
