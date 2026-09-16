/* Node Parameter card. All explanatory content and labels live in locales.json. */
let valueLadder=null,pendingValueLadder=null;
function cancelValueLadder(){pendingValueLadder?.cancel();valueLadder?.cancel();}
function installValueLadder(entry,commit){
  entry.title=t('ladder.hint');
  entry.addEventListener('mousedown',e=>{if(e.button===1)e.preventDefault();});
  entry.addEventListener('auxclick',e=>{if(e.button===1)e.preventDefault();});
  function beginLadder(e){
    const button=e.button,mask=button===1?4:button===2?2:1;
    e.preventDefault();e.stopPropagation();cancelValueLadder();
    const writable=()=>entry.isConnected&&!entry.disabled&&!entry.readOnly&&!readonly;
    if(!writable()||!entry.value.trim()||!Number.isFinite(Number(entry.value)))return;
    entry.focus({preventScroll:true});if(!writable())return;
    const initial=entry.value,initialValue=Number(initial),steps=[100,10,1,.1,.01,.001];
    const popup=el('div',{id:'valueladder',role:'tooltip'}),heading=el('strong',{},'Value Ladder'),rows=el('div',{class:'ladder-rows'}),output=el('output'),hint=el('small',{},t('ladder.release'));
    for(const step of steps)rows.append(el('div',{'data-step':step},String(step)));
    popup.append(heading,rows,output,hint);document.body.append(popup);
    const rowHeight=rows.firstChild.getBoundingClientRect().height,offset=rows.offsetTop;
    popup.style.left=Math.max(8,Math.min(entry.getBoundingClientRect().left-popup.offsetWidth-10,innerWidth-popup.offsetWidth-8))+'px';
    popup.style.top=Math.max(8,Math.min(e.clientY-offset-3.5*rowHeight,innerHeight-popup.offsetHeight-8))+'px';
    const rowsTop=rows.getBoundingClientRect().top,indexAt=y=>Math.max(0,Math.min(steps.length-1,Math.floor((y-rowsTop)/rowHeight)));
    let index=indexAt(e.clientY),anchorX=e.clientX,base=initialValue,value=initialValue,finished=false;
    const oldDescription=entry.getAttribute('aria-describedby');entry.setAttribute('aria-describedby','valueladder');entry.numericGestureActive=true;
    document.body.classList.add('scrubbing-value');entry.classList.add('scrubbing');
    const paint=()=>{[...rows.children].forEach((row,i)=>row.classList.toggle('active',i===index));output.value=String(value);};paint();
    const controller=new AbortController(),options={capture:true,signal:controller.signal};
    const observer=new MutationObserver(()=>{if(!writable()||!entry.getClientRects().length)finish(false);});
    function finish(accept){
      if(finished)return;finished=true;controller.abort();observer.disconnect();valueLadder=null;if(button===2||e.pointerType==='touch')suppressContextUntil=performance.now()+400;
      const allowed=accept&&writable();entry.value=allowed?String(value):initial;entry.numericGestureActive=false;
      popup.remove();document.body.classList.remove('scrubbing-value');entry.classList.remove('scrubbing');
      if(oldDescription===null)entry.removeAttribute('aria-describedby');else entry.setAttribute('aria-describedby',oldDescription);
      if(entry.hasPointerCapture(e.pointerId))entry.releasePointerCapture(e.pointerId);
      // Graph defaults use the existing single checkpoint; live Uniforms use their CAS write.
      if(allowed&&value!==initialValue)commit();
    }
    function move(ev){
      if(ev.pointerId!==e.pointerId)return;
      if(!(ev.buttons&mask)||!writable()){finish(false);return;}
      ev.preventDefault();ev.stopPropagation();
      const next=indexAt(ev.clientY);
      if(next!==index){index=next;base=value;anchorX=ev.clientX;paint();return;}
      const ticks=Math.trunc((ev.clientX-anchorX)/8),candidate=base+ticks*steps[index];
      if(!Number.isFinite(candidate))return;
      value=ticks?Number(candidate.toPrecision(15)):base;
      if(entry.min!==''&&Number.isFinite(Number(entry.min)))value=Math.max(Number(entry.min),value);
      if(entry.max!==''&&Number.isFinite(Number(entry.max)))value=Math.min(Number(entry.max),value);
      entry.value=String(value);paint();
    }
    valueLadder={entry,cancel:()=>finish(false)};
    window.addEventListener('pointermove',move,options);
    window.addEventListener('pointerup',ev=>{if(ev.pointerId===e.pointerId&&ev.button===button){ev.preventDefault();ev.stopPropagation();finish(true);}},options);
    window.addEventListener('pointercancel',ev=>{if(ev.pointerId===e.pointerId)finish(false);},options);
    window.addEventListener('pointerdown',()=>finish(false),options);
    entry.addEventListener('lostpointercapture',()=>finish(false),options);
    entry.addEventListener('blur',()=>finish(false),options);
    window.addEventListener('blur',()=>finish(false),options);
    window.addEventListener('resize',()=>finish(false),options);
    document.addEventListener('scroll',ev=>{if(ev.target.contains?.(entry))finish(false);},options);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)finish(false);},options);
    window.addEventListener('keydown',ev=>{if(ev.key==='Escape'){ev.preventDefault();ev.stopImmediatePropagation();finish(false);}else if(ev.key==='Tab')finish(false);else {ev.preventDefault();ev.stopImmediatePropagation();}},options);
    window.addEventListener('contextmenu',ev=>{ev.preventDefault();ev.stopPropagation();},options);
    observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','readonly','hidden']});
    try{entry.setPointerCapture(e.pointerId);}catch{finish(false);}
  }
  let suppressContextUntil=0;
  entry.addEventListener('contextmenu',e=>{if(performance.now()<suppressContextUntil){e.preventDefault();e.stopPropagation();}});
  entry.addEventListener('pointerdown',e=>{
    const touch=e.pointerType==='touch';
    if(!touch&&(e.button===1||(e.button===2&&e.altKey))){suppressContextUntil=performance.now()+1200;beginLadder(e);return;}
    if(e.button!==0||e.ctrlKey||e.metaKey||e.altKey||entry.disabled||entry.readOnly||readonly)return;
    cancelValueLadder();
    if(touch){e.preventDefault();e.stopPropagation();}
    const controller=new AbortController(),options={capture:true,signal:controller.signal},scroller=entry.closest('.panel-scroll'),inlineCanvas=touch&&entry.closest('#canvas');
    const sx=e.clientX,sy=e.clientY,scrollTop=scroller?.scrollTop||0,initialPan=inlineCanvas?{...pan}:null;let moved=false,done=false,timer;
    const cleanup=()=>{if(done)return;done=true;clearTimeout(timer);controller.abort();if(pendingValueLadder?.entry===entry)pendingValueLadder=null;};
    pendingValueLadder={entry,cancel:cleanup};
    timer=setTimeout(()=>{cleanup();if(!entry.isConnected||entry.disabled||entry.readOnly||!entry.getClientRects().length)return;beginLadder(e);},450);
    window.addEventListener('pointermove',ev=>{if(ev.pointerId!==e.pointerId)return;
      if(Math.hypot(ev.clientX-sx,ev.clientY-sy)>8){moved=true;clearTimeout(timer);if(!touch){cleanup();return;}}
      if(touch){ev.preventDefault();ev.stopPropagation();if(moved&&scroller)scroller.scrollTop=scrollTop-(ev.clientY-sy);
        else if(moved&&inlineCanvas){pan={x:initialPan.x+ev.clientX-sx,y:initialPan.y+ev.clientY-sy};transform();}}
    },options);
    window.addEventListener('pointerup',ev=>{if(ev.pointerId!==e.pointerId)return;cleanup();if(touch){ev.preventDefault();ev.stopPropagation();if(!moved)entry.focus();}},options);
    window.addEventListener('pointercancel',cleanup,options);window.addEventListener('pointerdown',cleanup,options);window.addEventListener('blur',cleanup,options);
    window.addEventListener('keydown',cleanup,options);document.addEventListener('visibilitychange',()=>{if(document.hidden)cleanup();},options);
  });
}

let workspaceLayout=null;
function installInspectorPanels(){workspaceLayout=installPanelWorkspace();}
let inspectorTab='parameters',inspectorScope='node';
let uniformSnapshot={revision:-1,uniforms:{}},uniformPolling=false,uniformSyncError='',uniformPreviewSignature='';
const liveParameterRow=id=>uniformSnapshot.uniforms[id]||uniformSnapshot.textures?.[id];
let uniformWrites=Promise.resolve();
let uniformGeneration=0;
const uniformPending=new Map(),uniformReadbacks=new Set();

function updateUniformFields(forceKeys=new Set()){
  for(const section of document.querySelectorAll('.uniform-live')){
    const id=section.dataset.declaration,row=liveParameterRow(id);
    const ready=!!row&&uniformSnapshot.revision===revision&&!dirty&&!submitBusy;
    for(const entry of section.querySelectorAll('input[data-component]')){
      const index=Number(entry.dataset.component),item=row?.components[index],key=id+':'+index,pending=uniformPending.has(key);
      entry.disabled=readonly||!ready||!item?.writable||pending||uniformReadbacks.has(key);
      if(item&&(document.activeElement!==entry||forceKeys.has(key))&&!pending){
        entry.setSyncedValue(item.value);
        entry.uniformExpected={revision:uniformSnapshot.revision,...item};
      }
      if(item&&!entry.uniformExpected)entry.uniformExpected={revision:uniformSnapshot.revision,...item};
      entry.closest('.field').querySelector('.uniform-mode').textContent=item?.mode&&item.mode!=='CONSTANT'?item.mode:'';
    }
    const driven=row?.components.some(c=>!c.writable),message=section.querySelector('.uniform-sync-state');
    message.textContent=uniformSyncError||(!ready?t(!row&&uniformSnapshot.revision===revision&&!dirty&&!submitBusy?'parameter.unused':'uniform.waiting'):row.type==='sampler2D'?(row.sourceStatus==='connected'&&!row.defaultValid?t('texture.backupInvalid'):row.sourceStatus==='invalid'||!row.defaultValid?t('texture.invalid'):row.sourceStatus==='connected'?t('texture.connected'):driven?t('uniform.driven'):t('uniform.synced')):driven?t('uniform.driven'):t('uniform.synced'));
    const source=section.querySelector('.texture-effective');if(source)source.textContent=row?.effectiveSource?t('texture.effective')+' · '+(textureOptions().find(([value])=>value===row.effectiveSource)?.[1]||row.effectiveSource):'';
    message.classList.toggle('error',!!uniformSyncError||row?.sourceStatus==='invalid'||row?.defaultValid===false);
  }
}

async function refreshUniforms(){
  if(!graph||(typeof savedStateIssue!=='undefined'&&savedStateIssue)||uniformPolling||uniformPending.size||document.hidden)return;
  const visible=el=>el&&el.getClientRects().length>0&&!el.closest('details:not([open])');
  if(!visible($('.uniform-live'))&&(!autoPreview||!visible($('#preview'))))return;
  uniformPolling=true;
  const generation=uniformGeneration;
  try{
    const incoming=await api('uniforms');
    if(generation!==uniformGeneration)return;
    uniformSnapshot=incoming;uniformSyncError=incoming.revision!==revision&&!dirty&&!submitBusy?t('uniform.graphChanged'):'';
    const recovered=new Set(uniformReadbacks);uniformReadbacks.clear();updateUniformFields(recovered);
    const signature=JSON.stringify([Object.fromEntries(Object.entries(uniformSnapshot.uniforms).map(([id,row])=>[id,row.components.map(c=>c.value)])),uniformSnapshot.textures]);
    if(autoPreview&&(signature!==uniformPreviewSignature||(editorTarget==='top'&&performance.now()-lastPreviewAt>=1000))&&visible($('#preview'))){uniformPreviewSignature=signature;await preview();}
  }catch(e){uniformSyncError=t('uniform.offline');updateUniformFields();}
  finally{uniformPolling=false;}
}

function startUniformSync(){
  const tick=async()=>{await refreshUniforms();setTimeout(tick,500);};tick();
}

function writeUniformInput(entry,value){
  const id=entry.closest('.uniform-live').dataset.declaration,index=Number(entry.dataset.component),key=id+':'+index;
  if(uniformPending.has(key)||uniformReadbacks.has(key))return;
  uniformGeneration++;uniformPending.set(key,1);updateUniformFields();
  uniformWrites=uniformWrites.then(async()=>{
    try{
      const expected=entry.uniformExpected;
      if(!expected)throw Error(t('uniform.waiting'));
      uniformSnapshot=await api('uniform-value',{declarationId:id,component:index,value,revision:expected.revision,expected});
      const item=liveParameterRow(id)?.components[index];
      if(item){entry.setSyncedValue(item.value);entry.uniformExpected={revision:uniformSnapshot.revision,...item};}
      uniformSyncError='';status(t(entry.dataset.texture?'texture.updated':'uniform.updated'));await preview();
    }catch(e){
      // A rejected write must read TD back before this field can accept another edit.
      uniformReadbacks.add(key);entry.uniformExpected=null;uniformSyncError=e.message;status(e.message,true);
    }
    finally{
      const remaining=uniformPending.get(key)-1;
      if(remaining)uniformPending.set(key,remaining);else uniformPending.delete(key);
      updateUniformFields();if(uniformReadbacks.size)refreshUniforms();
    }
  });
}

function liveUniformFields(decl){
  const section=el('section',{class:'uniform-live','data-declaration':decl.id});
  const texture=decl.kind==='sampler';section.append(el('h4',{},t(texture?'texture.current':'uniform.current')));
  const components=texture?['']:Array.isArray(decl.value)?decl.value:[decl.value],box=el('div',{class:'components'+(components.length===1?' scalar':'')});
  box.style.setProperty('--component-count',components.length);
  components.forEach((value,index)=>{
    const entry=input('',next=>writeUniformInput(entry,next),texture?'text':'number');if(texture){entry.dataset.texture='true';entry.placeholder=t('texture.currentEmpty');}
    entry.dataset.component=index;entry.disabled=true;
    entry.setAttribute('aria-label',t(texture?'texture.current':'uniform.current')+(components.length===1?'':' '+'XYZW'[index]));
    const row=field('',entry);row.prepend(el('span',{class:'component-label','aria-hidden':'true'},components.length===1?decl.type:'XYZW'[index]));
    row.append(el('small',{class:'uniform-mode'}));box.append(row);
  });
  section.append(box,el('p',{class:'muted uniform-sync-state'},t('uniform.waiting')));if(texture)section.append(el('p',{class:'muted texture-effective'}));return section;
}

function defaultInput(n,port,type){
  if(isResourceType(type))return null;
  if(n.inputValues && Object.hasOwn(n.inputValues,port))return clone(n.inputValues[port]);
  const key=definition(n)?.key;
  if(['combine','vector'].includes(key)&&port!=='value'){const start='xyzw'.indexOf(port),values=(n.params.components||[0,0,0,0]).slice(start,start+typeComponents(type));return type==='float'?values[0]:values;}
  if(key==='vector'&&port==='value')return null;
  if(key==='function_call')return clone(FunctionModel.find(graph,n.params.functionId)?.inputs.find(p=>p.id===port)?.default??0);
  if(key==='function_output')return clone(currentFunction()?.outputs.find(p=>p.id===port)?.default??0);
  if(['texture','texture_sample'].includes(key)&&port==='uv')return null;
  if(key==='pixel_out'&&editorTarget==='mat')return [0,0,0,0];
  if(key==='pixel_out'||key==='vertex_out')return [0,0,0,1];
  const value=definition(n)?.inputDefaults?.[port]??(port==='factor'?.5:port==='alpha'?1:0);
  return filledValue(type,value);
}

