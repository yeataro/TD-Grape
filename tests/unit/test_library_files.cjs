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
