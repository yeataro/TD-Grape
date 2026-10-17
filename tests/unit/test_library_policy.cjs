// The Library version policy at its edges (amendment 3, Refactor.119.2): cases Codex checked by probe in its review of R.119.1
// (workspace work/refactor/r1191-review/entry-gaps.cjs, open-batch-boundary.cjs), fixed here as regression tests before R.120 changes
// standard forms and capacity. Library 版本政策的邊界：Codex 核對 R.119.1 時用探針驗過的案例，在 R.120 改標準形與容量之前固定成回歸測試。
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const c=vm.createContext({});vm.runInContext(fs.readFileSync(require.resolve('../../src/generated/grape_core.js'),'utf8'),c);
const {GraphDocument,registry}=c.GrapeGraph;
const {sharedGraph,node,port}=require('../fixtures/shared_subgraphs.cjs');
const plain=v=>JSON.parse(JSON.stringify(v));
const at='2026-10-17T00:00:00.000Z';
const L1='11111111-1111-4111-8111-111111111111',L2='22222222-2222-4222-8222-222222222222';
const lib=n=>`${n.repeat(8)}-${n.repeat(4)}-4${n.repeat(3)}-8${n.repeat(3)}-${n.repeat(12)}`;
const def=(g,id)=>g.subgraphs.find(f=>f.id===id),doc=g=>new GraphDocument(g,registry);
const leaf=(id,L=L1)=>{const f=plain(sharedGraph().subgraphs[0]);f.id=id;if(L)f.libraryId=L;return f;};
const parent=(id,ref,L=L2)=>{const f=plain(sharedGraph().subgraphs[1]);f.id=id;f.graph.nodes.find(n=>n.id==='inner').params.subgraphId=ref;if(L)f.libraryId=L;return f;};
function graph(defs,roots=[]){const g=sharedGraph();g.subgraphs=defs;g.stages.pixel.edges=[];g.stages.pixel.nodes=[...roots.map((ref,i)=>node('call'+i,'subgraph_instance',{subgraphId:ref})),node('output','pixel_out')];return g;}
// Opening without a Library: only duplicates are settled, and nothing new is ever allocated. 沒有資源庫的開圖：只整理重複，不配新 ID。
function repair(g,choice={}){let made=0;const r=c.GrapeGraph.repairLibraryCopies(g,registry,undefined,()=>'new'+ ++made,choice,at);assert.equal(made,0);return r;}

test('C4 then B3: a pasted root that closes a cycle after the entry is refused as a whole, whichever version is taken',()=>{
  for(const conflicts of ['keep','incoming']){
    const oldD=leaf('D'),newD=leaf('D');newD.graph.nodes[1].inputValues.b=5;
    const target=graph([parent('A','B',null),leaf('B',null),oldD]);
    const source=graph([parent('A','B',null),leaf('B',null),parent('C','D'),newD],['A','C']);
    const clip=plain(c.GrapeGraph.copyNodes(doc(source),['call0','call1'],'same')),clipWas=plain(clip),base=doc(target),was=plain(base.snapshot());
    let n=0,d=0,reached=false;
    // A is still here, so its root is kept by ID (B3) inside B: A→B→A. A 還在，根照 ID 沿用，貼進 B 裡就成環。
    assert.throws(()=>base.change(m=>{c.GrapeGraph.pasteClip(m,clip,{x:0,y:0},()=>'p'+ ++n,()=>'group','subgraph:B',()=>'fresh'+ ++d,true,{conflicts});reached=true;}),/cycle/i);
    assert.ok(reached,'the paste itself ran; the end of the edit refused it');
    assert.deepEqual(plain(base.snapshot()),was);assert.deepEqual(clip,clipWas);
    // Without the root that closes the cycle the same entry passes. 拿掉成環的那個根，同樣的進圖就通過。
    const control=plain(c.GrapeGraph.copyNodes(doc(source),['call1'],'same'));n=0;d=0;
    const after=base.change(m=>c.GrapeGraph.pasteClip(m,control,{x:0,y:0},()=>'p'+ ++n,()=>'group','subgraph:B',()=>'fresh'+ ++d,true,{conflicts})).after;
    assert.ok(def(after,'B').graph.nodes.some(x=>x.id==='p1'));
    assert.equal(def(after,'D').graph.nodes[1].inputValues.b,conflicts==='incoming'?5:3);
  }
});

