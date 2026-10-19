const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
function readFile(name) {
  const file = path.join(root, name);
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(fs.readFileSync(file, 'utf8').split(/\r?\n/).flatMap(line => {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    return match ? [[match[1], match[2].trim().replace(/^["']|["']$/g, '')]] : [];
  }));
}
function selectedBackend(env) {
  const flag = (env.EXPO_PUBLIC_SUPABASE_ONLINE || 'true').trim().toLowerCase();
  if (!['true', 'false'].includes(flag)) throw new Error('EXPO_PUBLIC_SUPABASE_ONLINE must be true or false.');
  const mode = flag === 'false' ? 'local' : 'online';
  const url = mode === 'local' ? env.EXPO_PUBLIC_LOCAL_SUPABASE_URL : env.EXPO_PUBLIC_SUPABASE_URL;
  const key = (mode === 'local' ? env.EXPO_PUBLIC_LOCAL_SUPABASE_KEY : env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.EXPO_PUBLIC_SUPABASE_KEY) || '';
  let privileged = key.startsWith('sb_secret_');
  try { privileged ||= JSON.parse(Buffer.from(key.split('.')[1] || '', 'base64url').toString()).role === 'service_role'; } catch {}
  return { mode, url, key, privileged };
}
module.exports = { readFile, selectedBackend };
