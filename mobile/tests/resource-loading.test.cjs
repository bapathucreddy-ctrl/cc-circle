const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function moduleAt(path,requires={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve(path),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>requires[n],Date});return exports}
const tick=()=>new Promise(r=>setImmediate(r));const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject}};
test('named resources deduplicate requests, keep null/empty results cached, and clear on sign-out',async()=>{
 const cache=moduleAt('../src/lib/resourceCache.ts'),entry=cache.resourceEntry('profile:user-1');const d=deferred();let requests=0,notifications=0;entry.listeners.add(()=>notifications++);
 const a=cache.fetchResource(entry,()=>{requests++;return d.promise}),b=cache.fetchResource(entry,()=>{requests++;return d.promise});await tick();assert.equal(requests,1);d.resolve(null);await Promise.all([a,b]);assert.equal(entry.loaded,true);assert.equal(entry.value,null);assert.equal(notifications,1);
 assert.notEqual(cache.resourceEntry('bookings:user-1'),entry);cache.clearResourceCache();assert.notEqual(cache.resourceEntry('profile:user-1'),entry);assert.equal(cache.resourceEntry('profile:user-1').loaded,false);
});
test('failed refresh retains previously loaded content and allows retry',async()=>{
 const cache=moduleAt('../src/lib/resourceCache.ts'),entry=cache.resourceEntry('bookings:mine');await cache.fetchResource(entry,async()=>['job']);await assert.rejects(cache.fetchResource(entry,async()=>{throw Error('offline')}));assert.equal(entry.value[0],'job');assert.equal(entry.pending,undefined);await cache.fetchResource(entry,async()=>[]);assert.equal(entry.value.length,0);
});
test('polling loaded resources stays visible, deduplicates overlap and reports refresh errors',async()=>{
 const states=[],refs=[],callbacks=[];let si=0,ri=0,ci=0,first=true,effect;const react={useState:initial=>{const i=si++;if(first)states[i]=typeof initial==='function'?initial():initial;return[states[i],v=>states[i]=typeof v==='function'?v(states[i]):v]},useRef:initial=>{const i=ri++;if(first)refs[i]={current:initial};return refs[i]},useCallback:fn=>{const i=ci++;if(first)callbacks[i]=fn;return callbacks[i]},useEffect:fn=>{if(first)effect=fn}};
 const cache=moduleAt('../src/lib/resourceCache.ts');const hooks=moduleAt('../src/hooks.ts',{react,'react-native':{},'./domain':{errorText:e=>e.message},'./lib/api':{},'./lib/resourceCache':cache});let request=deferred(),calls=0;const load=()=>{calls++;return request.promise};const render=()=>{si=0;ri=0;ci=0;const result=hooks.useResource(load,'id');first=false;return result};
 render();effect();assert.equal(render().loading,true);request.resolve(['first']);await tick();assert.equal(render().loading,false);request=deferred();const a=render().refresh(),b=render().refresh();assert.equal(render().loading,false);assert.equal(render().data[0],'first');assert.equal(calls,2);request.reject(Error('Network failed'));await Promise.all([a,b]);assert.equal(render().data[0],'first');assert.equal(render().loading,false);assert.equal(render().error,'Network failed');
});
test('switching accounts clears cached private data while same-account token refresh preserves it',async()=>{
 const cache=moduleAt('../src/lib/resourceCache.ts');cache.scopeResourceCache('customer-a');const a=cache.resourceEntry('bookings:mine');await cache.fetchResource(a,async()=>['private-a']);cache.scopeResourceCache('customer-a');assert.equal(cache.resourceEntry('bookings:mine'),a);
 cache.scopeResourceCache('customer-b');const b=cache.resourceEntry('bookings:mine');assert.notEqual(b,a);assert.equal(b.loaded,false);await cache.fetchResource(b,async()=>['private-b']);cache.scopeResourceCache(null);assert.equal(cache.resourceEntry('bookings:mine').loaded,false);
});
