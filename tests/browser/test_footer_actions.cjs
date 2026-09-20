const assert=require('node:assert/strict'),path=require('node:path');
const {harness}=require('./test_glsl_code.cjs');
(async()=>{
 const[source,state,folder]=process.argv.slice(2),h=await harness(source,state,folder,{skipPreview:true}),{page,checks,errors}=h;
 try{
  await page.selectOption('#language','en');
  const menu=page.locator('#editoractionsmenu'),trigger=page.locator('#editormenu');
  assert.equal(await page.locator('footer #reload,footer #editorrefresh').count(),0);
  await trigger.click();assert.equal(await menu.locator('[role="menuitem"]').count(),6);assert.equal(await menu.locator('[role="separator"]').count(),2);
  assert.equal(await menu.locator('.primary').count(),0);
  await page.keyboard.press('Escape');assert.equal(await menu.isVisible(),false);assert.equal(await trigger.evaluate(e=>e===document.activeElement),true);
  checks.push('one vertical-ellipsis footer entry, six text actions and two horizontal separators; Escape returns focus');
  await page.locator('#toggleheader').click();assert.equal(await page.locator('#editorheader').isVisible(),false);
  await trigger.click();await menu.locator('[data-editor-action="export"]').click();assert.equal(await page.locator('#exportdialog').isVisible(),true);await page.locator('#exportdialog').evaluate(e=>e.close());
  await trigger.click();await page.locator('#reload').click();assert.equal(await page.locator('#reloadapplieddialog').isVisible(),true);await page.locator('#reloadappliedcancel').click();
  checks.push('export and applied-graph reload retain their existing dialogs when the title bar is hidden');
  await page.evaluate(()=>{window.forwarded=[];for(const id of ['import','export','save','apply'])$('#'+id).onclick=()=>forwarded.push(id);});
  for(const id of ['import','export','save','apply']){await trigger.click();await menu.locator('[data-editor-action="'+id+'"]').click();}
  assert.deepEqual(await page.evaluate(()=>forwarded),['import','export','save','apply']);
  await trigger.click();await page.evaluate(()=>$('#apply').disabled=true);
  await page.waitForFunction(()=>document.querySelector('[data-editor-action="apply"]').disabled);
  await page.locator('[data-editor-action="apply"]').evaluate(e=>e.click());assert.deepEqual(await page.evaluate(()=>forwarded),['import','export','save','apply']);
  await page.keyboard.press('Escape');await page.evaluate(()=>$('#apply').disabled=false);
  checks.push('header duplicates delegate once to the existing actions and reflect changing disabled state');
  for(const width of [320,1600]){
   await page.setViewportSize({width,height:740});await trigger.click();
   const rect=await menu.boundingBox();assert.ok(rect.x>=0&&rect.y>=0&&rect.x+rect.width<=width+1&&rect.y+rect.height<=740);
   assert.equal(await page.locator('html').evaluate(e=>e.scrollWidth<=innerWidth),true);
   await page.screenshot({path:path.join(folder,'menu-'+width+'.png')});await page.keyboard.press('Escape');
  }
  checks.push('the menu opens within desktop and narrow viewports above its footer anchor');
  assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,count:checks.length}));
 }catch(e){await h.finish(e);throw e;}
})().catch(e=>{console.error(e);process.exitCode=1;});
