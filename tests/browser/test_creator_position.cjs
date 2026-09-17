/* Add Node placement and titlebar gestures with an isolated Shader fixture.
 * node test_creator_position.cjs SOURCE_DIR STATE_JSON REPORT_DIR
 */
const assert=require('node:assert/strict'),path=require('node:path');
const {harness}=require('./test_glsl_code.cjs');
const [source,stateFile,folder]=process.argv.slice(2);
const near=(a,b,tolerance=1)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} != ${b}`);
(async()=>{
  const h=await harness(source,stateFile,folder,{touch:true}),{page,checks,errors,settle}=h;
  page.setDefaultTimeout(6000);
  const cdp=await page.context().newCDPSession(page);
  const touch=async(type,p)=>{await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:p?[{id:1,x:p.x,y:p.y}]:[]});await settle();};
  const rect=selector=>page.locator(selector).boundingBox();
  const center=async selector=>{const r=await rect(selector);assert.ok(r,selector);return{x:r.x+r.width/2,y:r.y+r.height/2};};
  const snapshot=()=>page.evaluate(()=>JSON.stringify({graph,past,future,pan,scale,dirty,selected,selection:[...selection]}));
  const graphValue=()=>page.evaluate(()=>JSON.stringify(graph));
  const anchor=p=>page.evaluate(p=>{const a=graphPoint(p.x,p.y);return{x:snap(a.x),y:snap(a.y)};},p);
  const bounds=async()=>{const r=await rect('#creator'),v=page.viewportSize();assert.ok(r);assert.ok(r.x>=-1&&r.y>=-1&&r.x+r.width<=v.width+1&&r.y+r.height<=v.height+1,JSON.stringify({r,v}));return r;};
  const blank=async()=>{const r=await rect('#canvas');return{x:r.x+r.width*.52,y:r.y+80};};
  const headingPoint=async()=>{const r=await rect('#creator .create-heading');return{x:r.x+Math.min(100,r.width*.25),y:r.y+r.height/2};};
  const headerDrag=async(dx,dy,touchMode=false)=>{
    const p=await headingPoint();
    if(touchMode){await touch('touchStart',p);await touch('touchMove',{x:p.x+dx,y:p.y+dy});await touch('touchEnd');}
    else{await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(p.x+dx,p.y+dy,{steps:5});await page.mouse.up();await settle();}
  };
  const positionAt=async p=>{
    const box=await bounds(),head=await rect('#creator .create-heading');
    near(box.x+box.width/2,p.x);near(head.y+head.height/2,p.y);
    assert.equal(await page.locator('#createsearch').evaluate(e=>e===document.activeElement),true);
    return box;
  };
  const reset=async percent=>{
    await page.setViewportSize({width:1600,height:1100});
    await page.evaluate(percent=>{
      touchGraphGesture?.cancel();nodeDragGesture?.cancel();cancelConnection();closeCreator();closeGraphMenu();clearTimeout(autoTimer);
      setGraphFocus(false);setUIAppearance('size','standard');setUIAppearance('scale',percent);
      readonly=false;historyBusy=false;nativeMutationBusy=false;connectionInterrupted=true;dirty=false;graph.functions=[];graph.declarations=[];
      graph.stages.pixel={nodes:[testNode('source','float',24,48,{value:.3}),testNode('sink','pixel_out',760,48)],edges:[]};
      stage='pixel';graphTrail=[];past=[];future=[];selected=selectedEdge=null;selection.clear();boxSelectMode=false;
      rememberSavedGraph(graph);render();scale=.8;pan={x:35,y:55};transform();
    },percent);await page.mouse.click(4,4);await settle();
  };
  try{
    await page.selectOption('#language','en');
    for(const percent of [75,125]){
      await reset(percent);let p=await blank(),expected=await anchor(p),before=await snapshot(),originalGraph=await graphValue();
      await page.mouse.dblclick(p.x,p.y);await page.locator('#creator').waitFor();let box=await positionAt(p);assert.equal(await snapshot(),before);
      await headerDrag(65,-30);let moved=await bounds();near(moved.x,box.x+65);near(moved.y,box.y-30);assert.equal(await snapshot(),before);
      await page.locator('#createsearch').fill('Float');await settle();let searched=await bounds();near(searched.x,moved.x);near(searched.y,moved.y);
      await page.locator('[data-create-entry="float"]').click();await settle();
      let created=await page.evaluate(()=>({node:current().nodes.find(n=>n.id===selected),past:past.length}));assert.equal(created.past,1);near(created.node.ui.x,expected.x,.01);near(created.node.ui.y,expected.y,.01);
      await page.evaluate(()=>undo());assert.equal(await graphValue(),originalGraph);
      checks.push(`${percent}% double-click aligns cursor with upper center; titlebar movement and search retain its pose, original creation anchor and single-step Undo`);

      await reset(percent);p=await blank();before=await snapshot();await page.mouse.dblclick(p.x,p.y);await page.locator('#creator').waitFor();
      await page.locator('#createsearch').fill('Float');box=await bounds();const search=await center('#createsearch');
      await page.mouse.move(search.x,search.y);await page.mouse.down();await page.mouse.move(search.x-25,search.y,{steps:4});await page.mouse.up();await settle();
      moved=await bounds();near(moved.x,box.x);near(moved.y,box.y);assert.equal(await snapshot(),before);
      const close=await center('#closecreator');await page.mouse.move(close.x,close.y);await page.mouse.down();await page.mouse.move(close.x+3,close.y+2);
      moved=await bounds();near(moved.x,box.x);near(moved.y,box.y);await page.mouse.up();await settle();assert.equal(await page.locator('#creator').isVisible(),false);assert.equal(await snapshot(),before);
      checks.push(`${percent}% text selection and close-button presses retain normal control behavior without dragging the panel or editing graph/history`);

      await reset(percent);p=await blank();expected=await anchor(p);before=await snapshot();const port=await center('[data-node="source"] [data-kind="outputs"][data-port="out"]');
      await page.mouse.move(port.x,port.y);await page.mouse.down();await page.mouse.move(p.x,p.y,{steps:8});await page.mouse.up();await page.locator('#creator').waitFor();box=await positionAt(p);
      assert.equal(await snapshot(),before);await headerDrag(-55,28);moved=await bounds();near(moved.x,box.x-55);near(moved.y,box.y+28);assert.equal(await snapshot(),before);
      await page.locator('#createsearch').fill('Add');await page.locator('[data-create-entry="add"]').click();await settle();
      created=await page.evaluate(()=>({node:current().nodes.find(n=>n.id===selected),edges:current().edges,past:past.length}));assert.equal(created.past,1);near(created.node.ui.x,expected.x,.01);near(created.node.ui.y,expected.y,.01);assert.ok(created.edges.some(e=>e.from[0]==='source'&&e.from[1]==='out'&&e.to[0]===created.node.id));
      checks.push(`${percent}% wire-to-empty opens at upper-center and titlebar movement preserves compatible creation, source connection and original graph anchor`);

      await reset(percent);p=await blank();before=await snapshot();expected=await anchor(p);
      await touch('touchStart',p);await touch('touchEnd');await touch('touchStart',p);await touch('touchEnd');await page.locator('#creator').waitFor();box=await positionAt(p);
      await headerDrag(42,-24,true);moved=await bounds();near(moved.x,box.x+42);near(moved.y,box.y-24);assert.equal(await snapshot(),before);
      await page.locator('#createsearch').pressSequentially('Float',{delay:100});const choice=await center('[data-create-entry="float"]');await touch('touchStart',choice);await touch('touchEnd');await page.waitForFunction(()=>past.length===1);await settle();created=await page.evaluate(()=>({node:current().nodes.find(n=>n.id===selected),past:past.length}));assert.equal(created.past,1);near(created.node.ui.x,expected.x,.01);near(created.node.ui.y,expected.y,.01);
      checks.push(`${percent}% trusted touch double-tap/titlebar drag creates at the original invocation point without panning the canvas`);

      await reset(percent);p=await blank();before=await snapshot();await page.mouse.dblclick(p.x,p.y);await page.locator('#creator').waitFor();box=await bounds();
      const hp=await headingPoint();await touch('touchStart',hp);await touch('touchMove',{x:hp.x+60,y:hp.y+20});await touch('touchCancel');moved=await bounds();near(moved.x,box.x);near(moved.y,box.y);assert.equal(await snapshot(),before);
      const mp=await headingPoint();await page.mouse.move(mp.x,mp.y);await page.mouse.down();await page.mouse.move(mp.x+60,mp.y+20);await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.mouse.up();moved=await bounds();near(moved.x,box.x);near(moved.y,box.y);assert.equal(await snapshot(),before);
      await headerDrag(-3000,-3000);await bounds();await headerDrag(3000,3000);await bounds();assert.equal(await snapshot(),before);await page.keyboard.press('Escape');assert.equal(await page.locator('#creator').isVisible(),false);
      checks.push(`${percent}% touch cancellation/window blur restore panel position; extreme drags clamp to viewport and Escape closes without graph/history changes`);

      await reset(percent);
      for(const edge of [{x:2,y:2},{x:1598,y:2},{x:2,y:1098},{x:1598,y:1098}]){
        await page.evaluate(p=>openCreator(p.x,p.y),edge);await settle();await bounds();await page.locator('#createsearch').fill('Float');await settle();await bounds();await page.keyboard.press('Escape');
      }
      checks.push(`${percent}% opening near all viewport corners and changing result dimensions stays visible`);
    }
    await reset(125);await page.setViewportSize({width:390,height:740});await settle();
    await page.evaluate(()=>{const r=$('#canvas').getBoundingClientRect();openCreator(r.left+r.width/2,r.top+40);});await settle();await bounds();await headerDrag(-200,300,true);await bounds();
    await page.locator('#createsearch').fill('Float');await settle();await bounds();await page.screenshot({path:path.join(folder,'creator-mobile.png')});await page.keyboard.press('Escape');
    checks.push('390px touch viewport at125%UI scale keeps moved Add Node/search inside the viewport');
    await reset(100);const finalPoint=await blank();await page.mouse.dblclick(finalPoint.x,finalPoint.y);await page.locator('#creator').waitFor();await headerDrag(65,20);await page.screenshot({path:path.join(folder,'creator-desktop.png')});
    assert.deepEqual(errors,[]);await cdp.detach();await h.finish();console.log(JSON.stringify({passed:true,count:checks.length}));
  }catch(error){await cdp.detach();await h.finish(error);throw error;}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
