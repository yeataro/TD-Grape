/* Floating Parameter uses the existing pane and never changes graph or docked group data. */
const assert=require('node:assert/strict'),path=require('node:path');
const {harness}=require('./test_glsl_code.cjs');
(async()=>{
 const[source,state,folder]=process.argv.slice(2),h=await harness(source,state,folder,{skipPreview:true,touch:true}),{page,checks,errors,settle}=h;
 page.setDefaultTimeout(6000);const panel=page.locator('#floatingparameters');
 const unchanged=()=>page.evaluate(()=>JSON.stringify({graph,past,future,dirty,pan,scale,layout:(({floating,...docked})=>docked)(workspaceLayout.snapshot())}));
 const pressP=async()=>{await page.evaluate(()=>focusGraphCanvas());await page.keyboard.press('p');await settle();};
 try{
  await page.evaluate(()=>{
   nativeSourcePolling=uniformPolling=customPolling=true;uniformLive.disconnect();uniformLive.connect=()=>{};clearTimeout(autoTimer);scheduleGraphApply=()=>{};
   readonly=conflicted=connectionInterrupted=dirty=false;graph.declarations=[];graph.functions=[];stage='pixel';graphTrail=[];
   graph.stages.pixel={nodes:[testNode('value','float',40,80,{value:.3}),testNode('vector','vector',350,160,{type:'vec4',components:[.1,.2,.3,.4]})],edges:[]};
   past=[];future=[];selectNode(current().nodes[0]);render();pan={x:10,y:20};scale=.8;transform();
   window.originalParameterPane=$('#pane-parameters');window.originalParameterBody=$('#parameterbody');window.originalParameterParent=originalParameterPane.parentElement;
  });
  assert.equal(await panel.isVisible(),false);const before=await unchanged();await pressP();assert.equal(await panel.isVisible(),true);
  assert.equal(await page.evaluate(()=>$('#floatingparameters>#pane-parameters')===originalParameterPane&&$('#parameterbody')===originalParameterBody),true);
  assert.equal(await page.locator('#parameter-sidebar #pane-parameters').count(),0);assert.equal(await unchanged(),before);
  await pressP();assert.equal(await panel.isVisible(),false);assert.equal(await page.locator('#parameter-sidebar #pane-parameters').count(),1);assert.equal(await unchanged(),before);
  checks.push('P moves the same pane into the canvas and back, without duplicate controls, graph/history/view or docking changes');
  await page.evaluate(()=>{const r=$('#canvas').getBoundingClientRect();openGraphMenu(r.left+150,r.top+160);});
  const item=page.locator('#grapheditmenu [data-edit=floatingParameter]');assert.equal(await item.getAttribute('aria-checked'),'false');assert.match(await item.innerText(),/P/);await item.click();await settle();assert.equal(await panel.isVisible(),true);
  await page.evaluate(()=>{const r=$('#canvas').getBoundingClientRect();openGraphMenu(r.left+150,r.top+160,'value');});assert.equal(await item.getAttribute('aria-checked'),'true');await page.keyboard.press('Escape');
  await page.locator('#floatingparameters .floating-parameter-close').click();assert.equal(await panel.isVisible(),false);
  checks.push('Canvas/node context menus expose the checked P command and the close button restores docking');
  await pressP();const field=page.locator('#inspector [data-parameter-port="$value"][data-parameter-copy=compact]').first();
  await field.fill('0.75');await field.press('Enter');assert.equal(await page.evaluate(()=>current().nodes[0].params.value),.75);assert.equal(await page.evaluate(()=>past.length),1);
  await page.evaluate(()=>undo());assert.equal(await page.evaluate(()=>current().nodes[0].params.value),.3);assert.equal(await panel.isVisible(),true);
  await field.fill('0.42');await page.evaluate(()=>{window.draftField=$('#inspector [data-parameter-port="$value"][data-parameter-copy=compact]');workspaceLayout.setFloatingParameter(false);workspaceLayout.setFloatingParameter(true);});
  assert.equal(await field.inputValue(),'0.42');assert.equal(await field.evaluate(e=>e===draftField),true);await field.press('Escape');
  checks.push('Existing Parameter inputs edit with one Undo transaction and preserve the same draft DOM across floating/docked transitions');
  await page.evaluate(()=>{selectNode(current().nodes[1]);inspector();});assert.equal(await page.locator('#inspector [data-parameter-port="$value"][data-parameter-copy=compact]').count(),4);
  await page.locator('#inspector .parameter-tabs [role=tab]').last().click();const note=page.locator('[data-node-comment]');await note.fill('p');await note.press('p');assert.equal(await panel.isVisible(),true);
  await note.press('Escape');await page.evaluate(()=>{focusGraphCanvas();});
  await page.keyboard.down('p');await page.keyboard.press('p');await page.keyboard.up('p');assert.equal(await panel.isVisible(),false);await pressP();
  await page.locator('#uishortcuts').click();assert.equal(await page.locator('[data-shortcut=floatingParameter] kbd').innerText(),'P');await page.keyboard.press('p');assert.equal(await panel.isVisible(),true);await page.keyboard.press('Escape');
  for(const key of ['Control+p','Alt+p','Shift+p']){await page.evaluate(()=>focusGraphCanvas());await page.keyboard.press(key);assert.equal(await panel.isVisible(),true);}
  checks.push('Selection and inspector tabs update in place; P ignores text fields, dialogs, modifiers and key repeats');
  await page.evaluate(()=>{readonly=true;inspectorTab='parameters';inspector();});assert.equal(await page.locator('#inspector [data-parameter-port="$value"]').first().isDisabled(),true);
  await pressP();await pressP();assert.equal(await panel.isVisible(),true);
  const stable=await unchanged(),bounds=await panel.boundingBox();await page.mouse.move(bounds.x+90,bounds.y+16);await page.mouse.down();await page.mouse.move(bounds.x+160,bounds.y+90,{steps:5});await page.mouse.up();assert.equal(await unchanged(),stable);assert.deepEqual(await panel.boundingBox(),bounds);
  await page.mouse.move(bounds.x+50,bounds.y+60);await page.mouse.wheel(0,150);await settle();assert.equal(await unchanged(),stable);
  checks.push('Readonly still opens; header dragging and panel wheel do not move the panel or canvas');
  await page.evaluate(()=>{readonly=false;inspectorTab='parameters';selectNode(current().nodes[0]);inspector();});await settle();const short=await panel.boundingBox();
  await page.evaluate(()=>{const n=document.createElement('div');n.id='floating-content-probe';n.style.height='1800px';$('#inspector').append(n);});await settle();
  assert.ok((await panel.boundingBox()).height>short.height+50);assert.ok(await page.locator('#parameterbody').evaluate(e=>e.scrollHeight>e.clientHeight));
  await page.locator('#parameterbody').evaluate(e=>e.scrollTop=200);assert.ok(await page.locator('#parameterbody').evaluate(e=>e.scrollTop>0));
  await page.evaluate(()=>$('#floating-content-probe').remove());await settle();assert.ok(Math.abs((await panel.boundingBox()).height-short.height)<2);
  checks.push('Height follows short content and shrinks back; long content caps at available canvas height and scrolls inside');
  for(const width of [1600,430,320])for(const ui of [80,100,125])for(const theme of ['dark','light'])for(const size of ['standard','comfortable']){
   await page.setViewportSize({width,height:932});await page.evaluate(({ui,theme,width,size})=>{uiAppearance.scale=ui;uiAppearance.theme=theme;uiAppearance.size=size;renderUIAppearance();setSidebarOpen('left',width>800);setSidebarOpen('right',width>800);},{ui,theme,width,size});await settle();
   const geometry=await page.evaluate(()=>{
    const panel=$('#floatingparameters').getBoundingClientRect(),canvas=$('#canvas').getBoundingClientRect(),buttons=[...$('.graph-workspace .toolbar').querySelectorAll('.graph-tools button,.graph-tools select')].filter(b=>b.getClientRects().length&&!b.closest('[popover]')).map(b=>b.getBoundingClientRect()),bottom=Math.max(...buttons.map(b=>b.bottom));
    return{right:canvas.right-panel.right,top:panel.top-bottom,toolsRight:canvas.right-Math.max(...buttons.map(b=>b.right)),toolsTop:Math.min(...buttons.map(b=>b.top))-canvas.top,gap:12*uiScaleFactor(),width:panel.width,maxWidth:canvas.width,bottom:panel.bottom,canvasBottom:canvas.bottom,radius:getComputedStyle($('#floatingparameters')).borderRadius,toolbarRadius:getComputedStyle($('.selection-toolbar')).borderRadius};
   });
   assert.ok(Math.abs(geometry.right-geometry.gap)<1.5,JSON.stringify({width,ui,theme,geometry}));assert.ok(Math.abs(geometry.top-geometry.gap)<1.5,JSON.stringify({width,ui,theme,geometry}));
   assert.ok(Math.abs(geometry.toolsRight-geometry.right)<1.5,JSON.stringify({width,ui,theme,size,geometry}));assert.ok(Math.abs(geometry.toolsTop-geometry.top)<1.5,JSON.stringify({width,ui,theme,size,geometry}));
   assert.ok(geometry.width<=geometry.maxWidth&&geometry.bottom<=geometry.canvasBottom+1);assert.equal(geometry.radius,geometry.toolbarRadius);
   if(ui===100){await page.locator('.floating-parameter-close').hover();await page.screenshot({path:path.join(folder,`panel-${width}-${theme}-${size}.png`)});}
  }
  checks.push('Toolbar top/right and Parameter top/right gaps match across 36 viewport/scale/theme/density combinations; editing toolbar radius matches');
  await page.setViewportSize({width:430,height:932});await page.evaluate(()=>{setUIAppearance('scale',100);setUIExperiments({floatingToolbar:false});});await settle();
  assert.ok(await panel.evaluate(e=>{const a=e.getBoundingClientRect(),b=$('#canvas').getBoundingClientRect();return a.top>=b.top&&a.right<=b.right;}));
  await page.evaluate(()=>{setUIExperiments({floatingToolbar:true});const n=document.createElement('div');n.id='touch-scroll-probe';n.style.height='1800px';$('#inspector').append(n);});await settle();
  const touchState=await unchanged(),body=await page.locator('#parameterbody').boundingBox(),cdp=await page.context().newCDPSession(page),tx=body.x+body.width/2,ty=body.y+body.height-45;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:tx,y:ty}]});
  for(let i=1;i<=5;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x:tx,y:ty-i*25}]});await settle();}
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await settle();
  assert.ok(await page.locator('#parameterbody').evaluate(e=>e.scrollTop>0));assert.equal(await unchanged(),touchState);
  await page.evaluate(()=>$('#touch-scroll-probe').remove());await settle();const close=await page.locator('#floatingparameters .floating-parameter-close').boundingBox();await page.touchscreen.tap(close.x+close.width/2,close.y+close.height/2);await settle();assert.equal(await panel.isVisible(),false);await pressP();
  checks.push('Docked toolbar stays clear; real touch scroll stays within Parameter and touch close restores the pane without moving the graph');
  const resize=page.locator('.floating-parameter-resize'),startWidth=await panel.boundingBox(),resizeState=await unchanged(),grip=await resize.boundingBox();
  await page.mouse.move(grip.x+3,grip.y+20);await page.mouse.down();await page.mouse.move(grip.x-77,grip.y+20);await page.mouse.up();await settle();
  let resized=await panel.boundingBox();assert.ok(Math.abs(resized.width-startWidth.width-80)<1);assert.ok(Math.abs(resized.x+resized.width-startWidth.x-startWidth.width)<1);assert.equal(await unchanged(),resizeState);
  const grip2=await resize.boundingBox();await page.mouse.move(grip2.x+3,grip2.y+20);await page.mouse.down();await page.mouse.move(grip2.x+350,grip2.y+20);await page.mouse.up();await settle();assert.ok(Math.abs((await panel.boundingBox()).width-280)<1);
  await resize.focus();await page.keyboard.press('ArrowLeft');assert.ok(Math.abs((await panel.boundingBox()).width-288)<1);await page.keyboard.press('Home');assert.ok(Math.abs((await panel.boundingBox()).width-280)<1);
  const touchGrip=await resize.boundingBox(),gx=touchGrip.x+3,gy=touchGrip.y+20;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:gx,y:gy}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x:gx-60,y:gy}]});await settle();assert.ok(Math.abs((await panel.boundingBox()).width-340)<1);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await settle();assert.ok(Math.abs((await panel.boundingBox()).width-280)<1);
  await resize.focus();for(let i=0;i<5;i++)await page.keyboard.press('ArrowLeft');assert.ok(Math.abs((await panel.boundingBox()).width-320)<1);assert.equal(await unchanged(),resizeState);
  checks.push('Mouse/touch and keyboard resize only width, keep the right anchor and graph intact, enforce 280 minimum, and roll back cancelled touch');
  await page.evaluate(()=>{workspaceLayout.move('parameters','left',null);workspaceLayout.translate();});assert.equal(await panel.isVisible(),true);await pressP();assert.equal(await page.locator('#sidebar-left #pane-parameters').count(),1);await pressP();
  await resize.focus();await page.keyboard.press('ArrowLeft');await page.reload();await page.waitForSelector('.node');await settle();assert.equal(await panel.isVisible(),true);assert.ok(Math.abs((await panel.boundingBox()).width-328)<1);await pressP();assert.equal(await page.locator('#sidebar-left #pane-parameters').count(),1);
  checks.push('Workspace moves and translations keep the floated pane; reload restores its preference and closing uses the saved docking location');
  assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,checks}));
 }catch(e){await h.finish(e);throw e;}
})().catch(e=>{console.error(e);process.exitCode=1;});
