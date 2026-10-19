const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');
const exportsForTest={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../src/lib/billing.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:exportsForTest});
const {hourlyBillableHours,canPayBooking}=exportsForTest;
test('hourly previews round every partial hour up and wait for a verified final invoice before payment',()=>{
 const start='2026-10-16T10:00:00Z';assert.equal(hourlyBillableHours(start,'2026-10-16T12:10:00Z'),3);assert.equal(hourlyBillableHours(start,'2026-10-16T11:00:00Z'),1);assert.equal(hourlyBillableHours(start,'2026-10-16T11:00:01Z'),2);assert.equal(hourlyBillableHours(null,null),0);
 const booking={billing_mode:'hourly',status:'accepted',paid_at:null,billing_finalised_at:null};assert.equal(canPayBooking(booking),false);assert.equal(canPayBooking({...booking,status:'arrived'}),false);assert.equal(canPayBooking({...booking,status:'completed'}),false);assert.equal(canPayBooking({...booking,status:'completed',billing_finalised_at:start}),true);assert.equal(canPayBooking({...booking,status:'completed',billing_finalised_at:start,paid_at:start}),false);
 assert.equal(canPayBooking({...booking,billing_mode:'fixed'}),true,'existing fixed-price bookings still pay after acceptance');
});
