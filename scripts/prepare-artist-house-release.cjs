const fs=require('node:fs'),path=require('node:path'),sharp=require('../.local-tools/reel-renderer/node_modules/sharp');
const root=path.resolve(__dirname,'..');
function renameText(file){fs.writeFileSync(file,fs.readFileSync(file,'utf8').replace(/\bCircle\b/g,'Artist House'));}
(async()=>{
 for(const file of ['app.js','access.js','professionals.js'])renameText(path.join(root,'admin/src',file));
 renameText(path.join(root,'mobile/tests/notifications.test.cjs'));
 for(const [role,code]of[['customer',19],['professional',22]]){
  const target=path.join(root,'.local-tools/android-release/projects',role);
  for(const item of ['src','assets','App.tsx','index.ts','app.config.ts','package.json','package-lock.json'])fs.cpSync(path.join(root,'mobile',item),path.join(target,item),{recursive:true});
  const gradle=path.join(target,'android/app/build.gradle');fs.writeFileSync(gradle,fs.readFileSync(gradle,'utf8').replace(/versionCode \d+/,`versionCode ${code}`).replace(/versionName "[^"]+"/,'versionName "0.2.0"'));
  const resources=path.join(target,'android/app/src/main/res'),strings=path.join(resources,'values/strings.xml');
  fs.writeFileSync(strings,fs.readFileSync(strings,'utf8').replace(/(<string name="app_name">)[^<]+/,'$1Artist House'));
  for(const entry of fs.readdirSync(resources)){
   const sizes={'mipmap-mdpi':48,'mipmap-hdpi':72,'mipmap-xhdpi':96,'mipmap-xxhdpi':144,'mipmap-xxxhdpi':192};
   if(sizes[entry])for(const name of fs.readdirSync(path.join(resources,entry)))if(/^ic_launcher.*\.png$/.test(name))await sharp(path.join(root,'mobile/assets/brand/app-icon-'+role+'.png')).resize(sizes[entry],sizes[entry]).png().toFile(path.join(resources,entry,name));
   if(entry.startsWith('drawable-'))for(const name of fs.readdirSync(path.join(resources,entry)))if(/notification_icon.*\.png$/.test(name)){const file=path.join(resources,entry,name),meta=await sharp(file).metadata();await sharp(path.join(root,'mobile/assets/brand/mark-white.svg')).resize(meta.width,meta.height).png().toFile(file);}
  }
 }
 console.log('Artist House 0.2.0 sources, launcher labels and icons prepared; package IDs unchanged.');
})();
