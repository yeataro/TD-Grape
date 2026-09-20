/* Source eligibility and deliberately reordered HTTP/live traffic, with real editor gates. */
const assert=require('node:assert/strict');
const {harness}=require('./test_glsl_code.cjs');
(async()=>{
 const[source,state,folder]=process.argv.slice(2),h=await harness(source,state,folder,{skipPreview:true}),{page,checks,errors}=h;
 const entry=()=>page.locator('#cards [data-node="gainRef"] [data-source-component="0"]');
 const reset=()=>page.evaluate(()=>resetBoundaryFixture());
 try{
  await page.evaluate(()=>{
   window.boundaryRefresh=refreshNativeSources;
   window.boundarySubscribe=uniformLive.subscribe;
   uniformLive.disconnect();uniformLive.connect=()=>{};uniformLive.subscribe=()=>{};
   refreshNativeSources=async()=>{};refreshUniforms=async()=>{};preview=async()=>{};
   scheduleGraphApply=()=>{clearTimeout(autoTimer);autoTimer=null;};
   window.resetBoundaryFixture=()=>{
    clearTimeout(autoTimer);autoTimer=null;stage='pixel';graphTrail=[];graph.functions=[];
    readonly=dirty=submitBusy=applyLayoutOnly=historyBusy=nativeMutationBusy=nativeValueBusy=nativeSourceBusy=conflicted=applyNeedsReview=connectionInterrupted=nativeSourceUncertain=false;
    nativeSourcePolling=uniformPolling=customPolling=true;nativeSourceError='';nativeSourceRetryAt=0;nativeSourceRefreshPending=false;++nativeSourceReadEpoch;
    uniformLive.ready=false;uniformLive.subscriptions.clear();uniformLive.subscriptionKeys.clear();uniformLive.invalidSources.clear();
    revision=100;editVersion=0;past=[];future=[];applyInFlight=null;
    graph.declarations=[{id:'gain',kind:'uniform',name:'uGain',type:'float',value:null},{id:'color',kind:'uniform',name:'uColor',type:'vec4',nativeSequence:'color',value:null},{id:'spec',kind:'spec_constant',name:'spec',type:'int',constantId:0,value:1}];
    graph.stages.pixel={nodes:[testNode('gainRef','uniform',30,30,{declarationId:'gain'}),testNode('colorRef','uniform',30,250,{declarationId:'color'}),testNode('scalar','scalar',450,30,{type:'float',value:.4}),testNode('combine','combine',450,250,{type:'vec4'}),testNode('split','vector_split',750,250,{type:'vec4'}),testNode('out','pixel_out',750,30)],edges:[{from:['scalar','out'],to:['out','color']}]};
    window.boundaryServer=clone(graph);window.boundaryRevision=revision;window.boundaryValue=.25;window.boundaryRequests=[];window.pauseBoundaryRead=false;
    window.boundarySnapshot=()=>({revision:boundaryRevision,enabled:true,graph:clone(boundaryServer),declarations:clone(boundaryServer.declarations),history:{token:'value-'+boundaryValue},issues:[],uniforms:boundaryServer.declarations.filter(d=>d.kind==='uniform').map(d=>({...d,sequence:d.nativeSequence||'vec',expected:'slot-'+d.id,nameWritable:true,components:Array.from({length:typeComponents(d.type)},(_,i)=>({value:d.id==='gain'?boundaryValue:[.2,.4,.6,1][i],identity:'par-'+d.id+i,parameter:d.id+i,mode:'CONSTANT',writable:true,modeWritable:true}))})),specConstants:[{...boundaryServer.declarations[2],sequence:'const',components:[{value:1,mode:'CONSTANT',writable:true}]}]});
    nativeSourceSnapshot=boundarySnapshot();historyNativeToken=nativeSourceSnapshot.history.token;rememberSavedGraph(graph);
    api=async(route,body)=>{
     boundaryRequests.push({route,body:body&&clone(body)});
     if(route==='sources'){const captured=boundarySnapshot();return pauseBoundaryRead?new Promise(resolve=>{window.releaseBoundaryRead=()=>resolve(captured);}):captured;}
     if(route==='apply')return new Promise((resolve,reject)=>{window.rejectBoundaryApply=reject;window.releaseBoundaryApply=()=>{boundaryServer=clone(body.graph);boundaryRevision=body.revision+1;resolve({state:{graph:clone(boundaryServer),revision:boundaryRevision},shaderUpdated:true,history:{beforeToken:'before',token:'after'}});};});
     if(route==='source-value'){
      if(body.revision!==boundaryRevision)throw Error('Conflict: stale graph revision');
      const row=boundarySnapshot().uniforms.find(r=>r.id===body.id);
      for(const edit of body.components||[body])if(JSON.stringify(edit.expected)!==JSON.stringify(row.components[edit.component]))throw Error('The value changed in TD. Refresh and try again.');
      const beforeToken='value-'+boundaryValue;if(body.id==='gain')boundaryValue=body.value;
      return {...boundarySnapshot(),history:{beforeToken,token:'value-'+boundaryValue}};
     }
     throw Error('Unexpected request '+route);
    };
    window.boundaryWrite=value=>nativeSourceRequest('source-value',{id:'gain',component:0,value,expected:clone(nativeSourceIndex().get('gain').components[0])});
    window.boundaryOwnLive=()=>{uniformLive.ready=true;uniformLive.subscriptions.add('gain');uniformLive.subscriptionKeys.set('gain',nativeSourceValueKey(nativeSourceIndex().get('gain')));};
    selected=null;selection.clear();selectedInputId='gain';render();workspaceLayout.reveal('uniforms');workspaceLayout.reveal('parameters');inputCollapsedGroups.clear();renderNativeSources();renderGraphEditActions();
   };resetBoundaryFixture();
  });
  for(const action of ['delete-outside','constant-active','constant-outside','type-outside','name-active','components-active','components-outside','wire']){
   await reset();await page.evaluate(action=>change(()=>{
    const nodes=current().nodes;
    if(action==='delete-outside')current().nodes=nodes.filter(n=>n.id!=='combine');
    if(action==='constant-active')nodes.find(n=>n.id==='scalar').params.value=.8;
    if(action==='constant-outside')current().nodes.push(testNode('extra','scalar',500,500,{type:'float',value:.8}));
    if(action==='type-outside')nodes.find(n=>n.id==='combine').params.type='vec3';
    if(action==='name-active')nodes.find(n=>n.id==='gainRef').name='Renamed reference';
    if(action==='components-active')nodes.find(n=>n.id==='colorRef').ui.componentNames='xyzw';
    if(action==='components-outside')nodes.find(n=>n.id==='split').ui.componentNames='stpq';
    if(action==='wire')current().edges.push({from:['colorRef','out'],to:['split','value']});
   }),action);
   assert.equal(await entry().isEnabled(),true,action);
   assert.equal(await page.locator('#inspector [data-source-component="0"]').isEnabled(),true,action);
   assert.equal(await page.locator('[data-input-source="gain"] [data-source-component="0"]').isEnabled(),true,action);
   assert.equal(await page.locator('[data-input-source="color"] input[type=color]').isEnabled(),true,action);
   assert.equal(await page.locator('[data-input-source="spec"] [data-source-component="0"]').isDisabled(),true,action);
  }
  checks.push('8 ordinary graph edits retain canvas / Inputs / Parameter / Color numeric eligibility; Spec Constants retain their own protection');
  for(const action of ['rename','type','sequence','expose','missing','remove']){
   await reset();await page.evaluate(action=>{change(()=>{const d=graph.declarations[0];if(action==='rename')d.name='uChanged';if(action==='type')d.type='vec2';if(action==='sequence')d.nativeSequence='color';if(action==='expose')d.expose=true;if(action==='missing')d.sourceMissing=true;if(action==='remove')graph.declarations.shift();});},action);
   assert.equal(await page.evaluate(()=>uniformValueReady('gain')),false,action);
   assert.equal(await page.evaluate(()=>uniformValueReady('color')),true,action);
   await page.evaluate(()=>boundaryWrite(.7));assert.equal(await page.evaluate(()=>boundaryRequests.length),0,action);
  }
  checks.push('source-local name/type/sequence/expose/missing/deletion changes block only that source, including direct requests');
  await reset();await page.evaluate(()=>{change(()=>current().nodes.find(n=>n.id==='scalar').params.value=.8);window.boundaryApply=applyGraph();window.boundaryValueWrite=boundaryWrite(.7);change(()=>current().nodes.find(n=>n.id==='scalar').params.value=.9);});
  assert.equal(await entry().isEnabled(),true);assert.equal(await page.evaluate(()=>boundaryRequests.some(r=>r.route==='source-value')),false);
  await page.evaluate(async()=>{releaseBoundaryApply();await boundaryApply;await boundaryValueWrite;});
  assert.deepEqual(await page.evaluate(()=>[boundaryValue,revision,dirty,current().nodes.find(n=>n.id==='scalar').params.value,boundaryRequests.find(r=>r.route==='source-value').body.revision]),[.7,101,true,.9,101]);
  checks.push('semantic Apply queues REST, refreshes its revision, retains the original value expectation and preserves a newer local graph draft');
  await reset();await page.evaluate(()=>{change(()=>current().nodes[2].params.value=.8);window.boundaryApply=applyGraph();window.boundaryValueWrite=boundaryWrite(.7);});
  await page.evaluate(async()=>{releaseBoundaryApply();boundaryServer.stages.pixel.nodes.push(testNode('external','scalar',500,500,{type:'float',value:.3}));boundaryRevision++;await boundaryApply;await boundaryValueWrite;});
  assert.deepEqual(await page.evaluate(()=>[revision,boundaryValue,past.at(-1).kind,historyGraphKey(past.at(-1).before)===historyGraphKey(past.at(-1).after),past.at(-1).before.stages.pixel.nodes.some(n=>n.id==='external')]),[102,.7,'source',true,true]);
  checks.push('a fresh external graph adopted before a queued value write is not recorded as part of that value edit or its Undo');
  await reset();await page.evaluate(()=>{change(()=>current().nodes[2].params.value=.8);window.boundaryApply=applyGraph();window.boundaryValueWrite=boundaryWrite(.7);boundaryValue=.6;});
  await page.evaluate(async()=>{releaseBoundaryApply();await boundaryApply;await boundaryValueWrite;});
  assert.equal(await page.evaluate(()=>boundaryValue),.6);assert.equal(await page.evaluate(()=>boundaryRequests.find(r=>r.route==='source-value').body.expected.value),.25);
  assert.equal(await page.evaluate(()=>past.some(e=>e.kind==='source')),false);
  checks.push('external value changes while Apply is pending are rejected instead of rebasing the expected value');
  await reset();await page.evaluate(()=>{change(()=>current().nodes[2].params.value=.8);window.boundaryApply=applyGraph();window.boundaryValueWrite=boundaryWrite(.7);});
  await page.evaluate(async()=>{rejectBoundaryApply(Error('Conflict: external graph edit'));await boundaryApply;await boundaryValueWrite;});
  assert.equal(await entry().isDisabled(),true);assert.equal(await page.evaluate(()=>boundaryRequests.some(r=>r.route==='source-value')),false);
  await page.evaluate(()=>{boundaryRevision=101;receiveNativeSources(boundarySnapshot());});
  assert.equal(await entry().isEnabled(),true);assert.deepEqual(await page.evaluate(()=>[revision,nativeSourceSnapshot.revision,dirty,conflicted]),[100,101,true,true]);
  await page.evaluate(()=>boundaryWrite(.8));assert.equal(await page.evaluate(()=>boundaryValue),.8);assert.equal(await page.evaluate(()=>revision),100);
  checks.push('failed Apply cancels queued writes; a fresh source confirmation restores values without advancing or overwriting the conflicted graph draft');
  await reset();await page.evaluate(()=>{boundaryOwnLive();const components=clone(nativeSourceIndex().get('gain').components);components[0].value=.9;uniformLive.acceptValues({gain:components});receiveNativeSources(boundarySnapshot());});
  await h.settle();assert.equal(await entry().inputValue(),'0.9');
  assert.equal(await page.evaluate(()=>document.querySelector('#cards [data-source-component="0"]').sourceExpected.value),.9);
  checks.push('same-revision delayed HTTP inventory cannot overwrite live values or the next gesture expectation');
  await page.evaluate(async()=>{boundaryValue=.9;await boundaryWrite(.7);});assert.equal(await entry().inputValue(),'0.9');
  await page.evaluate(()=>uniformLive.acceptValues({gain:boundarySnapshot().uniforms[0].components}));await h.settle();assert.equal(await entry().inputValue(),'0.7');
  checks.push('REST commits on subscribed sources retain live readout ownership until its ordered value message arrives');
  await reset();await page.evaluate(()=>{nativeSourcePolling=false;pauseBoundaryRead=true;window.oldRead=boundaryRefresh();});
  await page.evaluate(()=>boundaryWrite(.7));await page.evaluate(async()=>{pauseBoundaryRead=false;releaseBoundaryRead();await oldRead;});
  assert.equal(await entry().inputValue(),'0.7');assert.equal(await page.evaluate(()=>boundaryValue),.7);
  checks.push('HTTP read begun before a REST write cannot roll its successful readback back at the same graph revision');
  await reset();await page.evaluate(()=>{
   nativeSourcePolling=false;uniformLive.ready=true;uniformLive.sources=['gain'];uniformLive.subscribedKey=null;
   const values={gain:clone(nativeSourceIndex().get('gain').components)};
   uniformLive.request=async()=>new Promise(resolve=>{window.releaseOldSubscription=()=>resolve({values});});
   window.oldSubscription=boundarySubscribe.call(uniformLive);
  });
  await page.evaluate(()=>boundaryWrite(.7));await page.evaluate(async()=>{releaseOldSubscription();await oldSubscription;});
  assert.equal(await entry().inputValue(),'0.7');assert.equal(await page.evaluate(()=>uniformLive.subscriptions.size),0);
  await page.evaluate(async()=>{uniformLive.request=async()=>({values:{gain:boundarySnapshot().uniforms[0].components}});await boundarySubscribe.call(uniformLive);});
  assert.equal(await page.evaluate(()=>uniformLive.subscriptions.has('gain')),true);assert.equal(await entry().inputValue(),'0.7');
  checks.push('a delayed subscribe acknowledgement sampled before a REST commit cannot take ownership with stale values; a fresh subscription can');
  await reset();await page.evaluate(()=>{change(()=>current().nodes[2].params.value=.8);window.oldInventory=boundarySnapshot();boundaryRevision=101;receiveNativeSources(boundarySnapshot());receiveNativeSources(oldInventory);});
  assert.deepEqual(await page.evaluate(()=>[revision,nativeSourceSnapshot.revision,dirty]),[100,101,true]);
  checks.push('metadata never regresses when the browser draft base revision trails the TD source revision');
  await reset();await page.evaluate(()=>{boundaryOwnLive();window.oldReadEpoch=nativeSourceReadEpoch;uniformLive.disconnect();boundaryValue=.4;receiveNativeSources(boundarySnapshot(),{readEpoch:oldReadEpoch});});
  assert.equal(await entry().isDisabled(),true);
  assert.equal(await page.evaluate(()=>uniformValueReady('gain')),false);
  await page.evaluate(()=>receiveNativeSources(boundarySnapshot()));assert.equal(await entry().inputValue(),'0.4');assert.equal(await entry().isEnabled(),true);
  checks.push('live disconnect rejects pre-handoff HTTP reads and resumes only after fresh native confirmation');
  await reset();await page.evaluate(()=>{const c=nativeSourceIndex().get('gain').components[0];c.mode='EXPRESSION';c.writable=false;renderNativeSourceValues();});
  assert.equal(await page.evaluate(()=>uniformValueReady('gain',false,0)),false);
  assert.equal(await page.evaluate(()=>uniformValueReady('color',false,0)),true);
  checks.push('driven components remain read-only without disabling another source');
  assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,count:checks.length,checks}));
 }catch(e){await h.finish(e);throw e;}
})().catch(e=>{console.error(e);process.exitCode=1;});
