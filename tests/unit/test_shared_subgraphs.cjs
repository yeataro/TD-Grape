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
 // A definition with an interface this build cannot use: its calls are ghosts, the graph still compiles, the panel reports it (Q37 1-1, A8).
 // 接口這一版用不了的定義：呼叫是 Ghost、整張圖照產、面板回報。
 const unsupported=sharedGraph();unsupported.subgraphs[0].inputs[0].type='mat4';
 assert.equal(compiler.supports(unsupported),true);assert.doesNotThrow(()=>compiler.compile(unsupported));
 assert.ok([...compiler.unusableSubgraphs(unsupported)].includes('gain'));
 // R115-1 (Codex): the whole interface counts, not its types alone — a bad default, a bad or repeated port ID. 整個接口都算：
 // 預設值不合、接口 ID 不合法或重複。
 for(const spoil of [f=>{f.inputs[0].default='bad';},f=>{f.inputs[0].id='1bad';},f=>{f.inputs.push({...f.inputs[0]});}]){
  const used=sharedGraph();spoil(used.subgraphs[0]);
  assert.equal(compiler.supports(used),true);assert.doesNotThrow(()=>compiler.compile(used));
  assert.ok([...compiler.unusableSubgraphs(used)].includes('gain'),'called: the panel reports it');
  const unused=sharedGraph();spoil(unused.subgraphs[0]);unused.subgraphs=[unused.subgraphs[0]];
  unused.stages.pixel.nodes=unused.stages.pixel.nodes.filter(n=>n.id==='output');unused.stages.pixel.edges=[];
  assert.doesNotThrow(()=>compiler.compile(unused));
  assert.deepEqual([...compiler.unusableSubgraphs(unused)],['gain'],'unused: the panel reports it too');
 }
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
 // An unused definition this host cannot use (an interface type it does not know). 這個 host 用不了的未用定義（不認得的接口型別）。
 const odd=sharedGraph();odd.subgraphs.push({...plain(odd.subgraphs[0]),id:'odd',name:'Odd'});odd.subgraphs[2].inputs[0].type='mat4';
 assert.equal(compiler.supports(odd),true);assert.doesNotThrow(()=>compiler.compile(odd));
 assert.deepEqual([...compiler.unusableSubgraphs(odd)],['odd']);
 // Called, its call is a ghost: left out, the graph still compiles (Q37 1-1). 被呼叫時，呼叫是 Ghost：跳過、整張圖照產。
 odd.stages.pixel.nodes.push(node('useOdd','subgraph_call',{subgraphId:'odd'}));
 assert.equal(compiler.supports(odd),true);assert.doesNotThrow(()=>compiler.compile(odd));
 // A ghost node inside a used definition is left out like one at the stage. 被用到的定義裡的 Ghost，和 stage 上的一樣跳過。
 const inside=sharedGraph();inside.subgraphs[0].graph.nodes.push({id:'mystery',nodeType:'unknown.node',params:{},ui:{x:0,y:0}});
 inside.subgraphs[0].graph.edges.push({id:'ghostWire',from:['mystery','out'],to:['mul','b']});
 assert.equal(compiler.supports(inside),true);assert.doesNotThrow(()=>compiler.compile(inside));
 assert.deepEqual([...compiler.unusableSubgraphs(inside)],[]);
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
// R113-1 (Codex re-review): a graph opened with a cycle is diagnosed in one pass, and the definitions on the cycle are reported.
// 開著循環的圖一次就診斷完，循環上的定義會被回報。
test('the panel diagnosis stays linear with an old cycle and reports the definitions on it',()=>{
 const compiler=c.GrapeTopCompiler,{subgraphGroups}=c.GrapeGraph;
 const g=sharedGraph();g.stages.pixel={nodes:[node('output','pixel_out')],edges:[]};g.subgraphs=[];
 const def=i=>({id:'d'+i,name:'D'+i,inputs:[],outputs:[],graph:{nodes:[node('in','subgraph_input'),node('out','subgraph_output')],edges:[]}});
 for(let i=0;i<=20;i++){const f=def(i);
  if(i===0)f.graph.nodes.push(node('self','subgraph_call',{subgraphId:'d0'}));
  else f.graph.nodes.push(node('a','subgraph_call',{subgraphId:'d'+(i-1)}),node('b','subgraph_call',{subgraphId:'d'+(i-1)}));
  g.subgraphs.push(f);}
 let visits=0;const counting={...registry,get:type=>{if(type==='sgrape.builtin.subgraph_input')visits++;return registry.get(type);}};
 subgraphGroups(g,counting);
 assert.ok(visits<=g.subgraphs.length,'each definition is read once, not once per call path');
 const started=Date.now(),unusable=compiler.unusableSubgraphs(g);
 assert.ok(Date.now()-started<200,'one pass, well under the old 900 ms');
 assert.deepEqual([...unusable],['d0'],'only the self-calling definition is on a cycle');
 // An unused self-call no longer passes unseen. 沒用到的自環不再沒人發現。
 const loop=sharedGraph();loop.subgraphs[0].graph.nodes.push(node('again','subgraph_call',{subgraphId:'gain'}));
 loop.stages.pixel.nodes=loop.stages.pixel.nodes.filter(n=>n.params.subgraphId!=='gain'&&n.params.subgraphId!=='wrapper');
 loop.stages.pixel.edges=loop.stages.pixel.edges.filter(e=>!['first','second'].includes(e.from[0])&&!['first','second'].includes(e.to[0]));
 assert.ok([...compiler.unusableSubgraphs(loop)].includes('gain'));
});

