const {test}=require('node:test'),assert=require('node:assert/strict');
const m=require('../../src/editor/functions_model.js');
const {GraphDocument,registry}=require('../../src/editor/wire_planning.js');
function removeNodes(g,data,ids){const model=new GraphDocument(g,registry,undefined,true);try{const network=[...model.networks.values()].find(n=>n.data===data);network.removeAll(data.nodes.filter(n=>ids.has(n.id)).map(n=>network.node(n.id)));}finally{model.close();}}
const call=(id,fn)=>({id,definitionUuid:m.CALL,params:{functionId:fn}});
const scope=nodes=>({nodes,edges:[]});
const definition=(id,nodes=[])=>({id,name:id,scope:'local',graph:scope(nodes),inputs:[],outputs:[]});
const document=(nodes,functions,vertex=[])=>({stages:{pixel:scope(nodes),vertex:scope(vertex)},functions});
test('last instance deletion removes its document definition and incident edges',()=>{
 const g=document([call('last','mapping'),{id:'out'}],[definition('mapping')]);
 g.stages.pixel.edges=[{from:['last','value'],to:['out','value']}];
 removeNodes(g,g.stages.pixel,new Set(['last']));
 assert.deepEqual(g.functions,[]);assert.deepEqual(g.stages.pixel,scope([{id:'out'}]));
});
test('shared calls in the same or another stage retain the definition',()=>{
 const g=document([call('one','mapping'),call('two','mapping')],[definition('mapping')],[call('otherStage','mapping')]);
 removeNodes(g,g.stages.pixel,new Set(['one','two']));assert.equal(g.functions.length,1);
 removeNodes(g,g.stages.vertex,new Set(['otherStage']));assert.deepEqual(g.functions,[]);
});
test('private nested definitions are removed; shared nested content survives',()=>{
 const g=document([call('root','parent'),call('shared','child')],[definition('parent',[call('inner','child'),call('private','private')]),definition('child'),definition('private')]);
 removeNodes(g,g.stages.pixel,new Set(['root']));assert.deepEqual(g.functions.map(f=>f.id),['child']);
});
test('unrelated reusable definitions and their dependencies are preserved',()=>{
 const g=document([call('root','child')],[definition('unused',[call('stored','child')]),definition('child'),definition('unrelated')]);
 const before=structuredClone(g.functions);removeNodes(g,g.stages.pixel,new Set(['root']));assert.deepEqual(g.functions,before);
});
test('deleting an ordinary node never collects dormant subgraph data',()=>{
 const g=document([{id:'ordinary'}],[definition('unused')]);removeNodes(g,g.stages.pixel,new Set(['ordinary']));assert.equal(g.functions.length,1);
});
test('document type expressions preserve referenced function scope',()=>{
 const g=document([call('root','child')],[definition('child')]);
 g.typeDefinitions=[{id:'arrayHolder',fields:[{type:'float['+m.GraphArrayLengths.token('fn_child',['length','out'])+']'}]}];
 removeNodes(g,g.stages.pixel,new Set(['root']));assert.equal(g.functions.length,1);
});
test('catalog snapshots are not live subgraph references',()=>{
 const g=document([call('root','child')],[definition('child')]);
 g.catalogSnapshot={oldCall:call('historical','child')};
 removeNodes(g,g.stages.pixel,new Set(['root']));assert.deepEqual(g.functions,[]);
});
test('deleting a call inside an edited definition preserves its owner',()=>{
 const owner=definition('owner',[call('inner','child')]),g=document([],[owner,definition('child')]);
 removeNodes(g,owner.graph,new Set(['inner']));assert.deepEqual(g.functions.map(f=>f.id),['owner']);
});
test('unreferenced recursive remnants are collected without recursive traversal failure',()=>{
 const g=document([call('root','a')],[definition('a',[call('toB','b')]),definition('b',[call('toA','a')])]);
 removeNodes(g,g.stages.pixel,new Set(['root']));assert.deepEqual(g.functions,[]);
});
