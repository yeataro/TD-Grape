// Library packages (Refactor.123; design workspace work/refactor/library-package-build-design-2026-10-18.md revision 3, design-interview
// Q78 cont.; acceptance = design §11, from Codex's review of revision 2). 資源庫包的解析與檢查；驗收照設計第十一節。
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const context=vm.createContext({});vm.runInContext(fs.readFileSync(path.join(__dirname,'../../src/generated/grape_core.js'),'utf8'),context);
const G=context.GrapeGraph,registry=G.registry;
const {sharedGraph,node,edge,port}=require('../fixtures/shared_subgraphs.cjs');
const plain=v=>JSON.parse(JSON.stringify(v));
const uid=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const ID={gain:uid(1),wrapper:uid(2),outer:uid(3),user:uid(4),a:uid(5),b:uid(6),k:uid(7),j:uid(8),p:uid(9)};

// The shared graph (Wrapper wires its value into Gain) plus Outer (uses Wrapper) and User (uses Gain, its value left free), optionally
// edited by legal operations; Library IDs are given last. 共用圖（Wrapper 把 value 接進 Gain），加上 Outer（用 Wrapper）、User（用 Gain、
// value 不接）；可先用合法操作改，最後才給 Library ID。
function graph(edit){
  const g=sharedGraph();
  g.subgraphs.push({id:'outer',title:'Outer',inputs:[port('value')],outputs:[port('result')],graph:{nodes:[node('in','subgraph_input'),node('inner','subgraph_instance',{subgraphId:'wrapper'}),node('out','subgraph_output')],edges:[edge('in','inner','value','value'),edge('inner','out','result','result')]}});
  g.subgraphs.push({id:'user',title:'User',inputs:[],outputs:[port('result')],graph:{nodes:[node('in','subgraph_input'),node('inner','subgraph_instance',{subgraphId:'gain'}),node('out','subgraph_output')],edges:[edge('inner','out','result','result')]}});
  const after=edit?new G.GraphDocument(g,registry).change(edit).after:g;
  for(const f of after.subgraphs)if(ID[f.id])f.libraryId=ID[f.id];
  return after;
}
const file=(g,root)=>plain(G.saveLibraryFile(g,registry,root,()=>{throw Error('every definition has an ID here');}));
const source=(name,files)=>({name,files:Object.entries(files).map(([n,content])=>({name:n,content}))});
const resolve=(...sources)=>G.resolveLibrary(sources,registry);
const items=r=>r.items.map(i=>i.libraryId).sort();
const reasons=r=>Object.fromEntries([...r.unusable].map(([id,p])=>[id,p.code]));
const removeValue=m=>m.subgraph('gain').editInterface('inputs',{kind:'remove',id:'value'});
const timesFive=m=>m.networks.get('subgraph:gain').node('mul').setInput('b',5);
const old=graph(),files={gain:file(old,'gain'),wrapper:file(old,'wrapper'),outer:file(old,'outer'),user:file(old,'user')};

test('the result does not depend on the order of the files (three levels, a shared dependency)',()=>{
  const names=Object.keys(files),results=[];
  for(const order of [names,[...names].reverse(),[names[2],names[0],names[3],names[1]]])
    results.push(plain(resolve(source('built-in',Object.fromEntries(order.map(n=>[n+'.json',files[n]]))))));
  const key=r=>JSON.stringify({items:r.items.map(i=>[i.libraryId,i.file]).sort(),problems:r.problems.map(p=>JSON.stringify(p)).sort()});
  assert.deepEqual(results.map(key),[key(results[0]),key(results[0]),key(results[0])]);
  assert.deepEqual(results[0].items.map(i=>i.libraryId).sort(),[ID.gain,ID.wrapper,ID.outer,ID.user].sort());
  assert.deepEqual(results[0].problems,[]);
});

