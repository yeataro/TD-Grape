// Copy, paste and duplicate of nodes (Refactor.96; core clipboard.ts; design-interview Q37 1-4). 節點的複製、貼上、複製副本（R.96）。
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const context=vm.createContext({});vm.runInContext(fs.readFileSync(path.join(__dirname,'../../src/generated/grape_core.js'),'utf8'),context);
const G=context.GrapeGraph,registry=G.registry;
const plain=v=>JSON.parse(JSON.stringify(v));
const bootstrap=JSON.parse(fs.readFileSync(path.join(__dirname,'../../src/generated/editor-bootstrap.json'),'utf8'));
const OP='a'.repeat(32);
let counter=0;const newId=()=>'p'+(++counter),newGroupId=()=>'g'+(++counter);

// Default graph plus a constant, its reference, and Add_1 (ref, color) feeding Color Output. 預設圖加常數、引用、Add_1。
function graph(){
  const doc=new G.GraphDocument(plain(bootstrap.defaultDocument.graph),registry);
  const result=doc.change(c=>{
    c.addDeclaration({id:'k1',kind:'constant',name:'kOffset',type:'vec4',value:[0.5,0,0,0]});
    const net=c.networks.get('pixel'),color=net.nodes.find(n=>n.data.nodeType==='sgrape.builtin.color');
    net.insert({id:'ref',nodeType:'sgrape.builtin.declaration',params:{declarationId:'k1'},ui:{x:100,y:200}});
    net.insert({id:'sum',nodeType:'sgrape.builtin.add',params:{type:'vec4'},name:'Add_1',ui:{x:300,y:240}});
    const output=net.nodes.find(n=>n.data.nodeType==='sgrape.builtin.pixel_out');
    net.connect(net.node('ref').outputs[0],net.node('sum').port('input','a'),G.values.policy);
    net.connect(color.outputs[0],net.node('sum').port('input','b'),G.values.policy);
    net.connect(net.node('sum').outputs[0],output.port('input','color'),G.values.policy);
  });
  return new G.GraphDocument(result.after,registry);
}
const output=doc=>doc.document.stages.pixel.nodes.find(n=>n.nodeType==='sgrape.builtin.pixel_out').id;

test('a copy holds the chosen nodes, the wires between them and the declarations they use, in the save format',()=>{
  const doc=graph(),clip=plain(G.copyNodes(doc,['ref','sum',output(doc)],OP));
  assert.equal(clip.format,'grape-graph');assert.equal(clip.version,1);assert.equal(clip.source,OP);
  assert.deepEqual(clip.stages.pixel.nodes.map(n=>n.id),['ref','sum'],'the Color Output is never copied');
  assert.equal(clip.stages.pixel.edges.length,1,'only ref→sum: the wire from color and the one to the output have an end outside');
  assert.deepEqual(clip.declarations.map(d=>d.id),['k1']);
  assert.equal(G.copyNodes(doc,[output(doc)],OP),null,'nothing that can be copied');
  assert.deepEqual(plain(G.readClip(JSON.stringify(clip))),clip,'read back');
  assert.equal(G.readClip('hello'),null);assert.equal(G.readClip('{"format":"other"}'),null);
});

test('pasting gives new IDs and names, keeps the layout from the corner and the wires between, as one change',()=>{
  const doc=graph(),clip=G.copyNodes(doc,['ref','sum'],OP);
  let ids;const result=doc.change(c=>{ids=G.pasteClip(c,clip,{x:1000,y:500},newId,newGroupId);});
  const nodes=result.after.stages.pixel.nodes,pasted=ids.map(id=>nodes.find(n=>n.id===id));
  assert.equal(pasted.length,2);assert.ok(!ids.includes('ref')&&!ids.includes('sum'));
  assert.deepEqual(plain(pasted.map(n=>[n.ui.x,n.ui.y])),[[1000,500],[1200,540]],'top-left at the point, the rest as they were');
  assert.equal(pasted[1].name,'Add_2','the next free name');assert.equal(pasted[0].name,undefined,'a reference takes no name');
  assert.equal(pasted[0].params.declarationId,'k1','the same shared source in the same Grape OP');
  const wires=result.after.stages.pixel.edges.filter(e=>ids.includes(e.from[0])||ids.includes(e.to[0]));
  assert.deepEqual(plain(wires.map(e=>[e.from,e.to])),[[[ids[0],'out'],[ids[1],'a']]],'only the wire between them');
  assert.equal(result.after.declarations.filter(d=>d.name.startsWith('kOffset')).length,1,'no copy of the declaration');
});

