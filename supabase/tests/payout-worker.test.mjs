import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),ts=require('../../mobile/node_modules/typescript');
const source=fs.readFileSync(new URL('../functions/cashfree-payouts/index.ts',import.meta.url),'utf8');
async function worker({future=false,frozen=null,verified=true}={}){
 const calls=[],job={booking_id:'booking',professional_id:'pro',status:'pending',amount_paise:10000,transfer_id:'fixed-transfer',beneficiary_id:frozen,available_at:new Date(Date.now()+(future?86400000:-1000)).toISOString(),next_attempt_at:new Date(Date.now()-1000).toISOString()};
 const tables={payout_jobs:[job],bookings:[{id:'booking',status:'completed',paid_at:new Date().toISOString(),talent_payout_paise:10000}],payment_orders:[{booking_id:'booking',status:'paid',environment:'sandbox'}],payout_accounts:[{professional_id:'pro',beneficiary_id:'new-bank',environment:'sandbox'}]};
 const admin={from(table){let changes=null;const filters=[],q={};
  for(const name of ['select','order','limit'])q[name]=()=>q;
  q.eq=(key,value)=>{filters.push(row=>row[key]===value);return q};q.is=q.eq;
  q.in=(key,values)=>{filters.push(row=>values.includes(row[key]));return q};
  q.lte=(key,value)=>{filters.push(row=>row[key]<=value);return q};q.update=value=>{changes=value;return q};
  const execute=()=>{const rows=tables[table].filter(row=>filters.every(filter=>filter(row)));if(changes)rows.forEach(row=>Object.assign(row,changes));return {data:rows,error:null}};
  q.single=async()=>{const result=execute();return {data:result.data[0],error:result.data.length===1?null:new Error('Not found')}};
  q.then=(yes,no)=>Promise.resolve(execute()).then(yes,no);return q;
 }};
 class HttpError extends Error{constructor(status){super('Not found');this.status=status}}
 const provider=async(path,method='GET',payload)=>{calls.push({path,method,payload});
  if(path.startsWith('/beneficiary'))return {beneficiary_id:new URL('https://example.com'+path).searchParams.get('beneficiary_id'),beneficiary_status:verified?'VERIFIED':'INVALID'};
  if(method==='GET')throw new HttpError(404);
  return {...payload,status:'SUCCESS'};
 };
 let handler;const imports={'../_shared/http.ts':{serveRequest:fn=>{handler=fn}},'../_shared/payments.ts':{adminClient:()=>admin,environment:()=> 'sandbox',handleError:error=>{throw error},json:value=>value},'../_shared/payouts.ts':{payouts:provider,requireWorker:async()=>{}}};
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:{},require:name=>imports[name],Date,Error,encodeURIComponent});
 return {run:()=>handler({}),job,calls};
}
test('future payouts never contact Cashfree, and eligible payouts use one idempotent transfer',async()=>{
 const future=await worker({future:true});await future.run();assert.equal(future.calls.length,0);
 const due=await worker();await due.run();assert.equal(due.job.status,'paid');await due.run();
 assert.equal(due.calls.filter(c=>c.method==='POST').length,1);
 const sent=due.calls.find(c=>c.method==='POST');assert.equal(sent.payload.transfer_id,'fixed-transfer');assert.equal(sent.payload.transfer_amount,100);
});
test('bank updates cannot redirect a frozen transfer, and invalid beneficiaries cannot be frozen or paid',async()=>{
 const frozen=await worker({frozen:'original-bank'});await frozen.run();
 assert.equal(frozen.job.beneficiary_id,'original-bank');assert.equal(frozen.calls.find(c=>c.method==='POST').payload.beneficiary_details.beneficiary_id,'original-bank');
 const invalid=await worker({verified:false});await invalid.run();assert.equal(invalid.calls.filter(c=>c.method==='POST').length,0);assert.equal(invalid.job.beneficiary_id,null);assert.equal(invalid.job.status,'pending');
});
