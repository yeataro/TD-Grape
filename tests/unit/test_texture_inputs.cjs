// TOP texture inputs (Refactor.43; graph-structure decision 5, Q44; texture-inputs.md): a declaration
// kind, every one goes to TD in list order, the GLSL index is its position; textures are passed
// as they are; Texture 2D samples, opaque black without a texture.
// TOP 貼圖輸入：宣告的一種；全部照清單順序交給 TD，GLSL 索引是位置；貼圖原樣代入；沒接貼圖＝不透明黑。
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const context=vm.createContext({});vm.runInContext(fs.readFileSync(path.join(__dirname,'../../src/generated/grape_core.js'),'utf8'),context);
const G=context.GrapeGraph,compiler=context.GrapeTopCompiler,registry=G.registry;
const plain=v=>JSON.parse(JSON.stringify(v));
const bootstrap=JSON.parse(fs.readFileSync(path.join(__dirname,'../../src/generated/editor-bootstrap.json'),'utf8'));
const policy=G.values.policy;

// Default graph + a second input; Texture 2D samples `which` into Color Output.
// 預設圖再加一個輸入；Texture 2D 取樣 which 接到 Color Output。
function sampling(which='input2',{wireTexture=true,uv}={}){
  const doc=new G.GraphDocument(plain(bootstrap.defaultDocument.graph),registry);
  return new G.GraphDocument(doc.change(c=>{
    c.addDeclaration({id:'input2',kind:'topInput',name:'photo',type:'sampler2D',defaultTexture:'banana'});
    const net=c.networks.get('pixel'),output=net.nodes.find(n=>n.data.nodeType==='sgrape.builtin.pixel_out');
    net.insert({id:'ref',nodeType:'sgrape.builtin.declaration',params:{declarationId:which},ui:{}});
    net.insert({id:'tex',nodeType:'sgrape.builtin.texture_sample',params:{},ui:{}});
    if(wireTexture)net.connect(net.node('ref').port('output','out'),net.node('tex').port('input','sampler'),policy);
    if(uv){net.insert({id:'uv',nodeType:'sgrape.builtin.td_value',params:{entry:uv},ui:{}});
      net.connect(net.node('uv').outputs[0],net.node('tex').port('input','uv'),policy);}
    net.connect(net.node('tex').outputs[0],output.port('input','color'),policy);
  }).after,registry);
}

test('a new graph has one texture input, input1, with Grape as its default image (human 2026-10-09)',()=>{
  const g=bootstrap.defaultDocument.graph;
  assert.deepEqual(plain(g.declarations),[{id:'input1',kind:'topInput',name:'input1',type:'sampler2D',defaultTexture:'grape'}]);
  const compiled=bootstrap.defaultDocument.compiled;
  assert.deepEqual(plain(compiled.bindings).map(d=>d.id),['input1'],'every input goes to TD, used or not');
  assert.doesNotMatch(compiled.pixel,/sTD2DInputs/,'an unused input adds no GLSL');
});

test('the GLSL index is the position among texture inputs; the texture is written where it is used',()=>{
  const result=compiler.compile(sampling('input2').snapshot());
  assert.match(result.pixel,/vec4 sg_n_tex = texture\(sTD2DInputs\[1\], vUV\.st\);/);
  assert.doesNotMatch(result.pixel,/sampler2D sg_/,'GLSL cannot keep a texture in a local variable');
  assert.deepEqual(plain(result.bindings).map(d=>[d.id,d.defaultTexture]),[['input1','grape'],['input2','banana']]);
  assert.match(compiler.compile(sampling('input1').snapshot()).pixel,/texture\(sTD2DInputs\[0\], vUV\.st\)/);
});

test('size and pixel size of the same input',()=>{
  const doc=sampling('input2');
  const g=doc.change(c=>{const net=c.networks.get('pixel'),output=net.nodes.find(n=>n.data.nodeType==='sgrape.builtin.pixel_out');
    net.connect(net.node('ref').port('output','size'),output.port('input','color'),policy);}).after;
  const pixel=compiler.compile(g).pixel;
  assert.match(pixel,/vec2 sg_n_ref_size = uTD2DInfos\[1\]\.res\.zw;/);
  assert.match(pixel,/vec2 sg_n_ref_pixelSize = uTD2DInfos\[1\]\.res\.xy;/);
});

test('a wired coordinate is used; without a texture the result is opaque black',()=>{
  assert.match(compiler.compile(sampling('input2',{uv:'uTDOutputInfoResZw'}).snapshot()).pixel,/texture\(sTD2DInputs\[1\], sg_n_uv\)/);
  assert.match(compiler.compile(sampling('input2',{wireTexture:false}).snapshot()).pixel,/vec4 sg_n_tex = vec4\(0\.0, 0\.0, 0\.0, 1\.0\);/);
});

test('a texture connects only to a texture input; values never connect to it',()=>{
  const net=sampling('input2').networks.get('pixel');
  // The editor treats a refusal (false or an error) the same way. 編輯器把回傳 false 或丟錯都當成不能接。
  const wire=(from,to)=>{try{return net.plan(policy,{kind:'wire',from,to}).ok;}catch{return false;}};
  assert.equal(wire({node:'ref',port:'out'},{node:'tex',port:'uv'}),false);
  assert.equal(wire({node:'ref',port:'size'},{node:'tex',port:'sampler'}),false);
  assert.equal(wire({node:'ref',port:'out'},{node:'pixel_out',port:'color'}),false,'Color Output takes values, not textures');
  assert.equal(wire({node:'ref',port:'out'},{node:'tex',port:'sampler'}),true);
});

test('default image and name can change; other fields are refused',()=>{
  const doc=sampling('input2');
  const after=doc.change(c=>c.changeDeclaration('input2',{defaultTexture:'normal',name:'photo2'})).after;
  assert.deepEqual(plain(after.declarations[1]),{id:'input2',kind:'topInput',name:'photo2',type:'sampler2D',defaultTexture:'normal'});
  assert.throws(()=>doc.change(c=>c.changeDeclaration('input2',{defaultTexture:'moon'})),/Unknown default texture/);
  assert.throws(()=>doc.change(c=>c.changeDeclaration('input2',{value:1})),e=>e.problem==='field');
  assert.throws(()=>doc.change(c=>c.changeDeclaration('input2',{type:'vec4'})),e=>e.problem==='type');
  assert.equal(G.freeDeclarationName(after,'input'),'input2');
});

test('a reference switches only among texture inputs; deleting an input moves the later ones up',()=>{
  const doc=sampling('input2'),view=doc.networks.get('pixel');
  const options=view.node('ref').definition.presentation(view.node('ref').data,view.context).inlineControls[0].options;
  assert.deepEqual(plain(options.map(o=>o.value)),['input1','input2']);
  const removed=doc.change(c=>c.removeDeclaration('input1')).after;
  const result=compiler.compile(removed);
  assert.match(result.pixel,/texture\(sTD2DInputs\[0\], vUV\.st\)/);
  assert.deepEqual(plain(result.bindings).map(d=>d.id),['input2']);
});
