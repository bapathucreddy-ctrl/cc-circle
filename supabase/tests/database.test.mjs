import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';

test('booking prices, access rules and payment transitions', async () => {
  const db = await PGlite.create({ extensions: { btree_gist } });
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth;
      create table auth.users(id uuid primary key,phone text);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to authenticated,service_role;
      grant execute on function auth.uid() to authenticated,service_role;
      create publication supabase_realtime;
    `);
    const folder = new URL('../migrations/', import.meta.url);
    for (const name of (await readdir(folder)).filter(name => name.endsWith('.sql')).sort()) {
      await db.exec(await readFile(new URL(name, folder), 'utf8'));
    }
    const client = '10000000-0000-4000-8000-000000000001';
    const talent = '10000000-0000-4000-8000-000000000002';
    const stranger = '10000000-0000-4000-8000-000000000003';
    await db.query('insert into auth.users(id) values($1),($2),($3)', [client,talent,stranger]);
    await db.query("update public.profiles set display_name='Test Customer' where id=$1", [client]);
    async function as(user, run) {
      await db.exec('set role authenticated');
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
      try { return await run(); } finally { await db.exec('reset role'); }
    }
    await as(talent, () => db.query('select public.save_professional_profile($1,$2,$3)', [
      { display_name:'Test Talent',category:'Actor',city:'Bengaluru',bio:'Experienced screen and stage performer for productions.',
        specialties:['Commercial'],longitude:77.6408,latitude:12.9784,portfolio_urls:['https://example.com/work'],public_specs:{height:'175'} },
      { fitting:'Private wardrobe details' }, { name:'Shoot day',amount_paise:500000,duration_minutes:120 },
    ]));
    await as(talent, () => db.query('update public.professionals set available_now=true where id=$1',[talent]));
    const service = (await db.query('select id from public.services')).rows[0].id;
    await as(stranger, async () => {
      const listing=(await db.query("select * from public.discover_professionals('Actor',77.64,12.97,'',15,false)")).rows[0];
      assert.equal(listing.booking_price_paise,559800);
      assert.equal((await db.query('select * from public.professional_private_details')).rows.length,0);
      const profile = (await db.query('select public_specs from public.professionals')).rows[0];
      assert.deepEqual(profile.public_specs,{});
      await assert.rejects(() => db.query('update public.professionals set verified_at=now() where id=$1',[talent]),/permission denied/);
    });
    const requestId='20000000-0000-4000-8000-000000000001';
    const create = () => db.query("select (public.request_booking($1,now()+interval '1 day','Test venue, Bengaluru',77.64,12.97,'Test requirements',$2,559800)).*",[service,requestId]);
    const booking = await as(client, async () => {
      const first=(await create()).rows[0];
      const repeated=(await create()).rows[0];
      assert.equal(first.id,repeated.id);
      assert.equal(first.service_amount_paise,543500);
      assert.equal(first.buyer_fee_paise,16300);
      assert.equal(first.amount_paise,559800);
      assert.equal(first.talent_fee_paise,43500);
      assert.equal(first.talent_payout_paise,500000);
      await assert.rejects(() => db.query('update public.bookings set amount_paise=1 where id=$1',[first.id]),/permission denied/);
      await assert.rejects(() => db.query("select public.transition_booking($1,'accepted')",[first.id]),/Only the professional/);
      return first;
    });
    await as(stranger, async () => {
      assert.equal((await db.query('select * from public.bookings')).rows.length,0);
      assert.equal((await db.query('select * from public.booking_activity()')).rows.length,0);
      assert.equal((await db.query('select * from public.booking_participants($1)', [booking.id])).rows.length, 0);
      await assert.rejects(() => db.query('insert into public.messages(booking_id,sender_id,body) values($1,$2,$3)',[booking.id,stranger,'Unauthorized message']),/(row-level security|Messaging requires)/);
      await assert.rejects(() => db.query("select public.transition_booking($1,'cancelled')",[booking.id]),/Booking not found/);
      await assert.rejects(() => db.query("select public.confirm_payment('fake','fake',1)"),/permission denied/);
    });
    await as(talent, async () => {
      const participants=(await db.query('select * from public.booking_participants($1)', [booking.id])).rows[0]; assert.equal(participants.client_name,'Test Customer'); assert.equal(participants.category,'Actor'); assert.match(participants.professional_name,/^[a-z]+[0-9]{6}$/);
      assert.equal((await db.query('select * from public.profiles where id=$1', [client])).rows.length, 0, 'Participant RPC does not expose the private customer profile');
      await db.query("select public.transition_booking($1,'accepted')",[booking.id]);
      await assert.rejects(() => db.query("select public.transition_booking($1,'completed')",[booking.id]),/customer end OTP/);
      await assert.rejects(() => db.query("select public.transition_booking($1,'en_route')",[booking.id]),/Verified payment is required/);
    });
    await as(client, async () => {
      assert.match((await db.query('select * from public.booking_participants($1)', [booking.id])).rows[0].professional_name, /^[a-z]+[0-9]{6}$/);
      await assert.rejects(() => db.query("select public.request_booking($1,$2,'Another venue',77.64,12.97,'',$3,559800)",[service,booking.starts_at,'20000000-0000-4000-8000-000000000002']),/already has a booking/);
      await assert.rejects(() => db.query('insert into public.messages(booking_id,sender_id,body) values($1,$2,$3)',[booking.id,client,'Too early']),/paid, active booking/);
    });
    await db.query('insert into public.payment_orders(booking_id,order_id,amount_paise,environment) values($1,$2,$3,$4)',[booking.id,'cc_test',559800,'sandbox']);
    await assert.rejects(() => db.query("select public.confirm_payment('cc_test','payment1',1)"),/amount mismatch/);
    await db.query("select public.confirm_payment('cc_test','payment1',559800)");
    await db.query("select public.confirm_payment('cc_test','payment1',559800)");
    await as(client, () => db.query('insert into public.messages(booking_id,sender_id,body) values($1,$2,$3)',[booking.id,client,'Hello after payment']));
    assert.equal((await db.query('select count(*)::int as count from public.payout_jobs where booking_id=$1',[booking.id])).rows[0].count,0, 'Prepayment never releases a payout before completion');
    await as(talent, async () => {
      await db.query("select public.transition_booking($1,'en_route')",[booking.id]);
      assert.ok((await db.query('select paid_at from public.bookings where id=$1',[booking.id])).rows[0].paid_at);
      await db.query('select public.share_booking_location($1,77.63,12.98,120)',[booking.id]);
    });
    await as(client, async () => assert.equal((await db.query('select * from public.booking_locations')).rows.length,1));
    await as(stranger, async () => assert.equal((await db.query('select * from public.booking_locations')).rows.length,0));
    await as(talent, async () => {
      await db.query("select public.transition_booking($1,'arrived')",[booking.id]);
      await assert.rejects(() => db.query("select public.transition_booking($1,'completed')",[booking.id]), /customer end OTP/);
    });
    await as(stranger, () => assert.rejects(() => db.query("select public.service_otp($1,'start')",[booking.id]), /Customer booking not found/));
    await as(talent, async () => {
      await assert.rejects(() => db.query("select public.service_otp($1,'start')",[booking.id]), /Customer booking not found/);
      await assert.rejects(() => db.query('select * from private.service_otps'), /permission denied/);
      await assert.rejects(() => db.query("select private.transition_booking($1,'completed')",[booking.id]), /permission denied/);
      await assert.rejects(() => db.query("select public.service_action($1,'request_completion')",[booking.id]), /start OTP first/);
    });
    async function code(phase) {
      return as(client, async () => (await db.query('select public.service_otp($1,$2) as value',[booking.id,phase])).rows[0].value);
    }
    async function action(phase,value='') {
      return as(talent, async () => (await db.query('select public.service_action($1,$2,$3) as value',[booking.id,phase,value])).rows[0].value);
    }
    await as(client, () => assert.rejects(() => db.query("select public.service_otp($1,'end')",[booking.id]), /not available/));
    await as(client, () => assert.rejects(() => db.query("select public.service_action($1,'start','123456')",[booking.id]), /Professional booking not found/));
    const startCode=await code('start'); assert.match(startCode.code,/^[0-9]{6}$/);
    assert.equal((await code('start')).code,startCode.code,'Refresh cannot reset guessing limits');
    const wrong=startCode.code==='000000'?'000001':'000000';
    for(let i=0;i<5;i++) assert.equal((await action('start',wrong)).ok,false);
    assert.equal((await code('start')).locked,true);
    assert.equal((await action('start',startCode.code)).ok,false,'Correct code is blocked after five failed attempts');
    await db.query("update private.service_otps set expires_at=now()-interval '1 second' where booking_id=$1",[booking.id]);
    assert.equal((await action('start',startCode.code)).ok,false,'Expired code cannot start service');
    const renewed=await code('start'); assert.equal(renewed.locked,false);
    assert.equal((await action('start',renewed.code)).ok,true);
    assert.ok((await db.query('select service_started_at from public.bookings where id=$1',[booking.id])).rows[0].service_started_at);
    await as(client, () => assert.rejects(() => db.query('select public.submit_booking_review($1,5,$2)',[booking.id,'Too early']),/completion/));
    assert.equal((await db.query('select count(*)::int as count from public.payout_jobs where booking_id=$1',[booking.id])).rows[0].count,0);
    await as(talent, () => assert.rejects(() => db.query('select public.share_booking_location($1,77.63,12.98,120)',[booking.id]), /active journey/));
    assert.equal((await action('request_completion')).ok,true);
    const endCode=await code('end');
    assert.equal((await action('end',endCode.code)).ok,true);
    assert.equal((await db.query('select count(*)::int as n from private.service_otps where booking_id=$1',[booking.id])).rows[0].n,0);
    await as(talent, async () => {
      assert.equal((await db.query('select * from public.booking_locations')).rows.length,0);
    });
    assert.equal((await db.query('select count(*)::int as n from public.messages where booking_id=$1',[booking.id])).rows[0].n,0,'Verified end OTP purges the chat');
    await as(client, async () => {
      assert.equal((await db.query('select * from public.booking_activity()')).rows[0].id,booking.id);
      await db.query("select public.submit_booking_review($1,5,'Great service')",[booking.id]);
      assert.equal((await db.query('select * from public.booking_activity()')).rows.length,0,'Reviewed booking is excluded on the server');
      await assert.rejects(() => db.query("select public.transition_booking($1,'cancelled')",[booking.id]),/cannot be cancelled/);
    });
    await db.query("select public.confirm_payment('cc_test','payment1',559800)");
    await db.query("select public.confirm_payment('cc_test','payment1',559800)");
    assert.equal((await db.query('select count(*)::int as count from public.payout_jobs where booking_id=$1',[booking.id])).rows[0].count,1);
    const payout=(await db.query('select * from public.payout_jobs where booking_id=$1',[booking.id])).rows[0];
    assert.equal(payout.amount_paise,500000);
    await as(stranger, async () => assert.equal((await db.query('select * from public.payout_jobs')).rows.length,0));

    // Lower bound and mid-range fees are enforced on the server, independently of the app preview.
    for (const [base,buyerFee,talentFee] of [[10000,4900,900],[200000,6500,17400],[1000000,29900,87000]]) {
      await db.query('update public.services set amount_paise=$1 where id=$2',[base,service]);
      const id=crypto.randomUUID();
      const total=base+talentFee+buyerFee;
      const next=await as(client, async () => (await db.query("select (public.request_booking($1,now()+interval '3 days','Test venue',77.64,12.97,'',$2,$3)).*",[service,id,total])).rows[0]);
      assert.equal(next.buyer_fee_paise,buyerFee); assert.equal(next.talent_fee_paise,talentFee);
      await as(client, () => db.query("select public.transition_booking($1,'cancelled')",[next.id]));
    }
    // A legacy payment order settling after cancellation creates a refund, never a payout.
    await as(client, async () => await assert.rejects(() => db.query("select public.request_booking($1,now()+interval '4 days','Test venue',77.64,12.97,'',$2,1)",[service,crypto.randomUUID()]),/price has changed/));
    const late=await as(client, async () => (await db.query("select (public.request_booking($1,now()+interval '4 days','Test venue',77.64,12.97,'',$2,1116900)).*",[service,crypto.randomUUID()])).rows[0]);
    await db.query('insert into public.payment_orders(booking_id,order_id,amount_paise,environment) values($1,$2,$3,$4)',[late.id,'cc_late',late.amount_paise,'sandbox']);
    await as(client, () => db.query("select public.transition_booking($1,'cancelled')",[late.id]));
    await db.query("select public.confirm_payment('cc_late','payment_late',$1)",[late.amount_paise]);
    assert.equal((await db.query('select status from public.payment_orders where booking_id=$1',[late.id])).rows[0].status,'refund_requested');
    assert.equal((await db.query('select count(*)::int as count from public.refund_requests where booking_id=$1',[late.id])).rows[0].count,1);
    assert.equal((await db.query('select count(*)::int as count from public.payout_jobs where booking_id=$1',[late.id])).rows[0].count,0);
    // New prepaid bookings also refund if cancelled before travel; no payout is released.
    const prepaid = await as(client, async () => (await db.query("select (public.request_booking($1,now()+interval '5 days','Prepaid venue',77.64,12.97,'',$2,1116900)).*", [service, crypto.randomUUID()])).rows[0]);
    await as(talent, () => db.query("select public.transition_booking($1,'accepted')", [prepaid.id]));
    await db.query("insert into public.payment_orders(booking_id,order_id,amount_paise,environment) values($1,'cc_prepaid',$2,'sandbox')", [prepaid.id, prepaid.amount_paise]);
    await db.query("select public.confirm_payment('cc_prepaid','prepaid_payment',$1)", [prepaid.amount_paise]);
    await as(client, () => db.query("select public.transition_booking($1,'cancelled')", [prepaid.id]));
    assert.equal((await db.query('select status from public.payment_orders where booking_id=$1', [prepaid.id])).rows[0].status, 'refund_requested');
    assert.equal((await db.query('select count(*)::int as count from public.refund_requests where booking_id=$1', [prepaid.id])).rows[0].count, 1);
    assert.equal((await db.query('select count(*)::int as count from public.payout_jobs where booking_id=$1', [prepaid.id])).rows[0].count, 0);
  } finally { await db.close(); }
});
