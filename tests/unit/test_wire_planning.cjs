const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context=vm.createContext({});vm.runInContext(fs.readFileSync(require.resolve('../../src/generated/grape_core.js'),'utf8'),context);
const {plan,registry}=context.GrapeGraph;
const c={components:{float:1,vec2:2,vec3:3,vec4:4,bool:1,bvec3:3,mat3:9,mat2x3:6},conversions:[{from:'float',to:'vec3'}]};
const source=(id,type)=>({id,definition:'constant',stored:{inputs:{},outputs:{out:type}}});
const op=(id,type='float')=>({id,definition:'multiply',stored:{inputs:{a:type,b:type},outputs:{out:type}},variants:registry.get('sgrape.builtin.multiply').signatures({params:{type}})});
const edge=(from,to,port='a')=>({from:[from,'out'],to:[to,port]});
const wire=(from,to,port='a')=>({kind:'wire',from:{node:from,port:'out'},to:{node:to,port}});
const plain=v=>JSON.parse(JSON.stringify(v));
function freeze(v){if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}
test('existing output never changes; unsupported new wire is rejected without mutation',()=>{
  const graph=freeze({nodes:[source('s','vec3'),op('m')],edges:[]}),before=JSON.stringify(graph);
  assert.equal(plan(graph,freeze(c),wire('s','m')).ok,false);assert.equal(JSON.stringify(graph),before);
});
test('native scalar-vector inputs are preferred to conversion without changing output or downstream',()=>{
  const graph={nodes:[source('s','float'),op('m','vec3'),op('next','vec3')],edges:[edge('m','next')]};
  const result=plan(graph,c,wire('s','m'));assert.equal(result.ok,true);
  assert.deepEqual(plain(result.inference.ports.get('m')),{inputs:{a:'float',b:'vec3'},outputs:{out:'vec3'}});
  assert.equal(result.inference.choices.has('next'),false);assert.equal(result.inference.ports.get('next'),graph.nodes[2].stored);
});
test('replacement preserves unrelated metadata and only displaces the selected input',()=>{
  const kept={...edge('s','m','b'),id:'keep',conversion:{kind:'identity'}};
  const graph={nodes:[source('s','float'),source('v','vec3'),op('m','vec3')],edges:[edge('s','m'),kept]};
  const r=plan(graph,c,wire('v','m'));assert.equal(r.ok,true);assert.equal(r.displaced.length,1);assert.equal(r.edges[0],kept);
  assert.deepEqual(plain(r.inference.ports.get('m').inputs),{a:'vec3',b:'float'});
});
test('disconnect and unrelated edits retain the selected signature; no reset to creation defaults',()=>{
  const m=op('m','vec3');m.stored.inputs={a:'float',b:'vec3'};
  const graph={nodes:[m,source('f','float'),op('other')],edges:[]};
  const inferred=plan(graph,c,{kind:'infer'});assert.equal(inferred.ok,true);assert.deepEqual(plain(inferred.inference.ports.get('m')),m.stored);
  const unrelated=plan(graph,c,wire('f','other'));assert.equal(unrelated.ok,true);assert.equal(unrelated.inference.ports.get('m'),m.stored);
});
test('existing inputs constrain whole tuples: incompatible matrix shape is absent from candidates',()=>{
  const m=op('m','vec3');m.stored.inputs={a:'mat3',b:'vec3'};
  m.variants=[{type:'vec3',inputs:{a:'mat3',b:'vec3'},outputs:{out:'vec3'}},{type:'vec3',inputs:{a:'mat2x3',b:'vec2'},outputs:{out:'vec3'}}];
  const graph={nodes:[source('a','mat3'),source('b','vec3'),source('new','mat2x3'),m],edges:[edge('a','m'),edge('b','m','b')]};
  const before=JSON.stringify(graph);assert.equal(plan(graph,c,wire('new','m')).ok,false);assert.equal(JSON.stringify(graph),before);
  const free={...graph,edges:[graph.edges[0]]};assert.equal(plan(free,c,wire('new','m')).ok,true);
});
test('Mix accepts its native factor choices; Clamp candidates cannot be cross-combined',()=>{
  const mix={id:'m',definition:'mix',stored:{inputs:{a:'vec3',b:'vec3',factor:'float'},outputs:{out:'vec3'}},variants:['float','vec3','bvec3'].map(factor=>({type:'vec3',inputs:{a:'vec3',b:'vec3',factor},outputs:{out:'vec3'}}))};
  for(const factor of ['float','vec3','bvec3']){const r=plan({nodes:[source('s',factor),mix],edges:[]},c,wire('s','m','factor'));assert.equal(r.ok,true);assert.equal(r.inference.ports.get('m').inputs.factor,factor);assert.equal(r.inference.ports.get('m').outputs.out,'vec3');}
  const clamp={id:'m',definition:'clamp',stored:{inputs:{value:'vec3',min:'float',max:'float'},outputs:{out:'vec3'}},variants:['float','vec3'].map(t=>({type:'vec3',inputs:{value:'vec3',min:t,max:t},outputs:{out:'vec3'}}))};
  const r=plan({nodes:[source('a','float'),source('b','vec3'),clamp],edges:[edge('a','m','min')]},{...c,conversions:[]},wire('b','m','max'));assert.equal(r.ok,false);
});
test('fixed result functions retain meaningful input dimensions; every output is invariant',()=>{
  const n={id:'n',definition:'length',stored:{inputs:{value:'float'},outputs:{out:'float'}},variants:['float','vec2','vec3','vec4'].map(type=>({type,inputs:{value:type},outputs:{out:'float'}}))};
  const r=plan({nodes:[source('s','vec3'),n],edges:[]},c,wire('s','n','value'));assert.equal(r.ok,true);assert.equal(r.inference.ports.get('n').inputs.value,'vec3');assert.equal(r.inference.ports.get('n').outputs.out,'float');
  n.stored.outputs.secondary='int';assert.equal(plan({nodes:[source('s','vec3'),n],edges:[]},c,wire('s','n','value')).ok,false);
});
test('cycles and missing ports reject; unrelated invalid drafts remain editable',()=>{
  assert.equal(plan({nodes:[op('a'),op('b')],edges:[edge('a','b')]},c,wire('b','a')).diagnostic.code,'cycle');
  const graph={nodes:[source('v','vec3'),source('f','float'),op('a'),op('bad','vec2')],edges:[edge('v','bad')]};
  assert.equal(plan(graph,c,wire('f','a')).ok,true);assert.equal(plan(graph,c,wire('absent','a')).diagnostic.code,'missing-port');
});
test('long chains never require recursive inference or visit downstream signatures on a wire',()=>{
  const nodes=[source('s','float')],edges=[];
  for(let i=0;i<12000;i++){nodes.push(op('n'+i));edges.push(edge(i?'n'+(i-1):'s','n'+i));}
  const r=plan({nodes,edges},c,wire('s','n0'));assert.equal(r.ok,true);assert.equal(r.inference.choices.size,1);assert.equal(r.inference.ports.size,12001);
});