test('C3: the copy kept by default may go local too when it uses one of its own duplicates — C2 is at most one, not at least one',()=>{
  for(const reverse of [false,true]){
    const defs=[parent('B1','B2',L1),leaf('B2')];if(reverse)defs.reverse();
    const before=graph(defs,['B1']),was=plain(before),r=repair(before);
    assert.deepEqual(plain(r.localized).sort(),['B1','B2']);assert.deepEqual(plain([...r.merged]),[]);
    assert.deepEqual(plain(r.document.subgraphs.map(f=>f.id)).sort(),['B1','B2'],'both stay, nothing merged away');
    assert.deepEqual(plain(r.differing),[]);assert.deepEqual(plain(r.updated),[],'no Library: no version work');
    assert.ok(r.document.subgraphs.every(f=>f.libraryId===undefined&&f.provenance[0].libraryId===L1));
    assert.equal(def(r.document,'B1').graph.nodes.find(n=>n.id==='inner').params.subgraphId,'B2','in-graph IDs and references stay');
    assert.deepEqual(before,was);
  }
});

test('C3: with no instances at all the kept copy is the smallest in-graph ID, whatever the list order, content or choice',()=>{
  for(const reverse of [false,true]) for(const different of [false,true]) for(const duplicates of ['merge','separate']){
    const defs=[leaf('B1'),leaf('B2')];if(different)defs[1].graph.nodes[1].inputValues.b=5;if(reverse)defs.reverse();
    const before=graph(defs),was=plain(before),r=repair(before,{duplicates}),merged=!different&&duplicates==='merge';
    assert.equal(def(r.document,'B1').libraryId,L1);assert.deepEqual(before,was);
    assert.deepEqual(plain([...r.merged]),merged?[['B2','B1']]:[]);
    assert.deepEqual(plain(r.localized),merged?[]:['B2']);
    assert.equal(r.document.subgraphs.length,merged?1:2,'the document matches what is reported');
    if(!merged)assert.equal(def(r.document,'B2').libraryId,undefined,'B2 really lost its Library ID');
  }
});

test('R119-2 with a changed type: a root kept by ID keeps a vec2 value fitted to the interface after the entry',()=>{
  const source=graph([leaf('gain'),parent('wrapper','gain')],['gain','wrapper']);
  def(source,'gain').inputs=[port('value','vec2',[1,1])];source.stages.pixel.nodes[0].inputValues={value:[7,9]};
  const clip=plain(c.GrapeGraph.copyNodes(doc(source),['call0','call1'],'same'));let n=0,d=0;
  const after=doc(graph([leaf('gain')])).change(m=>c.GrapeGraph.pasteClip(m,clip,{x:0,y:0},()=>'p'+ ++n,()=>'group','pixel',()=>'fresh'+ ++d,true,{conflicts:'incoming'})).after;
  const pasted=after.stages.pixel.nodes.find(x=>x.id==='p1');
  assert.equal(pasted.params.subgraphId,'gain');assert.deepEqual(plain(pasted.inputValues),{value:[7,9]});
  assert.equal(def(after,'gain').inputs[0].type,'vec2');
});

// ---- The batch boundary at open: what comes in whole keeps its names, values and wires; what was here follows. 開圖的 batch 邊界 ----
const edge=(id,from,to)=>({id,from,to});
function bLeaf(id,n,oldTitle,fresh=false){
  const input=fresh?'amount':'value',output=fresh?'updated':'result',type=fresh?'vec2':'float',value=fresh?[0,0]:0;
  return {id,title:fresh?(n==='1'?'Blur':'Sharp'):oldTitle,libraryId:lib(n),inputs:[port(input,type,value),port('keep',type,value)],outputs:[port(output,type,value)],
    graph:{nodes:[node('in','subgraph_input'),node('out','subgraph_output')],edges:[edge('through',['in',input],['out',output])]}};
}
function bParent(id,n,refs,fresh=false){
  const f={id,title:id.replace(/^lib/,''),inputs:[port('value',fresh?'vec2':'float',fresh?[1,1]:1)],outputs:refs.map((_,i)=>port('out'+i,fresh?'vec2':'float',fresh?[0,0]:0)),
    graph:{nodes:[node('in','subgraph_input'),node('out','subgraph_output')],edges:[]}};
  if(n)f.libraryId=lib(n);
  refs.forEach((r,i)=>{
    const call=node('call'+i,'subgraph_instance',{subgraphId:r});
    call.name=(r.includes('D')?'Detail':'Gain')+'_1';call.inputValues=fresh?{amount:[9,10],keep:[7,8]}:{value:9,keep:3};
    f.graph.nodes.push(call);
    f.graph.edges.push(edge('entry'+i,['in','value'],[call.id,fresh?'amount':'value']),edge('exit'+i,[call.id,fresh?'updated':'result'],['out','out'+i]),edge('keep'+i,['in','value'],[call.id,'keep']));
  });
  return f;
}
function bGraph(defs){return {format:'grape-graph',version:1,target:'top',declarations:[],subgraphs:defs,stages:{pixel:{
  nodes:[node('source','float',{value:2}),node('useB','subgraph_instance',{subgraphId:'B'}),node('output','pixel_out')],
  edges:[edge('stagein',['source','out'],['useB','value']),edge('stageout',['useB','result'],['output','color']),edge('stagekeep',['source','out'],['useB','keep'])]}}};}
