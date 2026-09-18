// Experimental UI defaults; overrides stay in this browser, never in graph/layout data.
const EDITOR_DEV_DEFAULTS = Object.freeze({ canvasTrash: false, floatingToolbar: true, editToolbar: true, selectionToolbar: 'off', selectionCollapseTools: true, persistentSelectionBounds: false, hideGroupedSelectionBounds: false, nodeBodyDrag: true, nodeDragCursor: 'default', nodeResizeHint: true, nodeCollapseExpandedHint: true, nodeCollapseCollapsedHint: true, rgbaComponentTint: true, vectorComponentTint: false, autoDisconnectInvalidEdges: true, uiStyle: 'professional', systemClock: false });
const EDITOR_DEV_SETTINGS = {...EDITOR_DEV_DEFAULTS};
let touchGraphGesture=null;
// Experimental canvas drop target. Dropping is the commit; hovering never edits.
let graphTrash=null,nodeDragGesture=null,nodeResizeGesture=null,suppressWireClick=false;
function isBlankWireDrop(x,y){
  const hit=document.elementFromPoint(x,y);
  return !!hit?.closest('#canvas')&&!hit.closest('.node,#wires path,.graph-navigation,.selection-toolbar');
}
function canDisconnectInputOnBlank(start){
  return !EDITOR_DEV_SETTINGS.canvasTrash&&!readonly&&start?.kind==='inputs'&&current().edges.some(e=>e.to[0]===start.node&&e.to[1]===start.port);
}
function wireStartHint(start,touch=false){return canDisconnectInputOnBlank(start)?'wire.inputDisconnectHint':touch?'wire.touchConnect':'wire.connect';}
function finishWireOnBlank(start,x,y){
  if(start?.add||!isBlankWireDrop(x,y))return;
  if(canDisconnectInputOnBlank(start)){
    const changed=change(()=>{current().edges=current().edges.filter(e=>e.to[0]!==start.node||e.to[1]!==start.port);selectedEdge=null;});
    if(changed)cancelConnection();
  }else openCreator(x,y,start);
}
function trashTarget(kind,value){
  const data=current(),target={owner:graph,data,stage,kind,ids:[],edges:[]};
  if(kind==='nodes')target.ids=value.filter(n=>canDeleteNode(n)).map(n=>n.id);
  else if(kind==='edge')target.edges=data.edges[value]?[clone(data.edges[value])]:[];
  else if(kind==='port'&&value.kind==='inputs')target.edges=data.edges.filter(e=>e.to[0]===value.node&&e.to[1]===value.port).map(clone);
  target.allowed=!readonly&&(kind==='port'||target.ids.length>0||target.edges.length>0);
  return target;
}
function beginGraphTrash(target){if(!EDITOR_DEV_SETTINGS.canvasTrash){clearGraphTrash();return;}graphTrash={...target,over:false};$('#graphtrash').dataset.state=target.allowed?'available':'blocked';}
function trashMessage(target,over){
  if(!target.allowed)return t('trash.protected');
  if(!over)return t('trash.hint');
  if(target.ids.length)return t('trash.releaseNodes').replace('{count}',target.ids.length);
  return t(target.edges.length?'trash.releaseWire':'trash.cancelWire');
}
function paintTrashHighlights(){
  const target=graphTrash,active=target?.over&&target.allowed;
  document.querySelectorAll('#cards .node').forEach(card=>card.classList.toggle('trash-pending',!!active&&target.ids.includes(card.dataset.node)));
  document.querySelectorAll('#wires path[data-from]').forEach(path=>path.classList.toggle('trash-pending',!!active&&target.edges.some(e=>e.from.join(':')===path.dataset.from&&e.to.join(':')===path.dataset.to)));
}
function updateGraphTrash(x,y){
  const target=graphTrash;if(!EDITOR_DEV_SETTINGS.canvasTrash||!target)return false;
  // The fixed transparent target stays larger than the animated trash icon.
  const r=$('#graphtrash').getBoundingClientRect(),canvas=$('#canvas').getBoundingClientRect();
  target.over=x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom&&x>=canvas.left&&y>=canvas.top;
  $('#graphtrash').dataset.state=target.over?(target.allowed?'active':'blocked'):(target.allowed?'available':'blocked');
  $('#graphtrashlabel').textContent=target.over?trashMessage(target,true):'';
  paintTrashHighlights();return target.over;
}
function clearGraphTrash(){
  graphTrash=null;$('#graphtrash').hidden=!EDITOR_DEV_SETTINGS.canvasTrash;$('#graphtrash').dataset.state='idle';$('#graphtrashlabel').textContent='';$('#graphtrashproxy').hidden=true;paintTrashHighlights();
}
function graphTrashDrop(x,y){return updateGraphTrash(x,y)?{...graphTrash}:null;}
function commitGraphTrash(target){
  if(!EDITOR_DEV_SETTINGS.canvasTrash||!target?.allowed||readonly||graph!==target.owner||current()!==target.data||stage!==target.stage)return false;
  const ids=new Set(current().nodes.filter(n=>target.ids.includes(n.id)&&canDeleteNode(n)).map(n=>n.id));
  const matches=e=>target.edges.some(edge=>edge.from[0]===e.from[0]&&edge.from[1]===e.from[1]&&edge.to[0]===e.to[0]&&edge.to[1]===e.to[1]);
  if(!ids.size&&!current().edges.some(matches))return false;
  return change(()=>{
    current().nodes=current().nodes.filter(n=>!ids.has(n.id));
    current().edges=current().edges.filter(e=>!ids.has(e.from[0])&&!ids.has(e.to[0])&&!matches(e));
    selection=new Set([...selection].filter(id=>!ids.has(id)));selected=selection.has(selected)?selected:[...selection].at(-1)||null;selectedEdge=null;
  });
}
function showTrashWireProxy(x,y){if(!EDITOR_DEV_SETTINGS.canvasTrash)return;const proxy=$('#graphtrashproxy');proxy.hidden=false;proxy.style.left=x/uiScaleFactor()+16+'px';proxy.style.top=y/uiScaleFactor()-32+'px';}
function dragExistingWire(path,event,index){
  if(!EDITOR_DEV_SETTINGS.canvasTrash||event.button!==0||event.pointerType==='touch'||readonly)return;
  event.stopPropagation();clearWireGesture();nodeDragGesture?.cancel();suppressWireClick=false;
  const canvas=$('#canvas'),sx=event.clientX,sy=event.clientY,target=trashTarget('edge',index);let moved=false;
  canvas.focus({preventScroll:true});selectedEdge=index;selected=null;selection.clear();inspector();renderNavigation();wires();
  const finish=()=>{
    wireGesture=null;clearGraphTrash();
    window.removeEventListener('pointermove',move,true);window.removeEventListener('pointerup',up,true);window.removeEventListener('blur',cancel);window.removeEventListener('resize',cancel);
    canvas.removeEventListener('pointercancel',cancel);canvas.removeEventListener('lostpointercapture',cancel);document.removeEventListener('keydown',key,true);
    if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);
  };
  const cancel=()=>{suppressWireClick=moved;finish();if(graph)wires();};
  const key=e=>{if(e.key==='Escape'){e.preventDefault();cancel();}};
  const move=e=>{
    if(e.pointerId!==event.pointerId)return;e.stopPropagation();
    if(!moved&&Math.hypot(e.clientX-sx,e.clientY-sy)<4)return;
    if(!moved){moved=true;beginGraphTrash(target);}
    showTrashWireProxy(e.clientX,e.clientY);updateGraphTrash(e.clientX,e.clientY);
  };
  const up=e=>{if(e.pointerId!==event.pointerId)return;e.stopPropagation();move(e);const drop=moved&&graphTrashDrop(e.clientX,e.clientY);suppressWireClick=moved;finish();if(drop)commitGraphTrash(drop);wires();};
  wireGesture={cancel};canvas.setPointerCapture(event.pointerId);
  window.addEventListener('pointermove',move,true);window.addEventListener('pointerup',up,true);window.addEventListener('blur',cancel);window.addEventListener('resize',cancel);
  canvas.addEventListener('pointercancel',cancel);canvas.addEventListener('lostpointercapture',cancel);document.addEventListener('keydown',key,true);
}
function isNodeDragSurface(target,card){
  if(!target||target.closest('.node')!==card)return false;
  if(target.closest('button,input,textarea,select,a,summary,[contenteditable="true"],[role="button"],.node-alias,.node-inline-values'))return false;
  return card.dataset.category==='annotation'?!!target.closest('.node-title'):EDITOR_DEV_SETTINGS.nodeBodyDrag||!!target.closest('.node-title');
}
function dragNodeTitle(event,node,title,cards,onFinish){
  if(event.button!==0)return;event.preventDefault();event.stopPropagation();closeCreator();
  if(event.ctrlKey||event.metaKey)return;
  nodeDragGesture?.cancel();clearWireGesture();
  if(!selection.has(node.id))selectNode(node);else {focusGraphCanvas();selected=node.id;selectedEdge=null;}
  document.querySelectorAll('.node').forEach(c=>c.classList.toggle('selected',selection.has(c.dataset.node)));inspector();renderNavigation();
  if(readonly)return;
  const data=current(),owner=graph,originScale=scale*uiScaleFactor(),sx=event.clientX,sy=event.clientY;
  const positions=data.nodes.filter(n=>selection.has(n.id)).map(n=>({node:n,card:cards.querySelector(`[data-node="${CSS.escape(n.id)}"]`),x:n.ui?.x||0,y:n.ui?.y||0,nextX:n.ui?.x||0,nextY:n.ui?.y||0}));
  const anchor=positions.find(item=>item.node===node);let moved=false;
  const restore=()=>{for(const p of positions){p.card.style.left=p.x+'px';p.card.style.top=p.y+'px';}};
  const finish=()=>{
    nodeDragGesture=null;clearGraphTrash();$('#personal-library')?.classList.remove('drop-ready');
    title.onpointermove=title.onpointerup=title.onpointercancel=title.onlostpointercapture=null;
    window.removeEventListener('blur',cancel);window.removeEventListener('resize',cancel);document.removeEventListener('keydown',key,true);
    if(title.hasPointerCapture(event.pointerId))title.releasePointerCapture(event.pointerId);onFinish(moved);
  };
  const cancel=()=>{restore();finish();if(graph)wires();};
  const key=e=>{if(e.key==='Escape'){e.preventDefault();cancel();}};
  const move=e=>{
    if(e.pointerId!==event.pointerId||(!moved&&Math.hypot(e.clientX-sx,e.clientY-sy)<3))return;
    if(!moved){moved=true;beginGraphTrash(trashTarget('nodes',positions.map(p=>p.node)));}
    const dx=snap(anchor.x+(e.clientX-sx)/originScale)-anchor.x,dy=snap(anchor.y+(e.clientY-sy)/originScale)-anchor.y;
    for(const p of positions){p.nextX=p.x+dx;p.nextY=p.y+dy;p.card.style.left=p.nextX+'px';p.card.style.top=p.nextY+'px';}
    updateGraphTrash(e.clientX,e.clientY);wires();
    $('#personal-library')?.classList.toggle('drop-ready',definition(node)?.key==='function_call'&&positions.length===1&&!!document.elementFromPoint(e.clientX,e.clientY)?.closest('#personal-library'));
  };
  title.onpointermove=move;
  title.onpointerup=e=>{
    if(e.pointerId!==event.pointerId)return;move(e);
    const drop=moved&&graphTrashDrop(e.clientX,e.clientY),library=moved&&definition(node)?.key==='function_call'&&positions.length===1&&document.elementFromPoint(e.clientX,e.clientY)?.closest('#personal-library');
    restore();finish();
    if(editorMutationBlocked()||graph!==owner||current()!==data){wires();return;}
    if(drop){commitGraphTrash(drop);wires();return;}
    if(library){render();savePersonalFunction(FunctionModel.find(graph,node.params.functionId));return;}
    if(moved&&positions.some(p=>p.x!==p.nextX||p.y!==p.nextY))change(()=>{for(const p of positions){p.node.ui||={};p.node.ui.x=p.nextX;p.node.ui.y=p.nextY;}},{localize:false});else wires();
  };
  title.onpointercancel=title.onlostpointercapture=cancel;
  nodeDragGesture={cancel};title.setPointerCapture(event.pointerId);window.addEventListener('blur',cancel);window.addEventListener('resize',cancel);document.addEventListener('keydown',key,true);
}

let selection=new Set(),creatorState=null,creatorIndex=0,creatorMatches=[],creatorCategory='all',wireDrag=null,wireGesture=null,suppressPortClick=false,boxSelectMode=false;
function inputSourceKind(d){return d.inputPreset?'uniform':d.inputKind||(['uniform','sampler','constant','spec_constant','top_input'].includes(d.key)?d.key:null);}
function nodeCategory(d){
  if(d.key==='comment')return 'annotation';
  if(['compare','if'].includes(d.key))return 'logic';
  if(['constant','spec_constant','scalar','vector'].includes(d.key)||['constant','spec_constant'].includes(d.inputKind))return 'constant';
  if(d.key==='top_input'||d.inputKind==='top_input')return 'sampler';
  const sourceKind=inputSourceKind(d);if(sourceKind)return sourceKind;
  if(d.definitionUuid===FunctionModel.CALL)return 'functions';
  if(['float','vec2','vec3','vec4','color'].includes(d.key))return 'constant';
  if(d.key==='uniform')return 'uniform';if(d.key==='sampler')return 'sampler';
  if(['uv','position'].includes(d.key))return 'attribute';
  if(['texture','texture_sample'].includes(d.key))return 'math';
  if(['deform','to_clip'].includes(d.key))return 'builtin';
  if(d.key.endsWith('_out')||d.key==='function_output')return 'output';return 'math';
}
function builtInSourceLabel(d){return d.key==='uv'?(editorTarget==='top'?'vUV.st':'UV 0'):d.key==='position'?'P':'';}
let typeContract=null;
// GLSL Code interfaces keep connection IDs separate from editable GLSL names.
const CustomGLSL=(()=>{
  const directions=['inputs','outputs'];
  const isName=value=>typeof value==='string'&&/^[A-Za-z][A-Za-z0-9_]{0,47}$/.test(value)&&
    !value.includes('__')&&!/^(gl_|TD|sTD|uTD|sg_|[iu]?sampler|[iu]?image|d?mat[234])/.test(value)&&
    !typeContract.glslCode.reservedNames.includes(value);
  function validate(params){
    if(!typeContract?.glslCode)throw Error(t('contract.unsupported'));
    if(!isName(params.functionName))throw Error(t('code.invalidName'));
    const names=new Set([params.functionName]),ids=new Set();
    for(const direction of directions){
      const list=params[direction];
      if(!Array.isArray(list)||list.length>(typeContract.glslCode.maxPorts)||direction==='outputs'&&!list.length)throw Error(t('code.portLimit'));
      for(const p of list){
        if(!p||typeof p.id!=='string'||!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(p.id)||ids.has(p.id))throw Error(t('code.invalidPort'));
        if(!isName(p.name)||names.has(p.name))throw Error(t('code.invalidName'));
        if(!(direction==='inputs'?interfaceTypes():valueTypes()).includes(p.type))throw Error(t('code.invalidType'));
        ids.add(p.id);names.add(p.name);
      }
    }
  }
  function add(params,direction){
    const used=new Set([params.functionName,...directions.flatMap(d=>params[d].map(p=>p.name))]);
    let index=1,name;do{name=(direction==='inputs'?'input':'output')+index++;}while(used.has(name));
    params[direction].push({id:'p'+crypto.randomUUID().replaceAll('-','').slice(0,12),name,type:'float'});
    validate(params);
  }
  function update(node,direction,id,patch){
    const p=node.params[direction].find(p=>p.id===id),before=p.type;
    Object.assign(p,patch);validate(node.params);
    if(direction==='inputs'&&before!==p.type&&Object.hasOwn(node.inputValues||{},id)){
      if(isResourceType(p.type))delete node.inputValues[id];
      else node.inputValues[id]=shapedValue(node.inputValues[id]??0,p.type);
    }
  }
  function remove(node,direction,id,edges){
    const side=direction==='inputs'?'to':'from';
    if(edges.some(e=>e[side][0]===node.id&&e[side][1]===id))throw Error(t('code.disconnectFirst'));
    if(direction==='outputs'&&node.params.outputs.length===1)throw Error(t('code.keepOutput'));
    node.params[direction]=node.params[direction].filter(p=>p.id!==id);
    if(direction==='inputs'&&node.inputValues)delete node.inputValues[id];
  }
  function move(params,direction,id,offset){
    const list=params[direction],index=list.findIndex(p=>p.id===id),next=index+offset;
    if(index<0||next<0||next>=list.length)return;
    [list[index],list[next]]=[list[next],list[index]];
  }
  function header(params){
    const signature=directions.flatMap(direction=>params[direction].map(p=>`${direction==='inputs'?'in':'out'} ${p.type} ${p.name}`)).join(', ');
    const defaults=params.outputs.map(p=>`    ${p.name} = ${p.type==='float'?'0.0':p.type+'(0.0)'};`).join('\n');
    return `void ${params.functionName}(${signature}) {\n${defaults}`;
  }
  return {validate,add,update,remove,move,header};
})();

