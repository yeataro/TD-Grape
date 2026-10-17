// Library copies in the core (Refactor.118; basic design §3.7–3.10, amendment 1 A2–A6, amendment 2 B1–B4 revision 3): a definition
// with a Library ID is read-only; only the legal operations change it, each through one transaction ledger; the gate at the end of
// change() checks the result. Rows of amendment 2 B1's acceptance matrix are named in the tests.
// 核心裡的 Library 副本：帶 Library ID 的定義唯讀，只有合法操作能改，每次都經過交易帳本；change() 末尾的關卡檢查結果。測試名稱標出附錄二
// B1 驗收矩陣的列。
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const c=vm.createContext({});vm.runInContext(fs.readFileSync(require.resolve('../../src/generated/grape_core.js'),'utf8'),c);
const {GraphDocument,registry}=c.GrapeGraph;
const {sharedGraph,node,port}=require('../fixtures/shared_subgraphs.cjs');
const plain=v=>JSON.parse(JSON.stringify(v));
const L1='11111111-1111-4111-8111-111111111111',L2='22222222-2222-4222-8222-222222222222',L3='33333333-3333-4333-8333-333333333333';
const readOnly=e=>e.code==='subgraph.readOnly';
// gain (L1) inside wrapper (L2): both read-only, so the closure rule (A3) holds. gain（L1）在 wrapper（L2）裡：兩份都唯讀，閉包規則成立。
function library(){const g=sharedGraph();g.subgraphs[0].libraryId=L1;g.subgraphs[1].libraryId=L2;return g;}
const doc=g=>new GraphDocument(g,registry);
const def=(g,id)=>g.subgraphs.find(f=>f.id===id);
// A Library copy as a file would bring it: a plain one-port pass-through. 檔案帶來的 Library 副本：一個接口的直通。
function libraryCopy(id,libraryId=L3,title='Tint'){
  return {id,title,libraryId,inputs:[port('value')],outputs:[port('result')],graph:{
    nodes:[node('in','subgraph_input'),node('out','subgraph_output')],edges:[{id:'e1',from:['in','value'],to:['out','result']}]}};
}

test('a graph without Library copies never makes a ledger; an ordinary edit passes as before',()=>{
  const step=doc(sharedGraph()).change(m=>{
    m.networks.get('pixel').node('source').update({params:{value:5}});
    m.subgraph('gain').rename('Louder');
    assert.equal(m.libraryInUse,false,'no ledger without a legal operation');
  });
  assert.equal(def(step.after,'gain').title,'Louder');
});

test('an ordinary edit of a Library copy is refused: title, colour, interface, a node inside, its layout',()=>{
  const base=doc(library());
  assert.throws(()=>base.change(m=>m.subgraph('gain').rename('Blur')),readOnly);
  assert.throws(()=>base.change(m=>m.subgraph('gain').recolor('#336699')),readOnly);
  assert.throws(()=>base.change(m=>m.subgraph('gain').editInterface('inputs',{kind:'update',id:'value',patch:{label:'v'}})),readOnly);
  assert.throws(()=>base.change(m=>m.networks.get('subgraph:gain').node('mul').update({params:{type:'float'},inputValues:{b:4}})),readOnly);
  assert.throws(()=>base.change(m=>m.networks.get('subgraph:gain').node('mul').update({ui:{x:99,y:0}})),readOnly);
  // Edits around it pass: the stage and the instances' own shell (human 2026-10-16: an instance's shell is the instance's).
  // 周圍的修改照樣通過：stage 與實例自己的外殼（人類：實例的外殼歸實例）。
  const step=base.change(m=>{const n=m.networks.get('pixel');n.node('source').update({params:{value:7}});n.node('first').update({name:'Mine',inputValues:{value:2}});});
  assert.deepEqual(plain(step.after.subgraphs),plain(library().subgraphs));
});

test('matrix row 6: a copy added in this edit and then edited is refused',()=>{
  assert.throws(()=>doc(sharedGraph()).change(m=>{m.appendSubgraphs([libraryCopy('x')]);m.document.subgraphs.find(f=>f.id==='x').title='Changed';}),readOnly);
  assert.throws(()=>doc(sharedGraph()).change(m=>{m.appendSubgraphs([libraryCopy('x')]);m.subgraph('x').rename('Changed');}),readOnly);
});

test('matrix row 7: a copy added in this edit loses its ID or disappears without a legal operation: refused',()=>{
  assert.throws(()=>doc(sharedGraph()).change(m=>{m.appendSubgraphs([libraryCopy('x')]);delete m.document.subgraphs.find(f=>f.id==='x').libraryId;}),readOnly);
  assert.throws(()=>doc(sharedGraph()).change(m=>{m.appendSubgraphs([libraryCopy('x')]);m.document.subgraphs=m.document.subgraphs.filter(f=>f.id!=='x');}),readOnly);
  // Also an existing one. 既有的也一樣。
  assert.throws(()=>doc(library()).change(m=>{delete def(m.document,'wrapper').libraryId;}),readOnly);
  assert.throws(()=>doc(library()).change(m=>{m.document.subgraphs=m.document.subgraphs.filter(f=>f.id!=='wrapper');m.networks.get('pixel').node('second').update({params:{subgraphId:'gain'}});}),readOnly);
});

test('matrix row 8: an added copy may be legally removed; the identity is then gone for this edit',()=>{
  const step=doc(sharedGraph()).change(m=>{m.appendSubgraphs([libraryCopy('x')]);m.removeSubgraph('x');});
  assert.ok(!step.after.subgraphs.some(f=>f.id==='x'));
  // Put back afterwards under the same pair, or the old in-graph ID with another or no Library ID: refused (supplement).
  // 之後用同一對、或舊圖內 ID 配別的或沒有 Library ID 塞回：拒絕（補驗）。
  const added=doc(sharedGraph()).change(m=>m.appendSubgraphs([libraryCopy('x')])).after;
  for(const back of [libraryCopy('x'),libraryCopy('x',L1),{...libraryCopy('x'),libraryId:undefined}]){
    assert.throws(()=>doc(added).change(m=>{m.removeSubgraph('x');m.appendSubgraphs([JSON.parse(JSON.stringify(back))]);}),readOnly);
  }
  // A new in-graph ID for the same Library ID is a new copy. 同一個 Library ID 換新的圖內 ID＝新的副本。
  const again=doc(added).change(m=>{m.removeSubgraph('x');m.appendSubgraphs([libraryCopy('y')]);});
  assert.deepEqual(plain(again.after.subgraphs.filter(f=>f.libraryId===L3).map(f=>f.id)),['y']);
});

