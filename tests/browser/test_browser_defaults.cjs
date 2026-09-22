const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {harness}=require('./test_glsl_code.cjs');
(async()=>{
 const [source,stateFile,matFile,folder]=process.argv.slice(2),mat=JSON.parse(fs.readFileSync(matFile,'utf8'));
 const h=await harness(source,stateFile,folder,{skipPreview:true}),{page,checks,errors}=h;
 try{
  await page.evaluate(()=>{nativeSourcePolling=uniformPolling=customPolling=true;uniformLive.disconnect();uniformLive.connect=()=>{};clearTimeout(autoTimer);scheduleGraphApply=()=>{};});
  assert.ok(await page.locator('.browser-section').evaluateAll(es=>es.every(e=>!e.open)));
  await page.locator('#browser-section-categories > summary').click();
  assert.ok(await page.locator('#nodes .browser-branch').evaluateAll(es=>es.every(e=>!e.open)));
  await page.locator('#search').fill('Mix');assert.ok(await page.locator('#browsersearchitems [data-entry=mix]').isVisible());await page.locator('#search').fill('');
  checks.push('Add Node sections and nested categories start collapsed; search results remain directly accessible');
  await page.locator('#browser-section-library > summary').click();
  for(const tab of ['all','editor','personal','all']){
   await page.locator('[data-function-source='+tab+']').click();assert.equal(await page.locator('#personal-library').count(),tab==='personal'?1:0);
  }
  assert.equal(await page.locator('#librarydeclarations').count(),0);
  checks.push('Personal controls appear only on the Personal library tab; obsolete declaration editor is removed');
  assert.deepEqual(await page.locator('[data-example]').evaluateAll(es=>es.map(e=>e.dataset.example)),['banana','color','tint']);
  await page.evaluate(ex=>{examples={...examples,...ex};renderLibrary();},mat.examples);
  assert.deepEqual(await page.locator('[data-example]').evaluateAll(es=>es.map(e=>e.dataset.example)),['banana','color','tint']);
  const prior=await page.evaluate(()=>JSON.stringify(graph));assert.equal(await page.evaluate(()=>loadExample('phong')),false);assert.equal(await page.evaluate(()=>JSON.stringify(graph)),prior);
  await page.evaluate(()=>{editorTarget='mat';renderLibrary();});
  assert.deepEqual(await page.locator('[data-example]').evaluateAll(es=>es.map(e=>e.dataset.example)),['phong','pbr']);assert.equal(await page.evaluate(()=>loadExample('banana')),false);
  await page.evaluate(()=>{readonly=connectionInterrupted=dirty=false;nativeSourceSnapshot={enabled:false};past=[];future=[];});
  assert.equal(await page.evaluate(()=>loadExample('phong')),true);assert.equal(await page.evaluate(()=>graph.target),'mat');assert.ok(await page.evaluate(()=>graph.stages.vertex.nodes.length>0));
  checks.push('TOP/MAT template lists are separated; mismatched load is rejected without changing the graph and matching MAT template loads');
  await page.evaluate(()=>{workspaceLayout.reveal('uniforms');$('#inputsearch').value='';renderNativeSources();});
  assert.equal(await page.evaluate(()=>EDITOR_DEV_SETTINGS.frameWireEndpoint),true);
  const row=await page.evaluate(()=>[...$('.source-view-tools').children].map(e=>e.getBoundingClientRect().top));assert.ok(Math.max(...row)-Math.min(...row)<15);
  checks.push('Automatic wire-endpoint framing defaults on; source controls fit the wider default sidebar');
  await page.screenshot({path:path.join(folder,'defaults.png')});assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,checks}));
 }catch(e){await h.finish(e);throw e;}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
