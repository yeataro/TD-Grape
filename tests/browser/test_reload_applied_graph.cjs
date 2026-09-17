/* Applied-graph reload is destructive to local editing history; isolated fixture only. */
const assert=require('node:assert/strict'),path=require('node:path');
const {harness}=require('./test_glsl_code.cjs');
const [source,stateFile,folder]=process.argv.slice(2);
(async()=>{
  const h=await harness(source,stateFile,folder),{page,checks,errors,settle}=h;
  page.setDefaultTimeout(6000);let reads=0,applies=0;
  page.on('request',request=>{const p=new URL(request.url()).pathname;if(p.endsWith('/api/state'))reads++;if(request.method()==='POST'&&p.endsWith('/api/apply'))applies++;});
  const snapshot=()=>page.evaluate(()=>JSON.stringify({graph,past,future,dirty,revision,pan,scale,selected,selection:[...selection]}));
  const setup=async(history=true)=>{
    await page.evaluate(history=>{
      if($('#reloadapplieddialog').open)$('#reloadapplieddialog').close();clearTimeout(autoTimer);autoTimer=null;connectionInterrupted=true;autoPreview=false;
      cancelValueLadder();document.activeElement?.blur();editorFieldDrafts.clear();readonly=false;submitBusy=false;historyBusy=false;nativeMutationBusy=false;nativeSourceBusy=false;customBusy=false;personalBusy=false;exportBusy=false;
      graph.declarations=[];graph.functions=[];graph.stages.pixel={nodes:[testNode('reload_value','float',50,50,{value:.3}),testNode('reload_output','pixel_out',400,50)],edges:[]};stage='pixel';graphTrail=[];selected=null;selection.clear();dirty=false;rememberSavedGraph(graph);past=[];future=[];render();scale=.8;pan={x:30,y:50};transform();
      if(history){const before=clone(graph);graph.stages.pixel.nodes[0].params.value=.4;recordGraphHistory(before);const after=clone(graph);graph.stages.pixel.nodes[0].params.value=.5;recordGraphHistory(after);future=[past.pop()];graph=clone(future[0].before);dirty=false;render();}
    },history);await settle();reads=0;applies=0;
  };
  const open=async()=>{await page.locator('#reload').click();await page.locator('#reloadapplieddialog[open]').waitFor();await settle();};
  try{
    await page.selectOption('#language','en');
    await setup();let before=await snapshot();await open();
    assert.equal(await page.locator('#reloadappliedcancel').evaluate(e=>e===document.activeElement),true);
    const explanation=await page.locator('#reloadappliedexplanation').innerText();
    for(const phrase of ['TouchDesigner','Unapplied changes','Undo/Redo','cannot be undone'])assert.ok(explanation.includes(phrase),explanation);
    assert.equal(await snapshot(),before);assert.equal(reads,0);assert.equal(applies,0);
    await page.locator('#reloadappliedcancel').click();await settle();assert.equal(await snapshot(),before);assert.equal(reads,0);
    await open();await page.keyboard.press('Escape');await settle();assert.equal(await page.locator('#reloadapplieddialog').isVisible(),false);assert.equal(await snapshot(),before);assert.equal(reads,0);
    checks.push('clean graph with Undo/Redo still receives explicit destructive warning; Cancel is focused and Cancel/Escape leave all graph, history and view state intact without fetching');
    await setup(false);await open();assert.equal(await page.evaluate(()=>past.length+future.length),0);await page.locator('#reloadappliedcancel').click();
    checks.push('reload confirmation is shown even with no dirty graph or history');
    await setup();const field=page.locator('[data-inline-node="reload_value"]');await field.fill('0.123456789');before=await snapshot();
    await page.locator('#reload').click();await settle();assert.equal(await page.locator('#reloadapplieddialog').isVisible(),false);assert.equal(await field.inputValue(),'0.123456789');assert.equal(await field.evaluate(e=>e===document.activeElement),true);assert.equal(await snapshot(),before);assert.equal(reads,0);assert.equal(applies,0);
    await field.fill('');await page.locator('#reload').click();assert.equal(await field.inputValue(),'');assert.equal(await snapshot(),before);assert.equal(reads,0);
    await field.press('Escape');
    checks.push('pointer activation cannot blur-commit unfinished or empty fields; draft stays focused and reload remains blocked');
    for(const flag of ['submitBusy','historyBusy','nativeMutationBusy','nativeSourceBusy','customBusy','personalBusy','exportBusy','pendingEditorWrites']){
      await setup();before=await snapshot();assert.equal(await page.evaluate(flag=>{eval(flag+'=true');const result=requestAppliedGraphReload();eval(flag+'=false');return result;},flag),false);assert.equal(await page.locator('#reloadapplieddialog').isVisible(),false);assert.equal(await snapshot(),before);assert.equal(reads,0);
    }
    await setup();await open();before=await snapshot();await page.evaluate(()=>pendingEditorWrites=1);await page.locator('#reloadappliedconfirm').click();await settle();assert.equal(await page.locator('#reloadapplieddialog').isVisible(),true);assert.ok((await page.locator('#reloadappliedstatus').innerText()).includes('in progress'));assert.equal(await snapshot(),before);assert.equal(reads,0);await page.evaluate(()=>pendingEditorWrites=0);await page.locator('#reloadappliedcancel').click();
    checks.push('save, apply and parameter/history operations block opening, and confirmation rechecks write activity without clearing graph/history');
    await setup();await page.evaluate(()=>{dirty=true;connectionInterrupted=false;scheduleGraphApply(150);});before=await snapshot();await open();
    await page.waitForTimeout(250);assert.equal(applies,0);assert.equal(reads,0);assert.equal(await snapshot(),before);
    await page.locator('#reloadappliedcancel').click();await page.waitForFunction(()=>!dirty);assert.equal(applies,1);const lastApplied=await page.evaluate(()=>JSON.stringify(graph));
    checks.push('a queued auto-apply is paused while reviewing the warning and resumes normally after Cancel');
    await setup();await page.evaluate(()=>{current().nodes[0].params.value=.9;dirty=true;connectionInterrupted=false;scheduleGraphApply(150);});await open();await page.locator('#reloadappliedconfirm').click();await page.waitForFunction(()=>!historyBusy);await settle();
    assert.equal(reads,1);assert.equal(applies,0);assert.equal(await page.evaluate(()=>past.length+future.length),0);assert.equal(await page.evaluate(()=>dirty),false);assert.equal(await page.evaluate(()=>JSON.stringify(graph)),lastApplied);assert.equal(await page.locator('#reloadapplieddialog').isVisible(),false);
    checks.push('explicit confirmation fetches the applied graph once, replaces editing content and clears history; discarded draft is never auto-applied');
    await setup();before=await snapshot();await page.route('**/api/state',route=>route.fulfill({status:503,json:{error:'reload fixture unavailable'}}),{times:1});await open();await page.locator('#reloadappliedconfirm').click();await page.waitForFunction(()=>!historyBusy);await settle();assert.equal(reads,1);assert.equal(await snapshot(),before);assert.equal(await page.locator('#status').innerText(),await page.evaluate(()=>t('connection.busy')));assert.equal(await page.locator('#status').evaluate(e=>e.classList.contains('error')),true);
    checks.push('a failed state fetch reports its error and retains the pre-confirmation graph and Undo/Redo history');
    const mobile=await h.browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});mobile.on('pageerror',e=>errors.push(e.message));await mobile.goto(page.url());await mobile.waitForSelector('.node');
    await mobile.evaluate(()=>{connectionInterrupted=true;autoPreview=false;clearTimeout(autoTimer);autoTimer=null;});
    for(const percent of [75,125]){
      await mobile.evaluate(percent=>setUIAppearance('scale',percent),percent);await mobile.locator('#reload').tap();await mobile.locator('#reloadapplieddialog[open]').waitFor();
      const r=await mobile.locator('#reloadapplieddialog').boundingBox();assert.ok(r.x>=0&&r.y>=0&&r.x+r.width<=391&&r.y+r.height<=845,JSON.stringify({percent,r}));
      assert.ok(await mobile.locator('#reloadapplieddialog').evaluate(e=>e.scrollWidth<=e.clientWidth+1));assert.equal(await mobile.locator('#reloadappliedcancel').isVisible(),true);assert.equal(await mobile.locator('#reloadappliedconfirm').isVisible(),true);
      await mobile.screenshot({path:path.join(folder,'reload-mobile-'+percent+'.png')});await mobile.locator('#reloadappliedcancel').tap();
    }
    await mobile.close();checks.push('warning and both actions fit 390px touch viewports at 75% and 125% UI scale');
    assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,count:checks.length}));
  }catch(error){await h.finish(error);throw error;}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