test('a Library ID changed by an ordinary edit is refused, and so is a later legal operation on it',()=>{
  assert.throws(()=>doc(library()).change(m=>{def(m.document,'wrapper').libraryId=L3;}),readOnly);
  assert.throws(()=>doc(library()).change(m=>{def(m.document,'gain').libraryId=L3;m.removeSubgraph('gain');}),e=>readOnly(e)||e.code==='subgraph.inUse');
});

test('a read-only subgraph may only use read-only ones (A3); a malformed Library ID is refused',()=>{
  const local=sharedGraph();
  const bad={...plain(local.subgraphs[1]),id:'wrapped',libraryId:L3};
  assert.throws(()=>doc(local).change(m=>m.appendSubgraphs([bad])),e=>e.code==='subgraph.readOnlyClosure');
  assert.throws(()=>doc(local).change(m=>m.appendSubgraphs([{...libraryCopy('x'),libraryId:'not-a-uuid'}])),/Invalid Library ID/);
});

test('Make Single User on a Library copy gives a local copy; inside a read-only subgraph it is refused',()=>{
  let made=0;const next=()=>'solo'+ ++made;
  const step=doc(library()).change(m=>{const n=m.networks.get('pixel');n.independentSubgraph(n.node('first'),next);});
  const solo=def(step.after,'solo1');
  assert.equal(solo.libraryId,undefined,'the copy is local');
  assert.deepEqual(plain(def(step.after,'gain')),plain(def(library(),'gain')),'the original stays');
  assert.equal(step.after.stages.pixel.nodes.find(n=>n.id==='first').params.subgraphId,'solo1');
  assert.throws(()=>doc(library()).change(m=>{const n=m.networks.get('subgraph:wrapper');n.independentSubgraph(n.node('inner'),next);}),readOnly);
});

test('a Library copy whose last instance goes is collected only when the caller names it; one still used inside another stays',()=>{
  // gain alone at the stage: its last instance goes. 只有 gain 在 stage 上：刪掉它最後一個實例。
  const g=library();g.subgraphs=g.subgraphs.filter(f=>f.id==='gain');
  g.stages.pixel.nodes=g.stages.pixel.nodes.filter(n=>n.id!=='second');g.stages.pixel.edges=g.stages.pixel.edges.filter(e=>e.from[0]!=='second'&&e.to[0]!=='second');
  const kept=doc(g).change(m=>{const n=m.networks.get('pixel');n.removeAll([n.node('first')]);});
  assert.ok(kept.after.subgraphs.some(f=>f.id==='gain'),'not named: kept');
  const gone=doc(g).change(m=>{const n=m.networks.get('pixel');n.removeAll([n.node('first')],new Set(['gain']));});
  assert.ok(!gone.after.subgraphs.some(f=>f.id==='gain'),'named and unused: collected');
  // With wrapper still using gain, gain stays even when named. wrapper 還在用 gain：就算被指名也留著。
  const used=doc(library()).change(m=>{const n=m.networks.get('pixel');n.removeAll([n.node('first')],new Set(['gain']));});
  assert.ok(used.after.subgraphs.some(f=>f.id==='gain'));
});

// ---- Make Local (§3.10, A3) 轉為本地 ----
let forks=0;const next=()=>'fork'+ ++forks;

test('matrix row 9: Make Local in place when no read-only subgraph uses it; then ordinary edits pass',()=>{
  const step=doc(library()).change(m=>{
    assert.equal(m.makeLocal('wrapper',next),'wrapper','in place');
    m.subgraph('wrapper').rename('Mine');
  });
  assert.equal(def(step.after,'wrapper').libraryId,undefined);
  const later=doc(step.after).change(m=>m.subgraph('wrapper').rename('Again'));
  assert.equal(def(later.after,'wrapper').title,'Again');
});

test('matrix rows 10–11: with a read-only user, Make Local forks B′; instances outside read-only subgraphs move to it',()=>{
  // The stage, a local C and the read-only wrapper all use gain (Codex B1-R2-2 row 10). stage、本地 C、唯讀 wrapper 都用 gain。
  const g=library();g.subgraphs.push({id:'cdef',title:'C',inputs:[],outputs:[],graph:{nodes:[node('use','subgraph_instance',{subgraphId:'gain'})],edges:[]}});
  let fork;
  const step=doc(g).change(m=>{fork=m.makeLocal('gain',next);m.subgraph(fork).rename('Mine');});
  assert.notEqual(fork,'gain');
  assert.equal(def(step.after,fork).libraryId,undefined);
  assert.deepEqual(plain(def(step.after,'gain')),plain(def(library(),'gain')),'the read-only gain stays');
  assert.equal(step.after.stages.pixel.nodes.find(n=>n.id==='first').params.subgraphId,fork,'the stage moves');
  assert.equal(def(step.after,'cdef').graph.nodes[0].params.subgraphId,fork,'the local C moves');
  assert.equal(def(step.after,'wrapper').graph.nodes.find(n=>n.id==='inner').params.subgraphId,'gain','the read-only wrapper stays');
  assert.throws(()=>doc(step.after).change(m=>m.subgraph('gain').rename('Nope')),readOnly,'row 11: the original stays read-only');
  assert.throws(()=>doc(g).change(m=>{m.makeLocal('gain',next);def(m.document,'gain').title='Nope';}),readOnly,'row 11 in the same edit');
});

test('a copy with no instance made local and then deleted passes (supplement)',()=>{
  const step=doc(sharedGraph()).change(m=>{m.appendSubgraphs([libraryCopy('x')]);m.makeLocal('x',next);m.removeSubgraph('x');});
  assert.ok(!step.after.subgraphs.some(f=>f.id==='x'));
});

// ---- Explicit update (§3.11, B1) 明確更新 ----
// gain with its output port changed: every instance's wire from `result` goes. 換掉 gain 的輸出接口：所有實例從 result 出的線都刪掉。
function newGain(changes={}){const f=plain(def(library(),'gain'));f.outputs=[port('louder')];f.graph.edges=[f.graph.edges[0],{id:'e2',from:['mul','out'],to:['out','louder']}];return Object.assign(f,changes);}

test('an update replaces the copy, keeps its IDs, and syncs every instance, inside read-only subgraphs too',()=>{
  const step=doc(library()).change(m=>m.updateFromLibrary('gain',newGain()));
  assert.deepEqual(plain(def(step.after,'gain').outputs.map(p=>p.id)),['louder']);
  assert.equal(def(step.after,'gain').libraryId,L1);
  assert.ok(!def(step.after,'wrapper').graph.edges.some(e=>e.from[0]==='inner'&&e.from[1]==='result'),'the read-only wrapper was synced');
  assert.ok(!step.after.stages.pixel.edges.some(e=>e.from[0]==='first'&&e.from[1]==='result'),'the stage was synced');
  assert.throws(()=>doc(library()).change(m=>m.updateFromLibrary('gain',{...newGain(),libraryId:L3})),/keeps the Library ID/);
});

