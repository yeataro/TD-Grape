/* Upper/lower floating slots retain original pane DOM and graph state. */
const assert=require('node:assert/strict'),path=require('node:path');
const {harness}=require('./test_glsl_code.cjs');
(async()=>{
 const[source,state,folder]=process.argv.slice(2),h=await harness(source,state,folder,{skipPreview:true,touch:true}),{page,checks,errors,settle}=h;
 page.setDefaultTimeout(6000);
 const unchanged=()=>page.evaluate(()=>JSON.stringify({graph,past,future,dirty,pan,scale,layout:workspaceLayout.snapshot()}));
 const show=async id=>{await page.evaluate(id=>workspaceLayout.setFloatingPanel(id,true),id);await settle();};
 const fold=async(id,value)=>{await page.evaluate(({id,value})=>workspaceLayout.setFloatingCollapsed(id,value),{id,value});await settle();};
 try{
  await page.evaluate(()=>{
   nativeSourcePolling=uniformPolling=customPolling=true;uniformLive.disconnect();uniformLive.connect=()=>{};clearTimeout(autoTimer);scheduleGraphApply=()=>{};
   readonly=conflicted=connectionInterrupted=dirty=false;graph.declarations=[];graph.functions=[];stage='pixel';graphTrail=[];
   graph.stages.pixel={nodes:[testNode('value','float',40,80,{value:.3}),testNode('sum','add',350,160)],edges:[]};
   past=[];future=[];selectNode(current().nodes[1]);render();
   window.originalPanes=Object.fromEntries(['parameters','controls','live','help'].map(id=>[id,$('#pane-'+id)]));window.originalPreview=$('#preview');
   const controls=document.createElement('textarea');controls.id='op-draft-probe';controls.value='untouched draft';$('#customcontrols').append(controls);
  });
  const before=await unchanged();
  for(const id of ['parameters','controls','live','help'])assert.equal(await page.locator(`[data-popout-panel=${id}]`).count(),1);
  await page.locator('[data-popout-panel=parameters]').click();await show('help');
  assert.equal(await page.locator('#floatingparameters').isVisible(),true);assert.equal(await page.locator('#floatinghelp').isVisible(),true);
  await show('controls');assert.equal(await page.locator('#floatingparameters').isVisible(),false);assert.equal(await page.locator('#floatingcontrols').isVisible(),true);assert.equal(await page.locator('#floatinghelp').isVisible(),true);
  await show('live');assert.equal(await page.locator('#floatinghelp').isVisible(),false);assert.equal(await page.locator('#floatinglive').isVisible(),true);
  assert.equal(await page.evaluate(()=>Object.entries(originalPanes).every(([id,pane])=>pane===$('#pane-'+id))&&originalPreview===$('#preview')),true);
  assert.equal(await page.locator('#op-draft-probe').inputValue(),'untouched draft');assert.equal(await unchanged(),before);
  checks.push('Four tab popouts reuse original panes; Parameter/OP and Preview/Help compete only within their slot, preserving draft, preview DOM and graph/layout');

  for(const id of ['parameters','controls','live','help']){
   await show(id);const panel=page.locator('#floating'+id),toggle=panel.locator(id==='parameters'?'.floating-parameter-fold':'.floating-heading');
   await toggle.click();await settle();assert.equal(await toggle.getAttribute('aria-expanded'),'false');assert.ok((await panel.boundingBox()).height<50);
   assert.equal(await toggle.evaluate(e=>document.activeElement===e),true);
   assert.equal(await panel.locator('input:visible:not(.node-name-editor input),textarea:visible,select:visible,.parameter-input-port:visible,td-remote-panel:visible').count(),0);
   await toggle.focus();await page.keyboard.press('Enter');await settle();assert.equal(await toggle.getAttribute('aria-expanded'),'true');assert.ok((await panel.boundingBox()).height>50);
  }
  assert.equal(await unchanged(),before);
  checks.push('All four headers collapse to their title, hide controls and sockets, and expand by keyboard without changing node collapse or graph/history');

  await show('parameters');await fold('parameters',true);
  await page.evaluate(()=>{selectNode(current().nodes[0]);inspector();});await settle();assert.equal(await page.locator('#floatingparameters .floating-parameter-fold').getAttribute('aria-expanded'),'false');
  await page.evaluate(()=>{selected=null;selection.clear();inspector();});await settle();assert.equal(await page.locator('#floatingparameters .floating-parameter-fallback').isVisible(),true);
  assert.ok((await page.locator('#floatingparameters').boundingBox()).height<50);await fold('parameters',false);
  await page.evaluate(()=>{selectNode(current().nodes[1]);inspector();});
  assert.equal(await page.locator('#floatingparameters .floating-parameter-fallback').count(),0);assert.equal(await page.locator('#floatingparameters .floating-parameter-fold').count(),1);
  checks.push('Parameter collapse survives selection changes; empty selection has a collapsible fallback title, with no duplicate header on selected nodes');

  await page.evaluate(()=>{const p=document.createElement('div');p.id='long-parameter-probe';p.style.height='1800px';$('#inspector').append(p);});await show('help');
  for(const width of [1600,430])for(const height of [1000,650])for(const ui of [80,100,125]){
   await page.setViewportSize({width,height});await page.evaluate(({width,ui})=>{setUIAppearance('scale',ui);setSidebarOpen('left',width>800);setSidebarOpen('right',width>800);},{width,ui});await settle();
   const geometry=await page.evaluate(()=>{
    const upper=$('#floatingparameters').getBoundingClientRect(),lower=$('#floatinghelp').getBoundingClientRect(),canvas=$('#canvas').getBoundingClientRect(),view=$('.canvas-view-tools').getBoundingClientRect();
    return{gap:lower.top-upper.bottom,want:12*uiScaleFactor(),right:canvas.right-upper.right,aligned:upper.right-lower.right,bottom:lower.bottom,limit:Math.min(canvas.bottom,view.top),scroll:$('#parameterbody').scrollHeight>$('#parameterbody').clientHeight};
   });
   assert.ok(Math.abs(geometry.gap-geometry.want)<2,JSON.stringify({width,height,ui,geometry}));assert.ok(Math.abs(geometry.right-geometry.want)<2);assert.ok(Math.abs(geometry.aligned)<1);
   assert.ok(geometry.bottom<=geometry.limit&&geometry.scroll);if(ui===100)await page.screenshot({path:path.join(folder,`pair-${width}-${height}.png`)});
  }
  checks.push('Twelve desktop/mobile size and UI-scale combinations keep both slots inside the canvas with equal gaps and an internally scrolling upper panel');
  await page.setViewportSize({width:1600,height:1000});await page.evaluate(()=>setUIAppearance('scale',100));await show('live');await settle();
  const available=await page.locator('#floatingparameters').boundingBox(),preview=await page.locator('#floatinglive').boundingBox();assert.ok(preview.height>250);
  await fold('live',true);assert.ok((await page.locator('#floatingparameters').boundingBox()).height>available.height+200);
  await fold('live',false);assert.ok(Math.abs((await page.locator('#floatingparameters').boundingBox()).height-available.height)<2);
  await page.screenshot({path:path.join(folder,'parameter-preview.png')});
  checks.push('Preview retains a useful default height; collapsing and expanding it immediately releases and reclaims upper scrolling space');

  await show('controls');await page.evaluate(()=>{const p=document.createElement('div');p.style.height='1500px';$('#customcontrols').append(p);});await settle();
  assert.equal(await page.locator('#controlsbody').evaluate(e=>e.scrollHeight>e.clientHeight),true);
  await page.locator('#controlsbody').evaluate(e=>e.scrollTop=100);assert.ok(await page.locator('#controlsbody').evaluate(e=>e.scrollTop>0));
  const controlsBefore=await unchanged();await page.locator('#floatingcontrols .floating-heading').focus();await page.keyboard.press('Delete');assert.equal(await unchanged(),controlsBefore);
  await page.evaluate(()=>workspaceLayout.setFloatingPanel('controls',false));await settle();
  const lowerOnly=await page.locator('#floatinglive').boundingBox();assert.ok(lowerOnly.height>250);assert.equal(await page.locator('#floatingparameters').isVisible(),false);
  checks.push('OP Parameters also scroll when space is limited; floating controls block graph Delete, and the lower slot can remain open independently');

  await show('controls');await fold('controls',true);await fold('live',true);await page.reload();await page.waitForSelector('.node');await settle();
  for(const id of ['controls','live'])assert.equal(await page.locator('#floating'+id+' .floating-heading').getAttribute('aria-expanded'),'false');
  assert.equal(await page.locator('#floatingparameters').isVisible(),false);await page.locator('#floatingcontrols .floating-panel-close').click();await settle();
  assert.equal(await page.locator('#parameter-sidebar #pane-controls').count(),1);await page.locator('#controlstoggle').click();assert.equal(await page.locator('#controlsbody').isVisible(),true);
  assert.equal(await page.locator('#controlstoggle .floating-collapse-icon').count(),0);await page.evaluate(()=>{workspaceLayout.setFloatingParameter(true);});await settle();assert.equal(await page.locator('#floatingparameters').isVisible(),true);
  checks.push('Slot and collapse preferences survive reload; close restores normal docked tab behavior and P retains the Parameter slot');
  await page.locator('#workspacelayout').click();const visibility=page.locator('#layoutmenu [role=menuitemcheckbox]').nth(1);await visibility.click();await settle();
  assert.equal(await page.locator('#floatingparameters').isVisible(),false);assert.equal(await visibility.getAttribute('aria-checked'),'false');
  await visibility.click();await page.keyboard.press('Escape');assert.equal(await page.locator('#parameter-sidebar #pane-parameters').isVisible(),true);
  checks.push('The Layout visibility command also hides a floated pane and restores it docked when enabled again');
  assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,checks}));
 }catch(e){await h.finish(e);throw e;}
})().catch(e=>{console.error(e);process.exitCode=1;});
