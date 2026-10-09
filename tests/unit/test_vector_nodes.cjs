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
 // Unplugging the wire that made the group splits it back; the output stays (Q65). 拔掉造成分量組的線就分回去；輸出不變。
 const disconnected=new GraphDocument(step.after,registry).change(d=>{const n=d.networks.get('pixel');n.disconnectAll(n.edges);});
 assert.deepEqual(disconnected.after.stages.pixel.nodes.find(n=>n.id==='join').params.groups,{});
});
test('a component group splits back when its wire goes, however it goes; values and other wires stay (Q65)',()=>{
 const graph={format:'grape-graph',version:1,target:'top',declarations:[],stages:{pixel:{nodes:[node('wide','vec3',{value:[.2,.3,.4]}),node('d','float',{value:.6}),node('join','combine',{type:'vec4',groups:{},components:[.1,.2,.3,.9]})],edges:[edge('d','join','out','w')]}}};
 const wired=new GraphDocument(graph,registry).change(d=>{const n=d.networks.get('pixel');n.connect(n.node('wide').port('output','out'),n.node('join').port('input','x'),values.policy);});
 const join=after=>after.stages.pixel.nodes.find(n=>n.id==='join');
 assert.deepEqual(join(wired.after).params.groups,{x:'vec3'});
 // change() returns the result; the document it ran on is unchanged. change() 回傳結果；原文件不變。
 const ports=after=>new GraphDocument(after,registry).networks.get('pixel').node('join').inputs.map(p=>p.key+':'+p.type);
 const step=(graph,edit)=>new GraphDocument(graph,registry).change(d=>edit(d.networks.get('pixel'))).after;
 // Unplugged by hand: x, y, z come back as floats with their values; w keeps its wire; the output stays vec4.
 const byHand=step(wired.after,n=>n.disconnectAll(n.edges.filter(e=>e.data.from[0]==='wide')));
 assert.deepEqual(ports(byHand),['x:float','y:float','z:float','w:float']);
 assert.deepEqual(join(byHand).params.components,[.1,.2,.3,.9]);
 assert.equal(new GraphDocument(byHand,registry).networks.get('pixel').node('join').outputs[0].type,'vec4');
 assert.deepEqual(byHand.stages.pixel.edges.map(e=>e.to[1]),['w']);
 // The source node deleted: the same. 刪掉來源節點：一樣分回去。
 assert.deepEqual(ports(step(wired.after,n=>n.remove(n.node('wide')))),['x:float','y:float','z:float','w:float']);
 // A wire replaced by another into the same input regroups to the new one. 同一個輸入換成另一條線：照新的線分組。
 assert.deepEqual(join(step(wired.after,n=>n.connect(n.node('d').port('output','out'),n.node('join').port('input','x'),values.policy))).params.groups,{});
 // Other wires into the node stay as they are. 接到這個節點的其他線不受影響。
 assert.deepEqual(ports(wired.after),['x:vec3','w:float']);
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
