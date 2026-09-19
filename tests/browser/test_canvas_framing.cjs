/* Home/Frame: command scope, editor isolation, independent optional transitions. */
const assert=require('node:assert/strict');
const {harness}=require('./test_glsl_code.cjs');
(async()=>{
  const [source,stateFile,folder]=process.argv.slice(2),h=await harness(source,stateFile,folder,{skipPreview:true}),{page,checks,errors}=h;
  const view=()=>page.evaluate(()=>({pan:{...pan},scale}));
  const reset=()=>page.evaluate(()=>{stopCanvasMotion();pan={x:20,y:30};scale=.4;transform();$('#canvas').focus();});
  const tick=async fraction=>page.evaluate(fraction=>{const m=canvasMotion;framingTest.now=m.end-m.duration+m.duration*fraction;for(const [id,cb]of [...framingTest.frames]){framingTest.frames.delete(id);cb(framingTest.now);}},fraction);
  try{
    await page.evaluate(()=>{
      graph.declarations=[];graph.functions=[];graphTrail=[];stage='pixel';
      graph.stages.pixel={nodes:[testNode('a','scalar',0,100,{type:'float',value:1}),testNode('b','scalar',500,200,{type:'float',value:2}),testNode('c','scalar',2500,500,{type:'float',value:3})],edges:[]};
      selection=new Set(['a']);selected='a';selectedEdge=null;past=[];future=[];readonly=true;historyBusy=false;nativeMutationBusy=false;dirty=false;render();
      window.framingBefore=JSON.stringify({graph,past,future,dirty});window.framingNodes=[...$('#cards').children];
      window.framingTest={raf:window.requestAnimationFrame,cancel:window.cancelAnimationFrame,frames:new Map(),id:0,now:performance.now(),clock:performance.now.bind(performance)};
      Object.defineProperty(performance,'now',{configurable:true,value:()=>Math.max(framingTest.now,framingTest.clock())});
      window.requestAnimationFrame=cb=>{if(cb!==stepCanvasMotion)return framingTest.raf.call(window,cb);const id=--framingTest.id;framingTest.frames.set(id,cb);return id;};
      window.cancelAnimationFrame=id=>{if(!framingTest.frames.delete(id))framingTest.cancel.call(window,id);};
    });
    assert.deepEqual(await page.evaluate(()=>[EDITOR_DEV_SETTINGS.canvasDamping,EDITOR_DEV_SETTINGS.canvasDampingMs,EDITOR_DEV_SETTINGS.frameDamping,EDITOR_DEV_SETTINGS.frameDampingMs]),[false,250,false,250]);
    await reset();await page.keyboard.press('h');const home=await view();
    await reset();await page.keyboard.press('f');const single=await view();assert.ok(single.scale>home.scale);
    await page.evaluate(()=>{selection=new Set(['a','b']);selected='b';refreshCanvasSelection();});await reset();await page.keyboard.press('f');const multi=await view();assert.notDeepEqual(multi,home);assert.notDeepEqual(multi,single);
    await page.keyboard.press('h');assert.deepEqual(await view(),home);
    await page.evaluate(()=>{selection.clear();selected=null;refreshCanvasSelection();});await reset();await page.keyboard.press('f');assert.deepEqual(await view(),home);
    checks.push('H always frames all; F frames one/multiple selections or falls back to Home; both work read-only with defaults off / 250 ms');

    // Use the existing keyboard route; navigation must not steal field input or browser chords.
    await reset();const unchanged=await view();
    for(const kind of ['text','number','textarea','contenteditable']){
      await page.evaluate(kind=>{const e=document.createElement(kind==='textarea'?'textarea':kind==='contenteditable'?'div':'input');e.id='framing-editable';if(kind==='contenteditable')e.contentEditable='true';else if(kind!=='textarea')e.type=kind;$('#canvas').append(e);e.focus();},kind);
      await page.keyboard.press('h');await page.keyboard.press('f');assert.deepEqual(await view(),unchanged,kind);
      await page.evaluate(()=>$('#framing-editable').remove());
    }
    await page.locator('#canvas').focus();
    for(const extra of [{isComposing:true},{shiftKey:true},{ctrlKey:true},{metaKey:true},{altKey:true}]){
      await page.evaluate(extra=>{for(const key of ['h','f'])$('#canvas').dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true,...extra}));},extra);assert.deepEqual(await view(),unchanged);
    }
    for(const flag of ['pointer','numeric','wire']){
      await page.evaluate(flag=>{if(flag==='pointer')$('#canvas').onpointermove=()=>{};if(flag==='numeric')pendingValueLadder={};if(flag==='wire')linkStart={};},flag);
      await page.keyboard.press('h');await page.keyboard.press('f');assert.deepEqual(await view(),unchanged,flag);
      await page.evaluate(()=>{$('#canvas').onpointermove=null;pendingValueLadder=null;linkStart=null;});
    }
    checks.push('text/number/code-like fields, contenteditable, IME, modified keys and active pointer/numeric/wire gestures never trigger H/F');

    await page.evaluate(()=>{selection=new Set(['a']);selected='a';refreshCanvasSelection();});
    for(const canvasDamping of [false,true])for(const frameDamping of [false,true]){
      await page.evaluate(values=>setUIExperiments({...values,canvasDampingMs:200,frameDampingMs:450}),{canvasDamping,frameDamping});
      await reset();await page.keyboard.press('f');
      assert.equal(await page.evaluate(()=>!!canvasMotion),frameDamping);
      if(frameDamping){
        assert.equal(await page.evaluate(()=>canvasMotion.duration),450);const end=await page.evaluate(()=>canvasMotion.end);
        await page.keyboard.press('f');assert.equal(await page.evaluate(()=>canvasMotion.end),end,'same target does not restart framing');
        await tick(.5);const midway=await view();assert.ok(midway.scale>.4&&midway.scale<single.scale);await tick(1);
      }
      assert.deepEqual(await view(),single);
      await reset();await page.evaluate(()=>zoomCanvasAt(.8,200,200));assert.equal(await page.evaluate(()=>!!canvasMotion),canvasDamping);
      if(canvasDamping){assert.equal(await page.evaluate(()=>canvasMotion.duration),200);await tick(1);}
      assert.equal((await view()).scale,.8);assert.equal(await page.evaluate(()=>framingTest.frames.size),0);
    }
    checks.push('all four checkbox combinations route pan/zoom and H/F independently, use 200/450 ms respectively, stop exactly, and do not restart for repeated F');

    // An immediate command must cancel the other group's pending transition.
    await page.evaluate(()=>setUIExperiments({canvasDamping:false,frameDamping:true}));await reset();await page.keyboard.press('h');await tick(.25);
    const current=await view();await page.evaluate(()=>zoomCanvasAt(.8,200,200));const zoomed=await view();
    assert.equal(zoomed.scale,.8);assert.ok(Math.abs(zoomed.pan.x-(200-(200-current.pan.x)*.8/current.scale))<.02);assert.equal(await page.evaluate(()=>canvasMotion),null);
    await reset();await page.keyboard.press('f');await page.evaluate(()=>fit());assert.deepEqual(await view(),home);assert.equal(await page.evaluate(()=>canvasMotion),null,'system framing is immediate');
    await page.evaluate(()=>setUIExperiments({canvasDamping:true,frameDamping:false}));await reset();await page.evaluate(()=>zoomCanvasAt(.8,200,200));await page.keyboard.press('h');assert.deepEqual(await view(),home);assert.equal(await page.evaluate(()=>canvasMotion),null);
    checks.push('immediate pan/zoom, Home and system navigation cancel another pending transition without jumping to its hidden target');

    await page.evaluate(()=>setUIExperiments({canvasDamping:false,frameDamping:false}));await reset();
    assert.deepEqual(await page.evaluate(()=>[canvasMotion,canvasMotionFrame,canvasMotionEvents,framingTest.frames.size]),[null,0,null,0]);
    await page.keyboard.press('h');await page.keyboard.press('f');assert.equal(await page.evaluate(()=>framingTest.frames.size),0);
    assert.equal(await page.evaluate(()=>framingBefore===JSON.stringify({graph,past,future,dirty})&&framingNodes.every((e,i)=>e===$('#cards').children[i])),true);
    checks.push('both disabled remove motion state/listeners/callbacks; navigation preserves graph, node DOM, dirty state and Undo history');

    await page.selectOption('#language','en');assert.equal(await page.locator('#fit').innerText(),'Home');
    assert.equal(await page.locator('#fit').getAttribute('aria-keyshortcuts'),'H');assert.equal(await page.locator('#graphfitselection').getAttribute('aria-keyshortcuts'),'F');
    await page.evaluate(()=>openGraphMenu(700,400));
    assert.match(await page.locator('#grapheditmenu').innerText(),/Home/);assert.match(await page.locator('#grapheditmenu').innerText(),/Frame/);
    await page.keyboard.press('Escape');
    checks.push('short Home/Frame labels and H/F hints appear in toolbar and context menu');
    assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,count:checks.length}));
  }catch(error){await h.finish(error);throw error;}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
