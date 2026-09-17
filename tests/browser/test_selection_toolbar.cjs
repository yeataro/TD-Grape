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
  const bounds=()=>page.evaluate(()=>current().nodes.filter(n=>selection.has(n.id)).map(n=>({id:n.id,...nodeLayoutBounds(n)})));
  const reset=async()=>{await page.evaluate(()=>{closeArrangeMenu();graph=clone(window.selectionFixture);selection=new Set(['a','b','c','d']);selected='c';selectedEdge=null;past=[];future=[];readonly=false;historyBusy=false;nativeMutationBusy=false;dirty=false;rememberSavedGraph(graph);render();fit();});await settle();};
  const arrangement=async kind=>{await page.locator('#grapharrange').click();await page.locator('[data-arrange="'+kind+'"]').click();await settle();};
  const visual=()=>page.evaluate(()=>{const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};return{bar:rect($('#selectiontoolbar')),canvas:rect($('#canvas')),bounds:selectedCanvasBounds(),visible:!$('#selectiontoolbar').hidden&&getComputedStyle($('#selectiontoolbar')).visibility!=='hidden'};});
  try{
    await page.waitForSelector('#selectiontoolbar',{state:'attached'});
    await page.evaluate(()=>{
      clearTimeout(autoTimer);connectionInterrupted=true;conflicted=true;readonly=false;stage='pixel';graphTrail=[];historyBusy=false;nativeMutationBusy=false;
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
      assert.equal(await page.locator('.toolbar #undo').count(),1);assert.equal(await page.locator('.toolbar #redo').count(),1);
      for(const id of ['graphcopy','graphpaste','graphdelete','graphgroup','grapharrange'])assert.equal(await page.locator('#'+id).count(),1,id+' must be moved, never cloned');
    }
    checks.push('off/multiple/all modes place edit and multi-selection actions correctly for zero/one/two selections; history stays above and action IDs remain unique');

    await mode('multiple',false);await select(['a']);assert.equal(await page.locator('#graphcopy').isVisible(),false);
    await select(['a','b']);assert.equal(await page.locator('#selectiontoolbar').isVisible(),true);assert.equal(await page.locator('#graphcopy').isVisible(),false);
    await mode('all',false);await select(['a']);assert.equal(await page.locator('#graphcopy').isVisible(),true);
    await mode('off',true);assert.equal(await page.locator('#graphcopy').isVisible(),true);
    checks.push('independent edit-toolbar visibility controls top edit actions while all-selection mode still supplies its contextual edit actions');

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
      const button=await page.locator('#grapharrange').boundingBox();await page.touchscreen.tap(button.x+button.width/2,button.y+button.height/2);await settle();assert.equal(await page.locator('#arrangemenu').isVisible(),true);const m=await page.locator('#arrangemenu').boundingBox();assert.ok(m.x>=0&&m.y>=0&&m.x+m.width<=width+1&&m.y+m.height<=(width===844?390:844)+1,JSON.stringify(m));
      const option=await page.locator('[data-arrange="left"]').boundingBox();await page.touchscreen.tap(option.x+option.width/2,option.y+option.height/2);await settle();const arranged=await bounds();near(arranged[0].x,arranged[1].x,'touch aligns');assert.equal(await page.evaluate(()=>past.length),1);layouts.push({width,factor,...v,menu:m});await page.evaluate(()=>setGraphFocus(false));
    }
    fs.writeFileSync(path.join(folder,'layouts.json'),JSON.stringify(layouts,null,2));checks.push('touch can open and apply arrangements at320/390px portrait and844px landscape at100/125% UI scale; groups remain horizontal while toolbar/menu stay inside viewport');
    await page.setViewportSize({width:1600,height:1100});await page.evaluate(()=>setUIAppearance('scale',100));await reset();await mode('all');await select(['a','b']);await page.screenshot({path:path.join(folder,'selection-toolbar.png')});assert.deepEqual(errors,[]);await h.finish();
  }catch(error){await h.finish(error);throw error;}
}
run().catch(error=>{console.error(error);process.exit(1);});
