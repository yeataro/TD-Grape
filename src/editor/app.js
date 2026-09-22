'use strict';
const $=s=>document.querySelector(s), clone=v=>JSON.parse(JSON.stringify(v));
const shaderId=location.pathname.match(/^\/shader\/([a-f0-9]{32})\/$/)?.[1]||'';
const apiRoot='/api/'+(shaderId?shaderId+'/':'');
const draftKey='sgrapeDraft'+(shaderId?':'+shaderId:'');
const token=location.hash.slice(1)||sessionStorage.getItem('sgrapeToken')||'';
sessionStorage.setItem('sgrapeToken',token);history.replaceState(null,'',location.pathname);

const GRID=24;
const GRAPH_ZOOM_MIN=.25,GRAPH_ZOOM_MAX=1.7;
const snap=value=>Math.round(value/GRID)*GRID;
let localeData=null,language='en';
let editorProjectFile=null;
function updateEditorTitle(){
  const target=$('#target')?.textContent||'',project=editorProjectFile===null?'':editorProjectFile||t('project.unsaved');
  document.title=target||project?['TD-Grape',project,target].filter(Boolean).join(' · '):'TD-Grape · Shader Editor';
}
function setEditorTargetPath(path){$('#target').textContent=path||'';updateEditorTitle();}
function receiveProjectSummary(result){
  editorProjectFile=result.projectFile||'';
  const label=$('#projectfile');label.textContent=editorProjectFile||t('project.unsaved');label.title=label.textContent;
  const active=result.shaders?.find(s=>s.id===(shaderId||result.current));if(active)setEditorTargetPath(active.path);else updateEditorTitle();
}
function shortcutModifierLabel(){
  const nav=globalThis.navigator||{},platform=nav.userAgentData?.platform||nav.platform||nav.userAgent||'';
  return /Mac|iPhone|iPad|iPod/i.test(platform)?'Cmd':'Ctrl';
}
function t(key){
  const text=localeData?.messages[key]?.[language]??localeData?.messages[key]?.[localeData.defaultLanguage]??key;
  return text.includes('{modifier}')?text.replaceAll('{modifier}',shortcutModifierLabel()):text;
}
function translatePage(){document.documentElement.lang=language;document.querySelectorAll('[data-language-picker]').forEach(picker=>picker.value=language);updateEditorTitle();document.querySelectorAll('[data-i18n]').forEach(e=>e.textContent=t(e.dataset.i18n));document.querySelectorAll('[data-i18n-placeholder]').forEach(e=>e.placeholder=t(e.dataset.i18nPlaceholder));document.querySelectorAll('[data-i18n-label]').forEach(e=>e.setAttribute('aria-label',t(e.dataset.i18nLabel)));document.querySelectorAll('[data-i18n-alt]').forEach(e=>e.alt=t(e.dataset.i18nAlt));document.querySelectorAll('[data-i18n-title]').forEach(e=>e.title=t(e.dataset.i18nTitle));syncSidebarButtons();workspaceLayout?.translate();renderConnectionNotice();renderHeaderVisibility();renderUIAppearance();renderViewModes();renderGraphZoom();renderUIShare();renderUIExperiments();renderShortcutHelp();}
function setLanguage(value){
  if(!localeData.languages[value]||value===language)return;
  language=value;localStorage.setItem('sgrapeLanguage',language);
  translatePage();render();renderGraphSaveState();renderSavedStateIssue();renderUpgradeNotice();renderUpgradeReview();
  status(upgradePending?t('upgrade.explanation'):savedStateIssue?t('saved.explanation'):t('locale.changed'),!!savedStateIssue);
}
async function initLocale(){
  localeData=await (await fetch('/locales.json')).json();language=localStorage.getItem('sgrapeLanguage')||localeData.defaultLanguage;
  if(!localeData.languages[language])language=localeData.defaultLanguage;
  for(const picker of document.querySelectorAll('[data-language-picker]')){
    for(const [id,label]of Object.entries(localeData.languages))picker.append(el('option',{value:id},label));
    picker.onchange=()=>setLanguage(picker.value);
  }
  translatePage();
}

let editorTarget='mat',editorReadOnlyReason='',savedStateIssue=null;
let graph=null, catalog=[], examples={}, revision=0, selected=null, selectedEdge=null, stage='pixel', dirty=false, readonly=false;
let pan={x:40,y:60}, scale=.8, linkStart=null, past=[], future=[], errorNode=null;
const definition=nodeDefinition;
let persistentStatusError='',statusErrorKind='';
function status(message,error=false,{clearError=false,kind='operation'}={}){
  if(error){persistentStatusError=message;statusErrorKind=kind;}
  else if(clearError===true||clearError===statusErrorKind){persistentStatusError='';statusErrorKind='';}
  const shown=persistentStatusError||message;
  $('#status').textContent=shown;$('#status').title=shown;$('#status').classList.toggle('error',!!persistentStatusError);
  renderStatusVisibility();
}
function renderStatusVisibility(){const message=$('#status');message.hidden=!persistentStatusError&&message.textContent===$('#dirty').textContent;}
// A lost response does not establish whether a TD write committed. Recovery only reads.
const API_TIMEOUT_MS=20000;
let connectionInterrupted=false,connectionIssue='',connectionRetrying=false,applyNeedsReview=false;
let connectionSerial=0,connectionObserved=0,connectionRetryAt=0;
function renderConnectionNotice(){
  const bar=$('#connectionnotice');if(!bar)return;
  bar.hidden=!connectionIssue&&!applyNeedsReview;
  const kind=connectionIssue||'review';bar.dataset.kind=kind;
  $('#connectiontitle').textContent=t('connection.'+kind);
  $('#connectionhint').textContent=t('connection.'+(kind==='auth'?'authHelp':kind==='forbidden'?'forbiddenHelp':kind==='changed'?'changedHelp':kind==='review'?'reviewHelp':'checkHelp'));
  $('#connectionretry').disabled=connectionRetrying;
  $('#connectionretry').textContent=t(connectionRetrying?'connection.checking':'connection.retry');
  $('#connectiondraft').hidden=!graph;
}
function observeConnection(kind,serial){
  if(serial<connectionObserved)return;
  connectionObserved=serial;
  if(kind){
    connectionInterrupted=true;connectionIssue=kind;clearTimeout(autoTimer);
    if(localeData)status(t('connection.'+kind),true,{kind:'connection'});
  }else if(connectionInterrupted){
    connectionInterrupted=false;connectionIssue='';
    if(localeData)status(t('connection.restored'),false,{clearError:'connection'});
  }
  renderConnectionNotice();
}
let pendingEditorWrites=0;
async function editorRequest(path,data,binary=false){
  const serial=++connectionSerial,controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),API_TIMEOUT_MS);
  if(data)pendingEditorWrites++;
  try{
    const r=await fetch(apiRoot+path,{method:data?'POST':'GET',signal:controller.signal,headers:{'X-Sgrape-Token':token,...(data?{'Content-Type':'application/json'}:{})},body:data?JSON.stringify(data):undefined});
    const kind=r.status===401?'auth':r.status===403?'forbidden':r.status===503?'busy':r.status>=500?'unavailable':null;
    if(kind){observeConnection(kind,serial);throw Object.assign(Error(t('connection.'+kind)),{status:r.status,connection:true});}
    const result=r.ok&&binary?await r.blob():await r.json();
    if(!r.ok)throw Object.assign(Error(result.error||t('connection.failed')),{status:r.status,result});
    observeConnection(null,serial);return result;
  }catch(error){
    if(!error.status){observeConnection('unavailable',serial);throw Object.assign(Error(t('connection.unavailable')),{connection:true,cause:error});}
    throw error;
  }finally{clearTimeout(timer);if(data)pendingEditorWrites--;}
}
async function api(path,data){
  const snapshot=['apply','validate'].includes(path)&&graph?JSON.stringify(graph):null,generation=editorLoadGeneration;
  try{return await editorRequest(path,data);}
  catch(error){
    // Authentication, transport failures and revision conflicts are not GLSL errors.
    if(generation===editorLoadGeneration&&snapshot&&error.status===422&&!error.message.startsWith('Conflict:'))setCompileDiagnostics(error.result,snapshot);
    throw error;
  }
}
async function retryConnection(){
  if(connectionRetrying)return;
  connectionRetrying=true;connectionRetryAt=Date.now()+5000;renderConnectionNotice();
  try{
    if(!graph){await startEditor();return;}
    const current=await api('state');
    if(current.state?.revision!==revision){
      connectionIssue='changed';applyNeedsReview=true;conflicted=true;
      status(t('connection.changed'),true,{kind:'connection'});
    }else{
      applyNeedsReview=false;connectionIssue='';status(t('connection.restored'),false,{clearError:'connection'});
    }
  }catch(error){status(error.message,true);}
  finally{connectionRetrying=false;renderConnectionNotice();}
}
function installConnectionRecovery(){
  // Card interactions stay local: text selection, scrolling and Retry must not
  // reach canvas gestures or graph shortcuts. Native controls remain usable.
  const notice=$('#connectionnotice');
  for(const event of ['pointerdown','mousedown','touchstart','dblclick','contextmenu','keydown','dragover','drop'])notice.addEventListener(event,e=>e.stopPropagation());
  notice.addEventListener('wheel',e=>e.stopPropagation(),{passive:true});
  $('#connectionretry').onclick=retryConnection;
  setInterval(()=>{
    if(!document.hidden&&(connectionInterrupted||applyNeedsReview)&&!['auth','forbidden','changed'].includes(connectionIssue)&&Date.now()>=connectionRetryAt)retryConnection();
  },1000);
  window.addEventListener('online',()=>{if(connectionInterrupted)retryConnection();});
}
let compileIssues=[],compileIssueText='',compileIssueVersion=-1,compileDetailsOpen=false,compileIssuePhase='validation';
function clearCompileDiagnostics(){compileIssues=[];compileIssueText='';compileIssueVersion=-1;compileDetailsOpen=false;errorNode=null;renderCompileDiagnostics();}
function diagnosticGraphMatches(){return !!graph&&compileIssueVersion===editVersion;}
function diagnosticLocation(issue){
  if(!diagnosticGraphMatches()||!issue.node||!graph.stages[issue.stage])return null;
  const trail=Array.isArray(issue.trail)?issue.trail:issue.functionId?[issue.functionId]:[];
  if(trail.some(id=>!FunctionModel.find(graph,id))||(trail.at(-1)||null)!==(issue.functionId||null))return null;
  const data=trail.length?FunctionModel.find(graph,trail.at(-1)).graph:graph.stages[issue.stage];
  const node=data.nodes.find(n=>n.id===issue.node);return node?{trail,data,node}:null;
}
function setCompileDiagnostics(result,snapshot){
  if(!graph||snapshot!==JSON.stringify(graph))return;
  compileIssueText=typeof result.error==='string'?result.error:'';compileIssueVersion=editVersion;compileDetailsOpen=false;
  compileIssuePhase=['source','shader'].includes(result.phase)?result.phase:'validation';
  compileIssues=Array.isArray(result.diagnostics)&&result.diagnostics.length?result.diagnostics:[{node:result.node,functionId:result.functionId,stage:result.stage,trail:result.trail,message:result.error}];
  errorNode=compileIssues.find(issue=>issue.node)?.node||null;render();
}
function nodeHasCompileError(id){
  return diagnosticGraphMatches()&&compileIssues.some(issue=>issue.node===id&&issue.stage===stage&&(issue.functionId||null)===(currentFunction()?.id||null));
}
function locateCompileIssue(issue){
  const location=diagnosticLocation(issue);if(!location)return;
  stopCanvasMotion();
  stage=issue.stage;graphTrail=[...location.trail];selected=location.node.id;selection=new Set([selected]);selectedEdge=null;
  cancelConnection();closeCreator();document.querySelectorAll('.stage').forEach(button=>button.classList.toggle('active',button.dataset.stage===stage));
  $('#stagecaption').textContent=stage.toUpperCase()+' STAGE';render();
  const rect=$('#canvas').getBoundingClientRect(),bounds=nodeLayoutBounds(location.node);scale=Math.max(.7,Math.min(1,scale));pan={x:rect.width/uiScaleFactor()/2-(bounds.x+bounds.width/2)*scale,y:rect.height/uiScaleFactor()/2-(bounds.y+bounds.height/2)*scale};transform();
  if(location.node.definitionUuid==='sgrape.builtin.glsl_code'&&Number.isInteger(issue.codeLine)&&issue.codeLine>0){
    inspectorTab='parameters';inspector();workspaceLayout.reveal('parameters');
    const body=$('[data-code-body]');if(body){const lines=body.value.split('\n'),index=Math.min(issue.codeLine-1,lines.length-1),start=lines.slice(0,index).reduce((n,line)=>n+line.length+1,0);body.focus();body.setSelectionRange(start,start+lines[index].length);body.scrollTop=index*parseFloat(getComputedStyle(body).lineHeight);}
  }
}
function renderCompileDiagnostics(){
  const bar=$('#diagnosticbar');if(!bar)return;
  const scroll=bar.querySelector?.('pre')?.scrollTop||0;bar.replaceChildren();bar.hidden=!compileIssues.length||!diagnosticGraphMatches();if(bar.hidden)return;
  const row=el('div',{class:'diagnostic-summary',role:'status'});row.append(el('strong',{},t(compileIssuePhase==='source'?'diagnostic.sourceFailed':compileIssuePhase==='shader'?'diagnostic.shaderFailed':'diagnostic.failed')));bar.append(row);
  const shown=new Set();
  for(const issue of compileIssues){
    const location=diagnosticLocation(issue);if(!location)continue;
    const key=[issue.stage,issue.functionId,issue.node].join(':');if(shown.has(key))continue;shown.add(key);
    const label=location.node.definitionUuid===FunctionModel.CALL?FunctionModel.find(graph,location.node.params.functionId)?.name:catalog.find(d=>d.definitionUuid===location.node.definitionUuid)?.label;
    const path=[issue.stage==='vertex'?'Vertex':'Pixel',...location.trail.map(id=>FunctionModel.find(graph,id).name),label||issue.node].join(' / ');
    const button=el('button',{'data-diagnostic-node':issue.node},t('diagnostic.locate')+' · '+path);button.title=path+'\n'+issue.message;button.onclick=()=>locateCompileIssue(issue);row.append(button);
  }
  if(!shown.size)row.append(el('span',{},t('diagnostic.general')));
  const details=el('details',{class:'compile-details'}),summary=el('summary',{},t('diagnostic.details'));
  const text=compileIssueText||compileIssues.map(issue=>issue.message||'').filter(Boolean).join('\n');
  const pre=el('pre',{tabindex:'0','aria-label':t('diagnostic.details')},text||t('connection.failed'));
  details.append(summary,pre);details.open=compileDetailsOpen;
  details.ontoggle=()=>{if(details.isConnected)compileDetailsOpen=details.open;};
  bar.append(details);pre.scrollTop=scroll;
}