// Codex A1: Gain loses the input Wrapper wires into. Reading and compiling still passed; the ghost check refuses Wrapper and what uses it,
// and only them (Codex R2-1: User uses Gain with that input free). Gain 少了 Wrapper 接著的輸入：只擋 Wrapper 與用它的。
test('a subgraph broken by a dependency that lost a wired input is refused, with what uses it, and only them',()=>{
  const fresh=file(graph(removeValue),'gain');
  const r=resolve(source('built-in',{'gain.json':fresh,'wrapper.json':files.wrapper,'outer.json':files.outer,'user.json':files.user}));
  assert.deepEqual(reasons(r),{[ID.wrapper]:'ghost',[ID.outer]:'dependsOnUnusable'});
  assert.deepEqual(items(r),[ID.gain,ID.user].sort());
  assert.match(r.unusable.get(ID.wrapper).detail,/top: wire in\.value → inner\.value/);
  assert.deepEqual(plain(r.unusable.get(ID.wrapper).at),['built-in/wrapper.json']);
});

test('across sources the higher one wins first, even its carried copy over a lower own file; its change reaches lower subgraphs',()=>{
  // The new Gain in the built-in package breaks Wrapper in a personal one. 內建包的新 Gain 弄壞個人包的 Wrapper。
  const broken=resolve(source('built-in',{'gain.json':file(graph(removeValue),'gain')}),source('personal',{'wrapper.json':files.wrapper,'outer.json':files.outer,'user.json':files.user}));
  assert.deepEqual(reasons(broken),{[ID.wrapper]:'ghost',[ID.outer]:'dependsOnUnusable'});
  assert.deepEqual(items(broken),[ID.gain,ID.user].sort());
  // A copy carried in the higher source beats the lower source's own file; that own file is then not offered. 高來源夾帶的勝過低來源自己的檔。
  const carried=resolve(source('built-in',{'wrapper.json':files.wrapper}),source('personal',{'gain.json':file(graph(timesFive),'gain')}));
  assert.deepEqual(items(carried),[ID.wrapper]);
  assert.equal(carried.items[0].file.dependencies.find(d=>d.libraryId===ID.gain).graph.nodes.find(n=>n.id==='mul').inputValues.b,3);
});

test('two carried copies that disagree are refused, unless a higher source holds that subgraph (Codex R2-1)',()=>{
  const other=graph(timesFive),low={'wrapper.json':files.wrapper,'user.json':file(other,'user')};
  const alone=resolve(source('personal',low));
  assert.equal(alone.unusable.get(ID.gain).code,'conflictingCopies');
  assert.deepEqual(plain(alone.unusable.get(ID.gain).at),['personal/user.json','personal/wrapper.json']);
  assert.deepEqual(reasons(alone),{[ID.gain]:'conflictingCopies',[ID.wrapper]:'dependsOnUnusable',[ID.user]:'dependsOnUnusable'});
  const settled=resolve(source('built-in',{'gain.json':files.gain}),source('personal',low));
  assert.deepEqual(plain(settled.problems),[]);
  assert.deepEqual(items(settled),[ID.gain,ID.wrapper,ID.user].sort());
});

test('two files that are both the same subgraph are refused, naming both',()=>{
  const r=resolve(source('built-in',{'gain.json':files.gain,'gain2.json':file(graph(timesFive),'gain'),'wrapper.json':files.wrapper}));
  assert.equal(r.unusable.get(ID.gain).code,'duplicateRoot');
  assert.deepEqual(plain(r.unusable.get(ID.gain).at),['built-in/gain.json','built-in/gain2.json']);
  assert.equal(r.unusable.get(ID.wrapper).code,'dependsOnUnusable');
});

