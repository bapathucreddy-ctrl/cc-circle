import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createDb} from '../src/db.js';
import {createApp} from '../src/app.js';

test('community posts persist with authenticated reactions, comments and owner-only deletion',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'circle-community-'));const db=createDb(':memory:');const server=createApp(db,{uploadRoot:dir}).listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));const base=`http://127.0.0.1:${server.address().port}`;
 const call=async(path,method='GET',token,body)=>{const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,data:await r.json()}};
 try{
  const register=async name=>(await call('/auth/register','POST',null,{name,email:name+'@test.example',password:'password-test-123',role:'talent'})).data;
  const a=await register('Creator'),b=await register('Collaborator');
  assert.equal((await call('/me/community/posts','POST',null,{body:'Hello'})).status,401);
  assert.equal((await call('/me/community/posts','POST',a.token,{body:'  '})).status,400);
  const post=await call('/me/community/posts','POST',a.token,{body:'A new film collaboration.'});assert.equal(post.status,201);const pid=post.data.id;
  assert.equal((await call('/me/community/posts/'+pid,'DELETE',b.token)).status,404);
  for(let i=0;i<2;i++)assert.equal((await call('/me/community/posts/'+pid+'/like','PUT',b.token,{liked:true})).status,200);
  assert.equal((await call('/me/community/posts/'+pid+'/comments','POST',b.token,{body:'Beautiful work!'})).status,201);
  let feed=(await call('/me/community/posts','GET',b.token)).data;assert.equal(feed[0].likes,1);assert.equal(feed[0].liked,true);assert.equal(feed[0].comments[0].name,'Collaborator');assert.equal(feed[0].author.name,'Creator');assert.equal(feed[0].author.email,undefined);
  assert.equal((await call('/community/posts')).data[0].liked,false);
  await call('/me/community/posts/'+pid+'/like','PUT',b.token,{liked:false});assert.equal((await call('/community/posts')).data[0].likes,0);
  await call('/me/community/posts/'+pid,'DELETE',a.token);assert.equal((await call('/community/posts')).data.length,0);assert.equal(db.prepare('select count(*) n from community_comments').get().n,0);
 }finally{await new Promise(resolve=>server.close(resolve));db.close();rmSync(dir,{recursive:true,force:true})}
});
