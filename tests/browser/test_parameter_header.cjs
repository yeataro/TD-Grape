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
 const toggle=page.locator('#floatingparameters .parameter-ports-toggle'),popout=page.locator('.parameter-popout');
 try{
  await setup();const before=await snapshot();await page.evaluate(()=>{window.originalPane=$('#pane-parameters');});
  assert.equal(await popout.count(),1);assert.equal(await popout.evaluate(e=>!!e.closest('button')),true);
  assert.equal(await popout.evaluate(e=>!!e.parentElement.closest('button')),false);assert.match(await popout.getAttribute('title'),/P/);
  await page.screenshot({path:path.join(folder,'sidebar-popout.png')});
  await popout.click();await settle();assert.equal(await page.locator('#floatingparameters').isVisible(),true);assert.equal(await page.evaluate(()=>$('#floatingparameters>#pane-parameters')===originalPane),true);assert.equal(await snapshot(),before);
  assert.equal(await toggle.getAttribute('aria-pressed'),'true');assert.equal(await page.locator('.parameter-input-port').count(),2);
  const tabs=await page.locator('#inspector .parameter-tabs').boundingBox(),opacity=await toggle.evaluate(e=>getComputedStyle(e).opacity);
  await toggle.click();await settle();assert.equal(await toggle.getAttribute('aria-pressed'),'false');assert.ok(Number(await toggle.evaluate(e=>getComputedStyle(e).opacity))<Number(opacity));assert.equal(await page.locator('.parameter-input-port').count(),0);assert.deepEqual(await page.locator('#inspector .parameter-tabs').boundingBox(),tabs);assert.equal(await snapshot(),before);
  await page.keyboard.press('Space');await settle();assert.equal(await toggle.getAttribute('aria-pressed'),'true');assert.equal(await page.locator('.parameter-input-port').count(),2);
  assert.equal(await page.evaluate(()=>Object.hasOwn(EDITOR_DEV_DEFAULTS,'parameterInputPorts')||experimentGroups.some(([,keys])=>keys.includes('parameterInputPorts'))),false);
  checks.push('Sidebar pop-out moves the original pane; circular toggle supports mouse/keyboard, uses opacity and leaves tabs, graph/history/layout unchanged; no experiment entry remains');
  await page.locator('.floating-parameter-close').click();assert.equal(await page.locator('#parameter-sidebar .parameter-input-port,#parameter-sidebar .parameter-ports-toggle').count(),0);
  await page.evaluate(()=>workspaceLayout.move('parameters','left',null));await settle();assert.equal(await page.locator('#sidebar-left .parameter-popout').count(),1);await popout.click();assert.equal(await page.locator('#floatingparameters').isVisible(),true);
  await page.locator('#inspector .parameter-tabs [role=tab]').last().click();assert.equal(await toggle.count(),1);assert.equal(await page.locator('.parameter-input-port').count(),0);
  await page.evaluate(()=>{readonly=true;inspectorTab='parameters';inspector();});await toggle.click();assert.equal(await toggle.getAttribute('aria-pressed'),'false');await toggle.click();assert.equal(await page.locator('.parameter-input-port').first().isDisabled(),true);
  checks.push('Pop-out follows moved workspace tabs; Notes retains the display switch; readonly allows display changes; docked Parameter still has no shortcut sockets');
  for(const width of [1600,430])for(const theme of ['dark','light']){
   await page.setViewportSize({width,height:932});await page.evaluate(({width,theme})=>{setUIAppearance('theme',theme);setSidebarOpen('left',width>800);setSidebarOpen('right',width>800);},{width,theme});await settle();
   const gap=await page.locator('#inspector .parameter-tabs').evaluate(e=>{const a=e.getBoundingClientRect(),b=$('#inspector').getBoundingClientRect();return(a.left-b.left)/uiScaleFactor();});assert.equal(Math.round(gap),8);
   await page.screenshot({path:path.join(folder,`header-${width}-${theme}.png`)});
   const r=await toggle.boundingBox();await page.touchscreen.tap(r.x+r.width/2,r.y+r.height/2);await settle();assert.equal(await toggle.getAttribute('aria-pressed'),'false');await page.touchscreen.tap(r.x+r.width/2,r.y+r.height/2);assert.equal(await toggle.getAttribute('aria-pressed'),'true');
  }
  checks.push('Normal tab inset survives sockets in desktop/mobile dark/light views; circular action remains touch-operable');
  for(const {legacy,saved,expected} of [{legacy:false,expected:false},{legacy:true,expected:true},{legacy:true,saved:false,expected:false}]){
   await page.evaluate(({legacy,saved})=>{localStorage.setItem('sgrapeExperimentsV1',JSON.stringify({parameterInputPorts:legacy}));if(saved===undefined)localStorage.removeItem('grapeParameterInputPorts');else localStorage.setItem('grapeParameterInputPorts',JSON.stringify(saved));},{legacy,saved});
   await page.reload();await page.waitForSelector('.node');await setup();await page.evaluate(()=>workspaceLayout.setFloatingParameter(true));await settle();assert.equal(await toggle.getAttribute('aria-pressed'),String(expected));
  }
  await toggle.click();await page.reload();await page.waitForSelector('.node');await setup();assert.equal(await toggle.getAttribute('aria-pressed'),'true');
  assert.equal(await page.evaluate(()=>browserPreferenceKeys.includes('grapeParameterInputPorts')),true);
  checks.push('Former experimental on/off preferences migrate once; the dedicated preference wins and survives reload');
  assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,checks}));
 }catch(e){await h.finish(e);throw e;}
})().catch(e=>{console.error(e);process.exitCode=1;});
