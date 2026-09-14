// Exercise lost responses through HTTP without touching a user's TD project.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const [source,fixture,output]=process.argv.slice(2);
let state=JSON.parse(fs.readFileSync(fixture,'utf8').replace(/^\uFEFF/,'')),mode='auth',writes=0;
const checks=[],errors=[];
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');res.setHeader('Cache-Control','no-store');
 if(url.pathname.startsWith('/api/')){
  const operation=url.pathname.split('/').at(-1);let text='';for await(const chunk of req)text+=chunk;const body=text?JSON.parse(text):null;
  if(req.method==='POST')writes++;
  res.setHeader('Content-Type','application/json');
  if(mode==='hang')return;
  if(mode==='lost'&&operation==='apply'){state.state.graph=body.graph;state.state.revision++;mode='busy';}
  if(mode==='auth'||mode==='forbidden'||mode==='busy'){res.statusCode=mode==='auth'?401:mode==='forbidden'?403:503;return res.end(JSON.stringify({error:mode==='auth'?'Open the editor from TouchDesigner to reconnect':'TouchDesigner is paused or busy'}));}
  if(operation==='apply'){
   if(mode==='compile'){res.statusCode=422;return res.end(JSON.stringify({error:'fixture compile error',diagnostics:[{stage:'pixel',node:state.state.graph.stages.pixel.nodes[0].id,message:'fixture compile error'}]}));}
   if(mode==='conflict'){res.statusCode=422;return res.end(JSON.stringify({error:'Conflict: newer graph'}));}
   state.state.graph=body.graph;state.state.revision++;return res.end(JSON.stringify(state));
  }
  if(operation==='state')return res.end(JSON.stringify(state));
  if(operation==='shaders')return res.end(JSON.stringify({projectFile:'connection-test.toe',shaders:[]}));
  if(operation==='uniforms')return res.end(JSON.stringify({revision:state.state.revision,uniforms:{},textures:{}}));
  if(operation==='preview'){res.setHeader('Content-Type','image/png');return res.end(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8xkAAAAASUVORK5CYII=','base64'));}
  res.statusCode=404;return res.end('{}');
 }
 const name=url.pathname.startsWith('/shader/')?'index.html':url.pathname.slice(1);
 if(!/^[a-z0-9_.-]+$/i.test(name)||!fs.existsSync(path.join(source,name))){res.statusCode=404;return res.end();}
 res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'})[path.extname(name)]||'text/plain');res.end(fs.readFileSync(path.join(source,name)));
});
let browser;
(async()=>{
 fs.mkdirSync(output,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE});
 const page=await browser.newPage({viewport:{width:1440,height:950}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/shader/'+'a'.repeat(32)+'/');
 await page.waitForFunction(()=>document.querySelector('#connectionnotice').dataset.kind==='auth');
 assert.equal(await page.locator('#diagnosticbar').isVisible(),false);
 await page.locator('#connectionnotice details').evaluate(e=>e.open=true);assert.ok((await page.locator('#connectionhint').innerText()).includes('Open Editor'));
 mode='busy';assert.equal(await page.evaluate(()=>{const a=startEditor(),b=startEditor();a.catch(()=>{});return a===b;}),true);
 await page.waitForFunction(()=>connectionIssue==='busy'&&!editorStartPromise);mode='ok';
 await page.locator('#connectionretry').click();await page.waitForFunction(()=>graph&&editorStarted);
 checks.push('first-load authentication failure recovers through Retry without a browser reload');
 const capture=()=>page.evaluate(()=>JSON.stringify({graph,past,future,revision,dirty,selection:[...selection],pan,scale}));
 mode='busy';await page.evaluate(()=>{change(()=>{graph.stages.pixel.nodes[0].ui.x+=17;});applyGraph();});
 await page.waitForFunction(()=>applyNeedsReview&&!submitBusy);const draft=await capture(),count=writes;
 assert.equal(await page.locator('#diagnosticbar').isVisible(),false);await page.waitForTimeout(1000);assert.equal(writes,count);
 await page.locator('#connectionnotice details').evaluate(e=>e.open=true);
 assert.ok((await page.locator('#connectionhint').innerText()).includes('Cooking'));
 await page.screenshot({path:path.join(output,'connection-desktop.png')});
 mode='ok';await page.locator('#connectionretry').click();await page.waitForFunction(()=>!connectionRetrying&&!connectionInterrupted&&!applyNeedsReview);
 assert.equal(await capture(),draft);assert.equal(writes,count);
 checks.push('503 during Apply preserves the entire canvas and Undo state; recovery only reads');
 mode='compile';await page.locator('#apply').click();await page.waitForFunction(()=>compileIssues.length>0&&!submitBusy);
 assert.equal(await page.locator('#diagnosticbar').isVisible(),true);checks.push('real 422 shader errors still show shader diagnostics');
 mode='conflict';await page.evaluate(()=>clearCompileDiagnostics());await page.locator('#apply').click();await page.waitForFunction(()=>conflicted&&!submitBusy);
 assert.equal(await page.locator('#diagnosticbar').isVisible(),false);checks.push('revision conflicts do not masquerade as GLSL compilation failures');
 mode='lost';await page.locator('#apply').click();await page.waitForFunction(()=>applyNeedsReview&&!submitBusy);const lost=await capture(),lostWrites=writes;
 mode='ok';await page.locator('#connectionretry').click();await page.waitForFunction(()=>connectionIssue==='changed'&&!connectionRetrying);
 assert.equal(await capture(),lost);await page.waitForTimeout(1200);assert.equal(writes,lostWrites);
 checks.push('committed Apply with a lost response is not replayed or silently loaded over the draft');
 mode='forbidden';await page.locator('#connectionretry').click();await page.waitForFunction(()=>connectionIssue==='forbidden');
 assert.equal(await page.locator('#diagnosticbar').isVisible(),false);checks.push('Host/Origin rejection has separate connection guidance');
 await page.setViewportSize({width:744,height:1024});await page.locator('#connectionnotice details').evaluate(e=>e.open=true);
 assert.ok(await page.locator('#connectionretry').isVisible());assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:path.join(output,'connection-tablet.png')});checks.push('notice and retry remain usable in a narrow tablet viewport');
 mode='hang';await page.clock.install();await page.evaluate(()=>{connectionIssue='';connectionInterrupted=false;applyNeedsReview=false;api('state').catch(()=>{});});
 await page.waitForTimeout(100);await page.clock.fastForward(21000);await page.waitForFunction(()=>connectionIssue==='unavailable');
 assert.equal(await page.locator('#diagnosticbar').isVisible(),false);checks.push('hung requests have a bounded timeout and report an unknown connection cause');
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({passed:true,checks},null,2));console.log(JSON.stringify({passed:true,count:checks.length}));
})().catch(e=>{console.error(e);fs.mkdirSync(output,{recursive:true});fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({passed:false,checks,errors,error:e.stack},null,2));process.exitCode=1;}).finally(async()=>{await browser?.close();server.closeAllConnections();server.close();});
