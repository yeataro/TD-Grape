const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),{execFileSync}=require('node:child_process');
const {harness}=require('./test_glsl_code.cjs');
(async()=>{
 const[source,base,folder]=process.argv.slice(2);fs.mkdirSync(folder,{recursive:true});const fixture=path.join(folder,'state.json');
 execFileSync(process.env.PYTHON_EXECUTABLE||'python',[path.join(__dirname,'export_editor_fixture.py'),base,fixture]);
 const h=await harness(source,fixture,folder,{skipPreview:true}),{page,checks,errors,settle}=h;
 try{
  await page.selectOption('#language','en');
  await page.evaluate(()=>{clearTimeout(autoTimer);scheduleGraphApply=()=>{};connectionInterrupted=true;readonly=false;historyBusy=false;nativeMutationBusy=false;graphTrail=[];editorTarget='mat';graph.target='mat';graph.declarations=[];stage='vertex';past=[];future=[];selected=null;selection.clear();graph.stages.vertex={nodes:[testNode('vertex','vertex_out',650,80)],edges:[]};graph.stages.pixel={nodes:[testNode('pixel','pixel_out',650,80)],edges:[]};render();
    window.beforeTex=JSON.stringify(graph);window.texDef=catalog.find(d=>d.key==='tex_attribute');
    assertSearch=browseEntries(browserIndex(),'TDTexAttrib',{source:'all'}).some(e=>e.d.key==='tex_attribute');
    change(()=>instantiate(texDef,200,80));window.texId=selected;
  });await settle();assert.equal(await page.evaluate(()=>assertSearch),true);
  const decl=await page.evaluate(()=>graph.declarations[0]);assert.equal(decl.name,'Tex');assert.equal(decl.type,'vec3');assert.equal(decl.kind,'attribute');
  assert.ok((await page.locator('[data-node]').filter({has:page.locator('.node-prototype')}).allTextContents()).some(s=>s.includes('Texture Attribute')));
  assert.deepEqual(await page.evaluate(()=>ports(current().nodes.find(n=>n.id===texId),'inputs')),{layer:'uint'});
  await page.locator('#undo').click();await settle();assert.equal(await page.evaluate(()=>JSON.stringify(graph)),await page.evaluate(()=>beforeTex));
  await page.locator('#redo').click();await settle();checks.push('searchable texture attribute creates a shared vec3 Tex declaration in one undoable edit');
  await page.evaluate(()=>change(()=>instantiate(texDef,200,260)));await settle();assert.equal(await page.evaluate(()=>graph.declarations.length),1);
  await page.evaluate(()=>{graph.declarations.push({id:'alternative',kind:'attribute',name:'AlternateUV',type:'vec3',value:null,nativeSequence:'attr',arraySize:1},{id:'bad',kind:'attribute',name:'WrongShape',type:'vec2',value:null,nativeSequence:'attr',arraySize:1});selected=texId;selection=new Set([texId]);inspectorTab='settings';render();});await settle();
  const choices=await page.locator('#inspector select option').allTextContents();assert.ok(choices.includes('AlternateUV'));assert.ok(!choices.includes('WrongShape'));
  const picker=page.locator('#inspector select').filter({has:page.locator('option[value="alternative"]')});await picker.selectOption('alternative');await settle();
  await page.evaluate(()=>{const n=current().nodes.find(n=>n.id===texId);n.inputValues={layer:1};connectPorts({node:n.id,port:'out',kind:'outputs'},{node:'vertex',port:'__add__',kind:'inputs',add:true});});await settle();
  const g=await page.evaluate(()=>graph);execFileSync(process.env.PYTHON_EXECUTABLE||'python',['-c','import sys,json;sys.path.insert(0,sys.argv[1]);import sgrape_core as c;r=c.compile_graph(json.load(sys.stdin));assert "TDTexAttrib_AlternateUV(1u)" in r["vertex"]',path.resolve(__dirname,'../../src/core')],{input:JSON.stringify(g)});
  checks.push('existing declaration can be selected; incompatible shapes are excluded; the actual UI graph compiles a named layer read and stage connection');
  const visibility=await page.evaluate(()=>{stage='pixel';const pixel=availableEntries().some(d=>d.key==='tex_attribute');stage='vertex';editorTarget='top';const top=availableEntries().some(d=>d.key==='tex_attribute');editorTarget='mat';return {pixel,top};});assert.deepEqual(visibility,{pixel:false,top:false});
  checks.push('entry is available only in MAT Vertex; repeated nodes reuse Tex');
  await page.screenshot({path:path.join(folder,'texture-attribute.png')});assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,checks}));
 }catch(e){await h.finish(e);throw e;}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
