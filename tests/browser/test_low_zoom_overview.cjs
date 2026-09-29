// Isolated editor fixture: zoom presentation never writes to TD or graph history.
const assert=require('node:assert/strict'),path=require('node:path');
const {harness}=require('./test_glsl_code.cjs');
(async()=>{
 const[source,fixture,folder]=process.argv.slice(2),h=await harness(source,fixture,folder,{skipPreview:true,touch:true}),{page,settle,checks,errors,at}=h;
 const control=()=>page.locator('[data-experiment="lowZoomOverview"]');
 const snapshot=()=>page.evaluate(()=>JSON.stringify({graph,past,future,dirty}));
 const zoom=async value=>{await page.evaluate(value=>setGraphZoom(value),value);await settle();};
 const geometry=()=>page.evaluate(()=>[...document.querySelectorAll('#cards .node')].map(card=>({id:card.dataset.node,w:card.offsetWidth,h:card.offsetHeight,ports:[...card.querySelectorAll('.port')].map(port=>{const r=port.getBoundingClientRect(),p=graphPoint(r.left+r.width/2,r.top+r.height/2);return[p.x,p.y];})})));
 const sameGeometry=(a,b)=>{assert.equal(a.length,b.length);for(let i=0;i<a.length;i++){assert.deepEqual([a[i].id,a[i].w,a[i].h],[b[i].id,b[i].w,b[i].h]);assert.equal(a[i].ports.length,b[i].ports.length);a[i].ports.forEach((p,j)=>p.forEach((v,k)=>assert.ok(Math.abs(v-b[i].ports[j][k])<.03,`${a[i].id} socket drift`)));}};
 const setup=async()=>{await page.evaluate(()=>{
  nativeSourcePolling=uniformPolling=customPolling=true;uniformLive.disconnect();uniformLive.connect=()=>{};clearTimeout(autoTimer);scheduleGraphApply=()=>{};connectionInterrupted=true;readonly=historyBusy=nativeMutationBusy=false;graphTrail=[];graph.functions=[];graph.declarations=[];stage='pixel';
  const nodes=[testNode('value','float',40,120,{value:.3}),testNode('math','add',400,120,{type:'float'}),testNode('material','material_pbr',750,120),testNode('color','color',40,380),testNode('folded','float',400,430),testNode('router','router',650,380),testNode('note','comment',40,700)];
  nodes[1].name='A very long material adjustment name that must be truncated';nodes[1].ui.width=220;nodes[4].ui.collapsed=true;
  graph.stages.pixel={nodes,edges:[{from:['value','out'],to:['math','a']},{from:['math','out'],to:['material','metallic'],ui:{style:'link'}}]};
  selected='math';selection=new Set(['math']);showCustomNodeNames=true;showLinkLines=true;past=[];future=[];dirty=false;rememberSavedGraph(graph);render();setUIExperiments({canvasDamping:false,frameDamping:false});scale=.5;pan={x:80,y:120};transform();
 });await settle();};
 try{
  await page.selectOption('#language','en');await setup();const before=await snapshot();
  assert.equal(await page.evaluate(()=>EDITOR_DEV_DEFAULTS.lowZoomOverview),false);
  await page.locator('#uiexperiments').click();assert.equal(await control().isChecked(),false);await page.keyboard.press('Escape');
  await zoom(.1);assert.equal(await page.evaluate(()=>scale),.25);assert.equal(await page.locator('#canvas.graph-overview').count(),0);
  await page.locator('#zoom').click();await settle();assert.equal(await page.locator('[data-canvas-zoom="10"]').isVisible(),false);await page.keyboard.press('Home');assert.equal(await page.evaluate(()=>document.activeElement.dataset.canvasZoom),'25');await page.keyboard.press('Escape');
  checks.push('Default off retains 25% minimum; hidden extra presets are excluded from keyboard navigation');

  await page.locator('#uiexperiments').click();await control().check();await page.keyboard.press('Escape');
  const baseline=await geometry();await page.evaluate(()=>{window.overviewCard=$('#cards [data-node="value"]');window.overviewField=overviewCard.querySelector('input');overviewField.value='0.456789';});
  for(const value of [.249,.2,.1,.25,.8]){await zoom(value);sameGeometry(baseline,await geometry());assert.equal(await page.locator('#canvas.graph-overview').count(),value<.25?1:0);}
  assert.equal(await page.evaluate(()=>overviewCard===$('#cards [data-node="value"]')&&overviewField===overviewCard.querySelector('input')&&overviewField.value==='0.456789'),true);
  assert.equal(await snapshot(),before);checks.push('Threshold transitions preserve card sizes, socket positions, input DOM/drafts and graph/history');

  for(const theme of ['dark','light'])for(const ui of [75,100,125]){
   await page.evaluate(({theme,ui})=>{setUIAppearance('theme',theme);setUIAppearance('scale',ui);},{theme,ui});await zoom(.25);const g=await geometry();await zoom(.2);sameGeometry(g,await geometry());
   const paint=await page.evaluate(()=>[...document.querySelectorAll('#cards .node-overview-label')].map(label=>{
    const card=label.parentElement,probe=document.createElement('span');probe.style.background='var(--category-bg)';card.append(probe);const family=getComputedStyle(probe).backgroundColor;probe.remove();
    return {font:getComputedStyle(label).fontSize,bg:getComputedStyle(card).backgroundColor,family,visible:getComputedStyle(label).visibility,details:[...card.querySelectorAll('.port-label,.port-type,input,select,.node-title')].every(e=>getComputedStyle(e).visibility==='hidden'),ports:[...card.querySelectorAll('.port')].every(e=>getComputedStyle(e).visibility==='visible')};
   }));
   assert.equal(new Set(paint.map(p=>p.font)).size,1);assert.equal(paint[0].font,'36px');for(const p of paint){assert.equal(p.bg,p.family);assert.equal(p.visible,'visible');assert.ok(p.details&&p.ports);}
   assert.equal(await page.locator('.node-router .node-overview-label,.node[data-category="annotation"] .node-overview-label').count(),0);
   await page.screenshot({path:path.join(folder,`overview-${theme}-${ui}.png`)});
  }
  checks.push('Both themes at 75/100/125% UI use one font size, solid family backgrounds, hidden details and stable geometry; Router/notes retain their form');

  await page.evaluate(()=>{setUIAppearance('scale',100);showCustomNodeNames=false;overviewField.value='0.3';render();});await settle();
  assert.equal(await page.locator('[data-node="math"] .node-overview-label').textContent(),await page.locator('[data-node="math"] .node-function-title').textContent());
  await page.evaluate(()=>{showCustomNodeNames=true;render();});await settle();
  const clamp=await page.locator('[data-node="math"] .node-overview-label>span').evaluate(e=>({clamp:getComputedStyle(e).webkitLineClamp,overflow:getComputedStyle(e).overflow,clipped:e.scrollHeight>e.clientHeight}));
  assert.equal(clamp.clamp,'2');assert.equal(clamp.overflow,'hidden');assert.ok(clamp.clipped);sameGeometry(baseline,await geometry());
  checks.push('Names follow the custom-name preference and long names clamp to two lines without growing cards, including rerenders while zoomed out');

  const center=()=>page.evaluate(()=>{const r=$('#canvas').getBoundingClientRect();return graphPoint(r.left+r.width/2,r.top+r.height/2);});
  await zoom(.1);const anchored=await center();await page.locator('#uiexperiments').click();await control().uncheck();await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>scale),.25);const restored=await center();assert.ok(Math.abs(anchored.x-restored.x)<.03&&Math.abs(anchored.y-restored.y)<.03);assert.equal(await page.locator('#canvas.graph-overview').count(),0);
  checks.push('Turning off below 25% restores normal appearance and the original limit while preserving the viewport center');

  await page.evaluate(()=>setUIExperiments({lowZoomOverview:true}));await zoom(.2);const canvas=await page.locator('#canvas').boundingBox(),blank={x:canvas.x+canvas.width*.7,y:canvas.y+canvas.height*.8};
  await page.mouse.move(blank.x,blank.y);await page.mouse.wheel(0,10000);await settle();assert.equal(await page.evaluate(()=>scale),.1);
  await zoom(.2);await page.mouse.down({button:'middle'});await page.mouse.move(blank.x-240,blank.y);await page.mouse.up({button:'middle'});assert.equal(await page.evaluate(()=>scale),.1);
  await page.locator('#zoom').click();await settle();await page.keyboard.press('Home');assert.equal(await page.evaluate(()=>document.activeElement.dataset.canvasZoom),'10');await page.locator('[data-canvas-zoom="15"]').click();assert.equal(await page.evaluate(()=>scale),.15);
  await page.evaluate(()=>{current().nodes.find(n=>n.id==='note').ui.x=15000;render();fit();});assert.equal(await page.evaluate(()=>scale),.1);await page.evaluate(()=>{current().nodes.find(n=>n.id==='note').ui.x=40;render();});
  const cdp=await page.context().newCDPSession(page);await zoom(.3);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:blank.x-150,y:blank.y},{id:2,x:blank.x+150,y:blank.y}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x:blank.x-25,y:blank.y},{id:2,x:blank.x+25,y:blank.y}]});await settle();
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await settle();assert.equal(await page.evaluate(()=>scale),.1);
  assert.equal(await snapshot(),before);checks.push('Wheel, dolly, menu, fit and native touch pinch all reach 10% without changing graph/history');

  await page.evaluate(()=>{setUIExperiments({nodeBodyDrag:false});scale=.2;pan={x:80,y:120};transform();});await settle();
  const body=await at('#cards [data-node="material"]'),oldPosition=await page.evaluate(()=>clone(current().nodes.find(n=>n.id==='material').ui));
  await page.mouse.move(body.x,body.y);await page.mouse.down();await page.mouse.move(body.x+30,body.y+15,{steps:5});await page.mouse.up();await settle();
  assert.notDeepEqual(await page.evaluate(()=>current().nodes.find(n=>n.id==='material').ui),oldPosition);await page.evaluate(()=>undo());assert.deepEqual(await page.evaluate(()=>current().nodes.find(n=>n.id==='material').ui),oldPosition);
  const wireBefore=await snapshot(),socket=await at('#cards [data-node="value"] .port[data-kind="outputs"]');
  await page.mouse.move(socket.x,socket.y);await page.mouse.down();await page.mouse.move(socket.x+90,socket.y+90,{steps:4});assert.equal(await page.evaluate(()=>!!wireDrag),true);await page.keyboard.press('Escape');await page.mouse.up();assert.equal(await snapshot(),wireBefore);
  await page.evaluate(()=>{readonly=true;});await page.locator('#cards [data-node="color"]').click();assert.equal(await page.evaluate(()=>selected),'color');assert.equal(await snapshot(),wireBefore);await page.evaluate(()=>{readonly=false;});
  checks.push('Overview bodies select/drag with header-only dragging enabled; Undo and socket wire cancellation work, and readonly selection stays available');

  await zoom(.5);await page.evaluate(()=>{const input=$('#cards [data-node="value"] input');window.focusedOverviewField=input;input.focus();input.value='0.9876';});const draftBefore=await snapshot();await zoom(.2);await zoom(.5);
  assert.equal(await page.evaluate(()=>focusedOverviewField===$('#cards [data-node="value"] input')&&focusedOverviewField.value==='0.9876'),true);assert.equal(await snapshot(),draftBefore);
  await page.evaluate(()=>{focusedOverviewField.value='0.3';focusedOverviewField.blur();});checks.push('A focused numeric draft survives hiding/restoring details without an implicit edit');

  await page.evaluate(()=>{setUIExperiments({lowZoomOverview:true,canvasDamping:true,canvasDampingMs:150});setGraphZoom(.8);});await page.waitForFunction(()=>canvasMotion===null);await page.evaluate(()=>setGraphZoom(.1));await page.waitForFunction(()=>canvasMotion===null);assert.equal(await page.locator('#canvas.graph-overview').count(),1);
  await page.evaluate(()=>{setGraphZoom(.2);setUIExperiments({lowZoomOverview:false});});await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>scale),.25);assert.equal(await page.locator('#canvas.graph-overview').count(),0);
  checks.push('Animated zoom crosses the threshold; disabling cancels pending motion below the original limit');

  await page.evaluate(()=>setUIExperiments({lowZoomOverview:true}));await page.reload();await page.waitForSelector('.node');assert.equal(await page.evaluate(()=>EDITOR_DEV_SETTINGS.lowZoomOverview),true);
  await page.locator('#uiexperiments').click();await page.locator('#experimentsreset').click();assert.equal(await control().isChecked(),false);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem(experimentsStorageKey)).lowZoomOverview),false);
  await page.reload();await page.waitForSelector('.node');assert.equal(await page.evaluate(()=>EDITOR_DEV_SETTINGS.lowZoomOverview),false);
  checks.push('Browser preference survives reload; experiment reset persists the disabled default');
  assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,checks}));
 }catch(error){await h.finish(error);throw error;}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
