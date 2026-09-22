const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),{execFileSync}=require('node:child_process');
const {harness}=require('./test_glsl_code.cjs');
(async()=>{
 const[source,base,folder]=process.argv.slice(2);fs.mkdirSync(folder,{recursive:true});const fixture=path.join(folder,'state.json');
 execFileSync(process.env.PYTHON_EXECUTABLE||'python',[path.join(__dirname,'export_editor_fixture.py'),base,fixture]);
 const h=await harness(source,fixture,folder,{skipPreview:true}),{page,checks,errors,settle}=h;
 try{
  await page.selectOption('#language','en');
  await page.evaluate(()=>{clearTimeout(autoTimer);scheduleGraphApply=()=>{};connectionInterrupted=true;readonly=false;historyBusy=false;nativeMutationBusy=false;graphTrail=[];editorTarget='mat';graph.target='mat';graph.declarations=[];stage='pixel';past=[];future=[];selected=null;selection.clear();graph.stages.vertex={nodes:[testNode('vertex','vertex_out',650,80)],edges:[]};graph.stages.pixel={nodes:[testNode('pixel','pixel_out',650,80)],edges:[]};render();});
  for(const [key,availableStage,query] of [['td_convert_color_space','pixel','TDConvertColorSpace'],['td_instance_color_current','vertex','TDInstanceColor'],['td_instance_color_pixel','pixel','TDInstanceColor']]){
   const visibility=await page.evaluate(({key,availableStage,query})=>{stage=availableStage;const found=browseEntries(browserIndex(),query,{source:'all'}).some(e=>e.d.key===key);const allowed=availableEntries().some(d=>d.key===key);stage=availableStage==='vertex'?'pixel':'vertex';const other=availableEntries().some(d=>d.key===key);stage=availableStage;return{found,allowed,other};},{key,availableStage,query});
   assert.deepEqual(visibility,{found:true,allowed:true,other:false});
  }
  await page.evaluate(()=>{stage='pixel';render();change(()=>instantiate(catalog.find(d=>d.key==='td_convert_color_space'),200,80));window.conversionId=selected;const n=current().nodes.find(n=>n.id===selected);n.inputValues={color:[.2,.4,.8,.75]};connectPorts({node:n.id,port:'out',kind:'outputs'},{node:'pixel',port:'color',kind:'inputs'});});await settle();
  const graph=await page.evaluate(()=>graph);execFileSync(process.env.PYTHON_EXECUTABLE||'python',['-c','import json,sys;sys.path.insert(0,sys.argv[1]);import sgrape_core as c;g=json.load(sys.stdin);r=c.compile_graph(g);assert "#include <TDColorSpace>" in r["pixel"];assert "TDConvertColorSpace(" in r["pixel"]',path.resolve(__dirname,'../../src/core')],{input:JSON.stringify(graph)});
  checks.push('native conversion and both instance-color nodes are searchable only in their supported MAT stage');
  checks.push('actual UI-created conversion graph compiles with the required header and connected output');
  const sources=await page.evaluate(()=>{const def=catalog.find(d=>d.key==='builtin_source');stage='vertex';const vertex=builtinSourceEntries(def).map(d=>d.defaults.source);stage='pixel';const pixel=builtinSourceEntries(def).map(d=>d.defaults.source);editorTarget='top';const top=builtinSourceEntries(def).map(d=>d.defaults.source);editorTarget='mat';return{vertex,pixel,top};});
  for(const name of ['TDColor','TDInstanceIndex']){assert.ok(sources.vertex.includes(name));assert.ok(!sources.pixel.includes(name));assert.ok(!sources.top.includes(name));}
  assert.ok(sources.pixel.includes('TDScreenSpaceCoord'));assert.ok(!sources.vertex.includes('TDScreenSpaceCoord'));assert.ok(!sources.top.includes('TDScreenSpaceCoord'));
  checks.push('all three sources are exposed in the appropriate MAT stage and excluded from TOP');
  assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,checks}));
 }catch(e){await h.finish(e);throw e;}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
