/* Check Auto operand defaults through the real planner, creator and edit history.
 * Read {catalog,contract} from stdin, as the matrix arithmetic editor tests do.
 */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const payload=JSON.parse(fs.readFileSync(0,'utf8')),dir=path.resolve(__dirname,'../../src/editor');
const elements=new Map();
const element=key=>{
  if(!elements.has(key))elements.set(key,{value:'all',textContent:'',dataset:{},hidden:false,disabled:false,
    focus(){},replaceChildren(){},setAttribute(){},addEventListener(){},querySelectorAll(){return [];},
    classList:{add(){},remove(){},toggle(){}}});
  return elements.get(key);
};
const context=vm.createContext({assert,payload,console,URLSearchParams,TextEncoder,TextDecoder,crypto:globalThis.crypto,
  location:{pathname:'/',hash:'',search:''},history:{replaceState(){}},window:{addEventListener(){},getSelection(){return null;}},
  document:{addEventListener(){},querySelector:element,querySelectorAll:()=>[]},
  sessionStorage:{getItem(){return '';},setItem(){},removeItem(){}},setTimeout(){return 1;},clearTimeout(){},queueMicrotask(){}});
for(const name of ['functions_model.js','functions_ui.js','graph_ui.js','inspector.js'])
  vm.runInContext(fs.readFileSync(path.join(dir,name),'utf8'),context,{filename:name});
