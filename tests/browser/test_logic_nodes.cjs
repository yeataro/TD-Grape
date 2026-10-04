const assert=require('node:assert/strict');
const {harness}=require('./test_glsl_code.cjs');
const {logicCases}=require('../fixtures/logic_nodes.cjs');
const [source,stateFile,folder]=process.argv.slice(2);
(async()=>{
 const h=await harness(source,stateFile,folder,{skipPreview:true}),{page,checks,errors}=h;
 const isolate=()=>page.evaluate(()=>{clearTimeout(autoTimer);scheduleGraphApply=()=>{};readonly=conflicted=historyBusy=nativeMutationBusy=false;connectionInterrupted=true;nativeSourcePolling=uniformPolling=customPolling=true;uniformLive.disconnect();uniformLive.connect=()=>{};});
 try{
  await isolate();
  await page.evaluate(g=>{graph=clone(g);graph.topSourceVersion=1;stage='pixel';graphTrail=[];past=[];future=[];selected='operation';selection=new Set([selected]);graph.stages.pixel.nodes.forEach((n,i)=>n.ui={x:i*270,y:30});render();scale=.7;pan={x:10,y:10};transform();},logicCases()[0].graph);
  const before=await page.evaluate(()=>JSON.stringify(graph));
  await page.locator('[data-node="operation"] [data-node-control="operator"]').selectOption('<');
  assert.equal(await page.evaluate(()=>current().nodes.find(n=>n.id==='operation').params.operator),'<');
  await page.locator('#undo').click();assert.equal(await page.evaluate(()=>JSON.stringify(graph)),before);await page.locator('#redo').click();
  assert.match(await page.evaluate(()=>GrapeTopCompiler.compile(graph,typeContract.glslCode).pixel),/ < /);
  checks.push('The existing Compare card exposes a module-owned operator control with exact Undo/Redo');
  await page.locator('[data-node-selector="operation"]').selectOption('uint');
  assert.equal(await page.locator('[data-node-selector="operation"] option[value="auto"]').count(),0);
  assert.equal(await page.evaluate(()=>ports(current().nodes.find(n=>n.id==='operation'),'outputs').out),'bool');
  checks.push('Manual Compare input-family selection retains its bool output and has no Auto state');
  await page.evaluate(g=>{graph=clone(g);graph.topSourceVersion=1;selected='operation';selection=new Set([selected]);past=[];future=[];render();},logicCases().find(r=>r.key==='isnan'&&r.type==='vec3').graph);
  assert.equal(await page.locator('[data-node-selector="operation"]').inputValue(),'bvec3');
  assert.match(await page.locator('#nodehelp').textContent(),/value: vec3 → out: bvec3/);
  await page.locator('[data-node-selector="operation"]').selectOption('bvec4');
  assert.equal(await page.evaluate(()=>ports(current().nodes.find(n=>n.id==='operation'),'inputs').value),'vec4');
  assert.match(await page.locator('#nodehelp').textContent(),/value: vec4 → out: bvec4/);
  checks.push('isnan displays its actual boolean output choice and live Help signature; an explicit choice reshapes its input');
  await page.evaluate(g=>{graph=clone(g);graph.topSourceVersion=1;selected='source';selection=new Set([selected]);past=[];future=[];render();},logicCases().find(r=>r.key==='any').graph);
  await page.locator('[data-node="source"] [data-inline-port="$value"]').selectOption('false');
  assert.equal(await page.evaluate(()=>current().nodes.find(n=>n.id==='source').params.value),false);
  const saved=await page.evaluate(()=>clone(graph));let sent;page.on('request',r=>{if(r.url().endsWith('/api/apply'))sent=r.postDataJSON();});
  await page.evaluate(async()=>{connectionInterrupted=false;applyNeedsReview=false;await performApplyGraph();});
  assert.ok(sent.frontendArtifact?.compiled.pixel);assert.deepEqual(sent.graph,saved);
  await page.reload();await page.waitForSelector('.node');await isolate();assert.deepEqual(await page.evaluate(()=>clone(graph)),saved);
  checks.push('Actual boolean editing submits a frontend artifact and reloads without changing its saved type or value');
  assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,count:checks.length}));
 }catch(error){await h.finish(error);throw error;}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
