// Exercise the public model: no DOM, TD, legacy inference or node-name dispatch.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context=vm.createContext({});vm.runInContext(fs.readFileSync(require.resolve('../../src/editor/wire_planning.js'),'utf8'),context);
const {GraphDocument,registry,createRegistry,createCompiler,changesBetween,transact}=context.GrapeGraph;
const plain=x=>JSON.parse(JSON.stringify(x));
const policy={components:{float:1,vec2:2,vec3:3,vec4:4},conversions:[{from:'float',to:'vec3'},{from:'float',to:'vec4'}]};
const document=()=>({schemaVersion:1,target:'top',declarations:[],functions:[],stages:{pixel:{nodes:[],edges:[]}}});
function seeded(){return new GraphDocument(document(),registry).change(g=>{
  const n=g.networks.get('pixel');n.create('f','sgrape.builtin.float',{value:2});n.create('m','sgrape.builtin.multiply',{type:'vec3'});n.create('out','sgrape.builtin.pixel_out');
}).after;}

test('native tuple configuration belongs to the module; connect, disconnect, Undo and save agree',()=>{
  const base=new GraphDocument(seeded(),registry),step=base.change(g=>{
    const n=g.networks.get('pixel');n.node('m').update({inputValues:{a:[3,4,5],b:[6,7,8]}});
    const e=n.node('f').outputs[0].connect(n.node('m').port('input','a'),policy);
    assert.equal(n.node('m').port('input','a').type,'float');assert.equal(n.node('m').outputs[0].type,'vec3');
    assert.equal(n.node('m').data.inputValues.a,3);assert.equal(e.connection(policy).conversion,'identity');
  });
  assert.equal(step.changes.changed,true);assert.equal(step.changes.networks[0].complete,true);
  assert.deepEqual(plain(step.changes.networks[0].ports),[{node:'m',direction:'input',key:'a',before:'vec3',after:'float'}]);
  const disconnected=new GraphDocument(step.after,registry).change(g=>g.networks.get('pixel').edges[0].disconnect());
  assert.deepEqual(plain(disconnected.after.stages.pixel.nodes[1].params.operandTypes),{a:'float',b:'vec3'});
  assert.deepEqual(plain(disconnected.changes.networks[0].ports),[]);
  const undone=new GraphDocument(step.before,registry),redone=new GraphDocument(JSON.parse(JSON.stringify(step.after)),registry);
  assert.equal(undone.networks.get('pixel').node('m').port('input','a').type,'vec3');
  assert.equal(redone.networks.get('pixel').node('m').port('input','a').type,'float');
  const reverse=changesBetween(step.after,step.before,registry);
  assert.equal(reverse.networks[0].ports[0].after,'vec3');assert.equal(reverse.networks[0].edges[0].after,undefined);
});

test('manual output selection preserves dormant defaults and changes all related ports together',()=>{
  const source=seeded();source.stages.pixel.nodes[1].inputValues={a:[1,2,3],b:[4,5,6]};
  const first=new GraphDocument(source,registry).change(g=>g.networks.get('pixel').node('m').configure({type:'float'}));
  assert.equal(first.after.stages.pixel.nodes[1].inputValues.a,1);
  const second=new GraphDocument(first.after,registry).change(g=>g.networks.get('pixel').node('m').configure({type:'vec3'}));
  assert.deepEqual(plain(second.after.stages.pixel.nodes[1].inputValues),{a:[1,2,3],b:[4,5,6]});
  assert.equal(second.changes.networks[0].ports.length,3);
});

test('a rejected edit never publishes changes, and captured transaction handles cannot write later',()=>{
  const base=new GraphDocument(seeded(),registry),before=plain(base.snapshot());let captured;
  assert.throws(()=>base.change(g=>{const n=g.networks.get('pixel');captured=n.node('m');captured.update({name:'temporary'});n.connect(captured.outputs[0],captured.inputs[0],policy);}),/Cycle/);
  assert.deepEqual(plain(base.snapshot()),before);assert.throws(()=>captured.update({name:'late'}),/active transaction/);
  base.change(g=>{captured=g.networks.get('pixel').node('m');captured.update({name:'committed'});});
  assert.throws(()=>captured.configure({type:'float'}),/active transaction/);
});

