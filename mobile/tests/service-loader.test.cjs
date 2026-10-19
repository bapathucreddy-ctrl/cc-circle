const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),ts=require('typescript');
test('service loading animation uses five active crafts, respects reduced motion and stops on cleanup',async()=>{
 const output={},slots=[],effects=[];let cursor=0,starts=0,stops=0,listener;const jsx=(type,props)=>({type,props});
 class Value{constructor(value){this.value=value;}setValue(value){this.value=value;}interpolate(config){return config;}}
 const react={useState:init=>{const i=cursor++;if(!(i in slots))slots[i]=init;return[slots[i],value=>{slots[i]=value;}];},useRef:init=>{const i=cursor++;return slots[i]||=( {current:init});},useEffect:fn=>effects.push(fn)};
 const crafts=['Makeup','Photographer','Editor','HairStylist','ContentCreator'];
 const animated={Value,View:'AnimatedView',timing:()=>({}),sequence:()=>({}),stagger:()=>({}),loop:()=>({start(){starts++;},stop(){stops++;}})};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../src/components/ServiceLoader.tsx'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports:output,require:name=>name==='react'?react:name==='react/jsx-runtime'?{jsx,jsxs:jsx}:name==='react-native'?{Animated:animated,View:'View',Platform:{OS:'android'},Easing:{quad:1,inOut:value=>value},AccessibilityInfo:{isReduceMotionEnabled:async()=>false,addEventListener:(_event,fn)=>{listener=fn;return{remove(){}};}}}:name==='../lib/serviceCatalog'?{visibleCategories:crafts}:{ServiceCraftIcon:'ServiceCraftIcon'}});
 function render(){cursor=0;effects.length=0;return output.ServiceLoader({});}
 const first=render();assert.equal(first.props.children.length,5);effects[0]();effects[1]();assert.equal(starts,0);
 await new Promise(setImmediate);render();const cleanup=effects[1]();assert.equal(starts,1);cleanup();assert.equal(stops,1);
 listener(true);const reduced=render();effects[1]();assert.equal(starts,1);assert.ok(reduced.props.children.every(item=>item.props.style.opacity===1));
});
