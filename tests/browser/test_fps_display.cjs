/* Experimental browser FPS: idle cost, elapsed-time sampling and lifecycle. */
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {harness}=require('./test_glsl_code.cjs');
const [source,stateFile,folder]=process.argv.slice(2);
(async()=>{
  const h=await harness(source,stateFile,folder,{skipPreview:true}),{page,checks,errors}=h;
  try{
    assert.equal(await page.evaluate(()=>EDITOR_DEV_SETTINGS.showFps),false);
    assert.equal(await page.evaluate(()=>fpsFrame),null);assert.equal(await page.locator('#uifps').isVisible(),false);
    assert.equal(await page.locator('#uifpstrail').evaluate(e=>e.width),0);
    await page.evaluate(()=>{window.fpsBefore=JSON.stringify({graph,past,future});window.fpsWireCalls=0;const old=wires;wires=(...args)=>{fpsWireCalls++;return old(...args);};});
    await page.locator('#uiexperiments').click();const toggle=page.locator('[data-experiment-group="appearance"] [data-experiment="showFps"]');
    await toggle.check();await page.locator('#experimentspanel').evaluate(e=>e.hidePopover());
    await page.waitForFunction(()=>/^FPS [\d.]+$/.test(document.querySelector('#uifps').textContent));
    assert.equal(await page.evaluate(()=>fpsWireCalls),0);assert.equal(await page.evaluate(()=>JSON.stringify({graph,past,future})===fpsBefore),true);
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem(experimentsStorageKey)).showFps),true);
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.locator('#uifps').isVisible(),true);
    const bounds=await page.locator('#uifps').boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=390);
    assert.equal(await page.locator('#uifpstrail').isVisible(),true);
    assert.equal(await page.locator('#uifpstrail').evaluate(e=>getComputedStyle(e).pointerEvents),'none');
    await page.screenshot({path:path.join(folder,'fps-mobile-width.png')});
    for(const width of [390,320]){
      await page.setViewportSize({width,height:844});
      const panel=await page.locator('#uifps').boundingBox(),tools=await page.locator('.canvas-view-tools').boundingBox();
      assert.ok(panel.x>=0&&panel.x+panel.width<=width);
      assert.ok(panel.y+panel.height<tools.y,'history must not overlap the mobile view controls');
    }
    await page.evaluate(()=>setUIExperiments({showFps:false}));assert.equal(await page.evaluate(()=>fpsFrame),null);assert.equal(await page.locator('#uifps').isVisible(),false);
    checks.push('default off with no canvas allocation, real frames, appearance toggle, persistence and mobile placement; no graph/history or wire redraw');
    const sample=await page.evaluate(()=>{
      const raf=window.requestAnimationFrame,caf=window.cancelAnimationFrame,pending=new Map();let id=0;
      window.requestAnimationFrame=cb=>{pending.set(++id,cb);return id;};window.cancelAnimationFrame=key=>pending.delete(key);
      const tick=now=>{const [key,cb]=pending.entries().next().value;pending.delete(key);cb(now);};
      const ctx=$('#uifpstrail').getContext('2d'),clear=ctx.clearRect,text=ctx.fillText;
      let paints=0,axis='',lastPoints=[],points=[];
      const begin=ctx.beginPath,move=ctx.moveTo,line=ctx.lineTo,stroke=ctx.stroke;
      ctx.clearRect=function(...a){paints++;return clear.apply(this,a);};
      ctx.fillText=function(value,...a){if(value.endsWith(' ms'))axis=value;return text.call(this,value,...a);};
      ctx.beginPath=function(){points=[];return begin.call(this);};
      ctx.moveTo=function(x,y){points.push([x,y]);return move.call(this,x,y);};
      ctx.lineTo=function(x,y){points.push([x,y]);return line.call(this,x,y);};
      ctx.stroke=function(){lastPoints=points;return stroke.call(this);};
      try{
        EDITOR_DEV_SETTINGS.showFps=true;applyFpsDisplay();for(let i=0;i<=60;i++)tick(i*1000/60);
        const normal=$('#uifps').textContent,normalPaints=paints;tick(2000);
        const stalled=$('#uifps').textContent,spikeAxis=axis,spikePoint=lastPoints.at(-1);
        for(let i=1;i<=60;i++)tick(2000+i*1000/60);
        const retained=axis,recovered=$('#uifps').textContent;
        for(let i=1;i<=1800;i++)tick(3000+i*1000/60);
        const expired=axis,bounded=lastPoints.length<=600;
        tick(90000);const longGapAxis=axis;tick(90017);tick(90117);const noOldTail=lastPoints.length<=4;
        applyFpsDisplay();const loops=pending.size;
        Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));const paused=pending.size;
        Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));tick(10000);const resumed=$('#uifps').textContent;
        EDITOR_DEV_SETTINGS.showFps=false;applyFpsDisplay();return {normal,stalled,recovered,normalPaints,spikeAxis,spikePoint,retained,expired,bounded,longGapAxis,noOldTail,loops,paused,resumed,stopped:pending.size,width:$('#uifpstrail').width};
      }finally{
        delete document.hidden;EDITOR_DEV_SETTINGS.showFps=false;applyFpsDisplay();window.requestAnimationFrame=raf;window.cancelAnimationFrame=caf;
        ctx.clearRect=clear;ctx.fillText=text;ctx.beginPath=begin;ctx.moveTo=move;ctx.lineTo=line;ctx.stroke=stroke;
      }
    });
    assert.equal(sample.normal,'FPS 60.0');assert.equal(sample.stalled,'FPS 1.0');assert.equal(sample.recovered,'FPS 60.0');
    assert.ok(sample.normalPaints<=11);assert.ok(sample.normalPaints>=8);
    assert.equal(sample.spikeAxis,'1000 ms');assert.deepEqual(sample.spikePoint,[198,13]);assert.equal(sample.retained,'1000 ms');
    assert.equal(sample.expired,'50 ms');assert.equal(sample.bounded,true);assert.equal(sample.longGapAxis,'57000 ms');assert.equal(sample.noOldTail,true);
    assert.equal(sample.loops,1);assert.equal(sample.paused,0);assert.equal(sample.resumed,'FPS —');assert.equal(sample.stopped,0);assert.equal(sample.width,0);
    checks.push('single-frame stall remains visible after FPS recovers, expires after 30 seconds; 10 Hz bounded drawing and no stale history after long gaps');
    checks.push('no duplicate loop or hidden-tab sampling; resume resets history and close releases the drawing buffer');
    const cost=await page.evaluate(()=>{
      const raf=window.requestAnimationFrame,caf=window.cancelAnimationFrame;let callback;
      window.requestAnimationFrame=cb=>{callback=cb;return 1;};window.cancelAnimationFrame=()=>{};
      const durations=[];
      try{
        EDITOR_DEV_SETTINGS.showFps=true;applyFpsDisplay();callback(0);
        for(let i=1;i<=7200;i++){const start=performance.now();callback(i*1000/120);durations.push(performance.now()-start);}
        durations.sort((a,b)=>a-b);
        return {samples:durations.length,meanMs:durations.reduce((a,b)=>a+b,0)/durations.length,p95Ms:durations[Math.floor(durations.length*.95)],maxMs:durations.at(-1)};
      }finally{EDITOR_DEV_SETTINGS.showFps=false;applyFpsDisplay();window.requestAnimationFrame=raf;window.cancelAnimationFrame=caf;}
    });
    fs.writeFileSync(path.join(folder,'recorder-cost.json'),JSON.stringify(cost,null,2));
    assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,count:checks.length}));
  }catch(error){await h.finish(error);throw error;}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
