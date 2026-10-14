const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const c=vm.createContext({});vm.runInContext(fs.readFileSync(require.resolve('../../src/generated/grape_core.js'),'utf8'),c);
const {GraphDocument,registry,changesBetween}=c.GrapeGraph;
const {sharedGraph,port,node}=require('../fixtures/shared_subgraphs.cjs');
const plain=v=>JSON.parse(JSON.stringify(v));
const doc=g=>new GraphDocument(g,registry);

test('module-owned subgraph ports resolve in distinct network scopes with identical local IDs',()=>{
 const g=doc(sharedGraph());
 assert.deepEqual(plain(g.networks.get('pixel').node('first').interface.types()),{inputs:{value:'float'},outputs:{result:'float'}});
 assert.deepEqual(plain(g.networks.get('subgraph:gain').node('in').interface.types()),{inputs:{},outputs:{value:'float'}});
 assert.deepEqual(plain(g.networks.get('subgraph:wrapper').node('out').interface.types()),{inputs:{result:'float'},outputs:{}});
 assert.notEqual(g.networks.get('subgraph:gain').node('in'),g.networks.get('subgraph:wrapper').node('in'));
});
test('shared interface changes notify direct instances and boundaries, without rewriting their fixed neighbors',()=>{
 const g=sharedGraph();g.stages.other={nodes:[node('unrelated','float',{value:8})],edges:[]};
 const step=doc(g).change(m=>m.subgraph('gain').editInterface('inputs',{kind:'update',id:'value',patch:{label:'Amount',type:'vec3'}}));
 assert.deepEqual(plain(step.changes.global),[]);assert.deepEqual(plain(step.changes.definitions),['gain']);
 assert.deepEqual(plain(step.changes.networks.map(n=>n.id)),['pixel','subgraph:gain','subgraph:wrapper']);
 assert.deepEqual(plain(step.changes.networks.find(n=>n.id==='pixel').nodes.map(n=>n.id)),['first']);
 assert.equal(doc(step.after).networks.get('subgraph:gain').node('mul').outputs[0].type,'float');
 assert.equal(doc(step.after).networks.get('subgraph:wrapper').node('inner').inputs[0].type,'vec3');
 assert.deepEqual(plain(step.after.subgraphs[0].inputs[0].default),[1,1,1]);
 assert.deepEqual(plain(step.after.stages.pixel.edges),plain(step.before.stages.pixel.edges));
});
test('port removal is one transaction across nested instances; Undo restores exact defaults and incident edges',()=>{
 const g=sharedGraph();g.stages.pixel.nodes[1].inputValues={value:7};g.subgraphs[1].graph.nodes[1].inputValues={value:4};
 const step=doc(g).change(m=>m.subgraph('gain').editInterface('inputs',{kind:'remove',id:'value'}));
 assert.equal(step.after.stages.pixel.edges.length,4);assert.equal(step.after.subgraphs[0].graph.edges.length,1);assert.equal(step.after.subgraphs[1].graph.edges.length,1);
 assert.deepEqual(plain(step.after.stages.pixel.nodes[1].inputValues),{});
 assert.equal(doc(step.before).networks.get('pixel').node('first').inputs[0].type,'float');
 assert.equal(doc(JSON.parse(JSON.stringify(step.after))).networks.get('pixel').node('first').inputs.length,0);
 const undo=changesBetween(step.after,step.before,registry);assert.equal(undo.networks.find(n=>n.id==='pixel').ports[0].after,'float');
 assert.deepEqual(plain(g),plain(step.before));
});
test('adding and reordering ports preserves identity; failures do not publish partial edits',()=>{
 const base=doc(sharedGraph());let stale;
 const step=base.change(m=>{stale=m.subgraph('gain');stale.editInterface('inputs',{kind:'add',port:port('extra')});stale.editInterface('inputs',{kind:'move',id:'extra',delta:-1});});
 assert.deepEqual(plain(step.after.subgraphs[0].inputs.map(p=>p.id)),['extra','value']);
 assert.throws(()=>stale.editInterface('inputs',{kind:'remove',id:'value'}),/active transaction/);
 const before=base.snapshot();
 assert.throws(()=>base.change(m=>m.subgraph('gain').editInterface('inputs',{kind:'add',port:port('value')})),/duplicate/);
 assert.deepEqual(plain(base.snapshot()),plain(before));
 // Every definition in a graph is editable in this version (no read-only copies, Refactor.109). 這一版圖裡每份定義都可改。
 const renamed=doc(sharedGraph()).change(m=>m.subgraph('wrapper').rename('Wrapped'));
 assert.equal(renamed.after.subgraphs[1].name,'Wrapped');
});

