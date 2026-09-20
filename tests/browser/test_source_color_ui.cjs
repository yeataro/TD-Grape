const assert=require('node:assert/strict'),path=require('node:path');
const{harness}=require('./test_glsl_code.cjs');
(async()=>{
 const[source,state,folder]=process.argv.slice(2),h=await harness(source,state,folder,{skipPreview:true}),{page,checks,errors}=h;
 try{
 await page.evaluate(()=>{
  nativeSourcePolling=uniformPolling=customPolling=true;uniformLive.disconnect();uniformLive.connect=()=>{};
  graph.declarations=[{id:'tint',name:'uTint',kind:'uniform',type:'vec4',nativeSequence:'color',value:null},{id:'gain',name:'uGain',kind:'uniform',type:'float',value:null},{id:'lost',name:'uLost',kind:'uniform',type:'float',value:null,sourceMissing:true}];
  graph.stages.pixel={nodes:[testNode('colorReference','uniform',50,50,{declarationId:'tint'}),testNode('output','pixel_out',500,50)],edges:[]};graph.functions=[];graphTrail=[];stage='pixel';
  readonly=false;dirty=false;connectionInterrupted=false;selected=null;selection.clear();selectedInputId=null;past=[];future=[];
  nativeSourceSnapshot={revision,enabled:true,uniforms:graph.declarations.map(d=>({...d,sequence:d.nativeSequence||'vec',missing:!!d.sourceMissing,pending:false,components:[.2,.4,.6,.7].map((value,i)=>({value,mode:'CONSTANT',writable:true,parameter:'color0'+i}))})),issues:[]};
  inputCollapsedGroups.clear();render();workspaceLayout.reveal('uniforms');window.initialGraph=JSON.stringify(graph);
  window.calls=[];nativeSourceRequest=async(endpoint,body)=>{calls.push({endpoint,body});const row=nativeSourceIndex().get(body.id);for(const e of body.components)row.components[e.component].value=e.value;renderNativeSourceValues(new Set([body.id]));};
 });
 const card=page.locator('[data-input-source="tint"]'),color=card.locator('[data-native-color]'),picker=color.locator('input[type=color]');
 assert.equal(await picker.count(),1);assert.equal(await color.locator('.native-color-line input').count(),4);
 assert.equal(await color.locator('.native-color-expanded').count(),0);await color.locator('.node-values-toggle').click();assert.equal(await color.locator('.native-color-expanded').isVisible(),true);
 await card.locator('.input-source-select').click();assert.equal(await page.locator('#inspector [data-native-color] input[type=color]').count(),1);
 assert.equal(await page.locator('[data-node="colorReference"] [data-native-color] input[type=color]').count(),1);
 checks.push('Color source cards, Parameter and graph references share palette, compact components and expandable component controls');
 await picker.fill('#ff8000');
 assert.equal(await page.evaluate(()=>calls.length),1);const edits=await page.evaluate(()=>calls[0].body.components);assert.deepEqual(edits.map(e=>e.component),[0,1,2]);assert.equal(edits[0].value,1);
 assert.equal(await page.evaluate(()=>nativeSourceIndex().get('tint').components[3].value),.7);assert.equal(await page.evaluate(()=>JSON.stringify(graph)===initialGraph),true);
 checks.push('palette sends one RGB request, preserves alpha and never changes graph values');
 await page.evaluate(()=>{window.control=document.querySelector('[data-input-source="gain"] input');const row=nativeSourceIndex().get('tint');row.components[1]={...row.components[1],mode:'EXPRESSION',expression:'absTime.seconds',writable:false};renderNativeSourceValues(new Set(['tint']));});
 assert.equal(await picker.isDisabled(),true);assert.match(await color.innerText(),/Expression/);assert.equal(await page.evaluate(()=>control===document.querySelector('[data-input-source="gain"] input')),true);
 await page.evaluate(()=>{const row=nativeSourceIndex().get('tint');row.components[1]={...row.components[1],mode:'BIND',binding:'parent().par.Color',writable:true};renderNativeSourceValues(new Set(['tint']));});assert.equal(await picker.isEnabled(),true);
 checks.push('driven RGB disables palette; supported writable Bind stays editable and unrelated controls retain DOM');
 const badge=page.locator('[data-input-group="uniform"] > .input-group-title .source-count');assert.equal(await badge.innerText(),'2');
 assert.equal(await page.locator('[data-input-group="common.time"] > .input-group-title .source-count').isVisible(),false);
 await page.evaluate(()=>{graph.declarations.find(d=>d.id==='gain').sourceMissing=true;renderNativeSources();});assert.equal(await badge.innerText(),'1');
 await page.selectOption('#language','en');const add=page.locator('[data-input-create="uniform"]');assert.equal(await add.innerText(),'＋ Add');assert.match(await add.getAttribute('title'),/Add source/);assert.equal(await add.evaluate(e=>getComputedStyle(e).borderWidth),'0px');
 checks.push('badges exclude dormant and missing sources, hide zero, and Add has a quiet borderless background and explicit tooltip');
 await page.screenshot({path:path.join(folder,'colors-and-counts.png')});assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,checks}));
 }catch(e){await h.finish(e);throw e;}
})().catch(e=>{console.error(e);process.exitCode=1;});
