const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load(file,requires,globals={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve(file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:name=>{if(name in requires)return requires[name];throw Error('Unexpected module '+name)},...globals});return exports;}
function fixture(os='android',environment='development'){const calls=[],values=new Map();let account='owner';const query={};for(const name of ['select','eq','order','limit','is'])query[name]=(...args)=>{calls.push([name,...args]);return query};query.maybeSingle=async()=>({data:null,error:null});
 const api=load('../src/lib/notifications.ts',{'react-native':{Platform:{OS:os}},'expo-application':{getIosPushNotificationServiceEnvironmentAsync:async()=>environment},'expo-constants':{__esModule:true,default:{expoConfig:{extra:{androidPushConfigured:true,iosPushConfigured:true}}}},'expo-crypto':{randomUUID:()=> '10000000-0000-4000-8000-000000000001'},'../appVariant':{appVariant:'professional'},'./sessionStorage':{sessionStorage:{getItem:async k=>values.get(k),setItem:async(k,v)=>values.set(k,v)}},'./supabase':{supabase:{auth:{getSession:async()=>({data:{session:{user:{id:account}}}})},rpc:async(...args)=>{calls.push(['rpc',...args]);return {data:{push_enabled:false},error:null}},from:(...args)=>{calls.push(['from',...args]);return query}}}});
 return {api,calls,changeAccount:id=>account=id};}
test('delayed token retrieval cannot register against a different signed-in account',async()=>{const {api,calls,changeAccount}=fixture();changeAccount('someone-else');await api.saveNotificationToken('private-device-token','owner');assert.equal(calls.length,0)});

test('iOS registration uses the signed entitlement environment and rejects unsigned builds',async()=>{
 for(const environment of ['development','production']){const f=fixture('ios',environment);assert.equal(f.api.pushConfigured,true);await f.api.saveNotificationToken('a'.repeat(64),'owner');const rpc=f.calls.find(c=>c[0]==='rpc');assert.equal(rpc[1],'register_ios_notification_device');assert.equal(rpc[2].p_environment,environment==='development'?'sandbox':'production');}
 const f=fixture('ios',null);await assert.rejects(()=>f.api.saveNotificationToken('a'.repeat(64),'owner'),/Apple-signed/);assert.equal(f.calls.length,0);
 const race=fixture('ios');const save=race.api.saveNotificationToken('a'.repeat(64),'owner');race.changeAccount('someone-else');await save;assert.equal(race.calls.length,0);
});

test('APNs signs ES256 JWTs, routes the correct app/environment and preserves tokens on provider failures',async()=>{
 const crypto=require('node:crypto'),keys=crypto.generateKeyPairSync('ec',{namedCurve:'prime256v1'});
 const api=load('../../supabase/functions/_shared/apns.ts',{}, {crypto:crypto.webcrypto,btoa,atob,TextEncoder,AbortSignal});
 const account=api.apnsAccount('ABCD123456','TEAM123456',keys.privateKey.export({type:'pkcs8',format:'pem'}));
 const jwt=await api.apnsAuthorization(account),[header,payload,signature]=jwt.split('.');
 assert.equal(JSON.parse(Buffer.from(header,'base64url')).alg,'ES256');assert.equal(JSON.parse(Buffer.from(payload,'base64url')).iss,'TEAM123456');assert.equal(crypto.verify('sha256',Buffer.from(header+'.'+payload),{key:keys.publicKey,dsaEncoding:'ieee-p1363'},Buffer.from(signature,'base64url')),true);assert.equal(await api.apnsAuthorization(account),jwt);
 for(const variant of ['customer','professional'])for(const environment of ['sandbox','production']){const req=api.apnsRequest('a'.repeat(64),environment,variant,'opaque-id','Booking accepted',jwt);assert.ok(req.url.startsWith(environment==='sandbox'?'https://api.sandbox.push.apple.com/':'https://api.push.apple.com/'));assert.equal(req.options.headers['apns-topic'],'com.cccircle.'+variant);const body=JSON.parse(req.options.body);assert.equal(body.notification_id,'opaque-id');assert.equal(body.aps.alert.body,'Open Circle for the latest update.');assert.equal(req.options.headers['apns-push-type'],'alert');}
 assert.throws(()=>api.apnsRequest('bad','production','customer','id','title',jwt),/Invalid APNs/);assert.throws(()=>api.apnsRequest('a'.repeat(64),'evil','customer','id','title',jwt),/Invalid APNs/);
 assert.equal(api.apnsResult(200),'sent');assert.equal(api.apnsResult(410,'Unregistered'),'invalid');assert.equal(api.apnsResult(400,'BadDeviceToken'),'failed');assert.equal(api.apnsResult(403,'ExpiredProviderToken'),'retry');assert.equal(api.apnsResult(429),'retry');assert.equal(api.apnsResult(503),'retry');
});
test('device registration and logout use the same role-scoped installation',async()=>{const {api,calls}=fixture();await api.saveNotificationToken('private-device-token','owner');await api.unregisterNotifications();const rpcs=calls.filter(c=>c[0]==='rpc');assert.equal(rpcs[0][1],'register_notification_device');assert.equal(rpcs[0][2].p_variant,'professional');assert.equal(rpcs[1][1],'unregister_notification_device');assert.equal(rpcs[1][2].p_installation_id,rpcs[0][2].p_installation_id)});
test('notification taps reject malformed IDs and verify recipient plus app variant',async()=>{const {api,calls}=fixture();assert.equal(await api.resolveNotification('https://untrusted.example','owner'),null);assert.equal(calls.length,0);assert.equal(await api.resolveNotification('10000000-0000-4000-8000-000000000001','owner'),null);assert.ok(calls.some(c=>c[0]==='eq'&&c[1]==='user_id'&&c[2]==='owner'));assert.ok(calls.some(c=>c[0]==='eq'&&c[1]==='app_variant'&&c[2]==='professional'))});

