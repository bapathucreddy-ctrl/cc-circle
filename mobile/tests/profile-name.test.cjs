const { test }=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');
test('customer booking names come from saved profile, without substituting Google metadata',async()=>{
 let saved='Saved Customer';const exports={};const supabase={auth:{getSession:async()=>({data:{session:{user:{id:'customer',user_metadata:{full_name:'Different Google Name'}}}}})},from:()=>({select:()=>({eq:()=>({single:async()=>({data:{display_name:saved}})})})})};
 const js=ts.transpileModule(fs.readFileSync(require.resolve('../src/lib/api.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(js,{exports,require:name=>name==='./supabase'?{supabase}:{}});
 assert.equal(await exports.myDisplayName(),'Saved Customer');saved='';assert.equal(await exports.myDisplayName(),'');
});
