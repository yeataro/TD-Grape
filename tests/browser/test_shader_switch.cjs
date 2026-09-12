// Isolated browser fixture exercises navigation and draft handling; never writes to TD.
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const [source,snapshotFile,reportDir,overlay]=process.argv.slice(2),original=JSON.parse(fs.readFileSync(snapshotFile,'utf8').replace(/^\uFEFF/,''));
const ids=['a'.repeat(32),'b'.repeat(32)],states={},checks=[],errors=[];let failApply=false,applyDelay=0,menuDelay=0,applies=0;
for(const [i,id]of ids.entries()){const s=structuredClone(original);s.state.graph.target=i?'top':'mat';if(i)delete s.state.graph.stages.vertex;s.target='/project1/Sgrape_'+(i?'TOP1':'MAT1');states[id]=s;}
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost'),parts=url.pathname.split('/').filter(Boolean);res.setHeader('Cache-Control','no-store');
  if(parts[0]==='api'){
    res.setHeader('Content-Type','application/json');if(req.headers['x-sgrape-token']!=='fixture-token'){res.statusCode=401;return res.end('{"error":"Token missing"}');}
    const state=states[parts[1]],op=parts[2];if(!state){res.statusCode=404;return res.end('{}');}
    let text='';for await(const chunk of req)text+=chunk;const body=text?JSON.parse(text):null;
    if(op==='state')return res.end(JSON.stringify(state));
    if(op==='shaders'){if(menuDelay)await new Promise(r=>setTimeout(r,menuDelay));return res.end(JSON.stringify({shaders:ids.map((id,i)=>({id,path:states[id].target,kind:i?'top':'mat',readOnlyReason:''}))}));}
    if(op==='uniforms')return res.end(JSON.stringify({revision:state.state.revision,uniforms:{},textures:{}}));
    if(op==='inspect')return res.end(JSON.stringify({status:'valid',candidate:body.graph,issues:[],repairs:[]}));
    if(op==='apply'){
      applies++;if(applyDelay)await new Promise(r=>setTimeout(r,applyDelay));if(failApply){res.statusCode=422;return res.end('{"error":"Fixture compile failed"}');}
      state.state.graph=body.graph;state.state.revision++;return res.end(JSON.stringify({state:state.state,target:state.target}));
    }
    if(op==='preview'){res.setHeader('Content-Type','image/png');return res.end(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8xkAAAAASUVORK5CYII=','base64'));}
    res.statusCode=404;return res.end('{}');
  }
  const file=parts[0]==='shader'||!parts.length?'index.html':parts[0];
  if(!/^[a-z0-9_.-]+$/i.test(file)){res.statusCode=404;return res.end();}
  const target=overlay&&fs.existsSync(path.join(overlay,file))?path.join(overlay,file):path.join(source,file);
  if(!fs.existsSync(target)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml'})[path.extname(file)]||'text/plain');res.end(fs.readFileSync(target));
});
let browser;
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE});const context=await browser.newContext({viewport:{width:1440,height:900}}),page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));let dialogs=[],acceptDraft=false;
  page.on('dialog',async d=>{dialogs.push({type:d.type(),message:d.message()});if(d.type()==='beforeunload'){errors.push('Unexpected beforeunload');await d.accept();}else if(acceptDraft)await d.accept();else await d.dismiss();});
  const ready=async id=>{await page.waitForURL(origin+'/shader/'+id+'/');await page.waitForFunction(()=>graph&&document.querySelector('#shaderpicker').disabled===false);};
  const choose=async id=>{await page.locator('#shaderpicker').click();await page.locator(`[data-shader="${id}"]`).click();};
  const edit=async()=>page.evaluate(()=>{change(()=>current().nodes[0].ui.x+=24);clearTimeout(autoTimer);autoTimer=null;});
  await page.goto(origin+'/shader/'+ids[0]+'/#fixture-token');await ready(ids[0]);
  await page.locator('#shaderpicker').click();await page.waitForSelector('#shaderchoices button');assert.equal(await page.locator('#shaderchoices button').count(),2);assert.equal(await page.locator('[data-shader="'+ids[0]+'"]').getAttribute('aria-checked'),'true');
  await page.screenshot({path:path.join(reportDir,'shader-menu.png')});await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');await ready(ids[1]);
  assert.equal(await page.evaluate(()=>editorTarget),'top');assert.equal(await page.evaluate(()=>sessionStorage.getItem('sgrapeToken')),'fixture-token');assert.equal(new URL(page.url()).origin,origin);checks.push('keyboard menu switches MAT to TOP using the same origin and tab token');
  const initial=applies;await choose(ids[0]);await ready(ids[0]);assert.equal(applies,initial);checks.push('clean switch has no graph write');
  await edit();const draft=await page.evaluate(()=>JSON.stringify(graph));await choose(ids[1]);assert.equal(await page.locator('#shaderswitch').isVisible(),true);
  await page.locator('#switchcancel').click();assert.equal(await page.evaluate(()=>JSON.stringify(graph)),draft);assert.ok(page.url().includes(ids[0]));checks.push('cancel retains current draft and Shader');
  await choose(ids[1]);const beforeKeep=applies;await page.locator('#switchkeep').click();await ready(ids[1]);assert.equal(applies,beforeKeep);assert.equal(await page.evaluate(id=>JSON.stringify(JSON.parse(sessionStorage.getItem('sgrapeDraft:'+id)).graph),ids[0]),draft);checks.push('keep draft switches without applying or dropping draft');
  acceptDraft=true;await choose(ids[0]);await ready(ids[0]);await page.waitForFunction(()=>importReview?.candidate);assert.equal(await page.evaluate(()=>JSON.stringify(importReview.candidate)),draft);assert.equal(applies,beforeKeep);await page.locator('#closeimport').click();acceptDraft=false;checks.push('return offers draft through existing review, without automatic overwrite');
  await page.evaluate(()=>sessionStorage.removeItem(draftKey));await edit();await choose(ids[1]);failApply=true;await page.locator('#switchapply').click();await page.waitForFunction(()=>document.querySelector('#switchstatus').textContent.includes('Fixture compile failed'));
  assert.ok(page.url().includes(ids[0]));assert.equal(await page.evaluate(()=>dirty),true);checks.push('failed Apply and switch stays on the original draft');
  failApply=false;await page.locator('#switchapply').click();await ready(ids[1]);assert.equal(await page.evaluate(id=>sessionStorage.getItem('sgrapeDraft:'+id),ids[0]),null);checks.push('successful Apply and switch clears the applied draft before navigation');
  await choose(ids[0]);await ready(ids[0]);await edit();await choose(ids[1]);
  await page.evaluate(()=>{window.realSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k.startsWith('sgrapeDraft'))throw Error('Quota');return window.realSetItem.call(this,k,v);};});
  await page.locator('#switchkeep').click();assert.equal(await page.locator('#shaderswitch').isVisible(),true);assert.ok((await page.locator('#switchstatus').innerText()).length>0);assert.ok(page.url().includes(ids[0]));
  await page.evaluate(()=>Storage.prototype.setItem=window.realSetItem);await page.locator('#switchkeep').click();await ready(ids[1]);checks.push('storage failure prevents leaving the draft');
  states[ids[0]].state.revision++;acceptDraft=true;await choose(ids[0]);await ready(ids[0]);await page.waitForFunction(()=>importReview?.candidate);assert.ok(dialogs.at(-1).message.includes('TD'));assert.equal(await page.evaluate(()=>dirty),false);await page.locator('#closeimport').click();acceptDraft=false;checks.push('stale-revision draft remains reviewable without overwriting newer TD state');
  await page.evaluate(()=>sessionStorage.removeItem(draftKey));menuDelay=200;await page.locator('#shaderpicker').click();await page.locator('#status').click();await page.waitForTimeout(250);assert.equal(await page.locator('#shaderchoices').isVisible(),false);menuDelay=0;checks.push('late discovery response cannot reopen a dismissed menu');
  await page.locator('#shaderpicker').focus();await page.keyboard.press('ArrowDown');await page.waitForSelector('#shaderchoices button');await page.keyboard.press('Tab');assert.equal(await page.locator('#creator').isVisible(),false);assert.equal(await page.locator('#shaderchoices').isVisible(),false);checks.push('menu keyboard handling does not invoke graph Creator');
  applyDelay=500;await edit();await page.evaluate(()=>{void applyGraph();});await page.waitForFunction(()=>submitBusy);await choose(ids[1]);assert.ok(page.url().includes(ids[0]));await page.waitForFunction(()=>!submitBusy);applyDelay=0;checks.push('pending apply prevents navigation race');
  await page.keyboard.press('Escape');await page.setViewportSize({width:420,height:720});await page.locator('#shaderpicker').click();await page.waitForSelector('#shaderchoices button');const menu=await page.locator('#shaderchoices').boundingBox();assert.ok(menu.x>=0&&menu.x+menu.width<=420);await page.screenshot({path:path.join(reportDir,'shader-menu-small.png')});checks.push('path menu fits narrow viewport');
  assert.deepEqual(errors,[]);assert.equal(dialogs.some(d=>d.type==='beforeunload'),false);checks.push('no browser errors or duplicate navigation confirmations');
  fs.writeFileSync(path.join(reportDir,'switch-browser-tests.json'),JSON.stringify({passed:true,count:checks.length,checks},null,2));console.log(JSON.stringify({passed:true,count:checks.length}));
})().catch(e=>{console.error(e);fs.writeFileSync(path.join(reportDir,'switch-browser-tests.json'),JSON.stringify({passed:false,checks,errors,error:e.message},null,2));process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});
