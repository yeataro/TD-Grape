/* Parameter header actions use the same pane and browser-local display state. */
const assert=require('node:assert/strict'),path=require('node:path');
const {harness}=require('./test_glsl_code.cjs');
(async()=>{
 const[source,state,folder]=process.argv.slice(2),h=await harness(source,state,folder,{skipPreview:true,touch:true}),{page,checks,errors,settle}=h;
 page.setDefaultTimeout(6000);
 const setup=()=>page.evaluate(()=>{
  nativeSourcePolling=uniformPolling=customPolling=true;uniformLive.disconnect();uniformLive.connect=()=>{};clearTimeout(autoTimer);scheduleGraphApply=()=>{};
  readonly=conflicted=connectionInterrupted=dirty=false;graph.declarations=[];graph.functions=[];stage='pixel';graphTrail=[];
  const d=catalog.find(d=>d.key==='add');graph.stages.pixel={nodes:[{id:'target',definitionUuid:d.definitionUuid,revisionHash:d.revisionHash,params:{...clone(d.defaults),type:'vec3'},ui:{x:100,y:150}}],edges:[]};past=[];future=[];selectNode(current().nodes[0]);inspectorTab='parameters';render();
 });
 const snapshot=()=>page.evaluate(()=>JSON.stringify({graph,past,future,layout:workspaceLayout.snapshot()}));
 const popout=page.locator('[data-popout-panel="parameters"]'),option=page.locator('[data-experiment="parameterInputPorts"]');
 const chooseSockets=async enabled=>{await page.locator('#uiexperiments').click();await option.setChecked(enabled);await page.keyboard.press('Escape');await settle();};
 try{
  await setup();const before=await snapshot();await page.evaluate(()=>{window.originalPane=$('#pane-parameters');});
  assert.equal(await popout.count(),1);assert.equal(await popout.evaluate(e=>!!e.parentElement.closest('button')),false);assert.match(await popout.getAttribute('title'),/P/);
  await popout.click();await settle();assert.equal(await page.evaluate(()=>$('#floatingparameters>#pane-parameters')===originalPane),true);assert.equal(await snapshot(),before);
  assert.equal(await page.locator('.parameter-ports-toggle').count(),0);assert.equal(await page.locator('.parameter-input-port').count(),2);assert.equal(await option.isChecked(),true);
  const tabs=await page.locator('#inspector .parameter-tabs').boundingBox();
  await chooseSockets(false);assert.equal(await page.locator('.parameter-input-port').count(),0);assert.deepEqual(await page.locator('#inspector .parameter-tabs').boundingBox(),tabs);assert.equal(await snapshot(),before);
  await chooseSockets(true);assert.equal(await page.locator('.parameter-input-port').count(),2);
  checks.push('Pop-out preserves pane and graph; header has no circle; the default-on experimental checkbox controls sockets without shifting tabs');
  await page.locator('.floating-parameter-close').click();assert.equal(await page.locator('#parameter-sidebar .parameter-input-port').count(),0);
  await page.evaluate(()=>workspaceLayout.move('parameters','left',null));await settle();assert.equal(await page.locator('#sidebar-left .parameter-popout').count(),1);await popout.click();assert.equal(await page.locator('#floatingparameters').isVisible(),true);
  await page.evaluate(()=>{readonly=true;inspector();});assert.equal(await page.locator('.parameter-input-port').first().isDisabled(),true);
  checks.push('Pop-out follows moved tabs; docked Parameter has no shortcut sockets; readonly sockets cannot edit');
  for(const width of [1600,430])for(const theme of ['dark','light']){
   await page.setViewportSize({width,height:932});await page.evaluate(({width,theme})=>{setUIAppearance('theme',theme);setSidebarOpen('left',width>800);setSidebarOpen('right',width>800);},{width,theme});await settle();
   const edges=()=>page.evaluate(()=>[...$('#inspector').children].filter(e=>e.getClientRects().length).map(e=>e.getBoundingClientRect().right));
   const on=await edges();await chooseSockets(false);assert.deepEqual(await edges(),on);await chooseSockets(true);
   await page.locator('#floatingparameters').screenshot({path:path.join(folder,`header-${width}-${theme}.png`)});
  }
  checks.push('Right edges remain fixed with sockets on/off in desktop/mobile dark/light layouts');
  await chooseSockets(false);await page.reload();await page.waitForSelector('.node');await setup();assert.equal(await option.isChecked(),false);assert.equal(await page.locator('.parameter-input-port').count(),0);
  await page.locator('#uiexperiments').click();await page.locator('#experimentsreset').click();assert.equal(await option.isChecked(),true);await page.keyboard.press('Escape');assert.equal(await page.locator('.parameter-input-port').count(),2);
  checks.push('Experimental choice persists across reload; Reset defaults re-enables shortcut sockets');
  assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,checks}));
 }catch(e){await h.finish(e);throw e;}
})().catch(e=>{console.error(e);process.exitCode=1;});
