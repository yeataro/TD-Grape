// Compare migrated nodes against the fixed Legacy checkout, never a generated
// Python primitive from the candidate being tested. Legacy is read-only (-B).
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const [legacyRoot,folder]=process.argv.slice(2);assert.ok(legacyRoot&&folder,'Expected LEGACY_ROOT EVIDENCE_DIR');
fs.mkdirSync(folder,{recursive:true});
const keys=['mix','dot','length','normalize'];
const python=`import json,sys
sys.path.insert(0,sys.argv[1])
import sgrape_core as c
rows=[]
for key in json.loads(sys.argv[2]):
 for ty in ('float','vec4'):
  for connected in (False,True):
   source=c.node('float' if ty=='float' else 'color','source',value=.25 if ty=='float' else [.25,.5,.75,1])
   operation=c.node(key,'operation',type=ty)
   port='a' if key in ('mix','dot') else 'value'
   operation['inputValues']={port:.375 if ty=='float' else [.375,.5,.625,1]}
   edges=[c.edge('operation','out','color')]
   if connected:edges.insert(0,c.edge('source','operation',port))
   graph={'schemaVersion':1,'target':'top','declarations':[],'functions':[],'topInputs':[],'stages':{'pixel':{'nodes':[source,operation,c.node('pixel_out','out')],'edges':edges}}}
   compiled=c.compile_graph(graph);compiled.pop('hash')
   rows.append({'key':key,'type':ty,'connected':connected,'graph':graph,'compiled':compiled})
print(json.dumps(rows,allow_nan=False))
`;
const rows=JSON.parse(execFileSync(process.env.PYTHON||'python',['-B','-c',python,path.resolve(legacyRoot,'src/core'),JSON.stringify(keys)],{encoding:'utf8',env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}}));
fs.writeFileSync(path.join(folder,'legacy-cases.json'),JSON.stringify(rows,null,2));
const root=path.resolve(__dirname,'../..'),scope=vm.createContext({});vm.runInContext(fs.readFileSync(path.join(root,'src/editor/wire_planning.js'),'utf8'),scope);
for(const row of rows){
 assert.equal(scope.GrapeTopCompiler.supports(row.graph),true,row.key);
 assert.deepEqual(JSON.parse(JSON.stringify(scope.GrapeTopCompiler.compile(row.graph))),row.compiled,`${row.key} ${row.type} connected=${row.connected}`);
 const model=new scope.GrapeGraph.GraphDocument(row.graph,scope.GrapeGraph.registry),step=model.change(g=>g.networks.get('pixel').node('operation').configure({type:row.type==='float'?'vec4':'float'}));
 assert.equal(new scope.GrapeGraph.GraphDocument(step.after,scope.GrapeGraph.registry).networks.get('pixel').node('operation').outputs[0].type,['dot','length'].includes(row.key)?'float':row.type==='float'?'vec4':'float');
 assert.equal(new scope.GrapeGraph.GraphDocument(step.before,scope.GrapeGraph.registry).networks.get('pixel').node('operation').outputs[0].type,['dot','length'].includes(row.key)?'float':row.type);
}
const native=[];
for(const ty of ['vec2','vec3','vec4']){
 const g={schemaVersion:1,target:'top',declarations:[],functions:[],topInputs:[],stages:{pixel:{nodes:[
  {id:'factor',definitionUuid:'sgrape.builtin.vector',params:{type:ty,components:[.1,.2,.3,.4]}},
  {id:'mix',definitionUuid:'sgrape.builtin.mix',params:{type:ty}},
  {id:'out',definitionUuid:'sgrape.builtin.pixel_out',params:{}}
 ],edges:[]}}};
 const model=new scope.GrapeGraph.GraphDocument(g,scope.GrapeGraph.registry).change(m=>{
  const network=m.networks.get('pixel'),mix=network.node('mix');
  network.connect(network.node('factor').outputs[0],mix.port('input','factor'),{components:{float:1,vec2:2,vec3:3,vec4:4},conversions:[{from:'float',to:ty}]});
  // vec2/vec3 results feed Length so the final scalar can legally feed vec4.
  network.create('length','sgrape.builtin.length',{type:ty});
  network.connect(mix.outputs[0],network.node('length').inputs[0],{components:{[ty]:+ty.slice(-1)},conversions:[]});
  network.connect(network.node('length').outputs[0],network.node('out').inputs[0],{components:{float:1,vec4:4},conversions:[{from:'float',to:'vec4'}]});
 });
 native.push(JSON.parse(JSON.stringify(model.after)));
}
const mixed=native.map(g=>{const result=structuredClone(g);result.stages.pixel.nodes.push({id:'unmigrated',definitionUuid:'sgrape.builtin.uv',params:{}});return result;});
const candidatePython=`import json,sys\nsys.path.insert(0,sys.argv[1])\nimport sgrape_core as c\nrows=[]\nfor graph in json.load(sys.stdin):\n result=c.compile_graph(graph);result.pop('hash');rows.append(result)\nprint(json.dumps(rows,allow_nan=False))`;
const host=JSON.parse(execFileSync(process.env.PYTHON||'python',['-B','-c',candidatePython,path.join(root,'src/core')],{input:JSON.stringify([...native,...mixed]),encoding:'utf8',env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}}));
native.forEach((g,i)=>{
 assert.deepEqual(JSON.parse(JSON.stringify(scope.GrapeTopCompiler.compile(g))),host[i]);
 assert.equal(scope.GrapeTopCompiler.supports(mixed[i]),false);
 assert.equal(host[i].pixel,host[i+native.length].pixel);
 assert.deepEqual(host[i].stages.pixel.ports.mix,host[i+native.length].stages.pixel.ports.mix);
});
fs.writeFileSync(path.join(folder,'native-cases.json'),JSON.stringify({native,mixed,host},null,2));
const report={passed:true,nodes:keys,legacyRoot:path.resolve(legacyRoot),compilerEquivalenceCases:rows.length,modelConfigurationAndRestoreCases:rows.length,newNativeFactorCases:native.length,mixedLegacyFallbackCases:mixed.length,comparison:['GLSL','bindings','source map','ports','diagnostics'],limits:['float and vec4 fixed Legacy graphs; numeric vec2/3/4 factor is new behavior compared with candidate Python','does not claim all Desktop overloads or actual TD execution']};
fs.writeFileSync(path.join(folder,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
