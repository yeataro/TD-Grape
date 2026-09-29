// SESSION_JSON contains local MAT/TOP editor URLs. No graph writes are permitted.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
 const [sessionFile,folder]=process.argv.slice(2),session=JSON.parse(fs.readFileSync(sessionFile,'utf8'));
 fs.mkdirSync(folder,{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE});
 const checks=[],errors=[],writes=[];
 try{
  const context=await browser.newContext({viewport:{width:1500,height:1000}});
  await context.addInitScript(()=>{localStorage.setItem('sgrapeAutoPreview','true');});
  await context.route('**/*',route=>{
   const req=route.request(),url=new URL(req.url());
   if(req.method()!=='GET'&&!['remote-preview','live-ticket'].includes(url.pathname.split('/').at(-1))){writes.push(url.pathname);return route.abort();}
   return route.continue();
  });
  let previous;
  for(const kind of ['mat','top']){
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(session[kind]);
   await page.waitForFunction(()=>$('#preview').state==='connected'&&$('#preview').video.videoWidth>0,null,{timeout:20000});
   if(previous)await previous.waitForFunction(()=>$('#preview').state==='replaced');
   await page.locator('#preview video').click();
   const name=kind==='mat'?'Dimmer':'Outline',control=page.locator(`[data-viewer-control=${name}]:enabled`);
   await control.waitFor();
   const before=await page.evaluate(()=>JSON.stringify({graph,past,future,dirty,selected,selection:[...selection]}));
   const saved=await control.evaluate(e=>e.type==='checkbox'?e.checked:e.value);
   try{
    if(kind==='mat'){await control.fill(String(Number(saved)+.125));await control.press('Enter');}
    else await control.setChecked(!saved);
    await page.waitForFunction(({name,saved})=>!viewerParameterPending&&viewerParameterSnapshot.controls.find(r=>r.name===name).components[0].value!==saved,{name,saved:kind==='mat'?Number(saved):saved});
    assert.equal(await page.evaluate(()=>viewerParameterError),'');
    await page.locator('[data-viewer-control=Home]:enabled').click();
    await page.waitForFunction(()=>!viewerParameterPending);
    await page.locator('#preview video').click();await page.keyboard.press('h');
    assert.equal(await page.evaluate(()=>JSON.stringify({graph,past,future,dirty,selected,selection:[...selection]})),before);
    await page.screenshot({path:path.join(folder,kind+'-viewer.png')});
    checks.push(kind+' actual video, native parameter read/write and Home/H preserve the graph');
   }finally{
    if(kind==='mat'){await control.fill(String(saved));await control.press('Enter');}
    else await control.setChecked(saved);
    await page.waitForFunction(()=>!viewerParameterPending);
   }
   previous=page;
  }
  assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(folder,'results.json'),JSON.stringify({passed:true,checks,errors},null,2));console.log(JSON.stringify({passed:true,checks}));
 }finally{await browser.close();}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
