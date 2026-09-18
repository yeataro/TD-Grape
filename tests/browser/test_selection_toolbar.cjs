/* Selection toolbar and arrangement use an isolated fixture API, never TD.
 * node test_selection_toolbar.cjs SOURCE_DIR STATE_JSON REPORT_DIR */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {harness}=require('./test_glsl_code.cjs');
async function run(){
  const[source,stateFile,folder]=process.argv.slice(2),h=await harness(source,stateFile,folder,{touch:true}),{page,checks,errors,settle}=h;
  page.setDefaultTimeout(6000);
  const near=(a,b,label)=>assert.ok(Math.abs(a-b)<.02,`${label}: ${a} vs ${b}`);
  const select=async ids=>{await page.evaluate(ids=>{selection=new Set(ids);selected=ids.at(-1)||null;selectedEdge=null;render();},ids);await settle();};
  const mode=async(value,edit=true)=>{await page.evaluate(({value,edit})=>setUIExperiments({selectionToolbar:value,editToolbar:edit}),{value,edit});await settle();};
  const graphJSON=()=>page.evaluate(()=>JSON.stringify(graph));
  const editState=()=>page.evaluate(()=>({graph:JSON.stringify(graph),selection:[...selection],selected,selectedEdge,past:JSON.stringify(past),future:JSON.stringify(future),dirty,shaderChanges:hasShaderChanges()}));
  const viewState=()=>page.evaluate(()=>({scale,pan:{...pan}}));
  const bounds=()=>page.evaluate(()=>current().nodes.filter(n=>selection.has(n.id)).map(n=>({id:n.id,...nodeLayoutBounds(n)})));
  const reset=async()=>{await page.evaluate(()=>{closeArrangeMenu();graph=clone(window.selectionFixture);selection=new Set(['a','b','c','d']);selected='c';selectedEdge=null;past=[];future=[];readonly=false;historyBusy=false;nativeMutationBusy=false;dirty=false;rememberSavedGraph(graph);render();fit();});await settle();};
  const arrangement=async kind=>{await page.locator('#grapharrange').click();await page.locator('[data-arrange="'+kind+'"]').click();await settle();};
  const visual=()=>page.evaluate(()=>{const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};return{bar:rect($('#selectiontoolbar')),canvas:rect($('#canvas')),bounds:selectedCanvasBounds(),visible:!$('#selectiontoolbar').hidden&&getComputedStyle($('#selectiontoolbar')).visibility!=='hidden'};});
  const framed=async()=>{const v=await visual();assert.ok(v.bounds,'selection has visible bounds');assert.ok(Math.abs((v.bounds.left+v.bounds.right)/2-(v.canvas.x+v.canvas.right)/2)<1.5,'selected bounds centered horizontally');assert.ok(Math.abs((v.bounds.top+v.bounds.bottom)/2-(v.canvas.y+v.canvas.bottom)/2)<1.5,'selected bounds centered vertically');assert.ok(v.bounds.left>=v.canvas.x&&v.bounds.right<=v.canvas.right&&v.bounds.top>=v.canvas.y&&v.bounds.bottom<=v.canvas.bottom,'selected bounds fit within the canvas');return v;};
  try{
    await page.waitForSelector('#selectiontoolbar',{state:'attached'});
    await page.evaluate(()=>{
      clearTimeout(autoTimer);connectionInterrupted=true;conflicted=true;readonly=false;stage='pixel';graphTrail=[];historyBusy=false;nativeMutationBusy=false;setUIExperiments({persistentSelectionBounds:false});
      const a=testNode('a','float',80,100,{value:.375}),b=testNode('b','vec2',490,220,{value:[.2,.8]}),c=testNode('c','color',1000,410,{value:[.1,.3,.7,.9]}),d=testNode('d','comment',1540,600),out=testNode('output','pixel_out',2200,800);
      a.ui.width=230;b.ui.width=300;c.ui.width=370;d.ui.width=280;d.ui.comment='Fixture note\nSecond line';
      current().nodes=[a,b,c,d,out];current().edges=[{from:['c','out'],to:['output','color']}];selectionFixture=clone(graph);
    });await reset();
    assert.ok(new Set((await bounds()).map(n=>n.width)).size>1,'fixture must exercise variable widths');
    assert.ok(new Set((await bounds()).map(n=>n.height)).size>1,'fixture must exercise variable heights');
    for(const value of ['off','multiple','all'])for(const ids of [[],['a'],['a','b']]){
      await mode(value);await select(ids);
      assert.equal(await page.locator('#selectiontoolbar').isVisible(),value==='all'?ids.length>0:value==='multiple'&&ids.length>1,JSON.stringify({value,ids}));
      assert.equal(await page.locator('.toolbar [data-tool-group="edit"]').count(),value==='all'?0:1);
      assert.equal(await page.locator('#graphgroup').isVisible(),ids.length>1);
      assert.equal(await page.locator('#grapharrange').isVisible(),ids.length>1);
      assert.equal(await page.locator('#graphfitselection').isVisible(),ids.length>0&&(value!=='multiple'||ids.length>1));
      assert.equal(await page.locator('.toolbar #undo').count(),1);assert.equal(await page.locator('.toolbar #redo').count(),1);
      for(const id of ['graphcopy','graphpaste','graphdelete','graphgroup','grapharrange','graphfitselection'])assert.equal(await page.locator('#'+id).count(),1,id+' must be moved, never cloned');
    }
    checks.push('off/multiple/all modes place edit and multi-selection actions correctly for zero/one/two selections; history stays above and action IDs remain unique');

    await mode('multiple',false);await select(['a']);assert.equal(await page.locator('#graphcopy').isVisible(),false);
    await select(['a','b']);assert.equal(await page.locator('#selectiontoolbar').isVisible(),true);assert.equal(await page.locator('#graphcopy').isVisible(),false);
    await mode('all',false);await select(['a']);assert.equal(await page.locator('#graphcopy').isVisible(),true);
    await mode('off',true);assert.equal(await page.locator('#graphcopy').isVisible(),true);
    checks.push('independent edit-toolbar visibility controls top edit actions while all-selection mode still supplies its contextual edit actions');

    await reset();await page.mouse.move(2,2);await page.locator('#canvas').focus();
    assert.equal(await page.evaluate(()=>EDITOR_DEV_SETTINGS.persistentSelectionBounds),false);
    for(const value of ['off','multiple','all']){
      await mode(value,false);await select(['a','b']);const beforeOutline=await editState();
      await page.evaluate(()=>setUIExperiments({persistentSelectionBounds:true}));await settle();
      assert.equal(await page.locator('#selectionbounds').isVisible(),true,'persistent outline is independent of toolbar mode '+value);
      assert.deepEqual(await editState(),beforeOutline,'outline preference preserves graph, selection, history and dirty state');
      await page.evaluate(()=>setUIExperiments({persistentSelectionBounds:false}));await settle();assert.equal(await page.locator('#selectionbounds').isVisible(),false);
    }
    await mode('off',false);await page.evaluate(()=>setUIExperiments({persistentSelectionBounds:true}));
    for(const ids of [[],['a'],['a','b']]){await select(ids);assert.equal(await page.locator('#selectionbounds').isVisible(),ids.length>1,'persistent outline requires multiple selected nodes');}
    await page.evaluate(()=>{readonly=true;render();});await settle();assert.equal(await page.locator('#selectionbounds').isVisible(),true,'readonly may still show the selection outline');
    await page.evaluate(()=>{readonly=false;setUIAppearance('scale',125);scale=.35;pan={x:30,y:120};transform();});await settle();
    const outlineGeometry=await page.evaluate(()=>{const r=$('#selectionbounds').getBoundingClientRect();return{left:r.left,top:r.top,right:r.right,bottom:r.bottom,bounds:selectedCanvasBounds(),zoom:uiScaleFactor()};});
    near(outlineGeometry.left,outlineGeometry.bounds.left-6*outlineGeometry.zoom,'outline tracks graph and UI zoom horizontally');near(outlineGeometry.top,outlineGeometry.bounds.top-6*outlineGeometry.zoom,'outline tracks graph and UI zoom vertically');
    await page.evaluate(()=>{pan.x=-10000;transform();});await settle();assert.equal(await page.locator('#selectionbounds').isVisible(),false,'fully offscreen selection hides its persistent outline');
    await page.evaluate(()=>{pan.x=30;transform();});await settle();assert.equal(await page.locator('#selectionbounds').isVisible(),true,'outline returns when selection enters the viewport');
    await page.evaluate(()=>{setUIExperiments({persistentSelectionBounds:false});setUIAppearance('scale',100);});await settle();
    checks.push('optional persistent outline works with every toolbar mode and hidden edit tools, requires two nodes, survives readonly and viewport movement, follows both zoom scales, and changes no graph or history');

    await reset();await page.evaluate(()=>{
      GraphFrames.write(current(),[{id:'groupAB',name:'Group 1',color:'#7f8797',nodes:['a','b']},{id:'groupC',name:'Group 2',color:'#9285ad',nodes:['c']}]);render();fit();
    });await select(['a','b']);const beforeGroupOutline=await editState();
    for(const value of ['off','multiple','all']){
      await mode(value);await page.evaluate(()=>setUIExperiments({persistentSelectionBounds:true,hideGroupedSelectionBounds:true}));await settle();
      assert.equal(await page.locator('#selectionbounds').isVisible(),false,'complete group hides its outline in '+value+' mode');
      assert.equal(await page.locator('#selectiontoolbar').isVisible(),value!=='off','hiding the outline leaves the toolbar available');
      if(value!=='off'){await page.locator('#selectiontoolbar').hover();await settle();assert.equal(await page.locator('#selectionbounds').isVisible(),false,'toolbar hover respects the group exception');}
    }
    assert.deepEqual(await editState(),beforeGroupOutline,'group outline setting is view-only');
    for(const ids of [['a','b','d'],['a','b','c'],['a','d']]){
      await select(ids);assert.equal(await page.locator('#selectionbounds').isVisible(),true,'mixed or partial groups retain outline: '+ids);
    }
    await select(['a','b']);await page.evaluate(()=>setUIExperiments({hideGroupedSelectionBounds:false}));await settle();assert.equal(await page.locator('#selectionbounds').isVisible(),true,'disabling the exception restores the outline immediately');
    await page.evaluate(()=>setUIExperiments({persistentSelectionBounds:false,hideGroupedSelectionBounds:true}));await page.locator('#selectiontoolbar').hover();await settle();assert.equal(await page.locator('#selectionbounds').isVisible(),false,'hover-only outline also respects the exception');
    await select(['c']);await page.locator('#selectiontoolbar').hover();await settle();assert.equal(await page.locator('#selectionbounds').isVisible(),false,'one remaining group member is still a complete group');
    await select(['a','b','d']);await page.locator('#selectiontoolbar').hover();await settle();assert.equal(await page.locator('#selectionbounds').isVisible(),true,'hover-only mixed selection still shows its outline');
    await page.evaluate(()=>{readonly=true;setUIExperiments({persistentSelectionBounds:true});});await select(['a','b']);assert.equal(await page.locator('#selectionbounds').isVisible(),false,'group exception is available in readonly');
    await page.evaluate(()=>setUIExperiments({persistentSelectionBounds:false,hideGroupedSelectionBounds:false}));await page.mouse.move(2,2);
    checks.push('optional complete-group outline exception applies to persistent and hover outlines in all toolbar modes; mixed/partial/multiple groups retain outlines, toolbar remains available, readonly works and no graph/history changes occur');

    await reset();await mode('all');await select(['a','b']);
    const frameBefore=await editState(),allView=await viewState();
    await page.locator('#graphfitselection').click();await settle();await framed();
    const selectedView=await viewState();assert.ok(selectedView.scale>allView.scale,'framing selected nodes ignores the distant unselected nodes');assert.deepEqual(await editState(),frameBefore,'framing is view-only');
    await page.locator('#fit').click();await settle();assert.deepEqual(await viewState(),allView,'existing frame-all button still includes all nodes');
    await page.locator('#graphfitselection').click();await page.locator('#canvas').focus();await page.keyboard.press('h');await settle();assert.deepEqual(await viewState(),allView,'H still frames all nodes');assert.deepEqual(await editState(),frameBefore);
    await page.evaluate(()=>{arrangeSelection('left');arrangeSelection('top');});await page.locator('#undo').click();await settle();const pendingBefore=await editState();assert.equal(JSON.parse(pendingBefore.past).length,1);assert.equal(JSON.parse(pendingBefore.future).length,1);assert.equal(pendingBefore.dirty,true);await page.locator('#graphfitselection').click();await settle();await framed();assert.deepEqual(await editState(),pendingBefore,'framing preserves pending changes and both Undo/Redo branches');
    for(const[language,label]of [['en','Frame selection'],['zh-Hant','置中選取']]){await page.selectOption('#language',language);assert.equal(await page.locator('#graphfitselection').getAttribute('title'),label);assert.equal(await page.locator('#graphfitselection').getAttribute('aria-label'),label);assert.equal(await page.locator('#graphfitselection').getAttribute('aria-keyshortcuts'),null,'Frame selection has no new shortcut');}
    checks.push('Frame selection centers only selected nodes and zooms past distant unselected nodes without changing graph/selection/history/dirty state; frame-all and H stay unchanged and hints translate');

    await reset();await mode('all');await page.evaluate(()=>{const note=current().nodes.find(n=>n.id==='d');note.ui.width=500;note.ui.height=1200;render();});await select(['d']);
    const tallBefore=await editState();await page.locator('#graphfitselection').click();await settle();const tall=await framed(),tallScale=(await viewState()).scale;assert.deepEqual(await editState(),tallBefore,'tall-node framing is view-only');
    await page.evaluate(()=>{current().nodes.find(n=>n.id==='d').ui.collapsed=true;render();});await settle();
    const collapsedBefore=await editState();await page.locator('#graphfitselection').click();await settle();const collapsed=await framed();assert.ok(collapsed.bounds.bottom-collapsed.bounds.top<tall.bounds.bottom-tall.bounds.top,'collapsed node uses its actual rendered height');assert.ok((await viewState()).scale>tallScale,'collapsed height allows a closer frame');assert.deepEqual(await editState(),collapsedBefore);
    await page.evaluate(()=>{readonly=true;render();scale=.3;pan={x:100,y:100};transform();});assert.equal(await page.locator('#graphfitselection').isEnabled(),true);const lockedBefore=await editState();await page.locator('#graphfitselection').click();await settle();await framed();assert.deepEqual(await editState(),lockedBefore,'readonly still permits view-only framing');await page.evaluate(()=>{readonly=false;render();});
    await select([]);const emptyView=await viewState(),emptyState=await editState();await page.evaluate(()=>fitSelection());assert.deepEqual(await viewState(),emptyView);assert.deepEqual(await editState(),emptyState);
    await select(['a','b']);await page.evaluate(()=>{selectedEdge=0;render();});const edgeView=await viewState(),edgeState=await editState();await page.evaluate(()=>fitSelection());assert.deepEqual(await viewState(),edgeView);assert.deepEqual(await editState(),edgeState);
    checks.push('single/tall/collapsed selections frame their real bounds, readonly remains available, and empty or edge selections leave the viewport and editor state unchanged');

    await reset();await mode('all');await select(['a','b']);await page.evaluate(()=>{scale=.5;pan={x:35,y:180};transform();$('#canvas').focus();});await page.mouse.move(2,2);await settle();
    let first=await visual();assert.equal(first.visible,true);
    assert.ok(Math.abs((first.bar.x+first.bar.right)/2-(first.bounds.left+first.bounds.right)/2)<1,'toolbar centers horizontally above the selected bounds');
    assert.ok(first.bar.bottom<=first.bounds.top-5,'toolbar sits above the selection and does not cover output ports');
    const desktopButtons=await page.locator('#selectiontoolbar button:visible').evaluateAll(items=>items.map(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,height:r.height};}));
    assert.ok(desktopButtons.every((r,i)=>Math.abs(r.y-desktopButtons[0].y)<1&&(!i||r.x>=desktopButtons[i-1].right)),'desktop toolbar is one horizontal row');
    assert.equal(await page.locator('#selectionbounds').isVisible(),false);
    await page.locator('#selectiontoolbar').hover();await settle();assert.equal(await page.locator('#selectionbounds').isVisible(),true);
    await page.mouse.move(2,2);await settle();assert.equal(await page.locator('#selectionbounds').isVisible(),false);
    await page.locator('#graphcopy').focus();await page.keyboard.press('ArrowRight');
    assert.equal(await page.evaluate(()=>document.activeElement.id),await page.locator('#graphpaste').isEnabled()?'graphpaste':'graphdelete','Right moves to the next enabled toolbar action');
    await page.keyboard.press('ArrowLeft');assert.equal(await page.evaluate(()=>document.activeElement.id),'graphcopy','Left returns to the preceding action');await page.locator('#canvas').focus();
    await page.locator('#graphcopy').click();await page.mouse.move(2,2);await settle();assert.equal(await page.locator('#selectionbounds').isVisible(),false,'mouse click must not pin the hover outline');
    await page.evaluate(()=>{scale=.3;pan={x:70,y:210};transform();});await settle();const second=await visual();near(first.bar.width,second.bar.width,'toolbar width independent of graph zoom');near(first.bar.height,second.bar.height,'toolbar height independent of graph zoom');assert.notEqual(first.bar.x,second.bar.x);assert.ok(Math.abs((second.bar.x+second.bar.right)/2-(second.bounds.left+second.bounds.right)/2)<1);assert.ok(second.bar.bottom<=second.bounds.top-5);
    await page.evaluate(()=>{const c=$('#canvas');pan.x=c.clientWidth-330;scale=.5;transform();});await settle();const clamped=await visual();assert.equal(clamped.visible,true);assert.ok(clamped.bar.right<=clamped.canvas.right-2);assert.ok(clamped.bar.y>=clamped.canvas.y&&clamped.bar.bottom<=clamped.canvas.bottom);
    await page.evaluate(()=>{pan.x=-10000;transform();});await settle();assert.equal((await visual()).visible,false);
    checks.push('horizontal toolbar centers above selection bounds without covering output ports, clamps inside canvas, keeps its size through graph zoom/pan, and bounds appear only during contextual interaction');

    await reset();await mode('all');await select(['a']);
    await page.evaluate(()=>{const r=$('#canvas').getBoundingClientRect(),toolbar=$('#canvas>.toolbar').getBoundingClientRect(),n=current().nodes.find(n=>n.id==='a');scale=.6;pan={x:220,y:(toolbar.bottom-r.top)/uiScaleFactor()+10-n.ui.y*scale};transform();});await settle();
    const below=await visual();assert.equal(below.visible,true);assert.ok(below.bar.y>=below.bounds.bottom+5,'selection near the top toolbar uses the free space below');assert.ok(Math.abs((below.bar.x+below.bar.right)/2-(below.bounds.left+below.bounds.right)/2)<1,'below fallback remains centered');assert.ok(below.bar.bottom<=below.canvas.bottom);
    await select(['a','b']);await page.evaluate(()=>{scale=.6;pan={x:80,y:0};current().nodes.find(n=>n.id==='a').ui.y=0;current().nodes.find(n=>n.id==='b').ui.y=($('#canvas').clientHeight-40)/scale;render();transform();});await settle();
    const tight=await visual(),safeTop=await page.evaluate(()=>$('#canvas>.toolbar').getBoundingClientRect().bottom+8*uiScaleFactor());assert.equal(tight.visible,true);assert.ok(Math.abs(tight.bar.y-safeTop)<1,'when neither side fits, above placement clamps to the usable canvas top');assert.ok(tight.bar.x>=tight.canvas.x&&tight.bar.right<=tight.canvas.right+1&&tight.bar.bottom<=tight.canvas.bottom,'clamped fallback remains reachable');
    checks.push('centered toolbar falls below the selection when the top overlay blocks the space above, and clamps to the usable canvas when neither side fits');

    await reset();await mode('all');
    const original=await graphJSON();
    for(const kind of ['left','centerX','right','top','centerY','bottom']){
      await reset();await arrangement(kind);const rows=await bounds(),axis=['left','centerX','right'].includes(kind)?'x':'y';
      const values=rows.map(n=>kind==='centerX'?n.x+n.width/2:kind==='right'?n.x+n.width:kind==='centerY'?n.y+n.height/2:kind==='bottom'?n.y+n.height:n[axis]);values.forEach(v=>near(v,values[0],kind));
      assert.equal(await page.evaluate(()=>past.length),1,kind+' is one history step');
      const nonpositions=await page.evaluate(()=>({edges:current().edges,nodes:current().nodes.map(n=>({id:n.id,params:n.params,width:n.ui.width,comment:n.ui.comment}))}));
      await page.locator('#undo').click();await settle();assert.equal(await graphJSON(),original,kind+' undo restores exact graph');
      assert.deepEqual(await page.evaluate(()=>({edges:current().edges,nodes:current().nodes.map(n=>({id:n.id,params:n.params,width:n.ui.width,comment:n.ui.comment}))})),nonpositions,kind+' does not mutate values/edges');
    }
    checks.push('all six edge/center alignments account for each node size; each is one Undo step and preserves edges, values, notes, and widths');

    for(const kind of ['spaceX','spaceY']){
      await reset();await arrangement(kind);const axis=kind==='spaceX'?'x':'y',size=axis==='x'?'width':'height',rows=(await bounds()).sort((a,b)=>a[axis]-b[axis]);
      const gaps=rows.slice(1).map((n,i)=>n[axis]-rows[i][axis]-rows[i][size]);gaps.forEach(gap=>{near(gap,gaps[0],kind+' edge gaps');assert.ok(gap>=47.9,kind+' leaves room between nodes');});
      assert.equal(await page.evaluate(()=>past.length),1);await page.locator('#undo').click();await settle();assert.equal(await graphJSON(),original);
    }
    await reset();await arrangement('grid');const grid=await bounds();
    for(let i=0;i<grid.length;i++)for(let j=i+1;j<grid.length;j++){const a=grid[i],b=grid[j];assert.ok(a.x+a.width+47.9<=b.x||b.x+b.width+47.9<=a.x||a.y+a.height+47.9<=b.y||b.y+b.height+47.9<=a.y,'grid keeps generous gaps without overlap');}
    assert.equal(await page.evaluate(()=>past.length),1);await page.locator('#undo').click();await settle();assert.equal(await graphJSON(),original);
    checks.push('horizontal/vertical distribution equalizes edge gaps with a minimum margin; grid leaves space around differently sized nodes; each remains one reversible graph-only edit');

    await reset();await mode('all');await select(['a','b']);await page.locator('#grapharrange').click();assert.equal(await page.locator('[data-arrange="spaceX"]').isEnabled(),false);assert.equal(await page.locator('[data-arrange="spaceY"]').isEnabled(),false);
    await page.keyboard.press('Escape');await settle();assert.equal(await page.locator('#arrangemenu').isVisible(),false);assert.equal(await page.locator('#grapharrange').evaluate(e=>e===document.activeElement),true);
    await page.keyboard.press('Tab');await settle();assert.equal(await page.locator('#creator').isVisible(),false,'Tab from toolbar navigates focus instead of opening Creator');
    await page.locator('#grapharrange').click();await select(['a']);assert.equal(await page.locator('#arrangemenu').isVisible(),false);
    await select(['a','b']);await page.evaluate(()=>{readonly=true;render();});assert.equal(await page.locator('#grapharrange').isEnabled(),false);const readOnly=await graphJSON();await page.evaluate(()=>arrangeSelection('grid'));assert.equal(await graphJSON(),readOnly);await page.evaluate(()=>{readonly=false;render();});
    checks.push('distribution requires three nodes; arrangement closes when selection changes, Esc restores its opener, and readonly cannot mutate layout');

    const layouts=[];for(const width of [320,390,844])for(const factor of [100,125]){
      await page.setViewportSize({width,height:width===844?390:844});await reset();await mode('all');await select(['a','b']);await page.evaluate(factor=>setUIAppearance('scale',factor),factor);await page.evaluate(()=>setGraphFocus(true));await page.evaluate(()=>fit());await settle();const v=await visual();assert.equal(v.visible,true);assert.ok(v.bar.x>=v.canvas.x&&v.bar.right<=v.canvas.right+1&&v.bar.y>=v.canvas.y&&v.bar.bottom<=v.canvas.bottom+1,JSON.stringify(v));
      const groups=await page.locator('#selectiontoolbar .graph-tool-group:visible').evaluateAll(items=>items.map(group=>[...group.querySelectorAll('button')].filter(e=>e.getClientRects().length).map(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right};})));
      assert.ok(groups.every(items=>items.every((r,i)=>Math.abs(r.y-items[0].y)<1&&(!i||r.x>=items[i-1].right))),JSON.stringify({width,factor,groups})+' each group stays horizontal even when groups wrap');
      if(width===320&&factor===125)await page.screenshot({path:path.join(folder,'selection-toolbar-mobile-125.png')});
      const beforeFrame=await editState(),frameButton=await page.locator('#graphfitselection').boundingBox();assert.ok(frameButton&&frameButton.x>=0&&frameButton.y>=0&&frameButton.x+frameButton.width<=width+1&&frameButton.y+frameButton.height<=(width===844?390:844)+1,'Frame selection remains touch-reachable');await page.touchscreen.tap(frameButton.x+frameButton.width/2,frameButton.y+frameButton.height/2);await settle();await framed();assert.deepEqual(await editState(),beforeFrame,'touch framing adds no graph edit');
      const button=await page.locator('#grapharrange').boundingBox();await page.touchscreen.tap(button.x+button.width/2,button.y+button.height/2);await settle();assert.equal(await page.locator('#arrangemenu').isVisible(),true);const m=await page.locator('#arrangemenu').boundingBox();assert.ok(m.x>=0&&m.y>=0&&m.x+m.width<=width+1&&m.y+m.height<=(width===844?390:844)+1,JSON.stringify(m));
      const option=await page.locator('[data-arrange="left"]').boundingBox();await page.touchscreen.tap(option.x+option.width/2,option.y+option.height/2);await settle();const arranged=await bounds();near(arranged[0].x,arranged[1].x,'touch aligns');assert.equal(await page.evaluate(()=>past.length),1);layouts.push({width,factor,...v,menu:m});
      await page.evaluate(()=>setGraphFocus(false));
    }
    fs.writeFileSync(path.join(folder,'layouts.json'),JSON.stringify(layouts,null,2));checks.push('touch can frame selection and apply arrangements at320/390px portrait and844px landscape at100/125% UI scale; all six buttons remain reachable, groups stay horizontal, and toolbar/menu fit inside viewport');
    await page.setViewportSize({width:1600,height:1100});await page.evaluate(()=>setUIAppearance('scale',100));await reset();await mode('all');await select(['a','b']);await page.screenshot({path:path.join(folder,'selection-toolbar.png')});assert.deepEqual(errors,[]);await h.finish();
  }catch(error){await h.finish(error);throw error;}
}
run().catch(error=>{console.error(error);process.exit(1);});