test('matrix rows 1–2: an ordinary edit of A before or after an update of B that syncs A is refused',()=>{
  assert.throws(()=>doc(library()).change(m=>{def(m.document,'wrapper').title='Edited';m.updateFromLibrary('gain',newGain());}),readOnly);
  assert.throws(()=>doc(library()).change(m=>{m.updateFromLibrary('gain',newGain());def(m.document,'wrapper').title='Edited';}),readOnly);
});

test('matrix rows 3–5: two updates in a row keep A₂; going back to A₁ or before is refused, also before another legal operation',()=>{
  // The second update also drops the input: A changes twice. 第二次更新再拿掉輸入：A 改兩次。
  const second=()=>{const f=newGain();f.inputs=[port('amount')];f.graph.edges=[f.graph.edges[1]];return f;};
  let a1,a2;
  const step=doc(library()).change(m=>{m.updateFromLibrary('gain',newGain());a1=plain(def(m.document,'wrapper'));m.updateFromLibrary('gain',second());a2=plain(def(m.document,'wrapper'));});
  assert.notDeepEqual(a1,a2);assert.deepEqual(plain(def(step.after,'wrapper')),a2);
  const before=plain(def(library(),'wrapper'));
  for(const back of [a1,before]) assert.throws(()=>doc(library()).change(m=>{m.updateFromLibrary('gain',newGain());m.updateFromLibrary('gain',second());
    const list=m.document.subgraphs;list[list.findIndex(f=>f.id==='wrapper')]=JSON.parse(JSON.stringify(back));}),readOnly);
  // Row 5: back to A₁, then Make Single User reads A as its source. 第 5 列：退回 A₁ 再用設為唯一讀 A 當來源。
  assert.throws(()=>doc(library()).change(m=>{m.updateFromLibrary('gain',newGain());const keep=plain(def(m.document,'wrapper'));m.updateFromLibrary('gain',second());
    const list=m.document.subgraphs;list[list.findIndex(f=>f.id==='wrapper')]=keep;const n=m.networks.get('pixel');n.independentSubgraph(n.node('second'),next);}),readOnly);
});

test('an update that changes the title renames instances still named by default; hand names stay; a taken number moves (B1-R2-1)',()=>{
  const g=library();
  def(g,'wrapper').graph.nodes.find(n=>n.id==='inner').name='Gain_1';
  g.stages.pixel.nodes.find(n=>n.id==='first').name='Gain_1';
  g.stages.pixel.nodes.push({...node('blocker','float',{value:1}),name:'Blur_1'});
  g.stages.pixel.nodes.find(n=>n.id==='source').name='Mine';
  const step=doc(g).change(m=>m.updateFromLibrary('gain',newGain({title:'Blur'})));
  assert.equal(def(step.after,'wrapper').graph.nodes.find(n=>n.id==='inner').name,'Blur_1','inside the read-only wrapper');
  assert.equal(step.after.stages.pixel.nodes.find(n=>n.id==='first').name,'Blur_2','Blur_1 is taken on the stage');
  assert.equal(step.after.stages.pixel.nodes.find(n=>n.id==='source').name,'Mine');
  assert.throws(()=>doc(g).change(m=>{m.updateFromLibrary('gain',newGain({title:'Blur'}));def(m.document,'wrapper').title='Edited';}),readOnly);
});

test('a deep chain C→A→B: updating B syncs A and leaves C alone; an ordinary edit of C first is still refused',()=>{
  const g=library();
  g.subgraphs.push({id:'outer',title:'Outer',libraryId:L3,inputs:[port('value')],outputs:[port('result')],graph:{
    nodes:[node('in','subgraph_input'),node('mid','subgraph_instance',{subgraphId:'wrapper'}),node('out','subgraph_output')],
    edges:[{id:'o1',from:['in','value'],to:['mid','value']},{id:'o2',from:['mid','result'],to:['out','result']}]}});
  const step=doc(g).change(m=>m.updateFromLibrary('gain',newGain()));
  assert.deepEqual(plain(def(step.after,'outer')),plain(def(g,'outer')),'C did not change');
  assert.throws(()=>doc(g).change(m=>{def(m.document,'outer').title='Edited';m.updateFromLibrary('gain',newGain());}),readOnly);
});

test('a locally made A, edited, then synced by an update of its B stays local (supplement)',()=>{
  const step=doc(library()).change(m=>{m.makeLocal('wrapper',next);m.subgraph('wrapper').rename('Mine');m.updateFromLibrary('gain',newGain());});
  assert.equal(def(step.after,'wrapper').libraryId,undefined);
  assert.equal(def(step.after,'wrapper').title,'Mine');
});

test('a fork keeps its own content when the original is updated (supplement)',()=>{
  let fork;
  const step=doc(library()).change(m=>{fork=m.makeLocal('gain',next);m.subgraph(fork).rename('Mine');m.updateFromLibrary('gain',newGain());});
  assert.equal(def(step.after,fork).title,'Mine');
  assert.deepEqual(plain(def(step.after,fork).outputs.map(p=>p.id)),['result'],'the fork kept its old interface');
});

test('two copies with one Library ID are two identities (supplement)',()=>{
  const g=sharedGraph();g.subgraphs=[];
  g.subgraphs.push(libraryCopy('a1'),{...libraryCopy('a2'),title:'Other'});
  g.stages.pixel.nodes.push(node('i1','subgraph_instance',{subgraphId:'a1'}),node('i2','subgraph_instance',{subgraphId:'a2'}));
  const step=doc(g).change(m=>m.updateFromLibrary('a1',{...libraryCopy('a1'),title:'Updated'}));
  assert.equal(def(step.after,'a2').title,'Other','a2 untouched');
  assert.throws(()=>doc(g).change(m=>{m.updateFromLibrary('a1',{...libraryCopy('a1'),title:'Updated'});def(m.document,'a2').title='Edited';}),readOnly);
  const both=doc(g).change(m=>{m.updateFromLibrary('a1',{...libraryCopy('a1'),title:'One'});m.updateFromLibrary('a2',{...libraryCopy('a2'),title:'Two'});});
  assert.deepEqual(plain(both.after.subgraphs.map(f=>f.title)),['One','Two']);
});

