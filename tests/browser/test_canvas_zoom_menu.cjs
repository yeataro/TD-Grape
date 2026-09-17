/* Isolated canvas zoom menu gestures; never connects to TouchDesigner.
 * node test_canvas_zoom_menu.cjs SOURCE_DIR STATE_JSON REPORT_DIR
 */
const assert=require('node:assert/strict'),path=require('node:path');
const {harness}=require('./test_glsl_code.cjs');
const [source,stateFile,folder]=process.argv.slice(2);
(async()=>{
  const h=await harness(source,stateFile,folder,{touch:true}),{page,checks,errors,settle}=h;
  page.setDefaultTimeout(6000);
  const state=()=>page.evaluate(()=>JSON.stringify({graph,past,future,dirty,selection:[...selection],selected,stage,uiAppearance}));
  const centerWorld=()=>page.evaluate(()=>{const r=$('#canvas').getBoundingClientRect();return graphPoint(r.left+r.width/2,r.top+r.height/2);});
  const close=(a,b)=>assert.ok(Math.abs(a-b)<.1,`${a} != ${b}`);
  const open=async()=>{await page.locator('#zoom').click();await settle();assert.equal(await page.locator('#canvaszoommenu').isVisible(),true);};
  const menuFits=async()=>{
    const r=await page.locator('#canvaszoommenu').boundingBox(),b=await page.locator('#zoom').boundingBox(),viewport=page.viewportSize();
    assert.ok(r.x>=0&&r.y>=0&&r.x+r.width<=viewport.width+1&&r.y+r.height<=b.y+1,JSON.stringify({r,b,viewport}));
  };
  try{
    await page.selectOption('#language','en');
    await page.evaluate(()=>{clearTimeout(autoTimer);connectionInterrupted=true;readonly=false;historyBusy=false;nativeMutationBusy=false;scale=.8;pan={x:38,y:54};transform();});
    assert.equal(await page.locator('#zoom').getAttribute('aria-haspopup'),'menu');assert.equal(await page.locator('#zoom').innerText(),'80%');
    const initial=await state(),view=await page.evaluate(()=>JSON.stringify({pan,scale}));await open();
    assert.equal(await page.locator('#zoom').getAttribute('aria-expanded'),'true');
    assert.deepEqual(await page.locator('#canvaszoommenu button').allTextContents(),['25%','50%','75%','100%','125%','150%','170%']);
    assert.equal(await page.locator('#canvaszoommenu [aria-checked="true"]').count(),0);await menuFits();
    await page.keyboard.press('Escape');await settle();assert.equal(await page.locator('#zoom').getAttribute('aria-expanded'),'false');assert.equal(await page.locator('#zoom').evaluate(e=>e===document.activeElement),true);
    assert.equal(await state(),initial);assert.equal(await page.evaluate(()=>JSON.stringify({pan,scale})),view);
    checks.push('percentage opens upward menu with common stages and existing25–170% endpoints; opening/cancel leaves view and graph unchanged');

    for(const percent of [25,50,75,100,125,150,170]){
      const anchor=await centerWorld();await open();await page.locator(`[data-canvas-zoom="${percent}"]`).click();await settle();
      assert.equal(await page.evaluate(()=>scale),percent/100);assert.equal(await page.locator('#zoom').innerText(),percent+'%');
      const after=await centerWorld();close(after.x,anchor.x);close(after.y,anchor.y);assert.equal(await page.locator('#canvaszoommenu').isVisible(),false);
      await open();assert.equal(await page.locator('#canvaszoommenu [aria-checked="true"]').getAttribute('data-canvas-zoom'),String(percent));await page.keyboard.press('Escape');
    }
    assert.equal(await state(),initial);
    checks.push('all seven presets zoom around the canvas center, reflect the active percentage and preserve graph/history/selection/UI scale');

    await page.locator('#zoom').focus();await page.keyboard.press('ArrowUp');await settle();assert.equal(await page.locator('[data-canvas-zoom="170"]').evaluate(e=>e===document.activeElement),true);
    await page.keyboard.press('Home');assert.equal(await page.locator('[data-canvas-zoom="25"]').evaluate(e=>e===document.activeElement),true);
    await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>scale),.5);
    await page.keyboard.press('Space');await settle();assert.equal(await page.locator('[data-canvas-zoom="50"]').evaluate(e=>e===document.activeElement),true);
    await page.keyboard.press('End');await page.keyboard.press('ArrowUp');await page.keyboard.press('Space');assert.equal(await page.evaluate(()=>scale),1.5);
    await page.keyboard.press('ArrowDown');await page.keyboard.press('Delete');assert.equal(await state(),initial);await page.keyboard.press('Tab');await settle();assert.equal(await page.locator('#canvaszoommenu').isVisible(),false);assert.equal(await page.locator('#fit').evaluate(e=>e===document.activeElement),true);
    checks.push('keyboard Enter/Space/arrows/Home/End select presets; Escape restores focus, Tab advances and graph shortcuts stay isolated');

    await open();const r=await page.locator('#canvas').boundingBox();await page.mouse.click(r.x+r.width/2,r.y+r.height/2);await settle();assert.equal(await page.locator('#canvaszoommenu').isVisible(),false);
    await page.locator('#zoom').tap();await settle();await page.locator('[data-canvas-zoom="100"]').tap();assert.equal(await page.evaluate(()=>scale),1);assert.equal(await page.locator('#canvaszoommenu').isVisible(),false);
    checks.push('click-away dismissal and touch taps open/select the same menu');

    for(const uiScale of [75,125])for(const focused of [false,true]){
      await page.evaluate(({uiScale,focused})=>{setUIAppearance('scale',uiScale);setGraphFocus(focused);},{uiScale,focused});await settle();
      const anchor=await centerWorld();await open();await menuFits();await page.locator('[data-canvas-zoom="75"]').click();await settle();const after=await centerWorld();close(after.x,anchor.x);close(after.y,anchor.y);
      assert.equal(await page.evaluate(()=>graphFocused),focused);assert.equal(await page.evaluate(()=>uiAppearance.scale),uiScale);
    }
    checks.push('75%/125% UI scale and graph focus mode keep upward menu placement and center-anchored graph zoom correct');

    await page.evaluate(()=>{setGraphFocus(false);setUIAppearance('scale',125);});await page.setViewportSize({width:390,height:740});await settle();await open();await menuFits();await page.screenshot({path:path.join(folder,'zoom-menu-mobile.png')});await page.keyboard.press('Escape');
    await page.selectOption('#language','zh-Hant');assert.ok((await page.locator('#zoom').getAttribute('aria-label')).includes('畫布縮放'));
    await page.selectOption('#language','en');assert.ok((await page.locator('#zoom').getAttribute('aria-label')).includes('Canvas zoom'));
    checks.push('mobile menu remains inside viewport and labels translate in both languages');

    await page.setViewportSize({width:1600,height:1100});await page.evaluate(()=>setUIAppearance('scale',100));await settle();
    const canvas=await page.locator('#canvas').boundingBox();await page.mouse.move(canvas.x+canvas.width/2,canvas.y+canvas.height/2);await page.mouse.wheel(0,-10000);await settle();assert.equal(await page.evaluate(()=>scale),1.7);await page.mouse.wheel(0,10000);await settle();assert.equal(await page.evaluate(()=>scale),.25);
    await page.evaluate(()=>{setGraphZoom(1);});await open();await page.screenshot({path:path.join(folder,'zoom-menu-desktop.png')});
    checks.push('wheel zoom retains existing minimum25% and maximum170%');
    assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,count:checks.length}));
  }catch(error){await h.finish(error);throw error;}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
