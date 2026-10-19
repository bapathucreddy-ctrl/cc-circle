const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function load(file,requires,globals={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve(file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:name=>{if(!(name in requires))throw Error(name);return requires[name]},...globals});return exports;}
const token=id=>'header.'+Buffer.from(JSON.stringify({session_id:id})).toString('base64url')+'.signature';
test('a stalled device verification aborts after eight seconds and reports a retryable error',async()=>{
 let timeout,cleared=false;
 const api=load('../src/lib/appSessions.ts',{'base64-js':require('base64-js'),'./supabase':{supabase:{rpc:()=>({abortSignal:signal=>new Promise(resolve=>signal.addEventListener('abort',()=>resolve({data:null,error:{message:'aborted'}})))})}},'../appVariant':{appVariant:'customer'}},{AbortController,setTimeout:(fn,ms)=>{assert.equal(ms,8000);timeout=fn;return 1},clearTimeout:()=>cleared=true});
 const check=api.checkAppSession(true);timeout();await assert.rejects(()=>check,/Check your connection/);assert.equal(cleared,true);
});
test('a replaced session signs out locally; delayed cleanup cannot log out a newer login',async()=>{
 const calls=[];let sid='old',rpcError=false;
 const api=load('../src/lib/appSessions.ts',{'base64-js':require('base64-js'),'./supabase':{supabase:{rpc:(name,args)=>{calls.push({name,args});return{abortSignal:async()=>({data:true,error:rpcError?{}:null})}},auth:{getSession:async()=>({data:{session:{access_token:token(sid)}}}),signOut:async options=>calls.push({signOut:options})}}},'../appVariant':{appVariant:'professional'}},{AbortController,setTimeout,clearTimeout});
 assert.equal(await api.checkAppSession(true),true);assert.equal(calls[0].name,'activate_app_session');assert.equal(calls[0].args.p_variant,'professional');rpcError=true;await assert.rejects(()=>api.checkAppSession(),/Unable to verify/);
 let hidden=0;await api.expireAppSession('old',()=>hidden++);assert.equal(hidden,1);assert.equal(calls.find(c=>c.signOut).signOut.scope,'local');calls.length=0;
 sid='new';await api.expireAppSession('old',()=>hidden++);assert.equal(hidden,1);assert.equal(calls.length,0);
 sid='old';await api.expireAppSession('old',()=>hidden++,async()=>{sid='new'});assert.equal(calls.length,0,'new login survives slow location cleanup');
 assert.equal(api.appSessionId('invalid-token'),null);
});

test('session gate activates once, detects replacement within polling and ignores late replies after unmount',async()=>{
 const states=[],refs=[],effects=[],timers=[],calls=[];let si=0,ri=0,answer=true,replaced=0,resolve;
 const jsx=(type,props)=>({type,props});
 const api=load('../src/components/SessionGate.tsx',{'./ServiceLoader':{ServiceLoader:'ServiceLoader'},react:{useEffect:fn=>effects.push(fn),useRef:value=>refs[ri++]|| (refs[ri-1]={current:value}),useState:value=>{const i=si++;if(!(i in states))states[i]=value;return[states[i],v=>states[i]=typeof v==='function'?v(states[i]):v]}},'react/jsx-runtime':{jsx,jsxs:jsx},'react-native':{AppState:{currentState:'active',addEventListener:()=>({remove(){}})},ActivityIndicator:'Spinner',View:'View'},'../lib/appSessions':{checkAppSession:async activate=>{calls.push(activate);return answer==='pending'?new Promise(r=>resolve=r):answer}},'../ui':{Button:'Button',Notice:'Notice',useTheme:()=>({colors:{}})}},{setInterval:(fn,ms)=>{assert.equal(ms,5000);timers.push(fn);return timers.length},clearInterval(){}});
 const render=()=>{si=0;ri=0;return api.SessionGate({children:'account-content',onReplaced:()=>replaced++})};
 assert.notEqual(render(),'account-content');const cleanup=effects[0]();await tick();assert.equal(render(),'account-content');assert.equal(calls[0],true);answer=false;timers[0]();await tick();assert.equal(calls[1],false);assert.equal(replaced,1);assert.notEqual(render(),'account-content');cleanup();
 answer='pending';const second=effects[0]();await tick();second();resolve(false);await tick();assert.equal(replaced,1,'unmounted device checks cannot log out the current UI');
});

test('Edge authentication rejects replaced sessions before any privileged operation',async()=>{
 let allowed=false,checked=false;const user={id:'10000000-0000-4000-8000-000000000001'},sid='20000000-0000-4000-8000-000000000001';
 const api=load('../../supabase/functions/_shared/payments.ts',{'npm:@supabase/supabase-js@2.117.2':{createClient:()=>({auth:{getUser:async()=>({data:{user},error:null})},rpc:async(name,args)=>{assert.equal(name,'app_session_allowed');assert.equal(args.p_session_id,sid);checked=true;return{data:allowed,error:null}}})},'./http.ts':{readLimitedText:async()=>''}},{Deno:{env:{get:()=> 'fixture'}},atob});
 const request={headers:{get:()=> 'Bearer '+token(sid)}};
 await assert.rejects(()=>api.authenticate(request),error=>error.status===401&&/another device/.test(error.message));assert.equal(checked,true);allowed=true;assert.equal((await api.authenticate(request)).user.id,user.id);
});
