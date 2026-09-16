/* Isolated chrome layout and reload protection; never connects to TD. */
const assert=require('node:assert/strict'),path=require('node:path');
const {harness}=require('./test_glsl_code.cjs');
async function run(){
  const [source,stateFile,folder]=process.argv.slice(2),h=await harness(source,stateFile,folder),{page,checks,errors,settle}=h;
  try{
    await page.selectOption('#language','en');
    assert.equal(await page.locator('footer #dirty').count(),1);assert.equal(await page.locator('.location-bar #dirty').count(),0);
    assert.equal(await page.locator('footer > #editorrefresh:first-child + #dirty').count(),1);
    assert.ok(await page.evaluate(()=>{const bar=$('.location-bar').getBoundingClientRect(),toggle=$('#toggleheader').getBoundingClientRect();return Math.abs(toggle.x+toggle.width/2-bar.x-bar.width/2)<1;}));
    assert.equal(await page.locator('.graph-tool-group').count(),4);
    assert.deepEqual(await page.locator('.graph-tool-group').evaluateAll(groups=>groups.map(g=>[...g.querySelectorAll('button')].map(b=>b.id))),[['undo','redo'],['graphcopy','graphpaste','graphgroup','graphdelete'],['fit','boxselect'],['code']]);
    assert.equal(await page.locator('#editorheader #about').innerText(),'About');
    const desktopFooter=await page.locator('footer').boundingBox();assert.equal(desktopFooter.height,30);
    const heights=await page.locator('#editorheader .actions button,#editorheader .actions select').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().height));
    assert.ok(heights.every(h=>h===heights[0]),heights.join(','));
    await page.screenshot({path:path.join(folder,'desktop.png')});
    await page.setViewportSize({width:960,height:780});await settle();
    for(const group of await page.locator('.graph-tool-group').all()){
      const tops=await group.locator('button').evaluateAll(es=>es.map(e=>Math.round(e.getBoundingClientRect().top)));
      assert.ok(tops.every(y=>y===tops[0]),tops.join(','));
    }
    assert.ok(await page.locator('.toolbar').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
    await page.screenshot({path:path.join(folder,'half-width.png')});
    checks.push('four intact toolbar groups, separate graph path, equal header controls and compact persistent footer fit desktop and half width');
    const canvasBefore=(await page.locator('#canvas').boundingBox()).height;
    await page.locator('#toggleheader').click();await settle();
    assert.equal(await page.locator('#editorheader').isVisible(),false);assert.equal(await page.locator('footer').isVisible(),true);
    assert.equal(await page.locator('#toggleheader').getAttribute('aria-expanded'),'false');
    assert.ok((await page.locator('#canvas').boundingBox()).height>canvasBefore);
    await page.locator('#toggleheader').click();assert.equal(await page.locator('#editorheader').isVisible(),true);
    checks.push('header collapses and reopens from the second row without hiding footer');
    await page.evaluate(()=>{dirty=true;renderGraphSaveState();status('compile fixture',true,{kind:'compile'});});
    const badge=await page.locator('#dirty').innerText();await page.locator('#fit').click();
    await page.evaluate(()=>status('native source updated',false,{clearError:'operation'}));
    assert.equal(await page.locator('#status').innerText(),'compile fixture');assert.equal(await page.locator('#dirty').innerText(),badge);
    await page.evaluate(()=>status('Shader applied',false,{clearError:'compile'}));assert.equal(await page.locator('#status').innerText(),'Shader applied');
    await page.evaluate(()=>status('old operation failure',true));await page.evaluate(()=>load());
    assert.equal(await page.locator('#status').evaluate(e=>e.classList.contains('error')),false);
    checks.push('temporary operations do not cover persistent state or compile errors; matching recovery and successful reload clear errors');
    for(const key of ['graph.saved','graph.applied']){
      await page.evaluate(key=>{dirty=false;lastGraphSaveKey=key;renderGraphSaveState();status(t(key),false,{clearError:true});},key);
      assert.equal(await page.locator('#status').isVisible(),false);assert.equal(await page.locator('#dirty').isVisible(),true);
    }
    checks.push('applied and graph-saved messages appear once while their persistent badge stays visible');
    await page.evaluate(()=>{
      clearTimeout(autoTimer);connectionInterrupted=true;graph.declarations=[];graph.functions=[];stage='pixel';graphTrail=[];
      graph.stages.pixel={nodes:[testNode('value','float',100,100,{value:1}),testNode('pixel','pixel_out',400,100)],edges:[]};
      selected='value';selection=new Set(['value']);dirty=false;rememberSavedGraph(graph);render();scale=1;pan={x:0,y:0};transform();
    });
    const entry=page.locator('[data-inline-node="value"]'),origin=await page.evaluate(()=>performance.timeOrigin);
    await entry.fill('12.5');await page.locator('#editorrefresh').click();
    assert.equal(await page.evaluate(()=>performance.timeOrigin),origin);assert.equal(await entry.inputValue(),'12.5');
    assert.equal(await page.evaluate(()=>graph.stages.pixel.nodes[0].params.value),1);
    assert.equal(await entry.evaluate(e=>document.activeElement===e),true);
    await entry.press('Enter');assert.equal(await page.evaluate(()=>graph.stages.pixel.nodes[0].params.value),12.5);
    assert.equal(await page.locator('#status').evaluate(e=>e.classList.contains('error')),false);
    await entry.fill('');await page.locator('#editorrefresh').click();assert.equal(await entry.inputValue(),'');assert.equal(await page.evaluate(()=>performance.timeOrigin),origin);
    await entry.fill('12.5');await entry.press('Enter');
    checks.push('uncommitted or empty numeric field blocks refresh without blur/loss; committing resolves the notice');
    for(const flag of ['customBusy','personalBusy']){
      assert.equal(await page.evaluate(flag=>{eval(flag+'=true');const result=requestEditorReload();eval(flag+'=false');return result;},flag),false);
    }
    let releaseWrite,startedWrite;
    const started=new Promise(resolve=>startedWrite=resolve);
    await page.route('**/api/save',async route=>{startedWrite();await new Promise(resolve=>releaseWrite=resolve);await route.fulfill({json:{saved:true}});});
    await page.evaluate(()=>{window.chromeSave=api('save',{});});await started;
    assert.equal(await page.evaluate(()=>pendingEditorWrites),1);
    assert.equal(await page.evaluate(()=>requestEditorReload()),false);
    releaseWrite();await page.evaluate(()=>chromeSave);assert.equal(await page.evaluate(()=>pendingEditorWrites),0);
    await page.evaluate(()=>{connectionInterrupted=true;});
    checks.push('custom/personal mutations and an in-flight save POST block reload until completion');
    await page.evaluate(()=>{
      const modal=document.createElement('dialog'),input=document.createElement('input');input.id='chrome-modal-field';modal.append(input);document.body.append(modal);
      window.chromeTestModal=modal;modal.showModal();
    });
    await page.locator('#chrome-modal-field').fill('unsubmitted name');await page.locator('#chrome-modal-field').press('Tab');
    // Generic input() may commit its local field on blur while the dialog still awaits Save.
    await page.evaluate(()=>chromeTestModal.querySelector('input').hasPendingEdit=()=>false);
    assert.equal(await page.evaluate(()=>pendingEditorField()===chromeTestModal.querySelector('input')),true);
    await page.evaluate(()=>chromeTestModal.close());assert.equal(await page.evaluate(()=>!!pendingEditorField()),false);
    checks.push('a canceled modal draft does not block page reload');
    await page.evaluate(()=>{
      window.originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw Error('fixture storage full');};
    });
    assert.equal(await page.evaluate(()=>requestEditorReload()),false);assert.equal(await page.evaluate(()=>performance.timeOrigin),origin);
    assert.match(await page.locator('#status').innerText(),/could not be retained/);
    await page.evaluate(()=>{Storage.prototype.setItem=originalSetItem;window.originalConfirm=window.confirm;window.confirm=()=>false;});
    assert.equal(await page.evaluate(()=>requestEditorReload()),false);
    assert.equal(await page.evaluate(()=>JSON.parse(sessionStorage.getItem(draftKey)).graph.stages.pixel.nodes[0].params.value),12.5);
    checks.push('storage failure cancels reload; canceling reload retains the exact graph draft');
    await page.route('**/api/inspect',async route=>{
      const data=route.request().postDataJSON();await route.fulfill({json:{status:'valid',target:'top',candidate:data.graph,issues:[],repairs:[]}});
    });
    page.on('dialog',dialog=>dialog.accept());await page.evaluate(()=>window.confirm=window.originalConfirm);
    await page.locator('#toggleheader').click();await page.locator('#editorrefresh').click();
    await page.waitForFunction(previous=>performance.timeOrigin!==previous,origin,{timeout:10000});await page.locator('#importreview[open]').waitFor();
    assert.equal(await page.locator('#editorheader').isVisible(),false);assert.equal(await page.locator('footer').isVisible(),true);
    assert.equal(await page.evaluate(()=>importReview.candidate.stages.pixel.nodes[0].params.value),12.5);
    await page.evaluate(()=>{clearTimeout(autoTimer);connectionInterrupted=true;});
    await page.locator('#importaccept').click();assert.equal(await page.evaluate(()=>graph.stages.pixel.nodes[0].params.value),12.5);
    checks.push('full page reload retains hidden-header choice and offers the exact tab draft for explicit restore');
    const mobile=await h.browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
    mobile.on('pageerror',e=>errors.push(e.message));await mobile.goto(page.url());await mobile.waitForSelector('.node');
    await mobile.selectOption('#language','en');await mobile.evaluate(()=>{clearTimeout(autoTimer);connectionInterrupted=true;});
    const sizes=await mobile.locator('.toolbar button:not([hidden])').evaluateAll(es=>es.filter(e=>e.getClientRects().length).map(e=>e.getBoundingClientRect().height));
    assert.ok(sizes.every(v=>v===34),sizes.join(','));
    assert.ok(await mobile.locator('body').evaluate(e=>e.scrollWidth<=innerWidth+1));
    assert.ok(await mobile.locator('.toolbar').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
    assert.equal(await mobile.locator('#about').isVisible(),true);
    await mobile.screenshot({path:path.join(folder,'mobile-coarse.png')});await mobile.close();
    checks.push('390px coarse-pointer layout keeps all toolbar and stage controls equal-height with no horizontal overflow');
    assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,count:checks.length,checks}));
  }catch(error){await h.finish(error);throw error;}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
