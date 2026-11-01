const fs=require('node:fs');
const version='202610300004',sql=fs.readFileSync('supabase/migrations/'+version+'_daily_promotions.sql','utf8');
fs.writeFileSync('.local-tools/deploy-daily-promotions.sql',`begin;\ndo $$ begin if exists(select 1 from supabase_migrations.schema_migrations where version='${version}') then raise exception 'Daily promotions migration is already applied';end if;end $$;\n${sql}\ninsert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','daily_promotions',array['${sql.replaceAll("'","''")}']);\ncommit;\nselect true as daily_promotions_ready;`);
console.log('Prepared daily promotions deployment; sending is disabled until configured by an admin.');
