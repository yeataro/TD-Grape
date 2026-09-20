/* Native Buffer UI uses resource ports and source controls, not value sliders. */
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {execFileSync}=require('node:child_process');
const {harness}=require('./test_glsl_code.cjs');
(async()=>{
 const [source,base,folder]=process.argv.slice(2);fs.mkdirSync(folder,{recursive:true});
 const fixture=path.join(folder,'state.json');execFileSync(process.env.PYTHON_EXECUTABLE||'python',[path.join(__dirname,'export_editor_fixture.py'),base,fixture]);
 const h=await harness(source,fixture,folder,{skipPreview:true}),{page,checks,errors}=h;
 try{
  await page.evaluate(()=>{clearTimeout(autoTimer);nativeSourcePolling=uniformPolling=customPolling=true;uniformLive.disconnect();uniformLive.connect=()=>{};});
  await page.evaluate(()=>openInputCreate('texture_buffer'));
  assert.equal(await page.locator('#sourcename').inputValue(),'uBuffer');
  assert.equal(await page.locator('#sourcearraylength').isVisible(),false);
  assert.equal(await page.locator('#sourcearraypath').getAttribute('required'),null);
  assert.deepEqual(await page.locator('#sourcetype option').evaluateAll(es=>es.map(e=>e.value)),['float','vec2','vec3','vec4']);
  await page.locator('#sourcecreate button[type=submit]').click();
  assert.equal(await page.locator('#sourcecreatedialog').isVisible(),false);
  const decl=await page.evaluate(()=>graph.declarations.find(d=>d.type==='samplerBuffer'));
  assert.ok(decl);assert.equal(decl.value,null);assert.equal(decl.nativeSequence,'array');
  checks.push('Buffer creation has CHOP format/path and no baked length or numeric default');
  await page.evaluate(id=>{
   nativeSourceSnapshot={revision,enabled:true,uniforms:[{id,name:'uBuffer',type:'samplerBuffer',sequence:'array',missing:false,pending:false,nameWritable:true,expected:'source',components:[],arrayBinding:{mode:'CONSTANT',value:'',writable:true,expected:'path',arrayType:'texturebuffer',elementType:'float'}}],issues:[]};
   renderNativeSources();selectInputSource(id);
  },decl.id);
  assert.equal(await page.locator(`[data-input-group="texture_buffer"] [data-input-source="${decl.id}"]`).count(),1);
  assert.equal(await page.locator(`[data-input-group="uniform"] [data-input-source="${decl.id}"]`).count(),0);
  assert.equal(await page.locator(`[data-input-source="${decl.id}"] input`).count(),0);
  assert.equal(await page.locator('#inspector [data-source-custom]').count(),0);
  checks.push('Buffer is separate from Custom Uniforms; source card and inspector have no numeric Uniform controls');
  await page.evaluate(id=>{
   current().nodes=[testNode('buffer','uniform',30,100,{declarationId:id}),testNode('read','buffer_fetch',320,100),testNode('count','buffer_length',320,300),testNode('out','pixel_out',600,100)];
   current().edges=[{from:['buffer','out'],to:['read','buffer']},{from:['read','out'],to:['out','color']},{from:['buffer','out'],to:['count','buffer']}];render();
  },decl.id);
  assert.deepEqual(await page.evaluate(()=>{const ports=(i,kind)=>{const n=current().nodes[i];return resolvedNodePorts(catalog.find(d=>d.definitionUuid===n.definitionUuid),n.params,graph.declarations.find(d=>d.id===n.params.declarationId),kind);};return {source:ports(0,'outputs'),read:ports(1,'inputs'),count:ports(2,'outputs')};}),{source:{out:'samplerBuffer'},read:{buffer:'samplerBuffer',index:'int'},count:{out:'int'}});
  assert.equal(await page.locator('.node [data-native-source] input').count(),0);
  checks.push('reference resolves to samplerBuffer and connects to Fetch/Length without live numeric subscriptions');
  await page.screenshot({path:path.join(folder,'texture-buffer.png')});
  assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,count:checks.length}));
 }catch(e){await h.finish(e);throw e;}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
