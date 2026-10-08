const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../../src/generated/grape_core.js'),'utf8');
const context=vm.createContext({});vm.runInContext(source,context);
const compiler=context.GrapeTopCompiler;
// The legacy oracle is a frozen snapshot of the old Python compiler's results (removed in cleanup 5,
// Q48); the old graphs are converted with the tool that converts real old graphs (tools/dev/old_graph.cjs, Q44).
// 對照組是舊 Python 產碼器的結果快照（第 5 條清理時移除）；舊格式的圖用轉換真實舊圖的同一支工具轉成新格式。
const {convertOldGraph}=require('../../tools/dev/old_graph.cjs');
const {cases,identifiers}=JSON.parse(fs.readFileSync(path.join(__dirname,'../fixtures/top_compiler_legacy.json'),'utf8')),plain=v=>JSON.parse(JSON.stringify(v));
for(const row of cases)row.graph=convertOldGraph(row.graph).graph;
function freeze(v){if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}

// Legacy refused a wire to a port that no longer exists; it is now a ghost wire, treated as not
// connected (design-interview Q37 1-3). 舊產品對「接到不存在接孔的線」整張報錯；現在是 Ghost 線、當作沒接。
const nowGhost=new Set(['missing port']);
// Legacy listed only used Uniforms in the compiler result, while its TD side kept a row for every declared
// one (sgrape_sources.configure). The TD side now reads the compiler result, so unused Uniforms are in it
// too (Uniform D1); compared here as legacy listed them. 舊產碼結果只列用到的 Uniform，TD 端則替每個宣告留列；
// 現在 TD 讀產碼結果，所以沒用到的也在裡面。這裡照舊產品的列法比較。
const asLegacy=r=>({...r,bindings:r.bindings.filter(b=>b.kind!=='uniform'||new RegExp('^uniform \\S+ '+b.name+';$','m').test(r.pixel))});
test('frontend compilation matches legacy GLSL, bindings, ports, source map and diagnostics',()=>{
  for(const row of cases){
    assert.equal(compiler.supports(row.graph),true,row.name);
    if(nowGhost.has(row.name)){const result=compiler.compile(freeze(row.graph),identifiers);
      assert.ok(result.diagnostics.some(d=>/Ghost wire/.test(d.message)),row.name);}
    else if(row.error)assert.throws(()=>compiler.compile(freeze(row.graph),identifiers),undefined,row.name);
    else assert.deepEqual(asLegacy(plain(compiler.compile(freeze(row.graph),identifiers))),row.compiled,row.name);
  }
});
test('capability selection excludes whole graphs before execution',()=>{
  const base=cases[0].graph;
  const variants=[
    g=>g.target='mat',g=>g.subgraphs=[{}],g=>g.structDefinitions=[{}],g=>delete g.format,g=>g.version=2,
    g=>g.stages.pixel.nodes=Array.from({length:257},(_,i)=>({...g.stages.pixel.nodes[0],id:'n'+i})),
    g=>g.stages.pixel.edges=Array.from({length:1025},()=>g.stages.pixel.edges[0]),
  ];
  for(const change of variants){const g=plain(base);change(g);assert.equal(compiler.supports(g),false);assert.throws(()=>compiler.compile(g),/outside/);}
});
test('a declaration of a kind this build does not know is kept and not read (Q44)',()=>{
  const g=plain(cases[0].graph);g.declarations.push({id:'texture',kind:'sampler',type:'sampler2D',name:'uTexture',value:null});
  assert.equal(compiler.supports(g),true);
  const result=compiler.compile(g);assert.ok(!result.pixel.includes('uTexture'));assert.equal(result.bindings.some(b=>b.id==='texture'),false);
});
test('result and graph do not share mutable binding data',()=>{
  const g=plain(cases.find(c=>c.name==='uniform abs float').graph),before=JSON.stringify(g);
  const result=compiler.compile(g);result.bindings[0].value=999;
  assert.equal(JSON.stringify(g),before);
});
test('invalid supported edits retain node locations for existing diagnostic UI',()=>{
  // A reference to a declaration that is gone is a ghost now (Q45), named in the diagnostics.
  // 引用的宣告不見了＝Ghost（Q45），在診斷裡指出是哪個節點。
  const g=plain(cases.find(c=>c.name==='uniform abs float').graph);g.declarations=[];
  assert.ok(compiler.compile(g).diagnostics.some(d=>d.node==='gainNode'&&/Ghost node/.test(d.message)));
  const bad=cases.find(c=>c.name==='disconnected cycle').graph;
  assert.throws(()=>compiler.compile(bad),error=>error.node==='dead'&&error.stage==='pixel');
});

