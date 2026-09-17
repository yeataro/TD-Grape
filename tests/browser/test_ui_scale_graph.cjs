/* Root UI scaling and graph coordinates. Isolated fixture only; never contacts TD.
 * node test_ui_scale_graph.cjs SOURCE_DIR STATE_JSON REPORT_DIR
 */
const assert=require('node:assert/strict');
const {harness}=require('./test_glsl_code.cjs');
const [source,stateFile,folder]=process.argv.slice(2);
const near=(actual,expected,tolerance=.6)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} != ${expected}`);
(async()=>{
  const h=await harness(source,stateFile,folder,{touch:true}),{page,checks,errors,settle,at,drag}=h;
  page.setDefaultTimeout(6000);
  const cdp=await page.context().newCDPSession(page);
  const touch=async(type,points=[])=>{await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([id,x,y])=>({id,x,y,radiusX:4,radiusY:4}))});await settle();};
  const fixture=async percent=>{
    await page.evaluate(percent=>{
      touchGraphGesture?.cancel();nodeDragGesture?.cancel();nodeResizeGesture?.cancel();cancelConnection();closeCreator();closeGraphMenu();clearTimeout(autoTimer);
      setUIAppearance('size','standard');setUIAppearance('scale',percent);
      readonly=false;historyBusy=false;nativeMutationBusy=false;connectionInterrupted=true;dirty=false;graph.functions=[];graph.declarations=[];
      graph.stages.pixel={nodes:[testNode('source','float',24,48),testNode('add','add',400,48)],edges:[{from:['source','out'],to:['add','a']}]};
      stage='pixel';graphTrail=[];past=[];future=[];selected=selectedEdge=null;selection.clear();boxSelectMode=false;
      rememberSavedGraph(graph);render();scale=.8;pan={x:35,y:55};transform();
    },percent);
    await page.mouse.click(5,5);await settle();
  };
  const nodePosition=()=>page.evaluate(()=>{const {x,y}=current().nodes[0].ui;return{x,y};});
  const blank=async()=>{const r=await page.locator('#canvas').boundingBox();return{x:r.x+r.width-90,y:r.y+r.height-95};};
  const point=position=>page.evaluate(p=>graphPoint(p.x,p.y),position);
  const assertPoint=(a,b)=>{near(a.x,b.x,.1);near(a.y,b.y,.1);};
  const wiresAligned=()=>page.evaluate(()=>{
    for(const p of document.querySelectorAll('#wires path[data-from]'))for(const[ref,kind,len]of [[p.dataset.from,'outputs',0],[p.dataset.to,'inputs',p.getTotalLength()]]){
      const i=ref.lastIndexOf(':'),socket=document.querySelector(`[data-node="${ref.slice(0,i)}"] [data-kind="${kind}"][data-port="${ref.slice(i+1)}"]`),b=socket.getBoundingClientRect(),q=p.getPointAtLength(len),m=document.createElementNS(p.namespaceURI,'circle');
      m.setAttribute('cx',q.x);m.setAttribute('cy',q.y);m.setAttribute('r',1);p.parentNode.append(m);const r=m.getBoundingClientRect();m.remove();
      if(Math.hypot(r.left+r.width/2-b.left-b.width/2,r.top+r.height/2-b.top-b.height/2)>.75)return false;
      if(!document.elementFromPoint(b.left+b.width/2,b.top+b.height/2)?.closest('.port'))return false;
    }return true;
  });
  const bounds=async selector=>{
    const r=await page.locator(selector).boundingBox(),v=page.viewportSize();assert.ok(r,selector);
    assert.ok(r.x>=-1&&r.y>=-1&&r.x+r.width<=v.width+1&&r.y+r.height<=v.height+1,JSON.stringify({selector,r,v}));
    return r;
  };
  try{
    for(const percent of [75,100,125]){
      const u=percent/100;
      await fixture(percent);
      near(await page.evaluate(()=>uiScaleFactor()),u,.0001);
      assert.ok(await wiresAligned());
      const before=await page.evaluate(()=>({graph:JSON.stringify(graph),past:JSON.stringify(past),future:JSON.stringify(future),scale,pan:{...pan}}));
      await page.evaluate(percent=>setUIAppearance('scale',percent===75?125:75),percent);await settle();
      assert.deepEqual(await page.evaluate(()=>({graph:JSON.stringify(graph),past:JSON.stringify(past),future:JSON.stringify(future),scale,pan:{...pan}})),before);
      await page.evaluate(percent=>setUIAppearance('scale',percent),percent);await settle();assert.ok(await wiresAligned());
      let p=await at('[data-node="source"] .node-title');
      await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(p.x+48*.8*u,p.y+24*.8*u,{steps:4});await settle();
      assert.deepEqual(await nodePosition(),{x:24,y:48});assert.ok(await wiresAligned());
      await page.mouse.up();await settle();assert.deepEqual(await nodePosition(),{x:72,y:72});assert.equal(await page.evaluate(()=>past.length),1);assert.ok(await wiresAligned());
      await page.evaluate(()=>undo());assert.deepEqual(await nodePosition(),{x:24,y:48});
      const initial=await page.locator('[data-node="source"]').evaluate(e=>e.offsetWidth),history=await page.evaluate(()=>past.length);
      p=await at('[data-node-resize="source"]');await drag(p,{x:p.x+72*.8*u,y:p.y});
      assert.equal(await page.evaluate(()=>current().nodes[0].ui.width),initial+72);assert.equal(await page.evaluate(()=>past.length),history+1);assert.ok(await wiresAligned());
      await page.evaluate(()=>undo());
      checks.push(`${percent}%: UI changes preserve graph/view/history; mouse drag and resize follow pointer distance and each commit one Undo; socket hit tests and wire endpoints agree`);

      await fixture(percent);
      const r=await page.locator('[data-node="source"]').boundingBox(),start={x:r.x-12,y:r.y-12},end={x:r.x+r.width+12,y:r.y+r.height+12};
      await page.keyboard.down('Shift');await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(end.x,end.y,{steps:5});await settle();
      const box=await page.locator('#marquee').boundingBox();near(box.x,start.x,1);near(box.y,start.y,1);near(box.width,end.x-start.x,1);near(box.height,end.y-start.y,1);
      await page.mouse.up();await page.keyboard.up('Shift');assert.deepEqual(await page.evaluate(()=>[...selection]),['source']);
      p=await blank();const oldPan=await page.evaluate(()=>({...pan}));await drag(p,{x:p.x-60,y:p.y-30});
      const newPan=await page.evaluate(()=>({...pan}));near(newPan.x-oldPan.x,-60/u,.05);near(newPan.y-oldPan.y,-30/u,.05);
      p=await blank();const anchor=await point(p);await page.mouse.move(p.x,p.y);await page.mouse.wheel(0,-100);await settle();assertPoint(await point(p),anchor);
      checks.push(`${percent}%: marquee matches its physical drag rectangle, panning follows the pointer, and wheel zoom preserves the pointer's graph anchor`);

      await fixture(percent);p=await blank();let anchor2=await point(p);
      await page.evaluate(p=>openCreator(p.x,p.y),p);await settle();assertPoint(await page.evaluate(()=>({x:creatorState.x,y:creatorState.y})),anchor2);await bounds('#creator');
      await page.locator('#createsearch').fill('Float');await settle();await bounds('#creator');await page.evaluate(()=>closeCreator());
      const viewport=page.viewportSize();await page.evaluate(v=>openGraphMenu(v.width-8,v.height-8),viewport);await bounds('#grapheditmenu');await page.evaluate(()=>closeGraphMenu());
      await page.evaluate(()=>{selection=new Set(['source']);selected='source';copyGraphSelection();});
      p=await blank();await page.mouse.move(p.x,p.y);await settle();anchor2=await point(p);
      await page.evaluate(()=>pasteGraphSelection(editorClipboard));
      const pasted=await page.evaluate(()=>{const n=current().nodes.find(n=>n.id===selected);return{x:n.ui.x,y:n.ui.y};});
      const snapped=await page.evaluate(p=>({x:snap(p.x),y:snap(p.y)}),anchor2);assert.deepEqual(pasted,snapped);
      checks.push(`${percent}%: Add Node anchors in graph space, creator/context menus fit the viewport, and clipboard paste follows the canvas pointer`);

      if(percent===100)continue;
      await fixture(percent);p=await at('[data-node="source"] .node-title');
      await touch('touchStart',[[1,p.x,p.y]]);await touch('touchMove',[[1,p.x+48*.8*u,p.y+24*.8*u]]);assert.deepEqual(await nodePosition(),{x:24,y:48});
      await touch('touchEnd');assert.deepEqual(await nodePosition(),{x:72,y:72});assert.equal(await page.evaluate(()=>past.length),1);assert.ok(await wiresAligned());
      await fixture(percent);p=await blank();const anchor3=await point(p);
      await touch('touchStart',[[1,p.x-40,p.y],[2,p.x+40,p.y]]);
      await touch('touchMove',[[1,p.x-60+18,p.y-12],[2,p.x+60+18,p.y-12]]);
      near(await page.evaluate(()=>scale),1.2,.002);assertPoint(await point({x:p.x+18,y:p.y-12}),anchor3);
      await touch('touchEnd');assert.equal(await page.evaluate(()=>past.length),0);assert.equal(await page.evaluate(()=>visualViewport.scale),1);
      p=await blank();const touchPan=await page.evaluate(()=>({...pan}));await touch('touchStart',[[1,p.x,p.y]]);await touch('touchMove',[[1,p.x-45,p.y-25]]);await touch('touchEnd');
      const touchAfter=await page.evaluate(()=>({...pan}));near(touchAfter.x-touchPan.x,-45/u,.1);near(touchAfter.y-touchPan.y,-25/u,.1);
      checks.push(`${percent}%: trusted touch node drag commits once, pinch preserves its graph anchor without browser zoom, and touch panning tracks the finger`);
    }
    assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,count:checks.length}));
  }catch(error){await h.finish(error);throw error;}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