test('a declaration deleted since the copy comes back; pasting twice names on',()=>{
  const doc=graph(),clip=G.copyNodes(doc,['ref','sum'],OP);
  const gone=new G.GraphDocument(doc.change(c=>c.removeDeclaration('k1')).after,registry);
  const back=gone.change(c=>{G.pasteClip(c,clip,{x:0,y:0},newId,newGroupId);G.pasteClip(c,clip,{x:24,y:24},newId,newGroupId);}).after;
  assert.ok(back.declarations.some(d=>d.id==='k1'&&d.name==='kOffset'),'the same declaration again');
  assert.deepEqual(plain(back.stages.pixel.nodes.filter(n=>n.nodeType==='sgrape.builtin.add').map(n=>n.name)),['Add_1','Add_2','Add_3'],'Add_1 stays (only references go with a declaration); each paste takes the next name');
});

// Codex boundary review R08 A (Refactor.122): the rule above, the other half — the name is taken again, so the reference comes in as
// a ghost, as on opening; the nodes copied with it come in too. 名字又被用了：引用以 Ghost 進來（同開圖），一起複製的節點也進來。
test('a reference whose declaration name is taken again since the copy pastes as a ghost, with the rest of the copy',()=>{
  const doc=graph(),clip=G.copyNodes(doc,['ref','sum'],OP);
  const retaken=new G.GraphDocument(doc.change(c=>{c.removeDeclaration('k1');c.addDeclaration({id:'k2',kind:'constant',name:'kOffset',type:'float',value:1});}).after,registry);
  let ids;const after=retaken.change(c=>{ids=G.pasteClip(c,clip,{x:0,y:0},newId,newGroupId);}).after;
  assert.equal(ids.length,2,'both copied nodes are pasted');
  assert.ok(!after.declarations.some(d=>d.id==='k1'),'the old declaration does not come back: its name is in use');
  const pasted=new G.GraphDocument(after,registry),ghosts=G.ghostsOf(pasted.networks.get('pixel'),G.values.policy);
  assert.equal(ghosts.nodes.get(ids[0]),'missing','the reference is a ghost of a missing declaration');
  assert.equal(ghosts.nodes.has(ids[1]),false,'the Add beside it is an ordinary node');
});

test('duplicate is a paste of a fresh copy from its corner',()=>{
  const doc=graph(),clip=G.copyNodes(doc,['sum'],OP);
  assert.deepEqual(plain(G.clipCorner(clip)),{x:300,y:240});
});

// Deep clean (2026-10-12): a hand-made copy with a place that is not a number counts it as 0, not NaN. 深度清潔：手寫的複製位置不是數字時當 0。
test('a place that is not a number counts as 0',()=>{
  const doc=graph(),clip=G.copyNodes(doc,['ref','sum'],OP);clip.stages.pixel.nodes[0].ui.x='left';
  assert.ok(Number.isFinite(G.clipCorner(clip).x));
  let ids;const result=doc.change(c=>{ids=G.pasteClip(c,clip,{x:0,y:0},newId,newGroupId);});
  assert.ok(ids.every(id=>{const n=result.after.stages.pixel.nodes.find(n=>n.id===id);return Number.isFinite(n.ui.x)&&Number.isFinite(n.ui.y);}));
});

