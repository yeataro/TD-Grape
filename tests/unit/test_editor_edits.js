/* Exercise the editor's actual edit handlers, with only DOM/render/network effects stubbed. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const dir=process.argv[2]||path.resolve(__dirname,'../../src/editor');
const element={setAttribute(){},addEventListener(){},textContent:'',title:'',disabled:false,replaceChildren(){},classList:{add(){},toggle(){}}};
let timers=0,writes=0;
const context=vm.createContext({console,crypto:globalThis.crypto,assert,
  location:{pathname:'/',hash:''},history:{replaceState(){}},window:{addEventListener(){}},
  document:{querySelector(){return element;},querySelectorAll(){return [];}},
  sessionStorage:{getItem(){return '';},setItem(){writes++;}},
  setTimeout(){return ++timers;},clearTimeout(){}});
for(const name of ['functions_model.js','functions_ui.js','graph_ui.js'])vm.runInContext(fs.readFileSync(path.join(dir,name),'utf8'),context);
const app=fs.readFileSync(path.join(dir,'app.js'),'utf8');
vm.runInContext(app.slice(0,app.indexOf("$('#canvas').addEventListener('dragover'")),context);
vm.runInContext(`
render=()=>{};renderNativeSourceValues=()=>{};refreshUniforms=()=>{};
const call=(id,fn)=>({id,definitionUuid:FunctionModel.CALL,params:{functionId:fn},ui:{x:24,y:24}});
const fn=(id,scope='local')=>({id,name:id,scope,stages:['pixel'],inputs:[],outputs:[],graph:{nodes:[],edges:[]},...(scope==='local'?{}:{source:{id:'source.'+id,version:'1'}})});
// These fixtures have no edges. Use an empty selection; a dangling edge index
// is intentionally discarded by the current snapshot-scoped selection model.
const setup=()=>{
  graph={schemaVersion:1,declarations:[],functions:Array.from({length:64},(_,i)=>fn('f'+i,i===0?'library':'local')),stages:{pixel:{nodes:[call('call','f0')],edges:[]}}};
  graphTrail=['f0'];past=[{sentinel:'past'}];future=[{sentinel:'future'}];selection=new Set(['selected']);selected='selected';setSelectedEdges([]);dirty=false;editVersion=5;
};
const state=()=>JSON.stringify({graph,graphTrail,past,future,selection:[...selection],selected,selectedEdge,dirty,editVersion});
setup();let before=state();
assert.throws(()=>FunctionModel.localize(graph,'f0'),/64/);assert.equal(state(),before,'model localization must check capacity before mutation');
assert.throws(()=>FunctionModel.independent(graph,graph.stages.pixel.nodes[0]),/64/);assert.equal(state(),before,'model Independent must check capacity before mutation');
// Copy-on-write plus a failed import must not leave a localized Function or undo entry.
assert.doesNotThrow(()=>change(()=>FunctionModel.importLibrary(graph,fn('overflow','library'))));
assert.equal(state(),before,'failed import must preserve graph, navigation, selection and both histories');
assert.ok($('#status').textContent.includes('function.limit'),'known capacity failure must use the localizable message');
// One localization may succeed, then a later import fails. Roll back both.
setup();graph.functions.pop();before=state();
assert.equal(change(()=>FunctionModel.importLibrary(graph,fn('overflow','library'))),false);
assert.equal(state(),before,'a late failure must also roll back successful copy-on-write preparation');
setup();before=state();
assert.doesNotThrow(()=>newFunction());assert.equal(state(),before,'New Function at capacity must preserve the draft');
setup();graphTrail=[];before=state();
assert.doesNotThrow(()=>change(()=>FunctionModel.independent(graph,graph.stages.pixel.nodes[0])));
assert.equal(state(),before,'Make Independent at capacity must preserve references');
// A callback may fail after mutation for reasons unrelated to capacity.
setup();graphTrail=[];graph.functions=[];before=state();
assert.equal(change(()=>{graph.stages.pixel.nodes=[];selected=null;selection.clear();throw Error('fixture failure');}),false);
assert.equal(state(),before,'callback failure must roll back its partial mutation');
// Successful changes create exactly one history entry, clear redo and schedule deployment.
setup();graphTrail=[];graph.functions=[];const old=JSON.stringify(graph);
assert.equal(change(()=>graph.stages.pixel.nodes.push({id:'added',params:{}})),true);
assert.equal(past.length,2);assert.equal(past.at(-1).kind,'graph');assert.equal(JSON.stringify(past.at(-1).before),old);assert.equal(JSON.stringify(past.at(-1).after),JSON.stringify(graph));assert.equal(future.length,0);assert.equal(editVersion,6);assert.equal(dirty,true);
// A read-only graph must be inert for mutations and keyboard Undo/Redo.
readonly=true;before=state();change(()=>{throw Error('must not run');});undo();undo(true);assert.equal(state(),before);
console.log('Editor edits: failed import/localization, New Function, Independent, callback rollback, success history and read-only undo passed');
`,context);
assert.equal(timers,1,'only the successful edit may schedule a deployment');
assert.equal(writes,2,'token initialization and one successful draft write only');
