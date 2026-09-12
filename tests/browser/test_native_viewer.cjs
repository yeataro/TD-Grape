const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const [source,fixturePath,w]=process.argv.slice(2);fs.mkdirSync(w,{recursive:true});const fixture=JSON.parse(fs.readFileSync(fixturePath,'utf8'));
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE}),checks=[],errors=[];let page;
try{for(const host of ['127.0.0.1','100.64.0.2','192.168.50.2','127.0.0.1.example.test']){
 const context=await browser.newContext({viewport:{width:1700,height:1000}}),requests=[];let fail=false;
 await context.route('**/*',async route=>{const req=route.request(),url=new URL(req.url()),name=url.pathname;if(name.startsWith('/api/')){const operation=name.split('/').at(-1);if(req.method()==='POST')requests.push({operation,body:req.postDataJSON()});if(operation==='state')return route.fulfill({json:fixture});if(operation==='uniforms')return route.fulfill({json:{revision:fixture.state.revision,uniforms:{},textures:{}}});if(operation==='native-viewer')return route.fulfill({status:fail?503:200,json:fail?{error:'Test TD is busy'}:{opened:true,target:fixture.target}});return route.fulfill({status:404,json:{error:'Fixture endpoint unavailable'}});}const file=path.join(source,name.startsWith('/shader/')?'index.html':path.basename(name));if(!fs.existsSync(file))return route.fulfill({status:404,body:''});return route.fulfill({contentType:({'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json'})[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(file)});});
 page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('http://'+host+':8767/shader/'+'a'.repeat(32)+'/#fixture');await page.waitForSelector('.node');await page.selectOption('#language','en');await page.evaluate(()=>workspaceLayout.reveal('live'));
 const button=page.getByRole('button',{name:'Open this Grape COMP in a TouchDesigner floating viewer',exact:true});
 if(host==='127.0.0.1'){
  assert(await button.isVisible());assert(await button.isEnabled());assert.equal(requests.length,0);checks.push('Local entry is visible and does not open a window automatically');
  for(let i=0;i<2;i++){await button.click();await page.waitForFunction(()=>!nativeViewerOpening);}
  assert.equal(requests.length,2);assert(requests.every(r=>r.operation==='native-viewer'&&r.body.editorOrigin==='http://127.0.0.1:8767'));assert.match(await page.locator('#status').innerText(),/viewer opened/);checks.push('Clicks send only the current Shader viewer action and actual browser origin');
  fail=true;await button.click();await page.waitForFunction(()=>!nativeViewerOpening);assert.equal(await page.locator('#status').innerText(),'Test TD is busy');assert(await button.isEnabled());checks.push('Failed native request leaves the button retryable and graph untouched');
  await page.selectOption('#language','zh-Hant');assert.equal(await page.locator('#nativeviewer').innerText(),'開啟 Viewer');await page.screenshot({path:path.join(w,'native-viewer.png')});checks.push('Viewer entry is localized');
 }else{assert(await page.locator('#nativeviewer').isHidden());await page.evaluate(()=>document.querySelector('#nativeviewer').onclick());assert.equal(requests.length,0);checks.push(host+': remote entry hidden and handler does not send requests');}
 assert.deepEqual(await page.evaluate(()=>graph),fixture.state.graph);await context.close();
}
assert.deepEqual(errors,[]);fs.writeFileSync(path.join(w,'browser-result.json'),JSON.stringify({passed:true,checks},null,2));console.log(JSON.stringify({passed:true,count:checks.length}));
}catch(e){if(page&&!page.isClosed())await page.screenshot({path:path.join(w,'browser-failure.png')});throw e;}finally{await browser.close();}})().catch(e=>{console.error(e.stack);process.exitCode=1;});
