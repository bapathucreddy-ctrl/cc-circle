import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createDb} from '../src/db.js';
import {createApp} from '../src/app.js';

test('curated portfolios, project shortlists, applications and private replies persist with access controls',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'circle-market-'));const db=createDb(':memory:');const app=createApp(db,{uploadRoot:dir,portfolioFetchPage:async url=>({url,html:'<img src="https://cdn.example.com/one.jpg" width="500"><img src="https://cdn.example.com/two.jpg" width="500">'})});const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));const base=`http://127.0.0.1:${server.address().port}`;
 const call=async(path,method='GET',token,body)=>{const r=await fetch(base+path,{method,headers:{...(token?{Authorization:`Bearer ${token}`}:{}) ,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,data:await r.json()}};
 const register=async(name,role)=>{const r=await call('/auth/register','POST',null,{name,email:name+'@test.example',password:'password-test-123',role});assert.equal(r.status,201);return r.data};
 try{
  const talent=await register('Creator','talent'),buyer=await register('Studio','buyer'),other=await register('Other','buyer');
  const fields={name:'Creator',city:'Hyderabad',category:'Photography',bio:'Commercial product photography and short-form video.',availability:'Available this month',role:'talent',crafts:['Camera'],specialties:'Product, Fashion',experience:'5 years',day_rate:15000,rate:'₹15,000 per day',credits:'Campaign — photography',available_from:'2026-10-01',available_until:'2026-12-31'};
  assert.equal((await call('/me','PUT',talent.token,{...fields,available_until:'2026-01-01'})).status,400);
  assert.equal((await call('/me','PUT',talent.token,{...fields,available_from:'2026-02-31'})).status,400);assert.equal((await call('/me','PUT',talent.token,{...fields,available_from:'2026-99-99'})).status,400);assert.equal((await call('/me','PUT',talent.token,fields)).status,200);
  let r=await call('/talents?category=Camera&specialty=Product&available=2026-10-20');assert.equal(r.data.length,1);assert.equal(r.data[0].rate,fields.rate);assert.equal((await call('/talents?maxRate=10000')).data.length,0);assert.equal((await call('/talents?maxRate=20000')).data.length,1);assert.equal((await call('/talents?offset=40')).data.length,0);
  await call('/me/portfolios','POST',talent.token,{url:'https://example.com/work'});r=await call('/me','GET',talent.token);assert.equal(r.data.media.length,2);const [first,second]=r.data.media;
  assert.equal((await call(`/me/media/${second.id}`,'PUT',buyer.token,{cover:true})).status,403);
  assert.equal((await call(`/me/media/${second.id}`,'PUT',talent.token,{cover:true,caption:'Product campaign — photography'})).status,200);
  await call(`/me/media/${first.id}`,'PUT',talent.token,{hidden:true});
  r=await call(`/talents/${talent.user.id}`);assert.equal(r.data.media.length,1);assert.equal(r.data.cover,second.url);assert.match(r.data.media[0].caption,/photography/);
  await call('/me/portfolios/refresh','POST',talent.token,{});r=await call(`/talents/${talent.user.id}`);assert.equal(r.data.media.length,1);assert.equal(r.data.media[0].cover,true);
  await call(`/me/shortlist/${talent.user.id}`,'POST',buyer.token,{});r=await call('/me/projects','POST',buyer.token,{name:'October campaign'});const pid=r.data.id;
  assert.equal((await call(`/me/projects/${pid}/talent/${talent.user.id}`,'POST',other.token,{})).status,404);
  await call(`/me/projects/${pid}/talent/${talent.user.id}`,'POST',buyer.token,{});r=await call('/me/projects','GET',buyer.token);const share=r.data[0].share_token;assert.equal(r.data[0].people.length,1);
  r=await call(`/shared/projects/${share}`);assert.equal(r.data.people.length,1);assert.equal(r.data.people[0].email,undefined);
  await call(`/me/projects/${pid}/share`,'POST',buyer.token,{});assert.equal((await call(`/shared/projects/${share}`)).status,404);
  await call('/me/searches','POST',buyer.token,{name:'Camera in Hyderabad',filters:{category:'Camera',city:'Hyderabad'}});r=await call('/me/searches','GET',buyer.token);assert.equal(r.data[0].matches,1);
  await call(`/me/following/${talent.user.id}`,'POST',buyer.token,{});r=await call('/me/insights','GET',talent.token);assert.equal(r.data.followers,1);assert.equal(r.data.shortlists,1);
  r=await call('/briefs','POST',buyer.token,{title:'Product launch',category:'Photography',crafts:['Photography','Camera'],city:'Hyderabad',description:'Product campaign for a local studio.',budget:'₹40,000',dates:'October',deliverables:'20 edited photos'});assert.equal(r.status,201);const bid=r.data.id;
  r=await call(`/briefs/${bid}/apply`,'POST',talent.token,{message:'My product work is relevant and I am available.'});assert.equal(r.status,201);const iid=r.data.id;
  assert.equal((await call(`/briefs/${bid}/apply`,'POST',talent.token,{message:'Another application for the same brief'})).status,409);
  assert.equal((await call(`/me/inquiries/${iid}/messages`,'GET',other.token)).status,404);
  assert.equal((await call(`/me/inquiries/${iid}/messages`,'POST',other.token,{body:'Intrusion'})).status,404);
  await call(`/me/inquiries/${iid}/messages`,'POST',buyer.token,{body:'Can you share your approach?'});await call(`/me/inquiries/${iid}/messages`,'POST',talent.token,{body:'I will shoot in a studio with a clean background.'});r=await call(`/me/inquiries/${iid}/messages`,'GET',buyer.token);assert.equal(r.data.length,2);
  assert.equal((await call(`/me/inquiries/${iid}/confirm`,'POST',buyer.token,{})).status,400);
  assert.equal((await call(`/me/inquiries/${iid}`,'PATCH',talent.token,{status:'accepted'})).status,404);
  r=await call('/me/applications','GET',buyer.token);assert.equal(r.data.length,1);const aid=r.data[0].id;
  assert.equal((await call(`/me/applications/${aid}`,'PATCH',other.token,{status:'accepted'})).status,404);
  assert.equal((await call(`/me/applications/${aid}`,'PATCH',buyer.token,{status:'accepted'})).status,200);
  assert.equal((await call(`/me/inquiries/${iid}/confirm`,'POST',buyer.token,{})).status,200);
  r=await call('/me/inquiries','GET',talent.token);assert.ok(r.data[0].confirmed_at);
  await call('/me','DELETE',talent.token);r=await call('/me/projects','GET',buyer.token);assert.equal(r.data[0].people.length,0);r=await call('/me/applications','GET',buyer.token);assert.equal(r.data.length,0);
  assert.equal((await call('/me','DELETE',buyer.token)).status,200);
 }finally{server.close();db.close();rmSync(dir,{recursive:true,force:true})}
});
