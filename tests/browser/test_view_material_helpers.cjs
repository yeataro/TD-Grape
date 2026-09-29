/* Actual library navigation, ports and editable snapshots in an isolated editor. */
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),{execFileSync}=require('node:child_process');
const {harness}=require('./test_glsl_code.cjs');
(async()=>{
 const[source,fixture,folder]=process.argv.slice(2),h=await harness(source,fixture,folder,{skipPreview:true}),{page,settle,checks,errors}=h;
 const names=['View Direction','Fresnel','Facing','Mapping'];
 try{
  await page.selectOption('#language','en');
  const entries=await page.evaluate(names=>{
   clearTimeout(autoTimer);scheduleGraphApply=()=>{};connectionInterrupted=true;readonly=historyBusy=nativeMutationBusy=false;
   graphTrail=[];graph.functions=[];graph.declarations=[];past=[];future=[];
   graph.stages={vertex:{nodes:[],edges:[]},pixel:{nodes:[],edges:[]}};graph.target='mat';
   return [['mat','vertex'],['mat','pixel'],['top','pixel']].map(([target,st])=>{
    editorTarget=target;stage=st;
    return {target,stage:st,names:availableEntries().filter(d=>names.includes(d.label)).map(d=>d.label)};
   });
  },names);
  for(const e of entries)assert.deepEqual(e.names.sort(),names.filter(n=>e.target==='mat'||n!=='View Direction').sort());
  checks.push('View Direction is MAT-only; Fresnel, Facing and Mapping appear in TOP Pixel and both MAT stages');
  const meta=await page.evaluate(names=>{
   editorTarget='mat';stage='pixel';
   return availableEntries().filter(d=>names.includes(d.label)).map(d=>({name:d.label,category:browserMeta(d).category}));
  },names);
  for(const m of meta)assert.equal(m.category,['View Direction','Mapping'].includes(m.name)?'vector':'shader');
  checks.push('The actual shipped menu groups camera/mapping in Vector and angle weights in Shader');
  const ids=await page.evaluate(names=>{
   setUIExperiments({canvasDamping:false,frameDamping:false});render();
   const ids={};names.forEach((name,i)=>{change(()=>instantiate(availableEntries().find(d=>d.label===name),30+360*i,140));ids[name]=current().nodes.at(-1).id;});
   for(const name of ['Fresnel','Facing'])connectPorts({node:ids['View Direction'],kind:'outputs',port:'direction'},{node:ids[name],kind:'inputs',port:'viewDirection'});
   scale=.60;pan={x:30,y:40};transform();render();return ids;
  },names);await settle();
  const inputs=await page.evaluate(ids=>Object.fromEntries(Object.entries(ids).map(([name,id])=>{const n=current().nodes.find(n=>n.id===id);return[name,Object.keys(definition(n).inputs).map(p=>portLabel(n,'inputs',p))];})),ids);
  assert.deepEqual(inputs,{'View Direction':['Position','Camera'],Fresnel:['Normal','View Direction','IOR'],Facing:['Normal','View Direction'],Mapping:['Vector','Translation','Rotation','Scale']});
  assert.equal(await page.evaluate(()=>current().edges.length),2);
  await page.screenshot({path:path.join(folder,'helpers.png')});
  checks.push('All four instantiate with correct ports; Direction connects to Fresnel and Facing');
  for(const name of names){
   await page.locator(`.node[data-node="${ids[name]}"] .node-title`).dblclick();await settle();
   const before=await page.evaluate(()=>({count:current().nodes.length,scope:currentFunction().scope,id:current().nodes[1].id,name:current().nodes[1].name}));
   assert.ok(before.count>4);assert.equal(before.scope,'library');
   await page.evaluate(id=>change(()=>current().nodes.find(n=>n.id===id).name='Edited_Helper'),before.id);await settle();
   assert.equal(await page.evaluate(()=>currentFunction().scope),'local');
   assert.notEqual(await page.evaluate(({name,id})=>functionLibrary.find(f=>f.name===name).graph.nodes.find(n=>n.id===id).name,{name,id:before.id}),'Edited_Helper');
   await page.evaluate(()=>undo());await settle();
   assert.equal(await page.evaluate(({call,id})=>FunctionModel.find(graph,graph.stages.pixel.nodes.find(n=>n.id===call).params.functionId).graph.nodes.find(n=>n.id===id).name,{call:ids[name],id:before.id}),before.name);
   await page.evaluate(()=>{navigateGraph(0);scale=.60;pan={x:30,y:40};transform();});await settle();
  }
  checks.push('Every helper opens as an ordinary graph, localizes on edit and restores with Undo');
  const graph=await page.evaluate(()=>clone(graph));fs.writeFileSync(path.join(folder,'created.graph.json'),JSON.stringify(graph));
  execFileSync(process.env.PYTHON_EXECUTABLE||'python',['-B','-c',
   'import json,sys;sys.path.insert(0,sys.argv[1]);import sgrape_core as c;g=json.load(sys.stdin);base=c.demo_graph("color","mat");base["functions"]=g["functions"];base["stages"]["pixel"]["nodes"]+=g["stages"]["pixel"]["nodes"];base["stages"]["pixel"]["edges"]+=g["stages"]["pixel"]["edges"];c.compile_graph(base)',
   path.resolve(__dirname,'../../src/core')],{input:JSON.stringify(graph)});
  checks.push('Editor-created graph and function snapshots serialize and compile');
  assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,checks}));
 }catch(error){await h.finish(error);throw error;}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
