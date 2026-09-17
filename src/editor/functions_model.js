// Local-network HTTP pages may not expose randomUUID (a secure-context API).
// getRandomValues remains available; IDs retain UUID v4 entropy and format.
if(!crypto.randomUUID){crypto.randomUUID=()=>{
  const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
  const hex=Array.from(bytes,value=>value.toString(16).padStart(2,'0')).join('');
  return hex.slice(0,8)+'-'+hex.slice(8,12)+'-'+hex.slice(12,16)+'-'+hex.slice(16,20)+'-'+hex.slice(20);
};}
/* Pure graph operations, shared by the editor and model tests. */
const FunctionModel=(()=>{
  const CALL='sgrape.function.call',INPUT='sgrape.function.input',OUTPUT='sgrape.function.output';
  const copy=x=>JSON.parse(JSON.stringify(x));
  const uid=()=> 'fn_'+crypto.randomUUID().replaceAll('-','').slice(0,12);
  const find=(graph,id)=>(graph.functions||[]).find(f=>f.id===id);
  function ensureCapacity(graph,additional=0){
    if((graph.functions||[]).length+additional>64){const error=Error('At most 64 Function definitions are supported');error.code='function.limit';throw error;}
  }
  function allGraphs(graph){return [...Object.values(graph.stages),...(graph.functions||[]).filter(f=>f.scope==='local').map(f=>f.graph)];}
  function localize(graph,id){
    const target=find(graph,id);if(!target||target.scope==='local')return new Map();
    // Localize library callers too, so nested edits never rewrite a source snapshot.
    const affected=new Set([id]);let added=true;
    while(added){added=false;for(const f of graph.functions||[]){
      if(f.scope==='local'||affected.has(f.id))continue;
      if(f.graph.nodes.some(n=>n.definitionUuid===CALL&&affected.has(n.params.functionId))){affected.add(f.id);added=true;}
    }}
    ensureCapacity(graph,affected.size);
    const mapping=new Map();
    for(const old of affected){
      const f=find(graph,old),snapshot=copy(f),newId=uid();
      // Keep the edited object alive for pending input callbacks.
      f.id=newId;f.scope='local';f.origin=f.source||f.origin;delete f.source;
      graph.functions.push(snapshot);mapping.set(old,newId);
    }
    for(const data of allGraphs(graph))for(const n of data.nodes){
      if(n.definitionUuid===CALL&&mapping.has(n.params.functionId))n.params.functionId=mapping.get(n.params.functionId);
    }
    return mapping;
  }
  function importLibrary(graph,source){
    graph.functions||=[];
    const existing=graph.functions.find(f=>f.scope===source.scope&&f.source?.id===source.source?.id&&f.source?.version===source.source?.version);
    if(existing)return existing;
    const bundle=[source,...(source.dependencies||[])],mapping=new Map(),pending=[];
    const occupied=new Set(graph.functions.map(f=>f.id));
    for(const item of bundle){
      if(mapping.has(item.id))throw Error('Duplicate Function in library snapshot');
      const reused=graph.functions.find(f=>f.scope===item.scope&&f.source?.id===item.source?.id&&f.source?.version===item.source?.version);
      if(reused){mapping.set(item.id,reused.id);continue;}
      const imported=copy(item);delete imported.dependencies;
      if(occupied.has(imported.id))imported.id=uid();occupied.add(imported.id);
      mapping.set(item.id,imported.id);pending.push(imported);
    }
    ensureCapacity(graph,pending.length);
    for(const item of pending)for(const node of item.graph.nodes){
      if(node.definitionUuid!==CALL)continue;
      const mapped=mapping.get(node.params.functionId);
      // Older built-in callers can reference a snapshot already in this Shader.
      if(!mapped&&!find(graph,node.params.functionId))throw Error('Missing nested Function in library snapshot');
      if(mapped)node.params.functionId=mapped;
    }
    graph.functions.push(...pending);return find(graph,mapping.get(source.id));
  }
  function independent(graph,node){
    const source=find(graph,node.params.functionId);if(!source)return null;
    ensureCapacity(graph,1);
    const f=copy(source);f.id=uid();f.name+=' Copy';f.scope='local';f.origin=f.source||f.origin;delete f.source;
    graph.functions.push(f);node.params.functionId=f.id;return f;
  }
  return {CALL,INPUT,OUTPUT,uid,find,localize,importLibrary,independent,ensureCapacity};
})();
if(typeof module!=='undefined')module.exports=FunctionModel;

