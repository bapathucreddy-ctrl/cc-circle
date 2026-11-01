import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile,readdir} from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';import {btree_gist} from '@electric-sql/pglite/contrib/btree_gist';
test('daily promotions require admin configuration and customer consent, randomize distinct picks, deduplicate and stop on pause',async()=>{
 const db=await PGlite.create({extensions:{btree_gist}});try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,phone text,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,service_role;grant execute on function auth.uid() to authenticated,service_role;create publication supabase_realtime;`);
  const folder=new URL('../migrations/',import.meta.url);for(const file of(await readdir(folder)).filter(file=>file.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,folder),'utf8'));
  const [admin,customer,muted,professional]=Array.from({length:4},()=>crypto.randomUUID());for(const [i,id]of[admin,customer,muted,professional].entries())await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[id,i===0?'admin@example.test':`person${i}@example.test`]);await db.exec("select public.grant_banner_admin('admin@example.test')");
  async function as(id,fn){await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');try{return await fn();}finally{await db.exec('reset role');}}
  await assert.rejects(()=>as(customer,()=>db.query('select public.admin_promotion_settings()')),/Admin access required/);
  await assert.rejects(()=>as(customer,()=>db.query('select public.queue_daily_promotions()')),/permission denied/);
  const config=async()=>(await as(admin,()=>db.query('select public.admin_promotion_settings() as config'))).rows[0].config;
  const messages=['Your next portrait awaits','Make room for a little glam','Great hair for great plans','Your big idea needs a creator','Capture the moments that matter'];
  async function save(enabled,count=3){const before=await config();return(await as(admin,()=>db.query('select public.save_promotion_settings($1,$2,$3,$4) as config',[messages,enabled,count,before.updated_at]))).rows[0].config;}
  const before=await config();assert.equal(before.enabled,false);
  await assert.rejects(()=>as(admin,()=>db.query('select public.save_promotion_settings($1,true,3,$2)',[Array(5).fill('Duplicate'),before.updated_at])),/five different/);
  await save(true);
  for(const [id,variant,optin]of[[customer,'customer',true],[muted,'customer',false],[professional,'professional',true]]){
   const settings=(await as(id,()=>db.query('select public.notification_settings($1) as settings',[variant]))).rows[0].settings;assert.equal(settings.promotions_enabled,false);
   await as(id,()=>db.query('select public.notification_settings($1,$2)',[variant,{push_enabled:true,promotions_enabled:optin}]));
   await as(id,()=>db.query('select public.register_notification_device($1,$2,$3)',[variant,crypto.randomUUID(),id+'-device-token']));
  }
  const today=(await db.query("select (now() at time zone 'Asia/Kolkata')::date::text as day")).rows[0].day;
  await db.query("select public.queue_daily_promotions(($1::date::timestamp at time zone 'Asia/Kolkata'))",[today]);
  const plans=(await db.query("select *,extract(hour from scheduled_at at time zone 'Asia/Kolkata')::int as hour from private.promotion_schedule order by slot")).rows;
  assert.equal(plans.length,3);assert.equal(new Set(plans.map(row=>row.template_slot)).size,3);
  assert.ok(plans.every(row=>row.user_id===customer));assert.ok(plans[0].hour>=10&&plans[0].hour<12);assert.ok(plans[1].hour>=14&&plans[1].hour<16);assert.ok(plans[2].hour>=18&&plans[2].hour<20);
  for(const plan of plans){for(let repeat=0;repeat<2;repeat++)await db.query("select public.queue_daily_promotions($1::timestamptz+interval '1 second')",[plan.scheduled_at]);}
  const notes=(await db.query("select * from public.app_notifications where kind='promotion'")).rows;assert.equal(notes.length,3);assert.equal(new Set(notes.map(row=>row.body)).size,3);assert.ok(notes.every(row=>messages.includes(row.body)&&row.user_id===customer&&row.app_variant==='customer'));
  const jobs=(await db.query("select public.claim_notification_deliveries_for_providers(array['fcm']) as jobs")).rows[0].jobs;assert.equal(jobs.length,3);assert.ok(jobs.every(job=>messages.includes(job.promotion_body)));
  assert.equal((await db.query('select public.notification_delivery_current($1,$2) as ok',[jobs[0].id,jobs[0].attempt])).rows[0].ok,true);
  await as(customer,()=>db.query("select public.notification_settings('customer','{\"promotions_enabled\":false}')"));
  assert.equal((await db.query('select public.notification_delivery_current($1,$2) as ok',[jobs[0].id,jobs[0].attempt])).rows[0].ok,false);
  await as(customer,()=>db.query("select public.notification_settings('customer','{\"promotions_enabled\":true}')"));await save(false);
  assert.equal((await db.query('select public.notification_delivery_current($1,$2) as ok',[jobs[0].id,jobs[0].attempt])).rows[0].ok,false);
 }finally{await db.close();}
});
