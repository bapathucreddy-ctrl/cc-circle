const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, requires) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve(file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, { exports, require: name => { if (name in requires) return requires[name]; throw Error(name); } });
  return exports;
}
function apiFixture(pages) {
  const calls = [];
  const chain = {};
  for (const method of ['select', 'eq', 'order', 'range', 'upsert', 'delete']) chain[method] = (...args) => { calls.push([method, ...args]); return chain; };
  chain.then = resolve => Promise.resolve(pages.shift()).then(resolve);
  const api = load('../src/lib/api.ts', { './supabase': { supabase: { from: table => { calls.push(['from', table]); return chain; } } }, '../appVariant': { isProfessionalApp: false }, '../domain': {} });
  return { api, calls };
}
test('saved collection keeps offline professionals across crafts and has no proximity filters', async () => {
  const people = [{ id: 'makeup', category: 'Makeup', available_now: false }, { id: 'photo', category: 'Photographer', available_now: false }];
  const f = apiFixture([{ data: [...people.map(professional => ({ professional })), { professional: null }], error: null }]);
  const rows = await f.api.savedProfessionals('customer-1');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].id, 'makeup'); assert.equal(rows[1].id, 'photo');
  assert.ok(f.calls.some(call => call[0] === 'eq' && call[1] === 'user_id' && call[2] === 'customer-1'));
  assert.equal(f.calls.filter(call => call[0] === 'eq').length, 1);
});
test('saved collection reads all pages and reports later failures instead of a partial list', async () => {
  const page = Array.from({ length: 500 }, (_, id) => ({ professional: { id } }));
  const f = apiFixture([{ data: page }, { data: [{ professional: { id: 500 } }] }]);
  assert.equal((await f.api.savedProfessionals('customer-1')).length, 501);
  assert.ok(f.calls.some(call => call[0] === 'range' && call[1] === 500 && call[2] === 999));
  const failed = apiFixture([{ data: page }, { error: { message: 'Connection lost' } }]);
  await assert.rejects(() => failed.api.savedProfessionals('customer-1'), /Connection lost/);
});
test('save is idempotent and unsave targets only the current customer and professional', async () => {
  const f = apiFixture([{ error: null }, { error: null }]);
  await f.api.toggleSaved('customer-1', 'professional-1', false);
  const save = f.calls.find(call => call[0] === 'upsert');
  assert.equal(save[1].user_id, 'customer-1'); assert.equal(save[1].professional_id, 'professional-1');
  assert.equal(save[2].ignoreDuplicates, true);
  await f.api.toggleSaved('customer-1', 'professional-1', true);
  assert.ok(f.calls.some(call => call[0] === 'delete'));
  assert.ok(f.calls.some(call => call[0] === 'eq' && call[1] === 'professional_id' && call[2] === 'professional-1'));
});
function componentFixture(file, name, dependencies, props) {
  const slots = [], refs = []; let cursor = 0, ref = 0;
  const jsx = (type, props) => ({ type, props: props || {} });
  const react = { useState: initial => { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }]; }, useRef: initial => { const i = ref++; return refs[i] || (refs[i] = { current: initial }); } };
  const module = load(file, { react, 'react/jsx-runtime': { jsx, jsxs: jsx, Fragment: 'Fragment' }, 'react-native': { View: 'View', Text: 'Text', Pressable: 'Pressable' }, '../ui': { Button: 'Button', Icon: 'Icon', useTheme: () => ({colors:{text:'#111'}}), IconButton: 'IconButton', Notice: 'Notice', Field: 'Field', Card: 'Card', useTheme: () => ({ styles: {}, colors: {} }) }, '../domain': { errorText: e => e.message }, ...dependencies });
  const render = () => { cursor = 0; ref = 0; return module[name](props); };
  function nodes(node) { if (Array.isArray(node)) return node.flatMap(nodes); if (!node || typeof node !== 'object') return []; return [node, ...nodes(node.props?.children)]; }
  return { nodes: () => nodes(render()), find: predicate => nodes(render()).find(predicate) };
}
test('profile heart persists save/unsave and blocks rapid duplicate requests', async () => {
  const resource = { data: [], loading: false, error: '', refresh: async () => { resource.data = resource.data.length ? [] : ['pro-1']; } };
  const calls = [];
  let release;
  const f = componentFixture('../src/components/SaveProfessionalButton.tsx', 'SaveProfessionalButton', {
    '../hooks': { useResource: () => resource }, '../lib/api': { toggleSaved: async (...args) => { calls.push(args); await new Promise(resolve => { release = resolve; }); } },
  }, { userId: 'customer-1', professionalId: 'pro-1', compact: true });
  let heart = f.find(node => node.props.testID === 'save-professional-button');
  const saving = heart.props.onPress(); await heart.props.onPress();
  assert.equal(calls.length, 1); assert.equal(calls[0][2], false);
  assert.equal(f.find(node => node.props.testID === 'save-professional-button').props.accessibilityState.selected, true);
  assert.ok(f.find(node => node.props.testID === 'saved-heart'));
  release(); await saving;
  heart = f.find(node => node.props.testID === 'save-professional-button');
  assert.equal(heart.props.accessibilityState.selected, true); assert.equal(heart.props.accessibilityLabel, 'Unsave professional');
  const removing = heart.props.onPress(); release(); await removing;
  assert.equal(calls[1][2], true); assert.equal(f.find(node => node.props.testID === 'save-professional-button').props.accessibilityState.selected, false);
});
test('successful review immediately offers saving even when the review refetch is delayed', async () => {
  const review = { rating: 5, comment: 'Excellent work' };
  const f = componentFixture('../src/components/BookingReviewCard.tsx', 'BookingReviewCard', {
    '../hooks': { useResource: () => ({ data: null, error: '', loading: false, refresh: async () => {} }) },
    '../lib/api': { submitReview: async () => review }, './SaveProfessionalButton': { SaveProfessionalButton: 'SaveProfessional' },
  }, { bookingId: 'booking-1', userId: 'customer-1', professionalId: 'pro-1' });
  assert.equal(f.find(node => node.type === 'SaveProfessional'), undefined);
  f.find(node => node.props.accessibilityLabel === '5 stars').props.onPress();
  await f.find(node => node.props.title === 'Submit review').props.onPress();
  const save = f.find(node => node.type === 'SaveProfessional');
  assert.equal(save.props.userId, 'customer-1'); assert.equal(save.props.professionalId, 'pro-1');
  assert.equal(f.find(node => node.props.title === 'Submit review'), undefined);
});
