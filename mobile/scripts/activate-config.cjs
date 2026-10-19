const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const example = path.join(root, '.env.example');
const active = path.join(root, '.env');
if (!fs.existsSync(active)) fs.copyFileSync(example, active, fs.constants.COPYFILE_EXCL);
// Keep the reusable template free of the supplied account configuration.
fs.writeFileSync(example, 'EXPO_PUBLIC_SUPABASE_ONLINE=true\nEXPO_PUBLIC_SUPABASE_URL=\nEXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=\nEXPO_PUBLIC_LOCAL_SUPABASE_URL=http://10.0.2.2:54321\nEXPO_PUBLIC_LOCAL_SUPABASE_KEY=\nEXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=\nIOS_BUNDLE_IDENTIFIER=com.cccircle.development\nANDROID_PACKAGE=com.cccircle.development\n');
process.stdout.write('Configuration preserved in .env; reusable template reset.\n');
