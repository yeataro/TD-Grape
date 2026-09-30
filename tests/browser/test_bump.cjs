/* Bump remains an ordinary editable library Subgraph. */
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),{execFileSync}=require('node:child_process');
const {harness}=require('./test_glsl_code.cjs');
(async()=>{
 const[source,state,folder]=process.argv.slice(2),h=await harness(source,state,folder,{skipPreview:true}),{page,checks,errors,settle}=h;
 try{
  const availability=await page.evaluate(()=>{
   clearTimeout(autoTimer);scheduleGraphApply=()=>{};nativeSourcePolling=uniformPolling=customPolling=true;uniformLive.disconnect();uniformLive.connect=()=>{};
   readonly=historyBusy=nativeMutationBusy=false;connectionInterrupted=true;graphTrail=[];graph.functions=[];graph.declarations=[];past=[];future=[];
   graph.target='mat';graph.stages.pixel={nodes:[testNode('pixel','pixel_out',800,100,{dither:false,alphaTest:false,convertColorSpace:false})],edges:[]};
   return ['mat','top'].flatMap(target=>['pixel','vertex'].map(s=>{editorTarget=target;stage=s;return [target,s,availableEntries().some(d=>d.label==='Bump')];}));
  });
  for(const [target,stage,found]of availability)assert.equal(found,target==='mat'&&stage==='pixel');
  const id=await page.evaluate(()=>{
   editorTarget='mat';stage='pixel';setUIExperiments({canvasDamping:false,frameDamping:false});render();
   const d=availableEntries().find(d=>d.label==='Bump');change(()=>instantiate(d,150,80));render();scale=1;pan={x:70,y:35};transform();
   return current().nodes.find(n=>n.params.functionId).id;
  });
  assert.deepEqual(await page.evaluate(id=>ports(current().nodes.find(n=>n.id===id),'inputs'),id),{position:'vec3',normal:'vec3',height:'float',strength:'float',distance:'float'});
  assert.deepEqual(await page.evaluate(id=>ports(current().nodes.find(n=>n.id===id),'outputs'),id),{normal:'vec3'});
  assert.equal(await page.evaluate(()=>browserMeta(availableEntries().find(d=>d.label==='Bump')).category),'texture');
  checks.push('Bump appears in Texture for MAT Pixel with explicit geometry, height and controls');
  await page.locator(`.node[data-node="${id}"] .node-title`).click();
  const languages=await page.locator('#language option').evaluateAll(es=>es.map(e=>e.value));assert.equal(languages.length,5);
  for(const language of languages){await page.selectOption('#language',language);assert.ok((await page.locator('#nodehelp').innerText()).includes('Position'));assert.ok((await page.locator('#nodehelp').innerText()).includes('Strength'));}
  await page.selectOption('#language','en');
  assert.match(await page.locator('#nodehelp').innerText(),/not automatic geometry/);
  await page.screenshot({path:path.join(folder,'bump-node.png')});
  checks.push('Five languages explain explicit Position/Normal, controls and derivative limits');
  await page.locator(`.node[data-node="${id}"] .node-title`).dblclick();await settle();
  const contents=await page.evaluate(()=>({scope:currentFunction().scope,nodes:current().nodes.map(n=>n.definitionUuid)}));
  assert.equal(contents.scope,'library');assert.ok(contents.nodes.includes('sgrape.builtin.dFdx'));assert.ok(contents.nodes.includes('sgrape.builtin.dFdy'));
  assert.ok(!contents.nodes.includes('sgrape.builtin.glsl_code'));assert.ok(!contents.nodes.includes('sgrape.builtin.texture_sample'));
  await page.evaluate(()=>change(()=>current().nodes.find(n=>n.id==='relative_tolerance').inputValues.b=2e-6));
  assert.equal(await page.evaluate(()=>currentFunction().scope),'local');
  assert.equal(await page.evaluate(()=>functionLibrary.find(f=>f.name==='Bump').graph.nodes.find(n=>n.id==='relative_tolerance').inputValues.b),1e-6);
  await page.evaluate(()=>undo());await settle();
  assert.equal(await page.evaluate(id=>FunctionModel.find(graph,graph.stages.pixel.nodes.find(n=>n.id===id).params.functionId).graph.nodes.find(n=>n.id==='relative_tolerance').inputValues.b,id),1e-6);
  checks.push('Opening exposes ordinary nodes; editing localizes and Undo restores without changing the built-in');
  await page.evaluate(id=>{
   navigateGraph(0);change(()=>{
    current().nodes.push(testNode('compose','rgba',480,80));
    current().edges.push({from:[id,'normal'],to:['compose','rgb']},{from:['compose','out'],to:['pixel','color']});
   });render();
  },id);
  const graph=await page.evaluate(()=>clone(graph));fs.writeFileSync(path.join(folder,'created.graph.json'),JSON.stringify(graph));
  execFileSync(process.env.PYTHON_EXECUTABLE||'python',['-B','-c',
   'import json,sys;sys.path.insert(0,sys.argv[1]);import sgrape_core as c;c.compile_graph(json.load(sys.stdin))',path.resolve(__dirname,'../../src/core')],{input:JSON.stringify(graph)});
  checks.push('Editor-created, wired and serialized graph compiles through the real core');
  assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,count:checks.length}));
 }catch(e){await h.finish(e);throw e;}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
