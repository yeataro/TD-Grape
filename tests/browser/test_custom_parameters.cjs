/* Native snapshots back a deterministic API; browser gestures never edit TD. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const[src,stateFile,sourcesFile,customFile,out]=process.argv.slice(2);fs.mkdirSync(out,{recursive:true});
const read=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,'')),fixture=read(stateFile),sources=read(sourcesFile),custom=read(customFile);
fixture.state.graph=sources.graph;fixture.state.revision=sources.revision;fixture.shaderKind='top';fixture.target=custom.operator;fixture.upgradeReview=null;fixture.readOnlyReason='';fixture.savedStateIssue=null;
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
     const source=[...sources.uniforms,...sources.specConstants].find(r=>r.id===body.id);assert.ok(source);assert.equal(body.sourceExpected,source.expected);
     const existing=custom.controls.find(g=>g.sources.includes(source.id));
     if(existing)place(existing,body.page,body.before);
     else{const name=source.name[0].toUpperCase()+source.name.slice(1).toLowerCase();const row={name,label:source.name,page:body.page,style:source.type==='bool'?'Toggle':'Float',size:source.components.length,order:20,editable:true,menuNames:[],menuLabels:[],sources:[source.id],components:source.components.map((c,i)=>({name:name+i,value:c.value,default:c.value,mode:'CONSTANT',writable:true,enabled:true,readOnly:false,min:0,max:1,normMin:0,normMax:1,clampMin:false,clampMax:false,help:''}))};place(row,body.page,body.before);}
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
  page=await browser.newPage({viewport:{width:1700,height:1100}});page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>localStorage.setItem('sgrapeAutoPreview','false'));
  await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForSelector('.node');await page.selectOption('#language','en');
  await page.evaluate(()=>{clearTimeout(autoTimer);connectionInterrupted=true;readonly=false;dirty=false;customError='';customRetryAt=0;});
  await page.locator('[data-workspace-panel=controls]').click();await page.waitForFunction(()=>customReady());
  const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const idle=async()=>{await page.waitForFunction(()=>!customBusy&&!nativeMutationBusy);await settle();};
  const at=async s=>{const r=await page.locator(s).boundingBox();assert.ok(r,s);return{x:r.x+r.width/2,y:r.y+r.height/2};};
  const drag=async(a,b)=>{await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:12});await page.mouse.up();await idle();};
  const gain=custom.controls.find(g=>g.sources.includes('gain')).name,color=custom.controls.find(g=>g.sources.includes('tint')).name;
  await page.locator('#custompage').getByRole('tab',{name:'Motion',exact:true}).click();
  const field=page.locator('#customcontrols [data-custom-control='+gain+'] [data-control-field=value]');await field.fill('0.7');await field.press('Enter');await idle();assert.equal(custom.controls.find(r=>r.name===gain).components[0].value,.7);
  assert.equal(await page.locator('#customcontrols [data-control-field=label]').count(),0);assert.equal(await page.locator('#customcreate').count(),0);
  await field.fill('0.8');await field.press('Enter');await idle();assert.equal(custom.controls.find(r=>r.name===gain).components[0].value,.8);
  checks.push('Sidebar operates native values and page tabs; definition/add/style editors are absent');
  await page.locator('#custompage').getByRole('tab',{name:'Grape TOP',exact:true}).click();assert.ok(await page.locator('#customcontrols [data-control-field=pulse]').count());assert.ok(await page.locator('#customcontrols [data-custom-control=Version] input').isDisabled());
  await page.locator('#customizeparameters').click();await page.locator('#customdialog').waitFor({state:'visible'});assert.equal(await page.evaluate(()=>$('#customdialog').matches(':modal')),false);
  assert.equal(await page.locator('#customeditorpages [data-custom-page="Grape TOP"]').count(),0);assert.equal(await page.locator('#customeditorpages [data-custom-page="Output"]').count(),0);
  checks.push('Upper-right text button opens a nonmodal editor; protected pages remain operable in sidebar and absent from definition lists');
  const before=await page.locator('#customdialog').boundingBox();await drag(await at('.custom-editor-heading strong'),{x:before.x+180,y:before.y+85});const after=await page.locator('#customdialog').boundingBox();assert.notEqual(Math.round(before.y),Math.round(after.y));
  await page.evaluate(()=>{Object.assign($('#customdialog').style,{left:'720px',top:'180px',right:'auto'});});
  const canvas=await page.locator('#canvas').boundingBox();await page.mouse.click(canvas.x+70,canvas.y+80);await page.keyboard.press('Control+a');assert.ok(await page.evaluate(()=>selection.size>0));assert.ok(await page.locator('#customdialog').isVisible());
  checks.push('Floating window moves by its header; canvas selection shortcuts stay active with it open');
  await page.locator('#custompagecreate input').fill('Performance');await page.locator('#custompagecreate button').click();await idle();assert.ok(custom.pages.some(p=>p.name==='Performance'));
  await page.locator('[data-workspace-panel=uniforms]').click();await page.evaluate(()=>{for(const key of ['uniform','uniform.values'])setInputGroupCollapsed(key,false);renderNativeSources();});await page.waitForSelector('[data-input-source=gain] .input-source-select');
  const count=custom.controls.length,graphBefore=await page.evaluate(()=>JSON.stringify(graph));
  await drag(await at('[data-input-source=gain] .input-source-select'),await at('#customeditorparameters .custom-drop-hint'));
  assert.equal(custom.controls.length,count);assert.equal(custom.controls.find(g=>g.name===gain).page,'Performance');assert.equal(await page.evaluate(()=>JSON.stringify(graph)),graphBefore);
  assert.equal(await page.locator('#customdialog [data-control-field=style]').count(),0);assert.ok((await page.locator('.custom-definition').innerText()).includes('Float'));
  checks.push('Dragging from Sources moves an existing control without duplicating a master or changing graph nodes; Style/Size are display-only');
  const label=page.locator('#customdialog [data-control-field=label]');await label.fill('Gain amount');await label.press('Enter');await idle();await label.blur();
  const def=page.locator('#customdialog [data-control-field=default]').first();await def.fill('0.2');await def.press('Enter');await idle();await def.blur();assert.equal(custom.controls.find(g=>g.name===gain).label,'Gain amount');assert.equal(custom.controls.find(g=>g.name===gain).components[0].default,.2);
  const range=page.locator('#customdialog [data-control-field=normMax]').first();await range.fill('10');await range.press('Enter');await idle();await range.blur();
  assert.equal(custom.controls.find(g=>g.name===gain).components[0].normMax,10);
  await page.locator('#customundo').click();await idle();assert.equal(custom.controls.find(g=>g.name===gain).components[0].normMax,1);
  await page.locator('#customredo').click();await idle();assert.equal(custom.controls.find(g=>g.name===gain).components[0].normMax,10);
  const graphHistory=await page.evaluate(()=>JSON.stringify([past,future]));
  await page.locator('#customundo').focus();await page.keyboard.press('Control+z');await idle();assert.equal(custom.controls.find(g=>g.name===gain).components[0].normMax,1);
  assert.equal(await page.evaluate(()=>JSON.stringify([past,future])),graphHistory);
  await page.locator('#customredo').click();await idle();
  await def.fill('3');await def.press('Enter');await idle();await def.blur();
  assert.equal(await def.evaluate(e=>e.numericRange),undefined);
  const d=await def.boundingBox();await page.mouse.move(d.x+d.width/2,d.y+d.height/2);await page.mouse.down();await page.mouse.move(d.x+d.width/2+60,d.y+d.height/2,{steps:8});await page.mouse.up();await idle();
  assert.ok(custom.controls.find(g=>g.name===gain).components[0].default>3);
  await page.screenshot({path:path.join(out,'parameter-definition.png')});
  checks.push('Range controls and independent history buttons/shortcuts work; ordinary numeric dragging exceeds one without a clamp');
  await drag(await at('[data-input-source=tint] .input-source-select'),await at('#customeditorparameters .custom-drop-hint'));assert.equal(custom.controls.find(g=>g.name===color).page,'Performance');
  await drag(await at('[data-custom-parameter='+color+'] .custom-row-pick'),await at('[data-custom-parameter='+gain+'] .custom-row-pick'));assert.ok(custom.controls.indexOf(custom.controls.find(g=>g.name===color))<custom.controls.indexOf(custom.controls.find(g=>g.name===gain)));
  await drag(await at('[data-custom-parameter='+gain+'] .custom-row-pick'),await at('[data-custom-page=Look] .custom-row-pick'));assert.equal(custom.controls.find(g=>g.name===gain).page,'Look');
  await drag(await at('[data-custom-page=Performance] .custom-row-pick'),await at('[data-custom-page=Look] .custom-row-pick'));assert.ok(custom.pages.findIndex(p=>p.name==='Performance')<custom.pages.findIndex(p=>p.name==='Look'));
  checks.push('Parameter labels/defaults edit independently; actual pointer drags reorder controls, move across pages and reorder user pages');
  await page.locator('[data-custom-page=Performance] .custom-row-pick').click();await idle();
  await page.evaluate(()=>{$('#inputsearch').value='sFloat';$('#inputsearch').dispatchEvent(new Event('input'));});
  await page.waitForSelector('[data-input-source=spec_float] .input-source-select');await drag(await at('[data-input-source=spec_float] .input-source-select'),await at('#customeditorparameters .custom-drop-hint'));assert.ok(custom.controls.some(g=>g.sources.includes('spec_float')));
  checks.push('Specialization constants can be dragged from Sources into native parameter pages');
  const originalRequests=requests.length;const a=await at('[data-input-source=spec_float] .input-source-select'),b=await at('#customeditorparameters .custom-drop-hint');await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:8});await page.keyboard.press('Escape');await page.mouse.up();await idle();assert.equal(requests.length,originalRequests);
  assert.equal(await page.evaluate(()=>customSourceAllowed('not-a-source')),undefined);
  const preRemove=sources.graph.declarations.length;await page.locator('[data-custom-parameter='+custom.controls.find(g=>g.sources.includes('spec_float')).name+'] .custom-row-delete').click();await idle();assert.ok(!custom.controls.some(g=>g.sources.includes('spec_float')));assert.equal(sources.graph.declarations.length,preRemove);
  checks.push('Removing a selected control leaves its source declaration intact');
  checks.push('Escape cancels a source drop without any native mutation');
  await page.locator('#custompage').getByRole('tab',{name:'Performance',exact:true}).click();await page.screenshot({path:path.join(out,'parameter-editor.png')});
  await page.selectOption('#language','zh-Hant');await settle();assert.equal(await page.locator('#custompagecreate button').innerText(),'新增頁面');assert.ok((await page.locator('#customeditorparameters').innerText()).includes('從來源面板'));await page.screenshot({path:path.join(out,'parameter-editor-zh.png')});
  await page.setViewportSize({width:1150,height:800});await page.evaluate(()=>{Object.assign($('#customdialog').style,{left:'350px',top:'100px',width:'500px',height:'570px'});});await settle();
  assert.ok((await page.locator('#customdialog').boundingBox()).height>=330);await page.screenshot({path:path.join(out,'parameter-editor-narrow.png')});
  await page.locator('.custom-editor-heading button').click();await page.setViewportSize({width:900,height:650});await page.evaluate(()=>openCustomEditor());await settle();
  const centered=await page.locator('#customdialog').boundingBox();assert.ok(Math.abs(centered.x+centered.width/2-450)<2);assert.ok(Math.abs(centered.y+centered.height/2-325)<2);assert.ok(centered.y>=0&&centered.y+centered.height<=650);
  const identity=await page.locator('#customeditoroperator').boundingBox(),undo=await page.locator('#customundo').boundingBox();assert.ok(Math.abs(identity.y+identity.height/2-undo.y-undo.height/2)<2);assert.ok(undo.x>identity.x);
  checks.push('Reopening after a smaller viewport centers the window; Undo and Redo share the OP path row');
  for(const theme of ['dark','light']){
   await page.evaluate(theme=>document.documentElement.dataset.uiTheme=theme,theme);await settle();
   const colors=await page.evaluate(()=>({accent:getComputedStyle($('#sourcenotes')).accentColor,minimal:getComputedStyle($('#sourceminimal')).accentColor,title:getComputedStyle($('.custom-editor-heading')).backgroundColor,text:getComputedStyle($('.custom-editor-heading')).color}));
   assert.equal(colors.accent,colors.minimal);assert.notEqual(colors.accent,'auto');assert.notEqual(colors.title,colors.text);
   await page.screenshot({path:path.join(out,'parameter-'+theme+'.png')});
  }
  checks.push('Source checkboxes use the theme accent in both color modes');
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({passed:true,checks,requestCount:requests.length},null,2));console.log(JSON.stringify({passed:true,checks}));
 }catch(e){if(page)await page.screenshot({path:path.join(out,'failure.png')});fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({passed:false,error:e.stack,checks,errors,requests},null,2));throw e;}
 finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
