const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, requires = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve(file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { exports, require: name => { if (name in requires) return requires[name]; throw Error(name); } });
  return exports;
}
function fixture(startCollapsed = false) {
  const states = [], refs = []; let state = 0, ref = 0;
  const react = {
    useState: initial => { const i = state++; if (!(i in states)) states[i] = initial; return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value; }]; },
    useRef: initial => { const i = ref++; return refs[i] || (refs[i] = { current: initial }); },
    useMemo: fn => fn(), useEffect: fn => fn(),
  };
  const { MapExperience } = load('../src/components/MapExperience.tsx', {
    react, 'react/jsx-runtime': { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    'react-native': { View: 'View', Text: 'Text', Pressable: 'Pressable', PanResponder: { create: handlers => ({ panHandlers: handlers }) } },
    './KeyboardAwareScrollView': { KeyboardAwareScrollView: 'ScrollView' }, './TalentMap': { TalentMap: 'Map' },
    '../lib/mapSheet': load('../src/lib/mapSheet.ts'), '../ui': { useTheme: () => ({ colors: {} }) },
  });
  function render() { state = 0; ref = 0; return MapExperience({ startCollapsed, map: { center: [77, 12], onSelect: person => selected.push(person.id) }, title: 'Professionals nearby', children: 'professionals', footer: 'Compare' }); }
  const selected = [];
  return { render, selected };
}
const map = tree => tree.props.children[0].props.children;
const sheet = tree => tree.props.children[2];

test('expanding the overlay keeps the same background map and its selection handler', () => {
  const f = fixture(); let tree = f.render();
  assert.equal(map(tree).props.immersive, true);
  assert.equal(map(tree).props.overlayBottom, 258);
  sheet(tree).props.children[1].props.onPress();
  tree = f.render();
  assert.equal(sheet(tree).props.style.height, 504);
  assert.equal(map(tree).type, 'Map');
  assert.equal(map(tree).props.cameraOverlayBottom, 504);
  map(tree).props.onSelect({ id: 'pro-1' });
  assert.deepEqual(f.selected, ['pro-1']);
  assert.equal(sheet(tree).props.children[3].props.children, 'Compare');
});

test('only the handle captures dragging; camera reframes after release and viewport resize', () => {
  const f = fixture(); let tree = f.render();
  const handle = sheet(tree).props.children[0].props;
  assert.equal(sheet(tree).props.onMoveShouldSetPanResponder, undefined);
  handle.onPanResponderGrant();
  handle.onPanResponderMove(null, { dy: -180 });
  tree = f.render();
  assert.equal(map(tree).props.overlayBottom, 438);
  assert.equal(map(tree).props.cameraOverlayBottom, 258);
  handle.onPanResponderRelease(null, { dy: -180, vy: -.5 });
  tree = f.render();
  assert.equal(map(tree).props.cameraOverlayBottom, 504);
  tree.props.onLayout({ nativeEvent: { layout: { height: 320 } } });
  tree = f.render();
  assert.equal(map(tree).props.height, 320);
  assert.ok(sheet(tree).props.style.height < 320);
  assert.equal(map(tree).props.overlayBottom, map(tree).props.cameraOverlayBottom);
});

test('mobile discovery starts collapsed and the header cycles through list sizes back to map-first', () => {
  const f = fixture(true); let tree = f.render();
  assert.equal(map(tree).props.overlayBottom,116);
  sheet(tree).props.children[1].props.onPress(); tree=f.render();
  assert.equal(map(tree).props.overlayBottom,258);
  sheet(tree).props.children[1].props.onPress(); tree=f.render();
  assert.equal(map(tree).props.overlayBottom,504);
  sheet(tree).props.children[1].props.onPress(); tree=f.render();
  assert.equal(map(tree).props.overlayBottom,116);
});

test('map view controls stay hidden until requested and selecting a preset closes the panel', () => {
  let open=false; const lighting=[];
  const jsx=(type,props)=>({type,props});
  const {MapControls}=load('../src/components/MapControls.tsx',{
    react:{useState:()=>[open,value=>{open=typeof value==='function'?value(open):value;}]},
    'react/jsx-runtime':{jsx,jsxs:jsx},'react-native':{Pressable:'Pressable',Text:'Text',View:'View'},
    '../ui':{Icon:'Icon',useTheme:()=>({colors:{}})},
    '../lib/mapStyle':{mapLightPresets:['dawn','day','dusk','night']},
  });
  function nodes(node){if(Array.isArray(node))return node.flatMap(nodes);if(!node||typeof node!=='object')return [];return [node,...nodes(node.props?.children)];}
  const render=()=>MapControls({aerial:false,onAerial(){},lightPreset:'day',onLightPreset:value=>lighting.push(value),onRecenter(){}});
  let tree=render();assert.equal(nodes(tree).filter(n=>n.type==='Pressable').length,2);
  nodes(tree).find(n=>n.props?.accessibilityLabel==='Map view options').props.onPress();tree=render();
  nodes(tree).find(n=>n.props?.accessibilityLabel==='dusk map lighting').props.onPress();
  assert.deepEqual(lighting,['dusk']);assert.equal(nodes(render()).filter(n=>n.type==='Pressable').length,2);
});