let editVersion=0,submitBusy=false,applyLayoutOnly=false,autoTimer=null,conflicted=false;
let savedGraphContent=null,lastGraphSaveKey='graph.saved';
function graphContent(document){
  const content=clone(document);delete content.catalogSnapshot;
  // Coordinates and component expansion are presentation-only. Labels and type settings may
  // affect generated GLSL, so keep them when distinguishing layout saves.
  for(const data of [...Object.values(content.stages),...(content.functions||[]).map(f=>f.graph)]){
    delete data.ui;
    data.nodes=data.nodes.filter(node=>!['sgrape.builtin.comment','sgrape.builtin.generated_glsl'].includes(node.definitionUuid));
    for(const node of data.nodes)if(node.ui){delete node.ui.x;delete node.ui.y;delete node.ui.width;delete node.ui.height;delete node.ui.componentsExpanded;delete node.ui.collapsed;if(!Object.keys(node.ui).length)delete node.ui;}
  }
  return JSON.stringify(content);
}
function hasShaderChanges(document=graph){return !document||graphContent(document)!==savedGraphContent;}
function graphPendingKey(){return hasShaderChanges()?'graph.pending':'graph.savePending';}
function rememberSavedGraph(document,key='graph.saved'){savedGraphContent=graphContent(document);lastGraphSaveKey=key;}
function renderGraphSaveState(){
  const badge=$('#dirty');
  badge.textContent=t(savedStateIssue?'saved.locked':dirty?(readonly?'graph.readonly':graphPendingKey()):lastGraphSaveKey);
  badge.title=t('graph.revision')+revision;
  badge.classList.toggle('pending',dirty);renderStatusVisibility();
}
// History follows user commits, independently of Apply's compilation debounce.
let editorLoadGeneration=0,historyNativeToken=null,historyBusy=false,nativeMutationBusy=false,nativeValueBusy=false,applyInFlight=null,historyEpoch=0;
function historyValueKey(value){
  const ordered=v=>Array.isArray(v)?v.map(ordered):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,ordered(v[k])])):v;
  return JSON.stringify(ordered(value));
}
function historyGraphKey(document){const value=clone(document);delete value.catalogSnapshot;return historyValueKey(value);}
function historySourceIds(before,after){
  const sources=document=>new Map((document.declarations||[]).filter(d=>['uniform','spec_constant','pop_buffer','attribute'].includes(d.kind)).map(d=>[d.id,d]));
  const a=sources(before),b=sources(after);
  return [...new Set([...a.keys(),...b.keys()])].filter(id=>historyValueKey(a.get(id))!==historyValueKey(b.get(id)));
}
function editorMutationBlocked(ignoreValueWrite=false){return readonly||historyBusy||(nativeMutationBusy&&!(ignoreValueWrite&&nativeValueBusy));}
// A brief value-write lock still blocks clicks/keyboard focus, without changing
// unrelated controls to their permanently unavailable appearance.
function setEditorDisabled(control,blocked,idleBlocked=blocked){control.disabled=!!idleBlocked;control.inert=!!blocked&&!idleBlocked;}
function renderHistoryActions(){
  const busy=editorMutationBlocked(),idleBusy=editorMutationBlocked(true);
  setEditorDisabled($('#undo'),busy||!past.length,idleBusy||!past.length);setEditorDisabled($('#redo'),busy||!future.length,idleBusy||!future.length);
  setEditorDisabled($('#reload'),submitBusy||historyBusy||nativeMutationBusy,submitBusy||historyBusy||(nativeMutationBusy&&!nativeValueBusy));
  setEditorDisabled($('#apply'),readonly||submitBusy||historyBusy||nativeMutationBusy,readonly||submitBusy||historyBusy||(nativeMutationBusy&&!nativeValueBusy));
  $('#inspector').inert=historyBusy||nativeMutationBusy;$('#inspector').setAttribute('aria-busy',String(nativeValueBusy));
  for(const input of document.querySelectorAll('#cards .node-inline-values input'))setEditorDisabled(input,busy,idleBusy);
  if(typeof renderSelectionToolbar==='function')renderSelectionToolbar();
}
function recordHistory(entry){
  if(!entry.liveReceipt&&historyGraphKey(entry.before)===historyGraphKey(entry.after)&&(!entry.nativeApplied||entry.nativeBefore===entry.nativeAfter))return null;
  const step={id:crypto.randomUUID(),epoch:historyEpoch,...entry};
  if(step.nativeApplied){step.deltaBefore=step.nativeBefore;step.deltaAfter=step.nativeAfter;}
  past.push(step);if(past.length>60)past.shift();future=[];renderHistoryActions();return step;
}
function recordGraphHistory(before,{nativeBefore=historyNativeToken,nativeAfter=null,nativeApplied=false}={}){
  if(historyGraphKey(before)===historyGraphKey(graph))return null;
  return recordHistory({kind:'graph',before:clone(before),after:clone(graph),sourceIds:historySourceIds(before,graph),nativeBefore,nativeAfter,nativeApplied});
}
function scheduleGraphApply(delay=650){
  clearTimeout(autoTimer);autoTimer=null;
  if(dirty&&!readonly&&!submitBusy&&!historyBusy&&!nativeMutationBusy&&!conflicted&&!connectionInterrupted&&!applyNeedsReview)autoTimer=setTimeout(applyGraph,delay);
}
function adoptHistoryGraph(document){
  const snapshot=graph?.catalogSnapshot;graph=clone(document);if(snapshot)graph.catalogSnapshot=clone(snapshot);
  if(selectedInputId&&!allInputSources().some(d=>d.id===selectedInputId))selectedInputId=null;
  tidyTrail();
}
function sealGraphHistory(entries,beforeToken,afterToken){
  if(afterToken)historyNativeToken=afterToken;
  for(const entry of entries){
    if(entry.nativeApplied)continue;
    entry.nativeBefore=beforeToken||entry.nativeBefore;entry.nativeAfter=afterToken;entry.nativeApplied=true;
    entry.deltaBefore=entry.nativeBefore;entry.deltaAfter=entry.nativeAfter;
  }
}
function mark(){
  if(typeof refreshGeneratedGLSL==='function')queueMicrotask(()=>refreshGeneratedGLSL());
  clearCompileDiagnostics();
  dirty=true;editVersion++;renderGraphSaveState();$('#apply').disabled=readonly||submitBusy;
  try{sessionStorage.setItem(draftKey,JSON.stringify({graph,revision}));}catch{}
  scheduleGraphApply();
}
// Only these node fields can bypass semantic editing. Keep labels, comments,
// typeMode, interfaces, sources and unknown fields in the comparison.
function layoutContent(document){
  const fields=new Set(['x','y','width','height','collapsed','componentsExpanded','matrixColumnsExpanded']);
  const scope=data=>({...data,edges:data.edges.map(edge=>{const copy={...edge};if(edge.ui){const ui={...edge.ui};delete ui.style;if(Object.keys(ui).length)copy.ui=ui;else delete copy.ui;}return copy;}),nodes:data.nodes.map(node=>{
    const copy={...node};if(node.ui){const ui=Object.fromEntries(Object.entries(node.ui).filter(([key])=>!fields.has(key)));if(Object.keys(ui).length)copy.ui=ui;else delete copy.ui;}return copy;
  })});
  return JSON.stringify({...document,stages:Object.fromEntries(Object.entries(document.stages).map(([key,data])=>[key,scope(data)])),...(document.functions?{functions:document.functions.map(fn=>({...fn,graph:scope(fn.graph)}))}:{})});
}
function change(fn,{localize=true,redraw=true,typeChange=false,layout=false,disconnectInvalid=null}={}){
  if(editorMutationBlocked())return false;
  const previous=clone(graph),view={trail:[...graphTrail],selection:new Set(selection),selected,selectedEdge};
  let layoutOnly=false;
  try{if(localize)prepareSemanticEdit();fn();assertGeneratedGLSLLimit(graph);for(const data of [...Object.values(graph.stages),...(graph.functions||[]).map(f=>f.graph)])GraphFrames.prune(data);if(graph.topSourceVersion===1)graph.topInputs.forEach((s,i)=>s.name='sTD2DInputs['+i+']');layoutOnly=layout&&!localize&&!typeChange&&layoutContent(previous)===layoutContent(graph);if(!layoutOnly){FunctionModel.ensureCapacity(graph);resolveAutoEdit(graph,previous,{allowInvalid:typeChange,disconnectInvalid:typeChange&&(disconnectInvalid??EDITOR_DEV_SETTINGS.autoDisconnectInvalidEdges)});if(!typeChange)rejectNewConstantIssues(graph,previous);}}
  catch(e){
    graph=previous;graphTrail=view.trail;selection=view.selection;selected=view.selected;selectedEdge=view.selectedEdge;
    render();status(t('edit.failed')+(e.code==='function.limit'?t('function.limit'):e.message),true);return false;
  }
  if(!recordGraphHistory(previous)){if(redraw)render({layoutOnly});return true;}
  mark();if(redraw)render({layoutOnly});return true;
}
async function undo(redo=false){
  if(editorMutationBlocked())return false;
  const from=redo?future:past,to=redo?past:future;if(!from.length)return false;
  const generation=editorLoadGeneration;let replayed=false;historyBusy=true;++nativeSourceReadEpoch;clearTimeout(autoTimer);autoTimer=null;renderHistoryActions();
  try{
    // An in-flight Apply may materialize sources for several pending entries.
    // Wait for its receipts before deciding whether this one step is local.
    if(applyInFlight)await applyInFlight;
    if(generation!==editorLoadGeneration)return false;
    let entry=from.at(-1);
    // A canceled live gesture can finish while Undo waits for its receipt.
    // Discard that empty reservation and replay the real preceding edit.
    while(entry?.liveReceipt&&!(await entry.liveReceipt)){
      if(generation!==editorLoadGeneration)return false;
      from.pop();if(!redo&&!future.length&&entry.liveEmptyFuture)future.push(...entry.liveEmptyFuture);
      entry=from.at(-1);
    }
    if(!entry||generation!==editorLoadGeneration)return false;
    const expected=redo?entry.before:entry.after,desired=redo?entry.after:entry.before;
    if(entry.epoch!==historyEpoch||historyGraphKey(graph)!==historyGraphKey(expected))throw Error(t('history.changed'));
    const previousGraph=historyGraphKey(graph);let needsApply=false;
    if(entry.liveReceipt){
      const receipt=await entry.liveReceipt;
      if(receipt){
        if(!entry.liveRequest||entry.liveRequest.undo!==!redo)entry.liveRequest={requestId:crypto.randomUUID(),undo:!redo};
        await api('live-restore',{receipt,...entry.liveRequest});entry.liveRequest=null;
      }
    }else if(entry.nativeApplied&&(entry.sourceIds.length||entry.valueIds?.length)){
      const fromToken=redo?entry.nativeBefore:entry.nativeAfter,toToken=redo?entry.nativeAfter:entry.nativeBefore;
      if(!fromToken||!toToken)throw Error(t('history.unavailable'));
      // Receipts rebase CAS expectations, but may include unrelated external
      // edits. Keep the operation's original field delta immutable for replay.
      const deltaFromToken=redo?entry.deltaBefore:entry.deltaAfter,deltaToToken=redo?entry.deltaAfter:entry.deltaBefore;
      const result=await api('history-restore',{requestId:crypto.randomUUID(),revision,fromToken,toToken,deltaFromToken,deltaToToken,sourceIds:entry.sourceIds,valueIds:entry.valueIds||[],graph:clone(desired),currentGraph:clone(graph)});
      if(generation!==editorLoadGeneration)return false;
      nativeSourceError='';installNativeSourceSnapshot(result);revision=result.revision;
      const restored=result.workingGraph||result.graph||desired;adoptHistoryGraph(restored);
      needsApply=!!(result.sourceChanged||result.workingGraph);
      historyNativeToken=result.history?.token||toToken;
      if(redo)entry.nativeAfter=historyNativeToken;else entry.nativeBefore=historyNativeToken;
    }else adoptHistoryGraph(desired);
    from.pop();to.push(entry);
    // Carry the expected current checkpoint through intervening graph-only steps.
    // The opposite end remains the historic destination of that next replay.
    const neighbor=from.at(-1);if(neighbor?.nativeApplied&&historyNativeToken){if(redo)neighbor.nativeBefore=historyNativeToken;else neighbor.nativeAfter=historyNativeToken;}
    if(needsApply||previousGraph!==historyGraphKey(graph))mark();render();replayed=true;status(t(dirty?graphPendingKey():lastGraphSaveKey),false,{clearError:'operation'});return true;
  }catch(error){if(generation===editorLoadGeneration)status(t('history.failed')+error.message,true);return false;}
  finally{if(generation===editorLoadGeneration){++nativeSourceReadEpoch;historyBusy=false;renderHistoryActions();renderNativeSourceValues();if(replayed){await refreshUniforms();if(generation===editorLoadGeneration){refreshNativeSources({required:true});scheduleGraphApply();}}}}
}
function applyGraph(){
  if(applyInFlight)return applyInFlight;
  if(historyBusy||nativeMutationBusy)return Promise.resolve();
  const operation=performApplyGraph();applyInFlight=operation;
  operation.finally(()=>{if(applyInFlight===operation)applyInFlight=null;});return operation;
}
async function performApplyGraph(){
  clearTimeout(autoTimer);autoTimer=null;if(readonly||submitBusy||!dirty)return;
  const generation=editorLoadGeneration,sentVersion=editVersion,sentGraph=clone(graph),sentRevision=revision,layoutOnly=!hasShaderChanges(sentGraph);
  const sentEntries=past.filter(entry=>entry.kind==='graph'&&!entry.nativeApplied),beforeToken=historyNativeToken;
  submitBusy=true;applyLayoutOnly=layoutOnly;$('#apply').disabled=true;$('#reload').disabled=true;status(t(layoutOnly?'graph.saving':'material.compiling'));
  try{
    const data=await api('apply',{graph:sentGraph,revision});
    if(generation!==editorLoadGeneration)return;
    if(data.upgradeReview){
      const review=data.upgradeReview;
      if(review.required===false&&review.blocked&&!(review.changes||[]).length){
        // Current-version graph errors are editable drafts, not version upgrades.
        upgradePending=null;conflicted=false;renderUpgradeNotice();
        const diagnostics=(review.issues||[]).map(issue=>{const owner=issue.node&&!issue.functionId&&Object.entries(sentGraph.stages).find(([,data])=>data.nodes.some(n=>n.id===issue.node));return {...issue,stage:issue.stage||owner?.[0]};});
        const missing=[];
        for(const unit of autoUnits(sentGraph))for(const edge of unit.data.edges)for(const [side,direction]of [['from','outputs'],['to','inputs']]){
          const node=unit.data.nodes.find(n=>n.id===edge[side][0]);if(!node||Object.hasOwn(safeConcretePorts(sentGraph,node,unit.owner)[direction],edge[side][1]))continue;
          missing.push({node:node.id,stage:unit.owner?stage:unit.key.slice(6),functionId:unit.owner?.id||null,trail:unit.owner?[unit.owner.id]:[],message:t('type.missingPort').replace('{port}',(node.name||autoDefinition(sentGraph,node,unit.owner)?.label||node.id)+'.'+edge[side][1])});
        }
        if(missing.length){for(let i=diagnostics.length-1;i>=0;i--)if(diagnostics[i].code==='repair')diagnostics.splice(i,1);diagnostics.unshift(...missing);}
        const error=diagnostics.map(issue=>issue.message).filter(Boolean).join('\n')||t('material.failed');
        setCompileDiagnostics({error,diagnostics},JSON.stringify(sentGraph));throw Error(error);
      }
      upgradePending=review;conflicted=true;renderUpgradeNotice();status(t('upgrade.explanation'));return;
    }
    sealGraphHistory(sentEntries,data.history?.beforeToken||beforeToken,data.history?.token||null);
    if(data.state.graph.catalogSnapshot)graph.catalogSnapshot=clone(data.state.graph.catalogSnapshot);
    revision=data.state.revision;conflicted=false;clearCompileDiagnostics();
    const shaderUpdated=data.shaderUpdated??(data.compileInfo!=='Graph layout saved');
    // A confirmed layout save kept the native source configuration intact.
    // Advance this exact snapshot, not an older poll or a rebuilt Shader's controls.
    if(layoutOnly&&!shaderUpdated&&nativeSourceSnapshot?.revision===sentRevision&&nativeSourceSnapshot.graph&&graphContent(nativeSourceSnapshot.graph)===graphContent(sentGraph)){
      nativeSourceSnapshot={...nativeSourceSnapshot,revision,graph:clone(data.state.graph),declarations:clone(data.state.graph.declarations),sourceChanged:false};
    }
    rememberSavedGraph(sentGraph,shaderUpdated?'graph.applied':'graph.saved');
    if(editVersion===sentVersion){dirty=false;sessionStorage.removeItem(draftKey);}
    else {try{sessionStorage.setItem(draftKey,JSON.stringify({graph,revision}));}catch{}}
    renderGraphSaveState();setEditorTargetPath(data.target);await preview().catch(()=>{});
    if(generation!==editorLoadGeneration)return;
    if(!connectionInterrupted)status(t(dirty?graphPendingKey():shaderUpdated?'material.applied':lastGraphSaveKey),false,{clearError:true});
    document.querySelectorAll('.node.error').forEach(e=>e.classList.remove('error'));
    return true;
  }catch(e){if(generation!==editorLoadGeneration)return;nativeSourceUncertain=true;++nativeSourceReadEpoch;conflicted=e.message.includes('Conflict:');if(e.connection){applyNeedsReview=true;renderConnectionNotice();status(e.message,true,{kind:'connection'});}else status(t(layoutOnly?'graph.saveFailed':'material.failed')+e.message,true,{kind:'compile'});}
  finally{if(generation===editorLoadGeneration){submitBusy=false;applyLayoutOnly=false;$('#apply').disabled=readonly;$('#reload').disabled=false;renderHistoryActions();renderNativeSourceValues();refreshUniforms();refreshNativeSources({required:true});if(dirty&&editVersion!==sentVersion)scheduleGraphApply(200);}}
}
function el(tag,attrs={},text=''){const e=document.createElement(tag);for(const[k,v]of Object.entries(attrs)){if(k==='class')e.className=v;else e.setAttribute(k,v);}e.textContent=text;return e;}
function field(label,control){const f=el('label',{class:'field'},label);f.append(control);return f;}
function select(options,value,onchange){const s=el('select');for(const [id,label]of options){const o=el('option',{value:id},label);s.append(o);}s.value=value;s.onchange=()=>onchange(s.value);return s;}
function input(value,cb,type='text',{local=false}={}){
  const i=el('input',{type});i.value=value;let committed=i.value;
  const commit=()=>{if((!local&&editorMutationBlocked())||i.numericGestureActive||i.value===committed)return;const next=type==='number'?Number(i.value):i.value;if(type==='number'&&(!i.value.trim()||!Number.isFinite(next)||i.validateValue&&!i.validateValue(next))){i.setAttribute('aria-invalid','true');return;}i.removeAttribute('aria-invalid');committed=i.value;cb(next);};
  i.onchange=commit;i.onblur=commit;
  i.hasPendingEdit=()=>i.value!==committed;
  i.setSyncedValue=value=>{if(i.numericGestureActive)return;i.value=value??'';committed=i.value;};
  i.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();commit();}};
  if(type==='number'){i.step='0.05';installValueLadder(i,commit,{local});}return i;
}
function current(){return currentFunction()?.graph||graph.stages[stage];}
function ports(n,kind){if(nodeRenderProjections.has(n))return nodeRenderProjections.get(n).ports[kind];if(!definition(n))return{};return safeConcretePorts(graph,n,currentFunction())[kind];}
function graphPoint(clientX,clientY){
  // The 1px HTML world shares the sockets' coordinate system, including ancestor
  // scaling. Older WebKit SVG getScreenCTM() can omit that CSS transform.
  const rect=$('#world').getBoundingClientRect();
  if(!rect.width||!rect.height)return null;
  return {x:(clientX-rect.left)/rect.width,y:(clientY-rect.top)/rect.height};
}
function point(n,port,kind){
  const socket=$('#cards').querySelector(`[data-node="${CSS.escape(n.id)}"] [data-kind="${kind}"][data-port="${CSS.escape(port)}"]`);
  if(!socket)return null;
  const rect=socket.getBoundingClientRect();
  return graphPoint(rect.left+rect.width/2,rect.top+rect.height/2);
}
// pan/scale always describe the displayed view, including during interpolation.
// The optional target exists only while damping is enabled and actually moving.
let canvasMotion=null,canvasMotionFrame=0,canvasMotionEvents=null;
function stopCanvasMotion(finish=false){
  if(!canvasMotion)return;
  const target=canvasMotion.to;
  cancelAnimationFrame(canvasMotionFrame);canvasMotionFrame=0;canvasMotion=null;
  if(finish){pan={x:target.x,y:target.y};scale=target.scale;transform();}
}
function stepCanvasMotion(now){
  canvasMotionFrame=0;const motion=canvasMotion;if(!motion)return;
  // Retargeting preserves the last displayed frame's time. Pointer events may
  // arrive after this RAF's timestamp; restarting the clock there starves motion.
  const progress=Math.min(1,Math.max(0,(now-motion.lastTime)/(motion.end-motion.lastTime))),amount=1-Math.pow(1-progress,3);
  const {to}=motion;
  pan={x:pan.x+(to.x-pan.x)*amount,y:pan.y+(to.y-pan.y)*amount};scale+=(to.scale-scale)*amount;
  motion.lastTime=Math.max(motion.lastTime,now);
  if(progress===1){pan={x:to.x,y:to.y};scale=to.scale;canvasMotion=null;}
  transform();
  if(canvasMotion)canvasMotionFrame=requestAnimationFrame(stepCanvasMotion);
}
function moveCanvas(nextPan,nextScale=scale,setting='canvasDamping',forceAnimation=false){
  // Disabled takes the original immediate path: no target, timer or frame callback.
  if(!setting||(!forceAnimation&&!EDITOR_DEV_SETTINGS[setting])){stopCanvasMotion();pan=nextPan;scale=nextScale;transform();return;}
  if(forceAnimation&&!canvasMotionEvents)applyCanvasDamping(true);
  if(canvasMotion&&canvasMotion.setting!==setting)stopCanvasMotion();
  const to={...nextPan,scale:nextScale},target=canvasMotion?.to||{...pan,scale};
  if(to.x===target.x&&to.y===target.y&&to.scale===target.scale)return;
  const now=performance.now(),duration=EDITOR_DEV_SETTINGS[setting+'Ms']??333;
  if(canvasMotion){canvasMotion.to=to;canvasMotion.end=now+duration;}
  else canvasMotion={to,lastTime:now,end:now+duration,duration,setting};
  if(!canvasMotionFrame)canvasMotionFrame=requestAnimationFrame(stepCanvasMotion);
}
function applyCanvasDamping(force=false){
  stopCanvasMotion(true);canvasMotionEvents?.abort();canvasMotionEvents=null;
  if(!force&&!EDITOR_DEV_SETTINGS.canvasDamping&&!EDITOR_DEV_SETTINGS.frameDamping&&!['frame','centerAnimated'].includes(EDITOR_DEV_SETTINGS.arrowNavigationView))return;
  canvasMotionEvents=new AbortController();const options={capture:true,signal:canvasMotionEvents.signal};
  // Freeze where the user actually clicked before a node, wire or new gesture takes over.
  document.addEventListener('pointerdown',event=>{if(event.target.closest?.('#canvas')&&!event.target.closest('.toolbar,.canvas-view-tools,.selection-toolbar,#connectionnotice'))stopCanvasMotion();},options);
  for(const name of ['blur','resize'])window.addEventListener(name,()=>stopCanvasMotion(true),options);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopCanvasMotion(true);},options);
  document.addEventListener('keydown',event=>{if(event.key==='Escape')stopCanvasMotion();},options);
}
function transform(){
  // Hide intermediate grid lines at distant zoom; snapping stays in world units.
  let displayGrid=GRID;
  while(displayGrid*scale<14)displayGrid*=2;
  const step=displayGrid*scale,dot=Math.max(.45,Math.min(1.65,1.05*Math.pow(scale,.65)));
  $('#canvas').style.setProperty('--grid-dot',dot+'px');
  $('#canvas').style.setProperty('--wire-ring',3/scale+'px');
  $('#canvas').style.setProperty('--wire-glow',7/scale+'px');
  $('#wires').style.setProperty('--wire-hit-width',Math.max(6,6/(scale*uiScaleFactor()))+'px');
  $('#canvas').dataset.gridStep=displayGrid;
  $('#canvas').style.backgroundSize=step+'px '+step+'px';$('#canvas').style.backgroundPosition=(pan.x-step/2)+'px '+(pan.y-step/2)+'px';$('#world').style.transform=`translate(${pan.x}px,${pan.y}px) scale(${scale})`;renderGraphZoom();wireGesture?.refresh?.();scheduleSelectionToolbarPosition();}
