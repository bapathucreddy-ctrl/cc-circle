import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {btree_gist} from '@electric-sql/pglite/contrib/btree_gist';

async function fixture(run){const db=await PGlite.create({extensions:{btree_gist}});try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,phone text,email text,raw_user_meta_data jsonb default '{}',phone_confirmed_at timestamptz);create table auth.sessions(id uuid primary key,user_id uuid,created_at timestamptz);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,service_role;grant execute on function auth.uid() to authenticated,service_role;create publication supabase_realtime;`);
 const folder=new URL('../migrations/',import.meta.url);for(const name of (await readdir(folder)).filter(n=>n.endsWith('.sql')).sort())await db.exec(await readFile(new URL(name,folder),'utf8'));
 const user=crypto.randomUUID(),other=crypto.randomUUID();await db.query('insert into auth.users(id) values($1),($2)',[user,other]);
 const ids=Array.from({length:4},()=>crypto.randomUUID());for(let i=0;i<ids.length;i++)await db.query("insert into auth.sessions values($1,$2,now()+($3::int*interval '1 minute'))",[ids[i],user,i]);
 async function as(sid,work,who=user){await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[who,JSON.stringify({sub:who,session_id:sid})]);await db.exec('set role authenticated');try{return await work();}finally{await db.exec('reset role');}}
 const activate=(sid,role)=>as(sid,async()=>(await db.query('select public.activate_app_session($1) ok',[role])).rows[0].ok);
 const current=(sid,role)=>as(sid,async()=>(await db.query('select public.app_session_is_current($1) ok',[role])).rows[0].ok);
 await run({db,user,other,ids,as,activate,current});
}finally{await db.close();}}

test('new logins replace only their own app; restored old sessions cannot take control or read/write',()=>fixture(async({db,ids,as,activate,current})=>{
 const [oldCustomer,professional,newCustomer]=ids;
 assert.equal(await activate(oldCustomer,'customer'),true);assert.equal(await activate(professional,'professional'),true);
 await as(oldCustomer,()=>db.query("select public.register_notification_device('customer',$1,'customer-notification-device-token')",[crypto.randomUUID()]));
 await as(professional,()=>db.query("select public.register_notification_device('professional',$1,'professional-notification-device-token')",[crypto.randomUUID()]));
 assert.equal(await activate(newCustomer,'customer'),true);assert.equal(await current(oldCustomer,'customer'),false);assert.equal(await current(professional,'professional'),true);assert.equal(await current(newCustomer,'customer'),true);
 assert.equal(await activate(oldCustomer,'customer'),false,'old session must never steal the new login');
 assert.deepEqual((await db.query('select app_variant from private.notification_devices')).rows,[{app_variant:'professional'}]);
 await assert.rejects(()=>as(oldCustomer,()=>db.query('select * from public.profiles')),/session was replaced/);
 await assert.rejects(()=>as(oldCustomer,()=>db.query('select public.my_registration()')),/session was replaced/);
 await assert.rejects(()=>as(oldCustomer,()=>db.query("select public.register_notification_device('customer',$1,'cannot-register-revoked-device-token')",[crypto.randomUUID()])),/session was replaced/);
 await as(professional,()=>db.query('select public.my_registration()'));
 await assert.rejects(()=>as(newCustomer,()=>db.query('select public.app_session_allowed($1,$2)',[crypto.randomUUID(),oldCustomer])),/permission denied/);
}));

test('late activation, release and forged session identities cannot affect a newer device',()=>fixture(async({db,user,other,ids,as,activate,current})=>{
 const [old,,latest]=ids;assert.equal(await activate(latest,'customer'),true);assert.equal(await activate(old,'customer'),false);
 await as(old,()=>db.query("select public.release_app_session('customer')"));assert.equal(await current(latest,'customer'),true);
 assert.equal(await as(latest,async()=>(await db.query("select public.activate_app_session('customer') ok")).rows[0].ok,other),false,'a session ID is checked against its Auth owner');
 await as(latest,()=>db.query("select public.release_app_session('customer')"));assert.equal(await current(latest,'customer'),false);assert.equal(await activate(latest,'customer'),false);
 assert.equal((await db.query('select public.app_session_allowed($1,$2) ok',[user,latest])).rows[0].ok,false);
 await assert.rejects(()=>as(null,()=>db.query("select public.activate_app_session('customer')")),/Sign in again/);
}));

test('professional takeover clears the old pin; old cleanup cannot erase the new location',()=>fixture(async({db,user,ids,as,activate})=>{
 const [old,customer,newPro]=ids;await activate(old,'professional');
 await as(old,()=>db.query('select public.save_professional_profile($1,$2,$3)',[{display_name:'Lens Studio',category:'Photographer',city:'Bengaluru',bio:'A professional photographer for events and editorial work.',specialties:['Portrait'],longitude:77.64,latitude:12.97,portfolio_urls:['https://example.com/work'],public_specs:{}},{},{name:'Portrait session',amount_paise:500000,duration_minutes:60}]));
 await db.query('update public.professionals set is_published=true,available_now=true where id=$1',[user]);
 await as(old,()=>db.query('select public.publish_professional_location_fix(77.64,12.97,10)'));
 await activate(customer,'customer');assert.equal((await db.query('select count(*)::int n from private.professional_live_locations')).rows[0].n,1,'customer login leaves professional GPS alone');
 await activate(newPro,'professional');assert.equal((await db.query('select count(*)::int n from private.professional_live_locations')).rows[0].n,0);
 await as(newPro,()=>db.query('select public.publish_professional_location_fix(77.65,12.98,10)'));
 await assert.rejects(()=>as(old,()=>db.query('select public.clear_professional_location()')),/session was replaced/);
 assert.equal((await db.query('select longitude from private.professional_live_locations')).rows[0].longitude,77.65);
}));