function setPixelBufferCount(n,count){
  const spec=typeContract?.pixelBufferOutputs;
  if(readonly||editorTarget!=='mat'||definition(n)?.key!=='pixel_out'||!spec||!Number.isInteger(count)||count<1||count>spec.ports.length)return false;
  return change(()=>{
    const removed=spec.ports.slice(count);
    if(current().edges.some(e=>e.to[0]===n.id&&removed.includes(e.to[1])))throw Error(t('pixel.buffersConnected'));
    n.ui||={};const cache=n.ui.bufferInputValues||={};
    for(const port of removed)if(Object.hasOwn(n.inputValues||{},port)){cache[port]=clone(n.inputValues[port]);delete n.inputValues[port];}
    for(const port of spec.ports.slice(0,count))if(Object.hasOwn(cache,port)&&!Object.hasOwn(n.inputValues||{},port)){n.inputValues||={};n.inputValues[port]=clone(cache[port]);}
    n.params.bufferCount=count;
  });
}
function pixelBufferFields(box,n){
  if(editorTarget!=='mat'||definition(n)?.key!=='pixel_out'||!typeContract?.pixelBufferOutputs)return;
  const entry=select(typeContract.pixelBufferOutputs.ports.map((_,i)=>[String(i+1),String(i+1)]),String(n.params.bufferCount??1),value=>setPixelBufferCount(n,Number(value)));
  entry.dataset.pixelBufferCount=n.id;entry.disabled=readonly;
  entry.title=t('pixel.buffersHint');box.append(field(t('pixel.bufferCount'),entry));
}

function pixelBufferNames(box,n){
  if(editorTarget!=='mat'||definition(n)?.key!=='pixel_out'||!typeContract?.pixelBufferOutputs)return;
  const group=el('div',{class:'buffer-names'});
  for(const [index,port]of typeContract.pixelBufferOutputs.ports.slice(0,n.params.bufferCount??1).entries()){
    const entry=input(n.ui?.bufferLabels?.[port]||'',value=>{
      const label=value.trim();if(label.length>80||/[\x00-\x1f\x7f]/.test(label)){status(t('node.labelInvalid'),true);return;}
      change(()=>{n.ui||={};n.ui.bufferLabels||={};if(label)n.ui.bufferLabels[port]=label;else delete n.ui.bufferLabels[port];},{localize:false});
    });entry.placeholder='Buffer '+index;entry.maxLength=80;entry.dataset.bufferLabel=port;entry.disabled=readonly;
    group.append(field('Buffer '+index,entry));
  }
  box.append(group);
}

function numbers(value,label,callback,disabled=false,labels='XYZW'){
  const values=Array.isArray(value)?value:[value],box=el('div',{class:'components'+(values.length===1?' scalar':'')});
  box.style.setProperty('--component-count',values.length);
  values.forEach((v,index)=>{
    const entry=input(v,next=>{
      if(!Number.isFinite(next))return;
      const updated=values.slice();updated[index]=next;
      callback(Array.isArray(value)?updated:next);
    },'number');
    entry.setAttribute('aria-label',label+(values.length>1?' '+labels[index]:''));
    entry.disabled=disabled||readonly;
    const row=field('',entry);row.prepend(el('span',{class:'component-label','aria-hidden':'true'},values.length>1?labels[index]:label));box.append(row);
  });
  return box;
}

function colorDisplay(value){
  const clamp=value=>Math.max(0,Math.min(1,Number.isFinite(value)?value:0));
  const rgb=value.slice(0,3).map(v=>Math.round(clamp(v)*255));
  return {css:`rgba(${rgb.join(',')},${clamp(value[3]??1)})`,hex:'#'+rgb.map(v=>v.toString(16).padStart(2,'0')).join('')};
}
function colorSwatch(value){
  const swatch=el('span',{class:'color-swatch','aria-hidden':'true'}),ink=el('span',{class:'color-ink'});
  ink.style.backgroundColor=colorDisplay(value).css;swatch.append(ink);return swatch;
}
function colorFields(value,label,callback,disabled=false){
  const box=el('div',{class:'color-parameter'}),row=el('div',{class:'color-picker-row'}),display=colorDisplay(value),swatch=colorSwatch(value);
  const picker=el('input',{type:'color',value:display.hex,'aria-label':t('color.choose')});picker.disabled=readonly||disabled;
  picker.onchange=()=>{
    if(readonly||disabled||picker.value===display.hex||!/^#[0-9a-f]{6}$/i.test(picker.value))return;
    const rgb=[1,3,5].map(i=>parseInt(picker.value.slice(i,i+2),16)/255);
    callback([...rgb,value[3]]);
  };
  swatch.append(picker);row.append(swatch,el('span',{},t('color.choose')));box.append(row,numbers(value,label,callback,disabled,'RGBA'));
  if(value.some(v=>v<0||v>1))box.append(el('small',{class:'muted color-range-hint'},t('color.range')));
  return box;
}
function nodeLabel(n){return typeof n?.ui?.label==='string'&&n.ui.label.length<=80&&!/[\x00-\x1f\x7f]/.test(n.ui.label)?n.ui.label:'';}
function setNodeLabel(n,value){
  const label=value.trim();
  if(label.length>80||/[\x00-\x1f\x7f]/.test(label)){status(t('node.labelInvalid'),true);return false;}
  if(label===nodeLabel(n))return true;
  return change(()=>{n.ui||={x:0,y:0};if(label)n.ui.label=label;else delete n.ui.label;},{localize:false});
}
function nodeLabelField(n){
  const entry=input(nodeLabel(n),value=>{if(!setNodeLabel(n,value))entry.setSyncedValue(nodeLabel(n));});
  entry.dataset.nodeLabel=n.id;entry.maxLength=80;entry.placeholder=definition(n)?.label||'';entry.disabled=readonly;
  const previous=entry.onkeydown;entry.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();entry.setSyncedValue(nodeLabel(n));entry.blur();}else previous(e);};
  return field(t('node.label'),entry);
}
function nodeInspectorTitle(n,d){
  const title=el('div',{class:'node-inspector-title','data-category':nodeCategory(d||{key:''})});
  const name=el('h3',{class:'node-inspector-name'},d?.label||t('node.unknown'));
  name.title=name.textContent;title.append(name);
  if(d){
    const label=nodeLabelField(n),entry=label.querySelector('input');
    label.classList.add('node-inspector-label');
    label.replaceChildren(el('span',{class:'sr-only'},t('node.label')),entry);
    entry.placeholder=t('node.label');entry.title=t('node.label');
    title.append(label);
  }
  return title;
}
function focusNodeLabel(n){
  selectNode(n);inspectorScope='node';inspector();
  const entry=$('[data-node-label]');entry?.focus();entry?.select();
}
function nodeComment(n){return typeof n?.ui?.comment==='string'?n.ui.comment:'';}
function setNodeComment(n,value){
  const comment=value.replace(/\r\n?/g,'\n');
  if(comment.length>2000||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(comment)){status(t('node.commentInvalid'),true);return false;}
  if(comment===nodeComment(n))return true;
  return change(()=>{n.ui||={};if(comment)n.ui.comment=comment;else delete n.ui.comment;},{localize:false});
}
function nodeCommentField(n){
  const section=el('details',{class:'node-comment-field'});section.open=!!nodeComment(n);
  section.append(el('summary',{},t('node.comment')));
  const entry=el('textarea',{'data-node-comment':n.id,rows:3,maxlength:2000,'aria-label':t('node.comment')});entry.value=nodeComment(n);entry.disabled=readonly;
  let committed=entry.value;
  const commit=()=>{if(readonly||entry.value===committed)return;const value=entry.value;committed=value;if(!setNodeComment(n,value)){entry.value=nodeComment(n);committed=entry.value;}};
  entry.onchange=commit;entry.onblur=commit;
  entry.onkeydown=e=>{
    if(e.key==='Escape'){e.preventDefault();e.stopPropagation();entry.value=nodeComment(n);committed=entry.value;entry.blur();}
    else if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();commit();}
  };
  section.append(entry,el('small',{class:'muted'},t('node.commentHint')));return section;
}

function setDeclarationExposed(decl,value){
  const n=current().nodes.find(n=>n.id===selected&&n.params?.declarationId===decl.id);
  if(value&&!decl.expose&&!Object.hasOwn(decl,'exposeName')&&nodeLabel(n))decl.exposeName=nodeLabel(n);
  decl.expose=value;
}

function toggle(label,value,callback){
  const check=el('input',{type:'checkbox'});check.checked=!!value;check.disabled=readonly;
  check.onchange=()=>callback(check.checked);
  const row=el('label',{class:'toggle-field'});row.append(check,el('span',{},label));return row;
}

