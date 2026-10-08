// Uniforms, round A (Refactor.44; uniform-round.md, design-interview Q41, Q51): a declaration kind
// whose value goes to TD as a binding; `color: true` for vec3/vec4 only; referred to by the
// reference node (the old Uniform node retired). Uniform A：值以綁定交給 TD；color 只給 vec3、vec4。
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const context=vm.createContext({});vm.runInContext(fs.readFileSync(path.join(__dirname,'../../src/generated/grape_core.js'),'utf8'),context);
const G=context.GrapeGraph,compiler=context.GrapeTopCompiler,registry=G.registry;
const plain=v=>JSON.parse(JSON.stringify(v));
const bootstrap=JSON.parse(fs.readFileSync(path.join(__dirname,'../../src/generated/editor-bootstrap.json'),'utf8'));
const {convertOldGraph}=require('../../tools/dev/old_graph.cjs');

function withUniform(entry={},wire=true){
  const doc=new G.GraphDocument(plain(bootstrap.defaultDocument.graph),registry);
  return new G.GraphDocument(doc.change(c=>{
    c.addDeclaration({id:'u1',kind:'uniform',name:'uTint',type:'vec4',...entry});
    const net=c.networks.get('pixel'),output=net.nodes.find(n=>n.data.nodeType==='sgrape.builtin.pixel_out');
    net.insert({id:'ref',nodeType:'sgrape.builtin.declaration',params:{declarationId:'u1'},ui:{}});
    if(wire)net.connect(net.node('ref').outputs[0],output.port('input','color'),G.values.policy);
  }).after,registry);
}

test('a used Uniform is declared in GLSL and goes to TD with its value; an unused one goes to TD only',()=>{
  const result=compiler.compile(withUniform({value:[1,0.5,0,1],color:true}).snapshot());
  assert.match(result.pixel,/^uniform vec4 uTint;$/m);
  assert.match(result.pixel,/vec4 sg_n_ref = uTint;/);
  assert.deepEqual(plain(result.bindings.filter(b=>b.kind==='uniform')),
    [{id:'u1',kind:'uniform',name:'uTint',type:'vec4',value:[1,0.5,0,1],color:true}]);
  // Its TD row lives as long as the declaration (legacy; Uniform D1). TD 上那一列跟著宣告存在（舊產品同）。
  const unused=compiler.compile(withUniform({},false).snapshot());
  assert.ok(!unused.pixel.includes('uTint'));
  assert.deepEqual(plain(unused.bindings.filter(b=>b.kind==='uniform').map(b=>b.name)),['uTint']);
});

test('a new Uniform starts at zero; colour is decided when it is created and never switched (Q51, Q59)',()=>{
  const doc=withUniform();
  assert.deepEqual(plain(doc.snapshot().declarations.find(d=>d.id==='u1')),{id:'u1',kind:'uniform',name:'uTint',type:'vec4',value:[0,0,0,0]});
  assert.throws(()=>doc.change(c=>c.changeDeclaration('u1',{color:true})),/colour or not from the moment/);
  const colour=doc.change(c=>c.addDeclaration({id:'u2',kind:'uniform',name:'uPaint',type:'vec3',color:true})).after;
  const paint=new G.GraphDocument(colour,registry);
  assert.equal(paint.change(c=>c.changeDeclaration('u2',{type:'vec4'})).after.declarations.find(d=>d.id==='u2').type,'vec4','vec3 to vec4 stays on the Colors page');
  assert.throws(()=>paint.change(c=>c.changeDeclaration('u2',{type:'vec2'})),/Only vec3 and vec4/);
  assert.throws(()=>paint.change(c=>c.changeDeclaration('u2',{color:false})),/colour or not/);
  assert.throws(()=>doc.change(c=>c.changeDeclaration('u1',{color:'yes'})),/colour or not|true or false/);
  const constant=doc.change(c=>c.addDeclaration({id:'k',kind:'constant',name:'kA',type:'vec4'})).after;
  assert.throws(()=>new G.GraphDocument(constant,registry).change(c=>c.changeDeclaration('k',{color:true})),e=>e.problem==='field','a constant has no colour');
});

