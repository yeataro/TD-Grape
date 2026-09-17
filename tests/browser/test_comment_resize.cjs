/* Comment's two-axis handle shares ordinary node resize transactions. */
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {harness}=require('./test_glsl_code.cjs');
const [source,stateFile,folder]=process.argv.slice(2);
(async()=>{
  const h=await harness(source,stateFile,folder,{touch:true}),{page,checks,errors,settle}=h;
  page.setDefaultTimeout(6000);
  const card=id=>page.locator(`[data-node="${id}"]`),handle=id=>page.locator(`[data-node-resize="${id}"]`),body=()=>card('note').locator('[data-comment-node]'),preview=()=>card('note').locator('.comment-node-preview');
  const size=id=>card(id).evaluate(e=>{const r=e.getBoundingClientRect(),z=scale*uiScaleFactor();return{width:r.width/z,height:r.height/z};});
  const snapshot=()=>page.evaluate(()=>JSON.stringify({graph,past,future,pan,dirty}));
  const start=async(id='note')=>{const r=await handle(id).boundingBox(),p={x:r.x+r.width/2,y:r.y+r.height/2};await page.mouse.move(p.x,p.y);await page.mouse.down();return p;};
  const drag=async(dx,dy,id='note')=>{const p=await start(id);await page.mouse.move(p.x+dx,p.y+dy,{steps:4});await page.mouse.up();await settle();};
  const reset=async()=>{
    await page.evaluate(()=>{
      document.activeElement?.blur();clearTimeout(autoTimer);connectionInterrupted=true;conflicted=true;readonly=false;historyBusy=false;nativeMutationBusy=false;
      graphTrail=[];graph.functions=[];graph.declarations=[];stage='pixel';selectedInputId=null;inspectorTab='parameters';
      graph.stages.pixel={nodes:[testNode('note','comment',60,180),testNode('value','float',520,180)],edges:[]};
      Object.assign(current().nodes[0].ui,{width:320,height:200,comment:Array.from({length:35},(_,i)=>'- Line '+(i+1)).join('\n')});
      selected='note';selection=new Set(['note']);past=[];future=[];dirty=false;rememberSavedGraph(graph);
      setUIAppearance('scale',100);setUIExperiments({selectionToolbar:'all'});render();scale=1;pan={x:20,y:20};transform();
    });await settle();
  };
  try{
    await reset();const before=await snapshot(),barBefore=await page.locator('#selectiontoolbar').boundingBox(),p=await start();
    await page.mouse.move(p.x+70,p.y+90,{steps:5});await settle();assert.deepEqual(await size('note'),{width:390,height:290});assert.equal(await snapshot(),before);
    const barPreview=await page.locator('#selectiontoolbar').boundingBox();assert.ok(Math.abs(barPreview.x-barBefore.x-35)<.02,'centered toolbar follows half the width delta');assert.ok(Math.abs(barPreview.y-barBefore.y)<.02,'top-aligned toolbar stays above while the node grows down');
    await page.mouse.up();await settle();assert.equal(await page.evaluate(()=>past.length),1);assert.equal(await page.evaluate(()=>hasShaderChanges(graph)),false);
    assert.deepEqual(await page.evaluate(()=>[current().nodes[0].ui.width,current().nodes[0].ui.height]),[390,290]);
    await page.evaluate(()=>undo());assert.deepEqual(await size('note'),{width:320,height:200});await page.evaluate(()=>undo(true));assert.deepEqual(await size('note'),{width:390,height:290});
    checks.push('Two-axis preview updates the selection toolbar without writes; release commits both dimensions as one layout-only Undo/Redo');

    const textLayout=await preview().evaluate(e=>{const r=e.getBoundingClientRect(),card=e.closest('.node').getBoundingClientRect(),title=e.closest('.node').querySelector('.node-title').getBoundingClientRect();return{gap:r.top-title.bottom,bottom:card.bottom-r.bottom,scroll:e.scrollHeight>e.clientHeight,overflow:getComputedStyle(e).overflowY};});
    assert.ok(textLayout.gap>=9&&textLayout.gap<=11);assert.ok(textLayout.bottom>=10&&textLayout.bottom<=12);assert.equal(textLayout.scroll,true);assert.equal(textLayout.overflow,'auto');
    const graphZoom=await page.evaluate(()=>scale);await preview().hover();await page.mouse.wheel(0,160);await page.waitForFunction(()=>document.querySelector('[data-node="note"] .comment-node-preview').scrollTop>0);assert.equal(await page.evaluate(()=>scale),graphZoom);
    await page.evaluate(()=>setNodesCollapsed(['note'],true));assert.ok((await size('note')).height<70);assert.equal(await handle('note').count(),0);assert.equal(await page.evaluate(()=>current().nodes[0].ui.height),290);
    await page.evaluate(()=>setNodesCollapsed(['note'],false));assert.deepEqual(await size('note'),{width:390,height:290});
    checks.push('Text fills the card body and scrolls; collapse ignores stored height and expanding restores both saved dimensions');

    await reset();await page.evaluate(()=>{setUIAppearance('scale',125);scale=.5;transform();});await settle();await drag(50,35);
    assert.deepEqual(await size('note'),{width:400,height:256});assert.equal(await page.evaluate(()=>past.length),1);
    checks.push('Combined 125% interface / 50% graph scale converts both pointer deltas into graph units correctly');

    await reset();await page.evaluate(()=>{scale=.4;transform();});await drag(-80,-100);assert.deepEqual(await size('note'),{width:190,height:110});
    const atMinimum=await page.evaluate(()=>past.length);await drag(-20,-20);assert.equal(await page.evaluate(()=>past.length),atMinimum,'dragging beyond the shared minimum adds no history');
    await page.evaluate(()=>{current().nodes[0].ui.width=120;render();});await settle();assert.deepEqual(await size('note'),{width:190,height:110},'saved widths below the ordinary-node minimum are clamped for display');
    await page.evaluate(()=>{graph=JSON.parse(JSON.stringify(graph));render();scale=1;transform();});await settle();assert.deepEqual(await size('note'),{width:190,height:110});assert.equal(await page.evaluate(()=>current().nodes[0].ui.width),120,'render and reload do not rewrite saved dimensions');assert.equal(await page.evaluate(()=>past.length),atMinimum);await card('note').screenshot({path:path.join(folder,'comment-narrow.png')});await page.evaluate(()=>{scale=.4;transform();});
    await drag(450,450);assert.deepEqual(await size('note'),{width:1200,height:1200});const atMaximum=await page.evaluate(()=>past.length);await drag(30,30);assert.equal(await page.evaluate(()=>past.length),atMaximum);
    checks.push('Comment shares the ordinary 190px width minimum, clamps narrower saved widths on render/reload without rewriting them, and keeps no-op history empty; height remains 110–1200px and maximum width1200px');


    await reset();await page.evaluate(()=>{const n=current().nodes[0];Object.assign(n.ui,{width:190,height:110,comment:'# Heading'});rememberSavedGraph(graph);past=[];future=[];render();scale=1;transform();});await settle();
    const minimumLayout=()=>card('note').evaluate(e=>{const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height};},reader=e.querySelector('.comment-node-preview');return{card:rect(e),body:rect(e.querySelector('.comment-node-canvas-content')),reader:rect(reader),scroll:reader.scrollHeight,client:reader.clientHeight,text:reader.querySelector('h1')?.textContent};});
    const insets=()=>card('note').evaluate(e=>{const b=getComputedStyle(e.querySelector('.comment-node-canvas-content')),p=getComputedStyle(e.querySelector('.comment-node-preview'));return{outer:['Top','Right','Bottom','Left'].map(side=>parseFloat(b['margin'+side])),inner:['Top','Right','Bottom','Left'].map(side=>parseFloat(p['padding'+side]))};});const normalMinimum=await minimumLayout(),opaqueInsets=await insets();assert.equal(normalMinimum.card.width,190);assert.equal(normalMinimum.card.height,110);assert.equal(normalMinimum.text,'Heading');assert.ok(normalMinimum.scroll<=normalMinimum.client+1,'single H1 fits at minimum size without vertical scrolling');
    await card('note').locator('[data-note-appearance="noteTitleOnSelection"]').click();await settle();
    for(const isSelected of [true,false,true]){
      await page.evaluate(isSelected=>{document.activeElement?.blur();selection=new Set(isSelected?['note']:[]);selected=isSelected?'note':null;render();},isSelected);await settle();const measured=await minimumLayout();
      for(const key of ['card','body','reader'])assert.deepEqual(measured[key],normalMinimum[key],key+' minimum geometry stays fixed when title is hidden/reselected');assert.ok(measured.scroll<=measured.client+1);assert.equal(await page.evaluate(()=>current().nodes[0].ui.height),110);
      if(!isSelected)await page.screenshot({clip:normalMinimum.card,path:path.join(folder,'note-minimum-hidden.png')});
    }
    assert.equal(await page.evaluate(()=>hasShaderChanges()),false);await card('note').screenshot({path:path.join(folder,'note-minimum-selected.png')});checks.push('A single H1 fits the shared 190×110 minimum without vertical scrolling; hidden/reselected title preserves body space and stored height');


    await reset();await page.evaluate(()=>{const n=current().nodes[0];Object.assign(n.ui,{width:190,height:90,noteTransparent:true,comment:'# Heading'});rememberSavedGraph(graph);past=[];future=[];render();scale=1;transform();});await settle();
    const compactMinimum=await minimumLayout(),transparentInsets=await insets();assert.equal(compactMinimum.card.width,190);assert.equal(compactMinimum.card.height,90);assert.ok(compactMinimum.scroll<=compactMinimum.client+1,'single H1 fits compact transparent minimum without vertical scrolling');
    for(const group of ['outer','inner'])for(let i=0;i<4;i++)assert.equal(transparentInsets[group][i],opaqueInsets[group][i]/2,group+' inset is halved on every edge');
    await card('note').locator('[data-note-appearance="noteTitleOnSelection"]').click();await settle();
    for(const isSelected of [true,false,true]){await page.evaluate(isSelected=>{document.activeElement?.blur();selection=new Set(isSelected?['note']:[]);selected=isSelected?'note':null;render();},isSelected);await settle();const measured=await minimumLayout();for(const key of ['card','body','reader'])assert.deepEqual(measured[key],compactMinimum[key]);assert.ok(measured.scroll<=measured.client+1);}
    const beforeOpaque=await page.evaluate(()=>JSON.stringify(graph)),beforeOpaqueHistory=await page.evaluate(()=>past.length);await card('note').locator('[data-note-color="note"]').click();await page.locator('[data-note-color-default]').click();await settle();assert.equal((await size('note')).height,110);assert.equal(await page.evaluate(()=>current().nodes[0].ui.height),90,'opaque minimum clamps rendering without rewriting saved 90px');assert.equal(await page.evaluate(()=>past.length),beforeOpaqueHistory+1);const opaqueAt90=await page.evaluate(()=>JSON.stringify(graph));
    await page.locator('#undo').click();await settle();assert.equal(await page.evaluate(()=>JSON.stringify(graph)),beforeOpaque);assert.equal((await size('note')).height,90);await page.locator('#redo').click();await settle();assert.equal(await page.evaluate(()=>JSON.stringify(graph)),opaqueAt90);assert.equal((await size('note')).height,110);
    await card('note').locator('[data-note-color="note"]').click();await page.locator('[data-note-color-transparent]').click();await settle();assert.equal((await size('note')).height,90);assert.equal(await page.evaluate(()=>current().nodes[0].ui.height),90);assert.equal(await page.evaluate(()=>hasShaderChanges()),false);await card('note').screenshot({path:path.join(folder,'note-minimum-transparent.png')});checks.push('Transparent notes halve inner/outer padding on all four edges, fit H1 at 190×90, preserve selection geometry, and toggle opaque display clamp with exact Undo while retaining stored size');

    for(const reason of ['Escape','blur','pointercancel','lostpointercapture']){
      await reset();const stable=await snapshot(),p=await start();await page.mouse.move(p.x+35,p.y+45);
      if(reason==='Escape')await page.keyboard.press('Escape');
      else if(reason==='blur')await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
      else if(reason==='pointercancel')await handle('note').evaluate(e=>e.dispatchEvent(new PointerEvent('pointercancel',{pointerId:1,bubbles:true})));
      else await handle('note').evaluate(e=>e.releasePointerCapture(1));
      await page.mouse.up();await settle();assert.deepEqual(await size('note'),{width:320,height:200});assert.equal(await snapshot(),stable);
    }
    checks.push('Escape, blur, pointer cancellation and capture loss restore both dimensions without changing history');

    await reset();const cdp=await page.context().newCDPSession(page),r=await handle('note').boundingBox(),tp={x:r.x+r.width/2,y:r.y+r.height/2,id:7},pan=await page.evaluate(()=>({...pan}));
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[tp]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...tp,x:tp.x+40,y:tp.y+55}]});
    assert.deepEqual(await size('note'),{width:360,height:255});assert.equal(await page.evaluate(()=>past.length),0);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await settle();assert.equal(await page.evaluate(()=>past.length),1);assert.deepEqual(await page.evaluate(()=>({...pan})),pan);
    const stable=await snapshot(),r2=await handle('note').boundingBox(),t2={x:r2.x+r2.width/2,y:r2.y+r2.height/2,id:7};
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[t2]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...t2,x:t2.x+20,y:t2.y+20}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await settle();
    assert.equal(await snapshot(),stable);assert.deepEqual(await size('note'),{width:360,height:255});
    checks.push('Trusted touch resizes both dimensions without graph pan; touch cancellation restores the last saved size');

    await reset();await preview().dblclick();await body().fill('Uncommitted text');const committed=await page.evaluate(()=>nodeComment(current().nodes[0]));await drag(30,50);
    assert.equal(await body().inputValue(),'Uncommitted text');assert.equal(await body().evaluate(e=>e===document.activeElement),true);assert.equal(await page.evaluate(()=>nodeComment(current().nodes[0])),committed);assert.equal(await page.evaluate(()=>past.length),1);assert.deepEqual(await size('note'),{width:350,height:250});
    await body().press('Control+Enter');assert.equal(await page.evaluate(()=>past.length),2);assert.equal(await page.evaluate(()=>nodeComment(current().nodes[0])),'Uncommitted text');
    checks.push('A focused text draft survives two-axis resizing, stays uncommitted, and creates a separate Undo only when explicitly applied');

    const copied=await page.evaluate(()=>{
      const packet=GraphClipboard.decode(GraphClipboard.encode(graph,current(),['note'],shaderId));change(()=>GraphClipboard.paste(graph,current(),packet,{source:shaderId,stage,target:editorTarget,catalog,types:numericTypes(),anchor:{x:500,y:430}}));
      const n=current().nodes.find(n=>n.id!=='note'&&n.definitionUuid==='sgrape.builtin.comment');graph=JSON.parse(JSON.stringify(graph));document.activeElement?.blur();render();return n.id;
    });
    assert.deepEqual(await size(copied),{width:350,height:250});assert.equal(await card(copied).locator('[data-comment-node]').inputValue(),'Uncommitted text');
    await page.evaluate(()=>{readonly=true;render();});assert.equal(await handle('note').count(),0);assert.deepEqual(await size('note'),{width:350,height:250});
    checks.push('Clipboard, JSON save/load and read-only rendering preserve height and width together');

    await reset();const ordinary=await size('value');await drag(0,80,'value');assert.deepEqual(await size('value'),ordinary);assert.equal(await page.evaluate(()=>past.length),0);assert.equal(await page.evaluate(()=>Object.hasOwn(current().nodes[1].ui,'height')),false);
    await drag(50,80,'value');assert.equal((await size('value')).height,ordinary.height);assert.equal(await page.evaluate(()=>Object.hasOwn(current().nodes[1].ui,'height')),false);
    await page.screenshot({path:path.join(folder,'comment-height.png')});assert.deepEqual(errors,[]);
    checks.push('Ordinary nodes ignore vertical drags and retain width-only geometry and persistence');
    await h.finish();console.log(JSON.stringify({passed:true,count:checks.length}));
  }catch(e){await h.finish(e);throw e;}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
