/* Real product HTTP entry, custom DOM picker, native TD grouped WebSocket values.
 * node TEST SOURCE_ROOT BRIDGE_ROOT PRIVATE_WORK REPORT_DIR
 * Creates/removes only tests/td/color_picker_fixture.py's disposable manager/shader.
 * Run serially with other TD bridge jobs. Never targets registered user shaders.
 */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const [source,bridge,work,report]=process.argv.slice(2),python=process.env.PYTHON_EXECUTABLE||'python';
const fixtureJob=path.join(work,'jobs','custom_color_editor_browser_fixture.py'),fixtureOutput=path.join(report,'fixture');
fs.mkdirSync(report,{recursive:true});fs.mkdirSync(path.dirname(fixtureJob),{recursive:true});
const checks=[],errors=[],responses=[],requests=[];
const closeTo=(a,b,label)=>assert.ok(Math.abs(a-b)<1e-5,`${label}: ${a} != ${b}`);
const sameValues=(a,b,label)=>{assert.equal(a.length,b.length,label);a.forEach((value,i)=>closeTo(value,b[i],`${label}[${i}]`));};
function job(action){
  fs.writeFileSync(fixtureJob,`from pathlib import Path\nimport json\nGRAPE_ROOT=Path(${JSON.stringify(source)})\nGRAPE_TEST_OUTPUT=${JSON.stringify(fixtureOutput)}\nmapping=json.loads((GRAPE_ROOT/'src/td/source_files.json').read_text())\nsource_path=lambda name: GRAPE_ROOT/mapping[name]\nGRAPE_TEST_ACTION=${JSON.stringify(action)}\nexec(compile((GRAPE_ROOT/'tests/td/color_picker_fixture.py').read_text(encoding='utf-8'),'color_picker_fixture.py','exec'))\n`);
  let output;
  for(let attempt=0;attempt<5;attempt++){
    try{output=execFileSync(python,[path.join(bridge,'tools/dev/submit_job.py'),fixtureJob,'--report','custom-color-picker/editor-e2e','--timeout','25'],{cwd:bridge,encoding:'utf8',stdio:'pipe'});break;}
    catch(error){
      // Only retry a queue replacement failure before dispatch, never a TD timeout.
      if(attempt===4||!String(error.stderr).includes('temporary.replace')||!String(error.stderr).includes('PermissionError: [WinError 5]'))throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,125*(2**attempt));
    }
  }
  const reply=JSON.parse(output);assert.equal(reply.ok,true,JSON.stringify(reply));return reply.result;
}
(async()=>{
  let browser,page,started=false,failure=null,cleanup=null;
  try{
    assert.equal(job('start').ready,true);started=true;
    const connection=JSON.parse(fs.readFileSync(path.join(fixtureOutput,'connection.json'),'utf8'));
    browser=await chromium.launch({executablePath:process.env.CHROME_EXECUTABLE,headless:true});
    page=await browser.newPage({viewport:{width:1500,height:1000}});page.setDefaultTimeout(15000);
    page.on('pageerror',error=>errors.push(error.message));
    page.on('response',async response=>{if(response.url().includes('/api/')&&response.status()>=400)responses.push({path:new URL(response.url()).pathname,status:response.status(),body:await response.text().catch(()=>'<closed>')});});
    page.on('request',request=>{if(request.method()==='POST')requests.push(new URL(request.url()).pathname.split('/').at(-1));});
    await page.addInitScript(()=>localStorage.setItem('sgrapeAutoPreview','false'));
    await page.goto(connection.url);await page.waitForFunction(()=>typeof nativeSourceRows==='function'&&nativeSourceRows().some(row=>row.id==='tint'));
    await page.selectOption('#language','en');
    await page.evaluate(()=>{
      selectedInputId='tint';selected=null;selection.clear();inspectorTab='parameters';render();
      sourceCollapsePreferences.defaultCollapsed=false;inputCollapsedGroups.clear();renderNativeSources();
      window.colorInitialGraph=JSON.stringify(graph);window.colorInitialRevision=revision;window.colorInitialDirty=dirty;
      const outside=document.createElement('button');outside.id='test-color-outside';outside.textContent='Fixture outside';outside.style.cssText='position:fixed;right:10px;bottom:10px;z-index:100000';document.body.append(outside);
    });
    await page.waitForFunction(()=>uniformLive.ready&&uniformLive.subscriptions.has('tint'));
    const popup=()=>page.locator('.grape-color-picker');
    const field=channel=>popup().locator(`input[type=number][data-channel="${channel}"]`);
    const settle=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const updated=async()=>{await page.waitForFunction(()=>!!uniformLive.gesture?.colorSession&&uniformLive.gesture.sequence>0&&!uniformLive.gesture.inFlight&&uniformLive.gesture.latest===null);await settle();};
    const finished=async()=>{await page.waitForFunction(()=>!uniformLive.gesture);await settle();};
    const inspect=()=>{const result=job('inspect');assert.equal(result.graphUnchanged,true);assert.equal(result.userShadersPreserved,true);return result;};
    const hex=async value=>{await popup().locator('.gcp-hex').fill(value);await updated();};
    const open=async(trigger='#inspector .color-picker-trigger')=>{await page.locator(trigger).click();await popup().waitFor({state:'visible'});await page.waitForFunction(()=>!!uniformLive.gesture?.colorSession);};
    const outside=async()=>{await page.locator('#test-color-outside').click();await finished();};
    const cancel=async()=>{await popup().locator('.gcp-close').click();await finished();};
    const intact=async()=>assert.equal(await page.evaluate(()=>JSON.stringify(graph)===colorInitialGraph&&revision===colorInitialRevision&&dirty===colorInitialDirty),true);

    const initial=inspect(),initialHistory=await page.evaluate(()=>past.length);
    await open();assert.equal(await field('a').count(),1);assert.equal((await popup().locator('.gcp-hex').inputValue()).replace(/^#/,'').length,8);
    assert.equal(await popup().locator('.gcp-apply').isVisible().catch(()=>false),false);
    const slider=await popup().locator('input[type=range][data-channel="r"]').boundingBox();
    await page.mouse.move(slider.x+slider.width*.25,slider.y+slider.height*.5);await page.mouse.down();
    await page.mouse.move(slider.x+slider.width*.55,slider.y+slider.height*.5,{steps:7});await updated();
    const held=inspect();assert.notEqual(held.values.tint[0],initial.values.tint[0]);assert.equal(held.receiptCount,initial.receiptCount);
    await page.mouse.move(slider.x+slider.width*.82,slider.y+slider.height*.5,{steps:6});await updated();
    const heldAgain=inspect();assert.notEqual(heldAgain.values.tint[0],held.values.tint[0]);assert.equal(heldAgain.receiptCount,initial.receiptCount);
    await page.mouse.up();await hex('#33669980');
    const beforeClose=inspect();sameValues(beforeClose.values.tint,[.2,.4,.6,128/255],'RGBA changes before popup closes');
    assert.equal(beforeClose.receiptCount,initial.receiptCount);assert.equal(await page.evaluate(()=>past.length),initialHistory);
    await outside();const accepted=inspect();assert.equal(accepted.receiptCount,initial.receiptCount+1);assert.equal(await page.evaluate(()=>past.length),initialHistory+1);await intact();
    checks.push('Real TD RGBA updates repeatedly while dragging and before popup close; outside accepts the whole popup as one browser history entry and one native receipt');

    await page.evaluate(()=>undo());await page.waitForFunction(()=>!historyBusy);sameValues(inspect().values.tint,initial.values.tint,'Undo complete RGBA');
    await page.evaluate(()=>undo(true));await page.waitForFunction(()=>!historyBusy);sameValues(inspect().values.tint,accepted.values.tint,'Redo complete RGBA');
    checks.push('One Undo/Redo restores all four native values together while graph data/revision/dirty state remain unchanged');

    for(const closeKind of ['X','Escape']){
      const before=inspect(),history=await page.evaluate(()=>past.length);
      await open();await hex('#aabbccdd');assert.notDeepEqual(inspect().values.tint,before.values.tint);
      if(closeKind==='X')await cancel();else{await page.keyboard.press('Escape');await finished();}
      const restored=inspect();sameValues(restored.values.tint,before.values.tint,closeKind+' restores opening RGBA');
      assert.equal(restored.receiptCount,before.receiptCount,closeKind);assert.equal(await page.evaluate(()=>past.length),history,closeKind);await intact();
    }
    checks.push('X and Escape restore the actual opening RGBA values without leaving an Undo step or native receipt');

    await page.evaluate(()=>{selectedInputId='rgb';selected=null;selection.clear();render();});
    await open();assert.equal(await field('a').count(),0);assert.equal((await popup().locator('.gcp-hex').inputValue()).replace(/^#/,'').length,6);
    const rgbBefore=inspect();await hex('#123456');
    // TD's Color sequence can physically retain an unused fourth parameter.
    // A vec3 editor writes RGB only and must preserve that hidden native slot.
    const rgbHeld=inspect();sameValues(rgbHeld.values.rgb.slice(0,3),[18/255,52/255,86/255],'RGB3 preview');
    assert.deepEqual(rgbHeld.values.rgb.slice(3),rgbBefore.values.rgb.slice(3),'RGB3 preserves any unused native alpha slot');await outside();
    assert.equal(inspect().receiptCount,rgbBefore.receiptCount+1);sameValues(inspect().values.tint,accepted.values.tint,'RGB3 preserves different RGBA source');
    checks.push('Real vec3 Color uses 6-digit HEX with no Alpha and writes exactly three native components');

    // A bound OP Parameter control must use the same source authority and grouped gesture.
    await page.evaluate(async()=>{workspaceLayout.reveal('controls');await refreshCustomParameters();customPage='Colors';renderCustomParameters();});
    await page.waitForFunction(()=>customSnapshot?.controls.some(row=>row.sources?.includes('tint')&&row.style==='RGBA'));
    const bound=await page.evaluate(()=>customSnapshot.controls.find(row=>row.sources?.includes('tint')&&row.style==='RGBA').name);
    const boundTrigger=`#customcontrols [data-custom-control="${bound}"] .color-picker-trigger`;
    const opBefore=inspect(),opHistory=await page.evaluate(()=>past.length);
    await open(boundTrigger);await hex('#cc884466');const opHeld=inspect();sameValues(opHeld.values.tint,[.8,136/255,68/255,.4],'bound OP source preview');
    sameValues(opHeld.boundControls[bound],opHeld.values.tint,'bound OP actual master parameters');
    assert.equal(opHeld.receiptCount,opBefore.receiptCount);await outside();assert.equal(inspect().receiptCount,opBefore.receiptCount+1);
    assert.equal(await page.evaluate(()=>past.length),opHistory+1);await intact();
    checks.push('Bound OP Parameter Color uses live grouped writes: native master and Uniform agree during editing, one receipt/history entry after outside');

    // An external native edit while the popup owns a draft invalidates its old expectation.
    await page.evaluate(()=>{selectedInputId='tint';selected=null;selection.clear();workspaceLayout.reveal('parameters');render();});
    await open();await hex('#55667788');const external=job('external');
    assert.equal(external.userShadersPreserved,true);closeTo(external.values.tint[1],.731,'external G edit');
    if(await popup().isVisible().catch(()=>false)){
      await field('r').fill('0.93');await settle();
      await page.waitForFunction(()=>!uniformLive.gesture||uniformLive.gesture.error||!uniformLive.gesture.inFlight);
      if(await popup().isVisible().catch(()=>false))await popup().locator('.gcp-close').click();
    }
    await finished();sameValues(inspect().values.tint,external.values.tint,'stale draft/X never overwrites external native edit');await intact();
    checks.push('An external native component change defeats stale grouped updates/cancel restoration; the external value and entire current native vector remain intact');

    assert.equal(requests.some(name=>['source-value','apply','graph','validate'].includes(name)),false,'Color live edits do not use graph compilation or REST source-value writes');
    assert.equal(await page.locator('input[type=color]').count(),0);assert.deepEqual(errors,[]);
    await page.screenshot({path:path.join(report,'native-color-editor.png')});
  }catch(error){
    failure=error;
    if(page&&!page.isClosed()){
      await page.screenshot({path:path.join(report,'failure.png')}).catch(()=>{});
      fs.writeFileSync(path.join(report,'debug.json'),JSON.stringify(await page.evaluate(()=>({
        ready:uniformLive?.ready,gesture:uniformLive?.gesture&&{source:uniformLive.gesture.source,sequence:uniformLive.gesture.sequence,inFlight:uniformLive.gesture.inFlight,closed:uniformLive.gesture.closed,error:uniformLive.gesture.error?.message},
        invalid:[...uniformLive.invalidSources],subscriptions:[...uniformLive.subscriptions],past:past.length,historyBusy,nativeSourceError,connectionInterrupted,
        graphSame:JSON.stringify(graph)===window.colorInitialGraph,status:document.querySelector('#status')?.textContent,
      })).catch(error=>({error:error.message})),null,2));
    }
  }finally{
    if(browser)await browser.close();
    if(started){
      try{cleanup=job('cleanup');assert.equal(cleanup.fixtureRemoved,true);assert.equal(cleanup.userShadersPreserved,true);assert.equal(cleanup.graphUnchanged,true);}
      catch(error){failure ||= error;cleanup={...(cleanup||{}),error:error.stack};}
    }
    fs.writeFileSync(path.join(report,'report.json'),JSON.stringify({passed:!failure,count:checks.length,checks,errors,responses,requests,cleanup,...(failure?{error:failure.stack}:{})},null,2));
  }
  if(failure)throw failure;
  console.log(JSON.stringify({passed:true,count:checks.length,checks,cleanup}));
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