// ---- Across transactions 跨交易 ----
test('row 13: after Undo the next edit starts from the adopted document; after Redo too',()=>{
  const done=doc(library()).change(m=>{m.makeLocal('wrapper',next);m.subgraph('wrapper').rename('Mine');});
  assert.throws(()=>doc(done.before).change(m=>m.subgraph('wrapper').rename('Again')),readOnly,'Undo: read-only again');
  assert.equal(def(doc(done.after).change(m=>m.subgraph('wrapper').rename('Again')).after,'wrapper').title,'Again','Redo: local');
});

test('a failed edit publishes nothing; the next legal update passes',()=>{
  const base=doc(library()),was=plain(base.snapshot());
  assert.throws(()=>base.change(m=>{m.updateFromLibrary('gain',newGain());def(m.document,'wrapper').title='Edited';}),readOnly);
  assert.deepEqual(plain(base.snapshot()),was);
  assert.deepEqual(plain(def(base.change(m=>m.updateFromLibrary('gain',newGain())).after,'gain').outputs.map(p=>p.id)),['louder']);
});

// ---- Standard form and paste (A5 rule 3, B3–B4) 標準形與貼上 ----
test('the standard form ignores in-graph IDs but keeps shared versus separate dependencies apart',()=>{
  const g=library(),moved=plain(g);
  moved.subgraphs[0].id='g2';moved.subgraphs[1].graph.nodes.find(n=>n.id==='inner').params.subgraphId='g2';
  assert.equal(c.GrapeGraph.standardForm(g,registry,'wrapper'),c.GrapeGraph.standardForm(moved,registry,'wrapper'));
  // Two instances of one gain versus one each of two equal gains. 兩個實例共用一份 gain，對比各用一份內容相同的 gain。
  const twoUses=n=>({id:'two',title:'Two',libraryId:L3,inputs:[],outputs:[],graph:{nodes:[node('a','subgraph_instance',{subgraphId:'gain'}),node('b','subgraph_instance',{subgraphId:n})],edges:[]}});
  const shared=library();shared.subgraphs.push(twoUses('gain'));
  const apart=library();apart.subgraphs.push({...plain(def(apart,'gain')),id:'gainB'},twoUses('gainB'));
  assert.notEqual(c.GrapeGraph.standardForm(shared,registry,'two'),c.GrapeGraph.standardForm(apart,registry,'two'));
});

test('a pasted Library copy is reused when the same one is here; with none it comes in read-only; with other content the choice decides (C4)',()=>{
  let made=0;const newId=()=>'n'+ ++made,newGroupId=()=>'g'+made,newSub=()=>'sub'+ ++made;
  const clip=plain(c.GrapeGraph.copyNodes(doc(library()),['first'],'otherOp'));
  assert.ok(clip.subgraphs.some(f=>f.libraryId===L1),'the copy carries the Library ID');
  const paste=(target,choice)=>doc(target).change(m=>c.GrapeGraph.pasteClip(m,clip,{x:0,y:0},newId,newGroupId,'pixel',newSub,false,choice)).after;
  // The same gain is here: reused, nothing added. 這裡有同一份 gain：沿用，不加。
  const same=paste(library());
  assert.equal(same.subgraphs.length,2);
  assert.equal(same.stages.pixel.nodes.at(-1).params.subgraphId,'gain');
  // No copy with this Library ID here (the local gain does not count): a new read-only copy. 這裡沒有這個 Library ID（本地的 gain 不算）：加入唯讀副本。
  const none=paste(sharedGraph()),added=none.subgraphs.filter(f=>f.libraryId===L1);
  assert.equal(added.length,1);assert.notEqual(added[0].id,'gain');
  assert.throws(()=>doc(none).change(m=>m.subgraph(added[0].id).rename('Nope')),readOnly);
  // Here gain has other content. Default, keep the graph's version: the incoming one comes in local with its provenance, nothing here
  // changes. 這裡的 gain 內容不同。預設保留圖裡版本：帶進來的轉本地進來、記出處，圖裡不動。
  const differs=library();def(differs,'gain').title='Changed';
  const kept=paste(differs),local=kept.subgraphs.find(f=>!['gain','wrapper'].includes(f.id));
  assert.equal(kept.subgraphs.length,3);assert.equal(local.libraryId,undefined);
  assert.equal(local.provenance[0].kind,'library');assert.equal(local.provenance[0].libraryId,L1);assert.equal(local.provenance[0].title,'Gain');
  assert.deepEqual(plain(def(kept,'gain')),plain(def(differs,'gain')),'the graph keeps its version');
  assert.equal(kept.stages.pixel.nodes.at(-1).params.subgraphId,local.id);
  // Take the incoming one: the graph's copy is updated in place, nothing added. 改用帶進來的：圖裡那份就地更新，不加。
  const taken=paste(differs,{conflicts:'incoming'});
  assert.equal(taken.subgraphs.length,2);assert.equal(def(taken,'gain').title,'Gain');assert.equal(def(taken,'gain').libraryId,L1);
  assert.equal(taken.stages.pixel.nodes.at(-1).params.subgraphId,'gain');
});

// ---- Codex review of R.118 (R118-1..4) Codex 對 R.118 的審查 ----
const {ScopeReferences}=c.GrapeGraph;
function emptyGraph(){const g=sharedGraph();g.subgraphs=[];g.stages.pixel.nodes=g.stages.pixel.nodes.filter(n=>n.id==='output');g.stages.pixel.edges=[];return g;}
function gainCopy(id='gain'){return {...plain(sharedGraph().subgraphs[0]),id,libraryId:L1};}
function wrapperCopy(id='wrapper',inner='gain',libraryId=L2){const f=plain(sharedGraph().subgraphs[1]);f.id=id;f.graph.nodes.find(n=>n.id==='inner').params.subgraphId=inner;if(libraryId)f.libraryId=libraryId;else delete f.libraryId;return f;}
function withRoots(defs,refs){const g=emptyGraph();g.subgraphs=defs;refs.forEach((ref,i)=>g.stages.pixel.nodes.push(node('call'+i,'subgraph_instance',{subgraphId:ref})));return g;}
const refsOf=f=>f.graph.nodes.filter(n=>n.nodeType.endsWith('subgraph_instance')).map(n=>n.params.subgraphId);
function pasteInto(target,clip,sameSource=false,seed=0){let n=seed,d=seed;return doc(target).change(m=>c.GrapeGraph.pasteClip(m,clip,{x:0,y:0},()=>'p'+ ++n,()=>'group','pixel',()=>'fresh'+ ++d,sameSource)).after;}
const pastedRoots=g=>g.stages.pixel.nodes.filter(n=>n.id.startsWith('p')).map(n=>n.params.subgraphId);

