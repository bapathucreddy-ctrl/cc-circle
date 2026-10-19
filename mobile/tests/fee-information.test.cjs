const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function component(file, name, props, platform = 'web') {
  const slots = []; let cursor = 0;
  const jsx = (type, props) => ({ type, props: props || {} });
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(require.resolve(file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { exports, require: id => id === 'react' ? { useState: initial => { const index = cursor++; if (!(index in slots)) slots[index] = initial; return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }]; } } : id === 'react/jsx-runtime' ? { jsx, jsxs: jsx, Fragment: 'Fragment' } : id === 'react-native' ? { Modal: 'Modal', Platform: { OS: platform }, Pressable: 'Pressable', ScrollView: 'ScrollView', Text: 'Text', View: 'View' } : id === '../domain' ? { money: value => `INR ${value / 100}` } : { Button: 'Button', TextButton: 'TextButton', Chip: 'Chip', useTheme: () => ({ styles: {}, colors: {} }) } });
  const render = () => { cursor = 0; return exports[name](props); };
  function walk(node) { if (Array.isArray(node)) return node.flatMap(walk); if (!node || typeof node !== 'object' || (node.type === 'Modal' && !node.props.visible)) return []; if (typeof node.type === 'function') return walk(node.type(node.props)); return [node, ...walk(node.props.children)]; }
  const nodes = () => walk(render());
  const find = predicate => { const found = nodes().find(predicate); assert.ok(found); return found; };
  return { nodes, find, texts: () => nodes().filter(n => n.type === 'Text').map(n => n.props.children), press: title => find(n => n.props.title === title).props.onPress() };
}
test('booking fee information supports web hover and mobile tap, showing the actual fee only', () => {
  for (const platform of ['web', 'android', 'ios']) {
    const view = component('../src/components/PriceBreakdown.tsx', 'BookingFeeInfo', { amountPaise: 4900 }, platform);
    const info = () => view.find(n => n.props.accessibilityLabel === 'Booking fee information');
    info().props.onHoverIn();
    assert.equal(view.texts().includes('INR 49'), platform === 'web');
    info().props.onHoverOut(); assert.ok(!view.texts().includes('INR 49'));
    info().props.onPress(); assert.ok(view.texts().includes('INR 49'));
    assert.ok(view.texts().includes('Payment handling')); assert.ok(view.texts().includes('INR 14.7'));
    assert.ok(view.texts().includes('Platform fee'));
    view.press('Got it'); assert.ok(!view.texts().includes('INR 49'));
    info().props.onFocus?.(); info().props.onHoverIn(); assert.ok(!view.texts().includes('INR 49'), 'Dismissal must not leave a tooltip behind or reopen it from restored focus');
    info().props.onHoverOut(); info().props.onHoverIn(); assert.equal(view.texts().includes('INR 49'), platform === 'web');
  }
});
test('expanding fee details preserves the quoted service, booking fee and total', () => {
  const view = component('../src/components/PriceBreakdown.tsx', 'PriceBreakdown', { servicePaise: 108700, bookingFeePaise: 4900, totalPaise: 113600, collapsible: true });
  assert.ok(view.texts().includes('INR 1136')); assert.ok(!view.texts().includes('INR 1087'));
  view.press('Show fee details'); assert.ok(view.texts().includes('INR 1087')); assert.ok(view.texts().includes('INR 49'));
  assert.ok(view.texts().includes('INR 1136')); view.press('Show less'); assert.ok(view.texts().includes('INR 1136'));
});
test('more preset fees remain editable and selecting an amount does not submit a payment', () => {
  let selected; const view = component('../src/components/FeePresets.tsx', 'FeePresets', { value: '500', onChange: value => { selected = value; } });
  assert.equal(view.nodes().filter(n => n.type === 'Chip').length, 6);
  view.press('More amounts'); assert.equal(view.nodes().filter(n => n.type === 'Chip').length, 12);
  view.find(n => n.type === 'Chip' && n.props.title === 'INR 15000').props.onPress(); assert.equal(selected, '15000');
});

 test('fee breakdown allocates the booking fee 70/30 without changing the quoted total', () => {
  const view = component('../src/components/PriceBreakdown.tsx', 'BookingFeeDetails', { amountPaise: 4900, servicePaise: 108700 });
  for (const text of ['Platform fee', 'Payment handling', 'Service fee', 'INR 49', 'INR 34.3', 'INR 14.7', 'INR 1087', 'INR 1136']) assert.ok(view.texts().includes(text));
});

test('booking fee allocation keeps both components equal to the original fee after rounding', () => {
  for (const fee of [1, 4900, 16300, 29900]) {
    const view = component('../src/components/PriceBreakdown.tsx', 'BookingFeeDetails', { amountPaise: fee });
    const amounts = view.texts().filter(value => typeof value === 'string' && value.startsWith('INR ')).map(value => Math.round(Number(value.slice(4)) * 100));
    assert.equal(amounts[0], Math.round(fee * .7)); assert.equal(amounts[0] + amounts[1], fee); assert.equal(amounts[2], fee);
  }
});
