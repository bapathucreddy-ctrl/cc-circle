const fs = require('node:fs');
const path = require('node:path');
const file = path.resolve(__dirname, '../.env');
if (!fs.existsSync(file)) throw new Error('Configure .env first.');
const { readFile, selectedBackend } = require('./read-config.cjs');
const env = { ...readFile('.env'), ...readFile('.env.local') };
const { mode, url: backendUrl, key, privileged } = selectedBackend(env);
if (privileged) throw new Error('A privileged key cannot be used for mobile configuration.');
if (!backendUrl || !key) throw new Error(`Configure the ${mode} Supabase URL and public key first.`);
async function check() {
  for (const kind of ['supabase','mapbox']) {
    try {
      const url=kind==='supabase' ? `${backendUrl}/auth/v1/settings` : `https://api.mapbox.com/styles/v1/mapbox/streets-v12?access_token=${encodeURIComponent(env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN)}`;
      const response=await fetch(url,{ headers:kind==='supabase'?{apikey:key}:{},signal:AbortSignal.timeout(15000)});
      let detail={};
      if (kind==='supabase' && response.ok) { const data=await response.json(); detail={phoneSignInEnabled:Boolean(data.external?.phone)}; }
      process.stdout.write(JSON.stringify({service:kind,backendMode:mode,reachable:true,status:response.status,...detail})+'\n');
    } catch { process.stdout.write(JSON.stringify({service:kind,reachable:false})+'\n'); }
  }
}
void check();
