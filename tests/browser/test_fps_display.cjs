/* Experimental browser FPS: idle cost, elapsed-time sampling and lifecycle. */
const assert=require('node:assert/strict'),path=require('node:path');
const {harness}=require('./test_glsl_code.cjs');
const [source,stateFile,folder]=process.argv.slice(2);
(async()=>{
  const h=await harness(source,stateFile,folder,{skipPreview:true}),{page,checks,errors}=h;
  try{
    assert.equal(await page.evaluate(()=>EDITOR_DEV_SETTINGS.showFps),false);
    assert.equal(await page.evaluate(()=>fpsFrame),null);assert.equal(await page.locator('#uifps').isVisible(),false);
    await page.evaluate(()=>{window.fpsBefore=JSON.stringify({graph,past,future});window.fpsWireCalls=0;const old=wires;wires=(...args)=>{fpsWireCalls++;return old(...args);};});
    await page.locator('#uiexperiments').click();const toggle=page.locator('[data-experiment-group="appearance"] [data-experiment="showFps"]');
    await toggle.check();await page.locator('#experimentspanel').evaluate(e=>e.hidePopover());
    await page.waitForFunction(()=>/^FPS [\d.]+$/.test(document.querySelector('#uifps').textContent));
    assert.equal(await page.evaluate(()=>fpsWireCalls),0);assert.equal(await page.evaluate(()=>JSON.stringify({graph,past,future})===fpsBefore),true);
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem(experimentsStorageKey)).showFps),true);
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.locator('#uifps').isVisible(),true);
    const bounds=await page.locator('#uifps').boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=390);
    await page.screenshot({path:path.join(folder,'fps-mobile-width.png')});
    await page.evaluate(()=>setUIExperiments({showFps:false}));assert.equal(await page.evaluate(()=>fpsFrame),null);assert.equal(await page.locator('#uifps').isVisible(),false);
    checks.push('default off, real frames, appearance toggle, local persistence and mobile placement; no graph/history or wire redraw');
    const sample=await page.evaluate(()=>{
      const raf=window.requestAnimationFrame,caf=window.cancelAnimationFrame,pending=new Map();let id=0;
      window.requestAnimationFrame=cb=>{pending.set(++id,cb);return id;};window.cancelAnimationFrame=key=>pending.delete(key);
      const tick=now=>{const [key,cb]=pending.entries().next().value;pending.delete(key);cb(now);};
      try{
        EDITOR_DEV_SETTINGS.showFps=true;applyFpsDisplay();for(let i=0;i<=60;i++)tick(i*1000/60);
        const normal=$('#uifps').textContent;tick(2000);const stalled=$('#uifps').textContent;
        applyFpsDisplay();const loops=pending.size;
        Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));const paused=pending.size;
        Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));tick(10000);const resumed=$('#uifps').textContent;
        EDITOR_DEV_SETTINGS.showFps=false;applyFpsDisplay();return {normal,stalled,loops,paused,resumed,stopped:pending.size};
      }finally{delete document.hidden;EDITOR_DEV_SETTINGS.showFps=false;applyFpsDisplay();window.requestAnimationFrame=raf;window.cancelAnimationFrame=caf;}
    });
    assert.deepEqual(sample,{normal:'FPS 60.0',stalled:'FPS 1.0',loops:1,paused:0,resumed:'FPS —',stopped:0});
    checks.push('elapsed time includes main-thread stalls; no duplicate loop, hidden-tab sampling, or background gap on resume');
    assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,count:checks.length}));
  }catch(error){await h.finish(error);throw error;}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