test('old graphs: the Uniform node becomes the reference node; nativeSequence color becomes color: true',()=>{
  const old={schemaVersion:1,target:'top',declarations:[{id:'u',kind:'uniform',name:'uC',type:'vec3',value:[1,1,1],nativeSequence:'color'}],
    stages:{pixel:{nodes:[{id:'n',definitionUuid:'sgrape.builtin.uniform',params:{declarationId:'u'}}],edges:[]}}};
  const {graph}=convertOldGraph(old);
  assert.deepEqual(graph.declarations[0],{id:'u',kind:'uniform',name:'uC',type:'vec3',value:[1,1,1],color:true});
  assert.equal(graph.stages.pixel.nodes[0].nodeType,'sgrape.builtin.declaration');
});

// Time (Q61): an ordinary Uniform pointing to a preset by `entry`; name and type come from the preset
// and are locked in the web editor. 時間：指向預設 Uniform 的普通 Uniform；名字與型別照表、網頁端鎖住。
test('a preset Uniform: name and type from the preset, locked; one per graph; bound by its entry with a value',()=>{
  const doc=withUniform({},false);
  const g=doc.change(c=>{
    c.addDeclaration({id:'b1',kind:'uniform',entry:'absTime'});
    const net=c.networks.get('pixel'),output=net.nodes.find(n=>n.data.nodeType==='sgrape.builtin.pixel_out');
    net.insert({id:'t',nodeType:'sgrape.builtin.declaration',params:{declarationId:'b1'},ui:{}});
    net.connect(net.node('t').outputs[0],output.port('input','color'),G.values.policy);
  }).after;
  assert.deepEqual(plain(g.declarations.find(d=>d.id==='b1')),{id:'b1',kind:'uniform',name:'uAbsTime',type:'float',value:0,entry:'absTime'});
  const result=compiler.compile(g);
  assert.match(result.pixel,/^uniform float uAbsTime;$/m);
  assert.deepEqual(plain(result.bindings.filter(b=>b.entry)),[{id:'b1',kind:'uniform',name:'uAbsTime',type:'float',value:0,entry:'absTime'}]);
  const again=new G.GraphDocument(g,registry);
  assert.throws(()=>again.change(c=>c.addDeclaration({id:'b2',kind:'uniform',entry:'absTime'})),e=>e.problem==='taken','one per graph');
  assert.throws(()=>again.change(c=>c.changeDeclaration('b1',{name:'uClock'})),/keeps its own name/);
  assert.throws(()=>again.change(c=>c.changeDeclaration('b1',{type:'vec2'})),/keeps its own name and type/);
  assert.throws(()=>again.change(c=>c.changeDeclaration('b1',{entry:'time'})),/keeps its preset/);
  assert.equal(again.change(c=>c.changeDeclaration('b1',{value:2})).after.declarations.find(d=>d.id==='b1').value,2,'its value changes like any Uniform');
  assert.throws(()=>again.change(c=>c.addDeclaration({id:'b3',kind:'uniform',entry:'moon'})),/Unknown Uniform preset/);
  assert.deepEqual(plain(G.uniformPresets.map(e=>e.name)),['uAbsTime','uAbsFrame','uTime','uFrame','uDeltaTime','uFrameStep']);
});

test('common identities: every one a definition points to exists; graphs never store them (Q61)',()=>{
  const known=new Set(G.commonSources.map(c=>c.id));
  for(const p of G.uniformPresets)if(p.common!==null)assert.ok(known.has(p.common),p.entry);
  const marked=G.tdValues.filter(e=>e.common);
  assert.deepEqual(plain(marked.map(e=>[e.id,e.common])),[['uTDOutputInfoResZw','resolution'],['glFragCoord','fragCoord'],['vUVSt','uv']]);
  for(const e of marked)assert.ok(known.has(e.common),e.id);
});
