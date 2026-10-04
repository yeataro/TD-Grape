const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context=vm.createContext({});
vm.runInContext(fs.readFileSync(require.resolve('../../src/editor/wire_planning.js'),'utf8'),context);
const {plan}=context.GrapeWirePlanning;
const c={components:{float:1,vec2:2,vec3:3,vec4:4},conversions:[]};
const variants=['float','vec2','vec3','vec4'].flatMap(type=>[
  {type,inputs:{a:type,b:type},outputs:{out:type}},
  ...(type==='float'?[]:[{type,inputs:{a:type,b:'float'},outputs:{out:type},operands:{a:type,b:'float'}},{type,inputs:{a:'float',b:type},outputs:{out:type},operands:{a:'float',b:type}}])
]);
const source=(id,type)=>({id,definition:'constant',stored:{inputs:{},outputs:{out:type}}});
const op=(id,type='float',automatic=true)=>({id,definition:'multiply',stored:{inputs:{a:type,b:type},outputs:{out:type}},arithmetic:{type,automatic,variants,preferMatchingOperands:true}});
const edge=(from,to,port='a')=>({from:[from,'out'],to:[to,port]});
const wire=(from,to,port='a')=>({kind:'wire',from:{node:from,port:'out'},to:{node:to,port}});
const json=value=>JSON.parse(JSON.stringify(value));
function freeze(value){if(value&&typeof value==='object'){Object.freeze(value);Object.values(value).forEach(freeze);}return value;}

test('pure module needs no DOM, TD or Python and does not mutate a frozen graph/capabilities',()=>{
  const graph=freeze({nodes:[source('s','vec3'),op('m')],edges:[]}),before=JSON.stringify(graph);
  const r=plan(graph,freeze(c),wire('s','m'));assert.equal(r.ok,true);
  assert.deepEqual(json(r.inference.ports.get('m')),{inputs:{a:'vec3',b:'vec3'},outputs:{out:'vec3'}});
  assert.equal(JSON.stringify(graph),before);assert.equal(graph.edges.length,0);
});
test('replacement displaces exactly one input and preserves unrelated edge metadata',()=>{
  const kept={...edge('s','m','b'),note:'keep'};
  const graph={nodes:[source('s','float'),source('v','vec3'),op('m')],edges:[edge('s','m'),kept]};
  const r=plan(graph,c,wire('v','m'));assert.equal(r.ok,true);assert.equal(r.displaced.length,1);
  assert.equal(r.edges[0],kept);assert.equal(r.inference.ports.get('m').outputs.out,'vec3');assert.equal(graph.edges.length,2);
});
test('cycle, missing port, incompatible locked type and downstream damage are diagnostics',()=>{
  const cycle=plan({nodes:[op('a'),op('b')],edges:[edge('a','b')]},c,wire('b','a'));assert.equal(cycle.ok,false);assert.equal(cycle.diagnostic.code,'cycle');
  const base={nodes:[source('v','vec3'),op('a','vec2',false)],edges:[]};
  assert.equal(plan(base,c,wire('v','a')).ok,false);
  assert.equal(plan(base,c,wire('absent','a')).diagnostic.code,'missing-port');
  const graph={nodes:[source('v','vec3'),op('a'),op('locked','float',false)],edges:[edge('a','locked')]};
  assert.equal(plan(graph,c,wire('v','a')).ok,false);
});
test('one connected product prefers its matching peer; both inputs determine mixed operands',()=>{
  const graph={nodes:[source('v','vec3'),source('f','float'),op('m')],edges:[]};
  const first=plan(graph,c,wire('v','m','b'));assert.equal(first.ok,true);
  assert.equal(first.inference.ports.get('m').inputs.a,'vec3');
  const both=plan({...graph,edges:first.edges},c,wire('f','m'));assert.equal(both.ok,true);
  assert.deepEqual(json(both.inference.ports.get('m')),{inputs:{a:'float',b:'vec3'},outputs:{out:'vec3'}});
});
test('unrelated edits retain a valid previously saved product signature',()=>{
  const m=op('m','vec3');m.stored.inputs.b='float';m.arithmetic.operands={a:'vec3',b:'float'};
  const graph={nodes:[source('v','vec3'),source('f','float'),m,op('other')],edges:[edge('v','m')]};
  const r=plan(graph,c,wire('f','other'));assert.equal(r.ok,true);
  assert.equal(r.inference.ports.get('m').inputs.b,'float');
});
test('stale previews never authorize the next plan; an unchanged invalid draft remains editable',()=>{
  const graph={nodes:[source('v','vec3'),op('a'),op('bad','vec2',false)],edges:[edge('v','bad')]};
  const result=plan(graph,c,wire('v','a'));assert.equal(result.ok,true);
  graph.edges=[edge('a','v')];assert.equal(plan(graph,c,wire('v','a')).diagnostic.code,'cycle');
});
test('infer and wire intents share signature selection without persistent draft state',()=>{
  const graph={nodes:[source('v','vec4'),op('m')],edges:[]};
  const a=plan(graph,c,wire('v','m'));assert.equal(a.ok,true);
  const b=plan({...graph,edges:a.edges},c,{kind:'infer'},graph);assert.equal(b.ok,true);
  assert.deepEqual(json([...a.inference.ports]),json([...b.inference.ports]));
});
test('long chains do not depend on JS recursion limits',()=>{
  const nodes=[source('s','float')],edges=[];
  for(let i=0;i<12000;i++){nodes.push(op('n'+i));edges.push(edge(i?'n'+(i-1):'s','n'+i));}
  const r=plan({nodes,edges},c,{kind:'infer'});assert.equal(r.ok,true);assert.equal(r.inference.ports.size,12001);
});
