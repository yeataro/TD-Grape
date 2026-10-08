const {test}=require('node:test'),assert=require('node:assert/strict');
const {GraphDocument,registry,createCompiler,values}=require('../../src/generated/grape_core.js');
const {vectorCases}=require('../fixtures/vector_nodes.cjs');
const {node,edge}=require('../fixtures/shared_subgraphs.cjs');
const compiler=createCompiler(registry);

// A dormant Uniform is not declared in the GLSL, but still goes to TD: its row lives as long as the
// declaration (Uniform D1, `declared`). 沒用到的 Uniform 不在 GLSL 裡，但仍交給 TD（那一列跟著宣告存在）。
test('fully overridden inputs are dormant for code but never for cycle detection',()=>{
 const row=vectorCases().find(r=>r.key==='replace-uniform'&&r.type==='vec4:true');
 const compiled=compiler.compile(row.graph);assert.ok(!/^uniform /m.test(compiled.pixel));assert.ok(!compiled.stages.pixel.live.includes('base'));
 assert.deepEqual(compiled.bindings.map(b=>b.kind),['uniform']);
 const cycle=structuredClone(row.graph);cycle.stages.pixel.edges[0].from=['operation','out'];
 assert.throws(()=>compiler.compile(cycle),/Cycle/);
 const partial=vectorCases().find(r=>r.key==='replace-uniform'&&r.type==='vec4:false');assert.equal(compiler.compile(partial.graph).bindings.length,1);
});
test('vector, routing and constructor graphs compile through actual node modules',()=>{
 for(const row of vectorCases()){assert.equal(compiler.supports(row.graph),true,row.key+' '+row.type);assert.match(compiler.compile(row.graph).pixel,/void main/);}
});
test('component drop displaces only overlapping wires, keeps output and has identical query/commit results',()=>{
 const graph={format:'grape-graph',version:1,target:'top',declarations:[],stages:{pixel:{nodes:[node('wide','vec2',{value:[.2,.3]}),node('a','float',{value:.4}),node('b','float',{value:.5}),node('c','float',{value:.6}),node('join','combine',{type:'vec4',groups:{},components:[0,0,0,0]})],edges:[edge('a','join','out','x'),edge('b','join','out','y'),edge('c','join','out','w')]}}};
 const query=new GraphDocument(graph,registry),n=query.networks.get('pixel'),before=query.snapshot();
 const planned=n.plan(values.policy,{kind:'wire',from:{node:'wide',port:'out'},to:{node:'join',port:'x'}});
 assert.equal(planned.ok,true);assert.equal(planned.displaced.length,2);assert.deepEqual(query.snapshot(),before);
 const step=query.change(d=>{const n=d.networks.get('pixel');n.connect(n.node('wide').port('output','out'),n.node('join').port('input','x'),values.policy);assert.equal(n.node('join').outputs[0].type,'vec4');assert.equal(n.node('join').inputs[0].type,'vec2');assert.equal(n.edges.length,2);});
 assert.deepEqual(step.after.stages.pixel.nodes.find(n=>n.id==='join').params.groups,{x:'vec2'});
 const disconnected=new GraphDocument(step.after,registry).change(d=>{const n=d.networks.get('pixel');n.disconnectAll(n.edges);});
 assert.deepEqual(disconnected.after.stages.pixel.nodes.find(n=>n.id==='join').params.groups,{x:'vec2'});
});
test('failed component drop is atomic and component edits live in the node data used by fallback',()=>{
 const graph={format:'grape-graph',version:1,target:'top',declarations:[],stages:{pixel:{nodes:[node('wide','vec4',{value:[0,0,0,0]}),node('join','combine',{type:'vec3',groups:{},components:[0,0,0,0]})],edges:[]}}};
 const q=new GraphDocument(graph,registry);assert.throws(()=>q.change(d=>{const n=d.networks.get('pixel');n.connect(n.node('wide').port('output','out'),n.node('join').port('input','x'),values.policy);}),/exceeds/);assert.deepEqual(q.snapshot(),graph);
 const step=q.change(d=>d.networks.get('pixel').node('join').setInput('y',.7));assert.equal(step.after.stages.pixel.nodes[1].params.components[1],.7);assert.equal(step.after.stages.pixel.nodes[1].inputValues,undefined);
});
test('explicit constructor input changes cannot silently retarget its output',()=>{
 const g=vectorCases().find(r=>r.key==='convert'&&r.type==='vec4->vec4').graph;
 const d=new GraphDocument(g,registry);assert.throws(()=>d.change(g=>g.networks.get('pixel').node('operation').edit('fromType',{value:'vec2'})),/construct/);
 assert.equal(d.snapshot().stages.pixel.nodes.find(n=>n.id==='operation').params.toType,'vec4');
});
