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
  if(op==='apply'){
   assert.equal(body.revision,sources.revision);sources.revision++;sources.graph=body.graph;sources.declarations=body.graph.declarations;
   for(const d of sources.declarations.filter(d=>d.kind==='uniform'))if(!sources.uniforms.some(r=>r.id===d.id))sources.uniforms.push({id:d.id,name:d.name,type:d.type,missing:false,nameWritable:true,expected:d.id,components:[0,1,2,3].map(i=>({parameter:'test'+i,value:Array.isArray(d.value)?d.value[i]||0:d.value,mode:'CONSTANT',writable:true}))});
   fixture.state={graph:body.graph,revision:sources.revision};return res.end(JSON.stringify({state:fixture.state,target:fixture.target}));
  }
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
  const page=await browser.newPage({viewport:{width:1560,height:1050},hasTouch:true});page.on('pageerror',e=>errors.push(e.message));
  // Older personal layouts gain Inputs beside Add Node and Controls beside Parameter without resetting groups.
  await page.addInitScript(()=>localStorage.setItem('grapeWorkspaceV1',JSON.stringify({version:1,left:[{panels:['browser'],active:'browser',weight:1}],right:[{panels:['parameters','help'],active:'help',weight:7},{panels:['live'],active:'live',weight:2}],widths:{left:245,right:390}})));
  await page.goto('http://127.0.0.1:'+server.address().port+'/#fixture');await page.waitForSelector('.node');await page.selectOption('#language','en');
  await page.evaluate(()=>{window.actualApplyGraph=applyGraph;applyGraph=async()=>{clearTimeout(autoTimer);};});
  const showInputs=async()=>{await page.locator('[data-workspace-panel=uniforms]').click();};
  // Exercise actual category navigation, colors and source labels without changing the native fixture.
  await page.evaluate(()=>{
   window.presentationGraph=clone(graph);
   graph.declarations.push({id:'presentation_sampler',kind:'sampler',name:'uPreviewSampler',type:'sampler2D',source:'input:0',fallback:'opaque-black'});
   const d=catalog.find(d=>d.key==='sampler'),n=instantiate(d,500,300,null,{declarationId:'presentation_sampler'});window.presentationSamplerId=n.id;render();
   const r=document.querySelector('#canvas').getBoundingClientRect();openCreator(r.x+80,r.y+80);
  });
  await page.locator('.create-category-column').first().getByRole('option',{name:'Inputs',exact:true}).click();
  await page.locator('.create-category-column').nth(1).getByRole('option',{name:'Uniforms',exact:true}).click();
  assert.ok(await page.locator('[data-create-entry="input:gain"]').isVisible());
  assert.ok(await page.locator('[data-create-entry=uniform]').isVisible());
  assert.ok(await page.locator('[data-create-entry="preset:absTime"]').isVisible());
  assert.equal(await page.locator('[data-create-entry=sampler]').count(),0);
  assert.equal(await page.locator('[data-create-entry=mix]').count(),0);
  await page.screenshot({path:path.join(w,'creator-inputs-uniforms.png')});
  await page.locator('.create-category-column').nth(1).getByRole('option',{name:'Samplers',exact:true}).click();
  assert.ok(await page.locator('[data-create-entry=sampler]').isVisible());
  assert.ok(await page.locator('[data-create-entry="input:presentation_sampler"]').isVisible());
  assert.equal(await page.locator('[data-create-entry=uniform]').count(),0);
  await page.selectOption('#createsource','project');
  assert.equal(await page.locator('[data-create-entry=sampler]').count(),0);
  assert.ok(await page.locator('[data-create-entry="input:presentation_sampler"]').isVisible());
  await page.selectOption('#createsource','all');await page.fill('#createsearch','uRenamed');
  assert.ok(await page.locator('[data-create-entry="input:gain"]').isVisible());
  assert.equal(await page.locator('#createcategory').isVisible(),false);
  checks.push('Inputs subcategories browse new and existing sources; clock presets are Uniforms; global search and source filters remain usable');
  await page.fill('#createsearch','');
  const colors=await page.evaluate(()=>{
   const color=key=>getComputedStyle(document.querySelector('[data-create-entry="'+key+'"]')).backgroundColor;
   return {uniform:color('uniform'),reference:color('input:gain'),time:color('preset:absTime'),sampler:color('sampler'),samplerReference:color('input:presentation_sampler'),math:color('mix')};
  });
  assert.equal(colors.reference,colors.uniform);assert.equal(colors.time,colors.uniform);assert.equal(colors.samplerReference,colors.sampler);assert.notEqual(colors.reference,colors.math);assert.notEqual(colors.sampler,colors.math);
  await page.locator('#closecreator').click();
  const portLabel=id=>page.locator('[data-node="'+id+'"] .port-row.output .port-label');
  assert.equal(await portLabel('gain_ref').innerText(),'uRenamed');
  const samplerId=await page.evaluate(()=>window.presentationSamplerId);assert.equal(await portLabel(samplerId).innerText(),'uPreviewSampler');
  const edges=await page.evaluate(()=>JSON.stringify(current().edges));
  await page.evaluate(()=>{graph.declarations.find(d=>d.id==='gain').name='uLongSourceNameForReadableUniformReference12345678';render();});
  assert.equal(await portLabel('gain_ref').innerText(),'uLongSourceNameForReadableUniformReference12345678');
  assert.equal(await page.locator('[data-node=gain_ref] .port[data-kind=outputs]').getAttribute('data-port'),'out');
  assert.equal(await page.evaluate(()=>JSON.stringify(current().edges)),edges);
  const bounds=await portLabel('gain_ref').evaluate(e=>{const a=e.getBoundingClientRect(),b=e.closest('.node').getBoundingClientRect();return {contained:a.left>=b.left&&a.right<=b.right,full:e.title};});assert.ok(bounds.contained);assert.equal(bounds.full,'uLongSourceNameForReadableUniformReference12345678');
  checks.push('Uniform and Sampler reference colors follow their sources; renamed output labels preserve wire IDs and fit the node');
  await page.screenshot({path:path.join(w,'named-input-ports.png')});
  await page.evaluate(()=>{graph=window.presentationGraph;render();});
  await showInputs();await page.waitForSelector('[data-input-source=gain]');
  assert.equal(await page.locator('.workspace-group[data-workspace-group=parameters] [data-workspace-panel]').count(),3);
  assert.equal(await page.locator('#sidebar-left [data-workspace-panel=uniforms]').count(),1);
  assert.match(await page.locator('#nodecount').innerText(),/nodes/);checks.push('Existing layout retained with compact Inputs inventory');
  await page.locator('#sourceparameters').click();assert.equal(opened,1);
  await page.locator('[data-input-source=gain] .input-source-select').click();
  const value=page.locator('#inspector [data-native-source=gain] [data-source-component="0"]');
  await value.fill('0.42');await value.press('Enter');await page.waitForFunction(()=>!nativeSourceBusy);
  assert.equal(writes,1);assert.equal(await value.inputValue(),'0.42');checks.push('Selecting a source without a node edits actual TD values in Parameter');
  await showInputs();await page.locator('.inputs-create summary').click();
  await page.fill('#sourcename','uAdded');await page.selectOption('#sourcetype','vec3');await page.locator('#sourcecreate button').click();
  const id=await page.evaluate(()=>graph.declarations.find(d=>d.name==='uAdded').id);
  assert.equal(await page.evaluate(()=>current().nodes.filter(n=>n.params.declarationId===selectedInputId).length),0);
  assert.equal(await page.locator('.input-inspector-title strong').innerText(),'uAdded');checks.push('A source can be created and inspected before any graph reference');
  await page.locator('#inspector [data-input-reference]').click();
  await showInputs();await page.locator('#nativeuniforms [data-input-reference="'+id+'"]').click();
  assert.equal(await page.evaluate(id=>current().nodes.filter(n=>n.params.declarationId===id).length,id),2);
  assert.equal(await page.evaluate(id=>graph.declarations.filter(d=>d.id===id).length,id),1);checks.push('Repeated references reuse identity without creating incidental sources');
  await page.locator('#graphdelete').click();assert.equal(await page.evaluate(id=>graph.declarations.some(d=>d.id===id),id),true);
  const canvas=await page.locator('#canvas').boundingBox(),drop={x:canvas.x+canvas.width*.65,y:canvas.y+canvas.height*.45};
  await page.evaluate(({x,y})=>openCreator(x,y),drop);await page.fill('#createsearch','uAdded');
  await page.locator('[data-create-entry="input:'+id+'"]').click();
  assert.equal(await page.evaluate(id=>current().nodes.filter(n=>n.params.declarationId===id).length,id),2);checks.push('Floating Add Node finds and references existing named Inputs');
  const before=await page.evaluate(()=>graph.declarations.length);
  await page.evaluate(({x,y})=>openCreator(x,y),drop);await page.fill('#createsearch','uniform');await page.locator('[data-create-entry=uniform]').click();
  assert.equal(await page.evaluate(()=>graph.declarations.length),before+1);checks.push('New Uniform always creates a new identity');
  await page.evaluate(()=>{const n=current().nodes.find(n=>definition(n)?.key==='pixel_out');n.inputValues={color:[.1,.2,.3,.4]};const r=document.querySelector('#canvas').getBoundingClientRect();openCreator(r.x+120,r.y+150,{node:n.id,port:'color',kind:'inputs',type:'vec4'});});
  await page.fill('#createsearch','uniform');await page.locator('[data-create-entry=uniform]').click();
  const created=await page.evaluate(()=>{const n=current().nodes.find(n=>n.id===selected);return{node:n,decl:graph.declarations.find(d=>d.id===n.params.declarationId),edges:current().edges};});
  assert.equal(created.decl.type,'vec4');assert.deepEqual(created.decl.value,[.1,.2,.3,.4]);assert.ok(created.edges.some(e=>e.from[0]===created.node.id));
  await page.locator('#undo').click();assert.equal(await page.evaluate(id=>graph.declarations.some(d=>d.id===id),created.decl.id),false);checks.push('Wire shortcut inherits type/value, connects and undoes as one graph edit');
  // Mouse and touch handles share one transaction; cancellation leaves no source or node.
  await showInputs();await page.fill('#inputsearch','uAdded');
  let handle=page.locator('#nativeuniforms [data-input-reference="'+id+'"]'),rect=await handle.boundingBox();
  const start=await page.evaluate(()=>current().nodes.length);
  await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);await page.mouse.down();await page.mouse.move(drop.x,drop.y,{steps:8});await page.keyboard.press('Escape');await page.mouse.up();
  assert.equal(await page.evaluate(()=>current().nodes.length),start);
  rect=await handle.boundingBox();await page.mouse.move(rect.x+rect.width/2,rect.y+rect.height/2);await page.mouse.down();await page.mouse.move(drop.x,drop.y,{steps:8});await page.mouse.up();
  assert.equal(await page.evaluate(()=>current().nodes.length),start+1);checks.push('Reference drag creates once on canvas; Escape cancels without mutation');
  const touchBefore=await page.evaluate(()=>current().nodes.length),cdp=await page.context().newCDPSession(page);rect=await handle.boundingBox();
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:rect.x+rect.width/2,y:rect.y+rect.height/2,id:1}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:drop.x,y:drop.y,id:1}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert.equal(await page.evaluate(()=>current().nodes.length),touchBefore+1);checks.push('Real Chromium touch drag follows the same release-to-create path');
  await page.evaluate(({x,y})=>openCreator(x,y),drop);await page.fill('#createsearch','uAbsTime');await page.locator('[data-create-entry="preset:absTime"]').click();
  assert.equal(await page.evaluate(()=>graph.declarations.find(d=>d.id===current().nodes.find(n=>n.id===selected).params.declarationId).initialDriver),'absTime');
  await page.locator('#undo').click();assert.equal(await page.evaluate(()=>graph.declarations.some(d=>d.initialDriver==='absTime')),false);checks.push('Clock presets create ordinary sources and references in one undoable edit');
  await page.evaluate(()=>{applyGraph=window.actualApplyGraph;});
  await page.evaluate(({x,y})=>openCreator(x,y),drop);await page.fill('#createsearch','uniform');await page.locator('[data-create-entry=uniform]').click();
  const committed=await page.evaluate(()=>({node:selected,source:current().nodes.find(n=>n.id===selected).params.declarationId}));
  await page.waitForFunction(()=>!dirty&&!submitBusy);
  await page.locator('#undo').click();await page.waitForFunction(()=>!dirty&&!submitBusy);
  assert.equal(await page.evaluate(id=>current().nodes.some(n=>n.id===id),committed.node),false);
  assert.equal(await page.evaluate(id=>graph.declarations.some(d=>d.id===id),committed.source),true);
  checks.push('After Apply, Graph Undo keeps the native source identity while removing the reference');
  await page.evaluate(()=>{clearTimeout(autoTimer);dirty=false;});
  await page.selectOption('#language','zh-Hant');await showInputs();await page.fill('#inputsearch','');
  await page.screenshot({path:path.join(w,'inputs-panel.png')});
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(w,'browser-result.json'),JSON.stringify({passed:true,checks},null,2));console.log(JSON.stringify({passed:true,checks}));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
