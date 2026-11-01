import {test} from 'node:test';import assert from 'node:assert/strict';import {readFile}from'node:fs/promises';
test('every linked stylesheet is accessible inside the Android app, including mobile and dark styling',async()=>{
 const html=await readFile(new URL('../src/index.html',import.meta.url),'utf8'),java=await readFile(new URL('../android/app/src/main/java/com/cccircle/admin/MainActivity.java',import.meta.url),'utf8');
 const literal=java.match(/path\.matches\(("(?:[^"\\]|\\.)*")\)/)?.[1];assert.ok(literal);const allowed=new RegExp('^'+JSON.parse(literal)+'$');
 const sheets=[...html.matchAll(/rel="stylesheet" href="([^"]+)"/g)].map(m=>m[1]);assert.ok(sheets.includes('/mobile.css'));assert.ok(sheets.includes('/profile.css'));
 for(const file of sheets){assert.ok(allowed.test(file),'Native app blocks '+file);await readFile(new URL('../src'+file,import.meta.url));}
 assert.equal(allowed.test('/.env'),false);assert.equal(allowed.test('/../profile.css'),false);
 assert.equal(allowed.test('/service-defaults/party-makeup.jpg'),true);
 assert.equal(allowed.test('/service-defaults/../app.js'),false);
});
