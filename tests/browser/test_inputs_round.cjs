const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const [src,fixtureFile,sourcesFile,w]=process.argv.slice(2),fixture=JSON.parse(fs.readFileSync(fixtureFile)),sources=JSON.parse(fs.readFileSync(sourcesFile));fs.mkdirSync(w,{recursive:true});
sources.graph=fixture.state.graph;sources.revision=fixture.state.revision;sources.sourceChanged=false;
const editable=sources.uniforms.find(r=>r.id==='gain');editable.components[0].mode='CONSTANT';editable.components[0].writable=true;
let writes=0;
const server=http.createServer(async(req,res)=>{
 const route=new URL(req.url,'http://localhost').pathname;
 if(route.startsWith('/api/')){
  let raw='';for await(const chunk of req)raw+=chunk;const body=raw?JSON.parse(raw):{},op=route.split('/').at(-1);res.setHeader('Content-Type','application/json');
  if(op==='state')return res.end(JSON.stringify(fixture));
  if(op==='sources')return res.end(JSON.stringify(sources));
  if(op==='apply'){
   assert.equal(body.revision,sources.revision);sources.revision++;sources.graph=body.graph;sources.declarations=body.graph.declarations;
   for(const d of sources.declarations.filter(d=>d.kind==='uniform'))if(!sources.uniforms.some(r=>r.id===d.id))sources.uniforms.push({id:d.id,name:d.name,type:d.type,missing:false,nameWritable:true,expected:d.id,components:[0,1,2,3].map(i=>({parameter:'test'+i,value:Array.isArray(d.value)?d.value[i]||0:d.value,mode:'CONSTANT',writable:true}))});
   fixture.state={graph:body.graph,revision:sources.revision};return res.end(JSON.stringify({state:fixture.state,target:fixture.target}));
  }
  if(op==='shaders')return res.end(JSON.stringify({projectFile:'Sources-test.toe',shaders:[]}));
  if(op==='uniforms')return res.end(JSON.stringify({revision:sources.revision,uniforms:{},textures:{}}));
  if(op==='preview'){res.statusCode=204;return res.end();}
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
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE}),errors=[];
 try {
  const page=await browser.newPage({viewport:{width:1450,height:1000},hasTouch:true});page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/#fixture');await page.waitForSelector('.node');await page.selectOption('#language','en');
  await page.evaluate(()=>{applyGraph=async()=>{clearTimeout(autoTimer);};});
  await page.locator('[data-workspace-panel=uniforms]').click();
  assert.equal(await page.locator('#sourcecreate').isVisible(),false);
  assert.equal(await page.locator('#uniformsbody .inputs-create').count(),0);
  assert.equal(await page.locator('#nativeuniforms [data-input-source=input0]').count(),1);
  assert.equal(await page.locator('[data-input-create=sampler]').count(),0);
  assert.equal(await page.locator('[data-input-group=constant] .input-group-toggle').count(),0);
  await page.locator('[data-input-create=constant]').click();const beforeCancel=await page.evaluate(()=>JSON.stringify(graph));await page.fill('#sourcename','cCancel');await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>JSON.stringify(graph)),beforeCancel);
  await page.locator('[data-input-create=constant]').click();await page.fill('#sourcename','gl_invalid');await page.locator('#sourcecreate button[type=submit]').click();assert.ok(await page.locator('#sourcecreateerror').innerText());assert.equal(await page.evaluate(()=>JSON.stringify(graph)),beforeCancel);
  await page.fill('#sourcename','cGain');await page.locator('#sourcecreate button[type=submit]').click();
  assert.ok(await page.locator('.input-inspector-title').isVisible());
  const id=await page.evaluate(()=>graph.declarations.find(d=>d.name==='cGain').id);
  await page.locator('[data-input-group=constant] .input-group-toggle').click();assert.equal(await page.locator('#input-group-constant').isVisible(),false);
  await page.evaluate(()=>{$('#nativeuniforms').dataset.sourceStructure='';renderNativeSources();});assert.equal(await page.locator('#input-group-constant').isVisible(),false);
  await page.fill('#inputsearch','cGain');assert.equal(await page.locator('[data-input-source="'+id+'"]').isVisible(),true);await page.fill('#inputsearch','');assert.equal(await page.locator('#input-group-constant').isVisible(),false);
  await page.locator('[data-input-create=constant]').click();await page.fill('#sourcename','cOther');await page.locator('#sourcecreate button[type=submit]').click();assert.equal(await page.locator('#input-group-constant').isVisible(),true);
  await page.locator('[data-input-create=uniform]').click();await page.selectOption('#sourcekind','preset:time');await page.locator('#sourcecreate button[type=submit]').click();const clock=await page.evaluate(()=>({id:selectedInputId,graph:JSON.stringify(graph),history:past.length}));
  await page.locator('[data-input-create=uniform]').click();await page.selectOption('#sourcekind','preset:time');assert.equal(await page.locator('#sourcename').isDisabled(),true);await page.locator('#sourcecreate button[type=submit]').click();assert.deepEqual(await page.evaluate(()=>({id:selectedInputId,graph:JSON.stringify(graph),history:past.length})),clock);
  await page.evaluate(id=>selectInputSource(id),id);
  await page.locator('#inspector [data-input-reference]').click();
  assert.equal(await page.evaluate(()=>current().nodes.filter(n=>definition(n)?.key==='constant').length),1);
  assert.ok(await page.locator('.node').filter({hasText:'cGain'}).count());
  const canvas=await page.locator('#canvas').boundingBox(),drop={x:canvas.x+canvas.width*.6,y:canvas.y+canvas.height*.5};
  await page.evaluate(({x,y})=>openCreator(x,y),drop);await page.fill('#createsearch','cGain');await page.locator('[data-create-entry="input:'+id+'"]').click();
  assert.equal(await page.evaluate(id=>sourceReferences(id).length,id),2);
  await page.evaluate(id=>selectInputSource(id),id);await page.locator('#inspector .danger').click();
  assert.equal(await page.evaluate(id=>graph.declarations.find(d=>d.id===id).sourceMissing,id),true);
  assert.ok(await page.locator('#inspector .danger').filter({hasText:'Restore'}).count());await page.locator('#inspector .danger').click();
  await page.locator('[data-input-create=top_input]').click();assert.equal(await page.locator('#sourcename').isDisabled(),true);await page.locator('#sourcecreate button[type=submit]').click();
  assert.equal(await page.evaluate(()=>graph.topInputs.length),2);
  const slot=await page.evaluate(()=>graph.topInputs[1].id);
  await page.locator('#nativeuniforms [data-input-reference="'+slot+'"]').click();
  assert.equal(await page.evaluate(id=>current().nodes.filter(n=>n.params.inputId===id).length,slot),1);
  // Reference copying preserves shared slot identity in the same Shader.
  await page.context().grantPermissions(['clipboard-read','clipboard-write']);await page.locator('#graphcopy').click();await page.locator('#graphpaste').click();await page.waitForFunction(id=>current().nodes.filter(n=>n.params.inputId===id).length===2,slot);
  assert.equal(await page.evaluate(()=>graph.topInputs.length),2);
  assert.equal(await page.evaluate(id=>current().nodes.filter(n=>n.params.inputId===id).length,slot),2);
  await page.evaluate(id=>selectInputSource(id),slot);assert.equal(await page.locator('#inspector .danger').isDisabled(),true);
  // Both Inputs and node palette use pointer drags. One drop creates one node.
  const drag=async(handle,touch)=>{const b=await handle.boundingBox(),before=await page.evaluate(()=>current().nodes.length);if(touch){const cdp=await page.context().newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+b.width/2,y:b.y+b.height/2,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:drop.x,y:drop.y,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();}else{await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(drop.x,drop.y,{steps:10});await page.mouse.up();}assert.equal(await page.evaluate(()=>current().nodes.length),before+1);};
  await drag(page.locator('#nativeuniforms [data-input-source="'+slot+'"] .input-source-select'),false);
  await drag(page.locator('#nativeuniforms [data-input-reference="'+slot+'"]'),true);
  await page.locator('[data-workspace-panel=browser]').click();await page.fill('#search','Add');
  await drag(page.locator('[data-add-entry=add]').first(),false);await drag(page.locator('[data-add-entry=add]').first(),true);
  await page.evaluate(({x,y})=>openCreator(x,y),drop);await page.fill('#createsearch','sTD2DInputs[1]');assert.ok(await page.locator('[data-create-entry="input:'+slot+'"]').count());await page.evaluate(()=>closeCreator());
  await page.locator('[data-workspace-panel=uniforms]').click();await page.selectOption('#language','zh-Hant');await page.screenshot({path:path.join(w,'top-inputs.png')});
  await page.locator('[data-input-group=constant] .input-group-toggle').click();const saved=await page.evaluate(()=>JSON.stringify(graph));await page.evaluate(()=>api('apply',{graph,revision}));await page.reload();await page.waitForSelector('.node');await page.locator('[data-workspace-panel=uniforms]').click();assert.equal(await page.locator('#input-group-constant').isVisible(),false);assert.equal(await page.evaluate(()=>JSON.stringify(graph)),saved);
  assert.deepEqual(errors,[]);console.log('Inputs category dialogs, cancel/invalid names, collapse/search/reload, clock reuse without graph edits, named constants, TOP references, clipboard, delete/restore, mouse row and touch handle drags passed');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
