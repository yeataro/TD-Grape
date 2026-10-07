// Isolated public-interface tests: no editor, host, DOM or Python.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const context=vm.createContext({});vm.runInContext(fs.readFileSync(path.join(__dirname,'../../src/generated/wire_planning.js'),'utf8'),context);
const {GraphDocument,createRegistry,registry,transact}=context.GrapeGraph;
const plain=x=>JSON.parse(JSON.stringify(x));
const node=(id,key,params={})=>({id,definitionUuid:'sgrape.builtin.'+key,params});
const document=()=>({schemaVersion:1,target:'top',declarations:[],functions:[],stages:{pixel:{nodes:[node('source','float',{value:.5}),node('operation','abs',{type:'float'}),node('out','pixel_out')],edges:[]}}});
const policy={components:{float:1,vec2:2,vec3:3,vec4:4},conversions:[{from:'float',to:'vec4'}]};
const open=(d=document(),r=registry)=>new GraphDocument(d,r);

test('node/port handles are stable, scoped and read-only; caller state stays independent',()=>{
  const d=document(),g=open(d),n=g.networks.get('pixel').node('source'),p=n.port('output','out');
  assert.equal(p,n.outputs[0]);assert.equal(n,g.networks.get('pixel').node('source'));
  assert.equal(p.type,'float');assert.equal(Object.isFrozen(n.data),true);
  d.stages.pixel.nodes[0].params.value=9;assert.equal(n.data.params.value,.5);
  assert.throws(()=>g.networks.get('pixel').connect(p,g.networks.get('pixel').node('out').inputs[0],policy),/transaction/);
  const d2=document();d2.functions=[{id:'nested',graph:plain(d2.stages.pixel)}];const nested=open(d2);
  assert.notEqual(nested.networks.get('pixel').node('source'),nested.networks.get('function:nested').node('source'));
});
test('connect/replacement is one graph edit; snapshot Undo/Redo and reopen preserve edge IDs and values',()=>{
  const base=open(),edit=base.change(g=>{
    const n=g.networks.get('pixel');n.connect(n.node('source').outputs[0],n.node('operation').inputs[0],policy);
    const e=n.connect(n.node('operation').outputs[0],n.node('out').inputs[0],policy);
    assert.equal(e.connection(policy).conversion,'convert');
  });
  assert.deepEqual(plain(base.snapshot()),document());
  const first=open(edit.after),ids=first.networks.get('pixel').edges.map(e=>e.id);
  assert.equal(new Set(ids).size,2);
  const replacement=first.change(g=>{const n=g.networks.get('pixel');n.connect(n.node('source').outputs[0],n.node('out').inputs[0],policy);});
  assert.equal(replacement.after.stages.pixel.edges.length,2);
  const undo=open(replacement.before),redo=open(replacement.after),reopened=open(JSON.parse(JSON.stringify(redo.snapshot())));
  assert.deepEqual(plain(undo.snapshot()),plain(edit.after));
  assert.deepEqual(plain(reopened.snapshot()),plain(redo.snapshot()));
  assert.deepEqual(plain(open(edit.before).snapshot()),document());
});
test('failed cycle or incompatible wire leaves the original graph and existing edges intact',()=>{
  const base=open().change(g=>{const n=g.networks.get('pixel');n.connect(n.node('source').outputs[0],n.node('operation').inputs[0],policy);});
  const g=open(base.after),before=JSON.stringify(g.snapshot());
  assert.throws(()=>g.change(c=>{const n=c.networks.get('pixel');n.connect(n.node('operation').outputs[0],n.node('operation').inputs[0],policy);}),/Cycle/);
  assert.equal(JSON.stringify(g.snapshot()),before);
  assert.throws(()=>g.change(c=>{const n=c.networks.get('pixel');n.connect(n.node('out').inputs[0],n.node('source').outputs[0],policy);}),/endpoints/);
  assert.equal(JSON.stringify(g.snapshot()),before);
});
test('dynamic port changes keep port handles and edge data; unsupported endpoints recover',()=>{
  const dynamic={...registry.get('sgrape.builtin.abs'),catalog:plain(registry.get('sgrape.builtin.abs').catalog),supports:()=>true,
    ports:n=>[{key:n.params.hidden?'other':'value',direction:'input',type:n.params.type||'float'},{key:'out',direction:'output',type:'float'}]};
  const r=createRegistry(registry.modules.map(m=>m.catalog.definition.key==='abs'?dynamic:m));
  const d=document();d.stages.pixel.edges=[{id:'stable',from:['source','out'],to:['operation','value'],ui:{style:'straight'}}];
  const g=open(d,r),edit=g.change(c=>{
    const n=c.networks.get('pixel'),port=n.node('operation').inputs[0],edge=n.edges[0];
    n.node('operation').data.params.hidden=true;
    assert.equal(port.exists,false);assert.equal(edge.to,port);assert.equal(edge.connection(policy).reason,'missing-port');
    n.node('operation').data.params.hidden=false;assert.equal(port.exists,true);assert.equal(edge.connection(policy).valid,true);
    n.node('operation').data.params.type='vec2';assert.equal(edge.connection(policy).reason,'type');
    n.node('operation').data.params.type='float';assert.equal(edge.connection(policy).valid,true);
    delete n.node('operation').data.params.hidden;
  });
  assert.deepEqual(plain(edit.after),d);
});
test('unknown nodes and wires roundtrip without active ports or loss',()=>{
  const d=document();d.stages.pixel.nodes[0].definitionUuid='missing.module';d.stages.pixel.nodes[0].opaque={privatePayload:[1,2,3]};
  d.stages.pixel.edges=[{id:'ghost',from:['source','out'],to:['operation','value'],ui:{style:'curve'}}];
  const g=open(d);assert.equal(g.networks.get('pixel').edges[0].connection(policy).reason,'missing-port');
  assert.deepEqual(plain(g.snapshot()),d);
});
test('editor transaction preserves captured node references; failures restore the document',()=>{
  const d=document(),captured=d.stages.pixel.nodes[0];
  const step=transact(d,registry,()=>{captured.params.value=.75;return d;});
  assert.equal(d.stages.pixel.nodes[0],captured);assert.equal(step.before.stages.pixel.nodes[0].params.value,.5);
  const saved=plain(d);assert.throws(()=>transact(d,registry,()=>{captured.params.value=99;throw Error('Rejected candidate');}),/Rejected/);
  assert.deepEqual(plain(d),saved);
});
test('duplicate definitions or port keys reject before compilation',()=>{
  const abs=registry.get('sgrape.builtin.abs');assert.throws(()=>createRegistry([abs,abs]),/duplicate/);
  const broken={...abs,ports:()=>[{key:'out',direction:'output',type:'float'},{key:'out',direction:'output',type:'float'}]};
  const d=document();const g=open(d,createRegistry([broken]));assert.throws(()=>g.networks.get('pixel').node('operation').outputs,/Duplicate port/);
});
test('editable handles follow same-length replacements and in-place identity changes',()=>{
  const d=document();d.stages.pixel.edges=[{id:'first',from:['source','out'],to:['operation','value']}];
  open(d).change(g=>{
    const n=g.networks.get('pixel'),source=n.node('source'),old=n.edges[0];
    assert.equal(source.data.params.value,.5);assert.equal(old.exists,true);
    n.data.nodes[0]=node('source','float',{value:.75});
    n.data.edges[0]={id:'second',from:['source','out'],to:['out','color']};
    assert.equal(source.data.params.value,.75);assert.equal(old.exists,false);assert.equal(n.edges[0].id,'second');
    n.data.nodes[0].id='renamed';assert.equal(source.data,undefined);assert.equal(n.node('renamed').data.params.value,.75);
    n.data.edges[0].id='third';assert.equal(n.edges[0].id,'third');
  });
});
test('deleted edge handles never attach to new connections, including after save/reopen',()=>{
  const edit=open().change(g=>{
    const n=g.networks.get('pixel'),a=n.node('source').outputs[0],b=n.node('operation').inputs[0];
    const first=n.connect(a,b,policy);n.disconnect(first);
    const second=n.connect(a,b,policy);assert.notEqual(second.id,first.id);assert.equal(first.exists,false);
    n.disconnect(second);
  });
  const next=open(edit.after).change(g=>{
    const n=g.networks.get('pixel'),third=n.connect(n.node('source').outputs[0],n.node('operation').inputs[0],policy);
    assert.equal(third.id,'edge_3');
  });
  assert.equal(next.after.stages.pixel.edges.length,1);
});
test('duplicate stored identities reject before a lookup can hide data',()=>{
  const d=document();d.stages.pixel.edges=[{id:'duplicate',from:['source','out'],to:['operation','value']},{id:'duplicate',from:['operation','out'],to:['out','color']}];
  assert.throws(()=>open(d).networks.get('pixel').edges,/Duplicate edge ID/);
  d.stages.pixel.edges=[];d.stages.pixel.nodes[1].id='source';
  assert.throws(()=>open(d).networks.get('pixel').node('source').data,/duplicate node ID/);
});
test('dependency order handles long chains and still reports disconnected cycles',()=>{
  const d=document(),data=d.stages.pixel;data.nodes=[node('source','float',{value:0})];data.edges=[];
  for(let i=0;i<12000;i++){data.nodes.push(node('n'+i,'abs',{type:'float'}));data.edges.push({id:'e'+i,from:[i?'n'+(i-1):'source','out'],to:['n'+i,'value']});}
  data.nodes.reverse();const order=open(d).networks.get('pixel').order('n11999');
  assert.equal(order.length,12001);assert.equal(order[0].id,'source');assert.equal(order.at(-1).id,'n11999');
  data.nodes.push(node('dead','abs',{type:'float'}));data.edges.push({id:'bad',from:['dead','out'],to:['dead','value']});
  assert.throws(()=>open(d).networks.get('pixel').order('n11999'),/Cycle/);
});

