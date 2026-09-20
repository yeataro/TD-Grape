/* Source failures stay visible; missing references cannot be added silently. */
const assert=require('node:assert/strict'),path=require('node:path');
const {harness}=require('./test_glsl_code.cjs');
(async()=>{
 const [source,state,folder]=process.argv.slice(2),h=await harness(source,state,folder,{skipPreview:true}),{page,checks,errors}=h;
 try{
  await page.evaluate(()=>{
   clearTimeout(autoTimer);nativeSourcePolling=uniformPolling=customPolling=true;uniformLive.disconnect();uniformLive.connect=()=>{};
   graph.declarations=[{id:'lost',kind:'uniform',name:'uLost',type:'float',value:0,sourceMissing:true}];
   graph.functions=[];graphTrail=[];graph.stages.pixel={nodes:[testNode('output','pixel_out',400,0)],edges:[]};
   readonly=false;dirty=false;selected=null;selection.clear();selectedInputId=null;
   nativeSourceSnapshot={revision,enabled:true,uniforms:[{...graph.declarations[0],missing:true,components:[]}],issues:[
    {id:'lost',name:'uLost',status:'missing',message:'Native source is missing: uLost'},
    {name:'uBuffer',sequence:'array',index:1,type:'samplerBuffer',status:'unsupported',message:'Texture Buffer access is not supported yet: uBuffer'}]};
   inputCollapsedGroups.delete('uniform');render();workspaceLayout.reveal('uniforms');
  });
  assert.equal(await page.locator('[data-input-source="lost"] .input-source-status').isVisible(),true);
  assert.equal(await page.locator('[data-input-source="lost"] [data-input-reference]').isDisabled(),true);
  await page.evaluate(()=>inputReference('lost'));
  assert.equal(await page.evaluate(()=>current().nodes.length),1);
  checks.push('missing source remains visible and cannot create a new graph reference');
  await page.locator('[data-input-source="lost"] .input-source-select').click();
  assert.equal(await page.evaluate(()=>selectedInputId),'lost');
  assert.equal(await page.locator('#inspector [data-input-reference="lost"]').isDisabled(),true);
  checks.push('missing source can still be selected for inspection and recovery');
  assert.equal(await page.locator('[data-source-issue="uBuffer"] .input-source-status').isVisible(),true);
  assert.match(await page.locator('[data-source-issue="uBuffer"]').innerText(),/samplerBuffer/);
  await page.locator('#inputsearch').fill('uBuffer');
  assert.equal(await page.locator('[data-source-issue="uBuffer"]').count(),1);
  checks.push('unsupported native Texture Buffer is searchable and shows its reason without expanding a card');
  await page.locator('#inputsearch').fill('');
  const titles=[];
  for(const phase of ['source','shader','validation'])titles.push(await page.evaluate(phase=>{setCompileDiagnostics({error:'Test failure',phase},JSON.stringify(graph));return $('#diagnosticbar strong').textContent;},phase));
  assert.equal(new Set(titles).size,3);
  checks.push('source validation, GLSL compilation and general apply failures have distinct headings');
  assert.equal(await page.evaluate(()=>typeDescriptor('float[1000000]').length===1000000&&compositeZeroValue('float[1000000]')===null),true);
  checks.push('large array types do not allocate an element list in the browser');
  await page.evaluate(()=>clearCompileDiagnostics());
  await page.screenshot({path:path.join(folder,'source-states.png')});
  assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,checks}));
 }catch(error){await h.finish(error);throw error;}
})().catch(error=>{console.error(error);process.exitCode=1;});