function setTypeContract(contract){
  if(contract?.version!==1||!Array.isArray(contract.numericTypes)||!contract.numericTypes.length||
      new Set(contract.numericTypes).size!==contract.numericTypes.length||!contract.numericTypes.every(t=>typeof t==='string')||
      !Array.isArray(contract.conversions)||!contract.definitions||!contract.types)throw Error(t('contract.unsupported'));
  const resourceTypes=contract.resourceTypes||[];
  if(!Array.isArray(resourceTypes)||resourceTypes.some(t=>t!=='sampler2D')||new Set(resourceTypes).size!==resourceTypes.length)throw Error(t('contract.invalid'));
  const specTypes=contract.specConstantTypes||[];
  if(!Array.isArray(specTypes)||specTypes.some(t=>!['int','uint','bool','float'].includes(t))||new Set(specTypes).size!==specTypes.length)throw Error(t('contract.invalid'));
  const valueTypes=contract.valueTypes||[...new Set([...contract.numericTypes,...specTypes])],known=t=>valueTypes.includes(t)||resourceTypes.includes(t);
  if(!Array.isArray(valueTypes)||new Set(valueTypes).size!==valueTypes.length||!contract.numericTypes.every(t=>valueTypes.includes(t)))throw Error(t('contract.invalid'));
  if(Object.keys(contract.types).length!==valueTypes.length+resourceTypes.length)throw Error(t('contract.invalid'));
  for(const type of valueTypes){
    const descriptor=contract.types[type],vector=/^(i|u|b)?vec([234])$/.exec(type);
    const family=vector?({i:'int',u:'uint',b:'bool'}[vector[1]]||'float'):type,count=vector?Number(vector[2]):1;
    if(!Object.hasOwn(contract.types,type)||!descriptor||!['float','int','uint','bool'].includes(family)||descriptor.family!==family||descriptor.components!==count)throw Error(t('contract.invalid'));
  }
  for(const type of specTypes.filter(t=>!contract.numericTypes.includes(t)))if(contract.types[type]?.family!==type||contract.types[type]?.components!==1)throw Error(t('contract.invalid'));
  for(const type of resourceTypes)if(contract.types[type]?.family!=='sampler'||contract.types[type]?.components!==0)throw Error(t('contract.invalid'));
  for(const rule of contract.conversions)if(!known(rule.from)||!known(rule.to)||!['identity','splat','cast'].includes(rule.kind))throw Error(t('contract.invalid'));
  for(const entry of Object.values(contract.definitions)){
    if(!['fixed','parameter','declaration'].includes(entry.selector)||!Array.isArray(entry.variants)||!entry.variants.length)throw Error(t('contract.invalid'));
    for(const variant of entry.variants)if((variant.type!==null&&!known(variant.type))||!variant.inputs||!variant.outputs||
      ![...Object.values(variant.inputs),...Object.values(variant.outputs)].every(known))throw Error(t('contract.invalid'));
  }
  if(contract.pixelBufferOutputs){
    const spec=contract.pixelBufferOutputs;
    if(spec.parameter!=='bufferCount'||spec.type!=='vec4'||!Array.isArray(spec.ports)||spec.ports.length!==8||spec.ports.some((p,i)=>p!==(i?'buffer'+i:'color')))throw Error(t('contract.invalid'));
  }
  if(contract.glslCode&&(contract.glslCode.maxPorts!==16||contract.glslCode.maxLength!==16384||!Array.isArray(contract.glslCode.reservedNames)||!contract.glslCode.reservedNames.every(n=>typeof n==='string')))throw Error(t('contract.invalid'));
  if(contract.vectors){
    const spec=contract.vectors;
    if(spec.version!==1||spec.components!=='xyzw'||!Array.isArray(spec.types)||spec.types.length!==new Set(spec.types).size||spec.types.some(type=>!valueTypes.includes(type)||contract.types[type].components<2))throw Error(t('contract.invalid'));
    for(const type of spec.types){
      const layouts=spec.layouts?.[type];if(!Array.isArray(layouts)||layouts.length!==2**(contract.types[type].components-1))throw Error(t('contract.invalid'));
      for(const row of layouts){let cursor=0;const groups={};
        for(const [port,ty]of Object.entries(row.inputs||{})){if(port!==spec.components[cursor]||!valueTypes.includes(ty)||contract.types[ty].family!==contract.types[type].family)throw Error(t('contract.invalid'));cursor+=contract.types[ty].components;if(contract.types[ty].components>1)groups[port]=ty;}
        if(cursor!==contract.types[type].components||JSON.stringify(groups)!==JSON.stringify(row.groups))throw Error(t('contract.invalid'));
      }
    }
  }
  typeContract=JSON.parse(JSON.stringify(contract));
}
const numericTypes=()=>typeContract?.numericTypes||[];
const valueTypes=()=>typeContract?.valueTypes||[...new Set([...numericTypes(),...(typeContract?.specConstantTypes||[])])];
const interfaceTypes=()=>[...valueTypes(),...(typeContract?.resourceTypes||[])];
const typeFamily=type=>typeContract?.types?.[type]?.family;
const typeForShape=(family,count)=>valueTypes().find(type=>typeFamily(type)===family&&typeComponents(type)===count);
function scalarValue(value,family){
  if(family==='bool')return !!value;
  const number=Number(value)||0;
  if(family==='int'||family==='uint'){const low=family==='uint'?0:-2147483648,high=family==='uint'?4294967295:2147483647;return Math.max(low,Math.min(high,Math.trunc(number)));}
  return Number.isFinite(number)?number:0;
}
function validScalarValue(value,family){
  if(family==='bool')return typeof value==='boolean';
  if(typeof value!=='number'||!Number.isFinite(value))return false;
  return family==='float'||Number.isInteger(value)&&value>=(family==='uint'?0:-2147483648)&&value<=(family==='uint'?4294967295:2147483647);
}
const isResourceType=type=>(typeContract?.resourceTypes||[]).includes(type);
function typeComponents(type){
  if(!typeContract||!Object.hasOwn(typeContract.types,type))throw Error(t('contract.invalid'));
  return typeContract.types[type].components;
}
function shapedValue(value,type){
  if(isResourceType(type))return null;
  const count=typeComponents(type),components=Array.isArray(value)?value:[value];
  const scalar=value=>scalarValue(value,typeFamily(type));
  return count===1?scalar(components[0]):Array.from({length:count},(_,i)=>scalar(components[i]??components[0]));
}
const filledValue=(type,value=0)=>shapedValue(value,type);
const selectableNodeTypes=d=>[...new Set(typeVariants(d).map(v=>v.type).filter(type=>type!==null))];
const compatible=(a,b)=>!!typeContract?.conversions.some(rule=>rule.from===a&&rule.to===b);
function typeVariants(d){
  if(d.inputPreset)return [{type:'float',inputs:{},outputs:{out:'float'}}];
  if(d.inputSourceId)return [{type:d.inputType,inputs:{},outputs:d.inputKind==='top_input'?d.outputs:{out:d.inputType}}];
  const entry=typeContract?.definitions[d.definitionUuid];if(entry)return entry.variants;
  if(![FunctionModel.CALL,FunctionModel.INPUT,FunctionModel.OUTPUT].includes(d.definitionUuid))return [];
  return [{type:null,inputs:d.inputs,outputs:d.outputs}];
}
function resolvedNodePorts(d,params,decl,kind){
  if(isVectorOperation(d))return vectorPorts(d.key,params)[kind];
  if(d.key==='convert')return kind==='inputs'?{value:params.fromType||'float'}:{out:params.toType||'int'};
  if(d.key==='glsl_code')return Object.fromEntries((Array.isArray(params[kind])?params[kind]:[]).map(p=>[p.id,p.type]));
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
const supportsAutoType=d=>!!d&&!['combine','vector'].includes(d.key)&&['math','logic'].includes(nodeCategory(d))&&typeContract?.definitions[d.definitionUuid]?.selector==='parameter';
const isVectorOperation=d=>['vector','replace','combine','vector_split','swizzle'].includes(d?.key);
function vectorPorts(key,params){
  const spec=typeContract?.vectors,type=params.type||'vec2';
  if(!spec?.types.includes(type))throw Error(t('vector.invalidType'));
  if(key==='vector')return {inputs:{},outputs:{out:type}};
  if(key==='combine'||key==='replace'){
    const groups=params.groups||{},layout=spec.layouts[type].find(row=>Object.keys(row.groups).length===Object.keys(groups).length&&Object.entries(row.groups).every(([p,t])=>groups[p]===t));
    if(!layout)throw Error(t('vector.overlap'));
    return key==='replace'?{inputs:{value:type,...layout.inputs},outputs:{out:type}}:{inputs:layout.inputs,outputs:{out:type}};
  }
  const components=spec.components.slice(0,typeComponents(type));
  if(key==='vector_split')return {inputs:{value:type},outputs:Object.fromEntries([...components].map(p=>[p,typeFamily(type)]))};
  const mask=params.mask??'xy';
  if(typeof mask!=='string'||!mask.length||mask.length>4||[...mask].some(p=>!components.includes(p)))throw Error(t('vector.invalidMask'));
  return {inputs:{value:type},outputs:{out:typeForShape(typeFamily(type),mask.length)}};
}
// A type draft can retain groups or swizzles that no longer fit. These are
// display ports only; strict vectorPorts still validates compiler/wire layouts.
function draftVectorPorts(key,params){
  const type=typeContract?.vectors?.types.includes(params.type)?params.type:'vec2',components='xyzw'.slice(0,typeComponents(type));
  if(key==='combine'||key==='replace'){const inputs=Object.fromEntries([...components].map(p=>[p,typeFamily(type)]));return {inputs:key==='replace'?{value:type,...inputs}:inputs,outputs:{out:type}};}
  if(key==='swizzle'){const count=Math.max(1,Math.min(4,String(params.mask||'xy').length));return {inputs:{value:type},outputs:{out:typeForShape(typeFamily(type),count)}};}
  return vectorPorts(key,{...params,type});
}
function displayNodePorts(d,params,decl,kind){
  try{return resolvedNodePorts(d,params,decl,kind);}catch(error){if(!isVectorOperation(d))throw error;return draftVectorPorts(d.key,params)[kind];}
}
function nodeTypeVariants(d,params){
  return typeVariants(d).flatMap(v=>{try{return [{...v,...(isVectorOperation(d)?vectorPorts(d.key,{...params,type:v.type}):{})}];}catch{return [];}});
}
function vectorConnectionExact(d,source,target){
  if(d?.key==='compare'&&!selectableNodeTypes(d).includes(source))return false;
  return isVectorOperation(d)?!!source&&source===target:compatible(source,target);
}
function constantRequirementIssues(document){
  if(!autoUnits(document).some(u=>u.data.nodes.some(n=>n.params.requireConstant)))return [];
  const issues=[],seenFunctions=new Set();
  function unit(data,owner,boundary,trail,stack=[]){
    const values=new Map(),active=new Set(),inputs=new Map();
    for(const edge of data.edges)inputs.set(edge.to.join(':'),edge.from);
    function visit(n){
      if(values.has(n.id))return values.get(n.id);if(active.has(n.id))return {};
      active.add(n.id);const d=autoDefinition(document,n,owner),p=safeConcretePorts(document,n,owner),incoming={};
      for(const [port,type]of Object.entries(p.inputs)){
        const source=inputs.get(n.id+':'+port),peer=source&&data.nodes.find(n=>n.id===source[0]);
        incoming[port]=peer?!!visit(peer)[source[1]]:!isResourceType(type)&&(!(d?.key==='texture'||d?.key==='texture_sample')||port!=='uv'||Object.hasOwn(n.inputValues||{},port));
      }
      let out={};
      if(n.definitionUuid===FunctionModel.INPUT)out=boundary;
      else if(n.definitionUuid===FunctionModel.CALL){
        const fn=document.functions?.find(f=>f.id===n.params.functionId);
        if(fn&&!stack.includes(fn.id)){seenFunctions.add(fn.id);out=unit(fn.graph,fn,incoming,[...trail,n.id],[...stack,fn.id]);}
      }else if(d?.key==='replace'){
        // Only the final component's effective source determines its constness.
        // A fully overridden runtime baseline must not taint a constant result.
        const components='xyzw'.slice(0,typeComponents(n.params.type)),final={};
        for(const component of components){
          const index='xyzw'.indexOf(component),group=Object.keys(p.inputs).find(port=>port!=='value'&&inputs.has(n.id+':'+port)&&'xyzw'.indexOf(port)<=index&&'xyzw'.indexOf(port)+typeComponents(p.inputs[port])>index);
          final[component]=group?incoming[group]:inputs.has(n.id+':value')?incoming.value:true;
        }
        out={out:Object.values(final).every(Boolean)};
      }else {
        const constant=typeContract?.constantExpressions?.includes(d?.key)&&Object.values(incoming).every(Boolean);
        out=Object.fromEntries(Object.entries(p.outputs).map(([port,type])=>[port,!!constant&&!isResourceType(type)]));
      }
      if(n.params.requireConstant&&(!Object.keys(out).length||!Object.values(out).every(Boolean)))issues.push({key:[...trail,n.id].join('/'),name:d?.label||n.id});
      values.set(n.id,out);active.delete(n.id);
      if(n.definitionUuid===FunctionModel.OUTPUT)values.set('__result',incoming);
      return out;
    }
    for(const n of data.nodes)visit(n);
    return values.get('__result')||{};
  }
  for(const [stage,data]of Object.entries(document.stages))unit(data,null,{},[stage]);
  for(const fn of document.functions||[])if(!seenFunctions.has(fn.id))unit(fn.graph,fn,Object.fromEntries(fn.inputs.map(p=>[p.id,!isResourceType(p.type)])),['function',fn.id],[fn.id]);
  return issues;
}
function rejectNewConstantIssues(document,previous){
  const issues=constantRequirementIssues(document);if(!issues.length)return;
  const existing=new Set(constantRequirementIssues(previous).map(i=>i.key));
  const issue=issues.find(i=>!existing.has(i.key));if(issue){const error=Error(t('vector.constantRejected')+' · '+issue.name);error.code='constantConflict';throw error;}
}
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
function safeConcretePorts(document,n,owner=null,type=n.params.type,override=null){
  try{return concretePorts(document,n,owner,type,override);}catch(error){const d=autoDefinition(document,n,owner);if(!isVectorOperation(d))throw error;return draftVectorPorts(d.key,{...n.params,type});}
}
function invalidTypeEdges(data,portMap){
  const vectors=new Set(data.nodes.filter(n=>['vector','replace','combine','vector_split','swizzle'].some(key=>n.definitionUuid==='sgrape.builtin.'+key)).map(n=>n.id));
  const comparisons=new Set(data.nodes.filter(n=>n.definitionUuid==='sgrape.builtin.compare').map(n=>n.id));
  return data.edges.filter(e=>{const source=portMap.get(e.from[0])?.outputs[e.from[1]],target=portMap.get(e.to[0])?.inputs[e.to[1]];return comparisons.has(e.to[0])&&!['float','int','uint'].includes(source)||!(vectors.has(e.to[0])?!!source&&source===target:compatible(source,target));});
}
function typeEdgeKey(edge,ports){return JSON.stringify([edge.from,edge.to,ports.get(edge.from[0])?.outputs[edge.from[1]],ports.get(edge.to[0])?.inputs[edge.to[1]]]);}
function planAutoGraph(document,data,owner=null,overrides=new Map(),{draft=false}={}){
  const nodes=new Map(data.nodes.map(n=>[n.id,n])),incoming=new Map(),ports=new Map(),choices=new Map(),groups=new Map(),issues=new Map(),active=new Set();
  for(const e of data.edges){if(!incoming.has(e.to[0]))incoming.set(e.to[0],[]);incoming.get(e.to[0]).push(e);}
  const canInfer=!owner||owner.scope==='local';
  const autoNodes=new Set(data.nodes.filter(n=>canInfer&&n.ui?.typeMode==='auto'&&supportsAutoType(autoDefinition(document,n,owner))).map(n=>n.id));
  const combineNodes=new Set(data.nodes.filter(n=>canInfer&&['combine','replace'].includes(autoDefinition(document,n,owner)?.key)).map(n=>n.id));
  function visit(n){
    if(ports.has(n.id))return;
    if(active.has(n.id))throw autoTypeError('wire.cycle');active.add(n.id);
    const links=incoming.get(n.id)||[];let plannedType=n.params.type;
    for(const e of links){const source=nodes.get(e.from[0]);if(source)visit(source);}
    try{if(combineNodes.has(n.id)){
      const isVector=autoDefinition(document,n,owner)?.key==='replace',componentLinks=isVector?links.filter(e=>e.to[1]!=='value'):links;
      if(isVector&&autoNodes.has(n.id)){
        const base=links.find(e=>e.to[1]==='value'),baseType=base&&ports.get(base.from[0])?.outputs[base.from[1]];
        // Replace follows only its whole-vector baseline. Overrides cannot
        // enlarge it, and a disconnected baseline keeps the stored dimension.
        if(typeContract.vectors.types.includes(baseType))plannedType=baseType;
        choices.set(n.id,plannedType);
      }
      const layout=typeContract.vectors.layouts[plannedType]?.find(row=>componentLinks.every(e=>Object.hasOwn(row.inputs,e.to[1])&&ports.get(e.from[0])?.outputs[e.from[1]]===row.inputs[e.to[1]])&&Object.keys(row.groups).every(p=>componentLinks.some(e=>e.to[1]===p)));
      if(!layout)throw Error(t('vector.overlap'));
      groups.set(n.id,layout.groups);ports.set(n.id,vectorPorts(isVector?'replace':'combine',{...n.params,type:plannedType,groups:layout.groups}));
    }else if(autoNodes.has(n.id)){
      const d=autoDefinition(document,n,owner),candidates=nodeTypeVariants(d,n.params).filter(v=>links.every(e=>vectorConnectionExact(d,ports.get(e.from[0])?.outputs[e.from[1]],v.inputs[e.to[1]])));
      const score=v=>links.reduce((sum,e)=>sum+Number(ports.get(e.from[0])?.outputs[e.from[1]]!==v.inputs[e.to[1]]),0);
      candidates.sort((a,b)=>score(a)-score(b)||typeComponents(a.type)-typeComponents(b.type));
      // Compare starts with integers only when no input can determine its type.
      // Keep the shared ranking unchanged as soon as either input is connected.
      const chosen=(!links.length&&d.key==='compare'?candidates.find(v=>v.type==='int'):null)||candidates[0];if(!chosen)throw autoTypeError('type.autoInputs',d.label||d.key);
      choices.set(n.id,chosen.type);ports.set(n.id,{inputs:chosen.inputs,outputs:chosen.outputs});
    }else ports.set(n.id,concretePorts(document,n,owner,n.params.type,overrides.get(n.id)));
    }catch(error){if(!draft)throw error;issues.set(n.id,error.message);ports.set(n.id,safeConcretePorts(document,n,owner,plannedType,overrides.get(n.id)));}
    active.delete(n.id);
  }
  // No policy nodes: existing unresolved/cyclic drafts remain a compiler concern.
  if(autoNodes.size||combineNodes.size||draft)for(const n of data.nodes)visit(n);
  else for(const n of data.nodes)ports.set(n.id,concretePorts(document,n,owner,n.params.type,overrides.get(n.id)));
  return {choices,ports,groups,issues};
}
function storedTypePorts(document,data,owner=null){return new Map(data.nodes.map(n=>[n.id,safeConcretePorts(document,n,owner)]));}
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
    let nextValue=shapedValue(value,newPorts[port]);
    n.inputValues[port]=Object.hasOwn(values,newPorts[port])?clone(values[newPorts[port]]):nextValue;
  }
  n.params.type=nextType;
  normalizeNodeValues(n,d);
}
function normalizeNodeValues(n,d){
  if(['vector','combine','replace'].includes(d.key))n.params.components=Array.from({length:4},(_,i)=>scalarValue(n.params.components?.[i]??0,typeFamily(n.params.type)));
  if(d.key==='scalar')n.params.value=shapedValue(n.params.value,n.params.type);
}
function autoTopology(document){return JSON.stringify({declarations:document.declarations.map(d=>[d.id,d.type]),units:autoUnits(document).map(({key,data,owner})=>[key,owner?.scope,owner?.inputs.map(p=>[p.id,p.type]),owner?.outputs.map(p=>[p.id,p.type]),data.nodes.map(n=>[n.id,n.definitionUuid,n.params.type,n.params.fromType,n.params.toType,n.params.declarationId,n.params.functionId,n.params.bufferCount,n.params.groups,n.params.mask,n.params.inputs,n.params.outputs,n.ui?.typeMode]),data.edges])});}
function resolveAutoEdit(document,previous,{allowInvalid=false,disconnectInvalid=false}={}){
  if(autoTopology(document)===autoTopology(previous))return;
  const oldUnits=new Map(autoUnits(previous).map(u=>[u.key,u])),plans=[];
  for(const unit of autoUnits(document)){
    const old=oldUnits.get(unit.key),oldPorts=old?storedTypePorts(previous,old.data,old.owner):new Map();
    let plan=planAutoGraph(document,unit.data,unit.owner,new Map(),{draft:true});
    if(disconnectInvalid&&(!unit.owner||unit.owner.scope==='local')){
      const retained=new Set(old?invalidTypeEdges(old.data,oldPorts).map(e=>typeEdgeKey(e,oldPorts)):[]);
      // Infer all downstream Auto nodes before removing newly incompatible
      // edges. Re-infer after removal; the edge count bounds this process.
      while(true){
        const invalid=new Set(invalidTypeEdges(unit.data,plan.ports).filter(e=>!retained.has(typeEdgeKey(e,plan.ports))));
        if(!invalid.size)break;
        unit.data.edges=unit.data.edges.filter(e=>!invalid.has(e));
        plan=planAutoGraph(document,unit.data,unit.owner,new Map(),{draft:true});
      }
    }
    if(!allowInvalid){
      const oldPlan=old?planAutoGraph(previous,old.data,old.owner,new Map(),{draft:true}):null;
      for(const [id,message]of plan.issues)if(oldPlan?.issues.get(id)!==message)throw Error(message);
      rejectNewTypeIssues(unit.data,plan.ports,old?.data,oldPorts);
    }
    plans.push({...unit,plan});
  }
  for(const {data,owner,plan}of plans)for(const n of data.nodes){if(plan.choices.has(n.id))reshapeTypedInputs(n,autoDefinition(document,n,owner),plan.choices.get(n.id));if(plan.groups.has(n.id))n.params.groups=clone(plan.groups.get(n.id));}
}
function setMathType(n,mode){
  const d=definition(n);if(!supportsAutoType(d))return false;
  return change(()=>{n.ui||={};if(mode==='auto')n.ui.typeMode='auto';else{if(!selectableNodeTypes(d).includes(mode))throw autoTypeError('contract.invalid');n.ui.typeMode='locked';reshapeTypedInputs(n,d,mode);}},{typeChange:true});
}
function planWireTypes(from,to,extra=null){
  const data=current(),owner=currentFunction(),nodes=clone(extra?[...data.nodes,extra.node]:data.nodes),overrides=extra?new Map([[extra.node.id,extra.ports]]):new Map();
  const target=nodes.find(n=>n.id===to.node),oldPorts=storedTypePorts(graph,data,owner),source=nodes.find(n=>n.id===from.node);
  const sourcePorts=source&&safeConcretePorts(graph,source,owner,source.params.type,overrides.get(source.id));
  let replaced=e=>e.to[0]===to.node&&e.to[1]===to.port;
  // Explicit component drops replace the whole overlapping wire, for both assemblers.
  if(['combine','replace'].includes(autoDefinition(graph,target,owner)?.key)&&to.port!=='value'){
    const targetPorts=safeConcretePorts(graph,target,owner,target.params.type,overrides.get(target.id));
    const first='xyzw'.indexOf(to.port),type=sourcePorts?.outputs[from.port];
    if(first<0||!Object.hasOwn(targetPorts.inputs,to.port)||!valueTypes().includes(type)||first+typeComponents(type)>typeComponents(target.params.type))throw Error(t('vector.overlap'));
    const end=first+typeComponents(type);
    replaced=e=>{
      if(e.to[0]!==to.node||e.to[1]==='value')return false;
      const start='xyzw'.indexOf(e.to[1]),oldType=oldPorts.get(e.from[0])?.outputs[e.from[1]],width=valueTypes().includes(oldType)?typeComponents(oldType):typeComponents(targetPorts.inputs[e.to[1]]||'float');
      return start<end&&start+width>first;
    };
  }
  const displaced=data.edges.filter(replaced),candidate={nodes,edges:[...clone(data.edges.filter(e=>!replaced(e))),{from:[from.node,from.port],to:[to.node,to.port]}]};
  // All entry paths (including creator previews) validate the trial before edits.
  const pending=[to.node],seen=new Set();
  while(pending.length){const id=pending.pop();if(id===from.node){const error=autoTypeError('wire.cycle');error.code='cycle';throw error;}if(seen.has(id))continue;seen.add(id);for(const e of candidate.edges)if(e.from[0]===id)pending.push(e.to[0]);}
  const plan=planAutoGraph(graph,candidate,owner,overrides,{draft:true}),oldPlan=planAutoGraph(graph,data,owner,new Map(),{draft:true});
  for(const [id,message]of plan.issues)if(oldPlan.issues.get(id)!==message)throw Error(message);
  rejectNewTypeIssues(candidate,plan.ports,data,storedTypePorts(graph,data,owner));
  for(const n of nodes){if(plan.choices.has(n.id))reshapeTypedInputs(n,autoDefinition(graph,n,owner),plan.choices.get(n.id));if(plan.groups.has(n.id))n.params.groups=clone(plan.groups.get(n.id));}
  if(autoUnits(graph).some(u=>u.data.nodes.some(n=>n.params.requireConstant))){
    const document=owner?{...graph,functions:graph.functions.map(f=>f===owner?{...f,graph:candidate}:f)}:{...graph,stages:{...graph.stages,[stage]:candidate}};
    rejectNewConstantIssues(document,graph);
  }
  return {...plan,edges:candidate.edges,displaced};
}
function commitPlannedWire(from,to){current().edges=planWireTypes(from,to).edges;}
function creatorTypePlan(d,variant,port,wire,locked){
  let id='__creator';while(current().nodes.some(n=>n.id===id))id+='_';
  const node={id,definitionUuid:d.definitionUuid,params:{...clone(d.defaults||{}),...(variant.type?{type:variant.type}:{}),...clone(variant.params||{})},ui:supportsAutoType(d)&&!locked?{typeMode:'auto'}:{}};
  const from=wire.kind==='outputs'?wire:{node:id,port},to=wire.kind==='inputs'?wire:{node:id,port};
  const plan=planWireTypes(from,to,{node,ports:variant});return plan.ports.get(id);
}
function creatorVariants(d,wire){
  if(d.presetType)return typeVariants(d).filter(variant=>variant.type===d.presetType);
  if(d.key==='convert'){
    const from=wire?.kind==='outputs'?wire.type:d.defaults.fromType,to=wire?.kind==='inputs'?wire.type:d.defaults.toType;
    const pairs=wire?valueTypes().map(type=>wire.kind==='outputs'?[from,type]:[type,to]):[[from,to]];
    return pairs.filter(([a,b])=>valueTypes().includes(a)&&valueTypes().includes(b)&&(typeComponents(a)===1||typeComponents(a)===typeComponents(b))).map(([a,b])=>({type:null,inputs:{value:a},outputs:{out:b},params:{fromType:a,toType:b}}));
  }
  if(d.key!=='swizzle')return typeVariants(d);
  const count=wire&&valueTypes().includes(wire.type)?typeComponents(wire.type):2;
  return typeVariants(d).flatMap(variant=>{
    if(count>typeComponents(variant.type))return [];
    const available=typeContract.vectors.components.slice(0,typeComponents(variant.type));
    const mask=Array.from({length:count},(_,i)=>available[Math.min(i,available.length-1)]).join('');
    return [{...variant,...vectorPorts(d.key,{type:variant.type,mask}),params:{mask}}];
  });
}
function creatorPriority(match,wire){
  if(!wire)return 99;
  const count=valueTypes().includes(wire.type)?typeComponents(wire.type):0;
  const order=wire.kind==='outputs'?(count>1?['vector_split','replace','swizzle','combine','multiply','add','mix']:['multiply','add','replace','combine','mix']):count>1?['vector','combine',wire.type==='vec4'?'vec4':wire.type,'swizzle']:['float','vector','add','multiply'];
  const index=order.indexOf(match.d.key);
  // Exact whole-vector matches precede scalar fallbacks across preset entries.
  return index<0?99:index+(match.d.presetType&&match.portType!==wire.type?0.5:0);
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
    caption.title=t(info.conversion==='splat'?'type.splat':info.conversion==='cast'?'type.cast':'type.incompatible').replace('{source}',info.source).replace('{target}',info.target);
    caption.replaceChildren(el('span',{'data-source-type':info.source},info.source),el('span',{class:'conversion-arrow','aria-hidden':'true'},'→'),document.createTextNode(info.target));
  }
  return caption;
}
function vectorNames(n){return n.ui?.componentNames==='rgba'?'RGBA':n.ui?.componentNames==='uv'&&typeComponents(n.params.type)===2?'UV':'XYZW';}
// Display hints come from known component ports, never arbitrary labels or upstream nodes.
function portColorComponent(n,kind,port){
  if(ports(n,kind)[port]!=='float')return null;
  const d=definition(n);
  if(d?.key==='split'&&kind==='outputs'&&['r','g','b','a'].includes(port))return port;
  if(d?.key==='rgba'&&kind==='inputs'&&port==='alpha')return 'a';
  if(isVectorOperation(d)&&n.ui?.componentNames==='rgba'){
    const label=vectorPortLabel(n,kind,port);
    if(['R','G','B','A'].includes(label))return label.toLowerCase();
  }
  return null;
}
function applyPortColorHint(element,n,kind,port){
  const component=portColorComponent(n,kind,port);
  if(component)element.dataset.colorComponent=component;
  const d=definition(n),label=vectorPortLabel(n,kind,port);
  const index=component?'rgba'.indexOf(component):isVectorOperation(d)&&typeContract?.types?.[ports(n,kind)[port]]?.components===1&&label?.length===1?vectorNames(n).indexOf(label):-1;
  if(index>=0)element.dataset.vectorComponent=String(index);
}
function applyComponentColorHint(element,index,rgba=false){
  if(!Number.isInteger(index)||index<0||index>3)return;
  element.dataset.vectorComponent=String(index);element.classList.add('component-tint-label');
  if(rgba)element.dataset.colorComponent='rgba'[index];
}
function applyPortLabelColorHint(element,n,kind,port){
  applyPortColorHint(element,n,kind,port);
  if(element.dataset.vectorComponent!==undefined)element.classList.add('component-tint-label');
  const label=vectorPortLabel(n,kind,port),names=vectorNames(n);
  if(!label||label.length<2||element.textContent!==label||![...label].every(name=>names.includes(name)))return;
  element.replaceChildren(...[...label].map(name=>{const span=el('span',{},name);applyComponentColorHint(span,names.indexOf(name),names==='RGBA');return span;}));
}
// Presentation only: show manual components that still contribute to the value.
function vectorManualComponents(n){
  const incoming=current().edges.filter(e=>e.to[0]===n.id);
  if(incoming.some(e=>e.to[1]==='value'))return [];
  const inputs=ports(n,'inputs'),covered=new Set(),names=vectorNames(n);
  for(const edge of incoming){
    const start='xyzw'.indexOf(edge.to[1]),type=inputs[edge.to[1]];
    if(start<0||!type)continue;
    for(let i=start;i<start+typeComponents(type);i++)covered.add(i);
  }
  return [...'xyzw'.slice(0,typeComponents(n.params.type))].flatMap((port,index)=>{
    const value=defaultInput(n,port,typeFamily(n.params.type));
    return !covered.has(index)&&(typeof value==='boolean'||Number.isFinite(value))?[{name:names[index],value}]:[];
  });
}
function updateVectorManualSummary(n,summary=null){
  const manual=vectorManualComponents(n);
  if(!manual.length){summary?.remove();return null;}
  const all=manual.length===typeComponents(n.params.type),labelled=manual.map(c=>c.name+' '+String(c.value));
  const description=t('vector.manualValues')+': '+labelled.join(' · ');
  summary||=el('span',{class:'vector-components-summary','data-vector-summary':n.id});
  summary.textContent=manual.map((c,i)=>all?String(c.value):labelled[i]).join(' · ');
  summary.title=description;summary.setAttribute('aria-label',description);return summary;
}
function vectorPortLabel(n,kind,port){
  const d=definition(n),names=vectorNames(n),start='xyzw'.indexOf(port);
  if(['combine','replace'].includes(d?.key)&&kind==='inputs'&&start>=0)return names.slice(start,start+typeComponents(ports(n,kind)[port]));
  if(['vector_split'].includes(d?.key)&&kind==='outputs'&&start>=0)return names[start];
  if(d?.key==='replace'&&(port==='value'||port==='out'))return 'Vector '+typeComponents(n.params.type);
  if(d?.key==='swizzle'&&kind==='outputs'&&port==='out')return [...n.params.mask].map(p=>names['xyzw'.indexOf(p)]).join('');
  return null;
}
function addVectorSplit(source,port){
  const type=ports(source,'outputs')[port];if(!typeContract?.vectors?.types.includes(type))return;
  const existing=current().edges.find(e=>e.from[0]===source.id&&e.from[1]===port&&e.to[1]==='value'&&definition(current().nodes.find(n=>n.id===e.to[0]))?.key==='vector_split');
  if(existing){selectNode(current().nodes.find(n=>n.id===existing.to[0]));render();return;}
  change(()=>{const node=instantiate(catalog.find(d=>d.key==='vector_split'),(source.ui?.x||0)+260,source.ui?.y||0,type);
    node.ui.componentNames=definition(source)?.key==='color'?'rgba':definition(source)?.key==='uv'?'uv':source.ui?.componentNames||'xyzw';node.ui.componentsExpanded=true;
    commitPlannedWire({node:source.id,port},{node:node.id,port:'value'});});
}
function clearVectorWirePreview(){document.querySelectorAll('.vector-drop-range,.vector-drop-replaced').forEach(row=>row.classList.remove('vector-drop-range','vector-drop-replaced'));}
function previewVectorWire(start,button){
  clearVectorWirePreview();if(!button)return '';
  const end=portInfo(button),from=start.kind==='outputs'?start:end,to=start.kind==='inputs'?start:end,node=current().nodes.find(n=>n.id===to.node);
  if(!['combine','replace'].includes(definition(node)?.key)||to.port==='value')return '';
  const size=typeComponents(from.type),first='xyzw'.indexOf(to.port),range='xyzw'.slice(first,first+size);
  const targetCard=document.querySelector(`#cards [data-node="${CSS.escape(to.node)}"]`);
  for(const row of targetCard?.querySelectorAll('.port-row.input')||[])if(range.includes(row.querySelector('.port')?.dataset.port))row.classList.add('vector-drop-range');
  try{const displaced=planWireTypes(from,to).displaced;for(const path of document.querySelectorAll('#wires path[data-from]'))if(displaced.some(e=>path.dataset.from===e.from.join(':')&&path.dataset.to===e.to.join(':')))path.classList.add('vector-drop-replaced');}catch{}
  return vectorNames(node).slice(first,first+size);
}
function focusGraphCanvas(){
  $('#canvas').focus({preventScroll:true});
  // A graph selection ends text selection; otherwise native Copy keeps copying
  // a stale Note/Help range even after a node title was clicked or dragged.
  window.getSelection()?.removeAllRanges();
}
function selectNode(n,toggle=false){
  selectedInputId=null;helpContext='node';
  focusGraphCanvas();
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
  if(start.add||end.add)return sparePortProblem(start.add?start:end,start.add?end:start);
  try{planWireTypes(from,to);}catch(e){return e.code==='cycle'?'cycle':e.code==='constantConflict'?'constantConflict':'autoConflict';}
  return null;
}
function connectPorts(start,end){
  const problem=connectionProblem(start,end);
  if(problem){if(problem!=='direction')status(t('wire.'+problem),true);return false;}
  const changed=change(()=>{
    let from=start.kind==='outputs'?start:end,to=start.kind==='inputs'?start:end;
    if(from.add)from=materializeSparePort(from,to);else if(to.add)to=materializeSparePort(to,from);
    commitPlannedWire(from,to);
  });if(changed)cancelConnection();return changed;
}
function portInfo(button){
  const node=button.closest('[data-node]');return {node:node.dataset.node,port:button.dataset.port,kind:button.dataset.kind,type:button.dataset.type,...(button.dataset.addPort?{add:true}:{})};
}
function findWireTarget(candidates,x,y,radius=14){
  const hit=document.elementFromPoint(x,y);
  if(!hit?.closest('#canvas'))return null;
  const direct=hit.closest('.port');
  if(direct)return !direct.disabled&&candidates.includes(direct)?direct:null;
  let nearest=null,distance=radius; // Screen pixels, independent of graph zoom.
  for(const candidate of candidates){
    if(candidate.disabled)continue;
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
    wireGesture=null;clearVectorWirePreview();clearGraphTrash();cancelAnimationFrame(frame);target?.classList.remove('wire-target');target=null;
    button.onpointermove=button.onpointerup=button.onpointercancel=button.onlostpointercapture=null;
    window.removeEventListener('blur',cancel);document.removeEventListener('keydown',onKey,true);
    if(button.hasPointerCapture(event.pointerId))button.releasePointerCapture(event.pointerId);
    wireDrag=null;if(moved){linkStart=null;$('#connection').hidden=true;}
  };
  const cancel=()=>{suppressPortClick=true;finish();if(graph)wires();};
  const onKey=e=>{if(e.key==='Escape'){e.preventDefault();cancel();}};
  const update=e=>{
    if(e.pointerId!==event.pointerId||(!moved&&Math.hypot(e.clientX-sx,e.clientY-sy)<4))return;
    if(!moved)beginGraphTrash(trashTarget('port',start));moved=true;linkStart=null;
    const over=updateGraphTrash(e.clientX,e.clientY),next=over?null:findWireTarget(candidates,e.clientX,e.clientY);
    if(target!==next){target?.classList.remove('wire-target');target=next;target?.classList.add('wire-target');}
    const r=target?.getBoundingClientRect();
    const q=graphPoint(r?r.left+r.width/2:e.clientX,r?r.top+r.height/2:e.clientY);if(!q)return;
    wireDrag={...start,q,ready:!!target};wires();const componentRange=previewVectorWire(start,target);
    $('#connection').hidden=false;$('#connection').textContent=t(target?'wire.release':canDisconnectInputOnBlank(start)&&isBlankWireDrop(e.clientX,e.clientY)?'trash.releaseWire':'wire.connect')+(componentRange?' · '+componentRange:'');
  };
  wireGesture={cancel,refresh:()=>{if(moved&&lastEvent)update(lastEvent);}};button.setPointerCapture(event.pointerId);
  window.addEventListener('blur',cancel);document.addEventListener('keydown',onKey,true);
  button.onpointermove=e=>{if(e.pointerId!==event.pointerId)return;lastEvent=e;if(!frame)frame=requestAnimationFrame(()=>{frame=0;update(lastEvent);});};
  button.onpointerup=e=>{
    if(e.pointerId!==event.pointerId)return;update(e);
    const end=target&&portInfo(target),hit=document.elementFromPoint(e.clientX,e.clientY),wasMoved=moved,drop=moved&&graphTrashDrop(e.clientX,e.clientY);
    suppressPortClick=wasMoved;finish();
    if(!wasMoved)return;
    if(drop){commitGraphTrash(drop);wires();return;}
    if(end)connectPorts(start,end);
    else finishWireOnBlank(start,e.clientX,e.clientY);
    wires();
  };
  button.onpointercancel=button.onlostpointercapture=cancel;
}
function drawWireDrag(svg){
  if(!wireDrag)return;const n=current().nodes.find(n=>n.id===wireDrag.node),p=n&&point(n,wireDrag.port,wireDrag.kind);if(!p)return;
  const a=wireDrag.kind==='outputs'?p:wireDrag.q,b=wireDrag.kind==='outputs'?wireDrag.q:p,dx=Math.max(60,Math.abs(a.x-b.x)*.5),path=document.createElementNS('http://www.w3.org/2000/svg','path');
  path.setAttribute('d',`M ${a.x} ${a.y} C ${a.x+dx} ${a.y}, ${b.x-dx} ${b.y}, ${b.x} ${b.y}`);path.setAttribute('data-type',wireDrag.type);if(wireDrag.kind==='outputs')applyPortColorHint(path,n,'outputs',wireDrag.port);path.classList.add('wire-preview');path.classList.toggle('ready',wireDrag.ready);svg.append(path);
}
function nodeCollapseSelection(){return graph&&selectedEdge===null?current().nodes.filter(n=>selection.has(n.id)):[];}
function nodeCollapseSelectionState(){
  const nodes=nodeCollapseSelection();
  return {nodes,canCollapse:nodes.some(n=>n.ui?.collapsed!==true),canExpand:nodes.some(n=>n.ui?.collapsed===true)};
}
function setNodesCollapsed(ids,collapsed){
  if(editorMutationBlocked())return false;
  const wanted=new Set(ids),nodes=current().nodes.filter(n=>wanted.has(n.id)&&(n.ui?.collapsed===true)!==collapsed);
  if(!nodes.length)return false;
  cancelValueLadder();cancelConnection();
  return change(()=>{for(const node of nodes){node.ui||={};node.ui.collapsed=collapsed;}},{localize:false});
}
function nodeCollapseToggle(node){
  const collapsed=node.ui?.collapsed===true;
  if(!(collapsed?EDITOR_DEV_SETTINGS.nodeCollapseCollapsedHint:EDITOR_DEV_SETTINGS.nodeCollapseExpandedHint))return null;
  const label=t(collapsed?'node.expand':'node.collapse'),button=el('button',{type:'button',class:'node-collapse-toggle','aria-expanded':String(!collapsed),'aria-label':label,title:label,'data-collapse-node':node.id});
  const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');icon.setAttribute('viewBox','0 0 12 12');icon.setAttribute('aria-hidden','true');
  const path=document.createElementNS(icon.namespaceURI,'path');path.setAttribute('d','M3 1 10 6 3 11Z');icon.append(path);button.append(icon);
  button.disabled=readonly;button.onpointerdown=button.ondblclick=e=>e.stopPropagation();
  button.onclick=e=>{e.stopPropagation();setNodesCollapsed([node.id],!collapsed);};return button;
}
function appendCollapsedPorts(list,node,portRow){
  for(const kind of ['inputs','outputs']){
    const names=Object.keys(ports(node,kind)),side=kind==='inputs'?'to':'from';
    const anchors=new Set([...names,...current().edges.filter(e=>e[side][0]===node.id).map(e=>e[side][1])]);
    if(!anchors.size)continue;
    const row=names.length===1?portRow(kind,names[0],false,true):el('div',{class:'port-row '+(kind==='inputs'?'input':'output')+' collapsed-port-row'});
    if(names.length>1){
      const label=t('node.collapsedPorts').replace('{count}',names.length),dot=el('button',{type:'button',class:'collapsed-port aggregate',tabindex:'-1','aria-disabled':'true','aria-label':label,title:label,'data-kind':kind});
      dot.onpointerdown=dot.onclick=dot.ondblclick=e=>e.stopPropagation();row.append(dot);
    }
    // Invisible anchors retain each real port ID for existing wire geometry.
    // They are never connection candidates; only a true single port has .port.
    for(const port of anchors)if(names.length!==1||port!==names[0])row.append(el('span',{class:'collapsed-wire-anchor','data-kind':kind,'data-port':port,'aria-hidden':'true'}));
    list.append(row);
  }
}
function nodeCanvasComment(n){
  const note=el('div',{class:'node-canvas-comment'});
  note.append(el('p',{},nodeComment(n)));
  note.onpointerdown=e=>{if(!EDITOR_DEV_SETTINGS.nodeBodyDrag)e.stopPropagation();};
  note.onclick=e=>e.stopPropagation();
  note.ondblclick=e=>e.stopPropagation();
  return note;
}
function noteFontScale(node){return Math.max(1,Math.min(10,Number.isFinite(node.ui?.noteFontScale)?node.ui.noteFontScale:1));}
function setNoteTitleOnSelection(node,enabled,owner=current()){
  if(editorMutationBlocked()||current()!==owner||!owner.nodes.includes(node))return false;
  return change(()=>{node.ui||={};if(enabled)node.ui.noteTitleOnSelection=true;else delete node.ui.noteTitleOnSelection;},{localize:false});
}
function noteAppearanceControls(node){
  const controls=el('div',{class:'note-title-actions'}),key='noteTitleOnSelection',label='note.titleOnSelection';
  const button=el('button',{type:'button','data-note-appearance':key,'aria-label':t(label),title:t(label)+' · '+t(label+'.hint'),'aria-pressed':String(node.ui?.[key]===true)});
  button.append(selectionIcon('M4 4h16v16H4zM4 9h16M7 6.5h5'));button.disabled=readonly;
  button.onpointerdown=button.ondblclick=e=>e.stopPropagation();
  button.onclick=e=>{
    e.stopPropagation();if(editorMutationBlocked()||!current().nodes.includes(node))return;
    if(setNoteTitleOnSelection(node,node.ui?.[key]!==true)){
      $('#cards').querySelector(`[data-node="${CSS.escape(node.id)}"] [data-note-appearance="${key}"]`)?.focus({preventScroll:true});
    }
  };
  controls.append(button);
  const color=el('button',{type:'button',class:'note-color-button','data-note-color':node.id,'aria-label':t('note.color'),title:t('note.color')+' · '+t('note.color.hint'),'aria-haspopup':'menu','aria-controls':'groupframepalette','aria-expanded':'false'});
  const swatch=el('span',{'aria-hidden':'true'});if(node.ui?.noteTransparent===true)swatch.classList.add('note-transparent-swatch');else if(/^#[\da-f]{6}$/i.test(node.ui?.noteColor||''))swatch.style.backgroundColor=node.ui.noteColor;color.append(swatch);color.disabled=readonly;
  color.onpointerdown=color.ondblclick=e=>e.stopPropagation();color.onclick=e=>{e.stopPropagation();openNoteColorPalette(node,color);};controls.append(color);
  return controls;
}
// Note is the only two-axis card; ordinary nodes retain width-only resizing.
// Size is a layout override in graph units, not a Shader parameter. Preview
// only the DOM until release so cancellation never creates a history entry.
function nodeCanResizeHeight(node){return definition(node)?.key==='comment';}
function nodeHeightLimits(card){
  const preview=card.querySelector('.comment-node-preview');
  if(preview&&!card.classList.contains('collapsed')){
    // Reserve one actual reading line, not an H1-sized estimate for all text.
    // The title keeps its layout space even when hidden; stored sizes stay intact.
    if(!preview.hidden||!card.dataset.noteMinimumHeight){
      const body=preview.parentElement,first=preview.querySelector('p,h1,h2,h3,h4,h5,h6,pre,li')||preview;
      const style=getComputedStyle(first),sum=(element,properties)=>{const css=getComputedStyle(element);return properties.reduce((total,key)=>total+(parseFloat(css[key])||0),0);};
      const borders=['borderTopWidth','borderBottomWidth'],padding=['paddingTop','paddingBottom'];
      const scrollbar=element=>Math.max(0,element.offsetHeight-element.clientHeight-sum(element,borders));
      const line=parseFloat(style.lineHeight)||parseFloat(style.fontSize)*1.5;
      const block=first===preview?0:sum(first,[...padding,...borders,'marginTop'])+scrollbar(first);
      const minimum=Math.ceil(sum(card,borders)+card.querySelector('.node-title').offsetHeight+sum(body,['marginTop','marginBottom'])+sum(preview,[...padding,...borders])+line+block+scrollbar(preview));
      card.dataset.noteMinimumHeight=String(minimum);card.style.setProperty('--node-min-height',minimum+'px');
    }
  }
  const style=getComputedStyle(card),minimum=parseFloat(style.minHeight)||110;
  return {minimum,maximum:Math.max(minimum,parseFloat(style.getPropertyValue('--node-max-height'))||1200)};
}
function nodeMinimumWidth(card){
  const cached=parseFloat(card.dataset.nodeMinWidth);if(Number.isFinite(cached)&&cached>=0)return cached;
  const style=getComputedStyle(card),declared=parseFloat(style.getPropertyValue('--node-min-width'));
  const minimum=Number.isFinite(declared)?Math.max(0,declared):parseFloat(style.minWidth)||parseFloat(style.width)||card.offsetWidth;
  card.dataset.nodeMinWidth=String(minimum);return minimum;
}
function nodeMaximumWidth(card){return Math.max(nodeMinimumWidth(card),parseFloat(getComputedStyle(card).getPropertyValue('--node-max-width'))||1200);}
function nodePreferredWidth(card){
  const cached=Number(card.dataset.nodeDefaultWidth);if(cached>0)return cached;
  // Measure actual labels and fields without ellipsis; comments can still wrap.
  const probe=card.cloneNode(true);probe.removeAttribute('data-node');probe.classList.add('node-size-probe');
  probe.querySelectorAll('.node-canvas-comment,.node-resize-handle').forEach(e=>e.remove());
  card.parentNode.append(probe);
  const context=document.createElement('canvas').getContext('2d');
  for(const input of probe.querySelectorAll('input:not([type=color])')){
    const style=getComputedStyle(input);context.font=style.font;
    const padding=parseFloat(style.paddingLeft)+parseFloat(style.paddingRight)+parseFloat(style.borderLeftWidth)+parseFloat(style.borderRightWidth);
    input.style.width=Math.ceil(Math.max(42,context.measureText(input.value||'0').width+padding+8))+'px';
  }
  const width=Math.max(nodeMinimumWidth(card),Math.min(nodeMaximumWidth(card),Math.ceil(probe.offsetWidth)+2));probe.remove();
  card.dataset.nodeDefaultWidth=String(width);return width;
}
function applyNodeWidth(card,node){
  const width=node.ui?.collapsed===true?nodePreferredWidth(card):Number.isFinite(node.ui?.width)?node.ui.width:nodePreferredWidth(card);
  card.style.width=Math.max(nodeMinimumWidth(card),Math.min(nodeMaximumWidth(card),width))+'px';
  if(nodeCanResizeHeight(node)){
    const {minimum,maximum}=nodeHeightLimits(card),height=node.ui?.height;
    card.style.height=node.ui?.collapsed!==true&&Number.isFinite(height)?Math.max(minimum,Math.min(maximum,height))+'px':'';
  }
}
function dragNodeWidth(event,node,card,handle){
  if(event.button!==0||readonly||editorMutationBlocked())return;
  event.preventDefault();event.stopPropagation();nodeResizeGesture?.cancel();nodeDragGesture?.cancel();touchGraphGesture?.cancel();clearWireGesture();closeCreator();
  const owner=graph,data=current(),originScale=scale*uiScaleFactor(),startX=event.clientX,startY=event.clientY,minimum=nodeMinimumWidth(card),maximum=nodeMaximumWidth(card),bounds=card.getBoundingClientRect(),initialWidth=bounds.width/originScale,oldStyle=card.style.width;
  const resizeHeight=nodeCanResizeHeight(node),heightLimits=resizeHeight?nodeHeightLimits(card):null,initialHeight=bounds.height/originScale,oldHeight=card.style.height;
  let nextWidth=initialWidth,nextHeight=initialHeight,moved=false,closed=false;
  const restore=()=>{card.style.width=oldStyle;if(resizeHeight)card.style.height=oldHeight;};
  const finish=()=>{
    if(closed)return;closed=true;nodeResizeGesture=null;card.classList.remove('resizing');
    handle.onpointermove=handle.onpointerup=handle.onpointercancel=handle.onlostpointercapture=null;
    window.removeEventListener('blur',cancel);window.removeEventListener('resize',cancel);window.removeEventListener('wheel',cancel,true);
    document.removeEventListener('keydown',key,true);document.removeEventListener('pointerdown',otherPointer,true);document.removeEventListener('visibilitychange',hidden);
    if(handle.hasPointerCapture(event.pointerId))handle.releasePointerCapture(event.pointerId);
  };
  const cancel=()=>{if(closed)return;restore();finish();if(graph)wires();};
  const key=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();cancel();}};
  const otherPointer=e=>{if(e.pointerId!==event.pointerId)cancel();};
  const hidden=()=>{if(document.hidden)cancel();};
  const move=e=>{
    if(closed||e.pointerId!==event.pointerId)return;e.preventDefault();e.stopPropagation();
    if(scale*uiScaleFactor()!==originScale||graph!==owner||current()!==data){cancel();return;}
    if(!moved&&Math.abs(e.clientX-startX)<3&&(!resizeHeight||Math.abs(e.clientY-startY)<3))return;
    nextWidth=Math.max(minimum,Math.min(maximum,Math.round(initialWidth+(e.clientX-startX)/originScale)));moved=true;
    card.style.width=nextWidth+'px';
    if(resizeHeight){nextHeight=Math.max(heightLimits.minimum,Math.min(heightLimits.maximum,Math.round(initialHeight+(e.clientY-startY)/originScale)));card.style.height=nextHeight+'px';}
    wires();
  };
  handle.onpointermove=move;
  handle.onpointerup=e=>{
    if(e.pointerId!==event.pointerId||closed)return;move(e);if(closed)return;
    restore();finish();
    if(!editorMutationBlocked()&&graph===owner&&current()===data&&data.nodes.includes(node)&&moved&&(Math.abs(nextWidth-initialWidth)>.5||resizeHeight&&Math.abs(nextHeight-initialHeight)>.5)){
      change(()=>{node.ui||={};node.ui.width=nextWidth;if(resizeHeight)node.ui.height=nextHeight;},{localize:false});
      // A focused numeric draft can intentionally defer card replacement.
      if(card.isConnected)applyNodeWidth(card,node);
    }
    wires();
  };
  handle.onpointercancel=handle.onlostpointercapture=e=>{if(e.pointerId===event.pointerId)cancel();};
  nodeResizeGesture={cancel};card.classList.add('resizing');handle.setPointerCapture(event.pointerId);
  window.addEventListener('blur',cancel);window.addEventListener('resize',cancel);window.addEventListener('wheel',cancel,{capture:true,passive:true});
  document.addEventListener('keydown',key,true);document.addEventListener('pointerdown',otherPointer,true);document.addEventListener('visibilitychange',hidden);
}
function appendNodeResizeHandle(card,node){
  applyNodeWidth(card,node);if(readonly||node.ui?.collapsed===true)return;
  const label=t(nodeCanResizeHeight(node)?'comment.resize':'node.resize'),handle=el('button',{type:'button',class:'node-resize-handle','aria-label':label,title:label,'data-node-resize':node.id});
  handle.onpointerdown=e=>dragNodeWidth(e,node,card,handle);handle.onclick=handle.ondblclick=e=>e.stopPropagation();card.append(handle);
}
function applyGraphUISettings(){
  document.documentElement.dataset.uiStyle=EDITOR_DEV_SETTINGS.uiStyle;
  document.documentElement.classList.toggle('rgba-component-tint',EDITOR_DEV_SETTINGS.rgbaComponentTint);
  document.documentElement.classList.toggle('vector-component-tint',EDITOR_DEV_SETTINGS.vectorComponentTint);
  document.documentElement.classList.toggle('node-resize-hints',EDITOR_DEV_SETTINGS.nodeResizeHint);
  document.documentElement.style.setProperty('--node-drag-cursor',EDITOR_DEV_SETTINGS.nodeDragCursor);
}
function renderCards(){
  applyGraphUISettings();
  if(typeof deferCommentNodeEditor==='function'&&deferCommentNodeEditor(true))return;
  if(typeof deferInlineValueRender==='function'&&deferInlineValueRender())return;
  touchGraphGesture?.cancel();nodeDragGesture?.cancel();nodeResizeGesture?.cancel();clearWireGesture();clearGraphTrash();const cards=$('#cards');cards.replaceChildren();
  selection=new Set([...selection].filter(id=>current().nodes.some(n=>n.id===id)));
  if(selected&&!current().nodes.some(n=>n.id===selected))selected=null;
  for(const n of current().nodes){
    const collapsed=n.ui?.collapsed===true,d=definition(n),card=el('article',{class:'node'+(collapsed?' collapsed':'')+(selection.has(n.id)?' selected':'')+(!canDeleteNode(n)?' output':'')+(nodeHasCompileError(n.id)?' error':''),'data-node':n.id});
    card.dataset.category=nodeCategory(d||{key:''});card.style.left=(n.ui?.x||0)+'px';card.style.top=(n.ui?.y||0)+'px';
    if(d?.key==='comment'){
      card.dataset.noteTitleOnSelection=String(n.ui?.noteTitleOnSelection===true);card.dataset.noteTransparent=String(n.ui?.noteTransparent===true);
      card.style.setProperty('--note-font-scale',noteFontScale(n));
      if(/^#[\da-f]{6}$/i.test(n.ui?.noteColor||'')){card.classList.add('note-colored');card.style.setProperty('--note-color',n.ui.noteColor);}
    }
    const title=el('div',{class:'node-title'}),text=el('div',{class:'node-title-text'});
    const collapseToggle=nodeCollapseToggle(n);if(collapseToggle)text.append(collapseToggle);
    const displayName=nodeDisplayName(n),canvasTitle=nodeCanvasTitle(n);
    const name=el('span',{class:d?.key==='function_call'?'node-function-name':'node-function-title'},canvasTitle);
    name.title=canvasTitle;
    if(d?.key==='function_call'){const icon=$('#subgraph-icon').content.firstElementChild.cloneNode(true),local=FunctionModel.find(graph,n.params.functionId)?.scope==='local';icon.classList.toggle('source-subgraph',!local);text.append(icon);text.title=t(local?'function.local':'function.source');}
    text.append(name);title.append(text);
    if(customNodeNamesEnabled()&&!isSourceReferenceNode(n)){name.onpointerdown=e=>e.stopPropagation();name.ondblclick=e=>{e.preventDefault();e.stopPropagation();beginNodeRename(n,name);};}
    const meta=el('div',{class:'node-title-meta'}),source=nodeSourceDeclaration(n),quick=source?null:nodePrimarySelector(n,d);
    if(source){const label=({uniform:'Uniform',constant:'Graph Const',spec_constant:'Spec Const',sampler:'Sampler',top_input:'TOP Input'})[source.kind||(n.params.inputId?'top_input':'')]||d.label;const subtitle=label+' · '+(source.type||'sampler2D');meta.append(el('small',{class:'node-prototype',title:subtitle},subtitle));}
    else {
      const subtitles=[];
      if(customNodeNamesEnabled()&&n.name)subtitles.push(d?.key==='vector'?'Vector':d?.key==='comment'?nodeTypeLabel(d):d?.label||'');
      if(d?.key==='uv')subtitles.push(builtInSourceLabel(d));
      if(subtitles.length){const subtitle=subtitles.join(' · ');meta.append(el('small',{class:'node-prototype',title:subtitle},subtitle));}
    }
    if(quick){if(meta.childNodes.length)meta.append(el('small',{class:'node-meta-separator','aria-hidden':'true'},'·'));meta.append(quick);}
    if(meta.childNodes.length)title.append(meta);
    if(d?.key==='comment')title.append(noteAppearanceControls(n));
    let suppressCardClick=false;
    card.dataset.dragSurface=d?.key==='comment'||!EDITOR_DEV_SETTINGS.nodeBodyDrag?'header':'body';
    card.onpointerdown=e=>{if(isNodeDragSurface(e.target,card))dragNodeTitle(e,n,card,cards,moved=>{suppressCardClick=moved;});};
    card.append(title);const list=el('div',{class:'ports'+(collapsed?' collapsed-ports':'')});
    const portRow=(kind,name,missing=false,compact=false)=>{
      const className=kind==='inputs'?'input':'output',type=ports(n,kind)[name]||'?';
      const label=missing?name:portLabel(n,kind,name),row=el('div',{class:'port-row '+className+(missing?' missing-port':'')+(compact?' collapsed-port-row':'')}),b=el('button',{class:'port'+(compact?' collapsed-port':''),title:`${displayName} ${className}: ${label} (${type})`,'aria-label':`${n.id} ${className} ${label}`});
      b.dataset.type=type;b.dataset.kind=kind;b.dataset.port=name;row.dataset.type=type;
      if(!missing)applyPortColorHint(row,n,kind,name);
      if(d?.key==='replace'){row.dataset.component=name;row.classList.add(name==='value'||name==='out'?'vector-whole':'vector-component');}
      b.disabled=missing;if(missing){b.setAttribute('aria-label',label+' · '+t('type.incompatible'));row.title=t('type.incompatible');}
      b.onpointerdown=e=>{if(!missing)dragWire(b,e);};
      b.onclick=e=>{e.stopPropagation();if(readonly||suppressPortClick)return;const info=portInfo(b);if(linkStart&&linkStart.kind!==info.kind)connectPorts(linkStart,info);else {linkStart=info;$('#connection').hidden=false;$('#connection').textContent=t(wireStartHint(info));}};
      if(compact){row.append(b);return row;}
      const caption=el('span',{class:'port-label',title:label},label);if(!missing)applyPortLabelColorHint(caption,n,kind,name);
      row.append(b,caption,missing?el('small',{},'?'):portTypeCaption(n,kind,name));
      if(!missing&&kind==='inputs'&&typeof nodeInlineValues==='function'){const control=nodeInlineValues(n,name);if(control)row.append(control);}
      if(kind==='outputs'&&typeContract?.vectors?.types.includes(type)&&d?.key!=='vector_split'){
        const split=el('button',{class:'vector-split-shortcut',type:'button',title:t('vector.splitShortcut'),'aria-label':t('vector.splitShortcut')+' · '+label});
        const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');icon.setAttribute('viewBox','0 0 16 16');icon.setAttribute('aria-hidden','true');const path=document.createElementNS(icon.namespaceURI,'path');path.setAttribute('d','M2 8h5M7 3v10M7 3h6M7 13h6');icon.append(path);split.append(icon);
        split.disabled=readonly;split.onpointerdown=e=>e.stopPropagation();split.onclick=e=>{e.stopPropagation();addVectorSplit(n,name);};split.ondblclick=e=>e.stopPropagation();row.append(split);
      }
      return row;
    };
    if(collapsed){appendCollapsedPorts(list,n,portRow);card.append(list);}else{
    if(d?.key==='compare'){const controls=el('div',{class:'node-body-controls'});controls.append(compareOperatorSelector(n));card.append(controls);}
    for(const kind of ['inputs','outputs']){
      const known=ports(n,kind);for(const name of Object.keys(known))list.append(portRow(kind,name));
      const side=kind==='inputs'?'to':'from',missing=new Set(current().edges.filter(e=>e[side][0]===n.id&&!Object.hasOwn(known,e[side][1])).map(e=>e[side][1]));
      for(const name of missing)list.append(portRow(kind,name,true));
    }
    appendSparePort(list,n);card.append(list);
    if(n.params?.value!==undefined||d?.key==='vector'){const control=typeof nodeFixedValueEditor==='function'?nodeFixedValueEditor(n):null;card.append(control||el('div',{class:'node-value'},Array.isArray(n.params.value)?n.params.value.join(' · '):String(n.params.value)));}
    if(d?.key==='color'&&Array.isArray(n.params.value))card.append(nodeColorPicker(n));
    if(['uniform','texture','sampler'].includes(d?.key)){const decl=graph.declarations.find(x=>x.id===n.params.declarationId);if(decl?.expose)card.append(el('div',{class:'expose-badge'},'Exposed · '+(decl.exposeName||(decl.kind==='sampler'&&decl.source==='input:0'?'Input 1 Default TOP':decl.name))));}
    if(d?.key==='comment')card.append(commentNodeEditor(n,true));
    else if(nodeComment(n))card.append(nodeCanvasComment(n));
    }
    card.onclick=e=>{e.stopPropagation();if(suppressCardClick||e.target.closest('button,input,textarea,select,a,[contenteditable="true"],[role="button"],.node-inline-values'))return;selectNode(n,e.ctrlKey||e.metaKey);document.querySelectorAll('.node').forEach(c=>c.classList.toggle('selected',selection.has(c.dataset.node)));inspector();renderNavigation();};
    card.ondblclick=e=>{e.stopPropagation();if(e.target.closest('button,input,textarea,select,a,[contenteditable="true"],[role="button"],.node-inline-values'))return;if(d?.key==='function_call')enterFunction(n);};cards.append(card);appendNodeResizeHandle(card,n);
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
  if(d.inputPreset)return {category:'shader',path:['shader'],source:'td',secondary:[],aliases:[inputPresets[d.inputPreset][0],'uniform','time','frame'],tags:[],glslName:inputPresets[d.inputPreset][1],descriptionKey:'inputs.clockHint',subgraph:false,saved:false,project:false};
  if(d.inputSourceId)return {category:'shader',path:['shader'],source:'project',secondary:[],aliases:['input','reference'],tags:[],glslName:d.label,descriptionKey:'inputs.referenceHint',subgraph:false,saved:false,project:true};
  const f=d.definitionUuid===FunctionModel.CALL?(d.source||FunctionModel.find(graph,d.functionId)):null;
  const authored=f?(f.browser||browserData().functions[f.source?.id]||browserData().functions[f.origin?.id]):browserData().nodes[d.definitionUuid];
  const stringList=value=>Array.isArray(value)?value.filter(x=>typeof x==='string'):[];
  const raw=authored||(d.key==='comment'?{category:'data',source:'editor',aliases:['note','annotation','text','註解','注释','備註'],descriptionKey:'help.comment'}:d.key==='replace'?{category:'vector',source:'glsl',glslName:'vecN',aliases:['override','replace','替換','覆寫'],descriptionKey:'help.replace'}:d.key==='spec_constant'?{category:'shader',source:'td',glslName:'constant_id',aliases:['specialization','spec','特化常數'],descriptionKey:'help.spec_constant'}:{}),known=c=>browserData().categories.includes(c),category=known(raw.category)?raw.category:'uncategorized';
  const source=f?(f.scope==='local'?'project':f.scope==='personal'?'personal':'editor'):(raw.source||'editor');
  const path=stringList(raw.categoryPath);
  const aliases=stringList(raw.aliases).filter(alias=>!d.presetType||!/^[iub]?vec(?:tor)?\s*[234]$/i.test(alias)||alias.replace(/tor|\s/gi,'').toLowerCase()===d.presetType);
  if(d.key==='comment')aliases.push('comment','筆記');
  return {category,path:path[0]===category?path:[category],source,secondary:stringList(raw.secondaryCategories).filter(known),aliases,tags:stringList(raw.tags),glslName:d.presetType||raw.glslName||'',descriptionKey:d.descriptionKey||f?.descriptionKey||raw.descriptionKey||'help.function',subgraph:!!f,saved:!!f&&!d.source&&f.scope!=='local',project:!!f&&!d.source};
}
const browserEntryKey=d=>d.entryKey||d.key;
function browserIndex(){
  // availableEntries already deduplicates installed library snapshots by source/version.
  const unique=new Map();
  for(const d of availableEntries()){const key=browserEntryKey(d);if(!unique.has(key))unique.set(key,{d,meta:browserMeta(d)});}
  return [...unique.values()];
}
function browserSearchScore(entry,query){
  const q=normalizeSearch(query);if(!q)return 0;
  const {d,meta:m}=entry,names=[d.label,m.glslName].map(normalizeSearch),aliases=m.aliases.map(normalizeSearch);
  const requestedVector=q.match(/\b([iub]?vec)(?:tor)?\s*([234])\b/);
  if(d.presetType&&requestedVector&&d.presetType!==requestedVector[1]+requestedVector[2])return Infinity;
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
  if(kind==='subgraph'){const icon=$('#subgraph-icon').content.firstElementChild.cloneNode(true);icon.setAttribute('class','browser-glyph browser-glyph-filled');icon.setAttribute('viewBox','8 10 48 48');return icon;}
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('class','browser-glyph');svg.setAttribute('aria-hidden','true');
  const path=document.createElementNS(svg.namespaceURI,'path');
  path.setAttribute('d',kind==='categories'?'M4 4v16M4 7h4M4 17h4M12 7h8M12 17h8':kind==='library'?'M4 5v14M8 5v14M12 6l4 13M17 4l4 13':kind==='project'?'M3 6h6l2 2h10v12H3Z':'m12 2 9 5v10l-9 5-9-5V7Zm0 10 9-5m-9 5L3 7m9 5v10');
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
  const key=browserEntryKey(d),button=el('button',{'data-entry':key,class:'palette-entry','aria-pressed':String(browserSelection===key)});
  button.append(browserGlyph(entry.meta.subgraph?'subgraph':'node'),el('span',{class:'palette-entry-label'},d.label),el('small',{class:'palette-entry-source'},browserSourceLabel(entry.meta.source)));
  button.title=d.label+' · '+browserBadges(entry)+'\n'+t('browser.inspect');
  button.onclick=()=>{browserSelection=key;document.querySelectorAll('#nodelibrary [data-entry]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.entry===key)));renderBrowserDetail(entry);button.scrollIntoView({block:'nearest'});};
  button.ondblclick=()=>addNode(d,(180-pan.x)/scale,(160-pan.y)/scale);
  const add=el('button',{class:'browser-add','data-add-entry':key,'aria-label':t('browser.add')+' '+d.label},'+');add.disabled=readonly;
  const drop=(x,y)=>{const p=graphPoint(x,y);if(p)addNode(d,p.x,p.y);};
  installCanvasItemDrag(add,()=>d.label,drop,()=>addNode(d,(180-pan.x)/scale,(160-pan.y)/scale));
  const inspect=button.onclick;installCanvasItemDrag(button,()=>d.label,drop,inspect);
  const pointer=button.onpointerdown;button.onpointerdown=e=>{if(e.pointerType==='mouse')pointer(e);};
  row.append(button,add);return row;
}
function renderBrowserDetail(entry){
  const box=$('#browserdetail');box.hidden=!entry;box.replaceChildren();if(!entry)return;
  const head=el('div',{class:'browser-detail-heading'});head.append(el('strong',{},entry.d.label));
  const close=el('button',{'aria-label':t('browser.closeDetails')},'×');close.onclick=()=>{browserSelection=null;renderLibrary();};head.append(close);box.append(head);
  const body=el('div',{class:'browser-detail-body',tabindex:'0'});body.append(el('small',{class:'muted'},browserBadges(entry)));
  body.append(el('p',{class:'browser-category-path'},entry.meta.path.map((key,i)=>i?t('browser.branch.'+key):browserCategoryLabel(key)).join(' › ')));
  const variants=creatorVariants(entry.d,null),variant=variants[0];
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
  const changed=change(()=>{graph=prepareGraphReplacement(examples[name]);graphTrail=[];selection.clear();selected=null;selectedEdge=null;errorNode=null;},{localize:false});
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
      const personal=el('section',{id:'personal-library',class:'browser-personal'}),heading=el('div',{class:'personal-heading'}),help=el('button',{class:'personal-help','aria-label':t('personal.showHelp'),title:t('personal.showHelp')},'?');
      help.onclick=()=>{helpContext='personal';workspaceLayout?.reveal('help');renderHelp();};heading.append(el('h4',{},t('browser.source.personal')),help);personal.append(heading,el('p',{class:'personal-drop-label'},t('personal.drop')));personalSourceHeader(personal);container.append(personal);
      const templates=el('details',{class:'browser-templates'});templates.append(el('summary',{},t('browser.templates')),el('p',{class:'muted'},t('library.exampleHint')));
      for(const name of Object.keys(examples)){const b=el('button',{class:'example-entry','data-example':name},t('example.'+name));b.disabled=readonly;b.onclick=()=>loadExample(name);templates.append(b);}container.append(templates);
    }
  }
  for(const b of document.querySelectorAll('#functionsources [data-function-source]')){const active=b.dataset.functionSource===libraryFunctionSource;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;}
  $('#libraryintro').textContent=t('browser.projectScope');
  renderBrowserDetail(entries.find(e=>browserEntryKey(e.d)===browserSelection));$('#nodecount').textContent=current().nodes.length+' '+t('sources.nodes');
}
let creatorDragGesture=null;
function closeCreator(){creatorDragGesture?.cancel();creatorState=null;$('#creator').hidden=true;}
function positionCreator(position=null){
  if(!creatorState)return;
  const box=$('#creator'),uiScale=uiScaleFactor();
  if(position)creatorState.panelPosition=position;
  // Keep the creation point in graph space separate from the movable panel.
  const target=creatorState.panelPosition||{x:creatorState.anchorX/uiScale-box.offsetWidth/2,y:creatorState.anchorY/uiScale-box.querySelector('.create-heading').offsetHeight/2};
  const x=Math.max(8,Math.min(target.x,innerWidth/uiScale-box.offsetWidth-8)),y=Math.max(8,Math.min(target.y,innerHeight/uiScale-box.offsetHeight-8));
  box.style.left=x+'px';box.style.top=y+'px';
  if(creatorState.panelPosition)creatorState.panelPosition={x,y};
}
function installCreatorDrag(){
  const box=$('#creator'),heading=box.querySelector('.create-heading');
  heading.addEventListener('pointerdown',event=>{
    if(event.button!==0||event.isPrimary===false||!creatorState||event.target.closest('button,input,select,textarea,a,[contenteditable="true"],[role="button"]'))return;
    event.preventDefault();event.stopPropagation();creatorDragGesture?.cancel();
    const state=creatorState,uiScale=uiScaleFactor(),rect=box.getBoundingClientRect(),origin={x:rect.left/uiScale,y:rect.top/uiScale},previous=state.panelPosition?{...state.panelPosition}:null;
    const sx=event.clientX,sy=event.clientY,controller=new AbortController(),options={capture:true,signal:controller.signal};
    let moved=false,finished=false;
    const finish=accept=>{
      if(finished)return;finished=true;controller.abort();creatorDragGesture=null;
      if(!accept&&creatorState===state){state.panelPosition=previous;positionCreator();}
      if(heading.hasPointerCapture(event.pointerId))heading.releasePointerCapture(event.pointerId);
    };
    const cancel=()=>finish(false);
    const move=ev=>{
      if(finished||ev.pointerId!==event.pointerId)return;
      if(creatorState!==state||box.hidden||uiScaleFactor()!==uiScale){cancel();return;}
      ev.preventDefault();ev.stopPropagation();
      if(!moved&&Math.hypot(ev.clientX-sx,ev.clientY-sy)<3)return;
      moved=true;positionCreator({x:origin.x+(ev.clientX-sx)/uiScale,y:origin.y+(ev.clientY-sy)/uiScale});
    };
    creatorDragGesture={cancel};
    window.addEventListener('pointermove',move,options);
    window.addEventListener('pointerup',ev=>{if(ev.pointerId!==event.pointerId)return;move(ev);finish(true);},options);
    window.addEventListener('pointercancel',ev=>{if(ev.pointerId===event.pointerId)cancel();},options);
    heading.addEventListener('lostpointercapture',cancel,options);
    window.addEventListener('pointerdown',ev=>{if(ev.pointerId!==event.pointerId)cancel();},options);
    window.addEventListener('blur',cancel,options);window.addEventListener('resize',cancel,options);
    window.addEventListener('keydown',ev=>{if(ev.key==='Escape')cancel();},options);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel();},options);
    try{heading.setPointerCapture(event.pointerId);}catch{cancel();}
  });
  window.addEventListener('resize',()=>positionCreator());
}
function openCreator(clientX,clientY,wire=null){
  if(readonly||!graph)return;cancelConnection();creatorDragGesture?.cancel();const position=graphPoint(clientX,clientY);if(!position)return;
  creatorState={path:[],anchorX:clientX,anchorY:clientY,...position,wire};creatorIndex=0;
  $('#creator').hidden=false;
  $('#createsearch').value='';$('#createsource').value='all';creatorCategory='all';$('#createtype').value='all';$('#createcontext').textContent=wire?`${wire.type} · ${wire.kind==='outputs'?'→':'←'}`:t('create.title');renderCreator();$('#createsearch').focus();
}
function renderCreator(){
  if(!creatorState)return;const query=$('#createsearch').value.toLowerCase(),category=creatorCategory,typeFilter=$('#createtype').value,wire=creatorState.wire;
  creatorMatches=[];
  const entries=browserIndex().map(({d})=>{if(['uniform','sampler','constant','spec_constant'].includes(d.key))d={...d,label:t('inputs.new')+' · '+d.label};return {d,meta:creatorMeta(d)};});
  for(const preset of Object.keys(inputPresets)){
    const base=catalog.find(d=>d.key==='uniform');if(!base)continue;
    const d={...base,key:'preset:'+preset,label:t('inputs.preset.'+preset),inputPreset:preset};entries.push({d,meta:creatorMeta(d)});
  }
  for(const decl of allInputSources().filter(d=>['uniform','sampler','constant','spec_constant','top_input'].includes(d.kind)&&!d.sourceMissing)){
    const base=catalog.find(d=>d.key===decl.kind);if(!base?.stages.includes(stage))continue;
    const d={...base,key:'input:'+decl.id,label:decl.name,inputSourceId:decl.id,inputKind:decl.kind,inputType:decl.type};entries.push({d,meta:creatorMeta(d)});
  }
  renderCreatorColumns(entries,query);
  for(const {d,meta} of browseEntries(entries,query,{tab:'categories',category,source:$('#createsource').value})){
    const entry={d,meta},path=creatorState.path||[];if(!query.trim()&&!creatorPaths(entry).some(p=>path.every((key,i)=>p[i]===key)))continue;
    let candidates=[];
    for(const variant of creatorVariants(d,wire)){
      const p=Object.entries(wire?.kind==='inputs'?variant.outputs:variant.inputs);
      if(!wire){const socketTypes=[...Object.values(variant.inputs),...Object.values(variant.outputs)];if(typeFilter==='all'||socketTypes.includes(typeFilter))candidates.push({d,type:variant.type,port:null,params:variant.params,variant});}
      else for(const[name,type]of p){try{const plan=creatorTypePlan(d,variant,name,wire,typeFilter!=='all'),actual=plan[wire.kind==='inputs'?'outputs':'inputs'][name];if(typeFilter==='all'||actual===typeFilter)candidates.push({d,type:variant.type,port:name,portType:actual,params:variant.params,variant:plan});}catch{}}
    }
    if(candidates.length){
      const sizeScore=m=>d.key==='combine'&&wire?.kind==='outputs'&&valueTypes().includes(wire.type)?Math.abs(typeComponents(m.type)-Math.min(4,typeComponents(wire.type)+1)):0;
      candidates.sort((a,b)=>Number(b.portType===wire?.type)-Number(a.portType===wire?.type)||sizeScore(a)-sizeScore(b));creatorMatches.push(candidates[0]);
    }
  }
  if(!query.trim())creatorMatches.sort((a,b)=>creatorPriority(a,wire)-creatorPriority(b,wire));
  creatorIndex=Math.min(creatorIndex,Math.max(0,creatorMatches.length-1));const list=$('#createresults');list.replaceChildren();
  creatorMatches.forEach((match,i)=>{const label=match.d.key==='vector'?nodeTypeLabel(match.d,{type:match.type}):match.d.label,b=el('button',{class:'create-entry'+(i===creatorIndex?' active':''),'data-category':nodeCategory(match.d),'data-create-entry':browserEntryKey(match.d)},label);if(match.port)b.append(el('small',{},match.port+' · '+match.portType));b.append(el('small',{class:'create-source'},browserBadges({d:match.d,meta:creatorMeta(match.d)})));b.dataset.browserCategory=creatorMeta(match.d).category;b.setAttribute('role','option');b.setAttribute('aria-selected',String(i===creatorIndex));b.onclick=()=>chooseCreator(i);b.onpointerenter=e=>{if(e.pointerType==='mouse')selectCreatorResult(i);};b.onfocus=()=>selectCreatorResult(i);list.append(b);});
  if(!creatorMatches.length)list.append(el('p',{class:'muted'},t('create.empty')));
  for(const button of document.querySelectorAll('[data-create-category]')){const active=button.dataset.createCategory===(query.trim()?'all':category);button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;}
  renderCreatorDetails();
  positionCreator();

}
function creatorInputSeed(wire){
  if(wire?.kind!=='inputs')return {};
  const n=current().nodes.find(n=>n.id===wire.node),name=portLabel(n,'inputs',wire.port),hint='u'+name.charAt(0).toUpperCase()+name.slice(1);
  return {name:hint,value:defaultInput(n,wire.port,wire.type)};
}
function chooseCreator(index){
  const match=creatorMatches[index],state=creatorState;if(!match||!state)return;
  const changed=change(()=>{
    const d=match.d.inputSourceId||match.d.inputPreset?catalog.find(d=>d.definitionUuid===match.d.definitionUuid):match.d;
    const inputSeed=match.d.inputPreset?{name:inputPresets[match.d.inputPreset][0],preset:match.d.inputPreset}:creatorInputSeed(state.wire);
    const n=instantiate(d,state.x,state.y,match.type,{locked:$('#createtype').value!=='all',declarationId:match.d.inputSourceId,inputSeed});Object.assign(n.params,clone(match.params||{}));
    if(state.wire){
      if(isVectorOperation(match.d)){const peer=current().nodes.find(p=>p.id===state.wire.node);n.ui.componentNames=definition(peer)?.key==='uv'?'uv':definition(peer)?.key==='color'?'rgba':peer.ui?.componentNames||'xyzw';}
      const from=state.wire.kind==='outputs'?{node:state.wire.node,port:state.wire.port}:{node:n.id,port:match.port};
      const to=state.wire.kind==='inputs'?{node:state.wire.node,port:state.wire.port}:{node:n.id,port:match.port};commitPlannedWire(from,to);
    }
  });
  if(changed){closeCreator();$('#canvas').focus();}else $('#createsearch').focus();
}
function duplicateSelection(){
  const ids=new Set(selection),nodes=current().nodes.filter(n=>ids.has(n.id)&&canDeleteNode(n));if(!nodes.length)return;
  change(()=>{const remap=new Map(nodes.map(n=>[n.id,'n'+crypto.randomUUID().replaceAll('-','').slice(0,12)]));
    const frames=GraphFrames.copy(current(),remap.keys(),remap);
    const edges=current().edges.filter(e=>remap.has(e.from[0])&&remap.has(e.to[0])).map(e=>({from:[remap.get(e.from[0]),e.from[1]],to:[remap.get(e.to[0]),e.to[1]]}));
    for(const n of nodes){const duplicate=clone(n);duplicate.id=remap.get(n.id);duplicate.ui={...clone(n.ui||{}),x:(n.ui?.x||0)+48,y:(n.ui?.y||0)+48};current().nodes.push(duplicate);assignCreatedNodeNames([duplicate]);}current().edges.push(...edges);selection=new Set(remap.values());selected=[...selection].at(-1);selectedEdge=null;
    if(frames.length)GraphFrames.write(current(),[...GraphFrames.read(current()),...frames]);
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
    focusGraphCanvas();closeCreator();const boxSelect=(boxSelectMode&&e.button===0)||e.shiftKey||e.button===2,sx=e.clientX,sy=e.clientY,ox=pan.x,oy=pan.y,previous=e.ctrlKey||e.metaKey?new Set(selection):new Set();let moved=false;
    if(![0,1,2].includes(e.button))return;canvas.setPointerCapture(e.pointerId);
    canvas.onpointermove=ev=>{moved=Math.hypot(ev.clientX-sx,ev.clientY-sy)>3;
      if(boxSelect){const rect=canvas.getBoundingClientRect(),box=$('#marquee'),uiScale=uiScaleFactor();box.hidden=false;box.style.left=(Math.min(sx,ev.clientX)-rect.left)/uiScale+'px';box.style.top=(Math.min(sy,ev.clientY)-rect.top)/uiScale+'px';box.style.width=Math.abs(ev.clientX-sx)/uiScale+'px';box.style.height=Math.abs(ev.clientY-sy)/uiScale+'px';
        selection=new Set(previous);document.querySelectorAll('.node').forEach(card=>{const r=card.getBoundingClientRect();if(r.right>=Math.min(sx,ev.clientX)&&r.left<=Math.max(sx,ev.clientX)&&r.bottom>=Math.min(sy,ev.clientY)&&r.top<=Math.max(sy,ev.clientY))selection.add(card.dataset.node);card.classList.toggle('selected',selection.has(card.dataset.node));});
      }else {pan={x:ox+(ev.clientX-sx)/uiScaleFactor(),y:oy+(ev.clientY-sy)/uiScaleFactor()};transform();}
    };
    canvas.onpointerup=ev=>{canvas.onpointermove=null;canvas.onpointerup=null;$('#marquee').hidden=true;
      if(boxSelect&&moved){selected=[...selection].at(-1)||null;selectedEdge=null;suppressContext=e.button===2;render();}
      else if(!moved&&e.button===0){if(linkStart)finishWireOnBlank(linkStart,ev.clientX,ev.clientY);else {selected=null;selection.clear();selectedEdge=null;render();}}
    };
    canvas.onpointercancel=()=>{canvas.onpointermove=null;canvas.onpointerup=null;$('#marquee').hidden=true;};
  };
  document.addEventListener('pointerdown',e=>{if(creatorState&&!e.target.closest('#creator'))closeCreator();});
  for(const id of ['createsearch','createtype','createsource'])$('#'+id).addEventListener(id==='createsearch'?'input':'change',()=>{if(id==='createsource'&&creatorState){creatorState.path=[];creatorCategory='all';}creatorIndex=0;renderCreator();});
  installCreatorColumns();installCreatorDrag();
  $('#closecreator').onclick=closeCreator;
  $('#creator').onkeydown=e=>{
    if(e.key==='Escape'){e.preventDefault();closeCreator();canvas.focus();}
    if(e.target.closest('#createcategory')||e.target.tagName==='SELECT')return;
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();creatorIndex=Math.max(0,Math.min(creatorMatches.length-1,creatorIndex+(e.key==='ArrowDown'?1:-1)));selectCreatorResult(creatorIndex);$('#createresults .active')?.scrollIntoView({block:'nearest'});}
    if(e.key==='Enter'&&e.target.tagName!=='SELECT'){e.preventDefault();chooseCreator(creatorIndex);}
  };
  document.addEventListener('keydown',e=>{
    if(e.defaultPrevented)return;
    if(e.target.closest('.details')||e.target.closest('#grapheditmenu')||e.target.closest('.library')||e.target.closest('#creator')||e.target.closest('.shader-selector')||e.target.closest('dialog')||['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;
    const plainKey=e.key.toLowerCase();
    const inGraph=e.target===document.body||e.target===document.documentElement||e.target.closest('.graph-workspace');
    const graphCommandReady=inGraph&&!e.isComposing&&!e.target.isContentEditable&&!canvas.onpointermove&&!valueLadder&&!pendingValueLadder&&!numericPresetMenu&&!creatorState&&!linkStart&&!wireGesture&&!nodeDragGesture&&!nodeResizeGesture&&!touchGraphGesture&&!document.querySelector('dialog[open],:popover-open');
    if(['h','l'].includes(plainKey)&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&(!e.shiftKey||plainKey==='l')){
      if(graphCommandReady){
        if(plainKey==='h'){e.preventDefault();fit();}
        else if(!e.repeat&&!editorMutationBlocked()&&selectedCanvasNodes().length>1){e.preventDefault();arrangeSelection(e.shiftKey?'autoReverse':'auto');}
      }
      return;
    }
    if(plainKey==='g'&&((e.ctrlKey||e.metaKey)&&!e.altKey||e.altKey&&!e.ctrlKey&&!e.metaKey)){
      if(graphCommandReady){
        e.preventDefault();
        if(!e.repeat&&!editorMutationBlocked()){
          if(e.altKey){if(e.shiftKey)joinGroupFrameSelection();else detachGroupFrameSelection();}else if(e.shiftKey)groupSelection();else createGroupFrame();
        }
      }
      return;
    }
    if(e.key==='ContextMenu'||(e.shiftKey&&e.key==='F10')){e.preventDefault();const r=canvas.getBoundingClientRect();openGraphMenu(r.left+r.width/2,r.top+r.height/3);return;}
    if(e.key==='Tab'){e.preventDefault();const r=canvas.getBoundingClientRect();openCreator(r.left+r.width/2,r.top+r.height/3);}
    if(e.key==='Escape'){
      const interaction=!!linkStart||!!creatorState;
      cancelConnection();closeCreator();
      if(!interaction&&graphFocused&&!document.fullscreenElement&&!document.querySelector('dialog[open],:popover-open')){e.preventDefault();setGraphFocus(false);$('#graphfocus').focus({preventScroll:true});}
      return;
    }
    if(e.altKey&&e.key==='ArrowUp'){e.preventDefault();if(graphTrail.length)navigateGraph(graphTrail.length-1);}
    if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();remove();}
    if(e.ctrlKey||e.metaKey){const k=e.key.toLowerCase();if(['z','a','d'].includes(k))e.preventDefault();
      if(k==='z')undo(e.shiftKey);if(k==='a'){selection=new Set(current().nodes.map(n=>n.id));selected=[...selection].at(-1);render();}if(k==='d')duplicateSelection();
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
  const editable=target=>target.closest('input,textarea,select,[contenteditable="true"],a,button:not(.port),.graph-navigation,.node-inline-values,.comment-node-preview,.group-frame-title');
  const syncSelection=()=>document.querySelectorAll('.node').forEach(c=>c.classList.toggle('selected',selection.has(c.dataset.node)));
  const sample=()=>{const [a,b=a]=[...points.values()];return{x:(a.x+b.x)/2,y:(a.y+b.y)/2,distance:Math.hypot(b.x-a.x,b.y-a.y)};};
  const rebase=()=>{const p=sample();gesture.origin={...p,point:graphPoint(p.x,p.y),pan:{...pan},scale};};
  const stopHold=()=>{clearTimeout(holdTimer);holdTimer=0;};
  const clearPreview=g=>{
    clearGraphTrash();clearVectorWirePreview();
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
      const o=g.origin,r=canvas.getBoundingClientRect(),uiScale=uiScaleFactor();
      scale=Math.max(GRAPH_ZOOM_MIN,Math.min(GRAPH_ZOOM_MAX,o.scale*p.distance/Math.max(1,o.distance)));
      pan={x:(p.x-r.left)/uiScale-o.point.x*scale,y:(p.y-r.top)/uiScale-o.point.y*scale};transform();return;
    }
    if(g.mode==='pan'){
      const o=g.origin;pan={x:o.pan.x+(p.x-o.x)/uiScaleFactor(),y:o.pan.y+(p.y-o.y)/uiScaleFactor()};transform();
    }else if(g.mode==='node'){
      const anchor=g.positions.find(item=>item.node===g.node),screenScale=g.origin.scale*uiScaleFactor(),mx=snap(anchor.x+dx/screenScale)-anchor.x,my=snap(anchor.y+dy/screenScale)-anchor.y;
      for(const item of g.positions){item.nextX=item.x+mx;item.nextY=item.y+my;item.card.style.left=item.nextX+'px';item.card.style.top=item.nextY+'px';}updateGraphTrash(p.x,p.y);wires();
    }else if(g.mode==='edge'){showTrashWireProxy(p.x,p.y);updateGraphTrash(p.x,p.y);
    }else if(g.mode==='wire'){
      const over=updateGraphTrash(p.x,p.y),target=over?null:findWireTarget(g.candidates,p.x,p.y,22);if(g.target!==target){g.target?.classList.remove('wire-target');g.target=target;target?.classList.add('wire-target');}
      const r=target?.getBoundingClientRect(),q=graphPoint(r?r.left+r.width/2:p.x,r?r.top+r.height/2:p.y);
      if(q){wireDrag={...g.port,q,ready:!!target};wires();const range=previewVectorWire(g.port,target);$('#connection').hidden=false;$('#connection').textContent=t(target?'wire.release':canDisconnectInputOnBlank(g.port)&&isBlankWireDrop(p.x,p.y)?'trash.releaseWire':'wire.touchConnect')+(range?' · '+range:'');}
    }else if(g.mode==='box'){
      const r=canvas.getBoundingClientRect(),box=$('#marquee'),uiScale=uiScaleFactor();box.hidden=false;
      box.style.left=(Math.min(g.start.x,p.x)-r.left)/uiScale+'px';box.style.top=(Math.min(g.start.y,p.y)-r.top)/uiScale+'px';box.style.width=Math.abs(dx)/uiScale+'px';box.style.height=Math.abs(dy)/uiScale+'px';
      selection=new Set();document.querySelectorAll('.node').forEach(card=>{const r=card.getBoundingClientRect();if(r.right>=Math.min(g.start.x,p.x)&&r.left<=Math.max(g.start.x,p.x)&&r.bottom>=Math.min(g.start.y,p.y)&&r.top<=Math.max(g.start.y,p.y))selection.add(card.dataset.node);});syncSelection();
    }
  };
  const move=()=>{
    const g=gesture,p=sample();if(!g||g.mode==='menu')return;
    if(!g.moved&&Math.hypot(p.x-g.start.x,p.y-g.start.y)>=slop){
      g.moved=true;stopHold();lastTap=null;
      if(g.port&&!readonly){g.mode='wire';cancelConnection();beginGraphTrash(trashTarget('port',g.port));g.candidates=[...$('#cards').querySelectorAll('.port')].filter(b=>!connectionProblem(g.port,portInfo(b)));}
      else if(g.node&&g.canDragNode&&!readonly){
        g.mode='node';if(!selection.has(g.node.id))selectNode(g.node);else selected=g.node.id;selectedEdge=null;syncSelection();inspector();cancelConnection();
        g.positions=current().nodes.filter(n=>selection.has(n.id)).map(node=>({node,card:$('#cards').querySelector(`[data-node="${CSS.escape(node.id)}"]`),x:node.ui?.x||0,y:node.ui?.y||0,nextX:node.ui?.x||0,nextY:node.ui?.y||0}));
        beginGraphTrash(trashTarget('nodes',g.positions.map(p=>p.node)));
      }else if(EDITOR_DEV_SETTINGS.canvasTrash&&g.edge>=0&&!readonly){g.mode='edge';selectEdge(g.edge);cancelConnection();beginGraphTrash(trashTarget('edge',g.edge));
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
      else {linkStart=g.port;$('#connection').hidden=false;$('#connection').textContent=t(wireStartHint(g.port,true));}
      return;
    }
    const key=g.node?'node:'+g.node.id:g.edge>=0?'edge:'+g.edge:'canvas',now=performance.now();
    const double=lastTap&&lastTap.key===key&&now-lastTap.time<=doubleDelay&&Math.hypot(p.x-lastTap.x,p.y-lastTap.y)<24;
    lastTap=double?null:{key,time:now,x:p.x,y:p.y};
    if(g.node){
      selectNode(g.node);syncSelection();inspector();renderNavigation();
      if(double){if(g.rename){const label=$('#cards').querySelector('[data-node="'+g.node.id+'"] .node-title-text>span');if(label)beginNodeRename(g.node,label);}else if(definition(g.node)?.key==='function_call')enterFunction(g.node);}
    }else if(g.edge>=0)selectEdge(g.edge);
    else if(double||linkStart){const start=linkStart;lastTap=null;if(start)finishWireOnBlank(start,p.x,p.y);else openCreator(p.x,p.y);}
    else {selected=selectedEdge=null;selection.clear();syncSelection();inspector();renderNavigation();}
  };
  canvas.addEventListener('pointerdown',e=>{
    if(e.pointerType!=='touch'||!graph||editable(e.target))return;stop(e);lastDevice='touch';lastTouch=performance.now();canvas.dataset.input='touch';
    if(!points.size){
      clearWireGesture();closeCreator();closeGraphMenu();focusGraphCanvas();
      const button=touchPort(e.clientX,e.clientY),card=(button||e.target).closest('.node'),node=card&&current().nodes.find(n=>n.id===card.dataset.node);
      gesture={mode:'pending',start:{x:e.clientX,y:e.clientY},data:current(),node,canDragNode:!!card&&isNodeDragSurface(e.target,card),port:button?portInfo(button):null,rename:customNodeNamesEnabled()&&!isSourceReferenceNode(node)&&!!e.target.closest('.node-function-title,.node-function-name'),edge:edgeIndex(e.target.closest('#wires path[data-from]')),moved:false,hadPinch:false,selection:new Set(selection),selected,selectedEdge};
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
    const target=g.target&&portInfo(g.target),hit=document.elementFromPoint(p.x,p.y),drop=g.moved&&graphTrashDrop(p.x,p.y);finish();
    if(drop){clearPreview(g);commitGraphTrash(drop);wires();return;}
    if(g.mode==='edge'){clearPreview(g);wires();return;}
    if(g.mode==='node'){
      clearPreview(g);if(!editorMutationBlocked()&&current()===g.data&&g.positions.some(item=>item.x!==item.nextX||item.y!==item.nextY)){
        change(()=>{for(const item of g.positions){item.node.ui||={};item.node.ui.x=item.nextX;item.node.ui.y=item.nextY;}},{localize:false});
      }else wires();
    }else if(g.mode==='wire'){
      clearPreview(g);if(target)connectPorts(g.port,target);
      else finishWireOnBlank(g.port,p.x,p.y);wires();
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
const editableText=target=>target?.closest?.('input,textarea,select,[contenteditable="true"],dialog,.library,.details,#creator,.comment-node-preview');
function clipboardSelection(){return current().nodes.filter(n=>selection.has(n.id)&&canDeleteNode(n)).map(n=>n.id);}
function copyGraphSelection(){const text=GraphClipboard.encode(graph,current(),clipboardSelection(),clipboardSource);if(text){editorClipboard=text;pasteCount=0;renderGraphEditActions();}return text;}

function renderGraphEditActions(){
  renderHistoryActions();
  const count=graph&&selectedEdge===null?clipboardSelection().length:0;
  const edge=graph&&selectedEdge!==null&&!!current().edges[selectedEdge];
  for(const [id,key,enabled] of [
    ['graphcopy','edit.copy',count>0],
    ['graphpaste','edit.paste',graph&&!editorMutationBlocked()&&(!!editorClipboard||!!navigator.clipboard?.readText)],
    ['graphgroup','function.group',graph&&!editorMutationBlocked()&&selectedEdge===null&&current().nodes.some(n=>selection.has(n.id)&&canDeleteNode(n)&&!SubgraphSourcePolicy.isSource(n,catalog))],
    ['graphdelete',edge?'wire.disconnectSelected':'node.delete',!editorMutationBlocked()&&(count>0||edge)]
  ]){
    const button=$('#'+id);button.disabled=!enabled;button.title=t(key);button.setAttribute('aria-label',t(key));
  }
  if(typeof renderSelectionToolbar==='function')renderSelectionToolbar();
  if(typeof renderShortcutButtonHints==='function')renderShortcutButtonHints();
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
  const position=graphPoint(rect.left+rect.width/3,rect.top+rect.height/3);if(!position)return false;
  return pasteGraphFromClipboard({x:position.x+offset-pasteCount*24,y:position.y+offset-pasteCount*24});
}

function pasteGraphSelection(text,position=null){
  if(readonly||!graph)return false;
  let payload;try{payload=GraphClipboard.decode(text);}catch(e){status(t(e.clipboardCode||'clipboard.invalid'),true);return false;}
  const canvas=$('#canvas').getBoundingClientRect(),anchor=position||pastePoint||graphPoint(canvas.left+canvas.width/2,canvas.top+canvas.height/3);if(!anchor)return false;
  const changed=change(()=>{let ids;try{ids=GraphClipboard.paste(graph,current(),payload,{source:clipboardSource,stage,target:editorTarget,catalog,types:interfaceTypes(),anchor:{x:snap(anchor.x+pasteCount*24),y:snap(anchor.y+pasteCount*24)}});}catch(e){if(e.clipboardCode)e.message=t(e.clipboardCode);throw e;}assignCreatedNodeNames(current().nodes.filter(n=>ids.includes(n.id)));selection=new Set(ids);selected=ids.at(-1);selectedEdge=null;});
  if(changed){pasteCount++;status(t('clipboard.pasted'));$('#canvas').focus({preventScroll:true});}return changed;
}
function closeGraphMenu(){graphEditMenu?.remove();graphEditMenu=null;}
function graphMenuIcon(action){
  const buttonId={copy:'graphcopy',paste:'graphpaste',group:'graphgroup',delete:'graphdelete',collapse:'graphcollapseselection',expand:'graphexpandselection'}[action];
  const existing=buttonId&&document.getElementById(buttonId)?.querySelector('svg');
  if(existing)return existing.cloneNode(true);
  if(action==='duplicate'){
    const icon=document.getElementById('graphcopy').querySelector('svg').cloneNode(true);
    const plus=document.createElementNS(icon.namespaceURI,'path');plus.setAttribute('d','M11 14h6m-3-3v6');icon.append(plus);return icon;
  }
  return selectionIcon(action==='rename'?'m4 16-1 5 5-1L20 8l-4-4L4 16Zm10-10 4 4':'M12 4v16M4 12h16');
}
function openGraphMenu(x,y,nodeId=null,{touch=false}={}){
  closeGraphMenu();closeCreator();cancelConnection();
  if(nodeId&&!selection.has(nodeId)){selectNode(current().nodes.find(n=>n.id===nodeId));render();}
  const position=graphPoint(x,y);
  const menu=el('div',{id:'grapheditmenu',role:'menu','data-input':touch?'touch':'mouse','aria-label':t('edit.menu')}),count=clipboardSelection().length;
  const {nodes:collapseNodes,canCollapse,canExpand}=nodeCollapseSelectionState();
  const rows=[
    ['add',t('action.nodes'),shortcutLabel('add'),!readonly,()=>openCreator(x,y)],
    ['collapse',t('node.collapse'),'',!editorMutationBlocked()&&canCollapse,()=>setNodesCollapsed(collapseNodes.map(n=>n.id),true)],
    ['expand',t('node.expand'),'',!editorMutationBlocked()&&canExpand,()=>setNodesCollapsed(collapseNodes.map(n=>n.id),false)],
    ['copy',t('edit.copy'),shortcutLabel('copy'),count>0,copyGraphToClipboard],
    ['paste',t('edit.paste'),shortcutLabel('paste'),!readonly&&(!!editorClipboard||!!navigator.clipboard?.readText),()=>pasteGraphFromClipboard(position)],
    ['rename',t('function.rename'),'',!readonly&&count===1&&definition(current().nodes.find(n=>selection.has(n.id)))?.key==='function_call',focusFunctionName],
    ['duplicate',t('edit.duplicate'),shortcutLabel('duplicate'),!readonly&&count>0,duplicateSelection],
    ['group',t('function.group'),shortcutLabel('group'),!readonly&&count>0,groupSelection],
    ['delete',t(selectedEdge!==null?'wire.disconnectSelected':'node.delete'),shortcutLabel('delete'),!readonly&&(count>0||selectedEdge!==null),remove]
  ];
  for(const[key,label,shortcut,enabled,action]of rows){if(key==='rename'&&!enabled||['collapse','expand'].includes(key)&&!collapseNodes.length)continue;const b=el('button',{role:'menuitem','data-edit':key}),caption=el('span',{class:'graph-menu-label'});caption.append(graphMenuIcon(key),el('span',{},label.replace(/^[＋+]\s*/,'')));b.append(caption,el('small',{},shortcut));decorateShortcutButton(b,key,key==='delete'&&selectedEdge!==null?'wire.disconnectSelected':undefined);b.disabled=!enabled;b.onclick=()=>{closeGraphMenu();$('#canvas').focus({preventScroll:true});action();};menu.append(b);}
  menu.onkeydown=e=>{if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();e.stopPropagation();const items=[...menu.querySelectorAll('button:not(:disabled)')],at=items.indexOf(document.activeElement),next=e.key==='Home'?0:e.key==='End'?items.length-1:(at+(e.key==='ArrowUp'?-1:1)+items.length)%items.length;items[next]?.focus();}if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeGraphMenu();$('#canvas').focus();}};
  document.body.append(menu);graphEditMenu=menu;const uiScale=uiScaleFactor();menu.style.left=Math.max(4,Math.min(x/uiScale,innerWidth/uiScale-menu.offsetWidth-4))+'px';menu.style.top=Math.max(4,Math.min(y/uiScale,innerHeight/uiScale-menu.offsetHeight-4))+'px';menu.querySelector('button:not(:disabled)')?.focus();
}
function installGraphClipboard(){
  $('#graphcopy').onclick=copyGraphToClipboard;
  $('#graphpaste').onclick=pasteGraphFromToolbar;
  $('#graphgroup').onclick=()=>{if(!$('#graphgroup').disabled)groupSelection();};
  $('#graphdelete').onclick=()=>{if(!$('#graphdelete').disabled){$('#canvas').focus({preventScroll:true});remove();}};
  clipboardSource=shaderId||crypto.randomUUID();
  $('#canvas').addEventListener('pointermove',e=>{pastePoint=graphPoint(e.clientX,e.clientY);});
  document.addEventListener('copy',e=>{if(!graph||editableText(e.target)||window.getSelection()?.toString())return;try{const text=copyGraphSelection();if(!text||!e.clipboardData)return;e.clipboardData.setData('text/plain',text);e.preventDefault();status(t('clipboard.copied'));}catch(error){status(t(error.clipboardCode||'clipboard.invalid'),true);}});
  document.addEventListener('paste',e=>{if(!graph||readonly||editableText(e.target))return;const text=e.clipboardData?.getData('text/plain');if(!text)return;e.preventDefault();pasteGraphSelection(text);});
  document.addEventListener('pointerdown',e=>{if(graphEditMenu&&!e.target.closest('#grapheditmenu'))closeGraphMenu();});
  window.addEventListener('blur',closeGraphMenu);window.addEventListener('resize',closeGraphMenu);
}

function creatorMeta(d){
  if(['constant','spec_constant','top_input'].includes(d.inputKind||d.key)){const branch=({constant:'constants',spec_constant:'specConstants',top_input:'topInputs'})[d.inputKind||d.key];return {...browserMeta(d),category:'inputs',path:['inputs',branch],secondary:[],descriptionKey:'help.'+(d.inputKind||d.key)};}
  const meta=browserMeta(d),kind=inputSourceKind(d);
  return kind?{...meta,category:'inputs',path:['inputs',kind==='uniform'?'uniforms':'samplers'],secondary:[]}:meta;
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
    const order=level?['uniforms','samplers','arithmetic','interpolation','range','trigonometry','exponential']:creatorState.wire?['vector','math','inputs',...browserData().categories]:['inputs',...browserData().categories];
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
  const entry={d:match.d,meta:creatorMeta(match.d)},meta=entry.meta;
  box.append(el('strong',{},match.d.label),el('small',{class:'muted'},browserBadges(entry)),el('p',{class:'browser-category-path'},meta.path.map((key,i)=>i?(t('browser.branch.'+key)==='browser.branch.'+key?key:t('browser.branch.'+key)):browserCategoryLabel(key)).join(' › ')));
  const variant=match.variant||typeVariants(match.d).find(v=>v.type===match.type)||typeVariants(match.d)[0];
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
