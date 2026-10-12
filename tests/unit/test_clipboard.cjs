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
