/* Optional canvas damping: local preference, shared numeric editor, no disabled loop.
 * node test_canvas_damping.cjs SOURCE_DIR STATE_JSON REPORT_DIR */
const assert=require('node:assert/strict'),path=require('node:path');
const {harness}=require('./test_glsl_code.cjs');
(async()=>{
  const [source,stateFile,folder]=process.argv.slice(2),h=await harness(source,stateFile,folder,{skipPreview:true,touch:true});
  const {page,checks,errors,settle}=h,requests=[];page.setDefaultTimeout(6000);
  page.on('request',r=>{if(r.method()==='POST'&&r.url().includes('/api/'))requests.push(r.url());});
  const near=(a,b)=>assert.ok(Math.abs(a-b)<.02,`${a} != ${b}`);
  const view=()=>page.evaluate(()=>({pan:{...pan},scale,active:!!canvasMotion,frames:cameraTest.frames.size,listeners:!!canvasMotionEvents}));
  const tick=fraction=>page.evaluate(fraction=>{const motion=canvasMotion;for(const [id,callback]of [...cameraTest.frames]){cameraTest.frames.delete(id);cameraTest.now=motion.end-motion.duration+motion.duration*fraction;callback(cameraTest.now);}},fraction);
  const wheel=delta=>page.evaluate(delta=>{const r=$('#canvas').getBoundingClientRect();$('#canvas').dispatchEvent(new WheelEvent('wheel',{clientX:Math.round(r.left+r.width*.6),clientY:Math.round(r.top+r.height*.4),deltaY:delta,bubbles:true,cancelable:true}));},delta);
  const open=async()=>{if(!await page.locator('#experimentspanel').isVisible())await page.locator('#uiexperiments').click();};
  const close=()=>page.evaluate(()=>{if($('#experimentspanel').matches(':popover-open'))$('#experimentspanel').hidePopover();document.activeElement?.blur();});
  const control=key=>page.locator(`[data-experiment="${key}"]`);
  try{
    await page.evaluate(()=>{
      graph.declarations=[];graph.functions=[];graphTrail=[];stage='pixel';
      graph.stages.pixel={nodes:[testNode('a','scalar',30,180,{type:'float',value:1}),testNode('b','add',330,180,{type:'float'})],edges:[{from:['a','out'],to:['b','a']}]};
      selection.clear();selected=selectedEdge=null;past=[];future=[];readonly=false;historyBusy=false;nativeMutationBusy=false;dirty=false;render();scale=.6;pan={x:20,y:30};transform();
      window.cameraTest={raf:window.requestAnimationFrame,cancel:window.cancelAnimationFrame,frames:new Map(),next:0,count:0,now:performance.now(),clock:performance.now.bind(performance)};
      Object.defineProperty(performance,'now',{configurable:true,value:()=>Math.max(cameraTest.now,cameraTest.clock())});
      window.requestAnimationFrame=callback=>{if(callback!==stepCanvasMotion)return cameraTest.raf.call(window,callback);const id=--cameraTest.next;cameraTest.frames.set(id,callback);cameraTest.count++;return id;};
      window.cancelAnimationFrame=id=>{if(!cameraTest.frames.delete(id))cameraTest.cancel.call(window,id);};
      window.beforeCameraGraph=JSON.stringify({graph,past,future,dirty});window.cameraNodes=[...$('#cards').children];window.cameraWires=[...$('#wires').children];
    });
    await open();assert.equal(await control('canvasDamping').isChecked(),false);assert.equal(await control('canvasDampingMs').inputValue(),'250');assert.equal(await control('canvasDampingMs').isDisabled(),true);
    assert.deepEqual(await control('canvasDampingMs').evaluate(e=>[e.min,e.max,e.step,e.classList.contains('numeric-slider')]),['10','1000','1',true]);
    await close();await wheel(-100);let v=await view();near(v.scale,.6*Math.exp(.1));assert.equal(v.active,false);assert.equal(v.frames,0);assert.equal(v.listeners,false);
    assert.equal(await page.evaluate(()=>cameraTest.count),0);checks.push('default off / 250 ms; disabled zoom is immediate with zero damping callbacks, target or listeners');

    await open();await control('canvasDamping').check();await control('canvasDampingMs').fill('200');await control('canvasDampingMs').press('Enter');
    assert.equal(await page.evaluate(()=>EDITOR_DEV_SETTINGS.canvasDampingMs),200);await close();
    const start=await view();const anchor=await page.evaluate(()=>{const r=$('#canvas').getBoundingClientRect();return graphPoint(Math.round(r.left+r.width*.6),Math.round(r.top+r.height*.4));});
    await wheel(-100);await wheel(-100);v=await view();near(v.scale,start.scale);assert.equal(v.frames,1);
    const target=await page.evaluate(()=>({...canvasMotion.to}));near(target.scale,start.scale*Math.exp(.2));
    await tick(.5);v=await view();assert.ok(v.scale>start.scale&&v.scale<target.scale);assert.equal(v.frames,1);
    const during=await page.evaluate(()=>{const r=$('#canvas').getBoundingClientRect(),world=$('#world').getBoundingClientRect();return {anchor:graphPoint(Math.round(r.left+r.width*.6),Math.round(r.top+r.height*.4)),width:world.width,port:point(current().nodes[0],'out','outputs')};});
    near(during.anchor.x,anchor.x);near(during.anchor.y,anchor.y);near(during.width,v.scale);
    await tick(1);v=await view();near(v.scale,target.scale);near(v.pan.x,target.x);near(v.pan.y,target.y);assert.equal(v.frames,0);assert.equal(v.active,false);
    const endPort=await page.evaluate(()=>point(current().nodes[0],'out','outputs'));near(endPort.x,during.port.x);near(endPort.y,during.port.y);
    checks.push('rapid wheel inputs accumulate into one loop; intermediate zoom keeps cursor anchor and graph hit coordinates aligned; loop ends exactly');

    const canvas=await page.locator('#canvas').boundingBox(),p={x:canvas.x+canvas.width*.8,y:canvas.y+180};
    const panStart=await view();await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(p.x+60,p.y+45,{steps:3});await page.mouse.up();
    assert.equal((await view()).frames,1);await tick(.5);v=await view();assert.ok(v.pan.x>panStart.pan.x&&v.pan.x<panStart.pan.x+60);await tick(1);v=await view();near(v.pan.x,panStart.pan.x+60);near(v.pan.y,panStart.pan.y+45);
    assert.equal(await page.evaluate(()=>beforeCameraGraph===JSON.stringify({graph,past,future,dirty})&&cameraNodes.every((e,i)=>e===$('#cards').children[i])&&cameraWires.every((e,i)=>e===$('#wires').children[i])),true);assert.deepEqual(requests,[]);
    checks.push('real mouse pan eases to the same final displacement without node/wire rebuild, graph/history changes or API writes');

    // Opening settings does not cancel the pending target; unchecking drains it once.
    await open();await wheel(-100);await tick(.25);const pending=await page.evaluate(()=>({...canvasMotion.to}));await control('canvasDamping').uncheck();v=await view();near(v.scale,pending.scale);near(v.pan.x,pending.x);assert.equal(v.frames,0);assert.equal(v.active,false);assert.equal(v.listeners,false);
    assert.equal(await control('canvasDampingMs').inputValue(),'200');await close();
    const off=await view(),count=await page.evaluate(()=>cameraTest.count);await wheel(50);v=await view();near(v.scale,off.scale*Math.exp(-.05));assert.equal(await page.evaluate(()=>cameraTest.count),count);
    await settle();assert.equal((await view()).frames,0);checks.push('unchecking clears pending work/listeners, keeps duration, and subsequent navigation schedules no damping frames');

    await open();await control('canvasDamping').check();
    for(const [input,expected]of [['-1',10],['1001',1000],['100',100]]){await control('canvasDampingMs').fill(input);await control('canvasDampingMs').press('Enter');assert.equal(await control('canvasDampingMs').inputValue(),String(expected));}
    // Shared slider works for local settings even in a read-only graph.
    await page.evaluate(()=>{readonly=true;document.activeElement.blur();});
    const number=await control('canvasDampingMs').boundingBox();await page.mouse.move(number.x+number.width*.3,number.y+number.height/2);await page.mouse.down();await page.mouse.move(number.x+number.width*.55,number.y+number.height/2,{steps:4});await page.mouse.up();
    assert.ok(await page.evaluate(()=>EDITOR_DEV_SETTINGS.canvasDampingMs>100));await control('canvasDampingMs').fill('100');await control('canvasDampingMs').press('Enter');assert.equal(await page.evaluate(()=>EDITOR_DEV_SETTINGS.canvasDampingMs),100);await page.evaluate(()=>readonly=false);await close();
    checks.push('bounded shared numeric slider/text input clamps to 10–1000 ms and remains usable for browser settings on a read-only graph');

    // A new graph interaction freezes the currently displayed position, not a hidden target.
    await wheel(100);await tick(.25);const displayed=await view();await page.mouse.move(p.x,p.y);await page.mouse.down();v=await view();near(v.scale,displayed.scale);near(v.pan.x,displayed.pan.x);assert.equal(v.frames,0);await page.mouse.up();
    await wheel(100);await page.evaluate(()=>window.dispatchEvent(new Event('blur')));assert.equal((await view()).frames,0);assert.equal((await view()).active,false);
    await wheel(100);await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));delete document.hidden;});assert.equal((await view()).frames,0);
    checks.push('new graph pointer interaction freezes visible coordinates; blur and backgrounding stop outstanding animation');

    // Touch path, including the two-finger-to-one-finger handoff.
    const cdp=await page.context().newCDPSession(page),touch=async(type,points)=>{await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([id,x,y])=>({id,x,y,radiusX:5,radiusY:5}))});await settle();};
    await page.evaluate(()=>{stopCanvasMotion();scale=.6;pan={x:20,y:30};transform();});
    await touch('touchStart',[[1,p.x-100,p.y],[2,p.x,p.y]]);await touch('touchMove',[[1,p.x-130,p.y],[2,p.x+30,p.y]]);
    const pinchTarget=await page.evaluate(()=>({...canvasMotion.to}));near(pinchTarget.scale,.96);await tick(.5);await touch('touchEnd',[[1,p.x-130,p.y]]);await touch('touchEnd',[]);await tick(1);v=await view();near(v.scale,pinchTarget.scale);near(v.pan.x,pinchTarget.x);near(v.pan.y,pinchTarget.y);assert.equal(v.frames,0);
    checks.push('touch pinch shares damping and preserves its final target through finger release');

    await open();assert.equal(await control('frameDampingMs').isDisabled(),true);assert.equal(await control('frameDampingMs').inputValue(),'250');
    await control('frameDamping').check();await control('frameDampingMs').fill('450');await control('frameDampingMs').press('Enter');
    assert.equal(await control('canvasDampingMs').inputValue(),'100');await control('frameDamping').uncheck();assert.equal(await control('frameDampingMs').inputValue(),'450');
    checks.push('Home/Frame shares the numeric control layout but has an independent checkbox and saved duration');
    await page.selectOption('#language','en');await open();await control('canvasDampingMs').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(folder,'damping-desktop.png')});
    await page.setViewportSize({width:390,height:844});await page.evaluate(()=>setUIAppearance('scale',125));await open();await control('canvasDampingMs').scrollIntoViewIfNeeded();
    assert.equal(await page.locator('#experimentspanel').evaluate(e=>e.scrollWidth<=e.clientWidth+1),true);await page.screenshot({path:path.join(folder,'damping-mobile.png')});
    const stored=await page.evaluate(()=>JSON.parse(localStorage.getItem('sgrapeExperimentsV1')));assert.equal(stored.canvasDamping,true);assert.equal(stored.canvasDampingMs,100);
    await page.reload();await page.waitForSelector('.node');assert.equal(await page.evaluate(()=>EDITOR_DEV_SETTINGS.canvasDamping),true);assert.equal(await page.evaluate(()=>EDITOR_DEV_SETTINGS.canvasDampingMs),100);
    assert.deepEqual(await page.evaluate(()=>[EDITOR_DEV_SETTINGS.frameDamping,EDITOR_DEV_SETTINGS.frameDampingMs]),[false,450]);
    const realStart=await page.evaluate(()=>scale);await wheel(-10);await page.waitForFunction(()=>canvasMotion===null);near(await page.evaluate(()=>scale),Math.min(1.7,realStart*Math.exp(.01)));
    assert.equal(await page.evaluate(()=>canvasMotionFrame),0);checks.push('the real browser animation scheduler also reaches the final zoom and stops');
    await open();await page.locator('#experimentsreset').click();assert.equal(await control('canvasDamping').isChecked(),false);assert.equal(await control('canvasDampingMs').inputValue(),'250');assert.equal(await page.evaluate(()=>canvasMotionEvents),null);
    assert.equal(await control('frameDamping').isChecked(),false);assert.equal(await control('frameDampingMs').inputValue(),'250');
    checks.push('local preference survives reload, narrow layout fits, and Reset restores completely disabled / 250 ms');
    assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,count:checks.length}));
  }catch(error){await h.finish(error);throw error;}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
