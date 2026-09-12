const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.GRAPE_PLAYWRIGHT||'playwright');
const [src,stateFile,sourcesFile,customFile,w]=process.argv.slice(2);if(!w)throw Error('Usage: node test_custom_parameters.cjs src state.json sources.json controls.json output');fs.mkdirSync(w,{recursive:true});const fixture=JSON.parse(fs.readFileSync(stateFile)),sources=JSON.parse(fs.readFileSync(sourcesFile)),custom=JSON.parse(fs.readFileSync(customFile));
sources.graph=fixture.state.graph;sources.revision=fixture.state.revision;sources.sourceChanged=false;custom.revision=sources.revision;
let serial=0;const requests=[];
function refresh(){custom.expectedPages='pages-'+serial;for(const row of custom.controls)row.expected='control-'+serial;}
refresh();
const server=http.createServer(async(req,res)=>{
 const route=new URL(req.url,'http://localhost').pathname;
 if(route.startsWith('/api/')){
  let raw='';for await(const chunk of req)raw+=chunk;const body=raw?JSON.parse(raw):{},op=route.split('/').at(-1);res.setHeader('Content-Type','application/json');
  if(op==='state')return res.end(JSON.stringify(fixture));
  if(op==='sources')return res.end(JSON.stringify(sources));
  if(op==='shaders')return res.end(JSON.stringify({projectFile:'Controls-test.toe',shaders:[]}));
  if(op==='uniforms')return res.end(JSON.stringify({revision:sources.revision,uniforms:{},textures:{}}));
  if(op==='preview'){res.statusCode=204;return res.end();}
  if(op==='custom-parameters'){
   if(req.method==='POST'){
    requests.push(body);assert.equal(body.revision,custom.revision);
    const row=custom.controls.find(r=>r.name===body.name);
    if(body.action==='page-create'){assert.equal(body.expectedPages,custom.expectedPages);custom.pages.push({name:body.name,editable:true});}
    else if(body.action==='create'||body.action==='bind'){
     const source=sources.uniforms.find(r=>r.id===body.id),name=body.action==='bind'?'Urenamed':body.name;
     custom.controls.push({name,label:name,page:body.page,style:body.style==='rgba'?'RGBA':'Float',size:body.style==='rgba'?4:1,order:10,components:Array.from({length:body.style==='rgba'?4:1},(_,i)=>({name:name+i,value:0,default:0,mode:'CONSTANT',writable:true})),sources:source?[source.id]:[],styleEditable:body.style==='rgba'});
    }else{
     assert.ok(row);assert.equal(body.expected,row.expected);
     if(body.action==='label')row.label=body.label;
     if(body.action==='value'){assert.deepEqual(body.expectedValue,row.components[body.component]);row.components[body.component].value=body.value;}
     if(body.action==='default')row.components[body.component].default=body.value;
     if(body.action==='page')row.page=body.page;
     if(body.action==='detach')row.sources=[];
     if(body.action==='remove')custom.controls=custom.controls.filter(r=>r!==row);
     if(body.action==='style')row.style=body.style==='rgba'?'RGBA':'Float';
    }
    serial++;refresh();
   }
   return res.end(JSON.stringify(custom));
  }
  res.statusCode=404;return res.end('{}');
 }
 const file=path.join(src,route==='/'?'index.html':path.basename(route));if(!fs.existsSync(file)){res.statusCode=404;return res.end();}
 res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,...(process.env.GRAPE_BROWSER?{executablePath:process.env.GRAPE_BROWSER}:{})});const checks=[],errors=[];
 try{
  const page=await browser.newPage({viewport:{width:1560,height:1050}});page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>localStorage.setItem('grapeWorkspaceV1',JSON.stringify({version:1,left:[{panels:['browser'],active:'browser',weight:1}],right:[{panels:['parameters','help','uniforms'],active:'help',weight:7},{panels:['live'],active:'live',weight:2}],widths:{left:245,right:420}})));
  await page.goto('http://127.0.0.1:'+server.address().port+'/#fixture');await page.waitForSelector('.node');await page.selectOption('#language','en');
  await page.locator('[data-workspace-panel=controls]').click();await page.waitForFunction(()=>customSnapshot?.controls.length>0);await page.selectOption('#custompage','Animation');
  assert.equal(await page.locator('.workspace-group[data-workspace-group=parameters] [data-workspace-panel]').count(),4);
  assert.equal(await page.locator('[data-parameter-scope]').count(),0);checks.push('Existing layout keeps its groups; custom controls are peer tools, separate from node parameters');
  const row=page.locator('[data-custom-control=Unbound]');await row.waitFor();
  const label=row.locator('[data-control-field=label]');await label.fill('Motion amount');await label.press('Enter');await page.waitForFunction(()=>!customBusy);
  const value=row.locator('[data-control-field=value]').first();await value.fill('0.7');await value.press('Enter');await page.waitForFunction(()=>!customBusy);
  await row.locator('summary').click();const def=row.locator('[data-control-field=default]').first();await def.fill('0.3');await def.press('Enter');await page.waitForFunction(()=>!customBusy);
  assert.equal(custom.controls.find(c=>c.name==='Unbound').components[0].value,.7);assert.equal(custom.controls.find(c=>c.name==='Unbound').components[0].default,.3);
  checks.push('Label, current values and defaults are independent native requests with conflict snapshots');
  await row.locator('[data-control-field=style]').selectOption('rgba');await page.waitForFunction(()=>!customBusy);assert.equal(custom.controls.find(c=>c.name==='Unbound').style,'RGBA');
  checks.push('Four-component controls offer Vector/RGBA presentation without graph type edits');
  await page.locator('#customnewpage').click();await page.locator('#customdialog input').fill('Performance');await page.locator('#customdialog').getByRole('button',{name:'Save',exact:true}).click();await page.waitForFunction(()=>!customBusy&&!document.querySelector('#customdialog').open);
  assert.equal(await page.locator('#custompage').inputValue(),'Performance');
  await page.fill('#customname','Speed');await page.selectOption('#customstyle','float');await page.locator('#customcreate button').click();await page.locator('[data-custom-control=Speed]').waitFor();checks.push('Pages and unbound controls can be created independently of graph sources');
  await page.locator('[data-workspace-panel=uniforms]').click();const gain=page.locator('[data-native-source=gain]');await gain.waitFor();await gain.locator('[data-source-custom]').click();await page.locator('#customdialog').waitFor({state:'visible'});await page.locator('#customdialog select').selectOption('Performance');await page.locator('#customdialog').getByRole('button',{name:'Add control',exact:true}).click();await page.locator('[data-custom-control=Urenamed]').waitFor();
  assert.ok(custom.controls.find(g=>g.name==='Urenamed').sources.includes('gain'));checks.push('Adding a Uniform control chooses a COMP page and reveals the peer editor');
  await page.locator('[data-custom-control=Urenamed]').getByRole('button',{name:'Detach',exact:true}).click();await page.waitForFunction(()=>!customBusy);assert.deepEqual(custom.controls.find(g=>g.name==='Urenamed').sources,[]);checks.push('Detach retains the control in its page');
  await page.selectOption('#language','zh-Hant');await page.selectOption('#custompage','Animation');await page.waitForFunction(()=>document.querySelector('[data-custom-control=Unbound]'));
  await page.screenshot({path:path.join(w,'custom-controls-panel.png')});
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(w,'browser-result.json'),JSON.stringify({passed:true,checks,requestCount:requests.length},null,2));console.log(JSON.stringify({passed:true,checks}));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
