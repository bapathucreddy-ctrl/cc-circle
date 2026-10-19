const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');
function load(pages={}) {
 const exports={},calls=[];
 const supabase={from(table){const q={};for(const key of ['select','eq','not','order'])q[key]=(...args)=>{calls.push([table,key,...args]);return q;};q.range=async(...args)=>{calls.push([table,'range',...args]);return pages[table]?.shift()||{data:[],error:null};};q.maybeSingle=async()=>pages[table]?.shift()||{data:null,error:null};return q;}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../src/lib/professionalPayouts.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:()=>({supabase})});return {...exports,calls};
}
test('only confirmed paid transfers count as transferred; processing and failures remain outstanding',()=>{
 const {payoutSummary}=load();const summary=payoutSummary([{talent_payout_paise:100000}],['paid','pending','processing','failed'].map(status=>({status,amount_paise:20000})));
 assert.equal(summary.earned,100000);assert.equal(summary.transferred,20000);assert.equal(summary.outstanding,80000);assert.equal(summary.processing,20000);assert.equal(summary.failed,20000);
 const empty=payoutSummary([],[]);assert.equal(empty.earned,0);assert.equal(empty.outstanding,0);
});
test('payout history paginates both sources, scopes by professional and uses only completed paid earnings',async()=>{
 const p=load({bookings:[{data:Array.from({length:500},()=>({talent_payout_paise:100})),error:null},{data:[{talent_payout_paise:250}],error:null}],payout_jobs:[{data:Array.from({length:500},()=>({amount_paise:20,status:'paid'})),error:null},{data:[{amount_paise:100,status:'processing'}],error:null}],payout_accounts:[{data:{professional_id:'pro'},error:null}]});
 const data=await p.professionalPayouts('pro');assert.equal(data.summary.earned,50250);assert.equal(data.summary.transferred,10000);assert.equal(data.summary.outstanding,40250);assert.equal(data.services.length,501);assert.equal(data.transfers.length,501);assert.equal(data.registered,true);
 for(const table of ['bookings','payout_jobs','payout_accounts'])assert.ok(p.calls.some(c=>JSON.stringify(c)===JSON.stringify([table,'eq','professional_id','pro'])));
 assert.ok(p.calls.some(c=>JSON.stringify(c)===JSON.stringify(['bookings','eq','status','completed'])));assert.ok(p.calls.some(c=>JSON.stringify(c)===JSON.stringify(['bookings','not','paid_at','is',null])));
 for(const table of ['bookings','payout_jobs'])assert.ok(p.calls.some(c=>JSON.stringify(c)===JSON.stringify([table,'range',500,999])));
});
test('a failed later page rejects the entire summary rather than showing incomplete financial totals',async()=>{
 const failure=new Error('Network failure');const p=load({bookings:[{data:[],error:null}],payout_jobs:[{data:Array.from({length:500},()=>({amount_paise:10,status:'paid'})),error:null},{data:null,error:failure}]});
 await assert.rejects(()=>p.professionalPayouts('pro'),error=>error===failure);
});