test('querying a port visits editable edge data once, and follows raw replacement and endpoint edits',()=>{
  const d=document(),raw=Array.from({length:300},(_,i)=>({id:'e'+i,from:['source','out'],to:['operation'+i,'value']}));
  let visits=0;
  d.stages.pixel.edges=new Proxy(raw,{get(target,key,receiver){if(typeof key==='string'&&/^\d+$/.test(key))visits++;return Reflect.get(target,key,receiver);}});
  const model=new GraphDocument(d,registry,undefined,true),network=model.networks.get('pixel'),port=network.node('operation299').port('input','value');
  assert.deepEqual(Array.from(port.edges,e=>e.id),['e299']);
  assert.ok(visits<=raw.length*2,`one port lookup visited ${visits} edge rows`);
  raw[299]={id:'replacement',from:['source','out'],to:['operation299','value']};
  assert.deepEqual(Array.from(port.edges,e=>e.id),['replacement']);
  raw[299].to=['operation0','value'];assert.equal(port.edges.length,0);
  assert.deepEqual(Array.from(network.node('operation0').port('input','value').edges,e=>e.id),['e0','replacement']);
});

test('editor transaction supplies its one before snapshot to validation and history',()=>{
  const d=document();d.unknown={keep:['content']};let previous;
  const step=transact(d,registry,before=>{previous=before;assert.equal(before.stages.pixel.nodes[0].params.value,.5);d.stages.pixel.nodes[0].params.value=7;return d;});
  assert.equal(previous,step.before);assert.equal(step.after,d);
  assert.equal(step.before.stages.pixel.nodes[0].params.value,.5);
  assert.deepEqual(plain(step.before.unknown),{keep:['content']});
  assert.throws(()=>transact(d,registry,before=>{assert.equal(before.stages.pixel.nodes[0].params.value,7);d.unknown.keep.push('bad');throw Error('rejected');}),/rejected/);
  assert.deepEqual(plain(d.unknown),{keep:['content']});
});

