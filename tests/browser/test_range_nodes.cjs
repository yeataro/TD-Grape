const assert=require('node:assert/strict');
const {harness}=require('./test_glsl_code.cjs');
const {rangeCases}=require('../fixtures/range_nodes.cjs');
const [source,stateFile,folder]=process.argv.slice(2);
(async()=>{
 const h=await harness(source,stateFile,folder,{skipPreview:true}),{page,checks,errors,settle}=h;
 const isolate=()=>page.evaluate(()=>{clearTimeout(autoTimer);scheduleGraphApply=()=>{};readonly=conflicted=historyBusy=nativeMutationBusy=false;connectionInterrupted=true;nativeSourcePolling=uniformPolling=customPolling=true;uniformLive.disconnect();uniformLive.connect=()=>{};});
 try{
  await isolate();
  await page.evaluate(()=>{
   stage='pixel';graph.target=editorTarget='top';graphTrail=[];graph.functions=[];graph.declarations=[];graph.topInputs=[];graph.typeDefinitions=[];
   graph.stages={pixel:{nodes:[testNode('low','float',0,0,{value:.2}),testNode('high','vec3',0,300,{value:[.8,.8,.8]}),testNode('output','pixel_out',900,0)],edges:[]}};
   past=[];future=[];selected=null;selection.clear();render();scale=.6;pan={x:10,y:10};transform();
  });
  await page.locator('#canvas').focus();await page.keyboard.press('Tab');await page.locator('#createsearch').fill('Clamp');await page.locator('[data-create-entry="clamp"]').click();await settle();
  const id=await page.evaluate(()=>selected),selector=`[data-node-selector="${id}"]`;
  assert.equal(await page.locator(selector+' option[value="auto"]').count(),0);
  await page.locator(selector).selectOption('vec3');
  const connected=await page.evaluate(id=>{
   const port=(node,kind,port)=>({node,kind,port});
   const lo=connectPorts(port('low','outputs','out'),port(id,'inputs','min'));
   const scalar=clone(ports(current().nodes.find(n=>n.id===id),'inputs'));
   const hi=connectPorts(port('high','outputs','out'),port(id,'inputs','max'));
   const n=current().nodes.find(n=>n.id===id);
   return {lo,hi,scalar,vector:ports(n,'inputs'),output:ports(n,'outputs').out,edges:current().edges.length};
  },id);
  assert.deepEqual(connected,{lo:true,hi:true,scalar:{value:'vec3',min:'float',max:'float'},vector:{value:'vec3',min:'vec3',max:'vec3'},output:'vec3',edges:2});
  checks.push('Actual Creator and manual output selector use the Clamp module; bounds choose complete local tuples without Auto or output changes');
  const before=await page.evaluate(()=>JSON.stringify(graph));
  await page.evaluate(id=>change(()=>withGraphNetwork(graph,current(),n=>n.disconnectAll(n.edges.filter(e=>e.to.node.id===id)))),id);
  assert.deepEqual(await page.evaluate(id=>ports(current().nodes.find(n=>n.id===id),'inputs'),id),{value:'vec3',min:'vec3',max:'vec3'});
  const disconnected=await page.evaluate(()=>JSON.stringify(graph));
  await page.locator('#undo').click();assert.equal(await page.evaluate(()=>JSON.stringify(graph)),before);
  await page.locator('#redo').click();assert.equal(await page.evaluate(()=>JSON.stringify(graph)),disconnected);
  checks.push('Disconnect retains the selected input state; actual Undo/Redo restores the exact graph and edges');
  await page.locator(selector).selectOption('int');
  assert.deepEqual(await page.evaluate(id=>({supported:GrapeTopCompiler.supports(graph),signature:current().nodes.find(n=>n.id===id).params.inputTypes??null}),id),{supported:false,signature:null});
  await page.locator(selector).selectOption('vec4');
  assert.equal(await page.evaluate(()=>GrapeTopCompiler.supports(graph)),true);
  assert.equal(await page.locator(selector+' option[value="auto"]').count(),0);
  checks.push('Manual integer configuration explicitly leaves frontend coverage and clears its signature; returning to vec4 restores frontend support');
  for(const row of rangeCases()){
   const result=await page.evaluate(g=>{
    graph=clone(g);graph.topSourceVersion=1;stage='pixel';graphTrail=[];past=[];future=[];selected=null;selection.clear();render();
    return {supported:GrapeTopCompiler.supports(graph),pixel:GrapeTopCompiler.compile(graph,typeContract.glslCode).pixel};
   },row.graph);assert.equal(result.supported,true);assert.match(result.pixel,new RegExp(row.key+'\\('));
  }
  checks.push('All 28 floating-point Min/Max/Clamp/Smoothstep signatures render and compile inside the real editor');
  const saved=await page.evaluate(()=>clone(graph));let sent;
  page.on('request',r=>{if(r.url().endsWith('/api/apply'))sent=r.postDataJSON();});
  await page.evaluate(async()=>{connectionInterrupted=false;applyNeedsReview=false;await performApplyGraph();});
  assert.ok(sent.frontendArtifact?.compiled.pixel);assert.deepEqual(sent.graph,saved);
  await page.reload();await page.waitForSelector('.node');await isolate();assert.deepEqual(await page.evaluate(()=>clone(graph)),saved);
  checks.push('Normal frontend artifact delivery and fixture reload preserve the selected tuple and complete graph');
  assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,count:checks.length}));
 }catch(error){await h.finish(error);throw error;}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
