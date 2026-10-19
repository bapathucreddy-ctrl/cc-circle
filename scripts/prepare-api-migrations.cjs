const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const folder = path.join(root, 'supabase', 'migrations');
const files = fs.readdirSync(folder).filter(name => /^\d+_[a-z0-9_]+\.sql$/.test(name)).sort();
const quote = value => "'" + value.replaceAll("'", "''") + "'";
let sql = `-- CC Circle initial deployment: run this complete file in Supabase SQL Editor.
-- Removes the identified empty old prototype objects and creates the app schema.
-- Auth users, Storage objects and Supabase system schemas are retained.
-- If any statement fails, the transaction rolls back, including prototype removal.
begin;
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version text primary key, statements text[], name text
);
`;
for (const file of files) {
  const [, version, name] = file.match(/^(\d+)_(.+)\.sql$/);
  const source = fs.readFileSync(path.join(folder, file), 'utf8');
  sql += `do $migration_guard$ begin
    if exists(select 1 from supabase_migrations.schema_migrations where version=${quote(version)}) then
      raise exception 'Migration ${version} is already applied. Use normal incremental deployment.';
    end if;
  end $migration_guard$;\n`;
  sql += source + '\n';
  sql += `insert into supabase_migrations.schema_migrations(version,name,statements)
    values(${quote(version)},${quote(name)},array[${quote(source)}]);\n`;
}
sql += "notify pgrst, 'reload schema';\ncommit;\n";
sql += "select 'CC Circle database deployment complete' as result;\n";
const target = path.join(root, 'supabase', '.temp', 'initial-deployment.sql');
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, sql);
const manualTarget = path.join(root, 'supabase', 'manual-deployment.sql');
fs.writeFileSync(manualTarget, sql);
process.stdout.write(`Prepared ${files.length} migrations in one transaction: supabase/manual-deployment.sql\n`);
