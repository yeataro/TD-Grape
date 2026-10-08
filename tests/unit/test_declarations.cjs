// Declarations and the reference node (Refactor.40; design-interview Q41, Q44, Q45).
// 宣告與引用宣告節點：全域常數、命名規則、改型別、刪除連同引用、指向不存在＝Ghost。
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const context=vm.createContext({});vm.runInContext(fs.readFileSync(path.join(__dirname,'../../src/generated/grape_core.js'),'utf8'),context);
const G=context.GrapeGraph,compiler=context.GrapeTopCompiler,registry=G.registry;
const plain=v=>JSON.parse(JSON.stringify(v));
const bootstrap=JSON.parse(fs.readFileSync(path.join(__dirname,'../../src/generated/editor-bootstrap.json'),'utf8'));

// Default graph with Add(ref, color) feeding Color Output. 預設圖加一個 Add：常數＋顏色→輸出。
function withConstant(type='vec4',value=[0.5,0,0,0]){
  const doc=new G.GraphDocument(plain(bootstrap.defaultDocument.graph),registry);
  const result=doc.change(c=>{
    c.addDeclaration({id:'k1',kind:'constant',name:'kOffset',type,value});
    const net=c.networks.get('pixel'),color=net.nodes.find(n=>n.data.nodeType==='sgrape.builtin.color');
    net.insert({id:'ref',nodeType:'sgrape.builtin.declaration',params:{declarationId:'k1'},ui:{}});
    net.insert({id:'sum',nodeType:'sgrape.builtin.add',params:{type:'vec4'},ui:{}});
    const output=net.nodes.find(n=>n.data.nodeType==='sgrape.builtin.pixel_out');
    net.connect(net.node('ref').outputs[0],net.node('sum').port('input','a'),G.values.policy);
    net.connect(color.outputs[0],net.node('sum').port('input','b'),G.values.policy);
    net.connect(net.node('sum').outputs[0],output.port('input','color'),G.values.policy);
  });
  return new G.GraphDocument(result.after,registry);
}

test('a global constant becomes file-scope const GLSL; it is not a TD binding',()=>{
  const doc=withConstant(),result=compiler.compile(doc.snapshot());
  assert.match(result.pixel,/^const vec4 kOffset = vec4\(0\.5, 0\.0, 0\.0, 0\.0\);$/m);
  assert.match(result.pixel,/const vec4 sg_n_ref = kOffset;/,'a reference to a constant is a constant expression');
  assert.deepEqual(plain(result.bindings),[]);
});

test('names follow GLSL, avoid reserved words and stay unique among declarations',()=>{
  const doc=withConstant(),g=doc.snapshot();
  assert.equal(G.declarationNameProblem(g,'kGain'),null);
  assert.equal(G.declarationNameProblem(g,'kOffset'),'taken');
  assert.equal(G.declarationNameProblem(g,'kOffset','k1'),null,'its own name is fine when renaming itself');
  assert.equal(G.declarationNameProblem(g,'float'),'reserved');
  assert.equal(G.declarationNameProblem(g,'gl_Pos'),'reserved');
  assert.equal(G.declarationNameProblem(g,'1abc'),'format');
  assert.equal(G.declarationNameProblem(g,'a__b'),'format');
  assert.equal(G.freeDeclarationName(g,'constant'),'constant1');
  assert.throws(()=>doc.change(c=>c.addDeclaration({id:'k2',kind:'constant',name:'kOffset',type:'float'})),e=>e.problem==='taken');
  assert.throws(()=>doc.change(c=>c.addDeclaration({id:'k2',kind:'mystery',name:'kOther',type:'float'})),e=>e.problem==='kind');
});

test('renaming changes the GLSL; changing type reshapes the value and the reference port',()=>{
  let doc=withConstant();
  doc=new G.GraphDocument(doc.change(c=>c.changeDeclaration('k1',{name:'kShift'})).after,registry);
  assert.match(compiler.compile(doc.snapshot()).pixel,/const vec4 kShift = /);
  doc=new G.GraphDocument(doc.change(c=>c.changeDeclaration('k1',{type:'vec2'})).after,registry);
  assert.deepEqual(plain(doc.snapshot().declarations[0].value),[0.5,0]);
  const net=doc.networks.get('pixel'),ghosts=G.ghostsOf(net,G.values.policy);
  // vec2 still converts into vec4 here, so check the reference's own output instead.
  assert.equal(net.node('ref').outputs[0].type,'vec2');
  assert.equal(ghosts.nodes.size,0);
});

test('removing a declaration removes its reference nodes and their wires in the same step',()=>{
  const doc=withConstant(),result=doc.change(c=>c.removeDeclaration('k1'));
  const pixel=result.after.stages.pixel;
  assert.equal(result.after.declarations.length,0);
  assert.ok(!pixel.nodes.some(n=>n.id==='ref'));
  assert.ok(!pixel.edges.some(e=>e.from[0]==='ref'||e.to[0]==='ref'));
  compiler.compile(result.after);
});

test('a reference whose declaration is gone is a missing ghost; the rest still compiles',()=>{
  const g=withConstant().snapshot();g.declarations=[];
  const doc=new G.GraphDocument(g,registry),ghosts=G.ghostsOf(doc.networks.get('pixel'),G.values.policy);
  assert.equal(ghosts.nodes.get('ref'),'missing');
  assert.ok(compiler.compile(g).diagnostics.some(d=>d.node==='ref'&&/missing/.test(d.message)));
});

test('the reference node switches what it points to',()=>{
  const doc=withConstant();
  const result=doc.change(c=>{
    c.addDeclaration({id:'k2',kind:'constant',name:'kOther',type:'vec4',value:[1,1,1,1]});
    c.networks.get('pixel').node('ref').edit('declaration',{value:'k2'});
  });
  assert.equal(result.after.stages.pixel.nodes.find(n=>n.id==='ref').params.declarationId,'k2');
  const view=new G.GraphDocument(result.after,registry).networks.get('pixel');
  const presentation=view.node('ref').definition.presentation(view.node('ref').data,view.context);
  assert.equal(presentation.label,'kOther');
  assert.deepEqual(plain(presentation.inlineControls[0].options.map(o=>o.label)),['kOffset','kOther']);
});