test('R118-1: a copy made local may not end with another Library ID, even after an ordinary removal and a legal add',()=>{
  const start=doc(sharedGraph()).change(m=>m.appendSubgraphs([libraryCopy('x')])).after;
  assert.throws(()=>doc(start).change(m=>{m.makeLocal('x',next);m.document.subgraphs=m.document.subgraphs.filter(f=>f.id!=='x');m.appendSubgraphs([libraryCopy('x',L1)]);}),readOnly);
  assert.throws(()=>doc(start).change(m=>{m.makeLocal('x',next);def(m.document,'x').libraryId=L1;}),readOnly);
  assert.equal(def(doc(start).change(m=>{m.makeLocal('x',next);m.subgraph('x').rename('Mine');}).after,'x').title,'Mine','the ordinary case still passes');
});

test('copies sharing a Library ID inside a pasted batch merge by default, or stay apart as local copies (C4 rule 3, C3 step 1)',()=>{
  // wrapper uses gain and gainB, equal in content but two definitions (only a hand-made or foreign file has this now). wrapper 用 gain
  // 與 gainB：內容相同但是兩份（現在只有手改或外來的檔案會這樣）。
  const w=wrapperCopy();w.graph.nodes.push(node('extra','subgraph_instance',{subgraphId:'gainB'}));
  const source=withRoots([gainCopy(),gainCopy('gainB'),w],['wrapper']),clip=plain(c.GrapeGraph.copyNodes(doc(source),['call0'],'source'));
  const merged=pasteInto(withRoots([gainCopy('existing')],[]),clip),root=pastedRoots(merged)[0];
  assert.equal(merged.subgraphs.length,2,'existing gain + the incoming wrapper');
  assert.deepEqual(plain(refsOf(def(merged,root))),['existing','existing'],'both instances use the one gain');
  assert.equal(pasteInto(merged,clip,false,10).subgraphs.length,2,'a second paste adds nothing');
  let n=0,d=0;
  const apart=doc(withRoots([gainCopy('existing')],[])).change(m=>c.GrapeGraph.pasteClip(m,clip,{x:0,y:0},()=>'p'+ ++n,()=>'group','pixel',()=>'fresh'+ ++d,false,{duplicates:'separate'})).after;
  const top=def(apart,pastedRoots(apart)[0]),[first,second]=refsOf(top);
  assert.equal(top.libraryId,undefined,'the read-only user of a copy kept apart goes local too (A3)');
  assert.equal(first,'existing');assert.equal(def(apart,second).libraryId,undefined);assert.equal(def(apart,second).provenance[0].libraryId,L1);
});

test('a paste meets the one copy here: a shared dependency stays shared; a graph still holding duplicates is refused until repaired',()=>{
  for(const sameSource of [false,true]){
    const source=withRoots([gainCopy(),wrapperCopy(),wrapperCopy('localC','gain',null)],['wrapper','localC']);
    const target=withRoots([gainCopy('usedByA'),wrapperCopy('existingA','usedByA')],[]);
    const after=pasteInto(target,plain(c.GrapeGraph.copyNodes(doc(source),['call0','call1'],'source')),sameSource);
    const [a,cdef]=pastedRoots(after);
    assert.equal(a,'existingA','the read-only parent is reused');
    assert.deepEqual(plain(refsOf(def(after,cdef))),['usedByA'],'the local C uses the same gain as A');
  }
  const clip=plain(c.GrapeGraph.copyNodes(doc(withRoots([gainCopy()],['gain'])),['call0'],'source'));
  assert.throws(()=>pasteInto(withRoots([gainCopy('g1'),gainCopy('g2')],[]),clip),e=>e.code==='subgraph.libraryDuplicate');
});

test('R118-3: renumbering in-graph IDs inside scoped types keeps the standard form; a second paste adds nothing',()=>{
  const source=withRoots([gainCopy()],['gain']);
  def(source,'gain').outputs[0].type='float['+ScopeReferences.token('fn_gain',['mul','out'])+']';
  const clip=plain(c.GrapeGraph.copyNodes(doc(source),['call0'],'source'));
  const first=pasteInto(emptyGraph(),clip),copyId=first.subgraphs[0].id;
  assert.notEqual(copyId,'gain');
  assert.equal(c.GrapeGraph.standardForm(source,registry,'gain'),c.GrapeGraph.standardForm(first,registry,copyId));
  assert.equal(pasteInto(first,clip,false,10).subgraphs.length,1);
});

test('R118-4: a fork moves its own scoped references to itself; the read-only original keeps its own',()=>{
  const g=library(),scoped=id=>'float['+ScopeReferences.token('fn_'+id,['mul','out'])+']';
  def(g,'gain').outputs[0].type=scoped('gain');
  const step=doc(g).change(m=>m.makeLocal('gain',()=>'forked'));
  assert.equal(def(step.after,'forked').outputs[0].type,scoped('forked'));
  assert.equal(def(step.after,'gain').outputs[0].type,scoped('gain'));
});

// ---- Codex check of R.118.1 (R118.1-1, R118.1-2) Codex 對 R.118.1 的核對 ----
test('R118.1-1 under C2: with one copy per Library ID the pairing is fixed; no order adds a definition, also at exactly 64',()=>{
  const fillers=Array.from({length:62},(_,i)=>({...gainCopy('filler'+i),title:'Filler'+i,libraryId:undefined}));
  for(const roots of [['B','A'],['A','B']]) for(const sameSource of [false,true]) for(const extra of [[],fillers]){
    const source=withRoots([gainCopy('B'),wrapperCopy('A','B')],roots);
    const target=withRoots([...(roots[0]==='A'?[gainCopy('B0'),wrapperCopy('A0','B0')]:[wrapperCopy('A0','B0'),gainCopy('B0')]),...extra],[]);
    const after=pasteInto(target,plain(c.GrapeGraph.copyNodes(doc(source),['call0','call1'],'source')),sameSource);
    assert.equal(after.subgraphs.length,2+extra.length);
    assert.deepEqual(plain(pastedRoots(after).sort()),['A0','B0']);
  }
  // Codex's eight separate equal copies (R118.2-1) now merge inside the batch and meet the one here. Codex 的八份分開的相同副本：批內合併後對上這裡那一份。
  const many=Array.from({length:8},(_,i)=>gainCopy('I'+i));
  const after=pasteInto(withRoots([gainCopy('T0')],[]),plain(c.GrapeGraph.copyNodes(doc(withRoots(many,many.map(f=>f.id))),many.map((_,i)=>'call'+i),'source')));
  assert.equal(after.subgraphs.length,1);
  assert.deepEqual(plain([...new Set(pastedRoots(after))]),['T0']);
});