// Leaves and users built by hand: a leaf gives a constant; a user calls one child. 手做的葉與使用者：葉給一個常數；使用者呼叫一個子。
const leaf=(id,title,extra=[])=>({id,title,inputs:[],outputs:[port('result')],graph:{nodes:[node('in','subgraph_input'),node('k','scalar',{type:'float',value:1}),...extra,node('out','subgraph_output')],edges:[edge('k','out','out','result')]}});
const caller=(id,title,child)=>({id,title,inputs:[],outputs:[port('result')],graph:{nodes:[node('in','subgraph_input'),node('i','subgraph_instance',{subgraphId:child}),node('out','subgraph_output')],edges:[edge('i','out','result','result')]}});
const doc=(...subgraphs)=>{const g=sharedGraph();g.subgraphs=subgraphs;for(const f of g.subgraphs)f.libraryId=ID[f.id];g.stages.pixel={nodes:[node('output','pixel_out')],edges:[]};return g;};

test('dependencies are rebuilt whole: a cycle made only by resolving, added and removed dependencies, stages worked out again',()=>{
  const cycle=resolve(source('built-in',{'a.json':file(doc(caller('a','A','b'),leaf('b','B')),'a'),'b.json':file(doc(caller('b','B','a'),leaf('a','A')),'b')}));
  assert.deepEqual(reasons(cycle),{[ID.a]:'cycle',[ID.b]:'cycle'});
  // K now calls J: P, saved when K was a leaf, gets J too; the other way, J goes. K 改成呼叫 J：P 也帶進 J；反過來 J 就拿掉。
  const pOld=file(doc(caller('p','P','k'),leaf('k','K')),'p'),kNew=file(doc(caller('k','K','j'),leaf('j','J')),'k');
  const added=resolve(source('built-in',{'p.json':pOld,'k.json':kNew}));
  assert.deepEqual(plain(added.items.find(i=>i.libraryId===ID.p).file.dependencies.map(d=>d.libraryId)),[ID.k,ID.j]);
  const pWithJ=file(doc(caller('p','P','k'),caller('k','K','j'),leaf('j','J')),'p'),kLeaf=file(doc(leaf('k','K')),'k');
  const removed=resolve(source('built-in',{'p.json':pWithJ,'k.json':kLeaf}));
  assert.deepEqual(plain(removed.items.find(i=>i.libraryId===ID.p).file.dependencies.map(d=>d.libraryId)),[ID.k]);
  // K takes a Pixel-only TD value: P becomes a Pixel subgraph, though its own file says Vertex and Pixel. K 加了只在 Pixel 的值：P 跟著變 Pixel。
  const kPixel=file(doc(leaf('k','K',[node('uv','td_value',{entry:'glFragCoord'})])),'k');
  assert.deepEqual(plain(pOld.subgraph.stages),['vertex','pixel']);
  const narrowed=resolve(source('built-in',{'p.json':pOld,'k.json':kPixel}));
  assert.deepEqual(plain(narrowed.items.find(i=>i.libraryId===ID.p).file.subgraph.stages),['pixel']);
});

test('the ghost check: unwired inputs and an empty boundary pass; an unknown node is refused; a MAT-only node is checked as MAT (Codex R2-2)',()=>{
  const open={id:'k',title:'Open',inputs:[port('value')],outputs:[port('result')],graph:{nodes:[node('in','subgraph_input'),node('k','scalar',{type:'float',value:1}),node('out','subgraph_output')],edges:[edge('k','out','out','result')]}};
  const empty={id:'k',title:'Empty',inputs:[],outputs:[],graph:{nodes:[node('in','subgraph_input'),node('out','subgraph_output')],edges:[]}};
  const unknown={...empty,title:'Future',graph:{nodes:[...empty.graph.nodes,{id:'f',nodeType:'vendor.pack.future',params:{},ui:{x:0,y:0}}],edges:[]}};
  // Made with legal edits in a MAT graph, the Library ID given after (a Library copy is read-only). MAT 圖裡用合法操作做，最後才給 Library ID（資源庫副本唯讀）。
  const mat=doc({...empty,title:'Cameras'});mat.target='mat';delete mat.subgraphs[0].libraryId;
  const withCameras=new G.GraphDocument(mat,registry).change(m=>m.networks.get('subgraph:k').insert(node('td','td_value',{entry:'tdNumCameras'}))).after;
  for(const f of withCameras.subgraphs)f.libraryId=ID[f.id];
  const one=f=>resolve(source('personal',{'k.json':f}));
  assert.deepEqual(plain(one(file(doc(open),'k')).problems),[]);
  assert.deepEqual(plain(one(file(doc(empty),'k')).problems),[]);
  assert.equal(one(file(doc(unknown),'k')).unusable.get(ID.k).code,'ghost');
  const cameras=one(file(withCameras,'k'));
  assert.deepEqual(plain(cameras.problems),[]);
  assert.deepEqual(plain(cameras.items[0].file.subgraph.targets),['mat']);
});