function wirePathFromTarget(target){
  const path=target.closest('#wires path,#wires polygon.link-direction');
  return path?.wirePaintPath?(path.wirePaintPath?.isConnected?path.wirePaintPath:null):path?.dataset.from?path:null;
}
function wires(){
  const svg=$('#wires'),hits=document.createDocumentFragment(),paint=document.createDocumentFragment();svg.replaceChildren();
  current().edges.forEach((edge,index)=>{
    const link=edge.ui?.style==='link';if(link&&!showLinkLines)return;
    const a=current().nodes.find(n=>n.id===edge.from[0]),b=current().nodes.find(n=>n.id===edge.to[0]);if(!a||!b)return;
    const p=point(a,edge.from[1],'outputs'),q=point(b,edge.to[1],'inputs');if(!p||!q)return;
    const dx=Math.max(70,Math.abs(q.x-p.x)*.5),ns='http://www.w3.org/2000/svg';
    const hit=document.createElementNS(ns,'path'),path=document.createElementNS(ns,'path');
    path.setAttribute('d',link?`M ${p.x} ${p.y} L ${q.x} ${q.y}`:`M ${p.x} ${p.y} C ${p.x+dx} ${p.y}, ${q.x-dx} ${q.y}, ${q.x} ${q.y}`);
    if(link)path.classList.add('wire-link');
    hit.setAttribute('d',path.getAttribute('d'));hit.classList.add('wire-hit');hit.setAttribute('aria-hidden','true');hit.wirePaintPath=path;
    path.dataset.from=edge.from.join(':');path.dataset.to=edge.to.join(':');path.setAttribute('data-type',ports(a,'outputs')[edge.from[1]]||'');applyPortColorHint(path,a,'outputs',edge.from[1]);
    const fromType=ports(a,'outputs')[edge.from[1]],toType=ports(b,'inputs')[edge.to[1]];
    if(!fromType||!toType||!vectorConnectionExact(definition(b),fromType,toType)){path.classList.add('invalid');path.setAttribute('stroke-dasharray','5 4');}
    if(selectedEdge===index)path.classList.add('selected');
    let arrow=null;
    if(link){
      arrow=document.createElementNS(ns,'polygon');arrow.classList.add('link-direction');
      arrow.setAttribute('points','6,0 -4,-4 -4,4');
      arrow.setAttribute('transform',`translate(${(p.x+q.x)/2} ${(p.y+q.y)/2}) rotate(${Math.atan2(q.y-p.y,q.x-p.x)*180/Math.PI})`);
      arrow.wirePaintPath=path;
      const hint=linkConnectionHint([edge]);
      for(const surface of [hit,path,arrow]){const title=document.createElementNS(ns,'title');title.textContent=hint;surface.append(title);surface.setAttribute('aria-label',hint);}
    }
    for(const surface of [hit,path,...(arrow?[arrow]:[])]){
      surface.onpointerenter=()=>path.classList.add('wire-hover');surface.onpointerleave=()=>path.classList.remove('wire-hover');
      surface.onpointerdown=e=>dragExistingWire(path,e,index);
      surface.onclick=e=>{e.stopPropagation();if(suppressWireClick)return;selectedEdge=index;selected=null;selection.clear();render();};
    }
    hits.append(hit);paint.append(path);if(arrow)paint.append(arrow);
  });
  // All visible strokes outrank all transparent hit areas. Preserve edge order
  // within each layer; both remain above Group bodies and below nodes/controls.
  svg.append(hits,paint);
  refreshLinkPortButtons();
  drawWireDrag(svg);paintTrashHighlights();positionGroupFrames();scheduleSelectionToolbarPosition();
}
function library(){renderLibrary();}
function render({layoutOnly=false}={}){renderCompileDiagnostics();
  if(!graph)return;if(!graph.stages?.[stage])stage='pixel';
  document.querySelectorAll('[data-stage]').forEach(b=>{b.hidden=!graph.stages?.[b.dataset.stage];b.classList.toggle('active',b.dataset.stage===stage);});
  $('#stagecaption').textContent=stage.toUpperCase()+' STAGE';
  $('#previewtitle').dataset.i18n=editorTarget==='top'?'preview.top':'preview.material';$('#previewtitle').textContent=t($('#previewtitle').dataset.i18n);renderPreviewAppearance();
  tidyTrail();renderCards();renderGroupFrames();wires();inspector();if(!layoutOnly){library();declarations();renderNativeSources();}transform();renderNavigation();renderSavedStateIssue();refreshGeneratedGLSL();
}
function textureOptions(){return [...(editorTarget==='top'?[['input:0',t('texture.input0')]]:[]),...[['builtin:banana',t('texture.banana')],['builtin:jellybeans',t('texture.jellybeans')],['builtin:white',t('texture.white')],['builtin:black',t('texture.black')],['external',t('texture.custom')]]]; }
function declarations(){const box=$('#declarations');box.replaceChildren();for(const d of graph.declarations){const card=el('div',{class:'decl'});card.append(el('small',{},d.type+' · '+d.id));card.append(field(t('declaration.name'),input(d.name,v=>change(()=>d.name=v))));declarationFields(card,d);box.append(card);}}
function remove(){
  if(selectedEdge===null&&!current().nodes.some(n=>selection.has(n.id)&&canDeleteNode(n)))return;
  change(()=>{if(selectedEdge!==null){current().edges.splice(selectedEdge,1);selectedEdge=null;return;}
    const ids=new Set(current().nodes.filter(n=>selection.has(n.id)&&canDeleteNode(n)).map(n=>n.id));
    current().nodes=current().nodes.filter(n=>!ids.has(n.id));current().edges=current().edges.filter(e=>!ids.has(e.from[0])&&!ids.has(e.to[0]));selection.clear();selected=null;
  });
}
function cancelConnection(){clearWireGesture();linkStart=null;wireDrag=null;$('#connection').hidden=true;if(graph)wires();}
let shaderMenuRequest=0,shaderChoice=null,switchingShader=false,resumeAfterShaderSwitch=false;
function closeShaderMenu(focus=true){
  shaderMenuRequest++;$('#shaderchoices').hidden=true;$('#shaderpicker').setAttribute('aria-expanded','false');if(focus)$('#shaderpicker').focus();
}
function sizeShaderMenu(){
  const menu=$('#shaderchoices'),available=Math.max(0,(innerWidth-$('.shader-selector').getBoundingClientRect().left)/uiScaleFactor()-8);
  menu.style.minWidth=Math.min(260,available)+'px';menu.style.maxWidth=Math.min(600,available)+'px';
}
window.addEventListener('resize',()=>{if(!$('#shaderchoices').hidden)sizeShaderMenu();});
async function openShaderMenu(last=false){
  const request=++shaderMenuRequest,menu=$('#shaderchoices');menu.hidden=false;$('#shaderpicker').setAttribute('aria-expanded','true');menu.replaceChildren(el('p',{class:'muted'},t('switch.loading')));sizeShaderMenu();
  try{
    const data=await api('shaders');if(request!==shaderMenuRequest)return;receiveProjectSummary(data);
    const rows=(data.shaders||[]).filter(row=>/^[a-f0-9]{32}$/.test(row.id)&&typeof row.path==='string'&&['mat','top'].includes(row.kind));
    menu.replaceChildren();
    for(const row of rows){
      const button=el('button',{role:'menuitemradio','aria-checked':String(row.id===shaderId),'data-shader':row.id});
      button.append(el('span',{class:'shader-kind','data-kind':row.kind},row.kind.toUpperCase()),el('span',{class:'shader-choice-path'},row.path));
      button.disabled=!!row.readOnlyReason;if(row.readOnlyReason)button.title=row.readOnlyReason;
      button.onclick=()=>chooseShader(row);menu.append(button);
    }
    if(!rows.length)menu.append(el('p',{class:'muted'},t('switch.empty')));
    const buttons=[...menu.querySelectorAll('button:not(:disabled)')];(last?buttons.at(-1):buttons.find(b=>b.getAttribute('aria-checked')==='true')||buttons[0])?.focus();
  }catch(e){if(request===shaderMenuRequest)menu.replaceChildren(el('p',{class:'error'},e.message));}
}
function closeShaderSwitch(resume=true){
  shaderChoice=null;$('#shaderswitch').close();
  if(resume&&resumeAfterShaderSwitch&&dirty&&!submitBusy&&!conflicted)autoTimer=setTimeout(applyGraph,650);
  resumeAfterShaderSwitch=false;$('#shaderpicker').focus();
}
function leaveForShader(row){
  if(!/^[a-f0-9]{32}$/.test(row.id))return;
  clearTimeout(autoTimer);autoTimer=null;switchingShader=true;
  // Same-origin navigation reuses this tab's session token, including a private gateway.
  location.assign('/shader/'+row.id+'/');
}
function chooseShader(row){
  if(row.id===shaderId){closeShaderMenu();return;}
  if(submitBusy||uniformPending.size||nativeSourceBusy||historyBusy||nativeMutationBusy){status(t('switch.busy'));return;}
  closeShaderMenu();
  if(!dirty){leaveForShader(row);return;}
  resumeAfterShaderSwitch=autoTimer!==null;clearTimeout(autoTimer);autoTimer=null;
  shaderChoice=row;$('#switchdestination').textContent=row.path;$('#switchstatus').textContent='';
  $('#switchapply').disabled=readonly;$('#switchkeep').disabled=false;$('#shaderswitch').showModal();
}
function installShaderNavigation(){
  $('#shaderpicker').onclick=()=>$('#shaderchoices').hidden?openShaderMenu():closeShaderMenu();
  $('#shaderpicker').onkeydown=e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();openShaderMenu(e.key==='ArrowUp');}if(e.key==='Escape')closeShaderMenu();};
  $('#shaderchoices').onkeydown=e=>{
    if(e.key==='Escape'||e.key==='Tab'){if(e.key==='Escape')e.preventDefault();closeShaderMenu();return;}
    if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){
      e.preventDefault();const buttons=[...$('#shaderchoices').querySelectorAll('button:not(:disabled)')],index=buttons.indexOf(document.activeElement);
      const next=e.key==='Home'?0:e.key==='End'?buttons.length-1:(index+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;buttons[next]?.focus();
    }
  };
  document.addEventListener('pointerdown',e=>{if(!e.target.closest('.shader-selector')&&!$('#shaderchoices').hidden)closeShaderMenu(false);});
  $('#switchcancel').onclick=()=>closeShaderSwitch();
  $('#shaderswitch').addEventListener('cancel',e=>{e.preventDefault();closeShaderSwitch();});
  $('#switchkeep').onclick=()=>{
    if(!shaderChoice||submitBusy||uniformPending.size||nativeSourceBusy||historyBusy||nativeMutationBusy)return;
    try{
      const draft=JSON.stringify({graph,revision});sessionStorage.setItem(draftKey,draft);
      if(sessionStorage.getItem(draftKey)!==draft)throw Error('Draft not retained');
      const row=shaderChoice;closeShaderSwitch(false);leaveForShader(row);
    }catch{$('#switchstatus').textContent=t('switch.storageFailed');}
  };
  $('#switchapply').onclick=async()=>{
    const row=shaderChoice;if(!row||submitBusy||uniformPending.size||nativeSourceBusy||historyBusy||nativeMutationBusy)return;
    $('#switchapply').disabled=$('#switchkeep').disabled=true;$('#switchstatus').textContent=t('material.compiling');conflicted=false;
    await applyGraph();if(shaderChoice!==row)return;
    $('#switchapply').disabled=readonly;$('#switchkeep').disabled=false;
    if(dirty){$('#switchstatus').textContent=$('#status').textContent;return;}
    closeShaderSwitch(false);leaveForShader(row);
  };
  window.addEventListener('pageshow',()=>{switchingShader=false;});
}
let lastPreviewAt=0,autoPreview=true,previewAttempted=false,previewPending=0,previewFormat='',previewSource='';
try{autoPreview=localStorage.getItem('sgrapeAutoPreview')!=='false';}catch{}
function renderPreviewAppearance(){
  renderNativeViewer();
  $('#refreshpreview').title=t('preview.connect');
  $('#refreshpreview').setAttribute('aria-label',t('preview.connect'));
  $('#previewsize').textContent=previewFormat;
  renderPreviewSource(previewSource);
  showPreviewBusy();
}
function renderPreviewSource(source){
  previewSource=source||'';
  const parts=previewSource.split('/').filter(Boolean),tail=parts.splice(-2);
  $('#previewpathprefix').textContent=parts.length?'/'+parts.join('/'):'';
  $('#previewpathtail').textContent=tail.length?'/'+tail.join('/'):'';
  $('#previewpath').disabled=!previewSource;
  $('#previewpath').title=previewSource;
  $('#previewpath').setAttribute('aria-label',t('preview.source')+(previewSource?' · '+previewSource:''));
  $('#previewpathdetail').textContent=previewSource;
}
$('#previewpathdetail').addEventListener('beforetoggle',event=>{
  if(event.newState!=='open')return;
  const rect=$('#previewpath').getBoundingClientRect(),zoom=uiScaleFactor(),vw=innerWidth/zoom,vh=innerHeight/zoom,width=Math.min(360,vw-24),top=Math.min(rect.bottom/zoom+4,vh-100);
  Object.assign(event.target.style,{left:Math.max(12,Math.min(rect.left/zoom,vw-width-12))+'px',top:Math.max(12,top)+'px',width:width+'px',maxHeight:Math.min(240,vh-top-12)+'px'});
});
if(typeof window!=='undefined')window.addEventListener('resize',()=>{const detail=$('#previewpathdetail');if(detail.matches(':popover-open'))detail.hidePopover();});
const localViewerEntry=['127.0.0.1','localhost','[::1]'].includes(location.hostname);
let nativeViewerOpening=false;
function renderNativeViewer(){const button=$('#nativeviewer');button.hidden=true;button.disabled=!graph||nativeViewerOpening;button.title=t('viewer.description');}
$('#nativeviewer').onclick=async()=>{
  if(!localViewerEntry||!graph||nativeViewerOpening)return;
  nativeViewerOpening=true;renderNativeViewer();
  try{await api('native-viewer',{editorOrigin:location.origin});status(t('viewer.opened'));}
  catch(error){status(error.message,true);}
  finally{nativeViewerOpening=false;renderNativeViewer();}
};
function showPreviewBusy(){
  const panel=$('#preview');if(!panel||!$('#livebody'))return;
  const state=panel.state||'disconnected',busy=previewPending>0||state==='connecting';
  $('#livebody').setAttribute('aria-busy',String(busy));
  $('#refreshpreview').classList.toggle('is-loading',busy);$('#refreshpreview').disabled=busy;
  $('#autopreview').setAttribute('aria-pressed',String(autoPreview));
  $('#autopreview').title=t(autoPreview?'preview.stop':'preview.start');
  $('#autopreview').disabled=!graph;
  const key=busy?'connecting':state==='connected'?'connected':state==='replaced'?'replaced':state==='error'?'error':'disconnected';
  $('#previewactivity').textContent=t('preview.'+key);
  const dot=$('#pane-live .live-dot');if(dot){dot.classList.toggle('is-connected',state==='connected');dot.title=t('preview.'+key);}
}
$('#preview').addEventListener('panel-state',event=>{
  const {state,message}=event.detail;if(!$('#previewactivity'))return;
  $('#previewactivity').title=message||'';
  $('#previewpath').classList.toggle('inactive',state!=='connected');
  showPreviewBusy();
});
$('#preview').addEventListener('panel-source',event=>{
  const {source}=event.detail;
  renderPreviewSource(source);
});
$('#preview').addEventListener('panel-format',event=>{
  previewFormat=event.detail.width+' × '+event.detail.height;
  $('#previewsize').textContent=previewFormat;
});
async function preview(force=false){
  if((!autoPreview&&!force)||!graph||document.hidden||!$('#preview').getClientRects().length)return;
  lastPreviewAt=performance.now();
  // Graph edits and uniform polling never reclaim a peer that another tab took over.
  if(previewPending||previewAttempted&&!force)return;
  previewAttempted=true;previewPending++;showPreviewBusy();
  try{
    let timeout;
    try{await Promise.race([customElements.whenDefined('td-remote-panel'),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(new Error(t('preview.unavailable'))),10000);})]);}
    finally{clearTimeout(timeout);}
    if(!autoPreview)return;
    const data=await editorRequest('remote-preview',{});
    if(!autoPreview)return;
    const endpoint=new URL('/',location.href);endpoint.port=String(data.port);
    $('#preview').setAttribute('endpoint',endpoint.href);
    renderPreviewSource(data.source);
    await $('#preview').connect({ticket:data.ticket});
  }catch(error){
    $('#previewactivity').title=error.message;
    if($('#preview').report)$('#preview').report('error',error.message);
    throw error;
  }finally{previewPending--;showPreviewBusy();}
}

