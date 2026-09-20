/* Graph + Inputs history contracts against the actual editor and an isolated API.
 * node test_input_history.cjs SOURCE_DIR STATE_JSON REPORT_DIR
 * Native receipts are immutable configuration snapshots; restore CAS touches only
 * changed fields inside sourceIds. Real TD sequence/Bind behavior has separate tests.
 */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const [source,stateFile,folder]=process.argv.slice(2);
assert.ok(source&&stateFile&&folder,'Expected SOURCE_DIR STATE_JSON REPORT_DIR');
const copy=x=>JSON.parse(JSON.stringify(x)),key=x=>JSON.stringify(x??null);
const fixture=JSON.parse(fs.readFileSync(stateFile,'utf8').replace(/^\uFEFF/,''));
fs.mkdirSync(folder,{recursive:true});
const builtin=(id,name,x,y)=>{const d=fixture.catalog.find(d=>d.key===name);assert.ok(d,name);return{id,definitionUuid:d.definitionUuid,revisionHash:d.revisionHash,params:copy(d.defaults),ui:{x,y}};};
const base=copy(fixture.state.graph);base.functions=[];base.declarations=[
 {id:'Live',kind:'uniform',name:'uLive',type:'float',value:.25},
 {id:'Other',kind:'uniform',name:'uOther',type:'float',value:.5},
 {id:'Missing',kind:'uniform',name:'uMissing',type:'float',value:.125,sourceMissing:true}
];
base.stages.pixel={nodes:[builtin('movable','float',96,96),builtin('pixel','pixel_out',480,96)],edges:[]};
fixture.upgradeReview=null;
const receipts=new Map(),requests=[],checks=[],errors=[],heldResponses=[];
let nextApplyResponse=null;
function holdApplyResponse(){let release;const gate={started:false,promise:new Promise(r=>release=r),release:()=>release()};nextApplyResponse=gate;heldResponses.push(gate);return gate;}
async function waitForHeldResponse(gate){const deadline=Date.now()+5000;while(!gate.started&&Date.now()<deadline)await new Promise(r=>setTimeout(r,10));assert.equal(gate.started,true,'Apply request did not reach fixture');}
let nativeGraph,nativeRows,revision,sourceChanged,failRestore=false,acceptDialog=true,applyCount=0,restoreCount=0;
const makeRow=d=>({name:d.name,sequence:d.nativeSequence||'vec',values:Array.from({length:4},(_,i)=>Array.isArray(d.value)?d.value[i]??0:i?0:d.value),mode:'CONSTANT',expression:''});
const receipt=()=>{const config=Object.fromEntries(Object.entries(nativeRows).sort(([a],[b])=>a.localeCompare(b)));const token=crypto.createHash('sha256').update(key(config)).digest('hex');if(!receipts.has(token))receipts.set(token,copy(config));return token;};
const components=(id,row)=>row.values.map((value,i)=>({parameter:row.sequence+'_'+id+'_'+i,value,mode:row.mode,expression:row.expression,binding:'',writable:row.mode==='CONSTANT',modeWritable:true,modeExpected:key([row.mode,row.expression])}));
const snapshot=()=>({enabled:true,revision,sourceChanged,graph:copy(nativeGraph),declarations:copy(nativeGraph.declarations),issues:[],topInputs:[],history:{token:receipt()},uniforms:nativeGraph.declarations.filter(d=>d.kind==='uniform').map(d=>{
 const row=nativeRows[d.id];return{id:d.id,name:d.name,type:d.type,default:copy(d.value),missing:!row,pending:false,nameWritable:!!row,expected:row?key([d.id,row.name]):null,sequence:row?.sequence||'',components:row?components(d.id,row):[]};
})});
function resetModel(){nativeGraph=copy(base);nativeRows=Object.fromEntries(base.declarations.filter(d=>!d.sourceMissing).map(d=>[d.id,makeRow(d)]));revision=fixture.state.revision;sourceChanged=false;failRestore=false;receipt();}
resetModel();
function conflict(message='Conflict: touched native source changed outside this history.'){const e=Error(message);e.status=409;throw e;}
function restore(body){
 assert.equal(body.revision,revision);assert.ok(body.requestId);assert.ok(receipts.has(body.fromToken)&&receipts.has(body.toToken),'immutable receipts must exist');
 assert.equal(new Set(body.sourceIds).size,body.sourceIds.length);
 if(failRestore){failRestore=false;conflict('Injected restore failure; native data retained.');}
 assert.ok(receipts.has(body.deltaFromToken)&&receipts.has(body.deltaToToken),'operation delta receipts must remain immutable');
 const before=receipts.get(body.fromToken),target=receipts.get(body.toToken),deltaBefore=receipts.get(body.deltaFromToken),deltaAfter=receipts.get(body.deltaToToken),desired=body.graph,updates=copy(nativeRows);
 const project=(row,d)=>d&&!d.sourceMissing?{...copy(row||makeRow(d)),name:d.name}:null;
 const oldDecl=new Map(body.currentGraph.declarations.filter(d=>d.kind==='uniform').map(d=>[d.id,d])),newDecl=new Map(desired.declarations.filter(d=>d.kind==='uniform').map(d=>[d.id,d]));
 for(const id of new Set([...oldDecl.keys(),...newDecl.keys()]))if(key(oldDecl.get(id))!==key(newDecl.get(id)))assert.ok(body.sourceIds.includes(id),'restore cannot mutate declarations outside sourceIds');
 for(const id of body.sourceIds){
  const left=before[id],decl=newDecl.get(id),right=project(target[id],decl),live=nativeRows[id],scopeLeft=project(deltaBefore[id],oldDecl.get(id)),scopeRight=project(deltaAfter[id],decl);
  if(!!left!==!!right){if(key(left)!==key(live))conflict();if(right)updates[id]=right;else delete updates[id];continue;}
  if(!!left!==!!live)conflict();if(!left)continue;
  // Other components/other source IDs may change externally and must survive.
  for(const field of ['name','sequence','mode','expression'])if(scopeLeft?.[field]!==scopeRight?.[field]&&left[field]!==right[field]){if(live[field]!==left[field])conflict();updates[id][field]=right[field];}
  for(let i=0;i<4;i++)if(scopeLeft?.values[i]!==scopeRight?.values[i]&&left.values[i]!==right.values[i]){if(live.values[i]!==left.values[i])conflict();updates[id].values[i]=right.values[i];}
 }
 nativeRows=updates;nativeGraph=copy(desired);revision++;sourceChanged=true;restoreCount++;return snapshot();
}
const server=http.createServer(async(req,res)=>{
 try{
  const route=new URL(req.url,'http://localhost').pathname;res.setHeader('Cache-Control','no-store');
  if(route.startsWith('/api/')){
   let raw='';for await(const chunk of req)raw+=chunk;const body=raw?JSON.parse(raw):{},operation=route.split('/').at(-1),beforeToken=receipt();res.setHeader('Content-Type','application/json');
   if(req.method==='POST')requests.push({operation,body:copy(body)});
   if(operation==='state')return res.end(JSON.stringify({...fixture,state:{...fixture.state,graph:copy(nativeGraph),revision},history:{token:receipt()}}));
   if(operation==='sources')return res.end(JSON.stringify(snapshot()));
   if(operation==='shaders')return res.end(JSON.stringify({projectFile:'Input-history-fixture.toe',shaders:[]}));
   if(operation==='uniforms')return res.end(JSON.stringify({revision,uniforms:{},textures:{},history:{token:receipt()}}));
   if(operation==='preview'){res.statusCode=204;return res.end();}
   if(operation==='apply'){
    assert.equal(body.revision,revision);nativeGraph=copy(body.graph);
    for(const d of nativeGraph.declarations.filter(d=>d.kind==='uniform'&&!d.sourceMissing)){if(!nativeRows[d.id])nativeRows[d.id]=makeRow(d);else nativeRows[d.id].name=d.name;}
    revision++;sourceChanged=false;applyCount++;const response={state:{graph:copy(nativeGraph),revision},target:fixture.target,history:{token:receipt(),beforeToken},shaderUpdated:true};
    if(nextApplyResponse){const gate=nextApplyResponse;nextApplyResponse=null;gate.started=true;await gate.promise;}
    return res.end(JSON.stringify(response));
   }
   if(operation==='source-value'){
    assert.equal(body.revision,revision);const row=nativeRows[body.id];assert.ok(row);assert.deepEqual(body.expected,components(body.id,row)[body.component]);row.values[body.component]=body.value;const out=snapshot();out.history.beforeToken=beforeToken;return res.end(JSON.stringify(out));
   }
   if(operation==='source-edit'){
    assert.equal(body.revision,revision);const d=nativeGraph.declarations.find(d=>d.id===body.id);assert.ok(d);const row=nativeRows[body.id];assert.equal(body.expected,row?key([body.id,row.name]):null);
    if(body.action==='remove'){delete nativeRows[body.id];nativeGraph.declarations=nativeGraph.declarations.filter(d=>d.id!==body.id);}
    else if(body.action==='restore'){delete d.sourceMissing;nativeRows[body.id]=makeRow(d);}
    else if(body.action==='rename'){d.name=body.name;row.name=body.name;}
    else throw Error('Unexpected source action '+body.action);
    revision++;sourceChanged=true;const out=snapshot();out.history.beforeToken=beforeToken;return res.end(JSON.stringify(out));
   }
   if(operation==='history-restore')return res.end(JSON.stringify(restore(body)));
   res.statusCode=404;return res.end('{}');
  }
  const name=route==='/'?'index.html':route.slice(1);if(!/^[a-z0-9_.-]+$/i.test(name)){res.statusCode=404;return res.end();}
  const file=path.join(source,name);if(!fs.existsSync(file)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));
 }catch(e){if(!e.status)errors.push('fixture: '+e.stack);res.statusCode=e.status||500;res.end(JSON.stringify({error:e.message}));}
});
(async()=>{
 let browser,page,failure;
 try{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE});page=await browser.newPage({viewport:{width:1560,height:1000}});page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>acceptDialog?d.accept():d.dismiss());
  const url='http://127.0.0.1:'+server.address().port;
  await page.exposeFunction('fixtureConfirm',()=>acceptDialog);
  const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const reset=async()=>{resetModel();acceptDialog=true;if(page.url()!=='about:blank')await page.evaluate(()=>sessionStorage.removeItem(draftKey));await page.goto(url);await page.waitForSelector('[data-node="movable"]');await page.waitForFunction(()=>nativeSourceSnapshot?.enabled&&!!historyNativeToken);await page.selectOption('#language','en');await page.evaluate(()=>{clearTimeout(autoTimer);autoTimer=null;scheduleGraphApply=()=>{clearTimeout(autoTimer);autoTimer=null;};confirmOverlay=fixtureConfirm;nativeSourcePolling=true;uniformPolling=true;customPolling=true;workspaceLayout.reveal('uniforms');});await settle();};
  const position=()=>page.evaluate(()=>current().nodes.find(n=>n.id==='movable').ui.x);
  const cursor=()=>page.evaluate(()=>JSON.stringify({graph,past,future,revision,historyNativeToken}));
  const move=async dx=>{const before=await position(),r=await page.locator('[data-node="movable"] .node-title').boundingBox();await page.mouse.move(r.x+30,r.y+15);await page.mouse.down();await page.mouse.move(r.x+30+dx,r.y+15,{steps:6});await page.mouse.up();await settle();assert.notEqual(await position(),before);return position();};
  const select=async id=>{await page.locator('[data-input-source="'+id+'"] .input-source-select').click();await settle();};
  const value=async v=>{if(await page.evaluate(()=>dirty))await apply();await select('Live');const input=page.locator('#inspector [data-native-source="Live"] [data-source-component="0"]');await input.fill(String(v));await input.press('Enter');await page.waitForFunction(()=>!nativeSourceBusy&&!nativeMutationBusy);await settle();assert.equal(nativeRows.Live.values[0],v);};
  const replay=async(redo=false)=>{assert.equal(await page.evaluate(redo=>undo(redo),redo),true);await settle();};
  const apply=async()=>{await page.evaluate(()=>applyGraph());await page.waitForFunction(()=>!submitBusy);await settle();assert.equal(await page.evaluate(()=>dirty),false);await page.evaluate(async()=>receiveNativeSources(await api('sources')));};
  const create=async name=>{await page.evaluate(()=>openInputCreate('uniform'));await page.locator('#sourcename').fill(name);await page.locator('#sourcecreate button[type=submit]').click();await page.locator('#sourcecreatedialog').waitFor({state:'hidden'});return page.evaluate(name=>graph.declarations.find(d=>d.name===name).id,name);};
  const type=async(id,name)=>{await select(id);await page.locator('#inspector select').first().selectOption(name);await settle();};
  const declaration=id=>page.evaluate(id=>graph.declarations.find(d=>d.id===id)||null,id);

  await reset();const x0=await position(),x1=await move(48);await value(.75);const x2=await move(48);
  assert.deepEqual(await page.evaluate(()=>[past.length,future.length]),[3,0]);await replay();assert.equal(await position(),x1);assert.equal(nativeRows.Live.values[0],.75);
  await replay();assert.equal(await position(),x1);assert.equal(nativeRows.Live.values[0],.25);await replay();assert.equal(await position(),x0);
  await replay(true);await replay(true);await replay(true);assert.equal(await position(),x2);assert.equal(nativeRows.Live.values[0],.75);
  checks.push('move → native value → move has three distinct Undo/Redo steps, retaining the intermediate positions and native value');

  await reset();await value(.6);await replay();await select('Live');const beforeNoop=await cursor(),writeBefore=requests.length;
  acceptDialog=false;await page.locator('[data-source-remove="Live"][data-source-action="remove"]').click();await settle();acceptDialog=true;assert.equal(await cursor(),beforeNoop);assert.equal(requests.length,writeBefore);
  await page.evaluate(()=>change(()=>{}));assert.equal(await cursor(),beforeNoop);
  await page.evaluate(()=>nativeSourceRequest('source-value',{id:'Live',component:0,value:nativeSourceSnapshot.uniforms.find(r=>r.id==='Live').components[0].value,expected:clone(nativeSourceSnapshot.uniforms.find(r=>r.id==='Live').components[0])}));
  assert.deepEqual(await page.evaluate(()=>[past.length,future.length]),[0,1]);await replay(true);assert.equal(nativeRows.Live.values[0],.6);
  checks.push('canceled Remove, no-op graph edit and same-value native write preserve Redo');

  await reset();await select('Live');await page.locator('[data-source-remove="Live"][data-source-action="remove"]').click();await page.waitForFunction(()=>!nativeSourceBusy&&!nativeMutationBusy);assert.equal(await declaration('Live'),null);assert.equal(nativeRows.Live,undefined);
  await replay();assert.equal((await declaration('Live')).name,'uLive');assert.equal(nativeRows.Live.values[0],.25);await replay(true);assert.equal(await declaration('Live'),null);
  await reset();await select('Missing');await page.locator('[data-source-remove="Missing"][data-source-action="restore"]').click();await page.waitForFunction(()=>!nativeSourceBusy&&!nativeMutationBusy);assert.equal(nativeRows.Missing.values[0],.125);await replay();assert.equal((await declaration('Missing')).sourceMissing,true);assert.equal(nativeRows.Missing,undefined);await replay(true);assert.equal(nativeRows.Missing.values[0],.125);
  checks.push('native Remove and missing-source Restore each undo/redo independently with source identity and defaults retained');

  await reset();const a=await create('uBatchA'),b=await create('uBatchB'),applyBefore=applyCount;assert.equal(nativeRows[a],undefined);assert.equal(nativeRows[b],undefined);await apply();assert.equal(applyCount,applyBefore+1);assert.ok(nativeRows[a]&&nativeRows[b]);
  await replay();assert.ok(nativeRows[a]);assert.equal(nativeRows[b],undefined);assert.ok(await declaration(a));assert.equal(await declaration(b),null);await replay();assert.equal(nativeRows[a],undefined);await replay(true);assert.ok(nativeRows[a]);assert.equal(nativeRows[b],undefined);await replay(true);assert.ok(nativeRows[a]&&nativeRows[b]);
  checks.push('one Apply containing new Uniform A and B still undoes and redoes one source at a time');

  await reset();const pending=await create('uPending');await page.locator('[data-input-name="'+pending+'"]').fill('uRenamed');await page.locator('[data-input-name="'+pending+'"]').press('Enter');await type(pending,'vec2');await type(pending,'vec3');await apply();
  assert.equal((await declaration(pending)).type,'vec3');await replay();assert.equal((await declaration(pending)).type,'vec2');assert.equal(nativeRows[pending].name,'uRenamed');await replay();assert.equal((await declaration(pending)).type,'float');await replay();assert.equal((await declaration(pending)).name,'uPending');assert.equal(nativeRows[pending].name,'uPending');await replay();assert.equal(nativeRows[pending],undefined);
  for(let i=0;i<4;i++)await replay(true);assert.equal((await declaration(pending)).type,'vec3');assert.equal(nativeRows[pending].name,'uRenamed');
  checks.push('one Apply containing a new source, pending rename and successive type changes replays every intermediate declaration');

  await reset();await value(.9);const beforeFailure=await cursor(),nativeBefore=copy(nativeRows);failRestore=true;assert.equal(await page.evaluate(()=>undo()),false);assert.equal(await cursor(),beforeFailure);assert.deepEqual(nativeRows,nativeBefore);assert.match(await page.locator('#status').innerText(),/Injected restore failure/);await replay();assert.equal(nativeRows.Live.values[0],.25);
  checks.push('a failed restore keeps graph, history cursor and native values; the same Undo can succeed on retry');

  await reset();await value(.8);nativeRows.Other.values[0]=.875;nativeRows.Live.values[2]=.625;await page.evaluate(async()=>receiveNativeSources(await api('sources')));await replay();assert.equal(nativeRows.Live.values[0],.25);assert.equal(nativeRows.Live.values[2],.625);assert.equal(nativeRows.Other.values[0],.875);await replay(true);assert.equal(nativeRows.Live.values[0],.8);assert.equal(nativeRows.Live.values[2],.625);
  nativeRows.Live.values[0]=.33;await page.evaluate(async()=>receiveNativeSources(await api('sources')));const conflictCursor=await cursor();assert.equal(await page.evaluate(()=>undo()),false);assert.equal(await cursor(),conflictCursor);assert.equal(nativeRows.Live.values[0],.33);assert.match(await page.locator('#status').innerText(),/Conflict/);
  await reset();await type('Live','vec3');nativeRows.Live.values[2]=.625;await apply();const appliedExternal=copy(nativeRows);await replay();assert.equal((await declaration('Live')).type,'float');assert.deepEqual(nativeRows,appliedExternal);await replay(true);assert.equal((await declaration('Live')).type,'vec3');assert.deepEqual(nativeRows,appliedExternal);
  checks.push('restore preserves external changes to another source or untouched component, including changes before a pending graph Apply, but rejects a changed touched component without advancing history');

  await reset();const delayedA=await create('uDelayedA'),delayedB=await create('uDelayedB'),gate=holdApplyResponse();
  await page.evaluate(()=>{window.historyTestApply=applyGraph();});await waitForHeldResponse(gate);const restoreBefore=requests.filter(r=>r.operation==='history-restore').length;
  await page.evaluate(()=>{window.historyTestUndo=undo();});await settle();assert.equal(await page.evaluate(()=>historyBusy),true);assert.deepEqual(await page.evaluate(()=>[past.length,future.length]),[2,0]);assert.equal(requests.filter(r=>r.operation==='history-restore').length,restoreBefore);assert.ok(await declaration(delayedA));assert.ok(await declaration(delayedB));
  gate.release();assert.equal(await page.evaluate(()=>window.historyTestUndo),true);await settle();assert.ok(nativeRows[delayedA]);assert.equal(nativeRows[delayedB],undefined);assert.ok(await declaration(delayedA));assert.equal(await declaration(delayedB),null);assert.deepEqual(await page.evaluate(()=>[past.length,future.length]),[1,1]);
  checks.push('Undo during a delayed Apply waits for its receipt, then replays only the last source step without adding an Apply history entry');

  await reset();const obsolete=await create('uObsolete'),late=holdApplyResponse();await page.evaluate(()=>{window.historyTestOldApply=applyGraph();});await waitForHeldResponse(late);
  const nextRevision=revision+1;resetModel();revision=nextRevision;nativeGraph.stages.pixel.nodes.find(n=>n.id==='movable').ui.x=777;
  await page.evaluate(async()=>{sessionStorage.removeItem(draftKey);await load();nativeSourcePolling=true;uniformPolling=true;customPolling=true;});await settle();const loadedCursor=await cursor();assert.equal(await position(),777);assert.equal(await declaration(obsolete),null);
  late.release();await page.evaluate(()=>window.historyTestOldApply);await settle();assert.equal(await cursor(),loadedCursor);assert.equal(await position(),777);assert.deepEqual(await page.evaluate(()=>[past.length,future.length,submitBusy,historyBusy]),[0,0,false,false]);assert.equal(await page.locator('#apply').isEnabled(),true);
  checks.push('a new load generation keeps its graph/revision/history and usable controls when an older Apply response arrives afterward');

  await reset();nativeRows.Live.values=[.25,.4,.6,.8];await page.evaluate(async()=>receiveNativeSources(await api('sources')));const retainedNative=copy(nativeRows);
  const imported=copy(base);imported.declarations=[{id:'importLive',kind:'uniform',name:'uLive',type:'vec3',value:[9,8,7],sourceMissing:true}];
  const uniformRef=builtin('import-ref','uniform',96,280);uniformRef.params={declarationId:'importLive'};imported.stages.pixel.nodes.push(uniformRef);
  imported.functions=[{id:'import-function',name:'Imported function',scope:'local',stages:['pixel'],inputs:[],outputs:[],graph:{nodes:[{...copy(uniformRef),id:'function-ref'}],edges:[]}}];
  const acceptImport=async candidate=>page.evaluate(candidate=>{importReview={name:'history-fixture.json',status:'valid',candidate,baseGraph:JSON.stringify(graph),target:editorTarget};return acceptImportReview();},candidate);
  const checkInventory=async()=>{assert.deepEqual(await page.evaluate(()=>graph.declarations.filter(d=>d.kind==='uniform'&&!d.sourceMissing).map(d=>d.id).sort()),['Live','Other']);assert.deepEqual(nativeRows,retainedNative);};
  assert.equal(await acceptImport(imported),true);assert.equal((await declaration('Live')).type,'vec3');assert.deepEqual((await declaration('Live')).value,[9,8,7]);assert.equal(await declaration('importLive'),null);assert.equal(await declaration('Missing'),null);
  assert.deepEqual(await page.evaluate(()=>[graph.stages.pixel.nodes.find(n=>n.id==='import-ref').params.declarationId,graph.functions[0].graph.nodes[0].params.declarationId]),['Live','Live']);
  await apply();await checkInventory();await replay();assert.equal((await declaration('Live')).type,'float');await checkInventory();await replay(true);assert.equal((await declaration('Live')).type,'vec3');await page.evaluate(async()=>receiveNativeSources(await api('sources')));await checkInventory();
  const example=copy(base);example.declarations=[];example.stages.pixel.nodes.find(n=>n.id==='movable').params.value=.99;
  assert.equal(await page.evaluate(example=>{examples.historyFixture=example;return loadExample('historyFixture');},example),true);await apply();await checkInventory();await replay();assert.ok(await page.evaluate(()=>graph.functions.some(f=>f.id==='import-function')));await checkInventory();await replay(true);await page.evaluate(async()=>receiveNativeSources(await api('sources')));await checkInventory();
  const conflictImport=copy(example);conflictImport.declarations=[{id:'foreignKind',kind:'constant',name:'uLive',type:'float',value:1}];const importCursor=await cursor();assert.equal(await acceptImport(conflictImport),false);assert.equal(await cursor(),importCursor);assert.deepEqual(nativeRows,retainedNative);
  checks.push('import and example actions retain live Uniform identity/inventory through Apply, Undo, Redo and polling; imported metadata and stage/function references remap while native values survive, and cross-kind collisions roll back');

  for(const [token,saved]of receipts)assert.equal(crypto.createHash('sha256').update(key(saved)).digest('hex'),token,'receipt payload was mutated');assert.ok(restoreCount>0);assert.deepEqual(errors,[]);await page.screenshot({path:path.join(folder,'input-history.png')});
 }catch(e){failure=e;if(page)await page.screenshot({path:path.join(folder,'failure.png')}).catch(()=>{});}
 finally{for(const gate of heldResponses)gate.release();if(browser)await browser.close();if(server.listening)await new Promise(r=>server.close(r));fs.writeFileSync(path.join(folder,'results.json'),JSON.stringify({passed:!failure,count:checks.length,checks,errors,applyCount,restoreCount,requests,...(failure?{error:failure.stack}:{})},null,2));}
 if(failure)throw failure;console.log(JSON.stringify({passed:true,count:checks.length,checks}));
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
