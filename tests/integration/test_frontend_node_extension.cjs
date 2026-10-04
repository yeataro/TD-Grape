/* Author one ordinary node in an isolated source copy; verify every projection.
 * node tests/integration/test_frontend_node_extension.cjs ABSOLUTE_EVIDENCE_DIR
 * Never adds the probe to the product or edits the checkout under test.
 */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'../..'),output=path.resolve(process.argv[2]);
fs.mkdirSync(output,{recursive:true});const scratch=fs.mkdtempSync(path.join(output,'checkout-'));
for(const dir of ['src/core','src/core-ts','src/library'])fs.cpSync(path.join(root,dir),path.join(scratch,dir),{recursive:true});
for(const file of ['tsconfig.json','tools/build_core.cjs','src/editor/index.html','src/editor/graph_ui.js']){const target=path.join(scratch,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(root,file),target);}
const file=path.join(scratch,'src/core-ts/nodes/abs_probe.ts');
const absFile=path.join(scratch,'src/core-ts/nodes/abs.ts'),text=fs.readFileSync(absFile,'utf8');
const entry="import {unaryNode} from '../node_sdk';\nexport default unaryNode({key:'abs_probe',operator:'abs',port:'incoming',label:'Absolute probe',descriptionKey:'help.abs',browser:{category:'math',source:'glsl',aliases:['single-entry-probe'],glslName:'abs',secondaryCategories:[],categoryPath:['math','arithmetic']}});\n";
fs.writeFileSync(file,entry);
function build(){execFileSync(process.execPath,[path.join(scratch,'tools/build_core.cjs')],{cwd:scratch,env:{...process.env,NODE_PATH:path.join(root,'node_modules')},stdio:'pipe'});}
build();
const python=`import json,sys
sys.path.insert(0,'src/core')
import sgrape_core as c
g=c.normalize_top_sources(c.demo_graph('color','top'))[0]
g['declarations']=[];g['functions']=[];g['topInputs']=[]
g['stages']['pixel']={'nodes':[c.node('float','source',value=-.25),c.node('abs_probe','probe',type='float'),c.node('pixel_out','out')],'edges':[c.edge('source','probe','incoming'),c.edge('probe','out','color')]}
result=c.compile_graph(g);result.pop('hash')
print(json.dumps({'graph':g,'compiled':result,'contract':c.type_contract(),'definition':c.CATALOG['abs_probe'],'catalogHash':c.catalog_contract()['hash']}))
`;
function runPython(code){return JSON.parse(execFileSync(process.env.PYTHON||'python',['-c',code],{cwd:scratch,encoding:'utf8',env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}}));}
const oracle=runPython(python);
const context=vm.createContext({});vm.runInContext(fs.readFileSync(path.join(scratch,'src/editor/wire_planning.js'),'utf8'),context);
assert.equal(context.GrapeTopCompiler.supports(oracle.graph),true);
assert.deepEqual(JSON.parse(JSON.stringify(context.GrapeTopCompiler.compile(oracle.graph,oracle.contract.glslCode))),oracle.compiled);
assert.ok(oracle.contract.definitions['sgrape.builtin.abs_probe'].variants.some(v=>v.type==='vec4'&&v.inputs.incoming==='vec4'));
const html=fs.readFileSync(path.join(scratch,'src/editor/index.html'),'utf8'),metadata=JSON.parse(html.match(/<script id="node-browser-data" type="application\/json">(.*?)<\/script>/s)[1]);
const ui=vm.createContext({assert,payload:{metadata,definition:oracle.definition,contract:oracle.contract},t:key=>key,FunctionModel:{CALL:'sgrape.function.call'},document:{getElementById:()=>({textContent:JSON.stringify(metadata)})}});
vm.runInContext(fs.readFileSync(path.join(scratch,'src/editor/graph_ui.js'),'utf8'),ui);
vm.runInContext(`setTypeContract(payload.contract);const entry={d:payload.definition,meta:browserMeta(payload.definition)};assert.equal(browseEntries([entry],'single-entry-probe',{source:'all'}).length,1);assert.equal(creatorMeta(entry.d).category,'math');assert.ok(selectableNodeTypes(entry.d).includes('vec4'));`,ui);
const capabilities=JSON.parse(fs.readFileSync(path.join(scratch,'src/core/frontend_capabilities.json'),'utf8'));
assert.ok(capabilities.definitions.includes('sgrape.builtin.abs_probe'));
// Editing an existing owned primitive must update both emitters and the saved
// artifact contract, even when its ports and presentation are unchanged.
const absPython=python.replaceAll('abs_probe','abs').replaceAll('incoming','value');
const before=runPython(absPython);
fs.writeFileSync(absFile,text.replace("operator:'abs'","operator:'floor'"));build();
const after=runPython(absPython),changed=vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(scratch,'src/editor/wire_planning.js'),'utf8'),changed);
assert.notEqual(after.catalogHash,before.catalogHash);
assert.match(after.compiled.pixel,/floor\(/);
assert.deepEqual(JSON.parse(JSON.stringify(changed.GrapeTopCompiler.compile(after.graph,after.contract.glslCode))),after.compiled);
fs.writeFileSync(absFile,text);fs.unlinkSync(file);build();runPython(absPython);
const removedCatalog=JSON.parse(fs.readFileSync(path.join(scratch,'src/library/node_catalog.json'),'utf8'));
assert.equal(removedCatalog.definitions.some(row=>row.definition.key==='abs_probe'),false);
assert.equal(JSON.parse(fs.readFileSync(path.join(scratch,'src/core/frontend_capabilities.json'),'utf8')).definitions.includes('sgrape.builtin.abs_probe'),false);
for(const invalid of [entry.replace("operator:'abs',",''),entry.replace("port:'incoming',",''),entry.replace("operator:'abs'","operator:'"+'x'.repeat(65)+"'"),entry.replace("port:'incoming'","port:'"+'x'.repeat(65)+"'")]){
  fs.writeFileSync(file,invalid);assert.throws(build);
}
fs.unlinkSync(file);build();
// A different family, port name and authored default must also be one-file
// extensions; no hidden legacy "factor = .5" convention may supply the result.
const callFile=path.join(scratch,'src/core-ts/nodes/mix_probe.ts');
const callText=fs.readFileSync(path.join(scratch,'src/core-ts/nodes/mix.ts'),'utf8').replace('"key": "mix"','"key": "mix_probe"').replace('"id": "mix"','"id": "mix_probe"').replace('sgrape.builtin.mix','sgrape.builtin.mix_probe').replaceAll('factor','weight').replace('0.5','0.25');
const callPython=python.replace("c.node('abs_probe','probe',type='float')","c.node('mix_probe','probe',type='float')").replace("c.edge('source','probe','incoming')","c.edge('source','probe','a')").replace("c.CATALOG['abs_probe']","c.CATALOG['mix_probe']");
function verifyCall(){const result=runPython(callPython),scope=vm.createContext({});vm.runInContext(fs.readFileSync(path.join(scratch,'src/editor/wire_planning.js'),'utf8'),scope);assert.deepEqual(JSON.parse(JSON.stringify(scope.GrapeTopCompiler.compile(result.graph,result.contract.glslCode))),result.compiled);return result;}
fs.writeFileSync(callFile,callText);build();const firstCall=verifyCall();assert.match(firstCall.compiled.pixel,/mix\(sg_n_source, 0\.0, 0\.25\)/);
fs.writeFileSync(callFile,callText.replace('0.25','0.75'));build();const nextCall=verifyCall();assert.match(nextCall.compiled.pixel,/mix\(sg_n_source, 0\.0, 0\.75\)/);assert.notEqual(firstCall.catalogHash,nextCall.catalogHash);
fs.unlinkSync(callFile);build();runPython(absPython);
const report={ok:true,authoredFiles:['src/core-ts/nodes/abs_probe.ts','src/core-ts/nodes/mix_probe.ts'],probe:'two independent one-file extensions',generated:['catalog definition and fingerprint','browser search/creator metadata','type contract','frontend emitter','receiver capability list','legacy fallback primitive and input defaults'],lifecycle:['existing primitive edits affect both emitters and catalog contract','removed projection disappears and Python still loads','missing/overlong operator or port rejected','numeric call with new port and default edits updates both emitters from one module'],scratch};
fs.writeFileSync(path.join(output,'result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
