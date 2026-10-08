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
// Legacy cases are old-format graphs; convert them with the tool that converts real old graphs (Q44).
// 舊產碼器產出舊格式的圖，用轉換真實舊圖的同一支工具轉成新格式。
const {convertOldGraph}=require('../../tools/dev/old_graph.cjs');
for(const row of rows)row.graph=convertOldGraph(row.graph).graph;
fs.writeFileSync(path.join(folder,'legacy-cases.json'),JSON.stringify(rows,null,2));
const api=vm.createContext({});vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../../src/generated/grape_core.js'),'utf8'),api);
// Comment layout differs from Legacy by decision (human 2026-10-08: keep the current style, where a
// node's notes go on their own lines). Compare the code and its source map with comments removed,
// and separately require every comment to stay a harmless one-line comment.
// 註解排版與舊產品不同是人類決定保留的；比對時去掉註解再比程式與 source map，另外檢查註解不會漏成程式。
function withoutComments(compiled){
  const result=JSON.parse(JSON.stringify(compiled));
  for(const stage of ['vertex','pixel']){
    const kept=[],lineMap=new Map();
    (result[stage]||'').split('\n').forEach((line,i)=>{
      const code=line.replace(/\s*\/\/.*$/,'');
      if(code.trim()===''&&line.trim()!=='')return;
      lineMap.set(i+1,kept.length+1);kept.push(code);
    });
    result[stage]=kept.join('\n');
    if(result.sourceMap&&result.sourceMap[stage])
      result.sourceMap[stage]=result.sourceMap[stage].filter(e=>lineMap.has(e.line)).map(e=>({...e,line:lineMap.get(e.line)}));
  }
  // Per-stage line lists quote the generated code; strip their comments the same way.
  const strip=lines=>lines.map(l=>[l,l.replace(/\s*\/\/.*$/,'')]).filter(([l,c])=>c.trim()!==''||l.trim()==='').map(([,c])=>c);
  const walk=v=>{if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')for(const k of Object.keys(v)){
    if(k==='lines'&&Array.isArray(v[k])&&v[k].every(x=>typeof x==='string'))v[k]=strip(v[k]);else walk(v[k]);}};
  walk(result);
  return result;
}
function assertHarmlessComments(compiled,label){
  for(const stage of ['vertex','pixel'])for(const line of (compiled[stage]||'').split('\n')){
    assert.ok(!/[\u0000-\u0008\u000b-\u001f\u007f\u2028\u2029]/.test(line),label+' control character in '+stage);
    assert.ok(!/\\s*$/.test(line),label+' line continuation in '+stage);
  }
}
for(const row of rows){
  assert.equal(api.GrapeTopCompiler.supports(row.graph),true);
  const compiled=JSON.parse(JSON.stringify(api.GrapeTopCompiler.compile(row.graph)));
  assertHarmlessComments(compiled,JSON.stringify(row.case));
  assert.deepEqual(withoutComments(compiled),withoutComments(row.compiled),JSON.stringify(row.case));
}
const report={passed:true,cases:rows.length,comparison:['GLSL without comments','bindings','sourceMap without comment lines','ports','diagnostics'],commentLayout:'current style kept by human decision 2026-10-08; comments checked to stay one-line and inert',types:['float','vec4'],counts:[2,3,32],modes:['steps','shared'],annotations:'multiline labels, Unicode separators, control bytes, backslash line joins',legacyRoot:path.resolve(legacyRoot),actualTD:false};
fs.writeFileSync(path.join(folder,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
