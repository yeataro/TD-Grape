/* Opt-in physical-device observation; verifies no graph or drag behavior change. */
const assert=require('node:assert/strict'),path=require('node:path');
const {harness}=require('./test_glsl_code.cjs');
(async()=>{
 const[source,state,folder,engine='chromium']=process.argv.slice(2),h=await harness(source,state,folder,{skipPreview:true,touch:true,engine}),{page,checks,settle,errors}=h;
 try{
  await page.setViewportSize({width:1024,height:900});await page.evaluate(()=>{
   nativeSourcePolling=uniformPolling=customPolling=true;uniformLive.disconnect();uniformLive.connect=()=>{};clearTimeout(autoTimer);scheduleGraphApply=()=>{};
   readonly=conflicted=connectionInterrupted=dirty=false;graph.declarations=[];graph.functions=[];stage='pixel';graphTrail=[];
   graph.stages.pixel={nodes:[testNode('src','float',40,150),testNode('dst','add',400,200)],edges:[]};past=[];future=[];
   setSidebarOpen('left',false);setSidebarOpen('right',false);selectNode(current().nodes[1]);scale=1.29;pan={x:-140,y:80};render();workspaceLayout.setFloatingParameter(true);setUIAppearance('scale',75);
  });await settle();
  assert.equal(await page.locator('#wire-coordinate-diagnostics').count(),0);
  const snapshot=()=>page.evaluate(()=>JSON.stringify({graph,past,future,dirty,scale,pan})),before=await snapshot();
  for(const selector of ['[data-node="src"] .port[data-kind="outputs"]','.parameter-input-port[data-port="a"]']){
   const start=await page.locator(selector).boundingBox();await page.mouse.move(start.x+start.width/2,start.y+start.height/2);await page.mouse.down();await page.mouse.move(420,600);await settle();
   const d=await page.locator('.parameter-wire-preview path,#wires .wire-preview').getAttribute('d');
   await page.evaluate(()=>{history.replaceState(null,'','?wire-coordinates'+location.hash);dispatchEvent(new PopStateEvent('popstate'));});await settle();await page.mouse.move(420,600);await settle();await settle();
   const report=JSON.parse(await page.locator('#wire-coordinate-diagnostics').getAttribute('data-sample'));
   assert.equal(report.ui,75);assert.equal(report.graphZoom,129);assert.deepEqual(report.event,[420,600]);assert.ok(Math.hypot(...report.tipDelta)<1);assert.ok(Math.hypot(...report.markerDelta)<1);
   assert.equal(await page.locator('.parameter-wire-preview path,#wires .wire-preview').getAttribute('d'),d);assert.equal(await snapshot(),before);
   await page.keyboard.press('Escape');await page.mouse.up();await page.mouse.move(start.x+start.width/2,start.y+start.height/2);await page.mouse.down();await page.mouse.move(420,600);await settle();await settle();
   const fresh=JSON.parse(await page.locator('#wire-coordinate-diagnostics').getAttribute('data-sample'));assert.ok(fresh.down?.socket,'new drag records its original socket');assert.ok(Math.hypot(fresh.down.event[0]-fresh.down.socket[0],fresh.down.event[1]-fresh.down.socket[1])<1);
   await page.screenshot({path:path.join(folder,report.overlay?'panel-diagnostic.png':'node-diagnostic.png')});
   await page.keyboard.press('Escape');await page.mouse.up();await settle();assert.equal(await snapshot(),before);
   assert.ok(await page.locator('#wire-coordinate-diagnostics').getAttribute('data-sample'),'last drag report remains readable after release/cancel');
   await page.evaluate(()=>{history.replaceState(null,'',location.pathname+location.hash);dispatchEvent(new PopStateEvent('popstate'));});await settle();assert.equal(await page.locator('#wire-coordinate-diagnostics').count(),0);
  }
  if(engine==='chromium'){
   await page.evaluate(()=>{history.replaceState(null,'','?wire-coordinates'+location.hash);dispatchEvent(new PopStateEvent('popstate'));});await settle();
   const cdp=await page.context().newCDPSession(page),r=await page.locator('[data-node="src"] .port[data-kind="outputs"]').boundingBox();
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:r.x+r.width/2,y:r.y+r.height/2}]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:420,y:600}]});await settle();await settle();
   const report=JSON.parse(await page.locator('#wire-coordinate-diagnostics').getAttribute('data-sample'));
   assert.equal(report.pointer,'touch');assert.ok(report.down.socket);assert.ok(Math.hypot(...report.tipDelta)<1);assert.ok(Math.hypot(...report.markerDelta)<1);
   await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await settle();assert.equal(await snapshot(),before);
   await page.evaluate(()=>{history.replaceState(null,'',location.pathname+location.hash);dispatchEvent(new PopStateEvent('popstate'));});await settle();await cdp.detach();
   checks.push('Native Chromium touch events report source and tip coordinates and cancellation preserves graph state');
  }
  checks.push('Default mode has no diagnostics; enabling it preserves node/proxy drag geometry and graph state at 75% UI / 129% canvas, and reports event/paint coordinates');
  checks.push('Report survives drag cancellation for capture; removing the URL flag removes overlay and listeners');
  await page.evaluate(()=>{history.replaceState(null,'','?wire-coordinates');dispatchEvent(new PopStateEvent('popstate'));});
  for(const ui of [75,78,100,125])for(const zoom of [.7753,1.29]){
   await page.evaluate(({ui,zoom})=>{setUIAppearance('scale',ui);scale=zoom;pan={x:40,y:40};transform();wires();},{ui,zoom});await settle();
   const expectedScale=ui/100*zoom,geometry=await page.evaluate(()=>({basis:graphCoordinateBasis(),body:document.body.getBoundingClientRect().toJSON(),viewport:[innerWidth,innerHeight],rootZoom:getComputedStyle(document.documentElement).zoom}));
   assert.equal(Number(geometry.rootZoom),1,'viewport coordinate root must stay unzoomed');
   assert.ok(Math.abs(geometry.basis.width-expectedScale)<.001);assert.ok(Math.abs(geometry.basis.height-expectedScale)<.001);
   assert.ok(Math.abs(geometry.body.width-geometry.viewport[0])<1);assert.ok(Math.abs(geometry.body.height-geometry.viewport[1])<1);
   for(const selector of ['[data-node="src"] .port[data-kind="outputs"]','.parameter-input-port[data-port="a"]']){
    const r=await page.locator(selector).boundingBox();await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();await page.mouse.move(650,700);await settle();await settle();
    const report=JSON.parse(await page.locator('#wire-coordinate-diagnostics').getAttribute('data-sample'));
    assert.equal(report.ui,ui);assert.deepEqual(report.event,[650,700]);assert.ok(Math.hypot(...report.tipDelta)<1);assert.ok(Math.hypot(...report.markerDelta)<1);
    if(ui===78&&zoom===.7753)await page.screenshot({path:path.join(folder,report.overlay?'78-panel.png':'78-node.png')});
    await page.keyboard.press('Escape');await page.mouse.up();await settle();
   }
  }
  checks.push('75/78/100/125% content zoom with 77.53/129% canvas keeps viewport bounds, graph basis, event marker and node/proxy tips in the same pixel space');
  await page.goto(new URL('/?wire-coordinates#diagnostic-session',page.url()).href);await page.reload();await page.waitForSelector('#wire-coordinate-diagnostics');
  assert.equal(await page.evaluate(()=>token),'diagnostic-session');
  checks.push('Direct diagnostic URL enables observation on load while preserving the session fragment');
  assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,checks}));
 }catch(e){await h.finish(e);throw e;}
})().catch(e=>{console.error(e);process.exitCode=1;});
