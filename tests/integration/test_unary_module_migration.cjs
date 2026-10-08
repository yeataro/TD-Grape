// Compare migrated nodes against the fixed Legacy checkout, never a generated
// Python primitive from the candidate being tested. Legacy is read-only (-B).
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const [legacyRoot,folder]=process.argv.slice(2);assert.ok(legacyRoot&&folder,'Expected LEGACY_ROOT EVIDENCE_DIR');
fs.mkdirSync(folder,{recursive:true});
const keys=['sin','cos','fract','sign','sqrt','floor','round','ceil','trunc'];
const python=`import json,sys
sys.path.insert(0,sys.argv[1])
import sgrape_core as c
rows=[]
for key in json.loads(sys.argv[2]):
 for ty in ('float','vec4'):
  for connected in (False,True):
   source=c.node('float' if ty=='float' else 'color','source',value=.25 if ty=='float' else [.25,.5,.75,1])
   operation=c.node(key,'operation',type=ty)
   operation['inputValues']={'value':.375 if ty=='float' else [.375,.5,.625,1]}
   edges=[c.edge('operation','out','color')]
   if connected:edges.insert(0,c.edge('source','operation','value'))
   graph={'schemaVersion':1,'target':'top','declarations':[],'functions':[],'topInputs':[],'stages':{'pixel':{'nodes':[source,operation,c.node('pixel_out','out')],'edges':edges}}}
   compiled=c.compile_graph(graph);compiled.pop('hash')
   rows.append({'key':key,'type':ty,'connected':connected,'graph':graph,'compiled':compiled})
print(json.dumps(rows,allow_nan=False))
`;
const rows=JSON.parse(execFileSync(process.env.PYTHON||'python',['-B','-c',python,path.resolve(legacyRoot,'src/core'),JSON.stringify(keys)],{encoding:'utf8',env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}}));
// Legacy cases are old-format graphs; convert them with the tool that converts real old graphs (Q44).
// 舊產碼器產出舊格式的圖，用轉換真實舊圖的同一支工具轉成新格式。
const {convertOldGraph}=require('../../tools/dev/old_graph.cjs');
for(const row of rows)row.graph=convertOldGraph(row.graph).graph;
fs.writeFileSync(path.join(folder,'legacy-cases.json'),JSON.stringify(rows,null,2));
const root=path.resolve(__dirname,'../..'),scope=vm.createContext({});vm.runInContext(fs.readFileSync(path.join(root,'src/generated/wire_planning.js'),'utf8'),scope);
for(const row of rows){
 assert.equal(scope.GrapeTopCompiler.supports(row.graph),true,row.key);
 assert.deepEqual(JSON.parse(JSON.stringify(scope.GrapeTopCompiler.compile(row.graph))),row.compiled,`${row.key} ${row.type} connected=${row.connected}`);
 const model=new scope.GrapeGraph.GraphDocument(row.graph,scope.GrapeGraph.registry),step=model.change(g=>g.networks.get('pixel').node('operation').configure({type:row.type==='float'?'vec4':'float'}));
 assert.equal(new scope.GrapeGraph.GraphDocument(step.after,scope.GrapeGraph.registry).networks.get('pixel').node('operation').outputs[0].type,row.type==='float'?'vec4':'float');
 assert.equal(new scope.GrapeGraph.GraphDocument(step.before,scope.GrapeGraph.registry).networks.get('pixel').node('operation').outputs[0].type,row.type);
}
const report={passed:true,nodes:keys,legacyRoot:path.resolve(legacyRoot),compilerEquivalenceCases:rows.length,modelConfigurationAndRestoreCases:rows.length,comparison:['GLSL','bindings','source map','ports','diagnostics'],limits:['float and vec4 full TOP graphs','does not claim all Desktop overloads or actual TD execution']};
fs.writeFileSync(path.join(folder,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
