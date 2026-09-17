/* Selection actions share the existing buttons and graph transactions. */
const ARRANGE_ACTIONS=[
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
let selectionToolbarFrame=0,selectionToolbarHover=false,arrangeContext=null;
function selectionIcon(path){
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('class','ui-icon');svg.setAttribute('aria-hidden','true');
  const shape=document.createElementNS(svg.namespaceURI,'path');shape.setAttribute('d',path);svg.append(shape);return svg;
}
function selectedCanvasNodes(){return graph&&selectedEdge===null?current().nodes.filter(n=>selection.has(n.id)):[];}
function selectedCanvasBounds(){
  const rects=selectedCanvasNodes().map(n=>$('#cards').querySelector(`[data-node="${CSS.escape(n.id)}"]`)?.getBoundingClientRect()).filter(Boolean);
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
  const move=(element,host,before=null)=>{if(element.parentElement!==host)host.insertBefore(element,before);};
  const view=top.querySelector('[data-tool-group="view"]');
  move(edit,mode==='all'?bar:top,mode==='all'?bar.firstChild:view);
  move(multi,mode==='off'?top:bar,mode==='off'?view:null);
  edit.hidden=mode!=='all'&&EDITOR_DEV_SETTINGS.editToolbar===false;
  multi.hidden=!multiple;
  $('#grapharrange').disabled=!multiple||editorMutationBlocked();
  bar.hidden=mode==='off'||!nodes.length||(mode==='multiple'&&!multiple);
  bar.setAttribute('aria-label',t('selection.toolbar'));edit.setAttribute('aria-label',t('selection.editTools'));multi.setAttribute('aria-label',t('selection.multipleTools'));
  $('#grapharrange').title=t('arrange.title');$('#grapharrange').setAttribute('aria-label',t('arrange.title'));
  if(!arrangeContextMatches()||editorMutationBlocked()||!multiple)closeArrangeMenu();
  if(bar.hidden){selectionToolbarHover=false;$('#selectionbounds').hidden=true;}
  scheduleSelectionToolbarPosition();
}
function scheduleSelectionToolbarPosition(){
  if(!$('#selectiontoolbar')||selectionToolbarFrame)return;
  selectionToolbarFrame=requestAnimationFrame(()=>{selectionToolbarFrame=0;positionSelectionToolbar();});
}
function positionSelectionToolbar(){
  const bar=$('#selectiontoolbar'),outline=$('#selectionbounds');if(!bar||bar.hidden){if(outline)outline.hidden=true;return;}
  const bounds=selectedCanvasBounds(),canvas=$('#canvas'),r=canvas.getBoundingClientRect(),zoom=uiScaleFactor();
  if(!bounds||bounds.right<r.left||bounds.left>r.right||bounds.bottom<r.top||bounds.top>r.bottom){bar.style.visibility='hidden';outline.hidden=true;return;}
  bar.style.visibility='';
  const margin=8,w=canvas.clientWidth,h=canvas.clientHeight,toolbar=$('#canvas>.toolbar'),tools=$('.canvas-view-tools');
  const top=toolbar?(toolbar.getBoundingClientRect().bottom-r.top)/zoom+margin:margin;
  const bottom=tools?(tools.getBoundingClientRect().top-r.top)/zoom-margin:h-margin;
  bar.style.maxWidth=Math.max(40,w-margin*2)+'px';
  bar.style.maxHeight=Math.max(40,bottom-top)+'px';
  const x=Math.max(margin,Math.min((bounds.right-r.left)/zoom-bar.offsetWidth,w-bar.offsetWidth-margin));
  const y=Math.max(top,Math.min((bounds.top-r.top)/zoom-bar.offsetHeight-12,bottom-bar.offsetHeight));
  bar.style.left=x+'px';bar.style.top=y+'px';
  outline.hidden=!(selectionToolbarHover||bar.querySelector(':focus-visible')||$('#arrangemenu').matches(':popover-open'));
  outline.style.left=(bounds.left-r.left)/zoom-6+'px';outline.style.top=(bounds.top-r.top)/zoom-6+'px';
  outline.style.width=(bounds.right-bounds.left)/zoom+12+'px';outline.style.height=(bounds.bottom-bounds.top)/zoom+12+'px';
}
function arrangeSelection(kind){
  if(editorMutationBlocked()||!arrangeContextMatches())return false;
  const nodes=selectedCanvasNodes();if(nodes.length<2||!ARRANGE_ACTIONS.some(([key])=>key===kind))return false;
  const items=nodes.map(n=>({id:n.id,...nodeLayoutBounds(n)})),positions=new Map(items.map(n=>[n.id,{x:n.x,y:n.y}]));
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
  }else{
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
    const item=el('button',{type:'button',role:'menuitem','data-arrange':kind});item.append(selectionIcon(path),el('span',{},t('arrange.'+kind)));
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
  const canvas=$('#canvas'),top=$('.toolbar .graph-tools'),bar=el('div',{id:'selectiontoolbar',class:'selection-toolbar',role:'toolbar',hidden:''}),outline=el('div',{id:'selectionbounds',hidden:'','aria-hidden':'true'});
  const multi=el('div',{class:'graph-tool-group','data-tool-group':'selection',role:'group',hidden:''});
  const arrange=el('button',{id:'grapharrange',class:'icon-button',type:'button','aria-haspopup':'menu','aria-controls':'arrangemenu','aria-expanded':'false'});
  arrange.append(selectionIcon('M4 3v18M8 5h12v4H8zM8 11h8v3H8zM8 16h10v3H8z'));arrange.onclick=openArrangeMenu;
  multi.append($('#graphgroup'),arrange);top.insertBefore(multi,top.querySelector('[data-tool-group="view"]'));canvas.append(outline,bar);
  const menu=el('div',{id:'arrangemenu',class:'popup-menu arrangement-menu',popover:'auto',role:'menu'});document.body.append(menu);
  for(const control of [bar,menu]){
    for(const event of ['pointerdown','mousedown','touchstart','dblclick'])control.addEventListener(event,e=>e.stopPropagation());
    control.addEventListener('wheel',e=>e.stopPropagation(),{passive:true});
  }
  bar.onpointerenter=e=>{if(e.pointerType==='mouse'){selectionToolbarHover=true;scheduleSelectionToolbarPosition();}};
  bar.onpointerleave=()=>{selectionToolbarHover=false;scheduleSelectionToolbarPosition();};
  bar.addEventListener('focusin',scheduleSelectionToolbarPosition);bar.addEventListener('focusout',scheduleSelectionToolbarPosition);
  bar.addEventListener('keydown',e=>{if(e.key==='Tab')e.stopPropagation();if(['ArrowLeft','ArrowRight','ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();e.stopPropagation();const items=[...bar.querySelectorAll('button:not(:disabled)')].filter(b=>b.getClientRects().length),i=items.indexOf(document.activeElement);items[e.key==='Home'?0:e.key==='End'?items.length-1:(i+(['ArrowRight','ArrowDown'].includes(e.key)?1:-1)+items.length)%items.length]?.focus();}if(e.key==='Escape'){e.stopPropagation();$('#canvas').focus({preventScroll:true});}});
  menu.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Escape'){e.preventDefault();closeArrangeMenu();arrange.focus({preventScroll:true});}else if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();const items=[...menu.querySelectorAll('button:not(:disabled)')],i=items.indexOf(document.activeElement);items[e.key==='Home'?0:e.key==='End'?items.length-1:(i+(e.key==='ArrowDown'?1:-1)+items.length)%items.length]?.focus();}});
  menu.addEventListener('toggle',()=>{arrange.setAttribute('aria-expanded',String(menu.matches(':popover-open')));if(!menu.matches(':popover-open'))arrangeContext=null;scheduleSelectionToolbarPosition();});
  new ResizeObserver(scheduleSelectionToolbarPosition).observe(canvas);new ResizeObserver(scheduleSelectionToolbarPosition).observe($('#cards'));
  renderSelectionToolbar();
}
