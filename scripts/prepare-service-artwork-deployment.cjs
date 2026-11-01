const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),names=process.argv[2]==='names',heading=process.argv[2]==='heading',version=heading?'202610300003':names?'202610300002':'202610300001',name=heading?'banner_picks_heading':names?'service_names':'service_artwork',sql=fs.readFileSync(path.join(root,'supabase/migrations/'+version+'_'+name+'.sql'),'utf8');
const target=path.join(root,'.local-tools/deploy-'+name.replaceAll('_','-')+'.sql');
fs.writeFileSync(target,`begin;\ndo $$ begin if exists(select 1 from supabase_migrations.schema_migrations where version='${version}') then raise exception 'Service migration is already applied';end if;end $$;\n${sql}\ninsert into supabase_migrations.schema_migrations(version,name,statements) values('${version}','${name}',array['${sql.replaceAll("'","''")}']);\ncommit;\nselect true as ${name}_ready;`);
const line=fs.readFileSync(path.join(root,'mobile/.env'),'utf8').split(/\r?\n/).find(line=>line.startsWith('EXPO_PUBLIC_SUPABASE_URL='));
const host=new URL(line.split('=').slice(1).join('=').trim().replace(/^['"]|['"]$/g,'')).hostname;
if(!/^[a-z0-9]{20}\.supabase\.co$/.test(host))throw Error('Unexpected backend hostname');
console.log('Prepared service-artwork migration for project '+host.split('.')[0]);
