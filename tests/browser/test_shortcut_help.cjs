/* Shortcut help and button hints; isolated fixture API, never contacts TD.
 * node test_shortcut_help.cjs SOURCE_DIR STATE_JSON REPORT_DIR */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {harness}=require('./test_glsl_code.cjs');
async function run(){
  const[source,stateFile,folder]=process.argv.slice(2),h=await harness(source,stateFile,folder,{touch:true}),{page,checks,errors,settle}=h;
  page.setDefaultTimeout(6000);
  const panel=()=>page.locator('#shortcutspanel');
  const state=()=>page.evaluate(()=>({graph:JSON.stringify(graph),past:JSON.stringify(past),future:JSON.stringify(future),selection:[...selection],selected,pan:{...pan},scale,stage}));
  const open=async()=>{await page.locator('#uishortcuts').click();await panel().waitFor();await settle();};
  const close=async()=>{await page.locator('#shortcutsclose').click();await settle();};
  try{
    await page.selectOption('#language','en');
    await page.evaluate(()=>{selection=new Set(current().nodes.slice(0,1).map(n=>n.id));selected=[...selection][0];render();});
    const before=await state();
    assert.match(await page.locator('#graphcopy').getAttribute('title'),/^Copy\s+Ctrl＋C$/);
    assert.match(await page.locator('#undo').getAttribute('title'),/Ctrl＋Z$/);
    assert.match(await page.locator('#redo').getAttribute('title'),/Ctrl＋Shift＋Z$/);
    assert.match(await page.locator('#graphpaste').getAttribute('title'),/Ctrl＋V$/);
    assert.match(await page.locator('#fit').getAttribute('title'),/H$/);
    assert.match(await page.locator('#graphup').getAttribute('title'),/Alt＋↑$/);
    assert.match(await page.locator('#graphcopy').getAttribute('aria-keyshortcuts'),/Control\+C/);
    await page.evaluate(()=>{render();render();});
    assert.match(await page.locator('#graphcopy').getAttribute('title'),/^Copy\s+Ctrl＋C$/);
    checks.push('copy/paste/history/navigation tooltips name the action plus the real key chord, expose accessible shortcuts, and survive repeated renders without duplicate suffixes');

    await open();
    assert.equal(await panel().evaluate(e=>e.matches(':modal')),true);
    assert.equal(await page.locator('#uishortcuts').getAttribute('aria-expanded'),'true');
    assert.equal(await panel().evaluate(e=>e.contains(document.activeElement)),true);
    const labels=await page.locator('[data-shortcut]').evaluateAll(rows=>Object.fromEntries(rows.map(e=>[e.dataset.shortcut,e.innerText])));
    assert.ok(labels.redo.includes('Shift'));assert.ok(labels.group.includes('Ctrl'));assert.ok(labels.group.includes('G'));
    assert.ok(labels.delete.includes('Backspace'));assert.ok(labels.menu.includes('F10'));assert.ok(labels.up.includes('↑'));
    assert.equal(await page.locator('[data-shortcut="autoArrange"] dt').innerText(),'Auto arrange');assert.equal(await page.locator('[data-shortcut="autoArrange"] kbd').innerText(),'L');
    assert.equal(Object.values(labels).some(label=>label.includes('Ctrl＋Y')),false);
    for(const key of ['Delete','Control+g','Control+d','Control+a','h','l','Tab'])await page.keyboard.press(key);
    await settle();assert.deepEqual(await state(),before);assert.equal(await page.locator('#creator').isVisible(),false);
    assert.equal(await panel().evaluate(e=>e.contains(document.activeElement)),true);
    checks.push('reference contains existing graph and field commands only; modal help traps focus and graph edit/navigation hotkeys do not leak through');

    await page.keyboard.press('Escape');await settle();assert.equal(await panel().isVisible(),false);
    assert.equal(await page.locator('#uishortcuts').evaluate(e=>e===document.activeElement),true);
    await open();await close();assert.equal(await panel().isVisible(),false);
    await open();await page.mouse.click(4,4);await settle();assert.equal(await panel().isVisible(),false);
    assert.equal(await page.locator('#uishortcuts').getAttribute('aria-expanded'),'false');
    await page.locator('#uitheme').click();await settle();assert.equal(await page.locator('#appearancepanel').isVisible(),true);await open();assert.equal(await page.locator('#appearancepanel').isVisible(),false);
    const p=await panel().boundingBox();await page.mouse.move(p.x+15,p.y+15);await page.mouse.down();await page.mouse.move(4,4);await page.mouse.up();await settle();assert.equal(await panel().isVisible(),true,'drag starting inside must not count as backdrop click');
    await close();checks.push('Escape, close, and complete backdrop clicks dismiss with focus restored; drag-out does not dismiss and opening closes existing popovers');

    await page.selectOption('#language','zh-Hant');await open();assert.equal(await page.locator('#shortcutstitle').innerText(),'快捷鍵');assert.match(await page.locator('#graphcopy').getAttribute('title'),/Ctrl＋C$/);
    assert.equal(await page.locator('[data-shortcut="autoArrange"] dt').innerText(),'自動排列');assert.equal(await page.locator('[data-shortcut="autoArrange"] kbd').innerText(),'L');
    await close();await page.evaluate(()=>{Object.defineProperty(navigator,'platform',{configurable:true,value:'MacIntel'});renderShortcutHelp();});
    assert.match(await page.locator('#graphcopy').getAttribute('title'),/Cmd＋C$/);await open();assert.ok((await page.locator('[data-shortcut="copy"] dd').innerText()).includes('Cmd'));
    await close();await page.evaluate(()=>{delete navigator.platform;renderShortcutHelp();});checks.push('dialog and tooltip labels translate, with Mac Cmd hints derived from the same action metadata');

    await page.evaluate(()=>{selection=new Set(current().nodes.slice(0,2).map(n=>n.id));selected=[...selection].at(-1);selectedEdge=null;readonly=false;historyBusy=false;nativeMutationBusy=false;render();});
    for(const[language,label]of [['en','Auto arrange'],['zh-Hant','自動排列']]){
      await page.selectOption('#language',language);await page.locator('#grapharrange').click();const action=page.locator('[data-arrange="auto"]');
      assert.equal(await action.innerText(),label);assert.equal(await action.getAttribute('title'),label+'　L');assert.equal(await action.getAttribute('aria-label'),label+'　L');assert.equal(await action.getAttribute('aria-keyshortcuts'),'L');
      await page.keyboard.press('Escape');await settle();
    }
    checks.push('auto-arrange menu uses the concise translated label and shared L tooltip/accessible metadata in both languages, matching shortcut help');

    const layouts=[];
    for(const width of [320,390,1600])for(const factor of [75,125])for(const theme of ['dark','light']){
      await page.setViewportSize({width,height:width<500?844:1050});await page.evaluate(({factor,theme})=>{setUIAppearance('scale',factor);setUIAppearance('theme',theme);},{factor,theme});await settle();await open();
      const geometry=await panel().evaluate(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:innerWidth,height:innerHeight,scroll:e.scrollWidth,client:e.clientWidth};});
      const label=JSON.stringify({width,factor,theme,geometry});assert.ok(geometry.x>=0&&geometry.y>=0&&geometry.right<=width+1&&geometry.bottom<=geometry.height+1,label);assert.ok(geometry.scroll<=geometry.client+1,label+' no horizontal scrolling');
      assert.ok(Math.abs((geometry.x+geometry.right)/2-width/2)<=2,label+' centered');
      await page.locator('#shortcutsclose').scrollIntoViewIfNeeded();const button=await page.locator('#shortcutsclose').boundingBox();await page.touchscreen.tap(button.x+button.width/2,button.y+button.height/2);await settle();assert.equal(await panel().isVisible(),false);
      layouts.push({width,factor,theme,...geometry});
    }
    fs.writeFileSync(path.join(folder,'layouts.json'),JSON.stringify(layouts,null,2));checks.push('320/390/1600px viewports at75/125% in both themes fit the modal without horizontal scrolling; close is reachable by touch');
    await page.setViewportSize({width:844,height:390});await page.evaluate(()=>setUIAppearance('scale',125));await open();
    await page.locator('[data-shortcut="textApply"]').scrollIntoViewIfNeeded();
    const reachable=await page.locator('#shortcutsclose').evaluate(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===e;});
    assert.equal(reachable,true,'close remains reachable while the shortcut list scrolls in short landscape');await close();checks.push('only the list scrolls on short screens, keeping the dialog heading and close button reachable');
    await page.setViewportSize({width:1600,height:1050});await page.evaluate(()=>setUIAppearance('scale',100));await open();await page.screenshot({path:path.join(folder,'shortcuts-desktop.png')});await close();
    await page.setViewportSize({width:390,height:844});await open();await page.screenshot({path:path.join(folder,'shortcuts-mobile.png')});await close();
    assert.deepEqual(errors,[]);await h.finish();
  }catch(error){await page.screenshot({path:path.join(folder,'failure.png')}).catch(()=>{});await h.finish(error);throw error;}
}
run().catch(error=>{console.error(error);process.exit(1);});
