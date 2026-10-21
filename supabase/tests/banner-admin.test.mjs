import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {btree_gist} from '@electric-sql/pglite/contrib/btree_gist';
test('banner publishing and marketing uploads require an explicitly approved, verified admin',async()=>{
 const db=await PGlite.create({extensions:{btree_gist}});
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,phone text,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,service_role;grant execute on function auth.uid() to authenticated,service_role;create publication supabase_realtime;
   create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select,insert,delete on storage.objects to authenticated;`);
  const folder=new URL('../migrations/',import.meta.url);for(const file of(await readdir(folder)).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,folder),'utf8'));
  const admin=crypto.randomUUID(),normal=crypto.randomUUID(),unverified=crypto.randomUUID();
  await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'admin@example.test',now()),($2,'user@example.test',now()),($3,'pending@example.test',null)",[admin,normal,unverified]);
  await db.exec("select public.grant_banner_admin('admin@example.test');select public.grant_banner_admin('pending@example.test')");
  async function as(who,run){await db.query("select set_config('request.jwt.claim.sub',$1,false)",[who]);await db.exec('set role authenticated');try{return await run();}finally{await db.exec('reset role');}}
  for(const who of [normal,unverified])assert.equal((await as(who,()=>db.query('select public.is_banner_admin() as ok'))).rows[0].ok,false);
  await assert.rejects(()=>as(normal,()=>db.exec("select public.grant_banner_admin('user@example.test')")),/permission denied/);
  await assert.rejects(()=>as(normal,()=>db.exec("insert into public.home_campaigns(id,title,subtitle,category,starts_at,ends_at,enabled) values('illegal','Bad','','Makeup',now(),now()+interval '1 day',false)")),/row-level security/);
  const path=`${admin}/${crypto.randomUUID()}.png`;
  await assert.rejects(()=>as(normal,()=>db.query("insert into storage.objects(bucket_id,name) values('home-banners',$1)",[path])),/row-level security/);
  await as(admin,()=>db.query("insert into storage.objects(bucket_id,name) values('home-banners',$1)",[path]));
  const payload=[path];
  await assert.rejects(()=>as(admin,()=>db.exec("insert into public.home_campaigns(id,title,subtitle,category,starts_at,ends_at,enabled) values('no-image','Bad','','Makeup',now(),now()+interval '1 day',true)")),/row-level security/);
  await assert.rejects(()=>as(admin,()=>db.query("insert into public.home_campaigns(id,title,subtitle,category,starts_at,ends_at,image_path,enabled) values('no-size','Bad','','Makeup',now(),now()+interval '1 day',$1,true)",payload)),/campaign_image_shape/);
  await as(admin,()=>db.query("insert into public.home_campaigns(id,title,subtitle,category,starts_at,ends_at,image_path,image_width,image_height,enabled) values('banner-test','Wedding','','Makeup',now(),now()+interval '1 day',$1,1536,1024,true)",payload));
  assert.equal((await as(normal,()=>db.exec("update public.home_campaigns set enabled=false where id='banner-test'")))[0].affectedRows,0);
  assert.equal((await as(admin,()=>db.query("delete from storage.objects where name=$1 returning id",payload))).rows.length,0);
  await assert.rejects(()=>as(admin,()=>db.exec("update public.home_campaigns set service_key='wedding-photography' where id='banner-test'")),/selected profession/);
  await as(admin,()=>db.exec("update public.home_campaigns set enabled=false where id='banner-test'"));
  await as(admin,()=>db.exec("update public.home_campaigns set featured_service_keys=array['bridal-makeup','wedding-photography','photo-editing'] where id='banner-test'"));
  assert.deepEqual((await as(admin,()=>db.query("select featured_service_keys from public.home_campaigns where id='banner-test'"))).rows[0].featured_service_keys,['bridal-makeup','wedding-photography','photo-editing']);
  await assert.rejects(()=>as(admin,()=>db.exec("update public.home_campaigns set featured_service_keys=array['not-a-service'] where id='banner-test'")),/distinct available services/);
  await assert.rejects(()=>as(admin,()=>db.exec("update public.home_campaigns set featured_service_keys=array['bridal-makeup','bridal-makeup'] where id='banner-test'")),/distinct available services/);
  await as(admin,()=>db.exec("update public.home_campaigns set featured_service_keys=array[]::text[] where id='banner-test'"));
  assert.equal((await db.query("select public from storage.buckets where id='home-banners'")).rows[0].public,true);
 }finally{await db.close();}
});
