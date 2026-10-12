// Groups (Refactor.98; core groups.ts; design-interview 1-2, G-1–G-3). 群組（R.98）。
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const context=vm.createContext({});vm.runInContext(fs.readFileSync(path.join(__dirname,'../../src/generated/grape_core.js'),'utf8'),context);
const G=context.GrapeGraph,registry=G.registry,groups=G.groups;
const plain=v=>JSON.parse(JSON.stringify(v));
const bootstrap=JSON.parse(fs.readFileSync(path.join(__dirname,'../../src/generated/editor-bootstrap.json'),'utf8'));
const OP='a'.repeat(32);let counter=0;const newId=()=>'p'+(++counter),newGroupId=()=>'g'+(++counter);

// Default graph plus four Add nodes a–d. 預設圖加四個 Add。
function graph(){
  const doc=new G.GraphDocument(plain(bootstrap.defaultDocument.graph),registry);
  return new G.GraphDocument(doc.change(c=>{const net=c.networks.get('pixel');
    for(const [i,id] of ['a','b','c','d'].entries())net.insert({id,nodeType:'sgrape.builtin.add',params:{type:'float'},name:'Add_'+(i+1),ui:{x:i*200,y:0}});}).after,registry);
}
const step=(doc,edit)=>new G.GraphDocument(doc.change(c=>edit(c.networks.get('pixel'),c)).after,registry);
const of=doc=>plain(groups.groupsOf(doc.document.stages.pixel));

test('create, join, leave, rename, recolour and remove, each one change',()=>{
  let doc=step(graph(),net=>groups.createGroup(net,['a','b'],{id:'g1',name:'Group 1'}));
  assert.deepEqual(of(doc),[{id:'g1',name:'Group 1',nodes:['a','b']}]);
  assert.equal(groups.canGroup(of(doc),['a','c']),false,'a is in a group already');
  assert.equal(groups.canGroup(of(doc),['c']),false,'two or more');
  assert.equal(groups.joinTarget(of(doc),['a','c']).id,'g1');
  doc=step(doc,net=>groups.joinGroup(net,['a','c']));
  assert.deepEqual(of(doc)[0].nodes,['a','b','c']);
  assert.equal(groups.joinTarget(of(doc),['a','b']),null,'nothing new to add');
  doc=step(doc,net=>groups.leaveGroups(net,['c']));
  assert.deepEqual(of(doc)[0].nodes,['a','b']);
  doc=step(doc,net=>groups.changeGroup(net,'g1',{name:'Lights',color:'#75a28a'}));
  assert.deepEqual(of(doc),[{id:'g1',name:'Lights',nodes:['a','b'],color:'#75a28a'}]);
  assert.throws(()=>step(doc,net=>groups.changeGroup(net,'g1',{name:'  '})),/Invalid group name/);
  doc=step(doc,net=>groups.removeGroup(net,'g1'));
  assert.deepEqual(of(doc),[]);assert.equal(doc.document.stages.pixel.ui?.groups,undefined,'nothing left behind');
  assert.equal(doc.document.stages.pixel.nodes.filter(n=>['a','b'].includes(n.id)).length,2,'the nodes stay');
});

test('every change tidies: deleted members leave, an empty group goes, a node stays with its first group',()=>{
  let doc=step(graph(),net=>{groups.createGroup(net,['a','b'],{id:'g1',name:'One'});groups.createGroup(net,['c','d'],{id:'g2',name:'Two'});});
  doc=step(doc,net=>net.removeAll([net.node('a')]));
  assert.deepEqual(of(doc).map(g=>g.nodes),[['b'],['c','d']],'a group of one stays (legacy)');
  doc=step(doc,net=>net.removeAll([net.node('b')]));
  assert.deepEqual(of(doc).map(g=>g.id),['g2'],'empty: gone');
  // Data written by hand (TD, an old copy): repaired at the next change. 手寫的資料：下一次修改時修好。
  const raw=plain(doc.document);raw.stages.pixel.ui.groups.push({id:'g3',name:'Dup',nodes:['c','zz','c']},{id:'bad'});
  const fixed=step(new G.GraphDocument(raw,registry),net=>net.node('d').update({ui:{x:5,y:5}}));
  assert.deepEqual(of(fixed),[{id:'g2',name:'Two',nodes:['c','d']}],'c stays in g2; unknown, repeated and malformed go');
  assert.equal(G.groups.tidyGroups(plain(fixed.document)),0,'already tidy');
});

test('the body text is kept as written; empty takes it away (Refactor.99)',()=>{
  let doc=step(graph(),net=>groups.createGroup(net,['a','b'],{id:'g1',name:'G'}));
  doc=step(doc,net=>groups.changeGroup(net,'g1',{text:'Line one\n**two**'}));
  assert.equal(of(doc)[0].text,'Line one\n**two**');
  const copied=G.copyNodes(doc,['a','b'],OP);assert.equal(plain(copied.stages.pixel.ui.groups)[0].text,'Line one\n**two**','it comes along with a copy');
  doc=step(doc,net=>groups.changeGroup(net,'g1',{text:''}));
  assert.equal(of(doc)[0].text,undefined);assert.ok(!('text' in doc.document.stages.pixel.ui.groups[0]),'no empty field left');
  assert.throws(()=>step(doc,net=>groups.changeGroup(net,'g1',{text:'x'.repeat(groups.GROUP_TEXT_LIMIT+1)})),/too long/);
});

