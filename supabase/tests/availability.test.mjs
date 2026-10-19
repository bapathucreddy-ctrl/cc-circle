import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';

test('live availability respects private bookings, overlapping requests, overruns and online preference', async () => {
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
    const service = (await db.query('select id from public.services')).rows[0].id;
    const online = value => as(talent, () => db.query('update public.professionals set available_now=$1 where id=$2', [value, talent]));
    const availability = () => as(customerB, async () => (await db.query('select * from public.professional_availability($1)', [talent])).rows[0]);
    const request = (user, when) => as(user, async () => (await db.query("select (public.request_booking($1,$2,'Availability test venue',77.64,12.978,'',$3,559800)).*", [service, when, crypto.randomUUID()])).rows[0]);
    const transition = (id, status, user = talent) => as(user, () => db.query('select public.transition_booking($1,$2)', [id, status]));
    await online(true);
    assert.deepEqual(await availability(), { available_now: true, is_online: true, is_busy: false });
    const start = new Date(Date.now() + 60000).toISOString();
    const first = await request(customerA, start);
    assert.deepEqual(await availability(), { available_now: false, is_online: true, is_busy: true });
    await as(customerB, async () => {
      assert.equal((await db.query('select * from public.bookings')).rows.length, 0, 'No other customer booking is disclosed');
      const all = (await db.query("select * from public.discover_professionals('Actor',77.64,12.978,'',15,false)")).rows;
      assert.equal(all[0].available_now, false);
      assert.equal((await db.query("select * from public.discover_professionals('Actor',77.64,12.978,'',15,true)")).rows.length, 0);
    });
    await assert.rejects(() => request(customerB, start), /already has a booking/);
    await online(false); await online(true);
    assert.equal((await availability()).available_now, false, 'Online toggle cannot override a booking');
    const tomorrow = await request(customerB, new Date(Date.now() + 86400000).toISOString());
    await transition(first.id, 'cancelled', customerA);
    assert.equal((await availability()).available_now, true, 'Cancellation releases the slot; future bookings do not make the professional busy now');
    const second = await request(customerA, start);
    await db.query('update public.bookings set paid_at=now() where id=$1', [second.id]);
    await transition(second.id, 'accepted'); await transition(second.id, 'en_route');
    await transition(tomorrow.id, 'accepted');
    await assert.rejects(() => transition(tomorrow.id, 'en_route'), /Finish your current active job/);
    // An unfinished job stays busy beyond its estimated end time.
    await db.query("update public.bookings set starts_at=now()-interval '3 hours',ends_at=now()-interval '1 hour' where id=$1", [second.id]);
    assert.equal((await availability()).available_now, false);
    await assert.rejects(() => request(customerB, start), /busy or unavailable/);
    await transition(second.id, 'arrived'); await online(false); const getCode = phase => as(customerA, async () => (await db.query('select public.service_otp($1,$2) as value',[second.id,phase])).rows[0].value.code);
    const act = (phase,code='') => as(talent, () => db.query('select public.service_action($1,$2,$3)',[second.id,phase,code]));
    await act('start',await getCode('start'));
    assert.equal((await availability()).is_busy,true,'Starting service keeps the professional busy');
    await act('request_completion');
    assert.equal((await availability()).is_busy,true,'Pending end OTP keeps the professional busy');
    await act('end',await getCode('end'));
    assert.deepEqual(await availability(), { available_now: false, is_online: false, is_busy: false });
    await online(true);
    assert.equal((await availability()).available_now, true, 'Completion restores availability for an online professional');
    const third = await request(customerA, start); await transition(third.id, 'declined');
    assert.equal((await availability()).available_now, true, 'Decline releases the requested slot');
    await as(talent, () => db.query("insert into public.availability_blocks(professional_id,starts_at,ends_at) values($1,now(),now()+interval '1 hour')", [talent]));
    assert.equal((await availability()).available_now, false);
    await db.query('delete from public.availability_blocks where professional_id=$1', [talent]);
    assert.equal((await availability()).available_now, true);
    await assert.rejects(() => request(customerA, tomorrow.starts_at), /already has a booking/);
  } finally { await db.close(); }
});
