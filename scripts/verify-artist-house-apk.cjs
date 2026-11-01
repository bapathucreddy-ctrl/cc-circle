const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),zlib=require('node:zlib'),crypto=require('node:crypto');
const role=process.argv[2];if(!['customer','professional','admin'].includes(role))throw Error('Choose an app role');
const root=path.resolve(__dirname,'..'),base=path.join(root,'.local-tools/android-release'),sdk=path.join(base,'sdk/build-tools/36.0.0'),java=path.join(base,'java',fs.readdirSync(path.join(base,'java'))[0],'bin/java.exe');
const apk=role==='admin'?path.join(root,'admin/android/app/build/outputs/apk/release/app-release.apk'):path.join(base,'projects',role,'android/app/build/outputs/apk/release/app-release.apk');
const bytes=fs.readFileSync(apk);let end=bytes.length-22;while(end>=0&&bytes.readUInt32LE(end)!==0x06054b50)end--;if(end<0)throw Error('Invalid APK');
const entries=new Map();let at=bytes.readUInt32LE(end+16);for(let i=0;i<bytes.readUInt16LE(end+10);i++){const name=bytes.toString('utf8',at+46,at+46+bytes.readUInt16LE(at+28));entries.set(name,{method:bytes.readUInt16LE(at+10),length:bytes.readUInt32LE(at+20),offset:bytes.readUInt32LE(at+42)});at+=46+bytes.readUInt16LE(at+28)+bytes.readUInt16LE(at+30)+bytes.readUInt16LE(at+32);}
function read(name){const e=entries.get(name);if(!e)throw Error('Missing asset '+name);const start=e.offset+30+bytes.readUInt16LE(e.offset+26)+bytes.readUInt16LE(e.offset+28),data=bytes.subarray(start,start+e.length);return e.method===8?zlib.inflateRawSync(data):data;}
const badging=cp.execFileSync(path.join(sdk,'aapt.exe'),['dump','badging',apk],{encoding:'utf8'}),code={customer:19,professional:22,admin:8}[role];
if(!badging.includes(`name='com.cccircle.${role}'`)||!badging.includes(`versionCode='${code}'`)||!badging.includes("versionName='0.2.0'")||badging.includes('application-debuggable')||!badging.includes('Artist House'))throw Error('Incorrect Artist House identity/version');
const signed=cp.spawnSync(java,['-jar',path.join(sdk,'lib/apksigner.jar'),'verify','--verbose','--print-certs',apk],{encoding:'utf8'});if(signed.status!==0)throw Error('Signature verification failed');
const cert=signed.stdout.match(/certificate SHA-256 digest: ([a-f0-9]+)/i)?.[1],metaFile=path.join(root,'artifacts/android',role+'-build.json'),old=JSON.parse(fs.readFileSync(metaFile));if(!cert||cert!==old.certificateSha256)throw Error('Signing key differs from the original app');
if(cp.spawnSync(path.join(sdk,'zipalign.exe'),['-c','-P','16','4',apk],{encoding:'utf8'}).status!==0)throw Error('Alignment check failed');
let appCode;
if(role==='admin'){
 for(const file of ['index.html','style.css','profile.css','mobile.css','reference.css','app.js','logo.svg'])if(!read('assets/'+file).equals(fs.readFileSync(path.join(root,'admin/dist',file))))throw Error('Stale admin asset '+file);
 for(const name of fs.readdirSync(path.join(root,'admin/dist/service-defaults')))if(!read('assets/service-defaults/'+name).equals(fs.readFileSync(path.join(root,'admin/dist/service-defaults',name))))throw Error('Default service photo missing');
 appCode=read('assets/app.js');for(const text of ['service-name-form','featured_heading','save_promotion_settings'])if(!appCode.includes(Buffer.from(text)))throw Error('Admin feature absent: '+text);
}else{
 appCode=read('assets/index.android.bundle');const generated=fs.readFileSync(path.join(base,'projects',role,'android/app/build/generated/assets/react/release/index.android.bundle'));if(!appCode.equals(generated)||appCode.subarray(0,8).toString('hex')!=='c61fbc03c103191f')throw Error('Stale or non-production bundle');
 for(const text of ['Artist House','promotions_enabled','featured_heading','service_artwork','nearby-professional-carousel'])if(!appCode.includes(Buffer.from(text)))throw Error('App feature absent: '+text);
 const config=JSON.parse(read('assets/app.config'));if(config.name!=='Artist House'||config.version!=='0.2.0'||config.android.package!=='com.cccircle.'+role||config.android.versionCode!==code)throw Error('Embedded and native config differ');
 if(config.extra.androidPushConfigured!==true)throw Error('Android push configuration is missing from this release');
 for(const arch of ['armeabi-v7a','arm64-v8a'])if(![...entries.keys()].some(name=>name.startsWith('lib/'+arch+'/')&&name.includes('mapbox')))throw Error('Native map missing for '+arch);
}
for(const line of fs.readFileSync(path.join(root,'supabase/.env'),'utf8').split(/\r?\n/)){const match=line.match(/^([A-Z0-9_]+)=(.*)$/);if(match&&/SECRET|SERVICE_ROLE|VISION_API_KEY|ACCESS_TOKEN/.test(match[1])){const value=match[2].trim().replace(/^['"]|['"]$/g,'');if(value.length>20&&appCode.includes(Buffer.from(value)))throw Error('Private credential entered the APK');}}
const label=role[0].toUpperCase()+role.slice(1),versioned=`ArtistHouse-${label}-0.2.0.apk`,file=`ArtistHouse-${label}.apk`;
for(const name of [file,versioned,`Circle-${label}.apk`,...(role==='admin'?[]:[`CC-Circle-${label}.apk`])])fs.copyFileSync(apk,path.join(root,'artifacts/android',name));
const metadata={variant:role,appName:role==='admin'?'Artist House Admin':'Artist House',package:'com.cccircle.'+role,version:'0.2.0',versionCode:code,file,versionedFile:versioned,bytes:bytes.length,sizeMB:+(bytes.length/1e6).toFixed(2),sha256:crypto.createHash('sha256').update(bytes).digest('hex'),certificateSha256:cert,signatureVerified:true,aligned16KB:true,signingKeyUnchanged:true,packageIdentityUnchanged:true,sourceBundleMatchesAPK:true,remoteServiceNames:true,remoteServicePhotos:true,editablePicksHeading:true,nearbyCarousel:role!=='admin',promotionalNotificationSettings:true,physicalDeviceTested:false};
fs.writeFileSync(metaFile,JSON.stringify(metadata,null,2)+'\n');console.log(JSON.stringify(metadata));
