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

test('a used Uniform is declared in GLSL and goes to TD with its value; an unused one does not',()=>{
  const result=compiler.compile(withUniform({value:[1,0.5,0,1],color:true}).snapshot());
  assert.match(result.pixel,/^uniform vec4 uTint;$/m);
  assert.match(result.pixel,/vec4 sg_n_ref = uTint;/);
  assert.deepEqual(plain(result.bindings.filter(b=>b.kind==='uniform')),
    [{id:'u1',kind:'uniform',name:'uTint',type:'vec4',value:[1,0.5,0,1],color:true}]);
  const unused=compiler.compile(withUniform({},false).snapshot());
  assert.ok(!unused.pixel.includes('uTint'));
  assert.ok(!unused.bindings.some(b=>b.kind==='uniform'));
});

test('a new Uniform starts at zero and is not a colour; color is for vec3 and vec4 only (Q51)',()=>{
  const doc=withUniform();
  assert.deepEqual(plain(doc.snapshot().declarations.find(d=>d.id==='u1')),{id:'u1',kind:'uniform',name:'uTint',type:'vec4',value:[0,0,0,0]});
  const on=doc.change(c=>c.changeDeclaration('u1',{color:true})).after;
  assert.equal(on.declarations.find(d=>d.id==='u1').color,true);
  const vec2=new G.GraphDocument(on,registry).change(c=>c.changeDeclaration('u1',{type:'vec2'})).after;
  assert.deepEqual(plain(vec2.declarations.find(d=>d.id==='u1')),{id:'u1',kind:'uniform',name:'uTint',type:'vec2',value:[0,0],color:false},
    'a type that cannot be a colour turns it off');
  assert.throws(()=>new G.GraphDocument(vec2,registry).change(c=>c.changeDeclaration('u1',{color:true})),/Only vec3 and vec4/);
  assert.throws(()=>doc.change(c=>c.changeDeclaration('u1',{color:'yes'})),/true or false/);
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

// Uniform B (Refactor.45; Q52): built-in values. 內建值（時間）。
test('a built-in value: fixed name and type, no value, one per graph; declared in GLSL and bound by its entry',()=>{
  const doc=withUniform({},false);
  const g=doc.change(c=>{
    c.addDeclaration({id:'b1',kind:'builtin',name:'uAbsTime',type:'float',entry:'absTime'});
    const net=c.networks.get('pixel'),output=net.nodes.find(n=>n.data.nodeType==='sgrape.builtin.pixel_out');
    net.insert({id:'t',nodeType:'sgrape.builtin.declaration',params:{declarationId:'b1'},ui:{}});
    net.connect(net.node('t').outputs[0],output.port('input','color'),G.values.policy);
  }).after;
  assert.deepEqual(plain(g.declarations.find(d=>d.id==='b1')),{id:'b1',kind:'builtin',name:'uAbsTime',type:'float',entry:'absTime'});
  const result=compiler.compile(g);
  assert.match(result.pixel,/^uniform float uAbsTime;$/m);
  assert.deepEqual(plain(result.bindings.filter(b=>b.kind==='builtin')),[{id:'b1',kind:'builtin',name:'uAbsTime',type:'float',entry:'absTime'}]);
  const again=new G.GraphDocument(g,registry);
  assert.throws(()=>again.change(c=>c.addDeclaration({id:'b2',kind:'builtin',name:'uAbsTime',type:'float',entry:'absTime'})),e=>e.problem==='taken','one per graph');
  assert.throws(()=>again.change(c=>c.changeDeclaration('b1',{name:'uClock'})),/keeps its own name/);
  assert.throws(()=>again.change(c=>c.changeDeclaration('b1',{value:1})),e=>e.problem==='field');
  assert.throws(()=>again.change(c=>c.addDeclaration({id:'b3',kind:'builtin',name:'uMoon',type:'float',entry:'moon'})),/Unknown built-in/);
  assert.deepEqual(plain(G.builtinValues.map(e=>e.name)),['uAbsTime','uAbsFrame','uTime','uFrame','uDeltaTime','uFrameStep']);
});
