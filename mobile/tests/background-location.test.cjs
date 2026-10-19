const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const tick=()=>new Promise(r=>setImmediate(r));
function fixture({os='android',grant=true}={}){
 const exports={},store=new Map(),writes=[],starts=[],tasks=new Map();let callback,watchRemoved=0,running=false,requests=0,now=Date.now(),user='pro-1',block,journeys=[],terminalRace=false;const queries=[];
 const fix=(lng=77.6,time=now)=>({timestamp:time,coords:{longitude:lng,latitude:12.9,accuracy:12}});
 const app={currentState:'active'};
 const location={ActivityType:{AutomotiveNavigation:2},Accuracy:{High:4,BestForNavigation:6},getForegroundPermissionsAsync:async()=>({granted:true}),requestForegroundPermissionsAsync:async()=>({granted:true}),getBackgroundPermissionsAsync:async()=>({granted:grant}),requestBackgroundPermissionsAsync:async()=>{requests++;return{granted:grant}},hasStartedLocationUpdatesAsync:async()=>running,stopLocationUpdatesAsync:async()=>{running=false},startLocationUpdatesAsync:async(name,options)=>{running=true;starts.push(options)},watchPositionAsync:async(options,fn)=>{callback=fn;return{remove(){watchRemoved++}}},getCurrentPositionAsync:async()=>fix()};
 const supabase={auth:{getSession:async()=>({data:{session:user?{user:{id:user}}:null}})},rpc:async(name,args)=>{writes.push({name,args});if(block&&name==='publish_professional_location_fix'){await block;block=null}return{error:terminalRace&&name==='share_booking_location'?{message:'Location sharing requires an active journey'}:null}},from:table=>{const filters=[];const query={select:v=>{filters.push(['select',v]);return query},eq:(...v)=>{filters.push(['eq',...v]);return query},in:(...v)=>{filters.push(['in',...v]);return query},is:(...v)=>{filters.push(['is',...v]);return query},limit:async n=>{queries.push({table,filters,limit:n});return{data:journeys,error:null}}};return query}};
 const requires={'react-native':{Platform:{OS:os},AppState:app},'expo-location':location,'expo-task-manager':{isTaskDefined:name=>tasks.has(name),defineTask:(name,fn)=>tasks.set(name,fn)},'./supabase':{supabase},'./sessionStorage':{sessionStorage:{getItem:async k=>store.get(k)||null,setItem:async(k,v)=>store.set(k,v)}},'../appVariant':{isProfessionalApp:true},'../domain':{errorText:e=>e.message}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../src/lib/professionalLocation.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>{if(!requires[n])throw Error(n);return requires[n]},Date:class extends Date{static now(){return now}},setInterval:()=>1,clearInterval(){}});
 return{api:exports,store,app,writes,starts,fix,queries,setJourneys:value=>journeys=value,terminalRace:()=>terminalRace=true,advance:()=>now+=10000,move:lng=>callback(fix(lng)),task:()=>tasks.get(exports.PROFESSIONAL_LOCATION_TASK),get running(){return running},get requests(){return requests},get watchRemoved(){return watchRemoved},signedOut:()=>user=null,block:promise=>block=promise};
}
test('iPhone background sharing uses navigation updates without Android foreground-service options',async()=>{
 const f=fixture({os:'ios'});await f.api.startProfessionalLocation('pro-1',true);await tick();assert.equal(f.running,true);assert.equal(f.starts[0].foregroundService,undefined);assert.equal(f.starts[0].activityType,2);assert.equal(f.starts[0].pausesUpdatesAutomatically,false);assert.equal(f.starts[0].showsBackgroundLocationIndicator,true);assert.equal(f.starts[0].deferredUpdatesInterval,0);f.app.currentState='background';f.advance();await f.task()({data:{locations:[f.fix(77.8)]}});assert.equal(f.writes.at(-1).args.p_longitude,77.8);await f.api.stopProfessionalLocation('pro-1');assert.equal(f.running,false);
});

