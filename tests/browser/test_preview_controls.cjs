// Live shared-preview regression: node test_preview_controls.cjs SESSION_JSON REPORT_DIR
// Exercises real UI controls; only remote-preview POSTs are allowed.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const [sessionFile,folder]=process.argv.slice(2),session=JSON.parse(fs.readFileSync(sessionFile,'utf8'));
fs.mkdirSync(folder,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE});
 const checks=[],errors=[],writes=[];let snapshots=0;
 try{
  const context=await browser.newContext({viewport:{width:1500,height:1040}});
  await context.route('**/*',route=>{
   const request=route.request(),url=new URL(request.url());
   if(url.pathname.endsWith('/preview'))snapshots++;
   if(request.method()!=='GET'&&!url.pathname.endsWith('/remote-preview')){writes.push(url.pathname);return route.abort();}
   return route.continue();
  });
  const open=async()=>{const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(session.url);return page;};
  const connected=page=>page.waitForFunction(()=>document.querySelector('#preview').state==='connected'&&document.querySelector('#preview').shadowRoot.querySelector('video').videoWidth>0);
  const first=await open();await connected(first);
  const source=await first.locator('#previewpath').innerText();assert.ok(source.startsWith('/'));
  assert.equal(snapshots,0);checks.push('actual video and source path replace PNG polling');
  await first.locator('#autopreview').click();
  await first.waitForFunction(()=>document.querySelector('#preview').state==='disconnected');
  await first.reload();await first.waitForSelector('.node');
  assert.equal(await first.locator('#autopreview').getAttribute('aria-pressed'),'false');
  await first.locator('#refreshpreview').click();await connected(first);
  checks.push('disconnect preference persists and explicit reconnect re-enables preview');
  const second=await open();await connected(second);
  await first.waitForFunction(()=>document.querySelector('#preview').state==='replaced');
  await first.bringToFront();await first.locator('#fit').click();
  assert.equal(await first.locator('#preview').evaluate(e=>e.state),'replaced');
  await first.locator('#refreshpreview').click();await connected(first);
  await second.waitForFunction(()=>document.querySelector('#preview').state==='replaced');
  checks.push('latest tab takes over; returning to an old tab does not reclaim it');
  const connection=await first.locator('#preview').evaluate(e=>e.state);
  await first.locator('#language').selectOption('en');
  assert.equal(await first.locator('#preview').evaluate(e=>e.state),connection);
  await first.locator('#resize-live').press('Home');await connected(first);
  const fits=await first.locator('#preview').evaluate(e=>{const b=e.getBoundingClientRect(),p=e.closest('#livebody').getBoundingClientRect();return b.top>=p.top&&b.bottom<=p.bottom;});
  assert.ok(fits);checks.push('docking rebuild and panel resizing retain video within the pane');
  // Host dividers consume pointerup at Window capture. Hold the drag long enough
  // to catch accidental live resize and a lost release event.
  const panel=first.locator('#preview');
  await first.waitForTimeout(700);
  const oldSize=await panel.evaluate(e=>e.style.aspectRatio);
  const track=await panel.evaluate(e=>e.shadowRoot.querySelector('video').srcObject.getVideoTracks()[0].id);
  const divider=await first.locator('#resize-live').boundingBox();
  await first.mouse.move(divider.x+divider.width/2,divider.y+divider.height/2);
  await first.mouse.down();
  await first.mouse.move(divider.x+divider.width/2,divider.y+divider.height/2+48,{steps:8});
  await first.waitForTimeout(700);
  assert.equal(await panel.evaluate(e=>e.style.aspectRatio),oldSize);
  await first.mouse.up();
  await first.waitForFunction(previous=>document.querySelector('#preview').style.aspectRatio!==previous,oldSize);
  await connected(first);
  assert.equal(await panel.evaluate(e=>e.shadowRoot.querySelector('video').srcObject.getVideoTracks()[0].id),track);
  checks.push('divider hold keeps capture size; release updates size without replacing the video track');
  await first.screenshot({path:path.join(folder,'live-preview.png')});
  await first.locator('#autopreview').click();
  assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);assert.equal(snapshots,0);
  fs.writeFileSync(path.join(folder,'preview-tests.json'),JSON.stringify({passed:true,checks},null,2));
  console.log(JSON.stringify({passed:true,count:checks.length}));
 }catch(error){fs.writeFileSync(path.join(folder,'preview-tests.json'),JSON.stringify({passed:false,checks,errors,error:error.message},null,2));throw error;}
 finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