// Definitions travel with a copy (basic design 2026-10-14 §3.13, amendment A5; Refactor.111). 定義跟著複製走（§3.13、A5；R.111）。
test('a copy carries the definitions its instances use, with their closure; pasted into the same graph the instances keep their definition, elsewhere a new one',()=>{
  const doc=graph();
  const made=new G.GraphDocument(doc.change(c=>{
    c.createSubgraph({id:'inner',title:'Inner'});
    const outer=c.createSubgraph({id:'outer',title:'Outer'});
    c.networks.get('subgraph:outer').instantiateSubgraph('inner','nested',{x:0,y:0});
    c.networks.get('pixel').instantiateSubgraph('outer','instance',{x:10,y:10});
    void outer;
  }).after,registry);
  const clip=plain(G.copyNodes(made,['instance'],OP));
  assert.deepEqual(clip.subgraphs.map(f=>f.id).sort(),['inner','outer'],'the closure comes along');
  assert.deepEqual(plain(G.readClip(JSON.stringify(clip))).subgraphs.map(f=>f.id).sort(),['inner','outer']);
  // Same graph, definitions still there: the pasted instance points at the same definition. 同圖、定義還在：貼上的實例指同一份。
  let counter2=0;const newSub=()=>'s'+(++counter2);
  const same=made.change(c=>{G.pasteClip(c,clip,{x:0,y:0},newId,newGroupId,'pixel',newSub,true);});
  assert.equal(same.after.subgraphs.length,2);
  assert.deepEqual(plain(same.after.stages.pixel.nodes.filter(n=>n.nodeType==='sgrape.builtin.subgraph_instance').map(n=>n.params.subgraphId)),['outer','outer']);
  // Another graph: new identities, the nested relation kept. 別張圖：新身分，巢狀關係保留。
  const other=made.change(c=>{G.pasteClip(c,clip,{x:0,y:0},newId,newGroupId,'pixel',newSub,false);});
  assert.equal(other.after.subgraphs.length,4);
  const pastedInstance=other.after.stages.pixel.nodes.filter(n=>n.nodeType==='sgrape.builtin.subgraph_instance').at(-1);
  assert.notEqual(pastedInstance.params.subgraphId,'outer');
  const newOuter=other.after.subgraphs.find(f=>f.id===pastedInstance.params.subgraphId),newInner=newOuter.graph.nodes.find(n=>n.nodeType==='sgrape.builtin.subgraph_instance').params.subgraphId;
  assert.notEqual(newInner,'inner');assert.ok(other.after.subgraphs.some(f=>f.id===newInner));
  // Same graph, the definition deleted since: it comes back under a new identity (A5 rule 1). 同圖、定義已刪：以新身分恢復。
  const gone=new G.GraphDocument(made.change(c=>{const net=c.networks.get('pixel');net.removeAll([net.node('instance')],new Set(['outer','inner']));}).after,registry);
  assert.equal(gone.document.subgraphs.length,0);
  const back=gone.change(c=>{G.pasteClip(c,clip,{x:0,y:0},newId,newGroupId,'pixel',newSub,true);});
  assert.equal(back.after.subgraphs.length,2);assert.ok(back.after.subgraphs.every(f=>!['outer','inner'].includes(f.id)));
  // A definition from a Library is refused as a whole (amendment B7). 來自 Library 的定義整份拒絕（B7）。
  const lib=plain(clip);lib.subgraphs[0].libraryId='x';
  assert.throws(()=>made.change(c=>{G.pasteClip(c,lib,{x:0,y:0},newId,newGroupId,'pixel',newSub,false);}),e=>/Invalid Library ID/.test(e.message));
});

// Technical review R109–R112 (Refactor.113). 子圖技術審查的修正。
const {sharedGraph,node:fixtureNode}=require('../fixtures/shared_subgraphs.cjs');
const compiles=g=>{try{G.createCompiler(registry).compile(plain(g));return true;}catch(e){return e.message;}};
const callsIn=network=>network.nodes.filter(n=>n.nodeType==='sgrape.builtin.subgraph_instance');
let reviewCounter=0;const reviewSub=()=>'r'+(++reviewCounter);

test('TECH-1: a restored definition brings its dependencies from the copy; pasted instances whose definition is here keep it',()=>{
  const raw=sharedGraph(),wrapper2={...plain(raw.subgraphs[1]),id:'wrapper2',title:'Wrapper2'};
  raw.subgraphs.push(wrapper2);raw.stages.pixel.nodes.push(fixtureNode('third','subgraph_instance',{subgraphId:'wrapper2'}));
  const original=new G.GraphDocument(raw,registry),clip=plain(G.copyNodes(original,['first','second','third'],OP));
  const changed=new G.GraphDocument(original.change(c=>{
    const net=c.networks.get('pixel');net.remove(net.node('second'));net.remove(net.node('third'));
    c.removeSubgraph('wrapper');c.removeSubgraph('wrapper2');
    c.networks.get('subgraph:gain').node('mul').update({inputValues:{b:99}});
  }).after,registry);
  const step=changed.change(c=>{G.pasteClip(c,clip,{x:0,y:0},newId,newGroupId,'pixel',reviewSub,true);});
  const pasted=callsIn(step.after.stages.pixel).slice(-3),[first,second,third]=pasted.map(n=>n.params.subgraphId);
  assert.equal(first,'gain','a pasted instance whose definition is still here keeps it');
  const inner=id=>callsIn(step.after.subgraphs.find(f=>f.id===id).graph)[0].params.subgraphId;
  assert.notEqual(inner(second),'gain','a restored parent never points at the current child');
  assert.equal(inner(second),inner(third),'parents restored together share one restored child');
  const restoredGain=step.after.subgraphs.find(f=>f.id===inner(second));
  assert.deepEqual(plain(restoredGain.graph.nodes.find(n=>n.id==='mul').inputValues),{b:3},'the child comes back as copied');
  assert.deepEqual(plain(step.after.subgraphs.find(f=>f.id==='gain').graph.nodes.find(n=>n.id==='mul').inputValues),{b:99},'the current child is untouched');
  assert.equal(compiles(step.after),true);
});