test('nested compilation keeps graph ownership, bindings and diagnostics scoped to authored nodes',()=>{
 const g=sharedGraph(),before=plain(g);const compiler=c.GrapeTopCompiler;
 const compiled=compiler.compile(g);
 assert.deepEqual(g,before);
 assert.ok(compiled.sourceMap.pixel.some(row=>row.node==='mul'&&row.subgraphId==='gain'&&row.trail.join('/')==='wrapper/gain'));
 assert.equal(compiler.compile(JSON.parse(JSON.stringify(g))).pixel,compiled.pixel);
 g.subgraphs[0].graph.nodes.push(node('unused','float',{value:1}));
 const next=compiler.compile(g);
 assert.equal(next.diagnostics.filter(row=>row.node==='unused').length,2);
 assert.ok(next.diagnostics.every(row=>row.subgraphId==='gain'));
 g.subgraphs[0].graph.nodes[1].inputValues.b=NaN;
 assert.throws(()=>compiler.compile(g),error=>error.node==='mul'&&error.subgraphId==='gain'&&error.trail[0]==='gain');
});
test('subgraph validation rejects cycles and duplicate boundaries before returning code; a wire to a missing port is a ghost wire',()=>{
 const compiler=c.GrapeTopCompiler;
 const cycle=sharedGraph();cycle.subgraphs[0].graph.nodes.push(node('recurse','subgraph_call',{subgraphId:'wrapper'}));
 assert.equal(compiler.supports(cycle),true);assert.throws(()=>compiler.compile(cycle),/reference cycle/);
 const duplicate=sharedGraph();duplicate.subgraphs[0].graph.nodes.push(node('in2','subgraph_input'));
 assert.throws(()=>compiler.compile(duplicate),/Exactly one/);
 const unused=sharedGraph();unused.subgraphs.push({...plain(unused.subgraphs[0]),id:'unused'});unused.subgraphs[2].graph.edges[0].to[1]='missing';
 // A wire to a port that is gone is a ghost wire (Q37 1-3, TECH-2), and an unused definition does not block code (A8, TECH-3).
 // 接到已不存在接孔的線是 Ghost 線；沒被引用的定義不擋產碼。
 assert.doesNotThrow(()=>compiler.compile(unused));
 const unsupported=sharedGraph();unsupported.subgraphs[0].inputs[0].type='mat4';assert.equal(compiler.supports(unsupported),false);
 // An opaque port is a built-in type the host passes, on either side (amendment A1). opaque 接口是宿主能傳的內建型別，兩邊都可。
 const opaque=sharedGraph();opaque.subgraphs[0].inputs[0]={id:'value',type:'sampler2D'};opaque.subgraphs[0].outputs[0]={id:'result',type:'sampler2D'};
 assert.equal(compiler.supports(opaque),true);
});
test('explicit interface conversion reshapes per-instance defaults without aliasing or changing outputs',()=>{
 const g=sharedGraph();g.stages.pixel.nodes[1].inputValues={value:2};g.subgraphs[1].graph.nodes[1].inputValues={value:4};
 const step=doc(g).change(m=>m.subgraph('gain').editInterface('inputs',{kind:'update',id:'value',patch:{type:'vec4'}}));
 assert.deepEqual(plain(step.after.stages.pixel.nodes[1].inputValues.value),[2,2,2,2]);
 assert.deepEqual(plain(step.after.subgraphs[1].graph.nodes[1].inputValues.value),[4,4,4,4]);
 assert.equal(step.after.subgraphs[0].outputs[0].type,'float');
});
test('boundary annotations survive expansion and malformed boundary defaults identify their authored scope',()=>{
 const g=sharedGraph();g.subgraphs[0].graph.nodes[0].comment='Input boundary note';g.subgraphs[0].graph.nodes[2].comment='Output boundary note';
 const compiled=c.GrapeTopCompiler.compile(g);assert.match(compiled.pixel,/Input boundary note/);assert.match(compiled.pixel,/Output boundary note/);
 g.subgraphs[0].graph.nodes[2].inputValues={result:'invalid'};
 assert.throws(()=>c.GrapeTopCompiler.compile(g),error=>error.node==='out'&&error.subgraphId==='gain');
});