test('a file that does not read adds nothing and is named; the caller\'s check refuses a subgraph and what uses it',()=>{
  const r=resolve(source('built-in',{'broken.json':{format:'grape-subgraph',version:1},'gain.json':files.gain}));
  assert.deepEqual(plain(r.problems.map(p=>[p.code,p.at])),[['unreadable',['built-in/broken.json']]]);
  const refused=G.resolveLibrary([source('built-in',{'gain.json':files.gain,'wrapper.json':files.wrapper})],registry,f=>{if(f.subgraph.libraryId===ID.gain)throw Error('does not compile');return 'ok';});
  assert.deepEqual(reasons(refused),{[ID.gain]:'check',[ID.wrapper]:'dependsOnUnusable'});
  assert.deepEqual(plain(refused.items),[]);
});

test('the change report: content, what follows it, interface ports and titles',()=>{
  const renamed=graph(removeValue);
  renamed.subgraphs.find(f=>f.id==='gain').title='Gain2';
  const after=resolve(source('built-in',{'gain.json':file(renamed,'gain'),'user.json':files.user})).items.map(i=>i.file);
  const c=G.libraryChanges([files.gain,files.wrapper,files.user],after);
  assert.deepEqual(plain(c),{added:[],removed:[ID.wrapper],changed:[ID.gain],following:[ID.user],
    ports:[{libraryId:ID.gain,side:'inputs',added:[],removed:['value'],retyped:[]}],titles:[{libraryId:ID.gain,from:'Gain',to:'Gain2'}]});
});

// Acceptance 5 (Codex I2-1): the comparison names its reference, and says why when there is none; it reads git, never this build's own
// output, so building again does not move it. 驗收 5：寫出比較的參照，沒有就說原因；它讀 git、不讀這次建置自己的產物，所以重建不會移動它。
test('the change report names what it compares with, or why it cannot',()=>{
  const {libraryReport}=require('../../tools/library_report.cjs');
  const git=answers=>args=>{const key=args.join(' ');for(const [k,v] of Object.entries(answers))if(key.includes(k)){if(v instanceof Error)throw v;return v;}throw Error('no '+key);};
  const now=[files.gain];
  assert.equal(libraryReport(now,G.libraryChanges,git({'symbolic-full-name':Error('none')})),'Library report: no comparison (this branch has no upstream)');
  assert.equal(libraryReport(now,G.libraryChanges,git({'symbolic-full-name':'origin/x','--short':'abc1234'})),'Library report: no comparison (origin/x abc1234 has no editor-bootstrap.json)');
  assert.equal(libraryReport(now,G.libraryChanges,git({'symbolic-full-name':'origin/x','--short':'abc1234','show':'{"version":1}'})),'Library report: no comparison (origin/x abc1234 has no Library)');
  const pushed=JSON.stringify({library:{files:[files.gain]}});
  assert.equal(libraryReport(now,G.libraryChanges,git({'symbolic-full-name':'origin/x','--short':'abc1234','show':pushed})),'Library report (compared with origin/x abc1234 as recorded here): no changes');
  const report=libraryReport([file(graph(removeValue),'gain')],G.libraryChanges,git({'symbolic-full-name':'origin/x','--short':'abc1234','show':pushed}));
  assert.match(report,/content changed: Gain/);assert.match(report,/inputs of Gain .*removed value \(wires to them go when people update\)/);
});
