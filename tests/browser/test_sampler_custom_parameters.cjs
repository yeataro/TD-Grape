/* Native snapshots back a deterministic API; browser gestures never edit TD. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const[src,stateFile,sourcesFile,customFile,out]=process.argv.slice(2);fs.mkdirSync(out,{recursive:true});
const read=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,'')),fixture=read(stateFile),sources=read(sourcesFile),custom=read(customFile);
fixture.state.graph=sources.graph;fixture.state.revision=sources.revision;fixture.shaderKind='mat';fixture.target=custom.operator;fixture.upgradeReview=null;fixture.readOnlyReason='';fixture.savedStateIssue=null;
const template=structuredClone(custom.controls.find(g=>g.sources.includes(custom.samplerSources[0].id)));custom.controls=custom.controls.filter(g=>g!==undefined&&!g.sources.includes(custom.samplerSources[0].id));
const undoStack=[],redoStack=[];const capture=()=>JSON.parse(JSON.stringify({controls:custom.controls,pages:custom.pages}));
let serial=0;const requests=[],checks=[],errors=[];
function refresh(){custom.history={undo:!!undoStack.length,redo:!!redoStack.length,expected:'history-'+serial};custom.expectedPages='pages-'+serial;for(const row of custom.controls)row.expected='control-'+serial+'-'+row.name;for(const p of custom.pages)p.empty=!custom.controls.some(g=>g.page===p.name);}
function place(row,page,before){custom.controls=custom.controls.filter(g=>g!==row);row.page=page;const i=before?custom.controls.findIndex(g=>g.name===before):-1;custom.controls.splice(i<0?custom.controls.length:i,0,row);}
refresh();
const server=http.createServer(async(req,res)=>{try{
 const route=new URL(req.url,'http://localhost').pathname;res.setHeader('Cache-Control','no-store');
 if(route.startsWith('/api/')){
  let raw='';for await(const chunk of req)raw+=chunk;const body=raw?JSON.parse(raw):{},op=route.split('/').at(-1);res.setHeader('Content-Type','application/json');
  if(op==='state')return res.end(JSON.stringify(fixture));if(op==='sources')return res.end(JSON.stringify(sources));
  if(op==='shaders')return res.end(JSON.stringify({projectFile:'Parameter-test.toe',shaders:[]}));
  if(op==='uniforms')return res.end(JSON.stringify({revision:sources.revision,uniforms:{},textures:{}}));
  if(op==='preview'){res.statusCode=204;return res.end();}
  if(op==='custom-parameters'){
   if(req.method==='POST'){
    const saved=capture();requests.push(body);assert.equal(body.revision,custom.revision);const row=custom.controls.find(r=>r.name===body.name);
    if(['page-create','page-rename','page-remove','page-reorder','bind','place'].includes(body.action))assert.equal(body.expectedPages,custom.expectedPages);
    if(['undo','redo'].includes(body.action)){assert.equal(body.expectedHistory,custom.history.expected);const from=body.action==='undo'?undoStack:redoStack,to=body.action==='undo'?redoStack:undoStack;to.push(saved);Object.assign(custom,from.pop());}
    else if(body.action==='page-create')custom.pages.push({name:body.name,editable:true});
    else if(body.action==='page-rename'){custom.pages.find(p=>p.name===body.page).name=body.name;custom.controls.filter(r=>r.page===body.page).forEach(r=>r.page=body.name);}
    else if(body.action==='page-remove')custom.pages=custom.pages.filter(p=>p.name!==body.page);
    else if(body.action==='page-reorder'){const page=custom.pages.find(p=>p.name===body.page);custom.pages=custom.pages.filter(p=>p!==page);const i=custom.pages.findIndex(p=>p.name===body.before);custom.pages.splice(i<0?custom.pages.length:i,0,page);}
    else if(body.action==='bind'){
     const source=[...sources.uniforms,...sources.specConstants,...custom.samplerSources].find(r=>r.id===body.id);assert.ok(source);assert.equal(body.sourceExpected,source.expected);
     const existing=custom.controls.find(g=>g.sources.includes(source.id));
     if(existing)place(existing,body.page,body.before);
     else {const row=structuredClone(template);place(row,body.page,body.before);}
    }else{
     assert.ok(row);assert.equal(body.expected,row.expected);
     if(body.action==='label')row.label=body.label;
     if(body.action==='value'){assert.deepEqual(body.expectedValue,row.components[body.component]);row.components[body.component].value=body.value;}
     if(body.action==='color')body.components.forEach(e=>{assert.deepEqual(e.expectedValue,row.components[e.component]);row.components[e.component].value=e.value;});
     if(body.action==='default')row.components[body.component].default=body.value;
     if(body.action==='range')row.components[body.component][body.field]=body.value;
     if(body.action==='place')place(row,body.page,body.before);
     if(body.action==='remove')custom.controls=custom.controls.filter(r=>r!==row);
    }
    if(!['undo','redo','value','color','pulse'].includes(body.action)){undoStack.push(saved);redoStack.length=0;}serial++;refresh();
   }
   return res.end(JSON.stringify(custom));
  }
  res.statusCode=404;return res.end('{}');
 }
 const file=path.join(src,route==='/'?'index.html':path.basename(route));if(!fs.existsSync(file)){res.statusCode=404;return res.end();}
 res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));
 }catch(e){errors.push(e.stack);res.statusCode=409;res.end(JSON.stringify({error:e.message}));}});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE});let page;
 try{
  page=await browser.newPage({viewport:{width:1600,height:1100}});page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>localStorage.setItem('sgrapeAutoPreview','false'));
  await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>typeof graph!=='undefined'&&!!graph);
  await page.selectOption('#language','en');
  await page.evaluate(()=>{clearTimeout(autoTimer);connectionInterrupted=true;readonly=false;dirty=false;customError='';customRetryAt=0;});
  await page.locator('[data-workspace-panel=controls]').click();await page.waitForFunction(()=>customReady());
  await page.locator('#customizeparameters').click();await page.waitForFunction(()=>!!customSnapshot?.samplerSources?.length);
  await page.evaluate(()=>{Object.assign($('#customdialog').style,{left:'750px',top:'140px',width:'750px',height:'800px'});customEditPage='Motion';renderCustomEditor();});
  await page.locator('[data-workspace-panel=uniforms]').click();
  await page.evaluate(()=>{for(const key of ['sampler','textures'])setInputGroupCollapsed(key,false);renderNativeSources();});
  const id=custom.samplerSources[0].id;
  const from=page.locator('[data-input-source="'+id+'"] .input-source-select');await from.scrollIntoViewIfNeeded();
  const drag=async()=>{const a=await from.boundingBox(),b=await page.locator('#customeditorparameters .custom-drop-hint').boundingBox();await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:20});await page.mouse.up();await page.waitForTimeout(180);};
  const before=await page.evaluate(()=>JSON.stringify(graph));await drag();
  assert(requests.some(r=>r.action==='bind'&&r.id===id));assert.equal(custom.controls.filter(g=>g.sources.includes(id)).length,1);
  assert((await page.locator('.custom-definition').innerText()).includes('TOP'));assert.equal(await page.locator('.custom-definition [data-control-field=normMin]').count(),0);
  assert.equal(await page.locator('.custom-definition [data-control-field=default]').getAttribute('type'),'text');
  assert.equal(await page.evaluate(()=>JSON.stringify(graph)),before);
  await drag();assert.equal(custom.controls.filter(g=>g.sources.includes(id)).length,1);
  checks.push('Real Sources drag creates a TOP path control, repeat drag reuses it, graph unchanged; no numeric ranges or editable Style/Size');
  const input=page.locator('.custom-definition [data-control-field=default]');await input.fill('/project1/image');await input.press('Enter');await input.blur();
  await page.waitForTimeout(180);assert.equal(custom.controls.find(g=>g.sources.includes(id)).components[0].default,'/project1/image');
  await page.locator('[data-custom-parameter="'+template.name+'"] .custom-row-delete').click();await page.waitForTimeout(180);assert(!custom.controls.some(g=>g.sources.includes(id)));
  await page.locator('#customundo').click();await page.waitForTimeout(180);assert(custom.controls.some(g=>g.sources.includes(id)));
  await page.locator('#customredo').click();await page.waitForTimeout(180);assert(!custom.controls.some(g=>g.sources.includes(id)));
  await page.locator('#customundo').click();await page.waitForTimeout(180);
  checks.push('Text default edit and row deletion use the definition API and independent Undo/Redo');
  for(const lang of ['en','zh-Hant']){await page.selectOption('#language',lang);assert((await page.locator('.custom-drop-hint').innerText()).includes('Sampler'));}
  await page.locator('[data-custom-parameter="'+template.name+'"] .custom-row-pick').click();
  for(const theme of ['dark','light']){await page.evaluate(t=>document.documentElement.dataset.uiTheme=t,theme);await page.screenshot({path:path.join(out,'sampler-'+theme+'.png')});}
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({passed:true,checks,requests},null,2));console.log(JSON.stringify({passed:true,checks}));
 }catch(e){if(page)await page.screenshot({path:path.join(out,'failure.png')});throw e;}
 finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
