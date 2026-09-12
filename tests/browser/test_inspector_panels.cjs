/* Read-only real-TD browser check, with optional staged UI asset overrides.
 * node test_inspector_panels.cjs SESSION_JSON REPORT_DIR [OVERLAY_DIR]
 * SESSION_JSON contains {url}; keep it private. No POST requests are allowed.
 */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const [sessionFile,folder,overlay]=process.argv.slice(2),session=JSON.parse(fs.readFileSync(sessionFile,'utf8'));
let browser;const checks=[],errors=[],writes=[];
(async()=>{
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE});
  const context=await browser.newContext({viewport:{width:1600,height:1000},hasTouch:true});
  const page=await context.newPage();const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));let previewRequests=0;
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(new URL(r.url()).pathname.endsWith('/preview'))previewRequests++;});
  await page.route('**/*',async route=>{
    const req=route.request(),file=path.basename(new URL(req.url()).pathname);
    if(req.method()!=='GET'){writes.push(req.method()+' '+new URL(req.url()).pathname);return route.abort();}
    const name=req.resourceType()==='document'?'index.html':file;
    if(overlay&&['index.html','app.js','inspector.js','graph_ui.js','style.css','locales.json'].includes(name)&&fs.existsSync(path.join(overlay,name))){
      const contentTypes={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'};
      return route.fulfill({status:200,contentType:contentTypes[path.extname(name)],body:fs.readFileSync(path.join(overlay,name))});
    }
    return route.continue();
  });
  await page.goto(session.url);await page.waitForSelector('.node');await page.evaluate(()=>document.fonts.ready);
  const original=await page.evaluate(()=>JSON.stringify(graph));
  await page.locator('[data-node="tint"] .node-title').click();
  const panelIds=['parameters','live','help'],bodyIds=['parameterbody','livebody','helpbody'];
  const rects=()=>page.locator('.inspector-panel').evaluateAll(ps=>ps.map(p=>{const r=p.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height};}));
  let positions=await rects();assert.ok(positions[0].top<positions[1].top&&positions[1].top<positions[2].top);assert.ok(positions[0].height>positions[1].height&&positions[1].height>positions[2].height);
  await page.screenshot({path:path.join(folder,'panels-wide.png')});checks.push('Parameter above Live above Help, Parameter gets largest share');
  // Long bodies exercise actual wheel scrolling, without touching Shader data.
  await page.evaluate(ids=>{for(const id of ids){const p=document.createElement('div');p.className='scroll-probe';p.style.height='1200px';p.style.flexShrink='0';document.getElementById(id).append(p);}},bodyIds);
  for(let i=0;i<3;i++){
    await page.evaluate(ids=>ids.forEach(id=>document.getElementById(id).scrollTop=0),bodyIds);
    const headerBefore=await rects(),r=await page.locator('#'+bodyIds[i]).boundingBox();await page.mouse.move(r.x+r.width/2,r.y+Math.min(r.height/2,50));await settle();await page.mouse.wheel(0,450);
    await page.waitForFunction(id=>document.getElementById(id).scrollTop>50,bodyIds[i],{polling:100});
    const offsets=await page.evaluate(ids=>ids.map(id=>document.getElementById(id).scrollTop),bodyIds);
    assert.ok(offsets[i]>50);for(let j=0;j<3;j++)if(j!==i)assert.equal(offsets[j],0);
    assert.deepEqual(await rects(),headerBefore);checks.push('independent wheel scrolling with stationary header: '+panelIds[i]);
  }
  await page.evaluate(()=>document.querySelectorAll('.scroll-probe').forEach(p=>p.remove()));
  const fullHeight=(await rects())[0].height;
  await page.locator('#livetoggle').focus();await page.keyboard.press('Space');
  assert.equal(await page.locator('#livetoggle').getAttribute('aria-expanded'),'false');assert.equal(await page.locator('#livebody').isVisible(),false);assert.ok((await rects())[0].height>fullHeight);checks.push('keyboard collapse frees space and hides only its own body');
  const beforePreview=previewRequests;await page.evaluate(async()=>{await preview();await refreshUniforms();});await page.waitForTimeout(650);assert.equal(previewRequests,beforePreview);checks.push('closed Live skips new preview requests, including explicit preview calls');
  await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('#livetoggle').getAttribute('aria-expanded')==='true');assert.ok(previewRequests>beforePreview);checks.push('keyboard reopen fetches current preview');
  for(let mask=0;mask<8;mask++){
    for(let i=0;i<3;i++){const b=page.locator(`[data-panel="${panelIds[i]}"] .panel-heading`),desired=!!(mask&(1<<i));if((await b.getAttribute('aria-expanded')==='true')!==desired)await b.click();}
    const bounds=await page.locator('.details').boundingBox();
    for(let i=0;i<3;i++){
      const r=await page.locator(`[data-panel="${panelIds[i]}"] .panel-heading`).boundingBox();assert.ok(r.y>=bounds.y-.1&&r.y+r.height<=bounds.y+bounds.height+.1,'heading stays reachable');
      assert.equal(await page.locator('#'+bodyIds[i]).isVisible(),!!(mask&(1<<i)));
    }
    if(mask===0){const last=await page.locator('#helptoggle').boundingBox();assert.ok(Math.abs(last.y+last.height-bounds.y-bounds.height)<2);}
  }
  checks.push('all eight collapse combinations keep headings accessible and Help at bottom');
  await page.locator('#livetoggle').click();const countBeforeReload=previewRequests;
  await page.reload();await page.waitForSelector('.node');assert.equal(await page.locator('#livetoggle').getAttribute('aria-expanded'),'false');assert.equal(previewRequests,countBeforeReload);checks.push('collapse preferences persist and closed Live avoids startup PNG');
  await page.locator('#livetoggle').click();await page.locator('[data-node="texture"] .node-title').click();
  for(const viewport of [{width:1280,height:720},{width:420,height:720},{width:360,height:480}]){
    await page.setViewportSize(viewport);await settle();
    if(viewport.width<800&&!await page.locator('.details').isVisible())await page.locator('#toggledetails').click();
    await settle();const bounds=await page.locator('.details').boundingBox();assert.ok(bounds&&bounds.height>100);
    for(const button of ['#parametertoggle','#livetoggle','#helptoggle']){const r=await page.locator(button).boundingBox();assert.ok(r.x>=0&&r.y>=0&&r.x+r.width<=viewport.width+1&&r.y+r.height<=viewport.height+1);}
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await page.screenshot({path:path.join(folder,`panels-${viewport.width}x${viewport.height}.png`)});
  }
  checks.push('three visible headers and no page overflow at 1280x720, 420x720 and 360x480');
  await page.setViewportSize({width:1600,height:1000});await page.locator('#language').selectOption('en');assert.equal(await page.locator('#parametertoggle').innerText(),'Parameter');assert.equal(await page.locator('#helptoggle').innerText(),'Help');checks.push('localized headings and existing content survive language change');
  assert.equal(await page.evaluate(()=>JSON.stringify(graph)),original);assert.equal(await page.evaluate(()=>dirty),false);assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);checks.push('no Shader edits, POST requests or browser errors');
  fs.writeFileSync(path.join(folder,'panel-tests.json'),JSON.stringify({passed:true,count:checks.length,checks},null,2));console.log(JSON.stringify({passed:true,count:checks.length}));
})().catch(e=>{console.error(e);fs.writeFileSync(path.join(folder,'panel-tests.json'),JSON.stringify({passed:false,checks,errors,writes,error:e.message},null,2));process.exitCode=1;}).finally(async()=>{await browser?.close();});
