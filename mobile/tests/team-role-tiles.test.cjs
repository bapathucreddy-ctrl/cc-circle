const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
test('craft tiles add unique team members and support repeated additions and preserve quantities until explicitly removed',()=>{
 const slots=[];let cursor=0;const jsx=(type,props)=>({type,props:props||{}});
 const react={useState:initial=>{const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value;}];},useEffect(){}};
 const ui=new Proxy({useTheme:()=>({styles:{},colors:{}})},{get:(target,name)=>target[name]||name});
 const output={};const code=ts.transpileModule(fs.readFileSync(require.resolve('../src/screens/TeamRequests.tsx'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 vm.runInNewContext(code,{exports:output,Date,require:name=>name==='react'?react:name==='react/jsx-runtime'?{jsx,jsxs:jsx}:name==='react-native'?Object.fromEntries(['View','Text','Pressable'].map(key=>[key,key])):name==='../ui'?ui:name==='../domain'?{categoryLabels:{Makeup:'Makeup artist',Photographer:'Photographer'}}:name==='../lib/serviceCatalog'?{visibleCategories:['Makeup','Photographer']}:name==='../lib/requestId'?{createRequestId:()=> 'test'}:new Proxy({},{get:(_,key)=>key})});
 function walk(node){if(Array.isArray(node))return node.flatMap(walk);if(!node||typeof node!=='object')return[];return[node,...walk(node.props.children)];}
 const nodes=()=>{cursor=0;return walk(output.TeamRequestForm({center:[77,12],onPosted(){}}));};
 const tile=label=>nodes().find(n=>n.props.accessibilityLabel==='Add '+label+' to team');
 tile('Makeup artist').props.onPress();assert.equal(tile('Makeup artist').props.accessibilityState.selected,true);
 const count=label=>nodes().find(n=>String(n.props.accessibilityLabel||'').startsWith(label+' count '))?.props.children || 0;
 tile('Makeup artist').props.onPress();tile('Makeup artist').props.onPress();assert.equal(count('Makeup artist'),3);
 tile('Photographer').props.onPress();assert.equal(count('Makeup artist'),3);assert.equal(count('Photographer'),1);
 for(let i=0;i<30;i++)tile('Makeup artist').props.onPress();assert.equal(count('Makeup artist'),20);assert.equal(tile('Makeup artist').props.disabled,true);
 for(let i=0;i<20;i++)nodes().find(n=>n.props.accessibilityLabel==='Decrease Makeup artist count').props.onPress();
 assert.equal(tile('Makeup artist').props.accessibilityState.selected,false);assert.equal(count('Photographer'),1);

});
