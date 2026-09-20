/* Layout saves must not disable Uniform values or bypass native revision checks. */
const assert=require('node:assert/strict'),path=require('node:path');
const {harness}=require('./test_glsl_code.cjs');
(async()=>{
 const[source,state,folder]=process.argv.slice(2),h=await harness(source,state,folder,{skipPreview:true}),{page,checks,errors}=h;
 const control=()=>page.locator('#cards [data-node="gainRef"] [data-source-component="0"]');
 const reset=()=>page.evaluate(()=>resetLayoutFixture());
 const move=()=>page.evaluate(()=>change(()=>{current().nodes.find(n=>n.id==='gainRef').ui.x+=25;},{localize:false,layout:true}));
 const resize=()=>page.evaluate(()=>change(()=>{const ui=current().nodes.find(n=>n.id==='gainRef').ui;Object.assign(ui,{width:(ui.width||300)+40,height:(ui.height||160)+40});},{localize:false,layout:true}));
 const apply=()=>page.evaluate(()=>{window.layoutApply=applyGraph();renderNativeSourceValues();});
 const finish=()=>page.evaluate(async()=>{releaseApply();await layoutApply;});
 try{
  await page.evaluate(()=>{
   uniformLive.disconnect();uniformLive.connect=()=>{};nativeSourcePolling=uniformPolling=customPolling=true;
   scheduleGraphApply=()=>{clearTimeout(autoTimer);autoTimer=null;};refreshUniforms=async()=>{};refreshNativeSources=async()=>{};preview=async()=>{};
   window.resetLayoutFixture=()=>{
    clearTimeout(autoTimer);readonly=dirty=submitBusy=applyLayoutOnly=historyBusy=nativeMutationBusy=nativeValueBusy=nativeSourceBusy=conflicted=applyNeedsReview=connectionInterrupted=false;
    nativeSourceError='';applyInFlight=null;stage='pixel';graphTrail=[];graph.functions=[];revision=100;editVersion=0;past=[];future=[];
    graph.declarations=[{id:'gain',kind:'uniform',name:'uGain',type:'float',value:null},{id:'color',kind:'uniform',name:'uColor',type:'vec4',nativeSequence:'color',value:null},{id:'spec',kind:'spec_constant',name:'specValue',type:'int',value:1,constantId:0}];
    graph.stages.pixel={nodes:[testNode('gainRef','uniform',40,40,{declarationId:'gain'}),testNode('colorRef','uniform',40,280,{declarationId:'color'}),testNode('uv','uv',450,40),testNode('split','vector_split',650,40,{type:'vec2'})],edges:[]};
    window.serverGraph=clone(graph);window.serverRevision=revision;window.serverValue=.25;window.requests=[];window.pauseValue=false;
    window.layoutSnapshot=()=>({revision:serverRevision,enabled:true,graph:clone(serverGraph),sourceChanged:false,history:{token:'value-'+serverValue},uniforms:serverGraph.declarations.filter(d=>d.kind==='uniform').map(d=>({...d,sequence:d.nativeSequence||'vec',nameWritable:true,components:Array.from({length:typeComponents(d.type)},(_,i)=>({value:d.id==='gain'?serverValue:[.2,.4,.6,1][i],mode:'CONSTANT',writable:true,modeWritable:true,parameter:d.id+i}))})),specConstants:[{...serverGraph.declarations[2],sequence:'const',components:[{value:1,mode:'CONSTANT',writable:true}]}],issues:[]});
    nativeSourceSnapshot=layoutSnapshot();historyNativeToken=nativeSourceSnapshot.history.token;rememberSavedGraph(graph);selected=null;selectedInputId='gain';selection.clear();
    api=async(route,body)=>{
     requests.push({route,body:clone(body)});
     if(route==='apply')return new Promise((resolve,reject)=>{
      window.failApply=reject;window.releaseApply=(shaderUpdated=false)=>{serverGraph=clone(body.graph);serverRevision=body.revision+1;resolve({state:{revision:serverRevision,graph:clone(serverGraph)},shaderUpdated,target:'/fixture/shader',history:{beforeToken:'before-layout',token:'after-layout'}});};
     });
     if(route==='source-value'){
      if(body.revision!==serverRevision)throw Error('Stale revision was sent');
      if(body.expected.value!==serverValue)throw Error('Stale value expectation was sent');
      if(pauseValue)await new Promise(resolve=>window.releaseValue=resolve);
      const beforeToken='value-'+serverValue;serverValue=body.value;return {...layoutSnapshot(),history:{beforeToken,token:'value-'+serverValue}};
     }
     if(route==='sources')return layoutSnapshot();
     throw Error('Unexpected request: '+route);
    };
    render();workspaceLayout.reveal('uniforms');workspaceLayout.reveal('parameters');inputCollapsedGroups.clear();renderNativeSources();renderGraphEditActions();
   };resetLayoutFixture();
  });
  await move();assert.equal(await control().isEnabled(),true);
  assert.equal(await page.locator('#inspector [data-source-component="0"]').isEnabled(),true);
  assert.equal(await page.locator('[data-input-source="gain"] [data-source-component="0"]').isEnabled(),true);
  assert.equal(await page.locator('[data-input-source="color"] input[type=color]').isEnabled(),true);
  assert.equal(await page.locator('[data-input-source="spec"] [data-source-component="0"]').isDisabled(),true);
  assert.equal(await page.locator('#inspector [data-input-name]').isDisabled(),true);
  await resize();assert.equal(await control().isEnabled(),true);
  checks.push('position/size drafts keep canvas, Inputs, Parameter and Color values editable; source configuration and Spec Constants keep existing protection');
  await apply();assert.equal(await control().isEnabled(),true);
  await page.evaluate(()=>{window.oldSnapshot=clone(nativeSourceSnapshot);window.layoutValue=nativeSourceRequest('source-value',{id:'gain',component:0,value:.6,expected:clone(nativeSourceSnapshot.uniforms[0].components[0])});});
  assert.equal(await page.evaluate(()=>requests.filter(r=>r.route==='source-value').length),0);
  await finish();await page.evaluate(()=>layoutValue);
  assert.equal(await control().isEnabled(),true);assert.equal(await control().inputValue(),'0.6');
  assert.deepEqual(await page.evaluate(()=>[revision,nativeSourceSnapshot.revision,requests.find(r=>r.route==='source-value').body.revision]),[101,101,101]);
  await page.evaluate(()=>receiveNativeSources(oldSnapshot));assert.equal(await control().inputValue(),'0.6');
  assert.equal(await page.evaluate(()=>nativeSourceSnapshot.revision),101);
  checks.push('REST value submission waits for layout acknowledgement, uses its new revision and ignores delayed older source polls');
  await resize();await page.evaluate(()=>{pauseValue=true;window.layoutValue=nativeSourceRequest('source-value',{id:'gain',component:0,value:.7,expected:clone(nativeSourceSnapshot.uniforms[0].components[0])});});
  const applyCount=await page.evaluate(()=>requests.filter(r=>r.route==='apply').length);
  await page.evaluate(()=>applyGraph());assert.equal(await page.evaluate(()=>requests.filter(r=>r.route==='apply').length),applyCount);
  await page.evaluate(async()=>{releaseValue();await layoutValue;});assert.equal(await control().inputValue(),'0.7');assert.equal(await page.evaluate(()=>dirty),true);
  await apply();await finish();assert.equal(await control().isEnabled(),true);
  checks.push('a REST value write before layout Apply prevents overlapping revision writes and preserves the pending graph layout');
  await reset();await move();await apply();await finish();await page.evaluate(()=>undo());assert.equal(await control().isEnabled(),true);
  assert.equal(await page.evaluate(()=>current().nodes.find(n=>n.id==='gainRef').ui.x),40);await page.evaluate(()=>undo(true));assert.equal(await control().isEnabled(),true);
  assert.equal(await page.evaluate(()=>current().nodes.find(n=>n.id==='gainRef').ui.x),65);
  checks.push('layout Undo/Redo restores positions and leaves Uniform controls immediately usable');
  for(const action of ['rename','type','remove','wire']){
   await reset();await page.evaluate(action=>{change(()=>{const d=graph.declarations[0];if(action==='rename')d.name='uRenamed';else if(action==='type')d.type='vec2';else if(action==='remove')d.sourceMissing=true;else current().edges.push({from:['uv','out'],to:['split','value']});},{typeChange:true});renderNativeSourceValues();},action);
   assert.equal(await control().isDisabled(),true,action);
   await page.evaluate(()=>nativeSourceRequest('source-value',{id:'gain',component:0,value:.8,expected:clone(nativeSourceSnapshot.uniforms[0].components[0])}));
   assert.equal(await page.evaluate(()=>requests.length),0,action);
  }
  checks.push('rename, type, removal and graph-content drafts still block values, including direct request calls');
  await reset();await move();await apply();await page.evaluate(()=>{window.layoutValue=nativeSourceRequest('source-value',{id:'gain',component:0,value:.8,expected:clone(nativeSourceSnapshot.uniforms[0].components[0])});change(()=>{graph.declarations[0].name='uRenamed';});});
  await finish();await page.evaluate(()=>layoutValue);assert.equal(await control().isDisabled(),true);assert.equal(await page.evaluate(()=>requests.filter(r=>r.route==='source-value').length),0);
  checks.push('a newer semantic edit cancels a queued value write after the earlier layout response');
  await reset();await move();await apply();await page.evaluate(async()=>{releaseApply(true);await layoutApply;});assert.equal(await control().isDisabled(),true);
  await page.evaluate(()=>receiveNativeSources(layoutSnapshot()));assert.equal(await control().isEnabled(),true);
  checks.push('an unexpected Shader rebuild never reuses old native controls and waits for a fresh source snapshot');
  await reset();await move();await apply();await page.evaluate(()=>{window.layoutValue=nativeSourceRequest('source-value',{id:'gain',component:0,value:.8,expected:clone(nativeSourceSnapshot.uniforms[0].components[0])});});
  await page.evaluate(async()=>{failApply(Error('Conflict: another window changed the graph'));await layoutApply;await layoutValue;});assert.equal(await control().isDisabled(),true);assert.equal(await page.evaluate(()=>requests.filter(r=>r.route==='source-value').length),0);
  checks.push('a failed layout save with a revision conflict keeps controls protected and sends no queued value');
  await reset();await move();await apply();await page.evaluate(()=>{window.layoutValue=nativeSourceRequest('source-value',{id:'gain',component:0,value:.8,expected:clone(nativeSourceSnapshot.uniforms[0].components[0])});editorLoadGeneration++;submitBusy=applyLayoutOnly=false;});
  await finish();await page.evaluate(()=>layoutValue);assert.equal(await page.evaluate(()=>requests.filter(r=>r.route==='source-value').length),0);
  await reset();await move();await page.evaluate(()=>{readonly=true;renderNativeSourceValues();});assert.equal(await control().isDisabled(),true);
  checks.push('Shader/load-generation changes discard queued writes and read-only mode remains protected');
  await reset();await resize();await page.screenshot({path:path.join(folder,'layout-editable.png')});assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,checks}));
 }catch(e){await h.finish(e);throw e;}
})().catch(e=>{console.error(e);process.exitCode=1;});