test('FCM payload exposes only a generic update and an opaque notification ID; retries retain valid tokens',()=>{
 const api=load('../../supabase/functions/_shared/firebase.ts',{});
 const message=api.firebaseMessage('token','notification-id','Booking accepted');
 assert.equal(message.message.notification.body,'Open Circle for the latest update.');
 assert.equal(message.message.data.notification_id,'notification-id');
 assert.equal(message.message.android.notification.visibility,'PRIVATE');
 assert.equal(api.firebaseResult(200,{}),'sent');assert.equal(api.firebaseResult(503,{}),'retry');assert.equal(api.firebaseResult(429,{}),'retry');
 assert.equal(api.firebaseResult(400,{error:{details:[{errorCode:'INVALID_ARGUMENT'}]}}),'failed');
 assert.equal(api.firebaseResult(404,{error:{details:[{errorCode:'UNREGISTERED'}]}}),'invalid');
});

test('Firebase authorization signs a valid short-lived JWT and caches only its access token',async()=>{
 const crypto=require('node:crypto');const keys=crypto.generateKeyPairSync('rsa',{modulusLength:2048});let requests=0;
 const email='notification-worker@circle-test.iam.gserviceaccount.com';
 const api=load('../../supabase/functions/_shared/firebase.ts',{}, {crypto:crypto.webcrypto,btoa,atob,TextEncoder,URLSearchParams,AbortSignal,fetch:async(url,options)=>{
  requests++;assert.equal(url,'https://oauth2.googleapis.com/token');
  const jwt=options.body.get('assertion'),[head,body,signature]=jwt.split('.');
  const claims=JSON.parse(Buffer.from(body,'base64url'));
  assert.equal(claims.iss,email);assert.equal(claims.aud,'https://oauth2.googleapis.com/token');
  assert.equal(claims.scope,'https://www.googleapis.com/auth/firebase.messaging');assert.equal(claims.exp-claims.iat,3600);
  assert.equal(crypto.verify('RSA-SHA256',Buffer.from(head+'.'+body),keys.publicKey,Buffer.from(signature,'base64url')),true);
  return {ok:true,json:async()=>({access_token:'fixture-access-token',expires_in:3600})};
 }});
 const account=api.firebaseAccount(JSON.stringify({project_id:'circle-test',client_email:email,private_key:keys.privateKey.export({type:'pkcs8',format:'pem'})}));
 assert.equal(await api.firebaseAccessToken(account),'fixture-access-token');
 assert.equal(await api.firebaseAccessToken(account),'fixture-access-token');assert.equal(requests,1);
 assert.throws(()=>api.firebaseAccount(JSON.stringify({project_id:'https://untrusted.example',client_email:email,private_key:'fake'})),/Invalid Firebase/);
});

