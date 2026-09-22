const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),{execFileSync}=require('node:child_process');
const {harness}=require('./test_glsl_code.cjs');
(async()=>{
 const[source,base,folder]=process.argv.slice(2);fs.mkdirSync(folder,{recursive:true});const fixture=path.join(folder,'state.json');
 execFileSync(process.env.PYTHON_EXECUTABLE||'python',[path.join(__dirname,'export_editor_fixture.py'),base,fixture]);
 const h=await harness(source,fixture,folder,{skipPreview:true}),{page,checks,errors,settle}=h;
 try{
  await page.selectOption('#language','en');
  await page.evaluate(()=>{clearTimeout(autoTimer);scheduleGraphApply=()=>{};connectionInterrupted=true;readonly=false;historyBusy=false;nativeMutationBusy=false;graphTrail=[];editorTarget='mat';graph.target='mat';graph.declarations=[];stage='pixel';past=[];future=[];selected=null;selection.clear();graph.stages.vertex={nodes:[testNode('vertex','vertex_out',650,80)],edges:[]};render();});
  for(const mode of ['lod','size']){
   const key='td_projtexture_'+mode;
   const visibility=await page.evaluate(({key,mode})=>{editorTarget='mat';stage='pixel';const found=browseEntries(browserIndex(),mode==='lod'?'TDProjTextureLod':'TDProjTextureSize',{source:'all'}).some(e=>e.d.key===key);const allowed=availableEntries().some(d=>d.key===key);stage='vertex';const vertex=availableEntries().some(d=>d.key===key);stage='pixel';editorTarget='top';const top=availableEntries().some(d=>d.key===key);editorTarget='mat';return{found,allowed,vertex,top};},{key,mode});
   assert.deepEqual(visibility,{found:true,allowed:true,vertex:false,top:false});
   await page.evaluate(({key,mode})=>{
    graph.stages.pixel={nodes:[testNode('pixel','pixel_out',800,80)],edges:[]};render();
    const make=(key,x)=>{instantiate(catalog.find(d=>d.key===key),x,80);return current().nodes.find(n=>n.id===selected);};
    const wire=(a,b,port)=>connectPorts({node:a.id,port:'out',kind:'outputs'},{node:b.id,port,kind:'inputs'});
    change(()=>{
     const call=make(key,100),output=current().nodes.find(n=>n.id==='pixel');call.inputValues=mode==='lod'?{light:1,lod:2,uv:[.25,.5]}:{light:1};
     if(mode==='lod')wire(call,output,'color');
     else{const cast=make('convert',300);cast.params.fromType='ivec3';cast.params.toType='vec3';const rgba=make('combine',500);rgba.params.type='vec4';rgba.params.groups={x:'vec3'};rgba.params.components=[0,0,0,1];wire(call,cast,'value');wire(cast,rgba,'x');wire(rgba,output,'color');}
    });
   },{key,mode});await settle();
   const graph=await page.evaluate(()=>graph);
   execFileSync(process.env.PYTHON_EXECUTABLE||'python',['-c','import json,sys;sys.path.insert(0,sys.argv[1]);import sgrape_core as c;r=c.compile_graph(json.load(sys.stdin));assert sys.argv[2]+"(" in r["pixel"]',path.resolve(__dirname,'../../src/core'),mode==='lod'?'TDProjTextureLod':'TDProjTextureSize'],{input:JSON.stringify(graph)});
   checks.push(key+': stage-aware search and connected UI-created graph compile');
  }
  assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,checks}));
 }catch(e){await h.finish(e);throw e;}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
