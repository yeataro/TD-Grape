// Fixed Legacy is read-only; candidate Python is not the equivalence oracle.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const [legacyRoot,folder]=process.argv.slice(2);fs.mkdirSync(folder,{recursive:true});
const python=`import json,sys
sys.path.insert(0,sys.argv[1])
import sgrape_core as c
rows=[]
for ty in ('float','vec4'):
 for mode in ('steps','shared'):
  for operation in ('add','subtract','multiply','divide'):
   for count in (2,3,32):
    for connected in (False,True):
     source=c.node('float' if ty=='float' else 'color','source',value=c.filled_value(ty,2))
     n=c.node('math','fold',type=ty,inputCount=count,mode=mode,operation=operation,steps=[{'operator':operation,'input':i%count} for i in range(1,count)])
     n['inputValues']={'input'+str(i):c.filled_value(ty,i+1) for i in range(count)}
     n['ui']={'label':'Fold\\nLabel \\\\','comment':'A operation B\\n#line 99\\ntrailing \\\\'+chr(0x2028)+'control'+chr(1)+'end'}
     edges=[c.edge('fold','out','color')]
     if connected:edges.insert(0,c.edge('source','fold','input1'))
     g={'schemaVersion':1,'target':'top','declarations':[],'functions':[],'topInputs':[],'stages':{'pixel':{'nodes':[source,n,c.node('pixel_out','out')],'edges':edges}}}
     compiled=c.compile_graph(g);compiled.pop('hash')
     rows.append({'case':[ty,mode,operation,count,connected],'graph':g,'compiled':compiled})
print(json.dumps(rows,allow_nan=False))
`;
const rows=JSON.parse(execFileSync(process.env.PYTHON||'python',['-B','-c',python,path.resolve(legacyRoot,'src/core')],{encoding:'utf8',maxBuffer:16*1024*1024,env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}}));
fs.writeFileSync(path.join(folder,'legacy-cases.json'),JSON.stringify(rows,null,2));
const api=vm.createContext({});vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../../src/generated/wire_planning.js'),'utf8'),api);
for(const row of rows){assert.equal(api.GrapeTopCompiler.supports(row.graph),true);assert.deepEqual(JSON.parse(JSON.stringify(api.GrapeTopCompiler.compile(row.graph))),row.compiled,JSON.stringify(row.case));}
const report={passed:true,cases:rows.length,comparison:['GLSL','bindings','sourceMap','ports','diagnostics'],types:['float','vec4'],counts:[2,3,32],modes:['steps','shared'],annotations:'multiline labels, Unicode separators, control bytes, backslash line joins',legacyRoot:path.resolve(legacyRoot),actualTD:false};
fs.writeFileSync(path.join(folder,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
