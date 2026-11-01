import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';

test('the complete admin entry starts, toggles appearance and attaches Google login in browser and Android',async()=>{
 const html=await readFile(new URL('../src/index.html',import.meta.url),'utf8');
 const bundle=await build({entryPoints:[fileURLToPath(new URL('../src/app.js',import.meta.url))],bundle:true,write:false,format:'iife',platform:'browser',define:{__CIRCLE_SUPABASE_URL__:'"https://example.supabase.co"',__CIRCLE_PUBLIC_KEY__:'"public-test-key"'},plugins:[{name:'auth-test-double',setup(b){b.onResolve({filter:/^@supabase\/supabase-js$/},()=>({path:'client',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export const createClient=(url,key,options)=>{globalThis.__options=options;return globalThis.__db;};',loader:'js'}));}}]});
 for(const native of [false,true]){
  const ids=new Map([...html.matchAll(/id="([^"]+)"/g)].map(m=>[m[1],{dataset:{},textContent:'',attributes:{},setAttribute(k,v){this.attributes[k]=v;},querySelector(){return{setAttribute(){}};},click(){this.onclick?.();}}]));
  const document={documentElement:{dataset:{}},getElementById(id){assert.ok(ids.has(id),'Missing DOM element '+id);return ids.get(id);}};
  let subscribed=false,oauthOptions,openedUrl,appearance;
  const context={document,console,URL,sessionStorage:{},localStorage:{getItem(){return null;},setItem(){}},setInterval(){},setTimeout(){},__db:{auth:{onAuthStateChange(){subscribed=true;},async signInWithOAuth(options){oauthOptions=options;return{data:{url:'https://example.supabase.co/auth/v1/authorize'},error:null};}}},window:{location:{origin:'http://localhost:8090'},scrollTo(){},...(native?{CircleAndroid:{setAppearance(value){appearance=value;},openAuth(value){openedUrl=value;}}}:{})}};
  vm.runInNewContext(bundle.outputFiles[0].text,context);
  assert.equal(subscribed,true);assert.equal(typeof ids.get('google-sign-in').onclick,'function');
  assert.equal(document.documentElement.dataset.theme,'light');
  ids.get('admin-theme').click();assert.equal(document.documentElement.dataset.theme,'dark');assert.equal(ids.get('account-mode').textContent,'Dark');
  await ids.get('google-sign-in').onclick();assert.equal(oauthOptions.provider,'google');assert.equal(oauthOptions.options.redirectTo,native?'cccircle-admin://auth/callback':'http://localhost:8090');
  if(native){assert.equal(appearance,'dark');assert.equal(openedUrl,'https://example.supabase.co/auth/v1/authorize');assert.equal(context.__options.auth.flowType,'pkce');}
 }
});