// A wire not in effect (a ghost) never constrains its node (Refactor.103.1; Q37 1-3, Q72): a Mix turned vec3 with a vec4 still stored on
// `a` takes wires on its other inputs; the ghost stays where it is. 沒接通的線（Ghost）從不限制節點（R.103.1）：改成 vec3 的 Mix，`a` 上還存著
// vec4，其他輸入照樣接得上；Ghost 線留在原地。
test('a wire not in effect does not constrain its node; it stays stored',()=>{
  const mix={id:'m',definition:'mix',stored:{inputs:{a:'vec3',b:'vec3',factor:'float'},outputs:{out:'vec3'}},
    variants:['vec3','vec4'].flatMap(t=>['float',t].map(factor=>({type:t,inputs:{a:t,b:t,factor},outputs:{out:t}})))};
  const ghost=edge('v4','m','a'),graph={nodes:[source('v4','vec4'),source('f','float'),mix],edges:[ghost]};
  assert.equal(plan(graph,c,wire('f','m','factor')).diagnostic.code,'input-signature','counted, it blocks every input');
  const r=plan(graph,c,wire('f','m','factor'),new Set());assert.equal(r.ok,true);
  assert.ok(r.edges.includes(ghost),'the ghost wire is kept');assert.equal(r.inference.ports.get('m').outputs.out,'vec3');
  // A wire in effect still constrains: nothing turns into a ghost. 接通的線照樣限制：不會把它變成 Ghost。
  const live=edge('f','m','b'),fits={...graph,edges:[live]};
  assert.equal(plan(fits,{...c,conversions:[]},wire('v4','m','factor'),new Set([live])).ok,false);
});

// The same on a whole graph, as the human met it (Grape_TOP_REF, 2026-10-12). 整張圖上同一件事，照人類遇到的情況。
test('a graph: the Mix with a ghost on `a` takes Sine on factor; set back to vec4, the ghost is in effect again',()=>{
  const G=context.GrapeGraph,boot=JSON.parse(fs.readFileSync(require.resolve('../../src/generated/editor-bootstrap.json'),'utf8'));
  const build=type=>{const g=JSON.parse(JSON.stringify(boot.defaultDocument.graph)),p=g.stages.pixel;
    p.nodes.push({id:'rgba',nodeType:'sgrape.builtin.color',params:{value:[1,0,0,1]},ui:{x:0,y:0}},
      {id:'mix',nodeType:'sgrape.builtin.mix',params:{type},ui:{x:200,y:0}},{id:'sine',nodeType:'sgrape.builtin.sin',params:{type:'float'},ui:{x:0,y:200}});
    p.edges.push({id:'e_a',from:['rgba','out'],to:['mix','a']});return new G.GraphDocument(g,G.registry).networks.get('pixel');};
  const net=build('vec3'),policy=G.values.policy;
  assert.deepEqual([...G.ghostsOf(net,policy).edges],['e_a']);
  assert.equal([...G.connectedWires(net,policy)].some(e=>e.id==='e_a'),false,'not in effect');
  assert.equal(net.plan(policy,{kind:'wire',from:{node:'sine',port:'out'},to:{node:'mix',port:'factor'}}).ok,true);
  assert.equal(G.ghostsOf(build('vec4'),policy).edges.size,0,'back to vec4, the wire is in effect again');
});
