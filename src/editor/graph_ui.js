let touchGraphGesture=null;
let selection=new Set(),creatorState=null,creatorIndex=0,creatorMatches=[],creatorCategory='all',wireDrag=null,wireGesture=null,suppressPortClick=false,boxSelectMode=false;
function nodeCategory(d){
  if(d.definitionUuid===FunctionModel.CALL)return 'functions';
  if(['float','vec2','vec3','color'].includes(d.key))return 'constant';
  if(d.key==='uniform')return 'uniform';if(['texture','texture_sample','sampler','uv'].includes(d.key))return 'sampler';
  if(['position','deform','to_clip'].includes(d.key))return 'builtin';
  if(d.key.endsWith('_out')||d.key==='function_output')return 'output';return 'math';
}
let typeContract=null;
function setTypeContract(contract){
  if(contract?.version!==1||!Array.isArray(contract.numericTypes)||!contract.numericTypes.length||
      new Set(contract.numericTypes).size!==contract.numericTypes.length||!contract.numericTypes.every(t=>typeof t==='string')||
      !Array.isArray(contract.conversions)||!contract.definitions||!contract.types)throw Error(t('contract.unsupported'));
  const resourceTypes=contract.resourceTypes||[];
  if(!Array.isArray(resourceTypes)||resourceTypes.some(t=>t!=='sampler2D')||new Set(resourceTypes).size!==resourceTypes.length)throw Error(t('contract.invalid'));
  const known=t=>contract.numericTypes.includes(t)||resourceTypes.includes(t);
  if(Object.keys(contract.types).length!==contract.numericTypes.length+resourceTypes.length)throw Error(t('contract.invalid'));
  for(const type of contract.numericTypes){
    const descriptor=contract.types[type];
    if(!Object.hasOwn(contract.types,type)||!descriptor||descriptor.family!=='float'||
        !Number.isInteger(descriptor.components)||descriptor.components<1||descriptor.components>4)throw Error(t('contract.invalid'));
  }
  for(const type of resourceTypes)if(contract.types[type]?.family!=='sampler'||contract.types[type]?.components!==0)throw Error(t('contract.invalid'));
  for(const rule of contract.conversions)if(!known(rule.from)||!known(rule.to)||!['identity','splat'].includes(rule.kind))throw Error(t('contract.invalid'));
  for(const entry of Object.values(contract.definitions)){
    if(!['fixed','parameter','declaration'].includes(entry.selector)||!Array.isArray(entry.variants)||!entry.variants.length)throw Error(t('contract.invalid'));
    for(const variant of entry.variants)if((variant.type!==null&&!known(variant.type))||!variant.inputs||!variant.outputs||
      ![...Object.values(variant.inputs),...Object.values(variant.outputs)].every(known))throw Error(t('contract.invalid'));
  }
  if(contract.pixelBufferOutputs){
    const spec=contract.pixelBufferOutputs;
    if(spec.parameter!=='bufferCount'||spec.type!=='vec4'||!Array.isArray(spec.ports)||spec.ports.length!==8||spec.ports.some((p,i)=>p!==(i?'buffer'+i:'color')))throw Error(t('contract.invalid'));
  }
  typeContract=JSON.parse(JSON.stringify(contract));
}
const numericTypes=()=>typeContract?.numericTypes||[];
const interfaceTypes=()=>[...numericTypes(),...(typeContract?.resourceTypes||[])];
const isResourceType=type=>(typeContract?.resourceTypes||[]).includes(type);
function typeComponents(type){
  if(!typeContract||!Object.hasOwn(typeContract.types,type))throw Error(t('contract.invalid'));
  return typeContract.types[type].components;
}
function shapedValue(value,type){
  if(isResourceType(type))return null;
  const count=typeComponents(type),components=Array.isArray(value)?value:[value];
  return count===1?components[0]:Array.from({length:count},(_,i)=>components[i]??components[0]);
}
const filledValue=(type,value=0)=>shapedValue(value,type);
const selectableNodeTypes=d=>typeVariants(d).map(v=>v.type).filter(type=>type!==null);
const compatible=(a,b)=>!!typeContract?.conversions.some(rule=>rule.from===a&&rule.to===b);
function typeVariants(d){
  const entry=typeContract?.definitions[d.definitionUuid];if(entry)return entry.variants;
  if(![FunctionModel.CALL,FunctionModel.INPUT,FunctionModel.OUTPUT].includes(d.definitionUuid))return [];
  return [{type:null,inputs:d.inputs,outputs:d.outputs}];
}
function resolvedNodePorts(d,params,decl,kind){
  if(d.key==='pixel_out'&&kind==='inputs'&&typeContract?.pixelBufferOutputs){
    const spec=typeContract.pixelBufferOutputs,count=params[spec.parameter]??1;
    if(Number.isInteger(count)&&count>=1&&count<=spec.ports.length)return Object.fromEntries(spec.ports.slice(0,count).map(port=>[port,spec.type]));
  }
  const entry=typeContract?.definitions[d.definitionUuid];
  const chosen=entry?.selector==='parameter'?(params.type||'float'):entry?.selector==='declaration'?decl?.type:null;
  const variant=typeVariants(d).find(v=>v.type===chosen);
  // Preserve anchors for an unresolved declaration; unknown types cannot connect.
  return variant?.[kind]||Object.fromEntries(Object.keys(d[kind]||{}).map(port=>[port,'?']));
}
/* Auto is editor policy. Each saved node retains a concrete compiler type. */
const supportsAutoType=d=>!!d&&nodeCategory(d)==='math'&&typeContract?.definitions[d.definitionUuid]?.selector==='parameter';
function autoDefinition(document,node,owner=null){
  if(node.definitionUuid===FunctionModel.CALL){const f=(document.functions||[]).find(f=>f.id===node.params.functionId);return f&&{definitionUuid:FunctionModel.CALL,key:'function_call',inputs:Object.fromEntries(f.inputs.map(p=>[p.id,p.type])),outputs:Object.fromEntries(f.outputs.map(p=>[p.id,p.type]))};}
  if([FunctionModel.INPUT,FunctionModel.OUTPUT].includes(node.definitionUuid))return owner&&{definitionUuid:node.definitionUuid,key:node.definitionUuid===FunctionModel.INPUT?'function_input':'function_output',inputs:node.definitionUuid===FunctionModel.OUTPUT?Object.fromEntries(owner.outputs.map(p=>[p.id,p.type])):{},outputs:node.definitionUuid===FunctionModel.INPUT?Object.fromEntries(owner.inputs.map(p=>[p.id,p.type])):{}};
  return catalog.find(d=>d.definitionUuid===node.definitionUuid);
}
function autoUnits(document){return [...Object.entries(document.stages).map(([name,data])=>({key:'stage:'+name,data,owner:null})),...(document.functions||[]).map(owner=>({key:'function:'+owner.id,data:owner.graph,owner}))];}
function autoTypeError(key,detail=''){const error=Error(t(key)+(detail?' '+detail:''));error.code='autoConflict';return error;}
function concretePorts(document,n,owner,type=n.params.type,override=null){
  if(override)return override;
  const d=autoDefinition(document,n,owner);if(!d)return {inputs:{},outputs:{}};
  const decl=document.declarations.find(d=>d.id===n.params.declarationId),params={...n.params,type};
  return {inputs:resolvedNodePorts(d,params,decl,'inputs'),outputs:resolvedNodePorts(d,params,decl,'outputs')};
}
function invalidTypeEdges(data,portMap){
  return data.edges.filter(e=>!compatible(portMap.get(e.from[0])?.outputs[e.from[1]],portMap.get(e.to[0])?.inputs[e.to[1]]));
}
function typeEdgeKey(edge,ports){return JSON.stringify([edge.from,edge.to,ports.get(edge.from[0])?.outputs[edge.from[1]],ports.get(edge.to[0])?.inputs[edge.to[1]]]);}
function planAutoGraph(document,data,owner=null,overrides=new Map()){
  const nodes=new Map(data.nodes.map(n=>[n.id,n])),incoming=new Map(),ports=new Map(),choices=new Map(),active=new Set();
  for(const e of data.edges){if(!incoming.has(e.to[0]))incoming.set(e.to[0],[]);incoming.get(e.to[0]).push(e);}
  const canInfer=!owner||owner.scope==='local';
  const autoNodes=new Set(data.nodes.filter(n=>canInfer&&n.ui?.typeMode==='auto'&&supportsAutoType(autoDefinition(document,n,owner))).map(n=>n.id));
  function visit(n){
    if(ports.has(n.id))return;
    if(active.has(n.id))throw autoTypeError('wire.cycle');active.add(n.id);
    const links=incoming.get(n.id)||[];
    for(const e of links){const source=nodes.get(e.from[0]);if(source)visit(source);}
    if(autoNodes.has(n.id)){
      const d=autoDefinition(document,n,owner),candidates=typeVariants(d).filter(v=>links.every(e=>compatible(ports.get(e.from[0])?.outputs[e.from[1]],v.inputs[e.to[1]])));
      const score=v=>links.reduce((sum,e)=>sum+Number(ports.get(e.from[0])?.outputs[e.from[1]]!==v.inputs[e.to[1]]),0);
      candidates.sort((a,b)=>score(a)-score(b)||typeComponents(a.type)-typeComponents(b.type));
      const chosen=candidates[0];if(!chosen)throw autoTypeError('type.autoInputs',d.label||d.key);
      choices.set(n.id,chosen.type);ports.set(n.id,{inputs:chosen.inputs,outputs:chosen.outputs});
    }else ports.set(n.id,concretePorts(document,n,owner,n.params.type,overrides.get(n.id)));
    active.delete(n.id);
  }
  // No policy nodes: existing unresolved/cyclic drafts remain a compiler concern.
  if(autoNodes.size)for(const n of data.nodes)visit(n);
  else for(const n of data.nodes)ports.set(n.id,concretePorts(document,n,owner,n.params.type,overrides.get(n.id)));
  return {choices,ports};
}
function storedTypePorts(document,data,owner=null){return new Map(data.nodes.map(n=>[n.id,concretePorts(document,n,owner)]));}
function rejectNewTypeIssues(data,ports,oldData,oldPorts){
  const old=new Set(oldData?invalidTypeEdges(oldData,oldPorts).map(e=>typeEdgeKey(e,oldPorts)):[]);
  for(const e of invalidTypeEdges(data,ports))if(!old.has(typeEdgeKey(e,ports)))throw autoTypeError('type.autoDownstream',`${ports.get(e.from[0])?.outputs[e.from[1]]||'?'} → ${ports.get(e.to[0])?.inputs[e.to[1]]||'?'}`);
}
function reshapeTypedInputs(n,d,nextType){
  const previous=n.params.type||'float';if(previous===nextType)return;
  const oldPorts=typeVariants(d).find(v=>v.type===previous)?.inputs||{},newPorts=typeVariants(d).find(v=>v.type===nextType)?.inputs||{};
  // Retain manually entered defaults per dimension, including dormant connected inputs.
  for(const [port,value]of Object.entries(n.inputValues||{})){
    if(!oldPorts[port]||!newPorts[port]||oldPorts[port]===newPorts[port])continue;
    n.ui||={};const cache=n.ui.inputValuesByType||={};const values=cache[port]||={};values[oldPorts[port]]=clone(value);
    n.inputValues[port]=Object.hasOwn(values,newPorts[port])?clone(values[newPorts[port]]):shapedValue(value,newPorts[port]);
  }
  n.params.type=nextType;
}
function autoTopology(document){return JSON.stringify({declarations:document.declarations.map(d=>[d.id,d.type]),units:autoUnits(document).map(({key,data,owner})=>[key,owner?.scope,owner?.inputs.map(p=>[p.id,p.type]),owner?.outputs.map(p=>[p.id,p.type]),data.nodes.map(n=>[n.id,n.definitionUuid,n.params.type,n.params.declarationId,n.params.functionId,n.params.bufferCount,n.ui?.typeMode]),data.edges])});}
function resolveAutoEdit(document,previous){
  if(autoTopology(document)===autoTopology(previous))return;
  const oldUnits=new Map(autoUnits(previous).map(u=>[u.key,u])),plans=[];
  for(const unit of autoUnits(document)){
    const plan=planAutoGraph(document,unit.data,unit.owner),old=oldUnits.get(unit.key);
    rejectNewTypeIssues(unit.data,plan.ports,old?.data,old?storedTypePorts(previous,old.data,old.owner):new Map());
    plans.push({...unit,plan});
  }
  for(const {data,owner,plan}of plans)for(const n of data.nodes)if(plan.choices.has(n.id))reshapeTypedInputs(n,autoDefinition(document,n,owner),plan.choices.get(n.id));
}
function setMathType(n,mode){
  const d=definition(n);if(!supportsAutoType(d))return false;
  return change(()=>{n.ui||={};if(mode==='auto')n.ui.typeMode='auto';else{if(!selectableNodeTypes(d).includes(mode))throw autoTypeError('contract.invalid');n.ui.typeMode='locked';reshapeTypedInputs(n,d,mode);}});
}
function planWireTypes(from,to,extra=null){
  const data=current(),owner=currentFunction(),nodes=extra?[...data.nodes,extra.node]:data.nodes;
  const candidate={nodes,edges:[...data.edges.filter(e=>!(e.to[0]===to.node&&e.to[1]===to.port)),{from:[from.node,from.port],to:[to.node,to.port]}]};
  const plan=planAutoGraph(graph,candidate,owner,extra?new Map([[extra.node.id,extra.ports]]):new Map());
  rejectNewTypeIssues(candidate,plan.ports,data,storedTypePorts(graph,data,owner));return plan;
}
function creatorTypePlan(d,variant,port,wire,locked){
  let id='__creator';while(current().nodes.some(n=>n.id===id))id+='_';
  const node={id,definitionUuid:d.definitionUuid,params:{...clone(d.defaults||{}),...(variant.type?{type:variant.type}:{})},ui:supportsAutoType(d)&&!locked?{typeMode:'auto'}:{}};
  const from=wire.kind==='outputs'?wire:{node:id,port},to=wire.kind==='inputs'?wire:{node:id,port};
  const plan=planWireTypes(from,to,{node,ports:variant});return plan.ports.get(id);
}

