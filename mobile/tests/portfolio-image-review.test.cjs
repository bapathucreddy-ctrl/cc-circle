const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');
function moduleAt(file,mockRequire,extra={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve(file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:mockRequire,AbortSignal,btoa,Uint8Array,...extra});return exports;}
class HttpError extends Error{constructor(status,message){super(message);this.status=status;}}
function review(fetch,key='fixture-private-key'){return moduleAt('../../supabase/functions/_shared/portfolioImageReview.ts',()=>({HttpError}),{fetch,Deno:{env:{get:()=>key}}});}
test('image review rejects readable text and recognized branding, without publishing OCR details',async()=>{
 const bodies=[{textAnnotations:[{description:'@private_handle'}]},{fullTextAnnotation:{text:'Studio watermark'}},{logoAnnotations:[{score:.99,description:'Brand'}]}];
 for(const result of bodies){const r=review(async()=>new Response(JSON.stringify({responses:[result]})));await assert.rejects(()=>r.reviewPortfolioImage(new Uint8Array([255,216,255])),error=>error.status===422&&!error.message.includes('private_handle'));}
});
test('image review uses only the fixed server endpoint and accepts a successful clear image',async()=>{
 const calls=[];const r=review(async(url,init)=>{calls.push({url,init});return new Response(JSON.stringify({responses:[{}]}));});await r.reviewPortfolioImage(new Uint8Array([1,2,3]));
 assert.equal(calls[0].url,'https://vision.googleapis.com/v1/images:annotate');assert.equal(calls[0].init.headers['x-goog-api-key'],'fixture-private-key');const body=JSON.parse(calls[0].init.body);assert.equal(body.requests[0].image.content,'AQID');assert.deepEqual(body.requests[0].features.map(f=>f.type),['TEXT_DETECTION','LOGO_DETECTION']);
});
test('missing credentials, provider failures, partial errors and the exact 5 MB boundary fail closed',async()=>{
 const missing=review(()=>{throw Error('should not call')},'');await assert.rejects(()=>missing.reviewPortfolioImage(new Uint8Array([1])),e=>e.status===503);
 for(const response of [()=>new Response('private detail',{status:403}),()=>new Response(JSON.stringify({responses:[]})),()=>new Response(JSON.stringify({responses:[{error:{message:'private detail'}}]}))]){await assert.rejects(()=>review(async()=>response()).reviewPortfolioImage(new Uint8Array([1])),e=>e.status===503&&!e.message.includes('private detail'));}
 const r=review(()=>{throw Error('should not call')});await assert.rejects(()=>r.reviewPortfolioImage(new Uint8Array(5_000_000)),e=>e.status===400);await assert.rejects(()=>r.reviewPortfolioImage(new Uint8Array()),e=>e.status===400);
});
test('compression retries the original at high quality and returns only bytes below 5 MB',async()=>{
 const calls=[];let reads=0;const m=moduleAt('../src/lib/preparePortfolioImage.ts',name=>name==='expo-image-manipulator'?{SaveFormat:{JPEG:'jpeg'},manipulateAsync:async(...args)=>{calls.push(args);return{uri:'rendered'};}}:{readPortfolioAsset:async()=>new ArrayBuffer(++reads===1?5_000_000:4_999_999)});
 const bytes=await m.preparePortfolioImage({uri:'original',width:8000,height:6000});assert.equal(bytes.byteLength,4_999_999);assert.equal(calls.length,2);assert.ok(calls.every(c=>c[0]==='original'&&c[2].format==='jpeg'&&c[2].compress>=.94));assert.equal(calls[0][1][0].resize.width,6000);assert.equal(calls[1][1][0].resize.width,4800);
});
test('uncompressible photos stop after bounded attempts instead of uploading an oversized image',async()=>{
 let attempts=0;const m=moduleAt('../src/lib/preparePortfolioImage.ts',name=>name==='expo-image-manipulator'?{SaveFormat:{JPEG:'jpeg'},manipulateAsync:async()=>{attempts++;return{uri:'rendered'};}}:{readPortfolioAsset:async()=>new ArrayBuffer(5_000_000)});
 await assert.rejects(()=>m.preparePortfolioImage({uri:'original',width:8000,height:6000}),/below 5 MB/);assert.equal(attempts,6);
});
test('Instagram OAuth verifies the token account and saves the connection without importing media',async()=>{
 let handler;const calls=[],updates=[],connections=[];const job={id:'job',provider:'instagram',professional_id:'owner'};
 const admin={from(table){const q={update(value){updates.push(value);return q;},eq(){return q;},gt(){return q;},select(){return q;},async maybeSingle(){return{data:job,error:null};},async upsert(value){assert.equal(table,'portfolio_connections');connections.push(value);return{error:null};}};return q;}};
 moduleAt('../../supabase/functions/portfolio-callback/index.ts',name=>name.endsWith('/http.ts')?{serveRequest:fn=>{handler=fn;}}:name.endsWith('/payments.ts')?{adminClient:()=>admin,HttpError}:{callbackUrl:()=> 'https://callback.test',crypt:async()=> 'encrypted-token',digest:async()=> 'hashed-state',secret:()=> 'fixture-secret',providerJson:async url=>{calls.push(url);return url.includes('api.instagram.com')?{access_token:'short',user_id:'123'}:url.includes('/access_token?')?{access_token:'long',expires_in:3600}:{user_id:'456'};}},{URL,URLSearchParams,Response,Deno:{env:{get:()=>undefined}}});
 const response=await handler(new Request('https://callback.test?state='+'a'.repeat(64)+'&code=fixture-code'));assert.equal(response.status,200);assert.match(await response.text(),/Instagram account verified/);assert.equal(connections.length,1);assert.equal(connections[0].provider_user_id,'456');assert.equal(connections[0].token_cipher,'encrypted-token');assert.equal(updates.at(-1).status,'complete');assert.ok(calls.every(url=>!url.includes('/media')));assert.match(calls.at(-1),/\/me\?fields=user_id$/);
});
test('customer galleries expose only server-approved uploaded images, retaining legacy media for owner removal',async()=>{
 let handler;const signed=[],owner='10000000-0000-4000-8000-000000000001';const rows=[{id:'approved',provider:'upload',kind:'image',storage_path:owner+'/approved-fixture.jpg'},{id:'old-upload',provider:'upload',kind:'image',storage_path:owner+'/old.jpg'},{id:'instagram',provider:'instagram',kind:'image',media_url:'https://private.example/imported'}];
 const admin={rpc:async()=>({data:true,error:null}),from(table){const q={select(){return q;},eq(){return q;},order(){return q;},async maybeSingle(){return{data:{is_published:true},error:null};},async limit(){assert.equal(table,'portfolio_media');return{data:rows,error:null};}};return q;},storage:{from(){return{async createSignedUrl(path){signed.push(path);return{data:{signedUrl:'https://approved.example/photo'}};}};}}};
 moduleAt('../../supabase/functions/portfolio/index.ts',name=>name.endsWith('/http.ts')?{serveRequest:fn=>{handler=fn;}}:name.endsWith('/payments.ts')?{authenticate:async()=>({admin,user:{id:'customer'}}),body:async()=>({action:'list',professional_id:owner}),uuid:value=>value,HttpError,json:Response.json.bind(Response)}:{},{Response});
 const response=await handler(new Request('https://portfolio.test',{method:'POST'}));const data=await response.json();assert.equal(response.status,200);assert.equal(data.media.length,1);assert.equal(data.media[0].id,'approved');assert.equal(data.media[0].needsReview,false);assert.deepEqual(signed,[owner+'/approved-fixture.jpg']);assert.deepEqual(data.connections,[]);
});
