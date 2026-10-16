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

test('a pasted Library copy is reused when the same one is here, and comes in read-only otherwise',()=>{
  let made=0;const newId=()=>'n'+ ++made,newGroupId=()=>'g'+made,newSub=()=>'sub'+ ++made;
  const clip=plain(c.GrapeGraph.copyNodes(doc(library()),['first'],'otherOp'));
  assert.ok(clip.subgraphs.some(f=>f.libraryId===L1),'the copy carries the Library ID');
  // The same gain is here: reused, nothing added. 這裡有同一份 gain：沿用，不加。
  const same=doc(library()).change(m=>c.GrapeGraph.pasteClip(m,clip,{x:0,y:0},newId,newGroupId,'pixel',newSub,false));
  assert.equal(same.after.subgraphs.length,2);
  assert.equal(same.after.stages.pixel.nodes.at(-1).params.subgraphId,'gain');
  // Here gain differs, or is local: a new read-only copy comes in. 這裡的 gain 不同或是本地的：加入一份新的唯讀副本。
  const differs=library();def(differs,'gain').title='Changed';
  for(const target of [differs,sharedGraph()]){
    const step=doc(target).change(m=>c.GrapeGraph.pasteClip(m,clip,{x:0,y:0},newId,newGroupId,'pixel',newSub,false));
    const added=step.after.subgraphs.filter(f=>f.libraryId===L1&&f.title==='Gain');
    assert.equal(added.length,1);assert.notEqual(added[0].id,'gain');
    assert.throws(()=>doc(step.after).change(m=>m.subgraph(added[0].id).rename('Nope')),readOnly);
  }
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

test('R118-2: a paste keeps separate dependencies separate, and pasting the same copy again adds nothing',()=>{
  // wrapper uses gain and gainB, equal in content but two definitions. wrapper 用 gain 與 gainB：內容相同，但是兩份。
  const w=wrapperCopy();w.graph.nodes.push(node('extra','subgraph_instance',{subgraphId:'gainB'}));
  const source=withRoots([gainCopy(),gainCopy('gainB'),w],['wrapper']),clip=plain(c.GrapeGraph.copyNodes(doc(source),['call0'],'source'));
  const after=pasteInto(withRoots([gainCopy('existing')],[]),clip),root=pastedRoots(after)[0];
  const deps=refsOf(def(after,root));
  assert.notEqual(deps[0],deps[1],'still two dependencies');
  assert.equal(c.GrapeGraph.standardForm(source,registry,'wrapper'),c.GrapeGraph.standardForm(after,registry,root));
  const again=pasteInto(after,clip,false,10);
  assert.equal(again.subgraphs.length,after.subgraphs.length,'the second paste reuses everything');
});

test('R118-2: a paste keeps a shared dependency shared when reusing a parent fixes it, from another graph or restoring in this one',()=>{
  for(const sameSource of [false,true]){
    const source=withRoots([gainCopy(),wrapperCopy(),wrapperCopy('localC','gain',null)],['wrapper','localC']);
    const target=withRoots([gainCopy('decoy'),gainCopy('usedByA'),wrapperCopy('existingA','usedByA')],[]);
    const after=pasteInto(target,plain(c.GrapeGraph.copyNodes(doc(source),['call0','call1'],'source')),sameSource);
    const [a,cdef]=pastedRoots(after);
    assert.equal(a,'existingA','the read-only parent is reused');
    assert.deepEqual(plain(refsOf(def(after,cdef))),plain(refsOf(def(after,a))),'the local C uses the same gain as A');
  }
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
test('R118.1-1: when the whole batch can be reused, no order of the copy or of the graph adds a definition, also at 64 definitions',()=>{
  for(const roots of [['B','A'],['A','B']]) for(const order of [['B0','B1'],['B1','B0']]) for(const sameSource of [false,true]){
    const source=withRoots([gainCopy('B'),wrapperCopy('A','B')],roots),target=withRoots([...order.map(id=>gainCopy(id)),wrapperCopy('A0','B1')],[]);
    const after=pasteInto(target,plain(c.GrapeGraph.copyNodes(doc(source),['call0','call1'],'source')),sameSource);
    assert.equal(after.subgraphs.length,3,roots+' / '+order+' / '+sameSource);
    assert.deepEqual(plain(pastedRoots(after).sort()),['A0','B1']);
  }
  // At the 64-definition limit the same paste must still pass. 滿 64 份時同一筆貼上照樣要過。
  const fillers=Array.from({length:61},(_,i)=>({...gainCopy('filler'+i),title:'Filler'+i}));
  for(const roots of [['B','A'],['A','B']]){
    const after=pasteInto(withRoots([gainCopy('B0'),gainCopy('B1'),wrapperCopy('A0','B1'),...fillers],[]),plain(c.GrapeGraph.copyNodes(doc(withRoots([gainCopy('B'),wrapperCopy('A','B')],roots)),['call0','call1'],'source')));
    assert.equal(after.subgraphs.length,64);
  }
  // Two roots, neither above the other, sharing B: a later root may decide what an earlier one should have reused. 兩個互不為祖先的根共用 B。
  for(const roots of [['A','C'],['C','A']]){
    const source=withRoots([gainCopy('B'),wrapperCopy('A','B'),wrapperCopy('C','B',L3)],roots);
    const target=withRoots([gainCopy('B0'),gainCopy('B1'),wrapperCopy('A0','B0'),wrapperCopy('A1','B1'),wrapperCopy('C0','B1',L3)],[]);
    const after=pasteInto(target,plain(c.GrapeGraph.copyNodes(doc(source),['call0','call1'],'source')));
    assert.equal(after.subgraphs.length,5,'nothing added: '+roots);
    assert.deepEqual(plain(pastedRoots(after).sort()),['A1','C0']);
  }
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
