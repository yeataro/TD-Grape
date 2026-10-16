// Bringing definitions into a graph and Make Single User (basic design 2026-10-14 §3.10, §3.13; Refactor.109). There is no
// read-only copy and no localization in this version: every definition in a graph is local (amendment 2 B7).
// 把定義帶進圖與設為唯一。這一版沒有唯讀副本、沒有轉為本地：圖裡每份定義都是本地。
const {test}=require('node:test'),assert=require('node:assert/strict');
const {GraphDocument,registry,createRegistry,ScopeReferences}=require('../../src/generated/grape_core.js');
const {sharedGraph,node}=require('../fixtures/shared_subgraphs.cjs');
const copy=structuredClone;
const empty=()=>({format:'grape-graph',version:1,target:'top',declarations:[],subgraphs:[],stages:{pixel:{nodes:[],edges:[]}}});
const instance=(id,child)=>({id,nodeType:'sgrape.builtin.subgraph_instance',params:{subgraphId:child}});
const next=(...ids)=>()=>{assert.ok(ids.length,'Unexpected ID allocation');return ids.shift();};
const source=(id='source')=>({...copy(sharedGraph().subgraphs[0]),id});
// A definition with its two boundaries (structure.ts: exactly one Input and one Output). 帶兩個邊界節點的定義。
const definition=(id,nodes=[])=>({...source(id),graph:{nodes:[node('in','subgraph_input'),...nodes,node('out','subgraph_output')],edges:[]}});

test('batch insertion copies complete authored data and remaps both nested instances and scoped types',()=>{
 const g=empty(),child=source('child'),outer=definition('outer',[instance('nested','child')]);
 child.outputs[0].type='float['+ScopeReferences.token('fn_child',['mul','out'])+']';
 const original=copy([outer,child]);
 const step=new GraphDocument(g,registry).change(m=>{
  const handles=m.appendSubgraphs([outer,child],new Map([['child','renamed']]));
  assert.equal(handles[1].id,'renamed');
  assert.ok(m.networks.has('subgraph:renamed'));
 });
 assert.deepEqual([outer,child],original);assert.deepEqual(g.subgraphs,[]);
 const [parent,owned]=step.after.subgraphs;
 assert.equal(parent.graph.nodes[1].params.subgraphId,'renamed');
 assert.equal(owned.outputs[0].type,'float['+ScopeReferences.token('fn_renamed',['mul','out'])+']');
 child.graph.nodes[0].params.changed=true;assert.equal(owned.graph.nodes[0].params.changed,undefined);
});

test('invalid bundles leave the active document unchanged even when a caller catches the error',()=>{
 new GraphDocument(empty(),registry).change(m=>{
  const before=m.snapshot(),bad=source();bad.graph.nodes.push(instance('missing','absent'));
  assert.throws(()=>m.appendSubgraphs([bad]),/Missing nested/);assert.deepEqual(m.snapshot(),before);
  const recursive=source();recursive.graph.nodes.push(instance('recursive',recursive.id));
  assert.throws(()=>m.appendSubgraphs([recursive]),/cycle/);assert.deepEqual(m.snapshot(),before);
  assert.throws(()=>m.appendSubgraphs([source(),source()]),/Duplicate/);assert.deepEqual(m.snapshot(),before);
  assert.throws(()=>m.appendSubgraphs(Array.from({length:65},(_,i)=>source('f'+i))),/64/);assert.deepEqual(m.snapshot(),before);
 });
});

// `libraryId` is defined by the Library round; until then a definition carrying it is refused as a whole (amendment 2 B7).
// libraryId 到 Library 那一輪才定義；之前帶著它的定義整份拒絕。
test('a definition from a Library (libraryId) is refused as a whole, and nothing of its batch is written',()=>{
 new GraphDocument(empty(),registry).change(m=>{
  const before=m.snapshot();
  assert.throws(()=>m.appendSubgraphs([source('plain'),{...source('lib'),libraryId:'0f3c'}]),error=>/Library/.test(error.message)&&error.code==='subgraph.library');
  assert.deepEqual(m.snapshot(),before);
 });
});

