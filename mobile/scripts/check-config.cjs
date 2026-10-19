const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const { readFile, selectedBackend } = require('./read-config.cjs');
for (const name of ['.env', '.env.example']) {
  const target = path.join(root, name);
  if (!fs.existsSync(target)) { process.stdout.write(`${name}: absent\n`); continue; }
  const entries = name === '.env' ? { ...readFile(name), ...readFile('.env.local') } : readFile(name);
  const { mode, url, key, privileged } = selectedBackend(entries);
  process.stdout.write(JSON.stringify({ file: name,
    backendMode: mode,
    supabaseUrlConfigured: Boolean(url && (url.startsWith('https://') || (mode === 'local' && url.startsWith('http://')))),
    supabasePublicKeyConfigured: Boolean(key) && !privileged,
    privilegedKeyRejected: privileged,
    mapboxPublicTokenConfigured: Boolean(entries.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN?.startsWith('pk.')),
  }) + '\n');
}
