const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');
function load(fetch){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../src/lib/liveLocation.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,fetch,URLSearchParams,process:{env:{EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN:'fixture-public-token'}}});return exports;}
test('only available fresh GPS can create a pin, never a saved city or old/future position',()=>{
 const {hasLiveLocation}=load();const now=Date.now(),person={available_now:true,city:'Old profile city',longitude:77,latitude:12};
 assert.equal(hasLiveLocation(person,now),false);
 assert.equal(hasLiveLocation({...person,location_updated_at:new Date(now-1000).toISOString()},now),true);
 for(const age of [91000,-60000])assert.equal(hasLiveLocation({...person,location_updated_at:new Date(now-age).toISOString()},now),false);
 assert.equal(hasLiveLocation({...person,available_now:false,location_updated_at:new Date(now).toISOString()},now),false);
});
test('address lookup uses live longitude/latitude and an area for low precision, not profile text',async()=>{
 const calls=[];const api=load(async(url,options)=>{calls.push({url:new URL(url),options});return{ok:true,json:async()=>({features:[{properties:{name:'Current neighbourhood',place_formatted:'Current city'}}]})};});
 const controller=new AbortController();assert.equal(await api.liveLocationAddress(77.7,12.99,true,controller.signal),'Current neighbourhood, Current city');
 assert.equal(calls[0].url.searchParams.get('longitude'),'77.7');assert.equal(calls[0].url.searchParams.get('latitude'),'12.99');assert.equal(calls[0].url.searchParams.get('types'),'neighborhood,locality,place');assert.equal(calls[0].options.signal,controller.signal);
 await api.liveLocationAddress(77.7,12.99,false);assert.match(calls[1].url.searchParams.get('types'),/address/);
 assert.equal(await api.liveLocationAddress(NaN,12,true),null);assert.equal(calls.length,2);
 assert.equal(await load(async()=>({ok:false})).liveLocationAddress(77,12,false),null);
});
test('receiving a new GPS fix between expiry ticks never labels it future-dated or removes the address card',()=>{
 const exports={},helper=load();let now=Date.now(),state=[],cursor=0;const first={available_now:true,id:'pro',longitude:77.6,latitude:12.9,location_accuracy_meters:10,location_updated_at:new Date(now).toISOString()};
 const react={useState:initial=>{const i=cursor++;if(!(i in state))state[i]=initial;return[state[i],v=>state[i]=v]},useEffect(){}};
 const requires={react,'react/jsx-runtime':{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})},'react-native':{Text:'Text',View:'View'},'../ui':{useTheme:()=>({styles:{muted:{}}})},'../lib/liveLocation':{hasLiveLocation:(person,clock=now)=>helper.hasLiveLocation(person,clock)}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../src/components/ProfessionalLocation.tsx'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:n=>requires[n],Date:class extends Date{static now(){return now}}});
 exports.ProfessionalLocation({person:first});now+=12000;cursor=0;const result=exports.ProfessionalLocation({person:{...first,location_updated_at:new Date(now).toISOString(),longitude:77.61}});
 assert.ok(!JSON.stringify(result).includes('Current location unavailable'));assert.match(JSON.stringify(result),/77.61000/);
});
