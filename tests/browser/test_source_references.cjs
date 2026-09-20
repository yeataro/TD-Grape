const assert=require('node:assert/strict');
const{harness}=require('./test_glsl_code.cjs');
(async()=>{
 const[source,state,folder]=process.argv.slice(2),h=await harness(source,state,folder,{skipPreview:true}),{page,checks,errors}=h;
 try{
  await page.evaluate(()=>{
   nativeSourcePolling=uniformPolling=customPolling=true;uniformLive.disconnect();uniformLive.connect=()=>{};
   graph.declarations=[{id:'time',name:'uAbsTime',initialDriver:'absTime',kind:'uniform',type:'float',value:null},{id:'gain',name:'uGain',kind:'uniform',type:'float',value:null},{id:'unused',name:'uUnused',kind:'uniform',type:'float',value:null}];
   graph.stages.pixel={nodes:[testNode('a','uniform',0,50,{declarationId:'gain'}),testNode('b','uniform',300,50,{declarationId:'gain'}),testNode('timeRef','uniform',0,300,{declarationId:'time'}),testNode('frag','builtin_source',500,300,{source:'gl_FragCoord'})],edges:[]};
   graph.stages.vertex={nodes:[testNode('otherStage','uniform',0,0,{declarationId:'gain'})],edges:[]};graph.functions=[];graphTrail=[];stage='pixel';
   nativeSourceSnapshot={enabled:true,revision,uniforms:graph.declarations.map(d=>({...d,sequence:'vec',components:[{value:0,mode:'CONSTANT',writable:true}]})),issues:[]};
   nativeSourceError='';readonly=dirty=connectionInterrupted=false;selected=null;selectedInputId=null;selectedEdge=null;selection.clear();past=[];future=[];inputCollapsedGroups.clear();render();workspaceLayout.reveal('uniforms');
   window.before=JSON.stringify(graph);window.cardBefore=document.querySelector('[data-node="a"]');window.frameCalls=[];const move=moveCanvas;moveCanvas=(p,s,kind)=>{frameCalls.push(kind);move(p,s,kind);};
  });
  await page.locator('[data-input-source="gain"] .source-card-menu-button').click();await page.locator('[data-source-select-references]').click();
  assert.deepEqual(await page.evaluate(()=>[...selection]),['a','b']);assert.deepEqual(await page.evaluate(()=>frameCalls),['frameDamping']);
  assert.equal(await page.evaluate(()=>document.activeElement===$('#canvas')),true);assert.equal(await page.evaluate(()=>cardBefore===document.querySelector('[data-node="a"]')),true);
  checks.push('selects all matching current-stage references, retains node DOM and invokes existing Frame with its damping settings');
  await page.evaluate(()=>{readonly=true;renderNativeSources();});await page.locator('[data-preset="absTime"] .source-card-menu-button').click();assert.equal(await page.locator('[data-source-select-references]').isEnabled(),true);await page.locator('[data-source-select-references]').click();assert.deepEqual(await page.evaluate(()=>[...selection]),['timeRef']);
  checks.push('Common presets select their actual source identity; navigation remains available in readonly mode');
  const builtin=page.locator('[data-builtin-reference="gl_FragCoord"]').locator('..');await builtin.locator('.source-card-menu-button').click();await page.locator('[data-source-select-references]').click();assert.deepEqual(await page.evaluate(()=>[...selection]),['frag']);
  await page.locator('[data-input-source="unused"] .source-card-menu-button').click();assert.equal(await page.locator('[data-source-select-references]').isDisabled(),true);await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(()=>JSON.stringify(graph)===before&&!dirty&&!past.length&&!future.length),true);
  checks.push('built-ins share selection action; unused sources disable it, and graph/history/compilation state remain unchanged');
  await page.evaluate(()=>{graphTrail=[];stage='vertex';render();});await page.locator('[data-input-source="gain"] .source-card-menu-button').click();await page.locator('[data-source-select-references]').click();assert.deepEqual(await page.evaluate(()=>[...selection]),['otherStage']);
  const nested=await page.evaluate(()=>{
   graph.functions.push({id:'nested',name:'Nested',inputs:[],outputs:[],graph:{nodes:[testNode('inner','uniform',0,0,{declarationId:'gain'})],edges:[]}});
   const outer=currentSourceReferences('gain').map(n=>n.id);graphTrail=['nested'];const inner=currentSourceReferences('gain').map(n=>n.id);graphTrail=[];graph.functions=[];return{outer,inner};
  });assert.deepEqual(nested,{outer:['otherStage'],inner:['inner']});
  checks.push('scope follows the currently open subgraph without selecting its callers or other stages');
  assert.equal(await page.evaluate(()=>stage),'vertex');assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,checks}));
 }catch(e){await h.finish(e);throw e;}
})().catch(e=>{console.error(e);process.exitCode=1;});
