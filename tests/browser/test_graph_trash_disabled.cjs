/* Build the disabled development configuration in the fixture server; no TD connection.
 * node test_graph_trash_disabled.cjs SOURCE_DIR STATE_JSON REPORT_DIR [OVERLAY_DIR]
 * TEST_BROWSER=webkit runs the mouse cases in WebKit.
 */
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,webkit}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
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
  res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml'})[path.extname(file)]||'text/plain');const bytes=fs.readFileSync(file);res.end(nameOnDisk==='graph_ui.js'?bytes.toString().replace('canvasTrash: true','canvasTrash: false'):bytes);
});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const isWebKit=process.env.TEST_BROWSER==='webkit';
  browser=await (isWebKit?webkit:chromium).launch({headless:true,...(isWebKit?{}:{executablePath:process.env.CHROME_EXECUTABLE})});
  const context=await browser.newContext({viewport:{width:1133,height:744},hasTouch:true,isMobile:true,deviceScaleFactor:2}),page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForSelector('.node');
  assert.equal(await page.evaluate(()=>EDITOR_DEV_SETTINGS.canvasTrash),false);assert.equal(await page.locator('#graphtrash').isVisible(),false);
  const cdp=isWebKit?null:await context.newCDPSession(page),settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const touch=async(type,p)=>{await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:p?[{id:1,x:p.x,y:p.y,radiusX:5,radiusY:5}]:[]});await settle();};
  let device='mouse';
  const start=async p=>{if(device==='touch')await touch('touchStart',p);else {await page.mouse.move(p.x,p.y);await page.mouse.down();}};
  const move=async p=>{if(device==='touch')await touch('touchMove',p);else {await page.mouse.move(p.x,p.y,{steps:6});await settle();}};
  const end=async()=>{if(device==='touch')await touch('touchEnd');else {await page.mouse.up();await settle();}};
  const at=async selector=>{const r=await page.locator(selector).boundingBox();return{x:r.x+r.width/2,y:r.y+r.height/2};};
  const corner=async()=>{const r=await page.locator('#canvas').boundingBox();return{x:r.x+r.width-30,y:r.y+r.height-80};};
  const state=()=>page.evaluate(()=>JSON.stringify({graph,past,future}));
  const reset=async()=>{
    await page.evaluate(()=>{
      cancelConnection();closeCreator();closeGraphMenu();clearTimeout(autoTimer);dirty=false;past=[];future=[];historyBusy=false;nativeMutationBusy=false;connectionInterrupted=true;selection.clear();selected=selectedEdge=null;
      const node=(id,key,x,y)=>{const d=catalog.find(d=>d.key===key);return{id,definitionUuid:d.definitionUuid,revisionHash:d.revisionHash,params:{...d.defaults},ui:{x,y}};};
      graph.functions=[];graph.declarations=[];graph.stages.pixel={nodes:[node('source','float',0,24),node('add','add',330,24)],edges:[{from:['source','out'],to:['add','a']}]};stage='pixel';scale=.7;pan={x:24,y:34};render();
    });await page.mouse.click(10,10);await settle();
  };
  for(device of isWebKit?['mouse']:['mouse','touch']){
    await reset();await start(await at('[data-node="source"] .node-title'));await move(await corner());
    assert.equal(await page.locator('#graphtrash').isVisible(),false);assert.equal(await page.locator('#graphtrashlabel').isVisible(),false);assert.equal(await page.locator('.trash-pending').count(),0);await end();
    assert.equal(await page.evaluate(()=>current().nodes.length),2);assert.equal(await page.evaluate(()=>current().edges.length),1);assert.equal(await page.evaluate(()=>past.length),1);assert.ok(await page.evaluate(()=>current().nodes[0].ui.x!==0));await page.locator('#undo').click();assert.equal(await page.evaluate(()=>current().nodes[0].ui.x),0);
    checks.push(`${device}: former trash area is an ordinary node move, without hidden hit detection or deletion`);
    await reset();const before=await state(),input='[data-node="add"] [data-kind="inputs"][data-port="a"]';await start(await at(input));await move(await corner());assert.equal(await state(),before);await end();
    assert.equal(await page.evaluate(()=>current().edges.length),0);assert.equal(await page.evaluate(()=>past.length),1);assert.equal(await page.locator('#creator').isVisible(),false);assert.equal(await page.locator('#graphtrashproxy').isVisible(),false);await page.locator('#undo').click();assert.equal(await page.evaluate(()=>current().edges.length),1);
    checks.push(`${device}: input drag onto blank canvas commits one reversible disconnect only on release`);
    await reset();await start(await at(input));await end();assert.ok(await page.evaluate(()=>linkStart));await start(await corner());await end();assert.equal(await page.evaluate(()=>current().edges.length),0);assert.equal(await page.evaluate(()=>past.length),1);assert.equal(await page.locator('#creator').isVisible(),false);
    checks.push(`${device}: selecting an occupied input then clicking blank canvas follows the documented TD disconnect flow`);
    for(const cancel of ['escape','blur','node','outside']){
      await reset();const unchanged=await state();await start(await at(input));await move(await corner());
      if(cancel==='escape')await page.keyboard.press('Escape');else if(cancel==='blur')await page.evaluate(()=>window.dispatchEvent(new Event('blur')));else await move(cancel==='node'?await at('[data-node="source"] .node-title'):{x:10,y:10});await end();
      assert.equal(await state(),unchanged,device+'/'+cancel);assert.equal(await page.locator('#creator').isVisible(),false);
    }
    checks.push(`${device}: Escape, blur, a node drop and leaving the canvas preserve the wire`);
    for(const selector of ['[data-node="source"] [data-kind="outputs"]','[data-node="add"] [data-kind="inputs"][data-port="b"]']){
      await reset();const unchanged=await state();await start(await at(selector));await move(await corner());await end();assert.equal(await state(),unchanged);assert.equal(await page.locator('#creator').isVisible(),true);await page.locator('#closecreator').click();
    }
    checks.push(`${device}: output and unconnected-input drops retain the existing Add Node flow`);
    await reset();const wirePoint=await page.locator('#wires path[data-from]').evaluate(p=>{const q=p.getPointAtLength(p.getTotalLength()/2),r=document.querySelector('#world').getBoundingClientRect();return{x:r.left+q.x*r.width,y:r.top+q.y*r.height};});
    await start(wirePoint);await end();assert.equal(await page.evaluate(()=>selectedEdge),0);await page.locator('#graphdelete').click();assert.equal(await page.evaluate(()=>current().edges.length),0);await page.locator('#undo').click();assert.equal(await page.evaluate(()=>current().edges.length),1);
    checks.push(`${device}: normal wire selection and toolbar Delete/Undo remain available`);
  }
  await reset();const stable=await state();assert.equal(await page.evaluate(()=>commitGraphTrash(trashTarget('nodes',current().nodes))),false);assert.equal(await state(),stable);
  checks.push('Disabled configuration also rejects a stale direct trash commit');
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(folder,'results.json'),JSON.stringify({passed:true,count:checks.length,checks},null,2));console.log(JSON.stringify({passed:true,count:checks.length}));
})().catch(e=>{fs.writeFileSync(path.join(folder,'results.json'),JSON.stringify({passed:false,checks,errors,error:e.stack},null,2));console.error(e.stack);process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});
