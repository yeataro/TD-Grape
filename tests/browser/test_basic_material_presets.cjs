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
   const control=page.locator('[data-pixel-finishing="convertColorSpace"]');await assert.equal(await control.count(),1);assert.ok(await control.isChecked());
   await control.uncheck();await settle();assert.equal(await page.evaluate(()=>current().nodes.find(n=>n.id==='pixel').params.convertColorSpace),false);
   await page.evaluate(()=>undo());await settle();assert.ok(await control.isChecked());
   await page.evaluate(()=>{stage='vertex';selected='vertex';selection.clear();selection.add('vertex');render();});await settle();
   const fields=await page.evaluate(()=>current().nodes.find(n=>n.id==='vertex').params.outputs.map(p=>p.id));assert.deepEqual(fields,['world','normal','camera','color','uv',...(model.endsWith('_textured')?['tbn']:[])]);
   for(const st of ['vertex','pixel']){
    await page.evaluate(st=>{stage=st;selection.clear();selected=null;render();},st);await settle();
    assert.equal(await page.evaluate(()=>GraphFrames.valid(current())),true);
    assert.equal(await page.locator('#groupframes .group-frame').count(),preset.stages[st].ui.frames.length);
   }
   await page.evaluate(()=>{stage='pixel';selected='pixel';selection.clear();selection.add('pixel');render();});await settle();
   const edited=await page.evaluate(()=>graph);execFileSync(process.env.PYTHON_EXECUTABLE||'python',['-c','import json,sys;sys.path.insert(0,sys.argv[1]);import sgrape_core as c;r=c.compile_graph(json.load(sys.stdin));assert "TDConvertColorSpace(sg_color)" in r["pixel"]',path.resolve(__dirname,'../../src/core')],{input:JSON.stringify(edited)});
   checks.push(model+': loads both stages, native finishing toggle/Undo and edited graph compiles');
   if(model==='pbr_textured'){
    await page.evaluate(()=>{selected='material';selection.clear();selection.add('material');render();const n=current().nodes.find(n=>n.id==='material');scale=.8;pan={x:250-n.ui.x*scale,y:100-n.ui.y*scale};transform();});await settle();
    const ambient=()=>page.locator('input[data-inline-node="material"][data-inline-port="ambientStrength"]').first();
    assert.equal(await ambient().inputValue(),'0');
    assert.equal(await page.locator('.node[data-node="material"] .port[data-kind="inputs"][data-port="ambientStrength"]').count(),1);
    await ambient().fill('0.5');await ambient().press('Enter');await settle();
    assert.equal(await page.evaluate(()=>current().nodes.find(n=>n.id==='material').inputValues.ambientStrength),.5);
    await page.evaluate(()=>undo());await settle();assert.equal(await ambient().inputValue(),'0');
    await page.screenshot({path:path.join(folder,'pbr-ambient-input.png')});
    checks.push('PBR ambientStrength: visible float socket, zero default, direct editing and Undo');
   }
  }
  assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,checks}));
 }catch(e){await h.finish(e);throw e;}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