test('no-op and position-only updates describe exactly what changed without touching other nodes',()=>{
  const base=new GraphDocument(seeded(),registry),noop=base.change(()=>{});
  assert.equal(noop.changes.changed,false);assert.equal(noop.changes.networks.length,0);
  const move=base.change(g=>g.networks.get('pixel').node('m').update({ui:{x:10,y:20}}));
  const delta=move.changes.networks[0];assert.deepEqual(plain(delta.nodes.map(n=>n.id)),['m']);
  assert.deepEqual(plain(delta.nodes[0].ui),['x','y']);assert.equal(delta.ports.length,0);assert.equal(delta.edges.length,0);
  const duplicate=new GraphDocument(move.after,registry).change(g=>g.networks.get('pixel').node('m').update({ui:{y:20,x:10}}));
  assert.equal(duplicate.changes.changed,false);
});

test('remove owns incident edges while unknown nodes and payloads survive unrelated operations',()=>{
  const g=seeded();g.stages.pixel.nodes.push({id:'ghost',definitionUuid:'missing.module',params:{opaque:[1,2,3]}});
  const wired=new GraphDocument(g,registry).change(c=>{const n=c.networks.get('pixel');n.connect(n.node('f').outputs[0],n.node('m').inputs[0],policy);});
  const removed=new GraphDocument(wired.after,registry).change(c=>{const n=c.networks.get('pixel');n.remove(n.node('m'));});
  assert.equal(removed.after.stages.pixel.edges.length,0);assert.deepEqual(plain(removed.after.stages.pixel.nodes.at(-1).params),{opaque:[1,2,3]});
  assert.deepEqual(plain(removed.changes.networks[0].removed),['m']);assert.equal(removed.changes.networks[0].complete,false);
});

test('network identities and declaration invalidation cannot be mistaken for a local card edit',()=>{
  const g=seeded();g.functions=[{id:'nested',graph:plain(g.stages.pixel)}];
  const local=new GraphDocument(g,registry).change(c=>c.networks.get('function:nested').node('m').update({name:'inside'}));
  assert.deepEqual(plain(local.changes.networks.map(n=>n.id)),['function:nested']);
  const after=plain(g);after.declarations.push({id:'u',kind:'uniform',name:'value',type:'float',value:1});
  const changed=changesBetween(g,after,registry);assert.deepEqual(plain(changed.global),['declarations']);
  assert.equal(changed.networks.every(n=>!n.complete),true);
});

test('developer module owns arbitrary persisted signature state through the same graph/compiler interface',()=>{
  const template=registry.get('sgrape.builtin.abs'),catalog=plain(template.catalog);
  catalog.definition={...catalog.definition,key:'blend_probe',definitionUuid:'probe.blend',defaults:{width:'vec3',weight:'vec3'}};
  const port=(key,direction,type)=>({key,direction,type,default:type==='float'?0:[0,0,0]});
  const module={catalog,role:'value',supports:()=>true,validate:()=>{},
    ports:n=>[port('value','input',n.params.width),port('factor','input',n.params.weight),port('out','output',n.params.width)],
    signatures:n=>['float','vec3'].map(weight=>({type:n.params.width,inputs:{value:n.params.width,factor:weight},outputs:{out:n.params.width}})),
    configure:(n,s)=>({...n,params:{...n.params,weight:s.signature.inputs.factor}}),
    emit:(_n,c)=>({outputs:{out:'('+c.input('value')+' * '+c.input('factor')+')'}})};
  const r=createRegistry([...registry.modules,module]),first=new GraphDocument(document(),r).change(g=>{
    const n=g.networks.get('pixel');n.create('value','sgrape.builtin.vec3',{value:[1,2,3]});n.create('factor','sgrape.builtin.float',{value:.5});n.create('blend','probe.blend');n.create('out','sgrape.builtin.pixel_out');
    n.connect(n.node('value').outputs[0],n.node('blend').port('input','value'),policy);
    n.connect(n.node('factor').outputs[0],n.node('blend').port('input','factor'),policy);
    n.connect(n.node('blend').outputs[0],n.node('out').inputs[0],{...policy,conversions:[...policy.conversions,{from:'vec3',to:'vec4'}]});
  });
  const configured=first.after.stages.pixel.nodes.find(n=>n.id==='blend');
  assert.deepEqual(plain(configured.params),{width:'vec3',weight:'float'});assert.equal(configured.params.type,undefined);assert.equal(configured.params.operandTypes,undefined);
  // Use the compiler's supported output conversion without changing the probe.
  const compiledGraph=plain(first.after);compiledGraph.stages.pixel.edges=compiledGraph.stages.pixel.edges.filter(e=>e.to[0]!=='out');
  const compiler=createCompiler(r);assert.equal(compiler.supports(compiledGraph),true);
  // A disconnected probe still validates through the module; emit it through
  // a scalar result in a second module with identical custom state ownership.
  module.ports=n=>[port('factor','input',n.params.weight),port('out','output','float')];
  module.signatures=()=>[{type:'float',inputs:{factor:'float'},outputs:{out:'float'}}];
  module.emit=(_n,c)=>({outputs:{out:'abs('+c.input('factor')+')'}});
  const scalarRegistry=createRegistry([...registry.modules,module]),ready=new GraphDocument(document(),scalarRegistry).change(g=>{
    const n=g.networks.get('pixel');n.create('s','sgrape.builtin.float',{value:-.5});n.create('p','probe.blend',{weight:'float'});n.create('o','sgrape.builtin.pixel_out');
    n.connect(n.node('s').outputs[0],n.node('p').inputs[0],policy);n.connect(n.node('p').outputs[0],n.node('o').inputs[0],policy);
  });
  assert.match(createCompiler(scalarRegistry).compile(ready.after).pixel,/abs\(sg_n_s\)/);
});

