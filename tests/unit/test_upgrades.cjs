// Node upgrades (Refactor.65, human 2026-10-10): a stored node in an older form becomes the current one by what the graph
// holds, not by a version number; wires follow at the end that touches the node; subgraphs too; chains settle; another
// format is left to the importer. 節點升級：看圖裡存的內容、不看版本號；線跟著改接到節點的那一端；子圖一樣；連續改名會停；別的格式交給匯入器。
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const context=vm.createContext({});vm.runInContext(fs.readFileSync(path.join(__dirname,'../../src/generated/grape_core.js'),'utf8'),context);
const G=context.GrapeGraph,compiler=context.GrapeTopCompiler,registry=G.registry;
const plain=v=>JSON.parse(JSON.stringify(v));
const bootstrap=JSON.parse(fs.readFileSync(path.join(__dirname,'../../src/generated/editor-bootstrap.json'),'utf8'));
const TD='sgrape.builtin.td_value';

// The default graph with an RGBA node, and the two older UV shapes wired into it (as Grape_TOP1 had them).
// 預設圖加一個 RGBA 節點，接上兩種舊的 UV 寫法（同 Grape_TOP1 的情況）。
function oldGraph(){
  const g=plain(bootstrap.defaultDocument.graph);
  g.stages.pixel.nodes.push({id:'rgba',nodeType:'sgrape.builtin.rgba',params:{},ui:{}},{id:'len',nodeType:'sgrape.builtin.length',params:{type:'vec2'},ui:{}},
    {id:'st',nodeType:TD,params:{entry:'vUVSt'},ui:{x:1}},{id:'uv3',nodeType:TD,params:{entry:'vUV'},ui:{x:2}});
  // vUV.st was a vec2, vUV a vec3: each old wire goes where its type fits. vUV.st 是 vec2、vUV 是 vec3：舊線各接到型別相符的地方。
  g.stages.pixel.edges.push({id:'e1',from:['st','out'],to:['len','value']},{id:'e2',from:['uv3','out'],to:['rgba','rgb']},
    {id:'e3',from:['len','out'],to:['rgba','alpha']});
  return g;
}

test('older UV nodes become the current vUV and their wires move to the right outputs',()=>{
  const before=oldGraph(),frozen=JSON.stringify(before);
  const {graph,changes}=G.upgradeGraph(before);
  assert.equal(JSON.stringify(before),frozen,'the input is not changed');
  const node=id=>graph.stages.pixel.nodes.find(n=>n.id===id),edge=id=>graph.stages.pixel.edges.find(e=>e.id===id);
  assert.equal(node('st').params.entry,'vUV');
  assert.deepEqual(plain(edge('e1').from),['st','uv']);
  assert.deepEqual(plain(edge('e2').from),['uv3','uvw']);
  assert.deepEqual(plain(changes.map(c=>[c.network,c.node,c.rule,c.wires])),[['pixel','st','td-value-vuv-st',1],['pixel','uv3','td-value-vuv-out',1]]);
  // No ghost is left, and it compiles with both wires real. 沒有 Ghost 留下，兩條線都是真的。
  const ghosts=G.ghostsOf(new G.GraphDocument(graph,registry).networks.get('pixel'),G.values.policy);
  assert.equal(ghosts.nodes.size+ghosts.edges.size,0);
  assert.ok(G.formatProblem(graph)===null);
});

test('a current graph comes back as it is, the same object, with nothing to report',()=>{
  const g=plain(bootstrap.defaultDocument.graph);
  const result=G.upgradeGraph(g);
  assert.equal(result.graph,g);assert.equal(result.changes.length,0);
  const done=G.upgradeGraph(oldGraph()).graph;
  assert.equal(G.upgradeGraph(done).changes.length,0,'an upgraded graph needs nothing more');
});