function batchFixtures(reverse){
  const target=bGraph([bLeaf('B','1','Gain'),bLeaf('D','2','Detail'),bParent('A','3',['B','D']),bParent('E','5',['D']),bParent('ExternalRO','4',['B','D']),bParent('ExternalLocal',null,['B','D'])]);
  target.stages.pixel.nodes[1].name='Gain_1';target.stages.pixel.nodes[1].inputValues={value:9,keep:3};
  const library=bGraph([bLeaf('libB','1','Gain',true),bLeaf('libD','2','Detail',true),bParent('libA','3',['libB','libD','libX'],true),bParent('libE','5',['libD'],true),bParent('libX','6',['libB','libD'],true)]);
  // X, new to the graph, has the interface A expects of it, and one wire into its one output. X 是新依賴，接口照 A 的期待，單一輸出只接一條線。
  def(library,'libX').inputs=[port('amount','vec2',[0,0]),port('keep','vec2',[0,0])];def(library,'libX').outputs=[port('updated','vec2',[0,0])];
  for(const e of def(library,'libX').graph.edges){if(e.from[0]==='in')e.from[1]='amount';if(e.to[0]==='out')e.to[1]='updated';}
  def(library,'libX').graph.edges=def(library,'libX').graph.edges.filter(e=>e.id!=='exit1');
  if(reverse){target.subgraphs.reverse();library.subgraphs.reverse();}
  return {target,library};
}
test('R119-1 boundary at open: parents taken from the Library keep names, values and wires; parents only here and the stage follow',()=>{
  for(const reverse of [false,true]){
    const {target,library}=batchFixtures(reverse),before=JSON.stringify(target),libraryBefore=JSON.stringify(library);
    let made=0;const out=c.GrapeGraph.repairLibraryCopies(target,registry,library,()=>'fresh'+ ++made,{versions:'update'},at).document;
    assert.equal(made,1,'only X is new');
    for(const source of library.subgraphs){
      const actual=out.subgraphs.find(f=>f.libraryId===source.libraryId);
      assert.equal(c.GrapeGraph.standardForm(out,registry,actual.id),c.GrapeGraph.standardForm(library,registry,source.id),'Library content exact: '+source.id);
    }
    for(const id of ['A','E','fresh1']){
      for(const call of def(out,id).graph.nodes.filter(n=>n.nodeType.endsWith('subgraph_instance'))){
        assert.equal(call.name,(call.params.subgraphId==='D'?'Detail':'Gain')+'_1','its own name stays');
        assert.deepEqual(plain(call.inputValues),{amount:[9,10],keep:[7,8]},'its own values stay');
      }
      assert.equal(def(out,id).graph.edges.length,def(library,id==='fresh1'?'libX':'lib'+id).graph.edges.length,'its own wires stay');
    }
    for(const id of ['ExternalRO','ExternalLocal']){
      const holder=def(out,id);
      for(const call of holder.graph.nodes.filter(n=>n.params.subgraphId)){
        assert.equal(call.name,(call.params.subgraphId==='B'?'Blur':'Sharp')+'_1','a default name here follows the new title');
        assert.deepEqual(plain(call.inputValues),{keep:[3,3]},'a removed input goes, a kept one is reshaped');
      }
      assert.deepEqual(plain(holder.graph.edges.map(e=>e.id)),['keep0','keep1'],'wires to removed ports go');
    }
    assert.equal(def(out,'ExternalRO').libraryId,lib('4'));assert.equal(def(out,'ExternalLocal').libraryId,undefined);
    const stage=out.stages.pixel,useB=stage.nodes.find(n=>n.id==='useB');
    assert.equal(useB.name,'Blur_1');assert.deepEqual(plain(useB.inputValues),{keep:[3,3]});assert.deepEqual(plain(stage.edges.map(e=>e.id)),['stagekeep']);
    assert.deepEqual(plain(c.GrapeGraph.repairLibraryCopies(out,registry,library,()=>'unexpected',{versions:'update'},at).differing),[],'opening again finds nothing different');
    assert.equal(JSON.stringify(target),before);assert.equal(JSON.stringify(library),libraryBefore);
  }
});