function nodeLayoutBounds(n){
  const card=document.querySelector(`#cards [data-node="${CSS.escape(n.id)}"]`);
  return {x:n.ui?.x||0,y:n.ui?.y||0,width:card?.offsetWidth||(Number.isFinite(n.ui?.width)&&n.ui.width>0?n.ui.width:190),height:card?.offsetHeight||180};
}
function canvasNodeBounds(nodes){
  const bounds=[...nodes.map(nodeLayoutBounds),...completeGroupFrames(nodes).map(groupFrameBounds).filter(Boolean)];
  return {minX:Math.min(...bounds.map(n=>n.x)),minY:Math.min(...bounds.map(n=>n.y)),maxX:Math.max(...bounds.map(n=>n.x+n.width)),maxY:Math.max(...bounds.map(n=>n.y+n.height))};
}
function centeredNodePan({minX,minY,maxX,maxY},zoom){
  return {x:$('#canvas').clientWidth/2-(minX+maxX)*zoom/2,y:$('#canvas').clientHeight/2-(minY+maxY)*zoom/2};
}
function centerNodes(nodes,animate=false){
  if(!nodes.length)return;
  // Center only pans; the current zoom is preserved throughout the motion.
  moveCanvas(centeredNodePan(canvasNodeBounds(nodes),scale),scale,animate?'center':null,animate);
}
function fitNodes(nodes,animate=false,forceAnimation=false){
  if(!nodes.length)return;
  const bounds=canvasNodeBounds(nodes),{minX,minY,maxX,maxY}=bounds;
  const nextScale=Math.max(.25,Math.min(1,($('#canvas').clientWidth-100)/(maxX-minX),($('#canvas').clientHeight-140)/(maxY-minY)));
  moveCanvas(centeredNodePan(bounds,nextScale),nextScale,animate?'frameDamping':null,forceAnimation);
}
function moveArrowNavigationView(node){
  const mode=EDITOR_DEV_SETTINGS.arrowNavigationView;
  if(mode==='frame')fitNodes([node],true,true);
  else if(mode==='frameInstant')fitNodes([node]);
  else if(mode==='centerAnimated'||mode==='centerInstant')centerNodes([node],mode==='centerAnimated');
}
function fit(){if(graph)fitNodes(current().nodes);}
async function load(){
  if(typeof uniformLive!=='undefined')uniformLive.disconnect();
  const generation=++editorLoadGeneration;clearTimeout(autoTimer);autoTimer=null;historyBusy=true;renderHistoryActions();
  try{
    const data=await api('state');if(generation!==editorLoadGeneration)return;
    applyNeedsReview=false;connectionIssue='';renderConnectionNotice();setTypeContract(data.typeContract);
    const filter=$('#createtype');filter.replaceChildren(el('option',{value:'all','data-i18n':'create.allTypes'},t('create.allTypes')),...interfaceTypes().map(type=>el('option',{value:type},type)));
    upgradePending=data.upgradeReview||null;closeUpgradeReview();savedStateIssue=data.savedStateIssue||null;editorTarget=data.shaderKind||data.state?.graph?.target||'mat';
    graph=savedStateIssue?{schemaVersion:1,target:editorTarget,declarations:[],functions:[],stages:{...(editorTarget==='mat'?{vertex:{nodes:[],edges:[]}}:{}),pixel:{nodes:[],edges:[]}}}:clone(data.state.graph);
    editorReadOnlyReason=data.readOnlyReason||'';catalog=data.catalog;examples=data.examples;functionLibrary=data.functionLibrary||[];personalLibrary=data.personalLibrary||{items:[],issues:[],folder:''};
    graphTrail=[];selection.clear();conflicted=false;revision=data.state?.revision??0;dirty=false;past=[];future=[];historyEpoch=0;historyNativeToken=data.history?.token||null;
    nativeSourceSnapshot=null;nativeSourceError='';nativeSourceBusy=false;nativeSourcePolling=false;nativeSourceRefreshPending=false;nativeSourceUncertain=false;++nativeSourceReadEpoch;nativeMutationBusy=false;nativeValueBusy=false;applyInFlight=null;submitBusy=false;applyLayoutOnly=false;
    uniformGeneration++;uniformPolling=false;uniformPending.clear();uniformReadbacks.clear();uniformWrites=Promise.resolve();uniformSnapshot={revision:-1,uniforms:{}};
    customSnapshot=null;customBusy=false;customPolling=false;customError='';customRetryAt=0;$('#customcontrols').dataset.structure='';$('#nativeuniforms').dataset.sourceStructure='';
    readonly=!!savedStateIssue||!!upgradePending||!!data.readOnlyReason||graph.schemaVersion!==1;selected=null;selectedInputId=null;clearCompileDiagnostics();rememberSavedGraph(graph);renderGraphSaveState();
    setEditorTargetPath(data.target);$('#apply').disabled=readonly;render();renderUpgradeNotice();fit();await preview().catch(()=>{});
    if(generation!==editorLoadGeneration)return;
    status(upgradePending?t('upgrade.explanation'):savedStateIssue?t('saved.explanation'):data.readOnlyReason||t('connection.ready'),readonly,{clearError:true});
    if(!savedStateIssue&&$('#savedreview').open)$('#savedreview').close();
  }finally{if(generation===editorLoadGeneration){historyBusy=false;renderHistoryActions();}}
}

