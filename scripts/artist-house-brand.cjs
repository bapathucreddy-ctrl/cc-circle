const fs=require('node:fs'),path=require('node:path'),sharp=require('../.local-tools/reel-renderer/node_modules/sharp');
const root=path.resolve(__dirname,'..'),folder=path.join(root,'mobile/assets/brand');
const shape='<path d="M49 8h22q2 0 3 3l44 96q2 4-3 4H78V62L46 46v49l-26 16H5q-4 0-2-4l43-96q1-3 3-3Z"/><path d="m60 69 14-7v48l-14-9Z"/>';
const mark=color=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><g fill="${color}">${shape}</g></svg>`;
const icon=(dark=true)=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><rect width="1024" height="1024" fill="${dark?'#101010':'#ffffff'}"/><g transform="translate(188 188) scale(5.4)" fill="${dark?'#ffffff':'#101010'}">${shape}</g></svg>`;
function textFiles(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())textFiles(file);else if(/\.(tsx?|html)$/.test(entry.name)){const source=fs.readFileSync(file,'utf8');fs.writeFileSync(file,source.replace(/\bCircle\b/g,'Artist House'));}}}
(async()=>{
 const backup=path.join(root,'.local-tools/original-artwork/circle-before-artist-house');fs.mkdirSync(backup,{recursive:true});
 for(const name of ['mark-black.svg','mark-white.svg','mark-black.png','mark-white.png','app-icon-customer.png','app-icon-professional.png'])if(!fs.existsSync(path.join(backup,name)))fs.copyFileSync(path.join(folder,name),path.join(backup,name));
 for(const color of ['black','white']){const svg=mark(color==='black'?'#000000':'#ffffff');fs.writeFileSync(path.join(folder,'mark-'+color+'.svg'),svg);await sharp(Buffer.from(svg)).resize(360,360).png().toFile(path.join(folder,'mark-'+color+'.png'));}
 for(const role of ['customer','professional']){const svg=icon(role==='customer');fs.writeFileSync(path.join(folder,'app-icon-'+role+'.svg'),svg);await sharp(Buffer.from(svg)).resize(1024,1024).png().toFile(path.join(folder,'app-icon-'+role+'.png'));}
 fs.writeFileSync(path.join(folder,'artist-house-wordmark.svg'),`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 620 140"><g transform="translate(0 6)" fill="#111">${shape}</g><text x="140" y="98" font-family="Arial,sans-serif" font-weight="700" font-size="68" fill="#111">Artist House</text></svg>`);
 textFiles(path.join(root,'mobile/src'));
 const config=path.join(root,'mobile/app.config.ts');fs.writeFileSync(config,fs.readFileSync(config,'utf8').replace(/\bCircle\b/g,'Artist House'));
 const html=path.join(root,'admin/src/index.html');fs.writeFileSync(html,fs.readFileSync(html,'utf8').replace(/\bCircle\b/g,'Artist House'));
 const manifest=path.join(root,'admin/android/app/src/main/AndroidManifest.xml');fs.writeFileSync(manifest,fs.readFileSync(manifest,'utf8').replace('android:label="Circle Admin"','android:label="Artist House Admin"'));
 await sharp(Buffer.from(icon(true))).resize(192,192).png().toFile(path.join(root,'admin/android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png'));
 console.log('Created Artist House vector marks and icons; original marks retained locally.');
})();
