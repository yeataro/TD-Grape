/* Real Chromium touch dispatch against isolated fixture APIs; never connects to TD.
 * node test_touch_editing.cjs SOURCE_DIR STATE_JSON REPORT_DIR [OVERLAY_DIR]
 */
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
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
  await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE});
  const context=await browser.newContext({viewport:{width:1133,height:744},hasTouch:true,isMobile:true,deviceScaleFactor:2}),page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForSelector('.node');await page.evaluate(()=>document.fonts.ready);
  const cdp=await context.newCDPSession(page),settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  let activeTouches=0;
  const touch=async(type,points=[])=>{if(type==='touchEnd'&&!activeTouches)return;await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([id,x,y])=>({id,x,y,radiusX:5,radiusY:5}))});activeTouches=points.length;await settle();};
  const start=p=>touch('touchStart',[[1,p.x,p.y]]),move=p=>touch('touchMove',[[1,p.x,p.y]]),end=()=>touch('touchEnd');
  const tap=async p=>{await start(p);await end();},doubleTap=async p=>{await tap(p);await page.waitForTimeout(80);await tap(p);};
  const at=async s=>{const r=await page.locator(s).boundingBox();assert.ok(r,s);return{x:r.x+r.width/2,y:r.y+r.height/2};};
  const sel=(id,kind,port)=>`[data-node="${id}"] [data-kind="${kind}"][data-port="${port}"]`;
  const sourcePort=sel('source','outputs','out'),aPort=sel('add','inputs','a'),bPort=sel('add','inputs','b'),colorPort=sel('color','outputs','out');
  const graphState=()=>page.evaluate(()=>JSON.stringify({graph,past,future,dirty}));
  const reset=async()=>{
    await end();await page.evaluate(()=>{
      touchGraphGesture?.cancel();cancelConnection();closeCreator();closeGraphMenu();clearTimeout(autoTimer);dirty=false;past=[];future=[];readonly=false;graphTrail=[];selection.clear();selected=selectedEdge=null;boxSelectMode=false;
      const node=(id,key,x,y,params={})=>{const d=catalog.find(d=>d.key===key);return{id,definitionUuid:d.definitionUuid,revisionHash:d.revisionHash,params:{...d.defaults,...params},ui:{x,y,comment:'Touch comment'}};};
      graph.functions=[];graph.declarations=[];graph.stages.pixel={nodes:[node('source','float',0,36),node('add','add',280,48),node('color','color',0,280)],edges:[]};stage='pixel';scale=.8;pan={x:30,y:40};render();
      $('#boxselect').setAttribute('aria-pressed','false');
    });
    // A mouse pointerdown also clears the previous touch double-tap sequence.
    await page.mouse.click(10,10);await settle();
  };
  const blank=async()=>{const r=await page.locator('#canvas').boundingBox();return{x:r.x+r.width-45,y:r.y+r.height-65};};
  const wiresAligned=()=>page.evaluate(()=>{
    for(const p of document.querySelectorAll('#wires path[data-from]'))for(const[ref,kind,len]of [[p.dataset.from,'outputs',0],[p.dataset.to,'inputs',p.getTotalLength()]]){
      const i=ref.lastIndexOf(':'),b=document.querySelector(`[data-node="${ref.slice(0,i)}"] [data-kind="${kind}"][data-port="${ref.slice(i+1)}"]`).getBoundingClientRect(),q=p.getPointAtLength(len),m=document.createElementNS(p.namespaceURI,'circle');m.setAttribute('cx',q.x);m.setAttribute('cy',q.y);m.setAttribute('r',1);p.parentNode.append(m);const r=m.getBoundingClientRect();m.remove();if(Math.hypot(r.left+r.width/2-b.left-b.width/2,r.top+r.height/2-b.top-b.height/2)>.75)return false;
    }return true;
  });
  await reset();await page.evaluate(()=>{current().edges=[{from:['source','out'],to:['add','a']}];wires();});
  let p=await at('[data-node="source"] .node-title'),before=await graphState(),count=applies;
  await start(p);await move({x:p.x+57.6,y:p.y+38.4});assert.equal(await graphState(),before);assert.ok(await wiresAligned());
  await page.waitForTimeout(750);assert.equal(applies,count);assert.equal(await page.locator('#grapheditmenu').count(),0);await end();
  assert.equal(await page.evaluate(()=>past.length),1);assert.deepEqual(await page.evaluate(()=>({x:current().nodes[0].ui.x,y:current().nodes[0].ui.y})),{x:72,y:72});assert.ok(await wiresAligned());
  await page.waitForFunction(()=>!dirty);assert.equal(applies,count+1);await page.locator('#undo').click();assert.deepEqual(await page.evaluate(()=>({x:current().nodes[0].ui.x,y:current().nodes[0].ui.y})),{x:0,y:36});
  checks.push('Node drag previews without graph writes; release is one Undo/apply; connected wires remain attached');
  for(const cancel of ['pointercancel','blur','rerender','escape']){
    await reset();p=await at('[data-node="source"] .node-canvas-comment');before=await graphState();const rect=await page.locator('[data-node="source"]').boundingBox();
    await start(p);await move({x:p.x+55,y:p.y+30});
    if(cancel==='pointercancel')await touch('touchCancel');else if(cancel==='escape')await page.keyboard.press('Escape');else await page.evaluate(c=>c==='blur'?window.dispatchEvent(new Event('blur')):render(),cancel);
    await end();assert.equal(await graphState(),before);const now=await page.locator('[data-node="source"]').boundingBox();assert.ok(Math.abs(now.x-rect.x)<.1&&Math.abs(now.y-rect.y)<.1);assert.equal(await page.locator('#grapheditmenu').count(),0);
  }
  checks.push('Node body/comment drag cancels cleanly on pointer cancellation, blur, rerender and Escape');
  await reset();p=await at('[data-node="source"] .node-title');before=await graphState();
  await start(p);await move({x:p.x+55,y:p.y+30});await touch('touchStart',[[1,p.x+55,p.y+30],[2,p.x+155,p.y+30]]);
  await touch('touchMove',[[1,p.x+35,p.y+40],[2,p.x+175,p.y+40]]);assert.equal(await graphState(),before);assert.ok(await page.evaluate(()=>scale>.8));
  await touch('touchEnd',[[1,p.x+35,p.y+40]]);await move({x:p.x+45,y:p.y+45});await end();assert.equal(await graphState(),before);assert.equal(await page.evaluate(()=>visualViewport.scale),1);
  checks.push('Second finger rolls back node preview, takes over pinch/pan, and never commits a move or page zoom');
  await reset();p=await at(sourcePort);let q=await at(aPort);count=applies;
  await start({x:p.x+10,y:p.y});await move({x:q.x-12,y:q.y});assert.equal(await page.locator('.wire-preview.ready').count(),1);assert.equal(await page.evaluate(()=>current().edges.length),0);
  await end();assert.deepEqual(await page.evaluate(()=>current().edges),[{from:['source','out'],to:['add','a']}]);assert.equal(await page.evaluate(()=>past.length),1);assert.ok(await wiresAligned());
  await page.waitForFunction(()=>!dirty);assert.equal(applies,count+1);
  checks.push('Touch-friendly socket proximity draws and commits one connection without a duplicate synthesized click');
  await reset();p=await at(aPort);q=await at(sourcePort);await start(p);await move(q);await end();assert.equal(await page.evaluate(()=>current().edges.length),1);
  checks.push('Reverse input-to-output touch dragging connects');
  await reset();p=await at(sourcePort);q=await at(bPort);await tap(p);assert.ok(await page.evaluate(()=>!!linkStart));await tap(p);assert.equal(await page.evaluate(()=>linkStart),null);
  await tap(p);await tap(q);assert.equal(await page.evaluate(()=>current().edges.length),1);assert.equal(await page.evaluate(()=>past.length),1);
  checks.push('Tap-tap connects; tapping the armed socket again cancels');
  await reset();p=await at(colorPort);q=await at(aPort);before=await graphState();await start(p);await move(q);assert.equal(await page.locator('.wire-target').count(),0);await end();assert.equal(await graphState(),before);assert.equal(await page.locator('#creator').isVisible(),false);
  checks.push('Incompatible touch drops cannot silently connect or open Add Node');
  await reset();p=await at(sourcePort);q=await at(aPort);before=await graphState();await start(p);await move(q);await touch('touchStart',[[1,q.x,q.y],[2,q.x+50,q.y+40]]);await touch('touchMove',[[1,q.x-15,q.y],[2,q.x+65,q.y+40]]);await end();
  assert.equal(await graphState(),before);assert.equal(await page.locator('.wire-preview,.wire-target').count(),0);assert.equal(await page.locator('#creator').isVisible(),false);
  checks.push('Second finger cancels a ready wire before pinch; release creates neither an edge nor a menu');
  await reset();p=await at(sourcePort);q=await at(aPort);before=await graphState();await start(p);await move(q);await touch('touchCancel');assert.equal(await graphState(),before);assert.equal(await page.locator('.wire-preview,.wire-target').count(),0);
  await start(p);await page.waitForTimeout(620);assert.equal(await page.locator('#grapheditmenu').count(),0);await end();assert.ok(await page.evaluate(()=>linkStart));await tap(p);assert.equal(await page.evaluate(()=>linkStart),null);
  checks.push('Canceled wire leaves no preview; holding a socket does not steal the gesture for a context menu');
  await reset();p=await at('[data-node="source"] .node-title');before=await graphState();await start(p);await move({x:p.x+40,y:p.y+25});await touch('touchStart',[[1,p.x+40,p.y+25],[2,80,250]]);await end();assert.equal(await graphState(),before);
  await reset();p=await at('[data-node="source"] .node-title');before=await graphState();await start(p);await move({x:p.x+40,y:p.y+25});await page.setViewportSize({width:744,height:1133});await end();assert.equal(await graphState(),before);await page.setViewportSize({width:1133,height:744});
  checks.push('A second touch outside the canvas or an orientation change cancels the preview without saving a move');
  await reset();p=await at(sourcePort);q=await blank();await start(p);await move(q);await end();assert.equal(await page.locator('#creator').isVisible(),true);assert.equal(await page.evaluate(()=>creatorState.wire.node),'source');assert.equal(await page.evaluate(()=>current().edges.length),0);
  checks.push('Wire dropped onto blank canvas opens the compatible Add Node menu');
  await reset();p=await blank();before=await graphState();await tap(p);assert.equal(await page.locator('#creator').isVisible(),false);await page.waitForTimeout(360);await doubleTap(p);
  assert.equal(await page.locator('#creator').isVisible(),true);assert.equal(await page.evaluate(()=>visualViewport.scale),1);assert.equal(await page.evaluate(()=>window.getSelection().toString()),'');assert.equal(await graphState(),before);
  await page.locator('#createsearch').fill('Float');assert.equal(await page.locator('#createsearch').inputValue(),'Float');assert.notEqual(await page.locator('#createsearch').evaluate(e=>getComputedStyle(e).userSelect),'none');
  checks.push('Blank double-tap opens Add Node once; no page zoom/text selection; the search field remains editable');
  await reset();p=await at('[data-node="add"] .node-title');before=await graphState();await start(p);await page.waitForTimeout(620);await page.locator('#grapheditmenu').waitFor();await end();
  assert.equal(await graphState(),before);assert.equal(await page.locator('#grapheditmenu').getAttribute('data-input'),'touch');assert.ok((await page.locator('#grapheditmenu [data-edit=delete]').boundingBox()).height>=44);assert.equal(await page.locator('#creator').isVisible(),false);
  await page.screenshot({path:path.join(folder,'touch-context-menu.png')});q=await at('#grapheditmenu [data-edit=delete]');await tap(q);assert.equal(await page.evaluate(()=>current().nodes.some(n=>n.id==='add')),false);assert.equal(await page.evaluate(()=>past.length),1);
  checks.push('Node long-press opens touch-sized context menu; releasing does not activate it; a separate Delete tap works');
  await reset();await page.evaluate(()=>{current().edges=[{from:['source','out'],to:['add','a']}];wires();});
  p=await page.evaluate(()=>{const path=document.querySelector('#wires path'),q=path.getPointAtLength(path.getTotalLength()/2),m=document.createElementNS(path.namespaceURI,'circle');m.setAttribute('cx',q.x);m.setAttribute('cy',q.y);m.setAttribute('r',1);path.parentNode.append(m);const r=m.getBoundingClientRect();m.remove();return{x:r.left+r.width/2,y:r.top+r.height/2};});
  await start(p);await page.waitForTimeout(620);await page.locator('#grapheditmenu').waitFor();await end();assert.equal(await page.locator('#grapheditmenu [data-edit=delete]').innerText(),await page.evaluate(()=>t('wire.disconnectSelected')));q=await at('#grapheditmenu [data-edit=delete]');await tap(q);assert.equal(await page.evaluate(()=>current().edges.length),0);assert.equal(await page.evaluate(()=>current().nodes.length),3);
  checks.push('Long-pressing a wire offers Disconnect and preserves both endpoint nodes');
  await reset();p=await blank();await start(p);await move({x:p.x+3,y:p.y+2});await page.waitForTimeout(620);assert.equal(await page.locator('#grapheditmenu').count(),1);await end();q=await at('#grapheditmenu [data-edit=add]');await tap(q);assert.equal(await page.locator('#creator').isVisible(),true);
  checks.push('Blank long-press tolerates small finger jitter and provides Add Node through the context menu');
  await reset();p=await blank();before=await graphState();await start(p);await move({x:p.x-35,y:p.y-20});await page.waitForTimeout(620);await end();assert.equal(await page.locator('#grapheditmenu').count(),0);assert.equal(await graphState(),before);
  checks.push('Moving before the hold threshold pans instead of triggering a delayed context menu');
  await reset();await page.evaluate(()=>{const f=FunctionModel.importLibrary(graph,functionLibrary[0]);current().nodes=[{id:'function',definitionUuid:FunctionModel.CALL,params:{functionId:f.id},ui:{x:0,y:36}}];render();});
  p=await at('[data-node="function"] .node-title');await doubleTap(p);assert.equal(await page.evaluate(()=>graphTrail.length),1);assert.equal(await page.locator('#creator').isVisible(),false);
  checks.push('Double-tapping a Subgraph enters it instead of opening Add Node');
  await reset();await page.evaluate(()=>{boxSelectMode=true;});let canvas=await page.locator('#canvas').boundingBox();p={x:canvas.x+10,y:canvas.y+10};q={x:canvas.x+440,y:canvas.y+220};await start(p);await move(q);await end();assert.deepEqual(await page.evaluate(()=>[...selection].sort()),['add','source']);
  p=await at('[data-node="source"] .node-title');await start(p);await move({x:p.x+38.4,y:p.y+19.2});await end();assert.equal(await page.evaluate(()=>past.length),1);assert.deepEqual(await page.evaluate(()=>current().nodes.slice(0,2).map(n=>n.ui.x)),[48,328]);
  checks.push('Box Select works with one finger; dragging a selected node moves the selected group together');
  await reset();await page.evaluate(()=>{readonly=true;});p=await at('[data-node="source"] .node-title');before=await graphState();await start(p);await move({x:p.x+50,y:p.y+20});await end();assert.equal(await graphState(),before);
  p=await at(sourcePort);q=await at(aPort);await start(p);await move(q);await end();assert.equal(await graphState(),before);p=await blank();await doubleTap(p);assert.equal(await page.locator('#creator').isVisible(),false);
  checks.push('Read-only graphs reject touch node moves, connections and Add Node');
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(folder,'results.json'),JSON.stringify({passed:true,count:checks.length,checks,scope:'Real Chromium touch events on Windows with tablet emulation; physical iPad remains to verify.'},null,2));console.log(JSON.stringify({passed:true,count:checks.length}));
})().catch(e=>{fs.writeFileSync(path.join(folder,'results.json'),JSON.stringify({passed:false,checks,errors,error:e.stack},null,2));console.error(e.stack);process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});