let editorReloading=false;
const editorFieldDrafts=new Map();
const editorFieldValue=entry=>['checkbox','radio'].includes(entry.type)?String(entry.checked):entry.value;
function pendingEditorField(){
  for(const entry of document.querySelectorAll('input,textarea,select'))if(!entry.closest('dialog:not([open])')&&entry.hasPendingEdit?.())return entry;
  for(const [entry,value]of editorFieldDrafts){
    if(!entry.isConnected||entry.closest('dialog:not([open])')){editorFieldDrafts.delete(entry);continue;}
    if((entry.closest('dialog[open]')||!entry.hasPendingEdit)&&editorFieldValue(entry)!==value)return entry;
  }
  // The GLSL editor can retain an unfinished body while another node is selected.
  for(const data of [...Object.values(graph?.stages||{}),...(graph?.functions||[]).map(f=>f.graph)]){
    for(const node of data.nodes){
      const draft=glslCodeDrafts.get(node);
      if(draft&&draft.base===node.params.code&&draft.text!==node.params.code)return true;
    }
  }
  return null;
}
function renderHeaderVisibility(){
  const button=$('#toggleheader'),shown=!$('#editorheader').hidden;
  button.setAttribute('aria-expanded',String(shown));button.title=t(shown?'header.hide':'header.show');
  $('#editorrefresh').title=t('editorReload.action');$('#reload').title=t('action.reload');
}
function requestEditorReload(){
  const unfinished=pendingEditorField();
  if(unfinished){status(t('editorReload.finishField'),true,{kind:'reload'});unfinished.focus?.({preventScroll:true});return false;}
  if(statusErrorKind==='reload')status(t('connection.ready'),false,{clearError:'reload'});
  if(submitBusy||uniformPending.size||nativeSourceBusy||historyBusy||nativeMutationBusy||customBusy||exportBusy||personalBusy||pendingEditorWrites){status(t('editorReload.busy'));return false;}
  if(dirty){
    try{
      const draft=JSON.stringify({graph,revision});sessionStorage.setItem(draftKey,draft);
      if(sessionStorage.getItem(draftKey)!==draft)throw Error('Draft not retained');
    }catch{status(t('editorReload.storageFailed'),true,{kind:'reload'});return false;}
    if(!confirm(t('editorReload.keepDraft')))return false;
  }
  clearTimeout(autoTimer);autoTimer=null;editorReloading=true;location.reload();return true;
}
// Reloading the applied graph replaces editing state and clears its history.
let reloadAppliedPending=null;
function reloadAppliedBusy(){return submitBusy||historyBusy||nativeMutationBusy||uniformPending.size||nativeSourceBusy||customBusy||exportBusy||personalBusy||pendingEditorWrites;}
function requestAppliedGraphReload(){
  const dialog=$('#reloadapplieddialog');if(dialog.open)return true;
  const unfinished=pendingEditorField();
  if(unfinished||valueLadder||pendingValueLadder){status(t('appliedReload.finishField'),true,{kind:'reload'});unfinished?.focus?.({preventScroll:true});return false;}
  if(reloadAppliedBusy()){status(t('appliedReload.busy'));return false;}
  reloadAppliedPending={resumeApply:!!autoTimer};clearTimeout(autoTimer);autoTimer=null;
  $('#reloadappliedstatus').textContent='';dialog.showModal();$('#reloadappliedcancel').focus({preventScroll:true});return true;
}
async function confirmAppliedGraphReload(){
  const dialog=$('#reloadapplieddialog');if(!dialog.open||!reloadAppliedPending)return false;
  if(reloadAppliedBusy()){$('#reloadappliedstatus').textContent=t('appliedReload.busy');return false;}
  if(pendingEditorField()||valueLadder||pendingValueLadder){$('#reloadappliedstatus').textContent=t('appliedReload.finishField');return false;}
  reloadAppliedPending.resumeApply=false;dialog.close('reload');
  try{await load();return true;}catch(error){status(error.message,true);return false;}
}
function installAppliedGraphReload(){
  $('#reload').onpointerdown=event=>{if(pendingEditorField()||valueLadder||pendingValueLadder)event.preventDefault();};
  $('#reload').onclick=requestAppliedGraphReload;
  $('#reloadappliedcancel').onclick=()=>$('#reloadapplieddialog').close('cancel');
  $('#reloadappliedconfirm').onclick=confirmAppliedGraphReload;
  $('#reloadapplieddialog').addEventListener('close',()=>{const pending=reloadAppliedPending;reloadAppliedPending=null;if(pending?.resumeApply)scheduleGraphApply();});
}
const appearanceStorageKey='sgrapeAppearanceV1';
const customNamesStorageKey='sgrapeCustomNamesV1';
let showCustomNodeNames=false;
function customNodeNamesEnabled(){return showCustomNodeNames;}
const linkLinesStorageKey='sgrapeLinkLinesV1';
let showLinkLines=true;
function renderLinkLinesVisibility(){
  const button=$('#showlinklines');if(!button)return;
  button.setAttribute('aria-pressed',String(showLinkLines));
  if(button.getAttribute('role')==='menuitemcheckbox')button.setAttribute('aria-checked',String(showLinkLines));
  decorateShortcutButton(button,'toggleLinkLines');
}
function setLinkLinesVisible(visible){
  showLinkLines=!!visible;
  try{localStorage.setItem(linkLinesStorageKey,String(showLinkLines));}catch{}
  renderLinkLinesVisibility();if(graph)wires();
}
function toggleLinkLines(){setLinkLinesVisible(!showLinkLines);}
function installGraphChrome(){
  try{
    const saved=localStorage.getItem(linkLinesStorageKey);
    showLinkLines=saved===null?JSON.parse(localStorage.getItem(experimentsStorageKey)||'{}').showLinkLines!==false:saved!=='false';
    if(saved===null)localStorage.setItem(linkLinesStorageKey,String(showLinkLines));
  }catch{}
  $('#showlinklines').onclick=toggleLinkLines;renderLinkLinesVisibility();
  try{showCustomNodeNames=localStorage.getItem(customNamesStorageKey)==='true';}catch{}
  const button=$('#customnames'),toolbar=$('.toolbar');
  button.setAttribute('aria-pressed',String(showCustomNodeNames));
  button.onclick=()=>{
    // Finish the same inline edit before changing how node titles are shown.
    document.activeElement?.blur?.();
    const unfinished=pendingEditorField();
    if(unfinished){status(t('editorReload.finishField'),true,{kind:'reload'});unfinished.focus?.({preventScroll:true});return;}
    showCustomNodeNames=!showCustomNodeNames;
    try{localStorage.setItem(customNamesStorageKey,String(showCustomNodeNames));}catch{}
    button.setAttribute('aria-pressed',String(showCustomNodeNames));
    if(graph)render();
  };
  applyFloatingToolbar();
  for(const controls of [toolbar,$('.canvas-view-tools')]){
    // Floating controls must never start a canvas pan, selection, or node drop.
    for(const event of ['pointerdown','mousedown','touchstart','dblclick'])controls.addEventListener(event,e=>e.stopPropagation());
    controls.addEventListener('wheel',e=>e.stopPropagation(),{passive:true});
  }
}
function applyFloatingToolbar(){
  const workspace=$('.graph-workspace'),canvas=$('#canvas'),toolbar=$('.toolbar');
  const floating=EDITOR_DEV_SETTINGS.floatingToolbar;
  workspace.classList.toggle('floating-toolbar',floating);
  if(floating){if(toolbar.parentElement!==canvas)canvas.prepend(toolbar);}
  else if(toolbar.parentElement!==workspace)workspace.insertBefore(toolbar,canvas);
}
const experimentsStorageKey='sgrapeExperimentsV1';
const experimentChoices={
  arrowNavigationView:[['none','experiments.navigationView.none'],['frame','experiments.navigationView.frame'],['frameInstant','experiments.navigationView.frameInstant'],['centerAnimated','experiments.navigationView.centerAnimated'],['centerInstant','experiments.navigationView.centerInstant']],
  arrowNavigationMode:[['legacy','experiments.navigation.legacy'],['branches','experiments.navigation.branches'],['spatial','experiments.navigation.spatial']],
  selectionToolbar:[['off','experiments.selection.off'],['multiple','experiments.selection.multiple'],['all','experiments.selection.all']],
  nodeDragCursor:[['default','experiments.cursor.default'],['move','experiments.cursor.move']],
  uiStyle:[['simple','experiments.style.simple'],['professional','experiments.style.professional'],['cool','experiments.style.cool'],['excellent','experiments.style.excellent'],['legendary','experiments.style.legendary'],['godlike','experiments.style.godlike']]
};
const experimentGroups=[
  ['toolbars',['floatingToolbar','editToolbar','selectionToolbar','selectionCollapseTools','persistentSelectionBounds','hideGroupedSelectionBounds','canvasTrash']],
  ['nodes',['nodeBodyDrag','nodeDragCursor','nodeResizeHint','groupCornerSelect','nodeCollapseExpandedHint','nodeCollapseCollapsedHint','autoDisconnectInvalidEdges']],
  ['appearance',['rgbaComponentTint','vectorComponentTint','systemClock','showFps','canvasDamping','frameDamping','arrowNavigationMode','ctrlArrowAdjacent','arrowNavigationView']]
];
// Rolling raw frame intervals for Low/Min; the plotted peak buckets must not
// be used for percentiles or averages of frames. Only read/sort once a second.
function createFpsStats(){
  const capacity=16384,windowMs=10000;
  const times=new Float64Array(capacity),intervals=new Float64Array(capacity),scratch=new Float64Array(capacity);
  let write=0,size=0,overwrittenAt=-Infinity;
  return {
    push(now,elapsed){
      if(!(elapsed>0))return;
      if(size===capacity)overwrittenAt=times[write];else size++;
      times[write]=now;intervals[write]=elapsed;write=(write+1)%capacity;
    },
    read(now){
      let n=0;
      for(let offset=1;offset<=size;offset++){
        const slot=(write-offset+capacity)%capacity;
        if(times[slot]<=now-windowMs)break;
        scratch[n++]=intervals[slot];
      }
      // Never silently report a shorter window if an extreme callback rate
      // exceeds the fixed buffer. Normal 60–1000 Hz displays fit in 10 seconds.
      if(!n||overwrittenAt>now-windowMs)return {low:null,min:null};
      const ordered=scratch.subarray(0,n);ordered.sort();
      const min=1000/ordered[n-1];
      if(n<100)return {low:null,min};
      const slowCount=Math.ceil(n/100);let slowTime=0;
      for(let i=n-slowCount;i<n;i++)slowTime+=ordered[i];
      return {low:1000*slowCount/slowTime,min};
    }
  };
}
let fpsFrame=null;
function applyFpsDisplay(){
  const panel=$('#uifps'),label=$('#uifpsvalue'),low=$('#uifpslow'),minimum=$('#uifpsmin'),canvas=$('#uifpstrail'),enabled=EDITOR_DEV_SETTINGS.showFps;
  panel.hidden=!enabled;
  document.removeEventListener('visibilitychange',applyFpsDisplay);
  if(enabled)document.addEventListener('visibilitychange',applyFpsDisplay);
  if(!enabled||document.hidden){
    if(fpsFrame!==null)cancelAnimationFrame(fpsFrame);
    fpsFrame=null;label.textContent='—';low.textContent=minimum.textContent='—';
    // Do not initialize a drawing context when the default-off feature is unused.
    if(canvas.width)canvas.width=0;
    return;
  }
  if(fpsFrame!==null)return;
  label.textContent='—';low.textContent=minimum.textContent='—';
  const width=200,height=52,ratio=Math.min(window.devicePixelRatio||1,2);
  canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);
  const ctx=canvas.getContext('2d');ctx.scale(ratio,ratio);
  // Every callback is sampled. The 100 ms buckets retain the worst interval,
  // so limiting the chart to 10 Hz cannot average away a single-frame stall.
  // Timestamp tags expire old slots without shifting or clearing a history.
  const count=100,bucketMs=100,peaks=new Float32Array(count),tags=new Float64Array(count).fill(-1),stats=createFpsStats();
  let start=null,previous=null,frames=0,lastPaint=-Infinity;
  function drawTrail(bin){
    const first=Math.max(0,bin-count+1),left=2,right=width-2,top=13,bottom=height-11;
    let ceiling=50;
    for(let b=first;b<=bin;b++){const slot=b%count;if(tags[slot]===b)ceiling=Math.max(ceiling,peaks[slot]);}
    ceiling=Math.ceil(ceiling/50)*50;
    ctx.clearRect(0,0,width,height);ctx.strokeStyle=ctx.fillStyle='#9273bb';
    ctx.font='9px ui-monospace, Consolas, monospace';ctx.textBaseline='top';
    ctx.fillText(ceiling+' ms',left,0);ctx.fillText('10 s',left,height-9);
    ctx.textAlign='right';ctx.fillText('0',right,height-9);ctx.textAlign='left';
    ctx.globalAlpha=.3;ctx.beginPath();ctx.moveTo(left,bottom);ctx.lineTo(right,bottom);ctx.stroke();ctx.globalAlpha=1;
    ctx.beginPath();let connected=false;
    for(let b=first;b<=bin;b++){
      const slot=b%count;
      if(tags[slot]!==b){connected=false;continue;}
      const x=right-(bin-b)*(right-left)/(count-1),y=bottom-peaks[slot]/ceiling*(bottom-top);
      if(connected)ctx.lineTo(x,y);else ctx.moveTo(Math.max(left,x-1),y);
      // Give an isolated sample after a stall a visible mark, even across a gap.
      ctx.lineTo(x,y);connected=true;
    }
    ctx.stroke();
  }
  // Browser callback cadence, not TD/video FPS or GPU completion. Sampling is
  // constant work; only this small canvas scans the fixed 100 slots, at 10 Hz.
  function sample(now){
    if(start===null){start=previous=now;drawTrail(Math.floor(now/bucketMs));lastPaint=now;}
    else{
      const bin=Math.floor(now/bucketMs),slot=bin%count,elapsed=now-previous;previous=now;
      if(tags[slot]!==bin){tags[slot]=bin;peaks[slot]=elapsed;}else peaks[slot]=Math.max(peaks[slot],elapsed);
      stats.push(now,elapsed);
      frames++;
      if(now-start>=1000){
        const summary=stats.read(now);
        label.textContent=(frames*1000/(now-start)).toFixed(1);
        low.textContent=summary.low===null?'—':summary.low.toFixed(1);
        minimum.textContent=summary.min===null?'—':summary.min.toFixed(1);
        start=now;frames=0;
      }
      if(now-lastPaint>=bucketMs){drawTrail(bin);lastPaint=now;}
    }
    fpsFrame=requestAnimationFrame(sample);
  }
  fpsFrame=requestAnimationFrame(sample);
}
let systemClockTimer=null;
function refreshSystemClock(){
  const now=new Date(),time=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
  const clock=$('#uisystemclock');clock.textContent=time;clock.dateTime=time;
  clearTimeout(systemClockTimer);
  systemClockTimer=setTimeout(refreshSystemClock,60000-now.getSeconds()*1000-now.getMilliseconds());
}
function refreshVisibleSystemClock(){if(!document.hidden)refreshSystemClock();}
function applySystemClock(){
  const clock=$('#uisystemclock'),fullscreen=$('#uifullscreen'),footer=$('.footer-preferences');
  const active=!!document.fullscreenElement,enabled=EDITOR_DEV_SETTINGS.systemClock||active;
  clock.hidden=!enabled;
  if(active&&document.body.classList.contains('graph-focused'))fullscreen.before(clock);
  else footer.insertBefore(clock,fullscreen.parentElement===footer?fullscreen:null);
  clearTimeout(systemClockTimer);systemClockTimer=null;
  document.removeEventListener('visibilitychange',refreshVisibleSystemClock);
  if(enabled){refreshSystemClock();document.addEventListener('visibilitychange',refreshVisibleSystemClock);}
}
function parseUIExperiments(raw){
  let saved;try{saved=JSON.parse(raw);}catch{}
  const result={...EDITOR_DEV_DEFAULTS};
  if(!saved||typeof saved!=='object'||Array.isArray(saved))return result;
  if(saved.arrowNavigationView===undefined&&saved.arrowNavigationFrame===true)result.arrowNavigationView='frame';
  for(const key of Object.keys(result)){
    const value=saved[key];
    if(key==='canvasDampingMs'||key==='frameDampingMs'){if(typeof value==='number'&&Number.isFinite(value))result[key]=Math.max(10,Math.min(1000,Math.round(value)));}
    else if(experimentChoices[key]?experimentChoices[key].some(([choice])=>choice===value):typeof value==='boolean')result[key]=value;
  }
  return result;
}
function renderUIExperiments(){
  const panel=$('#experimentspanel'),opener=$('#uiexperiments');
  opener.title=t('experiments.title');opener.setAttribute('aria-expanded',String(panel.matches(':popover-open')));
  for(const entry of panel.querySelectorAll('[data-experiment]')){
    const key=entry.dataset.experiment;
    if(entry.type==='checkbox')entry.checked=key==='floatingToolbar'?!EDITOR_DEV_SETTINGS[key]:EDITOR_DEV_SETTINGS[key];
    else if(entry.setSyncedValue)entry.setSyncedValue(EDITOR_DEV_SETTINGS[key]);else entry.value=EDITOR_DEV_SETTINGS[key];
    if(key==='canvasDampingMs'||key==='frameDampingMs')entry.disabled=!EDITOR_DEV_SETTINGS[key.slice(0,-2)];
    entry.closest('.experiment-option').title=t('experiments.'+key+'.hint');
  }
  // Keep the legacy storage key; Appearance is now outside the experimental UI/reset.
  $('#uistyle').value=EDITOR_DEV_SETTINGS.uiStyle;$('#uistyle').title=t('experiments.uiStyle.hint');
  $('#experimentsreset').disabled=Object.keys(EDITOR_DEV_DEFAULTS).filter(key=>key!=='uiStyle').every(key=>EDITOR_DEV_SETTINGS[key]===EDITOR_DEV_DEFAULTS[key]);
  if(panel.matches(':popover-open'))positionAppearancePanel(panel,opener);
}
function setUIExperiments(values){
  if($('#canvas').onpointermove){renderUIExperiments();status(t('experiments.finishGesture'));return;}
  const next=parseUIExperiments(JSON.stringify({...EDITOR_DEV_SETTINGS,...values}));
  if(Object.keys(next).every(key=>next[key]===EDITOR_DEV_SETTINGS[key]))return;
  const redrawWires=Object.keys(next).some(key=>!['uiStyle','systemClock','showFps','arrowNavigationMode','ctrlArrowAdjacent','arrowNavigationView','canvasDamping','canvasDampingMs','frameDamping','frameDampingMs','floatingToolbar','editToolbar','selectionToolbar','selectionCollapseTools','persistentSelectionBounds','hideGroupedSelectionBounds','groupCornerSelect'].includes(key)&&next[key]!==EDITOR_DEV_SETTINGS[key]);
  const dampingChanged=['arrowNavigationView','canvasDamping','canvasDampingMs','frameDamping','frameDampingMs'].some(key=>next[key]!==EDITOR_DEV_SETTINGS[key]);
  if(next.arrowNavigationMode!==EDITOR_DEV_SETTINGS.arrowNavigationMode)resetArrowNavigation();
  // Display preferences preserve graph elements and in-progress numeric drafts.
  if(redrawWires){
    cancelValueLadder();touchGraphGesture?.cancel();nodeDragGesture?.cancel();nodeResizeGesture?.cancel();
    if(linkStart||wireDrag||wireGesture)cancelConnection();
  }
  Object.assign(EDITOR_DEV_SETTINGS,next);
  if(dampingChanged)applyCanvasDamping();
  try{localStorage.setItem(experimentsStorageKey,JSON.stringify(next));}catch{}
  applyFloatingToolbar();applyGraphUISettings();applySystemClock();applyFpsDisplay();clearGraphTrash();
  if(graph&&redrawWires){
    for(const card of document.querySelectorAll('#cards .node')){
      const node=current().nodes.find(node=>node.id===card.dataset.node);if(!node)continue;
      card.dataset.dragSurface=isAnnotationNode(node)||!next.nodeBodyDrag?'header':'body';
      const title=card.querySelector('.node-title-text'),toggle=title.querySelector('.node-collapse-toggle');
      const visible=node.ui?.collapsed===true?next.nodeCollapseCollapsedHint:next.nodeCollapseExpandedHint;
      if(visible!==!!toggle){
        if(visible)title.prepend(nodeCollapseToggle(node));else toggle.remove();
        delete card.dataset.nodeDefaultWidth;applyNodeWidth(card,node);
      }
    }
    wires();
  }
  if(typeof renderSelectionToolbar==='function')renderSelectionToolbar();
  renderUIExperiments();
}
function installUIExperiments(){
  try{Object.assign(EDITOR_DEV_SETTINGS,parseUIExperiments(localStorage.getItem(experimentsStorageKey)));}catch{}
  const panel=$('#experimentspanel'),opener=$('#uiexperiments'),list=$('#experimentoptions');
  for(const [name,keys]of experimentGroups){
    const headingId='experimentgroup-'+name,group=el('section',{class:'experiment-group','data-experiment-group':name,'aria-labelledby':headingId});
    group.append(el('h3',{id:headingId,'data-i18n':'experiments.group.'+name},t('experiments.group.'+name)));
    for(const key of keys){
      if(!Object.hasOwn(EDITOR_DEV_DEFAULTS,key))continue;
      if(key==='canvasDamping'||key==='frameDamping'){
        const durationKey=key+'Ms';
        const row=el('div',{class:'experiment-option experiment-damping'}),label=el('label',{class:'experiment-toggle'});
        const toggle=el('input',{type:'checkbox','data-experiment':key});toggle.onchange=()=>setUIExperiments({[key]:toggle.checked});
        label.append(toggle,el('span',{'data-i18n':'experiments.'+key},t('experiments.'+key)));
        const number=input(EDITOR_DEV_SETTINGS[durationKey],value=>setUIExperiments({[durationKey]:value}),'number',{local:true});
        Object.assign(number,{min:'10',max:'1000',step:'1',numericRange:{min:10,max:1000,step:1}});
        number.dataset.experiment=durationKey;number.dataset.i18nLabel='experiments.'+durationKey;number.dataset.i18nTitle='experiments.'+durationKey+'.hint';number.setAttribute('aria-label',t('experiments.'+durationKey));number.refreshNumericSlider();
        const value=el('div',{class:'experiment-value'});value.append(number,el('span',{},'ms'));row.append(label,value);group.append(row);continue;
      }
      const row=el('label',{class:'experiment-option'}),choices=experimentChoices[key];
      const entry=choices?el('select',{'data-experiment':key}):el('input',{type:'checkbox','data-experiment':key});
      if(choices)for(const [value,label]of choices)entry.append(el('option',{value,'data-i18n':label},t(label)));
      row.append(el('span',{'data-i18n':'experiments.'+key},t('experiments.'+key)),entry);group.append(row);
      entry.onchange=()=>setUIExperiments({[key]:choices?entry.value:key==='floatingToolbar'?!entry.checked:entry.checked});
    }
    list.append(group);
  }
  $('#experimentsreset').onclick=()=>setUIExperiments({...EDITOR_DEV_DEFAULTS,uiStyle:EDITOR_DEV_SETTINGS.uiStyle});
  panel.addEventListener('beforetoggle',event=>{if(event.newState==='open')positionAppearancePanel(panel,opener);});
  panel.addEventListener('toggle',renderUIExperiments);
  panel.addEventListener('keydown',event=>{
    event.stopPropagation();
    if(event.key==='Escape'){event.preventDefault();panel.hidePopover();opener.focus({preventScroll:true});}
  });
  opener.onclick=()=>requestAnimationFrame(()=>{if(panel.matches(':popover-open'))list.querySelector('input,select')?.focus({preventScroll:true});});
  window.addEventListener('resize',()=>{if(panel.matches(':popover-open'))positionAppearancePanel(panel,opener);});
  applyGraphUISettings();applySystemClock();applyFpsDisplay();applyCanvasDamping();clearGraphTrash();renderUIExperiments();
}
/* One immutable palette per base theme. Only root color tokens are transformed;
   image pixels, authored color swatches and GLSL syntax colors never pass here. */
