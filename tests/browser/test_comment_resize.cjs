/* Comment's two-axis handle shares ordinary node resize transactions. */
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {harness}=require('./test_glsl_code.cjs');
const [source,stateFile,folder]=process.argv.slice(2);
(async()=>{
  const h=await harness(source,stateFile,folder,{touch:true}),{page,checks,errors,settle}=h;
  page.setDefaultTimeout(6000);
  const card=id=>page.locator(`[data-node="${id}"]`),handle=id=>page.locator(`[data-node-resize="${id}"]`),body=()=>card('note').locator('[data-comment-node]'),preview=()=>card('note').locator('.comment-node-preview');
  const size=id=>card(id).evaluate(e=>{const r=e.getBoundingClientRect(),z=scale*uiScaleFactor();return{width:Number((r.width/z).toFixed(3)),height:Number((r.height/z).toFixed(3))};});
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

    await reset();await page.evaluate(()=>{scale=.4;transform();});await drag(-80,-100);const minimumSize=await size('note');assert.equal(minimumSize.width,190);assert.ok(minimumSize.height>70&&minimumSize.height<=110);
    const atMinimum=await page.evaluate(()=>past.length);await drag(-20,-20);assert.equal(await page.evaluate(()=>past.length),atMinimum,'dragging beyond the shared minimum adds no history');
    await page.evaluate(()=>{current().nodes[0].ui.width=120;render();});await settle();assert.deepEqual(await size('note'),minimumSize,'saved widths below the ordinary-node minimum are clamped for display');
    await page.evaluate(()=>{graph=JSON.parse(JSON.stringify(graph));render();scale=1;transform();});await settle();assert.deepEqual(await size('note'),minimumSize);assert.equal(await page.evaluate(()=>current().nodes[0].ui.width),120,'render and reload do not rewrite saved dimensions');assert.equal(await page.evaluate(()=>past.length),atMinimum);await card('note').screenshot({path:path.join(folder,'comment-narrow.png')});await page.evaluate(()=>{scale=.4;transform();});
    await drag(450,450);assert.deepEqual(await size('note'),{width:1200,height:1200});const atMaximum=await page.evaluate(()=>past.length);await drag(30,30);assert.equal(await page.evaluate(()=>past.length),atMaximum);
    checks.push('Notes keep the 190px width floor, use a content-sized one-line height floor, preserve narrower saved dimensions on render/reload, and keep no-op/max-size history empty');

    const layout=()=>card('note').evaluate(e=>{
      const z=scale*uiScaleFactor(),rect=e=>{const r=e.getBoundingClientRect();return{x:r.x/z,y:r.y/z,width:r.width/z,height:r.height/z};},reader=e.querySelector('.comment-node-preview'),content=e.querySelector('.comment-node-canvas-content'),rootBlock=reader.querySelector('.comment-markdown')?.firstElementChild,block=rootBlock?.matches('ul,ol')?rootBlock.firstElementChild:rootBlock;
      const rs=getComputedStyle(reader),bs=block&&getComputedStyle(block),cs=getComputedStyle(content),num=value=>parseFloat(value)||0,padding=s=>num(s.paddingTop)+num(s.paddingBottom),borders=s=>num(s.borderTopWidth)+num(s.borderBottomWidth);
      return {card:rect(e),body:rect(content),reader:rect(reader.hidden?e.querySelector('[data-comment-node]'):reader),title:rect(e.querySelector('.node-title')),scroll:reader.scrollHeight,client:reader.clientHeight,inner:reader.clientHeight-padding(rs),line:bs&&num(bs.lineHeight),blockMarginTop:bs&&num(bs.marginTop),blockPadding:bs&&padding(bs),blockBorders:bs&&borders(bs),blockScrollbar:block&&block.offsetHeight-block.clientHeight-borders(bs),blockScroll:block?.scrollHeight,blockClient:block?.clientHeight,readerScrollbar:reader.offsetHeight-reader.clientHeight-borders(rs),outer:['Top','Right','Bottom','Left'].map(side=>num(cs['margin'+side])),padding:['Top','Right','Bottom','Left'].map(side=>num(rs['padding'+side]))};
    });
    const sameGeometry=(a,b)=>{for(const key of ['card','body','reader','title'])for(const axis of ['x','y','width','height'])assert.ok(Math.abs(a[key][axis]-b[key][axis])<.06,key+'.'+axis+' changed with selection/edit state');};
    const lineRows=[];let opaqueInsets;
    for(const fontScale of [1,4,10])for(const kind of ['plain','h1','code','ul','ol'])for(const appearance of ['opaque','transparent','hidden','transparent-hidden']){
      await reset();await page.evaluate(({fontScale,kind,appearance})=>{const n=current().nodes[0];Object.assign(n.ui,{width:190,height:1,noteFontScale:fontScale,comment:kind==='h1'?'# X':kind==='code'?'```\nX\n```':kind==='ul'?'- X':kind==='ol'?'1. X':'X',noteTransparent:appearance.includes('transparent'),noteTitleOnSelection:appearance.includes('hidden')});past=[];future=[];rememberSavedGraph(graph);render();scale=1;transform();},{fontScale,kind,appearance});await settle();
      const measured=await layout(),label=kind+' '+fontScale+'x '+appearance,oneLine=measured.line+measured.blockMarginTop+measured.blockPadding+measured.blockBorders+measured.blockScrollbar;
      assert.equal(measured.card.width,190);assert.ok(measured.inner>=oneLine-1&&measured.inner<=oneLine+2,label+' first line fits without excess vertical space: '+JSON.stringify(measured));assert.ok(measured.scroll<=measured.client+1,label+' preview has no vertical scroll for one line');assert.ok(measured.blockScroll<=measured.blockClient+1,label+' code/body has no vertical scroll for one line');assert.equal(await page.evaluate(()=>current().nodes[0].ui.height),1);
      if(appearance==='opaque')opaqueInsets=measured;
      if(appearance==='transparent')for(const group of ['outer','padding'])for(let i=0;i<4;i++)assert.equal(measured[group][i],opaqueInsets[group][i]/2,group+' inset is half on every edge');
      if(appearance.includes('hidden'))for(const isSelected of [false,true]){await page.evaluate(isSelected=>{document.activeElement?.blur();selection=new Set(isSelected?['note']:[]);selected=isSelected?'note':null;render();},isSelected);await page.mouse.move(1500,1000);await settle();sameGeometry(measured,await layout());assert.equal(await card('note').locator('.node-title').isVisible(),isSelected);}
      if(fontScale===10&&['opaque','transparent-hidden'].includes(appearance))await page.screenshot({clip:await card('note').boundingBox(),path:path.join(folder,'note-first-line-'+kind+'-'+appearance+'.png')});
      lineRows.push({fontScale,kind,appearance,height:measured.card.height,line:measured.line});assert.equal(await page.evaluate(()=>hasShaderChanges()),false);assert.equal(await page.evaluate(()=>past.length),0);
    }
    fs.writeFileSync(path.join(folder,'note-first-line-metrics.json'),JSON.stringify(lineRows,null,2));checks.push('Plain text, H1, fenced code and single-item ordered/unordered lists at 1/4/10x fit one line tightly at width190 in opaque/transparent/hidden-title modes; padding stays halved and selection never shifts geometry');

    await reset();await page.evaluate(()=>{const n=current().nodes[0];Object.assign(n.ui,{width:190,height:1,noteFontScale:10,noteTransparent:true,noteTitleOnSelection:true,comment:'# X'});rememberSavedGraph(graph);past=[];future=[];render();});await settle();const beforeEditing=await layout();await preview().dblclick();await settle();sameGeometry(beforeEditing,await layout());await body().fill('X');assert.equal(await page.evaluate(()=>current().nodes[0].ui.comment),'# X');await body().press('Escape');await settle();sameGeometry(beforeEditing,await layout());assert.equal(await page.evaluate(()=>past.length),0);
    await preview().dblclick();await body().fill('X');await body().press('Control+Enter');await settle();const editedLine=await layout();assert.ok(Math.abs(beforeEditing.card.height-editedLine.card.height-(beforeEditing.line-editedLine.line))<1.1,'committing H1 to plain text recomputes the actual line minimum');assert.equal(await page.evaluate(()=>current().nodes[0].ui.comment),'X');assert.equal(await page.evaluate(()=>current().nodes[0].ui.height),1);assert.equal(await page.evaluate(()=>past.length),1);assert.equal(await page.evaluate(()=>hasShaderChanges()),false);await page.evaluate(()=>undo());await settle();sameGeometry(beforeEditing,await layout());await page.evaluate(()=>undo(true));await settle();sameGeometry(editedLine,await layout());await page.evaluate(()=>undo());await settle();sameGeometry(beforeEditing,await layout());
    await page.evaluate(()=>{graph=JSON.parse(JSON.stringify(graph));setUIAppearance('scale',125);render();scale=.5;transform();});await settle();const scaledSize=await size('note');assert.ok(Math.abs(scaledSize.height-beforeEditing.card.height)<.06);assert.equal(scaledSize.width,190);assert.equal(await page.evaluate(()=>current().nodes[0].ui.height),1);assert.equal(await page.evaluate(()=>past.length),0);checks.push('Editing/Escape plus committed H1-to-plain text Undo/Redo, JSON reload and combined 125% UI/50% graph zoom preserve the content minimum without rewriting stored dimensions');

    await reset();await page.evaluate(()=>{const n=current().nodes[0];Object.assign(n.ui,{width:320,height:500,noteFontScale:10,comment:'X'});rememberSavedGraph(graph);past=[];future=[];render();scale=.5;transform();});await settle();const largeBefore=await snapshot();assert.deepEqual(await size('note'),{width:320,height:500});const shrinkStart=await start();await page.mouse.move(shrinkStart.x,shrinkStart.y-400,{steps:5});await settle();const shrinkPreview=await size('note');assert.ok(shrinkPreview.height<300&&shrinkPreview.height>200);assert.equal(await snapshot(),largeBefore);await page.mouse.up();await settle();assert.equal(await page.evaluate(()=>past.length),1);const shrunk=await snapshot();assert.equal(await page.evaluate(()=>hasShaderChanges()),false);await page.evaluate(()=>undo());await settle();assert.deepEqual(await size('note'),{width:320,height:500});await page.evaluate(()=>undo(true));await settle();assert.equal(await snapshot(),shrunk);
    const cancelBefore=await snapshot(),cancelSize=await size('note'),cancelStart=await start();await page.mouse.move(cancelStart.x+50,cancelStart.y+100);await page.keyboard.press('Escape');await page.mouse.up();await settle();assert.deepEqual(await size('note'),cancelSize);assert.equal(await snapshot(),cancelBefore);checks.push('Manually large notes remain large; a 10x paragraph shrinks to its real line minimum in one Undo/Redo, while preview and Escape leave graph/history unchanged');

    await reset();await page.evaluate(()=>{const n=current().nodes[0];Object.assign(n.ui,{width:190,height:1,noteFontScale:4,comment:'X\n\nY\n\nZ'});past=[];future=[];rememberSavedGraph(graph);render();});await settle();const multiline=await layout();assert.ok(multiline.scroll>multiline.client);assert.ok(multiline.inner<=multiline.line+2);await preview().hover();await page.mouse.wheel(0,160);await page.waitForFunction(()=>document.querySelector('[data-node="note"] .comment-node-preview').scrollTop>0);
    for(const code of [false,true]){await page.evaluate(code=>{const n=current().nodes[0];n.ui.comment=code?'```\nXXXXXXXXXXXXXXXXXXXX\n```':'XXXXXXXXXXXXXXXXXXXX';render();},code);await settle();const long=await layout();const wrapped=await preview().evaluate(e=>{const block=e.querySelector('.comment-markdown').firstElementChild;return{width:block.scrollWidth,client:block.clientWidth,height:block.getBoundingClientRect().height,line:parseFloat(getComputedStyle(block).lineHeight),padding:parseFloat(getComputedStyle(block).paddingTop)+parseFloat(getComputedStyle(block).paddingBottom),readerWidth:e.scrollWidth,readerClient:e.clientWidth};});assert.ok(wrapped.width>wrapped.client||wrapped.readerWidth>wrapped.readerClient,'long single line can scroll horizontally');assert.ok(long.scroll<=long.client+1,'horizontal scrollbar does not create vertical clipping');assert.ok(long.inner>=long.line+long.blockPadding+long.blockScrollbar-1);}
    checks.push('Multiple explicit lines scroll vertically without inflating the minimum; long paragraph/code lines stay single-line and reserve any horizontal scrollbar height');

    await reset();await page.evaluate(()=>{const n=current().nodes[0];delete n.ui.height;n.ui.comment='X';render();});await settle();assert.equal((await size('note')).height,180);assert.equal(await page.evaluate(()=>Object.hasOwn(current().nodes[0].ui,'height')),false);checks.push('Notes without a stored height keep the existing 180px default instead of auto-shrinking');

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
