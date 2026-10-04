// Canvas DOM is a projection, never a second graph owner. Keep unchanged cards
// within one working network; replaced model objects must get fresh handlers.
const CanvasUpdate=(()=>{
  let network=null,container=null;
  let pending=null,publication=0,load=-1;
  const entries=new Map();
  function publish(changes,{version,generation}){
    const scope=graphTrail.length?'function:'+graphTrail.at(-1):stage;
    const discontinuity=generation!==load||version!==publication+1;
    publication=version;load=generation;
    if(!pending||pending.scope!==scope||pending.network!==current())pending={scope,network:current(),full:discontinuity,affected:new Set()};
    pending.full||=discontinuity||changes.global.length>0;
    const local=changes.networks.find(n=>n.id===scope);if(!local)return;
    pending.full||=!local.complete||local.metadata;
    for(const n of local.nodes)pending.affected.add(n.id);
    for(const id of [...local.added,...local.removed])pending.affected.add(id);
    for(const edge of local.edges)for(const endpoints of [edge.before,edge.after])if(endpoints){pending.affected.add(endpoints.from[0]);pending.affected.add(endpoints.to[0]);}
    for(const p of local.ports){
      pending.affected.add(p.node);
      if(p.direction==='output')for(const e of current().edges)if(e.from[0]===p.node&&e.from[1]===p.key)pending.affected.add(e.to[0]);
    }
  }
  function contextKey(){
    const {stages,functions,catalogSnapshot,...metadata}=graph;
    return JSON.stringify([metadata,current().nodes.every(n=>frontendNodeModule(graph,n))?null:(functions||[]).map(({graph,...definition})=>definition),
      catalog,typeContract,editorTarget,stage,language,readonly,editorLoadGeneration,
      EDITOR_DEV_SETTINGS,uiAppearance,customNodeNamesEnabled()]);
  }
  function signature(node,incident,resolved){
    const {ui,params,...content}=node,{x,y,...appearance}=ui||{};
    // Materializing an implicit overload is not a visual change. Its effective
    // operand types are represented by the resolved ports below.
    const {operandTypes,...values}=params||{};
    const module=frontendNodeModule(graph,node),reference=module?.referencedGraph?.(node);
    const f=reference?FunctionModel.find(graph,reference):module?.structural?currentFunction():null;
    const interfaceState=f?[f.name,f.inputs,f.outputs,f.scope]:null;
    return JSON.stringify([content,values,appearance,resolved,incident,interfaceState]);
  }
  function updateCards({only=null}={}){
    applyGraphUISettings();
    // Deferral belongs to the card being edited, not the entire canvas. Existing
    // draft guards cancel edits when their model owner/source has changed.
    const commentHeld=deferCommentNodeEditor(true),inlineHeld=deferInlineValueRender();
    const protectedCard=commentHeld?document.activeElement.closest('#cards .node'):
      inlineHeld?inlineValueEdit.entry.closest('#cards .node'):null;
    touchGraphGesture?.cancel();nodeDragGesture?.cancel();nodeResizeGesture?.cancel();clearWireGesture();clearGraphTrash();
    const cards=$('#cards'),data=current(),context=contextKey(),ids=new Set(data.nodes.map(n=>n.id));
    const scoped=pending&&pending.network===data&&!pending.full&&network===data&&container===cards&&[...entries.values()].every(e=>e.context===context);
    const affected=scoped?new Set([...pending.affected,...(only||[])]):null;
    if(network!==data||container!==cards){
      cards.replaceChildren();entries.clear();network=data;container=cards;
    }
    selection=new Set([...selection].filter(id=>ids.has(id)));
    if(selected&&!ids.has(selected))selected=null;
    for(const [id,entry] of entries)if(!ids.has(id)){entry.card.remove();entries.delete(id);}
    // Index once per publication. Allocating an Edge ID does not change a card.
    const incident=new Map(data.nodes.filter(n=>!affected||affected.has(n.id)||!entries.has(n.id)).map(n=>[n.id,[]]));
    const resolved=new Map(data.nodes.map(n=>[n.id,affected&&!affected.has(n.id)&&entries.get(n.id)?.resolved||{inputs:ports(n,'inputs'),outputs:ports(n,'outputs')}]));
    for(const {id,...edge} of data.edges){
      incident.get(edge.from[0])?.push(edge);
      // A source type can change without changing the edge or receiver type.
      // The receiving card must still refresh its conversion caption.
      incident.get(edge.to[0])?.push([edge,resolved.get(edge.from[0])?.outputs[edge.from[1]]]);
    }
    const declarations=new Map(graph.declarations.map(d=>[d.id,d]));
    let previous=null;
    for(const node of data.nodes){
      let entry=entries.get(node.id);
      const key=affected&&!affected.has(node.id)&&entry?.node===node&&entry.key!==null?entry.key:signature(node,incident.get(node.id),resolved.get(node.id));
      const stale=!entry||entry.node!==node||entry.card.parentNode!==cards||entry.context!==context||entry.key!==key||only?.has(node.id);
      const held=entry?.card===protectedCard&&entry.node===node;
      if(stale&&!held){
        const card=renderNodeCard(node,cards,declarations);
        if(entry?.card.parentNode===cards)entry.card.replaceWith(card);
        entry={node,card,key,context,resolved:resolved.get(node.id)};entries.set(node.id,entry);
      }
      const card=entry.card;
      // Avoid moving retained DOM: even a needless reinsert can discard focus.
      const next=previous?previous.nextElementSibling:cards.firstElementChild;
      if(next!==card)cards.insertBefore(card,next);
      const left=(node.ui?.x||0)+'px',top=(node.ui?.y||0)+'px';
      if(card.style.left!==left)card.style.left=left;
      if(card.style.top!==top)card.style.top=top;
      card.classList.toggle('selected',selection.has(node.id));
      card.classList.toggle('error',nodeHasCompileError(node.id));
      previous=card;
    }
    pending=null;
    load=editorLoadGeneration;publication=graphPublicationVersion;
  }
  function update(){
    updateCards();
    // These projections still publish in full. Keeping their handlers current
    // is separate from retaining card DOM and does not change compiler work.
    renderGroupFrames();wires();
  }
  function invalidateChangedNodes(before,changes=null){
    // Inline/comment controls can update their own DOM with redraw:false.
    // Remember that divergence even if Undo later restores the old cache key.
    if(changes){
      const scope=graphTrail.length?'function:'+graphTrail.at(-1):stage;
      for(const node of changes.networks.find(n=>n.id===scope)?.nodes||[]){const entry=entries.get(node.id);if(entry)entry.key=null;}
      return;
    }
    const previous=FunctionModel.find(before,graphTrail.at(-1))?.graph||before.stages[stage];
    const nodes=new Map((previous?.nodes||[]).map(n=>[n.id,n]));
    for(const node of current().nodes)if(JSON.stringify(nodes.get(node.id))!==JSON.stringify(node)){
      const entry=entries.get(node.id);if(entry)entry.key=null;
    }
  }
  return {update,updateCards,invalidateChangedNodes,publish};
})();
