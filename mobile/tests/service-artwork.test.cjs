const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
test('shared service artwork refreshes live, retains images offline and restores bundled defaults',async()=>{
 let data=[{service_key:'party-makeup',image_path:'owner/new.jpg'}],fail=false,calls=0,tick,getSnapshot,foreground,removed=false;
 const subscriptions=[],cleanups=[],defaults={'party-makeup':101,'bridal-makeup':102},appState={currentState:'active',addEventListener(_,callback){foreground=callback;return{remove(){removed=true;}};}};
 const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../src/lib/useServiceImages.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{
  exports,setInterval(callback){tick=callback;return 1;},clearInterval(){tick=null;},
  require(name){return name==='react'?{useSyncExternalStore(subscribe,snapshot){getSnapshot=snapshot;const listener=()=>{};subscriptions.push(listener);cleanups.push(subscribe(listener));return snapshot();}}:name==='react-native'?{AppState:appState}:name==='./servicePresentation'?{serviceImages:defaults}:{supabase:{from(table){calls++;return{select(){return{order:async()=>{if(fail)throw Error('offline');return{data:table==='service_types'?[{key:'party-makeup',label:'Party glam'}]:data,error:null};}};}};},storage:{from:()=>({getPublicUrl:path=>({data:{publicUrl:'https://images.example/'+path}})})}}};}
 });
 assert.equal(exports.useServiceImages()['party-makeup'],101);
 await new Promise(setImmediate);assert.equal(getSnapshot()['party-makeup'].uri,'https://images.example/owner/new.jpg');assert.equal(getSnapshot()['bridal-makeup'],102);
 exports.useServiceImages();assert.equal(calls,2,'multiple cards share one shared artwork/catalog refresh');
 fail=true;tick();await new Promise(setImmediate);assert.equal(getSnapshot()['party-makeup'].uri,'https://images.example/owner/new.jpg');
 fail=false;data=[];foreground('active');await new Promise(setImmediate);assert.equal(getSnapshot()['party-makeup'],101);
 exports.useServiceNames();assert.equal(getSnapshot()['party-makeup'],'Party glam');
 cleanups.forEach(cleanup=>cleanup());assert.equal(tick,null);assert.equal(removed,true);
});
