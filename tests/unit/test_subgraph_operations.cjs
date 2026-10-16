const {test}=require('node:test'),assert=require('node:assert/strict');
const {GraphDocument,registry,createCompiler,createRegistry,ScopeReferences}=require('../../src/generated/grape_core.js');
const {sharedGraph,node}=require('../fixtures/shared_subgraphs.cjs');
const compiler=createCompiler(registry),plain=v=>JSON.parse(JSON.stringify(v));
const empty=()=>({format:'grape-graph',version:1,target:'top',declarations:[],subgraphs:[],stages:{pixel:{nodes:[],edges:[]}}});

test('create, instantiate and edit a new definition share one graph transaction and stable scope handles',()=>{
 const g=empty();let stale;
 const step=new GraphDocument(g,registry).change(m=>{
  const f=m.createSubgraph({id:'new_graph',title:'Subgraph 1',stage:'pixel'});
  const network=m.networks.get('pixel');network.instantiateSubgraph(f.id,'instance');
  stale=m.networks.get('subgraph:new_graph');assert.equal(m.networks.get(stale.id),stale);
  assert.equal(stale.node('input').outputs[0].type,'vec4');
  // A port's identity is generated, never a number; its label is what people see (§3.3). 接口身分產生式、不是序號；標籤給人看。
  const id=f.data.inputs[0].id;assert.match(id,/^p[0-9a-f]{24}$/);assert.equal(f.data.inputs[0].label,'in1');
  f.editInterface('inputs',{kind:'update',id,patch:{label:'Color'}});
  assert.equal(network.node('instance').inputs[0].key,id);assert.equal(f.data.inputs[0].label,'Color');
 });
 assert.equal(g.subgraphs.length,0);assert.equal(step.after.subgraphs.length,1);
 assert.ok(step.changes.definitions.includes('new_graph'));assert.ok(step.changes.networks.some(n=>n.id==='subgraph:new_graph'));
 assert.throws(()=>stale.create('illegal','sgrape.builtin.float'),/active transaction/);
 assert.deepEqual(new GraphDocument(JSON.parse(JSON.stringify(step.after)),registry).snapshot(),step.after);
});

test('a subgraph from a selection preserves conversion locations and deduplicates only identical source/type pairs',()=>{
 const g=empty(),d=g.stages.pixel;
 d.nodes=[node('source','float',{value:.5}),node('a','add',{type:'vec4'}),node('b','add',{type:'float'}),node('out','pixel_out'),node('extra','add',{type:'vec4'})];
 d.edges=[{from:['source','out'],to:['a','a']},{from:['source','out'],to:['a','b']},{from:['source','out'],to:['b','a']},{from:['a','out'],to:['out','color']},{from:['a','out'],to:['extra','a']},{from:['b','out'],to:['extra','b']}];
 d.nodes[1].inputValues={a:[.1,.2,.3,.4]};
 const step=new GraphDocument(g,registry).change(m=>m.networks.get('pixel').subgraphFromSelection(new Set(['a','b']),{id:'group',instanceId:'instance',title:'Group',stage:'pixel'}));
 const f=step.after.subgraphs[0],outside=step.after.stages.pixel;
 assert.deepEqual(f.inputs.map(p=>p.type),['vec4','float']);assert.deepEqual(f.inputs[0].default,[.1,.2,.3,.4]);
 assert.equal(f.outputs.length,2);assert.equal(outside.edges.filter(e=>e.from[0]==='source').length,2);
 assert.equal(f.graph.edges.filter(e=>e.from[0]==='input'&&e.from[1]===f.inputs[0].id).length,2);
 assert.equal(outside.edges.filter(e=>e.from[0]==='instance'&&e.from[1]===f.outputs[0].id).length,2);
 // Labels come from the peer port; a repeat on the same side gets a number (§3.3). 標籤取對端接孔名，同邊重複加編號。
 assert.deepEqual(f.inputs.map(p=>p.label),['a','a_1']);assert.deepEqual(f.outputs.map(p=>p.label),['out','out_1']);
 assert.equal(new Set([...f.inputs,...f.outputs].map(p=>p.id)).size,4);
 assert.equal(compiler.supports(step.after),true);assert.ok(compiler.compile(step.after,{reservedNames:[]}).pixel);
 assert.deepEqual(g,step.before);
});

