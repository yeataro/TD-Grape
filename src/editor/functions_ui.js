let graphTrail=[],functionLibrary=[],personalLibrary={items:[],issues:[],folder:''},personalBusy=false;

function librarySources(){return [...functionLibrary,...personalLibrary.items];}
async function refreshPersonalLibrary(){
  if(personalBusy)return;personalBusy=true;renderLibrary();
  try{personalLibrary=await api('personal');status(personalLibrary.issues.length?t('personal.partial'):t('personal.refreshed'),!!personalLibrary.issues.length);}
  catch(e){status(e.message,true);}
  finally{personalBusy=false;renderLibrary();}
}
async function savePersonalFunction(f){
  if(readonly||personalBusy||!f)return;
  personalBusy=true;renderLibrary();
  const snapshot=clone(graph),id=f.id;
  try{
    const result=await api('personal-save',{graph:snapshot,functionId:id});personalLibrary=result.library;
    status(result.created?t('personal.saved'):t('personal.reused'));
  }catch(e){
    status(e.message.includes('must be self-contained')?t('personal.external'):e.message,true);
  }finally{personalBusy=false;renderLibrary();}
}
const currentFunction=()=>FunctionModel.find(graph,graphTrail.at(-1));
function nodeDefinition(n){
  if(n.definitionUuid===FunctionModel.CALL){
    const f=FunctionModel.find(graph,n.params.functionId);if(!f)return null;
    return {key:'function_call',label:f.name,descriptionKey:f.scope==='local'?'help.function':(f.descriptionKey||'help.function'),inputs:Object.fromEntries(f.inputs.map(p=>[p.id,p.type])),outputs:Object.fromEntries(f.outputs.map(p=>[p.id,p.type])),stages:f.stages,defaults:{functionId:f.id},definitionUuid:FunctionModel.CALL,functionId:f.id};
  }
  if([FunctionModel.INPUT,FunctionModel.OUTPUT].includes(n.definitionUuid)){
    const f=currentFunction();if(!f)return null;const input=n.definitionUuid===FunctionModel.INPUT;
    return {definitionUuid:n.definitionUuid,key:input?'function_input':'function_output',label:input?'Function Input':'Function Output',descriptionKey:'help.functionPorts',inputs:input?{}:Object.fromEntries(f.outputs.map(p=>[p.id,p.type])),outputs:input?Object.fromEntries(f.inputs.map(p=>[p.id,p.type])):{},stages:f.stages};
  }
  return catalog.find(d=>d.definitionUuid===n.definitionUuid);
}
function prepareSemanticEdit(){
  const f=currentFunction();if(!f||f.scope==='local')return;
  const map=FunctionModel.localize(graph,f.id);graphTrail=graphTrail.map(id=>map.get(id)||id);
}
function tidyTrail(){while(graphTrail.length&&!FunctionModel.find(graph,graphTrail.at(-1)))graphTrail.pop();}
function navigateGraph(depth){
  graphTrail=graphTrail.slice(0,Math.max(0,depth));selected=null;selection.clear();selectedEdge=null;cancelConnection();closeCreator();render();fit();
}
function enterFunction(n){
  const f=FunctionModel.find(graph,n.params.functionId);if(!f)return;
  if(graphTrail.includes(f.id)){status(t('function.cycle'),true);return;}
  graphTrail.push(f.id);selected=null;selection.clear();selectedEdge=null;cancelConnection();closeCreator();render();fit();
}
function renderNavigation(){
  renderGraphEditActions();
  tidyTrail();const nav=$('#graphpath');nav.replaceChildren();$('#graphup').disabled=graphTrail.length===0;
  const crumbs=graphTrail.map(id=>FunctionModel.find(graph,id)?.name||'?');
  crumbs.forEach((label,index)=>{const depth=index+1;if(index)nav.append(el('span',{class:'graph-separator'},'/'));
    const b=el('button',{'aria-current':depth===graphTrail.length?'location':'false'},label);b.disabled=depth===graphTrail.length;b.onclick=()=>navigateGraph(depth);nav.append(b);
  });
  const f=currentFunction();$('#functionscope').textContent=f?(f.scope==='local'?t('function.local'):t('function.source')):'';
  $('#group').disabled=readonly||!current().nodes.some(n=>selection.has(n.id)&&canDeleteNode(n)&&!SubgraphSourcePolicy.isSource(n,catalog));
}
function canDeleteNode(n){return !['pixel_out','vertex_out','function_input','function_output'].includes(definition(n)?.key);}
function functionEntry(f,source=false){
  return {key:source?'source:'+f.scope+':'+f.id+':'+(f.source?.version||''):'function:'+f.id,label:f.name,stages:f.stages,inputs:Object.fromEntries(f.inputs.map(p=>[p.id,p.type])),outputs:Object.fromEntries(f.outputs.map(p=>[p.id,p.type])),defaults:{functionId:f.id},definitionUuid:FunctionModel.CALL,functionId:f.id,source:source?f:null,category:f.scope==='personal'?'personal':'functions'};
}
function nodeTypeLabel(d,params=d?.defaults){
  if(d?.key==='comment')return 'Note';
  if(['scalar','vector','matrix'].includes(d?.key))return params?.fixedType||({scalar:'Scalar',vector:'Vector',matrix:'Matrix'})[d.key];
  const label=d?.label||t('node.unknown');
  return ['vec2','vec3','vec4'].includes(d?.key)?label+' · Constant':label;
}
function availableEntries(){
  const entries=catalog.filter(d=>d.stages.includes(stage)&&!d.key.endsWith('_out')&&!['texture','float','vec2','vec3','vec4'].includes(d.key)&&(editorTarget==='top'?d.key!=='sampler':d.key!=='top_input')).flatMap(d=>{
    if(d.key==='builtin_source')return builtinSourceEntries(d);
    if(['scalar','vector','matrix'].includes(d.key))return [{...d,label:nodeTypeLabel(d),category:nodeCategory(d)},...selectableNodeTypes(d).map(type=>({...d,entryKey:type,fixedType:type,label:type,descriptionKey:({scalar:'help.fixedScalar',vector:'help.fixedVector',matrix:'help.fixedMatrix'})[d.key],defaults:{...d.defaults,...(d.key==='matrix'?{values:matrixReshapeValue(d.defaults.values,d.defaults.type,type)}:{}),type,fixedType:type},category:nodeCategory(d)}))];
    return [{...d,label:nodeTypeLabel(d),category:nodeCategory(d)}];
  });
  for(const f of librarySources().filter(f=>f.stages.includes(stage)&&(!f.targets||f.targets.includes(editorTarget))))entries.push(functionEntry(f,true));
  const sources=librarySources().flatMap(f=>[f,...(f.dependencies||[])]);
  for(const f of (graph.functions||[]).filter(f=>f.stages.includes(stage)&&!graphTrail.includes(f.id))){
    if(f.scope==='local'||!sources.some(s=>s.source?.id===f.source?.id&&s.source?.version===f.source?.version))entries.push(functionEntry(f));
  }
  return entries.filter(d=>!d.functionId||!graphTrail.includes(d.functionId));
}
function nodeSourceDeclaration(n){
  if(n?.params?.declarationId)return graph.declarations.find(d=>d.id===n.params.declarationId)||null;
  if(n?.params?.inputId)return topInputsView().find(d=>d.id===n.params.inputId)||null;
  return null;
}
function isSourceReferenceNode(n){return !!(n?.params&&('declarationId' in n.params||'inputId' in n.params||n.definitionUuid==='sgrape.builtin.builtin_source'));}
function nodeDisplayName(n){
  const source=nodeSourceDeclaration(n);if(source)return source.name;
  if(n.definitionUuid==='sgrape.builtin.builtin_source')return n.params.source;
  return customNodeNamesEnabled()&&n?.name?n.name:nodeTypeLabel(definition(n),n?.params);
}
function nodeCanvasTitle(n){
  return nodeDisplayName(n);
}
function nodeNameValid(value){
  return typeof value==='string'&&/^[A-Za-z][A-Za-z0-9_]{0,47}$/.test(value)&&!value.includes('__')&&
    !/^(gl_|TD|sTD|uTD|sg_|[iu]?sampler|[iu]?image|d?mat[234])/.test(value)&&!(typeContract?.glslCode?.reservedNames||[]).includes(value);
}
function uniqueNodeName(hint,n=null,nodes=current().nodes){
  let base=String(hint||'Node').replace(/[^A-Za-z0-9_]/g,'_').replace(/_+/g,'_').slice(0,38);
  if(!nodeNameValid(base))base='Node';
  const names=new Set(nodes.filter(x=>x!==n&&!isSourceReferenceNode(x)).map(x=>x.name).filter(Boolean));
  let index=1,name=base;while(names.has(name))name=base+'_'+index++;
  return name;
}
function assignCreatedNodeNames(nodes){
  for(const n of nodes){if(isSourceReferenceNode(n)){delete n.name;continue;}let hint=n.name;if(!hint){hint=nodeTypeLabel(definition(n),n.params);if(n.params?.fixedType)hint=hint[0].toUpperCase()+hint.slice(1);}n.name=uniqueNodeName(hint,n);}
}
function commitNodeName(n,raw){
  if(editorMutationBlocked()||isSourceReferenceNode(n))return false;
  const name=String(raw).trim().replace(/ +/g,'_');
  if(!nodeNameValid(name))throw Error(t('node.nameInvalid'));
  if(current().nodes.some(other=>other!==n&&!isSourceReferenceNode(other)&&other.name===name))throw Error(t('node.nameDuplicate'));
  if(name===n.name)return true;
  const changed=change(()=>n.name=name);if(changed)status(t('node.renamed'),false,{clearError:'operation'});return changed;
}
function nodeNameEditor(n,onDone=()=>{}){
  const wrapper=el('span',{class:'node-name-editor'}),entry=el('input',{type:'text','data-node-name':n.id,'aria-label':t('node.name'),autocomplete:'off',spellcheck:'false'}),error=el('small',{class:'node-name-error',role:'alert'});
  const original=n.name||uniqueNodeName(nodeTypeLabel(definition(n),n.params),n);entry.value=original;entry.maxLength=64;entry.disabled=readonly;let composing=false,finished=false;
  entry.hasPendingEdit=()=>!finished&&entry.value!==original;
  const clearNameError=()=>{if([t('node.nameInvalid'),t('node.nameDuplicate')].includes(persistentStatusError))status('',false,{clearError:'operation'});};
  const commit=()=>{if(composing||finished)return;finished=true;try{if(commitNodeName(n,entry.value)){clearNameError();onDone();}else finished=false;}catch(e){finished=false;error.textContent=e.message;entry.setAttribute('aria-invalid','true');status(e.message,true);}};
  const filter=()=>{const before=entry.value,start=entry.selectionStart,end=entry.selectionEnd,clean=value=>value.replace(/ /g,'_').replace(/[^A-Za-z0-9_]/g,'').slice(0,48);entry.value=clean(before);if(start!==null)entry.setSelectionRange(clean(before.slice(0,start)).length,clean(before.slice(0,end)).length);entry.removeAttribute('aria-invalid');error.textContent='';};
  entry.addEventListener('compositionstart',()=>{composing=true;});entry.addEventListener('compositionend',()=>{composing=false;filter();});entry.onblur=commit;
  entry.onkeydown=e=>{e.stopPropagation();if(e.isComposing||composing||e.keyCode===229)return;if(e.key==='Enter'){e.preventDefault();commit();}else if(e.key==='Escape'){e.preventDefault();finished=true;entry.value=original;clearNameError();onDone();}};
  for(const event of ['pointerdown','click','dblclick','contextmenu'])entry.addEventListener(event,e=>e.stopPropagation());
  entry.oninput=()=>{if(!composing)filter();};wrapper.append(entry,error);return wrapper;
}
function beginNodeRename(n,label){
  if(readonly||!customNodeNamesEnabled()||isSourceReferenceNode(n)||label.parentElement.querySelector('[data-node-name]'))return;
  const editor=nodeNameEditor(n,()=>{if(editor.isConnected)render();});label.replaceWith(editor);const entry=editor.querySelector('input');entry.focus();entry.select();
}
function uniqueInputName(hint='uValue'){
  const base=String(hint).replace(/[^A-Za-z0-9_]/g,'').slice(0,38)||'uValue',names=new Set(graph.declarations.map(d=>d.name));
  const safe=/^[A-Za-z]/.test(base)&&! /^(gl_|TD|sg_|sTD)/.test(base)?base:'u'+base;
  if(!names.has(safe))return safe;let i=2;while(names.has(safe+i))i++;return safe+i;
}
function topInputsView(){
  if(editorTarget!=='top')return [];
  if(graph.topSourceVersion===1)return (graph.topInputs||[]).map((s,index)=>({...s,name:'sTD2DInputs['+index+']'}));
  const legacy=graph.declarations.find(d=>d.kind==='sampler'&&d.source==='input:0');
  return graph.topInputs||[{id:'input0',name:'Input 0',defaultSource:legacy?.defaultSource||'builtin:banana',matchDefault:!!legacy?.defaultSource}];
}
function ensureTopInputs(){if(editorTarget!=='top')throw Error('TOP Inputs require Grape TOP.');graph.topInputs||=clone(topInputsView());if(graph.declarations.some(d=>d.source==='input:0')&&graph.topInputs.length)graph.topInputLegacyId||=graph.topInputs[0].id;return graph.topInputs;}
function allInputSources(){return [...topInputsView().map((s,index)=>({...s,kind:'top_input',type:'sampler2D',index})),...graph.declarations];}
function constantFields(box,decl){
  box.append(field(t('node.type'),typeSelect(valueTypes().map(v=>[v,v]),decl.type,value=>changeDeclaration(()=>setDeclarationType(decl,value)))),numbers(decl.value,t('declaration.value'),value=>changeDeclaration(()=>decl.value=value),false,'XYZW',decl.type),el('p',{class:'muted'},t('inputs.constantHint')));
}
function setDeclarationType(decl,type){
  const previous=decl.type;
  decl.value=isMatrixType(previous)&&isMatrixType(type)?matrixReshapeValue(decl.value,previous,type):shapedValue(decl.value,type);
  decl.type=type;
  if(decl.kind==='uniform'){
    if(isMatrixType(type))decl.nativeSequence='matrix';
    else if(decl.nativeSequence==='matrix')delete decl.nativeSequence;
  }
}
function specDefaultValue(value,type){const n=Number(Array.isArray(value)?value[0]:value)||0;return type==='bool'?!!n:type==='int'?Math.max(-2147483648,Math.min(2147483647,Math.trunc(n))):type==='uint'?Math.max(0,Math.min(4294967295,Math.trunc(n))):n;}
function createInputDeclaration(kind='uniform',type='float',{name,value,preset,nativeSequence,arraySource,elementType,length}={}){
  if(kind==='top_input'){const slots=ensureTopInputs();if(slots.length>=16)throw Error(t('inputs.topLimit'));const slot={id:'input_'+crypto.randomUUID().replaceAll('-','').slice(0,12),name:'sTD2DInputs['+slots.length+']',defaultSource:'builtin:black'};slots.push(slot);return slot;}
  if(kind==='sampler'&&editorTarget==='top')throw Error(t('inputs.chooseTop'));
  if(kind==='uniform'&&preset){
    const entry=typeContract?.sources?.uniformPresets?.[preset];if(!entry)throw Error('Unknown Uniform preset.');
    const matches=graph.declarations.filter(d=>d.initialDriver===preset||d.name===entry.name);
    if(matches.length){
      const existing=matches[0];
      if(matches.length!==1||existing.kind!=='uniform'||existing.type!==entry.type)throw Error(t('sources.presetConflict'));
      if(existing.sourceMissing)throw Error(t('sources.missing'));
      return existing; // Reuse the entity without applying its initial driver again.
    }
    type=entry.type;name=entry.name;
  }
  const id=kind+'_'+crypto.randomUUID().replaceAll('-','').slice(0,12);
  const decl={id,kind,type:kind==='sampler'?'sampler2D':type,name:uniqueInputName(name||({sampler:'uTexture',constant:'cValue',spec_constant:'sValue'})[kind]||'uValue')};
  if(kind==='spec_constant'){const ids=new Set(graph.declarations.filter(d=>d.kind==='spec_constant').map(d=>d.constantId));let constantId=0;while(ids.has(constantId))constantId++;Object.assign(decl,{value:specDefaultValue(value??0,type),constantId,nativeSequence:'const'});}
  else if(kind==='sampler')Object.assign(decl,{source:'builtin:black',fallback:'opaque-black'});
  else if(kind==='uniform'&&(nativeSequence==='array'||/\[[0-9]+\]$/.test(type))){
    if(elementType&&length)decl.type=elementType+'['+length+']';
    Object.assign(decl,{value:null,expose:false,nativeSequence:'array',arraySource:arraySource||''});
  }
  else {Object.assign(decl,{value:shapedValue(value??(typeContract?.types?.[type]?.shape==='matrix'?1:0),type),expose:false});if(kind==='uniform'){if(preset)decl.initialDriver=preset;if(nativeSequence)decl.nativeSequence=nativeSequence;else if(typeContract?.types?.[type]?.shape==='matrix')decl.nativeSequence='matrix';}}
  graph.declarations.push(decl);return decl;
}
function instantiate(d,x,y,type=null,{locked=false,declarationId=null,inputSeed={}}={}){
  const id='n'+crypto.randomUUID().replaceAll('-','').slice(0,12),params=clone(d.defaults||{});
  // Fixed entries retain their identity in params; generic entries keep their
  // stable default unless an explicit wire/type context requests another type.
  type=d.fixedType||type;
  if(d.source)params.functionId=FunctionModel.importLibrary(graph,d.source).id;
  if(type&&params.type){if(isMatrixType(params.type)&&isMatrixType(type)&&params.values)params.values=matrixReshapeValue(params.values,params.type,type);params.type=type;}
  if(['uniform','constant','spec_constant'].includes(d.key)){
    const decl=declarationId?graph.declarations.find(x=>x.id===declarationId&&x.kind===d.key):createInputDeclaration(d.key,type||(d.key==='spec_constant'?'int':'float'),inputSeed);
    if(!decl)throw Error('Uniform source is unavailable.');params.declarationId=decl.id;
  }
  if(d.key==='top_input'){const slots=ensureTopInputs();const slot=declarationId?slots.find(s=>s.id===declarationId):slots.find(s=>s.id===selectedInputId)||slots[0];if(!slot)throw Error(t('inputs.chooseTop'));params.inputId=slot.id;}
  if(d.key==='sampler'){
    const decl=declarationId?graph.declarations.find(x=>x.id===declarationId&&x.kind==='sampler'):createInputDeclaration('sampler','sampler2D',inputSeed);
    if(!decl)throw Error('Sampler source is unavailable.');params.declarationId=decl.id;
  }
  const n={id,definitionUuid:d.definitionUuid,params,ui:{x:snap(x),y:snap(y),...(supportsAutoType(d)?{typeMode:locked?'locked':'auto'}:{})}};
  normalizeNodeValues(n,d);
  if(d.revisionHash)n.revisionHash=d.revisionHash;current().nodes.push(n);assignCreatedNodeNames([n]);selected=id;selection=new Set([id]);selectedEdge=null;return n;
}
function newFunction(){
  change(()=>{const id=FunctionModel.uid();graph.functions||=[];
    const f={id,name:'Function '+(graph.functions.filter(f=>f.scope==='local').length+1),scope:'local',stages:[stage],inputs:[{id:'value',name:'Value',type:'vec4',default:[1,1,1,1]}],outputs:[{id:'value',name:'Value',type:'vec4',default:[0,0,0,1]}],graph:{nodes:[{id:'input',name:'Input',definitionUuid:FunctionModel.INPUT,params:{},ui:{x:48,y:144}},{id:'output',name:'Output',definitionUuid:FunctionModel.OUTPUT,params:{},ui:{x:624,y:144}}],edges:[{from:['input','value'],to:['output','value']}]}};
    graph.functions.push(f);instantiate(functionEntry(f),200,180);
  });
}
function groupSelection(){
  const data=current(),chosen=data.nodes.filter(n=>selection.has(n.id)&&canDeleteNode(n)&&!SubgraphSourcePolicy.isSource(n,catalog));if(!chosen.length)return;
  change(()=>{
    const ids=new Set(chosen.map(n=>n.id)),id=FunctionModel.uid(),callId='n'+crypto.randomUUID().replaceAll('-','').slice(0,12),inputs=[],outputs=[],edges=[],outside=[],incoming=new Map(),outgoing=new Map();
    for(const e of data.edges){const a=ids.has(e.from[0]),b=ids.has(e.to[0]);
      if(a&&b){edges.push(clone(e));continue;}
      if(!a&&!b){outside.push(clone(e));continue;}
      if(b){const n=chosen.find(n=>n.id===e.to[0]),type=ports(n,'inputs')[e.to[1]],key=e.from.join(':')+':'+type;
        if(!incoming.has(key)){const p='in'+(inputs.length+1);incoming.set(key,p);const value=defaultInput(n,e.to[1],type);const from=data.nodes.find(n=>n.id===e.from[0]);const name=SubgraphSourcePolicy.isSource(from,catalog)?SubgraphSourcePolicy.inputName(graph,from,e.from[1],e.to[1]):e.to[1];inputs.push({id:p,name,type,default:isResourceType(type)?null:value??filledValue(type)});outside.push({from:clone(e.from),to:[callId,p]});}
        edges.push({from:['input',incoming.get(key)],to:clone(e.to)});
      }else{const n=chosen.find(n=>n.id===e.from[0]),type=ports(n,'outputs')[e.from[1]],key=e.from.join(':');
        if(!outgoing.has(key)){const p='out'+(outputs.length+1);outgoing.set(key,p);outputs.push({id:p,name:e.from[1],type,default:filledValue(type)});edges.push({from:clone(e.from),to:['output',p]});}
        outside.push({from:[callId,outgoing.get(key)],to:clone(e.to)});
      }
    }
    const x=Math.min(...chosen.map(n=>n.ui.x)),y=Math.min(...chosen.map(n=>n.ui.y));
    const nodes=chosen.map(n=>({...clone(n),ui:{...clone(n.ui),x:n.ui.x-x+288,y:n.ui.y-y+144}}));
    nodes.push({id:'input',name:uniqueNodeName('Input',null,nodes),definitionUuid:FunctionModel.INPUT,params:{},ui:{x:24,y:144}},{id:'output',name:uniqueNodeName('Output',null,nodes),definitionUuid:FunctionModel.OUTPUT,params:{},ui:{x:Math.max(...nodes.map(n=>n.ui.x))+288,y:144}});
    const f={id,name:'Function '+((graph.functions||[]).filter(f=>f.scope==='local').length+1),scope:'local',stages:[stage],inputs,outputs,graph:{nodes,edges}};
    GraphFrames.write(f.graph,GraphFrames.copy(data,ids));
    const owner=(graph.functions||[]).find(item=>item.graph===data),oldScope=owner?'fn_'+owner.id:stage;
    graph.functions||=[];graph.functions.push(f);data.nodes=data.nodes.filter(n=>!ids.has(n.id));data.nodes.push({id:callId,definitionUuid:FunctionModel.CALL,params:{functionId:id},ui:{x,y}});assignCreatedNodeNames([data.nodes.at(-1)]);data.edges=outside;selected=callId;selection=new Set([callId]);selectedEdge=null;
    GraphArrayLengths.walk(graph,(ref,old)=>ref.scope===oldScope&&ids.has(ref.source[0])?GraphArrayLengths.token('fn_'+id,ref.source):old);
    if(chosen.some(n=>n.definitionUuid==='sgrape.builtin.array_create')){
      const plan=planAutoGraph(graph,f.graph,f);
      for(const port of f.outputs){const edge=edges.find(e=>e.to[0]==='output'&&e.to[1]===port.id);if(edge)port.type=plan.ports.get(edge.from[0]).outputs[edge.from[1]];}
    }
  });
}
function renameGraphFunction(id,value){
  const name=value.trim(),original=FunctionModel.find(graph,id);if(!original)return false;
  if(!name||name.length>80||/[\x00-\x1f\x7f]/.test(name)){status(t('function.nameInvalid'),true);return false;}
  if(original.name===name)return true;
  return change(()=>{const mapping=FunctionModel.localize(graph,id);graphTrail=graphTrail.map(key=>mapping.get(key)||key);FunctionModel.find(graph,mapping.get(id)||id).name=name;},{localize:false});
}
function functionNameField(f,rowBuilder=field){
  const entry=input(f.name,value=>{if(!renameGraphFunction(f.id,value))entry.setSyncedValue(f.name);});entry.dataset.functionName=f.id;entry.maxLength=80;entry.disabled=readonly;
  entry.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();entry.setSyncedValue(f.name);entry.blur();}});
  const row=rowBuilder(t('function.name'),entry);if(f.scope!=='local')row.append(row.classList.contains('parameter-row')?parameterHint(t('function.renameSource')):el('small',{class:'muted'},t('function.renameSource')));return row;
}
function focusFunctionName(){
  inspectorScope='node';inspectorTab='parameters';inspector();workspaceLayout.reveal('parameters');const field=$('[data-function-name]');field?.scrollIntoView({block:'nearest'});field?.focus();field?.select();
}
// Spare sockets are UI-only. A port and its first wire are one graph edit.
function sparePortDirection(n){
  return n?.definitionUuid===FunctionModel.INPUT?'inputs':n?.definitionUuid===FunctionModel.OUTPUT?'outputs':null;
}
function sparePortProblem(spare,other){
  const n=current().nodes.find(n=>n.id===spare.node),direction=sparePortDirection(n),f=currentFunction();
  const peer=current().nodes.find(n=>n.id===other.node),type=peer&&ports(peer,other.kind)[other.port];
  if(other.add||!f||!direction||spare.kind!==(direction==='inputs'?'outputs':'inputs')||!graphInterfaceTypes().includes(type))return 'autoConflict';
  return f[direction].length>=16?'portLimit':null;
}
function materializeSparePort(spare,other){
  const n=current().nodes.find(n=>n.id===spare.node),direction=sparePortDirection(n),f=currentFunction();
  const peer=current().nodes.find(n=>n.id===other.node),type=ports(peer,other.kind)[other.port];
  const base=(portLabel(peer,other.kind,other.port)||'Value').slice(0,48),names=new Set(f[direction].map(p=>p.name));
  let name=base,index=2;while(names.has(name))name=base+' '+index++;
  const id='p'+crypto.randomUUID().replaceAll('-','').slice(0,12);
  const value=direction==='inputs'?defaultInput(peer,other.port,type):null;
  f[direction].push({id,name,type,default:isResourceType(type)?null:value??filledValue(type)});
  return {...spare,port:id,type,add:false};
}
function appendSparePort(list,n){
  const direction=sparePortDirection(n),f=currentFunction();if(!f||!direction)return;
  const kind=direction==='inputs'?'outputs':'inputs',label=t(direction==='inputs'?'function.quickInput':'function.quickOutput');
  const row=el('div',{class:'port-row '+(kind==='inputs'?'input':'output')+' spare-port-row'});
  const b=el('button',{class:'port port-add',title:label+' · '+t('function.quickHint'),'aria-label':label,
    'data-kind':kind,'data-port':'__add__','data-type':'spare','data-add-port':'true'});
  b.disabled=readonly||f[direction].length>=16;
  if(f[direction].length>=16)b.title=t('wire.portLimit');
  b.onpointerdown=e=>{if(!b.disabled)dragWire(b,e);};
  b.onclick=e=>{e.stopPropagation();if(b.disabled||suppressPortClick)return;const info=portInfo(b);
    if(linkStart&&linkStart.kind!==info.kind)connectPorts(linkStart,info);
    else {linkStart=info;$('#connection').hidden=false;$('#connection').textContent=t('function.quickHint');}};
  row.append(b,el('span',{class:'port-label'},'+'));list.append(row);
}
function functionInspector(box,n,d){
  const parameterPage=inspectorTab==='parameters',row=parameterPage?parameterControlRow:field;
  const action=button=>parameterPage?parameterControlRow('',button):button;
  if(d.key==='function_call'){
    const f=FunctionModel.find(graph,n.params.functionId);box.append(functionNameField(f,row));
    const scope=f.scope==='local'?t('function.local'):t('function.source');box.append(parameterPage?parameterControlRow('',parameterHint(scope)):el('p',{class:'muted'},scope));
    const open=el('button',{class:'wide'},t('function.open'));open.onclick=()=>enterFunction(n);box.append(action(open));
    const separate=el('button',{class:'wide','data-action':'local-subgraph'},t(f.scope==='local'?'function.independent':'function.makeLocal'));separate.disabled=readonly;separate.onclick=()=>change(()=>FunctionModel.independent(graph,n));box.append(action(separate));
    const save=el('button',{class:'wide','data-action':'save-personal'},t('personal.save'));save.disabled=readonly;save.onclick=()=>savePersonalFunction(f);box.append(action(save));
  }
  const f=currentFunction();if(!f||!['function_input','function_output'].includes(d.key))return;
  box.append(functionNameField(f,row));
  const direction=d.key==='function_input'?'inputs':'outputs';
  for(const p of f[direction]){
    const section=el('section',{class:'input-parameter'});section.append(el('h4',{},p.id+' · '+p.type));
    // Port-definition tables retain their own grouped authoring layout.
    section.append(field(t('function.portName'),input(p.name||p.id,v=>change(()=>p.name=v))));
    if(isCompositeType(p.type))section.append(el('code',{},displayType(p.type)));
    else if(isResourceType(p.type))section.append(el('p',{class:'muted'},t('sampler.fallbackHint')));
    else section.append(numbers(p.default,t('function.portDefault'),v=>change(()=>p.default=v),false,'XYZW',p.type));
    if(inspectorTab==='settings'){
      section.append(field(t('node.type'),typeSelect(graphInterfaceTypes().map(type=>[type,displayType(type)]),p.type,type=>change(()=>{
        const previous=p.type;p.type=type;p.default=convertValue(p.default,type,previous);
        for(const data of everyGraph())for(const call of data.nodes)if(call.definitionUuid===FunctionModel.CALL&&call.params.functionId===f.id&&direction==='inputs'&&Object.hasOwn(call.inputValues||{},p.id))call.inputValues[p.id]=convertValue(call.inputValues[p.id],type,previous);
      },{typeChange:true}))));
      const order=el('div',{class:'function-port-order'});
      for(const [delta,label]of [[-1,t('code.up')],[1,t('code.down')]]){
        const button=el('button',{type:'button',title:label,'aria-label':label,'data-port-move':String(delta),'data-port-id':p.id},delta<0?'↑':'↓');
        const index=f[direction].findIndex(item=>item.id===p.id);button.disabled=readonly||index+delta<0||index+delta>=f[direction].length;
        button.onclick=()=>change(()=>{const list=currentFunction()[direction],index=list.findIndex(item=>item.id===p.id);const [item]=list.splice(index,1);list.splice(index+delta,0,item);});order.append(button);
      }
      section.append(order);
      const removePort=el('button',{class:'wide danger'},t('function.removePort'));
      removePort.onclick=()=>change(()=>{
        f[direction]=f[direction].filter(x=>x!==p);
        const boundary=f.graph.nodes.find(n=>n.definitionUuid===(direction==='inputs'?FunctionModel.INPUT:FunctionModel.OUTPUT));
        if(boundary){const side=direction==='inputs'?'from':'to';f.graph.edges=f.graph.edges.filter(e=>e[side][0]!==boundary.id||e[side][1]!==p.id);if(boundary.inputValues)delete boundary.inputValues[p.id];}
        for(const data of everyGraph())for(const call of data.nodes)if(call.definitionUuid===FunctionModel.CALL&&call.params.functionId===f.id){const side=direction==='inputs'?'to':'from';data.edges=data.edges.filter(e=>e[side][0]!==call.id||e[side][1]!==p.id);if(direction==='inputs'&&call.inputValues)delete call.inputValues[p.id];}
      });section.append(removePort);
    }
    box.append(section);
  }
  if(inspectorTab==='settings'){
    const add=el('button',{class:'wide'},t('function.addPort'));add.disabled=f[direction].length>=16;
    add.onclick=()=>change(()=>f[direction].push({id:'p'+crypto.randomUUID().replaceAll('-','').slice(0,8),name:'Value',type:'float',default:0}));box.append(add);
  }
}
function convertValue(value,type,previous=null){return value===null&&!isResourceType(type)?filledValue(type):isMatrixType(previous)&&isMatrixType(type)?matrixReshapeValue(value,previous,type):shapedValue(value,type);}
function everyGraph(){return [...Object.values(graph.stages),...(graph.functions||[]).map(f=>f.graph)];}
function portLabel(n,kind,id){
  if(isMatrixOperation(definition(n))&&/^c[0-3](?:[xyzw])?$/.test(id))return matrixPortLabel(id);
  if(kind==='inputs'&&id==='position'&&['sgrape.builtin.perlin_noise','sgrape.builtin.simplex_noise'].includes(n.definitionUuid))return t('noise.position');
  if(kind==='inputs'&&['sgrape.builtin.compare','sgrape.builtin.if'].includes(n.definitionUuid))return ({a:'A',b:'B',condition:'Condition',true:'True',false:'False'})[id]||id;
  if(['sgrape.builtin.vector','sgrape.builtin.replace','sgrape.builtin.combine','sgrape.builtin.vector_split','sgrape.builtin.swizzle'].includes(n.definitionUuid)){const label=vectorPortLabel(n,kind,id);if(label)return label;}
  if(n.definitionUuid==='sgrape.builtin.glsl_code')return n.params[kind]?.find(p=>p.id===id)?.name||id;
  if(kind==='outputs'&&definition(n)?.key==='top_input'){if(id==='out')return topInputsView().find(s=>s.id===n.params.inputId)?.name||id;return id==='size'?t('inputs.size'):t('inputs.pixelSize');}
  if(kind==='outputs'&&id==='out'&&['sampler','constant','spec_constant'].includes(definition(n)?.key))return graph.declarations.find(d=>d.id===n.params?.declarationId)?.name||id;
  if(n.definitionUuid==='sgrape.builtin.pixel_out'&&editorTarget==='mat'&&kind==='inputs'){const index=typeContract?.pixelBufferOutputs?.ports.indexOf(id);if(index>=0){const label=n.ui?.bufferLabels?.[id];return typeof label==='string'&&label.length<=80&&!/[\x00-\x1f\x7f]/.test(label)&&label.trim()?label:'Buffer '+index;}}
  if(![FunctionModel.CALL,FunctionModel.INPUT,FunctionModel.OUTPUT].includes(n.definitionUuid))return id;
  const f=n.definitionUuid===FunctionModel.CALL?FunctionModel.find(graph,n.params.functionId):currentFunction();
  const direction=n.definitionUuid===FunctionModel.INPUT?'inputs':n.definitionUuid===FunctionModel.OUTPUT?'outputs':kind;
  return f?.[direction]?.find(p=>p.id===id)?.name||id;
}

