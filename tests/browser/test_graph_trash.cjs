/* Drag-to-delete fixture tests: real Chromium touch and mouse, no TD connection.
 * node test_graph_trash.cjs SOURCE_DIR STATE_JSON REPORT_DIR [OVERLAY_DIR]
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
  res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml'})[path.extname(file)]||'text/plain');const bytes=fs.readFileSync(file);res.end(nameOnDisk==='graph_ui.js'?bytes.toString().replace('canvasTrash: false','canvasTrash: true'):bytes);
});
(async()=>{
  const isWebKit=process.env.TEST_BROWSER==='webkit';
  await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await (isWebKit?webkit:chromium).launch({headless:true,...(isWebKit?{}:{executablePath:process.env.CHROME_EXECUTABLE})});
  const context=await browser.newContext({viewport:{width:1133,height:744},hasTouch:true,isMobile:true,deviceScaleFactor:2}),page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForSelector('.node');
  const cdp=isWebKit?null:await context.newCDPSession(page),settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  let activeTouches=0;
  const touch=async(type,points=[])=>{if(type==='touchEnd'&&!activeTouches)return;await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([id,x,y])=>({id,x,y,radiusX:5,radiusY:5}))});activeTouches=points.length;await settle();};
  let device='touch';
  const start=async p=>{if(device==='touch')await touch('touchStart',[[1,p.x,p.y]]);else {await page.mouse.move(p.x,p.y);await page.mouse.down();await settle();}};
  const move=async p=>{if(device==='touch')await touch('touchMove',[[1,p.x,p.y]]);else {await page.mouse.move(p.x,p.y,{steps:6});await settle();}};
  const end=async()=>{if(device==='touch')await touch('touchEnd');else {await page.mouse.up();await settle();}};
  const at=async s=>{const r=await page.locator(s).boundingBox();assert.ok(r,s);return{x:r.x+r.width/2,y:r.y+r.height/2};};
  const trash=async()=>{const r=await page.locator('#graphtrash').boundingBox();return{x:r.x+r.width-22,y:r.y+r.height-22};};
  const wire=()=>page.locator('#wires path[data-from="source:out"][data-to="add:a"]');
  const wirePoint=()=>wire().evaluate(p=>{const q=p.getPointAtLength(p.getTotalLength()*.5),r=document.querySelector('#world').getBoundingClientRect();return{x:r.left+q.x*r.width,y:r.top+q.y*r.height};});
  const state=()=>page.evaluate(()=>JSON.stringify({graph,past,future,dirty}));
  const reset=async()=>{
    await page.evaluate(()=>{
      touchGraphGesture?.cancel();nodeDragGesture?.cancel();clearWireGesture();cancelConnection();closeCreator();closeGraphMenu();clearTimeout(autoTimer);dirty=false;past=[];future=[];readonly=false;historyBusy=false;nativeMutationBusy=false;connectionInterrupted=true;graphTrail=[];selection.clear();selected=selectedEdge=null;
      const node=(id,key,x,y)=>{const d=catalog.find(d=>d.key===key);return{id,definitionUuid:d.definitionUuid,revisionHash:d.revisionHash,params:{...d.defaults},ui:{x,y}};};
      graph.functions=[];graph.declarations=[];graph.stages.pixel={nodes:[node('source','float',0,24),node('add','add',330,20),node('output','pixel_out',330,260)],edges:[{from:['source','out'],to:['add','a']},{from:['source','out'],to:['add','b']}]};stage='pixel';scale=.7;pan={x:24,y:34};render();
    });await page.mouse.click(10,10);await settle();
  };
  for(device of isWebKit?['mouse']:['touch','mouse']){
    await reset();const clickWireBefore=await state();await start(await wirePoint());await end();assert.equal(await page.evaluate(()=>selectedEdge),0);assert.equal(await state(),clickWireBefore);assert.equal(await page.locator('#graphdelete').getAttribute('title'),await page.evaluate(()=>t('wire.disconnectSelected')));
    await reset();let before=await state(),p=await at('[data-node="source"] .node-title'),target=await trash();
    await start(p);await move(target);assert.equal(await state(),before);assert.equal(await page.locator('#graphtrash').getAttribute('data-state'),'active');assert.equal(await page.locator('[data-node="source"]').evaluate(n=>n.classList.contains('trash-pending')),true);
    await page.screenshot({path:path.join(folder,`${device}-node-over-trash.png`)});await end();assert.equal(await page.evaluate(()=>current().nodes.some(n=>n.id==='source')),false);assert.equal(await page.evaluate(()=>current().edges.length),0);assert.equal(await page.evaluate(()=>past.length),1);await page.locator('#undo').click();assert.equal(await page.evaluate(()=>current().nodes.find(n=>n.id==='source').ui.x),0);
    checks.push(`${device}: node preview is nonmutating, release deletes with attached wires, one Undo restores original position`);

    await reset();before=await state();p=await wirePoint();target=await trash();await start(p);await move(target);assert.equal(await state(),before);assert.equal(await page.locator('#graphtrash').getAttribute('data-state'),'active');assert.equal(await page.locator('#graphtrashproxy').isVisible(),true);assert.equal(await wire().evaluate(n=>n.classList.contains('trash-pending')),true);await end();
    assert.equal(await page.evaluate(()=>current().nodes.length),3);assert.deepEqual(await page.evaluate(()=>current().edges.map(e=>e.to[1])),['b']);assert.equal(await page.evaluate(()=>past.length),1);await page.locator('#undo').click();assert.equal(await page.evaluate(()=>current().edges.length),2);
    checks.push(`${device}: dragging the wire body removes only that wire, preserving its nodes and sibling branch`);

    await reset();before=await state();p=await at('[data-node="add"] [data-kind="inputs"][data-port="a"]');await start(p);await move(await trash());assert.equal(await state(),before);await end();assert.deepEqual(await page.evaluate(()=>current().edges.map(e=>e.to[1])),['b']);assert.equal(await page.evaluate(()=>past.length),1);
    checks.push(`${device}: dragging an occupied input into trash disconnects its one incoming wire`);

    await reset();before=await state();p=await at('[data-node="source"] [data-kind="outputs"]');await start(p);await move(await trash());assert.equal(await page.locator('#graphtrashlabel').textContent(),await page.evaluate(()=>t('trash.cancelWire')));await end();assert.equal(await state(),before);assert.equal(await page.locator('#creator').isVisible(),false);assert.equal(await page.evaluate(()=>linkStart),null);
    checks.push(`${device}: discarding a new output-wire drag retains all existing output branches and creates no history`);

    await reset();before=await state();p=await at('[data-node="output"] .node-title');await start(p);await move(await trash());assert.equal(await page.locator('#graphtrash').getAttribute('data-state'),'blocked');await end();assert.equal(await state(),before);
    await page.evaluate(()=>{selection=new Set(['source','output']);selected='source';render();});p=await at('[data-node="source"] .node-title');await start(p);await move(await trash());assert.ok((await page.locator('#graphtrashlabel').textContent()).includes('1'));await end();assert.deepEqual(await page.evaluate(()=>current().nodes.map(n=>n.id)),['add','output']);assert.deepEqual(await page.evaluate(()=>current().nodes.find(n=>n.id==='output').ui),{x:330,y:260});
    checks.push(`${device}: fixed output is protected; mixed selections delete only eligible nodes without moving protected ones`);

    for(const kind of ['node','wire'])for(const cancel of ['leave','escape','blur','resize','rerender','pointercancel']){
      await reset();before=await state();p=kind==='node'?await at('[data-node="source"] .node-title'):await wirePoint();await start(p);await move(await trash());
      if(cancel==='leave'){await move(p);}else if(cancel==='escape')await page.keyboard.press('Escape');else if(cancel==='pointercancel'){
        if(device==='touch')await touch('touchCancel');else await page.evaluate(()=>{const el=document.querySelector('.node-title');el.dispatchEvent(new PointerEvent('pointercancel',{bubbles:true,pointerId:1,pointerType:'mouse'}));document.querySelector('#canvas').dispatchEvent(new PointerEvent('pointercancel',{bubbles:true,pointerId:1,pointerType:'mouse'}));});
      }else await page.evaluate(c=>c==='rerender'?render():window.dispatchEvent(new Event(c)),cancel);
      await end();assert.equal(await state(),before,`${device}/${kind}/${cancel}`);assert.equal(await page.locator('#graphtrash').getAttribute('data-state'),'idle');assert.equal(await page.locator('.trash-pending').count(),0);
    }
    checks.push(`${device}: dragging out, Escape, blur, resize, rerender and pointer cancellation never commit deletion`);

    await reset();before=await state();p=await at('[data-node="source"] .node-title');await page.evaluate(()=>{readonly=true;render();});await start(p);await move(await trash());await end();assert.equal(await state(),before);
    checks.push(`${device}: read-only graphs ignore drop deletion`);
  }
  if(!isWebKit){device='touch';await reset();const beforePinch=await state(),p=await at('[data-node="source"] .node-title'),q=await trash();await start(p);await move(q);await touch('touchStart',[[1,q.x,q.y],[2,q.x-120,q.y-50]]);await touch('touchMove',[[1,q.x,q.y],[2,q.x-140,q.y-50]]);await end();assert.equal(await state(),beforePinch);assert.equal(await page.locator('#graphtrash').getAttribute('data-state'),'idle');
    checks.push('Second finger cancels a trash hover and transfers to navigation without deleting or moving a node');}
  await reset();const target=await page.locator('#graphtrash').boundingBox(),tools=await page.locator('.canvas-view-tools').boundingBox(),canvas=await page.locator('#canvas').boundingBox();assert.ok(Math.abs(target.x+target.width-canvas.x-canvas.width)<1);assert.ok(target.y+target.height<=tools.y);
  checks.push('Trash stays at the lower right above the zoom, fit and focus controls');
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(folder,'results.json'),JSON.stringify({passed:true,count:checks.length,checks},null,2));console.log(JSON.stringify({passed:true,count:checks.length}));
})().catch(e=>{fs.writeFileSync(path.join(folder,'results.json'),JSON.stringify({passed:false,checks,errors,error:e.stack},null,2));console.error(e.stack);process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});
