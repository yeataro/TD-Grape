/* Whole-group Network Editor overflow; isolated browser, no native TD calls. */
const assert=require('node:assert/strict'),path=require('node:path');
const {harness}=require('./test_glsl_code.cjs');
const [source,stateFile,folder]=process.argv.slice(2);
(async()=>{
  const h=await harness(source,stateFile,folder,{touch:true}),{page,checks,errors,settle}=h;page.setDefaultTimeout(6000);
  const resize=async width=>{await page.setViewportSize({width,height:900});await settle();};
  const menu=()=>page.locator('#graphmoremenu');
  const graphState=()=>page.evaluate(()=>JSON.stringify({graph,past,future,selection:[...selection]}));
  const bounds=()=>page.evaluate(()=>{
    const r=s=>{const b=document.querySelector(s).getBoundingClientRect();return{x:b.x,y:b.y,right:b.right,bottom:b.bottom,width:b.width,height:b.height};};
    return{toolbar:r('.toolbar'),stage:r('.stage-tabs'),more:r('#graphmore'),tools:r('.graph-tools'),path:r('#graphpath')};
  });
  try{
    await page.selectOption('#language','en');await page.evaluate(()=>{
      clearTimeout(autoTimer);connectionInterrupted=true;conflicted=true;readonly=false;historyBusy=nativeMutationBusy=false;stage='pixel';graphTrail=[];graph.functions=[];graph.declarations=[];
      graph.stages.pixel={nodes:[testNode('a','float',100,100,{value:0}),testNode('b','float',500,300),testNode('output','pixel_out',1100,200)],edges:[]};selection=new Set(['a','b']);selected='a';past=[];future=[];
      setUIExperiments({selectionToolbar:'off',editToolbar:true,floatingToolbar:false});render();fit();
    });await resize(1900);const before=await graphState();
    assert.equal(await page.locator('#graphmoremenu .graph-tool-group').count(),0);assert.equal(await page.locator('.toolbar #customnames').isVisible(),true);assert.equal(await page.locator('.toolbar #code').isVisible(),true);
    assert.equal(await page.locator('#graphmore').isVisible(),false);assert.equal(await page.locator('#graphmoreempty').count(),0);
    const fitWidth=await page.evaluate(()=>{const bar=$('.toolbar'),style=getComputedStyle(bar),tools=$('.graph-tools');return Math.ceil(innerWidth-bar.clientWidth+parseFloat(style.paddingLeft)+parseFloat(style.paddingRight)+(parseFloat(style.gap)||0)+$('.stage-tabs').offsetWidth+tools.offsetWidth+4);});
    await resize(fitWidth);assert.equal(await page.locator('#graphmore').isVisible(),false,'Do not reserve space for an unused dropdown');
    await resize(fitWidth-16);assert.equal(await page.locator('#graphmore').isVisible(),true);await page.locator('#graphmore').click();
    await resize(fitWidth);assert.equal(await page.locator('#graphmore').isVisible(),false);assert.equal(await menu().isVisible(),false);
    assert.equal(await page.evaluate(()=>document.activeElement.getClientRects().length>0),true);
    checks.push('All tools fit without an empty dropdown or reserved gap; crossing the real width threshold opens space by collapsing groups and widening removes the entry again');
    for(const width of [1200,900,660,390,320]){
      await resize(width);const b=await bounds();assert.ok(b.stage.y>=b.toolbar.y&&b.stage.bottom<=b.toolbar.bottom+1);assert.ok(Math.abs((b.stage.y+b.stage.bottom)/2-(b.tools.y+b.tools.bottom)/2)<2,JSON.stringify(b));
      assert.ok(b.more.right<=width+1&&b.stage.right<=b.tools.x+1,JSON.stringify(b));
      assert.equal(await page.evaluate(()=>$('#undo').parentElement===$('#redo').parentElement),true);
      assert.equal(await page.evaluate(()=>$('#undo').parentElement.parentElement.id),await page.evaluate(()=>$('#redo').parentElement.parentElement.id));
    }
    assert.equal(await graphState(),before);assert.ok(await page.locator('#graphmoremenu .graph-tool-group').count()>0);
    checks.push('Narrow layouts keep stage and dropdown on one row, preserve whole Undo/Redo and do not change graph/history');
    await page.locator('#graphmore').click();const pop=await menu().boundingBox();assert.ok(pop.x>=0&&pop.x+pop.width<=320&&pop.y>=0&&pop.y+pop.height<=900,JSON.stringify(pop));
    await page.keyboard.press('End');assert.equal(await page.locator('#code').evaluate(e=>e===document.activeElement),true);await page.keyboard.press('Home');assert.equal(await page.locator('#graphcopy').evaluate(e=>e===document.activeElement),true);
    await page.locator('#customnames').click();await settle();assert.equal(await page.locator('#customnames').getAttribute('aria-pressed'),'true');assert.equal(await menu().isVisible(),false);assert.equal(await graphState(),before);
    await page.locator('#graphmore').click();await page.locator('#grapharrange').click();assert.equal(await page.locator('#arrangemenu').isVisible(),true);
    const anchor=await page.locator('#grapharrange').boundingBox();assert.ok(anchor.width>0&&anchor.height>0);await page.keyboard.press('Escape');assert.equal(await menu().isVisible(),true);await page.keyboard.press('Escape');assert.equal(await menu().isVisible(),false);
    checks.push('Overflow has bounded geometry and keyboard navigation, reuses the custom-name action, and hosts the existing Arrange popup');
    await page.evaluate(()=>change(()=>{current().nodes.find(n=>n.id==='a').params.value=2;}));await settle();
    await page.locator('#graphmore').click();await page.locator('#undo').click();await settle();assert.equal(await page.evaluate(()=>current().nodes.find(n=>n.id==='a').params.value),0);
    await page.locator('#graphmore').click();await page.locator('#redo').click();await settle();assert.equal(await page.evaluate(()=>current().nodes.find(n=>n.id==='a').params.value),2);
    await page.route('**/api/validate',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({pixel:'void main() {}'})}));
    await page.locator('#graphmore').click();await page.locator('#code').click();await page.locator('#source').waitFor();assert.equal(await menu().isVisible(),false);await page.locator('#closecode').click();
    checks.push('Moved Undo/Redo invoke real history transactions and GLSL opens its existing validated source dialog');
    await page.evaluate(()=>setUIExperiments({selectionToolbar:'all'}));await settle();
    for(const id of ['graphcopy','graphdelete','grapharrange','graphfitselection']){assert.equal(await page.locator('#'+id).count(),1);assert.equal(await page.locator('#selectiontoolbar #'+id).count(),1);assert.equal(await page.locator('#'+id).getAttribute('role'),null);}
    await page.evaluate(()=>{setUIExperiments({selectionToolbar:'off'});readonly=true;render();});await settle();await page.locator('#graphmore').click();assert.equal(await page.locator('#graphdelete').isDisabled(),true);await page.keyboard.press('Escape');
    checks.push('Selection-toolbar ownership survives mode changes; controls remain unique and preserve read-only state');
    await page.evaluate(()=>{readonly=false;newFunction();enterFunction(current().nodes.find(n=>n.id===selected));});await settle();
    for(const size of ['standard','comfortable'])for(const scale of [75,100,125]){
      await page.evaluate(({size,scale})=>{setUIAppearance('size',size);setUIAppearance('scale',scale);}, {size,scale});await resize(390);
      const b=await bounds();assert.ok(b.path.width>20&&b.path.right<=b.tools.x+1,JSON.stringify(b));assert.ok(b.stage.bottom<=b.toolbar.bottom+1&&b.more.right<=390);
      await page.locator('#graphmore').click();if(size==='comfortable')assert.ok(await page.locator('#graphmoremenu button:visible').first().evaluate(e=>e.offsetHeight>=44));await page.keyboard.press('Escape');
    }
    assert.equal(await page.locator('#graphup').isVisible(),true);await page.locator('#graphup').click();await settle();assert.equal(await page.evaluate(()=>graphTrail.length),0);
    checks.push('Breadcrumb and Up remain usable at 75–125% scale; comfortable overflow controls meet touch row height');
    await page.evaluate(()=>{setUIAppearance('scale',100);setUIAppearance('size','standard');setUIExperiments({selectionToolbar:'all',floatingToolbar:true});window.toolbarLayoutCount=0;const original=layoutGraphToolbar;layoutGraphToolbar=function(){window.toolbarLayoutCount++;return original();};});
    await resize(900);await page.selectOption('#language','zh-Hant');await settle();assert.equal(await page.locator('#graphmore').getAttribute('aria-label'),'節點編輯器工具');await page.screenshot({path:path.join(folder,'toolbar-overflow.png')});await page.locator('#graphmore').click();await page.screenshot({path:path.join(folder,'toolbar-menu.png')});await page.keyboard.press('Escape');
    const count=await page.evaluate(()=>window.toolbarLayoutCount);await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>window.toolbarLayoutCount),count,'No resize observer or RAF feedback loop');
    checks.push('Floating chrome retains overflow behavior without an idle layout loop');
    assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,count:checks.length}));
  }catch(error){await h.finish(error);console.error(error);process.exitCode=1;}
})();