function splash(ready){const effects=[],timers=[],starts=[],jsx=(type,props)=>({type,props});let finished=0;class Value{constructor(v){this.v=v}addListener(){return 'listener'}removeListener(){}setValue(v){this.v=v}interpolate(){return 0}}
 const chain={start:cb=>{starts.push(cb)},stop(){}};
 const mod=load('../src/components/LaunchSplash.tsx',{'react':{useEffect:fn=>effects.push(fn),useRef:v=>({current:v}),useState:v=>[v,()=>{}]},'react/jsx-runtime':{jsx,jsxs:jsx},'react-native':{AccessibilityInfo:{isReduceMotionEnabled:async()=>false},Animated:{Value,View:'AnimatedView',sequence:()=>chain,timing:()=>({}),delay:()=>({})},Easing:{linear:()=>{},out:x=>x,cubic:()=>{}},Image:'Image',Platform:{OS:'android'},Text:'Text',View:'View'},'../ui':{BrandMark:'BrandMark',brandCopy:{name:'Circle',tagline:'CREATIVITY, CONNECTED.',footer:'YOUR PEOPLE. YOUR CIRCLE.'},useTheme:()=>({colors:{bg:'#f0f0f0',text:'#000',muted:'#666'},theme:'minimal'})},'../../assets/brand/splash-trace-minimal.png':1,'../../assets/brand/splash-trace-gallery.png':2},{setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length},clearTimeout:()=>{}});
 const tree=mod.LaunchSplash({ready,onFinish:()=>finished++});const cleanup=effects[0]();return {tree,timers,starts,cleanup,finished:()=>finished};}
test('original animated splash waits for the first layout, without consuming its animation behind native launch',async()=>{const a=splash(false);await Promise.resolve();assert.equal(a.timers.length,0);assert.equal(a.starts.length,0);assert.equal(a.tree.props.accessibilityLabel,'Circle is opening');const b=splash(true);await Promise.resolve();await Promise.resolve();assert.equal(b.starts.length,1);b.starts[0]({finished:true});assert.equal(b.finished(),1);b.cleanup();});
test('an interrupted splash releases startup by deadline but never calls back after unmount',()=>{const a=splash(true);a.timers[0].fn();assert.equal(a.finished(),1);a.cleanup();a.timers[0].fn();assert.equal(a.finished(),1)});

test('the clean bell never loads history and late settings refresh preserves push errors',async()=>{
 const states=[],refs=[],effects=[],pending=[];let si=0,ri=0,tree,historyCalls=0;
 const jsx=(type,props)=>({type,props});
 const react={createContext:()=>({Provider:'Provider'}),useContext:()=>({}),useCallback:fn=>fn,useRef:init=>{const i=ri++;return refs[i]||(refs[i]={current:init})},useState:init=>{const i=si++;if(!(i in states))states[i]=init;return[states[i],v=>states[i]=typeof v==='function'?v(states[i]):v]},useEffect:fn=>effects.push(fn)};
 const channel={on(){return this},subscribe(){return this}};
 const mod=load('../src/components/NotificationCenter.tsx',{'./AppFooter':{AppFooter:'AppFooter'},'react':react,'react/jsx-runtime':{jsx,jsxs:jsx},'react-native':{AppState:{currentState:'active',addEventListener:()=>({remove(){}})},Modal:'Modal',Platform:{OS:'web'},Pressable:'Pressable',ScrollView:'ScrollView',Switch:'Switch',Text:'Text',View:'View'},'react-native-safe-area-context':{SafeAreaView:'SafeAreaView'},'../appVariant':{appVariant:'customer'},'../lib/supabase':{supabase:{channel:()=>channel,removeChannel:async()=>{}}},'../lib/notifications':{pushConfigured:false,notificationInbox:()=>{historyCalls++;throw Error('History must not be loaded')},notificationSettings:()=>new Promise(resolve=>pending.push(resolve))},'../ui':{Button:'Button',Icon:'Icon',IconButton:'IconButton',Notice:'Notice',useTheme:()=>({colors:{},styles:{}})}},{setInterval:()=>1,clearInterval:()=>{}});
 const render=()=>{si=0;ri=0;return tree=mod.NotificationCenter({userId:'owner',children:null,onNavigate:()=>{}})};
 const find=(n,match)=>{if(Array.isArray(n))return n.flatMap(v=>find(v,match));if(!n||typeof n!=='object')return[];return[...(match(n)?[n]:[]),...find(n.props?.children,match)]};
 render();const cleanup=effects[0]();effects[1]();
 tree.props.value.open();render();
 find(tree,n=>n.type==='Button'&&n.props.title==='Enable phone notifications')[0].props.onPress();
 await new Promise(r=>setImmediate(r));
 pending.forEach(resolve=>resolve({push_enabled:false,messages_enabled:true,events_enabled:true}));await new Promise(r=>setImmediate(r));render();
 assert.equal(historyCalls,0);
 assert.match(find(tree,n=>n.type==='Notice')[0].props.message,/Phone notifications require the Android or iPhone app/);
 cleanup();
});
