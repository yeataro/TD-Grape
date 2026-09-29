/* Whole-matrix input rows must span the Parameter grid, not its toggle gutter. */
const assert=require('node:assert/strict'),path=require('node:path');
const {harness}=require('./test_glsl_code.cjs');
(async()=>{
 const[source,state,folder]=process.argv.slice(2),h=await harness(source,state,folder,{skipPreview:true}),{page,checks,errors,settle}=h;
 page.setDefaultTimeout(6000);
 const matrix=port=>page.locator(`#inspector [data-parameter-matrix="${port}"]`);
 const compact=port=>matrix(port).locator('input[data-parameter-copy="compact"]');
 const unchanged=()=>page.evaluate(()=>JSON.stringify({graph,past,future,dirty}));
 try{
  await page.selectOption('#language','en');
  await page.evaluate(()=>{
   nativeSourcePolling=uniformPolling=customPolling=true;uniformLive.disconnect();uniformLive.connect=()=>{};
   clearTimeout(autoTimer);scheduleGraphApply=()=>{};connectionInterrupted=true;readonly=historyBusy=nativeMutationBusy=false;
   graphTrail=[];graph.functions=[];graph.declarations=[];graph.target=editorTarget='mat';stage='pixel';inspectorTab='parameters';
   const f=FunctionModel.importLibrary(graph,functionLibrary.find(f=>f.name==='Normal Map'));
   graph.stages.pixel={nodes:[{id:'normal',definitionUuid:FunctionModel.CALL,params:{functionId:f.id},ui:{x:60,y:100}},
    testNode('square','transpose',400,100,{type:'mat4'}),testNode('rectangular','transpose',720,100,{type:'dmat2x3'}),
    testNode('basis','matrix',60,600,{type:'mat3',values:[1,0,0,0,1,0,0,0,1]})],edges:[]};
   past=[];future=[];dirty=false;selected='normal';selection=new Set(['normal']);rememberSavedGraph(graph);render();
  });await settle();
  const before=await unchanged();
  for(const mode of ['docked','floating'])for(const zoom of [75,100,125])for(const ports of [false,true]){
   await page.evaluate(({mode,zoom,ports})=>{setUIAppearance('scale',zoom);setUIExperiments({parameterInputPorts:ports});workspaceLayout.setFloatingParameter(mode==='floating');},{mode,zoom,ports});await settle();
   if(mode==='floating'){await page.locator('.floating-parameter-resize').focus();await page.keyboard.press('Home');await settle();}
   for(const [id,port,type,count] of [['normal','tangentToWorld','mat3',9],['square','value','mat4',16],['rectangular','value','dmat2x3',6]]){
    await page.evaluate(id=>{selected=id;selection=new Set([id]);inspector();},id);await settle();
    const geometry=await matrix(port).evaluate(group=>{
     const outer=group.parentElement.getBoundingClientRect(),box=group.getBoundingClientRect(),header=group.firstElementChild;
     const label=header.querySelector('.parameter-value-label'),kind=header.querySelector('.parameter-value-type');
     const columns=[...group.querySelectorAll(':scope>.parameter-value-group')];
     return {width:box.width,outer:outer.width,labelWidth:label.getBoundingClientRect().width,label:label.textContent,
      type:kind?.textContent,typeX:kind?.getBoundingClientRect().left,
      columns:columns.map(c=>({labelWidth:c.querySelector('.parameter-value-label').getBoundingClientRect().width,typeX:c.querySelector('.parameter-value-type').getBoundingClientRect().left})),
      fields:[...group.querySelectorAll('input[data-parameter-copy="compact"]')].map(e=>({value:e.value,width:e.getBoundingClientRect().width/uiScaleFactor(),left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right})),left:outer.left,right:outer.right};
    });
    assert.ok(Math.abs(geometry.width-geometry.outer)<1,JSON.stringify({mode,zoom,ports,id,geometry}));
    assert.ok(geometry.labelWidth>20);assert.equal(geometry.type,type);assert.equal(geometry.fields.length,count);
    for(const col of geometry.columns){assert.ok(col.labelWidth>20);assert.ok(Math.abs(col.typeX-geometry.typeX)<1);}
    for(const entry of geometry.fields){assert.ok(entry.width>=22,JSON.stringify({mode,zoom,ports,id,entry}));assert.ok(entry.value!==''&&entry.left>=geometry.left-1&&entry.right<=geometry.right+1);}
   }
  }
  assert.equal(await unchanged()===before,true);checks.push('36 matrix layouts span the full row, show names/types and readable components in docked/floating panes at 75/100/125% with quick sockets on/off');

  await page.evaluate(()=>{setUIAppearance('scale',100);workspaceLayout.setFloatingParameter(true);setUIExperiments({parameterInputPorts:true});selected='normal';selection=new Set(['normal']);inspector();});await settle();
  assert.equal(await compact('tangentToWorld').count(),9);
  const edit=compact('tangentToWorld').nth(5);await edit.fill('2.125');await edit.press('Enter');await settle();
  assert.deepEqual(await page.evaluate(()=>current().nodes.find(n=>n.id==='normal').inputValues.tangentToWorld),[1,0,0,0,1,2.125,0,0,1]);
  assert.equal(await page.evaluate(()=>past.length),1);await page.evaluate(()=>undo());await settle();
  assert.deepEqual(await compact('tangentToWorld').evaluateAll(es=>es.map(e=>Number(e.value))),[1,0,0,0,1,0,0,0,1]);
  await page.evaluate(()=>undo(true));await settle();
  await matrix('tangentToWorld').locator('[data-parameter-expand="tangentToWorld:c1"]').click();await settle();
  const expanded=matrix('tangentToWorld').locator('[data-parameter-value="tangentToWorld:c1"] [data-parameter-copy="component"]');
  assert.deepEqual(await expanded.evaluateAll(es=>es.map(e=>Number(e.value))),[0,1,2.125]);
  checks.push('Editing a displayed component targets the correct matrix column/row, supports Undo/Redo, and agrees with expanded XYZ fields');

  const saved=await unchanged();await compact('tangentToWorld').first().fill('0.75');
  await page.evaluate(()=>{window.matrixDraft=$('#inspector [data-parameter-matrix] input');inspector();});await settle();
  assert.equal(await compact('tangentToWorld').first().inputValue(),'0.75');assert.equal(await compact('tangentToWorld').first().evaluate(e=>e===matrixDraft),true);
  await compact('tangentToWorld').first().press('Escape');assert.equal(await unchanged()===saved,true);
  checks.push('An inspector redraw preserves an uncommitted matrix draft; Escape restores it without a graph/history edit');

  await page.evaluate(()=>connectPorts({node:'basis',kind:'outputs',port:'out'},{node:'normal',kind:'inputs',port:'tangentToWorld',panelProxy:true}));await settle();
  assert.equal(await matrix('tangentToWorld').count(),0);
  assert.equal(await page.locator('#inspector .parameter-input-port[data-port="tangentToWorld"]').count(),1);
  await page.locator('#inspector [data-input="tangentToWorld"] .connection-row button').click();await settle();
  assert.equal(await compact('tangentToWorld').nth(5).inputValue(),'2.125');
  const labels=await matrix('tangentToWorld').locator(':scope>.parameter-row .parameter-value-label').allTextContents();assert.deepEqual(labels,['Tangent to World']);
  checks.push('Whole-matrix quick connection shows the source; disconnect restores the saved components and heading');

  await page.setViewportSize({width:430,height:1000});await page.evaluate(()=>{setSidebarOpen('left',false);setSidebarOpen('right',false);});await settle();
  for(const theme of ['dark','light']){
   await page.evaluate(theme=>setUIAppearance('theme',theme),theme);await settle();
   await page.locator('#floatingparameters').screenshot({path:path.join(folder,`matrix-parameter-${theme}.png`)});
  }
  await page.evaluate(()=>{readonly=true;inspector();});await settle();
  assert.ok(await compact('tangentToWorld').evaluateAll(es=>es.every(e=>e.disabled)));assert.deepEqual(errors,[]);
  checks.push('Narrow floating panel is readable in both themes; readonly matrix fields stay disabled');
  await h.finish();console.log(JSON.stringify({passed:true,checks}));
 }catch(error){await h.finish(error);throw error;}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
