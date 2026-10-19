import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';

test('multi-profession event applications reserve exact headcounts with private quotes and normal bookings', async () => {
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
  const when=new Date(Date.now()+86400000).toISOString();
  const roles=[{category:'Photographer',quantity:2},{category:'Makeup',quantity:2},{category:'HairStylist',quantity:1}];
  const requestId=crypto.randomUUID();
  const post=(who=customer,roleList=roles,key=requestId)=>as(who,async()=>(await db.query('select public.create_team_request($1,$2,$3,$4,$5,$6,$7,$8) as id',
    ['Wedding celebration','Two photographers, bridal makeup and family hair styling for our wedding.',when,'Selected wedding venue, Bengaluru',77.64,12.97,roleList,key])).rows[0].id);
  await assert.rejects(()=>post(stranger),/Save your customer name/);
  await assert.rejects(()=>post(customer,[]),/one and six/);
  await assert.rejects(()=>post(customer,[{category:'Photographer',quantity:0}]),/check constraint/);
  await assert.rejects(()=>post(customer,[{category:'Photographer',quantity:1.5}]),/whole number/);
  await assert.rejects(()=>post(customer,[{category:'Photographer',quantity:1},{category:'Photographer',quantity:2}]),/duplicate key/);
  const event=await post();assert.equal(await post(),event,'Posting retries create one event');
  const list=id=>as(id,async()=>(await db.query('select public.team_requests() as value')).rows[0].value);
  assert.equal((await list(customer))[0].roles.reduce((n,r)=>n+r.quantity,0),5);
  assert.equal((await list(stranger)).length,0);
  assert.equal((await list(pros[6])).length,0,'Wrong professions cannot see this event');
  assert.equal((await list(pros[0]))[0].is_owner,false);
  await as(pros[0],async()=>{
    await assert.rejects(()=>db.query('select * from private.team_applications'),/permission denied/);
    await assert.rejects(()=>db.query('select public.team_applicants($1)',[event]),/Customer event not found/);
  });
  const apply=(i,service=serviceIds[i])=>as(pros[i],async()=>(await db.query("select public.apply_team_request($1,$2,'I can provide this event service.') as id",[event,service])).rows[0].id);
  await assert.rejects(()=>apply(6),/does not need/);
  await assert.rejects(()=>apply(0,serviceIds[1]),/your active services/);
  const applications=[];for(let i=0;i<6;i++)applications.push(await apply(i));
  assert.equal(await apply(0),applications[0],'Application retries cannot duplicate a professional');
  assert.equal((await db.query('select count(*)::int as n from public.bookings')).rows[0].n,0,'Applying does not book or charge anyone');
  const applicantList=()=>as(customer,async()=>(await db.query('select public.team_applicants($1) as value',[event])).rows[0].value);
  const applicants=await applicantList();assert.equal(applicants.length,6);assert.equal(applicants[0].total_paise,559800);
  const own=(await list(pros[0]))[0].my_application;
  assert.equal(own.net_paise,500000);assert.equal(own.total_paise,undefined,'Professional cannot see the customer total');
  assert.ok(!JSON.stringify(await list(pros[0])).includes(pros[1]),'Other applicants are private');
  const accept=(i,total=559800,who=customer)=>as(who,async()=>(await db.query('select (public.accept_team_applicant($1,$2)).*',[applications[i],total])).rows[0]);
  await assert.rejects(()=>accept(0,559800,stranger),/Customer application not found/);
  await assert.rejects(()=>accept(0,559800,pros[0]),/Customer application not found/);
  await assert.rejects(()=>accept(0,1),/latest application price/);
  await db.query('update public.services set amount_paise=600000 where id=$1',[serviceIds[0]]);
  await assert.rejects(()=>accept(0),/service has changed/);
  await as(pros[0],()=>db.query('select public.withdraw_team_application($1)',[event]));
  assert.equal((await applicantList()).length,5);
  applications[0]=await apply(0);
  const refreshed=(await applicantList()).find(a=>a.professional_id===pros[0]);assert.ok(refreshed.total_paise>559800);
  await assert.rejects(()=>accept(0),/latest application price/);
  const first=await accept(0,refreshed.total_paise);assert.equal(first.status,'accepted');assert.equal(first.paid_at,null);
  assert.equal(first.venue,'Selected wedding venue, Bengaluru');assert.equal(first.client_id,customer);assert.equal(first.professional_id,pros[0]);
  assert.equal((await accept(0,refreshed.total_paise)).id,first.id,'Acceptance retries return the same booking');
  await as(pros[0],()=>assert.rejects(()=>db.query("select public.transition_booking($1,'en_route')",[first.id]),/Verified payment/));
  await as(pros[0],()=>assert.rejects(()=>db.query('select public.withdraw_team_application($1)',[event]),/accepted application/));
  await accept(1);await assert.rejects(()=>accept(2),/headcount.*filled/);
  await as(customer,()=>db.query("select public.transition_booking($1,'cancelled')",[first.id]));
  await accept(2);
  // Blocking a provider after they apply is rechecked during customer selection.
  await db.query("insert into public.availability_blocks(professional_id,starts_at,ends_at) values($1,$2,$2::timestamptz+interval '3 hours')",[pros[3],when]);
  await assert.rejects(()=>accept(3),/time is unavailable/);
  assert.equal((await applicantList()).find(a=>a.id===applications[3]).booking_id,null,'Failed acceptance is atomic');
  await db.query('delete from public.availability_blocks where professional_id=$1',[pros[3]]);
  await accept(3);await accept(4);await accept(5);
  const completedTeam=(await list(customer))[0];assert.equal(completedTeam.roles.reduce((n,r)=>n+r.selected,0),5);
  const active=(await db.query("select count(*)::int as n from public.bookings where status='accepted'")).rows[0].n;assert.equal(active,5);
  assert.equal((await db.query('select count(*)::int as n from public.payout_jobs')).rows[0].n,0);
  const other=await post(customer,[{category:'Makeup',quantity:1}],crypto.randomUUID());
  await as(pros[3],()=>assert.rejects(()=>db.query('select public.apply_team_request($1,$2)',[other,serviceIds[3]]),/unavailable at this event time/));
  const bookedBefore=(await db.query('select id,status,amount_paise,paid_at from public.bookings order by id')).rows;
  await as(stranger,()=>assert.rejects(()=>db.query('select public.delete_team_request($1)',[event]),/Your event was not found/));
  await as(pros[0],()=>assert.rejects(()=>db.query('select public.delete_team_request($1)',[event]),/Your event was not found/));
  await as('',()=>assert.rejects(()=>db.query('select public.delete_team_request($1)',[event]),/Sign in/));
  await db.exec('set role anon');await assert.rejects(()=>db.query('select public.delete_team_request($1)',[event]),/permission denied/);await db.exec('reset role');
  await as(customer,()=>db.query('select public.delete_team_request($1)',[event]));
  assert.equal((await list(customer)).some(item=>item.id===event),false);
  assert.equal((await list(pros[0])).some(item=>item.id===event),false);
  assert.equal((await db.query('select count(*)::int as n from private.team_applications where event_id=$1',[event])).rows[0].n,0);
  assert.equal((await db.query('select count(*)::int as n from private.team_roles where event_id=$1',[event])).rows[0].n,0);
  assert.deepEqual((await db.query('select id,status,amount_paise,paid_at from public.bookings order by id')).rows,bookedBefore,'Deleting a post cannot delete/cancel/charge accepted bookings');
  assert.equal((await list(customer)).some(item=>item.id===other),true,'Other events remain visible');
  await as(customer,()=>assert.rejects(()=>db.query('select public.accept_team_applicant($1,$2)',[applications[0],559800]),/not found/));
  await assert.rejects(()=>apply(0),/This team request is unavailable/);
 }finally{await db.close();}
});