test('the body text\'s size and alignment are kept apart from the text; defaults are not stored (Refactor.101)',()=>{
  let doc=step(graph(),net=>groups.createGroup(net,['a','b'],{id:'g1',name:'G'}));
  doc=step(doc,net=>groups.changeGroup(net,'g1',{text:'Hi',textScale:1.5,textAlign:'center'}));
  assert.deepEqual([of(doc)[0].textScale,of(doc)[0].textAlign],[1.5,'center']);
  doc=step(doc,net=>groups.changeGroup(net,'g1',{textScale:1,textAlign:'left'}));
  const stored=doc.document.stages.pixel.ui.groups[0];
  assert.ok(!('textScale' in stored)&&!('textAlign' in stored),'1 and left are not stored');
  assert.throws(()=>step(doc,net=>groups.changeGroup(net,'g1',{textScale:20})),/text scale/);
  const raw=plain(doc.document);raw.stages.pixel.ui.groups[0].textAlign='justify';raw.stages.pixel.ui.groups[0].textScale=-1;
  assert.equal(G.groups.tidyGroups(raw),1,'bad values are tidied away');
});

test('the body text sits above the members or below them; top is not stored (Refactor.105.16)',()=>{
  let doc=step(graph(),net=>groups.createGroup(net,['a','b'],{id:'g1',name:'G'}));
  doc=step(doc,net=>groups.changeGroup(net,'g1',{text:'Hi',textPlace:'bottom'}));
  assert.equal(of(doc)[0].textPlace,'bottom');
  doc=step(doc,net=>groups.changeGroup(net,'g1',{textPlace:'top'}));
  assert.ok(!('textPlace' in doc.document.stages.pixel.ui.groups[0]),'top is not stored');
  assert.throws(()=>step(doc,net=>groups.changeGroup(net,'g1',{textPlace:'middle'})),/text place/);
  const raw=plain(doc.document);raw.stages.pixel.ui.groups[0].textPlace='middle';
  assert.equal(G.groups.tidyGroups(raw),1,'a bad place is tidied away');
});

test('a ghost node is still a member',()=>{
  const raw=plain(step(graph(),net=>groups.createGroup(net,['a','b'],{id:'g1',name:'G'})).document);
  raw.stages.pixel.nodes.find(n=>n.id==='a').nodeType='sgrape.builtin.not_a_node';
  assert.equal(G.groups.tidyGroups(raw),0);
  assert.deepEqual(plain(G.groups.groupsOf(raw.stages.pixel))[0].nodes,['a','b']);
});

test('copy and paste bring a group only when all its members come (G-2), under new IDs',()=>{
  const doc=step(graph(),net=>groups.createGroup(net,['a','b'],{id:'g1',name:'Pair'}));
  const whole=G.copyNodes(doc,['a','b','c'],OP),part=G.copyNodes(doc,['b','c'],OP);
  assert.deepEqual(plain(whole.stages.pixel.ui.groups).map(g=>g.id),['g1']);
  assert.equal(part.stages.pixel.ui,undefined,'b alone does not bring the group');
  let ids;const pasted=new G.GraphDocument(doc.change(c=>{ids=G.pasteClip(c,whole,{x:0,y:400},newId,newGroupId);}).after,registry);
  const all=of(pasted);
  assert.equal(all.length,2);
  const fresh=all.find(g=>g.id!=='g1');
  assert.equal(fresh.name,'Pair');assert.deepEqual(fresh.nodes,plain(ids.slice(0,2)),'its members are the pasted copies');
});

// Deep clean of Refactor.93–102 (2026-10-12): fixes found by the audit. 深度清潔（10-12）：檢查找到的修正。
test('limits and repeats: a join that would pass the member limit is not offered; the same node twice cannot make a group',()=>{
  const full=Array.from({length:groups.MEMBER_LIMIT},(_,i)=>'m'+i);
  const listed=[{id:'g1',name:'Full',nodes:full}];
  assert.equal(groups.joinTarget(listed,['m0','x']),null,'one more than the limit');
  assert.equal(groups.joinTarget([{id:'g1',name:'Room',nodes:full.slice(1)}],['m1','x']).id,'g1','fits exactly');
  assert.equal(groups.canGroup([],['a','a']),false);
});

test('tidying compares values, not the order fields were written in; source snapshots of subgraphs are left as they are',()=>{
  const network=nodes=>({nodes:nodes.map(id=>({id,nodeType:'sgrape.builtin.add',params:{}})),edges:[]});
  const reordered={...network(['a','b']),ui:{groups:[{nodes:['a','b'],name:'One',id:'g1'}]}};
  assert.equal(groups.tidy(reordered).fixed,false);
  const snapshot={...network(['a']),ui:{groups:[{id:'g1',name:'Gone',nodes:['missing']}]}};
  const document={stages:{pixel:network([])},subgraphs:[{id:'s',name:'S',scope:'library',graph:snapshot}]};
  assert.equal(groups.tidyGroups(document),0);
  assert.deepEqual(plain(snapshot.ui.groups),[{id:'g1',name:'Gone',nodes:['missing']}],'its authored bytes stay');
});