// Ghosts (design-interview Q37 1-1, 1-3; Refactor.39): kept, never emitted, never fatal.
// Ghost：保留、不產碼、不讓整張圖失敗。
const color=g=>g.stages.pixel.nodes.find(n=>n.nodeType==='sgrape.builtin.color');
function defaultGraph(){
  const graph=plain(JSON.parse(fs.readFileSync(path.join(__dirname,'../../src/generated/editor-bootstrap.json'),'utf8')).defaultDocument.graph);
  const add={id:'sum',nodeType:'sgrape.builtin.add',params:{type:'vec4'},inputValues:{a:[0.1,0.2,0.3,1],b:[0,0,0,0]},ui:{}};
  graph.stages.pixel.nodes.push(add);
  const out=graph.stages.pixel.edges.find(e=>e.to[0]==='pixel_out');out.from=['sum','out'];
  graph.stages.pixel.edges.push({id:'eColorToSum',from:[color(graph).id,'out'],to:['sum','a']});
  return graph;
}
test('an unknown node and its wires are kept but not emitted; the rest compiles',()=>{
  const g=defaultGraph(),reference=compiler.compile(plain(g));
  g.stages.pixel.nodes.push({id:'future',nodeType:'vendor.pack.future',params:{knob:3},ui:{x:5}});
  g.stages.pixel.edges.push({id:'eFuture',from:['future','out'],to:['sum','b']});
  const before=JSON.stringify(g),result=compiler.compile(g);
  assert.equal(JSON.stringify(g),before,'the graph is not changed');
  assert.ok(!result.pixel.includes('future'));
  assert.ok(result.diagnostics.some(d=>d.node==='future'&&/Ghost node \(unknown\)/.test(d.message)));
  assert.ok(result.diagnostics.some(d=>d.node==='sum'&&/Ghost wire to b/.test(d.message)));
  assert.equal(result.pixel,reference.pixel,'b keeps its own value, as if not connected');
});
test('a wire whose types no longer fit is a ghost wire, not a failure',()=>{
  const g=defaultGraph();
  g.stages.pixel.nodes.push({id:'logic',nodeType:'sgrape.builtin.not',params:{type:'bvec2'},ui:{}});
  g.stages.pixel.edges.push({id:'eBad',from:[color(g).id,'out'],to:['logic','value']}); // vec4 into bvec2
  const result=compiler.compile(g);
  assert.ok(result.diagnostics.some(d=>d.node==='logic'&&/Ghost wire to value/.test(d.message)));
  assert.equal(result.pixel,compiler.compile(defaultGraph()).pixel);
});
test('a node outside its stage is a misplaced ghost (ghostsOf)',()=>{
  const graph=context.GrapeGraph,registry=graph.registry;
  const add=registry.get('sgrape.builtin.add');
  const vertexOnly={...add,catalog:{...add.catalog,definition:{...add.catalog.definition,definitionUuid:'test.vertex.only',key:'vertexOnly',stages:['vertex']}}};
  const custom=graph.createRegistry([...registry.modules,vertexOnly]);
  const g=defaultGraph();g.stages.pixel.nodes.push({id:'v',nodeType:'test.vertex.only',params:{type:'vec4'},ui:{}});
  const doc=new graph.GraphDocument(g,custom),ghosts=graph.ghostsOf(doc.networks.get('pixel'),graph.values.policy);
  assert.equal(ghosts.nodes.get('v'),'misplaced');
  assert.equal(ghosts.nodes.get('sum'),undefined);
});
