/* Real editor creation, independent switches, persistence and legacy presentation. */
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {execFileSync}=require('node:child_process'),{harness}=require('./test_glsl_code.cjs');
(async()=>{
 const[source,base,folder]=process.argv.slice(2);fs.mkdirSync(folder,{recursive:true});const fixture=path.join(folder,'state.json');
 execFileSync(process.env.PYTHON_EXECUTABLE||'python',[path.join(__dirname,'export_editor_fixture.py'),base,fixture]);
 const h=await harness(source,fixture,folder,{skipPreview:true}),{page,checks,errors,settle}=h,keys=['dither','alphaTest','convertColorSpace'];
 const control=key=>page.locator(`[data-pixel-finishing="${key}"]`);
 try{
  await page.evaluate(()=>{
   nativeSourcePolling=uniformPolling=customPolling=true;uniformLive.disconnect();uniformLive.connect=()=>{};
   clearTimeout(autoTimer);scheduleGraphApply=()=>{};readonly=conflicted=connectionInterrupted=dirty=false;
   stage='pixel';graphTrail=[];graph.functions=[];graph.declarations=[];past=[];future=[];
   graph.stages.pixel={nodes:[testNode('color','color',60,160)],edges:[]};
   addNode(catalog.find(d=>d.key==='pixel_out'),450,160);window.outputId=selected;
   current().edges=[{from:['color','out'],to:[outputId,'color']}];render();
  });await settle();
  assert.equal(await page.locator('[data-native-finishing]').count(),0);
  for(const key of keys)assert.equal(await control(key).isChecked(),true);
  checks.push('Adding a MAT Color Output through the normal editor creates three checked independent switches');
  for(const key of keys){
   const before=await page.evaluate(()=>past.length);await control(key).uncheck();await settle();
   assert.equal(await page.evaluate(key=>current().nodes.find(n=>n.id===outputId).params[key],key),false);
   assert.equal(await page.evaluate(()=>past.length),before+1);for(const other of keys.filter(k=>k!==key))assert.equal(await control(other).isChecked(),true);
   await page.evaluate(()=>undo());await settle();assert.equal(await control(key).isChecked(),true);
   await page.evaluate(()=>undo(true));await settle();assert.equal(await control(key).isChecked(),false);
   await page.evaluate(()=>undo());await settle();
  }
  checks.push('Each switch changes only its own value and supports one-step Undo/Redo');
  for(const legacy of [null,false,true]){
   await page.evaluate(legacy=>{const n=current().nodes.find(n=>n.id===outputId);n.params=legacy===null?{}:{nativeFinishing:legacy};past=[];future=[];inspector();},legacy);await settle();
   assert.equal(await control('dither').isChecked(),true);assert.equal(await control('alphaTest').isChecked(),true);assert.equal(await control('convertColorSpace').isChecked(),!!legacy);
   const before=await page.evaluate(()=>JSON.stringify(current().nodes.find(n=>n.id===outputId)));
   await page.evaluate(()=>inspector());assert.equal(await page.evaluate(()=>JSON.stringify(current().nodes.find(n=>n.id===outputId))),before);
   await control('alphaTest').uncheck();assert.equal(await control('convertColorSpace').isChecked(),!!legacy);
   assert.equal(await page.evaluate(()=>Object.hasOwn(current().nodes.find(n=>n.id===outputId).params,'nativeFinishing')),false);
   await page.evaluate(()=>undo());await settle();assert.equal(await page.evaluate(()=>JSON.stringify(current().nodes.find(n=>n.id===outputId))),before);
  }
  checks.push('Old graphs display their saved behavior without mutation; editing migrates values together and Undo restores the original representation');
  await page.evaluate(()=>{readonly=true;inspector();});for(const key of keys)assert.equal(await control(key).isDisabled(),true);
  await page.evaluate(()=>{readonly=false;inspector();workspaceLayout.setFloatingParameter(true);});
  for(const language of ['en','zh-Hant','ja','fr','ko']){
   await page.evaluate(language=>setLanguage(language),language);await settle();assert.equal(await page.locator('#floatingparameters [data-pixel-finishing]').count(),3);
   for(const key of keys)assert.ok((await control(key).getAttribute('title')||await control(key).evaluate(e=>e.closest('label').title)||'').length>15);
  }
  await page.setViewportSize({width:430,height:932});await page.evaluate(()=>{setSidebarOpen('left',false);setSidebarOpen('right',false);});await settle();
  await page.screenshot({path:path.join(folder,'mobile.png')});
  const n=await page.evaluate(()=>current().nodes.find(n=>n.id===outputId));assert.equal(n.params.nativeFinishing,true);
  await control('dither').uncheck();await control('alphaTest').uncheck();await control('convertColorSpace').uncheck();
  const saved=await page.evaluate(()=>clone(graph));fs.writeFileSync(path.join(folder,'edited.json'),JSON.stringify(saved));
  execFileSync(process.env.PYTHON_EXECUTABLE||'python',['-c','import json,sys;sys.path.insert(0,sys.argv[1]);import sgrape_core as c;t=c.compile_graph(json.load(sys.stdin))["pixel"];assert all(x not in t for x in ("TDDither(","TDAlphaTest(","TDConvertColorSpace("));assert "TDOutputSwizzle(sg_color)" in t',path.resolve(__dirname,'../../src/core')],{input:JSON.stringify(saved)});
  await page.evaluate(g=>{graph=JSON.parse(JSON.stringify(g));render();},saved);for(const key of keys)assert.equal(await control(key).isChecked(),false);
  checks.push('Readonly, five locales, floating/mobile layout and serialized editor output retain values; all-off compiles to Swizzle only');
  await page.evaluate(()=>{workspaceLayout.setFloatingParameter(false);editorTarget='top';graph.target='top';graph.stages.pixel={nodes:[],edges:[]};addNode(catalog.find(d=>d.key==='pixel_out'),200,160);render();});
  assert.equal(await page.locator('[data-pixel-finishing]').count(),0);assert.deepEqual(await page.evaluate(()=>current().nodes.find(n=>n.id===selected).params),{});
  checks.push('TOP keeps its existing Swizzle-only output and has no MAT finishing controls or defaults');
  assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,checks}));
 }catch(e){await h.finish(e);throw e;}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