test('a subgraph from a selection preserves nested references, scopes and data while avoiding boundary identity collisions',()=>{
 const g=sharedGraph();g.stages.pixel.nodes.push(node('input','float',{value:3}));
 g.structDefinitions=[{id:'shape',fields:[{type:'float['+ScopeReferences.token('pixel',['input','out'])+']'}]}];
 const historical=plain(g.structDefinitions);g.catalogSnapshot={structDefinitions:historical};
 const step=new GraphDocument(g,registry).change(m=>m.networks.get('pixel').subgraphFromSelection(new Set(['input','first']),{id:'outer',instanceId:'outer_call',title:'Outer',stage:'pixel'}));
 const f=step.after.subgraphs.find(f=>f.id==='outer');
 assert.equal(f.graph.nodes.filter(n=>n.id==='input').length,1);assert.ok(f.graph.nodes.some(n=>n.id==='input_1'));
 assert.ok(step.after.subgraphs.some(f=>f.id==='gain'));assert.match(step.after.structDefinitions[0].fields[0].type,new RegExp(ScopeReferences.token('fn_outer',['input','out'])));
 assert.deepEqual(step.after.catalogSnapshot.structDefinitions,historical);
});

test('removing the last instance keeps a local definition and its network; a collectible one goes and its handles are invalidated',()=>{
 const g=sharedGraph();g.stages.pixel.nodes=g.stages.pixel.nodes.filter(n=>n.id!=='second');g.stages.pixel.edges=[];
 g.subgraphs=g.subgraphs.filter(f=>f.id==='gain');
 const kept=new GraphDocument(g,registry).change(m=>{
  const child=m.networks.get('subgraph:gain'),network=m.networks.get('pixel');
  network.remove(network.node('first'));
  assert.equal(m.networks.has('subgraph:gain'),true,'a local definition stays with zero uses (§3.9)');
  child.create('more','sgrape.builtin.float');
 });
 assert.equal(kept.after.subgraphs.length,1);assert.ok(kept.after.subgraphs[0].graph.nodes.some(n=>n.id==='more'));
 const step=new GraphDocument(g,registry).change(m=>{
  const child=m.networks.get('subgraph:gain'),network=m.networks.get('pixel');
  network.removeAll([network.node('first')],new Set(['gain']));
  assert.equal(m.networks.has('subgraph:gain'),false);
  assert.throws(()=>child.create('bad','sgrape.builtin.float'),/no longer belongs/);
 });
 assert.equal(step.after.subgraphs.length,0);assert.ok(step.changes.networks.some(n=>n.id==='subgraph:gain'&&n.removed.includes('mul')));
});

test('moving nodes into a child cannot revive their old parent handles or reuse a retired instance identity',()=>{
 const g=empty();g.stages.pixel.nodes=[node('value','float',{value:1}),node('retired','float',{value:0})];
 new GraphDocument(g,registry).change(m=>{
  const parent=m.networks.get('pixel'),old=parent.node('value');parent.remove(parent.node('retired'));
  const options={id:'child',instanceId:'retired',title:'Child',stage:'pixel'};
  assert.throws(()=>parent.subgraphFromSelection(new Set(['value']),options),/Retired node ID/);
  assert.equal(m.document.subgraphs.length,0);
  parent.subgraphFromSelection(new Set(['value']),{...options,instanceId:'instance'});
  assert.equal(old.data,undefined);
  assert.throws(()=>parent.create('value','sgrape.builtin.float'),/retired node ID/);
  assert.equal(m.networks.get('subgraph:child').node('value').data.params.value,1);
 });
});

