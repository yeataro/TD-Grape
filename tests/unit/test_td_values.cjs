// TD built-in values (Refactor.41; design-interview Q45 01, Q46; discuss-4.14 §10–11).
// TD 內建值：一個節點類型選表裡一筆；不認得或這個版本還接不了的是 Ghost。
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const context=vm.createContext({});vm.runInContext(fs.readFileSync(path.join(__dirname,'../../src/generated/grape_core.js'),'utf8'),context);
const G=context.GrapeGraph,compiler=context.GrapeTopCompiler,registry=G.registry;
const plain=v=>JSON.parse(JSON.stringify(v));
const bootstrap=JSON.parse(fs.readFileSync(path.join(__dirname,'../../src/generated/editor-bootstrap.json'),'utf8'));

function withEntry(entry){
  const doc=new G.GraphDocument(plain(bootstrap.defaultDocument.graph),registry);
  return doc.change(c=>{
    const net=c.networks.get('pixel'),output=net.nodes.find(n=>n.data.nodeType==='sgrape.builtin.pixel_out');
    net.insert({id:'td',nodeType:'sgrape.builtin.td_value',params:{entry},ui:{}});
    // Through Length (vector -> float), which Color Output accepts. 經 Length 轉成 float 再接到輸出。
    const type=net.node('td').outputs[0].type;
    net.insert({id:'len',nodeType:'sgrape.builtin.length',params:{type},ui:{}});
    net.connect(net.node('td').outputs[0],net.node('len').port('input','value'),G.values.policy);
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
  for(const name of ['vUV.st','vUV','uTDOutputInfo.res.zw','gl_FragCoord','TDPos'])assert.ok(G.tdValues.some(e=>e.name===name),name);
});

test('vUV.st and vUV are read straight from TD; no declaration, no binding',()=>{
  const st=compiler.compile(withEntry('vUVSt'));
  assert.match(st.pixel,/vec2 sg_n_td = vUV\.st;/);
  assert.deepEqual(plain(st.bindings),[]);
  assert.match(compiler.compile(withEntry('vUV')).pixel,/vec3 sg_n_td = vUV;/);
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
  const g=withEntry('vUVSt'),doc=new G.GraphDocument(g,registry);
  const after=doc.change(c=>c.networks.get('pixel').node('td').edit('entry',{value:'glFragCoord'})).after;
  assert.equal(after.stages.pixel.nodes.find(n=>n.id==='td').params.entry,'glFragCoord');
  const net=new G.GraphDocument(after,registry).networks.get('pixel'),node=net.node('td');
  const view=node.definition.presentation(node.data,net.context);
  assert.equal(view.label,'gl_FragCoord');
  const offered=view.inlineControls[0].options.map(o=>o.value);
  assert.ok(offered.includes('vUVSt')&&!offered.includes('tdNormal')&&!offered.includes('sTD2DInputs'));
  assert.throws(()=>doc.change(c=>c.networks.get('pixel').node('td').edit('entry',{value:'tdNormal'})));
});
