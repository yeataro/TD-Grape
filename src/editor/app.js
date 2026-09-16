'use strict';
const $=s=>document.querySelector(s), clone=v=>JSON.parse(JSON.stringify(v));
const shaderId=location.pathname.match(/^\/shader\/([a-f0-9]{32})\/$/)?.[1]||'';
const apiRoot='/api/'+(shaderId?shaderId+'/':'');
const draftKey='sgrapeDraft'+(shaderId?':'+shaderId:'');
const token=location.hash.slice(1)||sessionStorage.getItem('sgrapeToken')||'';
sessionStorage.setItem('sgrapeToken',token);history.replaceState(null,'',location.pathname);

const GRID=24;
const snap=value=>Math.round(value/GRID)*GRID;
let localeData=null,language='zh-Hant';
function t(key){return localeData?.messages[key]?.[language]??localeData?.messages[key]?.[localeData.defaultLanguage]??key;}
function translatePage(){document.documentElement.lang=language;document.querySelectorAll('[data-i18n]').forEach(e=>e.textContent=t(e.dataset.i18n));document.querySelectorAll('[data-i18n-placeholder]').forEach(e=>e.placeholder=t(e.dataset.i18nPlaceholder));document.querySelectorAll('[data-i18n-label]').forEach(e=>e.setAttribute('aria-label',t(e.dataset.i18nLabel)));document.querySelectorAll('[data-i18n-alt]').forEach(e=>e.alt=t(e.dataset.i18nAlt));syncSidebarButtons();workspaceLayout?.translate();renderConnectionNotice();renderHeaderVisibility();renderUIAppearance();}
async function initLocale(){localeData=await (await fetch('/locales.json')).json();language=localStorage.getItem('sgrapeLanguage')||localeData.defaultLanguage;if(!localeData.languages[language])language=localeData.defaultLanguage;const picker=$('#language');for(const [id,label]of Object.entries(localeData.languages))picker.append(el('option',{value:id},label));picker.value=language;picker.onchange=()=>{language=picker.value;localStorage.setItem('sgrapeLanguage',language);translatePage();render();renderGraphSaveState();renderSavedStateIssue();renderUpgradeNotice();renderUpgradeReview();status(upgradePending?t('upgrade.explanation'):savedStateIssue?t('saved.explanation'):t('locale.changed'),!!savedStateIssue);};translatePage();}

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
  const snapshot=['apply','validate'].includes(path)&&graph?JSON.stringify(graph):null;
  try{return await editorRequest(path,data);}
  catch(error){
    // Authentication, transport failures and revision conflicts are not GLSL errors.
    if(snapshot&&error.status===422&&!error.message.startsWith('Conflict:'))setCompileDiagnostics(error.result,snapshot);
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
  $('#connectionretry').onclick=retryConnection;
  setInterval(()=>{
    if(!document.hidden&&(connectionInterrupted||applyNeedsReview)&&!['auth','forbidden','changed'].includes(connectionIssue)&&Date.now()>=connectionRetryAt)retryConnection();
  },1000);
  window.addEventListener('online',()=>{if(connectionInterrupted)retryConnection();});
}
let compileIssues=[],compileIssueText='',compileIssueVersion=-1,compileDetailsOpen=false;
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
  compileIssues=Array.isArray(result.diagnostics)&&result.diagnostics.length?result.diagnostics:[{node:result.node,functionId:result.functionId,stage:result.stage,trail:result.trail,message:result.error}];
  errorNode=compileIssues.find(issue=>issue.node)?.node||null;render();
}
function nodeHasCompileError(id){
  return diagnosticGraphMatches()&&compileIssues.some(issue=>issue.node===id&&issue.stage===stage&&(issue.functionId||null)===(currentFunction()?.id||null));
}
function locateCompileIssue(issue){
  const location=diagnosticLocation(issue);if(!location)return;
  stage=issue.stage;graphTrail=[...location.trail];selected=location.node.id;selection=new Set([selected]);selectedEdge=null;
  cancelConnection();closeCreator();document.querySelectorAll('.stage').forEach(button=>button.classList.toggle('active',button.dataset.stage===stage));
  $('#stagecaption').textContent=stage.toUpperCase()+' STAGE';render();
  const rect=$('#canvas').getBoundingClientRect();scale=Math.max(.7,Math.min(1,scale));pan={x:rect.width/2-(location.node.ui?.x||0)*scale-100,y:rect.height/2-(location.node.ui?.y||0)*scale-65};transform();
  if(location.node.definitionUuid==='sgrape.builtin.glsl_code'&&Number.isInteger(issue.codeLine)&&issue.codeLine>0){
    inspectorTab='parameters';inspector();workspaceLayout.reveal('parameters');
    const body=$('[data-code-body]');if(body){const lines=body.value.split('\n'),index=Math.min(issue.codeLine-1,lines.length-1),start=lines.slice(0,index).reduce((n,line)=>n+line.length+1,0);body.focus();body.setSelectionRange(start,start+lines[index].length);body.scrollTop=index*parseFloat(getComputedStyle(body).lineHeight);}
  }
}
function renderCompileDiagnostics(){
  const bar=$('#diagnosticbar');if(!bar)return;
  const scroll=bar.querySelector?.('pre')?.scrollTop||0;bar.replaceChildren();bar.hidden=!compileIssues.length||!diagnosticGraphMatches();if(bar.hidden)return;
  const row=el('div',{class:'diagnostic-summary',role:'status'});row.append(el('strong',{},t('diagnostic.failed')));bar.append(row);
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

let editVersion=0,submitBusy=false,autoTimer=null,conflicted=false;
let savedGraphContent=null,lastGraphSaveKey='graph.saved';
function graphContent(document){
  const content=clone(document);delete content.catalogSnapshot;
  // Coordinates and component expansion are presentation-only. Labels and type settings may
  // affect generated GLSL, so keep them when choosing the progress message.
  for(const data of [...Object.values(content.stages),...(content.functions||[]).map(f=>f.graph)]){
    for(const node of data.nodes)if(node.ui){delete node.ui.x;delete node.ui.y;delete node.ui.componentsExpanded;if(!Object.keys(node.ui).length)delete node.ui;}
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
let nativeInputHistory=[];
function rememberNativeInputSources(declarations){nativeInputHistory=clone(declarations.filter(d=>d.kind==='uniform'&&!d.sourceMissing));}
function retainNativeInputSources(document){
  // Graph Undo removes references, not native Par entities already accepted by TD.
  for(const decl of nativeInputHistory)if(!document.declarations.some(d=>d.id===decl.id||d.name===decl.name))document.declarations.push(clone(decl));
}
function mark(){
  clearCompileDiagnostics();
  dirty=true;editVersion++;renderGraphSaveState();$('#apply').disabled=readonly||submitBusy;
  try{sessionStorage.setItem(draftKey,JSON.stringify({graph,revision}));}catch{}
  clearTimeout(autoTimer);if(!readonly&&!conflicted&&!connectionInterrupted&&!applyNeedsReview)autoTimer=setTimeout(applyGraph,650);
}
function checkpoint(){past.push(clone(graph));if(past.length>60)past.shift();future=[];}
function change(fn,{localize=true,redraw=true}={}){
  if(readonly)return false;
  const previous=clone(graph),view={trail:[...graphTrail],selection:new Set(selection),selected,selectedEdge};
  try{if(localize)prepareSemanticEdit();fn();if(graph.topSourceVersion===1)graph.topInputs.forEach((s,i)=>s.name='sTD2DInputs['+i+']');FunctionModel.ensureCapacity(graph);resolveAutoEdit(graph,previous);rejectNewConstantIssues(graph,previous);}
  catch(e){
    graph=previous;graphTrail=view.trail;selection=view.selection;selected=view.selected;selectedEdge=view.selectedEdge;
    render();status(t('edit.failed')+(e.code==='function.limit'?t('function.limit'):e.message),true);return false;
  }
  past.push(previous);if(past.length>60)past.shift();future=[];mark();if(redraw)render();return true;
}
function undo(redo=false){if(readonly)return;let from=redo?future:past,to=redo?past:future;if(!from.length)return;to.push(clone(graph));graph=from.pop();retainNativeInputSources(graph);tidyTrail();mark();render();}
async function applyGraph(){
  clearTimeout(autoTimer);autoTimer=null;if(readonly||submitBusy||!dirty)return;
  const sentVersion=editVersion,sentGraph=clone(graph),layoutOnly=!hasShaderChanges(sentGraph);
  submitBusy=true;$('#apply').disabled=true;$('#reload').disabled=true;status(t(layoutOnly?'graph.saving':'material.compiling'));
  try{
    const data=await api('apply',{graph:sentGraph,revision});
    if(data.upgradeReview){upgradePending=data.upgradeReview;conflicted=true;renderUpgradeNotice();status(t('upgrade.explanation'));return;}
    rememberNativeInputSources(data.state.graph.declarations);retainNativeInputSources(graph);
    if(data.state.graph.catalogSnapshot)graph.catalogSnapshot=clone(data.state.graph.catalogSnapshot);
    revision=data.state.revision;conflicted=false;clearCompileDiagnostics();
    const shaderUpdated=data.shaderUpdated??(data.compileInfo!=='Graph layout saved');
    rememberSavedGraph(sentGraph,shaderUpdated?'graph.applied':'graph.saved');
    if(editVersion===sentVersion){dirty=false;sessionStorage.removeItem(draftKey);}
    else {try{sessionStorage.setItem(draftKey,JSON.stringify({graph,revision}));}catch{}}
    renderGraphSaveState();$('#target').textContent=data.target;await preview().catch(()=>{});
    if(!connectionInterrupted)status(t(dirty?graphPendingKey():shaderUpdated?'material.applied':lastGraphSaveKey),false,{clearError:true});
    document.querySelectorAll('.node.error').forEach(e=>e.classList.remove('error'));
  }catch(e){conflicted=e.message.includes('Conflict:');if(e.connection){applyNeedsReview=true;renderConnectionNotice();status(e.message,true,{kind:'connection'});}else status(t(layoutOnly?'graph.saveFailed':'material.failed')+e.message,true,{kind:'compile'});}
  finally{submitBusy=false;$('#apply').disabled=readonly;$('#reload').disabled=false;refreshUniforms();if(dirty&&editVersion!==sentVersion&&!conflicted&&!connectionInterrupted&&!applyNeedsReview)autoTimer=setTimeout(applyGraph,200);}
}
function el(tag,attrs={},text=''){const e=document.createElement(tag);for(const[k,v]of Object.entries(attrs)){if(k==='class')e.className=v;else e.setAttribute(k,v);}e.textContent=text;return e;}
function field(label,control){const f=el('label',{class:'field'},label);f.append(control);return f;}
function select(options,value,onchange){const s=el('select');for(const [id,label]of options){const o=el('option',{value:id},label);s.append(o);}s.value=value;s.onchange=()=>onchange(s.value);return s;}
function input(value,cb,type='text'){
  const i=el('input',{type});i.value=value;let committed=i.value;
  const commit=()=>{if(readonly||i.numericGestureActive||i.value===committed)return;const next=type==='number'?Number(i.value):i.value;if(type==='number'&&(!i.value.trim()||!Number.isFinite(next)))return;committed=i.value;cb(next);};
  i.onchange=commit;i.onblur=commit;
  i.hasPendingEdit=()=>i.value!==committed;
  i.setSyncedValue=value=>{if(i.numericGestureActive)return;i.value=value??'';committed=i.value;};
  i.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();commit();}};
  if(type==='number'){i.step='0.05';installValueLadder(i,commit);}return i;
}
function current(){return currentFunction()?.graph||graph.stages[stage];}
function ports(n,kind){const d=definition(n);if(!d)return{};const decl=graph.declarations.find(x=>x.id===n.params.declarationId);return resolvedNodePorts(d,n.params,decl,kind);}
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
function transform(){
  // Hide intermediate grid lines at distant zoom; snapping stays in world units.
  let displayGrid=GRID;
  while(displayGrid*scale<14)displayGrid*=2;
  const step=displayGrid*scale,dot=Math.max(.45,Math.min(1.65,1.05*Math.pow(scale,.65)));
  $('#canvas').style.setProperty('--grid-dot',dot+'px');
  $('#canvas').style.setProperty('--wire-ring',3/scale+'px');
  $('#canvas').style.setProperty('--wire-glow',7/scale+'px');
  $('#canvas').dataset.gridStep=displayGrid;
  $('#canvas').style.backgroundSize=step+'px '+step+'px';$('#canvas').style.backgroundPosition=(pan.x-step/2)+'px '+(pan.y-step/2)+'px';$('#world').style.transform=`translate(${pan.x}px,${pan.y}px) scale(${scale})`;$('#zoom').textContent=Math.round(scale*100)+'%';wireGesture?.refresh?.();}
function wires(){const svg=$('#wires');svg.replaceChildren();current().edges.forEach((edge,index)=>{const a=current().nodes.find(n=>n.id===edge.from[0]),b=current().nodes.find(n=>n.id===edge.to[0]);if(!a||!b)return;const p=point(a,edge.from[1],'outputs'),q=point(b,edge.to[1],'inputs');if(!p||!q)return;const dx=Math.max(70,Math.abs(q.x-p.x)*.5);const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',`M ${p.x} ${p.y} C ${p.x+dx} ${p.y}, ${q.x-dx} ${q.y}, ${q.x} ${q.y}`);path.dataset.from=edge.from.join(':');path.dataset.to=edge.to.join(':');path.setAttribute('data-type',ports(a,'outputs')[edge.from[1]]||'');applyPortColorHint(path,a,'outputs',edge.from[1]);if(selectedEdge===index)path.classList.add('selected');path.onpointerdown=e=>dragExistingWire(path,e,index);path.onclick=e=>{e.stopPropagation();if(suppressWireClick)return;selectedEdge=index;selected=null;selection.clear();render();};svg.append(path);});drawWireDrag(svg);paintTrashHighlights();}
function library(){renderLibrary();}
function render(){renderCompileDiagnostics();
  if(!graph)return;if(!graph.stages?.[stage])stage='pixel';
  document.querySelectorAll('[data-stage]').forEach(b=>{b.hidden=!graph.stages?.[b.dataset.stage];b.classList.toggle('active',b.dataset.stage===stage);});
  $('#stagecaption').textContent=stage.toUpperCase()+' STAGE';
  $('#previewtitle').dataset.i18n=editorTarget==='top'?'preview.top':'preview.material';$('#previewtitle').textContent=t($('#previewtitle').dataset.i18n);renderPreviewAppearance();
  tidyTrail();renderCards();wires();inspector();library();declarations();renderNativeSources();transform();renderNavigation();renderSavedStateIssue();
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
async function openShaderMenu(last=false){
  const request=++shaderMenuRequest,menu=$('#shaderchoices');menu.hidden=false;$('#shaderpicker').setAttribute('aria-expanded','true');menu.replaceChildren(el('p',{class:'muted'},t('switch.loading')));
  try{
    const data=await api('shaders');if(request!==shaderMenuRequest)return;
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
  if(submitBusy||uniformPending.size||nativeSourceBusy){status(t('switch.busy'));return;}
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
    if(!shaderChoice||submitBusy||uniformPending.size||nativeSourceBusy)return;
    try{
      const draft=JSON.stringify({graph,revision});sessionStorage.setItem(draftKey,draft);
      if(sessionStorage.getItem(draftKey)!==draft)throw Error('Draft not retained');
      const row=shaderChoice;closeShaderSwitch(false);leaveForShader(row);
    }catch{$('#switchstatus').textContent=t('switch.storageFailed');}
  };
  $('#switchapply').onclick=async()=>{
    const row=shaderChoice;if(!row||submitBusy||uniformPending.size||nativeSourceBusy)return;
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
  const rect=$('#previewpath').getBoundingClientRect(),width=Math.min(360,innerWidth-24),top=Math.min(rect.bottom+4,innerHeight-100);
  Object.assign(event.target.style,{left:Math.max(12,Math.min(rect.left,innerWidth-width-12))+'px',top:Math.max(12,top)+'px',width:width+'px',maxHeight:Math.min(240,innerHeight-top-12)+'px'});
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

function fit(){if(!graph)return;const ns=current().nodes;if(!ns.length)return;const minX=Math.min(...ns.map(n=>n.ui?.x||0)),minY=Math.min(...ns.map(n=>n.ui?.y||0)),maxX=Math.max(...ns.map(n=>(n.ui?.x||0)+190)),maxY=Math.max(...ns.map(n=>(n.ui?.y||0)+180));scale=Math.min(1,($('#canvas').clientWidth-100)/(maxX-minX),($('#canvas').clientHeight-140)/(maxY-minY));scale=Math.max(.25,scale);pan={x:($('#canvas').clientWidth-(maxX-minX)*scale)/2-minX*scale,y:($('#canvas').clientHeight-(maxY-minY)*scale)/2-minY*scale};transform();}
async function load(){const data=await api('state');applyNeedsReview=false;connectionIssue='';renderConnectionNotice();setTypeContract(data.typeContract);const filter=$('#createtype');filter.replaceChildren(el('option',{value:'all','data-i18n':'create.allTypes'},t('create.allTypes')),...interfaceTypes().map(type=>el('option',{value:type},type)));upgradePending=data.upgradeReview||null;closeUpgradeReview();savedStateIssue=data.savedStateIssue||null;editorTarget=data.shaderKind||data.state?.graph?.target||'mat';graph=savedStateIssue?{schemaVersion:1,target:editorTarget,declarations:[],functions:[],stages:{...(editorTarget==='mat'?{vertex:{nodes:[],edges:[]}}:{}),pixel:{nodes:[],edges:[]}}}:clone(data.state.graph);editorReadOnlyReason=data.readOnlyReason||'';catalog=data.catalog;examples=data.examples;functionLibrary=data.functionLibrary||[];personalLibrary=data.personalLibrary||{items:[],issues:[],folder:''};graphTrail=[];selection.clear();conflicted=false;revision=data.state?.revision??0;dirty=false;nativeInputHistory=[];nativeSourceSnapshot=null;customSnapshot=null;customError='';customRetryAt=0;$('#customcontrols').dataset.structure='';$('#nativeuniforms').dataset.sourceStructure='';readonly=!!savedStateIssue||!!upgradePending||!!data.readOnlyReason||graph.schemaVersion!==1;past=[];future=[];selected=null;selectedInputId=null;clearCompileDiagnostics();rememberSavedGraph(graph);renderGraphSaveState();$('#target').textContent=data.target;$('#apply').disabled=readonly;render();renderUpgradeNotice();fit();await preview().catch(()=>{});status(upgradePending?t('upgrade.explanation'):savedStateIssue?t('saved.explanation'):data.readOnlyReason||t('connection.ready'),readonly,{clearError:true});if(!savedStateIssue&&$('#savedreview').open)$('#savedreview').close();}

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
  if(submitBusy||uniformPending.size||nativeSourceBusy||customBusy||exportBusy||personalBusy||pendingEditorWrites){status(t('editorReload.busy'));return false;}
  if(dirty){
    try{
      const draft=JSON.stringify({graph,revision});sessionStorage.setItem(draftKey,draft);
      if(sessionStorage.getItem(draftKey)!==draft)throw Error('Draft not retained');
    }catch{status(t('editorReload.storageFailed'),true,{kind:'reload'});return false;}
    if(!confirm(t('editorReload.keepDraft')))return false;
  }
  clearTimeout(autoTimer);autoTimer=null;editorReloading=true;location.reload();return true;
}
const appearanceStorageKey='sgrapeAppearanceV1';
function parseUIAppearance(raw){
  let saved;try{saved=JSON.parse(raw);}catch{}
  return{size:saved?.size==='comfortable'?'comfortable':'standard',theme:saved?.theme==='light'?'light':'dark'};
}
let uiAppearance=parseUIAppearance(null);
function renderUIAppearance(){
  const root=document.documentElement,{size,theme}=uiAppearance;
  root.dataset.uiSize=size;root.dataset.uiTheme=theme;
  for(const [id,key,value,pressed]of [['uisize','size',size,size==='comfortable'],['uitheme','theme',theme,theme==='light']]){
    const button=$('#'+id);if(!button)continue;
    const label=t('appearance.'+key+'.'+value);
    button.title=label;button.setAttribute('aria-label',label);button.setAttribute('aria-pressed',String(pressed));
  }
  $('#uitheme .theme-moon').toggleAttribute('hidden',theme!=='dark');$('#uitheme .theme-sun').toggleAttribute('hidden',theme!=='light');
  $('meta[name="theme-color"]').content=theme==='light'?'#f2f1f6':'#19181f';
}
function setUIAppearance(key,value){
  if(!((key==='size'&&['standard','comfortable'].includes(value))||(key==='theme'&&['dark','light'].includes(value))))return;
  uiAppearance={...uiAppearance,[key]:value};
  try{localStorage.setItem(appearanceStorageKey,JSON.stringify(uiAppearance));}catch{}
  renderUIAppearance();
  // A display preference does not redraw the graph, change its zoom or apply a Shader.
  if(graph)requestAnimationFrame(wires);
}
function installUIAppearance(){
  try{uiAppearance=parseUIAppearance(localStorage.getItem(appearanceStorageKey));}catch{}
  renderUIAppearance();
  $('#uisize').onclick=()=>setUIAppearance('size',uiAppearance.size==='standard'?'comfortable':'standard');
  $('#uitheme').onclick=()=>setUIAppearance('theme',uiAppearance.theme==='dark'?'light':'dark');
}
function installEditorChrome(){
  installUIAppearance();
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
$('#canvas').addEventListener('dragover',e=>{if(Array.from(e.dataTransfer.types).includes('application/x-sgrape-node')){e.preventDefault();e.dataTransfer.dropEffect='copy';}});
$('#canvas').addEventListener('drop',e=>{const key=e.dataTransfer.getData('application/x-sgrape-node'),d=availableEntries().find(d=>browserEntryKey(d)===key||(key==='vector'&&d.key==='vector'&&d.presetType==='vec2'));$('#canvas').classList.remove('drop-ready');if(!d||!d.stages.includes(stage)||readonly)return;e.preventDefault();const rect=$('#canvas').getBoundingClientRect();if(addNode(d,(e.clientX-rect.left-pan.x)/scale-95,(e.clientY-rect.top-pan.y)/scale-18))status(t('node.added')+d.label);});

$('#apply').onclick=()=>{conflicted=false;applyNeedsReview=false;if(connectionIssue==='changed')connectionIssue='';renderConnectionNotice();applyGraph();};
$('#save').onclick=async()=>{try{const r=await api('save',{});status(r.saved?t('project.saved')+(dirty?t('project.draft'):''):t('project.saveFailed'),!r.saved);}catch(e){status(e.message,true);}};
$('#reload').onclick=()=>{if(dirty&&!confirm(t('graph.reloadConfirm')))return;load().catch(e=>status(e.message,true));};

$('.toolbar').addEventListener('click',e=>{const b=e.target.closest('[data-stage]');if(!b||!graph.stages?.[b.dataset.stage])return;stage=b.dataset.stage;graphTrail=[];selection.clear();selected=null;selectedEdge=null;cancelConnection();document.querySelectorAll('.stage').forEach(x=>x.classList.toggle('active',x===b));$('#stagecaption').textContent=stage.toUpperCase()+' STAGE';render();fit();});
$('#undo').onclick=()=>undo();$('#redo').onclick=()=>undo(true);$('#fit').onclick=fit;$('#search').oninput=library;
$('#adduniform').onclick=()=>newUniform();
$('#export').onclick=openExport;
installImportUI();
installSavedStateUI();
$('#code').onclick=async()=>{try{const code=await api('validate',{graph});renderGLSL((code.vertex?'// VERTEX\n'+code.vertex+'\n':'')+'// PIXEL\n'+code.pixel);$('#source').showModal();}catch(e){status(e.message,true);}};$('#closecode').onclick=()=>$('#source').close();
$('#canvas').addEventListener('wheel',e=>{e.preventDefault();const rect=$('#canvas').getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top,old=scale;scale=Math.max(.25,Math.min(1.7,scale*Math.exp(-e.deltaY*.001)));pan={x:x-(x-pan.x)*scale/old,y:y-(y-pan.y)*scale/old};transform();},{passive:false});
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
window.addEventListener('beforeunload',e=>{if(!editorReloading&&!switchingShader&&(dirty||pendingEditorField())){e.preventDefault();e.returnValue='';}});
installSidebarVisibility();
window.addEventListener('resize',()=>{fit();if(graph)wires();});
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
function renderGLSL(source){
  const target=$('#sourcecode'),fragment=document.createDocumentFragment();
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
  fragment.append(document.createTextNode(source.slice(offset)));target.replaceChildren(fragment);target.scrollTop=0;target.scrollLeft=0;
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
  try{const result=await api('shaders');const label=$('#projectfile');label.textContent=result.projectFile||t('project.unsaved');label.title=label.textContent;}catch{const label=$('#projectfile');if(!label.textContent)label.textContent=t('project.unavailable');}
}
refreshProjectFile();setInterval(()=>{if(!document.hidden)refreshProjectFile();},30000);
