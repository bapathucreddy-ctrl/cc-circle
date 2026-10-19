const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');
function load(pages){
 const calls=[];const query={};
 for(const method of ['select','eq','not','order'])query[method]=(...args)=>{calls.push([method,...args]);return query;};
 query.range=async(...args)=>{calls.push(['range',...args]);return pages.shift();};
 const output={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../src/lib/earnings.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:output,require:()=>({supabase:{from:table=>{assert.equal(table,'bookings');return query;}}})});
 return {run:output.professionalEarnings,calls};
}
test('lifetime earnings includes every page of paid, completed net payouts for this professional',async()=>{
 const fixture=load([{data:Array.from({length:500},()=>({talent_payout_paise:10000})),error:null},{data:[{talent_payout_paise:25500}],error:null}]);
 const total=await fixture.run('professional-1');assert.equal(total.totalPaise,5025500);assert.equal(total.completedServices,501);
 assert.ok(fixture.calls.some(c=>JSON.stringify(c)===JSON.stringify(['eq','professional_id','professional-1'])));
 assert.ok(fixture.calls.some(c=>JSON.stringify(c)===JSON.stringify(['eq','status','completed'])));
 assert.ok(fixture.calls.some(c=>JSON.stringify(c)===JSON.stringify(['not','paid_at','is',null])));
 assert.deepEqual(fixture.calls.filter(c=>c[0]==='range'),[['range',0,499],['range',500,999]]);
});
test('no completed paid services returns zero, but a failed later page never returns a partial total',async()=>{
 const empty=await load([{data:[],error:null}]).run('professional-1');assert.equal(empty.totalPaise,0);assert.equal(empty.completedServices,0);
 const failure=new Error('Unavailable');const fixture=load([{data:Array.from({length:500},()=>({talent_payout_paise:100})),error:null},{data:null,error:failure}]);
 await assert.rejects(fixture.run('professional-1'),error=>error===failure);
});
