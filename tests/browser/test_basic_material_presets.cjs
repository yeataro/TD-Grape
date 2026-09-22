const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),{execFileSync}=require('node:child_process');
const {harness}=require('./test_glsl_code.cjs');
(async()=>{
 const[source,base,folder]=process.argv.slice(2);fs.mkdirSync(folder,{recursive:true});const fixture=path.join(folder,'state.json');
 execFileSync(process.env.PYTHON_EXECUTABLE||'python',[path.join(__dirname,'export_editor_fixture.py'),base,fixture]);
 const presets=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../src/library/material_presets.json'),'utf8'));
 const h=await harness(source,fixture,folder,{skipPreview:true}),{page,checks,errors,settle}=h;
 try{
  await page.selectOption('#language','en');
  for(const [model,preset] of Object.entries(presets)){
   await page.evaluate(preset=>{clearTimeout(autoTimer);scheduleGraphApply=()=>{};connectionInterrupted=true;readonly=false;historyBusy=false;nativeMutationBusy=false;graphTrail=[];editorTarget='mat';graph=clone(preset);stage='pixel';past=[];future=[];selected='pixel';selection.clear();selection.add('pixel');render();},preset);await settle();
   const control=page.locator('[data-native-finishing="pixel"]');await assert.equal(await control.count(),1);assert.ok(await control.isChecked());
   await control.uncheck();await settle();assert.equal(await page.evaluate(()=>current().nodes.find(n=>n.id==='pixel').params.nativeFinishing),false);
   await page.evaluate(()=>undo());await settle();assert.ok(await control.isChecked());
   await page.evaluate(()=>{stage='vertex';selected='vertex';selection.clear();selection.add('vertex');render();});await settle();
   const fields=await page.evaluate(()=>current().nodes.find(n=>n.id==='vertex').params.outputs.map(p=>p.id));assert.deepEqual(fields,['world','normal','camera','color','uv']);
   for(const st of ['vertex','pixel']){
    await page.evaluate(st=>{stage=st;selection.clear();selected=null;render();},st);await settle();
    assert.equal(await page.evaluate(()=>GraphFrames.valid(current())),true);
    assert.equal(await page.locator('#groupframes .group-frame').count(),preset.stages[st].ui.frames.length);
   }
   await page.evaluate(()=>{stage='pixel';selected='pixel';selection.clear();selection.add('pixel');render();});await settle();
   const edited=await page.evaluate(()=>graph);execFileSync(process.env.PYTHON_EXECUTABLE||'python',['-c','import json,sys;sys.path.insert(0,sys.argv[1]);import sgrape_core as c;r=c.compile_graph(json.load(sys.stdin));assert "TDConvertColorSpace(sg_color)" in r["pixel"]',path.resolve(__dirname,'../../src/core')],{input:JSON.stringify(edited)});
   checks.push(model+': loads both stages, native finishing toggle/Undo and edited graph compiles');
  }
  assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,checks}));
 }catch(e){await h.finish(e);throw e;}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
