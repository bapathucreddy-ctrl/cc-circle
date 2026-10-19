const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const [variant, ...args] = process.argv.slice(2);
if (!['customer', 'professional'].includes(variant)) throw Error('Choose customer or professional.');
const projectRoot = path.resolve(__dirname, '..');
// Generated projects belong to one app identity. Never silently reuse the old
// combined app, or the other app's generated project, for a native run.
if (args[0] === 'run:android' || args[0] === 'run:ios') {
  const expected = `com.cccircle.${variant}`;
  let nativeProject;
  if (args[0] === 'run:android') nativeProject = path.join(projectRoot, 'android/app/build.gradle');
  else {
    const ios = path.join(projectRoot, 'ios');
    const project = fs.existsSync(ios) && fs.readdirSync(ios).find(name => name.endsWith('.xcodeproj'));
    if (project) nativeProject = path.join(ios, project, 'project.pbxproj');
  }
  if (nativeProject && fs.existsSync(nativeProject) && !fs.readFileSync(nativeProject, 'utf8').includes(expected)) {
    throw Error(`Generated native project does not match ${expected}. Use a clean source checkout for this app, or its EAS build profile. Existing native files were left intact.`);
  }
}
const result = spawnSync(process.execPath, [require.resolve('expo/bin/cli'), ...args], {
  cwd: projectRoot, stdio: 'inherit', env: { ...process.env, CC_APP_VARIANT: variant, EXPO_PUBLIC_APP_VARIANT: variant },
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
