// Color Output takes any value and fills it to a colour (Refactor.42; design-interview Q46):
// single value (v,v,v,1), vec2 (x,y,0.5,1), vec3 (r,g,b,1), vec4 as it is; int and bool alike.
// Color Output 什麼都能接、自動補齊；vec4 與既有的圖產碼完全不變。
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const context=vm.createContext({});vm.runInContext(fs.readFileSync(path.join(__dirname,'../../src/generated/grape_core.js'),'utf8'),context);
const G=context.GrapeGraph,compiler=context.GrapeTopCompiler,registry=G.registry;
const plain=v=>JSON.parse(JSON.stringify(v));
const bootstrap=JSON.parse(fs.readFileSync(path.join(__dirname,'../../src/generated/editor-bootstrap.json'),'utf8'));

function wired(node,port){
  const doc=new G.GraphDocument(plain(bootstrap.defaultDocument.graph),registry);
  return doc.change(c=>{
    const net=c.networks.get('pixel'),output=net.nodes.find(n=>n.data.nodeType==='sgrape.builtin.pixel_out');
    net.insert({id:'src',ui:{},...node});
    net.connect(port?net.node('src').port('output',port):net.node('src').outputs[0],output.port('input','color'),G.values.policy);
  }).after;
}
const colorLine=g=>compiler.compile(g).pixel.split('\n').find(l=>l.includes('sg_color ='));
const outputType=g=>g.stages.pixel.nodes.find(n=>n.nodeType==='sgrape.builtin.pixel_out').params.type;

test('vec2 becomes (x, y, 0.5, 1)',()=>{
  const g=wired({nodeType:'sgrape.builtin.td_value',params:{entry:'vUV'}},'uv');
  assert.equal(outputType(g),'vec2');
  assert.equal(colorLine(g),'    vec4 sg_color = vec4(vec2(sg_n_src_uv), 0.5, 1.0);');
});
test('a single value becomes (v, v, v, 1); int and bool alike',()=>{
  assert.equal(colorLine(wired({nodeType:'sgrape.builtin.scalar',params:{type:'float',value:0.25}})),'    vec4 sg_color = vec4(vec3(float(sg_n_src)), 1.0);');
  assert.equal(colorLine(wired({nodeType:'sgrape.builtin.td_value',params:{entry:'uTDPass'}})),'    vec4 sg_color = vec4(vec3(float(sg_n_src)), 1.0);');
  assert.equal(colorLine(wired({nodeType:'sgrape.builtin.td_value',params:{entry:'glFrontFacing'}})),'    vec4 sg_color = vec4(vec3(float(sg_n_src)), 1.0);');
});
test('vec3 becomes (r, g, b, 1)',()=>{
  assert.equal(colorLine(wired({nodeType:'sgrape.builtin.td_value',params:{entry:'vUV'}},'uvw')),'    vec4 sg_color = vec4(vec3(sg_n_src_uvw), 1.0);');
});
test('vec4 and graphs stored before this change generate exactly what they did',()=>{
  const g=plain(bootstrap.defaultDocument.graph);
  assert.equal(outputType(g),undefined);
  assert.match(colorLine(g),/^    vec4 sg_color = sg_n_color;$/);
  // An old float wire into the vec4 input keeps its old conversion. 舊的 float 接線照舊轉換。
  g.stages.pixel.nodes.push({id:'old',nodeType:'sgrape.builtin.scalar',params:{type:'float',value:0.5},ui:{}});
  g.stages.pixel.edges.find(e=>e.to[0]==='pixel_out').from=['old','out'];
  assert.equal(colorLine(g),'    vec4 sg_color = vec4(sg_n_old);');
});
