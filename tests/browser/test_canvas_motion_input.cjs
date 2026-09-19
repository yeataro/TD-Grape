/* Continuous pointer input must not restart the animation clock and starve paint.
 * Replay input delivered just after the frame timestamp, before its RAF callback. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {harness}=require('./test_glsl_code.cjs');
(async()=>{
  const [source,stateFile,folder]=process.argv.slice(2),h=await harness(source,stateFile,folder,{skipPreview:true}),{page,checks,errors}=h;
  try{
    const p=await page.evaluate(()=>{
      setUIExperiments({canvasDamping:true,canvasDampingMs:250});
      scale=.6;pan={x:20,y:30};transform();
      window.motionReplay={raf:window.requestAnimationFrame,cancel:window.cancelAnimationFrame,frames:new Map(),id:0,now:10000000};
      Object.defineProperty(performance,'now',{configurable:true,value:()=>motionReplay.now});
      window.requestAnimationFrame=cb=>{if(cb!==stepCanvasMotion)return motionReplay.raf.call(window,cb);const id=--motionReplay.id;motionReplay.frames.set(id,cb);return id;};
      window.cancelAnimationFrame=id=>{if(!motionReplay.frames.delete(id))motionReplay.cancel.call(window,id);};
      const r=$('#canvas').getBoundingClientRect();return{x:r.left+r.width*.8,y:r.top+150};
    });
    await page.mouse.move(p.x,p.y);await page.mouse.down();
    const samples=await page.evaluate(p=>{
      const samples=[],base=motionReplay.now;
      for(let i=0;i<20;i++){
        const timestamp=base+i*1000/60;motionReplay.now=timestamp+2;
        $('#canvas').onpointermove({clientX:p.x+10*(i+1),clientY:p.y+5*(i+1)});
        for(const [id,cb]of [...motionReplay.frames]){motionReplay.frames.delete(id);cb(timestamp);}
        samples.push({frame:i,x:pan.x,y:pan.y,renderedX:$('#world').getBoundingClientRect().x,targetX:canvasMotion?.to.x,callbacks:motionReplay.frames.size});
      }
      return samples;
    },p);
    await page.mouse.up();fs.writeFileSync(path.join(folder,'input-timeline.json'),JSON.stringify(samples,null,2));
    assert.ok(samples[1].x>20,'pan must advance by the second frame while input is still arriving');
    assert.ok(samples.slice(2).every((v,i)=>v.x>samples[i+1].x&&v.renderedX>samples[i+1].renderedX),'continuous pan must keep advancing on screen');
    assert.ok(samples.every(v=>v.callbacks===1),'only one motion callback is pending');
    checks.push('continuous pointer input advances the displayed canvas immediately even when input arrives after the RAF timestamp; one pending callback');
    await page.evaluate(()=>{motionReplay.now+=300;for(const [id,cb]of [...motionReplay.frames]){motionReplay.frames.delete(id);cb(motionReplay.now);}delete performance.now;window.requestAnimationFrame=motionReplay.raf;window.cancelAnimationFrame=motionReplay.cancel;});
    const final=await page.evaluate(()=>({pan,active:!!canvasMotion}));assert.equal(final.active,false);assert.ok(Math.abs(final.pan.x-220)<.02&&Math.abs(final.pan.y-130)<.02);
    checks.push('after input stops, motion reaches the exact final pointer displacement and stops');
    assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,count:checks.length}));
  }catch(error){await h.finish(error);throw error;}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
