const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {harness}=require('./test_glsl_code.cjs');
const [source,stateFile,folder]=process.argv.slice(2);
(async()=>{
 const h=await harness(source,stateFile,folder,{skipPreview:true}),{page,checks,errors}=h;
 page.setDefaultTimeout(6000);
 const isolate=()=>page.evaluate(()=>{clearTimeout(autoTimer);scheduleGraphApply=()=>{};readonly=conflicted=historyBusy=nativeMutationBusy=false;connectionInterrupted=true;nativeSourcePolling=uniformPolling=customPolling=true;uniformLive.disconnect();uniformLive.connect=()=>{};});
 try{
  await isolate();
  await page.evaluate(()=>{
   graph.functions=[];graph.declarations=[];graph.topInputs=[];graph.topSourceVersion=1;graph.typeDefinitions=[];
   graph.stages={pixel:{nodes:[testNode('source','float',10,20,{value:.2}),testNode('input','add',260,20,{type:'vec4'}),testNode('more','multiply',520,20,{type:'vec4'}),testNode('sink','pixel_out',850,20)],edges:[{from:['source','out'],to:['input','a']},{from:['input','out'],to:['more','a']},{from:['more','out'],to:['sink','color']}]}};
   graph.stages.pixel.nodes[1].inputValues={b:[.1,.1,.1,.1]};graph.stages.pixel.nodes[2].inputValues={b:[2,2,2,2]};
   GraphFrames.write(graph.stages.pixel,[{id:'group_frame',name:'Inside',color:'#6688aa',nodes:['input','more']}]);
   stage='pixel';graphTrail=[];past=[];future=[];selected='input';selection=new Set(['input','more']);selectedEdge=null;render();
   window.modelOps={create:0,group:0,remove:0};
   const create=GrapeGraph.GraphDocument.prototype.createSubgraph,group=GrapeGraph.Network.prototype.groupSubgraph,remove=GrapeGraph.Network.prototype.removeAll;
   GrapeGraph.GraphDocument.prototype.createSubgraph=function(...args){modelOps.create++;return create.apply(this,args);};
   GrapeGraph.Network.prototype.groupSubgraph=function(...args){modelOps.group++;return group.apply(this,args);};
   GrapeGraph.Network.prototype.removeAll=function(...args){modelOps.remove++;return remove.apply(this,args);};
  });
  const before=await page.evaluate(()=>JSON.stringify(graph));
  await page.locator('#canvas').focus();await page.keyboard.press('Control+Shift+g');
  const grouped=await page.evaluate(()=>({graph:clone(graph),call:selected,history:past.length,ops:clone(modelOps),frontendSupported:GrapeTopCompiler.supports(graph)}));
  assert.equal(grouped.ops.group,1);assert.equal(grouped.graph.functions.length,1);assert.equal(grouped.history,1);
  const f=grouped.graph.functions[0];assert.equal(f.graph.ui.frames[0].name,'Inside');assert.equal(grouped.graph.stages.pixel.ui?.frames?.length||0,0);
  assert.ok(f.graph.nodes.some(n=>n.id==='input_1'));assert.equal(grouped.frontendSupported,false);
  checks.push('Group shortcut uses the graph model, preserves complete frames and avoids boundary ID collisions; frames retain their existing explicit Python route');
  await page.locator('#undo').click();assert.equal(await page.evaluate(()=>JSON.stringify(graph)),before);
  await page.locator('#redo').click();assert.deepEqual(await page.evaluate(()=>clone(graph)),grouped.graph);
  checks.push('Grouping is one exact Undo/Redo operation');
  await page.evaluate(()=>change(()=>GraphFrames.write(graph.functions[0].graph,[])));
  await page.evaluate(()=>{selected=current().nodes.find(n=>n.definitionUuid===FunctionModel.CALL).id;selection=new Set([selected]);enterFunction(current().nodes.find(n=>n.id===selected));});
  const nested=await page.evaluate(()=>{
   selected='input';selection=new Set(['input']);groupSelection();
   const result={functions:graph.functions.length,ops:clone(modelOps),code:GrapeTopCompiler.compile(graph,typeContract.glslCode).pixel};navigateGraph(0);return result;
  });assert.equal(nested.functions,2);assert.equal(nested.ops.group,2);assert.ok(nested.code.includes('void main'));
  checks.push('Grouping inside an existing child creates a scoped nested definition and remains compilable');
  await page.locator('#undo').click();assert.equal(await page.evaluate(()=>graph.functions.length),1);
  await page.evaluate(()=>{const call=current().nodes.find(n=>n.definitionUuid===FunctionModel.CALL);change(()=>{const peer=withGraphNetwork(graph,current(),n=>n.instantiateSubgraph(call.params.functionId,'peer',{x:250,y:380}).data);assignCreatedNodeNames([peer]);});selected=call.id;selection=new Set([call.id]);render();});
  await page.locator('#graphdelete').click();assert.equal(await page.evaluate(()=>graph.functions.length),1);
  await page.evaluate(()=>{selected='peer';selection=new Set(['peer']);render();});
  await page.locator('#graphdelete').click();assert.equal(await page.evaluate(()=>graph.functions.length),0);
  await page.locator('#undo').click();assert.equal(await page.evaluate(()=>graph.functions.length),1);
  checks.push('Deleting shared and final instances through the real action preserves or collects the definition appropriately, with Undo');
  await page.evaluate(()=>{newFunction();});
  assert.equal(await page.evaluate(()=>modelOps.create),1);
  const count=await page.evaluate(()=>graph.functions.length);
  await page.locator('#canvas').focus();await page.keyboard.press('Delete');assert.equal(await page.evaluate(()=>graph.functions.length),count-1);
  await page.locator('#undo').click();assert.equal(await page.evaluate(()=>graph.functions.length),count);
  checks.push('New Subgraph and keyboard deletion use model operations and restore the full definition');
  const library=await page.evaluate(()=>{
   const f=graph.functions.find(f=>f.graph.nodes.some(n=>n.id==='more'));
   f.scope='library';f.source={id:f.id,version:'fixture-v1'};
   const sourceId=f.id,original=JSON.stringify(f);enterFunction(current().nodes.find(n=>n.params.functionId===sourceId));
   selected='input';selection=new Set(['input','more']);groupSelection();
   window.libraryDiff={before:JSON.parse(original),after:clone(FunctionModel.find(graph,sourceId))};
   const local=currentFunction(),result={sourcePreserved:JSON.stringify(FunctionModel.find(graph,sourceId))===original,
    local:local.scope,extracted:local.graph.nodes.some(n=>n.definitionUuid===FunctionModel.CALL),supported:GrapeTopCompiler.supports(graph)};
   navigateGraph(0);return result;
  });if(!library.sourcePreserved)fs.writeFileSync(path.join(folder,'library-diff.json'),JSON.stringify(await page.evaluate(()=>libraryDiff),null,2));
  assert.deepEqual(library,{sourcePreserved:true,local:'local',extracted:true,supported:true});
  checks.push('Grouping a Library body resolves its new writable local scope and preserves the stored source snapshot');
  const authored=await page.evaluate(()=>clone(graph));
  fs.writeFileSync(path.join(folder,'authored.graph.json'),JSON.stringify(authored));
  let sent;page.on('request',r=>{if(r.url().endsWith('/api/apply'))sent=r.postDataJSON();});
  await page.evaluate(async()=>{connectionInterrupted=false;applyNeedsReview=false;await performApplyGraph();});
  assert.ok(sent.frontendArtifact?.compiled.pixel);assert.deepEqual(sent.graph,authored);
  await page.reload();await page.waitForSelector('.node');await isolate();assert.deepEqual(await page.evaluate(()=>clone(graph)),authored);
  checks.push('The authored result is sent as a frontend artifact and the fixture save/reload preserves all definitions');
  assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,count:checks.length}));
 }catch(error){await h.finish(error);throw error;}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
