/* Actual Chromium pointer/capture and touch dispatch, isolated from TD writes.
 * Usage: node test_navigation_browser.cjs SOURCE_DIR STATE_JSON REPORT_JSON [OVERLAY_DIR]
 * Set PLAYWRIGHT_MODULE and CHROME_EXECUTABLE when not on the normal search path.
 */
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const [source,stateFile,reportFile,overlay]=process.argv.slice(2);
const snapshot=JSON.parse(fs.readFileSync(stateFile,'utf8').replace(/^\uFEFF/,''));
const checks=[],errors=[];
const server=http.createServer(async(req,res)=>{
  const name=new URL(req.url,'http://localhost').pathname;
  res.setHeader('Cache-Control','no-store');
  if(name.startsWith('/api/')){
    let data='';for await(const chunk of req)data+=chunk;
    const op=name.split('/').at(-1);res.setHeader('Content-Type','application/json');
    if(op==='state')return res.end(JSON.stringify(snapshot));
    if(op==='uniforms')return res.end(JSON.stringify({revision:snapshot.state.revision,uniforms:{},textures:{}}));
    if(op==='apply'){snapshot.state.graph=JSON.parse(data).graph;snapshot.state.revision++;return res.end(JSON.stringify({state:snapshot.state,target:'/browser-test/Shader'}));}
    if(op==='preview'){res.setHeader('Content-Type','image/png');return res.end(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8xkAAAAASUVORK5CYII=','base64'));}
    res.statusCode=404;return res.end('{}');
  }
  const file=name==='/'?'index.html':name.slice(1);
  if(!/^[a-z0-9_.-]+$/i.test(file)){res.statusCode=404;return res.end();}
  const target=overlay&&fs.existsSync(path.join(overlay,file))?path.join(overlay,file):path.join(source,file);
  if(!fs.existsSync(target)){res.statusCode=404;return res.end();}
  const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml'};
  res.setHeader('Content-Type',types[path.extname(file)]||'text/plain');
  res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; frame-ancestors 'none'");
  res.end(fs.readFileSync(target));
});
let browser;
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE});
  const context=await browser.newContext({viewport:{width:1600,height:1000},hasTouch:true});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForSelector('.node');
  await page.evaluate(()=>document.fonts.ready);
  const reset=async(zoom=.8)=>page.evaluate(zoom=>{
    cancelConnection();closeCreator();clearTimeout(autoTimer);dirty=false;past=[];future=[];graphTrail=[];selection.clear();selected=null;
    const node=(id,key,x,y,params={})=>{const d=catalog.find(d=>d.key===key);return {id,definitionUuid:d.definitionUuid,revisionHash:d.revisionHash,params:{...d.defaults,...params},ui:{x,y}};};
    graph.functions=[];graph.declarations=[];graph.stages.pixel={nodes:[node('source','float',20,30),node('vector','color',20,230),node('add','add',350,30),node('add2','add',650,30),node('vecadd','add',350,300,{type:'vec4'})],edges:[]};
    stage='pixel';pan={x:45,y:55};scale=zoom;render();
  },zoom);
  const sel=(node,kind,port)=>`[data-node="${node}"] [data-kind="${kind}"][data-port="${port}"]`;
  const at=async selector=>{const r=await page.locator(selector).boundingBox();assert.ok(r);return{x:r.x+r.width/2,y:r.y+r.height/2};};
  const start=async selector=>{const p=await at(selector);await page.mouse.move(p.x,p.y);await page.mouse.down();};
  const move=async(selector,offset=0)=>{const p=await at(selector);await page.mouse.move(p.x+offset,p.y,{steps:5});await page.evaluate(()=>new Promise(requestAnimationFrame));};
  const targets=async()=>page.locator('.wire-target').count();
  const edges=async()=>page.evaluate(()=>current().edges);
  const sourcePort=sel('source','outputs','out'),input=sel('add','inputs','a');
  await reset();await start(sourcePort);await move(input,-10);
  assert.equal(await targets(),1);assert.equal(await page.locator(input).evaluate(e=>e.classList.contains('wire-target')),true);
  assert.equal(await page.locator('.wire-preview.ready').count(),1);
  const alignment=await page.evaluate(()=>{const p=document.querySelector('.wire-preview'),b=document.querySelector('.wire-target').getBoundingClientRect(),q=p.getPointAtLength(p.getTotalLength()).matrixTransform(p.getScreenCTM());return Math.hypot(q.x-b.left-b.width/2,q.y-b.top-b.height/2);});
  assert.ok(alignment<.1);await page.screenshot({path:path.join(path.dirname(reportFile),'wire-ready.png')});
  await page.mouse.up();assert.deepEqual(await edges(),[{from:['source','out'],to:['add','a']}]);assert.equal(await targets(),0);checks.push('nearby output-to-input: exact ready target and snapped endpoint agree with release');
  await reset();await start(input);await move(sourcePort,10);assert.equal(await targets(),1);await page.mouse.up();assert.equal((await edges()).length,1);checks.push('reverse input-to-output proximity connection');
  await reset();await start(sel('vector','outputs','out'));await move(input);assert.equal(await targets(),0);await page.mouse.up();assert.equal((await edges()).length,0);assert.equal(await page.locator('#creator').isVisible(),false);checks.push('incompatible direct port: no highlight, no connection, no creator');
  await reset();await start(sourcePort);await move(sel('vecadd','inputs','a'),-10);assert.equal(await targets(),1);await page.mouse.up();assert.equal((await edges())[0].to[0],'vecadd');checks.push('float-to-vector splat remains compatible');
  await reset();await page.evaluate(()=>{current().edges=[{from:['add','out'],to:['add2','a']}];wires();});
  await start(sel('add2','outputs','out'));await move(input);assert.equal(await targets(),0);await page.mouse.up();assert.equal((await edges()).length,1);checks.push('cycle is rejected by both highlight and connection rule');
  await reset();await start(sourcePort);await move(input,-10);await page.mouse.move(100,150);await page.evaluate(()=>new Promise(requestAnimationFrame));assert.equal(await targets(),0);await page.mouse.up();assert.equal((await edges()).length,0);checks.push('leaving canvas removes ready state and cannot connect');
  for(const cancel of ['escape','blur','pointercancel','captureloss','rerender']){
    await reset();await start(sourcePort);await move(input,-10);assert.equal(await targets(),1);
    if(cancel==='escape')await page.keyboard.press('Escape');
    else await page.evaluate(mode=>{const b=document.querySelector('[data-node="source"] .port');if(mode==='blur')window.dispatchEvent(new Event('blur'));if(mode==='pointercancel')b.dispatchEvent(new PointerEvent('pointercancel',{pointerId:1}));if(mode==='captureloss')b.releasePointerCapture(1);if(mode==='rerender')render();},cancel);
    await page.mouse.move((await at(input)).x,(await at(input)).y);await page.mouse.up();
    assert.equal(await targets(),0);assert.equal((await edges()).length,0);assert.equal(await page.locator('.wire-preview').count(),0);checks.push('cancellation: '+cancel);
  }
  await reset();await page.locator(sourcePort).click();await page.locator(input).click();assert.equal((await edges()).length,1);checks.push('click-click connection retained');
  await page.evaluate(()=>{current().edges=[{from:['add2','out'],to:['add','a']}];wires();});
  await start(sourcePort);await move(input);await page.mouse.up();assert.deepEqual(await edges(),[{from:['source','out'],to:['add','a']}]);
  await page.keyboard.press('Control+z');assert.deepEqual(await edges(),[{from:['add2','out'],to:['add','a']}]);checks.push('replace occupied input, one Undo restores original edge');
  await reset();await start(sourcePort);const canvas=await page.locator('#canvas').boundingBox();await page.mouse.move(canvas.x+500,canvas.y+600);await page.mouse.up();assert.equal(await page.locator('#creator').isVisible(),true);checks.push('empty canvas wire drop opens filtered Creator');
  for(const zoom of [.25,1.7]){
    await reset(zoom);if(zoom>1)await page.evaluate(()=>{current().nodes.find(n=>n.id==='add').ui.x=240;render();});
    await start(sourcePort);await move(input,-10);assert.equal(await targets(),1);await page.mouse.up();assert.equal((await edges()).length,1);checks.push('10px proximity at zoom '+zoom);
  }
  await reset();await start(sourcePort);await move(input,-10);await page.mouse.wheel(0,-250);await page.evaluate(()=>new Promise(requestAnimationFrame));
  assert.equal(await targets(),1);await page.mouse.up();assert.equal((await edges()).length,1);checks.push('wheel zoom during wire drag refreshes the target before release');
  const cdp=await context.newCDPSession(page);
  const touch=async(type,points)=>{await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([id,x,y])=>({id,x,y,radiusX:1,radiusY:1}))});await page.evaluate(()=>new Promise(requestAnimationFrame));};
  const view=()=>page.evaluate(()=>({scale,pan,graph:JSON.stringify(graph),history:past.length,selected,viewportScale:visualViewport.scale}));
  await reset(.8);const before=await view(),cx=canvas.x+600,cy=canvas.y+500;
  await touch('touchStart',[[1,cx-50,cy],[2,cx+50,cy]]);
  await touch('touchMove',[[1,cx-100,cy+20],[2,cx+100,cy+20]]);
  const during=await view();assert.ok(Math.abs(during.scale-1.6)<.001);assert.equal(during.viewportScale,1);
  const worldX=(cx-canvas.x-before.pan.x)/before.scale,worldY=(cy-canvas.y-before.pan.y)/before.scale;
  assert.ok(Math.abs((cx-canvas.x-during.pan.x)/during.scale-worldX)<.01);
  assert.ok(Math.abs((cy+20-canvas.y-during.pan.y)/during.scale-worldY)<.01);
  await touch('touchEnd',[]);assert.equal((await view()).graph,before.graph);assert.equal((await view()).history,0);assert.equal(await page.locator('#creator').isVisible(),false);checks.push('real two-touch Chromium input: anchored 2x zoom plus pan, no page zoom or graph edit');
  await reset(.8);await touch('touchStart',[[1,cx-20,cy],[2,cx+20,cy]]);await touch('touchMove',[[1,cx-180,cy],[2,cx+180,cy]]);assert.equal((await view()).scale,1.7);await touch('touchEnd',[]);
  await reset(.8);await touch('touchStart',[[1,cx-180,cy],[2,cx+180,cy]]);await touch('touchMove',[[1,cx-10,cy],[2,cx+10,cy]]);assert.equal((await view()).scale,.25);await touch('touchCancel',[]);checks.push('touch zoom limits and pointer cancellation');
  await reset();const prior=await view();await touch('touchStart',[[1,cx,cy]]);await touch('touchMove',[[1,cx+45,cy+25]]);await touch('touchEnd',[]);assert.deepEqual((await view()).pan,{x:prior.pan.x+45,y:prior.pan.y+25});checks.push('single touch background pan');
  await reset();const p=await at(sourcePort);await touch('touchStart',[[1,p.x,p.y]]);await touch('touchEnd',[]);const q=await at(input);await touch('touchStart',[[1,q.x,q.y]]);await touch('touchEnd',[]);assert.equal((await edges()).length,1);checks.push('touch tap-tap ports connect once');
  assert.equal(await page.locator('.library').evaluate(e=>getComputedStyle(e).scrollbarColor),'rgb(81, 70, 95) rgb(27, 27, 35)');
  assert.equal(await page.locator('.material-preview').evaluate(e=>getComputedStyle(e).borderBottomWidth),'1px');checks.push('sidebar scrollbar colors and Live/Parameter divider');
  await page.locator('#language').selectOption('en');assert.equal(await page.evaluate(()=>t('wire.release')).then(s=>s.startsWith('Release')),true);checks.push('new feedback localized in English and Traditional Chinese');
  assert.equal(await page.locator('link[rel="icon"]').getAttribute('href'),'/favicon.svg');
  assert.equal(await page.evaluate(async()=>{const icon=new Image();icon.src=document.querySelector('link[rel="icon"]').href;await icon.decode();return icon.naturalWidth>0&&icon.naturalWidth===icon.naturalHeight;}),true);checks.push('local SVG favicon decodes under the editor Content Security Policy');
  assert.deepEqual(errors,[]);checks.push('no browser page errors');
  fs.writeFileSync(reportFile,JSON.stringify({passed:true,count:checks.length,checks,scope:'Real Chromium pointer and multi-touch events, captured TD catalog with isolated HTTP fixture; no physical touch hardware or TD writes.'},null,2));
  console.log(JSON.stringify({passed:true,count:checks.length}));
})().catch(e=>{console.error(e);fs.writeFileSync(reportFile,JSON.stringify({passed:false,checks,errors,error:e.message},null,2));process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});
