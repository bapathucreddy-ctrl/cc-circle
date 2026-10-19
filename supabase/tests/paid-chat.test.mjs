import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';import {btree_gist} from '@electric-sql/pglite/contrib/btree_gist';
test('both participants can chat only after payment and closing a service purges its messages',async()=>{
 const db=await PGlite.create({extensions:{btree_gist}});
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,phone text);
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema auth to authenticated,service_role;grant execute on function auth.uid() to authenticated,service_role;create publication supabase_realtime;`);
  const folder=new URL('../migrations/',import.meta.url);for(const file of (await readdir(folder)).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,folder),'utf8'));
  const [customer,pro,stranger]=Array.from({length:3},()=>crypto.randomUUID());for(const id of [customer,pro,stranger])await db.query('insert into auth.users(id) values($1)',[id]);
  async function as(id,run){await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);try{return await run();}finally{await db.exec('reset role');}}
  await as(pro,()=>db.query('select public.save_professional_profile($1,$2,$3)',[{display_name:'Studio Chat',category:'Photographer',city:'Bengaluru',bio:'A professional photographer for events and editorial work.',specialties:['Portrait'],longitude:77.64,latitude:12.97,portfolio_urls:['https://example.com/work'],public_specs:{}},{},{name:'Portrait session',amount_paise:500000,duration_minutes:60}]));
  const service=(await db.query('select id from public.services')).rows[0].id;
  const request=async day=>as(customer,async()=>(await db.query("select (public.request_booking($1,now()+make_interval(days=>$2),'Chat test venue',77.64,12.97,'',$3,559800)).*",[service,day,crypto.randomUUID()])).rows[0]);
  const send=(who,id,body='Hello')=>as(who,()=>db.query('insert into public.messages(booking_id,sender_id,body) values($1,$2,$3)',[id,who,body]));
  const read=(who,id)=>as(who,async()=>(await db.query('select body from public.messages where booking_id=$1',[id])).rows);
  let day=1;
  for(const status of ['requested','accepted']){
   const b=await request(day++);await db.query('update public.bookings set status=$1 where id=$2',[status,b.id]);
   for(const who of [customer,pro]){await assert.rejects(()=>send(who,b.id),/paid, active booking/);assert.equal((await read(who,b.id)).length,0);}
  }
  for(const status of ['accepted','en_route','arrived']){
   const b=await request(day++);await db.query('update public.bookings set status=$1,paid_at=now() where id=$2',[status,b.id]);
   await send(customer,b.id,'Customer message');await send(pro,b.id,'Professional message');
   for(const who of [customer,pro])assert.equal((await read(who,b.id)).length,2);
   assert.equal((await read(stranger,b.id)).length,0);await assert.rejects(()=>send(stranger,b.id),/paid, active booking/);
   await db.query("update public.bookings set status='completed',service_ended_at=now() where id=$1",[b.id]);
   assert.equal((await db.query('select count(*)::int as n from public.messages where booking_id=$1',[b.id])).rows[0].n,0);
   for(const who of [customer,pro])await assert.rejects(()=>send(who,b.id),/paid, active booking/);
  }
  for(const status of ['cancelled','declined']){
   const b=await request(day++);await db.query("update public.bookings set status='accepted',paid_at=now() where id=$1",[b.id]);await send(customer,b.id);
   await db.query('update public.bookings set status=$1 where id=$2',[status,b.id]);
   assert.equal((await db.query('select count(*)::int as n from public.messages where booking_id=$1',[b.id])).rows[0].n,0);
   for(const who of [customer,pro])await assert.rejects(()=>send(who,b.id),/paid, active booking/);
  }
  // An end timestamp closes chat even before the separate completed-status write.
  const b=await request(day++);await db.query("update public.bookings set status='arrived',paid_at=now() where id=$1",[b.id]);await send(pro,b.id);
  await db.query('update public.bookings set service_ended_at=now() where id=$1',[b.id]);
  for(const who of [customer,pro]){assert.equal((await read(who,b.id)).length,0);await assert.rejects(()=>send(who,b.id),/paid, active booking/);}
 }finally{await db.close();}
});
