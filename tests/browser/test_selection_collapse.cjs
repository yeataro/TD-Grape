/* Explicit collapse/expand selection commands and their independent preference. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {harness}=require('./test_glsl_code.cjs');
const[source,stateFile,folder]=process.argv.slice(2);
(async()=>{
  fs.mkdirSync(folder,{recursive:true});const fixture=path.join(folder,'fresh-state.json');
  execFileSync(process.env.PYTHON_EXECUTABLE||'python',[path.join(__dirname,'export_editor_fixture.py'),stateFile,fixture],{stdio:'pipe'});
  const h=await harness(source,fixture,folder,{touch:true}),{page,checks,errors,settle}=h;page.setDefaultTimeout(6000);
  const button=action=>page.locator('#graph'+action+'selection');
  const editState=()=>page.evaluate(()=>JSON.stringify({graph,past,future,dirty,shaderChanges:hasShaderChanges()}));
  const graphJSON=()=>page.evaluate(()=>JSON.stringify(graph));
  const select=async ids=>{await page.evaluate(ids=>{selection=new Set(ids);selected=ids.at(-1)||null;selectedEdge=null;render();},ids);await settle();};
  const reset=async()=>{await page.evaluate(()=>{
    closeGraphMenu();clearTimeout(autoTimer);connectionInterrupted=true;conflicted=true;readonly=false;historyBusy=false;nativeMutationBusy=false;stage='pixel';graphTrail=[];
    graph=clone(window.collapseFixture);selected='a';selection=new Set(['a','b']);selectedEdge=null;past=[];future=[];dirty=false;rememberSavedGraph(graph);
    setUIExperiments({selectionToolbar:'all',selectionCollapseTools:true});render();fit();
  });await settle();};
  const openMenu=async()=>{await page.evaluate(()=>{const r=$('#canvas').getBoundingClientRect();openGraphMenu(r.left+300,r.top+150);});await settle();};
  const assertState=async(collapse,expand,blocked=false)=>{assert.equal(await button('collapse').isVisible(),collapse||blocked);assert.equal(await button('expand').isVisible(),expand||blocked);assert.equal(await button('collapse').isEnabled(),collapse);assert.equal(await button('expand').isEnabled(),expand);assert.equal(await page.locator('#graphcollapseseparator').isVisible(),collapse||expand||blocked);};
  try{
    await page.evaluate(()=>{
      graph.functions=[];graph.declarations=[];graphTrail=[];stage='pixel';
      const a=testNode('a','float',80,120,{value:.3}),b=testNode('b','vec3',490,180,{value:[.2,.4,.6]}),note=testNode('note','comment',850,150),out=testNode('output','pixel_out',1250,250);
      a.ui.width=260;b.ui.collapsed=true;note.ui={...note.ui,width:370,height:220,comment:'# Note\nA second line',noteTitleOnSelection:true,noteTransparent:true,noteFontScale:2};
      graph.stages.pixel={nodes:[a,b,note,out],edges:[{from:['a','out'],to:['output','color']}]};GraphFrames.write(current(),[{id:'group',name:'Group 1',nodes:['a','b'],color:'#8191a8'}]);window.collapseFixture=clone(graph);
    });const baseFixture=await page.evaluate(()=>clone(window.collapseFixture));await reset();
    assert.equal(await page.evaluate(()=>EDITOR_DEV_DEFAULTS.selectionCollapseTools),true);await assertState(true,true);
    await openMenu();assert.equal(await page.locator('#grapheditmenu [data-edit="collapse"]').isEnabled(),true);assert.equal(await page.locator('#grapheditmenu [data-edit="expand"]').isEnabled(),true);
    const mixed=await graphJSON();await page.locator('#grapheditmenu [data-edit="expand"]').click();await settle();assert.deepEqual(await page.evaluate(()=>current().nodes.slice(0,2).map(n=>n.ui.collapsed)),[undefined,false]);assert.equal(await page.evaluate(()=>past.length),1);await assertState(true,false);
    await page.locator('#undo').click();await settle();assert.equal(await graphJSON(),mixed);await assertState(true,true);
    await openMenu();await page.locator('#grapheditmenu [data-edit="collapse"]').click();await settle();assert.deepEqual(await page.evaluate(()=>current().nodes.slice(0,2).map(n=>n.ui.collapsed)),[true,true]);await assertState(false,true);
    checks.push('mixed selection exposes both context commands; expand or collapse applies to all selected nodes and is exactly undoable');

    await reset();const initial=await graphJSON(),frames=await page.evaluate(()=>JSON.stringify(GraphFrames.read(current())));
    await button('collapse').click();await settle();await assertState(false,true);assert.equal(await page.evaluate(()=>past.length),1);assert.equal(await page.evaluate(()=>hasShaderChanges()),false);assert.equal(await page.evaluate(()=>JSON.stringify(GraphFrames.read(current()))),frames);
    const collapsed=await graphJSON(),noOp=await editState();assert.equal(await page.evaluate(()=>setNodesCollapsed(['a','b'],true)),false);assert.equal(await editState(),noOp);
    await button('expand').click();await settle();await assertState(true,false);assert.equal(await page.evaluate(()=>past.length),2);assert.equal(await page.evaluate(()=>current().nodes[0].ui.width),260);
    await page.locator('#undo').click();await settle();assert.equal(await graphJSON(),collapsed);await page.locator('#undo').click();await settle();assert.equal(await graphJSON(),initial);await page.locator('#redo').click();await settle();assert.equal(await graphJSON(),collapsed);
    checks.push('toolbar pair hides inapplicable actions and stays separated from adjacent tools, one layout-only Undo per action, no no-op history, and unchanged group membership');

    await reset();await select(['note','b']);const noteBefore=await page.evaluate(()=>clone(current().nodes.find(n=>n.id==='note').ui));
    await button('collapse').click();await settle();assert.equal(await page.locator('[data-node="note"]').evaluate(e=>e.classList.contains('collapsed')),true);assert.equal(await page.locator('[data-node="note"] [data-comment-node]').count(),0);
    await button('expand').click();await settle();const noteAfter=await page.evaluate(()=>clone(current().nodes.find(n=>n.id==='note').ui));delete noteAfter.collapsed;assert.deepEqual(noteAfter,noteBefore);
    assert.equal(await page.evaluate(()=>hasShaderChanges()),false);checks.push('Note collapse and expand preserve text, appearance, dimensions, and font scale with no shader changes');

    await reset();for(const ids of [['a'],['b']]){await select(ids);await assertState(ids[0]==='a',ids[0]==='b');}
    await select(['a','b']);for(const flag of ['readonly','historyBusy','nativeMutationBusy']){await page.evaluate(flag=>{if(flag==='readonly')readonly=true;if(flag==='historyBusy')historyBusy=true;if(flag==='nativeMutationBusy')nativeMutationBusy=true;renderSelectionToolbar();},flag);await assertState(false,false,true);const before=await editState();assert.equal(await page.evaluate(()=>setNodesCollapsed(['a','b'],true)),false);assert.equal(await editState(),before);await page.evaluate(flag=>{if(flag==='readonly')readonly=false;if(flag==='historyBusy')historyBusy=false;if(flag==='nativeMutationBusy')nativeMutationBusy=false;renderSelectionToolbar();},flag);}
    await select([]);assert.equal(await button('collapse').isEnabled(),false);assert.equal(await button('expand').isEnabled(),false);await openMenu();assert.equal(await page.locator('#grapheditmenu [data-edit="collapse"],#grapheditmenu [data-edit="expand"]').count(),0);await page.evaluate(()=>closeGraphMenu());
    await select(['a','b']);await page.evaluate(()=>{selectedEdge=0;renderSelectionToolbar();});assert.equal(await button('collapse').isEnabled(),false);assert.equal(await button('expand').isEnabled(),false);
    checks.push('single, empty, edge, readonly and busy selections have correct availability; blocked commands leave graph and history intact');

    await reset();const beforeSetting=await editState();await page.locator('#uiexperiments').click();const setting=page.locator('[data-experiment="selectionCollapseTools"]');assert.equal(await setting.isChecked(),true);
    assert.equal(await setting.locator('xpath=ancestor::section').getAttribute('data-experiment-group'),'toolbars');await setting.uncheck();await settle();assert.equal(await editState(),beforeSetting);assert.equal(await button('collapse').isVisible(),false);assert.equal(await button('expand').isVisible(),false);assert.equal(await page.locator('#graphcollapseseparator').isVisible(),false);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem(experimentsStorageKey)).selectionCollapseTools),false);
    await page.keyboard.press('Escape');await openMenu();assert.equal(await page.locator('#grapheditmenu [data-edit="collapse"]').isEnabled(),true);assert.equal(await page.locator('#grapheditmenu [data-edit="expand"]').isEnabled(),true);await page.evaluate(()=>closeGraphMenu());
    await page.reload();await page.waitForSelector('.node');assert.equal(await page.evaluate(()=>EDITOR_DEV_SETTINGS.selectionCollapseTools),false);await page.evaluate(fixture=>{window.collapseFixture=fixture;clearTimeout(autoTimer);connectionInterrupted=true;conflicted=true;readonly=false;setUIExperiments({selectionCollapseTools:true});},baseFixture);
    checks.push('independent gear setting persists across reload without graph/history writes and never removes the context-menu alternatives');

    await reset();for(const [lang,collapse,expand]of [['en','Collapse selected nodes','Expand selected nodes'],['zh-Hant','收合選取節點','展開選取節點']]){
      await page.selectOption('#language',lang);assert.equal(await button('collapse').getAttribute('title'),collapse);assert.equal(await button('expand').getAttribute('aria-label'),expand);
    }
    await button('collapse').focus();await page.keyboard.press('ArrowRight');assert.equal(await button('expand').evaluate(e=>e===document.activeElement),true);
    await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{setGraphFocus(true);fit();});await settle();for(const action of ['collapse','expand']){const r=await button(action).boundingBox();assert.ok(r&&r.x>=0&&r.y>=0&&r.x+r.width<=390&&r.y+r.height<=844,JSON.stringify(r));}
    const r=await button('expand').boundingBox();await page.touchscreen.tap(r.x+r.width/2,r.y+r.height/2);await settle();await assertState(true,false);await page.screenshot({path:path.join(folder,'selection-collapse-mobile.png')});
    checks.push('labels translate, toolbar arrow navigation reaches both commands, and touch can expand the selection in a narrow viewport');
    assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,count:checks.length}));
  }catch(error){await h.finish(error);throw error;}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
