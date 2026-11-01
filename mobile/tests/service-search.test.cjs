const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');
function load(file,mocks={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve(file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:name=>mocks[name]||{}});return exports;}
const domain=load('../src/domain.ts');const catalog=load('../src/lib/serviceCatalog.ts');const search=load('../src/lib/serviceSearch.ts',{'../domain':domain,'./serviceCatalog':catalog});
test('wedding search returns relevant services across professions, including bride, groom and reels',()=>{
 const rows=search.searchServiceSuggestions('wedding');const keys=rows.map(row=>row.key);for(const key of ['wedding-photography','bridal-makeup','groom-makeup','wedding-makeup','event-reels'])assert.ok(keys.includes(key),key);assert.ok(!keys.includes('product-photography'));assert.equal(rows.find(row=>row.key==='event-reels').label,'Wedding reels');
 assert.deepEqual(Array.from(search.searchServiceSuggestions('wedding photography').map(row=>row.category)),['Photographer','Photographer']);
});
test('search tolerates common typing mistakes, prefixes, alternate occasion words and live admin labels',()=>{
 for(const query of ['wed','weding','weddding','shaadi'])assert.ok(search.searchServiceSuggestions(query).some(row=>row.key==='wedding-photography'),query);
 assert.equal(search.searchServiceSuggestions('bride makeup')[0].key,'bridal-makeup');
 assert.equal(search.searchServiceSuggestions('Diamond bridal',{'bridal-makeup':'Diamond bridal experience'})[0].label,'Diamond bridal experience');
 assert.equal(search.searchServiceSuggestions('wedding',{'event-reels':'Celebration films'}).find(row=>row.key==='event-reels').label,'Celebration films');
 assert.equal(search.searchServiceSuggestions('').length,0);assert.equal(search.searchServiceSuggestions('unrelatedsearch').length,0);assert.equal(search.searchServiceSuggestions('x').length,0);
});
test('Home search selection routes with category and stable service key, supports keyboard selection and clear',()=>{
 const slots=[];let cursor=0;const jsx=(type,props)=>({type,props:props||{}});const react={useState(initial){const i=cursor++;if(!(i in slots))slots[i]=initial;return[slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value;}];}};const calls=[],fallback=[];let dismissed=0;
 const mod=load('../src/components/HomeServiceSearch.tsx',{react,'react/jsx-runtime':{jsx,jsxs:jsx},'react-native':{View:'View',Text:'Text',TextInput:'Input',Image:'Image',Pressable:'Pressable',Keyboard:{dismiss(){dismissed++;}}},'../domain':domain,'../lib/serviceSearch':search,'../lib/useServiceImages':{useServiceNames:()=>({}),useServiceImages:()=>({})},'../ui':{Icon:'Icon',useTheme:()=>({colors:{},styles:{}})}});
 const render=()=>{cursor=0;return mod.HomeServiceSearch({onChoose:(...args)=>calls.push(args),onSearchProfessionals:q=>fallback.push(q)});};
 function walk(node){if(!node||typeof node!=='object')return[];if(Array.isArray(node))return node.flatMap(walk);return[node,...walk(node.props.children)];}const find=p=>{const result=walk(render()).find(p);assert.ok(result);return result;};
 find(n=>n.type==='Input').props.onChangeText('wedding');find(n=>n.props.accessibilityLabel==='Wedding photography, Photographer').props.onPress();assert.deepEqual(calls[0],['Photographer','wedding-photography']);assert.equal(dismissed,1);
 find(n=>n.type==='Input').props.onChangeText('bride makeup');find(n=>n.type==='Input').props.onSubmitEditing();assert.deepEqual(calls[1],['Makeup','bridal-makeup']);
 find(n=>n.type==='Input').props.onChangeText('unknownperson');find(n=>n.type==='Input').props.onSubmitEditing();assert.deepEqual(fallback,['unknownperson']);
 find(n=>n.props.accessibilityLabel==='Clear service search').props.onPress();assert.equal(find(n=>n.type==='Input').props.value,'');
});