test('Make Single User copies only one instance, named by the one naming rule; nested definitions and other instances stay shared',()=>{
 const g=empty(),child=source('child'),parent=definition('parent',[instance('nested','child')]);
 parent.title='A'.repeat(80);
 g.subgraphs=[child,parent];g.stages.pixel.nodes=[instance('a','parent'),instance('b','parent')];
 const step=new GraphDocument(g,registry).change(m=>{
  const network=m.networks.get('pixel'),f=network.independentSubgraph(network.node('a'),next('solo'));
  assert.equal(f.id,'solo');assert.equal(f.data.title.length,80);assert.match(f.data.title,/_1$/);
 });
 assert.deepEqual(step.after.subgraphs.slice(0,2),g.subgraphs);
 assert.deepEqual(step.after.stages.pixel.nodes.map(n=>n.params.subgraphId),['solo','parent']);
 assert.equal(step.after.subgraphs[2].graph.nodes[1].params.subgraphId,'child');
 // A short name takes the next free number, like a node (node_names.ts); no " Copy". 短名稱和節點一樣取下一個沒人用的編號，不加 Copy。
 const short=empty();short.subgraphs=[definition('wrap'),{...definition('taken'),title:'Wrap_1'}];short.subgraphs[0].title='Wrap';
 short.stages.pixel.nodes=[instance('a','wrap')];
 const named=new GraphDocument(short,registry).change(m=>{const n=m.networks.get('pixel');n.independentSubgraph(n.node('a'),next('solo'));});
 assert.equal(named.after.subgraphs[2].title,'Wrap_2');
});

test('ID allocation or module failure is atomic; a closed transaction cannot add definitions',()=>{
 const g=empty(),child=source();g.subgraphs=[child];g.stages.pixel.nodes=[instance('use',child.id)];let closed;
 new GraphDocument(g,registry).change(m=>{
  closed=m;const before=m.snapshot(),network=m.networks.get('pixel');
  assert.throws(()=>network.independentSubgraph(network.node('use'),next('invalid id')),/Invalid/);
  assert.deepEqual(m.snapshot(),before);
  assert.throws(()=>network.independentSubgraph(network.node('use'),next(child.id)),/duplicate/);
  assert.deepEqual(m.snapshot(),before);
 });
 assert.throws(()=>closed.appendSubgraphs([source('closed')]),/active transaction/);
 const custom=createRegistry(registry.modules.map(m=>m.reference?{...m,reference:()=>{throw Error('Module refused');}}:m));
 new GraphDocument(g,custom).change(m=>{
  const before=m.snapshot(),network=m.networks.get('pixel');
  assert.throws(()=>network.independentSubgraph(network.node('use'),next('solo')),/Module refused/);
  assert.deepEqual(m.snapshot(),before);
 });
});

test('custom structural identity and reference fields support copies without central dispatch',()=>{
 const modules=registry.modules.map(m=>m.reference?{...m,catalog:{...m.catalog,definition:{...m.catalog.definition,nodeType:'example.call'}},
  reference:id=>({child:id}),referencedGraph:n=>n.params.child,supports:()=>false}:m);
 const custom=createRegistry(modules),g=empty();g.subgraphs=[source()];
 g.stages.pixel.nodes=[{id:'use',nodeType:'example.call',params:{child:'source',label:'keep'}}];
 const step=new GraphDocument(g,custom).change(m=>{const n=m.networks.get('pixel');n.independentSubgraph(n.node('use'),next('solo'));});
 assert.deepEqual(step.after.stages.pixel.nodes[0].params,{child:'solo',label:'keep'});
 assert.deepEqual(step.after.subgraphs[0],g.subgraphs[0]);
});
