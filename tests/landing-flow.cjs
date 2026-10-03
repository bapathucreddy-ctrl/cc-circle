const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = fs.readFileSync('src/app/index.tsx', 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText;
function render(state) {
  const routes = [];
  const context = { exports: {}, require(name) {
    if (name === 'react') return { createElement: (type, props, ...children) => ({ type, props, children }) };
    if (name === 'expo-router') return { router: { push: route => routes.push(route) } };
    if (name === 'react-native') return { Image: 'Image', View: 'View', useWindowDimensions: () => ({ width: 1200 }) };
    if (name.endsWith('/UI')) return { Button: 'Button', Page: 'Page', Text: 'Text', c: {}, s: {} };
    if (name.endsWith('/Typography')) return { headingFont: 'serif' };
    if (name.endsWith('/CircleContext')) return { useCircle: () => state };
    if (name.endsWith('.jpg')) return 1;
    throw Error(`Unexpected import: ${name}`);
  }};
  vm.runInNewContext(code, context);
  const tree = context.exports.default();
  const buttons = [];
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(visit);
    if (node.type === 'Button') buttons.push(node);
    node.children?.forEach(visit);
  }
  visit(tree);
  assert.equal(buttons.length, 2, 'Landing must expose only its two main buttons');
  return { buttons, routes };
}
for (const ready of [false, true]) for (const user of [null, { role: 'talent' }, { role: 'buyer' }]) {
  const { buttons, routes } = render({ ready, user });
  for (const button of buttons) button.props.onPress();
  if (!ready) { assert.equal(routes.length, 0); assert.ok(buttons.every(b => b.props.disabled)); }
  else if (user) assert.deepEqual(routes, ['/community', '/community']);
  else {
    assert.equal(routes[0].pathname, '/auth');
    assert.equal(routes[1].pathname, '/auth');
    assert.equal(routes[0].params.mode, 'signin');
    assert.equal(routes[0].params.role, 'buyer');
    assert.equal(routes[1].params.role, 'talent');
  }
}
console.log('Landing routing checks passed');
