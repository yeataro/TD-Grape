// Library files and the built-in Library (D-2, Refactor.121; scope workspace work/refactor/d2-builtin-library-scope-2026-10-18.md):
// reading and saving the grape-subgraph format, bringing a file in the way a person pulls it, and the built-in Tint as the build packs it.
// 資源庫檔與內建資源庫：grape-subgraph 格式的讀與存、照使用者拉入的方式帶進圖、建置打包好的內建 Tint。
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
const c=vm.createContext({});vm.runInContext(fs.readFileSync(path.join(root,'src/generated/grape_core.js'),'utf8'),c);
const G=c.GrapeGraph,C=c.GrapeTopCompiler;
const bootstrap=JSON.parse(fs.readFileSync(path.join(root,'src/generated/editor-bootstrap.json'),'utf8'));
const {sharedGraph,node}=require('../fixtures/shared_subgraphs.cjs');
const plain=v=>JSON.parse(JSON.stringify(v));
const tint=()=>JSON.parse(fs.readFileSync(path.join(root,'src/library/subgraphs/tint.json'),'utf8'));
const glsl=G.createEditorContract(G.registry,'top').glslCode;
let counter=0;const ids=()=>'n'+ ++counter;
const uuid=n=>`${String(n).repeat(8)}-${String(n).repeat(4)}-4${String(n).repeat(3)}-8${String(n).repeat(3)}-${String(n).repeat(12)}`;
const empty=()=>plain(bootstrap.defaultDocument.graph);

test('the built-in Tint reads as a checked definition: Color × Tint, grape by default, pixel and vertex, both targets',()=>{
  const file=tint(),{shelf,root:id}=G.readLibraryFile(file,G.registry),f=shelf.subgraphs.find(d=>d.id===id);
  assert.equal(f.libraryId,file.subgraph.libraryId);assert.ok(G.validLibraryId(f.libraryId));
  assert.equal(f.title,'Tint');assert.equal(f.category,'color');
  assert.deepEqual(plain(f.inputs.map(p=>[p.label,p.default])),[['Color',[1,1,1,1]],['Tint',[0.7,0.3,1,1]]]);
  assert.deepEqual(plain(f.outputs.map(p=>p.label)),['Color']);
  assert.ok(f.graph.nodes.some(n=>n.nodeType==='sgrape.builtin.multiply'&&n.name==='Apply_Tint'));
  assert.deepEqual(plain(file.subgraph.stages).sort(),['pixel','vertex']);assert.deepEqual(plain(file.subgraph.targets).sort(),['mat','top']);
  assert.match(f.texts['zh-Hant'].description,/葡萄/);
});

test('saving what was read gives the same file back, Library ID kept',()=>{
  const file=tint(),read=G.readLibraryFile(file,G.registry);
  assert.deepEqual(plain(G.saveLibraryFile(read.shelf,G.registry,read.root,()=>{throw Error('no new ID')})),file);
});

test('a file comes in the way a person pulls it: a read-only copy that compiles; a second pull reuses it',()=>{
  const read=G.readLibraryFile(tint(),G.registry);let id,again;
  const doc=new G.GraphDocument(empty(),G.registry);
  const first=doc.change(m=>{id=G.bringInLibraryFile(m,read,ids);const p=m.networks.get('pixel');p.instantiateSubgraph(id,'useTint',{x:0,y:0});
    p.connect(p.node('useTint').outputs[0],p.node('pixel_out').inputs[0],G.values.policy);}).after;
  const copy=first.subgraphs.find(f=>f.id===id);
  assert.equal(copy.libraryId,tint().subgraph.libraryId);
  assert.throws(()=>new G.GraphDocument(first,G.registry).change(m=>m.subgraph(id).rename('Mine')),e=>e.code==='subgraph.readOnly');
  assert.ok(C.compile(first,glsl).pixel.includes('*'),'the multiplication is in the code');
  const second=new G.GraphDocument(first,G.registry).change(m=>{again=G.bringInLibraryFile(m,read,ids);}).after;
  assert.equal(again,id);assert.equal(second.subgraphs.length,first.subgraphs.length);
});

test('a subgraph with a nested one saves both with Library IDs, nested references by Library ID, and comes back in whole',()=>{
  const g=sharedGraph();let n=0;
  const file=G.saveLibraryFile(g,G.registry,'wrapper',()=>uuid(++n),{category:'math',description:'Wraps Gain',credits:{author:'Someone'}});
  assert.deepEqual(plain([file.subgraph.libraryId,file.dependencies.map(d=>d.libraryId)]),[uuid(1),[uuid(2)]]);
  assert.equal(file.subgraph.graph.nodes.find(x=>x.id==='inner').params.subgraphId,uuid(2),'nested reference by Library ID');
  assert.equal(file.subgraph.credits.author,'Someone');assert.equal(file.dependencies[0].description,undefined,'details go to the subgraph itself');
  for(const entry of [file.subgraph,...file.dependencies])assert.ok(!('id' in entry),'no in-graph ID in a file');
  const read=G.readLibraryFile(plain(file),G.registry);let id;
  const after=new G.GraphDocument(empty(),G.registry).change(m=>{id=G.bringInLibraryFile(m,read,ids);}).after;
  const wrapper=after.subgraphs.find(f=>f.id===id),inner=after.subgraphs.find(f=>f.libraryId===uuid(2));
  assert.equal(wrapper.graph.nodes.find(x=>x.id==='inner').params.subgraphId,inner.id);
});

