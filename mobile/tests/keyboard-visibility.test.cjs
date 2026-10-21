const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, requireModule, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(require.resolve(file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(code, { exports, require: requireModule, ...globals });
  return exports;
}
const math = load('../src/lib/keyboardVisibility.ts', () => { throw Error('Unexpected dependency'); });

test('keyboard scrolling reveals obscured fields without moving already visible fields', () => {
  assert.equal(math.keyboardScrollAdjustment(460, 48, 80, 400), 128);
  assert.equal(math.keyboardScrollAdjustment(160, 48, 80, 400), 0);
  assert.equal(math.keyboardScrollAdjustment(70, 48, 80, 400), -30);
  assert.equal(math.keyboardScrollAdjustment(100, 48, 80, 400), 0);
  assert.equal(math.keyboardScrollAdjustment(332, 48, 80, 400), 0);
});

test('large multiline inputs keep their start visible and a fully covered viewport does not jump', () => {
  assert.equal(math.keyboardScrollAdjustment(200, 450, 80, 400), 100);
  assert.equal(math.keyboardScrollAdjustment(100, 450, 80, 400), 0);
  assert.equal(math.keyboardScrollAdjustment(100, 48, 80, 90), 0);
});

function fixture(horizontal = false) {
  const effects = [], frames = new Map(), listeners = new Map(), scrolls = [];
  let frameId = 0, inputTop = 450, inputHeight = 48, visibleHeight = 700;
  const input = { measureInWindow: callback => callback(0, inputTop, 200, inputHeight) };
  const native = { getNativeScrollRef: () => ({ measureInWindow: callback => callback(0, 80, 350, visibleHeight) }), scrollTo: value => scrolls.push(value) };
  const react = {
    forwardRef: callback => callback, useRef: value => ({ current: value }), useState: value => [value, () => {}],
    useCallback: callback => callback, useEffect: callback => effects.push(callback),
    useImperativeHandle() {},
  };
  const rn = { ScrollView: 'ScrollView', Platform: { OS: 'android' }, StyleSheet: { flatten: value => value },
    TextInput: { State: { currentlyFocusedInput: () => input } },
    Keyboard: { addListener: (name, callback) => { listeners.set(name, callback); return { remove: () => listeners.delete(name) }; } },
  };
  const exports = load('../src/components/KeyboardAwareScrollView.tsx', name => {
    if (name === 'react') return react;
    if (name === 'react-native') return rn;
    if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }) };
    if (name === '../lib/keyboardVisibility') return math;
    throw Error(name);
  }, { requestAnimationFrame: callback => { frames.set(++frameId, callback); return frameId; }, cancelAnimationFrame: id => frames.delete(id) });
  const node = exports.KeyboardAwareScrollView({ horizontal }, null);
  node.props.ref.current = native;
  const cleanup = effects.map(effect => effect()).filter(Boolean);
  const flush = () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback()); };
  return { node, listeners, scrolls, flush, cleanup: () => cleanup.forEach(callback => callback()),
    setInput: (top, height = 48) => { inputTop = top; inputHeight = height; }, setHeight: value => { visibleHeight = value; }, frames };
}

test('keyboard opening and switching fields while open reveal the active input and preserve scroll offset', () => {
  const f = fixture();
  f.node.props.onFocus({}); f.flush();
  assert.equal(f.scrolls.length, 0);
  f.listeners.get('keyboardDidShow')({ endCoordinates: { screenY: 400 } }); f.flush();
  assert.equal(f.scrolls.at(-1).y, 118);
  f.node.props.onScroll({ nativeEvent: { contentOffset: { y: 118 } } });
  f.setInput(430);
  f.node.props.onBlur({}); f.node.props.onFocus({}); f.flush();
  assert.equal(f.scrolls.at(-1).y, 216);
  f.cleanup();
  assert.equal(f.listeners.size, 0);
  assert.equal(f.frames.size, 0);
});

test('resized viewport keeps fields clear of footer controls; blur and horizontal carousels do not scroll', () => {
  const f = fixture(); f.setHeight(260); f.node.props.onFocus({}); f.flush();
  assert.equal(f.scrolls.at(-1).y, 178);
  f.node.props.onBlur({}); f.setInput(600);
  const previous = f.scrolls.length;
  f.listeners.get('keyboardDidShow')({ endCoordinates: { screenY: 400 } }); f.flush();
  assert.equal(f.scrolls.length, previous); f.cleanup();
  const carousel = fixture(true); carousel.node.props.onFocus({}); carousel.flush();
  assert.equal(carousel.listeners.size, 0); assert.equal(carousel.scrolls.length, 0); carousel.cleanup();
});
