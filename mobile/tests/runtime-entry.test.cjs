const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');
const source=ts.transpileModule(fs.readFileSync(require.resolve('../index.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function load(expoGo, professional=false){const loaded=[];let registered;const app=()=>{},notice=()=>{};
 vm.runInNewContext(source,{exports:{},require:name=>{
  if(name==='expo')return {isRunningInExpoGo:()=>expoGo,registerRootComponent:root=>{registered=root;}};
  if(name==='./src/appVariant')return {isProfessionalApp:professional};
  loaded.push(name);
  if(name==='./src/lib/professionalLocation')return {};

  if(name==='./App'){if(expoGo)throw Error('Native-only App was imported in Expo Go');return {default:app};}
  if(name==='./src/ExpoGoScreen')return {default:notice};
  throw Error('Unexpected import '+name);
 }});
 return {loaded,registered,expected:expoGo?notice:app};
}
test('Expo Go entry never imports the native-only application before showing setup guidance',()=>{
 const result=load(true);assert.deepEqual(result.loaded,['./src/ExpoGoScreen']);assert.equal(result.registered,result.expected);
});
test('development builds and web still load the full application',()=>{
 const result=load(false);assert.deepEqual(result.loaded,['./App']);assert.equal(result.registered,result.expected);
});

test('professional native entry registers background tasks before loading React screens',()=>{const result=load(false,true);assert.deepEqual(result.loaded,['./src/lib/professionalLocation','./App']);});
