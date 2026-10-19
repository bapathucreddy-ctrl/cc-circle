const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, mocks = {}, extra = {}) { const exports = {}; vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve(file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, { exports, require: name => mocks[name] || {}, ...extra }); return exports; }
test('service starting prices paginate matching nearby packages and quote the lowest real customer total', async () => {
  const domain = load('../src/domain.ts'), calls = []; let page = 0;
  const query = {}; for (const method of ['select', 'in', 'eq', 'order']) query[method] = (...args) => { calls.push([method, ...args]); return query; };
  query.range = async (...args) => { calls.push(['range', ...args]); return { data: page++ === 0 ? Array.from({ length: 500 }, () => ({ service_key: 'bridal-makeup', amount_paise: 200000 })) : [{ service_key: 'bridal-makeup', amount_paise: 100000 }, { service_key: 'party-makeup', amount_paise: 150000 }, { service_key: 'unknown', amount_paise: 100000 }], error: null }; };
  let discovery;
  const mod = load('../src/lib/serviceStartingPrices.ts', { '../domain': domain, './api': { discover: async (...args) => { discovery = args; return [{ id: 'nearby-available' }]; } }, './serviceCatalog': { servicesForCategory: () => [{ key: 'bridal-makeup' }, { key: 'party-makeup' }] }, './supabase': { supabase: { from: () => query } } });
  const result = await mod.serviceStartingPrices('Makeup', [77, 12], true);
  assert.deepEqual(Array.from(discovery), ['Makeup', [77, 12], '', 15, true]);
  assert.equal(result['bridal-makeup'], domain.bookingFees(100000).buyerTotal);
  assert.equal(result['party-makeup'], domain.bookingFees(150000).buyerTotal);
  assert.ok(!('unknown' in result)); assert.equal(page, 2);
  assert.ok(calls.some(row => row[0] === 'in' && row[1] === 'professional_id' && row[2].join() === 'nearby-available'));
  assert.ok(calls.some(row => row[0] === 'eq' && row[1] === 'active' && row[2] === true));
});
test('missing nearby professionals never produce made-up starting prices', async () => {
  let queried = false;
  const mod = load('../src/lib/serviceStartingPrices.ts', { './api': { discover: async () => [] }, './supabase': { supabase: { from: () => { queried = true; } } } });
  assert.equal(Object.keys(await mod.serviceStartingPrices('Makeup', [77, 12], false)).length, 0); assert.equal(queried, false);
});
test('home category opens a sheet in place and keeps the selected timing when choosing a service', () => {
  const slots = []; let cursor = 0; const jsx = (type, props) => ({ type, props: props || {} });
  const react = { useState: initial => { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = value; }]; } };
  const ui = Object.fromEntries(['Brand', 'ThemeToggle', 'Field', 'Segmented', 'Button', 'Icon', 'TextButton', 'Notice'].map(key => [key, key]));
  Object.assign(ui, { craftImages: { Makeup: 1 }, useTheme: () => ({ styles: {}, colors: {}, theme: 'minimal', mode: 'light' }) });
  const calls = [];
  const mod = load('../src/screens/Marketplace.tsx', { react, 'react/jsx-runtime': { jsx, jsxs: jsx }, 'react-native': { View: 'View', Text: 'Text', ScrollView: 'ScrollView', Pressable: 'Pressable', Image: 'Image', useWindowDimensions: () => ({ width: 430 }) }, '../ui': ui, '../lib/servicePresentation': { serviceImages: { 'bridal-makeup': 1, 'event-photography': 2 } }, '../domain': { categoryLabels: { Makeup: 'Makeup artist' } }, '../lib/serviceCatalog': { visibleCategories: ['Makeup'] }, '../hooks': { useResource: () => ({ data: [], refresh: async () => {} }), useForegroundRefresh: () => {} }, './CraftServices': { CraftServiceSheet: 'CraftServiceSheet' }, '../components/LocationPicker': { LocationPicker: 'LocationPicker' }, '../components/OccasionBanners': { OccasionBanners: 'OccasionBanners', seasonalBodyBackground: () => ({}) }, '../components/NotificationCenter': { NotificationBell: 'NotificationBell' } });
  const render = () => { cursor = 0; return mod.Home({ center: [77, 12], locationLabel: 'Test area', onLocationChange() {}, onDiscover: (...args) => calls.push(args), onRequest() {}, onBookings() {} }); };
  function nodes(node) { if (!node || typeof node !== 'object') return []; if (Array.isArray(node)) return node.flatMap(nodes); return [node, ...nodes(node.props.children)]; }
  const find = predicate => { const result = nodes(render()).find(predicate); assert.ok(result); return result; };
  assert.equal(find(n => n.type === 'CraftServiceSheet').props.category, null);
  find(n => n.type === 'Segmented').props.onChange('schedule');
  find(n => n.props.accessibilityLabel === 'Find makeup artist').props.onPress();
  assert.equal(calls.length, 0); assert.equal(find(n => n.type === 'CraftServiceSheet').props.category, 'Makeup');
  assert.equal(find(n => n.type === 'CraftServiceSheet').props.availableNow, false);
  find(n => n.type === 'CraftServiceSheet').props.onChoose('Makeup', 'bridal-makeup');
  assert.deepEqual(calls[0], ['Makeup', false, undefined, 'bridal-makeup']);
  assert.equal(find(n => n.type === 'CraftServiceSheet').props.category, null);
});

