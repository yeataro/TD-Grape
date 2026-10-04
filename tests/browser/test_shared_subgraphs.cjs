const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {harness}=require('./test_glsl_code.cjs');
const {sharedGraph}=require('../fixtures/shared_subgraphs.cjs');
const [source,stateFile,folder]=process.argv.slice(2);
(async()=>{
 const h=await harness(source,stateFile,folder,{skipPreview:true}),{page,checks,errors}=h;
 try{
  await page.evaluate(g=>{
   clearTimeout(autoTimer);scheduleGraphApply=()=>{};readonly=false;historyBusy=nativeMutationBusy=false;connectionInterrupted=true;
   graph=g;editorTarget='top';stage='pixel';graphTrail=[];past=[];future=[];selected=null;selection.clear();
   for(const data of [graph.stages.pixel,...graph.functions.map(f=>f.graph)])data.nodes.forEach((n,i)=>n.ui={x:i*260,y:60});
   window.interfaceEdits=[];const get=GrapeGraph.GraphDocument.prototype.subgraph;
   GrapeGraph.GraphDocument.prototype.subgraph=function(id){const handle=get.call(this,id),edit=handle.editInterface;handle.editInterface=function(...args){interfaceEdits.push(args[1].kind);return edit.apply(this,args);};return handle;};
   render();scale=.7;pan={x:10,y:20};transform();
  },sharedGraph());
  const original=await page.evaluate(()=>GrapeTopCompiler.compile(graph,typeContract.glslCode));
  assert.match(original.pixel,/3\.0/);assert.ok(original.sourceMap.pixel.some(row=>row.trail.join('/')==='wrapper/gain'&&row.node==='mul'));
  checks.push('Real editor compiles two shared and nested instances with scoped source locations');
  const localized=await page.evaluate(()=>{
   const source=document.querySelector('[data-node="source"]'),second=document.querySelector('[data-node="second"]');
   const ok=change(()=>editFunctionInterface(graph.functions[0],'inputs',{kind:'update',id:'value',patch:{name:'Amount'}},()=>{throw Error('Legacy interface called');}));
   return {ok,source:source===document.querySelector('[data-node="source"]'),second:second===document.querySelector('[data-node="second"]'),first:document.querySelector('[data-node="first"]').textContent.includes('Amount')};
  });assert.deepEqual(localized,{ok:true,source:true,second:true,first:true});
  checks.push('Interface publication redraws its actual instance while retaining unrelated cards');
  const defaultEdit=await page.evaluate(()=>{
   const before=JSON.stringify(graph);
   const disconnected=change(()=>removeGraphEdges(graph,current(),e=>e.to[0]==='first'&&e.to[1]==='value'));
   const first=current().nodes.find(n=>n.id==='first');selected=first.id;selection=new Set([first.id]);render();
   return {before,disconnected,value:defaultInput(first,'value','float'),compiled:GrapeTopCompiler.supports(graph)};
  });assert.equal(defaultEdit.disconnected,true);assert.equal(defaultEdit.value,1);assert.equal(defaultEdit.compiled,true);
  await page.locator('#undo').click();assert.equal(await page.evaluate(()=>JSON.stringify(graph)),defaultEdit.before);
  checks.push('Unconnected call inputs render their module-owned defaults and restore their wire on Undo');
  await page.evaluate(()=>{enterFunction(current().nodes.find(n=>n.id==='first'));selected='in';selection=new Set(['in']);inspectorTab='settings';render();});
  const row=page.locator('[data-function-port="value"]');await row.locator('input').first().fill('Renamed');await row.locator('input').first().press('Enter');await row.locator('input').first().press('Tab');
  assert.equal(await page.evaluate(()=>currentFunction().inputs[0].name),'Renamed');
  checks.push('Actual boundary inspector renames the graph-owned interface through the model');
  const wiring=await page.evaluate(()=>{
   const before=JSON.stringify(graph),ok=connectPorts({node:'in',kind:'outputs',port:'value'},{node:'mul',kind:'inputs',port:'b'});
   return {before,ok,type:ports(current().nodes.find(n=>n.id==='mul'),'outputs').out};
  });assert.equal(wiring.ok,true);assert.equal(wiring.type,'float');await page.locator('#undo').click();assert.equal(await page.evaluate(()=>JSON.stringify(graph)),wiring.before);
  checks.push('Wiring inside a subgraph uses scoped boundary ports and preserves fixed output types');
  const before=await page.evaluate(()=>JSON.stringify(graph));
  await row.locator('button.danger').click();
  assert.equal(await page.evaluate(()=>graph.stages.pixel.edges.length),4);assert.equal(await page.evaluate(()=>FunctionModel.find(graph,'wrapper').graph.edges.length),1);
  await page.locator('#undo').click();assert.equal(await page.evaluate(()=>JSON.stringify(graph)),before);await page.locator('#redo').click();await page.locator('#undo').click();
  checks.push('Removing a shared port cleans its boundary and all nested callers in one Undo/Redo entry');
  const cycle=await page.evaluate(()=>{
   const before=JSON.stringify(graph),n=current().nodes.find(n=>n.id==='mul');
   const ok=connectPorts({node:n.id,kind:'outputs',port:'out'},{node:n.id,kind:'inputs',port:'a'});
   return {ok,unchanged:before===JSON.stringify(graph)};
  });assert.deepEqual(cycle,{ok:false,unchanged:true});
  const edited=await page.evaluate(()=>change(()=>{const n=current().nodes.find(n=>n.id==='mul');withGraphNetwork(graph,current(),network=>network.node(n.id).update({inputValues:{b:4}}));}));assert.equal(edited,true);
  assert.match(await page.evaluate(()=>GrapeTopCompiler.compile(graph,typeContract.glslCode).pixel),/4\.0/);
  await page.locator('#undo').click();assert.equal(await page.evaluate(()=>JSON.stringify(graph)),before);
  checks.push('Shared body edits compile in every invocation, reject cycles atomically and undo exactly');
  const library=await page.evaluate(()=>{
   graph.functions[0].scope='library';graph.functions[0].source={id:'gain',version:'v1'};
   const snapshot=clone(graph.functions[0]);
   const ok=change(()=>editFunctionInterface(currentFunction(),'inputs',{kind:'update',id:'value',patch:{name:'Local'}},()=>{throw Error('Legacy interface called');}));
   window.libraryCopyDiff={before:snapshot,after:clone(FunctionModel.find(graph,'gain'))};return {ok,snapshot:JSON.stringify(FunctionModel.find(graph,'gain'))===JSON.stringify(snapshot),local:currentFunction().scope,redirected:graph.stages.pixel.nodes.find(n=>n.id==='first').params.functionId===currentFunction().id,compile:GrapeTopCompiler.supports(graph)};
  });if(!library.snapshot)fs.writeFileSync(path.join(folder,'library-diff.json'),JSON.stringify(await page.evaluate(()=>libraryCopyDiff),null,2));assert.deepEqual(library,{ok:true,snapshot:true,local:'local',redirected:true,compile:true});
  checks.push('Library localization preserves its stored source snapshot and edits only the graph-owned local copy');
  const saved=await page.evaluate(async()=>{const code=GrapeTopCompiler.compile(graph,typeContract.glslCode).pixel,before=JSON.stringify(graph);await api('apply',{graph:clone(graph)});await load();return {graph:before===JSON.stringify(graph),code:code===GrapeTopCompiler.compile(graph,typeContract.glslCode).pixel};});assert.deepEqual(saved,{graph:true,code:true});
  checks.push('Fixture save/reload retains the shared definitions and exact frontend code (not a TD persistence claim)');
  assert.ok((await page.evaluate(()=>interfaceEdits)).includes('remove'));
  fs.writeFileSync(path.join(folder,'graph.json'),await page.evaluate(()=>JSON.stringify(graph,null,2)));
  fs.writeFileSync(path.join(folder,'compiled.json'),await page.evaluate(()=>JSON.stringify(GrapeTopCompiler.compile(graph,typeContract.glslCode),null,2)));
  assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,count:checks.length}));
 }catch(e){await h.finish(e);throw e;}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
