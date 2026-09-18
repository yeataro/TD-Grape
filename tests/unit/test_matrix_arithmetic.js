/* Arithmetic inference is a finite signature lookup, never value evaluation. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const payload=JSON.parse(fs.readFileSync(0,'utf8')),dir=path.resolve(__dirname,'../../src/editor');
const stub={addEventListener(){},classList:{toggle(){}},value:''};
const context=vm.createContext({assert,payload,console,crypto:globalThis.crypto,location:{pathname:'/',hash:''},history:{replaceState(){}},window:{addEventListener(){},getSelection(){return null;}},document:{addEventListener(){},querySelector:()=>stub,querySelectorAll:()=>[]},sessionStorage:{getItem(){return '';},setItem(){}},setTimeout(){return 1;},clearTimeout(){}});
for(const name of ['functions_model.js','functions_ui.js','graph_ui.js','inspector.js'])vm.runInContext(fs.readFileSync(path.join(dir,name),'utf8'),context);
const app=fs.readFileSync(path.join(dir,'app.js'),'utf8');vm.runInContext(app.slice(0,app.indexOf("$('#canvas').addEventListener('dragover'")),context);
vm.runInContext(`
catalog=payload.catalog;setTypeContract(payload.contract);editorTarget='top';stage='pixel';graphTrail=[];
const same=(a,b)=>assert.equal(JSON.stringify(a),JSON.stringify(b));
const make=(key,id,params={},auto=false)=>({id,definitionUuid:'sgrape.builtin.'+key,params:{...catalog.find(d=>d.key===key).defaults,...params},ui:auto?{typeMode:'auto'}:{}});
const source=(type,id)=>isMatrixType(type)?make('matrix',id,{type,values:shapedValue(1,type)}):typeComponents(type)>1?make('vector',id,{type,components:[1,2,3,4]}):make('scalar',id,{type,value:2});
const documentFor=(key,a,b,params={},auto=true)=>({declarations:[],functions:[],stages:{pixel:{nodes:[source(a,'a'),source(b,'b'),make(key,'op',params,auto)],edges:[{from:['a','out'],to:['op','a']},{from:['b','out'],to:['op','b']}]}}});
let count=0;
for(const d of catalog.filter(isArithmetic))for(const variant of typeVariants(d)){
  graph=documentFor(d.key,variant.inputs.a,variant.inputs.b);
  const before=clone(graph),plan=planAutoGraph(graph,current());
  assert.equal(plan.issues.size,0);same(plan.ports.get('op'),{inputs:variant.inputs,outputs:variant.outputs});
  resolveAutoEdit(graph,{...clone(graph),stages:{pixel:{nodes:[],edges:[]}}});
  same(concretePorts(graph,current().nodes[2],null),plan.ports.get('op'));
  const saved=JSON.stringify(graph);graph=JSON.parse(saved);same(concretePorts(graph,current().nodes[2],null),plan.ports.get('op'));
  same(before.stages.pixel.nodes[2].params.type,d.defaults.type);count++;
}
for(const key of ['add','subtract','multiply','divide']){
  const n=make(key,'op',{type:'mat2x3'}),type=concretePorts({declarations:[]},n,null).inputs.b;
  same(defaultInput(n,'b',type),key==='multiply'?shapedValue(1,type):Array(typeComponents(type)).fill(key==='divide'?1:0));
}
for(const port of ['a','b']){
  graph=documentFor('multiply','mat2x3','float');current().nodes[port==='a'?0:1]=source('mat2x3',port);
  current().edges=current().edges.filter(e=>e.to[1]===port);
  assert.equal(planAutoGraph(graph,current()).ports.get('op').outputs.out,'mat2x3');
}
graph=documentFor('multiply','mat2x3','vec2',{type:'vec3'},false);
let plan=planAutoGraph(graph,current());same(plan.ports.get('op'),{inputs:{a:'mat2x3',b:'vec2'},outputs:{out:'vec3'}});
graph=documentFor('add','mat3','vec3');assert.throws(()=>planAutoGraph(graph,current()));
graph=documentFor('multiply','mat2x3','vec3');assert.throws(()=>planAutoGraph(graph,current()));
graph=documentFor('add','mat3','float');
resolveAutoEdit(graph,{...clone(graph),stages:{pixel:{nodes:[],edges:[]}}});
const mixed=clone(graph),op=current().nodes[2];op.inputValues={a:shapedValue(1,'mat3'),b:7};
reshapeTypedInputs(op,catalog.find(d=>d.key==='add'),'mat3',{a:'mat3',b:'mat3'});assert.equal(op.inputValues.b.length,9);
reshapeTypedInputs(op,catalog.find(d=>d.key==='add'),'mat3',{a:'mat3',b:'float'});assert.equal(op.inputValues.b,7);
graph=clone(mixed);const previous=clone(graph);current().nodes[1]=source('mat3','b');resolveAutoEdit(graph,previous);
assert.equal(current().nodes[2].params.operandTypes.b,'mat3');
graph=clone(mixed);assert.equal(concretePorts(graph,current().nodes[2],null).inputs.b,'float');
// A downstream array must follow the result vector, not either matrix shape.
graph=documentFor('multiply','mat2x3','vec2');current().nodes.push(make('array_create','array',{elementType:'vec3'}));current().edges.push({from:['op','out'],to:['array','value']});
plan=planAutoGraph(graph,current());assert.equal(plan.ports.get('array').outputs.out,'vec3[4]');
console.log('matrix arithmetic editor passed: '+count+' signatures');
`,context);
