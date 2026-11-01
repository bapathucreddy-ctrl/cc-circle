import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('Admin loads offline splash using scripts allowed by its native content security policy',async()=>{
 const read=path=>readFile(new URL(path,import.meta.url),'utf8');
 const [entry,html,js,activity]=await Promise.all([read('../src/index.html'),read('../src/launch-splash.html'),read('../src/launch-splash.js'),read('../android/app/src/main/java/com/cccircle/admin/MainActivity.java')]);
 assert.ok(entry.includes('src="/launch-splash.html"'));
 assert.ok(html.includes('<script src="/launch-splash.js"></script>'));
 assert.ok(!html.includes('<script>'));
 assert.ok(js.includes('artist-house-splash-complete'));
 for(const ext of ['html','js'])assert.ok(activity.includes('launch-splash\\\\.'+ext));
 assert.ok(activity.includes("script-src 'self';"));
});
