import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {btree_gist} from '@electric-sql/pglite/contrib/btree_gist';

test('typed sessions, private avatars, campaign windows and complete rating distributions preserve access boundaries',async()=>{
 const db=await PGlite.create({extensions:{btree_gist}});
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,phone text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,service_role;grant execute on function auth.uid() to authenticated,service_role;create publication supabase_realtime;`);
  const folder=new URL('../migrations/',import.meta.url);for(const file of(await readdir(folder)).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,folder),'utf8'));
  const pro=crypto.randomUUID(),customer=crypto.randomUUID();await db.query('insert into auth.users(id) values($1),($2)',[pro,customer]);
  await db.query("insert into public.professionals(id,display_name,category,city,bio,longitude,latitude,is_published) values($1,'Studio Circle','Makeup','Bengaluru','Professional makeup for weddings and events.',77.64,12.97,true)",[pro]);
  async function as(who,run){await db.query("select set_config('request.jwt.claim.sub',$1,false)",[who]);await db.exec('set role authenticated');try{return await run();}finally{await db.exec('reset role');}}
  const service=await as(pro,async()=>(await db.query("insert into public.services(professional_id,name,amount_paise,duration_minutes) values($1,'Bridal makeup',100000,60) returning *",[pro])).rows[0]);
  assert.equal(service.service_key,'bridal-makeup');
  await assert.rejects(()=>as(pro,()=>db.query("update public.services set service_key='event-photography' where id=$1",[service.id])),/professional category/);
  await assert.rejects(()=>as(customer,()=>db.query("insert into public.services(professional_id,name,amount_paise,duration_minutes) values($1,'Party makeup',100000,60)",[pro])),/row-level security/);
  await assert.rejects(()=>as(pro,()=>db.query('select * from public.professional_photos')),/permission denied/);
  await db.query("insert into public.professional_photos values($1,$2,now())",[pro,pro+'/approved-test.jpg']);
  await db.exec("insert into public.home_campaigns values('test-live','Live','Test','Makeup','party-makeup',now()-interval '1 day',now()+interval '1 day',1,true),('test-expired','Past','Test','Makeup','party-makeup',now()-interval '2 days',now()-interval '1 day',1,true),('test-future','Future','Test','Makeup','party-makeup',now()+interval '1 day',now()+interval '2 days',1,true),('test-disabled','Disabled','Test','Makeup','party-makeup',now()-interval '1 day',now()+interval '1 day',1,false)");
  const campaigns=await as(customer,()=>db.query("select id from public.home_campaigns where id like 'test-%'"));assert.deepEqual(campaigns.rows.map(r=>r.id),['test-live']);
  await assert.rejects(()=>as(customer,()=>db.query("update public.home_campaigns set enabled=false where id='test-live'")),/permission denied/);
  await db.query(`insert into public.bookings(client_id,professional_id,service_id,request_id,service_name,amount_paise,service_amount_paise,buyer_fee_paise,talent_fee_paise,talent_payout_paise,starts_at,ends_at,venue,venue_longitude,venue_latitude,status,paid_at)
   select $1,$2,$3,gen_random_uuid(),'Bridal makeup',113600,108700,4900,8700,100000,now()+interval '1 day',now()+interval '2 days','Test venue',77.64,12.97,'completed',now() from generate_series(1,25)`,[customer,pro,service.id]);
  await db.query("insert into public.booking_reviews(booking_id,client_id,professional_id,rating,comment) select id,client_id,professional_id,case when row_number() over(order by id)%2=1 then 5 else 4 end,'A verified booking review' from public.bookings where professional_id=$1",[pro]);
  const summary=(await as(customer,()=>db.query('select public.professional_reviews($1) as value',[pro]))).rows[0].value;
  assert.equal(summary.count,25);assert.equal(summary.reviews.length,20);assert.equal(summary.distribution['5'],13);assert.equal(summary.distribution['4'],12);assert.equal(summary.distribution['1'],0);assert.ok(!JSON.stringify(summary).includes(customer));
  const page=async(who,offset,limit=20)=>(await as(who,()=>db.query('select public.professional_review_page($1,$2,$3) as value',[pro,offset,limit]))).rows[0].value;
  assert.equal((await page(customer,0)).length,20);assert.equal((await page(customer,20)).length,5);assert.equal((await page(customer,25)).length,0);
  assert.equal((await page(customer,0,100)).length,25);
  assert.ok((await page(customer,0)).every(row=>Object.keys(row).sort().join(',')==='comment,created_at,rating'));
  await db.query('update public.professionals set is_published=false where id=$1',[pro]);
  assert.equal((await page(customer,0)).length,0);assert.equal((await page(pro,0)).length,20);
  await db.query("update public.professionals set category='Photographer' where id=$1",[pro]);assert.equal((await db.query('select active from public.services where id=$1',[service.id])).rows[0].active,false);
 }finally{await db.close();}
});
