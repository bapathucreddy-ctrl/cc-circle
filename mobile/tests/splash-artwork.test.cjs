const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(require.resolve('../src/components/launchSplashHtml.ts'),'utf8');
const artwork=JSON.parse(html.slice(html.indexOf(' = ')+3).trim().slice(0,-1));
test('offline crafts reveal finishes and notifies native and web hosts, including reduced motion',async()=>{
 for(const reduced of [false,true]){
  const elements=new Map(),listeners=new Map(),messages=[],frames=[],timers=[];
  const node=()=>({attrs:{},children:[],setAttribute(k,v){this.attrs[k]=String(v)},getAttribute(k){return this.attrs[k]??(k==='height'?'54':'0')},appendChild(v){this.children.push(v)},addEventListener(){}});
  const element=id=>{if(!elements.has(id))elements.set(id,node());return elements.get(id)};
  const window={ReactNativeWebView:{postMessage:v=>messages.push(['native',v])},parent:{postMessage:v=>messages.push(['web',v])},addEventListener:(n,fn)=>listeners.set(n,fn),dispatchEvent:e=>listeners.get(e.type)?.()};
  const context={window,document:{getElementById:element,createElementNS:node},Image:class{set src(v){this.onload?.()}},performance:{now:()=>0},matchMedia:()=>({matches:reduced}),CustomEvent:class{constructor(type){this.type=type}},requestAnimationFrame:fn=>{frames.push(fn);return frames.length},cancelAnimationFrame(){},setTimeout:fn=>timers.push(fn)};
  vm.runInNewContext(artwork.match(/<script>([\s\S]*?)<\/script>/)[1],context);
  await Promise.resolve();await Promise.resolve();
  if(reduced)timers.forEach(fn=>fn());else frames[0](4300);
  assert.ok(elements.get('crafts').children.length>=5);
  for(const child of elements.get('crafts').children){assert.equal(child.attrs.opacity,'1');assert.ok(Number(child.attrs.width)>0);}
  assert.equal(elements.get('copy').attrs.opacity,'1');
  assert.deepEqual(messages,[['native','artist-house-splash-complete'],['web','artist-house-splash-complete']]);
  assert.ok(!/https?:\/\//.test(artwork.replace('http://www.w3.org/2000/svg','')),'splash must load entirely offline');
 }
});
test('question examples are placeholders and signup offers the existing Instagram flow',()=>{
 const account=fs.readFileSync(require.resolve('../src/screens/Account.tsx'),'utf8');
 assert.ok(account.includes('placeholder={field.hint}'));assert.ok(!account.includes('label={field.hint'));
 const signup=fs.readFileSync(require.resolve('../src/components/RegistrationGate.tsx'),'utf8');
 assert.ok(signup.includes('Connect Instagram (optional)'));assert.ok(signup.includes('<PortfolioManager userId={userId} connectionOnly />'));
});
