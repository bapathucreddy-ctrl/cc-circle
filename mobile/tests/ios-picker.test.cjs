const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function fixture(os='ios'){
 let draft;const changed=[],jsx=(type,props)=>({type,props}),exports={},date=new Date('2026-11-10T12:00:00Z');
 const requires={react:{useState:value=>{draft??=value;return[draft,value=>draft=value]}},'react/jsx-runtime':{jsx,jsxs:jsx},'react-native':{Platform:{OS:os},Modal:'Modal',View:'View'},'@react-native-community/datetimepicker':{__esModule:true,default:'Picker'},'react-native-safe-area-context':{SafeAreaView:'SafeAreaView'},'../ui':{Button:'Button',useTheme:()=>({colors:{panel:'#fff',text:'#000'},mode:'light'})}};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../src/components/DateTimePicker.tsx'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:n=>requires[n]});
 const render=()=>exports.default({value:date,mode:'time',onChange:(...values)=>changed.push(values)});
 const find=(node,type,title)=>{if(Array.isArray(node))return node.flatMap(n=>find(n,type,title));if(!node||typeof node!=='object')return[];return[...(node.type===type&&(!title||node.props.title===title)?[node]:[]),...find(node.props?.children,type,title)];};
 return{render,find,changed,date};
}
test('iPhone wheel edits commit only on Done and Cancel discards the draft',()=>{
 const f=fixture(),next=new Date('2026-11-10T15:30:00Z');f.find(f.render(),'Picker')[0].props.onChange({},next);assert.equal(f.changed.length,0);f.find(f.render(),'Button','Done')[0].props.onPress();assert.equal(f.changed[0][0].type,'set');assert.equal(f.changed[0][1].getTime(),next.getTime());
 const cancel=fixture();cancel.find(cancel.render(),'Picker')[0].props.onChange({},next);cancel.find(cancel.render(),'Button','Cancel')[0].props.onPress();assert.equal(cancel.changed[0][0].type,'dismissed');assert.equal(cancel.changed[0][1],undefined);
});
test('Android keeps the native date picker and its existing callback',()=>{const f=fixture('android'),tree=f.render();assert.equal(tree.type,'Picker');tree.props.onChange({type:'set'},f.date);assert.equal(f.changed.length,1);});