function inputTypeDisplay(n,port){
  const target=ports(n,'inputs')[port],edge=current().edges.find(e=>e.to[0]===n.id&&e.to[1]===port);
  const sourceNode=edge&&current().nodes.find(n=>n.id===edge.from[0]),source=sourceNode&&ports(sourceNode,'outputs')[edge.from[1]];
  const conversion=source&&source!==target?typeContract?.conversions.find(rule=>rule.from===source&&rule.to===target)?.kind:null;
  return {source:source||null,target,conversion,text:source&&source!==target?source+' → '+target:target};
}
function portTypeCaption(n,kind,name){
  if(kind==='outputs')return el('small',{},ports(n,kind)[name]);
  const info=inputTypeDisplay(n,name),caption=el('small',{class:'port-type'},info.text);
  if(info.source&&info.source!==info.target){
    caption.classList.add('has-conversion');caption.dataset.conversion=info.conversion||'invalid';
    caption.title=t(info.conversion==='splat'?'type.splat':'type.incompatible').replace('{source}',info.source).replace('{target}',info.target);
    caption.replaceChildren(el('span',{'data-source-type':info.source},info.source),el('span',{class:'conversion-arrow','aria-hidden':'true'},'→'),document.createTextNode(info.target));
  }
  return caption;
}
function selectNode(n,toggle=false){
  helpContext='node';
  $('#canvas').focus({preventScroll:true});
  if(toggle){if(selection.has(n.id))selection.delete(n.id);else selection.add(n.id);selected=selection.has(n.id)?n.id:[...selection].at(-1)||null;}
  else {selection=new Set([n.id]);selected=n.id;}
  selectedEdge=null;renderGraphEditActions();
}
function connectionProblem(start,end){
  if(start.kind===end.kind)return 'direction';
  const from=start.kind==='outputs'?start:end,to=start.kind==='inputs'?start:end;

  // A new edge must not close a path back to its source.
  const pending=[to.node],seen=new Set();
  while(pending.length){const id=pending.pop();if(id===from.node)return 'cycle';if(seen.has(id))continue;seen.add(id);
    for(const edge of current().edges)if(edge.from[0]===id)pending.push(edge.to[0]);}
  try{planWireTypes(from,to);}catch{return 'autoConflict';}
  return null;
}
function connectPorts(start,end){
  const problem=connectionProblem(start,end);
  if(problem){if(problem!=='direction')status(t('wire.'+problem),true);return false;}
  const from=start.kind==='outputs'?start:end,to=start.kind==='inputs'?start:end;
  const changed=change(()=>{current().edges=current().edges.filter(e=>!(e.to[0]===to.node&&e.to[1]===to.port));current().edges.push({from:[from.node,from.port],to:[to.node,to.port]});});if(changed)cancelConnection();return changed;
}
function portInfo(button){
  const node=button.closest('[data-node]');return {node:node.dataset.node,port:button.dataset.port,kind:button.dataset.kind,type:button.dataset.type};
}
function findWireTarget(candidates,x,y,radius=14){
  const hit=document.elementFromPoint(x,y);
  if(!hit?.closest('#canvas'))return null;
  const direct=hit.closest('.port');
  if(direct)return candidates.includes(direct)?direct:null;
  let nearest=null,distance=radius; // Screen pixels, independent of graph zoom.
  for(const candidate of candidates){
    const r=candidate.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,d=Math.hypot(x-cx,y-cy);
    if(d<distance&&document.elementFromPoint(cx,cy)?.closest('.port')===candidate){nearest=candidate;distance=d;}
  }
  return nearest;
}
function clearWireGesture(){if(wireGesture)wireGesture.cancel();}
function dragWire(button,event){
  if(event.button!==0||readonly)return;event.stopPropagation();
  clearWireGesture();suppressPortClick=false;
  const start=portInfo(button),sx=event.clientX,sy=event.clientY;
  const candidates=[...$('#cards').querySelectorAll('.port')].filter(p=>!connectionProblem(start,portInfo(p)));
  let moved=false,target=null,frame=0,lastEvent=null;
  const finish=()=>{
    wireGesture=null;cancelAnimationFrame(frame);target?.classList.remove('wire-target');target=null;
    button.onpointermove=button.onpointerup=button.onpointercancel=button.onlostpointercapture=null;
    window.removeEventListener('blur',cancel);document.removeEventListener('keydown',onKey,true);
    if(button.hasPointerCapture(event.pointerId))button.releasePointerCapture(event.pointerId);
    wireDrag=null;if(moved){linkStart=null;$('#connection').hidden=true;}
  };
  const cancel=()=>{suppressPortClick=true;finish();if(graph)wires();};
  const onKey=e=>{if(e.key==='Escape'){e.preventDefault();cancel();}};
  const update=e=>{
    if(e.pointerId!==event.pointerId||(!moved&&Math.hypot(e.clientX-sx,e.clientY-sy)<4))return;
    moved=true;linkStart=null;
    const next=findWireTarget(candidates,e.clientX,e.clientY);
    if(target!==next){target?.classList.remove('wire-target');target=next;target?.classList.add('wire-target');}
    const r=target?.getBoundingClientRect();
    const q=graphPoint(r?r.left+r.width/2:e.clientX,r?r.top+r.height/2:e.clientY);if(!q)return;
    wireDrag={...start,q,ready:!!target};$('#connection').hidden=false;$('#connection').textContent=t(target?'wire.release':'wire.connect');wires();
  };
  wireGesture={cancel,refresh:()=>{if(moved&&lastEvent)update(lastEvent);}};button.setPointerCapture(event.pointerId);
  window.addEventListener('blur',cancel);document.addEventListener('keydown',onKey,true);
  button.onpointermove=e=>{if(e.pointerId!==event.pointerId)return;lastEvent=e;if(!frame)frame=requestAnimationFrame(()=>{frame=0;update(lastEvent);});};
  button.onpointerup=e=>{
    if(e.pointerId!==event.pointerId)return;update(e);
    const end=target&&portInfo(target),hit=document.elementFromPoint(e.clientX,e.clientY),wasMoved=moved;
    suppressPortClick=wasMoved;finish();
    if(!wasMoved)return;
    if(end)connectPorts(start,end);
    else if(hit?.closest('#canvas')&&!hit.closest('.node'))openCreator(e.clientX,e.clientY,start);
    wires();
  };
  button.onpointercancel=button.onlostpointercapture=cancel;
}
function drawWireDrag(svg){
  if(!wireDrag)return;const n=current().nodes.find(n=>n.id===wireDrag.node),p=n&&point(n,wireDrag.port,wireDrag.kind);if(!p)return;
  const a=wireDrag.kind==='outputs'?p:wireDrag.q,b=wireDrag.kind==='outputs'?wireDrag.q:p,dx=Math.max(60,Math.abs(a.x-b.x)*.5),path=document.createElementNS('http://www.w3.org/2000/svg','path');
  path.setAttribute('d',`M ${a.x} ${a.y} C ${a.x+dx} ${a.y}, ${b.x-dx} ${b.y}, ${b.x} ${b.y}`);path.setAttribute('data-type',wireDrag.type);path.classList.add('wire-preview');path.classList.toggle('ready',wireDrag.ready);svg.append(path);
}
function nodeCanvasComment(n){
  const note=el('div',{class:'node-canvas-comment'});
  note.append(el('p',{},nodeComment(n)));
  note.onpointerdown=e=>e.stopPropagation();
  note.onclick=e=>e.stopPropagation();
  note.ondblclick=e=>e.stopPropagation();
  return note;
}
function renderCards(){
  touchGraphGesture?.cancel();clearWireGesture();const cards=$('#cards');cards.replaceChildren();
  selection=new Set([...selection].filter(id=>current().nodes.some(n=>n.id===id)));
  if(selected&&!current().nodes.some(n=>n.id===selected))selected=null;
  for(const n of current().nodes){
    n.ui||={x:0,y:0};const d=definition(n),card=el('article',{class:'node'+(selection.has(n.id)?' selected':'')+(!canDeleteNode(n)?' output':'')+(nodeHasCompileError(n.id)?' error':''),'data-node':n.id});
    card.dataset.category=nodeCategory(d||{key:''});card.style.left=n.ui.x+'px';card.style.top=n.ui.y+'px';
    const title=el('div',{class:'node-title'}),text=el('div',{class:'node-title-text'});
    const name=el('span',{class:d?.key==='function_call'?'node-function-name':'node-function-title'},d?.label||t('node.unknown'));
    name.title=d?.label||t('node.unknown');
    if(d?.key==='function_call'){const icon=$('#subgraph-icon').content.firstElementChild.cloneNode(true),local=FunctionModel.find(graph,n.params.functionId)?.scope==='local';icon.classList.toggle('source-subgraph',!local);text.append(icon);text.title=t(local?'function.local':'function.source');}
    text.append(name);title.append(text);
    if(nodeLabel(n)){
      const alias=el('span',{class:'node-alias'},nodeLabel(n));alias.title=nodeLabel(n);title.append(alias);
      alias.onpointerdown=e=>{if(e.button!==0)return;e.stopPropagation();selectNode(n);inspector();};
      alias.ondblclick=e=>{e.preventDefault();e.stopPropagation();focusNodeLabel(n);};
    }
    let suppressCardClick=false;
    title.onpointerdown=e=>{
      if(e.button!==0)return;e.stopPropagation();closeCreator();
      if(e.ctrlKey||e.metaKey)return;
      if(!selection.has(n.id))selectNode(n);else selected=n.id;
      document.querySelectorAll('.node').forEach(c=>c.classList.toggle('selected',selection.has(c.dataset.node)));inspector();
      if(readonly)return;const start=current().nodes.filter(n=>selection.has(n.id)).map(n=>({n,x:n.ui.x,y:n.ui.y})),sx=e.clientX,sy=e.clientY,priorFuture=future;let moved=false;
      title.setPointerCapture(e.pointerId);
      title.onpointermove=ev=>{
        if(!(ev.buttons&1)||(!moved&&Math.hypot(ev.clientX-sx,ev.clientY-sy)<3))return;
        if(!moved){checkpoint();moved=true;}
        const anchor=start.find(x=>x.n===n),mx=snap(anchor.x+(ev.clientX-sx)/scale)-anchor.x,my=snap(anchor.y+(ev.clientY-sy)/scale)-anchor.y;
        for(const item of start){item.n.ui.x=item.x+mx;item.n.ui.y=item.y+my;const c=cards.querySelector(`[data-node="${CSS.escape(item.n.id)}"]`);c.style.left=item.n.ui.x+'px';c.style.top=item.n.ui.y+'px';}wires();
        $('#personal-library')?.classList.toggle('drop-ready',d?.key==='function_call'&&start.length===1&&!!document.elementFromPoint(ev.clientX,ev.clientY)?.closest('#personal-library'));
      };
      title.onpointerup=ev=>{title.onpointermove=null;title.onpointerup=null;suppressCardClick=moved;$('#personal-library')?.classList.remove('drop-ready');
        if(moved&&d?.key==='function_call'&&start.length===1&&document.elementFromPoint(ev.clientX,ev.clientY)?.closest('#personal-library')){
          for(const item of start){item.n.ui.x=item.x;item.n.ui.y=item.y;}past.pop();future=priorFuture;render();savePersonalFunction(FunctionModel.find(graph,n.params.functionId));return;
        }
        if(moved){mark(false);render();}else renderNavigation();};
      title.onpointercancel=()=>{title.onpointermove=null;title.onpointerup=null;$('#personal-library')?.classList.remove('drop-ready');if(moved)mark(false);render();};
    };
    card.append(title);const list=el('div',{class:'ports'});
    for(const[kind,className]of [['inputs','input'],['outputs','output']])for(const[name,type]of Object.entries(ports(n,kind))){
      const row=el('div',{class:'port-row '+className}),b=el('button',{class:'port',title:`${d?.label} ${className}: ${name} (${type})`,'aria-label':`${n.id} ${className} ${name}`});
      b.dataset.type=type;b.dataset.kind=kind;b.dataset.port=name;row.dataset.type=type;
      b.onpointerdown=e=>dragWire(b,e);
      b.onclick=e=>{e.stopPropagation();if(readonly||suppressPortClick)return;const info=portInfo(b);if(linkStart&&linkStart.kind!==info.kind)connectPorts(linkStart,info);else {linkStart=info;$('#connection').hidden=false;$('#connection').textContent=t('wire.connect');}};
      row.append(b,el('span',{},portLabel(n,kind,name)),portTypeCaption(n,kind,name));list.append(row);
    }
    card.append(list);
    if(n.params?.value!==undefined)card.append(el('div',{class:'node-value'},Array.isArray(n.params.value)?n.params.value.join(' · '):String(n.params.value)));
    if(d?.key==='color'&&Array.isArray(n.params.value)){const strip=el('div',{class:'node-color'});strip.append(colorSwatch(n.params.value));card.append(strip);}
    if(['uniform','texture','sampler'].includes(d?.key)){const decl=graph.declarations.find(x=>x.id===n.params.declarationId);if(decl?.expose)card.append(el('div',{class:'expose-badge'},'Exposed · '+(decl.exposeName||(decl.kind==='sampler'&&decl.source==='input:0'?'Input 1 Default TOP':decl.name))));}
    if(nodeComment(n))card.append(nodeCanvasComment(n));
    card.onclick=e=>{e.stopPropagation();if(suppressCardClick)return;selectNode(n,e.ctrlKey||e.metaKey);document.querySelectorAll('.node').forEach(c=>c.classList.toggle('selected',selection.has(c.dataset.node)));inspector();renderNavigation();};
    card.ondblclick=e=>{e.stopPropagation();if(d?.key==='function_call')enterFunction(n);};cards.append(card);
  }
}
/* Node Browser: one definition index, multiple views, global search. */
let libraryTab='categories',libraryFunctionSource='all',libraryNodeCategory='all',browserSource='all',browserSelection=null;
let browserProjection=null;
const browserOpenBranches=new Set(['math','math/interpolation']);
function browserData(){return browserProjection||=(JSON.parse(document.getElementById('node-browser-data').textContent));}
const browserCategoryLabel=key=>t('browser.category.'+key);
const browserSourceLabel=key=>t('browser.source.'+key);
const normalizeSearch=value=>String(value||'').normalize('NFKC').toLowerCase().trim();
function browserMeta(d){
  const f=d.definitionUuid===FunctionModel.CALL?(d.source||FunctionModel.find(graph,d.functionId)):null;
  const authored=f?(f.browser||browserData().functions[f.source?.id]||browserData().functions[f.origin?.id]):browserData().nodes[d.definitionUuid];
  const stringList=value=>Array.isArray(value)?value.filter(x=>typeof x==='string'):[];
  const raw=authored||{},known=c=>browserData().categories.includes(c),category=known(raw.category)?raw.category:'uncategorized';
  const source=f?(f.scope==='local'?'project':f.scope==='personal'?'personal':'editor'):(raw.source||'editor');
  const path=stringList(raw.categoryPath);
  return {category,path:path[0]===category?path:[category],source,secondary:stringList(raw.secondaryCategories).filter(known),aliases:stringList(raw.aliases),tags:stringList(raw.tags),glslName:raw.glslName||'',descriptionKey:d.descriptionKey||f?.descriptionKey||raw.descriptionKey||'help.function',subgraph:!!f,saved:!!f&&!d.source&&f.scope!=='local',project:!!f&&!d.source};
}
function browserIndex(){
  // availableEntries already deduplicates installed library snapshots by source/version.
  const unique=new Map();
  for(const d of availableEntries())if(!unique.has(d.key))unique.set(d.key,{d,meta:browserMeta(d)});
  return [...unique.values()];
}
function browserSearchScore(entry,query){
  const q=normalizeSearch(query);if(!q)return 0;
  const {d,meta:m}=entry,names=[d.label,m.glslName].map(normalizeSearch),aliases=m.aliases.map(normalizeSearch);
  if(names.includes(q))return 0;if(aliases.includes(q))return 1;
  const terms=q.split(/\s+/),contains=values=>terms.every(term=>values.some(v=>v.includes(term)));
  if(contains([...names,...aliases]))return 2;
  const tags=[...m.tags,...m.path,...m.path.slice(1).map(key=>t('browser.branch.'+key)),m.category,...m.secondary,browserCategoryLabel(m.category),...m.secondary.map(browserCategoryLabel)].map(normalizeSearch);
  if(contains([...names,...aliases,...tags]))return 3;
  const description=normalizeSearch(t(m.descriptionKey));
  return contains([...names,...aliases,...tags,description])?4:Infinity;
}
function browseEntries(entries,query,{tab=libraryTab,category=libraryNodeCategory,source=browserSource,librarySource=libraryFunctionSource}={}){
  let found=entries.filter(e=>source==='all'||e.meta.source===source);
  if(normalizeSearch(query))return found.map(e=>({...e,score:browserSearchScore(e,query)})).filter(e=>Number.isFinite(e.score)).sort((a,b)=>a.score-b.score||a.d.label.localeCompare(b.d.label)||a.d.key.localeCompare(b.d.key));
  if(tab==='library')found=found.filter(e=>e.meta.subgraph&&!e.meta.project&&(librarySource==='all'||e.meta.source===librarySource));
  if(tab==='project')found=found.filter(e=>e.meta.project);
  if(category!=='all')found=found.filter(e=>e.meta.category===category||e.meta.secondary.includes(category));
  return found;
}
function activeBrowserCategories(entries){return browserData().categories.filter(cat=>entries.some(e=>e.meta.category===cat||e.meta.secondary.includes(cat)));}
function renderCategoryTabs(container,entries,active,attribute){
  const keys=['all',...activeBrowserCategories(entries)];
  const signature=keys.join('|')+'|'+language;
  if(container.dataset.signature!==signature){
    container.replaceChildren(...keys.map(key=>{
      const button=el('button',{type:'button',role:'tab',class:'category-tab','data-browser-category':key,[attribute]:key},key==='all'?t('category.all'):browserCategoryLabel(key));
      return button;
    }));container.dataset.signature=signature;
  }
  for(const b of container.children){const chosen=b.getAttribute(attribute)===active;b.setAttribute('aria-selected',String(chosen));b.tabIndex=chosen?0:-1;}
}
function browserGlyph(kind){
  if(kind==='subgraph'){const icon=$('#subgraph-icon').content.firstElementChild.cloneNode(true);icon.setAttribute('class','browser-glyph');return icon;}
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('class','browser-glyph');svg.setAttribute('aria-hidden','true');
  const path=document.createElementNS(svg.namespaceURI,'path');
  path.setAttribute('d',kind==='subgraph'?'M7 7h10l-5 10M4 7a3 3 0 1 0 6 0a3 3 0 1 0-6 0M14 7a3 3 0 1 0 6 0a3 3 0 1 0-6 0M9 17a3 3 0 1 0 6 0a3 3 0 1 0-6 0':kind==='categories'?'M4 4v16M4 7h4M4 17h4M12 7h8M12 17h8':kind==='library'?'M4 5v14M8 5v14M12 6l4 13M17 4l4 13':kind==='project'?'M3 6h6l2 2h10v12H3Z':'m12 2 9 5v10l-9 5-9-5V7Zm0 10 9-5m-9 5L3 7m9 5v10');
  svg.append(path);return svg;
}
function browserTree(entries){
  const root={children:new Map(),entries:[]};
  for(const entry of entries){
    const paths=[entry.meta.path,...entry.meta.secondary.map(cat=>[cat])],seen=new Set();
    for(const path of paths){const id=path.join('/');if(seen.has(id))continue;seen.add(id);let branch=root;
      for(const key of path){if(!branch.children.has(key))branch.children.set(key,{key,children:new Map(),entries:[]});branch=branch.children.get(key);}branch.entries.push(entry);
    }
  }
  const make=(branch,path=[])=>{
    const group=el('div',{class:path.length?'browser-tree-children':'browser-tree'});
    const children=[...branch.children.values()],order=path.length?['arithmetic','interpolation','range','trigonometry','exponential']:browserData().categories;children.sort((a,b)=>order.indexOf(a.key)-order.indexOf(b.key));
    for(const child of children){
      const childPath=[...path,child.key],id=childPath.join('/'),detail=el('details',{'data-branch':id,'data-browser-category':childPath[0],class:'browser-branch'});
      const summary=el('summary');summary.append(el('span',{class:'tree-chevron','aria-hidden':'true'}),el('span',{},path.length?t('browser.branch.'+child.key):browserCategoryLabel(child.key)));detail.append(summary,make(child,childPath));
      detail.open=browserOpenBranches.has(id);summary.onclick=e=>{e.preventDefault();detail.open=!detail.open;if(detail.open)browserOpenBranches.add(id);else browserOpenBranches.delete(id);};group.append(detail);
    }
    for(const entry of branch.entries)group.append(paletteEntry(entry.d));return group;
  };return make(root);
}
function installLibraryTabs(){
  for(const section of document.querySelectorAll('.browser-section')){
    const summary=section.querySelector('summary'),glyph=browserGlyph(section.dataset.browserSection);summary.prepend(glyph);
    section.addEventListener('toggle',()=>{if(graph)renderLibrary();});
  }
  for(const b of document.querySelectorAll('#functionsources [data-function-source]'))b.onclick=()=>{libraryFunctionSource=b.dataset.functionSource;renderLibrary();};
  $('#functionsources').onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;const buttons=[...e.currentTarget.querySelectorAll('[role=tab]')],at=buttons.indexOf(document.activeElement);if(at<0)return;e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?buttons.length-1:(at+(e.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;buttons[next].click();buttons[next].focus();};
  $('#browsersource').onchange=e=>{browserSource=e.target.value;renderLibrary();};
  $('#search').addEventListener('keydown',e=>{if(e.key==='Escape'&&e.target.value){e.preventDefault();e.target.value='';renderLibrary();}});
  $('#browserclearsearch').onclick=()=>{$('#search').value='';renderLibrary();$('#search').focus();};
}
function graphFunctionSource(d){const m=browserMeta(d);return m.source==='project'?'shader':m.source==='personal'?'personal':'builtin';}
function browserBadges(entry){const m=entry.meta;return [browserSourceLabel(m.source),...(m.subgraph?['Subgraph']:[]),...(m.saved?[t('library.savedVersion')]:[])].join(' · ');}
function paletteEntry(d){
  const entry={d,meta:browserMeta(d)},row=el('div',{class:'browser-row','data-category':nodeCategory(d),'data-browser-category':entry.meta.category});
  const button=el('button',{'data-entry':d.key,class:'palette-entry','aria-pressed':String(browserSelection===d.key)});
  button.append(browserGlyph(entry.meta.subgraph?'subgraph':'node'),el('span',{class:'palette-entry-label'},d.label),el('small',{class:'palette-entry-source'},browserSourceLabel(entry.meta.source)));
  button.draggable=!readonly;button.title=d.label+' · '+browserBadges(entry)+'\n'+t('browser.inspect');
  button.ondragstart=e=>{if(readonly){e.preventDefault();return;}e.dataTransfer.setData('application/x-sgrape-node',d.key);e.dataTransfer.effectAllowed='copy';$('#canvas').classList.add('drop-ready');};
  button.ondragend=()=>$('#canvas').classList.remove('drop-ready');
  button.onclick=()=>{browserSelection=d.key;document.querySelectorAll('#nodelibrary [data-entry]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.entry===d.key)));renderBrowserDetail(entry);};
  button.ondblclick=()=>addNode(d,(180-pan.x)/scale,(160-pan.y)/scale);
  const add=el('button',{class:'browser-add','data-add-entry':d.key,'aria-label':t('browser.add')+' '+d.label},'+');add.disabled=readonly;
  add.onclick=()=>addNode(d,(180-pan.x)/scale,(160-pan.y)/scale);row.append(button,add);return row;
}
function renderBrowserDetail(entry){
  const box=$('#browserdetail');box.hidden=!entry;box.replaceChildren();if(!entry)return;
  const head=el('div',{class:'browser-detail-heading'});head.append(el('strong',{},entry.d.label));
  const close=el('button',{'aria-label':t('browser.closeDetails')},'×');close.onclick=()=>{browserSelection=null;renderLibrary();};head.append(close);box.append(head);
  const body=el('div',{class:'browser-detail-body'});body.append(el('small',{class:'muted'},browserBadges(entry)));
  body.append(el('p',{class:'browser-category-path'},entry.meta.path.map((key,i)=>i?t('browser.branch.'+key):browserCategoryLabel(key)).join(' › ')));
  const variants=typeVariants(entry.d),variant=variants[0];
  if(variant){
    const signature=el('div',{class:'browser-signature'}),inputs=Object.entries(variant.inputs).map(([name,type])=>type+' '+name).join(', '),outputs=Object.entries(variant.outputs).map(([name,type])=>type+(Object.keys(variant.outputs).length>1?' '+name:'')).join(', ');
    signature.append(el('code',{},(entry.meta.glslName||entry.d.label)+'('+inputs+')'+(outputs?' → '+outputs:'')));
    if(variants.length>1)signature.append(el('small',{class:'muted'},t('browser.signatureExample')));body.append(signature);
  }
  body.append(markdown(t(entry.meta.descriptionKey)));
  if(entry.meta.aliases.length)body.append(el('p',{class:'browser-aliases'},'Alias: '+entry.meta.aliases.join(', ')));box.append(body);
}
function personalSourceHeader(section){
  const refresh=el('button',{class:'personal-refresh'},t('personal.refresh'));refresh.disabled=personalBusy;refresh.onclick=refreshPersonalLibrary;section.append(refresh);
  const location=el('details',{class:'personal-location'});location.append(el('summary',{},t('personal.location')),el('p',{},personalLibrary.folder||t('personal.unavailable')));
  for(const issue of personalLibrary.issues)location.append(el('p',{class:'error'},issue.file+' · '+issue.error));section.append(location);
}
function loadExample(name){
  if(readonly||!examples[name])return false;
  if(dirty&&!confirm(t('graph.exampleConfirm')))return false;
  const changed=change(()=>{graph=clone(examples[name]);graphTrail=[];selection.clear();selected=null;selectedEdge=null;errorNode=null;},{localize:false});
  if(changed){cancelConnection();closeCreator();fit();if(matchMedia('(max-width:800px)').matches)workspaceLayout.closeBrowser();}return changed;
}
function renderLibrary(){
  const query=$('#search').value,searching=!!query.trim(),entries=browserIndex();
  $('#search').placeholder=t('browser.search');
  $('#browsersections').hidden=searching;$('#browsersearchresults').hidden=!searching;
  $('#browsersearchscope').textContent=t('browser.globalSearch');
  (searching?$('#browsersearchfilters'):$('#browsercategoryfilters')).append($('#browser-source-row'));
  const matches=searching?browseEntries(entries,query,{tab:'categories',category:'all',source:browserSource}):[];
  $('#browsersearchitems').replaceChildren(...matches.map(({d})=>paletteEntry(d)));
  if(searching&&!matches.length)$('#browsersearchitems').append(el('p',{class:'muted library-empty'},t('library.noResults')));
  const sections=[['categories','nodes'],['library','libraryentries'],['project','projectentries']];
  for(const [tab,id]of sections){
    const container=$('#'+id),section=$('#browser-section-'+tab);container.replaceChildren();
    if(searching||!section.open)continue;
    const found=browseEntries(entries,'',{tab,category:'all',source:tab==='categories'?browserSource:'all'});
    if(found.length)container.append(browserTree(found));else container.append(el('p',{class:'muted library-empty'},t('library.noResults')));
    if(tab==='library'){
      const personal=el('section',{id:'personal-library',class:'browser-personal'});personal.append(el('h4',{},t('browser.source.personal')),el('p',{class:'muted'},t('personal.hint')));personalSourceHeader(personal);container.append(personal);
      const templates=el('details',{class:'browser-templates'});templates.append(el('summary',{},t('browser.templates')),el('p',{class:'muted'},t('library.exampleHint')));
      for(const name of Object.keys(examples)){const b=el('button',{class:'example-entry','data-example':name},t('example.'+name));b.disabled=readonly;b.onclick=()=>loadExample(name);templates.append(b);}container.append(templates);
    }
  }
  for(const b of document.querySelectorAll('#functionsources [data-function-source]')){const active=b.dataset.functionSource===libraryFunctionSource;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;}
  $('#libraryintro').textContent=t('browser.projectScope');
  renderBrowserDetail(entries.find(e=>e.d.key===browserSelection));$('#nodecount').textContent=current().nodes.length+' '+t('sources.nodes');
}
function closeCreator(){creatorState=null;$('#creator').hidden=true;}
function openCreator(clientX,clientY,wire=null){
  if(readonly||!graph)return;cancelConnection();const rect=$('#canvas').getBoundingClientRect();
  creatorState={path:[],anchorX:clientX,anchorY:clientY,x:(clientX-rect.left-pan.x)/scale,y:(clientY-rect.top-pan.y)/scale,wire};creatorIndex=0;
  const box=$('#creator');box.hidden=false;box.style.left=Math.max(8,Math.min(clientX,innerWidth-324))+'px';box.style.top=Math.max(8,Math.min(clientY,innerHeight-380))+'px';
  $('#createsearch').value='';$('#createsource').value='all';creatorCategory='all';$('#createtype').value='all';$('#createcontext').textContent=wire?`${wire.type} · ${wire.kind==='outputs'?'→':'←'}`:t('create.title');renderCreator();$('#createsearch').focus();
}
function renderCreator(){
  if(!creatorState)return;const query=$('#createsearch').value.toLowerCase(),category=creatorCategory,typeFilter=$('#createtype').value,wire=creatorState.wire;
  creatorMatches=[];
  const entries=browserIndex();
  renderCreatorColumns(entries,query);
  for(const {d} of browseEntries(entries,query,{tab:'categories',category,source:$('#createsource').value})){
    const entry={d,meta:browserMeta(d)},path=creatorState.path||[];if(!query.trim()&&!creatorPaths(entry).some(p=>path.every((key,i)=>p[i]===key)))continue;
    let candidates=[];
    for(const variant of typeVariants(d)){
      const p=Object.entries(wire?.kind==='inputs'?variant.outputs:variant.inputs);
      if(!wire){const socketTypes=[...Object.values(variant.inputs),...Object.values(variant.outputs)];if(typeFilter==='all'||socketTypes.includes(typeFilter))candidates.push({d,type:variant.type,port:null});}
      else for(const[name,type]of p){try{const plan=creatorTypePlan(d,variant,name,wire,typeFilter!=='all'),actual=plan[wire.kind==='inputs'?'outputs':'inputs'][name];if(typeFilter==='all'||actual===typeFilter)candidates.push({d,type:variant.type,port:name,portType:actual});}catch{}}
    }
    if(candidates.length){candidates.sort((a,b)=>Number(b.portType===wire?.type)-Number(a.portType===wire?.type));creatorMatches.push(candidates[0]);}
  }
  creatorIndex=Math.min(creatorIndex,Math.max(0,creatorMatches.length-1));const list=$('#createresults');list.replaceChildren();
  creatorMatches.forEach((match,i)=>{const b=el('button',{class:'create-entry'+(i===creatorIndex?' active':''),'data-category':nodeCategory(match.d),'data-create-entry':match.d.key},match.d.label);if(match.port)b.append(el('small',{},match.port+' · '+match.portType));b.append(el('small',{class:'create-source'},browserBadges({d:match.d,meta:browserMeta(match.d)})));b.dataset.browserCategory=browserMeta(match.d).category;b.setAttribute('role','option');b.setAttribute('aria-selected',String(i===creatorIndex));b.onclick=()=>chooseCreator(i);b.onpointerenter=e=>{if(e.pointerType==='mouse')selectCreatorResult(i);};b.onfocus=()=>selectCreatorResult(i);list.append(b);});
  if(!creatorMatches.length)list.append(el('p',{class:'muted'},t('create.empty')));
  for(const button of document.querySelectorAll('[data-create-category]')){const active=button.dataset.createCategory===(query.trim()?'all':category);button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;}
  renderCreatorDetails();
  const box=$('#creator');box.style.left=Math.max(8,Math.min(creatorState.anchorX,innerWidth-box.offsetWidth-8))+'px';box.style.top=Math.max(8,Math.min(creatorState.anchorY,innerHeight-box.offsetHeight-8))+'px';

}
function chooseCreator(index){
  const match=creatorMatches[index],state=creatorState;if(!match||!state)return;
  const changed=change(()=>{const n=instantiate(match.d,state.x,state.y,match.type,{locked:$('#createtype').value!=='all'});if(state.wire){const from=state.wire.kind==='outputs'?[state.wire.node,state.wire.port]:[n.id,match.port],to=state.wire.kind==='inputs'?[state.wire.node,state.wire.port]:[n.id,match.port];current().edges=current().edges.filter(e=>e.to[0]!==to[0]||e.to[1]!==to[1]);current().edges.push({from,to});}});
  if(changed){closeCreator();$('#canvas').focus();}else $('#createsearch').focus();
}
function duplicateSelection(){
  const ids=new Set(selection),nodes=current().nodes.filter(n=>ids.has(n.id)&&canDeleteNode(n));if(!nodes.length)return;
  change(()=>{const remap=new Map(nodes.map(n=>[n.id,'n'+crypto.randomUUID().replaceAll('-','').slice(0,12)]));
    const edges=current().edges.filter(e=>remap.has(e.from[0])&&remap.has(e.to[0])).map(e=>({from:[remap.get(e.from[0]),e.from[1]],to:[remap.get(e.to[0]),e.to[1]]}));
    for(const n of nodes){const duplicate=clone(n);duplicate.id=remap.get(n.id);duplicate.ui={...clone(n.ui),x:n.ui.x+48,y:n.ui.y+48};current().nodes.push(duplicate);}current().edges.push(...edges);selection=new Set(remap.values());selected=[...selection].at(-1);selectedEdge=null;
  });
}
function installGraphInteractions(){
  installGraphClipboard();
  const canvas=$('#canvas');canvas.tabIndex=0;
  installTouchNavigation(canvas);
  canvas.ondblclick=e=>{if(!e.target.closest('.node')&&!e.target.closest('path'))openCreator(e.clientX,e.clientY);};
  let suppressContext=false;
  canvas.oncontextmenu=e=>{e.preventDefault();if(!suppressContext)openGraphMenu(e.clientX,e.clientY,e.target.closest('.node')?.dataset.node);suppressContext=false;};
  canvas.onpointerdown=e=>{
    if(e.target.closest('.node')||e.target.closest('path')||e.target.closest('.graph-navigation'))return;
    canvas.focus();closeCreator();const boxSelect=(boxSelectMode&&e.button===0)||e.shiftKey||e.button===2,sx=e.clientX,sy=e.clientY,ox=pan.x,oy=pan.y,previous=e.ctrlKey||e.metaKey?new Set(selection):new Set();let moved=false;
    if(![0,1,2].includes(e.button))return;canvas.setPointerCapture(e.pointerId);
    canvas.onpointermove=ev=>{moved=Math.hypot(ev.clientX-sx,ev.clientY-sy)>3;
      if(boxSelect){const rect=canvas.getBoundingClientRect(),box=$('#marquee');box.hidden=false;box.style.left=Math.min(sx,ev.clientX)-rect.left+'px';box.style.top=Math.min(sy,ev.clientY)-rect.top+'px';box.style.width=Math.abs(ev.clientX-sx)+'px';box.style.height=Math.abs(ev.clientY-sy)+'px';
        selection=new Set(previous);document.querySelectorAll('.node').forEach(card=>{const r=card.getBoundingClientRect();if(r.right>=Math.min(sx,ev.clientX)&&r.left<=Math.max(sx,ev.clientX)&&r.bottom>=Math.min(sy,ev.clientY)&&r.top<=Math.max(sy,ev.clientY))selection.add(card.dataset.node);card.classList.toggle('selected',selection.has(card.dataset.node));});
      }else {pan={x:ox+ev.clientX-sx,y:oy+ev.clientY-sy};transform();}
    };
    canvas.onpointerup=ev=>{canvas.onpointermove=null;canvas.onpointerup=null;$('#marquee').hidden=true;
      if(boxSelect&&moved){selected=[...selection].at(-1)||null;selectedEdge=null;suppressContext=e.button===2;render();}
      else if(!moved&&e.button===0){if(linkStart)openCreator(ev.clientX,ev.clientY,linkStart);else {selected=null;selection.clear();selectedEdge=null;render();}}
    };
    canvas.onpointercancel=()=>{canvas.onpointermove=null;canvas.onpointerup=null;$('#marquee').hidden=true;};
  };
  document.addEventListener('pointerdown',e=>{if(creatorState&&!e.target.closest('#creator'))closeCreator();});
  for(const id of ['createsearch','createtype','createsource'])$('#'+id).addEventListener(id==='createsearch'?'input':'change',()=>{if(id==='createsource'&&creatorState){creatorState.path=[];creatorCategory='all';}creatorIndex=0;renderCreator();});
  installCreatorColumns();
  $('#closecreator').onclick=closeCreator;
  $('#creator').onkeydown=e=>{
    if(e.key==='Escape'){e.preventDefault();closeCreator();canvas.focus();}
    if(e.target.closest('#createcategory')||e.target.tagName==='SELECT')return;
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();creatorIndex=Math.max(0,Math.min(creatorMatches.length-1,creatorIndex+(e.key==='ArrowDown'?1:-1)));selectCreatorResult(creatorIndex);$('#createresults .active')?.scrollIntoView({block:'nearest'});}
    if(e.key==='Enter'&&e.target.tagName!=='SELECT'){e.preventDefault();chooseCreator(creatorIndex);}
  };
  document.addEventListener('keydown',e=>{
    if(e.target.closest('.details')||e.target.closest('#grapheditmenu')||e.target.closest('.library')||e.target.closest('#creator')||e.target.closest('.shader-selector')||e.target.closest('dialog')||['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;
    if(e.key==='ContextMenu'||(e.shiftKey&&e.key==='F10')){e.preventDefault();const r=canvas.getBoundingClientRect();openGraphMenu(r.left+r.width/2,r.top+r.height/3);return;}
    if(e.key==='Tab'){e.preventDefault();const r=canvas.getBoundingClientRect();openCreator(r.left+r.width/2,r.top+r.height/3);}
    if(e.key==='Escape'){cancelConnection();closeCreator();}
    if(e.altKey&&e.key==='ArrowUp'){e.preventDefault();if(graphTrail.length)navigateGraph(graphTrail.length-1);}
    if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();remove();}
    if(e.ctrlKey||e.metaKey){const k=e.key.toLowerCase();if(['z','a','d','g'].includes(k))e.preventDefault();
      if(k==='z')undo(e.shiftKey);if(k==='a'){selection=new Set(current().nodes.map(n=>n.id));selected=[...selection].at(-1);render();}if(k==='d')duplicateSelection();if(k==='g')groupSelection();
    }
  });
  $('#graphup').onclick=()=>navigateGraph(graphTrail.length-1);$('#group').onclick=groupSelection;$('#newfunction').onclick=newFunction;
  $('#boxselect').onclick=()=>{boxSelectMode=!boxSelectMode;$('#boxselect').setAttribute('aria-pressed',String(boxSelectMode));};
}

function installTouchNavigation(canvas){
  // One owner for a touch sequence. Graph edits remain previews until release;
  // a second finger cancels the preview and takes over as anchored navigation.
  const points=new Map(),slop=8,holdDelay=550,doubleDelay=320;
  let gesture=null,frame=0,holdTimer=0,lastTap=null,lastTouch=-Infinity,lastDevice='mouse';
  const stop=e=>{if(e.cancelable)e.preventDefault();e.stopImmediatePropagation();};
  const editable=target=>target.closest('input,textarea,select,[contenteditable="true"],a,button:not(.port),.graph-navigation');
  const syncSelection=()=>document.querySelectorAll('.node').forEach(c=>c.classList.toggle('selected',selection.has(c.dataset.node)));
  const sample=()=>{const [a,b=a]=[...points.values()];return{x:(a.x+b.x)/2,y:(a.y+b.y)/2,distance:Math.hypot(b.x-a.x,b.y-a.y)};};
  const rebase=()=>{gesture.origin={...sample(),pan:{...pan},scale};};
  const stopHold=()=>{clearTimeout(holdTimer);holdTimer=0;};
  const clearPreview=g=>{
    for(const item of g?.positions||[]){if(item.card.isConnected){item.card.style.left=item.x+'px';item.card.style.top=item.y+'px';}}
    if(g?.mode==='box'){selection=new Set(g.selection);selected=g.selected;selectedEdge=g.selectedEdge;syncSelection();}
    g?.target?.classList.remove('wire-target');wireDrag=null;$('#marquee').hidden=true;
    if(g?.mode==='wire'){$('#connection').hidden=true;linkStart=null;}
  };
  const finish=()=>{
    stopHold();cancelAnimationFrame(frame);frame=0;
    const g=gesture,ids=[...points.keys()];gesture=null;touchGraphGesture=null;points.clear();
    for(const id of ids)if(canvas.hasPointerCapture(id))canvas.releasePointerCapture(id);
    lastTouch=performance.now();return g;
  };
  const cancel=()=>{
    if(!gesture)return;const g=finish();clearPreview(g);lastTap=null;if(graph)wires();
  };
  const touchPort=(x,y)=>findWireTarget([...$('#cards').querySelectorAll('.port')],x,y,22);
  const edgeIndex=path=>path?current().edges.findIndex(e=>e.from.join(':')===path.dataset.from&&e.to.join(':')===path.dataset.to):-1;
  const selectEdge=index=>{selectedEdge=index;selected=null;selection.clear();syncSelection();inspector();wires();renderNavigation();};
  const openMenu=(g,p)=>{
    if(g.node&&!selection.has(g.node.id)){selectNode(g.node);syncSelection();inspector();}
    else if(g.edge>=0)selectEdge(g.edge);
    g.mode='menu';lastTap=null;cancelConnection();openGraphMenu(p.x,p.y,g.node?.id||null,{touch:true});
  };
  const beginPinch=()=>{
    const g=gesture;stopHold();cancelAnimationFrame(frame);frame=0;clearPreview(g);
    g.positions=null;g.target=null;g.mode='pinch';g.moved=true;g.hadPinch=true;lastTap=null;
    closeGraphMenu();cancelConnection();rebase();
  };
  const paint=()=>{
    frame=0;const g=gesture;if(!g||!points.size)return;
    const p=sample(),dx=p.x-g.start.x,dy=p.y-g.start.y;
    if(points.size>=2){
      const o=g.origin,r=canvas.getBoundingClientRect();
      scale=Math.max(.25,Math.min(1.7,o.scale*p.distance/Math.max(1,o.distance)));
      pan={x:p.x-r.left-(o.x-r.left-o.pan.x)*scale/o.scale,y:p.y-r.top-(o.y-r.top-o.pan.y)*scale/o.scale};transform();return;
    }
    if(g.mode==='pan'){
      const o=g.origin;pan={x:o.pan.x+p.x-o.x,y:o.pan.y+p.y-o.y};transform();
    }else if(g.mode==='node'){
      const anchor=g.positions.find(item=>item.node===g.node),mx=snap(anchor.x+dx/g.origin.scale)-anchor.x,my=snap(anchor.y+dy/g.origin.scale)-anchor.y;
      for(const item of g.positions){item.nextX=item.x+mx;item.nextY=item.y+my;item.card.style.left=item.nextX+'px';item.card.style.top=item.nextY+'px';}wires();
    }else if(g.mode==='wire'){
      const target=findWireTarget(g.candidates,p.x,p.y,22);if(g.target!==target){g.target?.classList.remove('wire-target');g.target=target;target?.classList.add('wire-target');}
      const r=target?.getBoundingClientRect(),q=graphPoint(r?r.left+r.width/2:p.x,r?r.top+r.height/2:p.y);
      if(q){wireDrag={...g.port,q,ready:!!target};$('#connection').hidden=false;$('#connection').textContent=t(target?'wire.release':'wire.touchConnect');wires();}
    }else if(g.mode==='box'){
      const r=canvas.getBoundingClientRect(),box=$('#marquee');box.hidden=false;
      box.style.left=Math.min(g.start.x,p.x)-r.left+'px';box.style.top=Math.min(g.start.y,p.y)-r.top+'px';box.style.width=Math.abs(dx)+'px';box.style.height=Math.abs(dy)+'px';
      selection=new Set();document.querySelectorAll('.node').forEach(card=>{const r=card.getBoundingClientRect();if(r.right>=Math.min(g.start.x,p.x)&&r.left<=Math.max(g.start.x,p.x)&&r.bottom>=Math.min(g.start.y,p.y)&&r.top<=Math.max(g.start.y,p.y))selection.add(card.dataset.node);});syncSelection();
    }
  };
  const move=()=>{
    const g=gesture,p=sample();if(!g||g.mode==='menu')return;
    if(!g.moved&&Math.hypot(p.x-g.start.x,p.y-g.start.y)>=slop){
      g.moved=true;stopHold();lastTap=null;
      if(g.port&&!readonly){g.mode='wire';cancelConnection();g.candidates=[...$('#cards').querySelectorAll('.port')].filter(b=>!connectionProblem(g.port,portInfo(b)));}
      else if(g.node&&!readonly){
        g.mode='node';if(!selection.has(g.node.id))selectNode(g.node);else selected=g.node.id;selectedEdge=null;syncSelection();inspector();cancelConnection();
        g.positions=current().nodes.filter(n=>selection.has(n.id)).map(node=>({node,card:$('#cards').querySelector(`[data-node="${CSS.escape(node.id)}"]`),x:node.ui.x,y:node.ui.y,nextX:node.ui.x,nextY:node.ui.y}));
      }else if(!g.node){g.mode=boxSelectMode?'box':'pan';cancelConnection();}
      else g.mode='blocked';
    }
    if(g.moved&&!frame)frame=requestAnimationFrame(paint);
  };
  const tap=(g,p)=>{
    if(g.port){
      lastTap=null;if(readonly)return;
      if(linkStart?.node===g.port.node&&linkStart.port===g.port.port&&linkStart.kind===g.port.kind){cancelConnection();return;}
      if(linkStart&&linkStart.kind!==g.port.kind)connectPorts(linkStart,g.port);
      else {linkStart=g.port;$('#connection').hidden=false;$('#connection').textContent=t('wire.touchConnect');}
      return;
    }
    const key=g.node?'node:'+g.node.id:g.edge>=0?'edge:'+g.edge:'canvas',now=performance.now();
    const double=lastTap&&lastTap.key===key&&now-lastTap.time<=doubleDelay&&Math.hypot(p.x-lastTap.x,p.y-lastTap.y)<24;
    lastTap=double?null:{key,time:now,x:p.x,y:p.y};
    if(g.node){
      selectNode(g.node);syncSelection();inspector();renderNavigation();
      if(double){if(g.alias)focusNodeLabel(g.node);else if(definition(g.node)?.key==='function_call')enterFunction(g.node);}
    }else if(g.edge>=0)selectEdge(g.edge);
    else if(double||linkStart){const start=linkStart;lastTap=null;openCreator(p.x,p.y,start);}
    else {selected=selectedEdge=null;selection.clear();syncSelection();inspector();renderNavigation();}
  };
  canvas.addEventListener('pointerdown',e=>{
    if(e.pointerType!=='touch'||!graph||editable(e.target))return;stop(e);lastDevice='touch';lastTouch=performance.now();canvas.dataset.input='touch';
    if(!points.size){
      clearWireGesture();closeCreator();closeGraphMenu();canvas.focus({preventScroll:true});
      const button=touchPort(e.clientX,e.clientY),card=(button||e.target).closest('.node'),node=card&&current().nodes.find(n=>n.id===card.dataset.node);
      gesture={mode:'pending',start:{x:e.clientX,y:e.clientY},data:current(),node,port:button?portInfo(button):null,alias:!!e.target.closest('.node-alias'),edge:edgeIndex(e.target.closest('#wires path[data-from]')),moved:false,hadPinch:false,selection:new Set(selection),selected,selectedEdge};
      touchGraphGesture={cancel};
      if(!button)holdTimer=setTimeout(()=>{holdTimer=0;if(gesture&&!gesture.moved&&points.size===1)openMenu(gesture,sample());},holdDelay);
    }
    points.set(e.pointerId,{x:e.clientX,y:e.clientY});canvas.setPointerCapture(e.pointerId);
    if(points.size>=2)beginPinch();else rebase();
  },true);
  canvas.addEventListener('pointermove',e=>{
    if(!points.has(e.pointerId))return;stop(e);points.set(e.pointerId,{x:e.clientX,y:e.clientY});move();
  },true);
  canvas.addEventListener('pointerup',e=>{
    if(!points.has(e.pointerId))return;stop(e);points.set(e.pointerId,{x:e.clientX,y:e.clientY});move();cancelAnimationFrame(frame);paint();
    const g=gesture,p={x:e.clientX,y:e.clientY};
    if(points.size>1){points.delete(e.pointerId);if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);g.mode=points.size>=2?'pinch':'pan';rebase();return;}
    const target=g.target&&portInfo(g.target),hit=document.elementFromPoint(p.x,p.y);finish();
    if(g.mode==='node'){
      clearPreview(g);if(!readonly&&current()===g.data&&g.positions.some(item=>item.x!==item.nextX||item.y!==item.nextY)){
        checkpoint();for(const item of g.positions){item.node.ui.x=item.nextX;item.node.ui.y=item.nextY;}mark(false);render();
      }else wires();
    }else if(g.mode==='wire'){
      clearPreview(g);if(target)connectPorts(g.port,target);
      else if(hit?.closest('#canvas')&&!hit.closest('.node'))openCreator(p.x,p.y,g.port);wires();
    }else if(g.mode==='box'){$('#marquee').hidden=true;selected=[...selection].at(-1)||null;selectedEdge=null;inspector();renderNavigation();}
    else if(!g.moved&&!g.hadPinch&&g.mode!=='menu')tap(g,p);
  },true);
  for(const name of ['pointercancel','lostpointercapture'])canvas.addEventListener(name,e=>{if(points.has(e.pointerId)){stop(e);cancel();}},true);
  // Keep native double-tap zoom, text selection and callouts out of this canvas,
  // including older iOS handling of absolutely positioned descendants.
  for(const name of ['touchstart','touchmove'])canvas.addEventListener(name,e=>{if(!editable(e.target)&&e.cancelable)e.preventDefault();},{passive:false});
  for(const name of ['click','dblclick','contextmenu'])canvas.addEventListener(name,e=>{
    if(e.isTrusted&&!editable(e.target)&&(points.size||e.pointerType==='touch'||lastDevice==='touch'&&performance.now()-lastTouch<900))stop(e);
  },true);
  document.addEventListener('pointerdown',e=>{lastDevice=e.pointerType;if(e.pointerType!=='touch'){cancel();lastTouch=-Infinity;lastTap=null;canvas.dataset.input=e.pointerType;}else if(gesture&&!e.target.closest('#canvas'))cancel();},true);
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){lastTap=null;cancel();}},true);
  window.addEventListener('blur',()=>{lastTap=null;cancel();});window.addEventListener('resize',()=>{lastTap=null;cancel();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){lastTap=null;cancel();}});
}