test('R118.1-2: a resolved self-reference never equals an unresolved scope that reads fn_0',()=>{
  const source=withRoots([gainCopy()],['gain']);def(source,'gain').outputs[0].type='float['+ScopeReferences.token('fn_gain',['mul','out'])+']';
  const target=withRoots([gainCopy('other')],[]);def(target,'other').outputs[0].type='float['+ScopeReferences.token('fn_0',['mul','out'])+']';
  assert.notEqual(c.GrapeGraph.standardForm(source,registry,'gain'),c.GrapeGraph.standardForm(target,registry,'other'));
  const after=pasteInto(target,plain(c.GrapeGraph.copyNodes(doc(source),['call0'],'source')));
  assert.equal(after.subgraphs.length,2,'not reused: a new read-only copy comes in');
  // A valid renumbering still compares equal. 合法的重新編號仍然相等。
  const moved=withRoots([gainCopy('other')],[]);def(moved,'other').outputs[0].type='float['+ScopeReferences.token('fn_other',['mul','out'])+']';
  assert.equal(c.GrapeGraph.standardForm(source,registry,'gain'),c.GrapeGraph.standardForm(moved,registry,'other'));
});

// ---- Codex check of R.118.2 and the Library version policy (amendment 3, Refactor.119) Codex 對 R.118.2 的核對與 Library 版本政策 ----
const at='2026-10-17T00:00:00.000Z';
test('R118.2-2: stored text that reads like a normalization marker never equals a resolved reference',()=>{
  const self='float['+ScopeReferences.token('fn_gain',['mul','out'])+']';
  for(const literal of ['float[\u0000closure:0:mul\u0000out\u0000]','float[\u0000["closure",0,"mul","out"]\u0000]']){
    const source=withRoots([gainCopy()],['gain']);def(source,'gain').outputs[0].type=self;
    const target=plain(withRoots([gainCopy('other')],[]));def(target,'other').outputs[0].type=literal;
    assert.notEqual(c.GrapeGraph.standardForm(source,registry,'gain'),c.GrapeGraph.standardForm(target,registry,'other'),JSON.stringify(literal));
    const after=pasteInto(target,plain(c.GrapeGraph.readClip(JSON.stringify(c.GrapeGraph.copyNodes(doc(source),['call0'],'source')))));
    assert.equal(after.subgraphs.length,2,'not reused');
  }
});

test('C2: an edit may not add a second copy of a Library ID; a graph opened with duplicates stays editable',()=>{
  assert.throws(()=>doc(library()).change(m=>m.appendSubgraphs([gainCopy('again')])),e=>e.code==='subgraph.libraryDuplicate');
  const opened=withRoots([gainCopy('g1'),gainCopy('g2')],['g1','g2']);
  const step=doc(opened).change(m=>m.updateFromLibrary('g1',{...gainCopy('g1'),title:'Updated'}));
  assert.equal(def(step.after,'g1').title,'Updated');
});

test('C6: losing a Library ID records the provenance — Make Local in place or by fork, and Make Single User; never compared',()=>{
  const inPlace=doc(library()).change(m=>m.makeLocal('wrapper',next,at)).after;
  assert.deepEqual(plain(def(inPlace,'wrapper').provenance),[{kind:'library',libraryId:L2,title:'Wrapper',at}]);
  let fork;const forked=doc(library()).change(m=>{fork=m.makeLocal('gain',next,at);}).after;
  assert.deepEqual(plain(def(forked,fork).provenance),[{kind:'library',libraryId:L1,title:'Gain',at}]);
  assert.equal(def(forked,'gain').provenance,undefined,'the read-only original has none');
  let solo;const single=doc(library()).change(m=>{const p=m.networks.get('pixel');solo=p.independentSubgraph(p.node('first'),()=>'solo',at).id;}).after;
  assert.equal(def(single,solo).provenance[0].libraryId,L1);
  const marked=library();def(marked,'gain').provenance=[{kind:'library',libraryId:L3,title:'Old',at}];
  assert.equal(c.GrapeGraph.standardForm(marked,registry,'wrapper'),c.GrapeGraph.standardForm(library(),registry,'wrapper'),'provenance is not content');
  for(const bad of [[{kind:'copied'}],[{kind:'library',libraryId:L1,title:'A',at},{kind:'library',libraryId:L1,title:'A',at}],[{kind:'library',libraryId:'nope',title:'A',at}]]){
    const f={...plain(sharedGraph().subgraphs[0]),id:'z',provenance:bad};
    assert.throws(()=>doc(sharedGraph()).change(m=>m.appendSubgraphs([f])),/provenance/);
  }
});

// Kernel v1 / v2 differ in one value; Sharpen, Blur and Glow each wrap a Kernel. Kernel 兩版差一個值；Sharpen、Blur、Glow 各包一個 Kernel。
const LK='44444444-4444-4444-8444-444444444444',LS='55555555-5555-4555-8555-555555555555',LB='66666666-6666-4666-8666-666666666666',LG='77777777-7777-4777-8777-777777777777';
function kernel(id,v){const f={...gainCopy(id),libraryId:LK,title:'Kernel'};f.graph.nodes[1].inputValues={b:v};return f;}
const shell=(id,inner,libraryId,title)=>({...wrapperCopy(id,inner,libraryId),title});
test('C4 with Kernel versions: keep leaves Sharpen alone and the batch shares one local Kernel; incoming updates Kernel for all',()=>{
  const target=()=>withRoots([kernel('K1',3),shell('Sharpen','K1',LS,'Sharpen')],['Sharpen']);
  const source=withRoots([kernel('K',5),shell('Blur','K',LB,'Blur'),shell('Glow','K',LG,'Glow')],['Blur','Glow']);
  const clip=plain(c.GrapeGraph.copyNodes(doc(source),['call0','call1'],'source'));
  const was=plain(clip);
  const kept=pasteInto(target(),clip),[blur,glow]=pastedRoots(kept);
  assert.deepEqual(plain(clip),was,'the clip itself is never changed');
  assert.deepEqual(plain(def(kept,'K1')),plain(def(target(),'K1')));assert.deepEqual(plain(def(kept,'Sharpen')),plain(def(target(),'Sharpen')));
  assert.equal(def(kept,blur).libraryId,undefined);assert.equal(def(kept,glow).libraryId,undefined,'their read-only users go local too');
  const [kb]=refsOf(def(kept,blur)),[kg]=refsOf(def(kept,glow));
  assert.equal(kb,kg,'Blur and Glow still share one Kernel');assert.notEqual(kb,'K1');assert.equal(def(kept,kb).libraryId,undefined);
  let n=0,d=0;
  const taken=doc(target()).change(m=>c.GrapeGraph.pasteClip(m,clip,{x:0,y:0},()=>'p'+ ++n,()=>'group','pixel',()=>'fresh'+ ++d,false,{conflicts:'incoming'})).after;
  assert.equal(taken.subgraphs.length,4,'K1, Sharpen, Blur, Glow');
  assert.equal(def(taken,'K1').graph.nodes[1].inputValues.b,5);assert.equal(def(taken,'K1').libraryId,LK);
  for(const root of pastedRoots(taken)){assert.notEqual(def(taken,root).libraryId,undefined);assert.deepEqual(plain(refsOf(def(taken,root))),['K1']);}
});

