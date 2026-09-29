/* Built-in material helpers use ordinary import, editing and Undo paths. */
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),{execFileSync}=require('node:child_process');
const {harness}=require('./test_glsl_code.cjs');
(async()=>{
 const[source,fixture,folder]=process.argv.slice(2),h=await harness(source,fixture,folder,{skipPreview:true}),{page,settle,checks,errors}=h;
 try{
  await page.selectOption('#language','en');
  const visible=await page.evaluate(()=>{
   clearTimeout(autoTimer);scheduleGraphApply=()=>{};connectionInterrupted=true;readonly=historyBusy=nativeMutationBusy=false;
   graphTrail=[];graph.functions=[];graph.declarations=[];past=[];future=[];
   graph.stages={vertex:{nodes:[],edges:[]},pixel:{nodes:[],edges:[]}};graph.target=editorTarget='mat';stage='pixel';
   return ['mat','top'].flatMap(target=>['pixel','vertex'].map(st=>{editorTarget=target;stage=st;return {target,stage:st,names:availableEntries().filter(d=>d.source).map(d=>d.label)};}));
  });
  for(const row of visible){assert.ok(row.names.includes('Color Multiply'));assert.equal(row.names.includes('Normal Map'),row.target==='mat'&&row.stage==='pixel');}
  checks.push('Normal Map is offered only in MAT Pixel; Color Multiply remains available across stages');
  const ids=await page.evaluate(()=>{
   editorTarget='mat';stage='pixel';setUIExperiments({canvasDamping:false,frameDamping:false});render();
   for(const [i,name] of ['Color Multiply','Normal Map'].entries())change(()=>instantiate(availableEntries().find(d=>d.label===name),80+i*370,120));
   render();scale=1;pan={x:80,y:30};transform();
   return current().nodes.map(n=>({id:n.id,name:FunctionModel.find(graph,n.params.functionId).name}));
  });await settle();
  for(const {id,name} of ids){
   const labels=await page.evaluate(id=>{const n=current().nodes.find(n=>n.id===id);return Object.keys(definition(n).outputs).map(p=>portLabel(n,'outputs',p));},id);
   assert.deepEqual(labels,name==='Color Multiply'?['RGBA','RGB','A']:['Normal']);
   assert.equal(await page.locator(`.node[data-node="${id}"] .port[data-kind="outputs"]`).count(),labels.length);
  }
  checks.push('Built-in import displays RGBA/RGB/A and Normal sockets with their public labels');
  await page.screenshot({path:path.join(folder,'material-subgraphs.png')});
  const normal=ids.find(n=>n.name==='Normal Map');
  await page.locator(`.node[data-node="${normal.id}"] .node-title`).dblclick();await settle();
  const inner=await page.evaluate(()=>({scope:currentFunction().scope,nodes:current().nodes.map(n=>n.definitionUuid)}));
  assert.equal(inner.scope,'library');assert.equal(inner.nodes.length,12);
  assert.ok(inner.nodes.includes('sgrape.builtin.td_front_facing'));assert.ok(!inner.nodes.includes('sgrape.builtin.texture_sample'));
  await page.evaluate(()=>{change(()=>current().nodes.find(n=>n.id==='decode').inputValues.b=[3,3,3]);});await settle();
  assert.equal(await page.evaluate(()=>currentFunction().scope),'local');
  assert.equal(await page.evaluate(()=>functionLibrary.find(f=>f.name==='Normal Map').graph.nodes.find(n=>n.id==='decode').inputValues.b[0]),2);
  await page.evaluate(()=>undo());await settle();assert.equal(await page.evaluate(id=>FunctionModel.find(graph,graph.stages.pixel.nodes.find(n=>n.id===id).params.functionId).graph.nodes.find(n=>n.id==='decode').inputValues.b[0],normal.id),2);
  checks.push('Double-click opens regular nodes without texture sampling; editing localizes, preserves the source, and supports Undo');
  await page.evaluate(()=>{navigateGraph(0);selected=null;selection.clear();render();});await settle();
  const graph=await page.evaluate(()=>clone(graph));
  fs.writeFileSync(path.join(folder,'created.graph.json'),JSON.stringify(graph));
  // Add a root to the ordinary editor-created graph for portable compilation.
  execFileSync(process.env.PYTHON_EXECUTABLE||'python',['-B','-c',
   'import json,sys;sys.path.insert(0,sys.argv[1]);import sgrape_core as c;g=json.load(sys.stdin);base=c.demo_graph("color","mat");base["functions"]=g["functions"];base["stages"]["pixel"]["nodes"]+=g["stages"]["pixel"]["nodes"];c.compile_graph(base)',
   path.resolve(__dirname,'../../src/core')],{input:JSON.stringify(graph)});
  checks.push('The editor-created snapshots serialize and compile without source-library references');
  assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,checks}));
 }catch(error){await h.finish(error);throw error;}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