test('background starts only after explicit consent and publishes movement without a mounted screen',async()=>{
 const f=fixture();await f.api.startProfessionalLocation('pro-1');await tick();assert.equal(f.requests,0);assert.equal(f.starts.length,0);
 await f.api.startProfessionalLocation('pro-1',true);await tick();assert.equal(f.requests,1);assert.equal(f.running,true);assert.equal(f.starts[0].foregroundService.killServiceOnDestroy,false);assert.equal(f.watchRemoved,1);
 f.app.currentState='background';f.advance();await f.task()({data:{locations:[f.fix(77.7),f.fix(77.8,Date.now()-120000)]}});
 assert.equal(f.writes.at(-1).args.p_longitude,77.7);assert.equal(f.running,true);
 const count=f.starts.length;f.app.currentState='active';await f.api.startProfessionalLocation('pro-1');assert.equal(f.starts.length,count);
});
test('availability off stops native updates and late queued fixes cannot restore a cleared pin',async()=>{
 const f=fixture();await f.api.startProfessionalLocation('pro-1',true);await tick();f.advance();let resolve;f.block(new Promise(r=>resolve=r));const write=f.api.publishProfessionalFix(f.fix(78),'pro-1');await tick();const stop=f.api.stopProfessionalLocation('pro-1');resolve();await Promise.all([write,stop]);
 assert.equal(f.running,false);assert.equal(f.writes.at(-1).name,'clear_professional_location');const count=f.writes.length;
 f.advance();await f.task()({data:{locations:[f.fix(79)]}});assert.equal(f.writes.length,count);
});
test('signed-out background tasks stop instead of publishing for another account',async()=>{
 const f=fixture();await f.api.startProfessionalLocation('pro-1',true);await tick();f.signedOut();const count=f.writes.filter(w=>w.name.includes('publish')).length;f.advance();await f.task()({data:{locations:[f.fix(78)]}});assert.equal(f.running,false);assert.equal(f.writes.filter(w=>w.name.includes('publish')).length,count);
});
test('permission denial uses foreground GPS, and old fixes are never published as live',async()=>{
 const f=fixture({grant:false});await f.api.startProfessionalLocation('pro-1',true);await tick();assert.equal(f.running,false);assert.equal(f.starts.length,0);
 f.advance();f.move(77.8);await tick();assert.equal(f.writes.at(-1).args.p_longitude,77.8);const count=f.writes.length;
 f.advance();await f.api.publishProfessionalFix(f.fix(79,Date.now()-120000),'pro-1');assert.equal(f.writes.length,count);
});
test('browser watch shares movement between jobs even when a different tab is foreground',async()=>{
 const f=fixture({os:'web'});await f.api.startProfessionalLocation('pro-1');await tick();f.app.currentState='background';f.advance();f.move(77.9);await tick();assert.equal(f.writes.at(-1).args.p_longitude,77.9);assert.equal(f.requests,0);assert.equal(f.starts.length,0);
});

test('an existing paused sharing preference is preserved until explicitly enabled again',async()=>{const f=fixture();f.store.set('live-location-pro-1','off');await assert.rejects(f.api.startProfessionalLocation('pro-1'),/previously paused/);assert.equal(f.starts.length,0);await f.api.startProfessionalLocation('pro-1',true);assert.equal(f.store.get('live-location-pro-1'),'on');assert.equal(f.running,true);});

test('background GPS updates the active booking without a mounted navigation screen',async()=>{
 const f=fixture();await f.api.startProfessionalLocation('pro-1',true);await tick();f.setJourneys([{id:'job-1'}]);f.app.currentState='background';f.advance();await f.task()({data:{locations:[f.fix(77.8)]}});
 const write=f.writes.at(-1);assert.equal(write.name,'share_booking_location');assert.equal(write.args.p_booking_id,'job-1');assert.equal(write.args.p_longitude,77.8);assert.equal(f.running,true);assert.equal(f.starts[0].accuracy,6);assert.equal(f.starts[0].timeInterval,3000);assert.equal(f.starts[0].deferredUpdatesInterval,undefined);
 assert.deepEqual(f.queries.at(-1).filters.map(v=>JSON.parse(JSON.stringify(v))),[['select','id'],['eq','professional_id','pro-1'],['in','status',['en_route','arrived']],['is','service_started_at',null]]);
});
test('completed journeys and service-start races do not receive later background fixes or stop discovery',async()=>{
 const f=fixture();await f.api.startProfessionalLocation('pro-1',true);await tick();f.setJourneys([{id:'job-1'}]);f.advance();f.terminalRace();await f.task()({data:{locations:[f.fix(78)]}});assert.equal(f.running,true);f.setJourneys([]);const count=f.writes.filter(w=>w.name==='share_booking_location').length;f.advance();await f.task()({data:{locations:[f.fix(79)]}});assert.equal(f.writes.filter(w=>w.name==='share_booking_location').length,count);assert.equal(f.writes.at(-1).name,'publish_professional_location_fix');
});
test('going offline during an in-flight fix prevents a late booking-location publication',async()=>{
 const f=fixture();await f.api.startProfessionalLocation('pro-1',true);await tick();f.setJourneys([{id:'job-1'}]);f.advance();let resolve;f.block(new Promise(r=>resolve=r));const publish=f.api.publishProfessionalFix(f.fix(78),'pro-1');await tick();const stop=f.api.stopProfessionalLocation('pro-1');resolve();await Promise.all([publish,stop]);assert.equal(f.writes.filter(w=>w.name==='share_booking_location').length,0);assert.equal(f.writes.at(-1).name,'clear_professional_location');
});