/* Portable selection snapshots contain graph data only, never editor credentials. */
const GraphClipboard=(()=>{
  const FORMAT='td-sgrape.selection',LIMIT=512000,copy=v=>JSON.parse(JSON.stringify(v));
  const fail=code=>{throw Object.assign(Error(code),{clipboardCode:code});};
  const id=()=> 'n'+crypto.randomUUID().replaceAll('-','').slice(0,12);
  const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
  const validId=v=>typeof v==='string'&&/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(v);
  function encode(graph,data,ids,source){
    const chosen=new Set(ids),nodes=data.nodes.filter(n=>chosen.has(n.id));if(!nodes.length)return null;
    const functions=[],declarations=[],topInputs=[],seenFunctions=new Set(),seenDeclarations=new Set();
    function scan(nodes){for(const n of nodes){
      if(n.params?.inputId&&!topInputs.some(s=>s.id===n.params.inputId)){const slot=graph.topInputs?.find(s=>s.id===n.params.inputId);if(!slot)fail('clipboard.missing');topInputs.push(copy(slot));}
      const declaration=n.params?.declarationId;if(declaration&&!seenDeclarations.has(declaration)){const d=graph.declarations.find(d=>d.id===declaration);if(!d)fail('clipboard.missing');seenDeclarations.add(declaration);declarations.push(copy(d));}
      if(n.definitionUuid===FunctionModel.CALL){const ident=n.params.functionId;if(seenFunctions.has(ident))continue;const f=FunctionModel.find(graph,ident);if(!f)fail('clipboard.missing');seenFunctions.add(ident);functions.push(copy(f));scan(f.graph.nodes);}
    }}
    scan(nodes);const result={format:FORMAT,version:1,source,nodes:copy(nodes),edges:copy(data.edges.filter(e=>chosen.has(e.from[0])&&chosen.has(e.to[0]))),functions,declarations,topInputs};
    const text=JSON.stringify(result);if(new TextEncoder().encode(text).length>LIMIT)fail('clipboard.size');return text;
  }
  function decode(text){
    if(typeof text!=='string'||text.length>LIMIT||new TextEncoder().encode(text).length>LIMIT)fail('clipboard.size');
    let p;try{p=JSON.parse(text);}catch{fail('clipboard.invalid');}
    if(p?.format!==FORMAT||p.version!==1)fail('clipboard.invalid');
    for(const key of ['nodes','edges','functions','declarations'])if(!Array.isArray(p[key]))fail('clipboard.invalid');
    if(!p.nodes.length||p.nodes.length>2048||p.edges.length>8192||p.functions.length>64)fail('clipboard.size');
    return p;
  }
  function paste(graph,data,p,{source,stage,target,catalog,types,anchor}){
    const same=p.source===source,defs=new Map(catalog.map(d=>[d.definitionUuid,d])),functionMap=new Map(),declarationMap=new Map();
    function unique(items){const map=new Map();for(const item of items){if(!object(item)||!validId(item.id)||map.has(item.id))fail('clipboard.invalid');map.set(item.id,item);}return map;}
    const sourceFunctions=unique(p.functions),sourceDeclarations=unique(p.declarations);
    const topMap=new Map(),newSlots=[];
    if(p.topInputs?.length){if(target!=='top')fail('clipboard.stage');for(const [key,slot]of unique(p.topInputs)){if(typeof slot.name!=='string'||!slot.name.length||slot.name.length>48||typeof slot.defaultSource!=='string')fail('clipboard.invalid');const existing=graph.topInputs?.find(s=>same?s.id===key:s.origin?.shader===p.source&&s.origin?.id===key);if(existing)topMap.set(key,existing.id);else {const next={...copy(slot),id:id(),origin:{shader:p.source,id:key}};delete next.legacyKeys;topMap.set(key,next.id);newSlots.push(next);}}}
    const newFunctions=[],newDeclarations=[],names=new Set(graph.declarations.map(d=>d.name));
    for(const [key,d]of sourceDeclarations){
      if(graph.topSourceVersion===1&&d.kind==='sampler')fail('clipboard.stage');
      if(same&&graph.declarations.some(x=>x.id===key)){declarationMap.set(key,key);continue;}
      if(!['uniform','sampler','constant','spec_constant'].includes(d.kind)||!types.includes(d.type)&&d.type!=='sampler2D'&&!(['int','uint','bool'].includes(d.type)&&d.kind==='spec_constant')||typeof d.name!=='string'||!/^[A-Za-z][A-Za-z0-9_]{0,47}$/.test(d.name))fail('clipboard.invalid');
      const number=v=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=1e20;
      const source=v=>typeof v==='string'&&v.length<=2048&&!/[\x00-\x1f]/.test(v)&&(v==='input:0'||['builtin:banana','builtin:white','builtin:black','builtin:jellybeans'].includes(v)||v.startsWith('op:/'));
      if(['uniform','constant'].includes(d.kind)){const count=d.type==='float'?1:Number(d.type.slice(-1));if(count===1?!number(d.value):!Array.isArray(d.value)||d.value.length!==count||!d.value.every(number))fail('clipboard.invalid');}
      if(d.kind==='spec_constant'&&(!['int','uint','bool','float'].includes(d.type)||!Number.isInteger(d.constantId)||d.constantId<0||(d.type==='bool'?typeof d.value!=='boolean':!number(d.value)||(d.type!=='float'&&(!Number.isInteger(d.value)||d.value<(d.type==='uint'?0:-2147483648)||d.value>(d.type==='uint'?4294967295:2147483647))))))fail('clipboard.invalid');
      if(d.kind==='sampler'&&(!source(d.source)||d.defaultSource!==undefined&&!source(d.defaultSource)))fail('clipboard.invalid');
      const next=copy(d);next.id=id();let name=d.name,index=1;while(names.has(name))name=d.name.slice(0,36)+'_copy'+index++;next.name=name;names.add(name);
      if(next.kind==='sampler'&&next.source==='input:0'){
        if(target!=='top'){next.source=next.defaultSource||'builtin:banana';delete next.defaultSource;}
        else{const existing=[...graph.declarations,...newDeclarations].find(d=>d.kind==='sampler'&&d.source==='input:0');if(existing)for(const field of ['defaultSource','expose','exposeName']){delete next[field];if(Object.hasOwn(existing,field))next[field]=copy(existing[field]);}}
      }
      if(next.kind==='spec_constant'){const ids=new Set([...graph.declarations,...newDeclarations].filter(d=>d.kind==='spec_constant').map(d=>d.constantId));let constantId=0;while(ids.has(constantId))constantId++;next.constantId=constantId;}
      declarationMap.set(key,next.id);newDeclarations.push(next);
    }
    for(const [key,f]of sourceFunctions){
      if(same&&FunctionModel.find(graph,key)){functionMap.set(key,key);continue;}
      const next=copy(f);next.id=FunctionModel.uid();next.scope='local';next.origin=next.source||next.origin;delete next.source;delete next.dependencies;
      if(typeof next.name!=='string'||!next.name.length||next.name.length>80||!Array.isArray(next.stages)||!next.stages.includes(stage))fail('clipboard.stage');
      for(const direction of ['inputs','outputs']){if(!Array.isArray(next[direction])||next[direction].length>16)fail('clipboard.invalid');unique(next[direction]);for(const port of next[direction])if(!types.includes(port.type))fail('clipboard.invalid');}
      functionMap.set(key,next.id);newFunctions.push(next);
    }
    function nodesAndEdges(content,boundary=false){
      if(!object(content)||!Array.isArray(content.nodes)||!Array.isArray(content.edges)||content.nodes.length>256||content.edges.length>1024)fail('clipboard.invalid');
      const nodes=unique(content.nodes);
      for(const node of nodes.values()){
        if(!object(node.params)||!object(node.ui)||![node.ui.x,node.ui.y].every(Number.isFinite))fail('clipboard.invalid');
        if(node.definitionUuid===FunctionModel.CALL){const key=node.params.functionId;if(!functionMap.has(key))fail('clipboard.missing');node.params.functionId=functionMap.get(key);}
        else if([FunctionModel.INPUT,FunctionModel.OUTPUT].includes(node.definitionUuid)){if(!boundary)fail('clipboard.boundary');}
        else{const d=defs.get(node.definitionUuid);if(!d)fail('clipboard.missing');if(!d.stages.includes(stage))fail('clipboard.stage');if(d.key.endsWith('_out'))fail('clipboard.boundary');if(node.revisionHash&&node.revisionHash!==d.revisionHash)fail('clipboard.revision');}
        if(node.params.inputId){if(!topMap.has(node.params.inputId))fail('clipboard.missing');node.params.inputId=topMap.get(node.params.inputId);}
        if(node.params.declarationId){if(!declarationMap.has(node.params.declarationId))fail('clipboard.missing');node.params.declarationId=declarationMap.get(node.params.declarationId);}
      }
      const edges=new Set();for(const edge of content.edges){if(!object(edge)||!Array.isArray(edge.from)||!Array.isArray(edge.to)||edge.from.length!==2||edge.to.length!==2||!nodes.has(edge.from[0])||!nodes.has(edge.to[0])||!validId(edge.from[1])||!validId(edge.to[1]))fail('clipboard.invalid');const key=JSON.stringify(edge.to);if(edges.has(key))fail('clipboard.invalid');edges.add(key);}
    }
    for(const f of newFunctions)nodesAndEdges(f.graph,true);
    const content={nodes:copy(p.nodes),edges:copy(p.edges)};nodesAndEdges(content);
    if(data.nodes.length+content.nodes.length>256||data.edges.length+content.edges.length>1024)fail('clipboard.size');
    FunctionModel.ensureCapacity(graph,newFunctions.length);
    if(newSlots.length){if(!graph.topInputs){const legacy=graph.declarations.find(d=>d.source==='input:0');graph.topInputs=[{id:'input0',name:'Input 0',defaultSource:legacy?.defaultSource||'builtin:banana',matchDefault:!!legacy?.defaultSource}];}if(graph.topInputs.length+newSlots.length>16)fail('clipboard.size');if(graph.declarations.some(d=>d.source==='input:0'))graph.topInputLegacyId||=graph.topInputs[0].id;graph.topInputs.push(...newSlots);}
    graph.functions||=[];graph.functions.push(...newFunctions);graph.declarations.push(...newDeclarations);
    const remap=new Map(content.nodes.map(n=>[n.id,id()])),x=Math.min(...content.nodes.map(n=>n.ui.x)),y=Math.min(...content.nodes.map(n=>n.ui.y));
    for(const node of content.nodes){node.id=remap.get(node.id);node.ui={...node.ui,x:node.ui.x-x+anchor.x,y:node.ui.y-y+anchor.y};data.nodes.push(node);}
    for(const edge of content.edges)data.edges.push({from:[remap.get(edge.from[0]),edge.from[1]],to:[remap.get(edge.to[0]),edge.to[1]]});
    // Reject recursive function pastes as one failed transaction, including into itself.
    const seen=new Set(),active=new Set();function visit(key){if(active.has(key))fail('clipboard.cycle');if(seen.has(key))return;const f=FunctionModel.find(graph,key);if(!f)fail('clipboard.missing');if(!f.stages.includes(stage))fail('clipboard.stage');active.add(key);for(const n of f.graph.nodes)if(n.definitionUuid===FunctionModel.CALL)visit(n.params.functionId);active.delete(key);seen.add(key);}
    for(const n of data.nodes)if(n.definitionUuid===FunctionModel.CALL)visit(n.params.functionId);
    if(new TextEncoder().encode(JSON.stringify(graph)).length>LIMIT)fail('clipboard.size');
    return content.nodes.map(n=>n.id);
  }
  return {encode,decode,paste};
})();

/* Source placement is an editing policy, separate from Function expansion. */
const SubgraphSourcePolicy=(()=>{
  const outside=new Set(['uniform','sampler','constant','spec_constant','top_input','attribute','attributes','buffer']);
  function isSource(node,catalog){return outside.has(catalog.find(d=>d.definitionUuid===node.definitionUuid)?.key);}
  function inputName(document,node,port,fallback){
    const source=document.declarations.find(d=>d.id===node?.params?.declarationId);
    return source?.name||document.topInputs?.find(s=>s.id===node?.params?.inputId)?.name||fallback||port;
  }
  return {isSource,inputName};
})();
