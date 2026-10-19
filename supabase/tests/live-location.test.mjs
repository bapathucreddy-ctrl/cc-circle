import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';

test('live discovery uses fresh owner GPS, hides offline/stale pins and protects raw coordinates', async () => {
  const db = await PGlite.create({ extensions: { btree_gist } });
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key,phone text);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to authenticated,service_role;
      grant execute on function auth.uid() to authenticated,service_role;
      create publication supabase_realtime;`);
    const folder = new URL('../migrations/', import.meta.url);
    for (const name of (await readdir(folder)).filter(name => name.endsWith('.sql')).sort()) await db.exec(await readFile(new URL(name, folder), 'utf8'));
    const [talent, customerA, customerB] = Array.from({ length: 3 }, () => crypto.randomUUID());
    await db.query('insert into auth.users(id) values($1),($2),($3)', [talent, customerA, customerB]);
    async function as(user, run) {
      await db.exec('set role authenticated'); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
      try { return await run(); } finally { await db.exec('reset role'); }
    }
    await as(talent, () => db.query('select public.save_professional_profile($1,$2,$3)', [
      { display_name: 'Availability Artist', category: 'Actor', city: 'Bengaluru', bio: 'Experienced performer checking availability and scheduling.', specialties: [], longitude: 77.64, latitude: 12.978, portfolio_urls: ['https://example.com/work'] },
      {}, { name: 'Performance', amount_paise: 500000, duration_minutes: 60 },
    ]));

    await as(talent,()=>db.query('update public.professionals set available_now=true where id=$1',[talent]));
    const discovery=(now=false)=>as(customerA,async()=> (await db.query("select * from public.discover_live_professionals('Actor',77.64,12.978,'',15,$1)",[now])).rows);
    let rows=await discovery(); assert.equal(rows.length,1);assert.equal(rows[0].location_updated_at,null);assert.equal(rows[0].available_now,true);
    assert.equal((await discovery(true)).length,1,'online professionals appear in available-now results without GPS');
    await assert.rejects(as(customerA,()=>db.query('select public.publish_professional_location(77.641234,12.979876)')));
    await as(talent,()=>db.query('select public.publish_professional_location_fix(77.641234,12.979876,1500)'));
    rows=await discovery();assert.equal(Number(rows[0].longitude),77.641234);assert.equal(Number(rows[0].latitude),12.979876);assert.equal(rows[0].available_now,true);assert.ok(rows[0].location_updated_at);assert.equal(rows[0].location_accuracy_meters,1500,'coarse desktop location keeps its actual uncertainty');
    await assert.rejects(as(customerA,()=>db.query('select public.publish_professional_location_fix(77.64,12.97,10)')));
    await assert.rejects(as(talent,()=>db.query('select public.publish_professional_location_fix(77.64,12.97,-1)')));
    await db.query("insert into public.availability_blocks(professional_id,starts_at,ends_at) values($1,now()-interval '1 minute',now()+interval '1 hour')",[talent]);
    rows=await discovery();assert.equal(rows[0].available_now,false);assert.equal(rows[0].location_updated_at,null);assert.equal((await discovery(true)).length,0,'busy professionals remain unavailable even with fresh GPS');
    await db.query('delete from public.availability_blocks where professional_id=$1',[talent]);
    await assert.rejects(as(customerA,()=>db.query('select * from private.professional_live_locations')));
    await as(customerA,()=>db.query('select public.clear_professional_location()'));assert.ok((await discovery())[0].location_updated_at,'another user cannot clear GPS');
    await db.exec("update private.professional_live_locations set updated_at=now()-interval '91 seconds'");
    rows=await discovery();assert.equal(rows[0].location_updated_at,null);assert.equal(rows[0].available_now,true);
    await as(talent,()=>db.query('select public.publish_professional_location(77.641234,12.979876)'));
    await as(talent,()=>db.query('update public.professionals set available_now=false where id=$1',[talent]));
    assert.equal((await discovery())[0].location_updated_at,null);assert.equal((await discovery())[0].available_now,false);assert.equal((await discovery(true)).length,0);
    await assert.rejects(as(talent,()=>db.query('select public.publish_professional_location(77.64,12.97)')));
    await as(talent,()=>db.query('select public.clear_professional_location()'));assert.equal((await db.query('select count(*)::int as n from private.professional_live_locations')).rows[0].n,0);
  }finally{await db.close();}
});
