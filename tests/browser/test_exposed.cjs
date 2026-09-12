// Actual Chromium middle-pointer gestures with an isolated Shader service fixture.
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const [source,snapshotFile,folder,overlay]=process.argv.slice(2),original=JSON.parse(fs.readFileSync(snapshotFile,'utf8').replace(/^\uFEFF/,''));
let state=structuredClone(original),applies=0,uniformWrites=0,external=false;const checks=[],errors=[];
const components=[1,1,1,1].map((value,i)=>({parameter:'Tint'+'xyzw'[i],value,mode:'CONSTANT',writable:true}));
const snapshot=()=>({revision:state.state.revision,uniforms:{uniform_tint:{type:'vec4',default:[1,1,1,1],components}},textures:{texture_main:{type:'sampler2D',components:[{parameter:'Texture',value:'/project1/texture',mode:'CONSTANT',writable:true}],defaultValid:true,sourceStatus:'parameter',effectiveSource:'op:/project1/texture'}}});
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
state.state.graph.declarations[0].expose=true;state.state.graph.declarations[0].exposeName='Source Image';state.state.graph.declarations.push({id:'unused',kind:'uniform',type:'float',name:'uUnused',value:.5,expose:true});
fs.mkdirSync(folder,{recursive:true});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE});try{const page=await browser.newPage({viewport:{width:1600,height:1040},hasTouch:false});page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:'+server.address().port+'/shader/'+'a'.repeat(32)+'/#fixture');await page.waitForSelector('.node');

await page.locator('[data-parameter-scope="exposed"]').click();assert.equal(await page.locator('.exposed-card').count(),3);assert.ok(await page.locator('[data-exposed="texture_main"]').isVisible());assert.ok((await page.locator('#inspector').innerText()).includes('uUnused'));await page.waitForFunction(()=>!document.querySelector('[data-exposed="uniform_tint"] .uniform-live input').disabled);checks.push('Exposed lists all Shader declarations without selecting their nodes, including Texture and unused entries');
const live=page.locator('[data-exposed="uniform_tint"] .uniform-live input').first(),before=await page.evaluate(()=>JSON.stringify(graph));await live.fill('2.5');await live.press('Enter');await page.waitForFunction(()=>uniformPending.size===0);assert.equal(components[0].value,2.5);assert.equal(uniformWrites,1);assert.equal(await page.evaluate(()=>JSON.stringify(graph)),before);checks.push('global live editing uses one guarded TD write without changing defaults or graph');
components[0].mode='EXPRESSION';components[0].writable=false;await page.evaluate(()=>refreshUniforms());assert.equal(await live.isDisabled(),true);assert.ok((await page.locator('[data-exposed="uniform_tint"] .uniform-mode').first().innerText()).includes('EXPRESSION'));checks.push('TD Expression ownership is shown and remains read-only in Exposed');
assert.ok((await page.locator('[data-exposed="unused"] .uniform-sync-state').innerText()).includes('目前輸出'));assert.equal(await page.locator('[data-exposed="unused"] .uniform-live input').isDisabled(),true);checks.push('unused declarations explain the absence of a live TD parameter instead of waiting forever');
await page.evaluate(()=>enterFunction(graph.stages.pixel.nodes.find(n=>n.id==='filter')));const functionsBefore=await page.evaluate(()=>JSON.stringify(graph.functions));await page.locator('[data-exposed="uniform_tint"] summary').click();const value=page.locator('[data-exposed="uniform_tint"] details .components input').first();await value.fill('.25');await value.press('Enter');assert.equal(await page.evaluate(()=>graph.declarations.find(d=>d.id==='uniform_tint').value[0]),.25);assert.equal(components[0].value,2.5);assert.equal(await page.evaluate(()=>JSON.stringify(graph.functions)),functionsBefore);checks.push('editing a global default while inside a source Function neither localizes that Function nor changes the live value');
await page.locator('[data-exposed="uniform_tint"] summary').click();await page.locator('[data-exposed="uniform_tint"] details input[type=checkbox]').click();assert.equal(await page.locator('[data-exposed="uniform_tint"]').count(),0);await page.locator('#undo').click();assert.equal(await page.locator('[data-exposed="uniform_tint"]').count(),1);checks.push('Expose removal updates the global page immediately and is undoable');
await page.locator('[data-parameter-scope="exposed"]').focus();await page.keyboard.press('ArrowLeft');assert.equal(await page.locator('[data-parameter-scope="node"]').getAttribute('aria-selected'),'true');await page.keyboard.press('ArrowRight');assert.equal(await page.locator('[data-parameter-scope="exposed"]').getAttribute('aria-selected'),'true');await page.selectOption('#language','en');assert.ok((await page.locator('#inspector').innerText()).includes('Public parameters of this Shader'));checks.push('Node/Exposed tabs support keyboard navigation and both languages');
await page.screenshot({path:path.join(folder,'exposed.png')});await page.evaluate(()=>{readonly=true;inspector();});assert.equal(await page.locator('.exposed-card input:not(:disabled)').count(),0);checks.push('read-only state disables all exposed value and settings editors');

assert.deepEqual(errors,[]);fs.writeFileSync(path.join(folder,'results.json'),JSON.stringify({passed:true,count:checks.length,checks},null,2));console.log(JSON.stringify({passed:true,count:checks.length}));}catch(e){fs.writeFileSync(path.join(folder,'results.json'),JSON.stringify({passed:false,checks,errors,error:e.message},null,2));console.error(e.stack);throw e;}finally{await browser.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e.message);process.exitCode=1;});