test('lying module configuration fails atomically instead of accepting a different interface',()=>{
  const original=registry.get('sgrape.builtin.multiply'),bad={...original,configure:n=>({...n,params:{type:'float'}})};
  const r=createRegistry(registry.modules.map(m=>m===original?bad:m)),base=new GraphDocument(seeded(),r);
  assert.throws(()=>base.change(g=>{const n=g.networks.get('pixel');n.connect(n.node('f').outputs[0],n.node('m').inputs[0],policy);}),/disagrees/);
  assert.equal(base.networks.get('pixel').edges.length,0);assert.equal(base.networks.get('pixel').node('m').outputs[0].type,'vec3');
});

test('transitional editor publication and snapshot replay share the same model change contract',()=>{
  const graph=seeded();let handle;
  const step=transact(graph,registry,(_before,model)=>{handle=model.networks.get('pixel').node('m');handle.update({name:'named'});return graph;});
  assert.deepEqual(plain(step.changes),plain(changesBetween(step.before,step.after,registry)));
  assert.throws(()=>handle.update({name:'stale'}),/active transaction/);
  const reverse=changesBetween(step.after,step.before,registry);assert.deepEqual(plain(reverse.networks[0].nodes[0].fields),['name']);
});

test('publication payloads and caller patches cannot mutate graph-owned state or identities',()=>{
  const graph=seeded(),patch={ui:{x:20}};
  const step=transact(graph,registry,(_before,g)=>{
    const n=g.networks.get('pixel');n.node('m').update(patch);patch.ui.x=900;
    assert.throws(()=>n.node('m').update({id:'other'}),/identity/);
    n.connect(n.node('f').outputs[0],n.node('m').inputs[0],policy);return graph;
  });
  step.changes.networks[0].edges[0].after.from[0]='foreign';
  assert.equal(graph.stages.pixel.nodes[1].ui.x,20);assert.equal(graph.stages.pixel.edges[0].from[0],'f');
  new GraphDocument(graph,registry).change(g=>{const n=g.networks.get('pixel'),old=n.node('m');n.remove(old);assert.throws(()=>n.create('m','sgrape.builtin.add'),/retired/);assert.equal(old.data,undefined);});
});

test('module configuration preserves fixed presets and planner reconciliation does not touch unrelated signatures',()=>{
  const graph=seeded();graph.stages.pixel.nodes[1].params.fixedType='vec3';
  assert.throws(()=>new GraphDocument(graph,registry).change(g=>g.networks.get('pixel').node('m').configure({type:'float'})),/Fixed/);
  const n=new GraphDocument(graph,registry).networks.get('pixel'),plan=n.plan(policy,{kind:'infer',nodes:[]});
  assert.equal(plan.ok,true);assert.equal(plan.inference.signatures.size,0);
});

