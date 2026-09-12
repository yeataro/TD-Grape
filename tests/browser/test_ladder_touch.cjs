// Actual Chromium middle-pointer gestures with an isolated Shader service fixture.
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const [source,snapshotFile,folder,overlay]=process.argv.slice(2),original=JSON.parse(fs.readFileSync(snapshotFile,'utf8').replace(/^\uFEFF/,''));
let state=structuredClone(original),applies=0,uniformWrites=0,external=false;const checks=[],errors=[];
const components=[1,1,1,1].map((value,i)=>({parameter:'Tint'+'xyzw'[i],value,mode:'CONSTANT',writable:true}));
const snapshot=()=>({revision:state.state.revision,uniforms:{uniform_tint:{type:'vec4',default:[1,1,1,1],components}},textures:{}});
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');res.setHeader('Cache-Control','no-store');
  if(url.pathname.startsWith('/api/')){
    res.setHeader('Content-Type','application/json');const operation=url.pathname.split('/').at(-1);let text='';for await(const chunk of req)text+=chunk;const body=text?JSON.parse(text):null;
    if(operation==='state')return res.end(JSON.stringify(state));
    if(operation==='uniforms')return res.end(JSON.stringify(snapshot()));
    if(operation==='uniform-value'){
      uniformWrites++;const item=components[body.component];if(external||!item.writable||body.expected.value!==item.value){res.statusCode=409;return res.end('{"error":"TD value changed; preserved"}');}
      item.value=body.value;return res.end(JSON.stringify(snapshot()));
    }
    if(operation==='apply'){applies++;state.state.graph=body.graph;state.state.revision++;return res.end(JSON.stringify(state));}
    if(operation==='preview'){res.setHeader('Content-Type','image/png');return res.end(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8xkAAAAASUVORK5CYII=','base64'));}
    res.statusCode=404;return res.end('{}');
  }
  const file=url.pathname.startsWith('/shader/')?'index.html':url.pathname.slice(1);if(!/^[a-z0-9_.-]+$/i.test(file)){res.statusCode=404;return res.end();}
  const target=overlay&&fs.existsSync(path.join(overlay,file))?path.join(overlay,file):path.join(source,file);
  if(!fs.existsSync(target)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'})[path.extname(file)]||'text/plain');res.end(fs.readFileSync(target));
});
let browser;
fs.mkdirSync(folder,{recursive:true});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE});try{const page=await browser.newPage({viewport:{width:1600,height:1040},hasTouch:true});page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port+'/shader/'+'a'.repeat(32)+'/#fixture');await page.waitForSelector('.node');

await page.locator('[data-node="tint"] .node-title').click();const field=()=>page.locator('#inspector > .components input').first(),cdp=await page.context().newCDPSession(page);
const position=async()=>{await field().scrollIntoViewIfNeeded();await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));const r=await field().boundingBox();return{x:r.x+r.width/2,y:r.y+r.height/2};};
const touch=async(type,p)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'||type==='touchCancel'?[]:[{x:p.x,y:p.y,id:1}]});
let p=await position(),history=await page.evaluate(()=>past.length);await touch('touchStart',p);await page.waitForTimeout(550);await page.locator('#valueladder').waitFor();const rung=await page.locator('[data-step="0.1"]').boundingBox();p.y=rung.y+rung.height/2;await touch('touchMove',p);p.x+=16;await touch('touchMove',p);assert.equal(Number(await field().inputValue()),1.2);assert.equal(await page.evaluate(()=>graph.declarations.find(d=>d.id==='uniform_tint').value[0]),1);assert.equal(applies,0);checks.push('real Chromium touch long-press opens Ladder; movement previews locally without compiling');
await touch('touchEnd');assert.equal(await page.evaluate(()=>graph.declarations.find(d=>d.id==='uniform_tint').value[0]),1.2);assert.equal(await page.evaluate(()=>past.length),history+1);await page.waitForFunction(()=>!dirty);assert.equal(applies,1);checks.push('touch release closes Ladder and commits one Undo/apply operation');
p=await position();const before=await page.evaluate(()=>JSON.stringify({graph,past}));await touch('touchStart',p);await page.waitForTimeout(550);await page.locator('#valueladder').waitFor();p.x+=24;await touch('touchMove',p);await touch('touchCancel');assert.equal(await page.locator('#valueladder').count(),0);assert.equal(await page.evaluate(()=>JSON.stringify({graph,past})),before);checks.push('touch cancellation restores the original value and history');
p=await position();await touch('touchStart',p);await touch('touchEnd');await page.waitForTimeout(520);assert.equal(await page.locator('#valueladder').count(),0);assert.equal(await field().evaluate(e=>document.activeElement===e),true);checks.push('short touch taps focus the numeric field without opening Ladder');
await page.evaluate(()=>{const spacer=document.createElement('div');spacer.style.height='1000px';$('#inspector').append(spacer);});p=await position();const scrollBefore=await page.locator('#parameterbody').evaluate(e=>e.scrollTop);await touch('touchStart',p);p.y-=50;await touch('touchMove',p);await touch('touchEnd');await page.waitForTimeout(520);assert.equal(await page.locator('#valueladder').count(),0);assert.ok(await page.locator('#parameterbody').evaluate(e=>e.scrollTop)>scrollBefore);assert.equal(await page.evaluate(()=>JSON.stringify({graph,past})),before);checks.push('moving before the hold threshold scrolls Parameter instead of starting an accidental numeric edit');
p=await position();await page.mouse.move(p.x,p.y);await page.mouse.down();await page.waitForTimeout(550);await page.locator('#valueladder').waitFor();await page.mouse.up();checks.push('left mouse hold also opens the same Ladder');
p=await position();await page.mouse.move(p.x,p.y);await page.keyboard.down('Alt');await page.mouse.down({button:'right'});await page.locator('#valueladder').waitFor();await page.mouse.up({button:'right'});await page.keyboard.up('Alt');assert.equal(await page.locator('#valueladder').count(),0);checks.push('Alt+right mouse works as the no-middle-button alternative');
await page.evaluate(()=>{readonly=true;inspector();});p=await position();await touch('touchStart',p);await page.waitForTimeout(550);await touch('touchEnd');assert.equal(await page.locator('#valueladder').count(),0);checks.push('touch long-press cannot edit a read-only parameter');

assert.deepEqual(errors,[]);fs.writeFileSync(path.join(folder,'results.json'),JSON.stringify({passed:true,count:checks.length,checks},null,2));console.log(JSON.stringify({passed:true,count:checks.length}));}catch(e){fs.writeFileSync(path.join(folder,'results.json'),JSON.stringify({passed:false,checks,errors,error:e.message},null,2));console.error(e.stack);throw e;}finally{await browser.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e.message);process.exitCode=1;});