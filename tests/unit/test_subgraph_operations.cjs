const {test}=require('node:test'),assert=require('node:assert/strict');
const {GraphDocument,registry,createCompiler,createRegistry,ScopeReferences}=require('../../src/generated/grape_core.js');
const {sharedGraph,node}=require('../fixtures/shared_subgraphs.cjs');
const compiler=createCompiler(registry),plain=v=>JSON.parse(JSON.stringify(v));
const empty=()=>({format:'grape-graph',version:1,target:'top',declarations:[],subgraphs:[],stages:{pixel:{nodes:[],edges:[]}}});

test('create, instantiate and edit a new definition share one graph transaction and stable scope handles',()=>{
 const g=empty();let stale;
 const step=new GraphDocument(g,registry).change(m=>{
  const f=m.createSubgraph({id:'new_graph',name:'Subgraph 1',stage:'pixel'});
  const network=m.networks.get('pixel');network.instantiateSubgraph(f.id,'call');
  stale=m.networks.get('function:new_graph');assert.equal(m.networks.get(stale.id),stale);
  assert.equal(stale.node('input').outputs[0].type,'vec4');
  f.editInterface('inputs',{kind:'update',id:'value',patch:{name:'Color'}});
  assert.equal(network.node('call').inputs[0].key,'value');
 });
 assert.equal(g.subgraphs.length,0);assert.equal(step.after.subgraphs.length,1);
 assert.ok(step.changes.definitions.includes('new_graph'));assert.ok(step.changes.networks.some(n=>n.id==='function:new_graph'));
 assert.throws(()=>stale.create('illegal','sgrape.builtin.float'),/active transaction/);
 assert.deepEqual(new GraphDocument(JSON.parse(JSON.stringify(step.after)),registry).snapshot(),step.after);
});

test('grouping preserves conversion locations and deduplicates only identical source/type pairs',()=>{
 const g=empty(),d=g.stages.pixel;
 d.nodes=[node('source','float',{value:.5}),node('a','add',{type:'vec4'}),node('b','add',{type:'float'}),node('out','pixel_out'),node('extra','add',{type:'vec4'})];
 d.edges=[{from:['source','out'],to:['a','a']},{from:['source','out'],to:['a','b']},{from:['source','out'],to:['b','a']},{from:['a','out'],to:['out','color']},{from:['a','out'],to:['extra','a']},{from:['b','out'],to:['extra','b']}];
 d.nodes[1].inputValues={a:[.1,.2,.3,.4]};
 const step=new GraphDocument(g,registry).change(m=>m.networks.get('pixel').groupSubgraph(new Set(['a','b']),{id:'group',callId:'call',name:'Group',stage:'pixel'}));
 const f=step.after.subgraphs[0],outside=step.after.stages.pixel;
 assert.deepEqual(f.inputs.map(p=>p.type),['vec4','float']);assert.deepEqual(f.inputs[0].default,[.1,.2,.3,.4]);
 assert.equal(f.outputs.length,2);assert.equal(outside.edges.filter(e=>e.from[0]==='source').length,2);
 assert.equal(f.graph.edges.filter(e=>e.from[0]==='input'&&e.from[1]==='in1').length,2);
 assert.equal(outside.edges.filter(e=>e.from[0]==='call'&&e.from[1]==='out1').length,2);
 assert.equal(compiler.supports(step.after),true);assert.ok(compiler.compile(step.after,{reservedNames:[]}).pixel);
 assert.deepEqual(g,step.before);
});

test('grouping preserves nested references, scopes and data while avoiding boundary identity collisions',()=>{
 const g=sharedGraph();g.stages.pixel.nodes.push(node('input','float',{value:3}));
 g.structDefinitions=[{id:'shape',fields:[{type:'float['+ScopeReferences.token('pixel',['input','out'])+']'}]}];
 const historical=plain(g.structDefinitions);g.catalogSnapshot={structDefinitions:historical};
 const step=new GraphDocument(g,registry).change(m=>m.networks.get('pixel').groupSubgraph(new Set(['input','first']),{id:'outer',callId:'outer_call',name:'Outer',stage:'pixel'}));
 const f=step.after.subgraphs.find(f=>f.id==='outer');
 assert.equal(f.graph.nodes.filter(n=>n.id==='input').length,1);assert.ok(f.graph.nodes.some(n=>n.id==='input_1'));
 assert.ok(step.after.subgraphs.some(f=>f.id==='gain'));assert.match(step.after.structDefinitions[0].fields[0].type,new RegExp(ScopeReferences.token('fn_outer',['input','out'])));
 assert.deepEqual(step.after.catalogSnapshot.structDefinitions,historical);
});

