const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const[source,snapshot,folder,overlay]=process.argv.slice(2),fixture=JSON.parse(fs.readFileSync(snapshot,'utf8')),checks=[],compiled=[];
const context=vm.createContext({catalog:fixture.catalog,clone:structuredClone,t:key=>key,crypto:require('node:crypto').webcrypto});
vm.runInContext(fs.readFileSync(path.join(source,'functions_model.js'),'utf8'),context);
vm.runInContext(fs.readFileSync(path.join(overlay||source,'graph_ui.js'),'utf8')+'\nthis.model={setTypeContract,resolveAutoEdit,planAutoGraph,autoUnits,storedTypePorts,supportsAutoType};',context);
const M=context.model;M.setTypeContract(fixture.typeContract);
const copy=structuredClone;
function node(key,id,type,auto=false){const d=fixture.catalog.find(d=>d.key===key);assert.ok(d,key);return {id,definitionUuid:d.definitionUuid,revisionHash:d.revisionHash,params:{...copy(d.defaults),...(type?{type}:{})},ui:{x:0,y:0,...(auto?{typeMode:'auto'}:{})}};}
const edge=(from,to,port='a',out='out')=>({from:[from,out],to:[to,port]});
function graph(nodes,edges){return {schemaVersion:1,target:'top',declarations:[],functions:[],stages:{pixel:{nodes:[...nodes,node('pixel_out','out')],edges}}};}
function resolved(g,previous=graph([],[])){M.resolveAutoEdit(g,previous);return g;}
function ty(g,id){return g.stages.pixel.nodes.find(n=>n.id===id).params.type;}
function test(name,fn){fn();checks.push(name);}
const base=()=>graph([node('float','a'),node('float','b'),node('color','color'),node('multiply','m','float',true)],[edge('a','m'),edge('b','m','b'),edge('m','out','color')]);
test('old explicit vec4 nodes retain their type and gain no Auto flag',()=>{const g=base();const m=g.stages.pixel.nodes.find(n=>n.id==='m');delete m.ui.typeMode;m.params.type='vec4';const old=copy(g);g.stages.pixel.nodes.push(node('float','new'));resolved(g,old);assert.equal(ty(g,'m'),'vec4');assert.equal(m.ui.typeMode,undefined);});
test('new unconnected Auto nodes resolve deterministically to float',()=>{const g=resolved(graph([node('add','m','vec4',true)],[]));assert.equal(ty(g,'m'),'float');});
test('vec4 and float resolve Multiply to vec4 with a concrete compiler type',()=>{const g=base();g.stages.pixel.edges[0].from=['color','out'];resolved(g);assert.equal(ty(g,'m'),'vec4');compiled.push({name:'vec4-float',graph:g});});
test('replacing the vector with a float demotes Auto to float',()=>{const g=base();g.stages.pixel.edges[0].from=['color','out'];resolved(g);const old=copy(g);g.stages.pixel.edges[0].from=['a','out'];resolved(g,old);assert.equal(ty(g,'m'),'float');compiled.push({name:'float-float',graph:g});});
test('Auto propagates forward through a chain',()=>{const g=base();g.stages.pixel.nodes.push(node('add','next','float',true));g.stages.pixel.edges=[edge('color','m'),edge('b','m','b'),edge('m','next'),edge('next','out','color')];resolved(g);assert.equal(ty(g,'m'),'vec4');assert.equal(ty(g,'next'),'vec4');compiled.push({name:'auto-chain',graph:g});});
test('Length vec4 input still supplies float to its downstream Auto node',()=>{const g=graph([node('color','c'),node('length','length','float',true),node('add','m','float',true)],[edge('c','length','value'),edge('length','m'),edge('m','out','color')]);resolved(g);assert.equal(ty(g,'length'),'vec4');assert.equal(ty(g,'m'),'float');compiled.push({name:'length-output',graph:g});});
test('mixed vector dimensions have no silently coerced solution',()=>{const g=graph([node('vec2','a'),node('vec3','b'),node('add','m','float',true)],[edge('a','m'),edge('b','m','b')]);assert.throws(()=>resolved(g),/type.autoInputs/);assert.equal(ty(g,'m'),'float');});
test('an incompatible locked downstream blocks promotion before changing types',()=>{const g=base();g.stages.pixel.nodes.push(node('length','lock','vec3'));g.stages.pixel.edges=[edge('a','m'),edge('b','m','b'),edge('m','lock','value'),edge('lock','out','color')];resolved(g);const old=copy(g);g.stages.pixel.edges[0].from=['color','out'];assert.throws(()=>resolved(g,old),/type.autoDownstream/);assert.equal(ty(g,'m'),'float');assert.equal(ty(g,'lock'),'vec3');});
test('manual locks retain vec4 even with only float sources',()=>{const g=base(),m=g.stages.pixel.nodes.find(n=>n.id==='m');m.ui.typeMode='locked';m.params.type='vec4';resolved(g);assert.equal(ty(g,'m'),'vec4');compiled.push({name:'locked-splat',graph:g});});
test('retained vector defaults survive Auto dimension round trips',()=>{const g=base(),m=g.stages.pixel.nodes.find(n=>n.id==='m');m.params.type='vec4';m.inputValues={a:[.1,.2,.3,.4],b:[.5,.6,.7,.8]};const old=copy(g);old.stages.pixel.edges[0].from=['color','out'];resolved(g,old);assert.equal(m.inputValues.a,.1);const scalar=copy(g);g.stages.pixel.edges[0].from=['color','out'];resolved(g,scalar);assert.deepEqual(m.inputValues.a,[.1,.2,.3,.4]);assert.deepEqual(m.inputValues.b,[.5,.6,.7,.8]);compiled.push({name:'retained-defaults',graph:g});});
test('Math with fixed scalar inputs does not accept a vector in Mix.factor',()=>{const g=graph([node('color','c'),node('mix','m','float',true)],[edge('c','m','factor')]);assert.throws(()=>resolved(g),/type.autoInputs/);});
test('cycles involving Auto are rejected',()=>{const g=graph([node('add','a','float',true),node('multiply','b','float',true)],[edge('a','b'),edge('b','a')]);assert.throws(()=>resolved(g),/wire.cycle/);});
test('labels and numeric edits do not re-infer saved Auto state',()=>{const g=base();g.stages.pixel.nodes.find(n=>n.id==='m').params.type='vec4';const before=copy(g);g.stages.pixel.nodes[0].params.value=.8;g.stages.pixel.nodes[0].ui.label='gain';resolved(g,before);assert.equal(ty(g,'m'),'vec4');});
test('unrelated edits can still repair a graph with a preexisting invalid edge',()=>{const g=graph([node('vec2','a'),node('length','length','vec3')],[edge('a','length','value')]);const before=copy(g);g.stages.pixel.nodes.push(node('float','new'));resolved(g,before);assert.equal(ty(g,'length'),'vec3');});
test('manual type cleanup infers Auto first and preserves splats and preexisting invalid drafts',()=>{
 const g=graph([node('vector','v','vec2'),node('add','a','vec2',true),node('length','locked','vec2'),node('float','scalar'),node('add','splat','vec4'),node('vector','old','vec2'),node('length','invalid','vec3')],[edge('v','a'),edge('a','locked','value'),edge('scalar','splat'),edge('old','invalid','value')]);
 const before=copy(g);g.stages.pixel.nodes.find(n=>n.id==='v').params.type='vec3';M.resolveAutoEdit(g,before,{allowInvalid:true,disconnectInvalid:true});
 assert.equal(ty(g,'a'),'vec3');assert.deepEqual(g.stages.pixel.edges,[edge('v','a'),edge('scalar','splat'),edge('old','invalid','value')]);
});
test('disabled cleanup preserves newly invalid endpoints and ordinary edits never remove them',()=>{
 const g=graph([node('vector','v','vec4'),node('vector_split','split','vec4')],[edge('v','split','value')]),before=copy(g);
 g.stages.pixel.nodes[0].params.type='vec2';M.resolveAutoEdit(g,before,{allowInvalid:true});assert.deepEqual(g.stages.pixel.edges,before.stages.pixel.edges);
 const invalid=copy(g);g.stages.pixel.nodes.push(node('float','unrelated'));resolved(g,invalid);assert.deepEqual(g.stages.pixel.edges,before.stages.pixel.edges);
});
test('manual port shrink removes only connections to newly missing ports',()=>{
 const g=graph([node('color','c')],[edge('c','out','color'),edge('c','out','buffer1')]);g.stages.pixel.nodes.find(n=>n.id==='out').params.bufferCount=2;
 const before=copy(g);g.stages.pixel.nodes.find(n=>n.id==='out').params.bufferCount=1;
 M.resolveAutoEdit(g,before,{allowInvalid:true,disconnectInvalid:true});assert.deepEqual(g.stages.pixel.edges,[edge('c','out','color')]);
});
test('Replace Auto follows only its base and propagates the result downstream',()=>{
 assert.equal(M.supportsAutoType(fixture.catalog.find(d=>d.key==='replace')),true);assert.equal(M.supportsAutoType(fixture.catalog.find(d=>d.key==='vector')),false);
 const g=graph([node('vector','v','vec4'),node('float','z'),node('replace','r','vec2',true),node('length','next','float',true)],[edge('v','r','value'),edge('z','r','z'),edge('r','next','value')]);resolved(g);
 assert.equal(ty(g,'r'),'vec4');assert.equal(ty(g,'next'),'vec4');const before=copy(g);g.stages.pixel.edges=g.stages.pixel.edges.filter(e=>e.to[1]!=='value'||e.to[0]!=='r');resolved(g,before);assert.equal(ty(g,'r'),'vec4');
});
test('Replace overrides cannot enlarge Auto and manual base shrink discards only the out-of-range override',()=>{
 const g=graph([node('vector','v','vec4'),node('float','z'),node('replace','r','vec4',true)],[edge('v','r','value'),edge('z','r','z')]),before=copy(g);
 g.stages.pixel.nodes[0].params.type='vec2';M.resolveAutoEdit(g,before,{allowInvalid:true,disconnectInvalid:true});assert.equal(ty(g,'r'),'vec2');assert.deepEqual(g.stages.pixel.edges,[edge('v','r','value')]);
 const bad=graph([node('vector','v','vec3'),node('replace','r','vec2',true)],[edge('v','r','x')]);assert.throws(()=>resolved(bad),/vector.overlap/);assert.equal(ty(bad,'r'),'vec2');
});
function withFunction(scope='local'){
 const g=graph([],[]);g.functions=[{id:'fn',name:'Example',scope,inputs:[{id:'v',name:'Value',type:'vec3',default:[1,1,1]}],outputs:[{id:'v',name:'Value',type:'vec3',default:[0,0,0]}],stages:['pixel'],graph:{nodes:[{id:'in',definitionUuid:'sgrape.function.input',params:{},ui:{}},node('add','m','float',true),{id:'out',definitionUuid:'sgrape.function.output',params:{},ui:{}}],edges:[edge('in','m','a','v'),edge('m','out','v')]}}];return g;
}
test('Function boundary types resolve using that Function rather than the visible graph',()=>{const g=withFunction();resolved(g);assert.equal(g.functions[0].graph.nodes[1].params.type,'vec3');});
test('read-only library graphs keep stored concrete types',()=>{const g=withFunction('builtin');g.functions[0].graph.nodes[1].params.type='vec3';const old=copy(g);g.stages.pixel.nodes.push(node('float','new'));resolved(g,old);assert.deepEqual(g.functions,old.functions);});
test('different components propagate from shared typed Function interfaces',()=>{const g=withFunction();g.stages.pixel.nodes.push({id:'call',definitionUuid:'sgrape.function.call',params:{functionId:'fn'},ui:{}},node('length','l','float',true));g.stages.pixel.edges=[edge('call','l','value','v'),edge('l','out','color')];resolved(g);assert.equal(ty(g,'l'),'vec3');compiled.push({name:'function-boundary',graph:g});});
test('Function interface edits infer internal Auto before pruning incompatible boundary connections',()=>{
 const g=withFunction();resolved(g);const before=copy(g);g.functions[0].inputs[0].type='vec2';
 M.resolveAutoEdit(g,before,{allowInvalid:true,disconnectInvalid:true});assert.equal(g.functions[0].graph.nodes[1].params.type,'vec2');assert.deepEqual(g.functions[0].graph.edges,[edge('in','m','a','v')]);
});
for(const name of ['dot','length','normalize'])test(name+' supports Auto float using the shared signature contract',()=>{const edges=[edge('a','m',name==='dot'?'a':'value'),edge('m','out','color')];if(name==='dot')edges.push(edge('a','m','b'));const g=resolved(graph([node('float','a'),node(name,'m','vec3',true)],edges));assert.equal(ty(g,'m'),'float');compiled.push({name:'scalar-'+name,graph:g});});
fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(path.join(folder,'model.json'),JSON.stringify({passed:true,count:checks.length,checks},null,2));fs.writeFileSync(path.join(folder,'compiler-cases.json'),JSON.stringify(compiled,null,2));console.log(JSON.stringify({passed:true,count:checks.length,compilerCases:compiled.length}));
