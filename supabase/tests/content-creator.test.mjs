import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';

test('content creators can publish, appear in discovery and receive bookings', async () => {
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
      { display_name: 'Reel Studio', category: 'ContentCreator', city: 'Bengaluru', bio: 'Experienced performer checking availability and scheduling.', specialties: [], longitude: 77.64, latitude: 12.978, portfolio_urls: ['https://example.com/work'] },
      {}, { name: 'Performance', amount_paise: 500000, duration_minutes: 60 },
    ]));


    const service=(await db.query('select id from public.services where professional_id=$1',[talent])).rows[0].id;
    const rows=await as(customerA,async()=>(await db.query("select * from public.discover_live_professionals('ContentCreator',77.64,12.978)")).rows);
    assert.equal(rows.length,1);assert.equal(rows[0].category,'ContentCreator');assert.match(rows[0].display_name,/^[a-z]+[0-9]{6}$/);
    const booking=await as(customerA,async()=>(await db.query("select (public.request_booking($1,now()+interval '1 day','Reel shoot venue',77.64,12.978,'Two edited reels',$2,559800)).*",[service,crypto.randomUUID()])).rows[0]);
    assert.equal(booking.professional_id,talent);assert.equal(booking.talent_payout_paise,500000);assert.equal(booking.status,'requested');
  }finally{await db.close();}
});
