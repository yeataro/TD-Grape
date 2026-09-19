/* Selection actions share the existing buttons and graph transactions. */
const ARRANGE_ACTIONS=[
  ['auto','M3 9h5v6H3zM16 3h5v6h-5zM16 15h5v6h-5zM8 12h4M12 6v12M12 6h4M12 18h4'],
  ['autoReverse','M3 3h5v6H3zM3 15h5v6H3zM16 9h5v6h-5zM8 6h4M8 18h4M12 6v12M12 12h4'],
  ['left','M4 3v18M8 6h12v4H8zM8 14h8v4H8z'],
  ['centerX','M12 2v20M4 6h16v4H4zM7 14h10v4H7z'],
  ['right','M20 3v18M4 6h12v4H4zM8 14h8v4H8z'],
  ['top','M3 4h18M6 8h4v12H6zM14 8h4v8h-4z'],
  ['centerY','M2 12h20M6 4h4v16H6zM14 7h4v10h-4z'],
  ['bottom','M3 20h18M6 4h4v12H6zM14 8h4v8h-4z'],
  ['spaceX','M3 3v18M21 3v18M7 6h3v12H7zM14 6h3v12h-3z'],
  ['spaceY','M3 3h18M3 21h18M6 7h12v3H6zM6 14h12v3H6z'],
  ['grid','M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z']
];
let selectionToolbarFrame=0,selectionToolbarHover=false,selectionBoundsHover=false,selectionSpreadActive=false,arrangeContext=null;
function selectionIcon(path){
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('class','ui-icon');svg.setAttribute('aria-hidden','true');
  const shape=document.createElementNS(svg.namespaceURI,'path');shape.setAttribute('d',path);svg.append(shape);return svg;
}
function selectedCanvasNodes(){return graph&&selectedEdge===null?current().nodes.filter(n=>selection.has(n.id)):[];}
function fitSelection(){const nodes=selectedCanvasNodes();if(nodes.length)fitNodes(nodes,true);else fit(true);}
function selectedCanvasBounds(){
  const rects=selectedCanvasNodes().map(n=>$('#cards').querySelector(`[data-node="${CSS.escape(n.id)}"]`)?.getBoundingClientRect()).filter(Boolean);
  for(const frame of completeGroupFrames(selectedCanvasNodes())){const rect=$('#groupframes')?.querySelector(`[data-frame="${CSS.escape(frame.id)}"]`)?.getBoundingClientRect();if(rect)rects.push(rect);}
  if(!rects.length)return null;
  return {left:Math.min(...rects.map(r=>r.left)),top:Math.min(...rects.map(r=>r.top)),right:Math.max(...rects.map(r=>r.right)),bottom:Math.max(...rects.map(r=>r.bottom))};
}
function closeArrangeMenu(){
  const menu=$('#arrangemenu');if(menu?.matches(':popover-open'))menu.hidePopover();
  arrangeContext=null;$('#grapharrange')?.setAttribute('aria-expanded','false');scheduleSelectionToolbarPosition();
}
function arrangeContextMatches(){
  return !arrangeContext||(arrangeContext.owner===graph&&arrangeContext.level===current()&&arrangeContext.ids.join('\0')===selectedCanvasNodes().map(n=>n.id).join('\0'));
}
function renderSelectionToolbar(){
  const bar=$('#selectiontoolbar'),top=$('.toolbar .graph-tools');if(!bar||!top)return;
  const edit=document.querySelector('[data-tool-group="edit"]'),multi=document.querySelector('[data-tool-group="selection"]');
  const mode=EDITOR_DEV_SETTINGS.selectionToolbar||'off',nodes=selectedCanvasNodes(),multiple=nodes.length>1;
  const move=(element,host,before=null)=>{if(element.parentElement!==host&&!(host===top&&element.parentElement.id==='graphmoremenu')){host.insertBefore(element,before);if(host===bar)element.querySelectorAll('button').forEach(b=>{b.removeAttribute('role');b.removeAttribute('aria-checked');});}};
  const view=top.querySelector('[data-tool-group="view"]');
  move(edit,mode==='all'?bar:top,mode==='all'?bar.firstChild:view);
  move(multi,mode==='off'?top:bar,mode==='off'?view:null);
  edit.hidden=mode!=='all'&&EDITOR_DEV_SETTINGS.editToolbar===false;
  multi.hidden=!nodes.length;
  $('#graphgroup').hidden=!multiple;$('#grapharrange').hidden=!multiple;$('#graphframe').hidden=!multiple;
  const joinTarget=groupFrameJoinTarget(),joinButton=$('#graphjoinframe');
  joinButton.hidden=!joinTarget;joinButton.disabled=editorMutationBlocked();
  joinButton.dataset.shortcutContext=joinTarget?.name||'';decorateShortcutButton(joinButton,'joinFrame');
  $('#graphdetachframe').hidden=!canDetachGroupFrameSelection();
  $('#graphdetachframe').disabled=editorMutationBlocked();
  decorateShortcutButton($('#graphdetachframe'),'detachFrame');
  $('#graphframe').disabled=editorMutationBlocked()||!canCreateGroupFrame();
  decorateShortcutButton($('#graphframe'),'groupFrame',canCreateGroupFrame()?'frame.create':'frame.unframedOnly');
  $('#grapharrange').disabled=!multiple||editorMutationBlocked();
  $('#graphfitselection').disabled=!nodes.length;
  const collapseState=nodeCollapseSelectionState();
  for(const [action,available]of [['collapse',collapseState.canCollapse],['expand',collapseState.canExpand]]){
    const button=$('#graph'+action+'selection'),label=t('selection.'+action);
    button.hidden=!EDITOR_DEV_SETTINGS.selectionCollapseTools||!available;
    button.disabled=editorMutationBlocked()||!available;button.title=label;button.setAttribute('aria-label',label);
  }
  $('#graphcollapseseparator').hidden=!EDITOR_DEV_SETTINGS.selectionCollapseTools||!(collapseState.canCollapse||collapseState.canExpand);
  bar.hidden=mode==='off'||!nodes.length||(mode==='multiple'&&!multiple);
  bar.setAttribute('aria-label',t('selection.toolbar'));edit.setAttribute('aria-label',t('selection.editTools'));multi.setAttribute('aria-label',t('selection.nodeTools'));
  $('#grapharrange').title=t('arrange.title');$('#grapharrange').setAttribute('aria-label',t('arrange.title'));
  decorateShortcutButton($('#graphfitselection'),'fitSelection');
  if(!arrangeContextMatches()||editorMutationBlocked()||!multiple)closeArrangeMenu();
  if(bar.hidden)selectionToolbarHover=selectionBoundsHover=false;
  scheduleSelectionToolbarPosition();
  scheduleGraphToolbarOverflow();
}
function scheduleSelectionToolbarPosition(){
  if(!$('#selectiontoolbar')||selectionToolbarFrame)return;
  selectionToolbarFrame=requestAnimationFrame(()=>{selectionToolbarFrame=0;positionSelectionToolbar();});
}
function positionSelectionToolbar(){
  const bar=$('#selectiontoolbar'),outline=$('#selectionbounds');if(!bar||!outline)return;
  const nodes=selectedCanvasNodes(),persistent=EDITOR_DEV_SETTINGS.persistentSelectionBounds&&nodes.length>1;
  if(bar.hidden&&!persistent){outline.hidden=true;return;}
  const bounds=selectedCanvasBounds(),canvas=$('#canvas'),r=canvas.getBoundingClientRect(),zoom=uiScaleFactor();
  if(!bounds||bounds.right<r.left||bounds.left>r.right||bounds.bottom<r.top||bounds.top>r.bottom){bar.style.visibility='hidden';outline.hidden=true;return;}
  bar.style.visibility='';
  const gap=6,frame=completeGroupFrames(nodes).find(item=>item.nodes.length===nodes.length);
  outline.hidden=!!(EDITOR_DEV_SETTINGS.hideGroupedSelectionBounds&&frame)||!(persistent||!bar.hidden&&(selectionToolbarHover||selectionBoundsHover||selectionSpreadActive||bar.querySelector(':focus-visible')||$('#arrangemenu').matches(':popover-open')));
  for(const handle of outline.children){handle.hidden=nodes.length<2||editorMutationBlocked();handle.title=t('selection.spread');handle.setAttribute('aria-label',handle.title);}
  outline.style.left=(bounds.left-r.left)/zoom-gap+'px';outline.style.top=(bounds.top-r.top)/zoom-gap+'px';
  outline.style.width=(bounds.right-bounds.left)/zoom+gap*2+'px';outline.style.height=(bounds.bottom-bounds.top)/zoom+gap*2+'px';
  if(bar.hidden)return;
  const margin=8,w=canvas.clientWidth,h=canvas.clientHeight,toolbar=$('#canvas>.toolbar'),tools=$('.canvas-view-tools');
  const top=toolbar?(toolbar.getBoundingClientRect().bottom-r.top)/zoom+margin:margin;
  const bottom=tools?(tools.getBoundingClientRect().top-r.top)/zoom-margin:h-margin;
  bar.style.maxWidth=Math.max(40,w-margin*2)+'px';
  bar.style.maxHeight=Math.max(40,bottom-top)+'px';
  const x=Math.max(margin,Math.min(((bounds.left+bounds.right)/2-r.left)/zoom-bar.offsetWidth/2,w-bar.offsetWidth-margin));
  const above=(bounds.top-r.top)/zoom-bar.offsetHeight-12,below=(bounds.bottom-r.top)/zoom+12;
  const fits=y=>y>=top&&y+bar.offsetHeight<=bottom;
  const preferred=fits(above)?above:fits(below)?below:above;
  const y=Math.max(top,Math.min(preferred,bottom-bar.offsetHeight));
  bar.style.left=x+'px';bar.style.top=y+'px';
}
// Scale center distances, then translate to keep the opposite outside edge fixed.
// Solving against actual widths/heights keeps differently sized nodes unchanged.
function selectionSpreadPositions(items,handle,dx,dy){
  const axes=[['x','width',handle.includes('w')?-1:handle.includes('e')?1:0,dx],['y','height',handle.includes('n')?-1:handle.includes('s')?1:0,dy]];
  const factors=axes.map(([axis,size,direction,delta])=>{
    if(!direction)return 1;
    const centers=items.map(n=>n[axis]+n[size]/2),span=Math.max(...items.map(n=>n[axis]+n[size]))-Math.min(...items.map(n=>n[axis]));
    const target=Math.max(Math.max(...items.map(n=>n[size])),span+direction*delta);let factor=Infinity,initialFactor=Infinity;
    for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){
      const distance=Math.abs(centers[i]-centers[j]);
      if(distance>1e-6){
        const half=(items[i][size]+items[j][size])/2;
        factor=Math.min(factor,(target-half)/distance);initialFactor=Math.min(initialFactor,(span-half)/distance);
      }
    }
    // A wide node may enclose every other node along this axis. Its outer
    // bounds then stay constant initially; use center spread to avoid jumping
    // straight to the point where another node escapes that enclosing width.
    if(Number.isFinite(initialFactor)&&initialFactor>1+1e-6)return Math.max(0,1+direction*delta/(Math.max(...centers)-Math.min(...centers)));
    return Number.isFinite(factor)?Math.max(0,factor):1;
  });
  // Stop at the first new collision on the drag path. Existing overlaps do not
  // lock the selection; they may be spread apart normally. Preserve up to 8px
  // of an existing gap instead of introducing touching edges while contracting.
  let travel=1;
  for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){
    const a=items[i],b=items[j],distances=axes.map(([axis,size])=>Math.abs(a[axis]+a[size]/2-b[axis]-b[size]/2));
    const sizes=axes.map(([,size])=>(a[size]+b[size])/2);
    if(distances.every((distance,k)=>distance<sizes[k]-1e-6))continue;
    let enter=0,leave=1;
    for(let k=0;k<2;k++){
      const distance=distances[k],limit=sizes[k]+Math.min(8,Math.max(0,distance-sizes[k]));
      if(distance<1e-6)continue;
      const start=distance-limit,velocity=distance*(factors[k]-1);
      if(Math.abs(velocity)<1e-9){if(start>=-1e-6)leave=-1;}
      else if(velocity<0)enter=Math.max(enter,-start/velocity);
      else leave=Math.min(leave,-start/velocity);
    }
    if(enter<leave-1e-8)travel=Math.min(travel,Math.max(0,enter));
  }
  const result=new Map(items.map(n=>[n.id,{x:n.x,y:n.y}]));
  axes.forEach(([axis,size,direction],k)=>{
    if(!direction)return;
    const factor=1+(factors[k]-1)*travel;
    const values=items.map(n=>(n[axis]+n[size]/2)*factor-n[size]/2);
    const edge=direction>0?Math.min(...items.map(n=>n[axis])):Math.max(...items.map(n=>n[axis]+n[size]));
    const nextEdge=direction>0?Math.min(...values):Math.max(...values.map((value,i)=>value+items[i][size]));
    items.forEach((n,i)=>result.get(n.id)[axis]=values[i]+edge-nextEdge);
  });
  return result;
}
function dragSelectionSpread(event,handle){
  event.preventDefault();event.stopPropagation();
  const nodes=selectedCanvasNodes();if(event.button!==0||editorMutationBlocked()||nodes.length<2||$('#selectionbounds').hidden)return;
  nodeResizeGesture?.cancel();nodeDragGesture?.cancel();touchGraphGesture?.cancel();clearWireGesture();closeCreator();closeArrangeMenu();focusGraphCanvas();
  const owner=graph,data=current(),zoom=scale*uiScaleFactor(),originPan={...pan},start={x:event.clientX,y:event.clientY};
  const items=nodes.map(node=>({node,card:$('#cards').querySelector(`[data-node="${CSS.escape(node.id)}"]`),id:node.id,...nodeLayoutBounds(node)}));
  if(items.some(item=>!item.card))return;
  let positions=new Map(items.map(n=>[n.id,{x:n.x,y:n.y}])),moved=false,closed=false;
  const abort=new AbortController(),options={signal:abort.signal};
  const restore=()=>{for(const n of items){n.card.style.left=n.x+'px';n.card.style.top=n.y+'px';}};
  const valid=()=>graph===owner&&current()===data&&!editorMutationBlocked()&&selectedEdge===null&&scale*uiScaleFactor()===zoom&&pan.x===originPan.x&&pan.y===originPan.y&&items.length===selection.size&&items.every(n=>data.nodes.includes(n.node)&&selection.has(n.id));
  const finish=()=>{closed=true;abort.abort();nodeResizeGesture=null;selectionSpreadActive=false;handle.classList.remove('active');if(handle.hasPointerCapture(event.pointerId))handle.releasePointerCapture(event.pointerId);};
  const cancel=()=>{if(closed)return;restore();finish();if(graph)wires();};
  const move=e=>{
    if(closed||e.pointerId!==event.pointerId)return;e.preventDefault();e.stopPropagation();
    if(!valid()){cancel();return;}
    if(!moved&&Math.hypot(e.clientX-start.x,e.clientY-start.y)<3)return;
    moved=true;positions=selectionSpreadPositions(items,handle.dataset.selectionSpread,(e.clientX-start.x)/zoom,(e.clientY-start.y)/zoom);
    for(const n of items){const p=positions.get(n.id);n.card.style.left=p.x+'px';n.card.style.top=p.y+'px';}wires();
  };
  nodeResizeGesture={cancel};selectionSpreadActive=true;handle.classList.add('active');
  window.addEventListener('pointermove',move,options);
  window.addEventListener('pointerup',e=>{
    if(closed||e.pointerId!==event.pointerId)return;move(e);if(closed)return;
    restore();finish();
    if(valid()&&moved&&items.some(n=>Math.abs(positions.get(n.id).x-n.x)>.001||Math.abs(positions.get(n.id).y-n.y)>.001))change(()=>{
      for(const n of items){const p=positions.get(n.id);n.node.ui||={};n.node.ui.x=p.x;n.node.ui.y=p.y;}
    },{localize:false});else wires();
  },options);
  window.addEventListener('pointercancel',e=>{if(e.pointerId===event.pointerId)cancel();},options);handle.addEventListener('lostpointercapture',cancel,options);
  window.addEventListener('pointerdown',e=>{if(e.pointerId!==event.pointerId)cancel();},{...options,capture:true});
  window.addEventListener('blur',cancel,options);window.addEventListener('resize',cancel,options);window.addEventListener('wheel',cancel,{...options,capture:true,passive:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel();},options);
  document.addEventListener('keydown',e=>{if(['Control','Meta','Shift','Alt'].includes(e.key))return;e.preventDefault();e.stopImmediatePropagation();if(e.key==='Escape')cancel();},{...options,capture:true});
  handle.setPointerCapture(event.pointerId);
}
// Lay out only the selected graph. Collapse cycles for ranking, then use two
// neighbor/port-order sweeps to reduce crossings without a layout dependency.
function autoArrangePositions(items,edges,fromOutputs=false){
  const positions=new Map();if(!items.length)return positions;
  const byId=new Map(items.map(n=>[n.id,n])),order=new Map(items.map((n,i)=>[n.id,i]));
  const next=new Map(items.map(n=>[n.id,new Set()])),previous=new Map(items.map(n=>[n.id,new Set()]));
  const incoming=new Map(items.map(n=>[n.id,[]])),outgoing=new Map(items.map(n=>[n.id,[]]));
  const connected=new Set();
  for(const e of edges){const a=e.from[0],b=e.to[0];if(byId.has(a)&&byId.has(b)){
    connected.add(a);connected.add(b);if(a===b)continue;
    next.get(a).add(b);previous.get(b).add(a);incoming.get(b).push(e.from);outgoing.get(a).push(e.to);
  }}

  // Connected pieces get separate vertical bands, so unrelated chains do not
  // weave through one another. Graph order supplies deterministic tie breaks.
  const pieces=[],seen=new Set();
  for(const n of items){
    if(seen.has(n.id))continue;
    const ids=[],pending=[n.id];seen.add(n.id);
    while(pending.length){const id=pending.pop();ids.push(id);
      for(const other of [...next.get(id),...previous.get(id)])if(!seen.has(other)){seen.add(other);pending.push(other);}
    }
    pieces.push(ids.sort((a,b)=>order.get(a)-order.get(b)));
  }
  const left=Math.min(...items.map(n=>n.x)),gapX=GRID*4,gapY=GRID*2;
  let top=Math.min(...items.map(n=>n.y)),mainWidth=0;
  for(const ids of pieces){
    if(ids.length===1&&!connected.has(ids[0]))continue;
    const index=new Map(),low=new Map(),stack=[],active=new Set(),groups=[],groupOf=new Map();let visitIndex=0;
    function visit(id){
      index.set(id,visitIndex);low.set(id,visitIndex++);stack.push(id);active.add(id);
      for(const to of next.get(id)){
        if(!index.has(to)){visit(to);low.set(id,Math.min(low.get(id),low.get(to)));}
        else if(active.has(to))low.set(id,Math.min(low.get(id),index.get(to)));
      }
      if(low.get(id)===index.get(id)){
        const group={next:new Set(),incoming:0,rank:0};let member;
        do{member=stack.pop();active.delete(member);groupOf.set(member,group);}while(member!==id);
        groups.push(group);
      }
    }
    for(const id of ids)if(!index.has(id))visit(id);
    for(const id of ids)for(const to of next.get(id)){
      const a=groupOf.get(id),b=groupOf.get(to);if(a!==b&&!a.next.has(b)){a.next.add(b);b.incoming++;}
    }
    const ready=groups.filter(g=>!g.incoming);
    for(let i=0;i<ready.length;i++)for(const to of ready[i].next){
      to.rank=Math.max(to.rank,ready[i].rank+1);if(!--to.incoming)ready.push(to);
    }
    if(fromOutputs){
      // Rank the same condensed DAG from its sinks. Short branches move next
      // to their consumers while every sink shares this component's last layer.
      const distance=new Map();
      for(let i=ready.length-1;i>=0;i--)distance.set(ready[i],Math.max(0,...[...ready[i].next].map(to=>distance.get(to)+1)));
      const depth=Math.max(...distance.values());
      for(const group of groups)group.rank=depth-distance.get(group);
    }
    const layers=Array.from({length:Math.max(...groups.map(g=>g.rank))+1},()=>[]);
    for(const id of ids)layers[groupOf.get(id).rank].push(id);
    const rowOrder=new Map();
    const remember=layer=>layer.forEach((id,i)=>rowOrder.set(id,(i+.5)/layer.length));
    layers.forEach(remember);
    // A neighbor occupies one row slot; its ordered ports subdivide that slot.
    // Use logical port order so collapsed nodes retain their expanded ordering.
    const portOrder=(id,port,kind)=>{
      const ports=byId.get(id)[kind]||[],index=ports.indexOf(port),fraction=index<0?.5:(index+.5)/ports.length;
      return rowOrder.get(id)+(fraction-.5)/layers[groupOf.get(id).rank].length;
    };
    const sortLayer=(layer,neighbors,forward)=>{
      const score=id=>{const related=neighbors.get(id).filter(([other])=>forward?groupOf.get(other).rank<groupOf.get(id).rank:groupOf.get(other).rank>groupOf.get(id).rank);
        return related.length?related.reduce((sum,[other,port])=>sum+portOrder(other,port,forward?'outputs':'inputs'),0)/related.length:rowOrder.get(id);};
      const scores=new Map(layer.map(id=>[id,score(id)]));
      layer.sort((a,b)=>scores.get(a)-scores.get(b)||order.get(a)-order.get(b));remember(layer);
    };
    for(let pass=0;pass<2;pass++){
      for(let i=1;i<layers.length;i++)sortLayer(layers[i],incoming,true);
      for(let i=layers.length-2;i>=0;i--)sortLayer(layers[i],outgoing,false);
    }
    const heights=layers.map(layer=>layer.reduce((sum,id)=>sum+byId.get(id).height,0)+gapY*(layer.length-1));
    const height=Math.max(...heights);let x=left;
    layers.forEach((layer,i)=>{
      let y=top+(height-heights[i])/2;
      for(const id of layer){positions.set(id,{x,y});y+=byId.get(id).height+gapY;}
      x+=Math.max(...layer.map(id=>byId.get(id).width))+gapX;
    });
    mainWidth=Math.max(mainWidth,x-gapX-left);
    top+=height+gapX;
  }
  // Unwired singletons share a compact shelf below connected components. Keep
  // graph order, actual dimensions, and the same spacing in both directions.
  const loose=items.filter(n=>!connected.has(n.id));
  if(loose.length){
    const widest=Math.max(...loose.map(n=>n.width)),columns=mainWidth?Math.min(2,loose.length):Math.ceil(Math.sqrt(loose.length));
    const width=Math.max(mainWidth,columns*(widest+gapX)-gapX);let x=left,rowHeight=0;
    for(const n of loose){
      if(x>left&&x+n.width>left+width){top+=rowHeight+gapY;x=left;rowHeight=0;}
      positions.set(n.id,{x,y:top});x+=n.width+gapX;rowHeight=Math.max(rowHeight,n.height);
    }
  }
  return positions;
}
function arrangeSelection(kind){
  if(editorMutationBlocked()||!arrangeContextMatches())return false;
  const nodes=selectedCanvasNodes();if(nodes.length<2||!ARRANGE_ACTIONS.some(([key])=>key===kind))return false;
  const automatic=kind==='auto'||kind==='autoReverse';
  const items=nodes.map(n=>({id:n.id,...nodeLayoutBounds(n),...(automatic?{inputs:Object.keys(ports(n,'inputs')),outputs:Object.keys(ports(n,'outputs'))}:{})}));
  const positions=automatic?autoArrangePositions(items,current().edges,kind==='autoReverse'):new Map(items.map(n=>[n.id,{x:n.x,y:n.y}]));
  const left=Math.min(...items.map(n=>n.x)),top=Math.min(...items.map(n=>n.y)),right=Math.max(...items.map(n=>n.x+n.width)),bottom=Math.max(...items.map(n=>n.y+n.height));
  if(['left','centerX','right','top','centerY','bottom'].includes(kind))for(const n of items){
    const p=positions.get(n.id);
    if(kind==='left')p.x=left;if(kind==='centerX')p.x=(left+right-n.width)/2;if(kind==='right')p.x=right-n.width;
    if(kind==='top')p.y=top;if(kind==='centerY')p.y=(top+bottom-n.height)/2;if(kind==='bottom')p.y=bottom-n.height;
  }else if(kind==='spaceX'||kind==='spaceY'){
    if(items.length<3)return false;
    const axis=kind==='spaceX'?'x':'y',size=axis==='x'?'width':'height';
    items.sort((a,b)=>a[axis]-b[axis]||a.id.localeCompare(b.id));
    const first=items[0],last=items.at(-1),span=last[axis]+last[size]-first[axis],total=items.reduce((sum,n)=>sum+n[size],0);
    const gap=Math.max(GRID*2,(span-total)/(items.length-1));let at=first[axis];
    for(const n of items){positions.get(n.id)[axis]=at;at+=n[size]+gap;}
  }else if(kind==='grid'){
    items.sort((a,b)=>a.y-b.y||a.x-b.x||a.id.localeCompare(b.id));
    const columns=Math.ceil(Math.sqrt(items.length)),widths=Array(columns).fill(0);
    items.forEach((n,i)=>widths[i%columns]=Math.max(widths[i%columns],n.width));
    let y=top;
    for(let row=0;row<items.length;row+=columns){let x=left;const batch=items.slice(row,row+columns);
      batch.forEach((n,col)=>{positions.set(n.id,{x,y});x+=widths[col]+GRID*2;});y+=Math.max(...batch.map(n=>n.height))+GRID*2;
    }
  }
  return change(()=>{for(const n of current().nodes){const p=positions.get(n.id);if(p){n.ui||={};n.ui.x=Math.round(p.x*1000)/1000;n.ui.y=Math.round(p.y*1000)/1000;}}},{localize:false});
}
function openArrangeMenu(){
  const button=$('#grapharrange'),menu=$('#arrangemenu');if(button.disabled)return;
  if(menu.matches(':popover-open')){closeArrangeMenu();return;}
  const nodes=selectedCanvasNodes();arrangeContext={owner:graph,level:current(),ids:nodes.map(n=>n.id)};
  menu.replaceChildren();menu.setAttribute('aria-label',t('arrange.title'));
  for(const [kind,path]of ARRANGE_ACTIONS){
    if(['left','top','spaceX'].includes(kind))menu.append(el('div',{role:'separator',class:'popup-separator'}));
    const item=el('button',{type:'button',role:'menuitem','data-arrange':kind});item.append(selectionIcon(path),el('span',{},t('arrange.'+kind)));
    if(kind==='auto')decorateShortcutButton(item,'autoArrange');
    if(kind==='autoReverse')decorateShortcutButton(item,'autoArrangeReverse');
    item.disabled=(kind==='spaceX'||kind==='spaceY')&&nodes.length<3;
    item.onclick=()=>{if(!arrangeContextMatches())return closeArrangeMenu();arrangeSelection(kind);closeArrangeMenu();$('#grapharrange').focus({preventScroll:true});};menu.append(item);
  }
  menu.showPopover();button.setAttribute('aria-expanded','true');
  const r=button.getBoundingClientRect(),z=uiScaleFactor(),margin=8;
  menu.style.maxHeight=Math.max(0,innerHeight/z-margin*2)+'px';
  const x=r.right/z+6+menu.offsetWidth<=innerWidth/z-margin?r.right/z+6:r.left/z-menu.offsetWidth-6;
  menu.style.left=Math.max(margin,Math.min(x,innerWidth/z-menu.offsetWidth-margin))+'px';
  menu.style.top=Math.max(margin,Math.min(r.top/z,innerHeight/z-menu.offsetHeight-margin))+'px';
  menu.querySelector('button:not(:disabled)')?.focus({preventScroll:true});scheduleSelectionToolbarPosition();
}
function installSelectionToolbar(){
  const canvas=$('#canvas'),top=$('.toolbar .graph-tools'),bar=el('div',{id:'selectiontoolbar',class:'selection-toolbar',role:'toolbar',hidden:''}),outline=el('div',{id:'selectionbounds',hidden:''});
  for(const direction of ['nw','n','ne','e','se','s','sw','w']){
    const handle=el('button',{type:'button',class:'selection-spread-handle','data-selection-spread':direction,tabindex:'-1'});
    handle.onpointerdown=e=>dragSelectionSpread(e,handle);outline.append(handle);
  }
  for(const name of ['click','dblclick','contextmenu','mousedown','touchstart'])outline.addEventListener(name,e=>{e.stopPropagation();});
  const multi=el('div',{class:'graph-tool-group','data-tool-group':'selection',role:'group',hidden:''});
  const arrange=el('button',{id:'grapharrange',class:'icon-button',type:'button','aria-haspopup':'menu','aria-controls':'arrangemenu','aria-expanded':'false'});
  const arrangeIcon=selectionIcon('M4 3v18M8 5h12v4H8zM8 11h8v3H8zM8 16h10v3H8z'),dropdown=document.createElementNS(arrangeIcon.namespaceURI,'path');
  dropdown.setAttribute('d','M18.5 20h5L21 23z');dropdown.setAttribute('fill','currentColor');dropdown.setAttribute('stroke','none');arrangeIcon.append(dropdown);
  arrange.append(arrangeIcon);arrange.onclick=openArrangeMenu;
  const frame=el('button',{id:'graphfitselection',class:'icon-button',type:'button'});
  frame.append(selectionIcon('M8 3H3v5M16 3h5v5M21 16v5h-5M8 21H3v-5M8 8h8v8H8z'));frame.onclick=fitSelection;
  const groupFrame=el('button',{id:'graphframe',class:'icon-button',type:'button'});groupFrame.append(selectionIcon('M7 2v20M17 2v20M2 7h20M2 17h20'));groupFrame.onclick=createGroupFrame;
  const join=el('button',{id:'graphjoinframe',class:'icon-button',type:'button'});join.append(selectionIcon('M10 4H4v16h16v-6M21 3 10 14M10 7v7h7'));
  join.onclick=()=>{if(joinGroupFrameSelection())$('#canvas').focus({preventScroll:true});};
  const detach=el('button',{id:'graphdetachframe',class:'icon-button',type:'button'});detach.append(selectionIcon('M10 4H4v16h16v-6M10 14 21 3M14 3h7v7'));
  detach.onclick=()=>{if(detachGroupFrameSelection())$('#canvas').focus({preventScroll:true});};
  for(const [action,path]of [['collapse','M4 11h16v2H4zM8 3l4 4 4-4M8 21l4-4 4 4'],['expand','M4 10h16v4H4zM8 6l4-4 4 4M8 18l4 4 4-4']]){
    const button=el('button',{id:'graph'+action+'selection',class:'icon-button',type:'button'});button.append(selectionIcon(path));
    button.onclick=()=>{if(setNodesCollapsed(nodeCollapseSelection().map(n=>n.id),action==='collapse'))$('#canvas').focus({preventScroll:true});};multi.append(button);
  }
  multi.append(el('span',{id:'graphcollapseseparator',class:'graph-tool-separator',role:'separator','aria-orientation':'vertical'}),groupFrame,join,detach,$('#graphgroup'),arrange,frame);top.insertBefore(multi,top.querySelector('[data-tool-group="view"]'));canvas.append(outline,bar);
  const menu=el('div',{id:'arrangemenu',class:'popup-menu arrangement-menu',popover:'auto',role:'menu'});document.body.append(menu);
  for(const control of [bar,menu]){
    for(const event of ['pointerdown','mousedown','touchstart','dblclick'])control.addEventListener(event,e=>e.stopPropagation());
    control.addEventListener('wheel',e=>e.stopPropagation(),{passive:true});
  }
  bar.onpointerenter=e=>{if(e.pointerType==='mouse'){selectionToolbarHover=selectionBoundsHover=true;scheduleSelectionToolbarPosition();}};
  bar.onpointerleave=()=>{selectionToolbarHover=false;scheduleSelectionToolbarPosition();};
  // Once revealed from the toolbar, keep the outline reachable across the gap
  // and over its handles. Leaving this interaction area restores hover-only UI.
  canvas.addEventListener('pointermove',e=>{
    if(e.pointerType!=='mouse'||!selectionBoundsHover||selectionSpreadActive)return;
    const near=element=>{const r=element.getBoundingClientRect(),gap=14*uiScaleFactor();return e.clientX>=r.left-gap&&e.clientX<=r.right+gap&&e.clientY>=r.top-gap&&e.clientY<=r.bottom+gap;};
    selectionBoundsHover=near(bar)||near(outline);scheduleSelectionToolbarPosition();
  },{passive:true});
  canvas.addEventListener('pointerleave',()=>{if(!selectionSpreadActive){selectionBoundsHover=false;scheduleSelectionToolbarPosition();}});
  bar.addEventListener('focusin',scheduleSelectionToolbarPosition);bar.addEventListener('focusout',scheduleSelectionToolbarPosition);
  bar.addEventListener('keydown',e=>{if(e.key==='Tab')e.stopPropagation();if(['ArrowLeft','ArrowRight','ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();e.stopPropagation();const items=[...bar.querySelectorAll('button:not(:disabled)')].filter(b=>b.getClientRects().length),i=items.indexOf(document.activeElement);items[e.key==='Home'?0:e.key==='End'?items.length-1:(i+(['ArrowRight','ArrowDown'].includes(e.key)?1:-1)+items.length)%items.length]?.focus();}if(e.key==='Escape'){e.stopPropagation();$('#canvas').focus({preventScroll:true});}});
  menu.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();closeArrangeMenu();arrange.focus({preventScroll:true});}else if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();const items=[...menu.querySelectorAll('button:not(:disabled)')],i=items.indexOf(document.activeElement);items[e.key==='Home'?0:e.key==='End'?items.length-1:(i+(e.key==='ArrowDown'?1:-1)+items.length)%items.length]?.focus();}});
  menu.addEventListener('toggle',()=>{arrange.setAttribute('aria-expanded',String(menu.matches(':popover-open')));if(!menu.matches(':popover-open'))arrangeContext=null;scheduleSelectionToolbarPosition();});
  new ResizeObserver(scheduleSelectionToolbarPosition).observe(canvas);new ResizeObserver(scheduleSelectionToolbarPosition).observe($('#cards'));
  renderSelectionToolbar();
}