let editorClipboard=null,graphEditMenu=null,pastePoint=null,pasteCount=0;
let clipboardSource=null;
const editableText=target=>target?.closest?.('input,textarea,select,[contenteditable="true"],dialog,.library,.details,#creator');
function clipboardSelection(){return current().nodes.filter(n=>selection.has(n.id)&&canDeleteNode(n)).map(n=>n.id);}
function copyGraphSelection(){const text=GraphClipboard.encode(graph,current(),clipboardSelection(),clipboardSource);if(text){editorClipboard=text;pasteCount=0;renderGraphEditActions();}return text;}

function renderGraphEditActions(){
  const count=graph&&selectedEdge===null?clipboardSelection().length:0;
  const edge=graph&&selectedEdge!==null&&!!current().edges[selectedEdge];
  for(const [id,key,enabled] of [
    ['graphcopy','edit.copy',count>0],
    ['graphpaste','edit.paste',graph&&!readonly&&(!!editorClipboard||!!navigator.clipboard?.readText)],
    ['graphgroup','function.group',graph&&!readonly&&selectedEdge===null&&current().nodes.some(n=>selection.has(n.id)&&canDeleteNode(n)&&!SubgraphSourcePolicy.isSource(n,catalog))],
    ['graphdelete',edge?'wire.disconnectSelected':'node.delete',!readonly&&(count>0||edge)]
  ]){
    const button=$('#'+id);button.disabled=!enabled;button.title=t(key);button.setAttribute('aria-label',t(key));
  }
}
async function copyGraphToClipboard(){
  let text;try{text=copyGraphSelection();}catch(e){status(t(e.clipboardCode||'clipboard.invalid'),true);return;}
  if(!text)return;
  $('#canvas').focus({preventScroll:true});
  let copied=false;
  // Explicit Copy owns this event even when a Parameter text range was selected.
  const capture=e=>{if(e.clipboardData){e.clipboardData.setData('text/plain',text);e.preventDefault();e.stopImmediatePropagation();copied=true;}};
  document.addEventListener('copy',capture,true);
  try{document.execCommand('copy');}catch{}finally{document.removeEventListener('copy',capture,true);}
  if(!copied&&navigator.clipboard?.writeText){try{await navigator.clipboard.writeText(text);copied=true;}catch{}}
  status(t(copied?'clipboard.copied':'clipboard.localCopy'));
}
async function pasteGraphFromClipboard(position){
  if(!graph||readonly)return false;
  const owner=graph,level=current(),pasteStage=stage;
  let text;try{if(navigator.clipboard?.readText)text=await navigator.clipboard.readText();}catch{}
  // A clipboard permission prompt must not paste into a different graph level.
  if(graph!==owner||stage!==pasteStage||current()!==level||readonly)return false;
  if(!text)text=editorClipboard;
  if(text)return pasteGraphSelection(text,position);
  status(t('clipboard.useShortcut'));return false;
}
function pasteGraphFromToolbar(){
  const rect=$('#canvas').getBoundingClientRect(),offset=(pasteCount%5)*24;
  // Disregard the last pointer position; it can be offscreen after touch panning.
  // Bound the stagger so repeated button presses stay in the visible area.
  return pasteGraphFromClipboard({x:(rect.width/3-pan.x)/scale+offset-pasteCount*24,y:(rect.height/3-pan.y)/scale+offset-pasteCount*24});
}