// ---- Long chains (R.120): pairs compared once and remembered give the same answers as the standard form. 長鏈：每一對只比一次並記住，答案和標準形一樣 ----
const uuidAt=i=>`${(0x10000000+i).toString(16).slice(-8)}-0000-4000-8000-000000000000`;
function chainOf(prefix,n,{leaf=3,topTitle}={}){
  const defs=[{...leaf_(prefix+'0'),libraryId:uuidAt(0),title:'L0'}];defs[0].graph.nodes[1].inputValues={b:leaf};
  for(let i=1;i<n;i++){const f=parent(prefix+i,prefix+(i-1),uuidAt(i));f.title=i===n-1&&topTitle?topTitle:'L'+i;defs.push(f);}
  return defs;
}
function leaf_(id){return leaf(id,null);}
test('a chain whose top differs: only the top differs; whose leaf differs: every level does — at open and on paste, as the standard form says',()=>{
  const n=12;
  for(const [change,expected] of [[{topTitle:'Renamed'},['t11']],[{leaf:5},Array.from({length:n},(_,i)=>'t'+i)]]){
    const doc=graph(chainOf('t',n),['t'+(n-1)]),lib=graph(chainOf('lib',n,change));
    const r=c.GrapeGraph.repairLibraryCopies(doc,registry,lib,()=>'new',{versions:'update'},at);
    assert.deepEqual(plain(r.differing).sort(),expected.slice().sort());
    for(const id of doc.subgraphs.map(f=>f.id)){
      const L=def(doc,id).libraryId,mine=lib.subgraphs.find(f=>f.libraryId===L);
      assert.equal(r.differing.includes(id),c.GrapeGraph.standardForm(doc,registry,id)!==c.GrapeGraph.standardForm(lib,registry,mine.id),id);
    }
    const source=graph(chainOf('s',n,change),['s'+(n-1)]),target=graph(chainOf('t',n),[]);
    const plan=c.GrapeGraph.planLibraryEntry(target,plain(c.GrapeGraph.copyNodes(doc_(source),['call0'],'other')),source.subgraphs.map(f=>f.id),registry,{},at);
    assert.deepEqual(plain(plan.conflicts).sort(),expected.map(id=>'s'+id.slice(1)).sort());
    assert.equal(plan.reused.size,n-expected.length);
  }
});
function doc_(g){return new GraphDocument(g,registry);}

// ---- Codex review of R.120 (R120-1, R120-2) Codex 對 R.120 的審查 ----
test('R120-1: an equal parent does not vouch for a child whose own closure names a network outside it by scope',()=>{
  // A uses B and C; B's output type names C's network by scope: inside A's closure, outside B's. A 用 B 與 C；B 的輸出型別以 scoped 參照指向 C。
  const make=prefix=>{
    const a=parent(prefix+'A',prefix+'B',lib('1')),b=leaf(prefix+'B',lib('2')),cc=leaf(prefix+'C',lib('3'));
    a.title='Parent';b.title='Child';cc.title='Sibling';a.graph.nodes.push(node('sibling','subgraph_instance',{subgraphId:cc.id}));
    b.outputs[0].type='float['+c.GrapeGraph.ScopeReferences.token('fn_'+cc.id,['mul','out'])+']';
    return graph([a,b,cc],[a.id]);
  };
  const left=make('g'),right=make('lib');
  assert.equal(c.GrapeGraph.standardForm(left,registry,'gA'),c.GrapeGraph.standardForm(right,registry,'libA'));
  assert.notEqual(c.GrapeGraph.standardForm(left,registry,'gB'),c.GrapeGraph.standardForm(right,registry,'libB'));
  // Parents first or children first, the answer is the standard form's. 先問父或先問子，答案都和標準形一樣。
  for(const reverse of [false,true]){
    const doc=plain(left);if(reverse)doc.subgraphs.reverse();
    const r=c.GrapeGraph.repairLibraryCopies(doc,registry,right,()=>'new',{versions:'local'},at);
    assert.deepEqual(plain(r.differing),['gB']);
    assert.equal(def(r.document,'gB').libraryId,undefined);assert.equal(def(r.document,'gA').libraryId,undefined,'its read-only user goes local too');
    assert.equal(def(r.document,'gC').libraryId,lib('3'));
  }
});

test('R120-2: a graph well inside the byte limit compiles even when its subgraph notes, copied per instance, would not fit',()=>{
  const g=graph([leaf('gain',null)],Array.from({length:20},()=> 'gain'));
  g.subgraphs[0].graph.nodes.find(n=>n.id==='mul').comment='中'.repeat(10000);
  assert.deepEqual(plain(c.GrapeGraph.overLimit(g,registry)),[],'the graph itself passes the gate');
  assert.ok(c.GrapeGraph.documentBytes(g)<40000);
  const compiled=c.GrapeTopCompiler.compile(g,c.GrapeGraph.createEditorContract(registry,'top').glslCode);
  assert.ok(compiled.pixel.length>0);
});
