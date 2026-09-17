/* Browser-local experimental controls. The fixture never connects to TD.
 * node test_ui_experiments.cjs SOURCE_DIR STATE_JSON REPORT_DIR
 */
const assert=require('node:assert/strict'),path=require('node:path');
const {harness}=require('./test_glsl_code.cjs');
const [source,stateFile,folder]=process.argv.slice(2);
(async()=>{
  const h=await harness(source,stateFile,folder,{touch:true}),{page,checks,errors,settle}=h;
  page.setDefaultTimeout(6000);await page.emulateMedia({reducedMotion:'reduce'});
  const writes=[];
  page.on('request',request=>{const route=new URL(request.url()).pathname;if(request.method()==='POST'&&route.startsWith('/api/')&&!route.endsWith('/remote-preview'))writes.push(route);});
  const panel=page.locator('#experimentspanel'),opener=page.locator('#uiexperiments');
  const control=key=>panel.locator(`[data-experiment="${key}"]`);
  const snapshot=()=>page.evaluate(()=>JSON.stringify({graph,past,future,dirty}));
  const settings=()=>page.evaluate(()=>({...EDITOR_DEV_SETTINGS}));
  const open=async()=>{if(!await panel.isVisible())await opener.click();await settle();};
  const close=async()=>{if(await panel.isVisible()){await control('canvasTrash').focus();await page.keyboard.press('Escape');await settle();}};
  const set=async values=>{await page.evaluate(values=>setUIExperiments(values),values);await settle();};
  const setup=async()=>{await page.evaluate(()=>{
    cancelValueLadder();document.activeElement?.blur();clearTimeout(autoTimer);connectionInterrupted=true;conflicted=true;readonly=false;historyBusy=false;nativeMutationBusy=false;graphTrail=[];stage='pixel';selectedInputId=null;
    const make=(id,key,params,x,y)=>{const d=catalog.find(d=>d.key===key);return{id,name:id,definitionUuid:d.definitionUuid,revisionHash:d.revisionHash,params:{...clone(d.defaults),...params},ui:{x,y}};};
    const folded=make('folded','float',{value:.2},360,80);folded.ui.collapsed=true;
    graph.declarations=[];graph.functions=[];graph.stages.pixel={nodes:[make('value','float',{value:.3},40,80),folded,make('color','color',{value:[.7,.3,1,1]},40,300),make('split','vector_split',{type:'vec2'},380,330)],edges:[{from:['color','out'],to:['split','value']}]};
    selected='value';selection=new Set(['value']);inspectorTab='parameters';past=[];future=[];dirty=false;rememberSavedGraph(graph);render();scale=.8;pan={x:25,y:30};transform();
  });await settle();};
  const reload=async()=>{await close();await page.reload();await page.waitForSelector('.node');await page.evaluate(()=>{clearTimeout(autoTimer);connectionInterrupted=true;conflicted=true;});await settle();};
  try{
    await setup();const defaults=await page.evaluate(()=>({...EDITOR_DEV_DEFAULTS}));
    assert.deepEqual(await settings(),defaults);assert.equal(defaults.uiStyle,'professional');assert.equal(await page.locator('html').getAttribute('data-ui-style'),'professional');
    assert.equal(defaults.floatingToolbar,true);assert.equal(await page.locator('#canvas>.toolbar').count(),1);assert.equal(defaults.systemClock,false);assert.equal(await page.locator('#uisystemclock').isVisible(),false);assert.equal(await page.evaluate(()=>systemClockTimer),null);
    await open();assert.equal(await panel.locator('input[type=checkbox]').count(),Object.values(defaults).filter(value=>typeof value==='boolean').length);assert.equal(await panel.locator('select').count(),Object.values(defaults).filter(value=>typeof value==='string').length);
    assert.deepEqual(await panel.locator('[data-experiment]').evaluateAll(entries=>entries.map(entry=>entry.dataset.experiment).sort()),Object.keys(defaults).sort());
    assert.deepEqual(await panel.locator('[data-experiment-group]').evaluateAll(groups=>groups.map(group=>group.dataset.experimentGroup)),['toolbars','nodes','appearance']);
    assert.deepEqual(await panel.locator('[data-experiment-group="toolbars"] [data-experiment]').evaluateAll(entries=>entries.map(entry=>entry.dataset.experiment)),['floatingToolbar','editToolbar','selectionToolbar','persistentSelectionBounds','canvasTrash'].filter(key=>Object.hasOwn(defaults,key)));
    assert.equal(defaults.persistentSelectionBounds,false);assert.equal(await control('persistentSelectionBounds').isChecked(),false);
    assert.equal(await panel.locator('details').count(),0);assert.equal(await control('floatingToolbar').isChecked(),false);
    if(Object.hasOwn(defaults,'selectionToolbar')){assert.equal(defaults.selectionToolbar,'off');assert.equal(defaults.editToolbar,true);assert.deepEqual(await control('selectionToolbar').locator('option').evaluateAll(options=>options.map(option=>option.value)),['off','multiple','all']);}
    assert.deepEqual(await control('nodeDragCursor').locator('option').evaluateAll(options=>options.map(o=>o.value)),['default','move']);
    assert.deepEqual(await control('uiStyle').locator('option').evaluateAll(options=>options.map(o=>o.value)),['professional','cool','excellent','legendary','godlike']);
    assert.equal(await page.locator('#experimentsreset').isDisabled(),true);assert.equal(await opener.getAttribute('aria-expanded'),'true');
    assert.equal(await control('floatingToolbar').evaluate(e=>e===document.activeElement),true);const openedGraph=await snapshot();await page.keyboard.press('Tab');assert.equal(await control(Object.hasOwn(defaults,'editToolbar')?'editToolbar':'canvasTrash').evaluate(e=>e===document.activeElement),true);await page.keyboard.press('Delete');assert.equal(await snapshot(),openedGraph);
    checks.push('fresh editors keep the toolbar background off and Professional style; all registered preferences appear once in three ordered, open groups with toolbar controls first');
    checks.push('mouse opening focuses the first option, Tab stays in the panel and Delete does not delete selected graph nodes');

    const unchanged=await snapshot();
    for(const [key,value]of Object.entries(defaults)){
      const changed=typeof value==='boolean'?!value:key==='uiStyle'?'cool':key==='selectionToolbar'?'multiple':'move';
      if(typeof value==='boolean')await control(key).setChecked(key==='floatingToolbar'?!changed:changed);else await control(key).selectOption(changed);
      await settle();assert.equal((await settings())[key],changed);
    }
    assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('sgrapeExperimentsV1'))),await settings());
    assert.equal(await page.locator('#graphtrash').isVisible(),true);
    assert.equal(await page.locator('#canvas>.toolbar').count(),0);assert.equal(await page.locator('.graph-workspace>.toolbar').count(),1);
    assert.equal(await page.locator('[data-node="value"]').getAttribute('data-drag-surface'),'header');
    assert.equal(await page.locator('[data-collapse-node="value"]').count(),0);assert.equal(await page.locator('[data-collapse-node="folded"]').count(),0);
    assert.equal(await page.locator('[data-node-resize="value"]').count(),1,'hiding the resize hint retains resizing');
    assert.deepEqual(await page.evaluate(()=>({tint:document.documentElement.classList.contains('rgba-component-tint'),vectorTint:document.documentElement.classList.contains('vector-component-tint'),resize:document.documentElement.classList.contains('node-resize-hints'),cursor:getComputedStyle($('.node-title')).cursor})),{tint:false,vectorTint:true,resize:false,cursor:'move'});
    assert.equal(await snapshot(),unchanged);assert.deepEqual(writes,[]);
    checks.push('every control changes its live behavior and browser preference only; resize handles remain, while graph, invalid wire, history, dirty state and API writes remain untouched');

    await close();assert.equal(await page.locator('#uisystemclock').isVisible(),true);
    const clockPosition=await page.evaluate(()=>{const c=$('#uisystemclock'),r=c.getBoundingClientRect(),f=$('#uifullscreen').getBoundingClientRect(),now=new Date();return {next:c.nextElementSibling?.id,left:r.left,right:r.right,fullscreenLeft:f.left,text:c.textContent,expected:String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0'),dateTime:c.dateTime};});
    assert.equal(clockPosition.next,'uifullscreen');assert.ok(clockPosition.right<=clockPosition.fullscreenLeft);assert.equal(clockPosition.text,clockPosition.expected);assert.equal(clockPosition.dateTime,clockPosition.text);
    await page.evaluate(()=>{setGraphFocus(true);});assert.equal(await page.locator('.footer-preferences #uisystemclock').count(),1);assert.equal(await page.locator('.canvas-view-tools #uisystemclock').count(),0);await page.evaluate(()=>setGraphFocus(false));assert.equal(await page.locator('#uisystemclock').evaluate(e=>e.nextElementSibling?.id),'uifullscreen');
    checks.push('enabled system clock shows padded local 24-hour HH:mm immediately before footer fullscreen, stays in the footer during graph focus, and has no graph duplicate');
    await set({systemClock:false});
    await page.evaluate(()=>{
      window.experimentClock={Date:window.Date,setTimeout:window.setTimeout,clearTimeout:window.clearTimeout,now:new Date(2026,8,18,23,59,59,950).getTime(),next:0,timers:new Map()};
      const fixture=experimentClock;window.Date=class extends fixture.Date{constructor(...args){super(...(args.length?args:[fixture.now]));}static now(){return fixture.now;}};
      window.setTimeout=(fn,delay,...args)=>{if(fn!==refreshSystemClock)return fixture.setTimeout.call(window,fn,delay,...args);const id=--fixture.next;fixture.timers.set(id,{fn,delay});return id;};
      window.clearTimeout=id=>{if(fixture.timers.has(id))fixture.timers.delete(id);else fixture.clearTimeout.call(window,id);};
    });
    try{
      await set({systemClock:true});assert.equal(await page.locator('#uisystemclock').textContent(),'23:59');assert.deepEqual(await page.evaluate(()=>[...experimentClock.timers.values()].map(t=>t.delay)),[50]);
      await page.evaluate(()=>{experimentClock.now+=50;const [id,timer]=[...experimentClock.timers][0];experimentClock.timers.delete(id);timer.fn();});assert.equal(await page.locator('#uisystemclock').textContent(),'00:00');assert.deepEqual(await page.evaluate(()=>[...experimentClock.timers.values()].map(t=>t.delay)),[60000]);
      await page.evaluate(()=>{experimentClock.now+=60*1000;document.dispatchEvent(new Event('visibilitychange'));});assert.equal(await page.locator('#uisystemclock').textContent(),'00:01');assert.equal(await page.evaluate(()=>experimentClock.timers.size),1);
      await set({systemClock:false});assert.equal(await page.locator('#uisystemclock').isVisible(),false);assert.equal(await page.evaluate(()=>systemClockTimer),null);assert.equal(await page.evaluate(()=>experimentClock.timers.size),0);
      await page.evaluate(()=>{experimentClock.now+=60*1000;document.dispatchEvent(new Event('visibilitychange'));});assert.equal(await page.locator('#uisystemclock').textContent(),'00:01');assert.equal(await page.evaluate(()=>experimentClock.timers.size),0);
    }finally{await page.evaluate(()=>{setUIExperiments({systemClock:false});window.Date=experimentClock.Date;window.setTimeout=experimentClock.setTimeout;window.clearTimeout=experimentClock.clearTimeout;delete window.experimentClock;});}
    assert.equal(await snapshot(),unchanged);checks.push('system clock rolls over midnight at the next minute boundary, keeps exactly one minute timer, refreshes on visibility restoration and clears timer/listener when disabled');await open();

    assert.equal(await page.locator('#wires path').count(),1);
    await page.evaluate(()=>{window.experimentStyleDOM=[...document.querySelectorAll('#cards .node,#wires path,#inspector input,.toolbar')];});
    const styleGeometry=()=>page.locator('#cards .node,#wires path,#inspector input,.toolbar').evaluateAll(elements=>elements.map(e=>{const r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height];}));
    const geometry=await styleGeometry();
    for(const uiStyle of ['professional','cool','excellent','legendary','godlike','cool','excellent','godlike','legendary','professional']){
      await control('uiStyle').selectOption(uiStyle);await settle();
      assert.equal(await page.locator('html').getAttribute('data-ui-style'),uiStyle);
      assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('sgrapeExperimentsV1')).uiStyle),uiStyle);
      assert.equal(await page.evaluate(()=>experimentStyleDOM.every((element,index)=>element.isConnected&&document.querySelectorAll('#cards .node,#wires path,#inspector input,.toolbar')[index]===element)),true);
      assert.deepEqual(await styleGeometry(),geometry);assert.equal(await snapshot(),unchanged);
    }
    for(const systemClock of [true,false]){
      await control('systemClock').setChecked(systemClock);await settle();
      assert.equal(await page.evaluate(()=>experimentStyleDOM.every((element,index)=>element.isConnected&&document.querySelectorAll('#cards .node,#wires path,#inspector input,.toolbar')[index]===element)),true);
      assert.deepEqual(await styleGeometry(),geometry);assert.equal(await snapshot(),unchanged);
    }
    for(const theme of ['light','dark']){
      await page.evaluate(theme=>setUIAppearance('theme',theme),theme);await settle();
      assert.equal(await page.evaluate(()=>experimentStyleDOM.every((element,index)=>element.isConnected&&document.querySelectorAll('#cards .node,#wires path,#inspector input,.toolbar')[index]===element)),true);
      assert.deepEqual(await styleGeometry(),geometry);assert.equal(await snapshot(),unchanged);
    }
    checks.push('Professional, Cool, Excellent, Legendary and Godlike apply and persist without rebuilding node/wire/Parameter/toolbar DOM; style, clock-only and theme switches preserve geometry, graph and Undo');

    for(const expanded of[false,true])for(const collapsed of[false,true]){
      await set({nodeCollapseExpandedHint:expanded,nodeCollapseCollapsedHint:collapsed});
      assert.equal(await page.locator('[data-collapse-node="value"]').count(),expanded?1:0);
      assert.equal(await page.locator('[data-collapse-node="folded"]').count(),collapsed?1:0);
      assert.equal(await page.locator('[data-node="folded"]').evaluate(e=>e.classList.contains('collapsed')),true);
      assert.ok(await page.locator('#cards .node').evaluateAll(cards=>cards.every(card=>{const toggle=card.querySelector('.node-collapse-toggle'),name=card.querySelector('.node-function-title');return !toggle||toggle.getBoundingClientRect().right<=name.getBoundingClientRect().left+1;})),'newly visible collapse controls must not overlap node names');
    }
    await set({autoDisconnectInvalidEdges:false});await set({autoDisconnectInvalidEdges:true});assert.equal(await snapshot(),unchanged);
    checks.push('expanded and collapsed triangle preferences are independent; changing automatic disconnection does not clean existing invalid edges or alter collapsed state');

    await close();await page.evaluate(()=>{window.experimentToolbar=$('.toolbar');window.experimentCard=$('[data-node="value"]');});
    for(let i=0;i<6;i++){const floating=i%2===0;await set({floatingToolbar:floating});assert.equal(await page.locator('#canvas>.toolbar').count(),floating?1:0);assert.equal(await page.locator('.graph-workspace>.toolbar').count(),floating?0:1);assert.equal(await page.evaluate(()=>$('.toolbar')===experimentToolbar&&$('[data-node="value"]')===experimentCard),true);}
    await page.locator('#boxselect').click();assert.equal(await page.evaluate(()=>boxSelectMode),true);await page.locator('#boxselect').click();assert.equal(await page.evaluate(()=>boxSelectMode),false);assert.equal(await snapshot(),unchanged);
    await page.evaluate(()=>{change(()=>current().nodes[0].params.value=.4);change(()=>current().nodes[0].params.value=.5);});await page.locator('#undo').click();assert.equal(await page.evaluate(()=>current().nodes[0].params.value),.4);assert.equal(await page.evaluate(()=>past.length),1);
    checks.push('repeated toolbar relocation reuses the same DOM, remains reversible, and toolbar actions execute once');

    await setup();const numeric=page.locator('[data-inline-node="value"]').first();await numeric.fill('');
    await page.evaluate(()=>{window.experimentDraft=document.activeElement;});const numericBefore=await snapshot();
    await set({floatingToolbar:true,nodeBodyDrag:true,rgbaComponentTint:true,nodeCollapseExpandedHint:false,uiStyle:'professional',persistentSelectionBounds:false});
    assert.equal(await page.evaluate(()=>experimentDraft.isConnected&&document.activeElement===experimentDraft),true);assert.equal(await numeric.inputValue(),'');assert.equal(await snapshot(),numericBefore);await numeric.press('Escape');
    await page.locator('#canvas').focus();await settle();
    await page.evaluate(()=>{showCustomNodeNames=true;render();const card=$('[data-node="value"]');beginNodeRename(current().nodes[0],card.querySelector('.node-function-title'));});
    const rename=page.locator('#cards [data-node-name="value"]');await rename.fill('Draft_Name');await page.evaluate(()=>{window.experimentNameDraft=document.activeElement;});const nameBefore=await snapshot();
    await set({floatingToolbar:false,nodeDragCursor:'default',nodeCollapseExpandedHint:true,uiStyle:'godlike'});
    assert.equal(await page.evaluate(()=>experimentNameDraft.isConnected&&document.activeElement===experimentNameDraft),true);assert.equal(await rename.inputValue(),'Draft_Name');assert.equal(await snapshot(),nameBefore);await rename.press('Escape');
    checks.push('live preferences preserve focused incomplete numeric drafts and canvas rename DOM/text without committing or discarding either draft');

    await set({canvasTrash:true});const corner=await page.evaluate(()=>{const r=selector=>{const b=$(selector).getBoundingClientRect();return{left:b.left,right:b.right,top:b.top,bottom:b.bottom};};return{trash:r('#graphtrash'),tools:r('.canvas-view-tools'),canvas:r('#canvas')};});
    assert.ok(Math.abs(corner.trash.right-corner.canvas.right)<2);assert.ok(corner.trash.bottom<=corner.tools.top);
    await set({canvasTrash:false});assert.equal(await page.locator('#graphtrash').isVisible(),false);
    checks.push('the enabled trash aligns with the right canvas edge above the view tools; disabling removes its visible target');

    const deniedBefore=await snapshot(),storedBefore=await page.evaluate(()=>localStorage.getItem('sgrapeExperimentsV1')),oldBody=(await settings()).nodeBodyDrag;
    await page.evaluate(()=>{window.experimentStorageSetter=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='sgrapeExperimentsV1')throw new DOMException('Fixture storage denied','SecurityError');return experimentStorageSetter.call(this,key,value);};});
    try{await open();await control('nodeBodyDrag').setChecked(!oldBody);await settle();assert.equal((await settings()).nodeBodyDrag,!oldBody);assert.equal(await page.locator('[data-node="value"]').getAttribute('data-drag-surface'),oldBody?'header':'body');assert.equal(await snapshot(),deniedBefore);assert.equal(await page.evaluate(()=>localStorage.getItem('sgrapeExperimentsV1')),storedBefore);}
    finally{await page.evaluate(()=>{Storage.prototype.setItem=experimentStorageSetter;delete window.experimentStorageSetter;});}
    await close();checks.push('a denied preference write still applies the live option and leaves graph/history and previously stored preferences untouched');

    const panStart=await page.evaluate(()=>{const r=$('#canvas').getBoundingClientRect();for(let y=r.bottom-150;y>r.top+80;y-=60)for(let x=r.left+30;x<r.right-30;x+=60){const e=document.elementFromPoint(x,y);if(e?.closest('#canvas')&&!e.closest('.node,path,.graph-navigation,.toolbar,.canvas-view-tools'))return{x,y};}return null;});assert.ok(panStart);
    const panFlags=await settings(),panBefore=await snapshot(),panStorage=await page.evaluate(()=>localStorage.getItem('sgrapeExperimentsV1'));
    await page.mouse.move(panStart.x,panStart.y);await page.mouse.down({button:'middle'});await page.mouse.move(panStart.x+24,panStart.y+8);assert.equal(await page.evaluate(()=>!!$('#canvas').onpointermove),true);
    await set({nodeBodyDrag:!panFlags.nodeBodyDrag});assert.deepEqual(await settings(),panFlags);assert.equal(await snapshot(),panBefore);assert.equal(await page.evaluate(()=>localStorage.getItem('sgrapeExperimentsV1')),panStorage);
    await page.mouse.up({button:'middle'});assert.equal(await page.evaluate(()=>!!$('#canvas').onpointermove),false);await set({nodeBodyDrag:!panFlags.nodeBodyDrag});assert.equal((await settings()).nodeBodyDrag,!panFlags.nodeBodyDrag);
    checks.push('an active trusted mouse pan rejects preference changes without changing flags, storage or graph, then permits them after release');

    await close();await opener.focus();await page.keyboard.press('Enter');await settle();assert.equal(await panel.isVisible(),true);assert.equal(await control('floatingToolbar').evaluate(e=>e===document.activeElement),true);
    await page.keyboard.press('Escape');await settle();assert.equal(await panel.isVisible(),false);assert.equal(await opener.evaluate(e=>e===document.activeElement),true);
    await open();await page.locator('#uitheme').click();assert.equal(await panel.isVisible(),false);assert.equal(await page.locator('#appearancepanel').isVisible(),true);
    await open();assert.equal(await page.locator('#appearancepanel').isVisible(),false);await page.locator('#uisize').click();assert.equal(await panel.isVisible(),false);await open();assert.equal(await page.locator('#sizepanel').isVisible(),false);
    await page.locator('#editorheader .brand').click();await settle();assert.equal(await panel.isVisible(),false);assert.equal(await opener.getAttribute('aria-expanded'),'false');
    checks.push('keyboard entry focuses the first option, Escape restores the opener, outside click dismisses, and footer popovers replace each other');

    for(const locale of ['en','zh-Hant']){
      await page.selectOption('#language',locale);await open();const title=await page.evaluate(()=>t('experiments.title'));assert.equal(await opener.getAttribute('aria-label'),title);assert.equal(await opener.getAttribute('title'),title);
      const labels=await panel.locator('[data-experiment]').evaluateAll(entries=>entries.map(e=>({key:e.dataset.experiment,label:e.closest('label').querySelector('span').textContent,title:e.closest('label').title})));
      assert.ok(labels.every(x=>x.label.trim()&&x.title.trim()&&!x.label.startsWith('experiments.')&&!x.title.startsWith('experiments.')));
      assert.ok(await panel.locator('select option,[data-experiment-group] h3').evaluateAll(entries=>entries.every(entry=>entry.textContent.trim()&&!entry.textContent.startsWith('experiments.'))));
      assert.equal(await control('floatingToolbar').locator('..').locator('span').textContent(),locale==='en'?'Show toolbar background':'顯示工具列底色');await close();
    }
    checks.push('English and Traditional Chinese expose translated names, hints, cursor/style choices and opener labels');

    await set({canvasTrash:true,floatingToolbar:false,persistentSelectionBounds:true,nodeBodyDrag:false,nodeDragCursor:'move',nodeResizeHint:false,nodeCollapseExpandedHint:false,nodeCollapseCollapsedHint:false,rgbaComponentTint:false,autoDisconnectInvalidEdges:false,uiStyle:'godlike',systemClock:true});const saved=await settings();
    for(const uiStyle of ['professional','cool','excellent','legendary','godlike']){
      await set({...saved,uiStyle});await reload();assert.deepEqual(await settings(),{...saved,uiStyle});assert.equal(await page.locator('html').getAttribute('data-ui-style'),uiStyle);assert.equal(await page.locator('#canvas>.toolbar').count(),0);assert.equal(await page.locator('.graph-workspace>.toolbar').count(),1);assert.equal(await page.locator('#graphtrash').isVisible(),true);assert.equal(await page.locator('#uisystemclock').isVisible(),true);
      await open();await page.locator('#experimentsreset').click();await settle();assert.deepEqual(await settings(),defaults);assert.equal(await page.locator('#canvas>.toolbar').count(),1);assert.equal(await page.locator('#uisystemclock').isVisible(),false);assert.equal(await page.evaluate(()=>systemClockTimer),null);assert.equal(await page.locator('html').getAttribute('data-ui-style'),'professional');assert.equal(await page.locator('#experimentsreset').isDisabled(),true);assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('sgrapeExperimentsV1'))),defaults);
    }
    await page.evaluate(()=>localStorage.setItem('sgrapeExperimentsV1','{ broken'));await reload();assert.deepEqual(await settings(),defaults);
    const malformed={canvasTrash:'true',floatingToolbar:1,persistentSelectionBounds:'true',nodeBodyDrag:null,nodeDragCursor:'url(https://invalid.test/cursor)',uiStyle:'glow',systemClock:'true',nodeResizeHint:false,unknown:true};
    assert.deepEqual(await page.evaluate(raw=>parseUIExperiments(raw),JSON.stringify(malformed)),{...defaults,nodeResizeHint:false});
    for(const raw of ['null','[]','true','"text"'])assert.deepEqual(await page.evaluate(raw=>parseUIExperiments(raw),raw),defaults);
    checks.push('all five UI styles and an explicitly disabled floating toolbar survive isolated reload; reset restores floating toolbar/Professional defaults and malformed storage is ignored');

    const legacy={...saved};delete legacy.uiStyle;delete legacy.systemClock;delete legacy.floatingToolbar;
    await page.evaluate(legacy=>localStorage.setItem('sgrapeExperimentsV1',JSON.stringify(legacy)),legacy);await reload();
    assert.deepEqual(await settings(),{...legacy,uiStyle:'professional',systemClock:false,floatingToolbar:true});assert.equal(await page.locator('html').getAttribute('data-ui-style'),'professional');assert.equal(await page.locator('#canvas>.toolbar').count(),1);
    await open();for(const uiStyle of ['cool','excellent','legendary','godlike']){await control('uiStyle').selectOption(uiStyle);await settle();assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('sgrapeExperimentsV1'))),{...legacy,uiStyle,systemClock:false,floatingToolbar:true});}
    await page.locator('#experimentsreset').click();await settle();assert.deepEqual(await settings(),defaults);assert.equal(await page.locator('html').getAttribute('data-ui-style'),'professional');
    checks.push('legacy V1 preferences retain existing options while missing style/toolbar flags default to Professional/floating; selecting a style persists defaults and reset restores them');

    await setup();await set({systemClock:true});assert.equal(await page.evaluate(()=>matchMedia('(pointer:coarse)').matches),true);
    const geometryBefore=await snapshot();
    for(const width of[320,390])for(const scale of[75,125])for(const theme of['dark','light']){
      await close();await page.setViewportSize({width,height:844});await page.evaluate(({scale,theme})=>{setUIAppearance('scale',scale);setUIAppearance('theme',theme);}, {scale,theme});await settle();await open();
      const bounds=await panel.boundingBox();assert.ok(bounds.x>=-1&&bounds.y>=-1&&bounds.x+bounds.width<=width+1&&bounds.y+bounds.height<=845,JSON.stringify({width,scale,theme,bounds}));
      assert.ok(await panel.evaluate(e=>e.scrollWidth<=e.clientWidth+1));
      const clockBounds=await page.locator('#uisystemclock').boundingBox(),fullscreenBounds=await page.locator('#uifullscreen').boundingBox();assert.ok(clockBounds&&fullscreenBounds&&clockBounds.x>=0&&clockBounds.x+clockBounds.width<=fullscreenBounds.x&&fullscreenBounds.x+fullscreenBounds.width<=width+1);
      await control('systemClock').scrollIntoViewIfNeeded();const target=await control('systemClock').boundingBox();assert.ok(target&&target.x>=0&&target.x+target.width<=width);
      if(width===390&&scale===125)await page.screenshot({path:path.join(folder,`experiments-${theme}-coarse.png`)});
    }
    assert.equal(await snapshot(),geometryBefore);checks.push('320/390px coarse-pointer layouts at 75/125% in both themes keep the enabled footer clock, fullscreen, panel and its last option usable without graph/history changes');
    await close();await page.setViewportSize({width:390,height:844});await page.evaluate(()=>setUIAppearance('scale',100));await settle();await opener.tap();assert.equal(await panel.isVisible(),true);const old=(await settings()).nodeBodyDrag;await control('nodeBodyDrag').tap();assert.equal((await settings()).nodeBodyDrag,!old);await page.locator('#editorheader .brand').tap();assert.equal(await panel.isVisible(),false);
    checks.push('trusted coarse touch opens the panel, toggles a preference and dismisses outside');

    await close();await page.setViewportSize({width:320,height:844});await page.evaluate(()=>{setUIAppearance('scale',125);setUIExperiments({canvasTrash:true});setGraphFocus(true);});await settle();
    const focusCorners=await page.evaluate(()=>{const rect=selector=>{const r=$(selector).getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};return{trash:rect('#graphtrash'),tools:rect('.canvas-view-tools'),canvas:rect('#canvas')};});
    assert.ok(Math.abs(focusCorners.trash.right-focusCorners.canvas.right)<2&&focusCorners.trash.bottom<=focusCorners.tools.top,JSON.stringify(focusCorners));
    assert.equal(await page.locator('.canvas-view-tools #uifullscreen').count(),1);assert.equal(await page.locator('#graphfocus').getAttribute('aria-pressed'),'true');
    checks.push('320px / 125% coarse focus mode keeps the trash at the right edge above fullscreen and restore-layout view tools');

    const desktop=await h.browser.newPage({viewport:{width:1600,height:1000},hasTouch:false});desktop.on('pageerror',error=>errors.push(error.message));await desktop.goto(page.url());await desktop.waitForSelector('.node');await desktop.evaluate(()=>{clearTimeout(autoTimer);connectionInterrupted=true;conflicted=true;setUIAppearance('theme','dark');setUIAppearance('scale',100);setUIExperiments({systemClock:true});});await desktop.locator('#uiexperiments').click();await desktop.evaluate(()=>document.fonts.ready);await desktop.screenshot({path:path.join(folder,'experiments-dark-desktop.png')});await desktop.close();
    assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,count:checks.length}));
  }catch(error){await h.finish(error);throw error;}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
