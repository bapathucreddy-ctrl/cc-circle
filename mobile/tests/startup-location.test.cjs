const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject}};
function fixture({gps,address=async()=> 'MG Road, Bengaluru'}={}){
 const state=[],refs=[],effects=[];let si=0,ri=0,first=true,foreground;const exports={};
 const react={useState:initial=>{const i=si++;if(first)state[i]=initial;return[state[i],value=>{state[i]=typeof value==='function'?value(state[i]):value}]},useRef:initial=>{const i=ri++;if(first)refs[i]={current:initial};return refs[i]},useCallback:fn=>fn,useEffect:fn=>{if(first)effects.push(fn)}};
 const requires={react,'react-native':{AppState:{addEventListener:(_,cb)=>{foreground=cb;return{remove(){foreground=null}}}}},'./domain':{bengaluru:[77.5946,12.9716],errorText:e=>e.message},'./lib/currentLocation':{currentLocation:gps},'./lib/deviceLocation':{coordinateLocationLabel:point=>point[1]+', '+point[0],deviceLocationLabel:address}};
 const source=ts.transpileModule(fs.readFileSync(require.resolve('../src/useInitialDeviceLocation.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(source,{exports,require:name=>requires[name],AbortController});
 const render=()=>{si=0;ri=0;const result=exports.useInitialDeviceLocation();first=false;return result};
 render();const cleanup=effects[0]();return{render,resume:()=>foreground?.('active'),cleanup};
}
const fix=(lng,lat)=>({coords:{longitude:lng,latitude:lat,accuracy:15}});
test('startup centers on fresh GPS before address lookup and late lookup cannot overwrite a manual selection',async()=>{
 const gps=deferred(),address=deferred();const f=fixture({gps:()=>gps.promise,address:()=>address.promise});
 gps.resolve(fix(77.7,12.9));await tick();assert.deepEqual([...f.render().center],[77.7,12.9]);assert.match(f.render().label,/12.9/);
 f.render().changeLocation([77.8,13.1],'Selected apartment');address.resolve('Old GPS address');await tick();
 assert.deepEqual([...f.render().center],[77.8,13.1]);assert.equal(f.render().label,'Selected apartment');f.cleanup();
});
test('GPS follows foreground reopen, while a chosen search address remains selected',async()=>{
 let calls=0;const f=fixture({gps:async()=>fix(77+(++calls)/10,12.9)});await tick();assert.equal(f.render().label,'MG Road, Bengaluru');
 f.resume();await tick();assert.equal(calls,2);assert.equal(f.render().center[0],77.2);
 f.render().changeLocation([78,13],'Chosen venue');f.resume();await tick();assert.equal(calls,2);assert.equal(f.render().label,'Chosen venue');
 f.render().changeLocation([77.2,12.9],'GPS address','gps');f.resume();await tick();assert.equal(calls,3);f.cleanup();
});
test('permission failure asks for a location instead of claiming the default city is GPS',async()=>{
 const f=fixture({gps:async()=>{throw Error('Allow location access')}});await tick();assert.equal(f.render().label,'Choose your location');assert.equal(f.render().error,'Allow location access');f.cleanup();
});
test('GPS resolving after unmount cannot update location state',async()=>{
 const gps=deferred();const f=fixture({gps:()=>gps.promise});const before=f.render().label;f.cleanup();gps.resolve(fix(78,13));await tick();assert.equal(f.render().label,before);
});
test('GPS address helper returns coordinates when lookup fails and labels approximate addresses honestly',async()=>{
 let response='Indiranagar, Bengaluru';const exports={};const source=ts.transpileModule(fs.readFileSync(require.resolve('../src/lib/deviceLocation.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(source,{exports,require:()=>({liveLocationAddress:async()=>{if(response instanceof Error)throw response;return response}}),AbortController,setTimeout,clearTimeout});
 assert.equal(await exports.deviceLocationLabel([77.64,12.97],500),'Indiranagar, Bengaluru · approximate area');
 response=new Error('offline');assert.equal(await exports.deviceLocationLabel([77.64,12.97],20),'12.97000, 77.64000');
});
