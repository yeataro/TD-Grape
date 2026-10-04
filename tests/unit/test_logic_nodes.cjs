const {test}=require('node:test'),assert=require('node:assert/strict');
const {GraphDocument,registry,createCompiler,values}=require('../../src/editor/wire_planning.js');
const {logicCases}=require('../fixtures/logic_nodes.cjs');
const {node,edge,port}=require('../fixtures/shared_subgraphs.cjs');
const compiler=createCompiler(registry);
test('logic graphs compile through the real registry for every supported type family',()=>{
 for(const row of logicCases()){assert.equal(compiler.supports(row.graph),true,row.key+' '+row.type);assert.match(compiler.compile(row.graph).pixel,/void main/);}
});
test('value literals reject invalid boolean/integer state and preserve full uint and int minima',()=>{
 for(const [v,t]of [[1,'bool'],[false,'int'],[1.5,'int'],[-1,'uint'],[4294967296,'uint'],[[true,0],'bvec2']])assert.throws(()=>values.literal(v,t));
 assert.equal(values.literal(-2147483648,'int'),'(-2147483647 - 1)');assert.equal(values.literal(4294967295,'uint'),'4294967295u');
 assert.equal(values.policy.conversions.some(p=>p.from==='bool'&&p.to==='float'),false);
});
test('boolean subgraph ports, manual reshape and If connections retain ownership and fixed outputs',()=>{
 const row=logicCases().find(r=>r.key==='if'&&r.type==='float'),g=structuredClone(row.graph);
 g.functions=[{id:'logic',name:'Logic',scope:'local',stages:['pixel'],inputs:[port('condition','bool',false)],outputs:[port('result','bool',false)],graph:{nodes:[node('in','function.input'),node('out','function.output')],edges:[edge('in','out','condition','result')]}}];
 g.stages.pixel.nodes.push(node('flag','scalar',{type:'bool',value:true}),node('call','function.call',{functionId:'logic'}));
 g.stages.pixel.edges.push(edge('flag','call','out','condition'),edge('call','operation','result','condition'));
 assert.equal(compiler.supports(g),true);assert.match(compiler.compile(g).pixel,/bool/);
 const step=new GraphDocument(g,registry).change(d=>{d.subgraph('logic').editInterface('inputs',{kind:'update',id:'condition',patch:{type:'int'}});});
 assert.equal(step.after.functions[0].inputs[0].default,0);
 const graph=new GraphDocument(g,registry);assert.throws(()=>graph.change(d=>d.networks.get('pixel').connect(d.networks.get('pixel').node('flag').port('output','out'),d.networks.get('pixel').node('operation').port('input','true'),values.policy)),/cannot|incompatible|connect|Connection/);
 assert.equal(graph.snapshot().stages.pixel.nodes[0].params.type,'float');
});
test('predicate output selection changes its input width only by an explicit command',()=>{
 const row=logicCases().find(r=>r.key==='isnan'&&r.type==='vec3');
 const step=new GraphDocument(row.graph,registry).change(d=>{const n=d.networks.get('pixel').node('operation');assert.equal(n.outputs[0].type,'bvec3');n.edit('output',{value:'bvec4'});assert.equal(n.inputs[0].type,'vec4');assert.equal(n.outputs[0].type,'bvec4');});
 assert.equal(step.after.stages.pixel.nodes[0].params.type,'vec4');
});
