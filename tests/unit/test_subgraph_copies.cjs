const {test}=require('node:test'),assert=require('node:assert/strict');
const {GraphDocument,registry,createRegistry,ScopeReferences}=require('../../src/generated/wire_planning.js');
const {sharedGraph,node}=require('../fixtures/shared_subgraphs.cjs');
const copy=structuredClone;
const empty=()=>({schemaVersion:1,target:'top',declarations:[],functions:[],stages:{pixel:{nodes:[],edges:[]}}});
const call=(id,child)=>({id,definitionUuid:'sgrape.function.call',params:{functionId:child}});
const next=(...ids)=>()=>{assert.ok(ids.length,'Unexpected ID allocation');return ids.shift();};
const source=(id='source')=>({...copy(sharedGraph().functions[0]),id,scope:'library',source:{id,version:'v1'}});

test('batch insertion copies complete authored data and remaps both nested calls and scoped types',()=>{
 const g=empty(),child=source('child'),outer=source('outer');
 outer.graph.nodes=[call('nested','child')];outer.graph.edges=[];
 child.outputs[0].type='float['+ScopeReferences.token('fn_child',['mul','out'])+']';
 const original=copy([outer,child]);
 const step=new GraphDocument(g,registry).change(m=>{
  const handles=m.appendSubgraphs([outer,child],new Map([['child','renamed']]));
  assert.equal(handles[1].id,'renamed');
  assert.ok(m.networks.has('function:renamed'));
 });
 assert.deepEqual([outer,child],original);assert.deepEqual(g.functions,[]);
 const [parent,owned]=step.after.functions;
 assert.equal(parent.graph.nodes[0].params.functionId,'renamed');
 assert.equal(owned.outputs[0].type,'float['+ScopeReferences.token('fn_renamed',['mul','out'])+']');
 assert.deepEqual(owned.source,child.source);
 child.graph.nodes[0].params.changed=true;assert.equal(owned.graph.nodes[0].params.changed,undefined);
});

test('invalid bundles leave the active document unchanged even when a caller catches the error',()=>{
 new GraphDocument(empty(),registry).change(m=>{
  const before=m.snapshot(),bad=source();bad.graph.nodes.push(call('missing','absent'));
  assert.throws(()=>m.appendSubgraphs([bad]),/Missing nested/);assert.deepEqual(m.snapshot(),before);
  const recursive=source();recursive.graph.nodes.push(call('recursive',recursive.id));
  assert.throws(()=>m.appendSubgraphs([recursive]),/cycle/);assert.deepEqual(m.snapshot(),before);
  assert.throws(()=>m.appendSubgraphs([source(),source()]),/Duplicate/);assert.deepEqual(m.snapshot(),before);
  assert.throws(()=>m.appendSubgraphs(Array.from({length:65},(_,i)=>source('f'+i))),/64/);assert.deepEqual(m.snapshot(),before);
 });
});

test('source localization redirects shared and nested callers while preserving exact source snapshots',()=>{
 const g=empty(),child=source('child'),parent=source('parent');
 parent.graph.nodes=[call('nested','child')];parent.graph.edges=[];
 g.functions=[child,parent];g.stages.pixel.nodes=[call('a','parent'),call('b','parent')];
 const before=copy(g);let retired;
 const step=new GraphDocument(g,registry).change(m=>{
  retired=m.networks.get('function:child');const raw=retired.node('mul').data;
  const mapping=m.localizeSubgraph('child',next('local_child','local_parent'));
  assert.deepEqual([...mapping],[['child','local_child'],['parent','local_parent']]);
  assert.equal(m.networks.get('function:local_child').node('mul').data,raw);
  assert.throws(()=>retired.node('mul').update({name:'Bad'}),/no longer belongs/);
  m.subgraph('local_child').rename('Editable gain');
 });
 for(const f of before.functions)assert.deepEqual(step.after.functions.find(d=>d.id===f.id),f);
 assert.deepEqual(step.after.stages.pixel.nodes.map(n=>n.params.functionId),['local_parent','local_parent']);
 assert.equal(step.after.functions.find(f=>f.id==='local_parent').graph.nodes[0].params.functionId,'local_child');
 assert.equal(step.after.functions.find(f=>f.id==='local_child').name,'Editable gain');
 assert.ok(step.changes.definitions.includes('local_child'));
});

