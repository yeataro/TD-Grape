const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {execFileSync}=require('node:child_process');
const {harness}=require('./test_glsl_code.cjs');
(async()=>{
 const [source,base,folder]=process.argv.slice(2);fs.mkdirSync(folder,{recursive:true});
 const fixture=path.join(folder,'state.json');execFileSync(process.env.PYTHON_EXECUTABLE||'python',[path.join(__dirname,'export_editor_fixture.py'),base,fixture]);
 const h=await harness(source,fixture,folder,{skipPreview:true}),{page,checks,errors}=h;
 try{
  await page.evaluate(()=>{clearTimeout(autoTimer);nativeSourcePolling=uniformPolling=customPolling=true;uniformLive.disconnect();uniformLive.connect=()=>{};scheduleGraphApply=()=>{};stage='vertex';render();openInputCreate('attribute');});
  assert.equal(await page.locator('#sourcecreatedialog').isVisible(),true);
  assert.equal(await page.locator('#sourcebufferfields').isVisible(),false);
  assert.equal(await page.locator('#sourcearrayfields').isVisible(),false);
  const types=await page.locator('#sourcetype option').evaluateAll(es=>es.map(e=>e.value));
  assert.ok(types.includes('mat3x2')&&types.includes('vec3'));assert.ok(!types.includes('bool')&&!types.includes('dmat3'));
  await page.locator('#sourcetype').selectOption('vec3');await page.locator('#sourcecreate button[type=submit]').click();
  const decl=await page.evaluate(()=>graph.declarations.find(d=>d.kind==='attribute'));assert.ok(decl);assert.equal(decl.value,null);assert.equal(decl.nativeSequence,'attr');
  checks.push('MAT Attribute shares creation dialog and numeric type picker, with no geometry values or POP path');
  await page.evaluate(id=>{
   dirty=false;nativeSourceError='';nativeSourceSnapshot={revision,enabled:true,uniforms:[{id,kind:'attribute',name:'Attribute',type:'vec3',sequence:'attr',missing:false,pending:false,nameWritable:true,expected:'source',components:[],attributeBinding:{type:'vec3',arraySize:1,sizeSupported:false,writable:true,expected:'binding'}}],issues:[]};
   renderNativeSources();selectInputSource(id);
  },decl.id);
  assert.equal(await page.locator(`[data-input-group="attribute"] [data-input-source="${decl.id}"]`).count(),1);
  assert.equal(await page.locator('#inspector [data-source-component], #inspector [data-source-custom]').count(),0);
  assert.equal(await page.locator('#inspector .native-input-fields input').count(),0);
  await page.evaluate(()=>{window.sentAttribute=null;nativeSourceRequest=async(endpoint,body)=>{sentAttribute={endpoint,body};return {};};});
  await page.locator('#inspector .native-input-fields select').selectOption('float');
  assert.deepEqual(await page.evaluate(()=>sentAttribute.body),{action:'attributeConfig',id:decl.id,type:'float',arraySize:1,expected:'binding'});
  checks.push('native type edits carry expected configuration; unsupported Array Size has no misleading numeric field');
  await page.evaluate(id=>{inputReference(id);window.attributeNode=current().nodes.find(n=>n.params.declarationId===id).id;},decl.id);
  assert.deepEqual(await page.evaluate(()=>{const n=current().nodes.find(n=>n.id===attributeNode);return ports(n,'outputs');}),{out:'vec3',arraySize:'uint'});
  await page.evaluate(id=>{stage='pixel';render();selectInputSource(id);},decl.id);
  assert.equal(await page.locator(`#inspector [data-input-reference="${decl.id}"]`).isDisabled(),true);
  checks.push('Vertex references have typed outputs; Pixel cannot add an Attribute reference');
  await page.evaluate(()=>{nativeSourceSnapshot.uniforms[0].attributeBinding.writable=false;nativeSourceSnapshot={...nativeSourceSnapshot};inspector();});
  assert.equal(await page.locator('#inspector .native-input-fields select').isDisabled(),true);
  await page.screenshot({path:path.join(folder,'mat-attributes.png')});
  checks.push('TD-driven Attribute configuration remains readonly');
  assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,count:checks.length}));
 }catch(e){await h.finish(e);throw e;}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