function splitLegacyTexture(n){
  if(definition(n)?.key!=='texture')return false;
  return change(()=>{
    if(editorTarget==='top'&&n.params.inputId){
      const data=current(),inputId=n.params.inputId,sourceDef=catalog.find(d=>d.key==='top_input'),sampleDef=catalog.find(d=>d.key==='texture_sample');
      let source=data.nodes.find(s=>s.definitionUuid===sourceDef.definitionUuid&&s.params.inputId===inputId);
      if(!source){source={id:'n'+crypto.randomUUID().replaceAll('-','').slice(0,12),definitionUuid:sourceDef.definitionUuid,revisionHash:sourceDef.revisionHash,params:{inputId},ui:{x:n.ui.x-288,y:n.ui.y+168}};data.nodes.push(source);}
      n.definitionUuid=sampleDef.definitionUuid;n.revisionHash=sampleDef.revisionHash;delete n.params.inputId;
      data.edges.push({from:[source.id,'out'],to:[n.id,'sampler']});return;
    }
    const decl=graph.declarations.find(d=>d.id===n.params.declarationId&&d.kind==='sampler');
    if(!decl)throw Error(t('sampler.missingDeclaration'));
    const data=current(),samplerDef=catalog.find(d=>d.key==='sampler'),sampleDef=catalog.find(d=>d.key==='texture_sample');
    let source=data.nodes.find(s=>s.definitionUuid===samplerDef.definitionUuid&&s.params.declarationId===decl.id);
    if(!source){source={id:'n'+crypto.randomUUID().replaceAll('-','').slice(0,12),definitionUuid:samplerDef.definitionUuid,revisionHash:samplerDef.revisionHash,params:{declarationId:decl.id},ui:{x:n.ui.x-288,y:n.ui.y+168}};data.nodes.push(source);}
    n.definitionUuid=sampleDef.definitionUuid;n.revisionHash=sampleDef.revisionHash;delete n.params.declarationId;
    decl.fallback='opaque-black';
    data.edges.push({from:[source.id,'out'],to:[n.id,'sampler']});
  });
}

function newSampler(n){
  return change(()=>{
    const id='sampler_'+crypto.randomUUID().replaceAll('-','').slice(0,12);
    graph.declarations.push({id,kind:'sampler',type:'sampler2D',name:'uTexture'+id.slice(-8),source:'builtin:black',fallback:'opaque-black'});
    n.params.declarationId=id;
  });
}
