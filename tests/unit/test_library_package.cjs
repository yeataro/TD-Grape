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
// output, so building again does not move it. One full SHA is fixed first and used for every read (Codex R123-6); a commit this clone
// lacks is told apart from a commit without the file. 驗收 5：寫出比較的參照，沒有就說原因；讀 git、不讀這次建置的產物。先固定一個完整
// SHA、之後都讀它；本機沒有那個 commit 和那一版沒有檔分開說。
test('the change report names what it compares with, or why it cannot',()=>{
  const {libraryReport}=require('../../tools/library_report.cjs');
  const SHA='1111111'+'a'.repeat(33),BOOT=SHA+':src/generated/editor-bootstrap.json';
  // Only these exact commands answer; anything else (a read through @{upstream} again) fails. 只有這些指令有回應；其他的（再經 @{upstream} 讀）失敗。
  const git=answers=>args=>{const v=answers[args.join(' ')];if(v===undefined||v instanceof Error)throw v??Error('no '+args.join(' '));return v;};
  const upstream={'rev-parse --symbolic-full-name @{upstream}':'refs/remotes/origin/x','rev-parse --verify refs/remotes/origin/x':SHA};
  const readable={...upstream,['cat-file -e '+SHA+'^{commit}']:'',['cat-file -e '+BOOT]:''};
  const report=(answers,now=[files.gain],stale=[])=>libraryReport(now,stale,G.libraryChanges,git(answers));
  assert.equal(report({}),'Library report: no comparison (this branch has no upstream)');
  assert.equal(report({'rev-parse --symbolic-full-name @{upstream}':'refs/remotes/origin/x'}),'Library report: no comparison (origin/x cannot be read here)');
  assert.equal(report(upstream),'Library report: no comparison (origin/x 1111111 points to a commit this clone does not have)');
  assert.equal(report({...upstream,['cat-file -e '+SHA+'^{commit}']:''}),'Library report: no comparison (origin/x 1111111 has no editor-bootstrap.json)');
  assert.equal(report({...readable,['show '+BOOT]:'{"ver'}),'Library report: no comparison (origin/x 1111111: its editor-bootstrap.json cannot be read)');
  assert.equal(report({...readable,['show '+BOOT]:'{"version":1}'}),'Library report: no comparison (origin/x 1111111 has no Library)');
  const pushed={...readable,['show '+BOOT]:JSON.stringify({library:{files:[files.gain]}})};
  assert.equal(report(pushed),'Library report (compared with origin/x 1111111 as recorded here): no changes');
  const changed=report(pushed,[file(graph(removeValue),'gain')]);
  assert.match(changed,/content changed: Gain/);assert.match(changed,/inputs of Gain .*removed value \(wires to them go when people update\)/);
  // Stale carried copies are a hint, with or without a comparison (Codex R123-5). 過時的夾帶副本是提示，比得了比不了都列。
  const hint='\n  older copies carried in source files (sharing such a file alone would use them): Gain ('+ID.gain+') in built-in/user.json';
  assert.equal(report({},[files.gain],[{libraryId:ID.gain,at:'built-in/user.json'}]),'Library report: no comparison (this branch has no upstream)'+hint);
});

// C6: copies differing only in provenance are the same content; credits are content (Codex R123-1). C6：只差出處仍算同內容；credits 算內容。
test('carried copies that differ only in provenance are the same; in credits, they differ',()=>{
  const traced=plain(files.user);traced.dependencies[0].provenance=[{kind:'library',libraryId:uid(20),title:'Origin',at:'2026-10-18T00:00:00.000Z'}];
  const same=resolve(source('personal',{'wrapper.json':files.wrapper,'user.json':traced}));
  assert.deepEqual(plain(same.problems),[]);
  assert.deepEqual(items(same),[ID.wrapper,ID.user].sort());
  // The copy chosen keeps its provenance (the first file by name). 選中的副本保留它的出處（依檔名第一個）。
  assert.deepEqual(plain(same.items.find(i=>i.libraryId===ID.wrapper).file.dependencies[0].provenance),traced.dependencies[0].provenance);
  const credited=plain(files.user);credited.dependencies[0].credits={author:'Different author'};
  assert.equal(resolve(source('personal',{'wrapper.json':files.wrapper,'user.json':credited})).unusable.get(ID.gain).code,'conflictingCopies');
});

