const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {harness}=require('./test_glsl_code.cjs');
const {sharedGraph}=require('../fixtures/shared_subgraphs.cjs');
const [source,stateFile,folder]=process.argv.slice(2);
(async()=>{
 const h=await harness(source,stateFile,folder,{skipPreview:true}),{page,checks,errors}=h;
 const isolate=()=>page.evaluate(()=>{clearTimeout(autoTimer);scheduleGraphApply=()=>{};readonly=conflicted=historyBusy=nativeMutationBusy=false;connectionInterrupted=true;nativeSourcePolling=uniformPolling=customPolling=true;uniformLive.disconnect();uniformLive.connect=()=>{};});
 try{
  await isolate();
  await page.evaluate(f=>{
   graph.functions=[];graph.declarations=[];graph.topInputs=[];graph.topSourceVersion=1;graph.typeDefinitions=[];
   graph.stages={pixel:{nodes:[testNode('source','float',10,10,{value:.2}),testNode('sink','pixel_out',930,10)],edges:[]}};
   f.scope='library';f.source={id:'test.gain',version:'v1'};
   f.graph.nodes.forEach((n,i)=>n.ui={x:i*270,y:40});window.copySource=f;
   stage='pixel';graphTrail=[];past=[];future=[];selected=null;selection.clear();render();
  },sharedGraph().functions[0]);
  const created=await page.evaluate(()=>{
   const entry=functionEntry(copySource,true),before=JSON.stringify(graph);
   instantiate(entry,100,100,null,{preview:true});const previewClean=JSON.stringify(graph)===before;
   let a,b;const ok=change(()=>{a=instantiate(entry,260,20);b=instantiate(entry,540,350);});
   window.copyCalls=[a.id,b.id];
   return {previewClean,ok,definitions:graph.functions.length,shared:a.params.functionId===b.params.functionId,
    sourceEqual:JSON.stringify(graph.functions[0])===JSON.stringify(copySource)};
  });assert.deepEqual(created,{previewClean:true,ok:true,definitions:1,shared:true,sourceEqual:true});
  checks.push('Creator preview leaves the work untouched; two source placements reuse one complete graph-owned definition');
  await page.evaluate(()=>{
   const [a]=copyCalls;connectPorts({node:'source',kind:'outputs',port:'out'},{node:a,kind:'inputs',port:'value'});
   connectPorts({node:a,kind:'outputs',port:'result'},{node:'sink',kind:'inputs',port:'color'});
   selected=a;selection=new Set([a]);render();scale=.7;pan={x:20,y:20};transform();
  });
  const before=await page.evaluate(()=>JSON.stringify(graph));
  const first=await page.evaluate(()=>copyCalls[0]);
  await page.locator(`[data-node="${first}"] .node-title`).click({button:'right'});
  await page.locator('[data-edit="independent"]').click();
  const independent=await page.evaluate(()=>({graph:clone(graph),ids:copyCalls.map(id=>current().nodes.find(n=>n.id===id).params.functionId)}));
  assert.notEqual(independent.ids[0],independent.ids[1]);assert.equal(independent.graph.functions.length,2);
  assert.deepEqual(independent.graph.functions.find(f=>f.id==='gain'),await page.evaluate(()=>copySource));
  await page.locator('#undo').click();assert.equal(await page.evaluate(()=>JSON.stringify(graph)),before);
  await page.locator('#redo').click();assert.deepEqual(await page.evaluate(()=>clone(graph)),independent.graph);
  checks.push('The real Make Local context-menu action separates one instance, preserving its peer and source; Undo/Redo is exact');
  const edited=await page.evaluate(()=>{
   const [a,b]=copyCalls,first=current().nodes.find(n=>n.id===a),second=current().nodes.find(n=>n.id===b);
   const peer=JSON.stringify(FunctionModel.find(graph,second.params.functionId));enterFunction(first);
   const ok=change(()=>withGraphNetwork(graph,current(),n=>n.node('mul').update({inputValues:{b:4}})));
   const renamed=renameGraphFunction(currentFunction().id,'My Gain'),supported=GrapeTopCompiler.supports(graph);
   const unchanged=JSON.stringify(FunctionModel.find(graph,second.params.functionId))===peer;navigateGraph(0);
   return {ok,renamed,supported,peerUnchanged:unchanged,code:GrapeTopCompiler.compile(graph,typeContract.glslCode).pixel};
  });assert.equal(edited.ok,true);assert.equal(edited.renamed,true);assert.equal(edited.supported,true);assert.equal(edited.peerUnchanged,true);assert.match(edited.code,/4\.0/);
  checks.push('Body edits and model-owned rename affect the independent definition, retain the peer, and compile through the frontend');
  const versions=await page.evaluate(()=>{
   const before=JSON.stringify(FunctionModel.find(graph,'gain')),v2=clone(copySource);v2.source.version='v2';v2.graph.nodes.find(n=>n.id==='mul').inputValues.b=5;
   let added;const ok=change(()=>{added=instantiate(functionEntry(v2,true),600,600);});
   return {ok,newId:added.params.functionId,oldUnchanged:JSON.stringify(FunctionModel.find(graph,'gain'))===before,
    versions:graph.functions.filter(f=>f.scope==='library').map(f=>f.source.version).sort()};
  });assert.equal(versions.ok,true);assert.notEqual(versions.newId,'gain');assert.equal(versions.oldUnchanged,true);assert.deepEqual(versions.versions,['v1','v2']);
  checks.push('A new Library version gets a separate definition without overwriting the existing work');
  const saved=await page.evaluate(()=>clone(graph));let sent;
  page.on('request',r=>{if(r.url().endsWith('/api/apply'))sent=r.postDataJSON();});
  await page.evaluate(async()=>{connectionInterrupted=false;applyNeedsReview=false;await performApplyGraph();});
  assert.ok(sent.frontendArtifact?.compiled.pixel);assert.deepEqual(sent.graph,saved);
  await page.reload();await page.waitForSelector('.node');await isolate();assert.deepEqual(await page.evaluate(()=>clone(graph)),saved);
  assert.deepEqual(errors,[]);checks.push('Frontend artifact delivery and fixture reload retain all independent definitions and source versions');
  fs.writeFileSync(path.join(folder,'authored.graph.json'),JSON.stringify(saved,null,2));await h.finish();console.log(JSON.stringify({passed:true,count:checks.length}));
 }catch(error){await h.finish(error);throw error;}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