const app=fs.readFileSync(path.join(dir,'app.js'),'utf8');
vm.runInContext(app.slice(0,app.indexOf("$('#canvas').addEventListener('dragover'")),context,{filename:'app.js'});
vm.runInContext(`
(async()=>{
render=()=>{};wires=()=>{};renderHistoryActions=()=>{};renderGraphSaveState=()=>{};clearCompileDiagnostics=()=>{};
renderNativeSourceValues=()=>{};refreshUniforms=async()=>{};refreshNativeSources=async()=>{};
api=async()=>{throw Error('model test must not contact the backend');};
catalog=payload.catalog;setTypeContract(payload.contract);editorTarget='top';stage='pixel';connectionInterrupted=true;
const same=(actual,expected,message)=>assert.equal(JSON.stringify(actual),JSON.stringify(expected),message);
const make=(key,id,params={},auto=false)=>{
  const d=catalog.find(entry=>entry.key===key);assert.ok(d,key+' exists in the supplied catalog');
  return {id,definitionUuid:d.definitionUuid,revisionHash:d.revisionHash,params:{...clone(d.defaults||{}),...params},ui:{typeMode:auto?'auto':'locked'}};
};
const source=(type,id)=>isMatrixType(type)?make('matrix',id,{type,values:shapedValue(1,type)}):
  typeComponents(type)>1?make('vector',id,{type,components:typeFamily(type)==='bool'?[true,false,true,false]:[1,2,3,4]}):
  make('scalar',id,{type,value:typeFamily(type)==='bool'?true:2});
function setup(nodes,edges=[]){
  graph={schemaVersion:1,target:'top',declarations:[],functions:[],stages:{pixel:{nodes,edges}}};
  graphTrail=[];creatorState=null;past=[];future=[];selection.clear();selected=null;selectedEdge=null;dirty=false;readonly=false;editVersion=0;
}
function operation(key,connections,params={},auto=true){
  const nodes=Object.entries(connections).map(([port,type])=>source(type,'source_'+port));
  nodes.push(make(key,'op',params,auto));
  setup(nodes,Object.keys(connections).map(port=>({from:['source_'+port,'out'],to:['op',port]})));
  const before=JSON.stringify(graph),plan=planAutoGraph(graph,current());
  assert.equal(plan.issues.size,0,key+' must have a legal signature');
  assert.equal(JSON.stringify(graph),before,'planning must not mutate saved node types');
  return plan.ports.get('op');
}
const numeric=['float','double','int','uint',...['vec','ivec','uvec','dvec'].flatMap(prefix=>[2,3,4].map(size=>prefix+size))];
let direct=0,creator=0;
for(const type of numeric)for(const port of ['a','b']){
  same(operation('multiply',{[port]:type}),{inputs:{a:type,b:type},outputs:{out:type}},'single '+type+' on Multiply '+port);
  direct++;
}
for(const prefix of ['vec','dvec'])for(const size of [2,3,4])for(const port of ['a','b']){
  const type=prefix+size,out=(prefix==='dvec'?'dmat':'mat')+size;
  same(operation('outer_product',{[port]:type}),{inputs:{a:type,b:type},outputs:{out}},'single '+type+' on Outer Product '+port);
  direct++;
}

// Once both inputs are connected, their real dimensions determine the result.
for(const [matrix,vector] of [['mat','vec'],['dmat','dvec']]){
  for(const [a,b,out] of [[vector+'3',matrix+'2x3',vector+'2'],[matrix+'3x2',vector+'3',vector+'2'],
    [matrix+'2x3',vector+'2',vector+'3'],[matrix+'2x3',matrix+'4x2',matrix+'4x3']])
    same(operation('multiply',{a,b}),{inputs:{a,b},outputs:{out}},'two connected Multiply operands');
  same(operation('outer_product',{a:vector+'3',b:vector+'2'}),
    {inputs:{a:vector+'3',b:vector+'2'},outputs:{out:matrix+'2x3'}},'rectangular Outer Product remains legal');
  for(const port of ['a','b']){
    const planned=operation('multiply',{[port]:matrix+'2x3'});
    assert.equal(planned.inputs[port],matrix+'2x3');assert.equal(planned.outputs.out,matrix+'2x3','single matrix retains its existing result-shape priority');
  }
}
assert.throws(()=>operation('multiply',{a:'mat2x3',b:'vec3'}),'incompatible multiplication dimensions remain rejected');

// Locked output signatures and configured nonsquare operands remain authoritative.
same(operation('multiply',{a:'vec3'},{type:'vec2',operandTypes:{a:'vec3',b:'mat2x3'}},false),
  {inputs:{a:'vec3',b:'mat2x3'},outputs:{out:'vec2'}},'locked Multiply must not become vec3 component-wise');
same(operation('outer_product',{a:'vec3'},{type:'mat2x3'},false),
  {inputs:{a:'vec3',b:'vec2'},outputs:{out:'mat2x3'}},'locked Outer Product must not become square');

// A selector's boolean type must not become the type of the selected data.
same(operation('if',{condition:'bool'}),{inputs:{condition:'bool',true:'float',false:'float'},outputs:{out:'float'}});
same(operation('mix_boolean',{factor:'bool'}),{inputs:{a:'float',b:'float',factor:'bool'},outputs:{out:'float'}});
same(operation('mix_boolean',{factor:'bvec3'}),{inputs:{a:'vec3',b:'vec3',factor:'bvec3'},outputs:{out:'vec3'}});
same(operation('multiply',{}),{inputs:{a:'float',b:'float'},outputs:{out:'float'}},'unconnected Multiply default stays float');
same(operation('outer_product',{}),{inputs:{a:'vec2',b:'vec2'},outputs:{out:'mat2'}},'unconnected Outer Product keeps its prior minimum-shape default');

// Unrelated edits must preserve saved Auto signatures, manual values and all
// downstream wires, including a branch whose type cannot follow a new default.
function savedAutoBranch(key,lockedSecond=false){
  const multiply=key==='multiply',type=multiply?'vec2':'mat2x3';
  const op=make(key,'op',{type,...(multiply?{operandTypes:{a:'vec3',b:'mat2x3'}}:{})},true);
  op.inputValues={b:multiply?[2,3,4,5,6,7]:[2,3]};
  const downstreamParams={type,...(isMatrixType(type)?{operandTypes:{a:type,b:type}}:{})};
  setup([source('vec3','source'),op,make('add','branch1',downstreamParams,true),make('add','branch2',downstreamParams,!lockedSecond)],
    [{from:['source','out'],to:['op','a']},{from:['op','out'],to:['branch1','a']},{from:['op','out'],to:['branch2','a']}]);
  return type;
}
for(const key of ['multiply','outer_product']){
  const type=savedAutoBranch(key);
  assert.equal(concretePorts(graph,current().nodes[1],null).outputs.out,type,'saved Auto params remain concrete before inference');
  const unchangedTopology=clone(graph);current().nodes[1].ui.x=50;resolveAutoEdit(graph,unchangedTopology);
  assert.equal(current().nodes[1].params.type,type,'a position-only edit does not reinterpret saved Auto signatures');
  for(const [lockedSecond,options] of [[false,{}],[true,{}],[true,{typeChange:true,disconnectInvalid:true}]]){
    savedAutoBranch(key,lockedSecond);
    const before=JSON.stringify(graph),savedNodes=JSON.stringify(current().nodes),savedEdges=JSON.stringify(current().edges);
    assert.equal(change(()=>current().nodes.push(source('float','unrelated')),options),true,key+' allows an unrelated topology edit');
    assert.equal(JSON.stringify(current().nodes.slice(0,-1)),savedNodes,'unrelated edit preserves all prior node types and values');
    assert.equal(JSON.stringify(current().edges),savedEdges,'unrelated edit retains both downstream wires even with disconnectInvalid');
    assert.equal(past.length,1,'the unrelated edit creates only its own history step');
    const after=JSON.stringify(graph);assert.equal(await undo(),true);assert.equal(JSON.stringify(graph),before);
    assert.equal(await undo(true),true);assert.equal(JSON.stringify(graph),after);
  }
  // Replacing the source is a new operand choice even when its type is equal.
  savedAutoBranch(key);current().nodes.splice(2);current().edges.splice(1);current().nodes.push(source('vec3','replacement'));
  assert.equal(connectPorts({node:'replacement',kind:'outputs',port:'out',type:'vec3'},
    {node:'op',kind:'inputs',port:'a',type:'vec3'}),true,key+' accepts a replacement source');
  same(concretePorts(graph,current().nodes[1],null),{inputs:{a:'vec3',b:'vec3'},outputs:{out:key==='multiply'?'vec3':'mat3'}},
    'same-type replacement source uses the new matching-operand default');
  same(current().edges,[{from:['replacement','out'],to:['op','a']}],'replacement source displaces the original incoming wire');
  savedAutoBranch(key);current().nodes.splice(2);current().edges.splice(1);
  assert.equal(change(()=>{current().nodes[0].params.type='vec4';}),true,'an upstream type edit triggers new operand inference');
  same(concretePorts(graph,current().nodes[1],null),{inputs:{a:'vec4',b:'vec4'},outputs:{out:key==='multiply'?'vec4':'mat4'}},
    'the new source type determines the matching peer');
  savedAutoBranch(key);current().nodes.splice(2);current().edges.splice(1);current().nodes[1].ui.typeMode='locked';
  assert.equal(setMathType(current().nodes[1],'auto'),true,'explicitly switching to Auto triggers the new default');
  same(concretePorts(graph,current().nodes[1],null),{inputs:{a:'vec3',b:'vec3'},outputs:{out:key==='multiply'?'vec3':'mat3'}},
    'an explicit Auto choice replaces the old locked signature');
}

// Nested local graphs use their own prior owner, not the root stage or parent.
for(const key of ['multiply','outer_product']){
  savedAutoBranch(key,true);const contents=current();
  const call=(id,functionId)=>({id,definitionUuid:FunctionModel.CALL,params:{functionId}});
  const fn=(id,data)=>({id,name:id,scope:'local',stages:['pixel'],inputs:[],outputs:[],graph:data});
  graph.functions=[fn('parent',{nodes:[call('call_child','child')],edges:[]}),fn('child',contents)];
  graph.stages.pixel={nodes:[call('call_parent','parent')],edges:[]};graphTrail=['parent','child'];
  const before=JSON.stringify(graph),savedNodes=JSON.stringify(current().nodes),savedEdges=JSON.stringify(current().edges);
  const wire={node:'source',port:'out',kind:'outputs',type:'vec3'},d=catalog.find(entry=>entry.key===key);
  creatorState={wire};const context=creatorValidationContext(),variant=creatorVariants(d,wire)[0];
  const expected={inputs:{a:'vec3',b:'vec3'},outputs:{out:key==='multiply'?'vec3':'mat3'}};
  same(creatorTypePlan(d,variant,'a',wire,false,context),expected,'nested creator local preview uses the new default');
  same(creatorTypePlan(d,variant,'a',wire,false),expected,'nested creator full trial also preserves the existing saved branch');
  assert.equal(JSON.stringify(graph),before,'nested creator trials do not alter saved types or values');
  assert.equal(change(()=>current().nodes.push(source('float','unrelated'))),true,'nested unrelated edit succeeds');
  assert.equal(JSON.stringify(current().nodes.slice(0,-1)),savedNodes,'nested saved nodes retain their exact signatures and values');
  assert.equal(JSON.stringify(current().edges),savedEdges,'nested saved downstream edges survive');
}

// Create from a dragged output uses the same Auto defaults on either input.
// Use the actual creator context so its local preview and memoization are covered.
for(const [key,types] of [['multiply',numeric],['outer_product',['vec2','vec3','vec4','dvec2','dvec3','dvec4']]]){
  for(const type of types)for(const port of ['a','b']){
    setup([source(type,'source')]);
    const wire={node:'source',port:'out',kind:'outputs',type},d=catalog.find(entry=>entry.key===key);
    creatorState={wire};const context=creatorValidationContext(),variant=creatorVariants(d,wire)[0],before=JSON.stringify(graph);
    const planned=creatorTypePlan(d,variant,port,wire,false,context);
    const out=key==='multiply'?type:(type.startsWith('d')?'dmat':'mat')+typeComponents(type);
    same(planned,{inputs:{a:type,b:type},outputs:{out}},'creator '+key+' '+type+' '+port);
    same(creatorTypePlan(d,variant,port,wire,false),planned,'the full creator trial agrees with the local preview');
    same(creatorTypePlan(d,variant,port,wire,false,context),planned,'cached creator answer stays identical');
    assert.equal(JSON.stringify(graph),before,'creator preview must not mutate the document');creator++;
  }
}

// A committed wire applies inferred signatures to the real graph. JSON reload,
// Undo and Redo preserve those concrete signatures rather than inferring afresh.
for(const [key,type,port] of [['multiply','vec3','a'],['multiply','dvec4','b'],['outer_product','vec3','a'],['outer_product','dvec4','b']]){
  setup([source(type,'source'),make(key,'op',{},true)]);const before=JSON.stringify(graph);
  const from={node:'source',kind:'outputs',port:'out',type},to={node:'op',kind:'inputs',port,type:ports(current().nodes[1],'inputs')[port]};
  assert.equal(connectPorts(from,to),true,key+' commit');assert.equal(past.length,1,'one connection creates one history step');
  const out=key==='multiply'?type:(type.startsWith('d')?'dmat':'mat')+typeComponents(type),expected={inputs:{a:type,b:type},outputs:{out}};
  same(concretePorts(graph,current().nodes[1],null),expected,'resolveAutoEdit applies the inferred signature');
  const saved=JSON.stringify(graph);graph=JSON.parse(saved);
  same(concretePorts(graph,current().nodes[1],null),expected,'saved signature survives JSON reload');
  assert.equal(await undo(),true);assert.equal(JSON.stringify(graph),before,'Undo restores the initial unconnected node');
  assert.equal(await undo(true),true);assert.equal(JSON.stringify(graph),saved,'Redo restores the saved result');
  same(concretePorts(graph,current().nodes[1],null),expected,'Redo preserves concrete ports');
}
console.log('Auto operand defaults passed: '+direct+' direct cases, '+creator+' creator cases, rectangular/locked/control/matrix guards, save/reload and Undo/Redo');
})()
`,context).catch(error=>{console.error(error);process.exitCode=1;});
