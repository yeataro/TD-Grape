/* Trusted Chromium touch events against shared Node/Parameter numeric controls.
 * node test_numeric_touch.cjs SOURCE_DIR STATE_JSON REPORT_DIR
 * This uses an isolated fixture API; it never writes to the user's TD session.
 */
const assert=require('node:assert/strict');
const {harness}=require('./test_glsl_code.cjs');
const [source,stateFile,folder]=process.argv.slice(2);
(async()=>{
  const h=await harness(source,stateFile,folder,{touch:true}),{page,checks,errors,settle}=h;
  page.setDefaultTimeout(6000);
  const cdp=await page.context().newCDPSession(page);
  const inline=()=>page.locator('[data-inline-node="float"][data-component="0"]');
  const parameter=()=>page.locator('#inspector [data-parameter-port="$value"][data-parameter-copy="compact"]').first();
  const point=async entry=>{const r=await entry.boundingBox();assert.ok(r);return{x:r.x+r.width*.4,y:r.y+r.height/2};};
  const touch=async(type,points=[])=>{await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map((p,i)=>({id:i+1,x:p.x,y:p.y}))});await settle();};
  const tap=async p=>{await touch('touchStart',[p]);await touch('touchEnd');};
  const focused=entry=>entry.evaluate(e=>e===document.activeElement);
  const state=()=>page.evaluate(()=>JSON.stringify({graph,past,future}));
  const currentValue=()=>page.evaluate(()=>current().nodes.find(n=>n.id==='float').params.value);
  const reset=async()=>{
    await page.evaluate(()=>{
      cancelValueLadder();document.activeElement?.blur();clearTimeout(autoTimer);
      connectionInterrupted=true;conflicted=true;readonly=false;historyBusy=false;nativeMutationBusy=false;
      graphTrail=[];graph.functions=[];graph.declarations=[];stage='pixel';selectedInputId=null;
      graph.stages.pixel={nodes:[testNode('float','float',40,180,{value:.3}),testNode('other','float',330,180,{value:.6})],edges:[]};
      selected='float';selection=new Set(['float']);inspectorTab='parameters';past=[];future=[];dirty=false;
      rememberSavedGraph(graph);render();scale=.8;pan={x:25,y:30};transform();
      window.numericFocusEvents=0;
      if(!window.numericFocusAudit){
        document.addEventListener('focusin',e=>{if(e.target.matches('.numeric-slider'))numericFocusEvents++;},true);
        document.addEventListener('pointerdown',e=>{if(e.target.matches('.numeric-slider'))window.numericLastPointerId=e.pointerId;},true);
        window.numericFocusAudit=true;
      }
    });
    await settle();
  };
  try{
    for(const [name,field]of [['Node',inline],['Parameter',parameter]]){
      await reset();let entry=field(),p=await point(entry),before=await state();
      await tap(p);assert.equal(await focused(entry),false);assert.equal(await state(),before);
      await tap(p);assert.equal(await focused(entry),true);assert.equal(await page.evaluate(()=>numericFocusEvents),1);
      await entry.fill('0.12345678912345');await entry.press('Enter');await settle();
      assert.equal(await currentValue(),.12345678912345);assert.equal(await page.evaluate(()=>past.length),1);
      assert.equal(Number(await inline().inputValue()),.12345678912345);
      assert.equal(Number(await parameter().inputValue()),.12345678912345);
      checks.push(`${name}: single tap does not focus or write; second nearby tap enters native high-precision editing and commits one synchronized Undo`);

      await reset();entry=field();p=await point(entry);before=await state();
      const panBefore=await page.evaluate(()=>clone(pan)),rect=await entry.boundingBox(),distance=rect.width*.2;
      await touch('touchStart',[p]);await touch('touchMove',[{x:p.x+distance,y:p.y+1}]);
      const preview=Number(await entry.inputValue());assert.ok(preview>.3&&preview<.6,`${name} preview ${preview}`);
      assert.equal(await state(),before);assert.equal(await focused(entry),false);assert.equal(await page.evaluate(()=>numericFocusEvents),0);
      assert.deepEqual(await page.evaluate(()=>pan),panBefore);assert.equal(await page.locator('#valueladder').count(),0);
      await page.evaluate(()=>render());await settle();
      assert.equal(await page.evaluate(()=>!!valueLadder),true);assert.equal(Number(await field().inputValue()),preview);
      await touch('touchEnd');assert.equal(await currentValue(),preview);assert.equal(await page.evaluate(()=>past.length),1);
      assert.equal(await focused(field()),false);assert.equal(Number(await inline().inputValue()),preview);assert.equal(Number(await parameter().inputValue()),preview);
      await page.locator('#undo').click();assert.equal(await currentValue(),.3);await page.locator('#redo').click();assert.equal(await currentValue(),preview);
      checks.push(`${name}: horizontal touch drag previews without focus or graph pan, synchronizes both surfaces on release, and commits exactly one Undo/Redo`);

      await reset();entry=field();p=await point(entry);before=await state();
      await touch('touchStart',[p]);await page.locator('#valueladder').waitFor();
      assert.equal(await focused(entry),false);assert.equal(await page.evaluate(()=>numericFocusEvents),0);
      await touch('touchMove',[{x:p.x+16,y:p.y}]);assert.equal(Number(await entry.inputValue()),.5);
      assert.equal(await state(),before);assert.equal(await page.locator('#valueladder .ladder-step').innerText(),'Δ 0.1');
      await page.evaluate(()=>render());await settle();assert.equal(await page.locator('#valueladder').count(),1);assert.equal(Number(await field().inputValue()),.5);
      await touch('touchEnd');assert.equal(await currentValue(),.5);assert.equal(await page.evaluate(()=>past.length),1);
      assert.equal(await focused(field()),false);assert.equal(await page.evaluate(()=>numericFocusEvents),0);
      checks.push(`${name}: long-press Ladder never focuses the input, adjusts with the selected increment, and commits once`);

      for(const mode of ['pending','scrub','ladder']){
        await reset();entry=field();p=await point(entry);before=await state();
        await touch('touchStart',[p]);let active=p;
        if(mode==='scrub'){active={x:p.x+30,y:p.y};await touch('touchMove',[active]);assert.notEqual(Number(await entry.inputValue()),.3);}
        if(mode==='ladder'){await page.locator('#valueladder').waitFor();active={x:p.x+16,y:p.y};await touch('touchMove',[active]);}
        await touch('touchStart',[active,{x:active.x+50,y:active.y+35}]);await touch('touchEnd');
        assert.equal(await state(),before,`${name} second finger ${mode}`);assert.equal(Number(await field().inputValue()),.3);
        assert.equal(await page.evaluate(()=>!!valueLadder||!!pendingValueLadder),false);assert.equal(await page.locator('#valueladder').count(),0);
        await tap(await point(field()));assert.equal(await focused(field()),false,`${name} stale double tap after ${mode}`);
      }
      checks.push(`${name}: a second finger cancels pending, scrub and Ladder gestures, restores the exact value, and cannot leave a stale tap or history entry`);

      await reset();entry=field();p=await point(entry);before=await state();
      await touch('touchStart',[p]);await touch('touchMove',[{x:p.x+35,y:p.y}]);await touch('touchCancel');
      assert.equal(await state(),before);assert.equal(Number(await entry.inputValue()),.3);assert.equal(await focused(entry),false);
      await tap(p);assert.equal(await focused(entry),false);
      checks.push(`${name}: pointer cancellation restores a scrub without committing, focusing, or priming the next tap`);

      for(const mode of ['scrub','ladder']){
        await reset();entry=field();p=await point(entry);before=await state();await touch('touchStart',[p]);
        if(mode==='ladder')await page.locator('#valueladder').waitFor();
        await touch('touchMove',[{x:p.x+30,y:p.y}]);assert.notEqual(Number(await entry.inputValue()),.3);
        assert.equal(await page.evaluate(()=>valueLadder.entry.hasPointerCapture(numericLastPointerId)),true);
        await page.evaluate(()=>valueLadder.entry.releasePointerCapture(numericLastPointerId));
        await touch('touchMove',[{x:p.x+32,y:p.y}]);await touch('touchEnd');
        assert.equal(await state(),before);assert.equal(Number(await field().inputValue()),.3);
        assert.equal(await page.evaluate(()=>!!valueLadder||!!pendingValueLadder),false);assert.equal(await page.locator('#valueladder').count(),0);
      }
      checks.push(`${name}: real pointer capture loss still cancels and restores both scrubbing and Ladder after the input's implicit capture transfer`);

      await reset();entry=field();p=await point(entry);await tap(p);await tap(p);assert.equal(await focused(entry),true);
      before=await state();await touch('touchStart',[p]);await page.waitForTimeout(500);
      assert.equal(await page.locator('#valueladder').count(),0);assert.equal(await page.evaluate(()=>!!pendingValueLadder||!!valueLadder),false);
      await touch('touchMove',[{x:p.x+20,y:p.y}]);await touch('touchEnd');
      assert.equal(await state(),before);assert.equal(await focused(entry),true);
      checks.push(`${name}: an already focused input retains native touch text editing instead of starting scrubbing or a long-press Ladder`);
    }

    for(const mode of ['scrub','ladder']){
      await reset();await page.evaluate(()=>{current().nodes[0]=testNode('float','vector',40,180,{type:'vec2',components:[.3,.6]});render();});await settle();
      await page.locator('[data-parameter-expand="$value"]').click();
      const fields=page.locator('#inspector [data-parameter-port="$value"][data-parameter-copy="compact"]'),first=fields.nth(0),second=fields.nth(1);
      await first.fill('0.9');assert.equal(await page.evaluate(()=>current().nodes[0].params.components[0]),.3);
      const p=await point(second);await touch('touchStart',[p]);if(mode==='ladder')await page.locator('#valueladder').waitFor();
      await touch('touchMove',[{x:p.x+16,y:p.y}]);const preview=Number(await second.inputValue());assert.ok(preview>.6);
      await page.evaluate(()=>render());await settle();assert.equal(await first.inputValue(),'0.9');
      await touch('touchEnd');await page.evaluate(()=>render());await settle();
      assert.deepEqual(await page.evaluate(()=>current().nodes[0].params.components),[.3,preview]);
      assert.equal(await first.inputValue(),'0.9');assert.equal(await page.locator('#inspector [data-parameter-port="$value"][data-parameter-copy="component"]').first().inputValue(),'0.9');assert.equal(await page.evaluate(()=>past.length),1);
      await first.press('Enter');assert.deepEqual(await page.evaluate(()=>current().nodes[0].params.components),[.9,preview]);assert.equal(await page.evaluate(()=>past.length),2);
    }
    checks.push('touch scrubbing or opening Ladder on another Parameter component preserves its sibling unfinished text draft through redraws; explicit text commit remains a separate Undo');

    await reset();let p=await point(inline());await tap(p);await page.waitForTimeout(420);await tap(p);
    assert.equal(await focused(inline()),false);
    await reset();p=await point(inline());await tap(p);await tap({x:p.x+35,y:p.y});assert.equal(await focused(inline()),false);
    await reset();await tap(await point(inline()));await tap(await point(parameter()));assert.equal(await focused(parameter()),false);
    checks.push('double-tap requires the same field, nearby coordinates and a short interval; separate taps cannot unexpectedly enter typing');

    await reset();p=await point(inline());let before=await state(),panBefore=await page.evaluate(()=>clone(pan));
    await touch('touchStart',[p]);await touch('touchMove',[{x:p.x+2,y:p.y+25}]);
    await touch('touchMove',[{x:p.x+55,y:p.y+30}]);await touch('touchEnd');
    assert.notDeepEqual(await page.evaluate(()=>pan),panBefore);assert.equal(await state(),before);assert.equal(await focused(inline()),false);
    checks.push('a vertical Node gesture locks canvas panning and cannot turn into a numeric drag when the finger later moves sideways');

    await reset();await page.evaluate(()=>{const spacer=document.createElement('div');spacer.style.height='1400px';$('#inspector').append(spacer);});
    p=await point(parameter());before=await state();const scrollBefore=await page.locator('#parameterbody').evaluate(e=>e.scrollTop);
    await touch('touchStart',[p]);await touch('touchMove',[{x:p.x+2,y:p.y-30}]);
    await touch('touchMove',[{x:p.x+50,y:p.y-60}]);await touch('touchEnd');
    assert.ok(await page.locator('#parameterbody').evaluate(e=>e.scrollTop)>scrollBefore);assert.equal(await state(),before);
    assert.equal(await page.locator('#valueladder').count(),0);assert.equal(await page.evaluate(()=>numericFocusEvents),0);
    checks.push('a vertical Parameter gesture locks scrolling, keeps numeric values unchanged and never focuses the input');

    await reset();await page.evaluate(()=>{readonly=true;render();});p=await point(inline());before=await state();
    await tap(p);await tap(p);await touch('touchStart',[p]);await touch('touchMove',[{x:p.x+40,y:p.y}]);await touch('touchEnd');
    assert.equal(await state(),before);assert.equal(await page.locator('#valueladder').count(),0);
    checks.push('read-only numeric fields cannot be changed by touch taps or scrubs');

    await reset();await inline().click();assert.equal(await focused(inline()),true);
    await page.locator('#canvas').focus();p=await point(inline());await page.mouse.move(p.x,p.y);await page.mouse.down();
    await page.mouse.move(p.x+30,p.y);assert.equal(await page.locator('#valueladder').count(),0);await page.mouse.up();await settle();
    assert.ok(await currentValue()>.3);assert.equal(await page.evaluate(()=>past.length),1);
    p=await point(inline());await page.mouse.move(p.x,p.y);await page.mouse.down({button:'middle'});await page.locator('#valueladder').waitFor();
    await page.mouse.up({button:'middle'});assert.equal(await page.locator('#valueladder').count(),0);
    checks.push('a touch-capable device still keeps mouse single-click editing, immediate horizontal scrubbing and middle-button Ladder behavior');

    assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,count:checks.length}));
  }catch(error){await h.finish(error);throw error;}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