function markdown(text){
  // Small Markdown subset; text is always DOM text, never executable HTML.
  const root=el('div',{class:'help-markdown'});
  for(const paragraph of text.split(/\n\s*\n/)){
    const block=el('p');let start=0;
    const tokens=/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)|`([^`]+)`|\*\*([^*]+)\*\*/g;
    for(const match of paragraph.matchAll(tokens)){
      block.append(document.createTextNode(paragraph.slice(start,match.index)));
      if(match[1])block.append(el('a',{href:match[2],target:'_blank',rel:'noopener noreferrer'},match[1]));
      else block.append(el(match[3]?'code':'strong',{},match[3]||match[4]));
      start=match.index+match[0].length;
    }
    block.append(document.createTextNode(paragraph.slice(start)));root.append(block);
  }
  return root;
}

function changeDeclaration(fn){return change(fn,{localize:false});}
function changeTextureSettings(decl,edit){
  changeDeclaration(()=>{edit(decl);if(decl.source==='input:0'&&graph.topInputs){const slot=graph.topInputs.find(s=>s.id===(graph.topInputLegacyId||graph.topInputs[0].id));slot.defaultSource=decl.defaultSource||'builtin:banana';slot.matchDefault=true;}if(decl.source==='input:0')for(const other of graph.declarations.filter(d=>d.kind==='sampler'&&d.source==='input:0'&&d!==decl))for(const key of ['defaultSource','expose','exposeName']){if(Object.hasOwn(decl,key))other[key]=clone(decl[key]);else delete other[key];}});
}
function setTextureMode(decl,mode){
  changeDeclaration(()=>{
    if(mode==='input:0'){
      const existing=graph.declarations.find(d=>d!==decl&&d.kind==='sampler'&&d.source==='input:0');
      const previous=decl.source;decl.source='input:0';decl.defaultSource=previous;
      if(existing)for(const key of ['defaultSource','expose','exposeName']){if(Object.hasOwn(existing,key))decl[key]=clone(existing[key]);else delete decl[key];}
    }else{decl.source=decl.defaultSource||'builtin:banana';delete decl.defaultSource;}
  });
}

function declarationFields(box,decl,settings=false,{live=true}={}){
  if(settings){
    box.append(field(t('declaration.name'),input(decl.name,value=>changeDeclaration(()=>decl.name=value))));
    box.append(el('p',{class:'muted'},decl.type+' · '+decl.id));return;
  }
  if(decl.kind==='sampler'){
    if(decl.expose&&live)box.append(liveUniformFields(decl));
    if(editorTarget==='top')box.append(field(t('texture.mode'),select([['input:0',t('texture.filterMode')],['source',t('texture.sourceMode')]],decl.source==='input:0'?'input:0':'source',value=>setTextureMode(decl,value))));
    const source=decl.source==='input:0'?(decl.defaultSource||'builtin:banana'):decl.source;
    box.append(field(t('texture.default'),select(textureOptions().filter(([key])=>key!=='input:0'),source.startsWith('op:')?'external':source,value=>changeTextureSettings(decl,d=>{const next=value==='external'?'op:/project1/texture':value;if(d.source==='input:0')d.defaultSource=next;else d.source=next;}))));
    if(source.startsWith('op:'))box.append(field(t('texture.path'),input(source.slice(3),value=>changeTextureSettings(decl,d=>{if(d.source==='input:0')d.defaultSource='op:'+value;else d.source='op:'+value;}))));
    box.append(toggle(t('uniform.expose'),decl.expose,value=>changeTextureSettings(decl,d=>setDeclarationExposed(d,value))));
    if(decl.expose)box.append(field(t('uniform.publicName'),input(decl.exposeName||(decl.source==='input:0'?'Input 1 Default TOP':decl.name),value=>changeTextureSettings(decl,d=>d.exposeName=value))));
    box.append(el('p',{class:'muted'},t(decl.source==='input:0'?'texture.filterHint':'texture.sourceHint')));
  }else{
    if(live)box.append(liveUniformFields(decl));
    box.append(el('h4',{},t('uniform.default')));
    box.append(numbers(decl.value,t('uniform.default'),value=>changeDeclaration(()=>decl.value=value)));
    const control=el('button',{},t('controls.fromUniform'));control.onclick=()=>openUniformControl(decl.id);box.append(control);
  }
}

function newUniform(node=null){
  change(()=>{
    const id='uniform_'+crypto.randomUUID().replaceAll('-','').slice(0,8);
    graph.declarations.push({id,kind:'uniform',type:'float',name:'uValue'+graph.declarations.length,value:.5,expose:false});
    if(node)node.params.declarationId=id;
  });
}

function renderParameterScope(box){
  const tabs=el('div',{class:'parameter-scope',role:'tablist','aria-label':t('parameter.scope')});
  for(const key of ['node','exposed']){const button=el('button',{role:'tab','data-parameter-scope':key,'aria-selected':String(inspectorScope===key),class:inspectorScope===key?'active':''},t('parameter.'+key));button.tabIndex=inspectorScope===key?0:-1;button.onclick=()=>{inspectorScope=key;inspector();refreshUniforms();};tabs.append(button);}
  tabs.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();e.stopPropagation();const next=e.key==='Home'?'node':e.key==='End'?'exposed':inspectorScope==='node'?'exposed':'node';inspectorScope=next;inspector();$('[data-parameter-scope="'+next+'"]').focus();refreshUniforms();};box.append(tabs);
}
function exposedInspector(box){
  box.append(el('p',{class:'muted'},t('parameter.exposedHint')));
  const declarations=graph.declarations.filter(d=>d.expose);
  if(!declarations.length)box.append(el('p',{class:'muted'},t('parameter.exposedEmpty')));
  for(const decl of declarations){
    const card=el('section',{class:'exposed-card','data-exposed':decl.id});
    card.append(el('h3',{},decl.exposeName||(decl.source==='input:0'?'Input 1 Default TOP':decl.name)),el('div',{class:'node-identity'},decl.type+' · '+decl.name),liveUniformFields(decl));
    const details=el('details'),summary=el('summary',{},t('parameter.exposedSettings')),settings=el('div');details.append(summary,settings);declarationFields(settings,decl,false,{live:false});card.append(details);if(readonly)for(const control of card.querySelectorAll('input,select,button'))control.disabled=true;box.append(card);
  }
  updateUniformFields();
}
let helpContext='node',previewHelpSelection=null;
function renderHelp(){
  const help=$('#nodehelp');help.replaceChildren();
  if(helpContext==='preview'&&selected!==previewHelpSelection)helpContext='node';
  if(helpContext==='preview'){
    help.append(el('h3',{},t(editorTarget==='top'?'preview.top':'preview.material')),markdown(t(editorTarget==='top'?'preview.helpTop':'preview.helpMaterial')));return;
  }
  const n=current().nodes.find(n=>n.id===selected),d=n&&definition(n);
  const source=!n&&graph.declarations.find(d=>d.id===selectedInputId);
  if(source){help.append(el('h3',{},source.name+' · '+source.type),markdown(t('help.'+source.kind)));return;}
  if(nodeComment(n)){const note=el('section',{class:'node-comment-help'});note.append(el('strong',{},t('node.comment')),el('p',{},nodeComment(n)));help.append(note);}
  help.append(markdown(t(d?(editorTarget==='top'&&['uv','texture','pixel_out'].includes(d.key)?'help.top.'+d.key:(d.descriptionKey||'help.'+d.key)):'help.select')));
}
function showPreviewHelp(){if(!graph)return;helpContext='preview';previewHelpSelection=selected;renderHelp();}
function installPreviewHelp(){
  $('#pane-live').addEventListener('click',showPreviewHelp);
  $('#livebody').addEventListener('keydown',event=>{
    if(event.target===$('#livebody')&&['Enter',' '].includes(event.key)){event.preventDefault();showPreviewHelp();}
  });
}

const glslCodeDrafts=new WeakMap();
function glslCodeInspector(box,n){
  const panel=el('div',{class:'glsl-code-panel','data-glsl-code':n.id});
  const name=input(n.params.functionName,value=>change(()=>{n.params.functionName=value;CustomGLSL.validate(n.params);}));
  name.maxLength=48;name.disabled=readonly;name.dataset.codeFunction='';
  panel.append(field(t('code.function'),name));
  for(const direction of ['inputs','outputs']){
    const group=el('section',{class:'code-interface','data-code-direction':direction});
    const heading=el('div',{class:'code-interface-heading'});
    heading.append(el('strong',{},t('code.'+direction)));
    const add=el('button',{type:'button','aria-label':t('code.add.'+direction),'data-code-add':direction},'+');
    add.disabled=readonly||n.params[direction].length>=typeContract.glslCode.maxPorts;
    add.onclick=()=>change(()=>CustomGLSL.add(n.params,direction));heading.append(add);group.append(heading);
    for(const [index,p]of n.params[direction].entries()){
      const row=el('div',{class:'code-port','data-code-port':p.id});
      const entry=input(p.name,value=>change(()=>CustomGLSL.update(n,direction,p.id,{name:value})));
      entry.maxLength=48;entry.disabled=readonly;entry.setAttribute('aria-label',t('code.portName'));entry.title=t('code.renameHint');
      const types=direction==='inputs'?interfaceTypes():numericTypes();
      const type=select(types.map(type=>[type,type]),p.type,value=>change(()=>CustomGLSL.update(n,direction,p.id,{type:value})));
      type.disabled=readonly;type.setAttribute('aria-label',t('node.type'));
      row.append(entry,type);
      for(const [label,offset,symbol]of [['code.up',-1,'↑'],['code.down',1,'↓']]){
        const move=el('button',{type:'button','aria-label':t(label),'data-code-move':String(offset)},symbol);
        move.title=t(label);move.disabled=readonly||index+offset<0||index+offset>=n.params[direction].length;
        move.onclick=()=>change(()=>CustomGLSL.move(n.params,direction,p.id,offset));row.append(move);
      }
      const remove=el('button',{type:'button','aria-label':t('code.remove'),'data-code-remove':p.id},'×');
      remove.title=t('code.remove');remove.disabled=readonly||direction==='outputs'&&n.params.outputs.length===1;
      remove.onclick=()=>change(()=>CustomGLSL.remove(n,direction,p.id,current().edges));row.append(remove);group.append(row);
    }
    panel.append(group);
  }
  const editor=el('div',{class:'code-editor'}),header=el('pre',{class:'code-wrapper','data-code-header':''},CustomGLSL.header(n.params));
  const body=el('textarea',{'aria-label':t('code.body'),'data-code-body':'',spellcheck:'false',autocapitalize:'off',autocomplete:'off',autocorrect:'off',wrap:'off'});
  const draft=glslCodeDrafts.get(n);body.value=draft?.base===n.params.code?draft.text:n.params.code;body.maxLength=typeContract.glslCode.maxLength;body.readOnly=readonly;
  body.rows=Math.max(6,Math.min(20,body.value.split('\n').length+1));
  let committed=n.params.code;
  const commit=()=>{
    if(readonly||body.value===committed)return;
    const value=body.value,previous=committed;
    // Replacing the focused editor during render can emit blur synchronously.
    committed=value;glslCodeDrafts.delete(n);
    // The body does not change node layout. Keep the focused DOM alive so a
    // blur followed by a button click is not swallowed by replacing that button.
    if(!change(()=>n.params.code=value,{redraw:false}))committed=previous;
    else {
      document.querySelectorAll('.node.error').forEach(card=>card.classList.remove('error'));
      const f=currentFunction();if(f)$('#functionscope').textContent=t(f.scope==='local'?'function.local':'function.source');
    }
  };
  body.oninput=()=>glslCodeDrafts.set(n,{base:n.params.code,text:body.value});
  body.onchange=commit;body.onblur=commit;
  body.onkeydown=event=>{
    if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)){event.preventDefault();event.stopPropagation();commit();}
    else if(event.key==='Tab'&&!event.shiftKey&&!readonly){event.preventDefault();event.stopPropagation();body.setRangeText('    ',body.selectionStart,body.selectionEnd,'end');body.oninput();}
  };
  editor.append(header,body,el('pre',{class:'code-wrapper'},'}'));panel.append(editor);
  panel.append(el('small',{class:'muted code-hint'},t('code.hint')));
  box.append(panel);
}

function vectorInspector(box,n,d){
  if(!isVectorOperation(d))return;
  const automatic=n.ui?.typeMode==='auto',options=selectableNodeTypes(d).map(type=>[type,type]);
  const composed=['combine','vector'].includes(d.key);
  const control=select(composed?options:[['auto',t('type.auto')+' · '+n.params.type],...options],automatic?'auto':n.params.type,value=>{
    if(composed)change(()=>n.params.type=value);else setMathType(n,value);
  });control.dataset.vectorType=n.id;control.disabled=readonly;
  box.append(field(t(composed?'vector.outputType':'vector.inputType'),control));
  if(d.key==='swizzle'){
    const slots=el('div',{class:'swizzle-components'}),names=vectorNames(n),components='xyzw'.slice(0,typeComponents(n.params.type));
    [...n.params.mask].forEach((value,index)=>{
      const selectComponent=select([...components].map((p,i)=>[p,names[i]]),value,next=>change(()=>n.params.mask=n.params.mask.slice(0,index)+next+n.params.mask.slice(index+1)));
      selectComponent.dataset.swizzleComponent=index;selectComponent.setAttribute('aria-label',t('vector.outputComponent')+' '+(index+1));selectComponent.disabled=readonly;
      slots.append(selectComponent);
    });
    for(const [label,enabled,edit]of [['−',n.params.mask.length>1,()=>n.params.mask=n.params.mask.slice(0,-1)],['+',n.params.mask.length<4,()=>n.params.mask+=components[Math.min(n.params.mask.length,components.length-1)]]]){
      const b=el('button',{type:'button','aria-label':t(label==='+'?'vector.addComponent':'vector.removeComponent')},label);b.disabled=readonly||!enabled;b.onclick=()=>change(edit);slots.append(b);
    }
    box.append(field(t('vector.componentOrder'),slots));
  }
}
function setNodeInputValue(n,port,next){
  if(['combine','vector'].includes(definition(n)?.key)&&port!=='value'){
    n.params.components||=[0,0,0,0];const values=Array.isArray(next)?next:[next];n.params.components.splice('xyzw'.indexOf(port),values.length,...values);
  }else {n.inputValues||={};n.inputValues[port]=next;}
}
// Inline controls edit the same graph values as Parameter. Keep drafts outside
// the graph until commit, and keep their DOM alive across unrelated refreshes.
let inlineValueEdit=null,inlineValueRenderPending=false,inlineValueRenderTimer=null;
function inlineValueSignature(n){return JSON.stringify([n.params,n.inputValues,current().edges.filter(e=>e.to[0]===n.id)]);}
function deferInlineValueRender(){
  const edit=inlineValueEdit;if(!edit)return false;
  if(edit.entry.isConnected&&document.activeElement===edit.entry&&!readonly&&edit.owner===current()&&current().nodes.includes(edit.node)&&edit.signature===inlineValueSignature(edit.node)){
    inlineValueRenderPending=true;return true;
  }
  edit.entry.cancelInlineValue?.();inlineValueEdit=null;return false;
}
function queueInlineValueRender(){
  inlineValueRenderPending=true;clearTimeout(inlineValueRenderTimer);
  inlineValueRenderTimer=setTimeout(()=>{
    inlineValueRenderTimer=null;if(inlineValueEdit?.entry===document.activeElement)return;
    if(inlineValueRenderPending){inlineValueRenderPending=false;render();}
  },0);
}
function inlineNumericFields(n,port,value,write,labels='XYZW'){
  const values=Array.isArray(value)?value:[value],box=el('span',{class:'node-inline-values'});
  values.forEach((v,index)=>{
    const label=(port==='$value'?t('declaration.value'):portLabel(n,'inputs',port))+(values.length>1?' '+labels[index]:''),entry=el('input',{type:'number',step:'any','aria-label':label});
    entry.dataset.inlineNode=n.id;entry.dataset.inlinePort=port;entry.dataset.component=String(index);entry.disabled=readonly;entry.value=String(v);
    let committed=entry.value;
    const own=()=>!readonly&&entry.isConnected&&current().nodes.includes(n);
    const focus=()=>{if(own())inlineValueEdit={entry,node:n,owner:current(),signature:inlineValueSignature(n)};};
    const restore=()=>{entry.value=committed;entry.removeAttribute('aria-invalid');};
    const commit=()=>{
      if(entry.numericGestureActive||!own()||entry.value===committed)return;
      const next=Number(entry.value);
      if(!entry.value.trim()||!Number.isFinite(next)){entry.setAttribute('aria-invalid','true');return;}
      // A changed source/topology invalidates a draft instead of writing it into
      // a replacement graph or another Subgraph definition.
      if(inlineValueEdit?.entry===entry&&inlineValueEdit.signature!==inlineValueSignature(n)){restore();return;}
      inlineValueEdit=null;
      const ok=change(()=>write(index,next),{redraw:false});
      if(!ok)return;
      committed=entry.value;entry.removeAttribute('aria-invalid');focus();
      const summary=entry.closest('.node')?.querySelector('[data-vector-summary]');if(summary)updateVectorManualSummary(n,summary);
      if(selected===n.id)inspector();queueInlineValueRender();
    };
    entry.cancelInlineValue=()=>{restore();if(inlineValueEdit?.entry===entry)inlineValueEdit=null;};
    entry.addEventListener('focus',focus);
    entry.addEventListener('input',()=>entry.removeAttribute('aria-invalid'));
    entry.addEventListener('change',commit);
    entry.addEventListener('blur',()=>{if(!entry.numericGestureActive)commit();restore();if(inlineValueEdit?.entry===entry)inlineValueEdit=null;queueInlineValueRender();});
    entry.addEventListener('keydown',e=>{
      e.stopPropagation();
      if(e.key==='Enter'){e.preventDefault();commit();}
      else if(e.key==='Escape'){e.preventDefault();cancelValueLadder();restore();focus();}
    });
    installValueLadder(entry,commit);
    for(const event of ['pointerdown','click','dblclick','contextmenu'])entry.addEventListener(event,e=>e.stopPropagation());
    if(values.length>1){const component=el('label',{class:'node-inline-component'});component.append(el('span',{'aria-hidden':'true'},labels[index]),entry);box.append(component);}
    else box.append(entry);
  });
  return box;
}
function nodeInlineValues(n,port){
  const type=ports(n,'inputs')[port],key=definition(n)?.key;
  if(type!=='float'||current().edges.some(e=>e.to[0]===n.id&&e.to[1]===port))return null;
  if(key==='vector'&&(port==='value'||current().edges.some(e=>e.to[0]===n.id&&e.to[1]==='value')))return null;
  const value=defaultInput(n,port,type);if(value===null)return null;
  return inlineNumericFields(n,port,value,(index,next)=>{
    const old=defaultInput(n,port,type),updated=Array.isArray(old)?old.slice():old;
    if(Array.isArray(updated))updated[index]=next;
    setNodeInputValue(n,port,Array.isArray(updated)?updated:next);
  },key==='vector'?vectorNames(n):'XYZW');
}
function nodeFixedValueEditor(n){
  const key=definition(n)?.key;if(key!=='float')return null;
  const box=inlineNumericFields(n,'$value',n.params.value,(index,next)=>{
    if(Array.isArray(n.params.value)){n.params.value=n.params.value.slice();n.params.value[index]=next;}else n.params.value=next;
  },key==='color'?'RGBA':'XYZW');box.classList.add('node-fixed-values');return box;
}
function inspector(){
  if(!valueLadder?.entry?.dataset.inlineNode&&!pendingValueLadder?.entry?.dataset.inlineNode)cancelValueLadder();
  const box=$('#inspector');box.replaceChildren();renderHelp();
  const n=current().nodes.find(n=>n.id===selected),d=n&&definition(n);
  if(n||selectedEdge!==null)selectedInputId=null;
  const inputSource=allInputSources().find(d=>d.id===selectedInputId);
  if(inputSource?.kind==='top_input'){topInputInspector(box,inputSource);return;}
  if(inputSource){inputSourceInspector(box,inputSource);return;}
  if(!n){
    box.append(el('p',{class:'muted'},selectedEdge!==null?t('wire.selected'):t('node.select')));
    if(selectedEdge!==null){const disconnect=el('button',{class:'wide danger','data-action':'disconnect-wire'},t('wire.disconnectSelected'));disconnect.disabled=readonly;disconnect.onclick=remove;box.append(disconnect);}
    return;
  }
  box.append(nodeInspectorTitle(n,d));
  if(!d)return;
  const tabs=el('div',{class:'parameter-tabs',role:'tablist','aria-label':t('panel.parameters')});
  for(const key of ['parameters','settings']){
    const button=el('button',{class:inspectorTab===key?'active':'',role:'tab','aria-selected':String(inspectorTab===key)},t('panel.'+key));
    button.onclick=()=>{inspectorTab=key;inspector();};tabs.append(button);
  }
  box.append(tabs);
  functionInspector(box,n,d);
  if(inspectorTab==='parameters'){
    if(d.key==='glsl_code')glslCodeInspector(box,n);
    vectorInspector(box,n,d);
    if(supportsAutoType(d)&&!isVectorOperation(d)){
      const automatic=n.ui?.typeMode==='auto',control=select([['auto',t('type.auto')+' · '+n.params.type],...selectableNodeTypes(d).map(type=>[type,type])],automatic?'auto':n.params.type,value=>setMathType(n,value));control.dataset.mathType=n.id;
      const row=field(t('type.operation'),control);control.title=t(automatic?'type.autoHint':'type.lockedHint');box.append(row);
    }
    pixelBufferFields(box,n);
    if(d.key==='texture'){const split=el('button',{class:'wide'},t('sampler.split'));split.onclick=()=>splitLegacyTexture(n);box.append(split);}
    if('value'in n.params)box.append((d.key==='color'?colorFields:numbers)(n.params.value,t('declaration.value'),value=>change(()=>n.params.value=value)));
    const decl=graph.declarations.find(x=>x.id===n.params.declarationId);
    if(decl){
      const source=el('button',{class:'wide','data-inspect-input':decl.id},t('inputs.edit')+' · '+decl.name);
      source.onclick=()=>selectInputSource(decl.id);box.append(source);
      if(decl.kind==='sampler')declarationFields(box,decl);
      else if(decl.kind==='constant')constantFields(box,decl);
      else nativeInputFields(box,decl);
    }
    if(n.params.inputId){
      const sources=topInputsView(),source=sources.find(s=>s.id===n.params.inputId);
      box.append(field(t('inputs.referenceSource'),select(sources.map(s=>[s.id,s.name]),n.params.inputId,value=>change(()=>n.params.inputId=value))));
      if(source){const edit=el('button',{class:'wide'},t('inputs.edit')+' · '+source.name);edit.onclick=()=>selectInputSource(source.id);box.append(edit);}
    }
    if(d.key==='sampler'){const create=el('button',{class:'wide'},t('sampler.create'));create.onclick=()=>newSampler(n);box.append(create);}
    else if(d.key==='uniform'&&!decl){
      const create=el('button',{class:'wide'},t('uniform.create'));create.onclick=()=>newUniform(n);box.append(create);
    }
    const inputBox=d.key==='glsl_code'?el('details',{class:'code-input-values'}):box;
    if(d.key==='glsl_code'&&n.params.inputs.length){inputBox.append(el('summary',{},t('code.inputValues')));box.append(inputBox);}
    for(const [port,type]of Object.entries(d.key==='function_output'?{}:ports(n,'inputs'))){
      const section=el('section',{class:'input-parameter','data-input':port});
      const connection=current().edges.find(e=>e.to[0]===n.id&&e.to[1]===port);
      const typeInfo=inputTypeDisplay(n,port);
      const heading=el('h4',{class:'input-heading'});heading.append(el('span',{},portLabel(n,'inputs',port)),el('small',{},typeInfo.text));section.append(heading);
      if(typeInfo.source&&typeInfo.source!==typeInfo.target)section.append(el('p',{class:'muted conversion-hint'},t(typeInfo.conversion==='splat'?'type.splat':'type.incompatible').replace('{source}',typeInfo.source).replace('{target}',typeInfo.target)));
      const value=defaultInput(n,port,type);
      if(isResourceType(type)){
        if(!connection)section.append(el('p',{class:'muted'},t('sampler.fallbackHint')));
      }else if(d.key==='vector'&&(port==='value'||current().edges.some(e=>e.to[0]===n.id&&e.to[1]==='value'))){
        if(!connection)section.append(el('p',{class:'muted'},t(port==='value'?'vector.baselineHint':'vector.inherited')));
      }else if(value===null){
        section.append(el('p',{class:'muted'},t('input.implicitUV')));
        if(!connection){const override=el('button',{class:'wide'},t('input.setUV'));override.onclick=()=>change(()=>{n.inputValues||={};n.inputValues[port]=[.5,.5];});section.append(override);}
      }else if(!connection){const values=numbers(value,portLabel(n,'inputs',port),next=>change(()=>setNodeInputValue(n,port,next)),false,port==='color'?'RGBA':'XYZW');values.classList.add('input-values');section.append(values);}
      if(connection){
        const source=current().nodes.find(other=>other.id===connection.from[0]),connectionRow=el('div',{class:'connection-row'});
        const origin=el('span',{class:'connection-source'},(nodeLabel(source)||definition(source)?.label||connection.from[0])+' · '+portLabel(source,'outputs',connection.from[1]));origin.title=connection.from.join(' · ');
        const disconnect=el('button',{'aria-label':t('wire.disconnect')+portLabel(n,'inputs',port)},t('wire.disconnectShort'));disconnect.disabled=readonly;
        disconnect.onclick=()=>change(()=>current().edges=current().edges.filter(e=>e!==connection));connectionRow.append(origin,disconnect);section.append(connectionRow);
      }else if(['texture','texture_sample'].includes(d.key)&&port==='uv'&&value!==null){
        const reset=el('button',{class:'wide'},t('input.restoreUV'));reset.onclick=()=>change(()=>delete n.inputValues[port]);section.append(reset);
      }
      inputBox.append(section);
    }
  }else{
    if(n.params.type&&!supportsAutoType(d)&&!isVectorOperation(d))box.append(field(t('node.type'),select(selectableNodeTypes(d).map(type=>[type,type]),n.params.type,value=>change(()=>{
      const old=clone(n.inputValues||{});n.params.type=value;
      for(const [port,type]of Object.entries(ports(n,'inputs'))){
        if(!Object.hasOwn(old,port))continue;
        n.inputValues[port]=shapedValue(old[port],type);
      }
    }))));
    if(isVectorOperation(d))box.append(field(t('vector.names'),select([['xyzw','X / Y / Z / W'],['rgba','R / G / B / A'],...(n.params.type==='vec2'?[['uv','U / V']]:[])],n.ui?.componentNames||'xyzw',value=>change(()=>n.ui.componentNames=value))));
    if(typeContract?.constantExpressions?.includes(d.key)&&!['constant','float','vec2','vec3','vec4','color'].includes(d.key)){
      const requirement=el('input',{type:'checkbox','data-require-constant':n.id});requirement.checked=!!n.params.requireConstant;requirement.disabled=readonly;
      requirement.onchange=()=>change(()=>{if(requirement.checked)n.params.requireConstant=true;else delete n.params.requireConstant;});
      const row=field(t('vector.requireConstant'),requirement);row.classList.add('constant-requirement');row.title=t('vector.constantHint');box.append(row,el('p',{class:'muted'},t('vector.constantHint')));
    }
    if('declarationId'in n.params){
      const options=graph.declarations.filter(x=>x.kind===(['uniform','constant'].includes(d.key)?d.key:'sampler')).map(x=>[x.id,x.name]);
      box.append(field(t('node.declaration'),select([['',t('select.placeholder')],...options],n.params.declarationId,value=>change(()=>n.params.declarationId=value))));
      const decl=graph.declarations.find(x=>x.id===n.params.declarationId);if(decl)declarationFields(box,decl,true);
    }
    pixelBufferNames(box,n);
    box.append(el('div',{class:'node-identity'},n.id));
  }
  box.append(nodeCommentField(n));
  updateUniformFields();

}

/* Sidebar visibility is independent of its remembered width and Shader state. */
function isSidebarOpen(side){
  const suffix=side==='left'?'library':'details';
  return matchMedia('(max-width:800px)').matches?document.body.classList.contains('show-'+suffix):!document.body.classList.contains('hide-'+suffix);
}
function syncSidebarButtons(){
  for(const [side,id]of [['left','togglelibrary'],['right','toggledetails']]){
    const button=$('#'+id);if(!button)continue;
    const open=isSidebarOpen(side),label=t('sidebar.'+(open?'hide':'show')+(side==='left'?'Left':'Right'));
    button.setAttribute('aria-expanded',String(open));button.setAttribute('aria-label',label);button.title=label;
  }
}
function setSidebarOpen(side,open){
  cancelValueLadder();cancelConnection();closeCreator();
  const compact=matchMedia('(max-width:800px)').matches,suffix=side==='left'?'library':'details';
  document.body.classList.toggle((compact?'show-':'hide-')+suffix,compact?open:!open);
  if(compact&&open)document.body.classList.remove('show-'+(side==='left'?'details':'library'));
  syncSidebarButtons();window.dispatchEvent(new Event('sidebarvisibilitychange'));
}
function installSidebarVisibility(){
  $('#togglelibrary').onclick=()=>setSidebarOpen('left',!isSidebarOpen('left'));
  $('#toggledetails').onclick=()=>setSidebarOpen('right',!isSidebarOpen('right'));
  matchMedia('(max-width:800px)').addEventListener('change',()=>{syncSidebarButtons();window.dispatchEvent(new Event('sidebarvisibilitychange'));});
  syncSidebarButtons();
}

/* Sidebar widths are browser preferences; they never edit the Shader graph. */
function installSidebarWidths(){
  const host=document.querySelector('main'),storageKey='sgrapeSidebarWidths',compact=matchMedia('(max-width:800px)');
  const handles={left:$('#libraryresize'),right:$('#detailsresize')};
  const metric=(name,fallback)=>Number.parseFloat(getComputedStyle(host).getPropertyValue(name))||fallback;
  const settings={left:{min:metric('--sidebar-left-min',180),max:metric('--sidebar-left-max',520),initial:metric('--sidebar-left-default',220)},right:{min:metric('--sidebar-right-min',300),max:metric('--sidebar-right-max',640),initial:metric('--sidebar-right-default',340)}};
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
  let saved={};try{saved=JSON.parse(localStorage.getItem(storageKey))||{};}catch{}
  let preferred=Object.fromEntries(Object.entries(settings).map(([side,s])=>[side,Number.isFinite(saved[side])?clamp(saved[side],s.min,s.max):s.initial]));
  let current={...preferred},gesture=null,frame=0;
  function bounds(side){
    const s=settings[side],other=side==='left'?'right':'left';
    const dividerCount=Number(isSidebarOpen('left'))+Number(isSidebarOpen('right'));
    const room=compact.matches?host.clientWidth-32:host.clientWidth-dividerCount*metric('--sidebar-divider',6)-metric('--sidebar-canvas-min',280)-(isSidebarOpen(other)?current[other]:0);
    const max=Math.max(0,Math.min(s.max,room));return {min:Math.min(s.min,max),max};
  }
  function paint(){
    for(const side of ['left','right'])host.style.setProperty('--'+side+'-sidebar-width',current[side]+'px');
    for(const side of ['left','right']){const b=bounds(side),handle=handles[side];handle.setAttribute('aria-valuemin',Math.round(b.min));handle.setAttribute('aria-valuemax',Math.round(b.max));handle.setAttribute('aria-valuenow',Math.round(current[side]));}
    if(!frame)frame=requestAnimationFrame(()=>{frame=0;if(graph)wires();});
  }
  function layout(){
    current={...preferred};
    if(compact.matches){for(const side of ['left','right']){const b=bounds(side);current[side]=clamp(current[side],b.min,b.max);}}
    else{
      const visible=['left','right'].filter(isSidebarOpen);
      let excess=Math.max(0,visible.reduce((sum,side)=>sum+current[side],0)-(host.clientWidth-visible.length*metric('--sidebar-divider',6)-metric('--sidebar-canvas-min',280)));
      for(const side of visible){const take=Math.min(excess,current[side]-settings[side].min);current[side]-=take;excess-=take;}
    }
    paint();
  }
  function save(){try{localStorage.setItem(storageKey,JSON.stringify(preferred));}catch{}window.dispatchEvent(new Event('workspacepreferenceschange'));}
  function setWidth(side,width){const b=bounds(side);current[side]=clamp(width,b.min,b.max);paint();}
  for(const [side,handle]of Object.entries(handles)){
    const direction=side==='left'?1:-1;
    handle.addEventListener('pointerdown',event=>{
      if(event.button!==0||!handle.getClientRects().length)return;
      event.preventDefault();event.stopPropagation();gesture?.cancel();cancelValueLadder();cancelConnection();closeCreator();handle.focus({preventScroll:true});
      const before={...current},start=event.clientX,controller=new AbortController(),options={capture:true,signal:controller.signal};let finished=false;
      document.body.classList.add('resizing-sidebar');handle.classList.add('resizing');
      function finish(accept){
        if(finished)return;finished=true;controller.abort();gesture=null;
        document.body.classList.remove('resizing-sidebar');handle.classList.remove('resizing');
        if(handle.hasPointerCapture(event.pointerId))handle.releasePointerCapture(event.pointerId);
        if(accept){preferred[side]=current[side];save();}else{current=before;paint();}
      }
      gesture={cancel:()=>finish(false)};
      window.addEventListener('pointermove',e=>{if(e.pointerId!==event.pointerId)return;if(!(e.buttons&1)){finish(false);return;}e.preventDefault();setWidth(side,before[side]+(e.clientX-start)*direction);},options);
      window.addEventListener('pointerup',e=>{if(e.pointerId===event.pointerId&&e.button===0){e.preventDefault();e.stopPropagation();setWidth(side,before[side]+(e.clientX-start)*direction);finish(true);}},options);
      window.addEventListener('pointercancel',e=>{if(e.pointerId===event.pointerId)finish(false);},options);
      handle.addEventListener('lostpointercapture',()=>finish(false),options);
      window.addEventListener('blur',()=>finish(false),options);
      window.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();finish(false);}},options);
      document.addEventListener('visibilitychange',()=>{if(document.hidden)finish(false);},options);
      try{handle.setPointerCapture(event.pointerId);}catch{finish(false);}
    });
    handle.addEventListener('keydown',event=>{
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
      event.preventDefault();event.stopPropagation();gesture?.cancel();cancelValueLadder();const b=bounds(side);
      const amount=(event.shiftKey?32:8)*(event.key==='ArrowRight'?1:-1)*direction;
      setWidth(side,event.key==='Home'?b.min:event.key==='End'?b.max:current[side]+amount);preferred[side]=current[side];save();
    });
    handle.addEventListener('dblclick',event=>{event.preventDefault();gesture?.cancel();setWidth(side,settings[side].initial);preferred[side]=current[side];save();});
  }
  window.addEventListener('resize',()=>{gesture?.cancel();layout();});
  window.addEventListener('workspacewidthschange',()=>{gesture?.cancel();let value={};try{value=JSON.parse(localStorage.getItem(storageKey))||{};}catch{}for(const side of ['left','right']){const s=settings[side];preferred[side]=Number.isFinite(value[side])?clamp(value[side],s.min,s.max):s.initial;}layout();});
  window.addEventListener('sidebarvisibilitychange',()=>{gesture?.cancel();layout();});layout();
}

/* Pane proportions are view preferences, independent of Shader data. */
function installPanelHeights(panels,options={}){
  const host=options.host||$('.details'),key=options.key||'sgrapeInspectorSizes',handles=options.handles||[...host.querySelectorAll('.panel-divider')],events=new AbortController();
  const metric=(name,fallback)=>Number.parseFloat(getComputedStyle(host).getPropertyValue(name))||fallback;
  const defaults=Object.fromEntries(panels.map(p=>[p.dataset.panel,metric('--panel-'+p.dataset.panel+'-weight',1)]));
  let saved={};try{saved=JSON.parse(localStorage.getItem(key))||{};}catch{}
  if(options.weights)saved=options.weights;
  let weights=Object.fromEntries(panels.map(p=>{const id=p.dataset.panel;return [id,Number.isFinite(saved[id])&&saved[id]>0?Math.max(.0001,Math.min(10000,saved[id])):defaults[id]];}));
  let heights={},minimumBody=0,header=38,gesture=null;
  const expanded=()=>panels.filter(p=>!p.classList.contains('collapsed'));
  function pair(handle){
    const lower=panels.find(p=>p.dataset.panel===handle.dataset.panelResize);
    if(lower.classList.contains('collapsed'))return null;
    const upper=panels.slice(0,panels.indexOf(lower)).reverse().find(p=>!p.classList.contains('collapsed'));
    return upper?[upper.dataset.panel,lower.dataset.panel]:null;
  }
  function limits(ids){const total=heights[ids[0]]+heights[ids[1]];return {min:header+minimumBody,max:total-header-minimumBody,total};}
  function paint(){
    for(const panel of panels)panel.style.flex='0 0 '+heights[panel.dataset.panel]+'px';
    for(const handle of handles){
      const ids=pair(handle);handle.hidden=!ids;if(!ids)continue;
      const bounds=limits(ids);handle.setAttribute('aria-controls',ids.map(id=>panels.find(p=>p.dataset.panel===id).id).join(' '));
      handle.setAttribute('aria-valuemin',Math.round(bounds.min));handle.setAttribute('aria-valuemax',Math.round(bounds.max));handle.setAttribute('aria-valuenow',Math.round(heights[ids[0]]));
    }
  }
  function layout(){
    if(!host.clientHeight)return;
    header=metric('--panel-header-height',38);const opened=expanded();
    const dividerCount=handles.filter(h=>pair(h)).length;
    let remaining=Math.max(0,host.clientHeight-header*panels.length-dividerCount*metric('--panel-divider-size',6));
    minimumBody=opened.length?Math.min(metric('--panel-body-min',80),remaining/opened.length):0;
    heights=Object.fromEntries(panels.map(p=>[p.dataset.panel,header]));
    let pool=opened.map(p=>p.dataset.panel);
    while(pool.length){
      const sum=pool.reduce((n,id)=>n+weights[id],0),small=pool.filter(id=>remaining*weights[id]/sum<minimumBody);
      if(!small.length){for(const id of pool)heights[id]+=remaining*weights[id]/sum;break;}
      for(const id of small){heights[id]+=minimumBody;remaining-=minimumBody;}
      pool=pool.filter(id=>!small.includes(id));
    }
    paint();
  }
  function setUpper(ids,value){const b=limits(ids);heights[ids[0]]=Math.max(b.min,Math.min(b.max,value));heights[ids[1]]=b.total-heights[ids[0]];paint();}
  function save(){
    const ids=expanded().map(p=>p.dataset.panel),bodyTotal=ids.reduce((n,id)=>n+Math.max(0,heights[id]-header),0),mass=ids.reduce((n,id)=>n+weights[id],0);
    if(!bodyTotal)return;
    for(const id of ids)weights[id]=Math.max(.0001,(heights[id]-header)/bodyTotal*mass);
    try{localStorage.setItem(key,JSON.stringify(weights));}catch{}
    options.onSave?.({...weights});
  }
  function cancel(){gesture?.cancel();}
  for(const handle of handles){
    handle.addEventListener('pointerdown',event=>{
      if(event.button!==0||!pair(handle))return;
      event.preventDefault();event.stopPropagation();cancel();cancelValueLadder();cancelConnection();closeCreator();handle.focus({preventScroll:true});
      const ids=pair(handle),before={...heights},start=event.clientY,controller=new AbortController(),options={capture:true,signal:controller.signal};let finished=false;
      document.body.classList.add('resizing-panel');handle.classList.add('resizing');
      function finish(accept){
        if(finished)return;finished=true;controller.abort();gesture=null;
        document.body.classList.remove('resizing-panel');handle.classList.remove('resizing');
        if(handle.hasPointerCapture(event.pointerId))handle.releasePointerCapture(event.pointerId);
        if(accept)save();else{heights=before;paint();}
      }
      gesture={cancel:()=>finish(false)};
      window.addEventListener('pointermove',e=>{if(e.pointerId!==event.pointerId)return;if(!(e.buttons&1)){finish(false);return;}e.preventDefault();setUpper(ids,before[ids[0]]+e.clientY-start);},options);
      window.addEventListener('pointerup',e=>{if(e.pointerId===event.pointerId&&e.button===0){e.preventDefault();e.stopPropagation();setUpper(ids,before[ids[0]]+e.clientY-start);finish(true);}},options);
      window.addEventListener('pointercancel',e=>{if(e.pointerId===event.pointerId)finish(false);},options);
      handle.addEventListener('lostpointercapture',()=>finish(false),options);
      window.addEventListener('blur',()=>finish(false),options);
      window.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();finish(false);}},options);
      document.addEventListener('visibilitychange',()=>{if(document.hidden)finish(false);},options);
      try{handle.setPointerCapture(event.pointerId);}catch{finish(false);}
    },{signal:events.signal});
    handle.addEventListener('keydown',event=>{
      if(!['ArrowUp','ArrowDown','Home','End'].includes(event.key))return;
      const ids=pair(handle);if(!ids)return;event.preventDefault();event.stopPropagation();cancel();cancelValueLadder();const b=limits(ids);
      setUpper(ids,event.key==='Home'?b.min:event.key==='End'?b.max:heights[ids[0]]+(event.key==='ArrowDown'?1:-1)*(event.shiftKey?32:8));save();
    },{signal:events.signal});
    handle.addEventListener('dblclick',event=>{
      const ids=pair(handle);if(!ids)return;event.preventDefault();cancel();const b=limits(ids);
      setUpper(ids,header+(b.total-2*header)*defaults[ids[0]]/(defaults[ids[0]]+defaults[ids[1]]));save();
    },{signal:events.signal});
  }
  const observer=new ResizeObserver(()=>{cancel();layout();});observer.observe(host);
  layout();return {cancel,layout,destroy(){cancel();events.abort();observer.disconnect();}};
}

/* The description keeps its chosen height even when its text or dock changes. */
function installBrowserDetailResize(){
  const host=$('#browserbody'),list=$('#librarycontent'),detail=$('#browserdetail'),handle=$('#browserdetailresize');
  const key='grapeBrowserDetailHeight',defaultHeight=240;
  let preferred=defaultHeight,height=defaultHeight,gesture=null;
  try{const saved=Number(localStorage.getItem(key));if(Number.isFinite(saved)&&saved>0)preferred=saved;}catch{}
  function limits(){
    const style=getComputedStyle(host),divider=Number.parseFloat(getComputedStyle(handle).getPropertyValue('--panel-divider-size'))||6;
    const available=Math.max(0,Math.floor(host.getBoundingClientRect().bottom-(Number.parseFloat(style.paddingBottom)||0)-list.getBoundingClientRect().top-divider));
    const max=Math.max(0,available-Math.min(140,Math.floor(available/2)));
    return {min:Math.min(112,max),max};
  }
  function layout(){
    if(!host.getClientRects().length)return;
    const b=limits();height=Math.max(b.min,Math.min(b.max,preferred));detail.style.flexBasis=height+'px';
    handle.setAttribute('aria-valuemin',b.min);handle.setAttribute('aria-valuemax',b.max);handle.setAttribute('aria-valuenow',height);
  }
  function save(){try{localStorage.setItem(key,String(preferred));}catch{}}
  function set(value){const b=limits();preferred=Math.max(b.min,Math.min(b.max,Math.round(value)));layout();}
  function cancel(){gesture?.cancel();}
  handle.addEventListener('pointerdown',event=>{
    if(event.button!==0||detail.hidden)return;
    event.preventDefault();event.stopPropagation();cancel();cancelValueLadder();cancelConnection();closeCreator();handle.focus({preventScroll:true});
    layout();const before=preferred,startHeight=height,startY=event.clientY,controller=new AbortController(),options={capture:true,signal:controller.signal};let finished=false;
    document.body.classList.add('resizing-panel');handle.classList.add('resizing');
    function finish(accept){
      if(finished)return;finished=true;controller.abort();gesture=null;
      document.body.classList.remove('resizing-panel');handle.classList.remove('resizing');
      if(handle.hasPointerCapture(event.pointerId))handle.releasePointerCapture(event.pointerId);
      if(accept)save();else{preferred=before;layout();}
    }
    gesture={cancel:()=>finish(false)};
    window.addEventListener('pointermove',e=>{if(e.pointerId!==event.pointerId)return;if(!(e.buttons&1)){finish(false);return;}e.preventDefault();set(startHeight+startY-e.clientY);},options);
    window.addEventListener('pointerup',e=>{if(e.pointerId===event.pointerId&&e.button===0){e.preventDefault();e.stopPropagation();set(startHeight+startY-e.clientY);finish(true);}},options);
    window.addEventListener('pointercancel',e=>{if(e.pointerId===event.pointerId)finish(false);},options);
    handle.addEventListener('lostpointercapture',()=>finish(false),options);
    window.addEventListener('blur',()=>finish(false),options);
    window.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();finish(false);}},options);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)finish(false);},options);
    try{handle.setPointerCapture(event.pointerId);}catch{finish(false);}
  });
  handle.addEventListener('keydown',event=>{
    if(!['ArrowUp','ArrowDown','Home','End'].includes(event.key))return;
    event.preventDefault();event.stopPropagation();cancel();layout();const b=limits();
    set(event.key==='Home'?b.min:event.key==='End'?b.max:height+(event.key==='ArrowUp'?1:-1)*(event.shiftKey?32:8));save();
  });
  handle.addEventListener('dblclick',event=>{event.preventDefault();cancel();preferred=defaultHeight;layout();save();});
  // Viewport clamping never overwrites the saved height; expanding restores it.
  new ResizeObserver(()=>{cancel();layout();}).observe(host);
  new MutationObserver(()=>{if(detail.hidden)cancel();layout();}).observe(detail,{attributes:true,attributeFilter:['hidden']});
  layout();
}

/* Limited two-sidebar workspace. All persisted data is presentation only. */
function installPanelWorkspace(){
  const ids=['browser','parameters','uniforms','controls','live','help'],key='grapeWorkspaceV1',presetsKey='grapeWorkspacePresetsV1';
  const hosts={left:$('#sidebar-left'),right:$('#parameter-sidebar')},panes={browser:$('#nodelibrary')},heads={};
  const copy=value=>JSON.parse(JSON.stringify(value)),read=(k,f)=>{try{return JSON.parse(localStorage.getItem(k))??f;}catch{return f;}};
  const write=(k,value)=>{try{localStorage.setItem(k,JSON.stringify(value));return true;}catch{status(t('layout.storageError'),true);return false;}};
  const defaults=()=>({version:1,left:[{panels:['browser','uniforms'],active:'browser',collapsed:false,weight:1}],right:[{panels:['parameters','controls'],active:'parameters',collapsed:false,weight:5},{panels:['live'],active:'live',collapsed:false,weight:3},{panels:['help'],active:'help',collapsed:false,weight:2}],widths:{left:220,right:340},visibility:{left:true,right:true},hidden:[]});
  function validate(raw){
    if(!raw||raw.version!==1)throw Error(t('layout.invalid'));
    const value=defaults(),seen=[];
    for(const side of ['left','right']){
      if(!Array.isArray(raw[side])||raw[side].length>ids.length)throw Error(t('layout.invalid'));
      value[side]=raw[side].map(group=>{
        if(!group||!Array.isArray(group.panels)||!group.panels.length||!group.panels.every(id=>ids.includes(id)))throw Error(t('layout.invalid'));
        seen.push(...group.panels);
        return {panels:[...group.panels],active:group.panels.includes(group.active)?group.active:group.panels[0],collapsed:group.collapsed===true,weight:Number.isFinite(group.weight)&&group.weight>0?Math.max(.0001,Math.min(10000,group.weight)):1};
      });
      const width=raw.widths?.[side];value.widths[side]=Number.isFinite(width)?Math.max(side==='left'?180:300,Math.min(side==='left'?520:640,width)):value.widths[side];
      value.visibility[side]=raw.visibility?.[side]!==false;
    }
    if(seen.length===4&&!seen.includes('uniforms')&&new Set(seen).size===4){const group=[...value.left,...value.right].find(g=>g.panels.includes('browser'));group.panels.push('uniforms');seen.push('uniforms');}
    if(seen.length===5&&!seen.includes('controls')&&new Set(seen).size===5){const group=[...value.left,...value.right].find(g=>g.panels.includes('parameters'));group.panels.push('controls');seen.push('controls');}
    if(seen.length!==ids.length||new Set(seen).size!==ids.length)throw Error(t('layout.invalid'));
    if(raw.hidden!==undefined&&(!Array.isArray(raw.hidden)||raw.hidden.some(id=>!ids.includes(id))||new Set(raw.hidden).size!==raw.hidden.length))throw Error(t('layout.invalid'));
    value.hidden=[...(raw.hidden||[])];
    return value;
  }
  let state=defaults(),sizes=[],drag=null,restoring=false;
  try{const stored=read(key,null);if(stored)state=validate(stored);else{
    state.widths={...state.widths,...read('sgrapeSidebarWidths',{})};
    const open=read('sgrapeInspectorPanels',{}),weights=read('sgrapeInspectorSizes',{});
    for(const g of state.right){g.collapsed=open[g.active]===false;g.weight=weights[g.active]||g.weight;}
    state=validate(state);
  }}catch{}
  // Upgrade only the former stock arrangement, once. Personal layouts and named presets stay put.
  const inputsPlacementKey='grapeInputsDefaultLeftV1';
  if(!read(inputsPlacementKey,false)){
    const topology=JSON.stringify([state.left,state.right].map(groups=>groups.map(g=>g.panels)));
    if(topology==='[[["browser"]],[["parameters","uniforms","controls"],["live"],["help"]]]'){
      state.left[0].panels.push('uniforms');state.right[0].panels=state.right[0].panels.filter(id=>id!=='uniforms');
      if(state.right[0].active==='uniforms'){state.left[0].active='uniforms';state.right[0].active='parameters';}
      write(key,state);
    }
    write(inputsPlacementKey,true);
  }
  const storedPresets=read(presetsKey,[]);let presets=[];for(const item of (Array.isArray(storedPresets)?storedPresets.slice(0,100):[])){try{if(typeof item.name==='string'&&item.name.trim())presets.push({name:item.name.slice(0,80),layout:validate(item.layout)});}catch{}}
  const browserHead=el('button',{id:'browsertoggle',class:'panel-heading',type:'button','aria-controls':'browserbody'});
  const browserLabel=el('span',{'data-i18n':'panel.addNode'});browserHead.append(browserLabel);
  $('#nodelibrary .section-label').remove();
  const browserBody=el('div',{id:'browserbody',class:'browser-body'});browserBody.append(...panes.browser.childNodes);panes.browser.append(browserBody);heads.browser=browserHead;
  for(const id of ids.slice(1)){panes[id]=$('#pane-'+id);heads[id]=panes[id].querySelector('.panel-heading');heads[id].remove();}
  for(const id of ids){panes[id].classList.remove('inspector-panel','collapsed');panes[id].classList.add('workspace-pane');panes[id].style.flex='';panes[id].setAttribute('role','tabpanel');panes[id].setAttribute('aria-labelledby',heads[id].id);heads[id].setAttribute('aria-controls',panes[id].id);heads[id].classList.add('workspace-tab');heads[id].dataset.workspacePanel=id;heads[id].type='button';}
  for(const [side,host]of Object.entries(hosts)){host.dataset.workspaceSide=side;host.classList.add('workspace-sidebar');}
  function title(id){return id==='browser'?t('panel.addNode'):id==='uniforms'?t('sources.title'):id==='controls'?t('controls.title'):id==='parameters'?t('panel.parameterTitle'):id==='help'?t('panel.helpTitle'):$('#previewtitle').textContent;}
  function locate(id){for(const side of ['left','right']){const index=state[side].findIndex(g=>g.panels.includes(id));if(index>=0)return {side,index,group:state[side][index]};}}
  function persist(){if(restoring)return;state.widths={...state.widths,...read('sgrapeSidebarWidths',{})};if(!matchMedia('(max-width:800px)').matches)state.visibility={left:isSidebarOpen('left'),right:isSidebarOpen('right')};write(key,state);}
  const parking=el('div',{hidden:true});document.body.append(parking);
  function build(){
    sizes.forEach(s=>s.destroy());sizes=[];
    for(const id of ids){panes[id].hidden=true;parking.append(heads[id],panes[id]);}
    for(const [side,host]of Object.entries(hosts)){
      host.replaceChildren();const groups=[];
      for(const group of state[side]){
        const visible=group.panels.filter(id=>!state.hidden.includes(id));if(!visible.length)continue;
        if(!visible.includes(group.active))group.active=visible[0];
        const groupId=group.panels[0],section=el('section',{class:'inspector-panel workspace-group','data-panel':groupId,'data-workspace-group':groupId,'data-tabbed':String(visible.length>1)});
        const bar=el('div',{class:'workspace-tabs',role:'tablist'});
        for(const id of visible){const button=heads[id];button.setAttribute('role','tab');button.setAttribute('aria-selected',String(group.active===id));button.setAttribute('aria-expanded',String(!group.collapsed));button.tabIndex=group.active===id?0:-1;
          button.onclick=()=>{if(group.active===id&&visible.length===1)group.collapsed=!group.collapsed;else {group.active=id;group.collapsed=false;}build();persist();heads[id].focus({preventScroll:true});};
          button.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();e.stopPropagation();const at=visible.indexOf(id),next=e.key==='Home'?0:e.key==='End'?visible.length-1:(at+(e.key==='ArrowRight'?1:-1)+visible.length)%visible.length;group.active=visible[next];group.collapsed=false;build();persist();heads[group.active].focus();};
          button.onpointerdown=e=>beginDrag(e,id);bar.append(button);
        }
        const fold=el('button',{type:'button',class:'workspace-fold','aria-label':t(group.collapsed?'layout.expand':'layout.collapse'),title:t(group.collapsed?'layout.expand':'layout.collapse'),'aria-expanded':String(!group.collapsed)});
        fold.innerHTML='<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="m4 6 4 4 4-4"/></svg>';
        fold.onclick=()=>{group.collapsed=!group.collapsed;build();persist();};bar.append(fold);
        section.append(bar);section.classList.toggle('collapsed',group.collapsed);
        for(const id of visible){const pane=panes[id];pane.hidden=group.collapsed||group.active!==id;const body=pane.querySelector('.panel-scroll');if(body)body.hidden=false;section.append(pane);}
        const handle=el('div',{class:'panel-divider',id:'resize-'+groupId,'data-panel-resize':groupId,role:'separator','aria-orientation':'horizontal','aria-label':t('layout.resize'),tabindex:'0'});
        if(groups.length)host.append(handle);host.append(section);groups.push(section);
      }
      if(!groups.length){host.append(el('div',{class:'workspace-empty'},t('layout.empty')));continue;}
      sizes.push(installPanelHeights(groups,{host,key:'grapeWorkspaceSizes-'+side,weights:Object.fromEntries(state[side].map(g=>[g.panels[0],g.weight])),onSave:weights=>{for(const g of state[side])if(Number.isFinite(weights[g.panels[0]]))g.weight=weights[g.panels[0]];persist();}}));
    }
    if(typeof graph!=='undefined'&&graph)preview().catch(error=>status(error.message,true));
  }
  function move(id,side,targetId=null,mode='after',tabIndex=null){
    if(!ids.includes(id)||!hosts[side])return;
    const source=locate(id),target=targetId?locate(targetId):null,destination=target?.group;
    if(destination===source.group&&source.group.panels.length===1)return;
    let index=Number.isInteger(tabIndex)?Math.max(0,Math.min(destination?.panels.length||0,tabIndex)):destination?.panels.length||0;
    if(mode==='tab'&&destination===source.group&&source.group.panels.indexOf(id)<index)index--;
    source.group.panels=source.group.panels.filter(x=>x!==id);
    if(source.group.active===id)source.group.active=source.group.panels[0];
    if(!source.group.panels.length)state[source.side].splice(state[source.side].indexOf(source.group),1);
    if(mode==='tab'&&destination&&destination.panels.length){destination.panels.splice(index,0,id);destination.active=id;destination.collapsed=false;}
    else{let position=destination?state[side].indexOf(destination):state[side].length;if(position<0)position=state[side].length;else if(destination&&mode==='after')position++;
      state[side].splice(position,0,{panels:[id],active:id,collapsed:false,weight:source.group.weight});}
    state.hidden=state.hidden.filter(x=>x!==id);build();persist();
  }
  function beginDrag(event,id){
    if(event.button!==0)return;const sx=event.clientX,sy=event.clientY,controller=new AbortController(),options={capture:true,signal:controller.signal};let active=false,target=null,ghost=null,mark=null;
    drag?.();
    const beforeVisibility={left:isSidebarOpen('left'),right:isSidebarOpen('right')};
    function finish(accept){controller.abort();drag=null;ghost?.remove();mark?.remove();document.body.classList.remove('moving-panel');
      if(active){const swallow=e=>{e.preventDefault();e.stopImmediatePropagation();};document.addEventListener('click',swallow,{capture:true,once:true});setTimeout(()=>document.removeEventListener('click',swallow,true),0);}
      if(accept&&target)move(id,target.side,target.id,target.mode,target.tabIndex);
      else if(active)for(const side of ['left','right'])if(isSidebarOpen(side)!==beforeVisibility[side])setSidebarOpen(side,beforeVisibility[side]);
    }
    drag=()=>finish(false);
    window.addEventListener('pointermove',e=>{if(e.pointerId!==event.pointerId)return;if(!(e.buttons&1)){finish(false);return;}if(!active&&Math.hypot(e.clientX-sx,e.clientY-sy)<6)return;
      e.preventDefault();e.stopPropagation();if(!active){active=true;cancelValueLadder();cancelConnection();closeCreator();document.body.classList.add('moving-panel');ghost=el('div',{class:'workspace-drag-label'},title(id));mark=el('div',{class:'workspace-drop-mark'});document.body.append(ghost,mark);}
      ghost.style.left=e.clientX+14+'px';ghost.style.top=e.clientY+10+'px';
      if(!matchMedia('(max-width:800px)').matches){if(e.clientX<28&&!isSidebarOpen('left'))setSidebarOpen('left',true);if(e.clientX>innerWidth-28&&!isSidebarOpen('right'))setSidebarOpen('right',true);}
      target=null;mark.hidden=true;
      for(const [side,host]of Object.entries(hosts)){const rect=host.getBoundingClientRect();if(!host.getClientRects().length||e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)continue;
        const group=[...host.querySelectorAll('.workspace-group')].find(g=>{const r=g.getBoundingClientRect();return e.clientY>=r.top&&e.clientY<=r.bottom;});
        const r=group?.getBoundingClientRect()||rect,bar=group?.querySelector('.workspace-tabs'),barRect=bar?.getBoundingClientRect();
        const overTabs=barRect&&e.clientY>=barRect.top+3&&e.clientY<=barRect.bottom;
        const ratio=(e.clientY-r.top)/r.height,mode=overTabs?'tab':group?(ratio<.24?'before':ratio>.76?'after':'tab'):'after';
        target={side,id:group?.dataset.workspaceGroup||null,mode};mark.hidden=false;mark.dataset.mode=mode;
        if(overTabs){
          if(e.clientX<barRect.left+24)bar.scrollLeft-=12;else if(e.clientX>barRect.right-40)bar.scrollLeft+=12;
          const tabs=[...bar.querySelectorAll('[data-workspace-panel]')],next=tabs.find(button=>{const b=button.getBoundingClientRect();return e.clientX<b.left+b.width/2;}),last=tabs.at(-1);
          const destination=locate(target.id).group;
          target.tabIndex=next?destination.panels.indexOf(next.dataset.workspacePanel):destination.panels.length;
          const x=next?next.getBoundingClientRect().left:last.getBoundingClientRect().right;
          Object.assign(mark.style,{left:Math.max(barRect.left+1,Math.min(barRect.right-4,x))-1+'px',top:barRect.top+3+'px',width:'3px',height:barRect.height-6+'px'});mark.textContent='';mark.dataset.mode='insert';
        }else{
          const h=mode==='tab'||!group?r.height:Math.min(44,r.height*.24),y=mode==='after'&&group?r.bottom-h:r.top;
          Object.assign(mark.style,{left:r.left+2+'px',top:y+2+'px',width:r.width-4+'px',height:Math.max(4,h-4)+'px'});mark.textContent=t(mode==='tab'?'layout.dropTab':mode==='before'?'layout.dropBefore':'layout.dropAfter');
        }
        break;
      }
    },options);
    window.addEventListener('pointerup',e=>{if(e.pointerId===event.pointerId){if(active){e.preventDefault();e.stopPropagation();}finish(active);}},options);
    window.addEventListener('pointercancel',()=>finish(false),options);window.addEventListener('blur',()=>finish(false),options);window.addEventListener('resize',()=>finish(false),options);
    window.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();finish(false);}},options);
  }
  function apply(value){state=validate(value);restoring=true;drag?.();write('sgrapeSidebarWidths',state.widths);build();
    if(!matchMedia('(max-width:800px)').matches)for(const side of ['left','right'])setSidebarOpen(side,state.visibility[side]);
    window.dispatchEvent(new Event('workspacewidthschange'));restoring=false;persist();}
  const dialog=el('dialog',{id:'layoutdialog','aria-labelledby':'layoutheading'});document.body.append(dialog);
  function manager(){
    closeMenu();
    dialog.replaceChildren();const heading=el('div',{class:'layout-heading'}),close=el('button',{type:'button','aria-label':t('action.close')},'×');close.onclick=()=>dialog.close();heading.append(el('strong',{id:'layoutheading'},t('layout.title')),close);dialog.append(heading,el('p',{class:'muted'},t('layout.hint')));
    const arrangement=el('div',{class:'layout-arrangement'});
    for(const id of ids){const row=el('label',{class:'layout-row'}),select=el('select',{'aria-label':title(id)}),found=locate(id);
      for(const side of ['left','right']){
        const group=el('optgroup',{label:t('layout.'+side)});
        const separate=el('option',{value:side+':new'},t('layout.separate'));if(found.side===side&&found.group.panels.length===1)separate.selected=true;group.append(separate);
        for(const g of state[side])if(g.panels.some(x=>x!==id)){const option=el('option',{value:side+':'+g.panels[0]},t('layout.tabWith')+' '+g.panels.filter(x=>x!==id).map(title).join(' / '));if(g===found.group)option.selected=true;group.append(option);}select.append(group);
      }
      select.onchange=()=>{const [side,target]=select.value.split(':');move(id,side,target==='new'?null:target,target==='new'?'after':'tab');manager();};
      row.append(el('span',{},title(id)),select);
      for(const [direction,label]of [[-1,'↑'],[1,'↓']]){const button=el('button',{type:'button','aria-label':t(direction<0?'layout.moveUp':'layout.moveDown')+' '+title(id)},label);button.onclick=()=>{const f=locate(id),g=state[f.side][f.index+direction];if(g)move(id,f.side,g.panels[0],direction<0?'before':'after');manager();};button.disabled=!state[found.side][found.index+direction];row.append(button);}
      if(found.group.panels.length>1)for(const direction of [-1,1]){const index=found.group.panels.indexOf(id),button=el('button',{type:'button',class:'layout-tab-step','aria-label':t(direction<0?'layout.tabEarlier':'layout.tabLater')+' '+title(id)},direction<0?'←':'→');button.disabled=index+direction<0||index+direction>=found.group.panels.length;button.onclick=()=>{move(id,found.side,found.group.panels[0],'tab',index+(direction<0?-1:2));manager();};row.append(button);}
      arrangement.append(row);
    }
    dialog.append(arrangement);
    const saveRow=el('div',{class:'layout-save'}),name=el('input',{id:'layoutname',maxlength:'80',placeholder:t('layout.name'),'aria-label':t('layout.name')}),save=el('button',{type:'button'},t('layout.save'));
    save.onclick=()=>{const label=name.value.trim();if(!label){name.focus();return;}if(presets.some(p=>p.name===label)){name.setCustomValidity(t('layout.duplicate'));name.reportValidity();return;}persist();presets.push({name:label,layout:copy(state)});write(presetsKey,presets);manager();};name.oninput=()=>name.setCustomValidity('');saveRow.append(name,save);dialog.append(saveRow);
    const list=el('div',{class:'layout-presets'}),defaultRow=el('div',{class:'layout-preset'}),reset=el('button',{type:'button'},t('layout.restore'));reset.onclick=()=>{apply(defaults());manager();};defaultRow.append(el('strong',{},t('layout.default')),reset);list.append(defaultRow);
    for(const item of presets){const row=el('div',{class:'layout-preset'});row.append(el('span',{},item.name));
      const rename=el('button',{type:'button'},t('layout.rename'));rename.onclick=()=>{
        const entry=el('input',{value:item.name,maxlength:80,'aria-label':t('layout.name')}),save=el('button',{type:'button'},t('layout.save')),cancel=el('button',{type:'button'},t('action.close'));
        save.onclick=()=>{const name=entry.value.trim();if(!name||presets.some(p=>p!==item&&p.name===name)){entry.setCustomValidity(t('layout.duplicate'));entry.reportValidity();return;}item.name=name;write(presetsKey,presets);manager();};entry.oninput=()=>entry.setCustomValidity('');entry.onkeydown=e=>{if(e.key==='Enter')save.click();if(e.key==='Escape'){e.preventDefault();e.stopPropagation();manager();}};cancel.onclick=manager;
        row.replaceChildren(entry,save,cancel);entry.focus();entry.select();
      };row.append(rename);
      for(const [label,fn]of [['layout.apply',()=>apply(item.layout)],['layout.update',()=>{persist();item.layout=copy(state);write(presetsKey,presets);} ],['layout.delete',()=>{presets=presets.filter(p=>p!==item);write(presetsKey,presets);} ]]){const button=el('button',{type:'button'},t(label));button.onclick=()=>{fn();manager();};row.append(button);}list.append(row);
    }
    dialog.append(list);
    const transfer=el('div',{class:'layout-transfer'}),exportButton=el('button',{type:'button'},t('layout.export')),importButton=el('button',{type:'button'},t('layout.import')),file=el('input',{type:'file',accept:'.json,application/json',hidden:true});
    exportButton.onclick=()=>{persist();const blob=new Blob([JSON.stringify({format:'TD-Grape Layout',version:1,current:state},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=el('a',{href:url,download:'TD-Grape-layout.json'});a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
    importButton.onclick=()=>file.click();file.onchange=async()=>{try{const source=file.files[0];if(!source||source.size>262144)throw Error(t('layout.invalid'));const value=JSON.parse(await source.text());if(value.format!=='TD-Grape Layout'||value.version!==1)throw Error(t('layout.invalid'));const imported=validate(value.current);apply(imported);manager();}catch(error){status(error.message,true);}};
    transfer.append(exportButton,importButton,file);dialog.append(transfer,el('p',{class:'muted'},t('layout.local')));
    if(!dialog.open)dialog.showModal();
  }
  const menuButton=$('#workspacelayout'),menu=el('div',{id:'layoutmenu',role:'menu',hidden:true,'aria-label':t('layout.title')});document.body.append(menu);
  menuButton.setAttribute('aria-haspopup','menu');menuButton.setAttribute('aria-controls','layoutmenu');menuButton.setAttribute('aria-expanded','false');
  function closeMenu(focus=false){menu.hidden=true;menuButton.setAttribute('aria-expanded','false');if(focus)menuButton.focus();}
  function showMenu(){
    closeCreator();menu.replaceChildren();menu.hidden=false;menuButton.setAttribute('aria-expanded','true');
    const heading=key=>menu.append(el('div',{class:'layout-menu-heading',role:'presentation'},t(key)));
    function choice(label,action,checked=null){const button=el('button',{type:'button',role:checked===null?'menuitem':'menuitemcheckbox'},label);if(checked!==null)button.setAttribute('aria-checked',String(checked));button.onclick=action;menu.append(button);return button;}
    heading('layout.panels');
    for(const id of ids)choice(title(id),()=>{if(state.hidden.includes(id)){state.hidden=state.hidden.filter(x=>x!==id);const found=locate(id);found.group.active=id;found.group.collapsed=false;setSidebarOpen(found.side,true);}else state.hidden.push(id);build();persist();showMenu();[...menu.querySelectorAll('button')][ids.indexOf(id)].focus();},!state.hidden.includes(id));
    heading('layout.presets');
    choice(t('layout.default'),()=>{apply(defaults());closeMenu(true);});
    for(const item of presets)choice(item.name,()=>{apply(item.layout);closeMenu(true);});
    menu.append(el('hr',{role:'separator'}));
    choice(t('layout.save'),()=>{manager();$('#layoutname').focus();});choice(t('layout.manage'),manager);
    const r=menuButton.getBoundingClientRect();Object.assign(menu.style,{left:Math.max(8,Math.min(innerWidth-menu.offsetWidth-8,r.right-menu.offsetWidth))+'px',top:Math.min(r.bottom+5,innerHeight-menu.offsetHeight-8)+'px'});
  }
  menuButton.onclick=()=>{if(menu.hidden){showMenu();menu.querySelector('button')?.focus();}else closeMenu();};
  menu.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeMenu(true);return;}const buttons=[...menu.querySelectorAll('button')],i=buttons.indexOf(document.activeElement);if(['ArrowUp','ArrowDown','Home','End'].includes(e.key)){e.preventDefault();buttons[e.key==='Home'?0:e.key==='End'?buttons.length-1:(i+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus();}if(e.key==='Tab')closeMenu();};
  document.addEventListener('pointerdown',e=>{if(!menu.hidden&&!menu.contains(e.target)&&!menuButton.contains(e.target))closeMenu();});
  window.addEventListener('resize',()=>closeMenu());

  build();restoring=true;write('sgrapeSidebarWidths',state.widths);if(!matchMedia('(max-width:800px)').matches)for(const side of ['left','right'])setSidebarOpen(side,state.visibility[side]);restoring=false;
  window.addEventListener('workspacepreferenceschange',persist);window.addEventListener('sidebarvisibilitychange',persist);
  return {move,apply,snapshot:()=>copy(state),closeBrowser(){setSidebarOpen(locate('browser').side,false);},reveal(id){state.hidden=state.hidden.filter(x=>x!==id);const found=locate(id);found.group.active=id;found.group.collapsed=false;setSidebarOpen(found.side,true);build();persist();},translate(){build();if(dialog.open)manager();if(!menu.hidden)showMenu();},manager};
}

/* Inputs are a source inventory. Graph nodes reference these identities; native
   Uniform values/modes continue to belong to the actual GLSL OP. */
let nativeSourceSnapshot=null,nativeSourceBusy=false,nativeSourcePolling=false,nativeSourceError='',nativeSourceRetryAt=0,selectedInputId=null;
const inputPresets={time:['uTime','me.time.seconds'],frame:['uFrame','me.time.frame'],absTime:['uAbsTime','absTime.seconds'],absFrame:['uAbsFrame','absTime.frame']};
function sourceReferences(id){return [...Object.values(graph.stages),...(graph.functions||[]).map(f=>f.graph)].flatMap(g=>g.nodes).filter(n=>n.params?.declarationId===id||n.params?.inputId===id);}
function sourceReady(){return nativeSourceSnapshot?.enabled&&!nativeSourceError&&!dirty&&!submitBusy&&!nativeSourceBusy&&nativeSourceSnapshot.revision===revision&&!readonly;}
function selectInputSource(id){
  if(!allInputSources().some(d=>d.id===id))return;
  helpContext='node';selectedInputId=id;selected=null;selectedEdge=null;selection.clear();cancelConnection();closeCreator();
  workspaceLayout?.reveal('parameters');render();
}
function inputReference(id,x=null,y=null){
  const decl=allInputSources().find(d=>d.id===id),d=decl&&catalog.find(d=>d.key===decl.kind);if(!d)return;
  const rect=$('#canvas').getBoundingClientRect(),p=graphPoint(x??rect.left+rect.width/2,y??rect.top+rect.height/2);if(!p)return;
  change(()=>{selectedInputId=null;const n=instantiate(d,p.x,p.y,null,{declarationId:id});selectNode(n);});
}
function receiveNativeSources(data){
  if(data.revision<revision)return; // A pre-Apply poll must not roll back its result.
  nativeSourceSnapshot=data;
  const live=new Set(data.uniforms.filter(r=>!r.missing&&!r.pending).map(r=>r.id));
  rememberNativeInputSources((data.declarations||data.graph?.declarations||[]).filter(d=>live.has(d.id)));
  if(data.revision!==revision&&!dirty&&!submitBusy&&data.graph){
    graph=clone(data.graph);revision=data.revision;past=[];future=[];render();
    if(data.sourceChanged){mark();}else{rememberSavedGraph(graph);renderGraphSaveState();}
  }
  renderNativeSources();
}
async function refreshNativeSources(){
  if(!graph||readonly||nativeSourcePolling||nativeSourceBusy||document.hidden||submitBusy||Date.now()<nativeSourceRetryAt)return;
  nativeSourcePolling=true;
  try{const shader=shaderChoice?.id;const data=await api('sources');if(shader!==shaderChoice?.id)return;nativeSourceError='';receiveNativeSources(data);}
  catch(e){nativeSourceError=e.status===404?t('sources.connectionUnsupported'):e.message;nativeSourceRetryAt=Date.now()+5000;renderNativeSourceValues();}
  finally{nativeSourcePolling=false;}
}
async function nativeSourceRequest(endpoint,body){
  if(!sourceReady())return null;
  nativeSourceBusy=true;renderNativeSourceValues();let result=null;
  try{result=await api(endpoint,{...body,revision:nativeSourceSnapshot.revision});nativeSourceError='';receiveNativeSources(result);}
  catch(e){nativeSourceError=e.message;status(e.message,true);}
  finally{nativeSourceBusy=false;renderNativeSourceValues();await refreshNativeSources();}
  return result;
}
function renderNativeSourceValues(){
  const ready=sourceReady();
  for(const card of document.querySelectorAll('#inspector [data-native-source]')){
    const row=nativeSourceSnapshot?.uniforms.find(r=>r.id===card.dataset.nativeSource);if(!row)continue;
    for(const entry of card.querySelectorAll('[data-source-component]')){
      const item=row.components[Number(entry.dataset.sourceComponent)];entry.disabled=!ready||!item?.writable;
      if(document.activeElement!==entry&&!entry.numericGestureActive){entry.setSyncedValue(item?.value);entry.sourceExpected=item?clone(item):null;}
      entry.title=item?.expression||item?.mode||'';
    }
    for(const label of card.querySelectorAll('[data-source-mode]')){
      const item=row.components[Number(label.dataset.sourceMode)];label.textContent=item?.mode==='CONSTANT'?t('inputs.valueMode'):item?.mode||'';label.title=item?.binding||item?.expression||'';
    }
    for(const entry of card.querySelectorAll('[data-source-expression]')){
      const item=row.components[Number(entry.dataset.sourceExpression)];entry.disabled=!ready||!item?.modeWritable;
      if(document.activeElement!==entry){entry.setSyncedValue(item?.expression||'');entry.sourceExpected=item?.modeExpected;}
    }
    for(const button of card.querySelectorAll('[data-source-freeze]'))button.disabled=!ready||!row.components[Number(button.dataset.sourceFreeze)]?.modeWritable;
    const state=card.querySelector('.native-source-state');if(state)state.textContent=row.pending?t('sources.enable'):row.missing?t('sources.missing'):row.components.some(c=>!c.writable)?t('uniform.driven'):t('uniform.synced');
  }
  for(const entry of document.querySelectorAll('#inspector [data-input-name]')){
    const row=nativeSourceSnapshot?.uniforms.find(r=>r.id===entry.dataset.inputName);entry.disabled=readonly||(row&&!row.pending&&(!ready||!row.nameWritable));
  }
  for(const entry of document.querySelectorAll('#inspector [data-source-remove]'))entry.disabled=!ready;
  for(const item of $('#sourcecreate').querySelectorAll('input,select,button'))item.disabled=readonly;
  if($('#sourcekind'))$('#sourcekind').disabled=readonly;
  if($('#sourcetype'))$('#sourcetype').disabled=readonly||!['uniform','constant'].includes($('#sourcekind').value);
  if($('#sourcekind').value==='top_input'){$('#sourcename').value='sTD2DInputs['+topInputsView().length+']';$('#sourcename').disabled=true;}
  $('#sourceparameters').hidden=!localViewerEntry;
  for(const option of $('#sourcekind').options)option.hidden=editorTarget==='top'?option.value==='sampler':option.value==='top_input';
  $('#sourcestatus').textContent=nativeSourceError||(!nativeSourceSnapshot?.enabled?t('sources.enable'):dirty||nativeSourceSnapshot.revision!==revision?t('sources.pending'):(nativeSourceSnapshot.issues||[]).map(i=>i.message).join('\n'));
  for(const item of document.querySelectorAll('[data-input-reference]'))item.disabled=readonly;
  for(const item of document.querySelectorAll('[data-source-custom]'))item.disabled=!ready;
}
function nativeInputFields(box,decl){
  const row=nativeSourceSnapshot?.uniforms.find(r=>r.id===decl.id);
  const card=el('section',{'data-native-source':decl.id,class:'native-input-fields'});box.append(card);
  if(!row||row.pending){card.append(el('p',{class:'muted'},t('sources.pending')));return;}
  const count=typeContract?.types?.[decl.type]?.components||1;
  if(!row.missing){
    const values=el('div',{class:'source-components'});
    row.components.forEach((item,index)=>{
      const entry=input(item.value,value=>nativeSourceRequest('source-value',{id:decl.id,component:index,value,expected:entry.sourceExpected}),'number');
      entry.dataset.sourceComponent=index;entry.sourceExpected=clone(item);entry.setAttribute('aria-label',decl.name+' '+'XYZW'[index]);
      const f=field('XYZW'[index],entry);if(index>=count)f.classList.add('source-dormant');values.append(f);
    });card.append(values);
    const drivers=el('details',{class:'input-drivers'});drivers.append(el('summary',{},t('inputs.drivers')));
    row.components.forEach((item,index)=>{
      const line=el('div',{class:'source-driver'}),expr=input(item.expression||'',expression=>nativeSourceRequest('source-edit',{action:'driver',id:decl.id,component:index,expression,expected:expr.sourceExpected}));
      expr.dataset.sourceExpression=index;expr.sourceExpected=item.modeExpected;expr.placeholder=t('inputs.expression');expr.setAttribute('aria-label',decl.name+' '+'XYZW'[index]+' Python');
      const freeze=el('button',{'data-source-freeze':index},t('inputs.freeze'));
      freeze.onclick=()=>{const live=nativeSourceSnapshot?.uniforms.find(r=>r.id===decl.id)?.components[index];nativeSourceRequest('source-edit',{action:'driver',id:decl.id,component:index,expression:'',expected:live?.modeExpected});};
      line.append(field('XYZW'[index],expr),el('small',{'data-source-mode':index}),freeze);drivers.append(line);
    });drivers.append(el('p',{class:'muted'},t('inputs.driverHint')));card.append(drivers);
  }
  card.append(el('p',{class:'muted native-source-state'}));renderNativeSourceValues();
}
function inputSourceInspector(box,decl){
  const heading=el('div',{class:'input-inspector-title'});heading.append(el('strong',{},decl.name),el('small',{},decl.kind==='uniform'?'Uniform · '+decl.type:(decl.kind==='constant'?'Constant':'Sampler')+' · '+decl.type));box.append(heading);
  const row=nativeSourceSnapshot?.uniforms.find(r=>r.id===decl.id);
  const rename=input(decl.name,name=>{
    if(!/^[A-Za-z][A-Za-z0-9_]{0,47}$/.test(name)||/^(gl_|TD|sg_|sTD)/.test(name)||graph.declarations.some(d=>d.id!==decl.id&&d.name===name)){status(t('inputs.invalidName'),true);inspector();return;}
    if(decl.kind==='uniform'&&row&&!row.pending){nativeSourceRequest('source-edit',{action:'rename',id:decl.id,name,expected:row.expected});}
    else changeDeclaration(()=>decl.name=name);
  });rename.dataset.sourceName='true';rename.dataset.inputName=decl.id;rename.disabled=readonly||(decl.kind==='uniform'&&row&&!row.pending&&(!sourceReady()||!row.nameWritable));box.append(field(t('declaration.name'),rename));
  if(decl.kind==='uniform'){
    box.append(field(t('node.type'),select(['float','vec2','vec3','vec4'].map(v=>[v,v]),decl.type,value=>changeDeclaration(()=>{decl.type=value;decl.value=shapedValue(decl.value,value);}))),el('small',{class:'muted'},row?.sequence==='color'?t('inputs.nativeColor'):t('inputs.nativeVector')));
    nativeInputFields(box,decl);
    const defaults=el('details',{class:'input-defaults'});defaults.append(el('summary',{},t('uniform.default')),numbers(decl.value,t('uniform.default'),value=>changeDeclaration(()=>decl.value=value)));box.append(defaults);
    const custom=el('button',{'data-source-custom':decl.id,class:'wide'},t('controls.fromUniform'));custom.onclick=()=>openUniformControl(decl.id);box.append(custom);
  }else if(decl.kind==='constant')constantFields(box,decl);
  else declarationFields(box,decl);
  const actions=el('div',{class:'source-actions'}),reference=el('button',{'data-input-reference':decl.id},t('sources.reference'));reference.onclick=()=>inputReference(decl.id);
  actions.append(reference);box.append(actions,el('p',{class:'muted'},t('inputs.references').replace('{count}',sourceReferences(decl.id).length)));
  if(decl.kind==='uniform'&&row&&!row.pending){
    const remove=el('button',{class:'wide danger','data-source-remove':decl.id},t(row.missing?'sources.restore':'sources.remove'));remove.disabled=!sourceReady();
    remove.onclick=()=>{const live=nativeSourceSnapshot.uniforms.find(r=>r.id===decl.id);if(!live.missing&&!confirm(t('sources.removeConfirm').replace('{name}',live.name).replace('{count}',sourceReferences(decl.id).length)))return;nativeSourceRequest('source-edit',{action:live.missing?'restore':'remove',id:decl.id,expected:live.expected}).then(()=>inspector());};box.append(remove);
  }
  else {
    const remove=el('button',{class:'wide danger'},t(decl.sourceMissing?'sources.restore':'sources.remove'));
    remove.onclick=()=>changeDeclaration(()=>{if(decl.sourceMissing)delete decl.sourceMissing;else if(sourceReferences(decl.id).length)decl.sourceMissing=true;else {graph.declarations=graph.declarations.filter(d=>d.id!==decl.id);selectedInputId=null;}});box.append(remove);
  }
  sourceLocations(box,decl.id);
  if(readonly)for(const field of box.querySelectorAll('input,select,button'))field.disabled=true;
  renderNativeSourceValues();
}
function sourceLocations(box,id){
  const refs=sourceReferences(id);if(!refs.length)return;
  const list=el('details',{class:'source-locations'});list.append(el('summary',{},t('inputs.locate')));
  for(const [st,data]of Object.entries(graph.stages))for(const n of data.nodes.filter(n=>refs.includes(n))){const button=el('button',{},st+' · '+(nodeLabel(n)||definition(n)?.label||n.id));button.onclick=()=>{stage=st;graphTrail=[];selectedInputId=null;selected=n.id;selection=new Set([n.id]);render();fit();};list.append(button);}box.append(list);
}
function topInputInspector(box,source){
  const slots=topInputsView(),index=slots.findIndex(s=>s.id===source.id),live=nativeSourceSnapshot?.topInputs?.find(s=>s.id===source.id);
  const edit=fn=>changeDeclaration(()=>{const slot=ensureTopInputs().find(s=>s.id===source.id);fn(slot);if(slot.id===graph.topInputLegacyId)for(const d of graph.declarations.filter(d=>d.source==='input:0'))d.defaultSource=slot.defaultSource;});
  box.append(el('strong',{},'sTD2DInputs['+index+']'),field(t('node.label'),input(source.label||'',name=>{if(name.length<=48&&!/[\x00-\x1f]/.test(name))edit(s=>s.label=name);})),el('p',{class:'muted'},t('inputs.topHint')));
  const value=source.defaultSource;
  box.append(field(t('texture.default'),select(textureOptions().filter(([key])=>key!=='input:0'),value.startsWith('op:')?'external':value,next=>edit(s=>{s.defaultSource=next==='external'?'op:/project1/texture':next;s.matchDefault=true;}))));
  if(value.startsWith('op:'))box.append(field(t('texture.path'),input(value.slice(3),next=>edit(s=>{s.defaultSource='op:'+next;s.matchDefault=true;}))));
  box.append(toggle(t('uniform.expose'),!!source.expose,next=>edit(s=>s.expose=next)));
  if(source.expose)box.append(field(t('uniform.publicName'),input(source.exposeName||'Input '+(index+1)+' Default TOP',next=>edit(s=>s.exposeName=next))));
  if(live)box.append(el('p',{class:'muted'},(live.connected?t('inputs.connected'):t('texture.default'))+' · '+live.path+' · '+live.width+' × '+live.height));
  const actions=el('div',{class:'source-actions'});
  for(const [label,offset]of [['↑',-1],['↓',1]]){const b=el('button',{'aria-label':t(offset<0?'inputs.moveUp':'inputs.moveDown')},label);b.disabled=readonly||index+offset<0||index+offset>=slots.length;b.onclick=()=>changeDeclaration(()=>{const slots=ensureTopInputs();[slots[index],slots[index+offset]]=[slots[index+offset],slots[index]];});actions.append(b);}
  const ref=el('button',{},t('sources.reference'));ref.disabled=readonly;ref.onclick=()=>inputReference(source.id);actions.append(ref);box.append(actions);
  const aliases=source.id===(graph.topInputLegacyId||slots[0].id)&&graph.declarations.some(d=>d.source==='input:0'),used=sourceReferences(source.id).length;
  const remove=el('button',{class:'wide danger'},t('sources.remove'));remove.disabled=readonly||!!used||aliases||!!live?.connected;remove.onclick=()=>changeDeclaration(()=>{graph.topInputs=ensureTopInputs().filter(s=>s.id!==source.id);if(graph.topInputLegacyId===source.id)delete graph.topInputLegacyId;selectedInputId=null;});box.append(remove);
  if(remove.disabled&&!readonly)box.append(el('p',{class:'muted'},t('inputs.topRemoveHint')));
  sourceLocations(box,source.id);
  if(readonly)for(const field of box.querySelectorAll('input,select,button'))field.disabled=true;
}
function installInputDrag(button,id){
  installCanvasItemDrag(button,()=>allInputSources().find(d=>d.id===id)?.name||'',(x,y)=>inputReference(id,x,y),()=>inputReference(id));
}
function installCanvasItemDrag(button,label,dropItem,clickItem){
  // Only the explicit reference handle captures touch; the inventory still scrolls.
  let suppressClick=0;
  button.onclick=()=>{if(performance.now()>suppressClick)clickItem();};
  button.onpointerdown=e=>{
    if(readonly||e.button!==0)return;e.preventDefault();e.stopPropagation();
    const start={x:e.clientX,y:e.clientY},pointer=e.pointerId,ghost=el('div',{class:'input-drag-preview'},label());let moved=false,done=false;
    button.setPointerCapture(pointer);
    const cancel=()=>finish(null),escape=ev=>{if(ev.key==='Escape'){ev.preventDefault();ev.stopImmediatePropagation();cancel();}},second=ev=>{if(ev.pointerId!==pointer)cancel();};
    function finish(ev){
      if(done)return;done=true;const drop=moved&&ev&&document.elementFromPoint(ev.clientX,ev.clientY)?.closest('#canvas');
      button.removeEventListener('pointermove',move);button.removeEventListener('pointerup',finish);button.removeEventListener('pointercancel',cancel);button.removeEventListener('lostpointercapture',cancel);document.removeEventListener('keydown',escape,true);document.removeEventListener('pointerdown',second,true);window.removeEventListener('blur',cancel);ghost.remove();$('#canvas').classList.remove('drop-ready');
      if(button.hasPointerCapture(pointer))button.releasePointerCapture(pointer);
      if(moved||!ev)suppressClick=performance.now()+500;
      if(drop)dropItem(ev.clientX,ev.clientY);
    }
    function move(ev){if(ev.pointerId!==pointer)return;if(Math.hypot(ev.clientX-start.x,ev.clientY-start.y)>8)moved=true;if(!moved)return;if(!ghost.isConnected)document.body.append(ghost);ghost.style.left=ev.clientX+12+'px';ghost.style.top=ev.clientY+12+'px';$('#canvas').classList.toggle('drop-ready',!!document.elementFromPoint(ev.clientX,ev.clientY)?.closest('#canvas'));}
    button.addEventListener('pointermove',move);button.addEventListener('pointerup',finish);button.addEventListener('pointercancel',cancel);button.addEventListener('lostpointercapture',cancel);document.addEventListener('keydown',escape,true);document.addEventListener('pointerdown',second,true);window.addEventListener('blur',cancel);
  };
}
function renderNativeSources(){
  const box=$('#nativeuniforms');if(!box||!graph)return;
  const query=normalizeSearch($('#inputsearch')?.value),decls=allInputSources().filter(d=>['uniform','sampler','constant','top_input'].includes(d.kind)&&normalizeSearch(d.name+' '+d.kind+' '+d.type).includes(query));
  const identity=JSON.stringify([language,decls.map(d=>[d.id,d.name,d.type,d.sourceMissing,d.kind,d.index]),selectedInputId]);
  if(box.dataset.sourceStructure!==identity&&!box.querySelector(':active')){
    box.dataset.sourceStructure=identity;box.replaceChildren();
    for(const kind of ['top_input','constant','uniform','sampler']){
      const group=decls.filter(d=>d.kind===kind);if(!group.length)continue;box.append(el('div',{class:'input-group-title'},({top_input:'TOP Inputs',constant:'Constants',uniform:'Uniforms',sampler:editorTarget==='top'?t('inputs.legacySamplers'):'Samplers'})[kind]));
      for(const decl of group){
        const card=el('div',{class:'input-source-row','data-input-source':decl.id}),pick=el('button',{class:'input-source-select','aria-pressed':String(selectedInputId===decl.id)});
        pick.append(el('span',{},decl.name),el('small',{},(kind==='top_input'?'['+decl.index+']':decl.type)+(decl.sourceMissing?' · '+t('sources.missing'):'')));pick.onclick=()=>selectInputSource(decl.id);
        const reference=el('button',{class:'input-reference','data-input-reference':decl.id,'aria-label':t('sources.reference')+' '+decl.name,title:t('inputs.dragReference')},'+');installInputDrag(reference,decl.id);card.append(pick,reference);box.append(card);
      }
    }
    if(!decls.length)box.append(el('p',{class:'muted'},query?t('create.empty'):t('inputs.empty')));
  }
  // Native row availability can arrive after an apply without changing graph revision.
  const active=selectedInputId||current().nodes.find(n=>n.id===selected)?.params?.declarationId;
  const row=nativeSourceSnapshot?.uniforms.find(r=>r.id===active),signature=JSON.stringify([active,row?.missing,row?.pending,row?.sequence,row?.components.map(c=>[c.mode,c.control,c.modeWritable])]);
  if($('#inspector').dataset.inputState!==signature&&!$('#inspector').contains(document.activeElement)){$('#inspector').dataset.inputState=signature;if(active)inspector();}
  renderNativeSourceValues();
}
function installNativeSources(){
  $('#inputsearch').oninput=renderNativeSources;
  $('#sourcekind').onchange=()=>{const kind=$('#sourcekind').value,preset=inputPresets[kind.slice(7)];$('#sourcename').value=uniqueInputName(preset?.[0]||(kind==='top_input'?'Input'+topInputsView().length:kind==='constant'?'cValue':kind==='sampler'?'uTexture':kind==='color'?'uColor':'uValue'));$('#sourcetype').value=['sampler','top_input'].includes(kind)?'sampler2D':kind==='color'?'vec4':'float';$('#sourcepresethint').textContent=preset?preset[1]:'';renderNativeSourceValues();};
  $('#sourcecreate').onsubmit=async e=>{
    e.preventDefault();const name=$('#sourcename').value.trim(),kind=$('#sourcekind').value;
    if(kind!=='top_input'&&(!/^[A-Za-z][A-Za-z0-9_]{0,47}$/.test(name)||/^(gl_|TD|sg_|sTD)/.test(name))){status(t('inputs.invalidName'),true);return;}
    let id;const changed=changeDeclaration(()=>{id=createInputDeclaration(['sampler','constant','top_input'].includes(kind)?kind:'uniform',kind==='color'?'vec4':kind.startsWith('preset:')?'float':$('#sourcetype').value,{name,...(kind==='color'?{nativeSequence:'color'}:kind.startsWith('preset:')?{preset:kind.slice(7)}:{})}).id;});if(changed)selectInputSource(id);
  };
  $('#sourceparameters').onclick=async()=>{try{await api('native-parameters',{});}catch(e){status(e.message,true);}};
  $('#canvas').addEventListener('pointerdown',()=>{selectedInputId=null;},true);
  setInterval(refreshNativeSources,1000);
}


/* COMP controls are a peer workspace panel. Native page/group identity and
   metadata come from TD; there is no duplicate browser parameter model. */
let customSnapshot=null,customBusy=false,customPolling=false,customError='',customRetryAt=0,customPage='';
function receiveCustomParameters(data){customSnapshot=data;renderCustomParameters();}
async function refreshCustomParameters(){
  if(!graph||readonly||customBusy||customPolling||document.hidden||submitBusy||Date.now()<customRetryAt)return;
  customPolling=true;const shader=shaderChoice?.id;
  try{const data=await api('custom-parameters');if(shader!==shaderChoice?.id)return;customError='';receiveCustomParameters(data);}
  catch(e){customError=e.status===404?t('sources.connectionUnsupported'):e.message;customRetryAt=Date.now()+5000;updateCustomValues();}
  finally{customPolling=false;}
}
async function customRequest(body){
  if(customBusy||dirty||submitBusy||readonly||!customSnapshot)return false;
  customBusy=true;updateCustomValues();const shader=shaderChoice?.id;
  try{const data=await api('custom-parameters',{revision:customSnapshot.revision,expectedPages:customSnapshot.expectedPages,...body});if(shader!==shaderChoice?.id)return false;customError='';receiveCustomParameters(data);await refreshNativeSources();return true;}
  catch(e){customError=e.message;status(e.message,true);return false;}
  finally{customBusy=false;updateCustomValues();}
}
function customReady(){return customSnapshot?.enabled&&!customError&&!dirty&&!submitBusy&&!customBusy&&!readonly&&customSnapshot.revision===revision;}
function customCurrent(name){return customSnapshot?.controls.find(g=>g.name===name);}
function updateCustomValues(){
  const ready=customReady(),box=$('#customcontrols');if(!box)return;
  $('#controlstatus').textContent=customError||(!customSnapshot?.enabled?t('sources.enable'):dirty||customSnapshot.revision!==revision?t('sources.pending'):t('controls.hint'));
  for(const card of box.querySelectorAll('[data-custom-control]')){
    const row=customCurrent(card.dataset.customControl);if(!row)continue;
    for(const entry of card.querySelectorAll('[data-control-field]')){
      const kind=entry.dataset.controlField,index=Number(entry.dataset.controlComponent),item=row.components[index];
      entry.disabled=!ready||(kind==='value'&&!item?.writable)||(kind==='style'&&!row.styleEditable);
      if(document.activeElement!==entry&&!entry.numericGestureActive){
        let value=kind==='value'?item.value:kind==='default'?item.default:kind==='style'?(row.style==='RGBA'?'rgba':'vec4'):row[kind];
        if(entry.setSyncedValue)entry.setSyncedValue(value);else entry.value=value;
        entry.customExpected=row.expected;entry.customExpectedValue=item?clone(item):null;
      }
    }
    for(const b of card.querySelectorAll('button'))b.disabled=!ready;
    card.querySelector('[data-custom-links]').textContent=row.sources.length?t('controls.linked').replace('{count}',row.sources.length):t('controls.unbound');
  }
  for(const element of $('#customcreate').querySelectorAll('input,select,button'))element.disabled=!ready||!customPage;
  $('#customnewpage').disabled=!ready;$('#custompageedit').disabled=!ready||!customPage;
}
function renderCustomParameters(){
  if(!customSnapshot){updateCustomValues();return;}
  const data=customSnapshot,box=$('#customcontrols');
  if(!data.pages.some(p=>p.name===customPage))customPage=data.pages[0]?.name||'';
  const pages=$('#custompage'),pageKey=JSON.stringify(data.pages.map(p=>p.name));
  if(pages.dataset.pages!==pageKey){pages.replaceChildren(...data.pages.map(p=>el('option',{value:p.name},p.name)));pages.dataset.pages=pageKey;}
  pages.value=customPage;
  const key=JSON.stringify([language,customPage,data.pages,data.controls.map(g=>[g.name,g.page,g.style,g.order,g.sources,g.components.map(p=>p.name)])]);
  if(box.dataset.structure===key||box.contains(document.activeElement)){updateCustomValues();return;}
  box.dataset.structure=key;box.replaceChildren();
  for(const row of data.controls.filter(g=>g.page===customPage)){
    const name=row.name,card=el('section',{class:'custom-control-card','data-custom-control':name});
    const heading=el('div',{class:'custom-control-heading'});heading.append(el('strong',{},name),el('small',{},row.style+(row.size>1?' '+row.size:'')));card.append(heading);
    function editField(kind,value,options=null){
      let entry;const commit=value=>customRequest({action:kind,name,[kind]:value,expected:entry.customExpected});
      entry=options?select(options,value,commit):input(value,commit);entry.dataset.controlField=kind;entry.customExpected=row.expected;return entry;
    }
    card.append(field(t('node.label'),editField('label',row.label)),field(t('controls.page'),editField('page',row.page,data.pages.map(p=>[p.name,p.name]))));
    if(row.size===4&&['Float','RGBA'].includes(row.style))card.append(field(t('controls.style'),editField('style',row.style==='RGBA'?'rgba':'vec4',[['vec4','Vector 4'],['rgba','RGBA']])));
    const values=el('div',{class:'custom-control-values'}),defaults=el('div',{class:'custom-control-values'});
    row.components.forEach((item,index)=>{
      for(const [kind,holder]of [['value',values],['default',defaults]]){
        let entry;entry=input(item[kind],value=>customRequest({action:kind,name,component:index,value,expected:entry.customExpected,expectedValue:entry.customExpectedValue}),typeof item[kind]==='number'?'number':'text');
        entry.dataset.controlField=kind;entry.dataset.controlComponent=index;entry.customExpected=row.expected;entry.customExpectedValue=clone(item);
        const label=row.size===1?t(kind==='value'?'controls.value':'controls.default'):row.style==='RGBA'?'RGBA'[index]:'XYZW'[index];entry.setAttribute('aria-label',name+' '+kind+' '+label);holder.append(field(label,entry));
      }
    });
    card.append(values);const details=el('details');details.append(el('summary',{},t('controls.defaults')),defaults);card.append(details);
    const actions=el('div',{class:'custom-control-actions'});
    for(const [direction,label]of [[-1,'↑'],[1,'↓']]){const b=el('button',{'aria-label':t(direction<0?'layout.moveUp':'layout.moveDown')+' '+name},label);b.onclick=()=>customRequest({action:'move',direction,name,expected:customCurrent(name).expected});actions.append(b);}
    if(row.sources.length){const b=el('button',{},t('controls.detach'));b.onclick=()=>customRequest({action:'detach',name,expected:customCurrent(name).expected});actions.append(b);}
    const remove=el('button',{},t('controls.remove'));remove.onclick=()=>{if(confirm(t('controls.removeConfirm').replace('{name}',customCurrent(name).label||name)))customRequest({action:'remove',name,expected:customCurrent(name).expected});};actions.append(remove);
    card.append(el('p',{class:'muted','data-custom-links':'true'}),actions);box.append(card);
  }
  if(!box.children.length)box.append(el('p',{class:'muted'},t('controls.empty')));
  updateCustomValues();
}
function customDialog(title){
  const dialog=$('#customdialog');dialog.replaceChildren();const head=el('div',{class:'custom-dialog-heading'}),close=el('button',{},t('action.close'));close.onclick=()=>dialog.close();head.append(el('strong',{},title),close);dialog.append(head);if(!dialog.open)dialog.showModal();return dialog;
}
function editCustomPage(create=false){
  if(!customReady())return;const dialog=customDialog(t(create?'controls.newPage':'controls.editPage')),page=customSnapshot.pages.find(p=>p.name===customPage),name=input(create?'':customPage,()=>{});
  dialog.append(field(t('controls.page'),name));
  const save=el('button',{},t('controls.save'));save.disabled=!create&&!page?.editable;save.onclick=async()=>{const label=name.value.trim();if(await customRequest({action:create?'page-create':'page-rename',page:customPage,name:label})){customPage=label;dialog.close();renderCustomParameters();}};dialog.append(save);
  if(!create){for(const [direction,label]of [[-1,'↑'],[1,'↓']]){const b=el('button',{'aria-label':t(direction<0?'layout.moveUp':'layout.moveDown')},label);b.disabled=!page.editable;b.onclick=async()=>{if(await customRequest({action:'page-move',page:customPage,direction}))dialog.close();};dialog.append(b);}
    const remove=el('button',{},t('controls.removePage'));remove.disabled=!page.editable||page.empty===false||customSnapshot.controls.some(c=>c.page===customPage);remove.onclick=async()=>{if(await customRequest({action:'page-remove',page:customPage}))dialog.close();};dialog.append(remove);}
}
async function openUniformControl(id){
  await refreshCustomParameters();await refreshNativeSources();
  if(!customReady()){status(customError||t('sources.pending'),true);return;}
  const existing=customSnapshot.controls.find(g=>g.sources.includes(id));
  if(existing){customPage=existing.page;workspaceLayout.reveal('controls');renderCustomParameters();return;}
  const row=nativeSourceSnapshot?.uniforms.find(r=>r.id===id);if(!row||row.missing)return;
  const dialog=customDialog(t('controls.fromUniform')),page=select(customSnapshot.pages.map(p=>[p.name,p.name]),customPage,()=>{});
  dialog.append(el('p',{},row.name),field(t('controls.page'),page));
  const add=el('button',{class:'primary'},t('controls.add'));add.disabled=!customSnapshot.pages.length;add.onclick=async()=>{if(await customRequest({action:'bind',id,page:page.value,sourceExpected:row.expected})){customPage=page.value;dialog.close();workspaceLayout.reveal('controls');renderCustomParameters();}};
  const create=el('button',{},t('controls.newPage'));create.onclick=()=>editCustomPage(true);dialog.append(add,create);
}
function installCustomParameters(){
  $('#custompage').onchange=()=>{customPage=$('#custompage').value;renderCustomParameters();};
  $('#customnewpage').onclick=()=>editCustomPage(true);$('#custompageedit').onclick=()=>editCustomPage(false);
  $('#customcreate').onsubmit=async e=>{e.preventDefault();if(await customRequest({action:'create',name:$('#customname').value.trim(),style:$('#customstyle').value,page:customPage}))$('#customname').value='';};
  setInterval(refreshCustomParameters,1000);
}
