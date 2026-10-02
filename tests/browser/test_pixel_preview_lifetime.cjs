/* Transient Pixel Preview lifecycle against an isolated, receipt-controlled API.
 * This tests browser ownership/serialization, not TD cooking or lease expiry.
 */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {harness}=require('./test_glsl_code.cjs');
const copy=v=>JSON.parse(JSON.stringify(v));
const hasPreview=g=>Object.values(g?.stages||{}).some(s=>s.nodes.some(n=>n.definitionUuid==='sgrape.builtin.preview'));
function formal(g){
 const result=copy(g);
 for(const data of [...Object.values(result.stages),...(result.functions||[]).map(f=>f.graph)]){
  const ids=new Set(data.nodes.filter(n=>n.definitionUuid==='sgrape.builtin.preview').map(n=>n.id));
  data.nodes=data.nodes.filter(n=>!ids.has(n.id));data.edges=data.edges.filter(e=>!ids.has(e.from[0])&&!ids.has(e.to[0]));
  if(ids.size&&data.ui?.frames)data.ui.frames=data.ui.frames.map(f=>({...f,nodes:f.nodes.filter(id=>!ids.has(id))})).filter(f=>f.nodes.length);
 }return result;
}
(async()=>{
 const[source,stateFile,folder]=process.argv.slice(2),h=await harness(source,stateFile,folder,{skipPreview:true}),{page,checks,errors}=h;
 const fixture=JSON.parse(fs.readFileSync(stateFile,'utf8').replace(/^\uFEFF/,'')),calls=[];
 let saved,serverRevision,active=null,expire=false,failEnd=false,holdEnd=null,holdApply=null,holdHistory=null,nextApplyError=null;
 const retired=new Set();
 try{
  await page.evaluate(()=>{
   clearTimeout(autoTimer);scheduleGraphApply=()=>{};refreshNativeSources=async()=>{};refreshUniforms=async()=>{};preview=async()=>{};
   nativeSourcePolling=uniformPolling=customPolling=true;uniformLive.disconnect();uniformLive.connect=()=>{};
   readonly=historyBusy=nativeMutationBusy=false;connectionInterrupted=true;graphTrail=[];graph.functions=[];graph.declarations=[];past=[];future=[];
   editorTarget='mat';graph.target='mat';stage='pixel';graph.stages.vertex={nodes:[testNode('vertex','vertex_out',700,150)],edges:[]};
   graph.stages.pixel={nodes:[testNode('source','scalar',70,130,{type:'float',value:.25}),testNode('pixel','pixel_out',700,150)],edges:[]};
   selected=null;selection.clear();dirty=false;rememberSavedGraph(graph);render();
   window.addPreview=()=>change(()=>{const n=instantiate(catalog.find(d=>d.key==='preview'),340,190);current().edges.push({from:['source','out'],to:[n.id,'value']});selectNode(n);});
  });
  saved=await page.evaluate(()=>clone(graph));serverRevision=await page.evaluate(()=>revision);
  await page.route('**/api/**',async route=>{
   const req=route.request(),op=new URL(req.url()).pathname.split('/').at(-1),body=req.postDataJSON();calls.push({op,body});
   const send=(json,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(json)});
   if(op==='state')return send({...fixture,state:{...fixture.state,graph:saved,revision:serverRevision}});
   if(op==='apply'){
    if(nextApplyError){const message=nextApplyError;nextApplyError=null;if(holdApply){const wait=holdApply;holdApply=null;await wait;}return send({error:message,diagnostics:[{node:'source',stage:'pixel',message}]},422);}
    if(body.pixelPreview&&retired.has(body.pixelPreview.sessionId))return send({error:'Conflict: Preview session ended'},409);
    if(body.revision!==serverRevision)return send({error:'Conflict: graph revision'},409);
    if(body.pixelPreview&&active&&active!==body.pixelPreview.sessionId)return send({error:'Conflict: another Preview owner'},409);
    if(body.pixelPreview)active=body.pixelPreview.sessionId;
    saved=formal(body.graph);serverRevision++;
    const result={...fixture,state:{...fixture.state,graph:copy(saved),revision:serverRevision},shaderUpdated:true,history:{token:'token-'+serverRevision},pixelPreview:body.pixelPreview?{active:true,sessionId:active,leaseMs:15000}:undefined};
    if(holdApply){const wait=holdApply;holdApply=null;await wait;}
    return send(result);
   }
   if(op==='pixel-preview-session'){
    if(body.action==='end'){
     if(failEnd)return send({error:'Formal output restore failed'},422);
     retired.add(body.sessionId);if(active===body.sessionId)active=null;
     if(holdEnd){const wait=holdEnd;holdEnd=null;await wait;}
     return send({active:false,sessionId:body.sessionId,revision:serverRevision});
    }
    if(expire){active=null;retired.add(body.sessionId);}
    return send({active:active===body.sessionId,sessionId:body.sessionId,leaseMs:15000,revision:serverRevision});
   }
   if(op==='uniforms')return send({revision:serverRevision,uniforms:{},textures:{}});
   if(op==='preview')return route.fulfill({status:204});
   if(op==='export'||op==='personal-save')return send({path:'isolated-test.json'});
   if(op==='inspect')return send({status:'valid',candidate:body.graph});
   if(op==='history-restore'){if(holdHistory){const wait=holdHistory;holdHistory=null;await wait;}return send({graph:body.graph,revision:serverRevision,history:{token:'test-history'}});}
   return send({},404);
  });
  await page.evaluate(()=>addPreview());
  const frameProjection=await page.evaluate(()=>{const working=clone(graph),id=working.stages.pixel.nodes.find(n=>n.definitionUuid==='sgrape.builtin.preview').id;working.stages.pixel.ui={frames:[{id:'preview-only',name:'temporary',nodes:[id]}]};const clean=withoutPixelPreview(working),restored=withPixelPreview(clean,working);return {clean:clean.stages.pixel.ui,restored:restored.stages.pixel.ui};});
  assert.deepEqual(frameProjection.clean,{frames:[]});assert.equal(frameProjection.restored.frames[0].id,'preview-only');
  const draft=await page.evaluate(()=>JSON.parse(sessionStorage.getItem(draftKey)).graph);
  assert.equal(hasPreview(draft),false);assert.equal(draft.stages.pixel.edges.length,0);
  assert.equal(await page.evaluate(()=>applyGraph()),true);
  let claim=calls.find(c=>c.op==='apply').body.pixelPreview;
  assert.match(claim.sessionId,/^[a-f0-9-]{36}$/i);assert.equal(claim.sequence,1);assert.equal(hasPreview(saved),false);
  assert.equal(await page.evaluate(()=>hasPixelPreview(graph)&&pixelPreviewSession.active&&!dirty),true);
  checks.push('First Apply claims one session with full working Preview, while clean persisted response leaves the local overlay intact');

  const png=await page.evaluate(async()=>{const {canvas,snapshot,view}=graphPngCanvas(),raw=await new Promise(r=>canvas.toBlob(r));const bytes=PngGraph.attach(new Uint8Array(await raw.arrayBuffer()),snapshot,view);return {snapshot,decoded:PngGraph.extract(bytes)};});
  assert.equal(hasPreview(png.snapshot),false);assert.equal(hasPreview(JSON.parse(png.decoded.raw)),false);
  const downloadPromise=page.waitForEvent('download');await page.evaluate(()=>downloadGraphJson());const download=await downloadPromise;
  const jsonPath=path.join(folder,'formal-export.json');await download.saveAs(jsonPath);assert.equal(hasPreview(JSON.parse(fs.readFileSync(jsonPath))),false);
  await page.evaluate(async()=>{await api('export',{graph});await api('personal-save',{graph});await api('inspect',{graph});await api('history-restore',{graph,currentGraph:graph});});
  for(const call of calls.filter(c=>['export','personal-save','inspect','history-restore'].includes(c.op))){assert.equal(hasPreview(call.body.graph),false);if(call.body.currentGraph)assert.equal(hasPreview(call.body.currentGraph),false);}
  assert.equal(hasPreview(await page.evaluate(()=>clone(graph))),true);
  checks.push('Draft, downloaded JSON, PNG metadata, host export, personal save, import inspection and History payloads exclude Preview without deleting the working node');

  const overlay=await page.evaluate(()=>{
   const id=current().nodes.find(n=>n.definitionUuid==='sgrape.builtin.preview').id;
   const data={graph:withoutPixelPreview(graph),revision:revision+1,enabled:false,uniforms:[],specConstants:[]};data.graph.stages.pixel.nodes.find(n=>n.id==='source').ui.x=90;
   receiveNativeSources(data);return {id:current().nodes.find(n=>n.definitionUuid==='sgrape.builtin.preview').id,connected:current().edges.some(e=>e.to[0]===id),x:current().nodes.find(n=>n.id==='source').ui.x,revision};
  });
  assert.equal(overlay.connected,true);assert.equal(overlay.x,90);saved=await page.evaluate(()=>withoutPixelPreview(graph));serverRevision=overlay.revision;
  await page.evaluate(()=>change(()=>current().nodes.find(n=>n.id==='source').params.value=.75));await page.evaluate(()=>applyGraph());
  assert.equal(saved.stages.pixel.nodes.find(n=>n.id==='source').params.value,.75);assert.equal(hasPreview(saved),false);
  assert.equal(calls.filter(c=>c.op==='apply').at(-1).body.pixelPreview.sessionId,claim.sessionId);
  checks.push('Native source snapshots preserve the Preview overlay, and ordinary formal edits still save under the same active session');

  await page.evaluate(()=>{stage='vertex';render();stage='pixel';render();});assert.equal(active,claim.sessionId);
  await page.evaluate(()=>{const n=current().nodes.find(n=>n.definitionUuid==='sgrape.builtin.preview');selected=n.id;selection=new Set([n.id]);remove();});
  await page.evaluate(()=>applyGraph());assert.equal(active,null);assert.equal(await page.evaluate(()=>pixelPreviewSession),null);
  await page.evaluate(()=>undo());assert.equal(await page.evaluate(()=>hasPixelPreview(graph)),true);await page.evaluate(()=>applyGraph());
  const second=calls.filter(c=>c.op==='apply').at(-1).body.pixelPreview;assert.notEqual(second.sessionId,claim.sessionId);claim=second;
  checks.push('Stage navigation retains the lifetime; removing Preview restores formal output, and Undo starts a fresh non-retired session');

  failEnd=true;
  const refused=await page.evaluate(async()=>{const before=JSON.stringify(graph);examples.__lifetime=withoutPixelPreview(graph);examples.__lifetime.stages.pixel.nodes.find(n=>n.id==='source').params.value=.9;return {ok:await loadExample('__lifetime'),same:before===JSON.stringify(graph),ending:pixelPreviewSession.ending};});
  assert.deepEqual(refused,{ok:false,same:true,ending:false});assert.equal(active,claim.sessionId);failEnd=false;
  let releaseEnd;holdEnd=new Promise(r=>releaseEnd=r);
  await page.evaluate(()=>{window.pendingReplacement=loadExample('__lifetime');});
  await page.waitForFunction(()=>pixelPreviewSession?.ending===true);
  assert.equal(await page.evaluate(()=>current().nodes.find(n=>n.id==='source').params.value),.75);
  assert.equal(await page.evaluate(()=>change(()=>current().nodes.find(n=>n.id==='source').params.value=88)),false);
  releaseEnd();assert.equal(await page.evaluate(()=>pendingReplacement),true);
  assert.equal(await page.evaluate(()=>current().nodes.find(n=>n.id==='source').params.value),.9);assert.equal(await page.evaluate(()=>hasPixelPreview(graph)),false);
  assert.equal(await page.evaluate(()=>past.some(e=>hasPixelPreview(e.before)||hasPixelPreview(e.after))),false);
  checks.push('Example replacement waits for a successful End receipt, blocks concurrent edits, and is rejected without changing the document if restore fails');

  await page.evaluate(()=>addPreview());await page.evaluate(()=>applyGraph());expire=true;
  const beforeHeartbeatApply=calls.filter(c=>c.op==='apply').length;
  await page.waitForFunction(()=>pixelPreviewSession===null&&!hasPixelPreview(graph),null,{timeout:5500});expire=false;
  assert.equal(calls.filter(c=>c.op==='apply').length,beforeHeartbeatApply);
  assert.equal(await page.evaluate(()=>past.some(e=>hasPixelPreview(e.before)||hasPixelPreview(e.after))),false);
  assert.equal(await page.evaluate(()=>dirty),false);
  checks.push('An inactive heartbeat removes expired local Preview and its Undo resurrection paths without silently reclaiming the Host session');

  await page.evaluate(()=>addPreview());await page.evaluate(()=>applyGraph());
  await page.evaluate(()=>{importReview={name:'test.json',target:editorTarget,baseGraph:JSON.stringify(graph),candidate:withoutPixelPreview(graph)};importReview.candidate.stages.pixel.nodes.find(n=>n.id==='source').params.value=.6;});
  assert.equal(await page.evaluate(()=>acceptImportReview()),true);assert.equal(active,null);assert.equal(await page.evaluate(()=>hasPixelPreview(graph)),false);
  await page.evaluate(()=>addPreview());await page.evaluate(()=>applyGraph());await page.evaluate(()=>load());
  assert.equal(active,null);assert.equal(await page.evaluate(()=>hasPixelPreview(graph)),false);assert.equal(await page.evaluate(()=>past.length),0);
  checks.push('Import acceptance and explicit graph reload release the runtime override and load only formal content');

  await page.evaluate(()=>addPreview());
  let releaseApply;holdApply=new Promise(r=>releaseApply=r);
  await page.evaluate(()=>{window.pendingPreviewApply=applyGraph();});
  await page.waitForFunction(()=>pixelPreviewSession!==null&&submitBusy);
  while(!active)await new Promise(r=>setTimeout(r,10));
  const oldSession=active;
  await page.evaluate(()=>releasePixelPreview());assert.equal(active,null);
  const receiptState=await page.evaluate(()=>({revision,dirty,past:past.length,graph:JSON.stringify(graph)}));
  releaseApply();await page.evaluate(()=>pendingPreviewApply);
  assert.deepEqual(await page.evaluate(()=>({revision,dirty,past:past.length,graph:JSON.stringify(graph)})),receiptState);
  assert.equal(retired.has(oldSession),true);
  checks.push('End receipt wins over a delayed successful Apply response; the old response cannot resurrect Preview or change dirty/history/revision');

  await page.evaluate(()=>{clearCompileDiagnostics();conflicted=false;nativeSourceUncertain=false;status('',false,{clearError:true});addPreview();});
  let releaseFailure;holdApply=new Promise(r=>releaseFailure=r);nextApplyError='late old Preview compilation failure';
  const beforeFailureCalls=calls.filter(c=>c.op==='apply').length;
  await page.evaluate(()=>{window.pendingFailedPreviewApply=applyGraph();});
  while(calls.filter(c=>c.op==='apply').length===beforeFailureCalls)await new Promise(r=>setTimeout(r,10));
  await page.evaluate(()=>releasePixelPreview());
  const beforeFailure=await page.evaluate(()=>({revision,dirty,past:past.length,graph:JSON.stringify(graph),compileIssueText,conflicted,nativeSourceUncertain,status:$('#status').textContent}));
  releaseFailure();await page.evaluate(()=>pendingFailedPreviewApply);
  assert.deepEqual(await page.evaluate(()=>({revision,dirty,past:past.length,graph:JSON.stringify(graph),compileIssueText,conflicted,nativeSourceUncertain,status:$('#status').textContent})),beforeFailure);
  checks.push('A delayed failed Apply after End cannot restore old compile diagnostics, conflict, uncertainty, status or document state');

  await page.evaluate(()=>addPreview());await page.evaluate(()=>applyGraph());
  await page.evaluate(()=>{
   graph.declarations.push({id:'history-uniform',kind:'uniform',name:'uBefore',type:'float'});const before=clone(graph);
   graph.declarations.at(-1).name='uAfter';recordHistory({kind:'source',before,after:clone(graph),sourceIds:['history-uniform'],nativeBefore:'before-rename',nativeAfter:'after-rename',nativeApplied:true});
   dirty=false;rememberSavedGraph(graph);
  });
  let releaseHistory;holdHistory=new Promise(r=>releaseHistory=r);
  const beforeHistoryCalls=calls.filter(c=>c.op==='history-restore').length;
  await page.evaluate(()=>{window.pendingNativeUndo=undo();});
  while(calls.filter(c=>c.op==='history-restore').length===beforeHistoryCalls)await new Promise(r=>setTimeout(r,10));
  await page.evaluate(()=>dispatchEvent(new Event('pagehide')));releaseHistory();
  assert.equal(await page.evaluate(()=>pendingNativeUndo),true);
  assert.equal(await page.evaluate(()=>hasPixelPreview(graph)),false);
  assert.equal(await page.evaluate(()=>graph.declarations.at(-1).name),'uBefore');
  assert.equal(await page.evaluate(()=>future.at(-1)?.kind),'source');
  assert.equal(await page.evaluate(()=>past.some(e=>hasPixelPreview(e.before)||hasPixelPreview(e.after))||future.some(e=>hasPixelPreview(e.before)||hasPixelPreview(e.after))),false);
  checks.push('A native History reply captured before page hide cannot resurrect Preview; formal Undo and its History stack remain coherent');

  await page.evaluate(()=>addPreview());await page.evaluate(()=>applyGraph());const finalSession=active;
  await page.evaluate(()=>dispatchEvent(new Event('pagehide')));
  await page.waitForFunction(()=>pixelPreviewSession===null);
  await new Promise(r=>setTimeout(r,100));
  const lastEnd=calls.filter(c=>c.op==='pixel-preview-session'&&c.body.action==='end').at(-1);
  assert.equal(lastEnd.body.sessionId,finalSession);assert.equal(active,null);assert.equal(await page.evaluate(()=>hasPixelPreview(graph)),false);
  checks.push('Page hide sends a best-effort End for the exact session and discards the local transient node; server TTL remains an independent fallback');
  assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,count:checks.length}));
 }catch(error){await h.finish(error);throw error;}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