test('last-call removal invalidates the removed scope before another mutation can use its handles',()=>{
 const g=sharedGraph();g.stages.pixel.nodes=g.stages.pixel.nodes.filter(n=>n.id!=='second');g.stages.pixel.edges=[];
 g.subgraphs=g.subgraphs.filter(f=>f.id==='gain');
 const step=new GraphDocument(g,registry).change(m=>{
  const child=m.networks.get('function:gain'),network=m.networks.get('pixel');
  network.remove(network.node('first'));
  assert.equal(m.networks.has('function:gain'),false);
  assert.throws(()=>child.create('bad','sgrape.builtin.float'),/no longer belongs/);
 });
 assert.equal(step.after.subgraphs.length,0);assert.ok(step.changes.networks.some(n=>n.id==='function:gain'&&n.removed.includes('mul')));
});

test('moving nodes into a child cannot revive their old parent handles or reuse a retired call identity',()=>{
 const g=empty();g.stages.pixel.nodes=[node('value','float',{value:1}),node('retired','float',{value:0})];
 new GraphDocument(g,registry).change(m=>{
  const parent=m.networks.get('pixel'),old=parent.node('value');parent.remove(parent.node('retired'));
  const options={id:'child',callId:'retired',name:'Child',stage:'pixel'};
  assert.throws(()=>parent.groupSubgraph(new Set(['value']),options),/Retired node ID/);
  assert.equal(m.document.subgraphs.length,0);
  parent.groupSubgraph(new Set(['value']),{...options,callId:'call'});
  assert.equal(old.data,undefined);
  assert.throws(()=>parent.create('value','sgrape.builtin.float'),/retired node ID/);
  assert.equal(m.networks.get('function:child').node('value').data.params.value,1);
 });
});

test('capacity, invalid selections and missing type descriptions fail without publishing partial definitions',()=>{
 const g=empty();g.stages.pixel.nodes=[node('a','float',{value:1}),node('out','pixel_out')];
 const model=new GraphDocument(g,registry),before=model.snapshot();
 assert.throws(()=>model.change(m=>m.networks.get('pixel').groupSubgraph(new Set(['out']),{id:'bad',callId:'call',name:'Bad',stage:'pixel'})),/cannot be grouped/);
 assert.throws(()=>model.change(m=>m.networks.get('pixel').groupSubgraph(new Set(['missing']),{id:'bad',callId:'call',name:'Bad',stage:'pixel'})),/selection/);
 assert.throws(()=>model.change(m=>{for(let i=0;i<65;i++)m.createSubgraph({id:'f'+i,name:'F',stage:'pixel'});}),/64/);
 assert.deepEqual(model.snapshot(),before);
});

test('structural creation follows module capabilities rather than built-in identity strings',()=>{
 const modules=registry.modules.map(m=>!m.structural?m:{...m,catalog:{...m.catalog,definition:{...m.catalog.definition,definitionUuid:'test.'+m.catalog.definition.key}},
  ...(m.reference?{reference:id=>({child:id}),referencedGraph:n=>n.params.child,supports:()=>false}: {})});
 const custom=createRegistry(modules),g=empty();
 const step=new GraphDocument(g,custom).change(m=>{
  m.createSubgraph({id:'custom',name:'Custom',stage:'pixel'});const n=m.networks.get('pixel').instantiateSubgraph('custom','call');
  assert.equal(n.data.nodeType,'test.function_call');assert.deepEqual(n.data.params,{child:'custom'});
  m.networks.get('pixel').remove(n);
 });
 assert.deepEqual(step.after.subgraphs,[]);
});

test('scope references preserve canonical tokens and skip snapshots, source metadata and code',()=>{
 const token=ScopeReferences.token('fn_child',['length','out']);
 assert.deepEqual(ScopeReferences.reference(token),{scope:'fn_child',source:['length','out']});
 assert.equal(ScopeReferences.reference('sg_extent_ff'),null);
 const data={type:'float['+token+']',source:{type:token},ui:{type:token},code:token,catalogSnapshot:{type:token}};
 ScopeReferences.walk(data,()=> 'replaced');assert.equal(data.type,'float[replaced]');
 assert.equal(data.source.type,token);assert.equal(data.catalogSnapshot.type,token);assert.equal(data.code,token);
});
