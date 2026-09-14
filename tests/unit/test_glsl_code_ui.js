const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const payload=JSON.parse(fs.readFileSync(0,'utf8'));
const context=vm.createContext({assert,payload,console,crypto:require('node:crypto').webcrypto,
  t:x=>x,clone:x=>JSON.parse(JSON.stringify(x)),catalog:payload.catalog,
  FunctionModel:{CALL:'sgrape.function.call',INPUT:'sgrape.function.input',OUTPUT:'sgrape.function.output'}});
vm.runInContext(fs.readFileSync(process.argv[2],'utf8'),context);
vm.runInContext(`
setTypeContract(payload.contract);
const graph=payload.graph,node=graph.stages.pixel.nodes[0],data=graph.stages.pixel;
CustomGLSL.validate(node.params);
const baseline=clone(node);
CustomGLSL.add(node.params,'outputs');const added=node.params.outputs[1];
assert.equal(added.name,'output1');assert.notEqual(added.id,'c');
CustomGLSL.update(node,'outputs',added.id,{name:'colour',type:'vec4'});
CustomGLSL.move(node.params,'outputs',added.id,-1);
assert.equal(node.params.outputs[0].id,added.id);
assert.equal(resolvedNodePorts(catalog.find(d=>d.key==='glsl_code'),node.params,null,'outputs')[added.id],'vec4');
assert.ok(CustomGLSL.header(node.params).includes('out vec4 colour'));
assert.throws(()=>CustomGLSL.remove(node,'outputs','c',data.edges),/code.disconnectFirst/);
CustomGLSL.remove(node,'outputs',added.id,data.edges);
assert.equal(JSON.stringify(node),JSON.stringify(baseline));
assert.throws(()=>CustomGLSL.remove(node,'outputs','c',[]),/code.keepOutput/);
CustomGLSL.update(node,'inputs','a',{name:'value',type:'vec3'});
assert.equal(JSON.stringify(node.inputValues.a),JSON.stringify([.2,.2,.2]));
CustomGLSL.update(node,'inputs','a',{type:'sampler2D'});
assert.equal(Object.hasOwn(node.inputValues,'a'),false);
const before=clone(graph),oldPorts=storedTypePorts(before,before.stages.pixel);
CustomGLSL.update(node,'outputs','c',{type:'vec2'});
const plan=planAutoGraph(graph,data);
assert.throws(()=>rejectNewTypeIssues(data,plan.ports,before.stages.pixel,oldPorts),/type.autoDownstream/);
for(const name of ['float','main','sampler2D','uTDTime','x__y','a b']){
 const bad=clone(baseline.params);bad.functionName=name;assert.throws(()=>CustomGLSL.validate(bad),/code.invalidName/);
}
console.log('GLSL Code model passed');
`,context);
