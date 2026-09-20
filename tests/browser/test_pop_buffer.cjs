const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {execFileSync}=require('node:child_process');
const {harness}=require('./test_glsl_code.cjs');
(async()=>{
 const [source,base,folder]=process.argv.slice(2);fs.mkdirSync(folder,{recursive:true});
 const fixture=path.join(folder,'state.json');execFileSync(process.env.PYTHON_EXECUTABLE||'python',[path.join(__dirname,'export_editor_fixture.py'),base,fixture]);
 const h=await harness(source,fixture,folder,{skipPreview:true}),{page,checks,errors}=h;
 try{
  await page.evaluate(()=>{clearTimeout(autoTimer);nativeSourcePolling=uniformPolling=customPolling=true;uniformLive.disconnect();uniformLive.connect=()=>{};scheduleGraphApply=()=>{};openInputCreate('pop_buffer');});
  assert.equal(await page.locator('#sourcebufferfields').isVisible(),true);
  assert.equal(await page.locator('#sourcearrayfields').isVisible(),false);
  await page.locator('#sourcecreate button[type=submit]').click();
  assert.equal(await page.locator('#sourcecreatedialog').isVisible(),true);
  await page.locator('#sourcebufferfields [data-buffer-field="pop"]').fill('/project1/points');
  await page.locator('#sourcebufferfields [data-buffer-field="attr"]').fill('P');
  await page.locator('#sourcetype').selectOption('vec3');
  await page.locator('#sourcecreate button[type=submit]').click();
  const decl=await page.evaluate(()=>graph.declarations.find(d=>d.kind==='pop_buffer'));
  assert.ok(decl);assert.equal(decl.value,null);assert.equal(decl.popSource,'/project1/points');assert.equal(decl.type,'vec3');
  checks.push('POP creation shares source dialog, requires user-specified path/attribute and keeps values outside graph');
  await page.evaluate(id=>{
   dirty=false;nativeSourceSnapshot={revision,enabled:true,uniforms:[{id,kind:'pop_buffer',name:'Data',type:'vec3',sequence:'buffer',missing:false,pending:false,nameWritable:true,expected:'source',components:[],bufferBinding:{writable:true,expected:'binding',fields:{pop:{mode:'CONSTANT',value:'/project1/points',writable:true},attrclass:{mode:'CONSTANT',value:'point',writable:true},attr:{mode:'CONSTANT',value:'P',writable:true}}}}],issues:[]};
   renderNativeSources();selectInputSource(id);
  },decl.id);
  assert.equal(await page.locator(`[data-input-group="pop_buffer"] [data-input-source="${decl.id}"]`).count(),1);
  assert.equal(await page.locator('#inspector [data-source-component]').count(),0);
  assert.equal(await page.locator('#inspector [data-source-custom]').count(),0);
  assert.equal(await page.locator('#inspector [data-buffer-field="pop"]').inputValue(),'/project1/points');
  checks.push('POP source has shared management controls and no Uniform value sliders');
  await page.evaluate(()=>{window.sentBuffer=null;nativeSourceRequest=async(endpoint,body)=>{window.sentBuffer={endpoint,body};return {};};});
  await page.locator('#inspector [data-buffer-field="attr"]').fill('Cd');
  await page.locator('#inspector [data-buffer-binding-editor] button').click();
  assert.deepEqual(await page.evaluate(()=>sentBuffer.body),{action:'bufferBinding',id:decl.id,fields:{pop:'/project1/points',attrclass:'point',attr:'Cd'},expected:'binding'});
  await page.evaluate(()=>{const row=nativeSourceSnapshot.uniforms[0];row.bufferBinding.fields.pop={mode:'EXPRESSION',expression:"op('../animated')",value:'',writable:false};row.bufferBinding.writable=false;nativeSourceSnapshot={...nativeSourceSnapshot};renderNativeSources();});
  assert.equal(await page.locator('#inspector [data-buffer-field="pop"]').isDisabled(),true);
  assert.equal(await page.locator('#inspector [data-buffer-binding-editor] button').isDisabled(),true);
  checks.push('binding edits carry the visible expected token; driven configuration stays readonly');
  await page.evaluate(id=>{
   inputReference(id);const n=current().nodes.find(n=>n.params.declarationId===id);window.createdBuffer=n.id;
   const def=catalog.find(d=>d.key==='pop_buffer');window.bufferPorts={inputs:resolvedNodePorts(def,n.params,graph.declarations.find(d=>d.id===id),'inputs'),outputs:resolvedNodePorts(def,n.params,graph.declarations.find(d=>d.id===id),'outputs')};
  },decl.id);
  assert.deepEqual(await page.evaluate(()=>bufferPorts),{inputs:{index:'uint',arrayIndex:'uint'},outputs:{out:'vec3',length:'uint',arraySize:'uint'}});
  checks.push('references retain both index inputs and all three outputs');
  await page.screenshot({path:path.join(folder,'pop-buffer.png')});assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,count:checks.length}));
 }catch(e){await h.finish(e);throw e;}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
