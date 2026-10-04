const assert=require('node:assert/strict'),{harness}=require('./test_glsl_code.cjs');
(async()=>{
 const [source,state,folder]=process.argv.slice(2),h=await harness(source,state,folder,{skipPreview:true}),{page,checks,errors}=h;
 const stopBackground=()=>page.evaluate(()=>{clearTimeout(autoTimer);scheduleGraphApply=()=>{};readonly=conflicted=historyBusy=nativeMutationBusy=false;connectionInterrupted=true;nativeSourcePolling=uniformPolling=customPolling=true;uniformLive.disconnect();uniformLive.connect=()=>{};});
 try{
  await stopBackground();
  const seed=await page.evaluate(()=>{
   const f=graph.functions.find(f=>f.id==='library_mapping_v1');
   if(!f)throw Error('Provide the captured Mapping deletion fixture');
   const n=instantiate(functionEntry(f),300,200);render();
   return {nodeId:n.id,graph:clone(graph),history:past.length};
  });
  await page.locator('#graphdelete').click();
  assert.equal(await page.evaluate(()=>graph.functions.some(f=>f.id==='library_mapping_v1')),false);
  assert.equal(await page.evaluate(()=>past.length),seed.history+1);
  assert.equal(await page.evaluate(()=>frontendCompilation(graph)),true);
  checks.push('Real Delete action removes the final Mapping instance and definition in one history entry; frontend route becomes eligible');
  await page.locator('#undo').click();await page.waitForFunction(id=>current().nodes.some(n=>n.id===id),seed.nodeId);
  assert.deepEqual(await page.evaluate(()=>clone(graph)),seed.graph);
  await page.locator('#redo').click();await page.waitForFunction(()=>!graph.functions.some(f=>f.id==='library_mapping_v1'));
  checks.push('Undo restores the exact node, definition, links and values; Redo removes them together');
  let applied=null;
  page.on('request',request=>{if(request.url().endsWith('/api/apply'))applied=request.postDataJSON();});
  await page.evaluate(async()=>{connectionInterrupted=false;applyNeedsReview=false;await performApplyGraph();});
  assert.deepEqual(applied.graph.functions,[]);assert.equal(typeof applied.frontendArtifact?.compiled.pixel,'string');
  await page.reload();await page.waitForSelector('.node');await stopBackground();
  assert.deepEqual(await page.evaluate(()=>graph.functions),[]);assert.equal(await page.evaluate(()=>frontendCompilation(graph)),true);
  checks.push('Apply sends the cleaned graph with a real frontend GLSL artifact; reopening saved state does not restore the deleted definition');
  const created=await page.evaluate(()=>{newFunction();return {id:selected,functionId:current().nodes.find(n=>n.id===selected).params.functionId};});
  await page.locator('#canvas').focus();await page.keyboard.press('Delete');
  assert.equal(await page.evaluate(id=>!!FunctionModel.find(graph,id),created.functionId),false);
  checks.push('Keyboard Delete uses the same cleanup for a newly created local subgraph');
  const trash=await page.evaluate(()=>{newFunction();const n=current().nodes.find(n=>n.id===selected);EDITOR_DEV_SETTINGS.canvasTrash=true;return {functionId:n.params.functionId,removed:commitGraphTrash({allowed:true,owner:graph,data:current(),stage,ids:[n.id],edges:[]})};});
  assert.equal(trash.removed,true);assert.equal(await page.evaluate(id=>!!FunctionModel.find(graph,id),trash.functionId),false);
  await page.locator('#undo').click();await page.waitForFunction(id=>!!FunctionModel.find(graph,id),trash.functionId);
  checks.push('Canvas trash shares cleanup and remains undoable');
  assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,count:checks.length}));
 }catch(error){await h.finish(error);throw error;}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