test('wires follow at the end that touches the node: inputs too; subgraphs are upgraded as well',()=>{
  const rules=[{id:'rename-in',nodeType:'sgrape.builtin.rgba',inputs:{alpha:'a'},note:{code:'t',source:'t'}}];
  // e3 arrives at rgba's alpha in the main graph; f1 at r2's alpha in the subgraph. e3 接到主圖 rgba 的 alpha；f1 接到子圖 r2 的 alpha。
  const g=oldGraph();g.subgraphs=[{id:'fn1',name:'f',scope:'local',inputs:[],outputs:[],graph:{nodes:[{id:'r2',nodeType:'sgrape.builtin.rgba',params:{},ui:{}},
    {id:'s2',nodeType:'sgrape.builtin.scalar',params:{type:'float',value:1},ui:{}}],edges:[{id:'f1',from:['s2','out'],to:['r2','alpha']}]}}];
  const {graph,changes}=G.upgradeGraph(g,rules);
  assert.deepEqual(plain(graph.stages.pixel.edges.find(e=>e.id==='e3').to),['rgba','a']);
  assert.deepEqual(plain(graph.subgraphs[0].graph.edges[0].to),['r2','a']);
  assert.deepEqual(plain(changes.map(c=>c.network)).sort(),['pixel','subgraph:fn1'],'networks are named as everywhere else');
});

test('a chain of renames is followed to its end; a table that never settles is refused',()=>{
  const note={code:'t',source:'t'};
  const chain=[{id:'a-b',nodeType:TD,params:{entry:'A'},set:{params:{entry:'B'}},note},{id:'b-c',nodeType:TD,params:{entry:'B'},set:{params:{entry:'C'}},note}];
  const g=plain(bootstrap.defaultDocument.graph);g.stages.pixel.nodes.push({id:'x',nodeType:TD,params:{entry:'A'},ui:{}});
  assert.equal(G.upgradeGraph(g,chain).graph.stages.pixel.nodes.find(n=>n.id==='x').params.entry,'C');
  const loop=[{id:'a-b',nodeType:TD,params:{entry:'A'},set:{params:{entry:'B'}},note},{id:'b-a',nodeType:TD,params:{entry:'B'},set:{params:{entry:'A'}},note}];
  assert.throws(()=>G.upgradeGraph(g,loop),/do not settle/);
});

test('another format is not upgraded here: it belongs to the importer',()=>{
  const old={schemaVersion:1,stages:{pixel:{nodes:[{id:'st',definitionUuid:TD,params:{entry:'vUVSt'}}],edges:[]}}};
  const result=G.upgradeGraph(old);
  assert.equal(result.graph,old);assert.equal(result.changes.length,0);
});

test('every rule says what changed for people, and rule ids are unique',()=>{
  const ids=G.nodeUpgrades.map(r=>r.id);
  assert.equal(new Set(ids).size,ids.length);
  for(const r of G.nodeUpgrades)assert.ok(r.note&&r.note.code.startsWith('upgrade.')&&r.note.source,r.id);
});

// Node names (Refactor.76, human 2026-10-11): one rule for new nodes, copies, pastes and renames that meet a taken name, as
// TD does — the number after the last underscore goes up; with none, _1 is added; a new node starts at _1. Underscores are
// shown as spaces and typed as spaces. 節點名稱（R.76，人類）：新增、複製、貼上、改名撞名同一套（照 TD）——最後底線後的數字往上加；
// 沒有就加 _1；新節點從 _1 開始。底線顯示成空白、輸入空白存成底線。
test('one naming rule: a new node starts at _1, a taken name moves up, a type ending in a digit keeps its own',()=>{
  assert.equal(G.newNodeName('Split',new Set()),'Split_1');
  assert.equal(G.newNodeName('Split',new Set(['Split_1','Split_2'])),'Split_3');
  assert.equal(G.newNodeName('Vector 2',new Set(['Vector_2_1'])),'Vector_2_2');
  assert.equal(G.newNodeName('TD Built-in',new Set()),'Node_1','a label that cannot make a GLSL name');
  assert.equal(G.freeName('Normalize_1',new Set(['Normalize_1'])),'Normalize_2');
  assert.equal(G.freeName('Glow',new Set(['Glow','Glow_1'])),'Glow_2');
  assert.equal(G.freeName('Glow_',new Set(['Glow_'])),'Glow_1','never two underscores in a row');
  assert.equal(G.freeName('Free',new Set(['Other'])),'Free');
  assert.equal(G.typedName('Glow 中文 Pass!_2'),'Glow  Pass_2','only letters, digits, spaces and underscores get in');
  assert.equal(G.storedName('  Glow  Pass  '),'Glow_Pass');
  assert.equal(G.shownName('Glow_Pass_2'),'Glow Pass 2');
  assert.ok(G.validNodeName('Split_1')&&!G.validNodeName('1st')&&!G.validNodeName('gl_x')&&!G.validNodeName('TD_x')&&!G.validNodeName('output'));
});

