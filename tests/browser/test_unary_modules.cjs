/* Real editor creation and persistence for the migrated unary family. */
const assert=require('node:assert/strict');
const {harness}=require('./test_glsl_code.cjs');
const [source,stateFile,folder]=process.argv.slice(2);
const keys=['sin','cos','fract','sign','sqrt','floor','round','ceil','trunc'];
(async()=>{
 const h=await harness(source,stateFile,folder,{skipPreview:true}),{page,checks,errors,settle}=h;
 page.setDefaultTimeout(6000);
 try{
  await page.evaluate(()=>{
   clearTimeout(autoTimer);scheduleGraphApply=()=>{};readonly=false;historyBusy=nativeMutationBusy=false;connectionInterrupted=true;
   stage='pixel';graph.target='top';editorTarget='top';graphTrail=[];graph.functions=[];graph.declarations=[];graph.topInputs=[];
   graph.stages={pixel:{nodes:[testNode('source','color',20,20,{value:[.25,.5,.75,1]}),testNode('output','pixel_out',720,20)],edges:[]}};
   past=[];future=[];selected=null;selection.clear();render();scale=.65;pan={x:10,y:10};transform();
   window.unaryModuleTest={inserts:0,updates:0,removes:0,disconnects:0,transactionMisses:0};
   for(const [method,counter]of [['insert','inserts'],['removeAll','removes'],['disconnectAll','disconnects']]){
    const original=GrapeGraph.Network.prototype[method];GrapeGraph.Network.prototype[method]=function(...args){unaryModuleTest[counter]++;if(this.graph!==editorGraphModel)unaryModuleTest.transactionMisses++;return original.apply(this,args);};
   }
   const update=GrapeGraph.Node.prototype.update;GrapeGraph.Node.prototype.update=function(...args){unaryModuleTest.updates++;if(this.network.graph!==editorGraphModel)unaryModuleTest.transactionMisses++;return update.apply(this,args);};
   const normalize=normalizeNodeValues;normalizeNodeValues=(n,d)=>{if(frontendNodeModule(graph,n))throw Error('Module creation reached legacy normalization');return normalize(n,d);};
   reshapeLegacyTypedInputs=()=>{throw Error('Module reached legacy type reshaping');};
  });
  for(const key of keys){
   const before=await page.evaluate(()=>JSON.stringify(graph));
   await page.locator('#canvas').focus();await page.keyboard.press('Tab');
   await page.locator('#createsearch').fill(key);
   await page.locator(`[data-create-entry="${key}"]`).click();await settle();
   const id=await page.evaluate(()=>selected);
   assert.equal(await page.evaluate(id=>definition(current().nodes.find(n=>n.id===id)).key,id),key);
   await page.locator('#undo').click();assert.equal(await page.evaluate(()=>JSON.stringify(graph)),before);
   await page.locator('#redo').click();
   await page.locator(`[data-node-selector="${id}"]`).selectOption('vec4');await settle();
   const result=await page.evaluate(id=>{
    const n=current().nodes.find(n=>n.id===id);
    const manual=change(()=>setNodeInputValue(n,'value',[.1,.2,.3,.4]));
    const inWire=connectPorts({node:'source',kind:'outputs',port:'out'},{node:id,kind:'inputs',port:'value'});
    const outWire=connectPorts({node:id,kind:'outputs',port:'out'},{node:'output',kind:'inputs',port:'color'});
    return {manual,inWire,outWire,input:ports(n,'inputs'),output:ports(n,'outputs'),supported:GrapeTopCompiler.supports(graph),pixel:GrapeTopCompiler.compile(graph,typeContract.glslCode).pixel};
   },id);
   assert.equal(result.manual,true);assert.equal(result.inWire,true);assert.equal(result.outWire,true);
   assert.deepEqual(result.input,{value:'vec4'});assert.deepEqual(result.output,{out:'vec4'});assert.equal(result.supported,true);
   assert.match(result.pixel,new RegExp('= '+key+'\\('));
   const connected=await page.evaluate(()=>JSON.stringify(graph));
   const undone=await page.evaluate(async()=>{await undo();return current().edges.some(e=>e.to[0]==='output');});
   assert.equal(undone,key!==keys[0]);await page.evaluate(()=>undo(true));
   assert.equal(await page.evaluate(()=>JSON.stringify(graph)),connected);
   checks.push(key+': Creator -> model insertion -> manual output/default -> wiring -> frontend GLSL -> exact Undo/Redo, with legacy configuration disabled');
  }
  assert.equal(await page.evaluate(()=>unaryModuleTest.inserts),keys.length);
  const deletion=await page.evaluate(async()=>{
   const before=JSON.stringify(graph);selection=new Set(current().nodes.filter(n=>!['source','output'].includes(n.id)).map(n=>n.id));selected=[...selection][0];selectedEdge=null;render();remove();
   const nodesRemoved=current().nodes.length===2&&current().edges.length===0;await undo();const exact=JSON.stringify(graph)===before;
   setSelectedEdges([...current().edges]);selected=null;selection.clear();remove();
   const edgesRemoved=current().edges.length===0;await undo();
   return {nodesRemoved,edgesRemoved,exact:exact&&JSON.stringify(graph)===before,calls:unaryModuleTest,closed:editorGraphModel===null};
  });
  assert.deepEqual(deletion,{nodesRemoved:true,edgesRemoved:true,exact:true,calls:{inserts:9,updates:9,removes:1,disconnects:1,transactionMisses:0},closed:true});
  checks.push('Input edits, multi-node deletion and multi-edge disconnect share the active model transaction; Undo restores exact authored state');
  const saved=await page.evaluate(async()=>{
   const document=JSON.stringify(graph),pixel=GrapeTopCompiler.compile(graph,typeContract.glslCode).pixel;
   await api('apply',{graph:JSON.parse(document)});await load();
   return {same:JSON.stringify(graph)===document,code:GrapeTopCompiler.compile(graph,typeContract.glslCode).pixel===pixel,count:current().nodes.length};
  });assert.deepEqual(saved,{same:true,code:true,count:keys.length+2});
  checks.push('All nine authored nodes save and reload through the editor API fixture with identical document and frontend shader');
  assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,count:checks.length}));
 }catch(error){await h.finish(error);throw error;}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