test('scope-only source dependencies localize together and metadata stays opaque',()=>{
 const g=empty(),child=source('child'),parent=source('parent');
 const token=ScopeReferences.token('fn_child',['mul','out']);parent.outputs[0].type='float['+token+']';
 parent.source.savedType=token;g.functions=[child,parent];g.typeDefinitions=[{id:'shape',type:'float['+token+']'}];
 const step=new GraphDocument(g,registry).change(m=>m.localizeSubgraph('child',next('local_child','local_parent')));
 const local=step.after.functions.find(f=>f.id==='local_parent');
 assert.equal(local.outputs[0].type,'float['+ScopeReferences.token('fn_local_child',['mul','out'])+']');
 assert.equal(local.origin.savedType,token);assert.deepEqual(step.after.functions.find(f=>f.id==='parent'),parent);
 assert.equal(step.after.typeDefinitions[0].type,'float['+ScopeReferences.token('fn_local_child',['mul','out'])+']');
});

test('independence copies only one instance; nested definitions, source and other instances remain shared',()=>{
 const g=empty(),child=source('child'),parent=source('parent');
 parent.name='A'.repeat(80);parent.graph.nodes=[call('nested','child')];parent.graph.edges=[];
 g.functions=[child,parent];g.stages.pixel.nodes=[call('a','parent'),call('b','parent')];
 const step=new GraphDocument(g,registry).change(m=>{
  const network=m.networks.get('pixel'),f=network.independentSubgraph(network.node('a'),next('solo'));
  assert.equal(f.id,'solo');assert.equal(f.data.name.length,80);
 });
 assert.deepEqual(step.after.functions.slice(0,2),g.functions);
 assert.deepEqual(step.after.stages.pixel.nodes.map(n=>n.params.functionId),['solo','parent']);
 assert.equal(step.after.functions[2].graph.nodes[0].params.functionId,'child');
 assert.deepEqual(step.after.functions[2].origin,parent.source);
});

test('ID allocation or module failure is atomic; a closed transaction cannot make source copies',()=>{
 const g=empty(),child=source();g.functions=[child];g.stages.pixel.nodes=[call('use',child.id)];let closed;
 new GraphDocument(g,registry).change(m=>{
  closed=m;const before=m.snapshot();
  assert.throws(()=>m.localizeSubgraph(child.id,next(child.id)),/duplicate/);
  assert.deepEqual(m.snapshot(),before);
  const network=m.networks.get('pixel');
  assert.throws(()=>network.independentSubgraph(network.node('use'),next('invalid id')),/Invalid/);
  assert.deepEqual(m.snapshot(),before);
 });
 assert.throws(()=>closed.localizeSubgraph(child.id,next('closed')),/active transaction/);
 assert.throws(()=>closed.appendSubgraphs([source('closed')]),/active transaction/);
 const custom=createRegistry(registry.modules.map(m=>m.reference?{...m,reference:()=>{throw Error('Module refused');}}:m));
 new GraphDocument(g,custom).change(m=>{
  const before=m.snapshot();assert.throws(()=>m.localizeSubgraph(child.id,next('local')),/Module refused/);
  assert.deepEqual(m.snapshot(),before);
 });
});

test('custom structural identity and reference fields support copies without central dispatch',()=>{
 const modules=registry.modules.map(m=>m.reference?{...m,catalog:{...m.catalog,definition:{...m.catalog.definition,definitionUuid:'example.call'}},
  reference:id=>({child:id}),referencedGraph:n=>n.params.child,supports:()=>false}:m);
 const custom=createRegistry(modules),g=empty();g.functions=[source()];
 g.stages.pixel.nodes=[{id:'use',definitionUuid:'example.call',params:{child:'source',label:'keep'}}];
 const step=new GraphDocument(g,custom).change(m=>{
  m.localizeSubgraph('source',next('local'));
  const n=m.networks.get('pixel');n.independentSubgraph(n.node('use'),next('solo'));
 });
 assert.deepEqual(step.after.stages.pixel.nodes[0].params,{child:'solo',label:'keep'});
 assert.deepEqual(step.after.functions.find(f=>f.id==='source'),g.functions[0]);
});
