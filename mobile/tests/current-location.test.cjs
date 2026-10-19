const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');
function fixture({web=true,secure=true,granted=true}={}){
 const calls=[];const location={Accuracy:{High:4},requestForegroundPermissionsAsync:async()=>{calls.push('permission');return{granted};},getCurrentPositionAsync:async options=>{calls.push(options);return{coords:{longitude:77.64,latitude:12.97},timestamp:Date.now()};}};
 const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../src/lib/currentLocation.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,isSecureContext:secure,require:name=>name==='expo-location'?location:{Platform:{OS:web?'web':'android'}}});return{read:exports.currentLocation,calls};
}
test('browser GPS explicitly rejects cached fixes and uses a bounded fresh-position request',async()=>{
 const f=fixture();await f.read();assert.equal(f.calls[1].maximumAge,0);assert.equal(f.calls[1].timeout,15000);assert.equal(f.calls[1].accuracy,4);
 const native=fixture({web:false});await native.read();assert.equal(native.calls[1].maximumAge,undefined);
});
test('insecure browsers and permission denial give actionable errors without reading GPS',async()=>{
 const insecure=fixture({secure:false});await assert.rejects(insecure.read(),/HTTPS/);assert.equal(insecure.calls.length,0);
 const denied=fixture({granted:false});await assert.rejects(denied.read(),/Allow location access/);assert.equal(denied.calls.length,1);
});