// TECH-3 (technical review R109–R112; amendment A8): only the definitions the stage reaches are checked; an unused one never blocks
// code and is reported for the Subgraphs panel instead. 只檢查 Stage 走得到的定義；沒用到的不擋產碼，改給子圖面板。
test('an unused definition never blocks code: deep unused chains compile, an unusable one is only reported',()=>{
 const compiler=c.GrapeTopCompiler;
 // A chain of unused definitions, each calling the next twice: expanding it would pass the 2048-node limit. 沒用到的鏈，每層呼叫下一層兩次。
 const deep=sharedGraph();
 for(let i=0;i<14;i++){
  const f={id:'chain'+i,name:'Chain '+i,inputs:[port('value')],outputs:[port('result')],graph:{nodes:[node('in','subgraph_input'),node('out','subgraph_output')],edges:[]}};
  if(i<13){f.graph.nodes.push(node('a','subgraph_call',{subgraphId:'chain'+(i+1)}),node('b','subgraph_call',{subgraphId:'chain'+(i+1)}));
   f.graph.edges.push({id:'e1',from:['in','value'],to:['a','value']},{id:'e2',from:['a','result'],to:['b','value']},{id:'e3',from:['b','result'],to:['out','result']});}
  else f.graph.edges.push({id:'e1',from:['in','value'],to:['out','result']});
  deep.subgraphs.push(f);
 }
 assert.equal(compiler.supports(deep),true);assert.doesNotThrow(()=>compiler.compile(deep));
 // An unused definition this host cannot use (a node it does not know). 這個 host 用不了的未用定義（不認得的節點）。
 const odd=sharedGraph();odd.subgraphs.push({...plain(odd.subgraphs[0]),id:'odd',name:'Odd'});
 odd.subgraphs[2].graph.nodes.push({id:'mystery',nodeType:'unknown.node',params:{},ui:{x:0,y:0}});
 assert.equal(compiler.supports(odd),true);assert.doesNotThrow(()=>compiler.compile(odd));
 assert.deepEqual([...compiler.unusableSubgraphs(odd)],['odd']);
 // Once it is used, it blocks as before. 被用到就照舊擋。
 odd.stages.pixel.nodes.push(node('useOdd','subgraph_call',{subgraphId:'odd'}));
 assert.equal(compiler.supports(odd),false);
});
test('the stage table remembers each definition once and never keeps a result cut short by a cycle',()=>{
 const {subgraphStages,subgraphStageTable}=c.GrapeGraph;
 // A calls B, B calls A, and A holds a pixel-only node: from B, the answer is pixel only. A→B→A，A 有只能在 pixel 的節點。
 const g=sharedGraph();
 g.subgraphs=[{id:'A',name:'A',inputs:[],outputs:[],graph:{nodes:[node('b','subgraph_call',{subgraphId:'B'}),node('t','texture_sample')],edges:[]}},
  {id:'B',name:'B',inputs:[],outputs:[],graph:{nodes:[node('a','subgraph_call',{subgraphId:'A'})],edges:[]}}];
 const table=subgraphStageTable(g,registry);
 assert.deepEqual(plain(table('A')),['pixel']);
 assert.deepEqual(plain(table('B')),plain(subgraphStages(g,'B',registry)));
 assert.deepEqual(plain(table('B')),['pixel']);
});
