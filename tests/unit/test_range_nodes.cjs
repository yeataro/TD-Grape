const {test}=require('node:test'),assert=require('node:assert/strict');
const {GraphDocument,registry,createCompiler}=require('../../src/generated/wire_planning.js');
const {rangeCases}=require('../fixtures/range_nodes.cjs');
const {node}=require('../fixtures/shared_subgraphs.cjs');
const compiler=createCompiler(registry),policy={components:{float:1,vec2:2,vec3:3,vec4:4},conversions:[{from:'float',to:'vec3'}]};

test('every scalar/vector range signature compiles while integer configurations retain the explicit old route',()=>{
 for(const {key,type,graph}of rangeCases()){
  assert.equal(compiler.supports(graph),true,key+' '+type);assert.ok(compiler.compile(graph).pixel.includes(key+'('));
  const handle=new GraphDocument(graph,registry).networks.get('pixel').node('operation');assert.equal(handle.outputs[0].type,type);
  const other=structuredClone(graph);other.stages.pixel.nodes.find(n=>n.id==='operation').params.type='int';
  assert.equal(compiler.supports(other),false);
 }
});

test('paired bounds are complete tuples; a half-scalar Clamp or Smoothstep is never a native candidate',()=>{
 for(const key of ['clamp','smoothstep']){
  const m=registry.get('sgrape.builtin.'+key),n=node('op',key,{type:'vec3'}),variants=m.signatures(n,{}).filter(s=>s.type==='vec3');
  assert.equal(variants.length,2);
  const a=key==='clamp'?'min':'edge0',b=key==='clamp'?'max':'edge1';
  assert.ok(variants.every(s=>s.inputs[a]===s.inputs[b]));
  const graph={schemaVersion:1,target:'top',declarations:[],stages:{pixel:{nodes:[n],edges:[]}}};
  assert.throws(()=>new GraphDocument(graph,registry).change(g=>g.networks.get('pixel').node('op').configure({signature:{type:'vec3',inputs:{...variants[0].inputs,[a]:'float'},outputs:{out:'vec3'}}})),/Invalid native signature/);
 }
});

test('wiring selects local bounds without changing output, retains existing peers and never resets after disconnect',()=>{
 const graph={schemaVersion:1,target:'top',declarations:[],stages:{pixel:{nodes:[node('lo','float',{value:.2}),node('hi','vec3',{value:[.8,.8,.8]}),node('clamp','clamp',{type:'vec3'})],edges:[]}}};
 const first=new GraphDocument(graph,registry).change(g=>{
  const n=g.networks.get('pixel');n.connect(n.node('lo').port('output','out'),n.node('clamp').port('input','min'),policy);
  assert.equal(n.node('clamp').port('input','min').type,'float');assert.equal(n.node('clamp').port('input','max').type,'float');
  assert.equal(n.node('clamp').outputs[0].type,'vec3');
 });
 const second=new GraphDocument(first.after,registry).change(g=>{
  const n=g.networks.get('pixel');n.connect(n.node('hi').port('output','out'),n.node('clamp').port('input','max'),policy);
  assert.equal(n.node('clamp').port('input','min').type,'vec3');assert.equal(n.node('clamp').outputs[0].type,'vec3');
  assert.equal(n.edges.length,2);assert.equal(n.edges.find(e=>e.from.node.id==='lo').connection(policy).conversion,'convert');
  n.disconnectAll(n.edges);assert.equal(n.node('clamp').port('input','min').type,'vec3');
 });
 assert.equal(second.after.stages.pixel.nodes.find(n=>n.id==='clamp').params.type,'vec3');
});

test('unconnected range defaults stay correct across manual output type changes',()=>{
 for(const [key,bound]of [['clamp','max'],['smoothstep','edge1']]){
  const graph={schemaVersion:1,target:'top',declarations:[],stages:{pixel:{nodes:[node('op',key,{type:'float'})],edges:[]}}};
  const step=new GraphDocument(graph,registry).change(g=>{
   const n=g.networks.get('pixel').node('op');assert.equal(n.port('input',bound).default,1);
   n.configure({type:'vec4'});assert.deepEqual(n.port('input',bound).default,[1,1,1,1]);
  });assert.equal(step.after.stages.pixel.nodes[0].params.type,'vec4');
 }
});
