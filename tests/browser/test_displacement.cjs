/* Independent editor fixture: Vertex availability, normal import/edit/Undo paths. */
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),{execFileSync}=require('node:child_process');
const {harness}=require('./test_glsl_code.cjs');
(async()=>{
 const[source,fixture,folder]=process.argv.slice(2),h=await harness(source,fixture,folder,{skipPreview:true}),{page,settle,checks,errors}=h;
 try{
  await page.selectOption('#language','en');
  const visible=await page.evaluate(()=>{
   clearTimeout(autoTimer);scheduleGraphApply=()=>{};connectionInterrupted=true;readonly=historyBusy=nativeMutationBusy=false;
   graphTrail=[];graph.functions=[];graph.declarations=[];past=[];future=[];
   graph.stages={vertex:{nodes:[],edges:[]},pixel:{nodes:[],edges:[]}};graph.target='mat';
   return ['mat','top'].flatMap(target=>['pixel','vertex'].map(st=>{editorTarget=target;stage=st;return {target,stage:st,entries:availableEntries().map(d=>({key:d.key,label:d.label}))};}));
  });
  for(const row of visible){assert.equal(row.entries.some(d=>d.label==='Displacement'),row.target==='mat'&&row.stage==='vertex');if(row.target==='mat')assert.ok(row.entries.some(d=>d.key==='sampler'));}
  checks.push('Displacement is MAT Vertex-only; custom Sampler is offered in both MAT stages');
  const browsing=await page.evaluate(()=>{
   editorTarget='mat';stage='vertex';
   const entries=availableEntries().map(d=>({d,meta:browserMeta(d)}));
   const inResults=options=>browseEntries(entries,options.query||'',options).some(e=>e.d.label==='Displacement');
   return {vector:inResults({tab:'categories',category:'vector',source:'all'}),uncategorized:inResults({tab:'categories',category:'uncategorized',source:'all'}),height:inResults({query:'height',source:'all'})};
  });
  assert.deepEqual(browsing,{vector:true,uncategorized:false,height:true});
  checks.push('The shipped browser lists Displacement under Vector, not Uncategorized, and finds it by height');
  const ids=await page.evaluate(()=>{
   editorTarget='mat';stage='vertex';setUIExperiments({canvasDamping:false,frameDamping:false});render();
   const add=(entry,x,y)=>{let n;change(()=>{n=instantiate(entry,x,y);});return current().nodes.at(-1).id;};
   const displace=add(availableEntries().find(d=>d.label==='Displacement'),900,120);
   const sampler=add(availableEntries().find(d=>d.key==='sampler'),30,120);
   const sample=add(availableEntries().find(d=>d.key==='texture_lod_2d'),320,120);
   const channel=testNode('height_channel','swizzle',610,120,{type:'vec4',mask:'x'});change(()=>current().nodes.push(channel));
   connectPorts({node:sampler,kind:'outputs',port:'out'},{node:sample,kind:'inputs',port:'sampler'});
   connectPorts({node:sample,kind:'outputs',port:'out'},{node:channel.id,kind:'inputs',port:'value'});
   connectPorts({node:channel.id,kind:'outputs',port:'out'},{node:displace,kind:'inputs',port:'height'});
   selected=displace;selection=new Set([displace]);render();scale=.8;pan={x:30,y:50};transform();
   return {displace,sampler,sample};
  });await settle();
  const ports=await page.evaluate(id=>{const n=current().nodes.find(n=>n.id===id);return {inputs:Object.keys(definition(n).inputs).map(p=>portLabel(n,'inputs',p)),outputs:Object.keys(definition(n).outputs).map(p=>portLabel(n,'outputs',p)),edges:current().edges.length};},ids.displace);
  assert.deepEqual(ports.inputs,['Position','Normal','Height','Scale','Midlevel']);assert.deepEqual(ports.outputs,['Position']);assert.equal(ports.edges,3);
  checks.push('Vertex Sampler connects through textureLod and R to Height; five public inputs and Position output display correctly');
  await page.screenshot({path:path.join(folder,'displacement.png')});
  await page.locator(`.node[data-node="${ids.displace}"] .node-title`).dblclick();await settle();
  assert.equal(await page.evaluate(()=>current().nodes.length),7);
  await page.evaluate(()=>change(()=>current().nodes.find(n=>n.id==='unit').name='Surface_Direction'));await settle();
  assert.equal(await page.evaluate(()=>currentFunction().scope),'local');
  assert.equal(await page.evaluate(()=>functionLibrary.find(f=>f.name==='Displacement').graph.nodes.find(n=>n.id==='unit').name),'Unit_Normal');
  await page.evaluate(()=>undo());await settle();
  assert.equal(await page.evaluate(id=>FunctionModel.find(graph,graph.stages.vertex.nodes.find(n=>n.id===id).params.functionId).graph.nodes.find(n=>n.id==='unit').name,ids.displace),'Unit_Normal');
  checks.push('The seven-node Subgraph opens, localizes on edit and supports Undo without changing its library source');
  await page.evaluate(()=>navigateGraph(0));await settle();
  const graph=await page.evaluate(()=>clone(graph));fs.writeFileSync(path.join(folder,'created.graph.json'),JSON.stringify(graph));
  execFileSync(process.env.PYTHON_EXECUTABLE||'python',['-B','-c',
   'import json,sys;sys.path.insert(0,sys.argv[1]);import sgrape_core as c;g=json.load(sys.stdin);base=c.demo_graph("color","mat");base["functions"]=g["functions"];base["declarations"]=g["declarations"];base["stages"]["vertex"]["nodes"]+=g["stages"]["vertex"]["nodes"];base["stages"]["vertex"]["edges"]+=g["stages"]["vertex"]["edges"];c.compile_graph(base)',
   path.resolve(__dirname,'../../src/core')],{input:JSON.stringify(graph)});
  checks.push('The editor-created resource and Subgraph snapshots serialize and compile');
  assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,checks}));
 }catch(error){await h.finish(error);throw error;}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