test('a file is refused when it is not one, is newer, or does not hold together',()=>{
  const bad=(change,pattern)=>{const f=plain(tint());change(f);assert.throws(()=>G.readLibraryFile(f,G.registry),e=>e.code==='library.file'&&pattern.test(e.message));};
  bad(f=>{f.format='grape-graph';},/not a grape-subgraph/);
  bad(f=>{f.version=2;},/newer/);
  bad(f=>{f.subgraph.libraryId='tint';},/Library ID/);
  bad(f=>{f.subgraph.stages=['pixel'];},/stages or targets/);
  bad(f=>{f.subgraph.title='';},/Invalid definition/);
  bad(f=>{f.dependencies=[{...plain(f.subgraph),libraryId:uuid(7)}];},/nothing uses/);
  bad(f=>{f.dependencies=[plain(f.subgraph)];},/repeated/);
  bad(f=>{f.subgraph.graph.nodes.push(node('lost','subgraph_instance',{subgraphId:uuid(8)}));},/missing from the file/);
  bad(f=>{f.subgraph.category='Not A Code';},/Invalid definition/);
});

test('scoped references cannot be written into a file yet: refused, not guessed',()=>{
  const g=sharedGraph();g.subgraphs[0].outputs[0].type='float['+G.ScopeReferences.token('fn_gain',['mul','out'])+']';
  assert.throws(()=>G.saveLibraryFile(g,G.registry,'gain',()=>uuid(3)),/scoped references/);
});

test('a Library ID is a version 4 UUID made from the random bytes given',()=>{
  const id=G.libraryIdFrom(new Uint8Array(16).fill(255));
  assert.ok(G.validLibraryId(id));assert.equal(id[14],'4');assert.match(id[19],/[89ab]/);
  assert.throws(()=>G.libraryIdFrom(new Uint8Array(8)));
});

test('the build packs the built-in Library: the files as written, and a wire-drop row per subgraph on its own ports',()=>{
  const files=fs.readdirSync(path.join(root,'src/library/subgraphs')).filter(f=>f.endsWith('.json')).sort()
    .map(f=>JSON.parse(fs.readFileSync(path.join(root,'src/library/subgraphs',f),'utf8')));
  assert.deepEqual(bootstrap.library.files,files);
  const file=tint(),row=bootstrap.library.wireDrop['library:'+file.subgraph.libraryId];
  assert.equal(row.output.vec4.port,file.subgraph.inputs[0].id,'a vec4 wire goes into Color');
  assert.equal(row.input.vec4.port,file.subgraph.outputs[0].id,'Color comes out');
  assert.ok(!fs.existsSync(path.join(root,'src/library/builtin_subgraphs.json')),'the old format is gone');
});

// ---- Codex review of R.121 (R121-1..4) Codex 對 R.121 的審查 ----
const rules=G.createEditorContract(G.registry,'top').glslCode;
const verify=file=>G.verifyLibraryFile(file,G.registry,bootstrap.defaultDocument.graph,C,rules);
const nested=()=>{let n=0;return plain(G.saveLibraryFile(sharedGraph(),G.registry,'wrapper',()=>uuid(++n)));};
test('R121-1: a nested interface default its type does not take is refused when read, and the build check refuses it too',()=>{
  for(const side of ['inputs','outputs']){
    const file=nested();file.dependencies[0][side][0].default=['bad'];
    assert.throws(()=>G.readLibraryFile(file,G.registry),e=>e.code==='library.file'&&/Invalid interface/.test(e.message),side);
    assert.throws(()=>verify(file),e=>e.code==='library.file',side);
  }
  const unknown=nested();unknown.subgraph.inputs[0].type='notAType';
  assert.throws(()=>G.readLibraryFile(unknown,G.registry),/unknown type|Invalid/);
});

test('R121-2: a file reads in the tidy form a graph keeps, so a copy brought in equals it, a second pull reuses it and an update settles',()=>{
  const file=plain(tint());
  file.subgraph.graph.ui={groups:[{id:'groupA',name:'Group',nodes:file.subgraph.graph.nodes.slice(0,2).map(x=>x.id),textScale:1}]};
  const read=G.readLibraryFile(file,G.registry);let id;
  const first=new G.GraphDocument(empty(),G.registry).change(m=>{id=G.bringInLibraryFile(m,read,ids);}).after;
  assert.equal(G.standardForm(first,G.registry,id),G.standardForm(read.shelf,G.registry,read.root),'the copy brought in equals the shelf');
  const again=new G.GraphDocument(first,G.registry).change(m=>{G.bringInLibraryFile(m,read,ids);}).after;
  assert.equal(again.subgraphs.length,first.subgraphs.length,'a second pull reuses it');
  assert.deepEqual(plain(G.repairLibraryCopies(first,G.registry,read.shelf,ids,{versions:'update'}).differing),[],'nothing differs from the Library');
  // Such a file is not in the form saving writes: the build check asks for it to be saved again. 這種檔不是存檔寫出的樣子：建置要求重存。
  assert.throws(()=>verify(file),/not in the form saving writes/);
  const noEdgeId=plain(tint());noEdgeId.subgraph.graph.edges[0].id='';
  assert.throws(()=>G.readLibraryFile(noEdgeId,G.registry),/edge is missing its id/);
});

