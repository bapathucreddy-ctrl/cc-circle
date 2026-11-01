const fs=require('fs'),path=require('path');const root=process.cwd(),version='0.2.1',codes={customer:20,professional:23,admin:9};
const config=path.join(root,'mobile/app.config.ts');fs.writeFileSync(config,fs.readFileSync(config,'utf8').replace("version: '0.2.0'",`version: '${version}'`).replace('versionCode: professional ? 22 : 19','versionCode: professional ? 23 : 20'));
for(const role of ['customer','professional']){
 const project=path.join(root,'.local-tools/android-release/projects',role);
 if(!fs.existsSync(path.join(root,'.local-tools/android-release/signing',role+'.json')))throw Error('Original signing configuration missing: '+role);
 for(const file of ['src','assets','App.tsx','index.ts','app.config.ts','package.json','package-lock.json','metro.config.js'])fs.cpSync(path.join(root,'mobile',file),path.join(project,file),{recursive:true});
 const gradle=path.join(project,'android/app/build.gradle');fs.writeFileSync(gradle,fs.readFileSync(gradle,'utf8').replace(/versionCode \d+/,`versionCode ${codes[role]}`).replace(/versionName "[^"]+"/,`versionName "${version}"`));
}
if(!fs.existsSync(path.join(root,'.local-tools/android-release/signing/admin.json')))throw Error('Original Admin signing configuration missing');
const admin='admin/android/app/build.gradle';fs.writeFileSync(admin,fs.readFileSync(admin,'utf8').replace(/versionCode \d+/,`versionCode ${codes.admin}`).replace(/versionName '[^']+'/,`versionName '${version}'`));
const sql=fs.readFileSync('supabase/migrations/202610310001_professional_discovery_bulk_approval.sql','utf8');
fs.writeFileSync('.local-tools/deploy-professional-workflow.sql',`begin;\ndo $$ begin if exists(select 1 from supabase_migrations.schema_migrations where version='202610310001') then raise exception 'Professional workflow migration already applied';end if;end $$;\n${sql}\ninsert into supabase_migrations.schema_migrations(version,name,statements) values('202610310001','professional_discovery_bulk_approval',array['${sql.replaceAll("'","''")}']);\ncommit;\nselect true as professional_workflow_ready;`);
console.log(JSON.stringify({version,codes,originalSigningConfigurationsPresent:true,sourceCopiesPrepared:true}));