test('TECH-2: an instance copied before its interface changed takes the current interface; a wire to a removed port is a ghost wire',()=>{
  const setup=edit=>{
    const raw=sharedGraph();raw.stages.pixel.nodes.find(n=>n.id==='first').inputValues={value:5};
    const gain=raw.subgraphs.find(f=>f.id==='gain');gain.graph.edges=gain.graph.edges.filter(e=>e.from[0]!=='in');
    const original=new G.GraphDocument(raw,registry),clip=plain(G.copyNodes(original,['source','first'],OP));
    const changed=new G.GraphDocument(original.change(c=>c.subgraph('gain').editInterface('inputs',edit)).after,registry);
    assert.equal(compiles(changed.document),true,'the graph compiles before the paste');
    const step=changed.change(c=>{G.pasteClip(c,clip,{x:0,y:0},newId,newGroupId,'pixel',reviewSub,true);});
    return {step,pasted:callsIn(step.after.stages.pixel).at(-1)};
  };
  const removed=setup({kind:'remove',id:'value'});
  assert.deepEqual(plain(removed.pasted.inputValues),{});
  const wire=removed.step.after.stages.pixel.edges.find(e=>e.to[0]===removed.pasted.id);
  assert.ok(wire,'the wire to the removed port is kept in the graph');
  const after=new G.GraphDocument(removed.step.after,registry);
  assert.ok(G.ghostsOf(after.networks.get('pixel'),G.values.policy).edges.has(after.networks.get('pixel').edges.find(e=>e.data===after.networks.get('pixel').data.edges.find(d=>d.to[0]===removed.pasted.id)).id),'and shown as a ghost wire');
  assert.equal(compiles(removed.step.after),true);
  const vector=setup({kind:'update',id:'value',patch:{type:'vec3'}});
  assert.deepEqual(plain(vector.pasted.inputValues),{value:[5,5,5]});assert.equal(compiles(vector.step.after),true);
  const texture=setup({kind:'update',id:'value',patch:{type:'sampler2D'}});
  assert.deepEqual(plain(texture.pasted.inputValues),{});assert.equal(compiles(texture.step.after),true);
});

test('TECH-4: every definition the copy carries is validated, also one that will not be brought in',()=>{
  const original=new G.GraphDocument(sharedGraph(),registry),clip=plain(G.copyNodes(original,['second'],OP));
  clip.subgraphs.find(f=>f.id==='gain').libraryId='handmade';
  const parsed=G.readClip(JSON.stringify(clip)),before=JSON.stringify(original.document);
  assert.throws(()=>original.change(c=>{G.pasteClip(c,parsed,{x:0,y:0},newId,newGroupId,'pixel',reviewSub,true);}),e=>/Invalid Library ID/.test(e.message));
  assert.equal(JSON.stringify(original.document),before,'nothing is written');
  // R113-2: a refused definition cannot hide behind a good one with the same ID. 被拒的定義不能藏在同 ID 的正常定義後面。
  const hidden=plain(G.copyNodes(original,['second'],OP));
  hidden.subgraphs.unshift({...plain(hidden.subgraphs.find(f=>f.id==='gain')),libraryId:'handmade'});
  assert.throws(()=>original.change(c=>{G.pasteClip(c,G.readClip(JSON.stringify(hidden)),{x:0,y:0},newId,newGroupId,'pixel',reviewSub,true);}),e=>/Invalid Library ID/.test(e.message));
  const twice=plain(G.copyNodes(original,['second'],OP));twice.subgraphs.push(plain(twice.subgraphs[0]));
  assert.throws(()=>original.change(c=>{G.pasteClip(c,G.readClip(JSON.stringify(twice)),{x:0,y:0},newId,newGroupId,'pixel',reviewSub,true);}),/Duplicate Subgraph identity/);
  assert.equal(JSON.stringify(original.document),before);
});