function pasteGraphSelection(text,position=null){
  if(readonly||!graph)return false;
  let payload;try{payload=GraphClipboard.decode(text);}catch(e){status(t(e.clipboardCode||'clipboard.invalid'),true);return false;}
  const canvas=$('#canvas').getBoundingClientRect(),anchor=position||pastePoint||{x:(canvas.width/2-pan.x)/scale,y:(canvas.height/3-pan.y)/scale};
  const changed=change(()=>{let ids;try{ids=GraphClipboard.paste(graph,current(),payload,{source:clipboardSource,stage,target:editorTarget,catalog,types:interfaceTypes(),anchor:{x:snap(anchor.x+pasteCount*24),y:snap(anchor.y+pasteCount*24)}});}catch(e){if(e.clipboardCode)e.message=t(e.clipboardCode);throw e;}selection=new Set(ids);selected=ids.at(-1);selectedEdge=null;});
  if(changed){pasteCount++;status(t('clipboard.pasted'));$('#canvas').focus({preventScroll:true});}return changed;
}
function closeGraphMenu(){graphEditMenu?.remove();graphEditMenu=null;}
function openGraphMenu(x,y,nodeId=null,{touch=false}={}){
  closeGraphMenu();closeCreator();cancelConnection();
  if(nodeId&&!selection.has(nodeId)){selectNode(current().nodes.find(n=>n.id===nodeId));render();}
  const rect=$('#canvas').getBoundingClientRect(),position={x:(x-rect.left-pan.x)/scale,y:(y-rect.top-pan.y)/scale};
  const menu=el('div',{id:'grapheditmenu',role:'menu','data-input':touch?'touch':'mouse','aria-label':t('edit.menu')}),count=clipboardSelection().length;
  const rows=[
    ['add',t('action.nodes'),'Tab',!readonly,()=>openCreator(x,y)],
    ['copy',t('edit.copy'),'Ctrl+C',count>0,copyGraphToClipboard],
    ['paste',t('edit.paste'),'Ctrl+V',!readonly&&(!!editorClipboard||!!navigator.clipboard?.readText),()=>pasteGraphFromClipboard(position)],
    ['rename',t('function.rename'),'',!readonly&&count===1&&definition(current().nodes.find(n=>selection.has(n.id)))?.key==='function_call',focusFunctionName],
    ['duplicate',t('edit.duplicate'),'Ctrl+D',!readonly&&count>0,duplicateSelection],
    ['group',t('function.group'),'Ctrl+G',!readonly&&count>0,groupSelection],
    ['delete',t(selectedEdge!==null?'wire.disconnectSelected':'node.delete'),'Delete',!readonly&&(count>0||selectedEdge!==null),remove]
  ];
  for(const[key,label,shortcut,enabled,action]of rows){if(key==='rename'&&!enabled)continue;const b=el('button',{role:'menuitem','data-edit':key},label);b.append(el('small',{},shortcut));b.disabled=!enabled;b.onclick=()=>{closeGraphMenu();$('#canvas').focus({preventScroll:true});action();};menu.append(b);}
  menu.onkeydown=e=>{if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();e.stopPropagation();const items=[...menu.querySelectorAll('button:not(:disabled)')],at=items.indexOf(document.activeElement),next=e.key==='Home'?0:e.key==='End'?items.length-1:(at+(e.key==='ArrowUp'?-1:1)+items.length)%items.length;items[next]?.focus();}if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeGraphMenu();$('#canvas').focus();}};
  document.body.append(menu);graphEditMenu=menu;menu.style.left=Math.max(4,Math.min(x,innerWidth-menu.offsetWidth-4))+'px';menu.style.top=Math.max(4,Math.min(y,innerHeight-menu.offsetHeight-4))+'px';menu.querySelector('button:not(:disabled)')?.focus();
}
function installGraphClipboard(){
  $('#graphcopy').onclick=copyGraphToClipboard;
  $('#graphpaste').onclick=pasteGraphFromToolbar;
  $('#graphgroup').onclick=()=>{if(!$('#graphgroup').disabled)groupSelection();};
  $('#graphdelete').onclick=()=>{if(!$('#graphdelete').disabled){$('#canvas').focus({preventScroll:true});remove();}};
  clipboardSource=shaderId||crypto.randomUUID();
  $('#canvas').addEventListener('pointermove',e=>{const r=e.currentTarget.getBoundingClientRect();pastePoint={x:(e.clientX-r.left-pan.x)/scale,y:(e.clientY-r.top-pan.y)/scale};});
  document.addEventListener('copy',e=>{if(!graph||editableText(e.target)||window.getSelection()?.toString())return;try{const text=copyGraphSelection();if(!text||!e.clipboardData)return;e.clipboardData.setData('text/plain',text);e.preventDefault();status(t('clipboard.copied'));}catch(error){status(t(error.clipboardCode||'clipboard.invalid'),true);}});
  document.addEventListener('paste',e=>{if(!graph||readonly||editableText(e.target))return;const text=e.clipboardData?.getData('text/plain');if(!text)return;e.preventDefault();pasteGraphSelection(text);});
  document.addEventListener('pointerdown',e=>{if(graphEditMenu&&!e.target.closest('#grapheditmenu'))closeGraphMenu();});
  window.addEventListener('blur',closeGraphMenu);window.addEventListener('resize',closeGraphMenu);
}