test('insertion owns authored metadata and initializes only through the registered module',()=>{
  const authored={id:'new',definitionUuid:'sgrape.builtin.abs',params:{},ui:{x:30},revisionHash:'saved-revision'};
  const step=new GraphDocument(document(),registry).change(g=>{
    const n=g.networks.get('pixel').insert(authored);authored.ui.x=900;
    assert.equal(n.data.ui.x,30);assert.equal(n.data.params.type,'float');assert.equal(n.data.revisionHash,'saved-revision');
  });
  assert.deepEqual(plain(step.changes.networks[0].added),['new']);
  assert.throws(()=>new GraphDocument(document(),registry).change(g=>g.networks.get('pixel').insert({...authored,definitionUuid:'unknown'})),/unavailable/);
});

test('bulk removal and disconnect validate foreign handles before mutation and retain identity sequence',()=>{
  const first=new GraphDocument(seeded(),registry).change(g=>{
    const n=g.networks.get('pixel');n.connect(n.node('f').outputs[0],n.node('m').inputs[0],policy);
  });
  const foreign=new GraphDocument(first.after,registry).networks.get('pixel');
  const result=new GraphDocument(first.after,registry).change(g=>{
    const n=g.networks.get('pixel'),edges=n.edges,before=JSON.stringify(g.document);
    assert.throws(()=>n.disconnectAll([...edges,...foreign.edges]),/another network/);
    assert.throws(()=>n.removeAll([n.node('f'),foreign.node('m')]),/another network/);
    assert.equal(JSON.stringify(g.document),before);
    n.disconnectAll([...edges,...edges]);assert.equal(n.edges.length,0);
    const next=n.connect(n.node('f').outputs[0],n.node('m').inputs[0],policy);assert.notEqual(next.id,edges[0].id);
    n.removeAll([n.node('f'),n.node('m'),n.node('f')]);assert.equal(n.edges.length,0);
    assert.throws(()=>n.create('m','sgrape.builtin.add'),/retired/);
  });
  assert.deepEqual(plain(result.changes.networks[0].removed).sort(),['f','m']);
});

test('fragment insertion is independent of import formats, atomic and owns copied node/edge metadata',()=>{
  const authored={nodes:[{id:'copy',definitionUuid:'sgrape.builtin.abs',params:{type:'float'},ui:{x:4}}],edges:[{id:'copied-edge',from:['f','out'],to:['copy','value'],ui:{style:'link'}}]};
  const step=new GraphDocument(seeded(),registry).change(g=>{
    const network=g.networks.get('pixel'),before=JSON.stringify(g.document);
    assert.throws(()=>network.insertFragment({...authored,nodes:[...authored.nodes,{...authored.nodes[0],id:'m'}]}),/duplicate/);
    assert.throws(()=>network.insertFragment({...authored,edges:[{from:['missing','out'],to:['copy','value']}]}),/endpoint/);
    assert.equal(JSON.stringify(g.document),before);
    network.insertFragment(authored);authored.nodes[0].ui.x=99;authored.edges[0].ui.style='curve';
    assert.equal(network.node('copy').data.ui.x,4);assert.equal(network.edges[0].data.ui.style,'link');assert.notEqual(network.edges[0].id,'copied-edge');
    const unavailable={nodes:[{id:'ghost',definitionUuid:'unavailable',params:{opaque:[1,2]}}],edges:[{from:['ghost','out'],to:['m','a']}]};
    assert.throws(()=>network.insertFragment(unavailable),/unavailable/);
    network.insertFragment(unavailable,{unavailable:'preserve'});assert.deepEqual(plain(network.node('ghost').data.params),{opaque:[1,2]});
    assert.equal(network.node('ghost').outputs.length,0);
  });
  assert.deepEqual(plain(step.changes.networks[0].added),['copy','ghost']);
});

