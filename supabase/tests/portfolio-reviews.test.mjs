import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';

test('hair professionals, private portfolio imports and verified post-service reviews', async () => {
 const db=await PGlite.create({extensions:{btree_gist}});
 try {
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,phone text);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,service_role;grant execute on function auth.uid() to authenticated,service_role;create publication supabase_realtime;`);
  const folder=new URL('../migrations/',import.meta.url);
  for(const file of (await readdir(folder)).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,folder),'utf8'));
  const [pro,customer,stranger]=Array.from({length:3},()=>crypto.randomUUID());
  await db.query('insert into auth.users(id) values($1),($2),($3)',[pro,customer,stranger]);
  async function as(id,run){await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);try{return await run();}finally{await db.exec('reset role');}}
  const profile={display_name:'Studio Scissor',category:'HairStylist',city:'Bengaluru',bio:'Professional styling for bridal, editorial and everyday occasions.',specialties:['Bridal hair'],longitude:77.64,latitude:12.978,portfolio_urls:[],public_specs:{}};
  const save=p=>as(pro,()=>db.query('select public.save_professional_profile($1,$2,$3)',[p,{}, {name:'Hair session',amount_paise:500000,duration_minutes:60}]));
  await assert.rejects(()=>save({...profile,display_name:'@my_private_id'}),/Import or upload/);
  await assert.rejects(()=>save(profile),/Import or upload/);
  const photos=Array.from({length:15},(_,i)=>({kind:'image',media_url:`https://cdn.example.com/${i}.jpg`,source_id:`private-source-${i}`}));
  await db.query("select public.replace_portfolio_media($1,'instagram',$2)",[pro,photos]);
  assert.equal((await db.query('select count(*)::int as n from public.portfolio_media where professional_id=$1',[pro])).rows[0].n,10);
  await save(profile);
  const importId=crypto.randomUUID();
  await db.query("insert into public.portfolio_imports(id,professional_id,provider,state_hash,expires_at) values($1,$2,'youtube','test-hash',now()+interval '10 minutes')",[importId,pro]);
  await as(pro,async()=>assert.equal((await db.query('select * from public.portfolio_import_status($1)',[importId])).rows[0].status,'pending'));
  await as(stranger,async()=>assert.equal((await db.query('select * from public.portfolio_import_status($1)',[importId])).rows.length,0));
  const firstClaim=await db.query("update public.portfolio_imports set status='processing' where id=$1 and status='pending' and expires_at>now() returning id",[importId]);
  const replay=await db.query("update public.portfolio_imports set status='processing' where id=$1 and status='pending' and expires_at>now() returning id",[importId]);
  assert.equal(firstClaim.rows.length,1);assert.equal(replay.rows.length,0,'OAuth state cannot be claimed twice');
  await as(stranger,async()=>{
   const rows=(await db.query("select * from public.discover_professionals('HairStylist',77.64,12.978,'',15,false)")).rows;
   assert.match(rows[0].display_name,/^[a-z]+[0-9]{6}$/);
   for(const table of ['portfolio_media','portfolio_connections','portfolio_imports'])await assert.rejects(()=>db.query(`select * from public.${table}`),/permission denied/);
   await assert.rejects(()=>db.query("select public.replace_portfolio_media($1,'instagram',$2)",[pro,photos]),/permission denied/);
   await assert.rejects(()=>db.query('select private.save_professional_profile($1,$2,$3)',[profile,{},{}]),/permission denied/);
  });
  await db.query("select public.replace_portfolio_media($1,'youtube',$2)",[pro,Array.from({length:10},(_,i)=>({kind:'youtube',youtube_id:'dQw4w9WgXcQ',source_id:String(i)}))]);
  assert.equal((await db.query('select count(*)::int as n from public.portfolio_media where professional_id=$1',[pro])).rows[0].n,10);
  assert.equal((await db.query("select count(*)::int as n from public.portfolio_media where professional_id=$1 and provider='instagram'",[pro])).rows[0].n,5);
  await assert.rejects(()=>db.query("select public.append_portfolio_upload($1,$2,'image')",[pro,`${pro}/${crypto.randomUUID()}.jpg`]),/full/);
  const service=(await db.query('select id from public.services where professional_id=$1',[pro])).rows[0].id;
  const booking=await as(customer,async()=>(await db.query("select (public.request_booking($1,now()+interval '1 day','Test hair venue',77.64,12.978,'',$2,559800)).*",[service,crypto.randomUUID()])).rows[0]);
  await assert.rejects(()=>as(customer,()=>db.query('select public.submit_booking_review($1,5,$2)',[booking.id,'Great styling'])),/after service completion/);
  await db.query("update public.bookings set status='completed',paid_at=now() where id=$1",[booking.id]);
  await assert.rejects(()=>as(stranger,()=>db.query("select public.submit_booking_review($1,5,'Forged')",[booking.id])),/Booking not found/);
  await assert.rejects(()=>as(pro,()=>db.query("select public.submit_booking_review($1,5,'Self review')",[booking.id])),/Booking not found/);
  await assert.rejects(()=>as(customer,()=>db.query("select public.submit_booking_review($1,6,'Invalid')",[booking.id])),/1-5 stars/);
  await as(customer,()=>db.query("select public.submit_booking_review($1,5,'Excellent styling and care.')",[booking.id]));
  await as(customer,()=>db.query("select public.submit_booking_review($1,1,'Changed on replay')",[booking.id]));
  const summary=await as(stranger,async()=>(await db.query('select public.professional_reviews($1) as summary',[pro])).rows[0].summary);
  assert.equal(summary.count,1);assert.equal(summary.average,5);assert.equal(summary.reviews[0].comment,'Excellent styling and care.');
  assert.ok(!JSON.stringify(summary).includes(customer));assert.ok(!JSON.stringify(summary).includes(booking.id));
  await as(stranger,async()=>assert.equal((await db.query('select * from public.booking_reviews')).rows.length,0));
  await as(customer,async()=>assert.equal((await db.query('select * from public.booking_reviews')).rows.length,1));
 }finally{await db.close();}
});