test('R121-3: a definition made local and saved as a new Library subgraph keeps its provenance in the file and when read back',()=>{
  const read=G.readLibraryFile(tint(),G.registry);let id;
  const first=new G.GraphDocument(empty(),G.registry).change(m=>{id=G.bringInLibraryFile(m,read,ids);}).after;
  const local=new G.GraphDocument(first,G.registry).change(m=>{m.makeLocal(id,()=>{throw Error('in place');},'2026-10-18T00:00:00.000Z');}).after;
  const origin=plain(local.subgraphs.find(f=>f.id===id).provenance);
  assert.equal(origin[0].libraryId,tint().subgraph.libraryId);
  const saved=G.saveLibraryFile(local,G.registry,id,()=>uuid(9));
  assert.equal(saved.subgraph.libraryId,uuid(9));assert.deepEqual(plain(saved.subgraph.provenance),origin);
  const back=G.readLibraryFile(plain(saved),G.registry);
  assert.deepEqual(plain(back.shelf.subgraphs[0].provenance),origin);
});

test('R121-4: what saving refuses, reading refuses too: a scoped reference keeps a file out',()=>{
  const file=plain(tint());
  file.subgraph.graph.nodes.find(x=>x.id==='multiply').params.extra={type:'float['+G.ScopeReferences.token('fn_L0',['multiply','out'])+']'};
  assert.throws(()=>G.readLibraryFile(file,G.registry),/scoped references/);
});

test('the build check passes Tint with the row the bootstrap holds, and refuses files the build must stop on',()=>{
  const file=tint();
  assert.deepEqual(plain(verify(file)),bootstrap.library.wireDrop['library:'+file.subgraph.libraryId]);
  const wrongStages=plain(file);wrongStages.subgraph.stages=['pixel'];
  assert.throws(()=>verify(wrongStages),/stages or targets/);
  const badName=plain(file);badName.subgraph.title='';
  assert.throws(()=>verify(badName),/Invalid definition/);
  const missing=plain(file);missing.subgraph.graph.nodes.push(node('lost','subgraph_instance',{subgraphId:uuid(8)}));
  assert.throws(()=>verify(missing),/missing from the file/);
});

// ---- Codex check of R.121.1: the closure usability gate, and the latest provenance (Refactor.121.2) Codex 核對 R.121.1 ----
test('the build check refuses a file whose subgraph reads and compiles but uses a definition this host cannot use',()=>{
  // A vertex-only node inside the nested definition: in a TOP pixel host the child is a ghost, compile still passes. 巢狀定義裡放只能用在
  // vertex 的節點：在 TOP 的 pixel 宿主裡那份是 Ghost，產碼照樣通過。
  const base=G.registry.get('sgrape.builtin.multiply');
  const vertexOnly={...base,catalog:{...base.catalog,definition:{...base.catalog.definition,key:'test_vertex',nodeType:'test.vertex',stages:['vertex']}}};
  const registry=G.createRegistry([...G.registry.modules,vertexOnly]),compiler=G.createCompiler(registry);
  const g=sharedGraph();g.subgraphs[0].graph.nodes.find(x=>x.id==='mul').nodeType='test.vertex';
  let n=0;const file=plain(G.saveLibraryFile(g,registry,'wrapper',()=>uuid(++n)));
  assert.ok(G.readLibraryFile(file,registry),'the file itself reads');
  assert.throws(()=>G.verifyLibraryFile(file,registry,bootstrap.defaultDocument.graph,compiler,G.createEditorContract(registry,'top').glslCode),/cannot be used/);
});

test('provenance keeps the latest Library a definition came from — an editing reference, not a lineage (human 10-18)',()=>{
  const at='2026-10-18T00:00:00.000Z',localOf=(read,newId)=>{let id;
    const brought=new G.GraphDocument(empty(),G.registry).change(m=>{id=G.bringInLibraryFile(m,read,ids);}).after;
    return {doc:new G.GraphDocument(brought,G.registry).change(m=>{m.makeLocal(id,()=>{throw Error('in place');},at);}).after,id};};
  const first=localOf(G.readLibraryFile(tint(),G.registry));
  const republished=G.saveLibraryFile(first.doc,G.registry,first.id,()=>uuid(5));
  const second=localOf(G.readLibraryFile(plain(republished),G.registry));
  const origin=second.doc.subgraphs.find(f=>f.id===second.id).provenance;
  assert.equal(origin.length,1);assert.equal(origin[0].libraryId,uuid(5),'the republished one, not Tint');
});
