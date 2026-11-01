const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function fixture(){
 const refs=[],states=[],deps=[];let r=0,s=0,e=0,effects=[],props,tree;const focused=[],scrolls=[];
 const react={useRef(initial){const index=r++;return refs[index]||(refs[index]={current:initial});},useState(initial){const index=s++;if(!(index in states))states[index]=initial;return[states[index],value=>states[index]=value];},useEffect(callback,next){const index=e++;if(!deps[index]||next.some((v,i)=>v!==deps[index][i])){effects.push(callback);deps[index]=next;}}};
 const jsx=(type,props)=>({type,props});const exports={};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../src/components/NearbyCarousel.tsx'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:name=>name==='react'?react:name==='react/jsx-runtime'?{jsx,jsxs:jsx}:name==='react-native'?{View:'View',Text:'Text',FlatList:'FlatList',Pressable:'Pressable'}:{Icon:'Icon',useTheme:()=>({colors:{}})}});
 function render(next){props={...props,...next};r=s=e=0;effects=[];tree=exports.NearbyCarousel({...props,onFocus:id=>focused.push(id),renderCard:person=>person.id});refs[0].current={scrollToIndex:options=>scrolls.push(options.index),scrollToOffset(){}};effects.forEach(fn=>fn());return tree;}
 function list(){return tree.props.children[0].props;}
 return{render,list,focused,scrolls};
}
test('swiping selects a map pin; pin selection scrolls the matching card without reordering results',()=>{
 const f=fixture(),people=[{id:'a'},{id:'b'},{id:'c'}];f.render({people,focusedId:'a'});assert.equal(f.scrolls.at(-1),0);
 f.list().onScrollBeginDrag();f.list().onViewableItemsChanged({viewableItems:[{item:people[1],isViewable:true}]});assert.equal(f.focused.at(-1),'b');
 f.render({focusedId:'c'});assert.equal(f.scrolls.at(-1),2);assert.deepEqual(f.list().data.map(p=>p.id),['a','b','c']);
 const count=f.focused.length;f.list().onViewableItemsChanged({viewableItems:[{item:people[1],isViewable:true}]});assert.equal(f.focused.length,count,'intermediate cards cannot override a selected pin');
 f.list().onViewableItemsChanged({viewableItems:[{item:people[2],isViewable:true}]});f.list().onScrollBeginDrag();f.list().onViewableItemsChanged({viewableItems:[{item:people[0],isViewable:true}]});assert.equal(f.focused.at(-1),'a');
});
test('refresh retains the focused professional, and removed results select a valid remaining card',()=>{
 const f=fixture();f.render({people:[{id:'a'},{id:'b'}],focusedId:'b'});const calls=f.scrolls.length;
 f.render({people:[{id:'a'},{id:'b'}]});assert.equal(f.scrolls.length,calls,'same result identities do not reset the carousel');
 f.render({people:[{id:'a'}]});assert.equal(f.focused.at(-1),'a');
 f.render({people:[]});assert.equal(f.list().data.length,0);
});
