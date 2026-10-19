import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { btree_gist } from '@electric-sql/pglite/contrib/btree_gist';

const bundle = await readFile(new URL('../manual-deployment.sql', import.meta.url), 'utf8');
const verification = await readFile(new URL('../verify-deployment.sql', import.meta.url), 'utf8');
const folder = new URL('../migrations/', import.meta.url);
const migrationFiles = (await readdir(folder)).filter(name => name.endsWith('.sql')).sort();
const userId = '10000000-0000-4000-8000-000000000001';

async function database(run) {
  const db = await PGlite.create({ extensions: { btree_gist } });
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth;
      create table auth.users(id uuid primary key, phone text);
      create function auth.uid() returns uuid language sql stable as
        $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to authenticated,service_role;
      grant execute on function auth.uid() to authenticated,service_role;
      create publication supabase_realtime;
      create schema storage;
      create table storage.objects(id text primary key);
      insert into storage.objects values('retained-object');
    `);
    await db.query('insert into auth.users(id,phone) values($1,$2)', [userId, '+919000000001']);
    await run(db);
  } finally { await db.close(); }
}

async function prototype(db) {
  // Representative old objects; the cleanup must remove only an empty prototype.
  await db.exec(`
    create table public.profiles(id uuid primary key references auth.users);
    create table public.services(id uuid primary key, owner_id uuid references public.profiles);
    create table public.bookings(id uuid primary key, service_id uuid references public.services);
    create table public.messages(id uuid primary key, booking_id uuid references public.bookings);
    create table public.saved_services(id uuid primary key, service_id uuid references public.services);
    create table public.booking_events(id uuid primary key, booking_id uuid references public.bookings);
    create view public.booking_details as select * from public.bookings;
    create function public.session_active() returns boolean language sql as $$select true$$;
  `);
}

async function retained(db) {
  assert.equal((await db.query('select id from auth.users')).rows[0].id, userId);
  assert.equal((await db.query('select id from storage.objects')).rows[0].id, 'retained-object');
}

async function deployed(db) {
  const history = (await db.query('select version,name,statements from supabase_migrations.schema_migrations order by version')).rows;
  assert.equal(history.length, migrationFiles.length);
  for (const [index, file] of migrationFiles.entries()) {
    const [, version, name] = file.match(/^(\d+)_(.+)\.sql$/);
    assert.equal(history[index].version, version);
    assert.equal(history[index].name, name);
    assert.deepEqual(history[index].statements, [await readFile(new URL(file, folder), 'utf8')]);
  }
  assert.equal((await db.query('select id from public.profiles')).rows[0].id, userId);
  assert.equal((await db.query('select count(*)::int as count from public.professionals')).rows[0].count, 0);
  await retained(db);
  await db.exec(verification);
}

test('complete manual deployment creates a fresh schema and records exact migration sources', () => database(async db => {
  await db.exec(bundle);
  await deployed(db);
}));

test('complete manual deployment replaces the empty prototype and retains Auth and Storage', () => database(async db => {
  await prototype(db);
  await db.exec(bundle);
  await deployed(db);
  const old = (await db.query("select to_regclass('public.booking_details') as view, to_regprocedure('public.session_active()') as function")).rows[0];
  assert.equal(old.view, null);
  assert.equal(old.function, null);
}));

test('prototype data prevents deployment without deleting records', () => database(async db => {
  await prototype(db);
  await db.query('insert into public.profiles values($1)', [userId]);
  await assert.rejects(() => db.exec(bundle), /prototype now contains records/);
  await db.exec('rollback');
  assert.equal((await db.query('select id from public.profiles')).rows[0].id, userId);
  assert.equal((await db.query("select to_regclass('public.professionals') as table")).rows[0].table, null);
  await retained(db);
}));

test('an existing newer services schema prevents initial deployment', () => database(async db => {
  await db.exec('create table public.services(id uuid primary key, professional_id uuid)');
  await assert.rejects(() => db.exec(bundle), /different or newer services schema/);
  await db.exec('rollback');
  assert.equal((await db.query("select count(*)::int as count from information_schema.columns where table_schema='public' and table_name='services' and column_name='professional_id'")).rows[0].count, 1);
  await retained(db);
}));

test('replaying the initial deployment refuses and preserves the deployed schema', () => database(async db => {
  await db.exec(bundle);
  await assert.rejects(() => db.exec(bundle), /already applied/);
  await db.exec('rollback');
  await deployed(db);
}));

test('read-only verification rejects an undeployed database', () => database(async db => {
  await assert.rejects(() => db.exec(verification), /migration history is missing/);
  await db.exec('rollback');
  await retained(db);
}));

test('read-only verification detects missing access protection', () => database(async db => {
  await db.exec(bundle);
  await db.exec('alter table public.bookings disable row level security');
  await assert.rejects(() => db.exec(verification), /public.bookings is missing or row security is disabled/);
  await db.exec('rollback');
  await retained(db);
}));

test('a late migration failure rolls back prototype removal and migration history', () => database(async db => {
  await prototype(db);
  // Force a collision after cleanup and marketplace creation have succeeded.
  await db.exec('create table public.payout_accounts(marker text)');
  await assert.rejects(() => db.exec(bundle), /payout_accounts.*already exists/);
  await db.exec('rollback');
  const state = (await db.query(`select
    to_regclass('public.booking_details') as old_view,
    to_regprocedure('public.session_active()') as old_function,
    to_regclass('public.professionals') as new_table,
    to_regclass('supabase_migrations.schema_migrations') as history`)).rows[0];
  assert.ok(state.old_view);
  assert.ok(state.old_function);
  assert.equal(state.new_table, null);
  assert.equal(state.history, null);
  await retained(db);
}));
