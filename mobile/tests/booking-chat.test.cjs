const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');
const output={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../src/lib/bookingChat.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:output});
test('chat opens only for paid active services and closes at verified service end',()=>{
 for(const status of ['requested','accepted','en_route','arrived','completed','cancelled','declined']){
  assert.equal(output.bookingChatOpen({status,paid_at:null,service_ended_at:null}),false);
  assert.equal(output.bookingChatOpen({status,paid_at:'2026-10-16T10:00:00Z',service_ended_at:null}),['accepted','en_route','arrived'].includes(status));
  assert.equal(output.bookingChatOpen({status,paid_at:'2026-10-16T10:00:00Z',service_ended_at:'2026-10-16T11:00:00Z'}),false);
 }
});
