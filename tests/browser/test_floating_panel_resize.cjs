/* Shared lower floating size; isolated graph and preview DOM, no TD writes. */
const assert=require('node:assert/strict'),path=require('node:path');
const {harness}=require('./test_glsl_code.cjs');
(async()=>{
 const[source,state,folder]=process.argv.slice(2),h=await harness(source,state,folder,{skipPreview:true,touch:true}),{page,checks,errors,settle}=h;
 const show=async id=>{await page.evaluate(id=>workspaceLayout.setFloatingPanel(id,true),id);await settle();};
 const box=id=>page.locator('#floating'+id).boundingBox();
 const near=(a,b)=>assert.ok(Math.abs(a-b)<1,`${a} != ${b}`);
 const saved=()=>page.evaluate(()=>localStorage.getItem('grapeFloatingLowerSize'));
 const snapshot=()=>page.evaluate(()=>JSON.stringify({graph,past,future,dirty,pan,scale,layout:(({floating,...docked})=>docked)(workspaceLayout.snapshot())}));
 const drag=async(id,axis,dx,dy)=>{
  const handle=await page.locator(`#floating${id} .floating-panel-resize-${axis}`).boundingBox();
  await page.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2);await page.mouse.down();await page.mouse.move(handle.x+handle.width/2+dx,handle.y+handle.height/2+dy,{steps:8});await page.mouse.up();await settle();
 };
 try{
  await page.evaluate(()=>{
   nativeSourcePolling=uniformPolling=customPolling=true;uniformLive.disconnect();uniformLive.connect=()=>{};clearTimeout(autoTimer);scheduleGraphApply=()=>{};readonly=conflicted=connectionInterrupted=dirty=false;
   graph.declarations=[];graph.functions=[];stage='pixel';graphTrail=[];graph.stages.pixel={nodes:[testNode('sum','add',40,80)],edges:[]};past=[];future=[];selectNode(current().nodes[0]);render();
   window.originalFloatingPreview=$('#preview');window.originalFloatingHelp=$('#pane-help');
   setSidebarOpen('left',false);setSidebarOpen('right',false);setUIAppearance('scale',100);
  });
  await show('parameters');await show('live');const initial=await snapshot();
  const first=await box('live');await drag('live','both',-120,-90);const enlarged=await box('live');
  near(enlarged.width,first.width+120);near(enlarged.height,first.height+90);near(enlarged.x+enlarged.width,first.x+first.width);near(enlarged.y+enlarged.height,first.y+first.height);
  await show('help');let help=await box('help');near(help.width,enlarged.width);near(help.height,enlarged.height);
  await page.evaluate(()=>{const p=document.createElement('div');p.style.height='1800px';$('#helpbody').append(p);});await settle();
  assert.ok(await page.locator('#helpbody').evaluate(e=>e.scrollHeight>e.clientHeight));
  await drag('help','width',40,0);await drag('help','height',0,30);help=await box('help');near(help.width,enlarged.width-40);near(help.height,enlarged.height-30);
  await show('live');const shared=await box('live');near(shared.width,help.width);near(shared.height,help.height);
  assert.equal(await page.evaluate(()=>originalFloatingPreview===$('#preview')&&originalFloatingHelp===$('#pane-help')),true);assert.equal(await snapshot(),initial);
  checks.push('Corner and independent edges resize both panes, preserve right/bottom anchors and original DOM, share dimensions, and leave graph/history/docking unchanged; Help scrolls');

  const beforeCancel=await saved(),handle=page.locator('#floatinglive .floating-panel-resize-both'),hr=await handle.boundingBox();
  await page.mouse.move(hr.x+5,hr.y+5);await page.mouse.down();await page.mouse.move(hr.x-50,hr.y-50);await page.keyboard.press('Escape');await page.mouse.up();await settle();
  assert.equal(await saved(),beforeCancel);near((await box('live')).width,shared.width);near((await box('live')).height,shared.height);
  await page.mouse.move(hr.x+5,hr.y+5);await page.mouse.down();await page.mouse.move(hr.x-50,hr.y-50);
  await page.evaluate(()=>workspaceLayout.setFloatingPanel('help',true));await page.mouse.up();await settle();assert.equal(await saved(),beforeCancel);near((await box('help')).width,shared.width);
  await page.locator('#floatinghelp .floating-panel-resize-both').focus();await page.keyboard.press('Home');await settle();near((await box('help')).width,280);near((await box('help')).height,160);
  await page.keyboard.press('ArrowLeft');await page.keyboard.press('ArrowUp');await settle();near((await box('help')).width,288);near((await box('help')).height,168);
  await page.evaluate(()=>workspaceLayout.setFloatingCollapsed('help',true));await settle();assert.ok((await box('help')).height<50);assert.equal(await page.locator('#floatinghelp .floating-panel-resize-both').isVisible(),false);
  await page.evaluate(()=>workspaceLayout.setFloatingCollapsed('help',false));await settle();near((await box('help')).height,168);
  checks.push('Escape cancels drag, keyboard supports minimum and arrow steps, and collapse preserves expanded dimensions');

  await drag('help','both',-160,-180);const preferred=await saved();
  for(const ui of [75,100,125]){
   await page.setViewportSize({width:390,height:650});await page.evaluate(ui=>setUIAppearance('scale',ui),ui);await settle();
   const geometry=await page.evaluate(()=>{const upper=$('#floatingparameters').getBoundingClientRect(),lower=$('#floatinghelp').getBoundingClientRect(),canvas=$('#canvas').getBoundingClientRect(),view=$('.canvas-view-tools').getBoundingClientRect();return{gap:lower.top-upper.bottom,want:12*uiScaleFactor(),left:lower.left,right:lower.right,canvasLeft:canvas.left,canvasRight:canvas.right,bottom:lower.bottom,viewTop:view.top};});
   assert.ok(geometry.gap>=geometry.want-1);assert.ok(geometry.left>=geometry.canvasLeft&&geometry.right<=geometry.canvasRight&&geometry.bottom<geometry.viewTop);assert.equal(await saved(),preferred);
   await page.screenshot({path:path.join(folder,`narrow-${ui}.png`)});
  }
  await page.setViewportSize({width:1600,height:1100});await page.evaluate(()=>setUIAppearance('scale',100));await settle();
  const preferredSize=JSON.parse(preferred),restored=await box('help');near(restored.width,preferredSize.width);near(restored.height,preferredSize.height);
  await page.reload();await page.waitForSelector('.node');await settle();await show('live');const reloaded=await box('live');near(reloaded.width,preferredSize.width);near(reloaded.height,preferredSize.height);
  checks.push('Narrow viewports clamp without overwriting preferred dimensions; upper slot keeps its gap, and shared size survives viewport restoration and reload');

  await page.evaluate(()=>{setUIAppearance('scale',75);readonly=true;});await settle();
  const touchBefore=await box('live'),touchSaved=await saved(),corner=await page.locator('#floatinglive .floating-panel-resize-both').boundingBox(),cdp=await page.context().newCDPSession(page);
  const point={x:corner.x+6,y:corner.y+6};
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:point.x-30,y:point.y-24}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await settle();
  near((await box('live')).width,touchBefore.width);assert.equal(await saved(),touchSaved);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:point.x-30,y:point.y-24}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await settle();
  near((await box('live')).width,touchBefore.width+30);near((await box('live')).height,touchBefore.height+24);await cdp.detach();
  await page.screenshot({path:path.join(folder,'preview-resized.png')});await show('help');await page.screenshot({path:path.join(folder,'help-resized.png')});
  checks.push('Trusted touch resizing respects 75% UI scale and read-only graphs; touch cancellation restores size without saving');
  await page.evaluate(()=>{setUIAppearance('scale',100);const saved=JSON.parse(localStorage.getItem('grapeWorkspaceV1'));saved.floating.lowerSize={width:'broken',height:null};localStorage.setItem('grapeWorkspaceV1',JSON.stringify(saved));});
  await page.reload();await page.waitForSelector('.node');await settle();await show('help');near((await box('help')).width,320);near((await box('help')).height,320);
  checks.push('Malformed stored dimensions recover to the default size');
  assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,checks}));
 }catch(e){await h.finish(e);throw e;}
})().catch(e=>{console.error(e);process.exitCode=1;});
