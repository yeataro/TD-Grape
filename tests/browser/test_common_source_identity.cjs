/* Common source ownership survives full Shader loads and copied initialization recipes. */
const assert=require('node:assert/strict'),fs=require('node:fs');
const {harness}=require('./test_glsl_code.cjs');
(async()=>{
 const [source,stateFile,folder]=process.argv.slice(2),h=await harness(source,stateFile,folder,{skipPreview:true}),{page,checks,errors}=h;
 try{
  const base=JSON.parse(fs.readFileSync(stateFile,'utf8').replace(/^\uFEFF/,''));
  const scene=await page.evaluate(()=>({declarations:[
   {id:'original',kind:'uniform',name:'uAbsTime',type:'float',value:17,initialDriver:'absTime'},
   {id:'copy',kind:'uniform',name:'uAbsTime_copy1',type:'float',value:23,initialDriver:'absTime'}],
   nodes:[testNode('original-ref','uniform',80,100,{declarationId:'original'}),testNode('copy-ref','uniform',400,100,{declarationId:'copy'})]}));
  const first=structuredClone(base),second=structuredClone(base);
  Object.assign(first.state.graph,{declarations:scene.declarations,functions:[]});first.state.graph.stages.pixel={nodes:scene.nodes,edges:[]};first.target='/fixture/first';
  second.state.graph.declarations=[];second.state.graph.functions=[];second.state.graph.stages.pixel={nodes:[],edges:[]};second.target='/fixture/second';
  let response=first;
  await page.route('**/api/state',route=>route.fulfill({json:response}));
  const reload=async document=>{
   response=document;
   await page.evaluate(async()=>{
    uniformLive.disconnect();uniformLive.connect=()=>{};stage='pixel';await load();
    nativeSourcePolling=uniformPolling=customPolling=true;connectionInterrupted=false;nativeSourceError='';
    nativeSourceSnapshot={revision,enabled:true,uniforms:graph.declarations.map(d=>({...d,sequence:'vec',components:[{value:d.value,mode:'EXPRESSION',expression:'absTime.seconds * 2',writable:false}]})),issues:[]};
    renderNativeSources();workspaceLayout.reveal('uniforms');
   });
  };
  await reload(first);
  const card=page.locator('[data-preset="absTime"]');
  assert.equal(await card.getAttribute('data-input-source'),'original');
  assert.equal(await card.getAttribute('data-source-state'),'ready');
  assert.equal(await page.locator('[data-input-group="uniform"] [data-input-source="copy"]').count(),1);
  assert.equal(await page.locator('[data-input-group="uniform"] [data-input-source="original"]').count(),0);
  await page.selectOption('#sourcenames','common');
  assert.equal(await page.locator('[data-node="original-ref"] .node-function-title').innerText(),'Absolute Time');
  assert.equal(await page.locator('[data-node="copy-ref"] .node-function-title').innerText(),'uAbsTime_copy1');
  checks.push('a native-name owner and an independent copy sharing its initialization recipe are not a conflict; only the owner gets the common label');
  await reload(second);assert.equal(await card.getAttribute('data-dormant'),'true');
  await reload(first);assert.equal(await card.getAttribute('data-input-source'),'original');assert.equal(await card.getAttribute('data-source-state'),'ready');
  await reload(first);assert.equal(await card.getAttribute('data-input-source'),'original');
  checks.push('switching away, returning, and reloading rebuild the same source ownership from declarations');
  const before=await page.evaluate(()=>JSON.stringify(graph.declarations));
  await card.locator('.input-reference').click();
  assert.equal(await page.evaluate(()=>JSON.stringify(graph.declarations)),before);
  assert.equal(await page.evaluate(()=>current().nodes.filter(n=>n.params.declarationId==='original').length),2);
  assert.equal(await card.locator('[data-component-mode-label]').innerText(),'Expression: absTime.seconds * 2');
  checks.push('another reference reuses the original entity without resetting its edited driver, value, or creating a declaration');
  await page.evaluate(()=>{clearTimeout(autoTimer);current().nodes=[];current().edges=[];render();});
  assert.equal(await card.getAttribute('data-input-source'),'original');assert.equal(await card.getAttribute('data-source-state'),'ready');
  checks.push('source existence is independent of canvas reference count');
  const renamed=structuredClone(first);renamed.state.graph.declarations=[{...scene.declarations[0],name:'uClock'}];renamed.state.graph.stages.pixel.nodes=[scene.nodes[0]];
  await reload(renamed);assert.equal(await card.getAttribute('data-input-source'),'original');
  assert.equal(await page.evaluate(()=>inputPresetSource('preset:absTime').id),'original');
  checks.push('a uniquely identifiable renamed source is consistently reused');
  for(const declarations of [
   [{...scene.declarations[0],type:'vec2'},scene.declarations[1]],
   [{...scene.declarations[0],name:'uClock'},scene.declarations[1]],
   [scene.declarations[0],{...scene.declarations[1],name:'uAbsTime'}]
  ]){
   await page.evaluate(declarations=>{graph.declarations=declarations;renderNativeSources();},declarations);
   assert.equal(await card.getAttribute('data-source-state'),'conflict');assert.equal(await card.locator('.input-reference').isDisabled(),true);
   assert.equal(await page.evaluate(()=>{const before=JSON.stringify(graph.declarations);let failed=false;try{createInputDeclaration('uniform','float',{preset:'absTime'});}catch{failed=true;}return failed&&before===JSON.stringify(graph.declarations)&&inputPresetSource('preset:absTime')===null;}),true);
  }
  checks.push('wrong types, ambiguous renamed candidates and duplicate exact names remain blocked without modifying source data');
  assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,count:checks.length}));
 }catch(e){await h.finish(e);throw e;}
})().catch(e=>{console.error(e);process.exitCode=1;});