test('capacity, invalid selections and missing type descriptions fail without publishing partial definitions',()=>{
 const g=empty();g.stages.pixel.nodes=[node('a','float',{value:1}),node('out','pixel_out')];
 const model=new GraphDocument(g,registry),before=model.snapshot();
 assert.throws(()=>model.change(m=>m.networks.get('pixel').subgraphFromSelection(new Set(['out']),{id:'bad',instanceId:'instance',title:'Bad',stage:'pixel'})),/cannot be made into a subgraph/);
 assert.throws(()=>model.change(m=>m.networks.get('pixel').subgraphFromSelection(new Set(['missing']),{id:'bad',instanceId:'instance',title:'Bad',stage:'pixel'})),/selection/);
 assert.throws(()=>model.change(m=>{for(let i=0;i<65;i++)m.createSubgraph({id:'f'+i,title:'F',stage:'pixel'});}),/64/);
 assert.deepEqual(model.snapshot(),before);
});

test('structural creation follows module capabilities rather than built-in identity strings',()=>{
 const modules=registry.modules.map(m=>!m.structural?m:{...m,catalog:{...m.catalog,definition:{...m.catalog.definition,nodeType:'test.'+m.catalog.definition.key}},
  ...(m.reference?{reference:id=>({child:id}),referencedGraph:n=>n.params.child,supports:()=>false}: {})});
 const custom=createRegistry(modules),g=empty();
 const step=new GraphDocument(g,custom).change(m=>{
  m.createSubgraph({id:'custom',title:'Custom',stage:'pixel'});const n=m.networks.get('pixel').instantiateSubgraph('custom','instance');
  assert.equal(n.data.nodeType,'test.subgraph_instance');assert.deepEqual(n.data.params,{child:'custom'});
  m.networks.get('pixel').remove(n);
 });
 assert.equal(step.after.subgraphs.length,1,'a local definition stays when its last instance goes');
});

test('scope references preserve canonical tokens and skip snapshots, source metadata and code',()=>{
 const token=ScopeReferences.token('fn_child',['length','out']);
 assert.deepEqual(ScopeReferences.reference(token),{scope:'fn_child',source:['length','out']});
 assert.equal(ScopeReferences.reference('sg_extent_ff'),null);
 const data={type:'float['+token+']',source:{type:token},ui:{type:token},code:token,catalogSnapshot:{type:token}};
 ScopeReferences.walk(data,()=> 'replaced');assert.equal(data.type,'float[replaced]');
 assert.equal(data.source.type,token);assert.equal(data.catalogSnapshot.type,token);assert.equal(data.code,token);
});

// Q46 (Refactor.61): where a subgraph can be used comes from its content; the graph never stores it.
// 子圖能用在哪裡由內容推算，圖裡不存。
test('a subgraph keeps no stages or targets; definitions brought in lose them',()=>{
 const g=empty();
 const step=new GraphDocument(g,registry).change(m=>{m.createSubgraph({id:'made',title:'Made'});});
 assert.equal('stages' in step.after.subgraphs[0],false);assert.equal('targets' in step.after.subgraphs[0],false);
 const definition={...plain(step.after.subgraphs[0]),id:'brought',stages:['pixel'],targets:['top']};
 const next=new GraphDocument(step.after,registry).change(m=>m.appendSubgraphs([definition]));
 const brought=next.after.subgraphs.find(f=>f.id==='brought');
 assert.equal('stages' in brought,false);assert.equal('targets' in brought,false);
 // Stored values are never taken, even odd ones: the content decides (Q46). 存著的值一律不採用，怪的也一樣：由內容決定。
 const odd=new GraphDocument(step.after,registry).change(m=>m.appendSubgraphs([{...definition,id:'odd',stages:['geometry'],targets:7}]));
 assert.equal('stages' in odd.after.subgraphs.find(f=>f.id==='odd'),false);
});