// Only this toolbar opts into overflow. Moving original controls preserves their
// handlers/state; the floating selection toolbar keeps ownership of its groups.
const GRAPH_TOOL_GROUPS=['history','edit','selection','view','names','code'];
const GRAPH_TOOL_RETREAT=['code','names','selection','edit','view','history'];
let graphToolbarFrame=0;
function scheduleGraphToolbarOverflow(){
  if(!$('#graphmore')||graphToolbarFrame)return;
  graphToolbarFrame=requestAnimationFrame(()=>{graphToolbarFrame=0;layoutGraphToolbar();});
}
function closeGraphMore(focus=false){
  const menu=$('#graphmoremenu');if(!menu?.matches(':popover-open'))return;
  focus||=menu.contains(document.activeElement);
  closeArrangeMenu();menu.hidePopover();$('#graphmore').setAttribute('aria-expanded','false');
  if(focus)($('#graphmore').hidden?$('#canvas'):$('#graphmore')).focus({preventScroll:true});
}
function positionGraphMore(){
  const menu=$('#graphmoremenu'),r=$('#graphmore').getBoundingClientRect(),z=uiScaleFactor(),margin=8;
  menu.style.maxHeight=Math.max(0,innerHeight/z-margin*2)+'px';
  menu.style.left=Math.max(margin,Math.min(r.right/z-menu.offsetWidth,innerWidth/z-menu.offsetWidth-margin))+'px';
  menu.style.top=Math.max(margin,Math.min(r.bottom/z+4,innerHeight/z-menu.offsetHeight-margin))+'px';
}
function layoutGraphToolbar(){
  const top=$('.toolbar .graph-tools'),toolbar=top.closest('.toolbar'),menu=$('#graphmoremenu'),more=$('#graphmore');
  const active=document.activeElement,open=menu.matches(':popover-open');
  const groups=GRAPH_TOOL_GROUPS.map(key=>document.querySelector(`[data-tool-group="${key}"]`)).filter(g=>g.parentElement===top||g.parentElement===menu);
  // One bounded measurement pass for six groups, never graph traversal or TD IO.
  for(const group of groups)top.insertBefore(group,more);
  more.hidden=false;
  const visible=groups.filter(g=>!g.hidden),style=getComputedStyle(toolbar),gap=parseFloat(getComputedStyle(top).gap)||0;
  const location=$('.graph-location-tools'),stages=location.querySelector('.stage-tabs'),path=$('#graphpath');
  const naturalPath=[...path.children].reduce((sum,child)=>sum+child.offsetWidth,0)+Math.max(0,path.childElementCount-1)*(parseFloat(getComputedStyle(path).gap)||0);
  const pathWidth=graphTrail.length?Math.min(220,naturalPath)+($('#graphup').disabled?0:$('#graphup').offsetWidth)+10:0;
  const locationWidth=stages.offsetWidth+(pathWidth?pathWidth+(parseFloat(getComputedStyle(location).gap)||0):0);
  const available=toolbar.clientWidth-parseFloat(style.paddingLeft)-parseFloat(style.paddingRight)-(parseFloat(style.gap)||0)-locationWidth;
  const widths=new Map(visible.map(g=>[g,g.offsetWidth+gap]));let used=[...widths.values()].reduce((a,b)=>a+b,0);
  const collapsed=new Set();
  // First try every tool without reserving a button or its gap. Only overflow
  // needs the dropdown's space; don't let that space cause premature collapse.
  if(Math.max(0,used-gap)>available){
    const remaining=available-more.offsetWidth;
    for(const key of GRAPH_TOOL_RETREAT){if(used<=remaining)break;const group=visible.find(g=>g.dataset.toolGroup===key);if(group){collapsed.add(group);used-=widths.get(group);}}
  }
  for(const group of groups){
    const overflow=collapsed.has(group);if(overflow)menu.append(group);
    for(const button of group.querySelectorAll('button')){
      if(overflow){button.setAttribute('role',button.hasAttribute('aria-pressed')?'menuitemcheckbox':'menuitem');if(button.hasAttribute('aria-pressed'))button.setAttribute('aria-checked',button.getAttribute('aria-pressed'));}
      else{button.removeAttribute('role');button.removeAttribute('aria-checked');}
    }
  }
  more.hidden=collapsed.size===0;if(more.hidden)closeGraphMore();
  more.title=t('toolbar.more');more.setAttribute('aria-label',t('toolbar.more'));menu.setAttribute('aria-label',t('toolbar.more'));
  // Focus can be lost when a button changes parent. Keep it on a reachable control.
  if(active===more&&more.hidden)$('#canvas').focus({preventScroll:true});
  else if(active?.closest?.('.graph-tool-group')){
    if(active.closest('#graphmoremenu')&&!open)more.focus({preventScroll:true});
    else if(active.getClientRects().length)active.focus({preventScroll:true});
  }
  if(open&&!more.hidden)positionGraphMore();
}
function installGraphToolbarOverflow(){
  const top=$('.toolbar .graph-tools'),toolbar=top.closest('.toolbar');
  const more=el('button',{id:'graphmore',class:'icon-button',type:'button','aria-haspopup':'menu','aria-controls':'graphmoremenu','aria-expanded':'false','data-overflow':'when-needed',hidden:''});
  more.append(selectionIcon('M3 5h16M3 10h16M3 15h8m3 3 4 4 4-4'));top.append(more);
  const menu=el('div',{id:'graphmoremenu',class:'popup-menu',popover:'manual',role:'menu'});document.body.append(menu);
  for(const key of GRAPH_TOOL_GROUPS)document.querySelector(`[data-tool-group="${key}"]`).dataset.overflow='collapsible';
  for(const item of toolbar.querySelectorAll('.stage-tabs,.graph-navigation'))item.dataset.overflow='permanent';
  const items=()=>[...menu.querySelectorAll('button:not(:disabled)')].filter(b=>b.getClientRects().length);
  const open=()=>{layoutGraphToolbar();if(more.hidden)return;menu.showPopover();more.setAttribute('aria-expanded','true');positionGraphMore();(items()[0]||menu).focus({preventScroll:true});};
  menu.tabIndex=-1;more.onclick=()=>menu.matches(':popover-open')?closeGraphMore(true):open();
  more.onkeydown=e=>{if(e.key==='ArrowDown'){e.preventDefault();e.stopPropagation();open();}};
  menu.onkeydown=e=>{
    e.stopPropagation();
    if(e.key==='Escape'){e.preventDefault();closeGraphMore(true);}
    else if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();const buttons=items(),i=buttons.indexOf(document.activeElement);buttons[e.key==='Home'?0:e.key==='End'?buttons.length-1:(i+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus();}
    else if(e.key==='Tab')closeGraphMore();
  };
  menu.onclick=e=>{if(e.target.closest('button:not(:disabled)')&&e.target.closest('button').id!=='grapharrange')closeGraphMore();};
  for(const name of ['pointerdown','mousedown','touchstart','dblclick','wheel'])menu.addEventListener(name,e=>e.stopPropagation());
  document.addEventListener('pointerdown',e=>{if(!e.target.closest('#graphmore,#graphmoremenu,#arrangemenu'))closeGraphMore();},true);
  window.addEventListener('blur',()=>closeGraphMore());
  window.addEventListener('resize',()=>{closeGraphMore();scheduleGraphToolbarOverflow();});
  let width=-1;new ResizeObserver(entries=>{const next=entries[0].contentRect.width;if(next!==width){if(width>=0)closeGraphMore();width=next;scheduleGraphToolbarOverflow();}}).observe(toolbar);
  document.fonts.ready.then(scheduleGraphToolbarOverflow);scheduleGraphToolbarOverflow();
}
