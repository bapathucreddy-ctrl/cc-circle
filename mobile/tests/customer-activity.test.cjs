const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');
const exportsForTest={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../src/lib/customerActivity.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:exportsForTest});
const {customerActivity}=exportsForTest;
test('rated past bookings disappear and review lookup failures never resurrect them',()=>{
 const past={id:'past',status:'completed',starts_at:'2026-10-16T10:00:00Z'};
 assert.equal(customerActivity([past],new Set()).id,'past');
 assert.equal(customerActivity([past],new Set(['past'])),null);
 assert.equal(customerActivity([past],null),null);
 const active={id:'active',status:'en_route',starts_at:'2026-10-17T10:00:00Z'};
 assert.equal(customerActivity([past,active],null).id,'active','Live tracking remains available during review lookup failures');
 assert.equal(customerActivity([past,active],new Set(['past'])).id,'active');
});
test('an unpaid hourly invoice stays visible even if review state is unavailable or dismissed',()=>{
 const invoice={id:'hourly-invoice',status:'completed',billing_mode:'hourly',paid_at:null};
 assert.equal(customerActivity([invoice],null).id,invoice.id);assert.equal(customerActivity([invoice],new Set([invoice.id])).id,invoice.id);
 assert.equal(customerActivity([{...invoice,paid_at:'2026-10-16T14:00:00Z'}],new Set([invoice.id])),null);
});
