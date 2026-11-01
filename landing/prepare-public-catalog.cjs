// Only public application settings may enter the marketing site's client code.
const fs=require('node:fs'),path=require('node:path');
const {env}=require('../mobile/node_modules/@expo/env').get(path.resolve(__dirname,'../mobile'),{silent:true});
const url=env.EXPO_PUBLIC_SUPABASE_URL,key=env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY||env.EXPO_PUBLIC_SUPABASE_KEY;
if(!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url)||!key||key.startsWith('sb_secret_'))throw Error('Expected public backend settings');
if(key.split('.').length===3&&JSON.parse(Buffer.from(key.split('.')[1],'base64url')).role!=='anon')throw Error('Only anonymous/public client credentials may be published');
fs.writeFileSync(path.join(__dirname,'dist/catalog-config.js'),'window.ARTIST_HOUSE_CATALOG='+JSON.stringify({url,key})+';\n');
console.log('Prepared public marketing catalog settings; no private credentials.');
