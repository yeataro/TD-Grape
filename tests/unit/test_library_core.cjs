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