// The ghost-plus-subgraph finding (R.113 check, human 10-14: handle it): a stage with a ghost node and any subgraph still compiles,
// as the flat compiler does; the ghost and its wires are left out. stage 有 Ghost 又有子圖時照樣產碼，同平面編譯器；Ghost 與它的線跳過。
test('a ghost node at the stage no longer refuses a graph that has subgraphs',()=>{
 const compiler=c.GrapeTopCompiler,g=sharedGraph();
 g.stages.pixel.nodes.push({id:'future',nodeType:'vendor.future.node',params:{},ui:{x:0,y:0}});
 g.stages.pixel.edges.push({id:'e:future',from:['future','out'],to:['sum','b']});
 assert.equal(compiler.supports(g),true);
 const glsl=compiler.compile(g,{reservedNames:[]}).pixel;
 assert.ok(!glsl.includes('future'),'the ghost writes nothing');
 const flat=sharedGraph();flat.subgraphs=[];flat.stages.pixel.nodes=flat.stages.pixel.nodes.filter(n=>n.nodeType!=='sgrape.builtin.subgraph_call');
 flat.stages.pixel.edges=flat.stages.pixel.edges.filter(e=>!['first','second'].includes(e.from[0])&&!['first','second'].includes(e.to[0]));
 flat.stages.pixel.nodes.push({id:'future',nodeType:'vendor.future.node',params:{},ui:{x:0,y:0}});
 assert.equal(compiler.supports(flat),true,'and the flat graph still compiles, as before');
 flat.subgraphs=[plain(sharedGraph().subgraphs[0])];
 assert.equal(compiler.supports(flat),true,'adding a first, unused definition keeps it compiling');
});

// Call names (visual notes 27, human 2026-10-14): a call is named after its definition's title plus its own number, the title's own
// trailing number never counted up; calls still named by default follow a renamed title, hand-named ones stay; the title takes the
// node-name rule. 呼叫名稱：照定義的 Title 加自己的編號、不把 Title 結尾的數字往上加；仍是預設名的呼叫跟著改名，手動取名的不動；Title 照節點名稱規則。
test('a call is named after its title and follows a rename unless named by hand; a title takes the node-name rule',()=>{
 const {newCallName,validSubgraphTitle,upgradeGraph,nodeUpgrades}=c.GrapeGraph;
 const none=new Set();
 assert.equal(newCallName('Gain',none),'Gain_1');assert.equal(newCallName('Gain',new Set(['Gain_1'])),'Gain_2');
 assert.equal(newCallName('Subgraph_1',new Set(['Subgraph_1_1'])),'Subgraph_1_2','the title\'s own number is not counted up');
 assert.equal(newCallName('Soft Glow',none),'Soft_Glow_1');
 assert.equal(newCallName('增益',none),'Subgraph_1','a title that cannot make a name falls back');
 for(const ok of ['Gain','Soft Glow','Subgraph_1','Gain2'])assert.equal(validSubgraphTitle(ok),true,ok);
 for(const bad of ['2Gain','TD Blur','Soft  Glow',' Gain','增益','a__b',''])assert.equal(validSubgraphTitle(bad),false,bad);
 // Rename: the default-named calls follow, the hand-named one stays, a taken number moves on. 改名：預設名跟著、手動名不動、編號被占就往後。
 const g=sharedGraph();
 const first=g.stages.pixel.nodes.find(n=>n.id==='first');first.name='Gain_1';
 g.stages.pixel.nodes.push(node('again','subgraph_call',{subgraphId:'gain'}),node('mine','subgraph_call',{subgraphId:'gain'}),node('blocker','float',{value:1}));
 g.stages.pixel.nodes.find(n=>n.id==='again').name='Gain_2';g.stages.pixel.nodes.find(n=>n.id==='mine').name='Mine';
 g.stages.pixel.nodes.find(n=>n.id==='blocker').name='Blur_2';
 g.subgraphs[1].graph.nodes.find(n=>n.id==='inner').name='Gain_1';
 const step=doc(g).change(m=>m.subgraph('gain').rename('Blur'));
 const name=id=>step.after.stages.pixel.nodes.find(n=>n.id===id).name;
 assert.equal(name('first'),'Blur_1');assert.equal(name('again'),'Blur_3','Blur_2 is taken by another node');assert.equal(name('mine'),'Mine');
 assert.equal(step.after.subgraphs[1].graph.nodes.find(n=>n.id==='inner').name,'Blur_1','calls inside other definitions follow too');
 assert.equal(step.after.subgraphs[0].name,'Blur');
 assert.throws(()=>doc(g).change(m=>m.subgraph('gain').rename('2Blur')),e=>e.code==='subgraph.title');
 // An old graph's title outside the rule opens as it is; its calls were named with the fallback and follow a valid rename.
 // 舊圖的 Title 不合規則照開；它的呼叫用退路命名，改成合法 Title 時跟著改。
 const old=sharedGraph();old.subgraphs[0].name='增益';delete old.stages.pixel.nodes.find(n=>n.id==='first').name;
 const read=upgradeGraph(old,nodeUpgrades,registry).graph;
 assert.equal(read.stages.pixel.nodes.find(n=>n.id==='first').name,'Subgraph_1','opening names it by the fallback');
 const fixed=doc(read).change(m=>m.subgraph('gain').rename('Gain'));
 assert.equal(fixed.after.stages.pixel.nodes.find(n=>n.id==='first').name,'Gain_1');
});