test('an instance whose subgraph content cannot run in this stage is a misplaced ghost and back once it fits',()=>{
 const G=require('../../src/generated/grape_core.js');
 // The same modules, with Multiply allowed only in Vertex. 同一組模組，Multiply 只允許 Vertex。
 const custom=createRegistry(registry.modules.map(m=>m.catalog.definition.key!=='multiply'?m:{...m,catalog:{...m.catalog,definition:{...m.catalog.definition,stages:['vertex']}}}));
 const g=sharedGraph(),doc=new GraphDocument(g,custom);
 assert.deepEqual(plain(G.subgraphStages(g,'gain',custom)),['vertex']);
 assert.deepEqual(plain(G.subgraphStages(g,'wrapper',custom)),['vertex'],'nested subgraphs are followed');
 const ghosts=G.ghostsOf(doc.networks.get('pixel'),G.values.policy);
 assert.equal(ghosts.nodes.get('first'),'misplaced');assert.equal(ghosts.nodes.get('second'),'misplaced');
 // Ghosts never refuse the graph (Q37 1-1): the misplaced instances are left out, the rest compiles. Ghost 不拒絕整張圖：放錯的實例跳過、其餘照產。
 assert.equal(createCompiler(custom).supports(g),true);assert.doesNotThrow(()=>createCompiler(custom).compile(g));
 assert.deepEqual(plain(G.subgraphStages(g,'gain',registry)),['vertex','pixel']);
 assert.equal(G.ghostsOf(new GraphDocument(g,registry).networks.get('pixel'),G.values.policy).nodes.size,0,'with the content fitting again, nothing is a ghost');
});

// Opaque ports (basic design §3.4, amendments A1/B5; Refactor.109): a texture goes through a subgraph on either side; an
// unconnected sampler2D port passes nothing on, so Texture 2D's own rule applies (opaque black).
// opaque 接口：貼圖兩邊都能穿過子圖；沒接的 sampler2D 接口把「沒有」往下傳，Texture 2D 自己的規則接手（不透明黑）。
const bootstrap=JSON.parse(require('node:fs').readFileSync(require('node:path').join(__dirname,'../../src/generated/editor-bootstrap.json'),'utf8'));
const {edge}=require('../fixtures/shared_subgraphs.cjs');
const G=require('../../src/generated/grape_core.js'),policy=G.values.policy;
const sampler=()=>({id:'tex',title:'Tex',inputs:[{id:'img',label:'image',type:'sampler2D'}],outputs:[{id:'rgba',label:'rgba',type:'vec4',default:[0,0,0,1]}],
 graph:{nodes:[node('in','subgraph_input'),node('sample','texture_sample'),node('out','subgraph_output')],edges:[edge('in','sample','img','sampler'),edge('sample','out','out','rgba')]}});
const through=()=>({id:'pass',title:'Pass',inputs:[{id:'img',label:'image',type:'sampler2D'}],outputs:[{id:'tex',label:'texture',type:'sampler2D'}],
 graph:{nodes:[node('in','subgraph_input'),node('out','subgraph_output')],edges:[edge('in','out','img','tex')]}});
