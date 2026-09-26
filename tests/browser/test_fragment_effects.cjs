/* Four fragment nodes in the real editor, served by an isolated fixture. */
const assert=require('node:assert/strict'),path=require('node:path');
const {harness}=require('./test_glsl_code.cjs');
(async()=>{
 const[source,state,folder]=process.argv.slice(2),h=await harness(source,state,folder,{skipPreview:true}),{page,checks,errors,settle}=h;
 try{
  await page.evaluate(()=>{
   nativeSourcePolling=uniformPolling=customPolling=true;uniformLive.disconnect();uniformLive.connect=()=>{};
   clearTimeout(autoTimer);scheduleGraphApply=()=>{};readonly=conflicted=connectionInterrupted=dirty=false;
   stage='pixel';graphTrail=[];past=[];future=[];graph.declarations=[];graph.functions=[];
   graph.stages.pixel={nodes:[testNode('pixel','pixel_out',800,320)],edges:[]};render();
   for(const [index,key] of ['discard','depth_out','td_alpha_test','td_dither'].entries())addNode(catalog.find(d=>d.key===key),80+index*220,200);
   scale=.75;pan={x:20,y:10};transform();
  });await settle();
  assert.deepEqual(await page.evaluate(()=>['discard','depth_out','td_alpha_test','td_dither'].filter(key=>!availableEntries().some(d=>d.key===key))),[]);
  assert.deepEqual(await page.evaluate(()=>{const old=editorTarget;editorTarget='top';try{return ['discard','depth_out','td_alpha_test','td_dither'].filter(key=>availableEntries().some(d=>d.key===key));}finally{editorTarget=old;}}),['discard']);
  checks.push('Add Node exposes all four MAT entries and only Discard for TOP');
  const nodes=await page.evaluate(()=>Object.fromEntries(current().nodes.map(n=>[definition(n).key,n.id])));
  for(const key of ['discard','depth_out','td_alpha_test']){
   assert.equal(await page.locator(`#cards [data-node="${nodes[key]}"] .port[data-kind="outputs"]`).count(),0);
   assert.equal(await page.locator(`#cards [data-node="${nodes[key]}"] .port[data-kind="inputs"]`).count(),1);
  }
  assert.equal(await page.locator(`#cards [data-node="${nodes.td_dither}"] .port[data-kind="outputs"]`).count(),1);
  checks.push('Terminal nodes have one input and no output; TDDither retains its vec4 output');
  await page.evaluate(id=>{selectNode(current().nodes.find(n=>n.id===id));inspectorTab='parameters';inspector();},nodes.depth_out);
  assert.match(await page.locator('[data-depth-warning]').innerText(),/early depth/i);
  for(const lang of ['zh-Hant','ja','fr','ko','en']){
   await page.evaluate(lang=>setLanguage(lang),lang);await settle();
   assert.ok((await page.locator('[data-depth-warning]').innerText()).length>15);
   assert.ok((await page.locator('#inspector').innerText()).includes('gl_FragCoord.z'));
   assert.ok(!(await page.locator('#inspector').innerText()).includes('lighting.automatic.depth'));
  }
  checks.push('Depth Output inspector exposes the Early-Z cost warning');
  await page.evaluate(async()=>{await undo();});assert.equal(await page.evaluate(()=>current().nodes.some(n=>definition(n).key==='td_dither')),false);
  await page.evaluate(async()=>{await undo(true);});assert.equal(await page.evaluate(()=>current().nodes.some(n=>definition(n).key==='td_dither')),true);
  checks.push('Creation uses ordinary Undo and Redo');
  assert.equal(await page.evaluate(id=>{
   const packet=GraphClipboard.decode(GraphClipboard.encode(graph,current(),[id],'source'));
   const destination=clone(graph);destination.stages.pixel={nodes:[],edges:[]};
   GraphClipboard.paste(destination,destination.stages.pixel,packet,{source:'destination',stage:'pixel',target:'mat',types:['float','vec4','bool'],catalog,anchor:{x:0,y:0}});
   return destination.stages.pixel.nodes.some(n=>n.definitionUuid==='sgrape.builtin.depth_out');
  },nodes.depth_out),true);checks.push('Depth Output can be copied as an ordinary terminal, without being mistaken for a stage boundary');
  await page.evaluate(ids=>{
   const a=current().nodes.find(n=>n.id===ids.td_alpha_test),b=current().nodes.find(n=>n.id===ids.discard);
   addNode(catalog.find(d=>d.key==='scalar'),60,470);const scalar=current().nodes.find(n=>definition(n).key==='scalar');scalar.params.type='bool';scalar.params.value=true;
   connectPorts({node:scalar.id,port:'out',kind:'outputs',type:'bool'},{node:b.id,port:'condition',kind:'inputs',type:'bool'});render();
  },nodes);
  assert.equal(await page.evaluate(id=>current().edges.some(e=>e.to[0]===id),nodes.discard),true);
  checks.push('A bool source connects to the terminal using ordinary editor wiring');
  await page.evaluate(id=>{selectNode(current().nodes.find(n=>n.id===id));inspectorTab='parameters';render();},nodes.depth_out);await settle();
  await page.screenshot({path:path.join(folder,'fragment-nodes.png')});
  await page.setViewportSize({width:430,height:900});await page.evaluate(()=>workspaceLayout.setFloatingParameter(true));await settle();
  assert.equal(await page.locator('#floatingparameters [data-depth-warning]').count(),1);
  await page.screenshot({path:path.join(folder,'fragment-mobile.png')});checks.push('Depth warning remains available in the floating parameter pane on a narrow viewport');
  assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,count:checks.length}));
 }catch(error){await h.finish(error);throw error;}
})();
