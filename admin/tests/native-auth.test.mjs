import {test} from 'node:test';
import assert from 'node:assert/strict';
import {adminAuthStorage,nativeAuthCode} from '../src/nativeAuth.js';
test('admin mobile accepts only its exact authorization-code callback',()=>{
 assert.equal(nativeAuthCode('cccircle-admin://auth/callback?code=one-time-code'),'one-time-code');
 for(const value of ['https://auth/callback?code=x','cccircle-admin://other/callback?code=x','cccircle-admin://auth/other?code=x','cccircle-admin://person@auth/callback?code=x','cccircle-admin://auth/callback#access_token=token'])assert.throws(()=>nativeAuthCode(value));
 assert.throws(()=>nativeAuthCode('cccircle-admin://auth/callback?error_description=Access%20denied'),/Access denied/);
});
test('sessions survive restart/update, migrate from session storage, and explicit logout clears them',()=>{
 const store=()=>{const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};};
 const session=store(),local=store(),storage=adminAuthStorage(session,local);
 storage.setItem('circle-banner-admin','session-token');storage.setItem('circle-banner-admin-code-verifier','one-use-proof');
 assert.equal(local.getItem('circle-banner-admin'),'session-token');
 const restarted=adminAuthStorage(store(),local);
 assert.equal(restarted.getItem('circle-banner-admin'),'session-token');assert.equal(restarted.getItem('circle-banner-admin-code-verifier'),'one-use-proof');
 restarted.removeItem('circle-banner-admin-code-verifier');assert.equal(local.getItem('circle-banner-admin-code-verifier'),null);
 restarted.removeItem('circle-banner-admin');assert.equal(storage.getItem('circle-banner-admin'),null);
 session.setItem('circle-banner-admin','old-session');assert.equal(storage.getItem('circle-banner-admin'),'old-session');assert.equal(session.getItem('circle-banner-admin'),null);
 const secure=store(),native=adminAuthStorage(session,local,secure);assert.equal(native.getItem('circle-banner-admin'),'old-session');assert.equal(local.getItem('circle-banner-admin'),null);
 assert.equal(adminAuthStorage(store(),store(),secure).getItem('circle-banner-admin'),'old-session');native.removeItem('circle-banner-admin');assert.equal(secure.getItem('circle-banner-admin'),null);
});