function withInstance(definition,wired){
 const doc=new GraphDocument(plain(bootstrap.defaultDocument.graph),registry);
 return doc.change(c=>{
  c.appendSubgraphs([definition]);
  const net=c.networks.get('pixel'),output=net.nodes.find(n=>n.data.nodeType==='sgrape.builtin.pixel_out');
  net.instantiateSubgraph(definition.id,'instance',{});
  if(wired){net.insert({id:'ref',nodeType:'sgrape.builtin.declaration',params:{declarationId:'input1'},ui:{}});
   net.connect(net.node('ref').port('output','out'),net.node('instance').port('input','img'),policy);}
  if(definition.id==='pass'){net.insert({id:'sample',nodeType:'sgrape.builtin.texture_sample',params:{},ui:{}});
   net.connect(net.node('instance').port('output','tex'),net.node('sample').port('input','sampler'),policy);
   net.connect(net.node('sample').outputs[0],output.port('input','color'),policy);}
  else net.connect(net.node('instance').port('output','rgba'),output.port('input','color'),policy);
 }).after;
}
test('a sampler2D input port carries a texture into a subgraph; unconnected, the Texture 2D inside is opaque black',()=>{
 const wired=withInstance(sampler(),true);assert.equal(compiler.supports(wired),true);
 assert.match(compiler.compile(wired,{reservedNames:[]}).pixel,/texture\(sTD2DInputs\[0\], vUV\.st\)/);
 const bare=withInstance(sampler(),false);assert.equal(compiler.supports(bare),true);
 const pixel=compiler.compile(bare,{reservedNames:[]}).pixel;
 assert.match(pixel,/vec4\(0\.0, 0\.0, 0\.0, 1\.0\)/);assert.doesNotMatch(pixel,/texture\(/);
});
test('a sampler2D output port carries a texture out of a subgraph; unconnected inside, the Texture 2D outside is opaque black',()=>{
 const wired=withInstance(through(),true);
 assert.match(compiler.compile(wired,{reservedNames:[]}).pixel,/texture\(sTD2DInputs\[0\], vUV\.st\)/);
 const pixel=compiler.compile(withInstance(through(),false),{reservedNames:[]}).pixel;
 assert.match(pixel,/vec4\(0\.0, 0\.0, 0\.0, 1\.0\)/);assert.doesNotMatch(pixel,/texture\(/);
});
test('switching a port to an opaque type drops its default and instance values; back to a value type gives zeros',()=>{
 const g=sharedGraph();g.stages.pixel.nodes[1].inputValues={value:7};
 const step=new GraphDocument(g,registry).change(m=>m.subgraph('gain').editInterface('inputs',{kind:'update',id:'value',patch:{type:'sampler2D'}}));
 assert.equal('default' in step.after.subgraphs[0].inputs[0],false);assert.deepEqual(plain(step.after.stages.pixel.nodes[1].inputValues),{});
 assert.throws(()=>new GraphDocument(g,registry).change(m=>m.subgraph('gain').editInterface('inputs',{kind:'update',id:'value',patch:{type:'sampler2D',default:1}})),/port/);
 const back=new GraphDocument(step.after,registry).change(m=>m.subgraph('gain').editInterface('inputs',{kind:'update',id:'value',patch:{type:'vec2'}}));
 assert.deepEqual(plain(back.after.subgraphs[0].inputs[0].default),[0,0]);
});
test('port identities are generated and never reused: removing a middle port and adding one cannot collide (§4 row 6)',()=>{
 const g=sharedGraph();
 const step=new GraphDocument(g,registry).change(m=>{
  const f=m.subgraph('gain'),taken=()=>new Set(f.data.inputs.map(p=>p.id));
  const a=G.newPortId(taken());f.editInterface('inputs',{kind:'add',port:{id:a,label:'a',type:'float',default:0}});
  const b=G.newPortId(taken());f.editInterface('inputs',{kind:'add',port:{id:b,label:'b',type:'float',default:0}});
  f.editInterface('inputs',{kind:'remove',id:a});
  const c=G.newPortId(taken());f.editInterface('inputs',{kind:'add',port:{id:c,label:'c',type:'float',default:0}});
  assert.equal(new Set([a,b,c]).size,3);assert.match(c,/^p[0-9a-f]{24}$/);
 });
 assert.deepEqual(step.after.subgraphs[0].inputs.map(p=>p.label),['value','b','c']);
});

// A subgraph must not reach itself through its instances (Refactor.111; legacy clipboard.cycle): the gate refuses the edit that would make
// the cycle; a graph opened with one stays editable. 子圖不能經由實例回到自己（R.111；照舊產品）：造成循環的修改被關卡拒絕；開圖時已有的照樣能編。
test('placing an instance that would make a subgraph instance itself is refused as a whole; an existing cycle does not block other edits',()=>{
 const g=sharedGraph(),doc=new GraphDocument(g,registry);
 assert.equal(G.subgraphCycle(g,registry),null);
 const before=doc.snapshot();
 assert.throws(()=>doc.change(m=>m.networks.get('subgraph:gain').instantiateSubgraph('wrapper','loop')),e=>e.code==='subgraph.cycle'&&!!e.subgraphId);
 assert.deepEqual(plain(doc.snapshot()),plain(before));
 assert.throws(()=>doc.change(m=>m.networks.get('subgraph:gain').instantiateSubgraph('gain','self')),e=>e.code==='subgraph.cycle');
 const cyclic=sharedGraph();cyclic.subgraphs[0].graph.nodes.push(node('loop','subgraph_instance',{subgraphId:'wrapper'}));
 assert.equal(G.subgraphCycle(cyclic,registry)!==null,true);
 const repaired=new GraphDocument(cyclic,registry).change(m=>{m.networks.get('pixel').create('x','sgrape.builtin.float');});
 assert.ok(repaired.after.stages.pixel.nodes.some(n=>n.id==='x'),'an unrelated edit still goes through');
});

// TECH-8 (technical review R109–R112): the gate compares the (parent, child) instance edges, not a whole-document yes/no.
// 關卡比的是父→子實例邊，不是整份文件有沒有循環。
test('an existing cycle does not let a new one in; repairing it, also while adding edges that close none, goes through',()=>{
 const fixture=cyclic=>{const raw=sharedGraph(),fresh=plain(raw.subgraphs[0]);fresh.id='fresh';fresh.name='Fresh';raw.subgraphs.push(fresh);
  if(cyclic)raw.subgraphs[0].graph.nodes.push(node('oldCycle','subgraph_instance',{subgraphId:'gain'}));return raw;};
 const selfInstance=m=>m.networks.get('subgraph:fresh').instantiateSubgraph('fresh','newCycle');
 assert.throws(()=>new GraphDocument(fixture(false),registry).change(selfInstance),e=>e.code==='subgraph.cycle');
 const doc=new GraphDocument(fixture(true),registry),before=plain(doc.snapshot());
 assert.throws(()=>doc.change(selfInstance),e=>e.code==='subgraph.cycle'&&e.subgraphId==='fresh','a new cycle is refused next to an old one');
 assert.deepEqual(plain(doc.snapshot()),before,'nothing is written');
 // A second instance along an old cycle's edge adds no new edge: editing the existing cycle stays possible. 沿舊循環的邊再放一個實例：沒有新邊，照樣能編。
 const again=doc.change(m=>m.networks.get('subgraph:gain').instantiateSubgraph('gain','oldCycle2'));
 assert.ok(again.after.subgraphs[0].graph.nodes.some(n=>n.id==='oldCycle2'));
 // One edit removes the old cycle and adds an edge that closes none. 一筆修改拆掉舊循環、加一條不成環的邊。
 const repaired=doc.change(m=>{const net=m.networks.get('subgraph:gain');net.remove(net.node('oldCycle'));m.networks.get('subgraph:fresh').instantiateSubgraph('gain','toGain');});
 assert.equal(G.subgraphCycle(repaired.after,registry),null);
});

// Selection to subgraph carries complete groups and leaves partial ones outside (amendment A8). 從選取建立帶完整群組，部分群組留在外面（A8）。
test('a subgraph from a selection takes the groups whose members all move, and leaves a partial group with its remaining members',()=>{
 const g=empty(),d=g.stages.pixel;
 d.nodes=[node('a','float',{value:1}),node('b','float',{value:2}),node('c','float',{value:3}),node('out','pixel_out')];
 d.ui={groups:[{id:'g1',name:'Whole',nodes:['a','b']},{id:'g2',name:'Part',nodes:['b','c']}]};
 const step=new GraphDocument(g,registry).change(m=>m.networks.get('pixel').subgraphFromSelection(new Set(['a','b']),{id:'sub',instanceId:'instance',title:'Sub',stage:'pixel'}));
 assert.deepEqual(plain(G.groups.groupsOf(step.after.subgraphs[0].graph)).map(x=>[x.name,x.nodes]),[['Whole',['a','b']]]);
 assert.deepEqual(plain(G.groups.groupsOf(step.after.stages.pixel)).map(x=>[x.name,x.nodes]),[['Part',['c']]]);
});
