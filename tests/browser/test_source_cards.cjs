/* Source cards: identity, first-reference initialization, grouping and selective DOM updates. */
const assert=require('node:assert/strict'),path=require('node:path');
const {harness}=require('./test_glsl_code.cjs');
(async()=>{
 const [source,state,folder]=process.argv.slice(2),h=await harness(source,state,folder,{skipPreview:true}),{page,checks,errors}=h;
 try{
  await page.evaluate(()=>{
   clearTimeout(autoTimer);nativeSourcePolling=uniformPolling=customPolling=true;uniformLive.disconnect();uniformLive.connect=()=>{};
   graph.declarations=[
    {id:'gain',kind:'uniform',name:'uGain',type:'float',value:0},
    {id:'color',kind:'uniform',name:'uColor',type:'int',value:0,nativeSequence:'color'},
    {id:'matrix',kind:'uniform',name:'uTransform',type:'mat4',value:1,nativeSequence:'matrix'},
    {id:'array',kind:'uniform',name:'uSamples',type:'float[4]',value:null,nativeSequence:'array',arraySource:'/test/chop'},
    {id:'lost',kind:'uniform',name:'uLost',type:'float',value:0,sourceMissing:true}
   ];
   graph.functions=[];graphTrail=[];graph.stages.pixel={nodes:[testNode('output','pixel_out',400,0)],edges:[]};
   readonly=false;dirty=false;connectionInterrupted=false;selected=null;selection.clear();selectedInputId=null;past=[];future=[];
   nativeSourceSnapshot={revision,enabled:true,uniforms:graph.declarations.map(d=>({...d,sequence:d.nativeSequence||'vec',missing:!!d.sourceMissing,pending:false,nameWritable:true,expected:{id:d.id},components:[{value:2,mode:'CONSTANT',writable:true}]})),issues:[]};
   inputCollapsedGroups.clear();render();workspaceLayout.reveal('uniforms');window.initialGraph=JSON.stringify(graph);
  });
  assert.equal(await page.locator('[data-input-group="common"] [data-preset]').count(),6);
  assert.equal(await page.locator('[data-dormant="true"]').count(),6);
  assert.equal(await page.evaluate(()=>JSON.stringify(graph)===initialGraph),true);
  assert.match(await page.locator('[data-preset="absTime"] .input-source-select').textContent(),/absTime.seconds/);
  assert.equal(await page.locator('[data-preset-reference="absTime"]').isEnabled(),true);
  checks.push('six dimmed Common presets are actionable, use TD expressions, and do not initialize on opening');
  for(const [id,group] of [['gain','values'],['color','values'],['matrix','matrices'],['array','arrays']])assert.equal(await page.locator(`[data-input-group="uniform.${group}"] [data-input-source="${id}"]`).count(),1);
  assert.match(await page.locator('[data-input-source="color"] .source-card-body').innerText(),/Colors/);
  await page.evaluate(()=>openInputCreate('uniform'));
  assert.equal(await page.locator('#sourcekind option').evaluateAll(es=>es.some(e=>e.value.startsWith('preset:'))),false);
  await page.locator('#closesourcecreate').click();
  checks.push('Custom Values / Matrices / Arrays preserve native Colors identity; generic creation omits time presets');
  await page.evaluate(()=>{window.gainCard=document.querySelector('[data-input-source="gain"]');window.gainControl=gainCard.querySelector('input');window.matrixCard=document.querySelector('[data-input-source="matrix"]');window.patches=0;window.cardObserver=new MutationObserver(list=>patches+=list.length);cardObserver.observe(gainCard,{childList:true,subtree:true});});
  await page.locator('[data-input-source="color"] .input-source-select').click();
  await page.evaluate(()=>{nativeSourceSnapshot.uniforms.find(r=>r.id==='gain').components[0].value=3;renderNativeSourceValues(new Set(['gain']));renderNativeSources();});
  assert.equal(await page.evaluate(()=>gainCard===document.querySelector('[data-input-source="gain"]')&&gainControl===gainCard.querySelector('input')&&matrixCard===document.querySelector('[data-input-source="matrix"]')),true);
  assert.equal(await page.evaluate(()=>gainControl.value),'3');assert.equal(await page.evaluate(()=>patches),0);
  checks.push('selection and native value updates retain other card/control DOM with zero child mutations');
  await page.evaluate(()=>{graph.declarations.find(d=>d.id==='color').name='uTint';renderNativeSources();});
  assert.equal(await page.evaluate(()=>gainCard===document.querySelector('[data-input-source="gain"]')&&matrixCard===document.querySelector('[data-input-source="matrix"]')),true);
  assert.match(await page.locator('[data-input-source="color"] .input-source-select').textContent(),/uTint/);
  checks.push('a metadata edit replaces only its source card, retaining unaffected numeric controls');
  await page.locator('[data-input-source="lost"] .source-card-toggle').click();
  assert.equal(await page.locator('[data-input-source="lost"] .source-card-body').isVisible(),false);
  assert.equal(await page.locator('[data-input-source="lost"] .input-source-status').isVisible(),true);
  assert.equal(await page.locator('[data-input-source="lost"] [data-input-reference]').isDisabled(),true);
  await page.locator('[data-input-source="gain"] .source-card-menu-button').click();
  assert.equal(await page.locator('#sourcecardmenu').isVisible(),true);await page.keyboard.press('Escape');
  await page.locator('[data-input-source="gain"] .source-card-head').click({button:'right'});
  assert.equal(await page.locator('#sourcecardmenu [role="separator"]').count(),1);await page.keyboard.press('Escape');
  checks.push('collapsed missing cards retain warnings; touch actions and right-click share a grouped menu');
  await page.screenshot({path:path.join(folder,'source-groups.png')});
  // Presets are graph edits, so keep this phase isolated from the fixture API.
  await page.evaluate(()=>{connectionInterrupted=true;graph.declarations=[];nativeSourceSnapshot={revision,enabled:true,uniforms:[],issues:[]};past=[];future=[];render();});
  await page.locator('[data-preset-reference="absTime"]').click();
  assert.equal(await page.evaluate(()=>graph.declarations.length),1);
  const first=await page.evaluate(()=>({id:graph.declarations[0].id,driver:graph.declarations[0].initialDriver,past:past.length,nodes:current().nodes.length}));
  assert.equal(first.driver,'absTime');assert.equal(first.past,1);
  await page.locator('[data-preset="absTime"] .input-reference').click();
  assert.equal(await page.evaluate(()=>graph.declarations.length),1);assert.equal(await page.evaluate(()=>current().nodes.length),first.nodes+1);
  assert.equal(await page.evaluate(()=>current().nodes.filter(n=>n.params.declarationId).every(n=>n.params.declarationId===graph.declarations[0].id)),true);
  await page.evaluate(()=>undo());await page.evaluate(()=>undo());
  assert.equal(await page.evaluate(()=>graph.declarations.length),0);
  checks.push('first reference creates one source and node in one Undo; later references reuse it, and Undo restores dormancy');
  await page.evaluate(()=>{graph.declarations=[{id:'existing',kind:'uniform',name:'uAbsTime',type:'float',value:17}];render();});
  await page.locator('[data-preset="absTime"] .input-reference').click();
  assert.deepEqual(await page.evaluate(()=>graph.declarations.map(d=>({id:d.id,value:d.value,driver:d.initialDriver||null}))),[{id:'existing',value:17,driver:null}]);
  checks.push('a compatible existing native name is reused without changing its value or assigning an initialization driver');
  await page.evaluate(()=>{graph.declarations=[{id:'conflict',kind:'constant',name:'uAbsTime',type:'float',value:7}];render();});
  assert.equal(await page.locator('[data-preset="absTime"] .input-reference').isDisabled(),true);
  await page.evaluate(()=>referenceCommonSource('absTime'));
  assert.equal(await page.evaluate(()=>graph.declarations.length),1);assert.equal(await page.evaluate(()=>graph.declarations[0].name),'uAbsTime');
  checks.push('conflicting native identity is visible and cannot silently create a renamed duplicate');
  await page.locator('[data-preset="absTime"] .source-card-menu-button').click();
  await page.locator('#sourcecardmenu button').last().click();
  assert.match(await page.locator('#nodehelp').innerText(),/absTime.seconds/);
  await page.screenshot({path:path.join(folder,'source-cards.png')});
  assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,checks}));
 }catch(error){await h.finish(error);throw error;}
})().catch(error=>{console.error(error);process.exitCode=1;});
