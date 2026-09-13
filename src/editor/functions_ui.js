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
  const crumbs=[stage==='pixel'?'Pixel':'Vertex',...graphTrail.map(id=>FunctionModel.find(graph,id)?.name||'?')];
  crumbs.forEach((label,depth)=>{if(depth)nav.append(el('span',{class:'graph-separator'},'/'));
    const b=el('button',{'aria-current':depth===graphTrail.length?'location':'false'},label);b.disabled=depth===graphTrail.length;b.onclick=()=>navigateGraph(depth);nav.append(b);
  });
  const f=currentFunction();$('#functionscope').textContent=f?(f.scope==='local'?t('function.local'):t('function.source')):'';
  $('#group').disabled=readonly||!current().nodes.some(n=>selection.has(n.id)&&canDeleteNode(n)&&!SubgraphSourcePolicy.isSource(n,catalog));
}
function canDeleteNode(n){return !['pixel_out','vertex_out','function_input','function_output'].includes(definition(n)?.key);}
function functionEntry(f,source=false){
  return {key:source?'source:'+f.scope+':'+f.id+':'+(f.source?.version||''):'function:'+f.id,label:f.name,stages:f.stages,inputs:Object.fromEntries(f.inputs.map(p=>[p.id,p.type])),outputs:Object.fromEntries(f.outputs.map(p=>[p.id,p.type])),defaults:{functionId:f.id},definitionUuid:FunctionModel.CALL,functionId:f.id,source:source?f:null,category:f.scope==='personal'?'personal':'functions'};
}
function availableEntries(){
  const entries=catalog.filter(d=>d.stages.includes(stage)&&!d.key.endsWith('_out')&&d.key!=='texture'&&(editorTarget==='top'?d.key!=='sampler':d.key!=='top_input')).map(d=>({...d,category:nodeCategory(d)}));
  for(const f of librarySources().filter(f=>f.stages.includes(stage)))entries.push(functionEntry(f,true));
  const sources=librarySources().flatMap(f=>[f,...(f.dependencies||[])]);
  for(const f of (graph.functions||[]).filter(f=>f.stages.includes(stage)&&!graphTrail.includes(f.id))){
    if(f.scope==='local'||!sources.some(s=>s.source?.id===f.source?.id&&s.source?.version===f.source?.version))entries.push(functionEntry(f));
  }
  return entries.filter(d=>!d.functionId||!graphTrail.includes(d.functionId));
}
function uniqueInputName(hint='uValue'){
  const base=String(hint).replace(/[^A-Za-z0-9_]/g,'').slice(0,38)||'uValue',names=new Set(graph.declarations.map(d=>d.name));
  const safe=/^[A-Za-z]/.test(base)&&! /^(gl_|TD|sg_|sTD)/.test(base)?base:'u'+base;
  if(!names.has(safe))return safe;let i=2;while(names.has(safe+i))i++;return safe+i;
}
function topInputsView(){
  if(editorTarget!=='top')return [];
  const legacy=graph.declarations.find(d=>d.kind==='sampler'&&d.source==='input:0');
  return graph.topInputs||[{id:'input0',name:'Input 0',defaultSource:legacy?.defaultSource||'builtin:banana',matchDefault:!!legacy?.defaultSource}];
}
function ensureTopInputs(){if(editorTarget!=='top')throw Error('TOP Inputs require Grape TOP.');graph.topInputs||=clone(topInputsView());if(graph.declarations.some(d=>d.source==='input:0'))graph.topInputLegacyId||=graph.topInputs[0].id;return graph.topInputs;}
function allInputSources(){return [...topInputsView().map((s,index)=>({...s,kind:'top_input',type:'sampler2D',index})),...graph.declarations];}
function constantFields(box,decl){
  box.append(field(t('node.type'),select(['float','vec2','vec3','vec4'].map(v=>[v,v]),decl.type,value=>changeDeclaration(()=>{decl.type=value;decl.value=shapedValue(decl.value,value);}))),numbers(decl.value,t('declaration.value'),value=>changeDeclaration(()=>decl.value=value)),el('p',{class:'muted'},t('inputs.constantHint')));
}
function createInputDeclaration(kind='uniform',type='float',{name,value,preset,nativeSequence}={}){
  if(kind==='top_input'){const slots=ensureTopInputs();if(slots.length>=16)throw Error(t('inputs.topLimit'));const slot={id:'input_'+crypto.randomUUID().replaceAll('-','').slice(0,12),name:name||'Input '+slots.length,defaultSource:'builtin:black'};slots.push(slot);return slot;}
  const id=kind+'_'+crypto.randomUUID().replaceAll('-','').slice(0,12);
  const decl={id,kind,type:kind==='sampler'?'sampler2D':type,name:uniqueInputName(name||(kind==='sampler'?'uTexture':'uValue'))};
  if(kind==='sampler')Object.assign(decl,{source:'builtin:black',fallback:'opaque-black'});
  else {Object.assign(decl,{value:shapedValue(value??0,type),expose:false});if(kind==='uniform'){if(preset)decl.initialDriver=preset;if(nativeSequence)decl.nativeSequence=nativeSequence;}}
  graph.declarations.push(decl);return decl;
}
function instantiate(d,x,y,type=null,{locked=false,declarationId=null,inputSeed={}}={}){
  const id='n'+crypto.randomUUID().replaceAll('-','').slice(0,12),params=clone(d.defaults||{});
  if(d.source)params.functionId=FunctionModel.importLibrary(graph,d.source).id;
  if(type&&params.type)params.type=type;
  if(['uniform','constant'].includes(d.key)){
    const decl=declarationId?graph.declarations.find(x=>x.id===declarationId&&x.kind===d.key):createInputDeclaration(d.key,type||'float',inputSeed);
    if(!decl)throw Error('Uniform source is unavailable.');params.declarationId=decl.id;
  }
  if(d.key==='top_input'){const slots=ensureTopInputs();const slot=declarationId?slots.find(s=>s.id===declarationId):createInputDeclaration('top_input',null,inputSeed);if(!slot)throw Error(t('clipboard.missing'));params.inputId=slot.id;}
  if(d.key==='sampler'){
    const decl=declarationId?graph.declarations.find(x=>x.id===declarationId&&x.kind==='sampler'):createInputDeclaration('sampler','sampler2D',inputSeed);
    if(!decl)throw Error('Sampler source is unavailable.');params.declarationId=decl.id;
  }
  const n={id,definitionUuid:d.definitionUuid,params,ui:{x:snap(x),y:snap(y),...(supportsAutoType(d)?{typeMode:locked?'locked':'auto'}:{})}};
  if(d.revisionHash)n.revisionHash=d.revisionHash;current().nodes.push(n);selected=id;selection=new Set([id]);selectedEdge=null;return n;
}
function newFunction(){
  change(()=>{const id=FunctionModel.uid();graph.functions||=[];
    const f={id,name:'Function '+(graph.functions.filter(f=>f.scope==='local').length+1),scope:'local',stages:[stage],inputs:[{id:'value',name:'Value',type:'vec4',default:[1,1,1,1]}],outputs:[{id:'value',name:'Value',type:'vec4',default:[0,0,0,1]}],graph:{nodes:[{id:'input',definitionUuid:FunctionModel.INPUT,params:{},ui:{x:48,y:144}},{id:'output',definitionUuid:FunctionModel.OUTPUT,params:{},ui:{x:624,y:144}}],edges:[{from:['input','value'],to:['output','value']}]}};
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
        if(!incoming.has(key)){const p='in'+(inputs.length+1);incoming.set(key,p);const value=defaultInput(n,e.to[1],type);const from=data.nodes.find(n=>n.id===e.from[0]);const name=SubgraphSourcePolicy.isSource(from,catalog)?SubgraphSourcePolicy.inputName(graph,from,e.from[1],e.to[1]):e.to[1];inputs.push({id:p,name,type,default:isResourceType(type)?null:value??[0,0]});outside.push({from:clone(e.from),to:[callId,p]});}
        edges.push({from:['input',incoming.get(key)],to:clone(e.to)});
      }else{const n=chosen.find(n=>n.id===e.from[0]),type=ports(n,'outputs')[e.from[1]],key=e.from.join(':');
        if(!outgoing.has(key)){const p='out'+(outputs.length+1);outgoing.set(key,p);outputs.push({id:p,name:e.from[1],type,default:filledValue(type)});edges.push({from:clone(e.from),to:['output',p]});}
        outside.push({from:[callId,outgoing.get(key)],to:clone(e.to)});
      }
    }
    const x=Math.min(...chosen.map(n=>n.ui.x)),y=Math.min(...chosen.map(n=>n.ui.y));
    const nodes=chosen.map(n=>({...clone(n),ui:{...clone(n.ui),x:n.ui.x-x+288,y:n.ui.y-y+144}}));
    nodes.push({id:'input',definitionUuid:FunctionModel.INPUT,params:{},ui:{x:24,y:144}},{id:'output',definitionUuid:FunctionModel.OUTPUT,params:{},ui:{x:Math.max(...nodes.map(n=>n.ui.x))+288,y:144}});
    const f={id,name:'Function '+((graph.functions||[]).filter(f=>f.scope==='local').length+1),scope:'local',stages:[stage],inputs,outputs,graph:{nodes,edges}};
    graph.functions||=[];graph.functions.push(f);data.nodes=data.nodes.filter(n=>!ids.has(n.id));data.nodes.push({id:callId,definitionUuid:FunctionModel.CALL,params:{functionId:id},ui:{x,y}});data.edges=outside;selected=callId;selection=new Set([callId]);selectedEdge=null;
  });
}
function renameGraphFunction(id,value){
  const name=value.trim(),original=FunctionModel.find(graph,id);if(!original)return false;
  if(!name||name.length>80||/[\x00-\x1f\x7f]/.test(name)){status(t('function.nameInvalid'),true);return false;}
  if(original.name===name)return true;
  return change(()=>{const mapping=FunctionModel.localize(graph,id);graphTrail=graphTrail.map(key=>mapping.get(key)||key);FunctionModel.find(graph,mapping.get(id)||id).name=name;},{localize:false});
}
function functionNameField(f){
  const entry=input(f.name,value=>{if(!renameGraphFunction(f.id,value))entry.setSyncedValue(f.name);});entry.dataset.functionName=f.id;entry.maxLength=80;entry.disabled=readonly;
  entry.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();entry.setSyncedValue(f.name);entry.blur();}});
  const row=field(t('function.name'),entry);if(f.scope!=='local')row.append(el('small',{class:'muted'},t('function.renameSource')));return row;
}
function focusFunctionName(){
  inspectorScope='node';inspectorTab='parameters';inspector();workspaceLayout.reveal('parameters');const field=$('[data-function-name]');field?.scrollIntoView({block:'nearest'});field?.focus();field?.select();
}
function functionInspector(box,n,d){
  if(d.key==='function_call'){
    const f=FunctionModel.find(graph,n.params.functionId);box.append(functionNameField(f));box.append(el('p',{class:'muted'},f.scope==='local'?t('function.local'):t('function.source')));
    const open=el('button',{class:'wide'},t('function.open'));open.onclick=()=>enterFunction(n);box.append(open);
    const separate=el('button',{class:'wide','data-action':'local-subgraph'},t(f.scope==='local'?'function.independent':'function.makeLocal'));separate.disabled=readonly;separate.onclick=()=>change(()=>FunctionModel.independent(graph,n));box.append(separate);
    const save=el('button',{class:'wide','data-action':'save-personal'},t('personal.save'));save.disabled=readonly;save.onclick=()=>savePersonalFunction(f);box.append(save);
  }
  const f=currentFunction();if(!f||!['function_input','function_output'].includes(d.key))return;
  box.append(functionNameField(f));
  const direction=d.key==='function_input'?'inputs':'outputs';
  for(const p of f[direction]){
    const section=el('section',{class:'input-parameter'});section.append(el('h4',{},p.id+' · '+p.type));
    section.append(field(t('function.portName'),input(p.name||p.id,v=>change(()=>p.name=v))));
    if(isResourceType(p.type))section.append(el('p',{class:'muted'},t('sampler.fallbackHint')));
    else section.append(numbers(p.default,t('function.portDefault'),v=>change(()=>p.default=v)));
    if(inspectorTab==='settings'){
      section.append(field(t('node.type'),select(interfaceTypes().map(t=>[t,t]),p.type,type=>change(()=>{
        p.type=type;p.default=convertValue(p.default,type);
        for(const data of everyGraph())for(const call of data.nodes)if(call.definitionUuid===FunctionModel.CALL&&call.params.functionId===f.id&&direction==='inputs'&&Object.hasOwn(call.inputValues||{},p.id))call.inputValues[p.id]=convertValue(call.inputValues[p.id],type);
      }))));
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
function convertValue(value,type){return value===null&&!isResourceType(type)?filledValue(type):shapedValue(value,type);}
function everyGraph(){return [...Object.values(graph.stages),...(graph.functions||[]).map(f=>f.graph)];}
function portLabel(n,kind,id){
  if(kind==='outputs'&&definition(n)?.key==='top_input'){if(id==='out')return topInputsView().find(s=>s.id===n.params.inputId)?.name||id;return id==='size'?t('inputs.size'):t('inputs.pixelSize');}
  if(kind==='outputs'&&id==='out'&&['uniform','sampler','constant'].includes(definition(n)?.key))return graph.declarations.find(d=>d.id===n.params?.declarationId)?.name||id;
  if(n.definitionUuid==='sgrape.builtin.pixel_out'&&editorTarget==='mat'&&kind==='inputs'){const index=typeContract?.pixelBufferOutputs?.ports.indexOf(id);if(index>=0){const label=n.ui?.bufferLabels?.[id];return typeof label==='string'&&label.length<=80&&!/[\x00-\x1f\x7f]/.test(label)&&label.trim()?label:'Buffer '+index;}}
  if(![FunctionModel.CALL,FunctionModel.INPUT,FunctionModel.OUTPUT].includes(n.definitionUuid))return id;
  const f=n.definitionUuid===FunctionModel.CALL?FunctionModel.find(graph,n.params.functionId):currentFunction();
  const direction=n.definitionUuid===FunctionModel.INPUT?'inputs':n.definitionUuid===FunctionModel.OUTPUT?'outputs':kind;
  return f?.[direction]?.find(p=>p.id===id)?.name||id;
}

function splitLegacyTexture(n){
  if(definition(n)?.key!=='texture')return false;
  return change(()=>{
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