// Copies are compared as read, the way saving writes them (Codex R123-2). 副本照讀進後、存檔會寫出的樣子比較。
test('a group default written out or left out is the same carried content',()=>{
  const grouped=graph(m=>G.groups.createGroup(m.networks.get('subgraph:gain'),['in','mul'],{id:'groupA',name:'Gain group'}));
  for(const field of [{textScale:1},{textAlign:'left'},{textPlace:'top'}]){
    const spelled=file(grouped,'user');Object.assign(spelled.dependencies[0].graph.ui.groups[0],field);
    const r=resolve(source('personal',{'wrapper.json':file(grouped,'wrapper'),'user.json':spelled}));
    assert.deepEqual(plain(r.problems),[],JSON.stringify(field));
    assert.deepEqual(items(r),[ID.wrapper,ID.user].sort());
  }
});

// A file that names its subgraph keeps that place when it does not read: no older copy takes over (Codex R123-3).
// 認得出自己是哪份子圖的檔，讀不進也佔著位置：不由舊副本頂替。
test('an own file that does not read makes its subgraph unusable, with what uses it; no other copy takes its place',()=>{
  const broken=plain(files.gain);broken.subgraph.outputs[0].default='one';
  assert.throws(()=>G.readLibraryFile(broken,registry));
  const across=resolve(source('built-in',{'gain.json':broken}),source('personal',{'gain.json':files.gain,'user.json':files.user}));
  assert.deepEqual(reasons(across),{[ID.gain]:'unreadable',[ID.user]:'dependsOnUnusable'});
  assert.deepEqual(plain(across.unusable.get(ID.gain).at),['built-in/gain.json']);
  assert.deepEqual(plain(across.items),[]);
  const inside=resolve(source('built-in',{'gain.json':broken,'wrapper.json':files.wrapper,'user.json':files.user}));
  assert.deepEqual(reasons(inside),{[ID.gain]:'unreadable',[ID.wrapper]:'dependsOnUnusable',[ID.user]:'dependsOnUnusable'});
  // A lower broken file takes nothing from a higher good one. 低來源壞掉的檔不影響高來源好的。
  const lower=resolve(source('built-in',{'gain.json':files.gain}),source('personal',{'gain.json':broken}));
  assert.deepEqual(items(lower),[ID.gain]);
  assert.deepEqual(plain(lower.problems.map(p=>[p.code,p.libraryId,p.at])),[['unreadable',ID.gain,['personal/gain.json']]]);
});

test('older carried copies are listed with their files; the files are not changed (Codex R123-5)',()=>{
  const wrapper=plain(files.wrapper);
  const r=resolve(source('built-in',{'gain.json':file(graph(timesFive),'gain'),'wrapper.json':wrapper,'user.json':files.user}));
  assert.deepEqual(plain(r.problems),[]);
  assert.deepEqual(plain(r.stale),[{libraryId:ID.gain,at:'built-in/wrapper.json'},{libraryId:ID.gain,at:'built-in/user.json'}]);
  assert.deepEqual(wrapper,files.wrapper);
  assert.deepEqual(plain(resolve(source('built-in',files)).stale),[]);
});

// Every member counts, carried ones too (Codex R123-4). 每個成員都算，只被夾帶的也是。
test('the change report sees the ports and title of a subgraph that is only carried',()=>{
  const renamed=graph(removeValue);renamed.subgraphs.find(f=>f.id==='gain').title='Gain2';
  const c=G.libraryChanges([files.user],[file(renamed,'user')]);
  assert.deepEqual(plain(c),{added:[],removed:[],changed:[ID.gain],following:[ID.user],
    ports:[{libraryId:ID.gain,side:'inputs',added:[],removed:['value'],retyped:[]}],titles:[{libraryId:ID.gain,from:'Gain',to:'Gain2'}]});
});

// Codex's test gap: a child that becomes MAT-only narrows its parent to MAT. 子變成只有 MAT，父也只剩 MAT。
test('a parent saved for TOP and MAT takes only MAT when its child becomes MAT-only',()=>{
  const pOld=file(doc(caller('p','P','k'),leaf('k','K')),'p');
  assert.deepEqual(plain(pOld.subgraph.targets),['top','mat']);
  const mat=doc(leaf('k','K'));mat.target='mat';delete mat.subgraphs[0].libraryId;
  const kMat=new G.GraphDocument(mat,registry).change(m=>m.networks.get('subgraph:k').insert(node('td','td_value',{entry:'tdNumCameras'}))).after;
  for(const f of kMat.subgraphs)f.libraryId=ID[f.id];
  const r=resolve(source('built-in',{'p.json':pOld,'k.json':file(kMat,'k')}));
  assert.deepEqual(plain(r.problems),[]);
  assert.deepEqual(plain(r.items.find(i=>i.libraryId===ID.p).file.subgraph.targets),['mat']);
});
