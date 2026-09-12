/* Native WebKit touch taps against isolated fixture APIs; never connects to TD.
 * node test_touch_webkit.cjs SOURCE_DIR STATE_JSON REPORT_DIR [OVERLAY_DIR]
 */
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const {webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const [source,stateFile,folder,overlay]=process.argv.slice(2),snapshot=JSON.parse(fs.readFileSync(stateFile,'utf8').replace(/^\uFEFF/,''));
let browser,applies=0;const errors=[],checks=[];fs.mkdirSync(folder,{recursive:true});
const server=http.createServer(async(req,res)=>{
  const name=new URL(req.url,'http://localhost').pathname;res.setHeader('Cache-Control','no-store');
  if(name.startsWith('/api/')){
    let raw='';for await(const c of req)raw+=c;res.setHeader('Content-Type','application/json');
    const op=name.split('/').at(-1);
    if(op==='state')return res.end(JSON.stringify(snapshot));
    if(op==='uniforms')return res.end(JSON.stringify({revision:snapshot.state.revision,uniforms:{},textures:{}}));
    if(op==='apply'){applies++;snapshot.state.graph=JSON.parse(raw).graph;snapshot.state.revision++;return res.end(JSON.stringify(snapshot));}
    if(op==='preview'){res.statusCode=204;return res.end();}res.statusCode=404;return res.end('{}');
  }
  const nameOnDisk=name==='/'?'index.html':name.slice(1);if(!/^[a-z0-9_.-]+$/i.test(nameOnDisk)){res.statusCode=404;return res.end();}
  const file=overlay&&fs.existsSync(path.join(overlay,nameOnDisk))?path.join(overlay,nameOnDisk):path.join(source,nameOnDisk);
  if(!fs.existsSync(file)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml'})[path.extname(file)]||'text/plain');res.end(fs.readFileSync(file));
});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await webkit.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1133,height:744},hasTouch:true,isMobile:true,deviceScaleFactor:2});
  page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForSelector('.node');
  await page.evaluate(()=>{
    clearTimeout(autoTimer);dirty=false;past=[];future=[];graphTrail=[];selection.clear();selected=selectedEdge=null;
    const node=(id,key,x,y)=>{const d=catalog.find(d=>d.key===key);return{id,definitionUuid:d.definitionUuid,revisionHash:d.revisionHash,params:{...d.defaults},ui:{x,y}};};
    graph.functions=[];graph.declarations=[];graph.stages.pixel={nodes:[node('source','float',0,36),node('add','add',280,48)],edges:[]};stage='pixel';scale=.8;pan={x:30,y:40};render();
  });
  const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const at=async s=>{const r=await page.locator(s).boundingBox();return{x:r.x+r.width/2,y:r.y+r.height/2};};
  const tap=async p=>{await page.touchscreen.tap(p.x,p.y);await settle();};
  const sourcePort='[data-node="source"] [data-kind="outputs"]',targetPort='[data-node="add"] [data-kind="inputs"][data-port="a"]';
  let p=await at(sourcePort),q=await at(targetPort);await tap(p);assert.ok(await page.evaluate(()=>linkStart));await tap(p);assert.equal(await page.evaluate(()=>linkStart),null);await tap(p);await tap(q);
  assert.equal(await page.evaluate(()=>current().edges.length),1);assert.equal(await page.evaluate(()=>past.length),1);checks.push('Native WebKit touch taps arm, cancel, and connect sockets exactly once');
  const canvas=await page.locator('#canvas').boundingBox();p={x:canvas.x+canvas.width-50,y:canvas.y+canvas.height-70};
  await tap(p);await page.waitForTimeout(80);await tap(p);assert.equal(await page.locator('#creator').isVisible(),true);assert.equal(await page.evaluate(()=>visualViewport.scale),1);assert.equal(await page.evaluate(()=>window.getSelection().toString()),'');checks.push('Native WebKit double-tap opens Add Node without page zoom or text selection');
  await page.locator('#createsearch').fill('Float');assert.equal(await page.locator('#createsearch').inputValue(),'Float');assert.notEqual(await page.locator('#createsearch').evaluate(e=>getComputedStyle(e).userSelect),'none');await page.locator('#closecreator').click();checks.push('Add Node search retains native text editing');
  p=await at('[data-node="source"] .node-title');await tap(p);q=await at('[data-node="add"] .node-title');await page.mouse.click(q.x,q.y);assert.equal(await page.evaluate(()=>selected),'add');await page.mouse.click(q.x,q.y,{button:'right'});assert.equal(await page.locator('#grapheditmenu').getAttribute('data-input'),'mouse');checks.push('An attached mouse can immediately select and right-click after touch');
  await page.keyboard.press('Escape');await page.evaluate(()=>{const f=FunctionModel.importLibrary(graph,functionLibrary[0]);current().nodes=[{id:'function',definitionUuid:FunctionModel.CALL,params:{functionId:f.id},ui:{x:0,y:36}}];current().edges=[];render();});
  p=await at('[data-node="function"] .node-title');await tap(p);await page.waitForTimeout(80);await tap(p);assert.equal(await page.evaluate(()=>graphTrail.length),1);checks.push('Native WebKit double-tap enters a Subgraph');
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(folder,'results.json'),JSON.stringify({passed:true,count:checks.length,checks,scope:'Playwright WebKit native taps on Windows; long drags/holds covered by Chromium suite, not physical iPad verification.'},null,2));console.log(JSON.stringify({passed:true,count:checks.length}));
})().catch(e=>{fs.writeFileSync(path.join(folder,'results.json'),JSON.stringify({passed:false,checks,errors,error:e.stack},null,2));console.error(e.stack);process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});