const uiTonePalettes=new Map();
const uiToneOverridden=new Set();
function uiToneColor(value){
  const hex=String(value).trim().match(/^#([\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i);
  if(hex){let h=hex[1];if(h.length<=4)h=[...h].map(c=>c+c).join('');return[parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16),h.length===8?parseInt(h.slice(6,8),16)/255:1];}
  const rgb=String(value).trim().match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/i);
  return rgb?[+rgb[1],+rgb[2],+rgb[3],rgb[4]===undefined?1:+rgb[4]]:null;
}
function uiToneAdjustedColor(color,amount,theme){
  const [r,g,b,alpha]=color,brightness=(.2126*r+.7152*g+.0722*b)/255;
  if(brightness<=0||brightness>=1)return `rgba(${r},${g},${b},${alpha})`;
  const strength=(amount>0?.32:theme==='light'?.55:.40)*1.5;
  const curved=Math.pow(brightness,Math.exp(-amount*strength));
  // Protect dark surfaces during brightening, without introducing a contrast pivot.
  const x=Math.min(1,brightness/(theme==='light'?.10:.35));
  const weight=amount>0?x*x*(3-2*x):1;
  const target=brightness+(curved-brightness)*weight;
  // Blend toward white or black in one proportion, preserving channel ordering.
  const adjusted=[r,g,b].map(c=>Math.round(target>brightness?c+(255-c)*(target-brightness)/(1-brightness):c*target/brightness));
  return `rgba(${adjusted.join(',')},${alpha})`;
}
function applyUITone(theme,value){
  const root=document.documentElement,amount=Math.max(-100,Math.min(100,Number(value)||0))/100;
  for(const property of uiToneOverridden)root.style.removeProperty(property);
  uiToneOverridden.clear();
  if(!amount)return;
  let palette=uiTonePalettes.get(theme);
  if(!palette){
    const style=getComputedStyle(root);palette=new Map();
    // Explicit UI namespaces exclude authoring/preview colors and shader syntax.
    for(const property of style){
      if(!/^--(?:ui-|node-|panel(?:-|$)|canvas-|browser-|state-|scroll-|category-|ladder-|type-|wire-|selection(?:-|$)|muted$|line$|border$|purple$|green$|danger$|help-link$)/.test(property))continue;
      const color=uiToneColor(style.getPropertyValue(property));if(color)palette.set(property,color);
    }
    uiTonePalettes.set(theme,palette);
  }
  for(const [property,color] of palette){root.style.setProperty(property,uiToneAdjustedColor(color,amount,theme));uiToneOverridden.add(property);}
}