test('a graph made before names were given is named once as it opens; sources and unknown types are left alone',()=>{
  const g=plain(bootstrap.defaultDocument.graph);
  for(const n of g.stages.pixel.nodes)delete n.name;
  const float=plain(registry.get('sgrape.builtin.float').catalog.definition.defaults);
  g.stages.pixel.nodes.push({id:'a',nodeType:'sgrape.builtin.float',params:plain(float),ui:{}},{id:'b',nodeType:'sgrape.builtin.float',name:'Float_1',params:plain(float),ui:{}},
    {id:'uv',nodeType:TD,params:{entry:'vUV'},ui:{}},{id:'what',nodeType:'vendor.future.node',params:{},ui:{}});
  const {graph,changes}=G.upgradeGraph(g,G.nodeUpgrades,registry);
  const names=Object.fromEntries(graph.stages.pixel.nodes.map(n=>[n.id,n.name]));
  assert.equal(names.a,'Float_2','the next free number, around the name already there');
  assert.equal(names.b,'Float_1');
  assert.equal(names.uv,undefined,'a TD value stands for a source: no name of its own');
  assert.equal(names.what,undefined,'an unknown type is kept as stored');
  assert.deepEqual(plain(changes.filter(c=>c.rule==='node-name').map(c=>c.node).sort()),['a','color','pixel_out']);
  assert.equal(G.upgradeGraph(graph,G.nodeUpgrades,registry).changes.length,0,'named once');
  assert.ok(compiler.compile(graph).pixel.includes('sg_n_Color_RGBA_1'),'the name is the GLSL name');
  assert.equal(G.upgradeGraph(g).changes.filter(c=>c.rule==='node-name').length,0,'without the registry, names are not touched');
});

// 【發布前清理】Refactor.117 (human 2026-10-16): a subgraph's node is an instance, not a call. Development graphs saved with the old
// type, at the stage and inside a definition, open as instances with their wires and code unchanged. 子圖節點改叫實例：舊名的開發中的圖
// （Stage 上與定義裡）開圖換成實例，線與產碼不變。
test('subgraph calls saved before Refactor.117 open as instances, nested ones too, with the same code',()=>{
  const {sharedGraph}=require('../fixtures/shared_subgraphs.cjs');
  const current=sharedGraph(),old=JSON.parse(JSON.stringify(current).split('sgrape.builtin.subgraph_instance').join('sgrape.builtin.subgraph_call'));
  assert.ok(JSON.stringify(old).includes('subgraph_call')&&JSON.stringify(current).includes('subgraph_instance'));
  const {graph,changes}=G.upgradeGraph(old,G.nodeUpgrades);
  assert.deepEqual(plain(graph),plain(current));
  assert.ok(changes.length>1&&changes.every(c=>c.rule==='subgraph-instance'));
  assert.ok(changes.some(c=>c.network.startsWith('subgraph:')),'a nested one is upgraded too');
  assert.equal(compiler.compile(graph).pixel,compiler.compile(current).pixel);
});
