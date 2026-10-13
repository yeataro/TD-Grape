// What happens to a definition when its calls go (basic design 2026-10-14 §3.9, amendments A4/B2; Refactor.109): a local
// definition is never collected — it stays with zero uses; only definitions the caller names collectible (Library copies it
// resolved as whole-restorable, in the Library round) go with their last call, together with the private part of their
// dependency closure. These tests name every definition collectible to exercise the closure; the first one names none.
// 呼叫都刪掉後定義怎麼辦：本地定義永不回收（留著、0 個引用）；只有呼叫端指名可回收的（Library 那一輪解析出能整份拉回的副本）
// 跟著最後一個呼叫走，連同它私有的依賴。這裡的測試把全部定義都指名可回收來驗閉包邏輯；第一個測試一個都不指名。
const {test}=require('node:test'),assert=require('node:assert/strict');
const m={CALL:'sgrape.builtin.subgraph_call'};
const {GraphDocument,registry,ScopeReferences}=require('../../src/generated/grape_core.js');
const all=g=>new Set(g.subgraphs.map(f=>f.id));
function removeNodes(g,data,ids,collectible=all(g)){const model=new GraphDocument(g,registry,undefined,true);try{const network=[...model.networks.values()].find(n=>n.data===data);network.removeAll(data.nodes.filter(n=>ids.has(n.id)).map(n=>network.node(n.id)),collectible);}finally{model.close();}}
const call=(id,fn)=>({id,nodeType:m.CALL,params:{subgraphId:fn}});
const scope=nodes=>({nodes,edges:[]});
const definition=(id,nodes=[])=>({id,name:id,graph:scope(nodes),inputs:[],outputs:[]});
const document=(nodes,subgraphs,vertex=[])=>({stages:{pixel:scope(nodes),vertex:scope(vertex)},subgraphs});
test('deleting the last call keeps a local definition: it stays in the document with zero uses',()=>{
 const g=document([call('last','mapping'),{id:'out'}],[definition('mapping')]);
 g.stages.pixel.edges=[{from:['last','value'],to:['out','value']}];
 removeNodes(g,g.stages.pixel,new Set(['last']),new Set());
 assert.deepEqual(g.subgraphs.map(f=>f.id),['mapping']);assert.deepEqual(g.stages.pixel,scope([{id:'out'}]));
});
test('a collectible definition goes with its last call, with its incident edges',()=>{
 const g=document([call('last','mapping'),{id:'out'}],[definition('mapping')]);
 g.stages.pixel.edges=[{from:['last','value'],to:['out','value']}];
 removeNodes(g,g.stages.pixel,new Set(['last']));
 assert.deepEqual(g.subgraphs,[]);assert.deepEqual(g.stages.pixel,scope([{id:'out'}]));
});
test('shared calls in the same or another stage retain the definition',()=>{
 const g=document([call('one','mapping'),call('two','mapping')],[definition('mapping')],[call('otherStage','mapping')]);
 removeNodes(g,g.stages.pixel,new Set(['one','two']));assert.equal(g.subgraphs.length,1);
 removeNodes(g,g.stages.vertex,new Set(['otherStage']));assert.deepEqual(g.subgraphs,[]);
});
test('private nested definitions are removed; shared nested content survives',()=>{
 const g=document([call('root','parent'),call('shared','child')],[definition('parent',[call('inner','child'),call('private','private')]),definition('child'),definition('private')]);
 removeNodes(g,g.stages.pixel,new Set(['root']));assert.deepEqual(g.subgraphs.map(f=>f.id),['child']);
});
test('a nested definition that is not collectible stays even when its collectible parent goes',()=>{
 const g=document([call('root','parent')],[definition('parent',[call('inner','child')]),definition('child')]);
 removeNodes(g,g.stages.pixel,new Set(['root']),new Set(['parent']));assert.deepEqual(g.subgraphs.map(f=>f.id),['child']);
});
test('unrelated reusable definitions and their dependencies are preserved',()=>{
 const g=document([call('root','child')],[definition('unused',[call('stored','child')]),definition('child'),definition('unrelated')]);
 const before=structuredClone(g.subgraphs);removeNodes(g,g.stages.pixel,new Set(['root']));assert.deepEqual(g.subgraphs,before);
});
test('deleting an ordinary node never collects dormant subgraph data',()=>{
 const g=document([{id:'ordinary'}],[definition('unused')]);removeNodes(g,g.stages.pixel,new Set(['ordinary']));assert.equal(g.subgraphs.length,1);
});
test('document type expressions preserve referenced function scope',()=>{
 const g=document([call('root','child')],[definition('child')]);
 g.structDefinitions=[{id:'arrayHolder',fields:[{type:'float['+ScopeReferences.token('fn_child',['length','out'])+']'}]}];
 removeNodes(g,g.stages.pixel,new Set(['root']));assert.equal(g.subgraphs.length,1);
});
test('catalog snapshots are not live subgraph references',()=>{
 const g=document([call('root','child')],[definition('child')]);
 g.catalogSnapshot={oldCall:call('historical','child')};
 removeNodes(g,g.stages.pixel,new Set(['root']));assert.deepEqual(g.subgraphs,[]);
});
test('deleting a call inside an edited definition preserves its owner',()=>{
 const owner=definition('owner',[call('inner','child')]),g=document([],[owner,definition('child')]);
 removeNodes(g,owner.graph,new Set(['inner']));assert.deepEqual(g.subgraphs.map(f=>f.id),['owner']);
});
test('unreferenced recursive remnants are collected without recursive traversal failure',()=>{
 const g=document([call('root','a')],[definition('a',[call('toB','b')]),definition('b',[call('toA','a')])]);
 removeNodes(g,g.stages.pixel,new Set(['root']));assert.deepEqual(g.subgraphs,[]);
});