function normalizeUITone(value){return typeof value==='number'&&Number.isFinite(value)?Math.max(-100,Math.min(100,Math.round(value))):0;}
function normalizeUIScale(value){return typeof value==='number'&&Number.isFinite(value)?Math.max(75,Math.min(125,Math.round(value))):100;}
function uiScaleFactor(){return uiAppearance.scale/100;}
function parseUIAppearance(raw){
  let saved;try{saved=JSON.parse(raw);}catch{}
  const theme=saved?.theme==='light'?'light':'dark',tones={dark:0,light:0};
  if(saved?.tones&&typeof saved.tones==='object'&&!Array.isArray(saved.tones)){
    for(const mode of ['dark','light'])tones[mode]=normalizeUITone(saved.tones[mode]);
  }else tones[theme]=normalizeUITone(saved?.tone);
  const size=saved?.size==='comfortable'?'comfortable':'standard';
  const scale=normalizeUIScale(Object.hasOwn(saved??{},'scale')?saved.scale:saved?.scales?.[size]);
  return{size,theme,tones,tone:tones[theme],scale};
}
let uiAppearance=parseUIAppearance(null);
function positionAppearancePanel(panel=$('#appearancepanel'),opener=$('#uitheme')){
  const rect=opener.getBoundingClientRect(),zoom=uiScaleFactor(),viewport=innerWidth/zoom;
  const width=Math.min(panel.offsetWidth||parseFloat(getComputedStyle(panel).width)||260,viewport-16);
  panel.style.right=Math.max(8,Math.min(viewport-width-8,(innerWidth-rect.right)/zoom))+'px';
  panel.style.bottom=Math.max(8,(innerHeight-rect.top)/zoom+8)+'px';
  panel.style.maxHeight=Math.max(80,rect.top/zoom-16)+'px';
}
function renderUIAppearance(){
  const root=document.documentElement,{size,theme,tone}=uiAppearance;
  root.dataset.uiSize=size;root.dataset.uiTheme=theme;
  $('#uistylerow').hidden=theme!=='dark';
  root.style.setProperty('--ui-scale',uiScaleFactor());
  applyUITone(theme,tone);
  document.querySelectorAll('#cards .node[data-category="annotation"]').forEach(applyNoteColorContrast);
  for(const [id,key,value]of [['uisize','size',size],['uitheme','theme',theme]]){
    const button=$('#'+id);if(!button)continue;
    const label=t('appearance.'+key+'.'+value);
    button.title=label;button.setAttribute('aria-label',label);
  }
  $('#uisize').setAttribute('aria-expanded',String($('#sizepanel').matches(':popover-open')));
  $('#uitheme').setAttribute('aria-expanded',String($('#appearancepanel').matches(':popover-open')));
  $('#uitheme .theme-moon').toggleAttribute('hidden',theme!=='dark');$('#uitheme .theme-sun').toggleAttribute('hidden',theme!=='light');
  for(const button of document.querySelectorAll('[data-ui-theme-choice]'))button.setAttribute('aria-pressed',String(button.dataset.uiThemeChoice===theme));
  for(const button of document.querySelectorAll('[data-ui-size-choice]'))button.setAttribute('aria-pressed',String(button.dataset.uiSizeChoice===size));
  const sizeSlider=$('#uiscale'),sizeDescription=uiAppearance.scale+'%';
  sizeSlider.value=String(uiAppearance.scale);sizeSlider.setAttribute('aria-valuetext',sizeDescription);sizeSlider.title=t('appearance.scale')+' · '+sizeDescription+' · '+t('appearance.scale.reset');
  $('#uiscaleminus').disabled=uiAppearance.scale<=75;$('#uiscaleplus').disabled=uiAppearance.scale>=125;
  $('#uiscaleminus').title=t('appearance.scale.decrease');$('#uiscaleplus').title=t('appearance.scale.increase');
  const slider=$('#uitone'),description=t('appearance.tone.'+(tone===0?'base':tone>0?'brighter':'darker'))+(tone?' '+Math.abs(tone):'');
  slider.value=String(tone);slider.setAttribute('aria-valuetext',description);slider.title=t('appearance.tone')+' · '+description+' · '+t('appearance.tone.reset');
  $('#uitoneminus').disabled=tone<=-100;$('#uitoneplus').disabled=tone>=100;
  $('#uitoneminus').title=t('appearance.tone.decrease');$('#uitoneplus').title=t('appearance.tone.increase');
  $('meta[name="theme-color"]').content=theme==='light'?'#f2f1f6':'#19181f';
  if($('#appearancepanel').matches(':popover-open'))positionAppearancePanel();
  if($('#sizepanel').matches(':popover-open'))positionAppearancePanel($('#sizepanel'),$('#uisize'));
}
function setUIAppearance(key,value){
  if(!((key==='size'&&['standard','comfortable'].includes(value))||(key==='theme'&&['dark','light'].includes(value))||(['tone','scale'].includes(key)&&typeof value==='number'&&Number.isFinite(value))))return;
  const previous=uiAppearance;
  const tones={...previous.tones};
  if(key==='tone')tones[previous.theme]=normalizeUITone(value);
  const scale=key==='scale'?normalizeUIScale(value):previous.scale;
  const theme=key==='theme'?value:previous.theme,size=key==='size'?value:previous.size;
  uiAppearance={size,theme,tones,tone:tones[theme],scale};
  try{localStorage.setItem(appearanceStorageKey,JSON.stringify({size,theme,tones,scale}));}catch{}
  renderUIAppearance();
  // A display preference does not redraw the graph, change its zoom or apply a Shader.
  if(previous.scale!==uiAppearance.scale||previous.size!==size)window.dispatchEvent(new Event('resize'));
  if(graph&&(key==='size'||key==='scale'))requestAnimationFrame(wires);
}
function installUIAppearance(){
  const style=$('#uistyle');
  for(const [value,label]of experimentChoices.uiStyle)style.append(el('option',{value,'data-i18n':label},t(label)));
  style.value=EDITOR_DEV_SETTINGS.uiStyle;style.onchange=()=>setUIExperiments({uiStyle:style.value});
  try{uiAppearance=parseUIAppearance(localStorage.getItem(appearanceStorageKey));}catch{}
  renderUIAppearance();
  for(const [panelId,openerId,choice,key,inputId,adjustKey,neutral,step]of [
    ['appearancepanel','uitheme','theme','theme','uitone','tone',0,10],
    ['sizepanel','uisize','size','size','uiscale','scale',100,5]
  ]){
    const panel=$('#'+panelId),opener=$('#'+openerId),slider=$('#'+inputId);
    const position=()=>positionAppearancePanel(panel,opener);
    panel.addEventListener('beforetoggle',event=>{if(event.newState==='open')position();});
    panel.addEventListener('toggle',()=>opener.setAttribute('aria-expanded',String(panel.matches(':popover-open'))));
    opener.onclick=event=>{if(event.detail===0)requestAnimationFrame(()=>{if(panel.matches(':popover-open'))panel.querySelector('[aria-pressed="true"]').focus({preventScroll:true});});};
    for(const button of panel.querySelectorAll('[data-ui-'+choice+'-choice]'))button.onclick=()=>setUIAppearance(key,button.getAttribute('data-ui-'+choice+'-choice'));
    slider.oninput=event=>setUIAppearance(adjustKey,Number(event.target.value));
    slider.ondblclick=()=>setUIAppearance(adjustKey,neutral);
    slider.oncontextmenu=event=>{event.preventDefault();setUIAppearance(adjustKey,neutral);};
    $('#'+inputId+'minus').onclick=()=>setUIAppearance(adjustKey,uiAppearance[adjustKey]-step);
    $('#'+inputId+'plus').onclick=()=>setUIAppearance(adjustKey,uiAppearance[adjustKey]+step);
    panel.addEventListener('keydown',event=>{
      event.stopPropagation();
      if(event.key==='Escape'){event.preventDefault();panel.hidePopover();opener.focus({preventScroll:true});}
    });
    window.addEventListener('resize',()=>{if(panel.matches(':popover-open'))position();});
  }
}
function renderGraphZoom(){
  const opener=$('#zoom'),menu=$('#canvaszoommenu'),percent=Math.round(scale*100);
  opener.textContent=percent+'%';opener.title=t('canvas.zoom')+' · '+percent+'%';opener.setAttribute('aria-label',opener.title);
  opener.setAttribute('aria-expanded',String(menu.matches(':popover-open')));
  for(const button of menu.querySelectorAll('[data-canvas-zoom]'))button.setAttribute('aria-checked',String(Math.abs(Number(button.dataset.canvasZoom)/100-scale)<.000001));
}
function setGraphZoom(value){
  if(!graph||!Number.isFinite(value))return;
  const rect=$('#canvas').getBoundingClientRect();zoomCanvasAt(value,rect.width/uiScaleFactor()/2,rect.height/uiScaleFactor()/2);
}
function zoomCanvasAt(value,x,y){
  const target=canvasMotion?.setting==='canvasDamping'?canvasMotion.to:null,previous=target?.scale??scale,origin=target||pan,next=Math.max(GRAPH_ZOOM_MIN,Math.min(GRAPH_ZOOM_MAX,value));
  moveCanvas({x:x-(x-origin.x)*next/previous,y:y-(y-origin.y)*next/previous},next);
}
function installGraphZoom(){
  const opener=$('#zoom'),menu=$('#canvaszoommenu'),presets=[25,50,75,100,125,150,170];
  const close=(focus=false)=>{if(menu.matches(':popover-open'))menu.hidePopover();if(focus)opener.focus({preventScroll:true});};
  const position=()=>{
    const rect=opener.getBoundingClientRect(),zoom=uiScaleFactor(),width=menu.offsetWidth||112;
    Object.assign(menu.style,{left:Math.max(8,Math.min(innerWidth/zoom-width-8,rect.right/zoom-width))+'px',bottom:Math.max(8,(innerHeight-rect.top)/zoom+6)+'px',maxHeight:Math.max(40,rect.top/zoom-16)+'px'});
  };
  for(const percent of presets){
    const button=el('button',{type:'button',role:'menuitemradio','data-canvas-zoom':percent,'aria-checked':'false',tabindex:'-1'},percent+'%');
    button.onclick=()=>{setGraphZoom(percent/100);close(true);};menu.append(button);
  }
  const buttons=[...menu.querySelectorAll('button')];
  menu.addEventListener('beforetoggle',event=>{if(event.newState==='open'){renderGraphZoom();position();}});
  menu.addEventListener('toggle',renderGraphZoom);
  opener.onclick=()=>requestAnimationFrame(()=>{if(menu.matches(':popover-open'))buttons.reduce((best,button)=>Math.abs(Number(button.dataset.canvasZoom)-scale*100)<Math.abs(Number(best.dataset.canvasZoom)-scale*100)?button:best).focus({preventScroll:true});});
  opener.addEventListener('keydown',event=>{
    if(!['ArrowUp','ArrowDown'].includes(event.key))return;event.preventDefault();event.stopPropagation();
    if(!menu.matches(':popover-open'))menu.showPopover();buttons[event.key==='ArrowUp'?buttons.length-1:0].focus({preventScroll:true});
  });
  menu.addEventListener('keydown',event=>{
    event.stopPropagation();const index=buttons.indexOf(document.activeElement);
    if(event.key==='Escape'){event.preventDefault();close(true);}
    else if(event.key==='Tab')close(true);
    else if(['ArrowUp','ArrowDown','Home','End'].includes(event.key)){
      event.preventDefault();buttons[event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length].focus({preventScroll:true});
    }
  });
  window.addEventListener('resize',()=>{if(menu.matches(':popover-open'))position();});
  renderGraphZoom();
}
// View modes retain the same graph DOM and never enter graph history or saved layouts.
let graphFocused=false,fullscreenBusy=false;
function renderViewModes(){
  const focused=$('#graphfocus'),fullscreen=$('#uifullscreen'),active=!!document.fullscreenElement;
  focused.textContent=t(graphFocused?'view.restoreLayout':'view.graphFocus');
  decorateShortcutButton(focused,'focusGraph',graphFocused?'view.restoreLayoutHint':'view.graphFocusHint');
  focused.setAttribute('aria-pressed',String(graphFocused));
  const supported=!!document.documentElement.requestFullscreen&&document.fullscreenEnabled!==false;
  fullscreen.disabled=fullscreenBusy||(!active&&!supported);
  decorateShortcutButton(fullscreen,'fullscreen',active?'view.exitFullscreen':supported?'view.fullscreen':'view.fullscreenUnavailable');
  fullscreen.setAttribute('aria-pressed',String(active));
  fullscreen.querySelector('.fullscreen-enter').toggleAttribute('hidden',active);
  fullscreen.querySelector('.fullscreen-exit').toggleAttribute('hidden',!active);
  applySystemClock();
}
function setGraphFocus(enabled){
  graphFocused=!!enabled;document.body.classList.toggle('graph-focused',graphFocused);
  const fullscreen=$('#uifullscreen');
  if(graphFocused)$('#graphfocus').after(fullscreen);else $('.footer-preferences').append(fullscreen);
  renderViewModes();if(graph)requestAnimationFrame(wires);
}
function installViewModes(){
  $('#graphfocus').onclick=()=>setGraphFocus(!graphFocused);
  // Canvas controls must not start a pan/selection gesture or clear the selection.
  $('.canvas-view-tools').addEventListener('pointerdown',event=>event.stopPropagation());
  $('.canvas-view-tools').addEventListener('dblclick',event=>event.stopPropagation());
  $('.canvas-view-tools').addEventListener('contextmenu',event=>event.stopPropagation());
  $('#uifullscreen').onclick=async()=>{
    if(fullscreenBusy)return;fullscreenBusy=true;renderViewModes();
    try{
      if(document.fullscreenElement)await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    }catch{status(t('view.fullscreenFailed'),true);}
    finally{fullscreenBusy=false;renderViewModes();}
  };
  document.addEventListener('fullscreenchange',()=>{renderViewModes();if(graph)requestAnimationFrame(wires);});
  // A view shortcut also works while editing, without submitting an Enter draft.
  document.addEventListener('keydown',event=>{
    if(event.key!=='Enter'||!event.altKey||event.ctrlKey||event.metaKey||event.shiftKey||event.isComposing)return;
    event.preventDefault();event.stopPropagation();
    if(!event.repeat)$('#uifullscreen').click();
  },true);
  renderViewModes();
}
function installEditorChrome(){
  installSelectMenus();
  installViewModes();
  installUIAppearance();
  installGraphZoom();
  installUIShare();
  installShortcutHelp();
  installUIExperiments();
  installGraphChrome();
  installSelectionToolbar();
  installGraphToolbarOverflow();
  try{$('#editorheader').hidden=localStorage.getItem('sgrapeHeaderVisible')==='false';}catch{}
  renderHeaderVisibility();
  $('#toggleheader').onclick=()=>{
    $('#editorheader').hidden=!$('#editorheader').hidden;
    try{localStorage.setItem('sgrapeHeaderVisible',String(!$('#editorheader').hidden));}catch{}
    renderHeaderVisibility();if(graph)requestAnimationFrame(wires);
  };
  $('#editorrefresh').onpointerdown=e=>{if(pendingEditorField())e.preventDefault();};
  $('#editorrefresh').onclick=requestEditorReload;
  const editable=entry=>entry?.matches?.('input:not([type=search]):not([type=button]):not([type=submit]),textarea,select')&&entry.closest('#inspector,#cards,#uniformsbody,#controlsbody,dialog');
  document.addEventListener('focusin',e=>{if(editable(e.target)&&!editorFieldDrafts.has(e.target))editorFieldDrafts.set(e.target,editorFieldValue(e.target));},true);
  document.addEventListener('change',e=>{
    const entry=e.target;if(!editable(entry)||entry.hasPendingEdit||entry.closest('dialog[open]'))return;
    queueMicrotask(()=>{if(entry.validity.valid&&entry.getAttribute('aria-invalid')!=='true')editorFieldDrafts.set(entry,editorFieldValue(entry));});
  },true);
  document.addEventListener('close',e=>{if(e.target.matches?.('dialog'))for(const entry of editorFieldDrafts.keys())if(e.target.contains(entry))editorFieldDrafts.delete(entry);},true);
  const clearFinishedDraftNotice=()=>{if(statusErrorKind==='reload'&&!pendingEditorField())status(t('connection.ready'),false,{clearError:'reload'});};
  document.addEventListener('keyup',clearFinishedDraftNotice);
  document.addEventListener('change',()=>queueMicrotask(clearFinishedDraftNotice));
}
function addNode(d,x,y){const changed=change(()=>instantiate(d,x,y));if(changed&&matchMedia('(max-width:800px)').matches)workspaceLayout.closeBrowser();return changed;}
function installFooterActions(){
  const trigger=$('#editormenu'),menu=$('#editoractionsmenu'),proxies=[...menu.querySelectorAll('[data-editor-action]')];let invoked=false;
  const sync=()=>{for(const button of proxies){const target=$('#'+button.dataset.editorAction);button.disabled=target.disabled||target.inert;}};
  const observer=new MutationObserver(sync);for(const button of proxies){
    const target=$('#'+button.dataset.editorAction);observer.observe(target,{attributes:true,attributeFilter:['disabled','inert']});
    button.onclick=()=>{if(!target.disabled&&!target.inert)target.click();};
  }
  const items=()=>[...menu.querySelectorAll('button:not(:disabled)')];
  function position(){
    if(!menu.matches(':popover-open'))return;
    const rect=trigger.getBoundingClientRect(),zoom=uiScaleFactor(),margin=8,width=innerWidth/zoom,height=innerHeight/zoom;
    const above=Math.max(0,rect.top/zoom-margin-4),below=Math.max(0,height-rect.bottom/zoom-margin-4),upward=menu.scrollHeight>below&&above>below;
    menu.style.maxHeight=(upward?above:below)+'px';
    menu.style.left=Math.max(margin,Math.min(rect.left/zoom,width-menu.offsetWidth-margin))+'px';
    menu.style.top=Math.max(margin,upward?rect.top/zoom-menu.offsetHeight-4:rect.bottom/zoom+4)+'px';
  }
  function open(last=false){invoked=false;sync();menu.showPopover();position();if(!pendingEditorField())(last?items().at(-1):items()[0])?.focus({preventScroll:true});}
  trigger.onpointerdown=e=>{if(pendingEditorField())e.preventDefault();};
  trigger.onclick=()=>menu.matches(':popover-open')?menu.hidePopover():open();
  trigger.onkeydown=e=>{if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();open(e.key==='ArrowUp');}};
  menu.addEventListener('click',e=>{const button=e.target.closest('button');if(button&&!button.disabled){invoked=true;menu.hidePopover();}},true);
  menu.onkeydown=e=>{
    const list=items(),at=list.indexOf(document.activeElement);
    if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();e.stopPropagation();list[e.key==='Home'?0:e.key==='End'?list.length-1:(at+(e.key==='ArrowDown'?1:-1)+list.length)%list.length]?.focus();}
    if(e.key==='Tab')menu.hidePopover();
  };
  menu.addEventListener('toggle',e=>{trigger.setAttribute('aria-expanded',String(e.newState==='open'));if(e.newState==='closed'&&!invoked&&menu.contains(document.activeElement))trigger.focus({preventScroll:true});});
  window.addEventListener('resize',position);sync();
}
$('#canvas').addEventListener('dragover',e=>{if(Array.from(e.dataTransfer.types).includes('application/x-sgrape-node')){e.preventDefault();e.dataTransfer.dropEffect='copy';}});
$('#canvas').addEventListener('drop',e=>{const key=e.dataTransfer.getData('application/x-sgrape-node'),d=availableEntries().find(d=>browserEntryKey(d)===key||(key==='vector'&&d.key==='vector'&&d.presetType==='vec2'));$('#canvas').classList.remove('drop-ready');if(!d||!d.stages.includes(stage)||readonly)return;e.preventDefault();const point=graphPoint(e.clientX,e.clientY);if(point&&addNode(d,point.x-95,point.y-18))status(t('node.added')+d.label);});

