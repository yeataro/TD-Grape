/* Same production browser/viewport and 102-node, 101-edge graph.
 * CPU metrics include React work; frame latency includes scheduler wait.
 * 不把這些前端數字當 TD 編譯、網路或跨裝置承諾。
 * node tests/browser/benchmark_react_editor.cjs BUILD PROTOTYPE_BUILD REPORT
 */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('playwright');
const [built,prototype,report]=process.argv.slice(2).map(x=>path.resolve(x));
const bootstrap=JSON.parse(fs.readFileSync(path.join(built,'editor-bootstrap.json')));
const graph=JSON.parse(fs.readFileSync(path.join(report,'session-perf.json'))).graph;
const target='1'.repeat(32);
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true}); const results=[];
 for(const [mode,root] of [['prototype',prototype],['formal',built],['formal',built],['prototype',prototype]]){
  let state={graph,revision:1,targetId:target}, writes=0;
  const server=http.createServer(async(req,res)=>{
   if(req.url.startsWith('/api/')){res.setHeader('Content-Type','application/json');let raw='';for await(const chunk of req)raw+=chunk;
    if(req.url.endsWith('/state'))return res.end(JSON.stringify({state,target:'/test/benchmark',shaderKind:'top',frontendCompiler:{protocol:'grape.top.ts.1',catalogHash:bootstrap.catalogHash,required:true}}));
    const body=JSON.parse(raw);state={graph:body.graph,revision:state.revision+1,targetId:target};writes++;return res.end(JSON.stringify({state}));}
   const name=new URL(req.url,'http://localhost').pathname;
   const file=path.join(root,name==='/'?'index.html':name);res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'})[path.extname(file)]||'text/plain');
   if(fs.existsSync(file))res.end(fs.readFileSync(file));else {res.statusCode=404;res.end();}
  });await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const page=await browser.newPage({viewport:{width:1600,height:1100}}), errors=[]; page.on('pageerror',e=>errors.push(e.message));
  const client=await page.context().newCDPSession(page); await client.send('Performance.enable');
  await page.goto(`http://127.0.0.1:${server.address().port}/`+(mode==='formal'?`?target=${target}`:''));
  if(mode==='prototype')await page.getByLabel('測試場景',{exact:true}).selectOption('large');
  await page.getByLabel('start value 0',{exact:true}).waitFor();await page.waitForTimeout(1000);
  assert.equal(await page.locator('.react-flow__node').count(),102);assert.equal(await page.locator('.react-flow__edge').count(),101);
  // Renderer-only timing, no server latency. The formal sender is debounced after commits.
  const before=await client.send('Performance.getMetrics');
  const samples=await page.evaluate(async()=>{
   const input=document.querySelector('[aria-label="start value 0"]'), setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
   const cards=[...document.querySelectorAll('.react-flow__node')],paths=[...document.querySelectorAll('.react-flow__edge-path')],d=paths.map(p=>p.getAttribute('d'));
   const longTasks=[];const observer=new PerformanceObserver(list=>longTasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration}))));observer.observe({entryTypes:['longtask']});
   const rows=[];const frame=()=>new Promise(r=>requestAnimationFrame(r));
   for(let i=0;i<35;i++){
    input.focus();setter.call(input,String(i+.5));input.dispatchEvent(new Event('input',{bubbles:true}));await frame();
    const t=performance.now();input.blur();const sync=performance.now()-t;await frame();const nextFrame=performance.now()-t;await frame();
    if(i>=5)rows.push({sync,nextFrame});
   }
   observer.disconnect();
   return {rows,longTasks,identity:cards.every(n=>n.isConnected),unchangedEdges:paths.every((p,i)=>p.isConnected&&p.getAttribute('d')===d[i])};
  });
  const after=await client.send('Performance.getMetrics');const metrics=Object.fromEntries(after.metrics.filter(x=>['ScriptDuration','TaskDuration','LayoutDuration','RecalcStyleDuration','LayoutCount','RecalcStyleCount'].includes(x.name)).map(x=>[x.name,x.value-before.metrics.find(a=>a.name===x.name).value]));
  await page.waitForTimeout(1200);
  assert.ok(samples.identity&&samples.unchangedEdges);assert.deepEqual(errors,[]);
  if (mode === 'prototype') {
    const damp = page.getByLabel('畫布阻尼', { exact: false });
    if (await damp.count()) await damp.uncheck();
  }
  const beforeMotion = writes;
  await page.evaluate(() => {
    window.frameSamples = []; window.measureMotion = true; let previous;
    function frame(t) { if (previous !== undefined) window.frameSamples.push(t - previous); previous = t; if (window.measureMotion) requestAnimationFrame(frame); }
    requestAnimationFrame(frame);
  });
  const pane = await page.locator('.react-flow__pane').boundingBox();
  await page.mouse.move(pane.x + 12, pane.y + 12); await page.mouse.down();
  for (let i = 1; i <= 60; i++) { await page.mouse.move(pane.x + 12 + i * 2, pane.y + 12 + i); await page.waitForTimeout(12); }
  await page.mouse.up();
  for (let i = 0; i < 25; i++) { await page.mouse.wheel(0, i < 12 ? -10 : 10); await page.waitForTimeout(15); }
  await page.waitForTimeout(500);
  const motion = await page.evaluate(() => { window.measureMotion = false; return window.frameSamples; });
  assert.equal(writes, beforeMotion, 'viewport gestures must not write the document');
  let idle;
  if(mode==='formal'&&results.length===1){
   const requestsBefore=writes;const pre=await client.send('Performance.getMetrics');
   await page.evaluate(()=>{window.idleMutations=0;window.idleObserver=new MutationObserver(r=>window.idleMutations+=r.length);window.idleObserver.observe(document.getElementById('root'),{subtree:true,attributes:true,childList:true,characterData:true});});
   await page.waitForTimeout(30000);const post=await client.send('Performance.getMetrics');
   idle={seconds:30,requests:writes-requestsBefore,mutations:await page.evaluate(()=>{window.idleObserver.disconnect();return window.idleMutations}),scriptMs:(post.metrics.find(m=>m.name==='ScriptDuration').value-pre.metrics.find(m=>m.name==='ScriptDuration').value)*1000};
   assert.equal(idle.requests,0);assert.equal(idle.mutations,0);
  }
  results.push({mode,samples,metrics,motion,idle});await page.close();await new Promise(r=>server.close(r));
 }
 fs.writeFileSync(path.join(report,'browser-perf.json'),JSON.stringify({browser:browser.version(),viewport:{width:1600,height:1100},nodes:102,edges:101,results},null,2));
 console.log(JSON.stringify(results.map(({mode,samples,metrics,idle})=>({mode,identity:samples.identity,longTasks:samples.longTasks,p95NextFrame:samples.rows.map(r=>r.nextFrame).sort((a,b)=>a-b)[28],metrics,idle}))));
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
