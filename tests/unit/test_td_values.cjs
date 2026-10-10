// TD built-in values (Refactor.41; design-interview Q45 01, Q46; discuss-4.14 §10–11).
// TD 內建值：一個節點類型選表裡一筆；不認得或這個版本還接不了的是 Ghost。
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const context=vm.createContext({});vm.runInContext(fs.readFileSync(path.join(__dirname,'../../src/generated/grape_core.js'),'utf8'),context);
const G=context.GrapeGraph,compiler=context.GrapeTopCompiler,registry=G.registry;
const plain=v=>JSON.parse(JSON.stringify(v));
const bootstrap=JSON.parse(fs.readFileSync(path.join(__dirname,'../../src/generated/editor-bootstrap.json'),'utf8'));

function withEntry(entry,port){
  const doc=new G.GraphDocument(plain(bootstrap.defaultDocument.graph),registry);
  return doc.change(c=>{
    const net=c.networks.get('pixel'),output=net.nodes.find(n=>n.data.nodeType==='sgrape.builtin.pixel_out');
    net.insert({id:'td',nodeType:'sgrape.builtin.td_value',params:{entry},ui:{}});
    // Through Length (vector -> float), which Color Output accepts. 經 Length 轉成 float 再接到輸出。
    const from=port?net.node('td').port('output',port):net.node('td').outputs[0],type=from.type;
    net.insert({id:'len',nodeType:'sgrape.builtin.length',params:{type},ui:{}});
    net.connect(from,net.node('len').port('input','value'),G.values.policy);
    net.connect(net.node('len').outputs[0],output.port('input','color'),G.values.policy);
  }).after;
}

test('the table: ids are stable codes, unique, and every entry says where it can be used',()=>{
  const ids=G.tdValues.map(e=>e.id);
  assert.equal(new Set(ids).size,ids.length);
  for(const e of G.tdValues){
    assert.match(e.id,/^[a-z][a-zA-Z0-9]*$/,e.name);
    assert.ok(e.targets.length&&e.expression&&e.type&&e.hint,e.name);
  }
  for(const name of ['vUV','uTDOutputInfo.res.zw','gl_FragCoord','TDPos'])assert.ok(G.tdValues.some(e=>e.name===name),name);
});

// One UV node with three outputs (Refactor.64, human 2026-10-10): U, UV, UVW read vUV.s, vUV.st, vUV.stp.
// 一個 UV 節點、三個輸出：U、UV、UVW 讀 vUV.s、vUV.st、vUV.stp。
test('vUV has U, UV and UVW outputs, read straight from TD; no declaration, no binding',()=>{
  const st=compiler.compile(withEntry('vUV','uv'));
  assert.match(st.pixel,/vec2 sg_n_td_uv = vUV\.st;/);
  assert.ok(!plain(st.bindings).some(d=>d.kind!=='topInput'),'only the default texture input is a binding');
  assert.match(compiler.compile(withEntry('vUV','u')).pixel,/float sg_n_td_u = vUV\.s;/);
  assert.match(compiler.compile(withEntry('vUV','uvw')).pixel,/vec3 sg_n_td_uvw = vUV\.stp;/);
  const net=new G.GraphDocument(withEntry('vUV','uv'),registry).networks.get('pixel'),node=net.node('td');
  assert.deepEqual(plain(node.outputs.map(p=>[p.key,p.type])),[['u','float'],['uv','vec2'],['uvw','vec3']]);
  const view=node.definition.presentation(node.data,net.context);
  assert.deepEqual(plain(view.portLabels.outputs),{u:'U',uv:'UV',uvw:'UVW'});
  assert.deepEqual(plain(view.components.outputs),{u:[0],uv:[0,1],uvw:[0,1,2]});
  assert.match(compiler.compile(withEntry('uTDOutputInfoResZw')).pixel,/vec2 sg_n_td = uTDOutputInfo\.res\.zw;/);
});

test('an entry this build cannot carry yet, a MAT-only entry in a TOP, and an unknown entry are ghosts',()=>{
  for(const entry of ['sTD2DInputs','tdNormal','vendorFuture']){
    const g=plain(bootstrap.defaultDocument.graph);
    g.stages.pixel.nodes.push({id:'td',nodeType:'sgrape.builtin.td_value',params:{entry},ui:{}});
    const ghosts=G.ghostsOf(new G.GraphDocument(g,registry).networks.get('pixel'),G.values.policy);
    assert.equal(ghosts.nodes.get('td'),'unknown',entry);
    compiler.compile(g);
  }
});

test('the node switches entries and offers only what this target can use',()=>{
  const g=withEntry('vUV','uv'),doc=new G.GraphDocument(g,registry);
  const after=doc.change(c=>c.networks.get('pixel').node('td').edit('entry',{value:'glFragCoord'})).after;
  assert.equal(after.stages.pixel.nodes.find(n=>n.id==='td').params.entry,'glFragCoord');
  const net=new G.GraphDocument(after,registry).networks.get('pixel'),node=net.node('td');
  const view=node.definition.presentation(node.data,net.context);
  assert.equal(view.label,'gl_FragCoord');
  const offered=view.inlineControls[0].options.map(o=>o.value);
  assert.ok(offered.includes('vUV')&&!offered.includes('vUVSt')&&!offered.includes('tdNormal')&&!offered.includes('sTD2DInputs'));
  assert.throws(()=>doc.change(c=>c.networks.get('pixel').node('td').edit('entry',{value:'tdNormal'})));
});
