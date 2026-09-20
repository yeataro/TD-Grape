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
function job(action){
 const script=`from pathlib import Path\nimport json\nGRAPE_ROOT=Path(${JSON.stringify(source)})\nmapping=json.loads((GRAPE_ROOT/'src/td/source_files.json').read_text())\nsource_path=lambda name: GRAPE_ROOT/mapping[name]\nGRAPE_TEST_ACTION=${JSON.stringify(action)}\nexec(compile((GRAPE_ROOT/'tests/td/uniform_editor_fixture.py').read_text(encoding='utf-8'),'uniform_editor_fixture.py','exec'))\n`;
 fs.writeFileSync(fixture,script);
 const result=JSON.parse(execFileSync(python,[path.join(bridge,'tools/dev/submit_job.py'),fixture,'--report','uniform-live/editor-e2e','--timeout','20'],{cwd:bridge,encoding:'utf8'}));
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
   // A fresh page runs ordinary HTTP initialization and must reconnect itself.
   await page.reload();await page.waitForFunction(()=>nativeSourceRows().some(r=>r.id==='live'));
   await page.evaluate(()=>{selectedInputId='live';render();});
   await page.waitForFunction(()=>uniformLive.ready&&uniformLive.subscribed==='live');
   checks.push(`${host}: page reload establishes a fresh live subscription`);
   await context.close();
  }
  assert.deepEqual(errors,[]);
 }catch(error){
  console.error(JSON.stringify({checks,errors,responses,body:lastPage&&!lastPage.isClosed()?(await lastPage.locator('body').innerText()).slice(-2400):''}));throw error;
 }finally{
  if(browser)await browser.close();
  if(started){const result=job('cleanup');assert.equal(result.shadersPreserved,true);assert.equal(result.errors,'');}
 }
 fs.writeFileSync(path.join(report,'report.json'),JSON.stringify({checks,errors},null,2));
 console.log(JSON.stringify({passed:true,checks}));
})().catch(error=>{console.error(error);process.exitCode=1;});
