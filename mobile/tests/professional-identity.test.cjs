const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');
const exportsFor=file=>{const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve(file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require});return exports;};
test('professional identity accepts real name syntax, normalizes whitespace and blocks promotional/contact names',()=>{
 const {validateProfessionalName}=exportsFor('../src/lib/professionalIdentity.ts');assert.equal(validateProfessionalName('  Arjun   Kumar  '),'Arjun Kumar');assert.equal(validateProfessionalName('José D’Souza'),'José D’Souza');assert.equal(validateProfessionalName('ಅರ್ಜುನ್ ಕುಮಾರ್'),'ಅರ್ಜುನ್ ಕುಮಾರ್');
 for(const name of ['innocent123','Arjun Photography','Mira Studio','Best Makeup Artist','book@example.com','https://my.site','Mira +91990000000',''])assert.throws(()=>validateProfessionalName(name),/real full name/);
});
