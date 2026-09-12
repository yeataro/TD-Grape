const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const [src,fixtureFile,sourcesFile,w]=process.argv.slice(2),fixture=JSON.parse(fs.readFileSync(fixtureFile)),sources=JSON.parse(fs.readFileSync(sourcesFile));fs.mkdirSync(w,{recursive:true});
sources.graph=fixture.state.graph;sources.revision=fixture.state.revision;sources.sourceChanged=false;
const editable=sources.uniforms.find(r=>r.id==='gain');editable.components[0].mode='CONSTANT';editable.components[0].writable=true;
let opened=0,writes=0;
const server=http.createServer(async(req,res)=>{
 const route=new URL(req.url,'http://localhost').pathname;
 if(route.startsWith('/api/')){
  let raw='';for await(const chunk of req)raw+=chunk;const body=raw?JSON.parse(raw):{},op=route.split('/').at(-1);res.setHeader('Content-Type','application/json');
  if(op==='state')return res.end(JSON.stringify(fixture));
  if(op==='sources')return res.end(JSON.stringify(sources));
  if(op==='shaders')return res.end(JSON.stringify({projectFile:'Sources-test.toe',shaders:[]}));
  if(op==='uniforms')return res.end(JSON.stringify({revision:sources.revision,uniforms:{},textures:{}}));
  if(op==='preview'){res.statusCode=204;return res.end();}
  if(op==='native-parameters'){opened++;return res.end('{}');}
  if(op==='source-value'){
   const row=sources.uniforms.find(r=>r.id===body.id);assert.equal(body.expected.value,row.components[body.component].value);row.components[body.component].value=body.value;writes++;return res.end(JSON.stringify(sources));
  }
  if(op==='source-edit'&&body.action==='create'){
   sources.revision++;const id='native_added';const decl={id,kind:'uniform',name:body.name,type:body.type,value:0};sources.graph.declarations.push(decl);sources.declarations=sources.graph.declarations;
   sources.uniforms.push({id,name:body.name,type:body.type,missing:false,nameWritable:true,expected:'new',components:'xyzw'.split('').map(c=>({parameter:'vec2value'+c,value:0,mode:'CONSTANT',writable:true}))});return res.end(JSON.stringify(sources));
  }
  res.statusCode=404;return res.end('{}');
 }
 const file=path.join(src,route==='/'?'index.html':path.basename(route));if(!fs.existsSync(file)){res.statusCode=404;return res.end();}
 res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE});const checks=[],errors=[];
 try{
  const page=await browser.newPage({viewport:{width:1560,height:1050}});page.on('pageerror',e=>errors.push(e.message));
  // Existing four-panel personal layouts must gain one peer tab, not reset.
  await page.addInitScript(()=>localStorage.setItem('grapeWorkspaceV1',JSON.stringify({version:1,left:[{panels:['browser'],active:'browser',weight:1}],right:[{panels:['parameters','help'],active:'help',weight:7},{panels:['live'],active:'live',weight:2}],widths:{left:245,right:390}})));
  await page.goto('http://127.0.0.1:'+server.address().port+'/#fixture');await page.waitForSelector('.node');await page.selectOption('#language','en');
  await page.evaluate(()=>{applyGraph=async()=>{clearTimeout(autoTimer);};});
  await page.locator('[data-workspace-panel=uniforms]').click();await page.waitForSelector('[data-native-source=gain]');
  assert.equal(await page.locator('.workspace-group[data-workspace-group=parameters] [data-workspace-panel]').count(),3);
  assert.equal(await page.locator('#nodecount').evaluate(e=>e.closest('#canvas')!==null),true);
  assert.match(await page.locator('#nodecount').innerText(),/nodes/);checks.push('Existing layout retained; Uniforms added as a peer tab; count moved to canvas');
  const value=page.locator('[data-native-source=gain] [data-source-component="0"]');
  await value.fill('0.42');await value.press('Enter');await page.waitForFunction(()=>!nativeSourceBusy);
  assert.equal(writes,1);assert.equal(await value.inputValue(),'0.42');checks.push('Editing a source value calls the native parameter endpoint without Expose');
  await page.locator('#sourceparameters').click();assert.equal(opened,1);checks.push('GLSL native parameter window has a direct entry');
  await page.fill('#sourcename','uAdded');await page.selectOption('#sourcetype','float');await page.locator('#sourcecreate button').click();await page.waitForSelector('[data-native-source=native_added]');
  assert.equal(await page.evaluate(()=>graph.declarations.some(d=>d.name==='uAdded')),true);checks.push('Add Uniform updates the graph source list from the returned native state');
  const row=page.locator('[data-native-source=native_added]');await row.getByRole('button',{name:'Add reference to graph',exact:true}).click();
  assert.equal(await page.evaluate(()=>current().nodes.some(n=>n.params.declarationId==='native_added')),true);checks.push('Graph reference uses the existing source definition');
  await page.evaluate(()=>{clearTimeout(autoTimer);dirty=false;});
  await page.selectOption('#language','zh-Hant');
  await page.screenshot({path:path.join(w,'uniforms-panel.png')});
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(w,'browser-result.json'),JSON.stringify({passed:true,checks},null,2));console.log(JSON.stringify({passed:true,checks}));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