$('#apply').onclick=()=>{conflicted=false;applyNeedsReview=false;if(connectionIssue==='changed')connectionIssue='';renderConnectionNotice();applyGraph();};
$('#save').onclick=async()=>{try{const r=await api('save',{});status(r.saved?t('project.saved')+(dirty?t('project.draft'):''):t('project.saveFailed'),!r.saved);}catch(e){status(e.message,true);}};
installAppliedGraphReload();

$('.toolbar').addEventListener('click',e=>{const b=e.target.closest('[data-stage]');if(!b||!graph.stages?.[b.dataset.stage])return;stage=b.dataset.stage;graphTrail=[];selection.clear();selected=null;selectedEdge=null;cancelConnection();document.querySelectorAll('.stage').forEach(x=>x.classList.toggle('active',x===b));$('#stagecaption').textContent=stage.toUpperCase()+' STAGE';render();fit();});
$('#undo').onclick=()=>undo();$('#redo').onclick=()=>undo(true);$('#fit').onclick=()=>fit();$('#search').oninput=library;
$('#adduniform').onclick=()=>newUniform();
$('#export').onclick=openExport;
installImportUI();
installSavedStateUI();
$('#code').onclick=async()=>{try{const code=await api('validate',{graph});renderGLSL((code.vertex?'// VERTEX\n'+code.vertex+'\n':'')+'// PIXEL\n'+code.pixel);$('#source').showModal();}catch(e){status(e.message,true);}};$('#closecode').onclick=()=>$('#source').close();
$('#canvas').addEventListener('wheel',e=>{e.preventDefault();const rect=$('#canvas').getBoundingClientRect();zoomCanvasAt((canvasMotion?.setting==='canvasDamping'?canvasMotion.to.scale:scale)*Math.exp(-e.deltaY*.001),(e.clientX-rect.left)/uiScaleFactor(),(e.clientY-rect.top)/uiScaleFactor());},{passive:false});
installUpgradeUI();
installGraphInteractions();
installLibraryTabs();
installInspectorPanels();installNativeSources();installCustomParameters();
installBrowserDetailResize();
installPreviewHelp();
installSidebarWidths();
installShaderNavigation();
installConnectionRecovery();
installEditorChrome();
installFooterActions();
window.addEventListener('beforeunload',e=>{if(!editorReloading&&!switchingShader&&(dirty||pendingEditorField())){e.preventDefault();e.returnValue='';}});
installSidebarVisibility();
// Resizing (including browser fullscreen) keeps the user's pan and zoom; Center fits explicitly.
window.addEventListener('resize',()=>{if(graph)wires();});
document.fonts.ready.then(()=>{if(graph)wires();});
let editorStarted=false,editorStartPromise=null;
function startEditor(){
  if(!editorStartPromise)editorStartPromise=initializeEditor().finally(()=>{editorStartPromise=null;});
  return editorStartPromise;
}
async function initializeEditor(){
  await load();
  if(editorStarted)return;editorStarted=true;
  $('#shaderpicker').disabled=false;
  startUniformSync();
  if(savedStateIssue||upgradePending)return;
  const raw=sessionStorage.getItem(draftKey);
  if(!raw)return;
  try{const draft=JSON.parse(raw);if(JSON.stringify(draft.graph)!==JSON.stringify(graph)&&confirm(t(draft.revision===revision?'draft.restoreConfirm':'draft.conflictConfirm'))){const text=JSON.stringify(draft.graph);await reviewImportFile({name:t('draft.reviewName'),size:new Blob([text]).size,text:async()=>text});}}
  catch{status(t('draft.failed'),true);}
}
initLocale().then(startEditor).catch(e=>status(e.message,true));

$('#about').onclick=()=>{closeCreator();$('#aboutdialog').showModal();};
$('#closeabout').onclick=()=>$('#aboutdialog').close();



/* Display-only GLSL tokens. Text nodes preserve source and keep code inert. */
function glslFragment(source){
  const fragment=document.createDocumentFragment();
  const keywords=new Set(('attribute const uniform varying buffer shared coherent volatile restrict readonly writeonly layout centroid flat smooth noperspective patch sample invariant precise highp mediump lowp precision in out inout subroutine if else switch case default while do for break continue return discard struct').split(' '));
  const types=/^(?:void|bool|int|uint|float|double|atomic_uint|[biud]?vec[234]|d?mat[234](?:x[234])?|[iu]?(?:sampler|image)(?:1D|2D|3D|Cube|2DRect|Buffer)(?:MS)?(?:Array)?(?:Shadow)?)$/;
  const tokens=/(?<comment>\/\/[^\r\n]*|\/\*[\s\S]*?(?:\*\/|(?![\s\S])))|(?<directive>^[\t ]*#[\t ]*[A-Za-z_]\w*)|(?<string>"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*')|(?<number>\b0[xX][\da-fA-F]+[uU]?\b|(?:\b\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?(?:[fF]|[lL][fF]|[uU])?)|(?<identifier>\b[A-Za-z_]\w*\b)/gm;
  const call=/\s*\(/y;
  let offset=0;
  for(const match of source.matchAll(tokens)){
    if(match.index>offset)fragment.append(document.createTextNode(source.slice(offset,match.index)));
    const text=match[0];let kind=Object.keys(match.groups).find(key=>match.groups[key]!==undefined);
    call.lastIndex=match.index+text.length;
    if(kind==='identifier')kind=types.test(text)?'type':keywords.has(text)?'keyword':/^(true|false)$/.test(text)?'number':text.startsWith('gl_')?'builtin':call.test(source)?'function':null;
    if(kind){const span=document.createElement('span');span.className='glsl-'+kind;span.textContent=text;fragment.append(span);}
    else fragment.append(document.createTextNode(text));
    offset=match.index+text.length;
  }
  fragment.append(document.createTextNode(source.slice(offset)));return fragment;
}
function renderGLSL(source){
  const target=$('#sourcecode');target.replaceChildren(glslFragment(source));target.scrollTop=0;target.scrollLeft=0;
}

async function setPreviewEnabled(enabled){
  autoPreview=enabled;
  try{localStorage.setItem('sgrapeAutoPreview',String(enabled));}catch{}
  showPreviewBusy();
  try{if(enabled)await preview(true);else $('#preview').disconnect?.();}
  catch(error){status(error.message,true);}
  finally{showPreviewBusy();}
}
$('#autopreview').onclick=()=>setPreviewEnabled(!autoPreview);
$('#refreshpreview').onclick=()=>setPreviewEnabled(true);
showPreviewBusy();

async function refreshProjectFile(){
  try{receiveProjectSummary(await api('shaders'));}catch{const label=$('#projectfile');if(!label.textContent)label.textContent=t('project.unavailable');}
}
refreshProjectFile();setInterval(()=>{if(!document.hidden)refreshProjectFile();},30000);


let generatedGLSLTimer=null,generatedGLSLSerial=0;
let generatedGLSLCache={key:null,state:'idle',text:''};
function generatedGLSLView(node,canvas=false){
  const box=el('div',{class:'comment-node-content generated-glsl-content'+(canvas?' comment-node-canvas-content':'')}),preview=el('div',{class:'comment-node-preview',tabindex:'0','aria-label':t('generatedGLSL.label')}),code=el('pre',{class:'generated-glsl-code comment-markdown','data-generated-glsl':node.id});
  preview.append(code);box.append(preview);
  preview.onpointerdown=e=>{e.stopPropagation();if(canvas&&!selection.has(node.id)){selectNode(node);refreshCanvasSelection();inspector();renderNavigation();}};
  preview.onclick=preview.ondblclick=e=>e.stopPropagation();preview.onkeydown=e=>e.stopPropagation();box.onwheel=e=>e.stopPropagation();
  return box;
}
function generatedGLSLKey(){return JSON.stringify([editorLoadGeneration,stage,graphContent(graph)]);}
function paintGeneratedGLSL(){
  for(const view of document.querySelectorAll('[data-generated-glsl]')){
    const cache=generatedGLSLCache,text=cache.state==='ready'?cache.text:cache.state==='error'?t('generatedGLSL.error')+'\n'+cache.text:t('generatedGLSL.loading');
    if(view.textContent!==text){const scroll=view.parentElement,top=scroll.scrollTop,left=scroll.scrollLeft;view.replaceChildren(cache.state==='ready'?glslFragment(text):document.createTextNode(text));scroll.scrollTop=top;scroll.scrollLeft=left;}
    view.dataset.state=cache.state;
  }
}
function refreshGeneratedGLSL(force=false){
  if(!graph||!document.querySelector('[data-generated-glsl]')){clearTimeout(generatedGLSLTimer);generatedGLSLSerial++;if(generatedGLSLCache.state==='loading')generatedGLSLCache={key:null,state:'idle',text:''};return;}
  const key=generatedGLSLKey();
  if(!force&&generatedGLSLCache.key===key){paintGeneratedGLSL();return;}
  clearTimeout(generatedGLSLTimer);const serial=++generatedGLSLSerial,source=clone(graph),sourceStage=stage;
  generatedGLSLCache={key,state:'loading',text:''};paintGeneratedGLSL();
  generatedGLSLTimer=setTimeout(async()=>{
    try{
      const code=await api('validate',{graph:source});
      if(serial!==generatedGLSLSerial||!graph||generatedGLSLKey()!==key)return;
      if(typeof code[sourceStage]!=='string')throw Error(t('generatedGLSL.unavailable'));
      generatedGLSLCache={key,state:'ready',text:code[sourceStage]};
    }catch(error){if(serial!==generatedGLSLSerial||!graph||generatedGLSLKey()!==key)return;generatedGLSLCache={key,state:'error',text:error.message};}
    paintGeneratedGLSL();
  },250);
}
