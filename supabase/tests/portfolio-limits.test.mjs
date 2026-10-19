import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';

test('portfolio limits are durable, per-user, service-only and independent from payments', async () => {
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
    const a=crypto.randomUUID(),b=crypto.randomUUID();
    await db.query('insert into auth.users(id) values($1),($2)',[a,b]);
    await db.exec('set role authenticated');
    await assert.rejects(()=>db.query('select public.claim_portfolio_operation($1)',[a]),/permission denied/);
    await db.exec('reset role; set role service_role');
    const claim=async user=>(await db.query('select public.claim_portfolio_operation($1) as allowed',[user])).rows[0].allowed;
    for(let i=0;i<60;i++)assert.equal(await claim(a),true);
    assert.equal(await claim(a),false);assert.equal(await claim(b),true);
    assert.equal((await db.query('select public.claim_payment_operation($1) as allowed',[a])).rows[0].allowed,true);
    await db.exec('reset role');
    await db.query("update private.portfolio_rate_limits set window_start=now()-interval '61 seconds' where user_id=$1",[a]);
    await db.exec('set role service_role');assert.equal(await claim(a),true);
  } finally { await db.close(); }
});