test('dynamic module commands keep output and port identity, detach only deleted ports and reject atomically',()=>{
  const initial=new GraphDocument(seeded(),registry).change(g=>{
    const network=g.networks.get('pixel');network.create('fold','sgrape.builtin.math',{type:'vec3'});
  }).after;
  const step=new GraphDocument(initial,registry).change(g=>{
    const network=g.networks.get('pixel'),n=network.node('fold'),first=n.port('input','input0'),out=n.outputs[0];
    network.connect(network.node('f').outputs[0],first,policy);n.edit('append');
    network.connect(network.node('f').outputs[0],n.port('input','input3'),policy);const removed=n.port('input','input3');
    n.update({inputValues:{input3:[1,2,3]}});n.edit('remove');
    assert.equal(n.port('input','input0'),first);assert.equal(n.outputs[0],out);assert.equal(out.type,'vec3');assert.equal(removed.exists,false);
    assert.equal(n.data.inputValues.input3,undefined);assert.equal(network.edges.length,1);assert.deepEqual(plain(network.edges[0].to.endpoint),['fold','input0']);
    const before=JSON.stringify(g.document);assert.throws(()=>n.edit('step',{index:0,field:'input',value:100}),/operand/);assert.equal(JSON.stringify(g.document),before);
    n.edit('mode',{value:'shared'});n.edit('operation',{value:'divide'});assert.equal(n.definition.presentation(n.data,g.context).note.text,'A ÷ B ÷ C');
  });
  const restored=new GraphDocument(step.before,registry);assert.equal(restored.networks.get('pixel').node('fold').inputs.length,3);
  assert.equal(step.changes.networks[0].complete,true);
});

test('value modules own scalar, color and dormant vector components without UI field knowledge',()=>{
  const step=new GraphDocument(document(),registry).change(g=>{
    const network=g.networks.get('pixel'),scalar=network.create('s','sgrape.builtin.scalar'),vector=network.create('v','sgrape.builtin.vector',{type:'vec2',components:[1,2,3,4]}),color=network.create('c','sgrape.builtin.color');
    scalar.edit('component',{index:0,value:5});assert.equal(scalar.definition.presentation(scalar.data,g.context).value.value,5);
    vector.edit('component',{index:1,value:9});vector.configure({type:'vec4'});assert.deepEqual(plain(vector.data.params.components),[1,9,3,4]);
    color.edit('value',{value:[1,.5,.25,1]});assert.equal(color.definition.presentation(color.data,g.context).value.color,true);
    const before=JSON.stringify(g.document);assert.throws(()=>vector.edit('component',{index:4,value:9}),/component/);assert.throws(()=>color.edit('value',{value:[1,2]}));assert.equal(JSON.stringify(g.document),before);
  });
  assert.equal(step.changes.networks[0].complete,true);
});

test('Mix chooses only local factor alternatives; fixed outputs, retained wires and disconnect state survive',()=>{
  const result=new GraphDocument(document(),registry).change(g=>{
    const n=g.networks.get('pixel'),mix=n.create('mix','sgrape.builtin.mix',{type:'vec3'}),v=n.create('v','sgrape.builtin.vector',{type:'vec3',components:[1,2,3,4]}),f=n.create('f','sgrape.builtin.float',{value:.5}),bad=n.create('bad','sgrape.builtin.color');
    const out=mix.outputs[0];n.connect(v.outputs[0],mix.port('input','a'),policy);
    const edge=n.connect(v.outputs[0],mix.port('input','factor'),policy);
    assert.equal(mix.port('input','factor').type,'vec3');assert.equal(mix.outputs[0],out);assert.equal(out.type,'vec3');
    const before=JSON.stringify(g.document);assert.throws(()=>n.connect(bad.outputs[0],mix.port('input','factor'),policy));assert.equal(JSON.stringify(g.document),before);
    edge.disconnect();assert.equal(mix.port('input','factor').type,'vec3');
    n.connect(f.outputs[0],mix.port('input','factor'),policy);assert.equal(mix.port('input','factor').type,'float');
    assert.equal(mix.port('input','a').edges.length,1);assert.equal(out.type,'vec3');
  });
  const restored=new GraphDocument(result.after,registry).networks.get('pixel');assert.equal(restored.node('mix').port('input','factor').type,'float');
});

test('Dot and Length configuration changes inputs while scalar output is invariant',()=>{
  new GraphDocument(document(),registry).change(g=>{
    const network=g.networks.get('pixel');
    for(const key of ['dot','length']){
      const n=network.create(key,'sgrape.builtin.'+key),out=n.outputs[0];
      assert.equal(n.definition.presentation(n.data,g.context).selectorLabel,'vector.inputType');
      n.configure({type:'vec4'});assert.ok(n.inputs.every(p=>p.type==='vec4'));assert.equal(n.outputs[0],out);assert.equal(out.type,'float');
    }
  });
});