test('a bulk edit allocates stable edge IDs in one pass and preserves the high-water mark',()=>{
  const d=document(),raw=Array.from({length:300},(_,i)=>({from:['source','out'],to:['operation'+i,'value']}));
  raw[0].id='edge_400';let visits=0;
  d.stages.pixel.edges=new Proxy(raw,{get(target,key,receiver){if(typeof key==='string'&&/^\d+$/.test(key))visits++;return Reflect.get(target,key,receiver);}});
  transact(d,registry,()=>{d.stages.pixel.nodes[0].params.value=2;return d;});
  assert.ok(visits<=raw.length*10,`bulk ID allocation visited ${visits} edge rows`);
  assert.equal(new Set(raw.map(e=>e.id)).size,300);assert.equal(raw[1].id,'edge_401');assert.equal(raw.at(-1).id,'edge_699');
  assert.equal(d.stages.pixel.edgeSequence,699);
  const saved=plain(d);transact(d,registry,()=>{d.stages.pixel.edges=[];return d;});
  assert.equal(d.stages.pixel.edgeSequence,699);
  assert.throws(()=>transact(d,registry,()=>{d.stages.pixel.edges=[{...saved.stages.pixel.edges[0]},{...saved.stages.pixel.edges[0]}];return d;}),/Duplicate edge ID/);
  assert.equal(d.stages.pixel.edges.length,0);assert.equal(d.stages.pixel.edgeSequence,699);
});

test('a raw draft deletion cannot reset identity allocation for the next graph version',()=>{
  const d=document();d.stages.pixel.edges=[{id:'edge_80',from:['source','out'],to:['operation','value']}];
  const removed=open(d).change(g=>{g.networks.get('pixel').data.edges=[];});
  assert.equal(removed.after.stages.pixel.edgeSequence,80);
  const next=open(removed.after).change(g=>{const n=g.networks.get('pixel');assert.equal(n.connect(n.node('source').outputs[0],n.node('operation').inputs[0],policy).id,'edge_81');});
  assert.equal(next.after.stages.pixel.edges.length,1);
});
