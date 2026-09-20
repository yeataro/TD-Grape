/* Full product HTTP entry, browser controls, native TD WebSocket and Par values.
 * node TEST SOURCE_ROOT BRIDGE_ROOT PRIVATE_WORK REPORT_DIR
 * Requires a running local TD development bridge; creates/removes only its fixture.
 */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const [source,bridge,work,report]=process.argv.slice(2);
const python=process.env.PYTHON_EXECUTABLE||'python';
const fixture=path.join(work,'jobs','uniform_editor_browser_fixture.py');
fs.mkdirSync(report,{recursive:true});
async function bounded(promise,label){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Timed out: '+label)),20000);})]);}finally{clearTimeout(timer);}}
function job(action){
 const script=`from pathlib import Path\nimport json\nGRAPE_ROOT=Path(${JSON.stringify(source)})\nmapping=json.loads((GRAPE_ROOT/'src/td/source_files.json').read_text())\nsource_path=lambda name: GRAPE_ROOT/mapping[name]\nGRAPE_TEST_ACTION=${JSON.stringify(action)}\nexec(compile((GRAPE_ROOT/'tests/td/uniform_editor_fixture.py').read_text(encoding='utf-8'),'uniform_editor_fixture.py','exec'))\n`;
 fs.writeFileSync(fixture,script);
 let output;
 for(let attempt=0;attempt<3;attempt++){
  try{output=execFileSync(python,[path.join(bridge,'tools/dev/submit_job.py'),fixture,'--report','uniform-live/editor-e2e','--timeout','20'],{cwd:bridge,encoding:'utf8',stdio:'pipe'});break;}
  catch(error){
   // Dropbox can briefly lock the queue file. Retry only a failed atomic
   // replacement: the job was not dispatched. Never retry a response timeout.
   if(attempt===2||!String(error.stderr).includes('temporary.replace')||!String(error.stderr).includes('PermissionError: [WinError 5]'))throw error;
  }
 }
 const result=JSON.parse(output);
 assert.equal(result.ok,true,JSON.stringify(result));return result.result;
}
(async()=>{
 let browser,lastPage,started=false;const checks=[],errors=[],responses=[];
 try{
  job('start');started=true;
  const connection=JSON.parse(fs.readFileSync(path.join(work,'reports/uniform-live/editor-e2e/connection.json'),'utf8'));
  browser=await chromium.launch({executablePath:process.env.CHROME_EXECUTABLE,headless:true});
  for(const host of ['127.0.0.1',...connection.addresses.filter(x=>x.startsWith('100.')).slice(0,1)]){
   const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage();
   lastPage=page;
   page.on('pageerror',error=>errors.push(error.message));
   page.on('response',async res=>{if(res.url().includes('/api/')&&res.status()>=400)responses.push({path:new URL(res.url()).pathname,status:res.status(),body:await res.text()});});
   const requests=[];page.on('request',req=>{if(req.method()==='POST')requests.push(new URL(req.url()).pathname.split('/').at(-1));});
   const url=new URL(connection.url);url.hostname=host;await page.goto(url.href);
   await page.waitForFunction(()=>typeof nativeSourceRows==='function'&&nativeSourceRows().some(r=>r.id==='live'));
   await page.evaluate(()=>{selectedInputId='live';selected=null;selection.clear();render();});
   await page.waitForFunction(()=>uniformLive.ready&&uniformLive.subscribed==='live');
   await page.evaluate(()=>{window.liveDisconnects=[];const disconnect=uniformLive.disconnect;uniformLive.disconnect=function(){liveDisconnects.push({stack:new Error().stack,submitBusy,subscriptions:[...this.subscriptions],views:[...this.views].map(([grid,visible])=>[grid.isConnected,visible])});return disconnect.call(this);};});
   const entry=page.locator('#inspector [data-source-component="0"]');
   await page.evaluate(()=>{window.testGraph=JSON.stringify(graph);window.testRevision=revision;window.testDirty=dirty;});
   let initial=job('inspect');const b=await entry.boundingBox();
   await page.mouse.move(b.x+b.width*.4,b.y+b.height*.5);await page.mouse.down();
   await page.mouse.move(b.x+b.width*.4+35,b.y+b.height*.5,{steps:6});
   await page.waitForFunction(()=>uniformLive.gesture?.sequence>0&&!uniformLive.gesture.inFlight);
   const held=job('inspect');assert.notEqual(held.value,initial.value);assert.equal(held.undoCount,initial.undoCount);
   await page.mouse.move(b.x+b.width*.4+60,b.y+b.height*.5,{steps:5});
   await page.waitForFunction(()=>uniformLive.gesture&&!uniformLive.gesture.inFlight);
   assert.notEqual(job('inspect').value,held.value);
   await page.mouse.up();await page.waitForFunction(()=>!uniformLive.gesture&&past.length===1);
   assert.equal(job('inspect').undoCount,initial.undoCount+1);
   checks.push(`${host}: multiple native Par changes before release; one Undo after release`);
   await page.evaluate(()=>undo());assert.equal(job('inspect').value,initial.value);
   await page.evaluate(()=>undo(true));assert.notEqual(job('inspect').value,initial.value);
   const count=requests.length;job('external');
   await page.waitForFunction(()=>Number(document.querySelector('#inspector [data-source-component="0"]').value)===.731);
   assert.deepEqual(requests.slice(count),[]);
   checks.push(`${host}: direct native Par edit pushes to browser; value-only Undo/Redo`);
   assert.equal(await page.evaluate(()=>JSON.stringify(graph)===testGraph&&revision===testRevision&&dirty===testDirty),true);
   assert.equal(requests.some(x=>['source-value','apply','graph','validate'].includes(x)),false);
   // Hold the layout response after TD accepted it, then drag through the acknowledgement.
   let releaseLayout,layoutAccepted;const accepted=new Promise(resolve=>layoutAccepted=resolve);
   const applyRoute=url=>url.pathname.startsWith('/api/')&&url.pathname.endsWith('/apply');
   await page.route(applyRoute,async route=>{
    const response=await route.fetch();await new Promise(resolve=>{releaseLayout=resolve;layoutAccepted();});await route.fulfill({response});
   });
   await page.evaluate(()=>{
    scheduleGraphApply=()=>{clearTimeout(autoTimer);autoTimer=null;};
    change(()=>{const ui=current().nodes[0].ui;ui.x+=25;ui.width=(ui.width||220)+30;},{localize:false,layout:true});
    window.layoutPromise=applyGraph();
   });
   let acceptTimeout;try{await Promise.race([accepted,new Promise((_,reject)=>{acceptTimeout=setTimeout(()=>reject(Error('Layout response was not intercepted')),15000);})]);}finally{clearTimeout(acceptTimeout);}
   job('layout');
   await page.waitForFunction(()=>uniformLive.ready&&uniformLive.subscriptions.has('live'));
   assert.equal(await entry.isEnabled(),true);
   const layoutBox=await entry.boundingBox();await page.mouse.move(layoutBox.x+layoutBox.width*.4,layoutBox.y+layoutBox.height*.5);await page.mouse.down();
   await page.mouse.move(layoutBox.x+layoutBox.width*.4+25,layoutBox.y+layoutBox.height*.5,{steps:6});
   await page.waitForFunction(()=>uniformLive.gesture?.sequence>0&&!uniformLive.gesture.inFlight);
   const duringLayout=job('inspect');assert.notEqual(duringLayout.value,.731);
   releaseLayout();await page.evaluate(()=>layoutPromise);assert.equal(await entry.isEnabled(),true);
   await page.mouse.move(layoutBox.x+layoutBox.width*.4+50,layoutBox.y+layoutBox.height*.5,{steps:5});await page.mouse.up();
   await page.waitForFunction(()=>!uniformLive.gesture);
   assert.notEqual(job('inspect').value,duringLayout.value);
   assert.equal(await page.evaluate(()=>!dirty&&nativeSourceSnapshot.revision===revision),true);
   await page.unroute(applyRoute);
   checks.push(`${host}: position/size save keeps real native live edits active before and after its revision acknowledgement`);
   // A real compile changes GLSL but must not detach unchanged native controls.
   let releaseCompile,compileAccepted;const compiled=new Promise(resolve=>compileAccepted=resolve);
   await page.route(applyRoute,async route=>{
    const response=await route.fetch(),data=await response.json();assert.equal(data.shaderUpdated,true);
    await new Promise(resolve=>{releaseCompile=resolve;compileAccepted();});await route.fulfill({response});
   });
   const beforeCompile=job('inspect').value;
   await page.evaluate(()=>{
    change(()=>{const n=current().nodes.find(n=>Array.isArray(n.params.value));n.params.value[0]=n.params.value[0]===.19?.29:.19;});
    window.compilePromise=applyGraph();
   });
   await bounded(compiled,'compile response');job('graph');assert.equal(await entry.isEnabled(),true);
   const cb=await entry.boundingBox();await page.mouse.move(cb.x+cb.width*.4,cb.y+cb.height*.5);await page.mouse.down();
   await page.mouse.move(cb.x+cb.width*.4+25,cb.y+cb.height*.5,{steps:5});
   await page.waitForFunction(()=>uniformLive.gesture?.sequence>0&&!uniformLive.gesture.inFlight);
   const duringCompile=job('inspect').value;assert.notEqual(duringCompile,beforeCompile);
   releaseCompile();await page.evaluate(()=>compilePromise);assert.equal(await entry.isEnabled(),true);
   await page.mouse.move(cb.x+cb.width*.4+55,cb.y+cb.height*.5,{steps:5});await page.mouse.up();
   await page.waitForFunction(()=>!uniformLive.gesture);const afterCompile=job('inspect').value;assert.notEqual(afterCompile,duringCompile);
   await page.unroute(applyRoute);
   await page.evaluate(()=>undo());assert.equal(job('inspect').value,beforeCompile);
   await page.evaluate(async()=>{await undo();await applyGraph();});job('graph');
   await page.evaluate(async()=>{await undo(true);await applyGraph();await undo(true);});job('graph');assert.equal(job('inspect').value,afterCompile);
   checks.push(`${host}: real GLSL compile retains the Par and held gesture; graph/value Undo and Redo preserve their separate effects`);
   // Queued REST fallback must confirm the new revision without replacing expected values.
   let releaseRestApply,restApplyAccepted;const restAccepted=new Promise(resolve=>restApplyAccepted=resolve);
   await page.route(applyRoute,async route=>{
    const response=await route.fetch();await new Promise(resolve=>{releaseRestApply=resolve;restApplyAccepted();});await route.fulfill({response});
   });
   await page.evaluate(()=>{
    change(()=>{const values=current().nodes.find(n=>Array.isArray(n.params.value)).params.value;values[1]=values[1]===.37?.47:.37;});window.restApplyPromise=applyGraph();
    window.restValuePromise=nativeSourceRequest('source-value',{id:'live',component:0,value:.618,expected:clone(nativeSourceIndex().get('live').components[0])});
   });
   await bounded(restAccepted,'REST Apply response');job('graph');assert.equal(job('inspect').value,afterCompile);
   releaseRestApply();await page.evaluate(async()=>{await restApplyPromise;await restValuePromise;});
   assert.ok(Math.abs(job('inspect').value-.618)<1e-6);
   await page.waitForFunction(()=>Math.abs(Number(document.querySelector('#inspector [data-source-component="0"]').value)-.618)<1e-6);
   await page.unroute(applyRoute);
   checks.push(`${host}: REST fallback waits for a real compile acknowledgement and writes the same native Par using the confirmed revision`);
   // Return a source snapshot sampled before a newer native live edit.
   let releaseOldRead,oldReadAccepted;const readAccepted=new Promise(resolve=>oldReadAccepted=resolve);
   const sourceRoute=url=>url.pathname.startsWith('/api/')&&url.pathname.endsWith('/sources');
   await page.waitForFunction(()=>!nativeSourcePolling);
   await page.route(sourceRoute,async route=>{const response=await route.fetch();await new Promise(resolve=>{releaseOldRead=resolve;oldReadAccepted();});await route.fulfill({response});});
   await page.evaluate(()=>{window.oldSourcesPromise=refreshNativeSources({required:true});});await bounded(readAccepted,'delayed sources read');
   await entry.fill('0.643');await entry.press('Enter');await page.waitForFunction(()=>!uniformLive.gesture&&Math.abs(nativeSourceIndex().get('live').components[0].value-.643)<1e-6);
   releaseOldRead();await page.evaluate(()=>oldSourcesPromise);assert.ok(Math.abs(Number(await entry.inputValue())-.643)<1e-6);
   await page.unroute(sourceRoute);
   checks.push(`${host}: delayed real HTTP source snapshot cannot replace a newer WebSocket value`);
   await entry.fill('0.673');await entry.press('Enter');await page.waitForFunction(()=>!uniformLive.gesture&&Math.abs(nativeSourceIndex().get('live').components[0].value-.673)<1e-6);
   assert.ok(Math.abs(job('inspect').value-.673)<1e-6);
   checks.push(`${host}: successive typed commits in one focused field use the acknowledged native expectation`);
   // A fresh page runs ordinary HTTP initialization and must reconnect itself.
   await page.reload();await page.waitForFunction(()=>nativeSourceRows().some(r=>r.id==='live'));
   await page.evaluate(()=>{selectedInputId='live';render();});
   await page.waitForFunction(()=>uniformLive.ready&&uniformLive.subscribed==='live');
   checks.push(`${host}: page reload establishes a fresh live subscription`);
   await context.close();
  }
  assert.deepEqual(errors,[]);
 }catch(error){
  console.error(JSON.stringify({checks,errors,responses,debug:lastPage&&!lastPage.isClosed()?await lastPage.evaluate(()=>({disconnects:window.liveDisconnects,ready:uniformLive.ready,invalid:[...uniformLive.invalidSources],polling:nativeSourcePolling,refreshPending:nativeSourceRefreshPending,sourceError:nativeSourceError,uncertain:nativeSourceUncertain,connectionInterrupted,readonly,historyBusy,nativeMutationBusy})):null,body:lastPage&&!lastPage.isClosed()?(await lastPage.locator('body').innerText()).slice(-2400):''}));throw error;
 }finally{
  if(browser)await browser.close();
  if(started){const result=job('cleanup');assert.equal(result.shadersPreserved,true);assert.equal(result.errors,'');}
 }
 fs.writeFileSync(path.join(report,'report.json'),JSON.stringify({checks,errors},null,2));
 console.log(JSON.stringify({passed:true,checks}));
})().catch(error=>{console.error(error);process.exitCode=1;});
