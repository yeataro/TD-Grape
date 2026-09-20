/* Local source deletion shares the confirmation UI and preserves references. */
const assert=require('node:assert/strict');
const {harness}=require('./test_glsl_code.cjs');
(async()=>{
 const [source,stateFile,folder]=process.argv.slice(2),h=await harness(source,stateFile,folder,{skipPreview:true}),{page,checks,errors,settle}=h;
 const card=()=>page.locator('[data-input-source="constant"]');
 const menuAction=async label=>{await card().locator('.source-card-menu-button').click();await page.locator('#sourcecardmenu').getByRole('menuitem',{name:label,exact:true}).click();};
 const accept=async()=>{await page.locator('.confirmation-dialog .danger').click();await page.locator('.confirmation-dialog').waitFor({state:'detached'});await settle();};
 const setup=async used=>{await page.evaluate(used=>{
  clearTimeout(autoTimer);connectionInterrupted=true;conflicted=false;readonly=false;nativeSourcePolling=uniformPolling=customPolling=true;
  uniformLive.disconnect();uniformLive.connect=()=>{};graphTrail=[];graph.functions=[];graph.declarations=[{id:'constant',kind:'constant',type:'float',name:'cValue',value:.5}];
  stage='pixel';graph.stages.pixel={nodes:[testNode('output','pixel_out',420,100)],edges:[]};graph.stages.vertex={nodes:[],edges:[]};
  if(used){graph.stages.pixel.nodes.push(testNode('ref','constant',40,100,{declarationId:'constant'}));graph.stages.pixel.edges.push({from:['ref',Object.keys(ports(graph.stages.pixel.nodes.at(-1),'outputs'))[0]],to:['output','color']});}
  selected=null;selectedInputId=null;selection.clear();past=[];future=[];dirty=false;nativeSourceSnapshot={revision,enabled:true,uniforms:[],issues:[]};sourceCardCache.clear();render();inputCollapsedGroups.clear();workspaceLayout.reveal('uniforms');
 },used);await settle();};
 try{
  await page.locator('#language').selectOption('en');await setup(false);
  assert.equal(await card().locator('.source-card-meta').count(),0);assert.equal(await card().locator('.port-row.output').count(),1);
  await menuAction('Remove source');await page.keyboard.press('Escape');await page.locator('.confirmation-dialog').waitFor({state:'detached'});
  assert.equal(await page.evaluate(()=>graph.declarations.length),1);assert.equal(await page.evaluate(()=>past.length),0);
  await menuAction('Remove source');await accept();assert.equal(await page.evaluate(()=>graph.declarations.length),0);assert.equal(await page.evaluate(()=>past.length),1);
  await page.evaluate(()=>undo());await settle();assert.equal(await card().count(),1);
  checks.push('established cards omit guidance; unused constant removal confirms, cancels safely and creates one undoable edit');
  await card().locator('.input-source-select').click();await page.locator('[data-input-remove="constant"]').click();await accept();assert.equal(await page.evaluate(()=>graph.declarations.length),0);
  checks.push('Parameter and source menu use the same local removal action');
  await setup(true);const before=await page.evaluate(()=>JSON.stringify(graph.stages));await menuAction('Remove source');
  assert.match(await page.locator('#confirmation-message').innerText(),/1 graph references/);await accept();
  assert.equal(await page.evaluate(()=>graph.declarations[0].sourceMissing),true);assert.equal(await page.evaluate(()=>JSON.stringify(graph.stages)),before);
  assert.equal(await card().locator('[data-input-reference]').isDisabled(),true);assert.equal(await card().getAttribute('data-source-state'),'missing');
  await menuAction('Restore source');assert.equal(await page.evaluate(()=>!!graph.declarations[0].sourceMissing),false);assert.equal(await page.evaluate(()=>JSON.stringify(graph.stages)),before);
  await page.evaluate(()=>undo());assert.equal(await page.evaluate(()=>graph.declarations[0].sourceMissing),true);await page.evaluate(()=>undo());assert.equal(await page.evaluate(()=>!!graph.declarations[0].sourceMissing),false);
  checks.push('referenced deletion retains nodes/wires with missing-source state; restore and undo preserve identity');
  await setup(false);await menuAction('Remove source');await page.evaluate(()=>editorLoadGeneration++);await accept();assert.equal(await page.evaluate(()=>graph.declarations.length),1);
  await menuAction('Remove source');await page.evaluate(()=>graph.stages.pixel.nodes.push(testNode('newRef','constant',40,100,{declarationId:'constant'})));await accept();assert.equal(await page.evaluate(()=>!!graph.declarations[0].sourceMissing),false);
  await page.evaluate(()=>{readonly=true;render();});await card().locator('.source-card-menu-button').click();assert.equal(await page.locator('#sourcecardmenu').getByRole('menuitem',{name:'Remove source',exact:true}).isDisabled(),true);
  checks.push('stale context or changed reference count cancels deletion; readonly disables it');
  assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,checks}));
 }catch(error){await h.finish(error);throw error;}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