function creatorPaths(entry){return [entry.meta.path,...entry.meta.secondary.map(cat=>[cat])];}
function renderCreatorColumns(entries,query){
  const container=$('#createcategory'),path=creatorState.path||(creatorState.path=[]),filtered=entries.filter(e=>$('#createsource').value==='all'||e.meta.source===$('#createsource').value);
  container.replaceChildren();container.className='create-category-columns';container.removeAttribute('role');
  if(query.trim()){container.hidden=true;return;}container.hidden=false;
  const paths=filtered.flatMap(creatorPaths),depth=Math.max(1,path.length+Number(paths.some(p=>p.length>path.length&&path.every((key,i)=>p[i]===key))));
  for(let level=0;level<depth;level++){
    const prefix=path.slice(0,level),keys=[...new Set(paths.filter(p=>prefix.every((key,i)=>p[i]===key)&&p[level]).map(p=>p[level]))];
    if(!keys.length)break;
    const order=level?['arithmetic','interpolation','range','trigonometry','exponential']:browserData().categories;
    keys.sort((a,b)=>{const ai=order.indexOf(a),bi=order.indexOf(b);return (ai<0?999:ai)-(bi<0?999:bi)||a.localeCompare(b);});
    const column=el('div',{class:'create-category-column',role:'listbox','aria-label':t('create.category')+' '+(level+1),'data-level':level});
    for(const key of [null,...keys]){
      const selected=key===null?!path[level]:path[level]===key,label=key===null?t('category.all'):level?(t('browser.branch.'+key)==='browser.branch.'+key?key:t('browser.branch.'+key)):browserCategoryLabel(key);
      const button=el('button',{type:'button',class:'create-category-choice',role:'option','aria-selected':String(selected),tabindex:selected?'0':'-1','data-create-path':JSON.stringify(key===null?prefix:[...prefix,key])},label);
      if(key!==null&&paths.some(p=>[...prefix,key].every((x,i)=>p[i]===x)&&p.length>level+1))button.append(el('span',{'aria-hidden':'true'},'›'));
      button.onclick=()=>{creatorState.path=key===null?prefix:[...prefix,key];creatorCategory=creatorState.path[0]||'all';creatorIndex=0;renderCreator();};column.append(button);
    }
    container.append(column);
  }
}
function renderCreatorDetails(){
  const box=$('#createdetail'),match=creatorMatches[creatorIndex];box.replaceChildren();if(!match){box.append(el('p',{class:'muted'},t('create.empty')));return;}
  const entry={d:match.d,meta:browserMeta(match.d)},meta=entry.meta;
  box.append(el('strong',{},match.d.label),el('small',{class:'muted'},browserBadges(entry)),el('p',{class:'browser-category-path'},meta.path.map((key,i)=>i?(t('browser.branch.'+key)==='browser.branch.'+key?key:t('browser.branch.'+key)):browserCategoryLabel(key)).join(' › ')));
  const variant=typeVariants(match.d).find(v=>v.type===match.type)||typeVariants(match.d)[0];
  if(variant){const inputs=Object.entries(variant.inputs).map(([name,type])=>type+' '+name).join(', '),outputs=Object.entries(variant.outputs).map(([name,type])=>type+' '+name).join(', ');box.append(el('code',{class:'browser-signature'},(meta.glslName||match.d.label)+'('+inputs+')'+(outputs?' → '+outputs:'')));}
  box.append(markdown(t(meta.descriptionKey)));
  if(meta.aliases.length)box.append(el('p',{class:'browser-aliases'},'Alias: '+meta.aliases.join(', ')));
}
function selectCreatorResult(index){creatorIndex=index;$('#createresults').querySelectorAll('.create-entry').forEach((b,i)=>{b.classList.toggle('active',i===index);b.setAttribute('aria-selected',String(i===index));});renderCreatorDetails();}
function installCreatorColumns(){
  $('#createcategory').onkeydown=e=>{
    if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End','Enter'].includes(e.key))return;
    const column=e.target.closest('.create-category-column');if(!column)return;e.preventDefault();e.stopImmediatePropagation();const buttons=[...column.children],at=buttons.indexOf(e.target);
    if(e.key==='ArrowLeft'){column.previousElementSibling?.querySelector('[aria-selected=true]')?.focus();return;}
    if(e.key==='ArrowRight'||e.key==='Enter'){e.target.click();const next=$('#createcategory').querySelector(`[data-level="${Number(column.dataset.level)+1}"] [aria-selected=true]`);(next||$('#createresults .active'))?.focus();return;}
    const next=e.key==='Home'?0:e.key==='End'?buttons.length-1:Math.max(0,Math.min(buttons.length-1,at+(e.key==='ArrowDown'?1:-1)));buttons[next].focus();buttons[next].scrollIntoView({block:'nearest',inline:'nearest'});
  };
}
