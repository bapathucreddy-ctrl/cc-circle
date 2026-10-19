const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');
function load(name){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../../supabase/functions/_shared/'+name+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Headers,Response,TextDecoder,Uint8Array,Error,require:id=>id==='./http.ts'?load('http'):{createClient:()=>{throw Error('No database expected')}}});return exports;}
test('browser CORS rejects unlisted origins before executing handlers and never returns wildcard credentials',async()=>{
 const {secureResponse}=load('http');let invoked=0;const handler=()=>{invoked++;return new Response('ok',{headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Credentials':'true'}})};
 let res=await secureResponse(new Request('https://api.example.com',{headers:{Origin:'https://evil.example'}}),handler,'https://app.example');assert.equal(res.status,403);assert.equal(invoked,0);assert.equal(res.headers.get('access-control-allow-origin'),null);
 res=await secureResponse(new Request('https://api.example.com',{headers:{Origin:'https://app.example'}}),handler,'https://app.example');assert.equal(res.status,200);assert.equal(invoked,1);assert.equal(res.headers.get('access-control-allow-origin'),'https://app.example');assert.equal(res.headers.get('access-control-allow-credentials'),null);assert.equal(res.headers.get('cache-control'),'no-store');assert.equal(res.headers.get('x-content-type-options'),'nosniff');
 res=await secureResponse(new Request('https://api.example.com'),handler,'https://app.example');assert.equal(res.status,200,'native calls have no Origin');
 res=await secureResponse(new Request('https://api.example.com',{method:'OPTIONS',headers:{Origin:'https://app.example'}}),handler,'https://app.example');assert.equal(res.status,204);assert.equal(invoked,2,'preflight must not invoke authenticated handler');
});
test('request limits bound streamed bytes including chunked, multibyte and deceptive content-length bodies',async()=>{
 const {readLimitedText}=load('http');const make=(body,headers={})=>new Request('https://example.com',{method:'POST',body,headers,duplex:'half'});
 assert.equal(await readLimitedText(make('hello'),5),'hello');
 await assert.rejects(()=>readLimitedText(make('ééé'),5),/body_too_large/);
 let cancelled=false;const stream=new ReadableStream({start(c){c.enqueue(new Uint8Array(3));c.enqueue(new Uint8Array(3));},cancel(){cancelled=true}});
 await assert.rejects(()=>readLimitedText(make(stream,{'Content-Length':'1'}),5),/body_too_large/);assert.equal(cancelled,true);
 await assert.rejects(()=>readLimitedText(make('a',{'Content-Length':'100'}),5),/body_too_large/);
});
test('portfolio rejects disguised HTML, scripts, incorrect containers and filename/MIME spoofing',()=>{
 const {validUploadHeader:valid}=load('upload');const bytes=s=>new Uint8Array(Buffer.from(s,'binary'));
 assert.equal(valid(bytes('<script>alert(1)</script>'),'jpg'),false);assert.equal(valid(bytes('<?php echo 1; ?>'),'png'),false);
 assert.equal(valid(new Uint8Array([255,216,255,224]),'jpg'),true);assert.equal(valid(new Uint8Array([137,80,78,71,13,10,26,10]),'png'),true);
 assert.equal(valid(bytes('RIFF0000WEBPdata'),'webp'),true);assert.equal(valid(bytes('RIFF0000WAVEdata'),'webp'),false);
 assert.equal(valid(bytes('\x00\x00\x00\x18ftypisom0000isom'),'mp4'),true);assert.equal(valid(bytes('\x00\x00\x00\x18ftypqt  0000qt  '),'mov'),true);assert.equal(valid(bytes('\x00\x00\x00\x18ftypheic0000heic'),'mp4'),false);
 assert.equal(valid(bytes('RIFF0000WEBPdata'),'svg'),false);
});
test('API JSON accepts bounded objects and rejects arrays, primitives, malformed JSON and oversized requests',async()=>{
 const {body}=load('payments');const request=value=>new Request('https://example.com',{method:'POST',body:value});
 assert.equal((await body(request('{"action":"list"}'))).action,'list');
 for(const value of ['null','[]','"text"','true','{'])await assert.rejects(()=>body(request(value)),error=>error.status===400);
 await assert.rejects(()=>body(request(JSON.stringify({value:'x'.repeat(9000)}))),error=>error.status===413);
 await assert.rejects(()=>body(new Request('https://example.com')),error=>error.status===405);
});
