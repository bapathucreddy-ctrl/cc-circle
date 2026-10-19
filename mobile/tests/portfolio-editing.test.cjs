const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function mount(file, props, mocks) {
  const slots = []; let cursor = 0;
  const state = initial => { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial; return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }]; };
  const jsx = (type, props) => ({ type, props: props || {} }); const exports = {};
  const ui = { useTheme: () => ({ styles: new Proxy({}, { get: () => ({}) }), colors: { panel: '#fff', text: '#000', line: '#ddd' } }), ...Object.fromEntries(['Button', 'Icon', 'Notice', 'TextButton', 'Card'].map(name => [name, name])) };
  const native = Object.fromEntries(['Image', 'Modal', 'Pressable', 'ScrollView', 'Text', 'View'].map(name => [name, name]));
  const code = ts.transpileModule(fs.readFileSync(require.resolve(file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, Date, Map, require: name => mocks[name] || (name === 'react' ? { useState: state, useRef: initial => state({ current: initial })[0] } : name === 'react/jsx-runtime' ? { jsx, jsxs: jsx, Fragment: 'Fragment' } : name === 'react-native' ? native : name === '../ui' ? ui : name === '../domain' ? { errorText: e => e.message } : {}) });
  const component = exports[Object.keys(exports)[0]];
  function render() { cursor = 0; return component(props); }
  function nodes(tree) { if (!tree || typeof tree !== 'object') return []; if (Array.isArray(tree)) return tree.flatMap(nodes); if (tree.type === 'Modal' && !tree.props.visible) return []; return [tree, ...nodes(tree.props?.children)]; }
  const find = (predicate) => { const result = nodes(render()).find(predicate); assert.ok(result, 'Expected visible control'); return result; };
  return { render, nodes: () => nodes(render()), find, press: title => find(n => n.props.title === title).props.onPress(), images: () => nodes(render()).filter(n => n.type === 'Image').map(n => n.props.source.uri) };
}
function gallery(onDelete, onAdd = () => {}) {
  const data = { media: ['a', 'b', 'c'].map(id => ({ id, kind: 'image', provider: 'upload', src: `https://example.test/${id}?signature=first` })), connections: [] };
  const view = mount('../src/components/PortfolioGallery.tsx', { professionalId: 'pro', editable: true, onDelete, onAdd }, { '../hooks': { useResource: () => ({ data, loading: false, error: '', refresh: async () => {} }), useForegroundRefresh: () => {} } });
  return { ...view, data };
}
test('gallery edit menu, multi-select and confirmation keep photos mounted throughout deletion', async () => {
  let finish; let request; const pending = new Promise(resolve => { finish = resolve; });
  const view = gallery(async ids => { request = Array.from(ids); await pending; view.data.media = view.data.media.filter(item => !ids.includes(item.id)); });
  const original = view.images(); assert.equal(original.length, 3);
  assert.ok(!view.nodes().some(n => n.props.accessibilityLabel?.startsWith('Remove sample')));
  view.press('Edit'); view.press('Remove samples');
  view.find(n => n.props.accessibilityLabel === 'Select work sample 1').props.onPress();
  view.find(n => n.props.accessibilityLabel === 'Select work sample 3').props.onPress();
  view.press('Remove (2)'); assert.equal(request, undefined, 'Removal must wait for confirmation');
  const deletion = view.press('Confirm removal');
  assert.deepEqual(request, ['a', 'c']); assert.deepEqual(view.images(), original, 'Pending deletion must retain the grid');
  finish(); await deletion; await new Promise(setImmediate);
  assert.equal(view.images().length, 1); assert.ok(view.images()[0].includes('/b?'));
});
test('cancelling selection does not delete and rotating signed URLs does not reload unchanged photos', () => {
  let deletes = 0, uploads = 0; const view = gallery(async () => { deletes++; }, () => { uploads++; });
  const original = view.images();
  view.press('Edit'); view.press('Remove samples'); view.find(n => n.props.accessibilityLabel === 'Select work sample 2').props.onPress();
  view.press('Remove (1)'); view.press('Keep samples'); view.press('Cancel'); assert.equal(deletes, 0);
  view.data.media = view.data.media.map(item => ({ ...item, src: item.src.replace('first', 'second') }));
  assert.deepEqual(view.images(), original);
  view.press('Edit');
  assert.ok(view.nodes().some(node => node.type === 'Text' && /No watermarks, usernames, company names or logos/.test(String(node.props.children))));
  view.press('Upload sample'); assert.equal(uploads, 1); assert.deepEqual(view.images(), original);
});
test('profile reviews show two comments and View more opens the dedicated review flow', () => {
  let opened = 0; const rows = Array.from({ length: 20 }, (_, i) => ({ rating: 5, comment: `Review ${i}`, created_at: `2026-10-${String(28-i).padStart(2,'0')}T12:00:00Z` }));
  const view = mount('../src/components/ProfessionalReviews.tsx', { professionalId: 'pro', onViewAll: () => { opened++; } }, { '../hooks': { useResource: (_load, _key, namespace) => ({ data: namespace === 'professional-reviews' ? { count: 24, average: 5, reviews: rows } : [], error: '', loading: false }), useForegroundRefresh: () => {} } });
  assert.equal(view.nodes().filter(n => n.type === 'Text' && /^Review /.test(n.props.children)).length, 2);
  view.press('View more'); assert.equal(opened, 1);
});
