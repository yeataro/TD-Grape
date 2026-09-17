/* Real library import/localization and editor name helpers, with no DOM needed. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const payload=JSON.parse(fs.readFileSync(0,'utf8'));
const context=vm.createContext({assert,payload,console,crypto:globalThis.crypto,TextEncoder});
for(const file of ['functions_model.js','functions_ui.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../../src/editor',file),'utf8'),context);
vm.runInContext(`
const clone=value=>JSON.parse(JSON.stringify(value)),equal=(a,b)=>assert.equal(JSON.stringify(a),JSON.stringify(b));
const originalLibrary=clone(payload.library),graph=clone(payload.graph),typeContract=payload.contract;
const customNodeNamesEnabled=()=>true;let editing=null;const current=()=>editing;
graph.functions=clone(payload.legacy);
const legacy=clone(graph.functions),data=graph.stages.pixel;
let count=0;
for(const source of payload.library){
  const imported=FunctionModel.importLibrary(graph,source);
  assert.notEqual(imported.id,source.id,'new version must not overwrite old snapshot with the same ID');
  assert.equal(FunctionModel.importLibrary(graph,source),imported,'same new version reuses snapshot');
  const old=FunctionModel.find(graph,source.id);equal(old,legacy.find(f=>f.id===source.id));
  const call={id:'call_'+count,definitionUuid:FunctionModel.CALL,params:{functionId:imported.id}};
  data.nodes.push(call);const names=imported.graph.nodes.map(n=>n.name);
  editing=imported.graph;
  for(const node of editing.nodes){assert.ok(nodeNameValid(node.name));assert.equal(nodeDisplayName(node),node.name);}
  assignCreatedNodeNames(editing.nodes);equal(editing.nodes.map(n=>n.name),names);
  count+=names.length;
  const snapshot=clone(imported),map=FunctionModel.localize(graph,imported.id),local=FunctionModel.find(graph,call.params.functionId);
  assert.equal(local.scope,'local');assert.equal(map.get(snapshot.id),local.id);
  equal(local.graph.nodes.map(n=>n.name),names);equal(FunctionModel.find(graph,snapshot.id),snapshot);
  equal(FunctionModel.find(graph,source.id),old);
}
assert.equal(count,20);equal(payload.library,originalLibrary);
console.log('20 default node names: editor validation/display, version isolation, reuse and localization passed');
`,context);
