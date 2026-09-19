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
    await page.waitForFunction(()=>/^[\d.]+$/.test(document.querySelector('#uifpsvalue').textContent));
    assert.equal(await page.evaluate(()=>fpsWireCalls),0);assert.equal(await page.evaluate(()=>JSON.stringify({graph,past,future})===fpsBefore),true);
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem(experimentsStorageKey)).showFps),true);
    assert.match(await page.locator('[data-i18n-title="fps.low.hint"]').getAttribute('title'),/100/);
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
    const statistics=await page.evaluate(()=>{
      const stats=createFpsStats();let time=0;
      for(let i=0;i<99;i++)stats.push(time+=10,10);
      const warmup=stats.read(time);stats.push(time+=10,10);const ready=stats.read(time);
      for(let i=100;i<198;i++)stats.push(time+=10,10);
      stats.push(time+=50,50);stats.push(time+=100,100);
      const slow=stats.read(time),repeat=stats.read(time),expired=stats.read(time+10000);
      stats.push(time+10010,10);const renewed=stats.read(time+10010);
      const wrap=createFpsStats();
      for(let i=1;i<=20000;i++)wrap.push(i*10,10);
      const wrapped=wrap.read(200000);
      const overflow=createFpsStats();
      for(let i=1;i<=16385;i++)overflow.push(i*.1,.1);
      const incomplete=overflow.read(1638.5),noData=createFpsStats().read(0);
      return {warmup,ready,slow,repeat,expired,renewed,wrapped,incomplete,noData};
    });
    assert.deepEqual(statistics.warmup,{low:null,min:100});assert.deepEqual(statistics.ready,{low:100,min:100});
    assert.ok(Math.abs(statistics.slow.low-1000*2/150)<1e-9);assert.equal(statistics.slow.min,10);
    assert.deepEqual(statistics.repeat,statistics.slow);assert.deepEqual(statistics.expired,{low:null,min:null});
    assert.deepEqual(statistics.renewed,{low:null,min:100});assert.deepEqual(statistics.wrapped,{low:100,min:100});
    assert.deepEqual(statistics.incomplete,{low:null,min:null});assert.deepEqual(statistics.noData,{low:null,min:null});
    checks.push('Low uses mean slowest 1% raw intervals, not the percentile or plotted peaks; warmup, exact 10-second expiry, ring wrap and overload are honest');
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
        const normal=$('#uifpsvalue').textContent,normalPaints=paints;tick(2000);
        const stalled=$('#uifpsvalue').textContent,spikeAxis=axis,spikePoint=lastPoints.at(-1);
        for(let i=1;i<=60;i++)tick(2000+i*1000/60);
        const retained=axis,recovered=$('#uifpsvalue').textContent,slowLow=$('#uifpslow').textContent,slowMin=$('#uifpsmin').textContent;
        for(let i=1;i<=600;i++)tick(3000+i*1000/60);
        const expired=axis,bounded=lastPoints.length<=200,expiredLow=$('#uifpslow').textContent,expiredMin=$('#uifpsmin').textContent;
        tick(90000);const longGapAxis=axis;tick(90017);tick(90117);const noOldTail=lastPoints.length<=4;
        applyFpsDisplay();const loops=pending.size;
        Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));const paused=pending.size;
        Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));tick(10000);const resumed=$('#uifpsvalue').textContent;
        EDITOR_DEV_SETTINGS.showFps=false;applyFpsDisplay();return {normal,stalled,recovered,slowLow,slowMin,expiredLow,expiredMin,normalPaints,spikeAxis,spikePoint,retained,expired,bounded,longGapAxis,noOldTail,loops,paused,resumed,stopped:pending.size,width:$('#uifpstrail').width};
      }finally{
        delete document.hidden;EDITOR_DEV_SETTINGS.showFps=false;applyFpsDisplay();window.requestAnimationFrame=raf;window.cancelAnimationFrame=caf;
        ctx.clearRect=clear;ctx.fillText=text;ctx.beginPath=begin;ctx.moveTo=move;ctx.lineTo=line;ctx.stroke=stroke;
      }
    });
    assert.equal(sample.normal,'60.0');assert.equal(sample.stalled,'1.0');assert.equal(sample.recovered,'60.0');
    assert.equal(sample.slowLow,'2.0');assert.equal(sample.slowMin,'1.0');assert.equal(sample.expiredLow,'60.0');assert.equal(sample.expiredMin,'60.0');
    assert.ok(sample.normalPaints<=11);assert.ok(sample.normalPaints>=8);
    assert.equal(sample.spikeAxis,'1000 ms');assert.deepEqual(sample.spikePoint,[198,13]);assert.equal(sample.retained,'1000 ms');
    assert.equal(sample.expired,'50 ms');assert.equal(sample.bounded,true);assert.equal(sample.longGapAxis,'77000 ms');assert.equal(sample.noOldTail,true);
    assert.equal(sample.loops,1);assert.equal(sample.paused,0);assert.equal(sample.resumed,'—');assert.equal(sample.stopped,0);assert.equal(sample.width,0);
    checks.push('single-frame stall remains visible after FPS recovers, expires after 10 seconds; 10 Hz bounded drawing and no stale history after long gaps');
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
