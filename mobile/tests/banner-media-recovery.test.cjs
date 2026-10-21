const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, dependencies = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve(file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, {
    exports, URL, atob, Date, require: name => dependencies[name] || {},
  });
  return exports;
}
test('seasonal colours follow the active banner and keep header text readable', () => {
  const { campaignBackground, campaignForeground, blendCampaignColor } = load('../src/lib/campaignColors.ts');
  const navratri = campaignBackground('navratri-garba'), diwali = campaignBackground('diwali'), wedding = campaignBackground('wedding-season');
  assert.equal(navratri, '#013832'); assert.equal(diwali, '#6A1F37'); assert.equal(wedding, '#DC9D88');
  assert.equal(campaignBackground('custom-banner', '#DCA088'), '#DCA088');
  assert.equal(campaignBackground('custom-banner', 'url(invalid)'), '#202020');
  assert.equal(campaignForeground(navratri), '#FFF6DD'); assert.equal(campaignForeground(wedding), '#17201D');
  for (const color of [navratri, diwali, wedding]) {
    assert.equal(blendCampaignColor(color, '#ffffff', 0).toLowerCase(), color.toLowerCase());
    assert.equal(blendCampaignColor(color, '#ffffff', 1), '#ffffff');
    assert.notEqual(blendCampaignColor(color, '#ffffff', .5), color.toLowerCase());
  }
});

test('uploaded artwork uses its public marketing URL, original proportions and configured header colour', () => {
  const jsx = (type, props) => ({ type, props });
  let refreshedEvery;
  const campaign = {featured_service_keys:['bridal-makeup','wedding-photography','photo-editing'],id:'custom',title:'Finished artwork',subtitle:'Wedding campaign',category:'Makeup',image_path:'owner/art.png',image_width:1200,image_height:800,background_color:'#E0A090'};
  const {OccasionBanners} = load('../src/components/OccasionBanners.tsx', {
    react:{useEffect(){}},'react/jsx-runtime':{jsx,jsxs:jsx},
    'react-native':{Image:'Image',Pressable:'Pressable',ScrollView:'ScrollView',Text:'Text',View:'View',Platform:{OS:'web'}},
    '../hooks':{useResource:()=>({data:[campaign]}),useForegroundRefresh:(_refresh,interval)=>{refreshedEvery=interval;}},
    '../lib/supabase':{supabase:{storage:{from:bucket=>{assert.equal(bucket,'home-banners');return {getPublicUrl:path=>({data:{publicUrl:'https://example.test/'+path}})};}}}},
    '../lib/serviceCatalog':load('../src/lib/serviceCatalog.ts'),'../lib/campaignColors':load('../src/lib/campaignColors.ts'),'../lib/servicePresentation':{serviceImages:{}},
    '../ui':{welcomeImages:{},useTheme:()=>({colors:{panel:'#ffffff'}})},
  });
  const calls=[];const tree=OccasionBanners({onChoose:(...args)=>calls.push(args)});
  const hero=tree.props.children[1].props.children[0];
  assert.equal(tree.props.style.backgroundColor,'#E0A090');
  assert.equal(hero.props.style({pressed:false}).aspectRatio,1.5);
  assert.equal(hero.props.children.props.source.uri,'https://example.test/owner/art.png');
  assert.equal(hero.props.children.props.resizeMode,'contain');
  function nodes(node){if(Array.isArray(node))return node.flatMap(nodes);if(!node||typeof node!=='object')return [];return [node,...nodes(node.props?.children)];}
  const picks=nodes(tree).filter(node=>node.type==='Pressable' && node.props.accessibilityLabel?.startsWith('Explore '));
  assert.deepEqual(picks.map(node=>node.props.accessibilityLabel),['Explore Bridal makeup','Explore Wedding photography','Explore Photo editing']);
  picks[2].props.onPress();assert.equal(calls.pop()[0],'Editor');
  hero.props.onPress();assert.equal(calls[0][0],'Makeup');assert.equal(refreshedEvery,30000);
});
test('display cache rejects expired, nearly expired and malformed signed image links', () => {
  const { mediaUrlIsFresh } = load('../src/lib/mediaUrl.ts');
  const now = Date.now();
  const url = exp => 'https://example.test/image?token=head.' + Buffer.from(JSON.stringify({ exp })).toString('base64url') + '.sig';
  assert.equal(mediaUrlIsFresh(url(now / 1000 - 1), now), false);
  assert.equal(mediaUrlIsFresh(url(now / 1000 + 30), now), false);
  assert.equal(mediaUrlIsFresh(url(now / 1000 + 3600), now), true);
  assert.equal(mediaUrlIsFresh('https://example.test/image?token=broken', now), false);
  assert.equal(mediaUrlIsFresh('https://example.test/public-image', now), true);
});
test('portfolio forbidden errors retain HTTP status without displaying raw gateway details', async () => {
  const { portfolioAction } = load('../src/lib/portfolio.ts', { './supabase': { supabase: { functions: { invoke: async () => ({ error: { context: { status: 403, json: async () => ({ message: 'Forbidden', privateDiagnostic: 'do-not-display' }) } } }) } } } });
  await assert.rejects(() => portfolioAction('list'), error => error.message.includes('HTTP 403') && error.message.includes('access was denied') && !error.message.includes('do-not-display'));
});

test('seasonal artwork stays unobscured with descriptions accessible but no app-added caption', () => {
  const jsx = (type, props) => ({ type, props });
  for (const id of ['navratri', 'diwali', 'wedding']) {
    const { OccasionBanners } = load('../src/components/OccasionBanners.tsx', {
      react: { useEffect() {} }, 'react/jsx-runtime': { jsx, jsxs: jsx },
      'react-native': { Image: 'Image', Pressable: 'Pressable', ScrollView: 'ScrollView', Text: 'Text', View: 'View', Platform: { OS: 'web' } },
      '../hooks': { useResource: () => ({ data: [{ id, title: 'Seasonal artists', subtitle: 'Make your celebration special', category: 'Makeup' }] }), useForegroundRefresh() {} },
      '../lib/campaignColors': load('../src/lib/campaignColors.ts'), '../lib/servicePresentation': { campaignImages: { navratri: 1, diwali: 2, wedding: 3 }, serviceImages: {} },
      '../ui': { welcomeImages: {}, useTheme: () => ({ colors: { panel: '#ffffff' } }) },
    });
    const tree = OccasionBanners({ onChoose() {} });
    function nodes(node) { if (Array.isArray(node)) return node.flatMap(nodes); if (!node || typeof node !== 'object') return []; return [node, ...nodes(node.props?.children)]; }
    const all = nodes(tree), hero = all.find(node => node.type === 'Pressable' && node.props.accessibilityLabel === 'Seasonal artists');
    assert.equal(nodes(hero).filter(node => node.type === 'Image').length, 1);
    assert.equal(nodes(hero).filter(node => node.type === 'Text' || node.type === 'View').length, 0);
    assert.equal(hero.props.style({ pressed: false }).opacity, undefined);
    assert.equal(hero.props.style({ pressed: true }).opacity, undefined);
    assert.equal(all.some(node => node.type === 'Text' && node.props.children === 'Seasonal artists'), false);
    assert.equal(all.some(node => node.type === 'Text' && node.props.children === 'Make your celebration special'), false);
    assert.equal(hero.props.accessibilityHint, 'Make your celebration special');
  }
});
