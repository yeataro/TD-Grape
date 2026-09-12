/* Graph edit buttons against isolated fixture APIs; never connects to TD or writes the OS clipboard.
 * node test_edit_shortcuts.cjs SOURCE_DIR STATE_JSON REPORT_DIR [OVERLAY_DIR]
 * TEST_BROWSER=webkit selects WebKit; Chromium is the default.
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
  res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml'})[path.extname(file)]||'text/plain');res.end(fs.readFileSync(file));
});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  browser=await (process.env.TEST_BROWSER==='webkit'?webkit:chromium).launch({headless:true,...(process.env.TEST_BROWSER==='webkit'?{}:{executablePath:process.env.CHROME_EXECUTABLE})});
  const context=await browser.newContext({viewport:{width:1133,height:744},hasTouch:true,isMobile:true,deviceScaleFactor:2}),page=await context.newPage();
  // Exercise the insecure HTTP/LAN fallback without changing the host clipboard.
  await page.addInitScript(()=>{Object.defineProperty(navigator,'clipboard',{configurable:true,value:undefined});document.execCommand=()=>false;});
  page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForSelector('.node');
  await page.evaluate(()=>{
    clearTimeout(autoTimer);dirty=false;past=[];future=[];graphTrail=[];selection.clear();selected=selectedEdge=null;
    const node=(id,key,x,y)=>{const d=catalog.find(d=>d.key===key);return{id,definitionUuid:d.definitionUuid,revisionHash:d.revisionHash,params:{...d.defaults},ui:{x,y}};};
    graph.functions=[];graph.declarations=[];graph.stages.pixel={nodes:[node('source','float',0,36),node('add','add',280,48),node('output','pixel_out',100,260)],edges:[{from:['source','out'],to:['add','a']}]};stage='pixel';scale=.7;pan={x:30,y:40};render();window.initial=clone(graph);
  });
  const state=()=>page.evaluate(()=>JSON.stringify({graph,past,future}));
  const choose=ids=>page.evaluate(ids=>{selection=new Set(ids);selected=ids.at(-1)||null;selectedEdge=null;render();},ids);
  const controls=()=>page.evaluate(()=>['graphcopy','graphpaste','graphdelete'].map(id=>document.getElementById(id).disabled));
  assert.deepEqual(await controls(),[true,true,true]);
  await page.locator('[data-node="source"] .node-title').tap();assert.deepEqual(await controls(),[false,true,false]);
  const before=await state();await page.locator('#graphcopy').tap();assert.equal(await state(),before);assert.deepEqual(await controls(),[false,false,false]);
  assert.equal(await page.evaluate(()=>JSON.parse(editorClipboard).nodes[0].id),'source');
  checks.push('Touch selection enables Copy/Delete; Copy retains graph data locally on HTTP and does not mutate history');

  await page.evaluate(()=>{pastePoint={x:-9000,y:-9000};pan={x:-1800,y:-900};transform();});
  await page.locator('#graphpaste').tap();assert.equal(await page.evaluate(()=>current().nodes.length),4);assert.equal(await page.evaluate(()=>past.length),1);
  const pasted=await page.evaluate(()=>({id:selected,ui:clone(current().nodes.find(n=>n.id===selected).ui)}));
  const canvas=await page.locator('#canvas').boundingBox(),box=await page.locator(`[data-node="${pasted.id}"]`).boundingBox();
  assert.ok(box.x>=canvas.x&&box.x<canvas.x+canvas.width&&box.y>=canvas.y&&box.y<canvas.y+canvas.height);
  await page.locator('#graphpaste').tap();assert.equal(await page.evaluate(()=>past.length),2);
  const next=await page.evaluate(()=>current().nodes.find(n=>n.id===selected).ui);assert.equal(next.x-pasted.ui.x,24);assert.equal(next.y-pasted.ui.y,24);
  await page.locator('#undo').tap();assert.equal(await page.evaluate(()=>current().nodes.length),4);await page.locator('#redo').tap();assert.equal(await page.evaluate(()=>current().nodes.length),5);
  checks.push('Toolbar Paste uses the visible viewport after panning, staggers repeated copies, and adds one Undo step per paste');

  const groupBase=await page.evaluate(()=>JSON.stringify(graph));await choose(['source','add']);await page.locator('#graphdelete').tap();
  assert.equal(await page.evaluate(()=>current().nodes.some(n=>n.id==='source'||n.id==='add')),false);assert.equal(await page.evaluate(()=>current().edges.length),0);
  await page.locator('#undo').tap();assert.equal(await page.evaluate(()=>JSON.stringify(graph)),groupBase);
  await page.evaluate(()=>{selection.clear();selected=null;selectedEdge=0;render();});
  assert.equal(await page.locator('#graphdelete').getAttribute('title'),await page.evaluate(()=>t('wire.disconnectSelected')));
  assert.ok(await page.locator('#graphcopy').isDisabled());const nodes=await page.evaluate(()=>current().nodes.length);
  await page.locator('#graphdelete').tap();assert.equal(await page.evaluate(()=>current().edges.length),0);assert.equal(await page.evaluate(()=>current().nodes.length),nodes);await page.locator('#undo').tap();
  checks.push('Delete removes selected nodes with attached edges, or disconnects the selected wire; both are reversible');

  await choose(['source','add']);const ungrouped=await page.evaluate(()=>JSON.stringify(graph));await page.locator('#graphgroup').tap();
  assert.equal(await page.evaluate(()=>graph.functions.length),1);assert.equal(await page.evaluate(()=>graph.functions[0].graph.edges.length),1);
  await page.locator('#undo').tap();assert.equal(await page.evaluate(()=>JSON.stringify(graph)),ungrouped);
  checks.push('Create Subgraph groups selected nodes with their internal wire and is reversible in one Undo');
  await choose(['output']);assert.ok(await page.locator('#graphcopy').isDisabled());assert.ok(await page.locator('#graphdelete').isDisabled());assert.ok(await page.locator('#graphgroup').isDisabled());
  await choose(['source']);await page.evaluate(()=>{readonly=true;render();});assert.deepEqual(await controls(),[false,true,true]);assert.ok(await page.locator('#graphgroup').isDisabled());await page.locator('#graphcopy').tap();
  const ro=await state();await page.evaluate(()=>pasteGraphFromToolbar());assert.equal(await state(),ro);await page.evaluate(()=>{readonly=false;render();});
  checks.push('Fixed outputs cannot be copied or deleted; read-only graphs allow Copy and reject Paste/Delete');

  await page.evaluate(()=>{
    window.osCopy=null;document.execCommand=()=>{const data=new DataTransfer(),event=new ClipboardEvent('copy',{clipboardData:data,bubbles:true,cancelable:true});document.activeElement.dispatchEvent(event);window.osCopy=data.getData('text/plain');return event.defaultPrevented;};
    const range=document.createRange();range.selectNodeContents(document.querySelector('header'));const s=window.getSelection();s.removeAllRanges();s.addRange(range);
  });
  await page.locator('#graphcopy').tap();assert.equal(await page.evaluate(()=>JSON.parse(window.osCopy).nodes[0].id),'source');
  await page.evaluate(()=>{document.execCommand=()=>false;window.getSelection().removeAllRanges();});
  const native=await page.evaluate(()=>{const input=document.createElement('input');document.body.append(input);input.focus();const data=new DataTransfer(),event=new ClipboardEvent('copy',{clipboardData:data,bubbles:true,cancelable:true});input.dispatchEvent(event);input.remove();return event.defaultPrevented;});assert.equal(native,false);
  checks.push('Explicit graph Copy owns only its copy event; normal input text copying remains native');

  await choose(['source','add']);await page.locator('#graphcopy').tap();
  await page.evaluate(()=>{Object.defineProperty(navigator,'clipboard',{value:{readText:async()=>{throw Error('denied');}},configurable:true});});
  await page.locator('#graphpaste').tap();assert.equal(await page.evaluate(()=>selection.size),2);
  assert.equal(await page.evaluate(()=>current().edges.filter(e=>selection.has(e.from[0])&&selection.has(e.to[0])).length),1);
  checks.push('Clipboard permission denial falls back to local graph data including the copied internal wire');

  await page.evaluate(()=>{Object.defineProperty(navigator,'clipboard',{value:{readText:async()=> 'unrelated text'},configurable:true});});
  const invalid=await state();await page.locator('#graphpaste').tap();assert.equal(await state(),invalid);
  await page.evaluate(()=>{Object.defineProperty(navigator,'clipboard',{value:{readText:()=>new Promise(resolve=>{window.finishRead=resolve;})},configurable:true});});
  await page.locator('#graphpaste').tap();await page.waitForFunction(()=>!!window.finishRead);
  await page.evaluate(()=>{graph=clone(graph);window.afterSwitch=JSON.stringify({graph,past,future});window.finishRead(editorClipboard);});
  await page.waitForTimeout(50);assert.equal(await state(),await page.evaluate(()=>window.afterSwitch));
  checks.push('Invalid clipboard text and a graph change during an async clipboard prompt never mutate the destination');

  await page.evaluate(()=>{Object.defineProperty(navigator,'clipboard',{value:undefined,configurable:true});graph=clone(initial);pan={x:30,y:40};past=[];future=[];selectedEdge=null;selection.clear();selected=null;render();});
  await page.locator('[data-node="source"] .node-title').click({button:'right'});await page.locator('[data-edit="copy"]').click();
  await page.evaluate(()=>openGraphMenu(450,360));await page.locator('[data-edit="paste"]').click();assert.equal(await page.evaluate(()=>current().nodes.length),4);
  const keyboardCopy=await page.evaluate(()=>{const data=new DataTransfer(),event=new ClipboardEvent('copy',{clipboardData:data,bubbles:true,cancelable:true});$('#canvas').dispatchEvent(event);return {text:data.getData('text/plain'),prevented:event.defaultPrevented};});assert.ok(keyboardCopy.prevented);assert.equal(JSON.parse(keyboardCopy.text).nodes.length,1);
  checks.push('Desktop right-click Copy/Paste and standard clipboard events still use the shared graph behavior');

  await page.locator('#language').selectOption('en');assert.equal(await page.locator('#graphcopy').getAttribute('title'),'Copy');assert.equal(await page.locator('#graphpaste').getAttribute('aria-label'),'Paste');
  await page.locator('#language').selectOption('zh-Hant');
  for(const width of [1133,744,420]){
    await page.setViewportSize({width,height:900});await page.evaluate(()=>fit());
    const geometry=await page.evaluate(()=>{const bar=document.querySelector('.graph-workspace .toolbar').getBoundingClientRect();return{viewport:innerWidth,body:document.documentElement.scrollWidth,bar:{x:bar.x,right:bar.right},buttons:['graphcopy','graphpaste','graphgroup','graphdelete'].map(id=>{const r=document.getElementById(id).getBoundingClientRect();return{x:r.x,right:r.right,w:r.width,h:r.height};})};});
    assert.ok(geometry.body<=geometry.viewport+1,JSON.stringify(geometry));
    for(const b of geometry.buttons){assert.ok(b.w>=44&&b.h>=44);assert.ok(b.x>=geometry.bar.x&&b.right<=geometry.bar.right+1,JSON.stringify(geometry));}
    await page.screenshot({path:path.join(folder,`toolbar-touch-${width}.png`)});
  }
  const desktop=await browser.newPage({viewport:{width:1600,height:1040}});await desktop.goto('http://127.0.0.1:'+server.address().port);await desktop.waitForSelector('.node');
  const desktopButton=await desktop.locator('#graphcopy').boundingBox();assert.equal(desktopButton.width,32);await desktop.screenshot({path:path.join(folder,'toolbar-desktop.png')});await desktop.close();
  checks.push('Localized tooltips/accessible labels, 44px touch targets, compact desktop buttons, and narrow layouts without horizontal overflow');
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(folder,'results.json'),JSON.stringify({passed:true,count:checks.length,checks},null,2));console.log(JSON.stringify({passed:true,count:checks.length}));
})().catch(e=>{fs.writeFileSync(path.join(folder,'results.json'),JSON.stringify({passed:false,checks,errors,error:e.stack},null,2));console.error(e.stack);process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});