test('profile service cards retain selection through booking and show details before services', () => {
  const slots = []; let cursor = 0; const jsx = (type, props) => ({ type, props: props || {} });
  const react = { useState: initial => { const i = cursor++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = value; }]; } };
  const domain = load('../src/domain.ts');
  const person = { id: 'p1', category: 'Makeup', display_name: 'innermost0123' };
  const services = [{ id: 's1', name: 'Bridal makeup', service_key: 'bridal-makeup', amount_paise: 500000, duration_minutes: 60 }, { id: 's2', name: 'Party makeup', service_key: 'party-makeup', amount_paise: 100000, duration_minutes: 60 }];
  const ui = Object.fromEntries(['Button', 'Icon', 'IconButton', 'TextButton', 'Notice', 'EmptyState'].map(key => [key, key]));
  Object.assign(ui, { welcomeImages: { Makeup: 9 }, useTheme: () => ({ styles: {}, colors: { line: '#ddd' } }) });
  const mocks = { react, 'react/jsx-runtime': { jsx, jsxs: jsx }, 'react-native': { View: 'View', Text: 'Text', ScrollView: 'ScrollView', Pressable: 'Pressable', Image: 'Image' }, '../ui': ui, '../domain': domain, '../lib/servicePresentation': { serviceImages: { 'bridal-makeup': 1, 'party-makeup': 2 } }, '../hooks': { useResource: (fn, key, namespace) => ({ data: namespace === 'services' ? services : namespace === 'professional-profile' ? person : [], refresh() {} }), useForegroundRefresh() {}, useAvailability: () => ({ data: { available_now: true } }) }, '../components/ProfessionalDetails': { ProfessionalDetails: 'ProfessionalDetails' }, '../components/ProfessionalProfileHeader': { ProfessionalProfileHeader: 'ProfessionalProfileHeader' }, '../components/ProfessionalReviews': { ProfessionalReviews: 'ProfessionalReviews' }, '../components/PortfolioGallery': { PortfolioGallery: 'PortfolioGallery' }, '../components/PriceBreakdown': { PriceBreakdown: 'PriceBreakdown' } };
  const mod = load('../src/screens/Marketplace.tsx', mocks); let booked;
  function walk(node) { if (Array.isArray(node)) return node.flatMap(walk); if (!node || typeof node !== 'object') return []; return [node, ...walk(node.props.children)]; }
  const nodes = () => { cursor = 0; return walk(mod.Profile({ person, userId: 'customer', preferredServiceKey: 'bridal-makeup', onBook: value => { booked = value; }, onCompare() {}, selectedForCompare: false })); };
  const radios = () => nodes().filter(n => n.props.accessibilityRole === 'radio');
  assert.deepEqual(radios().map(n => n.props.accessibilityState.checked), [true, false]);
  assert.ok(nodes().findIndex(n => n.type === 'ProfessionalDetails') < nodes().findIndex(n => n.props.accessibilityRole === 'radiogroup'));
  radios()[1].props.onPress();
  assert.deepEqual(radios().map(n => n.props.accessibilityState.checked), [false, true]);
  nodes().find(n => n.props.title === 'Book this session').props.onPress(); assert.equal(booked.id, 's2');
});
