/* Source inventory presentation; no TD edits. */
const assert=require('node:assert/strict'),path=require('node:path');
const{harness}=require('./test_glsl_code.cjs');
(async()=>{
 const[source,state,folder]=process.argv.slice(2),h=await harness(source,state,folder,{skipPreview:true}),{page,checks,errors}=h;
 try{
  await page.evaluate(()=>{
   nativeSourcePolling=uniformPolling=customPolling=true;uniformLive.disconnect();uniformLive.connect=()=>{};
   graph.declarations=[{id:'time',name:'uAbsTime',initialDriver:'absTime',kind:'uniform',type:'float',value:null},{id:'tint',name:'uTint',kind:'uniform',type:'vec4',nativeSequence:'color',value:null},{id:'lost',name:'uLost',kind:'uniform',type:'float',value:null,sourceMissing:true}];
   graph.stages.pixel={nodes:[testNode('out','pixel_out',500,50)],edges:[]};stage='pixel';graphTrail=[];graph.functions=[];
   nativeSourceSnapshot={enabled:true,revision,uniforms:graph.declarations.map(d=>({...d,missing:!!d.sourceMissing,sequence:d.nativeSequence||'vec',components:[0,1,2,3].map(i=>({value:.5,mode:d.id==='time'?'EXPRESSION':'CONSTANT',expression:d.id==='time'?'absTime.seconds':'',writable:d.id!=='time'}))})),issues:[]};
   nativeSourceError='';readonly=dirty=connectionInterrupted=false;selected=null;selection.clear();selectedInputId=null;past=[];future=[];inputCollapsedGroups.clear();render();workspaceLayout.reveal('uniforms');window.before=JSON.stringify(graph);
  });
  const time=page.locator('[data-input-source="time"]'),head=time.locator('.source-card-head'),type=time.locator('.input-source-select small');
  assert.deepEqual(await page.locator('[data-input-group="common.coordinates"] > .input-group-title .source-count').evaluateAll(es=>es.map(e=>[e.dataset.category,e.textContent])),[['attribute','1'],['builtin','2']]);
  assert.deepEqual(await page.locator('[data-input-group="common"] > .input-group-title .source-count').evaluateAll(es=>es.map(e=>[e.dataset.category,e.textContent])),[['uniform','1'],['attribute','1'],['builtin','8']]);
  assert.equal(await page.locator('[data-input-group="uniform"] > .input-group-title .source-count').innerText(),'1');
  checks.push('mixed Coordinates and parent totals split by actual card category; missing and dormant sources do not count');
  // Use the first uninitialized preset; internal preset IDs are catalog data.
  const dim=page.locator('[data-dormant="true"]').first();assert.equal(await dim.locator('.source-card-head').evaluate(e=>getComputedStyle(e).opacity),'0.33');
  await dim.locator('.source-card-toggle').click();assert.ok((await dim.locator('.source-card-body').innerText()).length>10);assert.equal(await dim.locator('.source-card-outputs').count(),0);
  assert.equal(await time.locator('.source-card-meta').count(),0);assert.equal(await time.locator('[data-component-mode-label]').innerText(),'Expression: absTime.seconds');
  await time.locator('.input-source-select').click();assert.match(await page.locator('#nodehelp').innerText(),/TD · Vectors/);
  checks.push('uninitialized cards dim to 33% and retain explanatory body; established cards show controls with metadata in Help');
  const expanded=(await head.boundingBox()).height;assert.equal(await type.isVisible(),false);assert.equal(await time.locator('.source-card-outputs .port-type').innerText(),'float');
  await time.locator('.source-card-toggle').click();assert.equal(await type.isVisible(),true);assert.ok((await head.boundingBox()).height>expanded);assert.equal(await time.locator('.source-card-outputs').isVisible(),false);
  await time.locator('.source-card-toggle').click();assert.equal(await type.count(),1);assert.equal(await type.isVisible(),false);
  assert.equal(await page.evaluate(()=>JSON.stringify(graph)===before&&!dirty&&!past.length),true);
  await page.evaluate(()=>{nativeSourceSnapshot.uniforms[0].components[0].expression='absTime.seconds'+' + 0'.repeat(80);renderNativeSourceValues();});
  const bounds=await time.evaluate(e=>({w:e.clientWidth,scroll:e.scrollWidth}));assert.ok(bounds.scroll<=bounds.w+1,JSON.stringify(bounds));
  assert.equal(await page.locator('#inspector [data-component-mode-label]').evaluate(e=>getComputedStyle(e).whiteSpace),'normal');
  checks.push('expanded title is shorter with type at output; collapsed title retains type, and long expressions fit with full Parameter text');
  await page.evaluate(()=>{readonly=true;renderNativeSources();});assert.equal(await time.locator('[data-source-output]').isDisabled(),true);
  await page.evaluate(()=>{readonly=false;connectionInterrupted=true;renderNativeSources();});
  // Reference insertion uses the same existing action as the + control.
  await page.evaluate(()=>{connectionInterrupted=false;renderNativeSources();});await time.locator('[data-source-output]').click();
  assert.equal(await page.evaluate(()=>current().nodes.filter(n=>n.params.declarationId==='time').length),1);assert.equal(await page.evaluate(()=>graph.declarations.length),3);
  const reference=page.locator('#cards .node').filter({has:page.locator('[data-native-source="time"]')});assert.ok((await reference.boundingBox()).width<400);
  checks.push('output handle honors readonly and adds a reference through the existing action without creating another source');
  await page.screenshot({path:path.join(folder,'source-presentation.png')});assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,checks}));
 }catch(e){await h.finish(e);throw e;}
})().catch(e=>{console.error(e);process.exitCode=1;});