const repair=(g,shelfGraph,choice)=>{let k=0;return c.GrapeGraph.repairLibraryCopies(g,registry,shelfGraph,()=>'new'+ ++k,choice,at);};
test('C3 step 1: duplicates are settled flat — the copy with most direct instances stays, the same content merges or goes local',()=>{
  const g=withRoots([gainCopy('a2'),gainCopy('a1')],['a1','a2','a1']);
  const merged=repair(g,undefined,{});
  assert.deepEqual(plain(merged.document.subgraphs.map(f=>f.id)),['a1']);
  assert.deepEqual(plain(merged.document.stages.pixel.nodes.filter(n=>n.id.startsWith('call')).map(n=>n.params.subgraphId)),['a1','a1','a1']);
  const apart=repair(g,undefined,{duplicates:'separate'});
  assert.equal(def(apart.document,'a1').libraryId,L1);assert.equal(def(apart.document,'a2').libraryId,undefined);
  assert.deepEqual(plain(def(apart.document,'a2').provenance),[{kind:'library',libraryId:L1,title:'Gain',at}]);
  // Equal counts: the smallest in-graph ID, whatever the list order. 同票：取圖內 ID 最小的，不看清單順序。
  for(const order of [['b','c'],['c','b']]) assert.deepEqual(plain(repair(withRoots(order.map(id=>gainCopy(id)),['b','c']),undefined,{}).document.subgraphs.map(f=>f.id)),['b']);
  assert.deepEqual(plain(g),plain(withRoots([gainCopy('a2'),gainCopy('a1')],['a1','a2','a1'])),'the given graph is untouched');
});

test('C3 step 1 (Codex R2-1, R2-2): a copy kept apart takes its read-only users along; a parent made equal by a merge is not merged again',()=>{
  // A→B2, B1 equal: keeping B apart makes B2 local and A with it, although A matches its Library. A→B2，B1 相同：B 分開時 B2 轉本地，A 跟著轉。
  const g=withRoots([gainCopy('B1'),gainCopy('B2'),wrapperCopy('A','B2')],['B1','A']);
  const out=repair(g,undefined,{duplicates:'separate'}).document;
  assert.equal(def(out,'B1').libraryId,L1);assert.equal(def(out,'B2').libraryId,undefined);assert.equal(def(out,'A').libraryId,undefined);
  // P1→B1,B2 and P2→B1,B1: different on the original, so P is settled as different content even though merging B makes them equal.
  // P1→B1、B2 與 P2→B1、B1：原稿上不同，所以照「內容不同」處理，即使合併 B 後兩者相同。
  const p=(id,a,b)=>{const f=wrapperCopy(id,a);f.graph.nodes.push(node('extra','subgraph_instance',{subgraphId:b}));return f;};
  for(const list of [[gainCopy('B1'),gainCopy('B2'),p('P1','B1','B2'),p('P2','B1','B1')],[p('P2','B1','B1'),p('P1','B1','B2'),gainCopy('B2'),gainCopy('B1')]]){
    const r=repair(withRoots(list,['P1','P2','P2']),undefined,{}).document;
    assert.deepEqual(plain(r.subgraphs.map(f=>f.id).sort()),['B1','P1','P2']);
    assert.equal(def(r,'P2').libraryId,L2,'P2 has more direct instances and stays');assert.equal(def(r,'P1').libraryId,undefined);
    assert.deepEqual(plain(refsOf(def(r,'P1'))),['B1','B1']);
  }
});

// The Library as the caller resolves it: gain v2 (b=5) and a wrapper using it. 呼叫端解析好的資源庫：gain 第 2 版與用它的 wrapper。
function shelf(extra=[]){const g=emptyGraph();const lg=gainCopy('libGain');lg.graph.nodes[1].inputValues={b:5};g.subgraphs=[lg,wrapperCopy('libWrapper','libGain'),...extra];return g;}
test('C3 step 2: copies differing from the Library are all updated, or all made local with their read-only users',()=>{
  const g=()=>withRoots([gainCopy(),wrapperCopy()],['wrapper','gain']);
  const up=repair(g(),shelf(),{versions:'update'});
  assert.deepEqual(plain(up.differing.sort()),['gain','wrapper']);
  assert.equal(def(up.document,'gain').graph.nodes[1].inputValues.b,5);assert.equal(def(up.document,'gain').libraryId,L1);
  assert.deepEqual(plain(refsOf(def(up.document,'wrapper'))),['gain'],'in-graph IDs stay');
  assert.equal(up.document.subgraphs.length,2);
  const local=repair(g(),shelf(),{versions:'local'});
  assert.ok(local.document.subgraphs.every(f=>f.libraryId===undefined&&f.provenance[0].kind==='library'));
  assert.equal(def(local.document,'gain').graph.nodes[1].inputValues.b,3,'the graph keeps its content');
  assert.equal(local.document.subgraphs.length,2,'in place, no fork');
  // The same as the Library: nothing to do. 和資源庫相同：沒事。
  const same=repair(withRoots([{...gainCopy(),graph:shelf().subgraphs[0].graph}],['gain']),shelf(),{versions:'local'});
  assert.deepEqual(plain(same.differing),[]);assert.equal(def(same.document,'gain').libraryId,L1);
});

