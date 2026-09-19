/* Named group frames are graph layout metadata, never shader nodes. */
const GROUP_FRAME_COLOR='#7f8797',GROUP_FRAME_PADDING=24,GROUP_FRAME_TITLE=28;
const GROUP_FRAME_COLORS=[
  ['slate','#7f8797'],['gray','#9a9390'],['red','#aa7a79'],['orange','#bb8c69'],
  ['sand','#b6a270'],['olive','#94a574'],['green','#75a28a'],['teal','#72a6a5'],
  ['blue','#759bb5'],['navy','#485f8d'],['violet','#9285ad'],['rose','#ad83a2']
];
let groupFramePalette=null;
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
function canDetachGroupFrameSelection(){
  if(!graph)return false;
  const ids=new Set(selectedCanvasNodes().map(node=>node.id));
  return GraphFrames.read(current()).some(frame=>frame.nodes.some(id=>ids.has(id)));
}
function detachGroupFrameSelection(){
  if(editorMutationBlocked()||!canDetachGroupFrameSelection())return false;
  const data=current(),ids=new Set(selectedCanvasNodes().map(node=>node.id));
  return change(()=>GraphFrames.write(data,GraphFrames.read(data).map(frame=>({...frame,nodes:frame.nodes.filter(id=>!ids.has(id))}))),{localize:false});
}
function groupFrameJoinTarget(){
  if(!graph)return null;
  const ids=new Set(selectedCanvasNodes().map(node=>node.id));
  let target=null,highest=0,tied=false;
  for(const frame of GraphFrames.read(current())){
    const count=frame.nodes.filter(id=>ids.has(id)).length;
    if(count>highest){target=frame;highest=count;tied=false;}
    else if(count&&count===highest)tied=true;
  }
  return target&&!tied&&[...ids].some(id=>!target.nodes.includes(id))?target:null;
}
function joinGroupFrameSelection(){
  if(editorMutationBlocked())return false;
  const target=groupFrameJoinTarget();if(!target)return false;
  const data=current(),ids=new Set(selectedCanvasNodes().map(node=>node.id));
  return change(()=>GraphFrames.write(data,GraphFrames.read(data).map(frame=>({...frame,nodes:frame.id===target.id?[...new Set([...frame.nodes,...ids])]:frame.nodes.filter(id=>!ids.has(id))}))),{localize:false});
}
function createGroupFrame(){
  if(editorMutationBlocked()||!canCreateGroupFrame())return null;
  const data=current(),frames=GraphFrames.read(data),names=new Set(frames.map(frame=>frame.name));
  let index=1,name;do{name='Group '+index++;}while(names.has(name));
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
function groupFrameColorSessionValid(session){
  return !!session&&graph===session.owner&&current()===session.data&&!editorMutationBlocked()&&
    (session.node?session.data.nodes.includes(session.node)&&definition(session.node)?.key==='comment':GraphFrames.read(session.data).some(frame=>frame.id===session.frame.id));
}
function paletteTargetColor(session){
  const color=session.node?session.node.ui?.noteColor:GraphFrames.read(session.data).find(frame=>frame.id===session.frame.id)?.color;
  return typeof color==='string'&&/^#[0-9a-f]{6}$/i.test(color)?color.toLowerCase():GROUP_FRAME_COLOR;
}
function focusGroupFrameColor(session){
  if(graph!==session?.owner||current()!==session.data)return;
  const selector=session.node?`[data-note-color="${CSS.escape(session.node.id)}"]${session.inspector?'[data-note-color-setting]':''}`:`[data-frame-color="${CSS.escape(session.frame.id)}"]`;
  $(session.node?(session.inspector?'#inspector':'#cards'):'#groupframes')?.querySelector(selector)?.focus({preventScroll:true});
}
function closeGroupFramePalette(focus=false){
  const palette=groupFramePalette;if(!palette)return;
  const session=palette.context;palette.context=null;
  session?.trigger.setAttribute('aria-expanded','false');
  if(palette.popup.matches(':popover-open'))palette.popup.hidePopover();
  if(focus)focusGroupFrameColor(session);
}
function commitGroupFrameColor(session,color){
  if(!groupFrameColorSessionValid(session)||!/^#[0-9a-f]{6}$/i.test(color))return false;
  const result=session.node?change(()=>{session.node.ui||={};session.node.ui.noteColor=color.toLowerCase();session.node.ui.noteTransparent=false;},{localize:false}):setGroupFrameColor(session.frame,color,session.data);
  focusGroupFrameColor(session);return result;
}
function ensureGroupFramePalette(){
  if(groupFramePalette)return groupFramePalette;
  const popup=el('div',{id:'groupframepalette',class:'group-frame-palette',popover:'auto',role:'menu','aria-label':t('frame.color')});
  // Keep the native input connected independently of the popover and frame cards.
  // Opening or cancelling its chooser must not turn an intermediate input event into an edit.
  const picker=el('input',{type:'color',class:'group-frame-native-color',tabindex:'-1','data-frame-custom-color':'','aria-label':t('frame.customColor')});
  const palette=groupFramePalette={popup,picker,context:null,native:null};
  picker.onchange=()=>{const session=palette.native;palette.native=null;commitGroupFrameColor(session,picker.value);};
  for(const event of ['pointerdown','mousedown','touchstart','click','dblclick'])popup.addEventListener(event,e=>e.stopPropagation());
  popup.addEventListener('wheel',e=>e.stopPropagation(),{passive:true});
  popup.addEventListener('keydown',e=>{
    e.stopPropagation();
    if(e.key==='Escape'||e.key==='Tab'){e.preventDefault();closeGroupFramePalette(true);return;}
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key))return;
    e.preventDefault();const buttons=[...popup.querySelectorAll('button')],index=Math.max(0,buttons.indexOf(document.activeElement));
    const next=e.key==='Home'?0:e.key==='End'?buttons.length-1:e.key==='ArrowDown'?Math.min(buttons.length-1,index+4):e.key==='ArrowUp'?Math.max(0,index-4):(index+(e.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;
    buttons[next]?.focus({preventScroll:true});
  });
  popup.addEventListener('toggle',()=>{if(!popup.matches(':popover-open'))closeGroupFramePalette();});
  window.addEventListener('resize',()=>closeGroupFramePalette());
  document.addEventListener('visibilitychange',()=>{if(document.hidden)closeGroupFramePalette();});
  document.addEventListener('wheel',e=>{if(!popup.contains(e.target))closeGroupFramePalette();},{passive:true});
  document.body.append(popup,picker);return palette;
}
function openGroupFramePalette(frame,trigger,data=current()){
  return openCanvasColorPalette({owner:graph,data,frame,trigger});
}
function openNoteColorPalette(node,trigger){
  return openCanvasColorPalette({owner:graph,data:current(),node,trigger,inspector:trigger.hasAttribute('data-note-color-setting')});
}
function openCanvasColorPalette(session){
  const {trigger}=session;
  const palette=ensureGroupFramePalette();
  if(palette.context?.trigger===trigger){closeGroupFramePalette(true);return;}
  closeGroupFramePalette();palette.native=null;
  if(!groupFrameColorSessionValid(session))return;
  palette.context=session;trigger.setAttribute('aria-expanded','true');
  const popup=palette.popup,color=paletteTargetColor(session);
  popup.setAttribute('aria-label',t(session.node?'note.color':'frame.color'));popup.replaceChildren();
  const grid=el('div',{class:'group-frame-palette-grid',role:'group','aria-label':t('frame.presetColors')});
  const hasNoteColor=!!session.node&&typeof session.node.ui?.noteColor==='string'&&/^#[0-9a-f]{6}$/i.test(session.node.ui.noteColor);
  if(session.node){
    const reset=el('button',{type:'button',class:'group-frame-preset',role:'menuitemradio','data-note-color-default':'','aria-label':t('note.defaultColor'),title:t('note.defaultColor'),'aria-checked':String(!hasNoteColor&&session.node.ui?.noteTransparent!==true),tabindex:'-1'});
    reset.style.setProperty('--swatch-color','var(--note-default-bg)');reset.append(el('span',{'aria-hidden':'true'}));
    reset.onclick=()=>{
      closeGroupFramePalette();if(!groupFrameColorSessionValid(session))return;
      change(()=>{if(session.node.ui){delete session.node.ui.noteColor;delete session.node.ui.noteTransparent;}},{localize:false});focusGroupFrameColor(session);
    };
    grid.append(reset);
  }
  for(const [name,value]of(session.node?GROUP_FRAME_COLORS.slice(1):GROUP_FRAME_COLORS)){
    const label=t('frame.colorPreset.'+name)+' · '+value.toUpperCase(),button=el('button',{type:'button',class:'group-frame-preset',role:'menuitemradio','data-frame-color-preset':value,'aria-label':label,title:label,'aria-checked':String((!session.node||hasNoteColor)&&session.node?.ui?.noteTransparent!==true&&color.toLowerCase()===value),tabindex:'-1'});
    button.style.setProperty('--swatch-color',value);button.append(el('span',{'aria-hidden':'true'}));
    button.onclick=()=>{closeGroupFramePalette();commitGroupFrameColor(session,value);};grid.append(button);
  }
  const custom=el('button',{type:'button',class:'group-frame-custom'+(session.node?' note-color-custom':''),role:'menuitem','data-frame-color-custom':'',tabindex:'-1','aria-label':t('frame.customColor'),title:t('frame.customColor')});
  custom.append(el('span',{class:'group-frame-rainbow','aria-hidden':'true'}),el('span',{},t('frame.customColor')));
  custom.onclick=()=>{
    if(!groupFrameColorSessionValid(session)){closeGroupFramePalette();return;}
    const rect=custom.getBoundingClientRect(),zoom=uiScaleFactor();
    Object.assign(palette.picker.style,{left:rect.left/zoom+'px',top:rect.top/zoom+'px'});
    palette.native=session;palette.picker.value=paletteTargetColor(session);
    palette.picker.setAttribute('aria-label',t('frame.customColor'));closeGroupFramePalette();
    // Native pickers require the original trusted click; do not defer this call.
    if(typeof palette.picker.showPicker==='function')palette.picker.showPicker();else palette.picker.click();
  };
  popup.append(grid,el('div',{class:'group-frame-palette-divider',role:'separator'}));
  if(session.node){
    const actions=el('div',{class:'group-frame-palette-actions'}),transparent=el('button',{type:'button',class:'group-frame-preset note-color-transparent',role:'menuitemradio','data-note-color-transparent':'',tabindex:'-1','aria-label':t('note.transparent'),title:t('note.transparent'),'aria-checked':String(session.node.ui?.noteTransparent===true)});
    transparent.append(el('span',{'aria-hidden':'true'}));transparent.onclick=()=>{
      closeGroupFramePalette();if(!groupFrameColorSessionValid(session))return;
      change(()=>{session.node.ui||={};session.node.ui.noteTransparent=true;},{localize:false});focusGroupFrameColor(session);
    };
    actions.append(custom,transparent);popup.append(actions);
  }else popup.append(custom);
  popup.showPopover();
  const rect=trigger.getBoundingClientRect(),zoom=uiScaleFactor(),margin=8,width=innerWidth/zoom,height=innerHeight/zoom;
  popup.style.maxHeight=Math.max(40,height-margin*2)+'px';
  const below=rect.bottom/zoom+6,above=rect.top/zoom-popup.offsetHeight-6;
  Object.assign(popup.style,{left:Math.max(margin,Math.min(rect.left/zoom,width-popup.offsetWidth-margin))+'px',top:Math.max(margin,Math.min(below+popup.offsetHeight<=height-margin?below:above,height-popup.offsetHeight-margin))+'px'});
  (popup.querySelector('[aria-checked="true"]')||custom).focus({preventScroll:true});
}
function removeGroupFrame(frame,data=current()){
  if(editorMutationBlocked()||current()!==data||!GraphFrames.read(data).some(item=>item.id===frame.id))return false;
  return change(()=>GraphFrames.write(data,GraphFrames.read(data).filter(item=>item.id!==frame.id)),{localize:false});
}
function selectGroupFrame(frame){
  focusGraphCanvas();
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
    if(moved&&(dx||dy)&&graph===owner&&current()===data&&!editorMutationBlocked())change(()=>{for(const p of positions){p.node.ui||={};p.node.ui.x=p.x+dx;p.node.ui.y=p.y+dy;}},{localize:false,layout:true});else wires();
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
  closeGroupFramePalette();
  if(groupFramePalette?.native&&!groupFrameColorSessionValid(groupFramePalette.native))groupFramePalette.native=null;
  let layer=$('#groupframes');if(!layer){layer=el('div',{id:'groupframes'});$('#world').prepend(layer);}
  const data=current(),frames=GraphFrames.read(data),active=document.activeElement;
  if(active?.matches('[data-frame-name]')&&active.frameOwner===data&&frames.some(frame=>frame.id===active.dataset.frameName)){positionGroupFrames();return;}
  layer.replaceChildren();
  for(const frame of frames){
    const card=el('section',{class:'group-frame','data-frame':frame.id,'aria-label':frame.name}),heading=el('div',{class:'group-frame-title',tabindex:'0',role:'group','aria-label':frame.name});
    card.style.setProperty('--frame-color',frame.color||GROUP_FRAME_COLOR);
    const name=el('span',{class:'group-frame-name',title:frame.name},frame.name);
    const color=el('button',{type:'button',class:'group-frame-color','data-frame-color':frame.id,'aria-label':t('frame.color'),title:t('frame.color'),'aria-haspopup':'menu','aria-controls':'groupframepalette','aria-expanded':'false'});color.disabled=readonly;
    color.append(el('span',{'aria-hidden':'true'}));color.onclick=()=>openGroupFramePalette(frame,color,data);
    const rename=el('button',{type:'button','data-frame-rename':frame.id,'aria-label':t('frame.rename'),title:t('frame.rename')}),remove=el('button',{type:'button','data-frame-remove':frame.id,'aria-label':t('frame.remove'),title:t('frame.remove')});
    rename.append(selectionIcon('m4 16-1 5 5-1L20 8l-4-4L4 16Zm10-10 4 4'));remove.append(selectionIcon('m6 6 12 12M18 6 6 18'));
    rename.disabled=remove.disabled=readonly;rename.onclick=()=>{if(current()===data)beginGroupFrameRename(frame);};remove.onclick=()=>removeGroupFrame(frame,data);
    for(const control of [rename,remove,color])control.onpointerdown=control.ondblclick=e=>e.stopPropagation();
    heading.onpointerdown=e=>{if(current()===data)dragGroupFrame(e,frame,heading);};
    heading.ondblclick=e=>{e.preventDefault();e.stopPropagation();if(current()===data)beginGroupFrameRename(frame);};
    heading.onclick=e=>e.stopPropagation();heading.oncontextmenu=e=>e.stopPropagation();
    heading.onkeydown=e=>{if(e.target===heading&&e.key.toLowerCase()==='g'&&(e.ctrlKey||e.metaKey||e.altKey))return;e.stopPropagation();if(e.target!==heading)return;if(e.key==='Enter'||e.key===' '){e.preventDefault();selectGroupFrame(frame);}if(e.key==='F2'){e.preventDefault();beginGroupFrameRename(frame);}};
    heading.append(name,color,rename,remove);card.append(heading);layer.append(card);
  }
  positionGroupFrames();
}
