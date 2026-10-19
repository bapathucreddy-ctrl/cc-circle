import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';

async function fixture(run) {
 const db=await PGlite.create({extensions:{btree_gist}});
 try {
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,phone text);
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   grant usage on schema auth to authenticated,service_role;grant execute on function auth.uid() to authenticated,service_role;create publication supabase_realtime;`);
  const folder=new URL('../migrations/',import.meta.url);
  for(const file of (await readdir(folder)).filter(f=>f.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(file,folder),'utf8'));
  const [customer,pro,stranger]=Array.from({length:3},()=>crypto.randomUUID());
  for(const id of [customer,pro,stranger]) await db.query('insert into auth.users(id) values($1)',[id]);
  async function as(id,run){await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);try{return await run();}finally{await db.exec('reset role');}}
  await as(pro,()=>db.query('select public.save_professional_profile($1,$2,$3)',[{display_name:'Lens Studio',category:'Photographer',city:'Bengaluru',bio:'A professional photographer for events and editorial work.',specialties:['Portrait'],longitude:77.64,latitude:12.97,portfolio_urls:['https://example.com/work'],public_specs:{}},{},{name:'Portrait session',amount_paise:500000,duration_minutes:60}]));
  const service=(await db.query('select id from public.services')).rows[0].id;
  const request=async()=>as(customer,async()=>(await db.query("select (public.request_booking($1,now()+interval '1 day','Private venue address',77.64,12.97,'',$2,559800)).*",[service,crypto.randomUUID()])).rows[0]);
  const notes=async who=>as(who,async()=>(await db.query('select * from public.app_notifications order by created_at')).rows);
  await run({db,as,customer,pro,stranger,service,request,notes});
 } finally {await db.close();}
}

test('iOS APNs devices retain environment, privacy and provider-specific leases beside legacy Android',()=>fixture(async({db,as,pro,stranger,request})=>{
 const android=crypto.randomUUID(),ios=crypto.randomUUID(),token='ab'.repeat(32);
 await as(pro,()=>db.query("select public.register_notification_device('professional',$1,'test-android-fcm-device-token')",[android]));
 await assert.rejects(()=>as(pro,()=>db.query("select public.register_ios_notification_device('professional',$1,$2,'bad-environment')",[ios,token])),/Invalid Apple/);
 await as(pro,()=>db.query("select public.register_ios_notification_device('professional',$1,$2,'sandbox')",[ios,token]));
 await assert.rejects(()=>as(stranger,()=>db.query('select * from private.notification_devices')),/permission denied/);
 await assert.rejects(()=>as(pro,()=>db.query("select public.claim_notification_deliveries_for_providers(array['apns'])")),/permission denied/);
 await as(pro,()=>db.query("select public.notification_settings('professional',$1)",[{push_enabled:true}]));await request();
 const androidJobs=(await db.query('select public.claim_notification_deliveries() jobs')).rows[0].jobs;assert.equal(androidJobs.length,1);assert.equal(androidJobs[0].provider,'fcm');
 assert.equal((await db.query("select attempts from private.notification_deliveries j join private.notification_devices d on j.device_id=d.id where d.provider='apns'")).rows[0].attempts,0,'missing APNs configuration must not consume retries');
 const jobs=(await db.query("select public.claim_notification_deliveries_for_providers(array['apns']) jobs")).rows[0].jobs;assert.equal(jobs.length,1);assert.equal(jobs[0].provider,'apns');assert.equal(jobs[0].environment,'sandbox');
 await as(pro,()=>db.query("select public.register_ios_notification_device('professional',$1,$2,'production')",[ios,token]));
 // An environment change invalidates the already-claimed snapshot.
 assert.equal((await db.query('select public.notification_delivery_current($1,$2) ok',[jobs[0].id,jobs[0].attempt])).rows[0].ok,false);
}));

test('notifications are participant-only, idempotent, private and close with paid chat',()=>fixture(async({db,as,customer,pro,stranger,request,notes})=>{
 const b=await request();
 assert.equal((await notes(customer))[0].title,'Booking request sent');
 assert.equal((await notes(pro))[0].title,'New booking request');
 assert.deepEqual(await notes(stranger),[]);
 await assert.rejects(()=>as(stranger,()=>db.query("insert into public.app_notifications(user_id,app_variant,kind,title,body,dedupe_key) values($1,'customer','booking','Forged','Forged','forged')",[customer])),/permission denied/);
 await assert.rejects(()=>as(customer,()=>db.query('select public.claim_notification_deliveries()')),/permission denied/);
 await db.query("update public.bookings set status='accepted',paid_at=now() where id=$1",[b.id]);
 const count=(await notes(customer)).length;
 await db.query("update public.bookings set notes='unrelated edit' where id=$1",[b.id]);
 assert.equal((await notes(customer)).length,count);
 await as(pro,()=>db.query("insert into public.messages(booking_id,sender_id,body) values($1,$2,'Secret contact text')",[b.id,pro]));
 assert.equal((await notes(customer)).filter(n=>n.kind==='message').length,1);
 assert.ok(!(JSON.stringify(await notes(customer))).includes('Secret contact text'));
 assert.ok(!(JSON.stringify(await notes(customer))).includes('Private venue address'));
 const n=(await notes(customer))[0];
 await as(stranger,()=>db.query('select public.read_notifications($1,$2)',['customer',n.id]));
 assert.equal((await notes(customer)).find(row=>row.id===n.id).read_at,null);
 await db.query("update public.bookings set status='en_route' where id=$1",[b.id]);
 await db.query("update public.bookings set status='arrived' where id=$1",[b.id]);
 await db.query('update public.bookings set service_started_at=now() where id=$1',[b.id]);
 await db.query('update public.bookings set completion_requested_at=now() where id=$1',[b.id]);
 await db.query("update public.bookings set service_ended_at=now(),status='completed' where id=$1",[b.id]);
 const titles=(await notes(customer)).map(n=>n.title);
 for(const title of ['Booking accepted','Payment confirmed','Your professional is on the way','Your professional has arrived','Service started','Confirm service completion','Service completed']) assert.ok(titles.includes(title),title);
 assert.equal((await notes(customer)).filter(n=>n.kind==='message').length,0);
 await db.query("insert into public.booking_reviews(booking_id,client_id,professional_id,rating,comment) values($1,$2,$3,5,'Great work')",[b.id,customer,pro]);
 assert.ok((await notes(pro)).some(n=>n.title==='New rating and review'));
 await as(customer,()=>db.query("select public.read_notifications('customer')"));
 assert.ok((await notes(customer)).every(n=>n.read_at));
}));

test('push consent, mute, leases, retries and device reassignment preserve notification isolation',()=>fixture(async({db,as,customer,pro,stranger,request})=>{
 const installation=crypto.randomUUID(), token='opaque-fcm-token-for-a-test-device';
 const register=who=>as(who,()=>db.query("select public.register_notification_device('professional',$1,$2)",[installation,token]));
 await register(pro);
 const first=await request();
 assert.equal((await db.query('select count(*)::int n from private.notification_deliveries')).rows[0].n,0,'push needs explicit consent');
 await as(pro,()=>db.query("select public.notification_settings('professional',$1)",[{push_enabled:true,messages_enabled:false}]));
 await db.query("update public.bookings set status='accepted',paid_at=now() where id=$1",[first.id]);
 await as(customer,()=>db.query("insert into public.messages(booking_id,sender_id,body) values($1,$2,'No push while muted')",[first.id,customer]));
 assert.equal((await db.query("select count(*)::int n from private.notification_deliveries j join public.app_notifications n on n.id=j.notification_id where n.kind='message'")).rows[0].n,0);
 const claim=async()=>(await db.query('select public.claim_notification_deliveries() jobs')).rows[0].jobs;
 const jobs=await claim(); assert.ok(jobs.length>=2);
 assert.equal((await db.query('select public.notification_delivery_current($1,$2) allowed',[jobs[0].id,jobs[0].attempt])).rows[0].allowed,true);
 assert.deepEqual(await claim(),[],'leased jobs cannot be claimed twice');
 await register(pro); assert.equal((await db.query('select count(*)::int n from private.notification_deliveries')).rows[0].n,jobs.length,'refresh same token retains queued deliveries');
 await db.query("select public.finish_notification_delivery($1,$2,'retry')",[jobs[0].id,jobs[0].attempt]);
 assert.deepEqual(await claim(),[],'backoff prevents immediate retries');
 await db.query("update private.notification_deliveries set next_attempt_at=now()-interval '1 second' where id=$1",[jobs[0].id]);
 const retry=(await claim())[0]; assert.equal(retry.attempt,2);
 await db.query("select public.finish_notification_delivery($1,1,'sent')",[retry.id]);
 assert.equal((await db.query('select state from private.notification_deliveries where id=$1',[retry.id])).rows[0].state,'sending','old worker cannot finish a newer lease');
 await register(stranger);
 assert.equal((await db.query('select public.notification_delivery_current($1,$2) allowed',[retry.id,retry.attempt])).rows[0].allowed,false,'a claimed delivery cannot survive device account reassignment');
 assert.equal((await db.query('select count(*)::int n from private.notification_deliveries')).rows[0].n,0,'reassignment purges old account deliveries');
 assert.equal((await db.query('select user_id from private.notification_devices')).rows[0].user_id,stranger);
 await as(stranger,()=>db.query("select public.unregister_notification_device($1,'professional')",[installation]));
 assert.equal((await db.query('select count(*)::int n from private.notification_devices')).rows[0].n,0);
}));

test('event opportunities/applications route only to matching participants; reminders deduplicate',()=>fixture(async({db,as,customer,pro,stranger,service,request,notes})=>{
 await db.query("update public.profiles set display_name='Test customer' where id=$1",[customer]);
 await db.query('update public.professionals set is_published=true where id=$1',[pro]);
 const event=(await as(customer,()=>db.query("select public.create_team_request('Wedding day','Photography for our wedding ceremony',now()+interval '2 days','Test event venue',77.64,12.97,$1,$2) id",[[{category:'Photographer',quantity:2}],crypto.randomUUID()]))).rows[0].id;
 assert.ok((await notes(pro)).some(n=>n.event_id===event&&n.title==='New event opportunity'));
 assert.equal((await notes(stranger)).length,0);
 await as(pro,()=>db.query("select public.apply_team_request($1,$2,'Available for this event')",[event,service]));
 assert.ok((await notes(customer)).some(n=>n.event_id===event&&n.title==='New event application'));
 await as(customer,()=>db.query('select public.delete_team_request($1)',[event]));
 assert.ok(!(await notes(customer)).some(n=>n.event_id===event));
 const b=await request();
 await db.query("update public.bookings set status='accepted',starts_at=now()+interval '30 minutes',ends_at=now()+interval '90 minutes' where id=$1",[b.id]);
 await db.query('select public.queue_booking_reminders()'); await db.query('select public.queue_booking_reminders()');
 assert.equal((await notes(customer)).filter(n=>n.kind==='reminder').length,1);
 assert.equal((await notes(pro)).filter(n=>n.kind==='reminder').length,1);
}));
