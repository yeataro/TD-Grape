/* Layout presets and transfers include floating panels; isolated from TD. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {harness}=require('./test_glsl_code.cjs');
(async()=>{
 const[source,state,folder]=process.argv.slice(2),h=await harness(source,state,folder,{skipPreview:true,touch:true}),{page,checks,errors,settle}=h;
 page.setDefaultTimeout(6000);
 const snapshot=()=>page.evaluate(()=>workspaceLayout.snapshot());
 const preset=async name=>{await page.locator('#workspacelayout').click();await page.getByRole('menuitem',{name,exact:true}).click();await settle();};
 const close=()=>page.locator('#layoutdialog').getByRole('button',{name:'Close',exact:true}).click();
 const save=async name=>{await page.evaluate(()=>workspaceLayout.manager());await page.locator('#layoutname').fill(name);await page.getByRole('button',{name:'Save layout',exact:true}).click();await close();};
 const stable=()=>page.evaluate(()=>JSON.stringify({graph,past,future,dirty,pan,scale,revision}));
 const visible=()=>page.evaluate(()=>({header:!$('#editorheader').hidden,left:isSidebarOpen('left'),right:isSidebarOpen('right'),floats:['parameters','controls','live','help'].filter(id=>!$('#floating'+id).hidden)}));
 try{
  await page.selectOption('#language','en');
  await page.evaluate(()=>{
   nativeSourcePolling=uniformPolling=customPolling=true;uniformLive.disconnect();uniformLive.connect=()=>{};clearTimeout(autoTimer);scheduleGraphApply=()=>{};
   readonly=conflicted=connectionInterrupted=dirty=false;stage='pixel';graphTrail=[];
   graph.stages.pixel={nodes:[testNode('sum','add',40,80)],edges:[]};past=[];future=[];selectNode(current().nodes[0]);render();pan={x:30,y:50};scale=1;transform();
   window.originalPanes=Object.fromEntries(['parameters','controls','live','help'].map(id=>[id,$('#pane-'+id)]));window.originalPreview=$('#preview');
   const draft=document.createElement('textarea');draft.id='layout-draft';draft.value='keep pending text';$('#customcontrols').append(draft);
  });
  const initial=await stable();assert.deepEqual(await visible(),{header:true,left:true,right:true,floats:[]});
  await preset('Minimal');
  assert.deepEqual(await visible(),{header:false,left:false,right:false,floats:['parameters','live']});
  for(const id of ['parameters','live'])assert.equal(await page.locator('#floating'+id).evaluate(e=>e.classList.contains('is-collapsed')),false);
  await page.screenshot({path:path.join(folder,'minimal.png')});
  assert.equal(await stable(),initial);checks.push('Minimal is optional; hides header and both sidebars, opens expanded Parameter and Preview without changing graph/history/view');

  await page.locator('.floating-parameter-resize').focus();for(let i=0;i<5;i++)await page.keyboard.press('ArrowLeft');
  await page.locator('#floatinglive .floating-panel-resize-both').focus();await page.keyboard.press('ArrowLeft');await page.keyboard.press('ArrowUp');
  await page.evaluate(()=>{workspaceLayout.setFloatingCollapsed('parameters',true);workspaceLayout.setFloatingCollapsed('live',true);});
  await save('My floating layout');const saved=await snapshot();
  assert.equal(saved.floating.parameterWidth,360);assert.deepEqual(saved.floating.lowerSize,{width:328,height:328});
  await preset('Default layout');assert.deepEqual(await visible(),{header:true,left:true,right:true,floats:[]});
  assert.equal(await page.locator('#parameter-sidebar #pane-parameters').count(),1);
  await page.evaluate(()=>{workspaceLayout.setFloatingPanel('controls',true);workspaceLayout.setFloatingPanel('help',true);workspaceLayout.setFloatingCollapsed('help',true);});
  await save('Alternate viewers');const alternate=await snapshot();
  await preset('My floating layout');assert.deepEqual(await snapshot(),saved);
  await preset('Alternate viewers');assert.deepEqual(await snapshot(),alternate);
  await preset('My floating layout');
  assert.equal(await page.evaluate(()=>Object.entries(originalPanes).every(([id,pane])=>pane===$('#pane-'+id))&&originalPreview===$('#preview')),true);
  assert.equal(await page.locator('#layout-draft').inputValue(),'keep pending text');assert.equal(await stable(),initial);
  checks.push('Named presets restore slot competition, per-panel collapse, preferred sizes and header; Default closes every float; pane/preview DOM and drafts survive');

  await page.evaluate(()=>workspaceLayout.manager());
  const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Export current layout',exact:true}).click()]);
  const file=path.join(folder,'floating-layout.json');await download.saveAs(file);assert.deepEqual(JSON.parse(fs.readFileSync(file)).current,saved);
  await page.getByRole('button',{name:'Restore default',exact:true}).click();
  await page.locator('#layoutdialog input[type=file]').setInputFiles(file);await page.waitForFunction(()=>!$('#floatingparameters').hidden);
  assert.deepEqual(await snapshot(),saved);await close();
  await page.reload();await page.waitForSelector('.node');await settle();assert.deepEqual(await snapshot(),saved);
  for(const id of ['parameters','live'])assert.equal(await page.locator('#floating'+id).evaluate(e=>e.classList.contains('is-collapsed')),true);
  await page.evaluate(()=>{workspaceLayout.setFloatingCollapsed('parameters',false);workspaceLayout.setFloatingCollapsed('live',false);});await settle();
  assert.ok(Math.abs((await page.locator('#floatingparameters').boundingBox()).width-360)<1);
  assert.ok(Math.abs((await page.locator('#floatinglive').boundingBox()).height-328)<1);
  checks.push('JSON export/import and page reload retain float state and preferred dimensions, including sizes while collapsed');

  await page.locator('#toggleheader').click();assert.equal((await snapshot()).visibility.header,true);
  await page.evaluate(()=>workspaceLayout.manager());
  await page.locator('.layout-preset').filter({hasText:'My floating layout'}).getByRole('button',{name:'Update',exact:true}).click();await close();
  await preset('Minimal');await preset('My floating layout');assert.equal((await visible()).header,true);
  for(const language of ['zh-Hant','ja','fr','ko','en']){
   await page.selectOption('#language',language);await page.locator('#workspacelayout').click();assert.equal(await page.getByRole('menuitem',{name:'Minimal',exact:true}).count(),1);await page.keyboard.press('Escape');
  }
  await page.evaluate(()=>workspaceLayout.manager());await page.locator('.layout-preset').filter({hasText:'Minimal'}).getByRole('button',{name:'Apply',exact:true}).click();await close();
  assert.deepEqual(await visible(),{header:false,left:false,right:false,floats:['parameters','live']});
  checks.push('Header toggle is captured by preset Update; Minimal is available in the menu and manager in all five languages');

  const beforeInvalid=await snapshot(),storageBefore=await page.evaluate(()=>localStorage.getItem('grapeWorkspaceV1'));
  assert.equal(await page.evaluate(()=>{const layout=workspaceLayout.snapshot();layout.floating.upper='browser';try{workspaceLayout.apply(layout);return false;}catch{return true;}}),true);
  assert.deepEqual(await snapshot(),beforeInvalid);assert.equal(await page.evaluate(()=>localStorage.getItem('grapeWorkspaceV1')),storageBefore);
  await page.evaluate(()=>{const layout=workspaceLayout.snapshot();delete layout.floating;delete layout.visibility.header;workspaceLayout.apply(layout);});
  assert.deepEqual((await visible()).floats,[]);assert.equal((await visible()).header,true);
  await page.evaluate(()=>{const layout=workspaceLayout.snapshot();layout.floating.upper='parameters';layout.hidden.push('parameters');workspaceLayout.apply(layout);});
  assert.deepEqual((await visible()).floats,[]);
  await page.evaluate(()=>workspaceLayout.setFloatingParameter(true));assert.equal((await snapshot()).hidden.includes('parameters'),false);
  checks.push('Invalid floating slots fail atomically; old layouts default to closed floats and a visible header; hidden panels cannot remain floating');

  await page.setViewportSize({width:430,height:850});await page.evaluate(()=>{setUIAppearance('scale',75);setSidebarOpen('right',true);});
  await preset('Minimal');assert.deepEqual(await visible(),{header:false,left:false,right:false,floats:['parameters','live']});
  const geometry=await page.evaluate(()=>{const a=$('#floatingparameters').getBoundingClientRect(),b=$('#floatinglive').getBoundingClientRect(),c=$('#canvas').getBoundingClientRect();return{gap:b.top-a.bottom,inset:12*uiScaleFactor(),right:a.right<=c.right&&b.right<=c.right,left:a.left>=c.left&&b.left>=c.left,overflow:document.documentElement.scrollWidth>innerWidth};});
  assert.ok(geometry.gap>=geometry.inset-1&&geometry.left&&geometry.right&&!geometry.overflow,JSON.stringify(geometry));
  await page.screenshot({path:path.join(folder,'minimal-mobile.png')});
  await page.setViewportSize({width:1600,height:1100});await settle();assert.equal((await visible()).left,false);assert.equal((await visible()).right,false);
  checks.push('Minimal closes mobile overlays, fits both floats at 75% UI scale and retains collapsed sidebars when returning to desktop');

  await page.evaluate(()=>{
   const layout=workspaceLayout.snapshot();delete layout.floating;delete layout.visibility.header;localStorage.setItem('grapeWorkspaceV1',JSON.stringify(layout));
   localStorage.setItem('sgrapeHeaderVisible','false');localStorage.setItem('grapeFloatingPanelsV1',JSON.stringify({upper:'controls',lower:'help',collapsed:{help:true}}));
   localStorage.setItem('grapeFloatingParameterWidth','400');localStorage.setItem('grapeFloatingLowerSize',JSON.stringify({width:380,height:260}));
  });
  await page.reload();await page.waitForSelector('.node');await settle();
  assert.deepEqual((await visible()).floats,['controls','help']);const migrated=await snapshot();
  assert.equal(migrated.visibility.header,false);assert.equal(migrated.floating.parameterWidth,400);assert.deepEqual(migrated.floating.lowerSize,{width:380,height:260});assert.equal(migrated.floating.collapsed.help,true);
  await page.evaluate(()=>{localStorage.setItem('grapeFloatingPanelsV1','{}');localStorage.setItem('sgrapeHeaderVisible','true');});
  await page.reload();await page.waitForSelector('.node');await settle();assert.deepEqual(await snapshot(),migrated);
  checks.push('Existing browser preferences migrate once into the current workspace; stale legacy keys cannot override the saved layout');
  assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,checks}));
 }catch(e){await h.finish(e);throw e;}
})().catch(e=>{console.error(e);process.exitCode=1;});
