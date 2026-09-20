/* Destructive source confirmation and Colors semantics use the real UI. */
const assert=require('node:assert/strict'),path=require('node:path');
const {harness}=require('./test_glsl_code.cjs');
(async()=>{
 const [source,state,folder]=process.argv.slice(2),h=await harness(source,state,folder,{skipPreview:true}),{page,checks,errors}=h;
 try{
  await page.evaluate(()=>{
   clearTimeout(autoTimer);nativeSourcePolling=uniformPolling=customPolling=true;uniformLive.disconnect();uniformLive.connect=()=>{};
   graph.declarations=[{id:'color',kind:'uniform',name:'uColor',type:'int',nativeSequence:'color',value:1}];
   graph.functions=[];graphTrail=[];graph.stages.pixel={nodes:[testNode('output','pixel_out',400,0)],edges:[]};
   readonly=false;dirty=false;connectionInterrupted=false;selected=null;selection.clear();selectedInputId='color';
   nativeSourceSnapshot={revision,enabled:true,uniforms:[{...graph.declarations[0],sequence:'color',missing:false,pending:false,nameWritable:true,expected:{token:1},components:[1,0,0,1].map(value=>({value,mode:'CONSTANT',writable:true}))}],issues:[]};
   window.sourceActions=[];nativeSourceRequest=async(endpoint,body)=>{sourceActions.push({endpoint,body});return {};};
   render();workspaceLayout.reveal('parameters');
  });
  assert.equal(await page.evaluate(()=>sourceReady()),true);
  const remove=page.locator('#inspector [data-source-action="remove"]');
  await remove.click();
  assert.equal(await page.locator('.confirmation-dialog').isVisible(),true);
  assert.equal(await page.evaluate(()=>document.activeElement===document.querySelector('.confirmation-dialog [autofocus]')),true);
  assert.equal(await page.evaluate(()=>sourceActions.length),0);
  await page.keyboard.press('Escape');
  await page.locator('.confirmation-dialog').waitFor({state:'detached'});
  assert.equal(await page.locator('.confirmation-dialog').count(),0);
  assert.equal(await page.evaluate(()=>sourceActions.length),0);
  checks.push('overlay opens with Cancel focused; Escape cancels without a native request');
  await remove.click();await page.locator('.confirmation-dialog button:not(.danger)').click();
  await page.locator('.confirmation-dialog').waitFor({state:'detached'});
  assert.equal(await page.evaluate(()=>sourceActions.length),0);
  await remove.click();await page.locator('.confirmation-dialog .danger').click();
  await page.locator('.confirmation-dialog').waitFor({state:'detached'});
  assert.equal(await page.evaluate(()=>sourceActions.length),1);
  assert.deepEqual(await page.evaluate(()=>sourceActions[0].body),{action:'remove',id:'color',expected:{token:1}});
  checks.push('only explicit confirmation sends one delete with the original native edit token');
  await remove.click();await page.evaluate(()=>editorLoadGeneration++);await page.locator('.confirmation-dialog .danger').click();
  await page.locator('.confirmation-dialog').waitFor({state:'detached'});
  assert.equal(await page.evaluate(()=>sourceActions.length),1);
  checks.push('switching editor context while confirmation is open prevents the stale delete');
  const types=await page.evaluate(()=>[...document.querySelector('#inspector [data-type-menu]').options].map(o=>({value:o.value,disabled:o.disabled})));
  assert.deepEqual(types,[{value:'int',disabled:true},...['float','vec2','vec3','vec4'].map(value=>({value,disabled:false}))]);
  assert.equal(await page.evaluate(()=>graph.declarations[0].type),'int');
  checks.push('legacy Colors type is retained and displayed; new choices are float/R through vec4/RGBA');
  await page.evaluate(()=>{graph.declarations[0].type='vec2';nativeSourceSnapshot.uniforms[0].type='vec2';inspector();});
  assert.deepEqual(await page.locator('#inspector [data-native-component-slot] input').evaluateAll(es=>es.map(e=>e.getAttribute('aria-label'))),['uColor R','uColor G']);
  await page.evaluate(()=>openInputCreate('uniform'));await page.selectOption('#sourcekind','color');
  assert.equal(await page.locator('#sourcetype').isEnabled(),true);
  assert.deepEqual(await page.locator('#sourcetype option').evaluateAll(es=>es.map(e=>e.value)),['float','vec2','vec3','vec4']);
  checks.push('Colors creation allows floating components and native controls use RGBA labels');
  await page.locator('#closesourcecreate').click();await remove.click();
  await page.screenshot({path:path.join(folder,'source-delete-overlay.png')});
  assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,checks}));
 }catch(error){await h.finish(error);throw error;}
})().catch(error=>{console.error(error);process.exitCode=1;});
