import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';

test('wedding hourly invoices use OTP times, round up, protect rates and pay out only after final payment', async () => {
 const db=await PGlite.create({ extensions:{ btree_gist } });
 try {
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create table auth.users(id uuid primary key,phone text);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated,service_role;grant execute on function auth.uid() to authenticated,service_role;
    create publication supabase_realtime;`);
  const folder=new URL('../migrations/',import.meta.url);
  for(const file of (await readdir(folder)).filter(name=>name.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,folder),'utf8'));
  const [customer,stranger,...pros]=Array.from({length:9},()=>crypto.randomUUID());
  for(const id of [customer,stranger,...pros])await db.query('insert into auth.users(id) values($1)',[id]);
  await db.query("update public.profiles set display_name='Wedding Customer' where id=$1",[customer]);
  const kinds=['Photographer','Photographer','Photographer','Makeup','Makeup','HairStylist','Dancer'];
  async function as(id,run){await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);try{return await run();}finally{await db.exec('reset role');}}
  for(let i=0;i<pros.length;i++)await as(pros[i],()=>db.query('select public.save_professional_profile($1,$2,$3)',[
    {display_name:`Event Studio ${i}`,category:kinds[i],city:'Bengaluru',bio:'Experienced professional available for beautiful wedding events.',specialties:['Weddings'],longitude:77.64,latitude:12.97,portfolio_urls:['https://example.com/work'],public_specs:{}},
    {},{name:'Event session',amount_paise:500000,duration_minutes:120}
  ]));
  const serviceIds=[];
  for(const id of pros)serviceIds.push((await db.query('select id from public.services where professional_id=$1',[id])).rows[0].id);
  const when=new Date(Date.now()+86400000).toISOString(),requestId=crypto.randomUUID();
  const create=()=>as(customer,async()=>(await db.query("select public.create_team_request('Wedding hourly','Wedding photography with actual service hours.',$1,'Wedding venue',77.64,12.97,$2,$3,'hourly',8) as id",[when,[{category:'Photographer',quantity:1}],requestId])).rows[0].id);
  const event=await create();assert.equal(await create(),event);
  const application=await as(pros[0],async()=>(await db.query("select public.apply_team_request($1,$2,'Hourly photographer',150000) as id",[event,serviceIds[0]])).rows[0].id);
  const applicants=await as(customer,async()=>(await db.query('select public.team_applicants($1) as data',[event])).rows[0].data);
  assert.equal(applicants[0].total_paise,163000,'customer service hourly rate is snapshotted separately from the once-only booking fee');
  const booking=await as(customer,async()=>(await db.query('select (public.accept_team_applicant($1,163000)).*',[application])).rows[0]);
  assert.equal(booking.billing_mode,'hourly');assert.equal(booking.hourly_net_paise,150000);assert.equal(booking.hourly_rate_paise,163000);assert.equal(booking.billing_finalised_at,null);
  assert.equal(new Date(booking.ends_at)-new Date(booking.starts_at),8*3600000);
  await assert.rejects(as(stranger,()=>db.query('select public.service_otp($1,\'start\')',[booking.id])),/Customer booking/);
  await assert.rejects(db.query("insert into public.payment_orders(booking_id,order_id,amount_paise,environment) values($1,'too-early',$2,'sandbox')",[booking.id,booking.amount_paise]),/completed final invoice/);
  await as(pros[0],()=>db.query("select public.transition_booking($1,'en_route')",[booking.id]));
  await as(pros[0],()=>db.query("select public.transition_booking($1,'arrived')",[booking.id]));
  const otp=phase=>as(customer,async()=>(await db.query('select public.service_otp($1,$2) as data',[booking.id,phase])).rows[0].data.code);
  await as(pros[0],()=>assert.rejects(db.query("select public.transition_booking($1,'completed')",[booking.id]),/end OTP/));
  const start=await otp('start');await as(pros[0],()=>db.query("select public.service_action($1,'start',$2)",[booking.id,start]));
  await db.query("update public.bookings set service_started_at=now()-interval '2 hours 10 minutes' where id=$1",[booking.id]);
  await as(pros[0],()=>db.query("select public.service_action($1,'request_completion')",[booking.id]));
  const end=await otp('end');await as(pros[0],()=>db.query("select public.service_action($1,'end',$2)",[booking.id,end]));
  const final=(await db.query('select * from public.bookings where id=$1',[booking.id])).rows[0];
  assert.equal(final.status,'completed');assert.equal(final.billable_hours,3);assert.ok(final.billing_finalised_at);assert.equal(final.paid_at,null);
  assert.equal(final.service_amount_paise,489000);assert.equal(final.talent_payout_paise,450000);assert.equal(final.buyer_fee_paise,14700);assert.equal(final.amount_paise,503700);
  assert.equal((await db.query('select count(*)::int as n from public.payout_jobs')).rows[0].n,0);
  await assert.rejects(db.query('update public.bookings set amount_paise=amount_paise+100 where id=$1',[booking.id]),/cannot be changed/);
  await assert.rejects(as(customer,()=>db.query('select public.submit_booking_review($1,5,\'Great\')',[booking.id])),/Settle your final invoice/);
  const rounded=await db.query("select private.service_billable_hours('2026-10-16 10:00Z','2026-10-16 11:00Z') as exact,private.service_billable_hours('2026-10-16 10:00Z','2026-10-16 11:00:01Z') as over,private.service_billable_hours('2026-10-16 10:00Z','2026-10-16 10:00Z') as minimum");
  assert.deepEqual(rounded.rows[0],{exact:1,over:2,minimum:1});
  await assert.rejects(as(customer,()=>db.query("select private.service_billable_hours(now(),now())")),/permission denied/);
  await db.query("insert into public.payment_orders(booking_id,order_id,amount_paise,environment) values($1,'hourly-final',$2,'sandbox')",[booking.id,final.amount_paise]);
  await db.query("select public.confirm_payment('hourly-final','payment-success',503700)");await db.query("select public.confirm_payment('hourly-final','payment-success',503700)");
  const payouts=await db.query('select amount_paise from public.payout_jobs where booking_id=$1',[booking.id]);assert.equal(payouts.rows.length,1);assert.equal(payouts.rows[0].amount_paise,450000);
  await as(customer,()=>db.query("select public.submit_booking_review($1,5,'Great wedding photographer')",[booking.id]));
 }finally{await db.close();}
});
