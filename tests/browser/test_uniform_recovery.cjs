// Actual Chromium middle-pointer gestures with an isolated Shader service fixture.
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const [source,snapshotFile,folder,overlay]=process.argv.slice(2),original=JSON.parse(fs.readFileSync(snapshotFile,'utf8').replace(/^\uFEFF/,''));
let state=structuredClone(original),applies=0,uniformWrites=0,external=false,failReads=false,holdWrite=null,roundWrite=false;const checks=[],errors=[];
const components=[1,1,1,1].map((value,i)=>({parameter:'Tint'+'xyzw'[i],value,mode:'CONSTANT',writable:true}));
const snapshot=()=>({revision:state.state.revision,uniforms:{uniform_tint:{type:'vec4',default:[1,1,1,1],components}},textures:{}});
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');res.setHeader('Cache-Control','no-store');
  if(url.pathname.startsWith('/api/')){
    res.setHeader('Content-Type','application/json');const operation=url.pathname.split('/').at(-1);let text='';for await(const chunk of req)text+=chunk;const body=text?JSON.parse(text):null;
    if(operation==='state')return res.end(JSON.stringify(state));
    if(operation==='uniforms'){if(failReads){res.statusCode=503;return res.end('{"error":"Readback offline"}');}return res.end(JSON.stringify(snapshot()));}
    if(operation==='uniform-value'){
      uniformWrites++;if(holdWrite)await holdWrite;const item=components[body.component];if(external||!item.writable||body.expected.value!==item.value){res.statusCode=409;return res.end('{"error":"TD value changed; preserved"}');}
      item.value=roundWrite?Math.round(body.value*10)/10:body.value;return res.end(JSON.stringify(snapshot()));
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
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE});
 const page=await browser.newPage({viewport:{width:1600,height:1000}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/shader/'+'a'.repeat(32)+'/#fixture');await page.waitForFunction(()=>typeof graph!=='undefined'&&graph);
 await page.locator('[data-node="tint"] .node-title').click();const live=page.locator('#inspector .uniform-live input').first();await page.waitForFunction(()=>!document.querySelector('#inspector .uniform-live input').disabled);
 const before=await page.evaluate(()=>JSON.stringify({graph,past}));
 const type=async(value)=>{await live.fill(String(value));await live.press('Enter');};
 let release;holdWrite=new Promise(r=>release=r);await type(2);await page.waitForFunction(()=>uniformPending.size===1);assert.equal(await live.isDisabled(),true);
 await page.evaluate(()=>writeUniformInput(document.querySelector('#inspector .uniform-live input'),99));assert.equal(uniformWrites,1);release();holdWrite=null;
 await page.waitForFunction(()=>uniformPending.size===0);assert.equal(components[0].value,2);assert.equal(await live.inputValue(),'2');checks.push('in-flight field disables repeat writes; one request commits');
 external=true;components[0].value=7;await type(3);await page.waitForFunction(()=>uniformPending.size===0&&uniformReadbacks.size===0);assert.equal(components[0].value,7);assert.equal(await live.inputValue(),'7');assert.ok((await page.locator('#status').innerText()).includes('preserved'));checks.push('rejected typed write reads authoritative TD value back into the same field');
 external=false;await type(3);await page.waitForFunction(()=>uniformPending.size===0);assert.equal(components[0].value,3);checks.push('typing the same previously rejected value succeeds after recovery');
 external=true;failReads=true;components[0].value=8;await type(4);await page.waitForFunction(()=>uniformPending.size===0&&uniformReadbacks.size===1);assert.equal(await live.isDisabled(),true);const failedCount=uniformWrites;await page.waitForTimeout(650);assert.equal(uniformWrites,failedCount);checks.push('unavailable readback keeps field disabled without retrying a write');
 // Rebuilding the inspector cannot bypass a pending authoritative readback.
 await page.evaluate(()=>inspector());assert.equal(await live.isDisabled(),true);failReads=false;external=false;await page.evaluate(()=>refreshUniforms());await page.waitForFunction(()=>uniformReadbacks.size===0);assert.equal(await live.inputValue(),'8');assert.equal(await live.isDisabled(),false);checks.push('recovery survives inspector rebuild and resumes once TD is readable');
 roundWrite=true;await type(1.234);await page.waitForFunction(()=>uniformPending.size===0);assert.equal(await live.inputValue(),'1.2');assert.equal(components[0].value,1.2);roundWrite=false;checks.push('successful write displays TD normalized value and resets typed-entry baseline');
 external=true;components[0].mode='EXPRESSION';components[0].writable=false;components[0].value=.75;await type(9);await page.waitForFunction(()=>uniformPending.size===0&&uniformReadbacks.size===0);assert.equal(await live.inputValue(),'0.75');assert.equal(await live.isDisabled(),true);assert.equal(components[0].mode,'EXPRESSION');checks.push('mode race restores evaluated value and preserves read-only Expression state');
 assert.equal(await page.evaluate(()=>JSON.stringify({graph,past})),before);assert.equal(applies,0);assert.deepEqual(errors,[]);checks.push('no graph, Undo history or compilation changes and no browser errors');
 fs.writeFileSync(path.join(folder,'uniform-recovery-tests.json'),JSON.stringify({passed:true,count:checks.length,checks},null,2));console.log(JSON.stringify({passed:true,count:checks.length}));
})().catch(e=>{console.error(e);fs.writeFileSync(path.join(folder,'uniform-recovery-tests.json'),JSON.stringify({passed:false,checks,errors,error:e.message},null,2));process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});
