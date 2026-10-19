const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const exportsForTest={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../src/lib/earningsAnalytics.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:exportsForTest,Date});const {earningsAnalytics}=exportsForTest;
const now=new Date(2026,9,19,14,30);
function service(day,amount,hour=12){return {starts_at:new Date(2026,9,day,hour).toISOString(),talent_payout_paise:amount};}
test('daily analytics use completed service date, not upfront payment date, and exclude future work',()=>{
 const result=earningsAnalytics([{...service(18,10000),paid_at:new Date(2026,9,18).toISOString(),service_ended_at:new Date(2026,9,19,10).toISOString()},service(19,20000),service(19,90000,20),service(18,70000)],'1D',now);
 assert.equal(result.totalPaise,30000);assert.equal(result.completedServices,2);assert.equal(result.averagePaise,15000);assert.equal(result.buckets.length,24);assert.equal(result.buckets[10].amount,10000);assert.equal(result.buckets[12].amount,20000);
});
test('5D and 1M windows include their first day and omit older records',()=>{
 const rows=[service(14,100),service(15,200),service(19,300),{...service(19,1000),starts_at:new Date(2026,8,20,12).toISOString()}];
 assert.equal(earningsAnalytics(rows,'5D',now).totalPaise,500);assert.equal(earningsAnalytics(rows,'5D',now).buckets.length,5);
 assert.equal(earningsAnalytics(rows,'1M',now).totalPaise,1600);
});
test('yearly analytics create twelve monthly buckets across the year boundary and never invent earnings',()=>{
 const rows=[{starts_at:new Date(2025,10,1,12).toISOString(),talent_payout_paise:100},{starts_at:new Date(2025,9,31,12).toISOString(),talent_payout_paise:900}];
 const year=earningsAnalytics(rows,'1Y',now);assert.equal(year.totalPaise,100);assert.equal(year.buckets.length,12);assert.equal(year.start.getMonth(),10);
 const empty=earningsAnalytics([],'1D',now);assert.equal(empty.totalPaise,0);assert.equal(empty.averagePaise,0);assert.ok(empty.buckets.every(point=>point.amount===0));
});
