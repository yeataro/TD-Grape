/* Run real import handlers with isolated DOM and HTTP boundaries. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const dir=process.argv[2]||path.resolve(__dirname,'../../src/editor'),elements=new Map();let downloaded;
const element=()=>({addEventListener(){},textContent:'',children:[],value:'',open:false,disabled:false,hidden:false,
  classList:{add(){},toggle(){}},setAttribute(){},append(...children){this.children.push(...children);},replaceChildren(){this.children=[];},
  showModal(){this.open=true;},close(){this.open=false;},click(){}});
const context=vm.createContext({assert,console,crypto:globalThis.crypto,location:{pathname:'/',hash:''},history:{replaceState(){}},window:{addEventListener(){}},
  document:{addEventListener(){},querySelector(s){if(!elements.has(s))elements.set(s,element());return elements.get(s);},querySelectorAll(){return [];},createElement:element},
  sessionStorage:{getItem(){return '';},setItem(){}},setTimeout(){return 1;},clearTimeout(){},Blob,File,
  URL:{createObjectURL(blob){downloaded=blob;return 'blob:fixture';},revokeObjectURL(){}}});
for(const name of ['functions_model.js','functions_ui.js','graph_ui.js','inspector.js','import_ui.js'])vm.runInContext(fs.readFileSync(path.join(dir,name),'utf8'),context);
const app=fs.readFileSync(path.join(dir,'app.js'),'utf8');
vm.runInContext(app.slice(0,app.indexOf("$('#canvas').addEventListener('dragover'")),context);
vm.runInContext(`
(async()=>{
render=()=>{};fit=()=>{};renderNativeSourceValues=()=>{};refreshUniforms=()=>{};
const initial={schemaVersion:1,target:'top',declarations:[],functions:[],stages:{pixel:{nodes:[],edges:[]}}};
const document={...clone(initial),name:'imported'};
const setup=()=>{closeImportReview();graph=clone(initial);editorTarget='top';readonly=false;graphTrail=[];past=[];future=[{redo:'keep'}];dirty=false;editVersion=0;};
const snapshot=()=>JSON.stringify({graph,graphTrail,past,future,dirty,editVersion});
let calls=0;
api=async(route,body)=>{assert.equal(route,'inspect');calls++;return {status:'valid',candidate:clone(body.graph),repairs:[],issues:[]};};
setup();let before=snapshot();
await reviewImportFile({name:'broken.json',size:1,text:async()=>'{bad'});
assert.equal(snapshot(),before);assert.equal(calls,0);assert.equal(importReview.raw,'{bad');assert.equal($('#importaccept').disabled,true);
assert.equal(acceptImportReview(),false);assert.equal(snapshot(),before);
setup();before=snapshot();
await reviewImportFile({name:'good.json',size:50,text:async()=>JSON.stringify(document)});
assert.equal(snapshot(),before,'inspection alone must not mutate graph/history');assert.equal(calls,1);
assert.equal($('#importaccept').disabled,false);assert.equal(acceptImportReview(),true);
assert.equal(JSON.stringify(graph),JSON.stringify(document));assert.equal(JSON.stringify(past.at(-1).before),JSON.stringify(initial));assert.equal(future.length,0);
await undo();assert.equal(JSON.stringify(graph),JSON.stringify(initial),'one Undo restores pre-import graph');
setup();await reviewImportFile({name:'good.json',size:50,text:async()=>JSON.stringify(document)});
graph.name='new edit';before=snapshot();assert.equal(acceptImportReview(),false);assert.equal(snapshot(),before);assert.equal(importReview.message,'import.changed');
setup();await reviewImportFile({name:'good.json',size:50,text:async()=>JSON.stringify(document)});
readonly=true;before=snapshot();assert.equal(acceptImportReview(),false);assert.equal(snapshot(),before);
// Replacing a whole graph must not localize the Function currently being viewed.
setup();graph.functions=Array.from({length:64},(_,i)=>({id:'f'+i,scope:'library',inputs:[],outputs:[],graph:{nodes:[],edges:[]}}));graphTrail=['f0'];
await reviewImportFile({name:'good.json',size:50,text:async()=>JSON.stringify(document)});
assert.equal(acceptImportReview(),true);assert.equal(graph.functions.length,0);assert.equal(past.at(-1).before.functions.length,64);
// Cancelled asynchronous work must not reopen a dialog or replace the current import.
setup();let resolveInspection;
api=()=>new Promise(resolve=>resolveInspection=resolve);
const pending=reviewImportFile({name:'delayed.json',size:50,text:async()=>JSON.stringify(document)});
await Promise.resolve();before=snapshot();closeImportReview();resolveInspection({status:'valid',candidate:document});await pending;
assert.equal(importReview,null);assert.equal($('#importreview').open,false);assert.equal(snapshot(),before);
setup();before=snapshot();api=async()=>({status:'newer',candidate:null,issues:[],repairs:[]});
await reviewImportFile({name:'newer.json',size:10,text:async()=>'{}'});assert.equal($('#importaccept').disabled,true);assert.equal(snapshot(),before);
// Keep the uploaded File itself so a BOM or undecodable byte is not lost on download.
setup();const byteFile=new File([new Uint8Array([239,187,191,123,125])],'bom.json');
await reviewImportFile(byteFile);downloadImportOriginal();
console.log('Import UI: invalid JSON, review before mutation, acceptance/Undo, concurrent edits, read-only, full-graph replacement and cancellation passed');
})()
`,context).then(async()=>assert.deepEqual([...new Uint8Array(await downloaded.arrayBuffer())],[239,187,191,123,125])).catch(error=>{console.error(error);process.exitCode=1;});
