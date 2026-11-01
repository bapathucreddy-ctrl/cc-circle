import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile,readdir} from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';import {btree_gist} from '@electric-sql/pglite/contrib/btree_gist';
test('private bases, first names, required equipment and admin-only bulk confirmation',async()=>{
 const db=await PGlite.create({extensions:{btree_gist}});try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,phone text,phone_confirmed_at timestamptz,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated,service_role;grant execute on function auth.uid() to authenticated,service_role;create publication supabase_realtime;`);
 const folder=new URL('../migrations/',import.meta.url);for(const file of(await readdir(folder)).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL(file,folder),'utf8'));
 const [admin,client,online,offline,third]=Array.from({length:5},()=>crypto.randomUUID());for(const [i,id]of[admin,client,online,offline,third].entries())await db.query("insert into auth.users(id,email,email_confirmed_at,phone,phone_confirmed_at) values($1,$2,now(),$3,now())",[id,`person${i}@example.test`,`91990000000${i}`]);await db.exec("select public.grant_banner_admin('person0@example.test')");
 async function as(id,fn){await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated');try{return await fn();}finally{await db.exec('reset role');}}
 for(const [i,id]of[online,offline,third].entries())await as(id,()=>db.query("select public.complete_registration($1,$2,null,true)",[['Arjun Kumar','Priya Reddy','Rahul Rao'][i],`person${i+2}@example.test`]));
 assert.equal((await db.query('select professional_display_name from public.profiles where id=$1',[online])).rows[0].professional_display_name,'Arjun');
 await assert.rejects(()=>as(online,()=>db.query("select public.complete_registration('Arjun Photography','person2@example.test',null,true)")),/real full name/);
 const equipment={'lenses':'24-70mm f2.8','lighting-kit':'Two LED kits','backup-camera':'Canon R6','backup-memory':'Two 128GB SD cards','equipment-pricing':'Included in session','photo-software':['Adobe Lightroom']};
 async function save(id,category='Photographer',specs=equipment,home=true){return as(id,()=>db.query('select public.save_professional_profile($1,$2,$3)',[{display_name:'Fake Studio',category,city:'Bengaluru',bio:'Experienced creative professional for local celebrations.',specialties:['Events'],longitude:77,latitude:12,portfolio_urls:['https://example.test/work'],public_specs:specs},home?{home_location:{address:'Private house 18, Test street, Bengaluru',longitude:77.641234,latitude:12.971234}}:{},{name:'Event session',amount_paise:500000,duration_minutes:60}]));}
 await assert.rejects(()=>save(online,'Photographer',equipment,false),/home address/);
 await assert.rejects(()=>save(online,'Photographer',{}),/equipment/);
 await assert.rejects(()=>save(online,'Photographer',{...equipment,'photo-software':[]}),/software/);
 await assert.rejects(()=>save(online,'Editor',{}),/editing services/);
 await save(online);await save(offline);await save(third);
 await as(online,()=>db.query('update public.professionals set available_now=true where id=$1',[online]));
 await assert.rejects(()=>as(online,()=>db.query("update public.professionals set public_specs='{}' where id=$1",[online])),/permission denied/);
 const profile=(await db.query('select * from public.professionals where id=$1',[online])).rows[0];assert.equal(profile.display_name,'Arjun');assert.equal(Number(profile.longitude),77.64);assert.ok(!JSON.stringify(profile).includes('Private house'));
 const privateRows=(await as(client,()=>db.query('select * from public.professional_home_locations'))).rows;assert.equal(privateRows.length,0);
 await db.query('update public.professional_home_locations set longitude=78 where professional_id=$1',[third]);
 const found=(await as(client,()=>db.query("select * from public.discover_live_professionals('Photographer',77.64,12.97,'',10,true)"))).rows;assert.equal(found.length,2);assert.equal(found[0].id,online);assert.equal(found[1].available_now,false);assert.equal(Number(found[1].longitude),77.64);assert.equal(found[1].location_updated_at,null);
 const service=(await db.query('select id from public.services where professional_id=$1',[online])).rows[0].id;
 await db.query("update public.profiles set full_name='Customer Name',display_name='Customer Name' where id=$1",[client]);
 const starts=new Date(Date.now()+86400000).toISOString();
 const event=(await as(client,()=>db.query('select public.create_team_request($1,$2,$3,$4,$5,$6,$7,$8) as id',['Wedding team','Photographers needed for a family celebration.',starts,'Event hall in Bengaluru',77.64,12.97,[{category:'Photographer',quantity:1}],crypto.randomUUID()]))).rows[0].id;
 await assert.rejects(()=>as(client,()=>db.query('select public.admin_bulk_requests()')),/Admin access required/);
 const application=(await as(online,()=>db.query("select public.apply_team_request($1,$2,'Available for the event') as id",[event,service]))).rows[0].id;
 assert.equal((await db.query('select count(*)::int n from public.bookings')).rows[0].n,0);
 await assert.rejects(()=>as(client,()=>db.query('select public.accept_team_applicant($1,559800)',[application])),/admin approval/);
 await assert.rejects(()=>as(client,()=>db.query('select public.review_bulk_response($1,true)',[application])),/Admin access required/);
 const pending=(await as(online,()=>db.query('select public.team_requests() value'))).rows[0].value;assert.equal(pending[0].my_application.review_status,'pending');
 const queue=(await as(admin,()=>db.query('select public.admin_bulk_requests() value'))).rows[0].value;assert.equal(queue[0].responses[0].full_name,'Arjun Kumar');
 const booking=(await as(admin,()=>db.query('select public.review_bulk_response($1,true) id',[application]))).rows[0].id;
 assert.equal((await as(admin,()=>db.query('select public.review_bulk_response($1,true) id',[application]))).rows[0].id,booking);
 const b=(await db.query('select * from public.bookings where id=$1',[booking])).rows[0];assert.equal(b.client_id,client);assert.equal(b.status,'accepted');
 const notifications=(await db.query("select user_id from public.app_notifications where booking_id=$1 and dedupe_key like 'status:%:accepted'",[booking])).rows;assert.equal(notifications.length,2);
 const service2=(await db.query('select id from public.services where professional_id=$1',[offline])).rows[0].id;
 // A second professional cannot overbook the requested role, including via direct admin RPC.
 await assert.rejects(()=>as(offline,()=>db.query("select public.apply_team_request($1,$2,'Also available')",[event,service2])),/filled/);
 await save(third,'Editor',{'editing-services':['Video Editing'],'video-software':['Adobe Premiere Pro']});
 await assert.rejects(()=>as(third,()=>db.query("insert into public.services(professional_id,name,amount_paise,duration_minutes,service_key) values($1,'Photo editing',500000,60,'photo-editing')",[third])),/software/);
 // Portrait review is bound to the exact immutable upload, and replacement removes approval.
 const path1=online+'/approved-portrait-a.jpg',path2=online+'/approved-portrait-b.jpg';
 await db.query('insert into public.professional_photos(professional_id,storage_path) values($1,$2)',[online,path1]);
 await assert.rejects(()=>as(admin,()=>db.query("select public.review_professional($1,'approved')",[online])),/photo changed/);
 await as(admin,()=>db.query("select public.review_professional($1,'approved','Portrait checked',null,$2)",[online,path1]));
 assert.equal((await db.query('select review_status from public.professional_photos where professional_id=$1',[online])).rows[0].review_status,'approved');
 const reviewed=(await as(admin,()=>db.query('select public.admin_professional_profile($1) value',[online]))).rows[0].value;
 assert.ok(reviewed.home_address.includes('Private house'));assert.equal(reviewed.original_name,'Arjun Kumar');
 await db.query('update public.professional_photos set storage_path=$2 where professional_id=$1',[online,path2]);
 assert.equal((await db.query('select verified_at from public.professionals where id=$1',[online])).rows[0].verified_at,null);
 assert.equal((await db.query('select review_status from public.professional_photos where professional_id=$1',[online])).rows[0].review_status,'pending');
 await assert.rejects(()=>as(admin,()=>db.query("select public.review_professional($1,'approved','Stale review',$2,$3)",[online,reviewed.reviewed_at,path1])),/photo changed/);
 await assert.rejects(()=>as(client,()=>db.query('select public.admin_professional_profile($1)',[online])),/Admin access required/);
 // A decline is visible to admins without creating a booking.
 const event2=(await as(client,()=>db.query('select public.create_team_request($1,$2,$3,$4,$5,$6,$7,$8) id',['Next event','Photographer needed for another family gathering.',new Date(Date.now()+2*86400000).toISOString(),'Another event hall',77.64,12.97,[{category:'Photographer',quantity:1}],crypto.randomUUID()]))).rows[0].id;
 await as(offline,()=>db.query('select public.reject_team_request($1)',[event2]));
 const declined=(await as(admin,()=>db.query('select public.admin_bulk_requests() value'))).rows[0].value.find(e=>e.id===event2);assert.equal(declined.declines[0].status,'declined');
 const response2=(await as(online,()=>db.query("select public.apply_team_request($1,$2,'Available') id",[event2,service]))).rows[0].id;
 await as(admin,()=>db.query("select public.review_bulk_response($1,false,'Request revised')",[response2]));
 await assert.rejects(()=>as(admin,()=>db.query('select public.review_bulk_response($1,true)',[response2])),/already been reviewed/);
 assert.equal((await db.query('select booking_id from private.team_applications where id=$1',[response2])).rows[0].booking_id,null);

 assert.equal((await db.query('select count(*)::int as n from public.professionals p where p.display_name is distinct from private.professional_username(p.id)')).rows[0].n,0,'Deployed profiles match the server-derived public first name');
 }finally{await db.close();}
});
