/* Named group frames are graph layout metadata, never shader nodes. */
const GROUP_FRAME_COLOR='#7f8797',GROUP_FRAME_PADDING=24,GROUP_FRAME_TITLE=28;
function groupFrameMembers(frame,data=current()){
  const ids=new Set(frame.nodes);return data.nodes.filter(n=>ids.has(n.id));
}
function groupFrameBounds(frame){
  const rects=groupFrameMembers(frame).map(n=>$('#cards').querySelector(`[data-node="${CSS.escape(n.id)}"]`)).filter(Boolean).map(card=>({x:card.offsetLeft,y:card.offsetTop,width:card.offsetWidth,height:card.offsetHeight}));
  if(!rects.length)return null;
  const left=Math.min(...rects.map(r=>r.x)),top=Math.min(...rects.map(r=>r.y));
  return {x:left-GROUP_FRAME_PADDING,y:top-GROUP_FRAME_PADDING-GROUP_FRAME_TITLE,
    width:Math.max(...rects.map(r=>r.x+r.width))-left+GROUP_FRAME_PADDING*2,
    height:Math.max(...rects.map(r=>r.y+r.height))-top+GROUP_FRAME_PADDING*2+GROUP_FRAME_TITLE};
}
function completeGroupFrames(nodes){
  const ids=new Set(nodes.map(n=>n.id));return GraphFrames.read(current()).filter(frame=>frame.nodes.every(id=>ids.has(id)));
}
function canCreateGroupFrame(){
  if(!graph)return false;
  const nodes=selectedCanvasNodes(),grouped=new Set(GraphFrames.read(current()).flatMap(frame=>frame.nodes));
  return nodes.length>1&&nodes.every(n=>!grouped.has(n.id));
}
function createGroupFrame(){
  if(editorMutationBlocked()||!canCreateGroupFrame())return null;
  const data=current(),frames=GraphFrames.read(data),names=new Set(frames.map(frame=>frame.name));
  let index=1,name;do{name=t('frame.defaultName')+' '+index++;}while(names.has(name));
  const frame={id:'frame_'+crypto.randomUUID().replaceAll('-','').slice(0,12),name,color:GROUP_FRAME_COLOR,nodes:selectedCanvasNodes().map(n=>n.id)};
  if(!change(()=>GraphFrames.write(data,[...frames,frame]),{localize:false}))return null;
  beginGroupFrameRename(frame);return frame.id;
}
function updateGroupFrame(frame,edit,data=current()){
  if(editorMutationBlocked()||current()!==data)return false;
  const frames=GraphFrames.read(data),target=frames.find(item=>item.id===frame.id);if(!target)return false;
  return change(()=>{edit(target);GraphFrames.write(data,frames);},{localize:false});
}
function renameGroupFrame(frame,name,data=current()){
  name=name.trim();if(!name||name.length>80||/[\x00-\x1f\x7f]/.test(name)){status(t('frame.invalidName'),true);return false;}
  return updateGroupFrame(frame,target=>target.name=name,data);
}
function setGroupFrameColor(frame,color,data=current()){
  if(!/^#[0-9a-f]{6}$/i.test(color))return false;
  return updateGroupFrame(frame,target=>target.color=color.toLowerCase(),data);
}
function removeGroupFrame(frame,data=current()){
  if(editorMutationBlocked()||current()!==data||!GraphFrames.read(data).some(item=>item.id===frame.id))return false;
  return change(()=>GraphFrames.write(data,GraphFrames.read(data).filter(item=>item.id!==frame.id)),{localize:false});
}
function selectGroupFrame(frame){
  const members=groupFrameMembers(frame);selection=new Set(members.map(n=>n.id));selected=members[0]?.id||null;selectedEdge=null;
  document.querySelectorAll('.node').forEach(card=>card.classList.toggle('selected',selection.has(card.dataset.node)));
  inspector();renderNavigation();positionGroupFrames();
}
function beginGroupFrameRename(frame){
  if(editorMutationBlocked())return;
  const data=current(),card=$('#groupframes')?.querySelector(`[data-frame="${CSS.escape(frame.id)}"]`),name=card?.querySelector('.group-frame-name');
  if(!name||card.querySelector('input[data-frame-name]'))return;
  const entry=el('input',{type:'text','data-frame-name':frame.id,'aria-label':t('frame.name'),maxlength:'80'});entry.value=frame.name;entry.frameOwner=data;
  name.replaceWith(entry);let cancelled=false;
  entry.onpointerdown=entry.ondblclick=e=>e.stopPropagation();
  entry.onkeydown=e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();cancelled=true;entry.blur();}else if(e.key==='Enter'&&!e.isComposing){e.preventDefault();entry.blur();}};
  entry.onblur=()=>{if(!cancelled&&entry.value.trim()!==frame.name)renameGroupFrame(frame,entry.value,data);if(entry.isConnected)entry.replaceWith(name);};
  entry.focus({preventScroll:true});entry.select();
}
function dragGroupFrame(event,frame,heading){
  if(event.button!==0||event.target.closest('input,button'))return;
  event.preventDefault();event.stopPropagation();nodeDragGesture?.cancel();nodeResizeGesture?.cancel();touchGraphGesture?.cancel();clearWireGesture();closeCreator();
  selectGroupFrame(frame);if(editorMutationBlocked())return;
  const owner=graph,data=current(),zoom=scale*uiScaleFactor(),start={x:event.clientX,y:event.clientY};
  const positions=groupFrameMembers(frame).map(node=>({node,card:$('#cards').querySelector(`[data-node="${CSS.escape(node.id)}"]`),x:node.ui?.x||0,y:node.ui?.y||0}));
  if(!positions.length||positions.some(p=>!p.card))return;
  let moved=false,closed=false,dx=0,dy=0;const abort=new AbortController(),options={signal:abort.signal};
  const restore=()=>{for(const p of positions){p.card.style.left=p.x+'px';p.card.style.top=p.y+'px';}};
  const finish=()=>{closed=true;abort.abort();nodeDragGesture=null;heading.classList.remove('dragging');if(heading.hasPointerCapture(event.pointerId))heading.releasePointerCapture(event.pointerId);};
  const cancel=()=>{if(closed)return;restore();finish();if(graph)wires();};
  const move=e=>{
    if(closed||e.pointerId!==event.pointerId)return;
    if(graph!==owner||current()!==data||scale*uiScaleFactor()!==zoom){cancel();return;}
    if(!moved&&Math.hypot(e.clientX-start.x,e.clientY-start.y)<3)return;
    moved=true;e.preventDefault();heading.classList.add('dragging');
    dx=snap(positions[0].x+(e.clientX-start.x)/zoom)-positions[0].x;dy=snap(positions[0].y+(e.clientY-start.y)/zoom)-positions[0].y;
    for(const p of positions){p.card.style.left=p.x+dx+'px';p.card.style.top=p.y+dy+'px';}wires();
  };
  nodeDragGesture={cancel};
  window.addEventListener('pointermove',move,options);
  window.addEventListener('pointerup',e=>{
    if(e.pointerId!==event.pointerId||closed)return;move(e);if(closed)return;restore();finish();
    if(moved&&(dx||dy)&&graph===owner&&current()===data&&!editorMutationBlocked())change(()=>{for(const p of positions){p.node.ui||={};p.node.ui.x=p.x+dx;p.node.ui.y=p.y+dy;}},{localize:false});else wires();
  },options);
  window.addEventListener('pointercancel',e=>{if(e.pointerId===event.pointerId)cancel();},options);
  heading.addEventListener('lostpointercapture',cancel,options);
  window.addEventListener('pointerdown',e=>{if(e.pointerId!==event.pointerId)cancel();},{...options,capture:true});
  window.addEventListener('blur',cancel,options);window.addEventListener('resize',cancel,options);
  window.addEventListener('wheel',cancel,{...options,capture:true,passive:true});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();cancel();}},{...options,capture:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)cancel();},options);
  heading.setPointerCapture(event.pointerId);
}
function positionGroupFrames(){
  const layer=$('#groupframes');if(!layer||!graph)return;
  const frames=GraphFrames.read(current());
  for(const card of layer.children){
    const frame=frames.find(item=>item.id===card.dataset.frame),bounds=frame&&groupFrameBounds(frame);card.hidden=!bounds;
    if(bounds){Object.assign(card.style,{left:bounds.x+'px',top:bounds.y+'px',width:bounds.width+'px',height:bounds.height+'px'});card.classList.toggle('selected',frame.nodes.every(id=>selection.has(id)));}
  }
}
function renderGroupFrames(){
  let layer=$('#groupframes');if(!layer){layer=el('div',{id:'groupframes'});$('#world').prepend(layer);}
  const data=current(),frames=GraphFrames.read(data),active=document.activeElement;
  if(active?.matches('[data-frame-name]')&&active.frameOwner===data&&frames.some(frame=>frame.id===active.dataset.frameName)){positionGroupFrames();return;}
  layer.replaceChildren();
  for(const frame of frames){
    const card=el('section',{class:'group-frame','data-frame':frame.id,'aria-label':frame.name}),heading=el('div',{class:'group-frame-title',tabindex:'0',role:'group','aria-label':frame.name});
    card.style.setProperty('--frame-color',frame.color||GROUP_FRAME_COLOR);
    const name=el('span',{class:'group-frame-name',title:frame.name},frame.name);
    const color=el('input',{type:'color','data-frame-color':frame.id,'aria-label':t('frame.color'),title:t('frame.color')});color.value=frame.color||GROUP_FRAME_COLOR;color.disabled=readonly;
    color.onchange=()=>setGroupFrameColor(frame,color.value,data);
    const rename=el('button',{type:'button','data-frame-rename':frame.id,'aria-label':t('frame.rename'),title:t('frame.rename')}),remove=el('button',{type:'button','data-frame-remove':frame.id,'aria-label':t('frame.remove'),title:t('frame.remove')});
    rename.append(selectionIcon('m4 16-1 5 5-1L20 8l-4-4L4 16Zm10-10 4 4'));remove.append(selectionIcon('m6 6 12 12M18 6 6 18'));
    rename.disabled=remove.disabled=readonly;rename.onclick=()=>{if(current()===data)beginGroupFrameRename(frame);};remove.onclick=()=>removeGroupFrame(frame,data);
    for(const control of [rename,remove,color])control.onpointerdown=control.ondblclick=e=>e.stopPropagation();
    heading.onpointerdown=e=>{if(current()===data)dragGroupFrame(e,frame,heading);};
    heading.ondblclick=e=>{e.preventDefault();e.stopPropagation();if(current()===data)beginGroupFrameRename(frame);};
    heading.onclick=e=>e.stopPropagation();heading.oncontextmenu=e=>e.stopPropagation();
    heading.onkeydown=e=>{e.stopPropagation();if(e.target!==heading)return;if(e.key==='Enter'||e.key===' '){e.preventDefault();selectGroupFrame(frame);}if(e.key==='F2'){e.preventDefault();beginGroupFrameRename(frame);}};
    heading.append(name,color,rename,remove);card.append(heading);layer.append(card);
  }
  positionGroupFrames();
}
