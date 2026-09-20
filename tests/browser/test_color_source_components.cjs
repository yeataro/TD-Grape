/* Color-source labels share the fixed Color RGBA naming convention; port IDs stay XYZW. */
const assert=require('node:assert/strict'),path=require('node:path');
const {harness}=require('./test_glsl_code.cjs');
(async()=>{
 const [source,state,folder]=process.argv.slice(2),h=await harness(source,state,folder,{skipPreview:true}),{page,checks,errors,settle}=h;
 const labels=id=>page.locator(`#cards [data-node="${id}"] .output .port-label`).allTextContents();
 try{
  await page.evaluate(()=>{
   clearTimeout(autoTimer);connectionInterrupted=conflicted=true;readonly=false;historyBusy=nativeMutationBusy=false;graphTrail=[];graph.functions=[];stage='pixel';selectedInputId=null;
   nativeSourceSnapshot=null;nativeSourcePolling=uniformPolling=customPolling=true;uniformLive.disconnect();uniformLive.connect=()=>{};
   graph.declarations=[{id:'color_source',kind:'uniform',name:'uColor',type:'vec4',nativeSequence:'color',value:null},{id:'vector_source',kind:'uniform',name:'uColorNameOnly',type:'vec4',value:null}];
   const color=testNode('color','uniform',40,60,{declarationId:'color_source'}),vector=testNode('vector','uniform',40,330,{declarationId:'vector_source'}),fixed=testNode('fixed','color',40,570),split=testNode('old','vector_split',360,60,{type:'vec4'});
   split.ui.componentNames='xyzw';graph.stages.pixel={nodes:[color,vector,fixed,split],edges:[{from:['color','out'],to:['old','value']}]};
   selected=null;selection.clear();past=[];future=[];dirty=false;rememberSavedGraph(graph);setUIExperiments({rgbaComponentTint:true,vectorComponentTint:false});render();scale=.8;pan={x:25,y:30};transform();window.beforeNames=JSON.stringify(graph);
  });
  assert.deepEqual(await labels('old'),['X','Y','Z','W']);
  assert.deepEqual(await page.locator('#cards [data-node="old"] .output .port').evaluateAll(es=>es.map(e=>e.dataset.port)),['x','y','z','w']);
  assert.deepEqual(await page.locator('#cards [data-node="old"] .output').evaluateAll(es=>es.map(e=>e.dataset.colorComponent||null)),[null,null,null,null]);
  assert.equal(await page.evaluate(()=>JSON.stringify(graph)===beforeNames&&!past.length&&!dirty),true);
  await page.evaluate(()=>{graph=JSON.parse(JSON.stringify(graph));render();});assert.deepEqual(await labels('old'),['X','Y','Z','W']);
  checks.push('existing Split naming choices remain unchanged through render/reload, without polling, graph/history edits or changing socket IDs');
  await page.evaluate(()=>{current().edges=[];current().nodes=current().nodes.filter(n=>n.id!=='old');past=[];future=[];render();addVectorSplit(current().nodes.find(n=>n.id==='color'),'out');});await settle();
  const made=await page.evaluate(()=>({id:selected,names:current().nodes.find(n=>n.id===selected).ui.componentNames,expanded:current().nodes.find(n=>n.id===selected).ui.componentsExpanded,history:past.length}));
  assert.equal(made.names,'rgba');assert.equal(made.expanded,true);assert.equal(made.history,1);assert.deepEqual(await labels(made.id),['R','G','B','A']);
  await page.evaluate(()=>undo());assert.equal(await page.locator(`[data-node="${made.id}"]`).count(),0);await page.evaluate(()=>undo(true));assert.deepEqual(await labels(made.id),['R','G','B','A']);
  await page.evaluate(()=>addVectorSplit(current().nodes.find(n=>n.id==='color'),'out'));assert.equal(await page.evaluate(()=>past.length),1);assert.equal(await page.evaluate(()=>selected),made.id);
  checks.push('automatic Split matches Color RGBA labels/expansion, is one Undo/Redo, and reuses an existing Split');
  await page.evaluate(()=>{inspectorTab='settings';inspector();});
  const names=page.locator('#inspector select').filter({has:page.locator('option[value=rgba]')});await names.selectOption('xyzw');assert.deepEqual(await labels(made.id),['X','Y','Z','W']);await page.evaluate(()=>undo());assert.deepEqual(await labels(made.id),['R','G','B','A']);
  checks.push('manually selecting XYZW on a Color-connected Split remains effective and Undo restores RGBA');
  for(const [id,expected] of [['vector','xyzw'],['fixed','rgba']]){
   const created=await page.evaluate(id=>{addVectorSplit(current().nodes.find(n=>n.id===id),'out');return{id:selected,names:current().nodes.find(n=>n.id===selected).ui.componentNames};},id);
   assert.equal(created.names,expected);assert.deepEqual(await labels(created.id),expected.toUpperCase().split(''));
  }
  checks.push('ordinary vec4 Uniforms remain XYZW even with a color-like name; fixed Color RGBA retains its behavior');
  await page.evaluate(()=>{const r=$('#canvas').getBoundingClientRect();openCreator(r.left+200,r.top+200,{node:'color',port:'out',type:'vec4',kind:'outputs'});});
  await page.locator('#createsearch').fill('Split');await page.locator('[data-create-entry="vector_split"]').click();await settle();
  const creator=await page.evaluate(()=>({id:selected,names:current().nodes.find(n=>n.id===selected).ui.componentNames}));assert.equal(creator.names,'rgba');assert.deepEqual(await labels(creator.id),['R','G','B','A']);
  checks.push('drag-wire creator uses the same Color Uniform naming as the automatic Split action');
  await page.evaluate(()=>{readonly=true;render();});assert.deepEqual(await labels(creator.id),['R','G','B','A']);
  await page.screenshot({path:path.join(folder,'color-source-splits.png')});assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,checks}));
 }catch(e){await h.finish(e);throw e;}
})().catch(e=>{console.error(e);process.exitCode=1;});