test('C3: the Library not found only settles duplicates; a lost ancestor goes local with its child; an update brings in a new dependency',()=>{
  const lost=withRoots([gainCopy(),wrapperCopy()],['wrapper']);
  const none=repair(lost,undefined,{versions:'local'});assert.ok(none.document.subgraphs.every(f=>f.libraryId!==undefined));
  // Only gain is in this Library; wrapper's own source is lost. 這個資源庫只有 gain；wrapper 的來源找不到。
  const onlyGain=emptyGraph();onlyGain.subgraphs=[shelf().subgraphs[0]];
  const local=repair(lost,onlyGain,{versions:'local'}).document;
  assert.equal(def(local,'gain').libraryId,undefined);assert.equal(def(local,'wrapper').libraryId,undefined,'the lost read-only user goes too (A3)');
  const updated=repair(lost,onlyGain,{versions:'update'}).document;
  assert.equal(def(updated,'wrapper').libraryId,L2,'updating needs nothing local');assert.equal(def(updated,'gain').graph.nodes[1].inputValues.b,5);
  // The Library's wrapper now uses a new dependency: it comes in read-only. 資源庫的 wrapper 多用了一個新依賴：唯讀進來。
  const extra={...gainCopy('libExtra'),libraryId:L3,title:'Extra'},lib=shelf([extra]);lib.subgraphs[1].graph.nodes.push(node('more','subgraph_instance',{subgraphId:'libExtra'}));
  const grown=repair(lost,lib,{versions:'update'}).document;
  const added=grown.subgraphs.find(f=>f.libraryId===L3);
  assert.ok(added);assert.deepEqual(plain(refsOf(def(grown,'wrapper'))),['gain',added.id]);
});

// ---- Codex review of R.119 (R119-1, R119-2) Codex 對 R.119 的審查 ----
// gain becomes "Blur" in the source, whose wrapper names its gain instance Gain_1 on purpose. 來源的 gain 改名 Blur，wrapper 刻意把實例叫 Gain_1。
function renamedSource(){const g=library();def(g,'gain').title='Blur';def(g,'wrapper').graph.nodes.find(n=>n.id==='inner').name='Gain_1';return g;}
const innerName=f=>f.graph.nodes.find(n=>n.id==='inner').name;
test('R119-1: taking the incoming version keeps the incoming parents whole — an existing parent and a new one keep their own instance names',()=>{
  const source=renamedSource(),clip=plain(c.GrapeGraph.copyNodes(doc(source),['second'],'other'));
  let n=0,d=0;const paste=t=>doc(t).change(m=>c.GrapeGraph.pasteClip(m,clip,{x:0,y:0},()=>'p'+ ++n,()=>'group','pixel',()=>'fresh'+ ++d,false,{conflicts:'incoming'})).after;
  const existing=paste(library());
  assert.equal(innerName(def(existing,'wrapper')),'Gain_1');
  assert.equal(c.GrapeGraph.standardForm(existing,registry,'wrapper'),c.GrapeGraph.standardForm(source,registry,'wrapper'));
  const onlyGain=library();onlyGain.subgraphs=onlyGain.subgraphs.filter(f=>f.id==='gain');onlyGain.stages.pixel.nodes=onlyGain.stages.pixel.nodes.filter(n=>n.id!=='second');
  onlyGain.stages.pixel.nodes.find(n=>n.id==='first').name='Gain_1';
  const fresh=paste(onlyGain),parent=fresh.subgraphs.find(f=>f.libraryId===L2);
  assert.equal(innerName(parent),'Gain_1','a parent brought in new is not renamed by the update of its child');
  assert.equal(def(fresh,'gain').title,'Blur');
  // An instance that was here before, still named by default, follows the new title. 原本就在、仍是預設名的實例跟著新 title 改名。
  assert.equal(fresh.stages.pixel.nodes.find(n=>n.id==='first').name,'Blur_1');
});

test('R119-1 at open: update all brings the Library content whole; opening again finds nothing different',()=>{
  const lib=renamedSource();lib.subgraphs.forEach(f=>{f.id='lib'+f.id;});def(lib,'libwrapper').graph.nodes.find(n=>n.id==='inner').params.subgraphId='libgain';
  const up=repair(library(),lib,{versions:'update'});
  assert.equal(innerName(def(up.document,'wrapper')),'Gain_1');
  assert.deepEqual(plain(repair(up.document,lib,{versions:'update'}).differing),[]);
});

test('R119-2: a root instance kept by its in-graph ID fits its values to the definition as this paste leaves it',()=>{
  const source=library();def(source,'gain').inputs=[port('extra','float',1)];def(source,'gain').graph.edges[0].from[1]='extra';
  def(source,'wrapper').graph.edges[0].to[1]='extra';source.stages.pixel.edges=[];source.stages.pixel.nodes.find(n=>n.id==='first').inputValues={extra:9};
  const clip=plain(c.GrapeGraph.copyNodes(doc(source),['first','second'],'same'));
  // Here wrapper is gone and gain still has its old interface. 這裡 wrapper 已刪，gain 還是舊接口。
  const target=library();target.subgraphs=target.subgraphs.filter(f=>f.id==='gain');target.stages.pixel.edges=[];target.stages.pixel.nodes=target.stages.pixel.nodes.filter(n=>n.id!=='second');
  let n=0,d=0;
  const after=doc(target).change(m=>c.GrapeGraph.pasteClip(m,clip,{x:0,y:0},()=>'p'+ ++n,()=>'group','pixel',()=>'fresh'+ ++d,true,{conflicts:'incoming'})).after;
  assert.deepEqual(plain(def(after,'gain').inputs.map(p=>p.id)),['extra']);
  assert.deepEqual(plain(after.stages.pixel.nodes.find(n=>n.id==='p1').inputValues),{extra:9});
});

test('C3 both steps (Codex R2-3, R.119 review): duplicates settled first, then the one copy updated; a copy made local in step 1 stays apart',()=>{
  const lib=emptyGraph();lib.subgraphs=[{...wrapperCopy('libA','libB'),title:'Wrapper 2'},{...gainCopy('libB')}];
  for(const order of [[gainCopy('B1'),gainCopy('B2'),wrapperCopy('A1','B1'),wrapperCopy('A2','B2')],[wrapperCopy('A2','B2'),wrapperCopy('A1','B1'),gainCopy('B2'),gainCopy('B1')]]){
    const merged=repair(withRoots(order,['A1','A2']),lib,{versions:'update'}).document;
    assert.deepEqual(plain(merged.subgraphs.map(f=>f.id).sort()),['A1','B1']);
    assert.equal(def(merged,'A1').title,'Wrapper 2');assert.deepEqual(plain(refsOf(def(merged,'A1'))),['B1']);
    const apart=repair(withRoots(order,['A1','A2']),lib,{duplicates:'separate',versions:'update'}).document;
    assert.deepEqual(plain(apart.subgraphs.filter(f=>f.libraryId!==undefined).map(f=>f.id).sort()),['A1','B1']);
    assert.equal(def(apart,'A1').title,'Wrapper 2');
    assert.equal(def(apart,'A2').libraryId,undefined);assert.equal(def(apart,'B2').libraryId,undefined);assert.deepEqual(plain(refsOf(def(apart,'A2'))),['B2']);
  }
});
