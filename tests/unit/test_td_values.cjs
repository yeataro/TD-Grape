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

// Each TD built-in value has its own stages (tdPos only in Vertex): a node and a subgraph holding it follow the entry, not the node
// type (CURRENT D-3 item 2, Codex R.121 review; Refactor.122). TOP graphs never meet it: every entry a TOP can use allows Pixel.
// 每個 TD 內建值有自己的 Stage（tdPos 只在 Vertex）：節點與裝著它的子圖照那一項，不照節點類型。TOP 圖碰不到：TOP 用得到的項目都允許 Pixel。
test('a TD built-in value follows its own entry\'s stages, at the top level and inside a subgraph',()=>{
  assert.ok(G.tdValues.filter(e=>e.targets.includes('top')).every(e=>e.stages.includes('pixel')),'every TOP entry allows Pixel');
  const value=(id,entry)=>({id,nodeType:'sgrape.builtin.td_value',params:{entry},ui:{x:0,y:0}});
  const g={format:'grape-graph',version:1,target:'mat',declarations:[],
    subgraphs:[{id:'pos',title:'Pos',inputs:[],outputs:[],graph:{nodes:[value('p','tdPos')],edges:[]}}],
    stages:{vertex:{nodes:[value('v','tdPos')],edges:[]},pixel:{nodes:[value('f','tdPos'),value('ok','glFragCoord')],edges:[]}}};
  assert.deepEqual(plain(G.subgraphStages(g,'pos',registry)),['vertex'],'a subgraph holding tdPos is a Vertex subgraph');
  const doc=new G.GraphDocument(g,registry),ghosts=net=>G.ghostsOf(doc.networks.get(net),G.values.policy).nodes;
  assert.equal(ghosts('pixel').get('f'),'misplaced','tdPos at the top of Pixel is misplaced');
  assert.equal(ghosts('pixel').has('ok'),false,'a Pixel entry in Pixel is fine');
  assert.equal(ghosts('vertex').has('v'),false,'tdPos in Vertex is fine');
  // A subgraph's stages are its content's alone, whatever document holds it (Codex R122-1, Refactor.122.1): an entry this target cannot
  // use still narrows them (R.122 let it set no limit; that made a Library file read back other stages than it was saved with). Its
  // instance in a TOP's Pixel is then a misplaced ghost; inside, the entry stays an unknown ghost. 子圖的 Stage 只看內容、不看文件：這個
  // target 用不了的項目也照樣收窄（R.122 曾讓它不設限制，Library 檔因此讀回的 Stage 和存的不同）。它的實例在 TOP 的 Pixel 是放錯的 Ghost。
  const top={...plain(bootstrap.defaultDocument.graph),subgraphs:[{id:'normal',title:'Normal',inputs:[],outputs:[],graph:{nodes:[value('n','tdNormal')],edges:[]}}]};
  assert.deepEqual(plain(G.subgraphStages(top,'normal',registry)),['vertex']);
  assert.deepEqual(plain(G.subgraphStages({...g,subgraphs:top.subgraphs},'normal',registry)),['vertex'],'the same in a MAT document');
});
