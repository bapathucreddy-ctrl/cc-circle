const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const { get } = require('@expo/env');
const [variant, requestedAction, ...extraArgs] = process.argv.slice(2);
const action = requestedAction || 'whoami';
if (!['customer', 'professional'].includes(variant)) throw Error('Choose customer or professional.');
const projectRoot = path.resolve(__dirname, '..');
const cli = path.resolve(projectRoot, '../.local-tools/eas-client/node_modules/eas-cli/bin/run');
const actions = {
  whoami: ['whoami'], login: ['login', '--browser'], 'project-info': ['project:info'],
  simulator: ['build', '--platform', 'ios', '--profile', `${variant}-simulator`],
  'env-development': [],
  'simulator-availability': ['simulator:availability', '--json', '--non-interactive'],
};
if (!actions[action]) throw Error('Choose whoami, login, project-info, env-development or simulator.');
// EAS project commands can evaluate app.config before loading dotenv. Load the
// active mobile environment explicitly; example files never act as credentials.
const environment = get(projectRoot, { silent: true }).env;
if (action === 'env-development') {
  const names = ['EXPO_PUBLIC_SUPABASE_ONLINE', 'EXPO_PUBLIC_SUPABASE_URL',
    'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'EXPO_PUBLIC_SUPABASE_KEY', 'EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN', 'IOS_PUSH_ENABLED',
    variant === 'customer' ? 'EAS_CUSTOMER_PROJECT_ID' : 'EAS_PROFESSIONAL_PROJECT_ID'];
  const values = { ...environment, ...process.env };
  const key = values.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || values.EXPO_PUBLIC_SUPABASE_KEY;
  if (!values.EXPO_PUBLIC_SUPABASE_URL || !key || !values.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN?.startsWith('pk.')) throw Error('Public app configuration is incomplete.');
  if (key.startsWith('sb_secret_')) throw Error('A server key cannot be uploaded as public client configuration.');
  if (key.split('.').length === 3 && JSON.parse(Buffer.from(key.split('.')[1], 'base64url')).role !== 'anon') throw Error('Only an anonymous Supabase key can be used by the app.');
  const folder = path.resolve(projectRoot, '../.local-tools/eas-environments'); fs.mkdirSync(folder, { recursive: true });
  const file = path.join(folder, `${variant}.env`);
  fs.writeFileSync(file, names.filter(name => values[name]).map(name => `${name}=${JSON.stringify(values[name])}`).join('\n') + '\n');
  actions[action] = ['env:push', 'development', '--path', file, '--force'];
}
const result = spawnSync(process.execPath, [cli, ...actions[action], ...extraArgs], {
  cwd: projectRoot, stdio: 'inherit', windowsHide: true,
  env: { ...environment, ...process.env, EAS_NO_VCS: '1', EAS_PROJECT_ROOT: projectRoot,
    CC_APP_VARIANT: variant, EXPO_PUBLIC_APP_VARIANT: variant },
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
