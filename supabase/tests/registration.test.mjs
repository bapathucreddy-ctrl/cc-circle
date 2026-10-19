import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';

test('one-time registration separates private account identity from professional public names', async () => {
 const db=await PGlite.create({ extensions:{btree_gist} });
 try {
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create table auth.users(id uuid primary key,phone text,email text,phone_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated,service_role;grant execute on function auth.uid() to authenticated,service_role;
    create publication supabase_realtime;`);
  const folder=new URL('../migrations/',import.meta.url);
  const legacy=crypto.randomUUID();
  for(const file of (await readdir(folder)).filter(f=>f.endsWith('.sql')).sort()) {
   if(file.startsWith('202610180004')) {
    await db.query("insert into auth.users(id,phone,phone_confirmed_at) values($1,'919000000099',now())",[legacy]);
    await db.query("update public.profiles set full_name='Legacy Private Name',professional_display_name='Legacy Private Name',contact_email='legacy@example.com' where id=$1",[legacy]);
    await db.query("insert into public.professionals(id,display_name,category,city,bio,longitude,latitude) values($1,'Legacy Private Name','Makeup','Bengaluru','Professional makeup for special events.',77.64,12.97)",[legacy]);
   }
   await db.exec(await readFile(new URL(file,folder),'utf8'));
  }
  const migrated=(await db.query('select p.full_name,p.contact_email,p.professional_display_name,t.display_name from public.profiles p join public.professionals t on t.id=p.id where p.id=$1',[legacy])).rows[0];
  assert.equal(migrated.full_name,'Legacy Private Name');assert.equal(migrated.contact_email,'legacy@example.com');
  assert.match(migrated.display_name,/^[a-z]+[0-9]{6}$/);assert.equal(migrated.display_name,migrated.professional_display_name);
  const [customer,professional,google]=Array.from({length:3},()=>crypto.randomUUID());
  await db.query("insert into auth.users(id,phone,phone_confirmed_at) values($1,'919000000001',now()),($2,'919000000002',now())",[customer,professional]);
  await db.query("insert into auth.users(id,email,raw_user_meta_data) values($1,'google@example.com','{\"full_name\":\"Google Private Name\"}')",[google]);
  async function as(id,run){await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);try{return await run();}finally{await db.exec('reset role');}}
  const state=id=>as(id,async()=>(await db.query('select public.my_registration() as value')).rows[0].value);
  const finish=(id,name,email,alias=null,pro=false)=>as(id,async()=>(await db.query('select public.complete_registration($1,$2,$3,$4) as value',[name,email,alias,pro])).rows[0].value);
  assert.equal((await state(customer)).completed_at,null);
  await assert.rejects(()=>finish(customer,'Customer Full Name','invalid'),/valid email/);
  const c=await finish(customer,'  Customer   Full Name  ','customer@example.com');
  assert.equal(c.full_name,'Customer Full Name');assert.equal(c.email,'customer@example.com');assert.ok(c.completed_at);assert.equal(c.professional_name,'');
  assert.equal((await finish(customer,'Customer Full Name','customer@example.com')).completed_at,c.completed_at,'Repeated registration preserves completion marker');
  await as(customer,()=>assert.rejects(()=>db.query("update public.profiles set registration_completed_at=now() where id=$1",[customer]),/permission denied/));
  await as(customer,()=>assert.rejects(()=>db.query("update public.profiles set display_name='Bypass' where id=$1",[customer]),/permission denied/));
  const g=await state(google);assert.equal(g.full_name,'Google Private Name');assert.equal(g.email_from_sign_in,true);assert.equal(g.phone_verified,false);
  await assert.rejects(()=>finish(google,'Google Private Name','google@example.com'),/Verify your mobile/);
  await db.query("update auth.users set phone='919000000003' where id=$1",[google]);
  await assert.rejects(()=>finish(google,'Google Private Name','google@example.com'),/Verify your mobile/);
  await db.query('update auth.users set phone_confirmed_at=now() where id=$1',[google]);
  const completedGoogle=await finish(google,'Google Private Name','changed@example.com');
  assert.equal(completedGoogle.email,'google@example.com','Google email comes from server-side Auth, not a submitted substitute');
  const p=await finish(professional,'Mira Rao','mira@example.com',null,true);assert.match(p.professional_name,/^[a-z]+[0-9]{6}$/);
  const alias=p.professional_name;
  for(const requested of ['Mira Rao','Mira Rao Studio','Northern Light'])assert.equal((await finish(professional,'Mira Rao','mira@example.com',requested,true)).professional_name,alias,'Submitted names cannot replace the assigned alias');
  const profile={display_name:'Northern Light',category:'Photographer',city:'Bengaluru',bio:'Experienced wedding and portrait photographer for creative projects.',specialties:['Weddings'],longitude:77.64,latitude:12.97,portfolio_urls:['https://example.com/work'],public_specs:{}};
  const save=name=>as(professional,()=>db.query('select public.save_professional_profile($1,$2,$3)',[{...profile,display_name:name},{},{name:'Portrait service',amount_paise:500000,duration_minutes:60}]));
  await save('Mira Rao');
  await save('Northern Light');
  await as(customer,async()=>{
    const publicProfile=(await db.query('select * from public.professionals where id=$1',[professional])).rows[0];
    assert.equal(publicProfile.display_name,alias);assert.ok(!JSON.stringify(publicProfile).includes('Mira Rao'));assert.ok(!JSON.stringify(publicProfile).includes('mira@example.com'));
    assert.equal((await db.query('select * from public.profiles where id=$1',[professional])).rows.length,0,'Private name/email are owner-only');
  });
  await save('Mira');assert.equal((await state(professional)).professional_name,alias,'Profile edits keep the generated username');
  await as(professional,()=>assert.rejects(()=>db.query('select * from private.professional_usernames'),/permission denied/));
  await db.query("update public.professionals set display_name='919000000002' where id=$1",[professional]);
  assert.equal((await db.query('select display_name from public.professionals where id=$1',[professional])).rows[0].display_name,alias);
  await as(customer,()=>db.query("select public.save_customer_full_name('New Customer Full Name')"));
  assert.equal((await state(customer)).full_name,'New Customer Full Name');
  assert.equal((await state(professional)).full_name,'Mira Rao','Customer updates cannot change the professional private name');
  const id=(await db.query('select id from public.services where professional_id=$1',[professional])).rows[0].id;
  const booking=await as(customer,async()=>(await db.query("select (public.request_booking($1,now()+interval '1 day','Test venue',77.64,12.97,'',$2,559800)).*",[id,crypto.randomUUID()])).rows[0]);
  const people=await as(customer,async()=>(await db.query('select * from public.booking_participants($1)',[booking.id])).rows[0]);
  assert.equal(people.professional_name,alias);assert.equal(people.client_name,'New Customer Full Name');
 }finally{await db.close();}
});
