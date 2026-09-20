/* Node Parameter card. All explanatory content and labels live in locales.json. */
let valueLadder=null,pendingValueLadder=null,numericPresetMenu=null,numericTouchTap=null;
document.addEventListener('pointerdown',e=>{if(e.pointerType!=='touch'||!e.isPrimary||e.target!==numericTouchTap?.entry)numericTouchTap=null;},true);
function cancelValueLadder(){pendingValueLadder?.cancel();valueLadder?.cancel();numericPresetMenu?.close();}
function openNumericPresets(entry,commit,event,{local=false}={}){
  event.preventDefault();event.stopPropagation();cancelValueLadder();
  const owner=local?null:current(),documentGraph=graph,writable=()=>entry.isConnected&&!entry.disabled&&!entry.readOnly&&(local||!editorMutationBlocked()&&graph===documentGraph&&current()===owner);
  if(!writable())return;
  const values=(entry.step==='1'?[0,1,-1]:[0,1,.5,-.5,-1]).filter(value=>(entry.min===''||value>=Number(entry.min))&&(entry.max===''||value<=Number(entry.max)));
  if(!values.length)return;
  entry.focus({preventScroll:true});if(!writable())return;
  const popup=el('div',{id:'numericpresets',popover:'auto',role:'menu','aria-label':t('numeric.presets')});
  const previousAttributes=new Map(['aria-haspopup','aria-expanded','aria-controls'].map(key=>[key,entry.getAttribute(key)]));
  const controller=new AbortController(),options={signal:controller.signal};let closed=false;
  const observer=new MutationObserver(()=>{if(!writable()||!entry.getClientRects().length)close();});
  function close(focus=false){
    if(closed)return;closed=true;controller.abort();observer.disconnect();
    if(popup.matches(':popover-open'))popup.hidePopover();popup.remove();
    if(numericPresetMenu?.entry===entry)numericPresetMenu=null;entry.numericGestureActive=false;
    for(const[key,value]of previousAttributes){if(value===null)entry.removeAttribute(key);else entry.setAttribute(key,value);}
    if(focus&&entry.isConnected&&!entry.disabled)entry.focus({preventScroll:true});
  }
  numericPresetMenu={entry,close};entry.numericGestureActive=true;
  entry.setAttribute('aria-haspopup','menu');entry.setAttribute('aria-controls','numericpresets');entry.setAttribute('aria-expanded','true');
  for(const value of values){
    const button=el('button',{type:'button',role:'menuitemradio','data-numeric-preset':value,'aria-checked':String(entry.value.trim()!==''&&Number(entry.value)===value),tabindex:'-1'},String(value));
    button.onclick=()=>{if(!writable()){close();return;}entry.value=String(value);entry.refreshNumericSlider?.();close(true);commit();};popup.append(button);
  }
  document.body.append(popup);popup.showPopover();
  const rect=entry.getBoundingClientRect(),zoom=uiScaleFactor(),x=event.clientX||rect.left,y=event.clientY||rect.bottom;
  Object.assign(popup.style,{left:Math.max(8,Math.min(x/zoom,innerWidth/zoom-popup.offsetWidth-8))+'px',top:Math.max(8,Math.min(y/zoom,innerHeight/zoom-popup.offsetHeight-8))+'px'});
  const buttons=[...popup.querySelectorAll('button')];(buttons.find(button=>button.getAttribute('aria-checked')==='true')||buttons[0]).focus({preventScroll:true});
  popup.addEventListener('keydown',e=>{
    e.stopPropagation();const index=buttons.indexOf(document.activeElement);
    if(e.key==='Escape'){e.preventDefault();close(true);}
    else if(e.key==='Tab'){e.preventDefault();close(true);}
    else if(['ArrowUp','ArrowDown','Home','End'].includes(e.key)){e.preventDefault();buttons[e.key==='Home'?0:e.key==='End'?buttons.length-1:(index+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length].focus({preventScroll:true});}
  },options);
  popup.addEventListener('contextmenu',e=>e.preventDefault(),options);
  popup.addEventListener('toggle',e=>{if(e.newState==='closed')close();},options);
  document.addEventListener('pointerdown',e=>{
    if(popup.contains(e.target)||e.target===entry)return;
    // Dismiss this menu without blurring and committing an unfinished field.
    e.preventDefault();e.stopImmediatePropagation();
    const consume=click=>{click.preventDefault();click.stopImmediatePropagation();};
    document.addEventListener('click',consume,{capture:true,once:true});setTimeout(()=>document.removeEventListener('click',consume,true),400);
    close(true);
  },{...options,capture:true});
  window.addEventListener('resize',()=>close(),options);window.addEventListener('blur',e=>{if(e.target===window)close();},options);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)close();},options);
  observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','readonly','hidden']});
}
function beginValueLadder(entry,e,adapter){
  const button=e.button,mask=button===1?4:button===2?2:1;
  e.preventDefault();e.stopPropagation();cancelValueLadder();
  const owner=adapter.local?null:current(),documentGraph=graph;
  const writable=()=>entry.isConnected&&(adapter.local||!editorMutationBlocked()&&graph===documentGraph&&current()===owner)&&(!adapter.writable||adapter.writable());
  if(!writable()||!Number.isFinite(adapter.read()))return;
  if(adapter.focus!==false&&e.pointerType!=='touch')entry.focus({preventScroll:true});if(!writable())return;
  const initialValue=adapter.read(),steps=adapter.integer?[100,10,1]:[10,1,.1,.01,.001];
  const popup=el('div',{id:'valueladder',role:'tooltip'}),rows=el('div',{class:'ladder-rows'});
  const readout=el('div',{class:'ladder-readout'}),number=el('output',{class:'ladder-value'}),increment=el('span',{class:'ladder-step'});
  readout.append(number,increment);
  for(const step of steps)rows.append(el('div',{'data-step':step},String(step)));
  popup.append(rows,readout);document.body.append(popup);
  const uiZoom=uiScaleFactor(),rowHeight=rows.firstChild.getBoundingClientRect().height,popupRect=popup.getBoundingClientRect(),entryRect=entry.getBoundingClientRect();
  const position=(x,y,width=popupRect.width,height=popupRect.height)=>{
    popup.style.left=Math.max(8,Math.min(x,innerWidth-width-8))/uiZoom+'px';
    popup.style.top=Math.max(8,Math.min(y,innerHeight-height-8))/uiZoom+'px';
  };
  const centerOffset=rows.children[2].getBoundingClientRect().top-popupRect.top+rowHeight/2;
  position(e.clientX-popupRect.width/2,e.clientY-centerOffset);
  const fullRect=popup.getBoundingClientRect(),rowsTop=rows.getBoundingClientRect().top,rowsBottom=rowsTop+steps.length*rowHeight;
  const indexAt=y=>Math.max(0,Math.min(steps.length-1,Math.floor((y-rowsTop)/rowHeight)));
  let index=2,anchorX=e.clientX,base=initialValue,value=initialValue,finished=false,compact=false,selectionEngaged=false;
  const oldDescription=entry.getAttribute('aria-describedby');entry.setAttribute('aria-describedby','valueladder');entry.numericGestureActive=true;adapter.begin?.();if(e.pointerType==='touch')entry.beginNumericEdit?.();
  const oldTitle=entry.getAttribute('title');entry.removeAttribute('title');
  document.body.classList.add('scrubbing-value');entry.classList.add('scrubbing');
  const paint=()=>{
    [...rows.children].forEach((row,i)=>row.classList.toggle('active',i===index));popup.classList.toggle('ladder-compact',compact);
    number.textContent=adapter.format?adapter.format(value):String(value);increment.textContent='Δ '+steps[index];
    if(compact){const badge=popup.getBoundingClientRect(),gap=4*uiZoom,above=entryRect.top-badge.height-gap;position(entryRect.right-badge.width,above>=8?above:entryRect.bottom+gap,badge.width,badge.height);}
    else position(fullRect.left,fullRect.top);
  };paint();
  const controller=new AbortController(),options={capture:true,signal:controller.signal};
  const observer=new MutationObserver(()=>{if(!writable()||!entry.getClientRects().length)finish(false);});
  function finish(accept){
    if(finished)return;finished=true;controller.abort();observer.disconnect();valueLadder=null;
    const allowed=accept&&writable();if(allowed)adapter.preview(value);else adapter.restore();entry.numericGestureActive=false;adapter.end?.();
    const liveHandled=entry.onNumericFinish?.(allowed);
    popup.remove();document.body.classList.remove('scrubbing-value');entry.classList.remove('scrubbing');
    if(oldDescription===null)entry.removeAttribute('aria-describedby');else entry.setAttribute('aria-describedby',oldDescription);
    if(oldTitle!==null)entry.setAttribute('title',oldTitle);
    if(entry.hasPointerCapture(e.pointerId))entry.releasePointerCapture(e.pointerId);
    if(!liveHandled&&allowed&&value!==initialValue)adapter.commit(value);
    if(e.pointerType==='touch'){entry.endNumericEdit?.();document.activeElement?.beginNumericEdit?.();}
  }
  function move(ev){
    if(ev.pointerId!==e.pointerId)return;
    if(!(ev.buttons&mask)||!writable()){finish(false);return;}
    ev.preventDefault();ev.stopPropagation();
    // Once horizontal adjustment begins, this gesture keeps its increment.
    // The hidden list no longer participates in pointer hit testing.
    if(!compact){
      const inGrid=ev.clientX>=fullRect.left&&ev.clientX<=fullRect.right&&ev.clientY>=rowsTop&&ev.clientY<rowsBottom;
      // Edge clamping must not change the initial 0.1 on horizontal movement.
      if(Math.abs(ev.clientY-e.clientY)>3)selectionEngaged=true;
      const next=inGrid&&selectionEngaged?indexAt(ev.clientY):index;
      if(next!==index){index=next;base=value;anchorX=ev.clientX;paint();return;}
    }
    const ticks=Math.trunc((ev.clientX-anchorX)/8),candidate=base+ticks*steps[index];
    if(Math.abs(ev.clientX-anchorX)>=8)compact=true;
    if(!Number.isFinite(candidate))return;
    value=ticks?Number(candidate.toPrecision(15)):base;
    if(Number.isFinite(adapter.min))value=Math.max(adapter.min,value);
    if(Number.isFinite(adapter.max))value=Math.min(adapter.max,value);
    const range=adapter.range;
    if(range)value=Math.max(range.min,Math.min(range.max,Number((range.min+Math.round((value-range.min)/range.step)*range.step).toPrecision(15))));
    adapter.preview(value);paint();
  }
  valueLadder={entry,cancel:()=>finish(false)};
  window.addEventListener('pointermove',move,options);
  window.addEventListener('pointerup',ev=>{if(ev.pointerId===e.pointerId&&ev.button===button){ev.preventDefault();ev.stopPropagation();finish(true);}},options);
  window.addEventListener('pointercancel',ev=>{if(ev.pointerId===e.pointerId)finish(false);},options);
  window.addEventListener('pointerdown',()=>finish(false),options);
  entry.addEventListener('lostpointercapture',ev=>{if(ev.pointerId===e.pointerId&&!entry.hasPointerCapture(e.pointerId))finish(false);},options);
  entry.addEventListener('blur',()=>finish(false),options);
  window.addEventListener('blur',()=>finish(false),options);
  window.addEventListener('resize',()=>finish(false),options);
  document.addEventListener('scroll',ev=>{if(ev.target.contains?.(entry))finish(false);},options);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)finish(false);},options);
  window.addEventListener('keydown',ev=>{if(ev.key==='Escape'){ev.preventDefault();ev.stopImmediatePropagation();finish(false);}else if(ev.key==='Tab')finish(false);else {ev.preventDefault();ev.stopImmediatePropagation();}},options);
  window.addEventListener('contextmenu',ev=>{ev.preventDefault();ev.stopPropagation();},options);
  observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','readonly','hidden']});
  try{if(!entry.hasPointerCapture(e.pointerId))entry.setPointerCapture(e.pointerId);}catch{finish(false);}
}

function installValueLadder(entry,commit,{local=false}={}){
  const blocked=()=>!local&&editorMutationBlocked();
  entry.title=t('ladder.hint');
  entry.classList.add('numeric-slider');
  const paintSlider=()=>{
    const value=Number(entry.value),valid=entry.value.trim()!==''&&Number.isFinite(value),magnitude=valid?Math.abs(value):0;
    let fraction=magnitude;
    // Decimal leading digits avoid overflowing the next decade for large finite values.
    if(magnitude>1){const leading=Number(magnitude.toExponential().split('e')[0]);fraction=leading===1?1:leading/10;}
    const range=entry.numericRange,proportion=range?(valid?Math.max(0,Math.min(1,(value-range.min)/(range.max-range.min))):0):valid&&value<0?1-fraction:fraction;
    entry.style.setProperty('--numeric-fill',Number((proportion*100).toFixed(6))+'%');
    entry.onNumericPreview?.();
  };
  entry.refreshNumericSlider=paintSlider;paintSlider();
  entry.addEventListener('input',paintSlider);entry.addEventListener('change',paintSlider);
  if(entry.setSyncedValue){const sync=entry.setSyncedValue;entry.setSyncedValue=value=>{sync(value);paintSlider();};}
  function beginScrub(e,firstMove){
    const owner=local?null:current(),documentGraph=graph;
    const writable=()=>entry.isConnected&&!entry.disabled&&!entry.readOnly&&(local||!editorMutationBlocked()&&graph===documentGraph&&current()===owner);
    if(!writable()||!entry.value.trim()||!Number.isFinite(Number(entry.value)))return;
    if(e.pointerType!=='touch')entry.focus({preventScroll:true});if(!writable())return;
    const initial=entry.value,initialValue=Number(initial),integer=entry.step==='1',range=entry.numericRange;
    const dragWidth=Math.max(1,entry.getBoundingClientRect().width);
    // Unwrap the repeating fill into continuous travel: 1 -> 10, 10 -> 19,
    // 100 -> 28. Integer band widths avoid drift at exact decimal boundaries.
    // Adding mouse travel here follows every crossed range, even within one event.
    const dragPosition=value=>{
      const magnitude=Math.abs(value);if(magnitude<=1)return value*10;
      const [digits,power]=magnitude.toExponential().split('e'),leading=Number(digits);
      const decade=Number(power)+(leading===1?0:1),fraction=leading===1?1:leading/10;
      return Math.sign(value)*(9*decade+fraction*10);
    };
    const dragValue=position=>{
      const distance=Math.abs(position),decade=distance<=10?0:Math.min(309,Math.ceil((distance-10)/9));
      // Scientific notation keeps the conceptual 1e309 range usable for finite
      // values above 1e308 without ever constructing an infinite range width.
      return {value:Number((Math.sign(position)*(distance-9*decade))+'e'+(decade-1)),decade};
    };
    const decimalPlaces=value=>{const [digits,exponent='0']=String(value).toLowerCase().split('e');return Math.max(0,(digits.split('.')[1]?.length||0)-Number(exponent));};
    let value=initialValue,baseValue=initialValue,boundedValue=initialValue,deltaUnits=0,segmentPixels=0,segmentTicks=0,sensitivity='',lastX=e.clientX,finished=false;
    entry.numericGestureActive=true;entry.onNumericBegin?.();if(e.pointerType==='touch')entry.beginNumericEdit?.();document.body.classList.add('scrubbing-value');entry.classList.add('scrubbing','numeric-dragging');
    const controller=new AbortController(),options={capture:true,signal:controller.signal};
    const observer=new MutationObserver(()=>{if(!writable()||!entry.getClientRects().length)finish(false);});
    function finish(accept){
      if(finished)return;finished=true;controller.abort();observer.disconnect();valueLadder=null;
      const allowed=accept&&writable();entry.value=allowed?String(integer?Math.round(value):value):initial;paintSlider();
      entry.numericGestureActive=false;document.body.classList.remove('scrubbing-value');entry.classList.remove('scrubbing','numeric-dragging');
      const liveHandled=entry.onNumericFinish?.(allowed);
      if(entry.hasPointerCapture(e.pointerId))entry.releasePointerCapture(e.pointerId);
      if(!liveHandled&&allowed&&Number(entry.value)!==initialValue)commit();
      // A drag leaves the control ready for another drag. A click instead enters text editing.
      if(document.activeElement===entry)entry.blur();
      if(e.pointerType==='touch'){entry.endNumericEdit?.();document.activeElement?.beginNumericEdit?.();}
    }
    function move(ev){
      if(ev.pointerId!==e.pointerId)return;
      if(!(ev.buttons&1)||!writable()){finish(false);return;}
      ev.preventDefault();ev.stopPropagation();
      if(range){
        const sensitivity=ev.ctrlKey?(ev.shiftKey?.01:10):ev.shiftKey?.1:1;
        boundedValue=Math.max(range.min,Math.min(range.max,boundedValue+(ev.clientX-lastX)/dragWidth*(range.max-range.min)*sensitivity));lastX=ev.clientX;
        value=Math.max(range.min,Math.min(range.max,Number((range.min+Math.round((boundedValue-range.min)/range.step)*range.step).toPrecision(15))));
        entry.value=String(value);paintSlider();return;
      }
      const units=integer?10000:ev.ctrlKey?(ev.shiftKey?1:1000):ev.shiftKey?10:100;
      const pixelsPerStep=integer?(ev.ctrlKey?1:ev.shiftKey?100:10):dragWidth/1000,key=units+':'+pixelsPerStep;
      // Retain completed steps when modifiers change, without carrying a partial
      // coarse step into a finer sensitivity and causing an unexpected jump.
      if(key!==sensitivity){segmentPixels=0;segmentTicks=0;sensitivity=key;}
      segmentPixels+=ev.clientX-lastX;lastX=ev.clientX;
      const travel=segmentPixels/pixelsPerStep;
      const ticks=integer?Math.trunc(travel):Math.sign(travel)*Math.round(Math.abs(travel)),change=ticks-segmentTicks;
      if(!change)return;segmentTicks=ticks;deltaUnits+=change*units;
      const travelled=integer?{value:baseValue+deltaUnits/10000,decade:0}:dragValue(dragPosition(baseValue)+deltaUnits/10000);
      const precision=Math.min(100,Math.max(integer?4:5-travelled.decade,decimalPlaces(baseValue)));
      const candidate=deltaUnits===0?baseValue:Number(travelled.value.toFixed(precision));
      if(Number.isNaN(candidate))return;
      value=Number.isFinite(candidate)?candidate:Math.sign(candidate)*Number.MAX_VALUE;
      if(entry.min!==''&&Number.isFinite(Number(entry.min)))value=Math.max(Number(entry.min),value);
      if(entry.max!==''&&Number.isFinite(Number(entry.max)))value=Math.min(Number(entry.max),value);
      if(value!==candidate){baseValue=value;deltaUnits=0;segmentPixels=0;segmentTicks=0;}
      entry.value=String(integer?Math.round(value):value);paintSlider();
    }
    valueLadder={entry,cancel:()=>finish(false)};
    window.addEventListener('pointermove',move,options);
    window.addEventListener('pointerup',ev=>{if(ev.pointerId===e.pointerId&&ev.button===0){ev.preventDefault();ev.stopPropagation();finish(true);}},options);
    window.addEventListener('pointercancel',ev=>{if(ev.pointerId===e.pointerId)finish(false);},options);
    window.addEventListener('pointerdown',()=>finish(false),options);
    // An input's inner control may transfer its implicit touch capture to the host.
    entry.addEventListener('lostpointercapture',ev=>{if(ev.pointerId===e.pointerId&&!entry.hasPointerCapture(e.pointerId))finish(false);},options);entry.addEventListener('blur',()=>finish(false),options);
    window.addEventListener('blur',()=>finish(false),options);window.addEventListener('resize',()=>finish(false),options);
    document.addEventListener('scroll',ev=>{if(ev.target.contains?.(entry))finish(false);},options);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)finish(false);},options);
    window.addEventListener('keydown',ev=>{
      if(ev.key==='Escape'){ev.preventDefault();ev.stopImmediatePropagation();finish(false);}
      else if(ev.key==='Tab')finish(false);
      else if(!['Shift','Control','Alt','Meta'].includes(ev.key)){ev.preventDefault();ev.stopImmediatePropagation();}
    },options);
    window.addEventListener('contextmenu',ev=>{ev.preventDefault();ev.stopPropagation();},options);
    observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','readonly','hidden']});
    try{if(!entry.hasPointerCapture(e.pointerId))entry.setPointerCapture(e.pointerId);move(firstMove);}catch{finish(false);}
  }
  entry.addEventListener('mousedown',e=>{if(e.button===1)e.preventDefault();});
  entry.addEventListener('auxclick',e=>{if(e.button===1)e.preventDefault();});
  function beginLadder(e){
    cancelValueLadder();const initial=entry.value;
    if(!initial.trim()||!Number.isFinite(Number(initial)))return;
    beginValueLadder(entry,e,{
      local,
      begin:()=>entry.onNumericBegin?.(),
      read:()=>Number(entry.value),integer:entry.step==='1',min:entry.min===''?-Infinity:Number(entry.min),max:entry.max===''?Infinity:Number(entry.max),range:entry.numericRange,
      writable:()=>!entry.disabled&&!entry.readOnly,
      preview:value=>{entry.value=String(value);paintSlider();},restore:()=>{entry.value=initial;paintSlider();},commit,
      end:()=>{if(e.button===2||e.pointerType==='touch')suppressContextUntil=performance.now()+400;}
    });
  }
  let suppressContextUntil=0;
  entry.addEventListener('contextmenu',e=>{if(performance.now()<suppressContextUntil||e.altKey){e.preventDefault();e.stopPropagation();return;}openNumericPresets(entry,commit,e,{local});});
  entry.addEventListener('pointerdown',e=>{
    const touch=e.pointerType==='touch';
    if(touch&&!e.isPrimary){e.preventDefault();e.stopPropagation();return;}
    if(!touch&&(e.button===1||(e.button===2&&e.altKey))){suppressContextUntil=performance.now()+1200;beginLadder(e);return;}
    if(e.button!==0||e.metaKey||e.altKey||entry.disabled||entry.readOnly||blocked())return;
    cancelValueLadder();
    const textEditing=document.activeElement===entry,canScrub=!textEditing&&entry.value.trim()&&Number.isFinite(Number(entry.value));
    // Once explicitly editing, leave caret placement and selection to the browser.
    if(touch&&textEditing){numericTouchTap=null;return;}
    if(touch||canScrub){e.preventDefault();e.stopPropagation();}
    const controller=new AbortController(),options={capture:true,signal:controller.signal},scroller=entry.closest('.panel-scroll'),inlineCanvas=touch&&entry.closest('#canvas');
    const sx=e.clientX,sy=e.clientY,scrollTop=scroller?.scrollTop||0,initialPan=inlineCanvas?{...pan}:null;let moved=false,done=false,timer;
    const previousTap=touch?numericTouchTap:null;numericTouchTap=null;
    const cleanup=()=>{if(done)return;done=true;clearTimeout(timer);controller.abort();if(pendingValueLadder?.entry===entry)pendingValueLadder=null;};
    pendingValueLadder={entry,cancel:cleanup};
    timer=setTimeout(()=>{cleanup();if(!entry.isConnected||entry.disabled||entry.readOnly||!entry.getClientRects().length)return;beginLadder(e);},450);
    window.addEventListener('pointermove',ev=>{if(ev.pointerId!==e.pointerId)return;
      const dx=ev.clientX-sx,dy=ev.clientY-sy;
      if(canScrub&&(!touch||!moved)&&(touch?Math.hypot(dx,dy)>8:Math.abs(dx)>4)&&Math.abs(dx)>=Math.abs(dy)){cleanup();beginScrub(e,ev);return;}
      if(Math.hypot(ev.clientX-sx,ev.clientY-sy)>8){moved=true;clearTimeout(timer);if(!touch){cleanup();return;}}
      if(touch){ev.preventDefault();ev.stopPropagation();if(moved&&scroller)scroller.scrollTop=scrollTop-(ev.clientY-sy)/uiScaleFactor();
        else if(moved&&inlineCanvas){moveCanvas({x:initialPan.x+(ev.clientX-sx)/uiScaleFactor(),y:initialPan.y+(ev.clientY-sy)/uiScaleFactor()});}}
    },options);
    window.addEventListener('pointerup',ev=>{
      if(ev.pointerId!==e.pointerId)return;cleanup();
      if(touch||canScrub){
        ev.preventDefault();ev.stopPropagation();
        if(!moved&&entry.isConnected&&!entry.disabled&&!entry.readOnly&&!blocked()){
          if(!touch)entry.focus({preventScroll:true});
          else if(previousTap?.entry===entry&&performance.now()-previousTap.time<=350&&Math.hypot(sx-previousTap.x,sy-previousTap.y)<=24)entry.focus({preventScroll:true});
          else numericTouchTap={entry,time:performance.now(),x:sx,y:sy};
        }
      }
    },options);
    window.addEventListener('pointercancel',cleanup,options);window.addEventListener('pointerdown',cleanup,options);window.addEventListener('blur',cleanup,options);
    window.addEventListener('keydown',ev=>{if(!canScrub||!['Shift','Control'].includes(ev.key))cleanup();},options);document.addEventListener('visibilitychange',()=>{if(document.hidden)cleanup();},options);
  });
}

let workspaceLayout=null;
function installInspectorPanels(){workspaceLayout=installPanelWorkspace();}
let inspectorTab='parameters',inspectorScope='node';
let uniformSnapshot={revision:-1,uniforms:{}},uniformPolling=false,uniformSyncError='',uniformPreviewSignature='';
const liveParameterRow=id=>uniformSnapshot.uniforms[id]||uniformSnapshot.textures?.[id];
let uniformWrites=Promise.resolve();
let uniformGeneration=0;
const uniformPending=new Map(),uniformReadbacks=new Set();

function updateUniformFields(forceKeys=new Set()){
  for(const section of document.querySelectorAll('.uniform-live')){
    const id=section.dataset.declaration,row=liveParameterRow(id);
    const ready=!!row&&uniformSnapshot.revision===revision&&!dirty&&!submitBusy&&!editorMutationBlocked(true);
    for(const entry of section.querySelectorAll('[data-component]')){
      const index=Number(entry.dataset.component),item=row?.components[index],key=id+':'+index,pending=uniformPending.has(key);
      entry.disabled=readonly||!ready||!item?.writable||pending||uniformReadbacks.has(key);
      if(item&&!entry.numericGestureActive&&(document.activeElement!==entry||forceKeys.has(key))&&!pending){
        entry.setSyncedValue(item.value);
        entry.uniformExpected={revision:uniformSnapshot.revision,...item};
      }
      if(item&&!entry.uniformExpected)entry.uniformExpected={revision:uniformSnapshot.revision,...item};
      entry.closest('.field').querySelector('.uniform-mode').textContent=item?.mode&&item.mode!=='CONSTANT'?item.mode:'';
    }
    const driven=row?.components.some(c=>!c.writable),message=section.querySelector('.uniform-sync-state');
    message.textContent=uniformSyncError||(!ready?t(!row&&uniformSnapshot.revision===revision&&!dirty&&!submitBusy?'parameter.unused':'uniform.waiting'):row.type==='sampler2D'?(row.sourceStatus==='connected'&&!row.defaultValid?t('texture.backupInvalid'):row.sourceStatus==='invalid'||!row.defaultValid?t('texture.invalid'):row.sourceStatus==='connected'?t('texture.connected'):driven?t('uniform.driven'):t('uniform.synced')):driven?t('uniform.driven'):t('uniform.synced'));
    const source=section.querySelector('.texture-effective');if(source)source.textContent=row?.effectiveSource?t('texture.effective')+' · '+(textureOptions().find(([value])=>value===row.effectiveSource)?.[1]||row.effectiveSource):'';
    message.classList.toggle('error',!!uniformSyncError||row?.sourceStatus==='invalid'||row?.defaultValid===false);
  }
}

async function refreshUniforms(){
  if(!graph||(typeof savedStateIssue!=='undefined'&&savedStateIssue)||uniformPolling||uniformPending.size||historyBusy||nativeMutationBusy||document.hidden)return;
  const visible=el=>el&&el.getClientRects().length>0&&!el.closest('details:not([open])');
  if(!visible($('.uniform-live'))&&(!autoPreview||!visible($('#preview'))))return;
  uniformPolling=true;
  const generation=uniformGeneration,loadGeneration=editorLoadGeneration;
  try{
    const incoming=await api('uniforms');
    if(generation!==uniformGeneration||loadGeneration!==editorLoadGeneration)return;
    uniformSnapshot=incoming;uniformSyncError=incoming.revision!==revision&&!dirty&&!submitBusy?t('uniform.graphChanged'):'';
    const recovered=new Set(uniformReadbacks);uniformReadbacks.clear();updateUniformFields(recovered);
    const signature=JSON.stringify([Object.fromEntries(Object.entries(uniformSnapshot.uniforms).map(([id,row])=>[id,row.components.map(c=>c.value)])),uniformSnapshot.textures]);
    if(autoPreview&&(signature!==uniformPreviewSignature||(editorTarget==='top'&&performance.now()-lastPreviewAt>=1000))&&visible($('#preview'))){uniformPreviewSignature=signature;await preview();}
  }catch(e){if(loadGeneration===editorLoadGeneration){uniformSyncError=t('uniform.offline');updateUniformFields();}}
  finally{if(loadGeneration===editorLoadGeneration)uniformPolling=false;}
}

function startUniformSync(){
  const tick=async()=>{await refreshUniforms();setTimeout(tick,500);};tick();
}

function writeUniformInput(entry,value){
  const id=entry.closest('.uniform-live').dataset.declaration,index=Number(entry.dataset.component),key=id+':'+index;
  if(editorMutationBlocked()||submitBusy||dirty||uniformPending.has(key)||uniformReadbacks.has(key))return;
  const generation=editorLoadGeneration,before=clone(graph),nativeBefore=uniformSnapshot.history?.token||nativeSourceSnapshot?.history?.token||historyNativeToken;
  uniformGeneration++;uniformPending.set(key,1);nativeMutationBusy=true;nativeValueBusy=true;clearTimeout(autoTimer);autoTimer=null;renderGraphEditActions();updateUniformFields();
  uniformWrites=uniformWrites.then(async()=>{
    if(generation!==editorLoadGeneration)return;
    try{
      const expected=entry.uniformExpected;
      if(!expected)throw Error(t('uniform.waiting'));
      const result=await api('uniform-value',{declarationId:id,component:index,value,revision:expected.revision,expected});
      if(generation!==editorLoadGeneration)return;
      uniformSnapshot=result;if(result.history?.token)historyNativeToken=result.history.token;
      recordHistory({kind:'value',before,after:clone(graph),nativeBefore:result.history?.beforeToken||nativeBefore,nativeAfter:result.history?.token||null,nativeApplied:true,sourceIds:[],valueIds:[id]});
      const item=liveParameterRow(id)?.components[index];
      if(item){entry.setSyncedValue(item.value);entry.uniformExpected={revision:uniformSnapshot.revision,...item};}
      uniformSyncError='';status(t(entry.dataset.texture?'texture.updated':'uniform.updated'),false,{clearError:'operation'});await preview();
    }catch(e){
      if(generation!==editorLoadGeneration)return;
      // A rejected write must read TD back before this field can accept another edit.
      uniformReadbacks.add(key);entry.uniformExpected=null;uniformSyncError=e.message;status(e.message,true);
    }
    finally{
      if(generation!==editorLoadGeneration)return;
      const remaining=uniformPending.get(key)-1;
      if(remaining)uniformPending.set(key,remaining);else uniformPending.delete(key);
      nativeMutationBusy=false;nativeValueBusy=false;renderGraphEditActions();updateUniformFields();if(uniformReadbacks.size)refreshUniforms();scheduleGraphApply();
    }
  });
}

function liveUniformFields(decl){
  const section=el('section',{class:'uniform-live','data-declaration':decl.id});
  const texture=decl.kind==='sampler';section.append(el('h4',{},t(texture?'texture.current':'uniform.current')));
  const components=texture?['']:Array.isArray(decl.value)?decl.value:[decl.value],box=el('div',{class:'components'+(components.length===1?' scalar':'')});
  box.style.setProperty('--component-count',components.length);
  components.forEach((value,index)=>{
    const commit=next=>writeUniformInput(entry,next),entry=texture?input('',commit):typedScalarInput('',typeFamily(decl.type),commit);if(texture){entry.dataset.texture='true';entry.placeholder=t('texture.currentEmpty');}
    entry.dataset.component=index;entry.disabled=true;
    entry.setAttribute('aria-label',t(texture?'texture.current':'uniform.current')+(components.length===1?'':' '+'XYZW'[index]));
    const row=field('',entry),label=el('span',{class:'component-label','aria-hidden':'true'},components.length===1?decl.type:'XYZW'[index]);
    if(components.length>1){applyComponentColorHint(label,index);applyComponentColorHint(entry,index);}row.prepend(label);
    row.append(el('small',{class:'uniform-mode'}));box.append(row);
  });
  section.append(box,el('p',{class:'muted uniform-sync-state'},t('uniform.waiting')));if(texture)section.append(el('p',{class:'muted texture-effective'}));return section;
}

function defaultInput(n,port,type){
  if(isResourceType(type)||isCompositeType(type))return null;
  if(n.inputValues && Object.hasOwn(n.inputValues,port))return clone(n.inputValues[port]);
  const key=definition(n)?.key;
  if(key==='array_create'&&port==='length')return n.params.length??4;
  if(['matrix_combine','matrix_replace'].includes(key)){
    if(port==='value')return null;
    const match=/^c([0-3])([xyzw])?$/.exec(port);
    if(match){const values=matrixColumnValues(n,Number(match[1]));return match[2]?values['xyzw'.indexOf(match[2])]:values;}
  }
  if(['combine','replace'].includes(key)&&port!=='value'){const start='xyzw'.indexOf(port),values=(n.params.components||[0,0,0,0]).slice(start,start+typeComponents(type));return shapedValue(values,type);}
  if(key==='replace'&&port==='value')return null;
  if(key==='function_call')return clone(FunctionModel.find(graph,n.params.functionId)?.inputs.find(p=>p.id===port)?.default??0);
  if(key==='function_output')return clone(currentFunction()?.outputs.find(p=>p.id===port)?.default??0);
  if(['texture','texture_sample'].includes(key)&&port==='uv')return null;
  if(key==='pixel_out'&&editorTarget==='mat')return [0,0,0,0];
  if(key==='pixel_out'||key==='vertex_out')return [0,0,0,1];
  const value=definition(n)?.inputDefaults?.[port]??(port==='factor'?.5:port==='alpha'?1:0);
  if(isArithmetic(definition(n))&&isMatrixType(type))return key==='multiply'?filledValue(type,1):Array(typeComponents(type)).fill(value);
  if(isConvertOperation(definition(n))&&isMatrixType(type))return filledValue(type,1);
  return filledValue(type,value);
}

function setPixelBufferCount(n,count){
  const spec=typeContract?.pixelBufferOutputs;
  if(readonly||editorTarget!=='mat'||definition(n)?.key!=='pixel_out'||!spec||!Number.isInteger(count)||count<1||count>spec.ports.length)return false;
  return change(()=>{
    const removed=spec.ports.slice(count);
    n.ui||={};const cache=n.ui.bufferInputValues||={};
    for(const port of removed)if(Object.hasOwn(n.inputValues||{},port)){cache[port]=clone(n.inputValues[port]);delete n.inputValues[port];}
    for(const port of spec.ports.slice(0,count))if(Object.hasOwn(cache,port)&&!Object.hasOwn(n.inputValues||{},port)){n.inputValues||={};n.inputValues[port]=clone(cache[port]);}
    n.params.bufferCount=count;
  },{typeChange:true});
}
function pixelBufferFields(box,n){
  if(editorTarget!=='mat'||definition(n)?.key!=='pixel_out'||!typeContract?.pixelBufferOutputs)return;
  const entry=select(typeContract.pixelBufferOutputs.ports.map((_,i)=>[String(i+1),String(i+1)]),String(n.params.bufferCount??1),value=>setPixelBufferCount(n,Number(value)));
  entry.dataset.pixelBufferCount=n.id;entry.disabled=readonly;
  entry.title=t('pixel.buffersHint');box.append(parameterControlRow(t('pixel.bufferCount'),entry));
}

function pixelBufferNames(box,n){
  if(editorTarget!=='mat'||definition(n)?.key!=='pixel_out'||!typeContract?.pixelBufferOutputs)return;
  const group=el('div',{class:'buffer-names'});
  for(const [index,port]of typeContract.pixelBufferOutputs.ports.slice(0,n.params.bufferCount??1).entries()){
    const entry=input(n.ui?.bufferLabels?.[port]||'',value=>{
      const label=value.trim();if(label.length>80||/[\x00-\x1f\x7f]/.test(label)){status(t('node.labelInvalid'),true);return;}
      change(()=>{n.ui||={};n.ui.bufferLabels||={};if(label)n.ui.bufferLabels[port]=label;else delete n.ui.bufferLabels[port];},{localize:false});
    });entry.placeholder='Buffer '+index;entry.maxLength=80;entry.dataset.bufferLabel=port;entry.disabled=readonly;
    group.append(field('Buffer '+index,entry));
  }
  box.append(group);
}

// Shared scalar controls keep graph defaults, declarations and live TD values
// consistent. Integer parsing stays exact through the complete 32-bit range.
function typedScalarInput(value,family,commit){
  if(family==='bool'){
    const entry=select([['false','false'],['true','true']],String(!!value),next=>commit(next==='true'));
    entry.setSyncedValue=next=>{entry.value=String(!!next);};return entry;
  }
  const entry=input(value,commit,'number');entry.validateValue=next=>validScalarValue(next,family);
  if(family==='int'||family==='uint'){
    entry.step='1';entry.min=family==='uint'?'0':'-2147483648';entry.max=family==='uint'?'4294967295':'2147483647';
    entry.refreshNumericSlider?.();
  }
  return entry;
}
function componentGrid(count){
  const box=el('div',{class:'components'+(count===1?' scalar':'')});
  box.style.setProperty('--component-count',count);return box;
}
function componentField(entry,index,count,label,labels='XYZW'){
  const row=field('',entry),caption=el('span',{class:'component-label','aria-hidden':'true'},count>1?labels[index]:label);
  if(count>1){applyComponentColorHint(caption,index,labels==='RGBA');applyComponentColorHint(entry,index,labels==='RGBA');}
  row.prepend(caption);return row;
}
function numbers(value,label,callback,disabled=false,labels='XYZW',type=null){
  const shape=typeContract?.types?.[type];
  if(shape?.shape==='matrix'){
    const box=el('div',{class:'matrix-parameter-values'}),values=shapedValue(value,type);
    for(let column=0;column<shape.columns;column++){
      const group=el('section',{class:'matrix-parameter-column'}),name=t('matrix.column').replace('{index}',column),start=column*shape.rows;
      group.append(el('div',{class:'parameter-value-label'},name),numbers(values.slice(start,start+shape.rows),label+' · '+name,next=>{const updated=values.slice();updated.splice(start,shape.rows,...next);callback(updated);},disabled,labels,typeForShape(shape.family,shape.rows)));
      box.append(group);
    }
    return box;
  }
  const values=Array.isArray(value)?value:[value],box=componentGrid(values.length);
  const family=type?typeFamily(type):typeof values[0]==='boolean'?'bool':'float';
  values.forEach((v,index)=>{
    const entry=typedScalarInput(v,family,next=>{
      const updated=values.slice();updated[index]=next;
      callback(Array.isArray(value)?updated:next);
    });
    entry.setAttribute('aria-label',label+(values.length>1?' '+labels[index]:''));
    entry.disabled=disabled||readonly;
    box.append(componentField(entry,index,values.length,label,labels));
  });
  return box;
}

// Parameter presentation is local to this pane; expanding components does not
// change the graph or the canvas node's independent presentation state.
const parameterExpansions=new WeakMap();
let parameterValueEdit=null;
// All ordinary Parameter controls share these columns, including untyped fields
// and action rows. Full-width editors keep their explicit specialized layout.
function parameterHint(text,className=''){
  return el('small',{class:'muted parameter-hint'+(className?' '+className:''),title:text},text);
}
function parameterControlRow(label,control,type=''){
  const row=el(control.matches('input,select,textarea')?'label':'div',{class:'parameter-row'});
  row.append(el('span',{class:'parameter-value-label',title:label},label));
  if(type)row.append(el('small',{class:'parameter-value-type',title:type},type));
  control.classList.add('parameter-control');row.append(control);return row;
}
function noteAppearanceSettings(box,node){
  const owner=current(),documentGraph=graph,section=el('section',{class:'note-appearance-settings'});
  const title=el('input',{type:'checkbox','data-note-title-setting':node.id,'aria-label':t('note.titleOnSelection'),title:t('note.titleOnSelection.hint')});
  title.checked=node.ui?.noteTitleOnSelection===true;title.disabled=readonly;
  title.onchange=()=>{
    if(!title.isConnected)return;
    if(setNoteTitleOnSelection(node,title.checked,owner))$('#inspector').querySelector(`[data-note-title-setting="${CSS.escape(node.id)}"]`)?.focus({preventScroll:true});
    else title.checked=node.ui?.noteTitleOnSelection===true;
  };
  const explicitColor=typeof node.ui?.noteColor==='string'&&/^#[0-9a-f]{6}$/i.test(node.ui.noteColor),transparent=node.ui?.noteTransparent===true;
  const value=transparent?t('note.transparent'):explicitColor?node.ui.noteColor.toUpperCase():t('note.defaultColor');
  const color=el('button',{type:'button',class:'note-setting-color','data-note-color':node.id,'data-note-color-setting':'','aria-label':t('note.color')+': '+value,title:t('note.color.hint'),'aria-haspopup':'menu','aria-controls':'groupframepalette','aria-expanded':'false'});
  const swatch=el('span',{class:'note-setting-color-swatch'+(transparent?' note-transparent-swatch':''),'aria-hidden':'true'});
  if(!transparent)swatch.style.backgroundColor=explicitColor?node.ui.noteColor:'var(--note-default-bg)';
  color.append(swatch,el('span',{class:'note-setting-color-value'},value));color.disabled=readonly;
  color.onclick=()=>{if(current()===owner&&color.isConnected)openNoteColorPalette(node,color);};
  const font=input(noteFontScale(node),value=>{
    if(!font.isConnected||graph!==documentGraph||current()!==owner||!owner.nodes.includes(node)||definition(node)?.key!=='comment'||editorMutationBlocked())return;
    const next=Math.round(Math.max(1,Math.min(10,value))*10)/10;
    change(()=>{node.ui||={};if(next===1)delete node.ui.noteFontScale;else node.ui.noteFontScale=next;},{localize:false});
  },'number');
  Object.assign(font,{min:'1',max:'10',step:'0.1',disabled:readonly});font.numericRange={min:1,max:10,step:.1};font.refreshNumericSlider();
  font.dataset.noteFontScale=node.id;font.setAttribute('aria-label',t('note.fontScale'));font.title=t('note.fontScale.hint')+'\n'+font.title;
  const align=select(['left','center','right'].map(value=>[value,t('note.align.'+value)]),noteTextAlign(node),value=>{
    if(!align.isConnected||graph!==documentGraph||current()!==owner||!owner.nodes.includes(node)||definition(node)?.key!=='comment'||editorMutationBlocked())return;
    change(()=>{node.ui||={};if(value==='left')delete node.ui.noteTextAlign;else node.ui.noteTextAlign=value;},{localize:false});
  });
  align.disabled=readonly;align.dataset.noteTextAlign=node.id;align.setAttribute('aria-label',t('note.textAlign'));
  section.append(parameterControlRow(t('note.titleOnSelection'),title),parameterControlRow(t('note.color'),color),parameterControlRow(t('note.fontScale'),font),parameterControlRow(t('note.textAlign'),align));
  box.append(section);
}
function deferParameterInspector(){
  const edit=parameterValueEdit;if(!edit)return false;
  if(edit.entry.isConnected&&!readonly&&selected===edit.node.id&&inspectorTab==='parameters'&&edit.owner===current()&&current().nodes.includes(edit.node)&&edit.signature===inlineValueSignature(edit.node)&&(document.activeElement===edit.entry||edit.entry.numericGestureActive||numericPresetMenu?.entry===edit.entry||edit.committing))return true;
  edit.entry.cancelParameterValue?.();parameterValueEdit=null;return false;
}
function applyValueComponentHint(element,n,port,index,vector,labels){
  if(vector){
    const key=definition(n)?.key,start=['combine','replace'].includes(key)?'xyzw'.indexOf(port):-1;
    applyComponentColorHint(element,Math.max(0,start)+index,labels==='RGBA');
  }else {applyPortColorHint(element,n,'inputs',port);if(element.dataset.vectorComponent!==undefined)element.classList.add('component-tint-label');}
}
function nodeInputOptions(n,port){return definition(n)?.key==='array_create'&&port==='length'?{typeChange:true,min:1,max:typeContract.composites.array.maxLength||1024}:{};}
function parameterValueRow(n,key,label,type,read,write,labels='XYZW',options={}){
  const matrixShape=typeContract?.types?.[type];
  if(matrixShape?.shape==='matrix'){
    const group=el('section',{class:'matrix-parameter-values','data-parameter-matrix':key});
    group.append(parameterControlRow(label,el('span',{},type)));
    for(let column=0;column<matrixShape.columns;column++){
      const start=column*matrixShape.rows,name=t('matrix.column').replace('{index}',column);
      group.append(parameterValueRow(n,key+':c'+column,name,typeForShape(matrixShape.family,matrixShape.rows),()=>read().slice(start,start+matrixShape.rows),(index,next)=>write(start+index,next),labels,options));
    }
    return group;
  }
  const initial=read(),vector=Array.isArray(initial),values=vector?initial:[initial];
  const box=el('section',{class:'parameter-value-group','data-parameter-value':key});
  const compact=el('div',{class:'parameter-value-controls'}),entries=[];let syncing=false;
  const row=parameterControlRow(label,compact,type);row.classList.add('parameter-value-row');box.append(row);
  if(key!=='$value')applyPortLabelColorHint(row.querySelector('.parameter-value-label'),n,'inputs',key);
  const scalarType=typeFamily(type)||'float';
  const componentWritable=index=>!options.writable||options.writable(index);
  const own=entry=>!editorMutationBlocked()&&entry.isConnected&&!entry.disabled&&current().nodes.includes(n)&&(entry.dataset.component===undefined||componentWritable(Number(entry.dataset.component)));
  const currentValues=()=>{const value=read();return Array.isArray(value)?value:[value];};
  function syncPreview(entry,index){
    if(syncing)return;syncing=true;
    for(const peer of entries)if(peer!==entry&&Number(peer.dataset.component)===index&&!(peer===document.activeElement&&peer.hasPendingEdit?.())){peer.value=entry.value;peer.refreshNumericSlider?.();}
    syncing=false;
  }
  function createEntry(index,expanded=false){
    const name=label+(vector?' '+labels[index]:''),attrs={'aria-label':name,'data-parameter-node':n.id,'data-parameter-port':key,'data-component':String(index),'data-parameter-copy':expanded?'component':'compact'};
    if(scalarType==='bool'){
      const entry=select([['false','false'],['true','true']],String(!!values[index]),value=>{if(own(entry))change(()=>write(index,value==='true'));});
      for(const[k,v]of Object.entries(attrs))entry.setAttribute(k,v);entry.disabled=readonly;applyValueComponentHint(entry,n,key,index,vector,labels);return entry;
    }
    const entry=el('input',{...attrs,type:'number',step:['int','uint'].includes(scalarType)?'1':'any'});entry.value=componentWritable(index)?String(values[index]):'';entry.disabled=readonly||!componentWritable(index);
    if(!componentWritable(index)){entry.placeholder='—';entry.title=t('vector.inherited');}
    applyValueComponentHint(entry,n,key,index,vector,labels);
    if(['int','uint'].includes(scalarType)){entry.min=scalarType==='uint'?'0':'-2147483648';entry.max=scalarType==='uint'?'4294967295':'2147483647';}
    if(options.min!==undefined)entry.min=String(options.min);if(options.max!==undefined)entry.max=String(options.max);
    let committed=entry.value;
    entry.hasPendingEdit=()=>entry.value!==committed;
    const focus=()=>{if(own(entry))parameterValueEdit={entry,node:n,owner:current(),signature:inlineValueSignature(n)};};
    const restore=()=>{entry.value=committed;entry.removeAttribute('aria-invalid');entry.refreshNumericSlider?.();};
    entry.setSyncedValue=value=>{if(entry.numericGestureActive)return;entry.value=componentWritable(index)?String(value):'';committed=entry.value;entry.refreshNumericSlider?.();};
    const commit=()=>{
      if(entry.numericGestureActive||!own(entry)||entry.value===committed)return;
      const next=Number(entry.value);
      if(!entry.value.trim()||!Number.isFinite(next)||(['int','uint'].includes(scalarType)&&(!Number.isInteger(next)||next<Number(entry.min)||next>Number(entry.max)))){entry.setAttribute('aria-invalid','true');return;}
      if(parameterValueEdit?.entry===entry&&parameterValueEdit.signature!==inlineValueSignature(n)){restore();return;}
      if(!change(()=>write(index,next),{redraw:false,typeChange:options.typeChange===true}))return;
      const focusedDraft=entries.find(peer=>peer!==entry&&peer===document.activeElement&&peer.hasPendingEdit?.());
      syncing=true;const latest=currentValues();for(const peer of entries)if(peer.dataset.component!==focusedDraft?.dataset.component)peer.setSyncedValue(latest[Number(peer.dataset.component)]);syncing=false;
      if(definition(n)?.key==='color'&&key==='$value'){
        const display=colorDisplay(n.params.value),ink=box.querySelector('.color-ink'),picker=box.querySelector('input[type=color]');
        if(ink)ink.style.backgroundColor=display.css;if(picker)picker.value=display.hex;
        let hint=box.querySelector('.color-range-hint');
        if(n.params.value.some(v=>v<0||v>1)){if(!hint){hint=parameterControlRow('',parameterHint(t('color.range')));hint.classList.add('color-range-hint');box.append(hint);}}else hint?.remove();
      }
      entry.removeAttribute('aria-invalid');focus();
      if(parameterValueEdit?.entry===entry)parameterValueEdit.committing=true;
      render();
      if(parameterValueEdit?.entry===entry)parameterValueEdit.committing=false;
    };
    entry.cancelParameterValue=restore;
    entry.beginNumericEdit=focus;entry.endNumericEdit=()=>{if(parameterValueEdit?.entry===entry)parameterValueEdit=null;};
    entry.addEventListener('focus',focus);
    entry.addEventListener('input',()=>entry.removeAttribute('aria-invalid'));
    entry.addEventListener('change',commit);
    entry.addEventListener('blur',()=>{if(numericPresetMenu?.entry===entry)return;if(!entry.numericGestureActive)commit();restore();if(parameterValueEdit?.entry===entry)parameterValueEdit=null;});
    entry.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Enter'){e.preventDefault();commit();}else if(e.key==='Escape'){e.preventDefault();cancelValueLadder();restore();focus();}});
    installValueLadder(entry,commit);entry.onNumericPreview=()=>syncPreview(entry,index);entries.push(entry);return entry;
  }
  function installGroupLadder(target,indices){
    if(scalarType==='bool'||readonly)return;
    indices=indices.filter(componentWritable);if(!indices.length)return;
    for(const anchor of target.querySelectorAll(':scope>.parameter-value-label,:scope>.parameter-value-type')){
      anchor.dataset.parameterLadder=anchor.classList.contains('parameter-value-type')?'type':'name';
      anchor.title+='\n'+t('ladder.groupHint');
      for(const event of ['mousedown','auxclick'])anchor.addEventListener(event,e=>{if(e.button===1){e.preventDefault();e.stopPropagation();}});
      anchor.addEventListener('pointerdown',e=>{
        if(e.button!==1||e.pointerType==='touch')return;
        e.preventDefault();e.stopPropagation();cancelValueLadder();
        // A group gesture never submits or replaces another component's text draft.
        const nodeFields=document.querySelectorAll(`[data-parameter-node="${CSS.escape(n.id)}"],[data-inline-node="${CSS.escape(n.id)}"]`);
        if(!own(anchor)||[...nodeFields].some(entry=>entry.hasPendingEdit?.()))return;
        const initial=currentValues(),signature=inlineValueSignature(n),integer=['int','uint'].includes(scalarType);
        if(indices.some(index=>!Number.isFinite(initial[index])))return;
        const low=scalarType==='uint'?0:integer?-2147483648:-Number.MAX_VALUE,high=scalarType==='uint'?4294967295:integer?2147483647:Number.MAX_VALUE;
        // One shared delta stops at the first component boundary, keeping spacing.
        const minimum=Math.max(...indices.map(index=>low-initial[index])),maximum=Math.min(...indices.map(index=>high-initial[index]));
        const previews=delta=>initial.map((value,index)=>delta!==0&&indices.includes(index)?value+delta:value);
        const display=values=>{syncing=true;for(const entry of entries){const index=Number(entry.dataset.component);if(componentWritable(index)){entry.value=String(values[index]);entry.refreshNumericSlider?.();}}syncing=false;};
        const previousEdit=parameterValueEdit;
        anchor.cancelParameterValue=()=>{if(valueLadder?.entry===anchor)cancelValueLadder();};
        beginValueLadder(anchor,e,{
          read:()=>0,integer,min:minimum,max:maximum,focus:false,
          writable:()=>own(anchor)&&signature===inlineValueSignature(n)&&entries.filter(entry=>indices.includes(Number(entry.dataset.component))).every(entry=>entry.isConnected&&!entry.disabled&&!entry.readOnly),
          begin:()=>{for(const entry of entries)entry.numericGestureActive=true;parameterValueEdit={entry:anchor,node:n,owner:current(),signature};},
          preview:delta=>display(previews(delta)),restore:()=>display(initial),
          format:delta=>indices.map(index=>previews(delta)[index]).join(' · '),
          end:()=>{for(const entry of entries)entry.numericGestureActive=false;if(parameterValueEdit?.entry===anchor)parameterValueEdit=previousEdit?.entry.isConnected&&document.activeElement===previousEdit.entry?previousEdit:null;},
          commit:delta=>change(()=>{const next=previews(delta);for(const index of indices)write(index,next[index]);})
        });
      });
    }
  }
  values.forEach((_,index)=>compact.append(createEntry(index)));
  installGroupLadder(row,values.map((_,index)=>index));
  if(vector&&values.length>=2&&values.length<=4){
    let expanded=parameterExpansions.get(n)?.has(key)||false;
    row.classList.add('parameter-expandable');
    const toggle=el('button',{class:'parameter-components-toggle',type:'button','aria-label':t('node.expandValues'),'aria-expanded':String(expanded),'data-parameter-expand':key},expanded?'▾':'▸');
    row.prepend(toggle);
    const components=el('div',{class:'parameter-component-rows'});components.hidden=!expanded;
    values.forEach((_,index)=>{const component=parameterControlRow(labels[index],createEntry(index,true),scalarType);component.classList.add('parameter-component-row');applyValueComponentHint(component.querySelector('.parameter-value-label'),n,key,index,true,labels);installGroupLadder(component,[index]);components.append(component);});box.append(components);
    toggle.onclick=()=>{expanded=!expanded;let state=parameterExpansions.get(n);if(!state){state=new Set();parameterExpansions.set(n,state);}if(expanded)state.add(key);else state.delete(key);components.hidden=!expanded;toggle.textContent=expanded?'▾':'▸';toggle.setAttribute('aria-expanded',String(expanded));};
    row.addEventListener('click',event=>{
      if(event.target.closest('input,select,textarea,button,a,[contenteditable],.color-swatch'))return;
      toggle.click();
    });
  }
  return box;
}

function colorDisplay(value){
  const clamp=value=>Math.max(0,Math.min(1,Number.isFinite(value)?value:0));
  const rgb=value.slice(0,3).map(v=>Math.round(clamp(v)*255));
  return {css:`rgba(${rgb.join(',')},${clamp(value[3]??1)})`,hex:'#'+rgb.map(v=>v.toString(16).padStart(2,'0')).join('')};
}
function colorSwatch(value){
  const swatch=el('span',{class:'color-swatch','aria-hidden':'true'}),ink=el('span',{class:'color-ink'});
  ink.style.backgroundColor=colorDisplay(value).css;swatch.append(ink);return swatch;
}
function colorPickerSwatch(value,callback,disabled=false){
  const read=()=>typeof value==='function'?value():value,display=colorDisplay(read()),swatch=colorSwatch(read());
  swatch.removeAttribute('aria-hidden');
  const picker=el('input',{type:'color',value:display.hex,'aria-label':t('color.choose')});picker.disabled=readonly||disabled;
  picker.onchange=()=>{
    const current=read();
    if(readonly||disabled||!picker.isConnected||picker.value===colorDisplay(current).hex||!/^#[0-9a-f]{6}$/i.test(picker.value))return;
    const rgb=[1,3,5].map(i=>parseInt(picker.value.slice(i,i+2),16)/255);
    callback([...rgb,current[3]]);
  };
  swatch.append(picker);return swatch;
}
function colorFields(value,label,callback,disabled=false){
  const box=el('div',{class:'color-parameter'}),row=el('div',{class:'color-picker-row'});
  row.append(colorPickerSwatch(value,callback,disabled),el('span',{},t('color.choose')));box.append(row,numbers(value,label,callback,disabled,'RGBA'));
  if(value.some(v=>v<0||v>1))box.append(el('small',{class:'muted color-range-hint'},t('color.range')));
  return box;
}
function nodeLabel(n){return typeof n?.ui?.label==='string'&&n.ui.label.length<=80&&!/[\x00-\x1f\x7f]/.test(n.ui.label)?n.ui.label:'';}
function setNodeLabel(n,value){
  const label=value.trim();
  if(label.length>80||/[\x00-\x1f\x7f]/.test(label)){status(t('node.labelInvalid'),true);return false;}
  if(label===nodeLabel(n))return true;
  return change(()=>{n.ui||={x:0,y:0};if(label)n.ui.label=label;else delete n.ui.label;},{localize:false});
}
function nodeLabelField(n){
  const entry=input(nodeLabel(n),value=>{if(!setNodeLabel(n,value))entry.setSyncedValue(nodeLabel(n));});
  entry.dataset.nodeLabel=n.id;entry.maxLength=80;entry.placeholder=nodeTypeLabel(definition(n),n.params);entry.disabled=readonly;
  const previous=entry.onkeydown;entry.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();entry.setSyncedValue(nodeLabel(n));entry.blur();}else previous(e);};
  return field(t('node.label'),entry);
}
function nodeInspectorTitle(n,d){
  const title=el('div',{class:'node-inspector-title','data-category':nodeCategory(d||{key:''})});
  const name=el('h3',{class:'node-inspector-name'},nodeTypeLabel(d,n.params));name.title=name.textContent;title.append(name);
  if(d&&!isSourceReferenceNode(n))title.append(nodeNameEditor(n,inspector));
  else if(d){const source=nodeSourceDeclaration(n),label=source?.name||'';title.append(el('span',{class:'node-inspector-source',title:label},label));}
  return title;
}
function focusNodeLabel(n){
  selectNode(n);inspectorScope='node';inspector();
  const entry=$('[data-node-label]');entry?.focus();entry?.select();
}
function nodeComment(n){return typeof n?.ui?.comment==='string'?n.ui.comment:'';}
function setNodeComment(n,value,{redraw=true}={}){
  const comment=value.replace(/\r\n?/g,'\n');
  if(comment.length>2000||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(comment)){status(t('node.commentInvalid'),true);return false;}
  if(comment===nodeComment(n))return true;
  return change(()=>{n.ui||={};if(comment)n.ui.comment=comment;else delete n.ui.comment;},{localize:false,redraw});
}
// Comment nodes use the same UI-only text storage as node notes. A draft stays
// local until blur or Ctrl+Enter, so typing is a single undoable edit.
const commentNodeDrafts=new WeakMap();
function deferCommentNodeEditor(canvas){
  const entry=document.activeElement;
  return !!entry?.matches('[data-comment-node]')&&entry.classList.contains('comment-node-canvas')===canvas&&entry.keepCommentEditor?.();
}
function commentNodeEditor(n,canvas=false){
  const owner=current(),draft=commentNodeDrafts.get(n),hasDraft=!readonly&&draft?.base===nodeComment(n)&&draft.text!==nodeComment(n)&&draft.canvas===canvas;
  const box=el('div',{class:'comment-node-content'+(canvas?' comment-node-canvas-content':'')}),preview=canvas?el('div',{class:'comment-node-preview',tabindex:'0',role:'group','aria-label':t('comment.text')}):null;
  const entry=el('textarea',{class:'comment-node-editor'+(canvas?' comment-node-canvas':''),'data-comment-node':n.id,'aria-label':t('comment.text'),placeholder:t('comment.placeholder'),rows:canvas?5:8,maxlength:2000});
  entry.value=hasDraft?draft.text:nodeComment(n);entry.readOnly=readonly;
  let committed=nodeComment(n);
  const refreshSize=()=>{const card=canvas&&box.closest('.node');if(card?.isConnected){applyNodeWidth(card,n);wires();}};
  const renderPreview=()=>{
    if(!preview)return;
    preview.replaceChildren(committed?commentMarkdown(committed):el('span',{class:'muted'},t('comment.placeholder')));
    if(!readonly)preview.title=t('comment.edit');
  };
  const read=()=>{if(preview){renderPreview();entry.hidden=true;preview.hidden=false;refreshSize();}};
  const edit=()=>{
    if(readonly||editorMutationBlocked()||current()!==owner||!owner.nodes.includes(n)||!box.isConnected)return;
    preview.hidden=true;entry.hidden=false;entry.focus({preventScroll:true});
  };
  entry.keepCommentEditor=()=>!readonly&&current()===owner&&owner.nodes.includes(n)&&nodeComment(n)===committed&&(canvas||selected===n.id&&inspectorTab==='parameters');
  entry.hasPendingEdit=()=>entry.value!==committed;
  entry.syncCommentValue=value=>{if(document.activeElement!==entry){committed=value;entry.value=value;renderPreview();refreshSize();}};
  const commit=()=>{
    if(readonly||current()!==owner||!owner.nodes.includes(n))return;
    if(entry.value===committed){commentNodeDrafts.delete(n);return;}
    const value=entry.value,previous=committed;committed=value;commentNodeDrafts.delete(n);
    if(!setNodeComment(n,value,{redraw:false})){committed=previous;entry.value=nodeComment(n);return;}
    committed=nodeComment(n);
    for(const other of document.querySelectorAll('[data-comment-node]'))if(other!==entry&&other.dataset.commentNode===n.id)other.syncCommentValue?.(committed);
  };
  entry.oninput=()=>commentNodeDrafts.set(n,{base:nodeComment(n),text:entry.value,canvas});
  entry.onchange=commit;entry.onblur=()=>{commit();read();};
  const select=e=>{
    e.stopPropagation();
    if(canvas&&!selection.has(n.id)){
      selectNode(n);document.querySelectorAll('.node').forEach(card=>card.classList.toggle('selected',selection.has(card.dataset.node)));inspector();renderNavigation();
    }
  };
  entry.onpointerdown=select;
  entry.onclick=entry.ondblclick=e=>e.stopPropagation();
  if(canvas)box.onwheel=e=>e.stopPropagation();
  entry.onkeydown=e=>{
    if(e.key==='Escape'){e.preventDefault();e.stopPropagation();commentNodeDrafts.delete(n);entry.value=nodeComment(n);committed=entry.value;entry.blur();preview?.focus({preventScroll:true});}
    else if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();e.stopPropagation();if(canvas){entry.blur();preview.focus({preventScroll:true});}else commit();}
  };
  if(!canvas){box.append(entry);return box;}
  preview.ondblclick=e=>{e.stopPropagation();if(!e.target.closest('a')){e.preventDefault();edit();}};
  preview.onclick=e=>e.stopPropagation();
  preview.onkeydown=e=>{e.stopPropagation();if(e.key==='Enter'&&e.target===preview){e.preventDefault();edit();}};
  // The native scrolling surface handles its own double tap, outside graph gestures.
  let touchStart=null,lastTap=null;
  preview.onpointerdown=e=>{select(e);touchStart=e.pointerType==='touch'&&!e.target.closest('a')?{x:e.clientX,y:e.clientY}:null;};
  preview.onpointermove=e=>{if(touchStart&&Math.hypot(e.clientX-touchStart.x,e.clientY-touchStart.y)>8){touchStart=null;lastTap=null;}};
  preview.onpointercancel=()=>{touchStart=lastTap=null;};
  preview.onpointerup=e=>{
    if(!touchStart)return;const point=touchStart;touchStart=null;const now=performance.now();
    if(lastTap&&now-lastTap.time<350&&Math.hypot(point.x-lastTap.x,point.y-lastTap.y)<24){lastTap=null;edit();}
    else lastTap={...point,time:now};
  };
  box.append(preview,entry);renderPreview();entry.hidden=!hasDraft;preview.hidden=!!hasDraft;return box;
}
function nodeCommentField(n){
  const section=el('section',{class:'node-comment-field node-notes-page'});
  const entry=el('textarea',{'data-node-comment':n.id,rows:3,maxlength:2000,'aria-label':t('node.comment')});entry.value=nodeComment(n);entry.disabled=readonly;
  let committed=entry.value;
  const commit=()=>{if(readonly||entry.value===committed)return;const value=entry.value;committed=value;if(!setNodeComment(n,value)){entry.value=nodeComment(n);committed=entry.value;}};
  entry.onchange=commit;entry.onblur=commit;
  entry.onkeydown=e=>{
    if(e.key==='Escape'){e.preventDefault();e.stopPropagation();entry.value=nodeComment(n);committed=entry.value;entry.blur();}
    else if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();commit();}
  };
  section.append(entry,el('small',{class:'muted'},t('node.commentHint')));return section;
}

function setDeclarationExposed(decl,value){
  const n=current().nodes.find(n=>n.id===selected&&n.params?.declarationId===decl.id);
  if(value&&!decl.expose&&!Object.hasOwn(decl,'exposeName')&&nodeLabel(n))decl.exposeName=nodeLabel(n);
  decl.expose=value;
}

function toggle(label,value,callback){
  const check=el('input',{type:'checkbox'});check.checked=!!value;check.disabled=readonly;
  check.onchange=()=>callback(check.checked);
  const row=el('label',{class:'toggle-field'});row.append(check,el('span',{},label));return row;
}

// Comment display is a deliberately small Markdown subset. Never interpret HTML.
function commentMarkdown(text){
  const root=el('div',{class:'comment-markdown'}),lines=String(text).replace(/\r\n?/g,'\n').split('\n');
  const inline=(target,value)=>{
    const tokens=/`([^`\n]+)`|\[([^\]\n]+)\]\(([^\s)]+)\)|\*\*([^*\n]+)\*\*|\*([^*\n]+)\*/g;let start=0;
    for(const match of value.matchAll(tokens)){
      target.append(document.createTextNode(value.slice(start,match.index)));
      if(match[1])target.append(el('code',{},match[1]));
      else if(match[2]){
        let url=null;
        if(/^(?:https?:\/\/|mailto:)/i.test(match[3]))try{url=new URL(match[3]);}catch{}
        if(url&&['http:','https:','mailto:'].includes(url.protocol))target.append(el('a',{href:url.href,target:'_blank',rel:'noopener noreferrer'},match[2]));
        else target.append(document.createTextNode(match[0]));
      }else target.append(el(match[4]?'strong':'em',{},match[4]||match[5]));
      start=match.index+match[0].length;
    }
    target.append(document.createTextNode(value.slice(start)));
  };
  const fence=line=>/^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
  const heading=line=>/^ {0,3}(#{1,6})\s+(.+)$/.exec(line);
  const listItem=line=>/^ {0,3}(?:([-+*])|([0-9]{1,9})[.)])\s+(.+)$/.exec(line);
  const startsBlock=line=>fence(line)||heading(line)||listItem(line);
  for(let i=0;i<lines.length;){
    if(!lines[i].trim()){i++;continue;}
    const fenced=fence(lines[i]),title=heading(lines[i]),item=listItem(lines[i]);
    if(fenced){
      const source=[];i++;
      while(i<lines.length){
        const close=fence(lines[i]);
        if(close&&close[1][0]===fenced[1][0]&&close[1].length>=fenced[1].length&&!close[2].trim()){i++;break;}
        source.push(lines[i++]);
      }
      const pre=el('pre'),code=el('code'),value=source.join('\n');
      if(fenced[2].trim().toLowerCase()==='glsl')code.append(glslFragment(value));else code.textContent=value;
      pre.append(code);root.append(pre);
    }else if(title){
      const block=el('h'+title[1].length);inline(block,title[2]);root.append(block);i++;
    }else if(item){
      const ordered=!!item[2],list=el(ordered?'ol':'ul');
      if(ordered)list.start=Number(item[2]);
      while(i<lines.length){
        const next=listItem(lines[i]);if(!next||!!next[2]!==ordered)break;
        const li=el('li');inline(li,next[3]);list.append(li);i++;
      }
      root.append(list);
    }else{
      const block=el('p');inline(block,lines[i++]);
      while(i<lines.length&&lines[i].trim()&&!startsBlock(lines[i])){block.append(el('br'));inline(block,lines[i++]);}
      root.append(block);
    }
  }
  return root;
}

function markdown(text){
  // Small Markdown subset; text is always DOM text, never executable HTML.
  const root=el('div',{class:'help-markdown'});
  for(const paragraph of text.split(/\n\s*\n/)){
    const block=el('p');let start=0;
    const tokens=/\[([^\]]+)\]\((https:\/\/[^\s)]+)\)|`([^`]+)`|\*\*([^*]+)\*\*/g;
    for(const match of paragraph.matchAll(tokens)){
      block.append(document.createTextNode(paragraph.slice(start,match.index)));
      if(match[1])block.append(el('a',{href:match[2],target:'_blank',rel:'noopener noreferrer'},match[1]));
      else block.append(el(match[3]?'code':'strong',{},match[3]||match[4]));
      start=match.index+match[0].length;
    }
    block.append(document.createTextNode(paragraph.slice(start)));root.append(block);
  }
  return root;
}

function changeDeclaration(fn,options={}){return change(fn,{...options,localize:false});}
function changeTextureSettings(decl,edit){
  changeDeclaration(()=>{edit(decl);if(decl.source==='input:0'&&graph.topInputs){const slot=graph.topInputs.find(s=>s.id===(graph.topInputLegacyId||graph.topInputs[0].id));slot.defaultSource=decl.defaultSource||'builtin:banana';slot.matchDefault=true;}if(decl.source==='input:0')for(const other of graph.declarations.filter(d=>d.kind==='sampler'&&d.source==='input:0'&&d!==decl))for(const key of ['defaultSource','expose','exposeName']){if(Object.hasOwn(decl,key))other[key]=clone(decl[key]);else delete other[key];}});
}
function setTextureMode(decl,mode){
  changeDeclaration(()=>{
    if(mode==='input:0'){
      const existing=graph.declarations.find(d=>d!==decl&&d.kind==='sampler'&&d.source==='input:0');
      const previous=decl.source;decl.source='input:0';decl.defaultSource=previous;
      if(existing)for(const key of ['defaultSource','expose','exposeName']){if(Object.hasOwn(existing,key))decl[key]=clone(existing[key]);else delete decl[key];}
    }else{decl.source=decl.defaultSource||'builtin:banana';delete decl.defaultSource;}
  });
}

function declarationFields(box,decl,settings=false,{live=true}={}){
  if(decl.type==='samplerBuffer'){nativeInputFields(box,decl);return;}
  if(settings){
    box.append(field(t('declaration.name'),input(decl.name,value=>changeDeclaration(()=>decl.name=value))));
    box.append(el('p',{class:'muted'},decl.type+' · '+decl.id));return;
  }
  if(decl.kind==='sampler'){
    if(decl.expose&&live)box.append(liveUniformFields(decl));
    if(editorTarget==='top')box.append(field(t('texture.mode'),select([['input:0',t('texture.filterMode')],['source',t('texture.sourceMode')]],decl.source==='input:0'?'input:0':'source',value=>setTextureMode(decl,value))));
    const source=decl.source==='input:0'?(decl.defaultSource||'builtin:banana'):decl.source;
    box.append(field(t('texture.default'),select(textureOptions().filter(([key])=>key!=='input:0'),source.startsWith('op:')?'external':source,value=>changeTextureSettings(decl,d=>{const next=value==='external'?'op:/project1/texture':value;if(d.source==='input:0')d.defaultSource=next;else d.source=next;}))));
    if(source.startsWith('op:'))box.append(field(t('texture.path'),input(source.slice(3),value=>changeTextureSettings(decl,d=>{if(d.source==='input:0')d.defaultSource='op:'+value;else d.source='op:'+value;}))));
    box.append(toggle(t('uniform.expose'),decl.expose,value=>changeTextureSettings(decl,d=>setDeclarationExposed(d,value))));
    if(decl.expose)box.append(field(t('uniform.publicName'),input(decl.exposeName||(decl.source==='input:0'?'Input 1 Default TOP':decl.name),value=>changeTextureSettings(decl,d=>d.exposeName=value))));
    box.append(el('p',{class:'muted'},t(decl.source==='input:0'?'texture.filterHint':'texture.sourceHint')));
  }else{
    if(live)box.append(liveUniformFields(decl));
    box.append(el('h4',{},t('uniform.default')));
    box.append(numbers(decl.value,t('uniform.default'),value=>changeDeclaration(()=>decl.value=value),false,'XYZW',decl.type));
    const control=el('button',{},t('controls.fromUniform'));control.onclick=()=>openUniformControl(decl.id);box.append(control);
  }
}

function newUniform(node=null){
  change(()=>{
    const id='uniform_'+crypto.randomUUID().replaceAll('-','').slice(0,8);
    graph.declarations.push({id,kind:'uniform',type:'float',name:'uValue'+graph.declarations.length,value:.5,expose:false});
    if(node)node.params.declarationId=id;
  });
}

function renderParameterScope(box){
  const tabs=el('div',{class:'parameter-scope',role:'tablist','aria-label':t('parameter.scope')});
  for(const key of ['node','exposed']){const button=el('button',{role:'tab','data-parameter-scope':key,'aria-selected':String(inspectorScope===key),class:inspectorScope===key?'active':''},t('parameter.'+key));button.tabIndex=inspectorScope===key?0:-1;button.onclick=()=>{inspectorScope=key;inspector();refreshUniforms();};tabs.append(button);}
  tabs.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();e.stopPropagation();const next=e.key==='Home'?'node':e.key==='End'?'exposed':inspectorScope==='node'?'exposed':'node';inspectorScope=next;inspector();$('[data-parameter-scope="'+next+'"]').focus();refreshUniforms();};box.append(tabs);
}
function exposedInspector(box){
  box.append(el('p',{class:'muted'},t('parameter.exposedHint')));
  const declarations=graph.declarations.filter(d=>d.expose);
  if(!declarations.length)box.append(el('p',{class:'muted'},t('parameter.exposedEmpty')));
  for(const decl of declarations){
    const card=el('section',{class:'exposed-card','data-exposed':decl.id});
    card.append(el('h3',{},decl.exposeName||(decl.source==='input:0'?'Input 1 Default TOP':decl.name)),el('div',{class:'node-identity'},decl.type+' · '+decl.name),liveUniformFields(decl));
    const details=el('details'),summary=el('summary',{},t('parameter.exposedSettings')),settings=el('div');details.append(summary,settings);declarationFields(settings,decl,false,{live:false});card.append(details);if(readonly)for(const control of card.querySelectorAll('input,select,button'))control.disabled=true;box.append(card);
  }
  updateUniformFields();
}
let helpContext='node',previewHelpSelection=null,sourceHelpPreset=null;
function renderHelp(){
  const help=$('#nodehelp');help.replaceChildren();
  if(helpContext==='structure'){StructureUI.help();return;}
  if(helpContext==='personal'){
    help.append(el('h3',{},t('browser.source.personal')),markdown(t('personal.hint')),markdown(t('personal.help')));return;
  }
  if(helpContext==='sourcePreset'&&sourceHelpPreset){
    const entry=typeContract?.sources?.uniformPresets?.[sourceHelpPreset];
    if(entry){help.append(el('h3',{},entry.initialize.expression),el('p',{},t(entry.labelKey)+' · '+entry.name+' · '+entry.type),el('p',{class:'muted'},'TD · Vectors'),markdown(t('inputs.clockHint')),markdown(t('sources.presetHelp')));return;}
  }
  if(helpContext==='preview'&&selected!==previewHelpSelection)helpContext='node';
  if(helpContext==='preview'){
    help.append(el('h3',{},t(editorTarget==='top'?'preview.top':'preview.material')),markdown(t(editorTarget==='top'?'preview.helpTop':'preview.helpMaterial')));return;
  }
  const n=current().nodes.find(n=>n.id===selected),d=n&&definition(n);
  if(d?.key==='struct_create'&&n.params.type.startsWith('struct:')){StructureUI.help(n.params.type.slice(7));return;}
  const source=!n&&graph.declarations.find(d=>d.id===selectedInputId);
  if(source){
    help.append(el('h3',{},source.name+' · '+source.type));
    const sequence=nativeSourceIndex().get(source.id)?.sequence||source.nativeSequence;
    if(sequence)help.append(el('p',{class:'muted'},'TD · '+nativeSourceSequenceName(sequence)));
    help.append(markdown(t(source.type==='samplerBuffer'?'buffer.nativeHint':'help.'+source.kind)));return;
  }
  if(n&&graph.declarations.find(source=>source.id===n.params.declarationId)?.type==='samplerBuffer'){help.append(markdown(t('buffer.nativeHint')));return;}
  if(nodeComment(n)){const note=el('section',{class:'node-comment-help'});note.append(el('strong',{},t('node.comment')),el('p',{},nodeComment(n)));help.append(note);}
  if(n?.params.fixedType&&['scalar','vector'].includes(d?.key)){help.append(markdown(t(d.key==='scalar'?'help.fixedScalar':'help.fixedVector')));return;}
  help.append(markdown(t(d?(editorTarget==='top'&&['uv','texture','pixel_out'].includes(d.key)?'help.top.'+d.key:(d.descriptionKey||'help.'+d.key)):'help.select')));
}
function showPreviewHelp(){if(!graph)return;helpContext='preview';previewHelpSelection=selected;renderHelp();}
function installPreviewHelp(){
  $('#pane-live').addEventListener('click',showPreviewHelp);
  $('#livebody').addEventListener('keydown',event=>{
    if(event.target===$('#livebody')&&['Enter',' '].includes(event.key)){event.preventDefault();showPreviewHelp();}
  });
}

const glslCodeDrafts=new WeakMap();
function glslCodeInspector(box,n){
  const panel=el('div',{class:'glsl-code-panel','data-glsl-code':n.id});
  const name=input(n.params.functionName,value=>change(()=>{n.params.functionName=value;CustomGLSL.validate(n.params);}));
  name.maxLength=48;name.disabled=readonly;name.dataset.codeFunction='';
  panel.append(parameterControlRow(t('code.function'),name));
  for(const direction of ['inputs','outputs']){
    const group=el('section',{class:'code-interface','data-code-direction':direction});
    const heading=el('div',{class:'code-interface-heading'});
    heading.append(el('strong',{},t('code.'+direction)));
    const add=el('button',{type:'button','aria-label':t('code.add.'+direction),'data-code-add':direction},'+');
    add.disabled=readonly||n.params[direction].length>=typeContract.glslCode.maxPorts;
    add.onclick=()=>change(()=>CustomGLSL.add(n.params,direction));heading.append(add);group.append(heading);
    for(const [index,p]of n.params[direction].entries()){
      const row=el('div',{class:'code-port','data-code-port':p.id});
      const entry=input(p.name,value=>change(()=>CustomGLSL.update(n,direction,p.id,{name:value})));
      entry.maxLength=48;entry.disabled=readonly;entry.setAttribute('aria-label',t('code.portName'));entry.title=t('code.renameHint');
      const types=direction==='inputs'?graphInterfaceTypes():graphValueTypes();
      const type=typeSelect(types.map(type=>[type,type]),p.type,value=>change(()=>CustomGLSL.update(n,direction,p.id,{type:value}),{typeChange:true}));
      type.disabled=readonly;type.setAttribute('aria-label',t('node.type'));
      row.append(entry,type);
      for(const [label,offset,symbol]of [['code.up',-1,'↑'],['code.down',1,'↓']]){
        const move=el('button',{type:'button','aria-label':t(label),'data-code-move':String(offset)},symbol);
        move.title=t(label);move.disabled=readonly||index+offset<0||index+offset>=n.params[direction].length;
        move.onclick=()=>change(()=>CustomGLSL.move(n.params,direction,p.id,offset));row.append(move);
      }
      const remove=el('button',{type:'button','aria-label':t('code.remove'),'data-code-remove':p.id},'×');
      remove.title=t('code.remove');remove.disabled=readonly||direction==='outputs'&&n.params.outputs.length===1;
      remove.onclick=()=>change(()=>CustomGLSL.remove(n,direction,p.id,current().edges));row.append(remove);group.append(row);
    }
    panel.append(group);
  }
  const editor=el('div',{class:'code-editor'}),header=el('pre',{class:'code-wrapper','data-code-header':''},CustomGLSL.header(n.params));
  const body=el('textarea',{'aria-label':t('code.body'),'data-code-body':'',spellcheck:'false',autocapitalize:'off',autocomplete:'off',autocorrect:'off',wrap:'off'});
  const draft=glslCodeDrafts.get(n);body.value=draft?.base===n.params.code?draft.text:n.params.code;body.maxLength=typeContract.glslCode.maxLength;body.readOnly=readonly;
  body.rows=Math.max(6,Math.min(20,body.value.split('\n').length+1));
  let committed=n.params.code;
  body.hasPendingEdit=()=>body.value!==committed;
  const commit=()=>{
    if(readonly||body.value===committed)return;
    const value=body.value,previous=committed;
    // Replacing the focused editor during render can emit blur synchronously.
    committed=value;glslCodeDrafts.delete(n);
    // The body does not change node layout. Keep the focused DOM alive so a
    // blur followed by a button click is not swallowed by replacing that button.
    if(!change(()=>n.params.code=value,{redraw:false}))committed=previous;
    else {
      document.querySelectorAll('.node.error').forEach(card=>card.classList.remove('error'));
      const f=currentFunction();if(f)$('#functionscope').textContent=t(f.scope==='local'?'function.local':'function.source');
    }
  };
  body.oninput=()=>glslCodeDrafts.set(n,{base:n.params.code,text:body.value});
  body.onchange=commit;body.onblur=commit;
  body.onkeydown=event=>{
    if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)){event.preventDefault();event.stopPropagation();commit();}
    else if(event.key==='Tab'&&!event.shiftKey&&!readonly){event.preventDefault();event.stopPropagation();body.setRangeText('    ',body.selectionStart,body.selectionEnd,'end');body.oninput();}
  };
  editor.append(header,body,el('pre',{class:'code-wrapper'},'}'));panel.append(editor);
  panel.append(el('small',{class:'muted code-hint'},t('code.hint')));
  box.append(panel);
}

function nodeTypeSelector(n,d){
  if(n.params.fixedType)return null;
  const options=selectableNodeTypes(d).map(type=>[type,type]);if(!options.length)return null;
  const composed=['combine','vector','replace'].includes(d.key),automatic=n.ui?.typeMode==='auto',auto=supportsAutoType(d);
  const control=typeSelect(auto?[['auto',t('type.auto')+' · '+n.params.type],...options]:options,auto&&automatic?'auto':n.params.type,value=>{
    if(auto)setMathType(n,value);
    else if(isMatrixOperation(d))change(()=>reshapeTypedInputs(n,d,value),{typeChange:true});
    else change(()=>{const old=clone(n.inputValues||{}),previous=ports(n,'inputs');n.params.type=value;normalizeNodeValues(n,d);for(const [port,type]of Object.entries(ports(n,'inputs'))){if(Object.hasOwn(old,port))n.inputValues[port]=convertValue(old[port],type,previous[port]);}},{typeChange:true});
  });control.disabled=readonly;control.title=t(auto?'type.operation':composed?'vector.outputType':'node.type');
  if(isVectorOperation(d))control.dataset.vectorType=n.id;else if(auto)control.dataset.mathType=n.id;
  return control;
}
function nodePrimarySelector(n,d){
  if(!d)return null;let control=null;
  if(isCompositeOperation(d))control=['array','array_create'].includes(d.key)?arrayElementSelector(n):null;
  else if(isConvertOperation(d))control=convertTypeSelector(n,'toType');
  else if(n.params.type)control=nodeTypeSelector(n,d);
  else if(d.key==='pixel_out'&&editorTarget==='mat'&&typeContract?.pixelBufferOutputs){control=select(typeContract.pixelBufferOutputs.ports.map((_,i)=>[String(i+1),String(i+1)]),String(n.params.bufferCount??1),value=>setPixelBufferCount(n,Number(value)));control.title=t('pixel.bufferCount');}
  else if(n.params.declarationId){const source=nodeSourceDeclaration(n);if(source)control=select(graph.declarations.filter(item=>item.kind===source.kind).map(item=>[item.id,item.name]),source.id,value=>change(()=>n.params.declarationId=value));}
  else if(n.params.inputId)control=select(topInputsView().map(item=>[item.id,item.name]),n.params.inputId,value=>change(()=>n.params.inputId=value));
  if(!control)return null;control.classList.add('node-primary-selector');control.dataset.nodeSelector=n.id;control.disabled=readonly;control.setAttribute('aria-label',control.title||t('node.declaration'));
  for(const event of ['pointerdown','click','dblclick','keydown'])control.addEventListener(event,e=>e.stopPropagation());return control;
}
function arrayElementSelector(n){
  const options=graphValueTypes().filter(type=>typeDescriptor(type)?.shape!=='array'||typeof typeDescriptor(type).length==='number');
  const control=typeSelect(options.map(type=>[type,displayType(type)]),n.params.elementType||'float',value=>change(()=>{n.params.elementType=value;if(definition(n)?.key==='array_create'&&Object.hasOwn(n.inputValues||{},'value'))n.inputValues.value=compositeValue(n.inputValues.value,value);},{typeChange:true}));
  control.dataset.arrayElementType=n.id;control.title=t('array.elementType');control.disabled=readonly;return control;
}
function structFieldSelector(n){
  const type=ports(n,'inputs').value,fields=typeDescriptor(type)?.fields||[];
  const control=select(fields.map(field=>[field.id||field.name,field.name+' · '+displayType(field.type)]),n.params.field,value=>change(()=>n.params.field=value,{typeChange:true}));
  control.dataset.structField=n.id;control.title=t('struct.field');control.disabled=readonly;control.setAttribute('aria-label',control.title);
  for(const event of ['pointerdown','click','dblclick','keydown'])control.addEventListener(event,event=>event.stopPropagation());return control;
}
function compositeInspector(box,n,d){
  if(!isCompositeOperation(d))return;
  if(d.key==='struct_create'){
    const choices=Object.keys(compositeStructs()).filter(type=>typeAvailable(type));
    const picker=typeSelect(choices.map(type=>[type,displayType(type)]),n.params.type,type=>change(()=>{n.params.type=type;},{typeChange:true}));picker.disabled=readonly;
    box.append(parameterControlRow(t('struct.type'),picker));
    const id=n.params.type.slice(7);if(n.params.type.startsWith('struct:')){const edit=el('button',{class:'wide'},t('struct.edit'));edit.onclick=()=>StructureUI.edit(id);box.append(edit);}
  }else if(d.key==='array'){
    box.append(parameterControlRow(t('array.elementType'),arrayElementSelector(n)));
    const length=arrayLengthControl(n.params.length??4,value=>change(()=>n.params.length=value,{typeChange:true}));
    const lengthInput=length.querySelector('input');if(lengthInput)lengthInput.dataset.arrayLength=n.id;
    box.append(parameterControlRow(t('array.length'),length),parameterControlRow('',parameterHint(t('array.lengthSourceHint'))),parameterControlRow('',parameterHint(t('array.initializationHint'))));
  }else if(d.key==='array_create'){
    box.append(parameterControlRow(t('array.elementType'),arrayElementSelector(n)),parameterControlRow('',parameterHint(t('array.createHint'))));
  }else if(d.key==='builtin_source'){
    const choices=builtinSourceEntries(d).map(entry=>[entry.defaults.source,entry.label]);
    const source=select(choices,n.params.source,value=>change(()=>n.params.source=value,{typeChange:true}));source.dataset.builtinSource=n.id;source.disabled=readonly;
    box.append(parameterControlRow(t('inputs.referenceSource'),source),parameterControlRow('',parameterHint(t('composite.hostSourceHint'))));
  }else{
    const port=d.key==='struct_field'?'value':'Array',connected=current().edges.some(edge=>edge.to[0]===n.id&&edge.to[1]===port),type=ports(n,'inputs')[port],typeLabel=d.key==='struct_field'?'struct.type':'composite.inputType';
    if(!connected){
      const choices=d.key==='struct_field'?Object.keys(compositeStructs()):graphInterfaceTypes().filter(type=>typeDescriptor(type)?.shape==='array'&&(d.key!=='array_replace'||!typeContainsResource(type)));
      if(!choices.includes(n.params.type))choices.unshift(n.params.type);
      const selector=typeSelect(choices.map(type=>[type,displayType(type)]),n.params.type,value=>change(()=>reshapeTypedInputs(n,d,value),{typeChange:true}));selector.disabled=readonly;selector.dataset.compositeInputType=n.id;
      box.append(parameterControlRow(t(typeLabel),selector));
    }else box.append(parameterControlRow(t(typeLabel),parameterHint(displayType(type))));
    if(d.key==='struct_field')box.append(parameterControlRow(t('struct.field'),structFieldSelector(n)));
    if(['array_get','array_replace'].includes(d.key)){
      const index=select((typeContract.composites.array.indexTypes||['int','uint']).map(type=>[type,type]),n.params.indexType||'int',value=>change(()=>{n.params.indexType=value;if(n.inputValues?.i!==undefined)n.inputValues.i=shapedValue(n.inputValues.i,value);},{typeChange:true}));index.dataset.arrayIndexType=n.id;index.disabled=readonly;
      box.append(parameterControlRow(t('matrix.indexType'),index),parameterControlRow('',parameterHint(t(d.key==='array_replace'?'array.replaceIndexHint':'array.indexHint'))));
    }
  }
}
function arrayLengthSelector(value,commit,allowSpecialization=true){
  const references=graph.declarations.filter(d=>['constant','spec_constant'].includes(d.kind)&&['int','uint'].includes(d.type));
  const mode=select([['literal',t('array.fixedLength')],...references.map(d=>['sg_len_'+d.id,d.name+' · '+(d.kind==='spec_constant'?'Spec Constant':'Constant')])],typeof value==='number'?'literal':value,next=>commit(next==='literal'?4:next));
  mode.disabled=readonly;mode.dataset.arrayLengthSource='true';mode.setAttribute('aria-label',t('array.length'));mode.title=t('array.lengthSourceHint');
  if(!allowSpecialization)for(const option of mode.options)if(arrayLengthDeclaration(option.value)?.kind==='spec_constant'){option.disabled=true;option.title=t('array.nativeSpecializationLimit');}
  return mode;
}
function arrayLengthControl(value,commit,allowSpecialization=true){
  const box=el('div',{class:'components'});box.append(arrayLengthSelector(value,commit,allowSpecialization));
  if(typeof value==='number'){
    const number=input(value,text=>{const count=Number(text);if(Number.isInteger(count)&&count>=1&&count<=(typeContract.composites.array.maxLength||1024))commit(count);else{status(t('array.invalidLength'),true);inspector();}},'number');
    number.min='1';number.max=String(typeContract.composites.array.maxLength||1024);number.step='1';number.disabled=readonly;number.setAttribute('aria-label',t('array.length'));box.append(number);
  }else box.title=arrayLengthExpression(value);
  return box;
}
function arrayNodeLengthControl(n){
  const box=el('div',{class:'node-body-controls','data-array-length-controls':n.id}),value=n.params.length??4;
  box.append(arrayLengthSelector(value,next=>change(()=>n.params.length=next,{typeChange:true})));
  if(typeof value==='number'){
    const fields=inlineNumericFields(n,'$length',value,(_,next)=>n.params.length=next,'XYZW',{type:'int',label:t('array.length'),typeChange:true}),number=fields.querySelector('input');
    number.min='1';number.max=String(typeContract.composites.array.maxLength||1024);number.dataset.arrayLength=n.id;box.append(fields);
  }
  for(const event of ['pointerdown','click','dblclick','keydown'])box.addEventListener(event,e=>e.stopPropagation());
  return box;
}
function compositeInputHint(n,port,type){
  if(typeContainsResource(type)||typeof typeDescriptor(type)?.length==='string')return t('composite.connectValue');
  const descriptor=definition(n),stored=Object.hasOwn(n.inputValues||{},port)||(descriptor?.key==='function_call'&&FunctionModel.find(graph,n.params.functionId)?.inputs.some(p=>p.id===port&&p.default!==undefined))||(descriptor?.key==='function_output'&&currentFunction()?.outputs.some(p=>p.id===port&&p.default!==undefined));
  return t(stored?'composite.storedDefault':'composite.zeroDefault')+' · '+displayType(type);
}
function convertTypeSelector(n,parameter){
  const d=definition(n),options=parameter==='fromType'?convertSources(d.key):convertTargets(n.params.fromType,d.key);
  const control=typeSelect(options.map(type=>[type,type]),n.params[parameter],type=>change(()=>{
    const previous=n.params[parameter];
    n.params[parameter]=type;
    if(parameter==='fromType'){
      if(!explicitConversionValid(type,n.params.toType,d.key)){
        const targets=convertTargets(type,d.key);n.params.toType=targets.includes(type)?type:targets.includes(d.defaults.toType)?d.defaults.toType:targets[0];
      }
      if(Object.hasOwn(n.inputValues||{},'value'))n.inputValues.value=matrixReshapeValue(n.inputValues.value,previous,type);
    }
  },{typeChange:true}));
  control.dataset.convertType=parameter;control.disabled=readonly;control.title=t(parameter==='fromType'?'convert.fromType':'convert.toType');return control;
}
function compareOperatorSelector(n){
  const control=select([['>','A > B'],['>=','A ≥ B'],['<','A < B'],['<=','A ≤ B'],['==','A == B'],['!=','A != B']],n.params.operator,value=>{
    if(!editorMutationBlocked()&&current().nodes.includes(n))change(()=>n.params.operator=value);
  });
  control.dataset.compareOperator=n.id;control.disabled=readonly;control.title=t('compare.operator');control.setAttribute('aria-label',control.title);
  for(const event of ['pointerdown','click','dblclick','keydown'])control.addEventListener(event,e=>e.stopPropagation());return control;
}
function changeMatrixAccess(n,key,value){
  return change(()=>{
    n.params[key]=value;
    for(const [port,type] of Object.entries(ports(n,'inputs')))if(Object.hasOwn(n.inputValues||{},port))n.inputValues[port]=shapedValue(n.inputValues[port],type);
  },{typeChange:true});
}
function vectorInspector(box,n,d){
  if(!isVectorOperation(d))return;
  const composed=['combine','vector','replace'].includes(d.key),control=nodeTypeSelector(n,d);
  if(control)box.append(parameterControlRow(t(composed?'vector.outputType':'vector.inputType'),control));
  if(d.key==='swizzle'){
    const slots=el('div',{class:'swizzle-components'}),names=vectorNames(n),components='xyzw'.slice(0,typeComponents(n.params.type));
    [...n.params.mask].forEach((value,index)=>{
      const selectComponent=select([...components].map((p,i)=>[p,names[i]]),value,next=>change(()=>n.params.mask=n.params.mask.slice(0,index)+next+n.params.mask.slice(index+1),{typeChange:true}));
      selectComponent.dataset.swizzleComponent=index;selectComponent.setAttribute('aria-label',t('vector.outputComponent')+' '+(index+1));selectComponent.disabled=readonly;
      applyComponentColorHint(selectComponent,'xyzw'.indexOf(value),names==='RGBA');
      slots.append(selectComponent);
    });
    for(const [label,enabled,edit]of [['−',n.params.mask.length>1,()=>n.params.mask=n.params.mask.slice(0,-1)],['+',n.params.mask.length<4,()=>n.params.mask+=components[Math.min(n.params.mask.length,components.length-1)]]]){
      const b=el('button',{type:'button','aria-label':t(label==='+'?'vector.addComponent':'vector.removeComponent')},label);b.disabled=readonly||!enabled;b.onclick=()=>change(edit,{typeChange:true});slots.append(b);
    }
    box.append(parameterControlRow(t('vector.componentOrder'),slots));
  }
}
function setNodeInputValue(n,port,next){
  if(['matrix_combine','matrix_replace'].includes(definition(n)?.key)&&port!=='value'){
    const shape=typeContract.types[n.params.type],match=/^c([0-3])([xyzw])?$/.exec(port);
    if(!match)return;
    n.params.values||=Array.from({length:shape.columns*shape.rows},(_,i)=>Math.floor(i/shape.rows)===i%shape.rows?1:0);
    const start=Number(match[1])*shape.rows+(match[2]?'xyzw'.indexOf(match[2]):0),values=Array.isArray(next)?next:[next];n.params.values.splice(start,values.length,...values);
  }else if(['combine','replace'].includes(definition(n)?.key)&&port!=='value'){
    n.params.components||=[0,0,0,0];const values=Array.isArray(next)?next:[next];n.params.components.splice('xyzw'.indexOf(port),values.length,...values);
  }else {n.inputValues||={};n.inputValues[port]=next;}
}
// Inline controls edit the same graph values as Parameter. Keep drafts outside
// the graph until commit, and keep their DOM alive across unrelated refreshes.
let inlineValueEdit=null,inlineValueRenderPending=false,inlineValueRenderTimer=null;
function inlineValueSignature(n){return JSON.stringify([n.params,n.inputValues,current().edges.filter(e=>e.to[0]===n.id)]);}
function deferInlineValueRender(){
  const edit=inlineValueEdit;if(!edit)return false;
  if(edit.entry.isConnected&&(document.activeElement===edit.entry||edit.entry.numericGestureActive||numericPresetMenu?.entry===edit.entry)&&!readonly&&edit.owner===current()&&current().nodes.includes(edit.node)&&edit.signature===inlineValueSignature(edit.node)){
    inlineValueRenderPending=true;return true;
  }
  edit.entry.cancelInlineValue?.();inlineValueEdit=null;return false;
}
function queueInlineValueRender(){
  inlineValueRenderPending=true;clearTimeout(inlineValueRenderTimer);
  inlineValueRenderTimer=setTimeout(()=>{
    inlineValueRenderTimer=null;if(inlineValueEdit?.entry&&(inlineValueEdit.entry===document.activeElement||inlineValueEdit.entry.numericGestureActive||numericPresetMenu?.entry===inlineValueEdit.entry))return;
    if(inlineValueRenderPending){inlineValueRenderPending=false;render();}
  },0);
}
function inlineNumericFields(n,port,value,write,labels='XYZW',options={}){
  const values=Array.isArray(value)?value:[value],box=el('span',{class:'node-inline-values'});
  const type=options.type||(port==='$value'?Object.values(ports(n,'outputs'))[0]:ports(n,'inputs')[port]),family=typeFamily(type),integer=['int','uint'].includes(family);
  values.forEach((v,index)=>{
    const label=(options.label||(port==='$value'?t('declaration.value'):portLabel(n,'inputs',port)))+(values.length>1?' '+labels[index]:'');
    if(family==='bool'){
      const entry=typedScalarInput(v,family,next=>{if(!editorMutationBlocked()&&entry.isConnected&&current().nodes.includes(n))change(()=>write(index,next));});
      entry.dataset.inlineNode=n.id;entry.dataset.inlinePort=port;entry.dataset.component=String(index);entry.disabled=readonly;entry.setAttribute('aria-label',label);
      applyValueComponentHint(entry,n,port,index,values.length>1,labels);
      for(const event of ['pointerdown','click','dblclick','keydown'])entry.addEventListener(event,e=>e.stopPropagation());
      if(values.length>1){const component=el('label',{class:'node-inline-component'}),caption=el('span',{'aria-hidden':'true'},labels[index]);applyValueComponentHint(caption,n,port,index,true,labels);component.append(caption,entry);box.append(component);}else box.append(entry);
      return;
    }
    const entry=el('input',{type:'number',step:integer?'1':'any','aria-label':label});
    entry.dataset.inlineNode=n.id;entry.dataset.inlinePort=port;entry.dataset.component=String(index);entry.disabled=readonly;entry.value=String(v);
    if(integer){entry.min=family==='uint'?'0':'-2147483648';entry.max=family==='uint'?'4294967295':'2147483647';}
    if(options.min!==undefined)entry.min=String(options.min);if(options.max!==undefined)entry.max=String(options.max);
    applyValueComponentHint(entry,n,port,index,values.length>1,labels);
    let committed=entry.value;
    entry.hasPendingEdit=()=>entry.value!==committed;
    const own=()=>!editorMutationBlocked()&&entry.isConnected&&current().nodes.includes(n)&&(!options.writable||options.writable(index));
    const focus=()=>{if(own())inlineValueEdit={entry,node:n,owner:current(),signature:inlineValueSignature(n)};};
    const restore=()=>{entry.value=committed;entry.refreshNumericSlider?.();entry.removeAttribute('aria-invalid');};
    const commit=()=>{
      if(entry.numericGestureActive||!own()||entry.value===committed)return;
      const next=Number(entry.value);
      if(!entry.value.trim()||!Number.isFinite(next)||(integer&&(!Number.isInteger(next)||next<Number(entry.min)||next>Number(entry.max)))){entry.setAttribute('aria-invalid','true');return;}
      // A changed source/topology invalidates a draft instead of writing it into
      // a replacement graph or another Subgraph definition.
      if(inlineValueEdit?.entry===entry&&inlineValueEdit.signature!==inlineValueSignature(n)){restore();return;}
      inlineValueEdit=null;
      const ok=change(()=>write(index,next),{redraw:false,typeChange:options.typeChange===true});
      if(!ok)return;
      committed=entry.value;entry.removeAttribute('aria-invalid');
      if(options.typeChange){render();return;}
      focus();
      const summary=entry.closest('.node')?.querySelector('[data-vector-summary]');if(summary)updateVectorManualSummary(n,summary);
      if(definition(n)?.key==='color')updateNodeColorPreview(n,entry.closest('.node'));
      if(selected===n.id)inspector();queueInlineValueRender();
    };
    entry.cancelInlineValue=()=>{restore();if(inlineValueEdit?.entry===entry)inlineValueEdit=null;};
    entry.beginNumericEdit=focus;entry.endNumericEdit=()=>{if(inlineValueEdit?.entry===entry)inlineValueEdit=null;queueInlineValueRender();};
    entry.addEventListener('focus',focus);
    entry.addEventListener('input',()=>entry.removeAttribute('aria-invalid'));
    entry.addEventListener('change',commit);
    entry.addEventListener('blur',()=>{if(numericPresetMenu?.entry===entry)return;if(!entry.numericGestureActive)commit();restore();if(inlineValueEdit?.entry===entry)inlineValueEdit=null;queueInlineValueRender();});
    entry.addEventListener('keydown',e=>{
      e.stopPropagation();
      if(e.key==='Enter'){e.preventDefault();commit();}
      else if(e.key==='Escape'){e.preventDefault();cancelValueLadder();restore();focus();}
    });
    installValueLadder(entry,commit);
    for(const event of ['pointerdown','click','dblclick','contextmenu'])entry.addEventListener(event,e=>e.stopPropagation());
    if(values.length>1){const component=el('label',{class:'node-inline-component'}),caption=el('span',{'aria-hidden':'true'},labels[index]);applyValueComponentHint(caption,n,port,index,true,labels);component.append(caption,entry);box.append(component);}
    else box.append(entry);
  });
  return box;
}
function matrixValueInput(n,column,row,{onNode=true,copy='compact'}={}){
  const shape=typeContract.types[n.params.type],index=column*shape.rows+row,labels=vectorNames(n);
  const entry=inlineNumericFields(n,'c'+column,matrixColumnValues(n,column)[row],(_,next)=>{
    n.params.values||=Array.from({length:shape.columns*shape.rows},(_,i)=>Math.floor(i/shape.rows)===i%shape.rows?1:0);n.params.values[index]=next;
  },labels,{type:shape.family,label:t('matrix.column').replace('{index}',column)+' '+labels[row],writable:()=>matrixComponentWritable(n,column,row)}).querySelector('input');
  entry.dataset.matrixNode=n.id;entry.dataset.matrixIndex=String(index);entry.dataset.matrixCopy=copy;entry.dataset.component=String(row);
  if(!onNode){delete entry.dataset.inlineNode;delete entry.dataset.inlinePort;}
  applyComponentColorHint(entry,row,labels==='RGBA');return entry;
}
function matrixInspector(box,n,d){
  const shape=typeContract?.types?.[n.params.type];if(!shape||!isMatrixOperation(d))return;
  if(!n.params.fixedType)box.append(parameterControlRow(t('node.type'),nodeTypeSelector(n,d)));
  if(d.key==='matrix_split')return;
  for(let column=0;column<shape.columns;column++){
    const key='c'+column,name=t('matrix.column').replace('{index}',column),row=parameterValueRow(n,key,name,typeForShape(shape.family,shape.rows),()=>matrixColumnValues(n,column),(index,next)=>{
      n.params.values||=Array.from({length:shape.columns*shape.rows},(_,i)=>Math.floor(i/shape.rows)===i%shape.rows?1:0);n.params.values[column*shape.rows+index]=next;
    },vectorNames(n),{writable:index=>matrixComponentWritable(n,column,index)});
    for(const entry of row.querySelectorAll('[data-component]')){entry.dataset.matrixNode=n.id;entry.dataset.matrixIndex=String(column*shape.rows+Number(entry.dataset.component));}
    const links=current().edges.filter(e=>e.to[0]===n.id&&(e.to[1]===key||e.to[1].startsWith(key)&&e.to[1].length===3));
    for(const connection of links){
      const peer=current().nodes.find(other=>other.id===connection.from[0]),line=el('div',{class:'connection-row'}),label=portLabel(n,'inputs',connection.to[1]);
      line.append(el('span',{class:'connection-source'},label+' ← '+nodeDisplayName(peer)+' · '+portLabel(peer,'outputs',connection.from[1])));
      const disconnect=el('button',{'aria-label':t('wire.disconnect')+label},t('wire.disconnectShort'));disconnect.disabled=readonly;disconnect.onclick=()=>change(()=>current().edges=current().edges.filter(e=>e!==connection));line.append(disconnect);row.append(line);
    }
    box.append(row);
  }
}
function nodeInlineValues(n,port){
  const type=ports(n,'inputs')[port],key=definition(n)?.key;
  if(!['float','double','int','uint','bool'].includes(type)||current().edges.some(e=>e.to[0]===n.id&&e.to[1]===port))return null;
  if(key==='replace'&&(port==='value'||current().edges.some(e=>e.to[0]===n.id&&e.to[1]==='value')))return null;
  const value=defaultInput(n,port,type);if(value===null)return null;
  if(type==='bool'){
    const box=el('span',{class:'node-inline-values'}),entry=select([['false','false'],['true','true']],String(!!value),next=>{
      if(!editorMutationBlocked()&&entry.isConnected&&current().nodes.includes(n))change(()=>setNodeInputValue(n,port,next==='true'));
    });
    entry.dataset.inlineNode=n.id;entry.dataset.inlinePort=port;entry.disabled=readonly;entry.setAttribute('aria-label',portLabel(n,'inputs',port));
    for(const event of ['pointerdown','click','dblclick','keydown'])entry.addEventListener(event,e=>e.stopPropagation());box.append(entry);return box;
  }
  return inlineNumericFields(n,port,value,(index,next)=>{
    const old=defaultInput(n,port,type),updated=Array.isArray(old)?old.slice():old;
    if(Array.isArray(updated))updated[index]=next;
    setNodeInputValue(n,port,Array.isArray(updated)?updated:next);
  },key==='replace'?vectorNames(n):'XYZW',nodeInputOptions(n,port));
}
function nodeFixedValueEditor(n){
  const key=definition(n)?.key;if(!['scalar','float','color','vector','vec2','vec3','vec4'].includes(key))return null;
  const isVector=key==='vector',value=isVector?(n.params.components||[0,0,0,0]).slice(0,typeComponents(n.params.type)):n.params.value;
  const fields=inlineNumericFields(n,'$value',value,(index,next)=>{
    if(isVector){n.params.components||=[0,0,0,0];n.params.components[index]=next;}
    else if(Array.isArray(n.params.value)){n.params.value=n.params.value.slice();n.params.value[index]=next;}else n.params.value=next;
  },key==='color'?'RGBA':isVector?vectorNames(n):'XYZW');fields.classList.add('node-fixed-values');
  if(key==='float'||key==='scalar')return fields;
  const expanded=n.ui?.componentsExpanded===true,box=el('div',{class:'node-manual-value-group'+(expanded?' expanded':''),'data-manual-values':n.id}),toggle=el('button',{class:'node-values-toggle',type:'button','aria-expanded':String(expanded),'aria-label':t('node.expandValues'),title:t('node.expandValues'),'data-value-expand':n.id},expanded?'▾':'▸');
  toggle.onpointerdown=e=>e.stopPropagation();toggle.ondblclick=e=>e.stopPropagation();toggle.onclick=e=>{e.stopPropagation();change(()=>{n.ui||={};n.ui.componentsExpanded=!expanded;},{localize:false,layout:true});};box.append(toggle,fields);
  if(key==='color'){box.classList.add('node-color-values');for(const entry of fields.querySelectorAll('input')){entry.title=entry.getAttribute('aria-label');entry.dataset.colorComponent='rgba'[Number(entry.dataset.component)];}}
  return box;
}
function updateNodeColorPreview(n,card){
  const display=colorDisplay(n.params.value),ink=card?.querySelector('.node-color .color-ink'),picker=card?.querySelector('.node-color input[type=color]');
  if(ink)ink.style.backgroundColor=display.css;if(picker)picker.value=display.hex;
}
function nodeColorPicker(n){
  const strip=el('div',{class:'node-color'}),swatch=colorPickerSwatch(()=>n.params.value,value=>{
    if(current().nodes.includes(n))change(()=>n.params.value=value);
  }),picker=swatch.querySelector('input');
  // Keep the native picker attached when leaving a numeric field schedules a redraw.
  picker.onfocus=()=>{if(!readonly)inlineValueEdit={entry:picker,node:n,owner:current(),signature:inlineValueSignature(n)};};
  picker.cancelInlineValue=()=>{picker.value=colorDisplay(n.params.value).hex;if(inlineValueEdit?.entry===picker)inlineValueEdit=null;};
  picker.onblur=()=>{if(inlineValueEdit?.entry===picker)inlineValueEdit=null;queueInlineValueRender();};
  for(const event of ['pointerdown','click','dblclick','contextmenu','keydown'])picker.addEventListener(event,e=>e.stopPropagation());
  strip.append(swatch);return strip;
}
function inspector(){
  if(deferParameterInspector()||deferCommentNodeEditor(false))return;
  if(!valueLadder?.entry?.dataset.inlineNode&&!pendingValueLadder?.entry?.dataset.inlineNode&&!numericPresetMenu?.entry?.dataset.inlineNode)cancelValueLadder();
  const box=$('#inspector');box.classList.remove('ordinary-parameters','comment-parameters','notes-parameters');box.replaceChildren();renderHelp();
  const n=current().nodes.find(n=>n.id===selected),d=n&&definition(n);
  if(n||selectedEdge!==null)selectedInputId=null;
  const inputSource=allInputSources().find(d=>d.id===selectedInputId);
  if(inputSource?.kind==='top_input'){topInputInspector(box,inputSource);return;}
  if(inputSource){inputSourceInspector(box,inputSource);return;}
  if(!n){
    box.append(el('p',{class:'muted'},selectedEdge!==null?t('wire.selected'):t('node.select')));
    if(selectedEdge!==null){const disconnect=el('button',{class:'wide danger','data-action':'disconnect-wire'},t('wire.disconnectSelected'));disconnect.disabled=readonly;disconnect.onclick=remove;box.append(disconnect);}
    return;
  }
  box.append(nodeInspectorTitle(n,d));
  if(!d)return;
  const ordinary=!isSourceReferenceNode(n);
  if(d.key==='comment'&&inspectorTab==='notes')inspectorTab='parameters';
  const tabs=el('div',{class:'parameter-tabs',role:'tablist','aria-label':t('panel.parameters')});
  for(const key of d.key!=='comment'?['parameters','settings','notes']:['parameters','settings']){
    const button=el('button',{class:inspectorTab===key?'active':'',role:'tab','aria-selected':String(inspectorTab===key)},t('panel.'+key));
    button.onclick=()=>{inspectorTab=key;inspector();};tabs.append(button);
  }
  box.append(tabs);
  if(inspectorTab==='notes'){box.classList.add('notes-parameters');box.append(nodeCommentField(n));return;}
  box.classList.toggle('ordinary-parameters',ordinary&&inspectorTab==='parameters');
  functionInspector(box,n,d);
  if(inspectorTab==='parameters'){
    if(d.key==='comment'){box.classList.add('comment-parameters');const section=el('section',{class:'comment-node-parameter'});section.append(commentNodeEditor(n),el('small',{class:'muted'},t('comment.hint')));box.append(section);return;}
    if(d.key==='glsl_code')glslCodeInspector(box,n);
    vectorInspector(box,n,d);
    matrixInspector(box,n,d);
    compositeInspector(box,n,d);
    if(d.key==='vector')box.append(parameterValueRow(n,'$value',t('declaration.value'),n.params.type,()=> (n.params.components||[0,0,0,0]).slice(0,typeComponents(n.params.type)),(index,value)=>{n.params.components||=[0,0,0,0];n.params.components[index]=value;},vectorNames(n)));
    if(supportsAutoType(d)&&!isVectorOperation(d)){
      const automatic=n.ui?.typeMode==='auto',control=nodeTypeSelector(n,d);
      const row=parameterControlRow(t('type.operation'),control);control.title=t(automatic?'type.autoHint':'type.lockedHint');box.append(row);
    }
    if(d.key==='scalar'&&!n.params.fixedType)box.append(parameterControlRow(t('node.type'),nodeTypeSelector(n,d)));
    if(isConvertOperation(d))for(const parameter of ['fromType','toType'])box.append(parameterControlRow(t(parameter==='fromType'?'convert.fromType':'convert.toType'),convertTypeSelector(n,parameter)));
    if(d.key==='compare')box.append(parameterControlRow(t('compare.operator'),compareOperatorSelector(n)));
    if(['matrix_get','matrix_set'].includes(d.key)){
      box.append(parameterControlRow(t('matrix.accessMode'),select([['column',t('matrix.wholeColumn')],['element',t('matrix.element')]],n.params.mode||'column',value=>changeMatrixAccess(n,'mode',value))));
      box.append(parameterControlRow(t('matrix.indexType'),select([['int','int'],['uint','uint']],n.params.indexType||'int',value=>changeMatrixAccess(n,'indexType',value))));
    }
    pixelBufferFields(box,n);
    if(d.key==='texture'){const split=el('button',{class:'wide'},t('sampler.split'));split.onclick=()=>splitLegacyTexture(n);box.append(ordinary?parameterControlRow('',split):split);}
    if('value'in n.params){
      if(ordinary){
        const values=parameterValueRow(n,'$value',t('declaration.value'),Object.values(ports(n,'outputs'))[0]||n.params.type||'float',()=>n.params.value,(index,value)=>{if(Array.isArray(n.params.value))n.params.value[index]=value;else n.params.value=value;},d.key==='color'?'RGBA':'XYZW');
        if(d.key==='color'){
          values.classList.add('color-parameter');values.querySelector('.parameter-value-controls').append(colorPickerSwatch(()=>n.params.value,value=>change(()=>n.params.value=value)));
          if(n.params.value.some(v=>v<0||v>1)){const hint=parameterControlRow('',parameterHint(t('color.range')));hint.classList.add('color-range-hint');values.append(hint);}
        }
        box.append(values);
      }else box.append((d.key==='color'?colorFields:numbers)(n.params.value,t('declaration.value'),value=>change(()=>n.params.value=value)));
    }
    const decl=graph.declarations.find(x=>x.id===n.params.declarationId);
    if(decl){
      const source=el('button',{class:'wide','data-inspect-input':decl.id},t('inputs.edit')+' · '+decl.name);
      source.onclick=()=>selectInputSource(decl.id);box.append(source);
      if(decl.kind==='sampler')declarationFields(box,decl);
      else if(decl.kind==='constant')constantFields(box,decl);
      else nativeInputFields(box,decl);
    }
    if(n.params.inputId){
      const sources=topInputsView(),source=sources.find(s=>s.id===n.params.inputId);
      box.append(field(t('inputs.referenceSource'),select(sources.map(s=>[s.id,s.name]),n.params.inputId,value=>change(()=>n.params.inputId=value))));
      if(source){const edit=el('button',{class:'wide'},t('inputs.edit')+' · '+source.name);edit.onclick=()=>selectInputSource(source.id);box.append(edit);}
    }
    if(d.key==='sampler'){const create=el('button',{class:'wide'},t('sampler.create'));create.onclick=()=>newSampler(n);box.append(create);}
    else if(d.key==='uniform'&&!decl){
      const create=el('button',{class:'wide'},t('uniform.create'));create.onclick=()=>newUniform(n);box.append(create);
    }
    const inputBox=d.key==='glsl_code'?el('details',{class:'code-input-values'}):box;
    if(d.key==='glsl_code'&&n.params.inputs.length){inputBox.append(el('summary',{},t('code.inputValues')));box.append(inputBox);}
    const hint=(text,className='')=>ordinary?parameterHint(text,className):el('p',{class:'muted '+className},text);
    for(const [port,type]of Object.entries(d.key==='function_output'?{}:ports(n,'inputs'))){
      if(isMatrixOperation(d)&&port!=='value')continue;
      const section=el('section',{class:'input-parameter'+(ordinary?' parameter-row':''),'data-input':port});
      const connection=current().edges.find(e=>e.to[0]===n.id&&e.to[1]===port);
      const typeInfo=inputTypeDisplay(n,port);
      const label=portLabel(n,'inputs',port),heading=el('h4',{class:'input-heading'});heading.append(el('span',ordinary?{class:'parameter-value-label',title:label}:{},label),el('small',ordinary?{class:'parameter-value-type',title:typeInfo.text}:{},typeInfo.text));section.append(heading);
      applyPortLabelColorHint(heading.firstElementChild,n,'inputs',port);
      if(typeInfo.source&&typeInfo.source!==typeInfo.target)section.append(hint(t(typeInfo.conversion==='splat'?'type.splat':typeInfo.conversion==='cast'?'type.cast':'type.incompatible').replace('{source}',typeInfo.source).replace('{target}',typeInfo.target),'conversion-hint'));
      const value=defaultInput(n,port,type);
      if(isCompositeType(type)){
        if(!connection)section.append(hint(compositeInputHint(n,port,type)));
      }else if(isResourceType(type)){
        if(!connection)section.append(hint(t('sampler.fallbackHint')));
      }else if(['replace','matrix_replace'].includes(d.key)&&(port==='value'||current().edges.some(e=>e.to[0]===n.id&&e.to[1]==='value'))){
        if(!connection)section.append(hint(t(port==='value'?'vector.baselineHint':'vector.inherited')));
      }else if(value===null){
        section.append(hint(t('input.implicitUV')));
        if(!connection){const override=el('button',{class:'wide'+(ordinary?' parameter-control':'')},t('input.setUV'));override.onclick=()=>change(()=>{n.inputValues||={};n.inputValues[port]=[.5,.5];});section.append(override);}
      }else if(!connection){
        if(ordinary){
          heading.remove();section.prepend(parameterValueRow(n,port,portLabel(n,'inputs',port),typeInfo.text,()=>defaultInput(n,port,type),(index,next)=>{
            const old=defaultInput(n,port,type);if(Array.isArray(old)){old[index]=next;setNodeInputValue(n,port,old);}else setNodeInputValue(n,port,next);
          },port==='color'?'RGBA':isVectorOperation(d)?vectorNames(n):'XYZW',nodeInputOptions(n,port)));
        }else {const values=numbers(value,portLabel(n,'inputs',port),next=>change(()=>setNodeInputValue(n,port,next)),false,port==='color'?'RGBA':'XYZW',type);values.classList.add('input-values');section.append(values);}
      }
      if(connection){
        const source=current().nodes.find(other=>other.id===connection.from[0]),connectionRow=el('div',{class:'connection-row'});
        const sourceName=nodeDisplayName(source),outputName=portLabel(source,'outputs',connection.from[1]),sourceLabel=sourceName===outputName?sourceName:sourceName+' · '+outputName;
        const origin=el('span',{class:'connection-source',title:sourceLabel},sourceLabel);
        const disconnect=el('button',{'aria-label':t('wire.disconnect')+portLabel(n,'inputs',port)},t('wire.disconnectShort'));disconnect.disabled=readonly;
        disconnect.onclick=()=>change(()=>current().edges=current().edges.filter(e=>e!==connection));connectionRow.append(origin,disconnect);section.append(connectionRow);
      }else if(['texture','texture_sample'].includes(d.key)&&port==='uv'&&value!==null){
        const reset=el('button',{class:'wide'+(ordinary?' parameter-control':'')},t('input.restoreUV'));reset.onclick=()=>change(()=>delete n.inputValues[port]);section.append(reset);
      }
      inputBox.append(section);
    }
  }else{
    if(d.key==='comment')noteAppearanceSettings(box,n);
    if(n.params.type&&!n.params.fixedType&&!supportsAutoType(d)&&!isVectorOperation(d)&&!isCompositeOperation(d))box.append(field(t('node.type'),nodeTypeSelector(n,d)));
    if(isVectorOperation(d)||isMatrixOperation(d))box.append(field(t('vector.names'),select([['xyzw','X / Y / Z / W'],['rgba','R / G / B / A'],['stpq','S / T / P / Q'],...(typeComponents(n.params.type)===2?[['uv','U / V']]:[])],n.ui?.componentNames||'xyzw',value=>change(()=>n.ui.componentNames=value))));
    if(typeContract?.constantExpressions?.includes(d.key)&&!['constant','spec_constant','scalar','vector','matrix','float','vec2','vec3','vec4','color'].includes(d.key)){
      const requirement=el('input',{type:'checkbox','data-require-constant':n.id});requirement.checked=!!n.params.requireConstant;requirement.disabled=readonly;
      requirement.onchange=()=>change(()=>{if(requirement.checked)n.params.requireConstant=true;else delete n.params.requireConstant;});
      const row=field(t('vector.requireConstant'),requirement);row.classList.add('constant-requirement');row.title=t('vector.constantHint');box.append(row,el('p',{class:'muted'},t('vector.constantHint')));
    }
    if('declarationId'in n.params){
      const options=graph.declarations.filter(x=>x.kind===(['uniform','constant','spec_constant','pop_buffer','attribute'].includes(d.key)?d.key:'sampler')).map(x=>[x.id,x.name]);
      box.append(field(t('node.declaration'),select([['',t('select.placeholder')],...options],n.params.declarationId,value=>change(()=>n.params.declarationId=value))));
      const decl=graph.declarations.find(x=>x.id===n.params.declarationId);if(decl)declarationFields(box,decl,true);
    }
    pixelBufferNames(box,n);
    box.append(el('div',{class:'node-identity'},n.id));
  }
  updateUniformFields();

}

/* Sidebar visibility is independent of its remembered width and Shader state. */
function isSidebarOpen(side){
  const suffix=side==='left'?'library':'details';
  return matchMedia('(max-width:800px)').matches?document.body.classList.contains('show-'+suffix):!document.body.classList.contains('hide-'+suffix);
}
function syncSidebarButtons(){
  for(const [side,id]of [['left','togglelibrary'],['right','toggledetails']]){
    const button=$('#'+id);if(!button)continue;
    const open=isSidebarOpen(side),label=t('sidebar.'+(open?'hide':'show')+(side==='left'?'Left':'Right'));
    button.setAttribute('aria-expanded',String(open));button.setAttribute('aria-label',label);button.title=label;
  }
}
function setSidebarOpen(side,open){
  cancelValueLadder();cancelConnection();closeCreator();
  const compact=matchMedia('(max-width:800px)').matches,suffix=side==='left'?'library':'details';
  document.body.classList.toggle((compact?'show-':'hide-')+suffix,compact?open:!open);
  if(compact&&open)document.body.classList.remove('show-'+(side==='left'?'details':'library'));
  syncSidebarButtons();window.dispatchEvent(new Event('sidebarvisibilitychange'));
}
function installSidebarVisibility(){
  $('#togglelibrary').onclick=()=>setSidebarOpen('left',!isSidebarOpen('left'));
  $('#toggledetails').onclick=()=>setSidebarOpen('right',!isSidebarOpen('right'));
  matchMedia('(max-width:800px)').addEventListener('change',()=>{syncSidebarButtons();window.dispatchEvent(new Event('sidebarvisibilitychange'));});
  syncSidebarButtons();
}

/* Sidebar widths are browser preferences; they never edit the Shader graph. */
function installSidebarWidths(){
  const host=document.querySelector('main'),storageKey='sgrapeSidebarWidths',compact=matchMedia('(max-width:800px)');
  const handles={left:$('#libraryresize'),right:$('#detailsresize')};
  const metric=(name,fallback)=>Number.parseFloat(getComputedStyle(host).getPropertyValue(name))||fallback;
  const settings={left:{min:metric('--sidebar-left-min',180),max:metric('--sidebar-left-max',520),initial:metric('--sidebar-left-default',220)},right:{min:metric('--sidebar-right-min',300),max:metric('--sidebar-right-max',640),initial:metric('--sidebar-right-default',340)}};
  const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
  let saved={};try{saved=JSON.parse(localStorage.getItem(storageKey))||{};}catch{}
  let preferred=Object.fromEntries(Object.entries(settings).map(([side,s])=>[side,Number.isFinite(saved[side])?clamp(saved[side],s.min,s.max):s.initial]));
  let current={...preferred},gesture=null,frame=0;
  function bounds(side){
    const s=settings[side],other=side==='left'?'right':'left';
    const dividerCount=Number(isSidebarOpen('left'))+Number(isSidebarOpen('right'));
    const room=compact.matches?host.clientWidth-32:host.clientWidth-dividerCount*metric('--sidebar-divider',6)-metric('--sidebar-canvas-min',280)-(isSidebarOpen(other)?current[other]:0);
    const max=Math.max(0,Math.min(s.max,room));return {min:Math.min(s.min,max),max};
  }
  function paint(){
    for(const side of ['left','right'])host.style.setProperty('--'+side+'-sidebar-width',current[side]+'px');
    for(const side of ['left','right']){const b=bounds(side),handle=handles[side];handle.setAttribute('aria-valuemin',Math.round(b.min));handle.setAttribute('aria-valuemax',Math.round(b.max));handle.setAttribute('aria-valuenow',Math.round(current[side]));}
    if(!frame)frame=requestAnimationFrame(()=>{frame=0;if(graph)wires();});
  }
  function layout(){
    current={...preferred};
    if(compact.matches){for(const side of ['left','right']){const b=bounds(side);current[side]=clamp(current[side],b.min,b.max);}}
    else{
      const visible=['left','right'].filter(isSidebarOpen);
      let excess=Math.max(0,visible.reduce((sum,side)=>sum+current[side],0)-(host.clientWidth-visible.length*metric('--sidebar-divider',6)-metric('--sidebar-canvas-min',280)));
      for(const side of visible){const take=Math.min(excess,current[side]-settings[side].min);current[side]-=take;excess-=take;}
    }
    paint();
  }
  function save(){try{localStorage.setItem(storageKey,JSON.stringify(preferred));}catch{}window.dispatchEvent(new Event('workspacepreferenceschange'));}
  function setWidth(side,width){const b=bounds(side);current[side]=clamp(width,b.min,b.max);paint();}
  for(const [side,handle]of Object.entries(handles)){
    const direction=side==='left'?1:-1;
    handle.addEventListener('pointerdown',event=>{
      if(event.button!==0||!handle.getClientRects().length)return;
      event.preventDefault();event.stopPropagation();gesture?.cancel();cancelValueLadder();cancelConnection();closeCreator();handle.focus({preventScroll:true});
      const before={...current},start=event.clientX,controller=new AbortController(),options={capture:true,signal:controller.signal};let finished=false;
      document.body.classList.add('resizing-sidebar');handle.classList.add('resizing');
      function finish(accept){
        if(finished)return;finished=true;controller.abort();gesture=null;
        document.body.classList.remove('resizing-sidebar');handle.classList.remove('resizing');
        if(handle.hasPointerCapture(event.pointerId))handle.releasePointerCapture(event.pointerId);
        if(accept){preferred[side]=current[side];save();}else{current=before;paint();}
      }
      gesture={cancel:()=>finish(false)};
      window.addEventListener('pointermove',e=>{if(e.pointerId!==event.pointerId)return;if(!(e.buttons&1)){finish(false);return;}e.preventDefault();setWidth(side,before[side]+(e.clientX-start)*direction/uiScaleFactor());},options);
      window.addEventListener('pointerup',e=>{if(e.pointerId===event.pointerId&&e.button===0){e.preventDefault();e.stopPropagation();setWidth(side,before[side]+(e.clientX-start)*direction/uiScaleFactor());finish(true);}},options);
      window.addEventListener('pointercancel',e=>{if(e.pointerId===event.pointerId)finish(false);},options);
      handle.addEventListener('lostpointercapture',()=>finish(false),options);
      window.addEventListener('blur',()=>finish(false),options);
      window.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();finish(false);}},options);
      document.addEventListener('visibilitychange',()=>{if(document.hidden)finish(false);},options);
      try{handle.setPointerCapture(event.pointerId);}catch{finish(false);}
    });
    handle.addEventListener('keydown',event=>{
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
      event.preventDefault();event.stopPropagation();gesture?.cancel();cancelValueLadder();const b=bounds(side);
      const amount=(event.shiftKey?32:8)*(event.key==='ArrowRight'?1:-1)*direction;
      setWidth(side,event.key==='Home'?b.min:event.key==='End'?b.max:current[side]+amount);preferred[side]=current[side];save();
    });
    handle.addEventListener('dblclick',event=>{event.preventDefault();gesture?.cancel();setWidth(side,settings[side].initial);preferred[side]=current[side];save();});
  }
  window.addEventListener('resize',()=>{gesture?.cancel();layout();});
  window.addEventListener('workspacewidthschange',()=>{gesture?.cancel();let value={};try{value=JSON.parse(localStorage.getItem(storageKey))||{};}catch{}for(const side of ['left','right']){const s=settings[side];preferred[side]=Number.isFinite(value[side])?clamp(value[side],s.min,s.max):s.initial;}layout();});
  window.addEventListener('sidebarvisibilitychange',()=>{gesture?.cancel();layout();});layout();
}

/* Pane proportions are view preferences, independent of Shader data. */
function installPanelHeights(panels,options={}){
  const host=options.host||$('.details'),key=options.key||'sgrapeInspectorSizes',handles=options.handles||[...host.querySelectorAll('.panel-divider')],events=new AbortController();
  const metric=(name,fallback)=>Number.parseFloat(getComputedStyle(host).getPropertyValue(name))||fallback;
  const defaults=Object.fromEntries(panels.map(p=>[p.dataset.panel,metric('--panel-'+p.dataset.panel+'-weight',1)]));
  let saved={};try{saved=JSON.parse(localStorage.getItem(key))||{};}catch{}
  if(options.weights)saved=options.weights;
  let weights=Object.fromEntries(panels.map(p=>{const id=p.dataset.panel;return [id,Number.isFinite(saved[id])&&saved[id]>0?Math.max(.0001,Math.min(10000,saved[id])):defaults[id]];}));
  let heights={},minimumBody=0,header=38,gesture=null;
  const expanded=()=>panels.filter(p=>!p.classList.contains('collapsed'));
  function pair(handle){
    const lower=panels.find(p=>p.dataset.panel===handle.dataset.panelResize);
    if(lower.classList.contains('collapsed'))return null;
    const upper=panels.slice(0,panels.indexOf(lower)).reverse().find(p=>!p.classList.contains('collapsed'));
    return upper?[upper.dataset.panel,lower.dataset.panel]:null;
  }
  function limits(ids){const total=heights[ids[0]]+heights[ids[1]];return {min:header+minimumBody,max:total-header-minimumBody,total};}
  function paint(){
    for(const panel of panels)panel.style.flex='0 0 '+heights[panel.dataset.panel]+'px';
    for(const handle of handles){
      const ids=pair(handle);handle.hidden=!ids;if(!ids)continue;
      const bounds=limits(ids);handle.setAttribute('aria-controls',ids.map(id=>panels.find(p=>p.dataset.panel===id).id).join(' '));
      handle.setAttribute('aria-valuemin',Math.round(bounds.min));handle.setAttribute('aria-valuemax',Math.round(bounds.max));handle.setAttribute('aria-valuenow',Math.round(heights[ids[0]]));
    }
  }
  function layout(){
    if(!host.clientHeight)return;
    header=metric('--panel-header-height',38);const opened=expanded();
    const dividerCount=handles.filter(h=>pair(h)).length;
    let remaining=Math.max(0,host.clientHeight-header*panels.length-dividerCount*metric('--panel-divider-size',6));
    minimumBody=opened.length?Math.min(metric('--panel-body-min',80),remaining/opened.length):0;
    heights=Object.fromEntries(panels.map(p=>[p.dataset.panel,header]));
    let pool=opened.map(p=>p.dataset.panel);
    while(pool.length){
      const sum=pool.reduce((n,id)=>n+weights[id],0),small=pool.filter(id=>remaining*weights[id]/sum<minimumBody);
      if(!small.length){for(const id of pool)heights[id]+=remaining*weights[id]/sum;break;}
      for(const id of small){heights[id]+=minimumBody;remaining-=minimumBody;}
      pool=pool.filter(id=>!small.includes(id));
    }
    paint();
  }
  function setUpper(ids,value){const b=limits(ids);heights[ids[0]]=Math.max(b.min,Math.min(b.max,value));heights[ids[1]]=b.total-heights[ids[0]];paint();}
  function save(){
    const ids=expanded().map(p=>p.dataset.panel),bodyTotal=ids.reduce((n,id)=>n+Math.max(0,heights[id]-header),0),mass=ids.reduce((n,id)=>n+weights[id],0);
    if(!bodyTotal)return;
    for(const id of ids)weights[id]=Math.max(.0001,(heights[id]-header)/bodyTotal*mass);
    try{localStorage.setItem(key,JSON.stringify(weights));}catch{}
    options.onSave?.({...weights});
  }
  function cancel(){gesture?.cancel();}
  for(const handle of handles){
    handle.addEventListener('pointerdown',event=>{
      if(event.button!==0||!pair(handle))return;
      event.preventDefault();event.stopPropagation();cancel();cancelValueLadder();cancelConnection();closeCreator();handle.focus({preventScroll:true});
      const ids=pair(handle),before={...heights},start=event.clientY,controller=new AbortController(),options={capture:true,signal:controller.signal};let finished=false;
      document.body.classList.add('resizing-panel');handle.classList.add('resizing');
      function finish(accept){
        if(finished)return;finished=true;controller.abort();gesture=null;
        document.body.classList.remove('resizing-panel');handle.classList.remove('resizing');
        if(handle.hasPointerCapture(event.pointerId))handle.releasePointerCapture(event.pointerId);
        if(accept)save();else{heights=before;paint();}
      }
      gesture={cancel:()=>finish(false)};
      window.addEventListener('pointermove',e=>{if(e.pointerId!==event.pointerId)return;if(!(e.buttons&1)){finish(false);return;}e.preventDefault();setUpper(ids,before[ids[0]]+(e.clientY-start)/uiScaleFactor());},options);
      window.addEventListener('pointerup',e=>{if(e.pointerId===event.pointerId&&e.button===0){e.preventDefault();e.stopPropagation();setUpper(ids,before[ids[0]]+(e.clientY-start)/uiScaleFactor());finish(true);}},options);
      window.addEventListener('pointercancel',e=>{if(e.pointerId===event.pointerId)finish(false);},options);
      handle.addEventListener('lostpointercapture',()=>finish(false),options);
      window.addEventListener('blur',()=>finish(false),options);
      window.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();finish(false);}},options);
      document.addEventListener('visibilitychange',()=>{if(document.hidden)finish(false);},options);
      try{handle.setPointerCapture(event.pointerId);}catch{finish(false);}
    },{signal:events.signal});
    handle.addEventListener('keydown',event=>{
      if(!['ArrowUp','ArrowDown','Home','End'].includes(event.key))return;
      const ids=pair(handle);if(!ids)return;event.preventDefault();event.stopPropagation();cancel();cancelValueLadder();const b=limits(ids);
      setUpper(ids,event.key==='Home'?b.min:event.key==='End'?b.max:heights[ids[0]]+(event.key==='ArrowDown'?1:-1)*(event.shiftKey?32:8));save();
    },{signal:events.signal});
    handle.addEventListener('dblclick',event=>{
      const ids=pair(handle);if(!ids)return;event.preventDefault();cancel();const b=limits(ids);
      setUpper(ids,header+(b.total-2*header)*defaults[ids[0]]/(defaults[ids[0]]+defaults[ids[1]]));save();
    },{signal:events.signal});
  }
  const observer=new ResizeObserver(()=>{cancel();layout();});observer.observe(host);
  layout();return {cancel,layout,destroy(){cancel();events.abort();observer.disconnect();}};
}

/* The description keeps its chosen height even when its text or dock changes. */
function installBrowserDetailResize(){
  const host=$('#browserbody'),list=$('#librarycontent'),detail=$('#browserdetail'),handle=$('#browserdetailresize');
  const key='grapeBrowserDetailHeight',defaultHeight=240;
  let preferred=defaultHeight,height=defaultHeight,gesture=null;
  try{const saved=Number(localStorage.getItem(key));if(Number.isFinite(saved)&&saved>0)preferred=saved;}catch{}
  function limits(){
    const style=getComputedStyle(host),divider=Number.parseFloat(getComputedStyle(handle).getPropertyValue('--panel-divider-size'))||6;
    const available=Math.max(0,Math.floor((host.getBoundingClientRect().bottom-list.getBoundingClientRect().top)/uiScaleFactor()-(Number.parseFloat(style.paddingBottom)||0)-divider));
    const max=Math.max(0,available-Math.min(140,Math.floor(available/2)));
    return {min:Math.min(112,max),max};
  }
  function layout(){
    if(!host.getClientRects().length)return;
    const b=limits();height=Math.max(b.min,Math.min(b.max,preferred));detail.style.flexBasis=height+'px';
    handle.setAttribute('aria-valuemin',b.min);handle.setAttribute('aria-valuemax',b.max);handle.setAttribute('aria-valuenow',height);
  }
  function save(){try{localStorage.setItem(key,String(preferred));}catch{}}
  function set(value){const b=limits();preferred=Math.max(b.min,Math.min(b.max,Math.round(value)));layout();}
  function cancel(){gesture?.cancel();}
  handle.addEventListener('pointerdown',event=>{
    if(event.button!==0||detail.hidden)return;
    event.preventDefault();event.stopPropagation();cancel();cancelValueLadder();cancelConnection();closeCreator();handle.focus({preventScroll:true});
    layout();const before=preferred,startHeight=height,startY=event.clientY,controller=new AbortController(),options={capture:true,signal:controller.signal};let finished=false;
    document.body.classList.add('resizing-panel');handle.classList.add('resizing');
    function finish(accept){
      if(finished)return;finished=true;controller.abort();gesture=null;
      document.body.classList.remove('resizing-panel');handle.classList.remove('resizing');
      if(handle.hasPointerCapture(event.pointerId))handle.releasePointerCapture(event.pointerId);
      if(accept)save();else{preferred=before;layout();}
    }
    gesture={cancel:()=>finish(false)};
    window.addEventListener('pointermove',e=>{if(e.pointerId!==event.pointerId)return;if(!(e.buttons&1)){finish(false);return;}e.preventDefault();set(startHeight+(startY-e.clientY)/uiScaleFactor());},options);
    window.addEventListener('pointerup',e=>{if(e.pointerId===event.pointerId&&e.button===0){e.preventDefault();e.stopPropagation();set(startHeight+(startY-e.clientY)/uiScaleFactor());finish(true);}},options);
    window.addEventListener('pointercancel',e=>{if(e.pointerId===event.pointerId)finish(false);},options);
    handle.addEventListener('lostpointercapture',()=>finish(false),options);
    window.addEventListener('blur',()=>finish(false),options);
    window.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();finish(false);}},options);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)finish(false);},options);
    try{handle.setPointerCapture(event.pointerId);}catch{finish(false);}
  });
  handle.addEventListener('keydown',event=>{
    if(!['ArrowUp','ArrowDown','Home','End'].includes(event.key))return;
    event.preventDefault();event.stopPropagation();cancel();layout();const b=limits();
    set(event.key==='Home'?b.min:event.key==='End'?b.max:height+(event.key==='ArrowUp'?1:-1)*(event.shiftKey?32:8));save();
  });
  handle.addEventListener('dblclick',event=>{event.preventDefault();cancel();preferred=defaultHeight;layout();save();});
  // Viewport clamping never overwrites the saved height; expanding restores it.
  new ResizeObserver(()=>{cancel();layout();}).observe(host);
  new MutationObserver(()=>{if(detail.hidden)cancel();layout();}).observe(detail,{attributes:true,attributeFilter:['hidden']});
  layout();
}

/* Limited two-sidebar workspace. All persisted data is presentation only. */
function installPanelWorkspace(){
  const ids=['browser','parameters','uniforms','controls','live','help','structures'],key='grapeWorkspaceV1',presetsKey='grapeWorkspacePresetsV1';
  const hosts={left:$('#sidebar-left'),right:$('#parameter-sidebar')},panes={browser:$('#nodelibrary')},heads={};
  const copy=value=>JSON.parse(JSON.stringify(value)),read=(k,f)=>{try{return JSON.parse(localStorage.getItem(k))??f;}catch{return f;}};
  const write=(k,value)=>{try{localStorage.setItem(k,JSON.stringify(value));return true;}catch{status(t('layout.storageError'),true);return false;}};
  const defaults=()=>({version:1,left:[{panels:['browser','uniforms','structures'],active:'browser',collapsed:false,weight:1}],right:[{panels:['parameters','controls'],active:'parameters',collapsed:false,weight:5},{panels:['live'],active:'live',collapsed:false,weight:3},{panels:['help'],active:'help',collapsed:false,weight:2}],widths:{left:220,right:340},visibility:{left:true,right:true},hidden:[]});
  function validate(raw){
    if(!raw||raw.version!==1)throw Error(t('layout.invalid'));
    const value=defaults(),seen=[];
    for(const side of ['left','right']){
      if(!Array.isArray(raw[side])||raw[side].length>ids.length)throw Error(t('layout.invalid'));
      value[side]=raw[side].map(group=>{
        if(!group||!Array.isArray(group.panels)||!group.panels.length||!group.panels.every(id=>ids.includes(id)))throw Error(t('layout.invalid'));
        seen.push(...group.panels);
        return {panels:[...group.panels],active:group.panels.includes(group.active)?group.active:group.panels[0],collapsed:group.collapsed===true,weight:Number.isFinite(group.weight)&&group.weight>0?Math.max(.0001,Math.min(10000,group.weight)):1};
      });
      const width=raw.widths?.[side];value.widths[side]=Number.isFinite(width)?Math.max(side==='left'?180:300,Math.min(side==='left'?520:640,width)):value.widths[side];
      value.visibility[side]=raw.visibility?.[side]!==false;
    }
    if(seen.length===4&&!seen.includes('uniforms')&&new Set(seen).size===4){const group=[...value.left,...value.right].find(g=>g.panels.includes('browser'));group.panels.push('uniforms');seen.push('uniforms');}
    if(seen.length===5&&!seen.includes('controls')&&new Set(seen).size===5){const group=[...value.left,...value.right].find(g=>g.panels.includes('parameters'));group.panels.push('controls');seen.push('controls');}
    if(seen.length===6&&!seen.includes('structures')&&new Set(seen).size===6){if(!value.left.length)value.left.push({panels:[],active:'structures',collapsed:false,weight:1});value.left[0].panels.push('structures');seen.push('structures');}
    if(seen.length!==ids.length||new Set(seen).size!==ids.length)throw Error(t('layout.invalid'));
    if(raw.hidden!==undefined&&(!Array.isArray(raw.hidden)||raw.hidden.some(id=>!ids.includes(id))||new Set(raw.hidden).size!==raw.hidden.length))throw Error(t('layout.invalid'));
    value.hidden=[...(raw.hidden||[])];
    return value;
  }
  let state=defaults(),sizes=[],drag=null,restoring=false;
  try{const stored=read(key,null);if(stored)state=validate(stored);else{
    state.widths={...state.widths,...read('sgrapeSidebarWidths',{})};
    const open=read('sgrapeInspectorPanels',{}),weights=read('sgrapeInspectorSizes',{});
    for(const g of state.right){g.collapsed=open[g.active]===false;g.weight=weights[g.active]||g.weight;}
    state=validate(state);
  }}catch{}
  // Upgrade only the former stock arrangement, once. Personal layouts and named presets stay put.
  const inputsPlacementKey='grapeInputsDefaultLeftV1';
  if(!read(inputsPlacementKey,false)){
    const topology=JSON.stringify([state.left,state.right].map(groups=>groups.map(g=>g.panels.filter(id=>id!=='structures'))));
    if(topology==='[[["browser"]],[["parameters","uniforms","controls"],["live"],["help"]]]'){
      state.left[0].panels.push('uniforms');state.right[0].panels=state.right[0].panels.filter(id=>id!=='uniforms');
      if(state.right[0].active==='uniforms'){state.left[0].active='uniforms';state.right[0].active='parameters';}
      write(key,state);
    }
    write(inputsPlacementKey,true);
  }
  const storedPresets=read(presetsKey,[]);let presets=[];for(const item of (Array.isArray(storedPresets)?storedPresets.slice(0,100):[])){try{if(typeof item.name==='string'&&item.name.trim())presets.push({name:item.name.slice(0,80),layout:validate(item.layout)});}catch{}}
  const browserHead=el('button',{id:'browsertoggle',class:'panel-heading',type:'button','aria-controls':'browserbody'});
  const browserLabel=el('span',{'data-i18n':'panel.addNode'});browserHead.append(browserLabel);
  $('#nodelibrary .section-label').remove();
  const browserBody=el('div',{id:'browserbody',class:'browser-body'});browserBody.append(...panes.browser.childNodes);panes.browser.append(browserBody);heads.browser=browserHead;
  for(const id of ids.slice(1)){panes[id]=$('#pane-'+id);heads[id]=panes[id].querySelector('.panel-heading');heads[id].remove();}
  for(const id of ids){panes[id].classList.remove('inspector-panel','collapsed');panes[id].classList.add('workspace-pane');panes[id].style.flex='';panes[id].setAttribute('role','tabpanel');panes[id].setAttribute('aria-labelledby',heads[id].id);heads[id].setAttribute('aria-controls',panes[id].id);heads[id].classList.add('workspace-tab');heads[id].dataset.workspacePanel=id;heads[id].type='button';}
  for(const [side,host]of Object.entries(hosts)){host.dataset.workspaceSide=side;host.classList.add('workspace-sidebar');}
  function title(id){return id==='browser'?t('panel.addNode'):id==='uniforms'?t('sources.title'):id==='structures'?t('struct.title'):id==='controls'?t('controls.title'):id==='parameters'?t('panel.parameterTitle'):id==='help'?t('panel.helpTitle'):$('#previewtitle').textContent;}
  function locate(id){for(const side of ['left','right']){const index=state[side].findIndex(g=>g.panels.includes(id));if(index>=0)return {side,index,group:state[side][index]};}}
  function persist(){if(restoring)return;state.widths={...state.widths,...read('sgrapeSidebarWidths',{})};if(!matchMedia('(max-width:800px)').matches)state.visibility={left:isSidebarOpen('left'),right:isSidebarOpen('right')};write(key,state);}
  const parking=el('div',{hidden:true});document.body.append(parking);
  function build(){
    sizes.forEach(s=>s.destroy());sizes=[];
    for(const id of ids){panes[id].hidden=true;parking.append(heads[id],panes[id]);}
    for(const [side,host]of Object.entries(hosts)){
      host.replaceChildren();const groups=[];
      for(const group of state[side]){
        const visible=group.panels.filter(id=>!state.hidden.includes(id));if(!visible.length)continue;
        if(!visible.includes(group.active))group.active=visible[0];
        const groupId=group.panels[0],section=el('section',{class:'inspector-panel workspace-group','data-panel':groupId,'data-workspace-group':groupId,'data-tabbed':String(visible.length>1)});
        const bar=el('div',{class:'workspace-tabs',role:'tablist'});
        for(const id of visible){const button=heads[id];button.setAttribute('role','tab');button.setAttribute('aria-selected',String(group.active===id));button.setAttribute('aria-expanded',String(!group.collapsed));button.tabIndex=group.active===id?0:-1;
          button.onclick=()=>{group.active=id;group.collapsed=false;build();persist();heads[id].focus({preventScroll:true});};
          button.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();e.stopPropagation();const at=visible.indexOf(id),next=e.key==='Home'?0:e.key==='End'?visible.length-1:(at+(e.key==='ArrowRight'?1:-1)+visible.length)%visible.length;group.active=visible[next];group.collapsed=false;build();persist();heads[group.active].focus();};
          button.onpointerdown=e=>beginDrag(e,id);bar.append(button);
        }
        const fold=el('button',{type:'button',class:'workspace-fold','aria-label':t(group.collapsed?'layout.expand':'layout.collapse'),title:t(group.collapsed?'layout.expand':'layout.collapse'),'aria-expanded':String(!group.collapsed)});
        fold.innerHTML='<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="m4 6 4 4 4-4"/></svg>';
        fold.onclick=()=>{group.collapsed=!group.collapsed;build();persist();};bar.append(fold);
        section.append(bar);section.classList.toggle('collapsed',group.collapsed);
        for(const id of visible){const pane=panes[id];pane.hidden=group.collapsed||group.active!==id;const body=pane.querySelector('.panel-scroll');if(body)body.hidden=false;section.append(pane);}
        const handle=el('div',{class:'panel-divider',id:'resize-'+groupId,'data-panel-resize':groupId,role:'separator','aria-orientation':'horizontal','aria-label':t('layout.resize'),tabindex:'0'});
        if(groups.length)host.append(handle);host.append(section);groups.push(section);
      }
      if(!groups.length){host.append(el('div',{class:'workspace-empty'},t('layout.empty')));continue;}
      sizes.push(installPanelHeights(groups,{host,key:'grapeWorkspaceSizes-'+side,weights:Object.fromEntries(state[side].map(g=>[g.panels[0],g.weight])),onSave:weights=>{for(const g of state[side])if(Number.isFinite(weights[g.panels[0]]))g.weight=weights[g.panels[0]];persist();}}));
    }
    if(typeof graph!=='undefined'&&graph)preview().catch(error=>status(error.message,true));
  }
  function move(id,side,targetId=null,mode='after',tabIndex=null){
    if(!ids.includes(id)||!hosts[side])return;
    const source=locate(id),target=targetId?locate(targetId):null,destination=target?.group;
    if(destination===source.group&&source.group.panels.length===1)return;
    let index=Number.isInteger(tabIndex)?Math.max(0,Math.min(destination?.panels.length||0,tabIndex)):destination?.panels.length||0;
    if(mode==='tab'&&destination===source.group&&source.group.panels.indexOf(id)<index)index--;
    source.group.panels=source.group.panels.filter(x=>x!==id);
    if(source.group.active===id)source.group.active=source.group.panels[0];
    if(!source.group.panels.length)state[source.side].splice(state[source.side].indexOf(source.group),1);
    if(mode==='tab'&&destination&&destination.panels.length){destination.panels.splice(index,0,id);destination.active=id;destination.collapsed=false;}
    else{let position=destination?state[side].indexOf(destination):state[side].length;if(position<0)position=state[side].length;else if(destination&&mode==='after')position++;
      state[side].splice(position,0,{panels:[id],active:id,collapsed:false,weight:source.group.weight});}
    state.hidden=state.hidden.filter(x=>x!==id);build();persist();
  }
  function beginDrag(event,id){
    if(event.button!==0)return;const sx=event.clientX,sy=event.clientY,controller=new AbortController(),options={capture:true,signal:controller.signal};let active=false,target=null,ghost=null,mark=null;
    drag?.();
    const beforeVisibility={left:isSidebarOpen('left'),right:isSidebarOpen('right')};
    function finish(accept){controller.abort();drag=null;ghost?.remove();mark?.remove();document.body.classList.remove('moving-panel');
      if(active){const swallow=e=>{e.preventDefault();e.stopImmediatePropagation();};document.addEventListener('click',swallow,{capture:true,once:true});setTimeout(()=>document.removeEventListener('click',swallow,true),0);}
      if(accept&&target)move(id,target.side,target.id,target.mode,target.tabIndex);
      else if(active)for(const side of ['left','right'])if(isSidebarOpen(side)!==beforeVisibility[side])setSidebarOpen(side,beforeVisibility[side]);
    }
    drag=()=>finish(false);
    window.addEventListener('pointermove',e=>{if(e.pointerId!==event.pointerId)return;if(!(e.buttons&1)){finish(false);return;}if(!active&&Math.hypot(e.clientX-sx,e.clientY-sy)<6)return;
      e.preventDefault();e.stopPropagation();if(!active){active=true;cancelValueLadder();cancelConnection();closeCreator();document.body.classList.add('moving-panel');ghost=el('div',{class:'workspace-drag-label'},title(id));mark=el('div',{class:'workspace-drop-mark'});document.body.append(ghost,mark);}
      ghost.style.left=(e.clientX+14)/uiScaleFactor()+'px';ghost.style.top=(e.clientY+10)/uiScaleFactor()+'px';
      if(!matchMedia('(max-width:800px)').matches){if(e.clientX<28&&!isSidebarOpen('left'))setSidebarOpen('left',true);if(e.clientX>innerWidth-28&&!isSidebarOpen('right'))setSidebarOpen('right',true);}
      target=null;mark.hidden=true;
      for(const [side,host]of Object.entries(hosts)){const rect=host.getBoundingClientRect();if(!host.getClientRects().length||e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)continue;
        const group=[...host.querySelectorAll('.workspace-group')].find(g=>{const r=g.getBoundingClientRect();return e.clientY>=r.top&&e.clientY<=r.bottom;});
        const r=group?.getBoundingClientRect()||rect,bar=group?.querySelector('.workspace-tabs'),barRect=bar?.getBoundingClientRect();
        const overTabs=barRect&&e.clientY>=barRect.top+3&&e.clientY<=barRect.bottom;
        const ratio=(e.clientY-r.top)/r.height,mode=overTabs?'tab':group?(ratio<.24?'before':ratio>.76?'after':'tab'):'after';
        target={side,id:group?.dataset.workspaceGroup||null,mode};mark.hidden=false;mark.dataset.mode=mode;
        if(overTabs){
          if(e.clientX<barRect.left+24)bar.scrollLeft-=12;else if(e.clientX>barRect.right-40)bar.scrollLeft+=12;
          const tabs=[...bar.querySelectorAll('[data-workspace-panel]')],next=tabs.find(button=>{const b=button.getBoundingClientRect();return e.clientX<b.left+b.width/2;}),last=tabs.at(-1);
          const destination=locate(target.id).group;
          target.tabIndex=next?destination.panels.indexOf(next.dataset.workspacePanel):destination.panels.length;
          const x=next?next.getBoundingClientRect().left:last.getBoundingClientRect().right;
          const uiZoom=uiScaleFactor();Object.assign(mark.style,{left:(Math.max(barRect.left+1,Math.min(barRect.right-4,x))-1)/uiZoom+'px',top:(barRect.top+3)/uiZoom+'px',width:3/uiZoom+'px',height:(barRect.height-6)/uiZoom+'px'});mark.textContent='';mark.dataset.mode='insert';
        }else{
          const h=mode==='tab'||!group?r.height:Math.min(44,r.height*.24),y=mode==='after'&&group?r.bottom-h:r.top;
          const uiZoom=uiScaleFactor();Object.assign(mark.style,{left:(r.left+2)/uiZoom+'px',top:(y+2)/uiZoom+'px',width:(r.width-4)/uiZoom+'px',height:Math.max(4,h-4)/uiZoom+'px'});mark.textContent=t(mode==='tab'?'layout.dropTab':mode==='before'?'layout.dropBefore':'layout.dropAfter');
        }
        break;
      }
    },options);
    window.addEventListener('pointerup',e=>{if(e.pointerId===event.pointerId){if(active){e.preventDefault();e.stopPropagation();}finish(active);}},options);
    window.addEventListener('pointercancel',()=>finish(false),options);window.addEventListener('blur',e=>{if(e.target===window)finish(false);},options);window.addEventListener('resize',()=>finish(false),options);
    window.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();finish(false);}},options);
  }
  function apply(value){state=validate(value);restoring=true;drag?.();write('sgrapeSidebarWidths',state.widths);build();
    if(!matchMedia('(max-width:800px)').matches)for(const side of ['left','right'])setSidebarOpen(side,state.visibility[side]);
    window.dispatchEvent(new Event('workspacewidthschange'));restoring=false;persist();}
  const dialog=el('dialog',{id:'layoutdialog','aria-labelledby':'layoutheading'});document.body.append(dialog);
  function manager(){
    closeMenu();
    dialog.replaceChildren();const heading=el('div',{class:'layout-heading'}),close=el('button',{type:'button','aria-label':t('action.close')},'×');close.onclick=()=>dialog.close();heading.append(el('strong',{id:'layoutheading'},t('layout.title')),close);dialog.append(heading,el('p',{class:'muted'},t('layout.hint')));
    const arrangement=el('div',{class:'layout-arrangement'});
    for(const id of ids){const row=el('label',{class:'layout-row'}),select=el('select',{'aria-label':title(id)}),found=locate(id);
      for(const side of ['left','right']){
        const group=el('optgroup',{label:t('layout.'+side)});
        const separate=el('option',{value:side+':new'},t('layout.separate'));if(found.side===side&&found.group.panels.length===1)separate.selected=true;group.append(separate);
        for(const g of state[side])if(g.panels.some(x=>x!==id)){const option=el('option',{value:side+':'+g.panels[0]},t('layout.tabWith')+' '+g.panels.filter(x=>x!==id).map(title).join(' / '));if(g===found.group)option.selected=true;group.append(option);}select.append(group);
      }
      select.onchange=()=>{const [side,target]=select.value.split(':');move(id,side,target==='new'?null:target,target==='new'?'after':'tab');manager();};
      row.append(el('span',{},title(id)),select);
      for(const [direction,label]of [[-1,'↑'],[1,'↓']]){const button=el('button',{type:'button','aria-label':t(direction<0?'layout.moveUp':'layout.moveDown')+' '+title(id)},label);button.onclick=()=>{const f=locate(id),g=state[f.side][f.index+direction];if(g)move(id,f.side,g.panels[0],direction<0?'before':'after');manager();};button.disabled=!state[found.side][found.index+direction];row.append(button);}
      if(found.group.panels.length>1)for(const direction of [-1,1]){const index=found.group.panels.indexOf(id),button=el('button',{type:'button',class:'layout-tab-step','aria-label':t(direction<0?'layout.tabEarlier':'layout.tabLater')+' '+title(id)},direction<0?'←':'→');button.disabled=index+direction<0||index+direction>=found.group.panels.length;button.onclick=()=>{move(id,found.side,found.group.panels[0],'tab',index+(direction<0?-1:2));manager();};row.append(button);}
      arrangement.append(row);
    }
    dialog.append(arrangement);
    const saveRow=el('div',{class:'layout-save'}),name=el('input',{id:'layoutname',maxlength:'80',placeholder:t('layout.name'),'aria-label':t('layout.name')}),save=el('button',{type:'button'},t('layout.save'));
    save.onclick=()=>{const label=name.value.trim();if(!label){name.focus();return;}if(presets.some(p=>p.name===label)){name.setCustomValidity(t('layout.duplicate'));name.reportValidity();return;}persist();presets.push({name:label,layout:copy(state)});write(presetsKey,presets);manager();};name.oninput=()=>name.setCustomValidity('');saveRow.append(name,save);dialog.append(saveRow);
    const list=el('div',{class:'layout-presets'}),defaultRow=el('div',{class:'layout-preset'}),reset=el('button',{type:'button'},t('layout.restore'));reset.onclick=()=>{apply(defaults());manager();};defaultRow.append(el('strong',{},t('layout.default')),reset);list.append(defaultRow);
    for(const item of presets){const row=el('div',{class:'layout-preset'});row.append(el('span',{},item.name));
      const rename=el('button',{type:'button'},t('layout.rename'));rename.onclick=()=>{
        const entry=el('input',{value:item.name,maxlength:80,'aria-label':t('layout.name')}),save=el('button',{type:'button'},t('layout.save')),cancel=el('button',{type:'button'},t('action.close'));
        save.onclick=()=>{const name=entry.value.trim();if(!name||presets.some(p=>p!==item&&p.name===name)){entry.setCustomValidity(t('layout.duplicate'));entry.reportValidity();return;}item.name=name;write(presetsKey,presets);manager();};entry.oninput=()=>entry.setCustomValidity('');entry.onkeydown=e=>{if(e.key==='Enter')save.click();if(e.key==='Escape'){e.preventDefault();e.stopPropagation();manager();}};cancel.onclick=manager;
        row.replaceChildren(entry,save,cancel);entry.focus();entry.select();
      };row.append(rename);
      for(const [label,fn]of [['layout.apply',()=>apply(item.layout)],['layout.update',()=>{persist();item.layout=copy(state);write(presetsKey,presets);} ],['layout.delete',()=>{presets=presets.filter(p=>p!==item);write(presetsKey,presets);} ]]){const button=el('button',{type:'button'},t(label));button.onclick=()=>{fn();manager();};row.append(button);}list.append(row);
    }
    dialog.append(list);
    const transfer=el('div',{class:'layout-transfer'}),exportButton=el('button',{type:'button'},t('layout.export')),importButton=el('button',{type:'button'},t('layout.import')),file=el('input',{type:'file',accept:'.json,application/json',hidden:true});
    exportButton.onclick=()=>{persist();const blob=new Blob([JSON.stringify({format:'TD-Grape Layout',version:1,current:state},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=el('a',{href:url,download:'TD-Grape-layout.json'});a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
    importButton.onclick=()=>file.click();file.onchange=async()=>{try{const source=file.files[0];if(!source||source.size>262144)throw Error(t('layout.invalid'));const value=JSON.parse(await source.text());if(value.format!=='TD-Grape Layout'||value.version!==1)throw Error(t('layout.invalid'));const imported=validate(value.current);apply(imported);manager();}catch(error){status(error.message,true);}};
    transfer.append(exportButton,importButton,file);dialog.append(transfer,el('p',{class:'muted'},t('layout.local')));
    if(!dialog.open)dialog.showModal();
  }
  const menuButton=$('#workspacelayout'),menu=el('div',{id:'layoutmenu',role:'menu',hidden:true,'aria-label':t('layout.title')});document.body.append(menu);
  menuButton.setAttribute('aria-haspopup','menu');menuButton.setAttribute('aria-controls','layoutmenu');menuButton.setAttribute('aria-expanded','false');
  function closeMenu(focus=false){menu.hidden=true;menuButton.setAttribute('aria-expanded','false');if(focus)menuButton.focus();}
  function showMenu(){
    closeCreator();menu.replaceChildren();menu.hidden=false;menuButton.setAttribute('aria-expanded','true');
    const heading=key=>menu.append(el('div',{class:'layout-menu-heading',role:'presentation'},t(key)));
    function choice(label,action,checked=null){const button=el('button',{type:'button',role:checked===null?'menuitem':'menuitemcheckbox'},label);if(checked!==null)button.setAttribute('aria-checked',String(checked));button.onclick=action;menu.append(button);return button;}
    heading('layout.panels');
    for(const id of ids)choice(title(id),()=>{if(state.hidden.includes(id)){state.hidden=state.hidden.filter(x=>x!==id);const found=locate(id);found.group.active=id;found.group.collapsed=false;setSidebarOpen(found.side,true);}else state.hidden.push(id);build();persist();showMenu();[...menu.querySelectorAll('button')][ids.indexOf(id)].focus();},!state.hidden.includes(id));
    heading('layout.presets');
    choice(t('layout.default'),()=>{apply(defaults());closeMenu(true);});
    for(const item of presets)choice(item.name,()=>{apply(item.layout);closeMenu(true);});
    menu.append(el('hr',{role:'separator'}));
    choice(t('layout.save'),()=>{manager();$('#layoutname').focus();});choice(t('layout.manage'),manager);
    const r=menuButton.getBoundingClientRect(),bounds=menu.getBoundingClientRect(),uiZoom=uiScaleFactor();Object.assign(menu.style,{left:Math.max(8,Math.min(innerWidth-bounds.width-8,r.right-bounds.width))/uiZoom+'px',top:Math.max(8,Math.min(r.bottom+5,innerHeight-bounds.height-8))/uiZoom+'px'});
  }
  menuButton.onclick=()=>{if(menu.hidden){showMenu();menu.querySelector('button')?.focus();}else closeMenu();};
  menu.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();closeMenu(true);return;}const buttons=[...menu.querySelectorAll('button')],i=buttons.indexOf(document.activeElement);if(['ArrowUp','ArrowDown','Home','End'].includes(e.key)){e.preventDefault();buttons[e.key==='Home'?0:e.key==='End'?buttons.length-1:(i+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length]?.focus();}if(e.key==='Tab')closeMenu();};
  document.addEventListener('pointerdown',e=>{if(!menu.hidden&&!menu.contains(e.target)&&!menuButton.contains(e.target))closeMenu();});
  window.addEventListener('resize',()=>closeMenu());

  build();restoring=true;write('sgrapeSidebarWidths',state.widths);if(!matchMedia('(max-width:800px)').matches)for(const side of ['left','right'])setSidebarOpen(side,state.visibility[side]);restoring=false;
  window.addEventListener('workspacepreferenceschange',persist);window.addEventListener('sidebarvisibilitychange',persist);
  return {move,apply,snapshot:()=>copy(state),closeBrowser(){setSidebarOpen(locate('browser').side,false);},reveal(id){state.hidden=state.hidden.filter(x=>x!==id);const found=locate(id);found.group.active=id;found.group.collapsed=false;setSidebarOpen(found.side,true);build();persist();},translate(){build();if(dialog.open)manager();if(!menu.hidden)showMenu();},manager};
}

/* Inputs are a source inventory. Graph nodes reference these identities; native
   Uniform values/modes continue to belong to the actual GLSL OP. */
let nativeSourceSnapshot=null,nativeSourceBusy=false,nativeSourcePolling=false,nativeSourceRefreshPending=false,nativeSourceError='',nativeSourceRetryAt=0,selectedInputId=null;
function inputPresets(){return Object.fromEntries(Object.entries(typeContract?.sources?.uniformPresets||{}).filter(([,entry])=>entry.availability?.[editorTarget]?.includes(stage)).map(([key,entry])=>[key,[entry.name,entry.initialize.expression]]));}
const inputCollapsedGroups=(()=>{try{const saved=JSON.parse(localStorage.getItem('sgrapeInputCollapsedGroups'));return new Set(Array.isArray(saved)?saved:[]);}catch{return new Set();}})();
function setInputGroupCollapsed(kind,collapsed){
  if(collapsed)inputCollapsedGroups.add(kind);else inputCollapsedGroups.delete(kind);
  try{localStorage.setItem('sgrapeInputCollapsedGroups',JSON.stringify([...inputCollapsedGroups]));}catch{}
}
function nativeSourceRows(){return [...(nativeSourceSnapshot?.uniforms||[]),...(nativeSourceSnapshot?.specConstants||[])];}
let nativeIndexedSnapshot=null,nativeRowsIndex=new Map();
function nativeSourceIndex(){
  if(nativeIndexedSnapshot!==nativeSourceSnapshot){nativeIndexedSnapshot=nativeSourceSnapshot;nativeRowsIndex=new Map(nativeSourceRows().map(row=>[row.id,row]));}
  return nativeRowsIndex;
}
function inputGroupLabel(kind){return ({attribute:t('sources.attributes'),pop_buffer:t('sources.popBuffers'),texture_buffer:t('sources.textureBuffers'),top_input:'TOP Inputs',constant:t('inputs.graphConstants'),spec_constant:t('inputs.specConstants'),uniform:t('sources.customUniforms'),sampler:editorTarget==='top'?t('inputs.legacySamplers'):'Samplers'})[kind];}
function inputSourceGroup(kind){return kind==='color'||kind==='array'||kind.startsWith('preset:')?'uniform':kind;}
function inputPresetSource(kind){const key=kind.startsWith('preset:')?kind.slice(7):null,entry=typeContract?.sources?.uniformPresets?.[key];return entry?graph.declarations.find(d=>d.kind==='uniform'&&d.type===entry.type&&(d.initialDriver===key||d.name===entry.name)):null;}
function finishInputCreate(kind,id){
  setInputGroupCollapsed(inputSourceGroup(kind),false);$('#inputsearch').value='';$('#nativeuniforms').dataset.sourceStructure='';$('#sourcecreatedialog').close();selectInputSource(id);
}
function openInputCreate(kind){
  if(editorMutationBlocked()||!graph||!['constant','spec_constant','uniform','texture_buffer','pop_buffer',...(editorTarget==='mat'?['attribute']:[]),editorTarget==='top'?'top_input':'sampler'].includes(kind))return;
  closeCreator();const dialog=$('#sourcecreatedialog'),choice=$('#sourcekind');
  const options=kind==='uniform'?[['uniform','Uniform'],['array',t('array.uniformSource')],['color','Color']]:[[kind,inputGroupLabel(kind)]];
  choice.replaceChildren(...options.map(([value,label])=>el('option',{value},label)));choice.value=kind;
  $('#sourcekindfield').hidden=options.length===1;$('#sourcecreatetitle').textContent=t('inputs.new')+' · '+inputGroupLabel(kind);
  $('#sourcecreateerror').textContent='';choice.onchange();dialog.showModal();
  if(!matchMedia('(pointer:coarse)').matches&&!$('#sourcename').disabled){$('#sourcename').focus({preventScroll:true});$('#sourcename').select();}
}
function sourceReferences(id){
  const uses=value=>{let found=false;GraphLengthReferences.walk(value,(ref,token)=>{if(ref===id)found=true;return token;},false);return found;};
  return [...Object.values(graph.stages),...(graph.functions||[]).map(f=>f.graph)].flatMap(g=>g.nodes).filter(n=>n.params?.declarationId===id||n.params?.inputId===id||uses(n.params))
    .concat(graph.declarations.filter(d=>uses(d)),(graph.functions||[]).filter(f=>uses([...f.inputs,...f.outputs])));
}
function nativeSourceGraphOnly(){
  // A source change may still need compilation. Repair that exact snapshot
  // without treating an unrelated local graph draft as safe to replace.
  return !!(nativeSourceSnapshot?.sourceChanged&&nativeSourceSnapshot.revision===revision&&nativeSourceSnapshot.graph&&historyGraphKey(graph)===historyGraphKey(nativeSourceSnapshot.graph));
}
function sourceGraphPending(){return dirty&&!nativeSourceGraphOnly();}
function sourceReady(ignoreValueWrite=false){return nativeSourceSnapshot?.enabled&&!nativeSourceError&&!sourceGraphPending()&&!submitBusy&&(!nativeSourceBusy||ignoreValueWrite&&nativeValueBusy)&&!editorMutationBlocked(ignoreValueWrite)&&nativeSourceSnapshot.revision===revision;}
function sourceMissingHint(decl){return t(sourceReferences(decl.id).length?'sources.missing':'sources.missingUnused');}
// Product dialogs stay inside the editor; callers recheck their live context
// after awaiting, because native state can change while the card is open.
function confirmOverlay({title,message,confirmLabel}){
  if(document.querySelector('.confirmation-dialog'))return Promise.resolve(false);
  const dialog=el('dialog',{class:'confirmation-dialog','aria-labelledby':'confirmation-title','aria-describedby':'confirmation-message'});
  const cancel=el('button',{type:'button',autofocus:''},t('appliedReload.cancel')),accept=el('button',{type:'button',class:'danger'},confirmLabel);
  const actions=el('div',{class:'confirmation-actions'});actions.append(cancel,accept);
  dialog.append(el('strong',{id:'confirmation-title'},title),el('p',{id:'confirmation-message'},message),actions);
  return new Promise(resolve=>{
    dialog.addEventListener('close',()=>{const accepted=dialog.returnValue==='confirm';dialog.remove();resolve(accepted);},{once:true});
    cancel.onclick=()=>dialog.close('cancel');accept.onclick=()=>dialog.close('confirm');
    document.body.append(dialog);dialog.showModal();cancel.focus({preventScroll:true});
  });
}
async function nativeSourceAction(action,decl){
  const live=nativeSourceRows().find(r=>r.id===decl.id);if(!live||!sourceReady())return;
  const load=editorLoadGeneration,expected=clone(live.expected),count=sourceReferences(decl.id).length;
  if(action==='remove'&&!await confirmOverlay({title:t('sources.remove'),message:t(count?'sources.removeConfirm':'sources.removeUnusedConfirm').replace('{name}',live.name).replace('{count}',count),confirmLabel:t('sources.remove')}))return;
  if(action==='adoptFormat'&&!await confirmOverlay({title:t('sources.adoptFormat'),message:t('sources.adoptFormatConfirm'),confirmLabel:t('sources.adoptFormat')}))return;
  if(load!==editorLoadGeneration||!sourceReady()||!graph.declarations.some(d=>d.id===decl.id))return;
  if(sourceReferences(decl.id).length!==count){status(t('live.changed'),true);return;}
  return nativeSourceRequest('source-edit',{action,id:decl.id,expected:action==='adoptFormat'?live.formatChange?.expected:expected});
}
async function localSourceAction(action,decl){
  if(!['remove','restore'].includes(action)||editorMutationBlocked()||!graph.declarations.includes(decl))return;
  const load=editorLoadGeneration,count=sourceReferences(decl.id).length;
  if(action==='remove'&&!await confirmOverlay({title:t('sources.remove'),message:t(count?'sources.removeConfirm':'sources.removeUnusedConfirm').replace('{name}',decl.name).replace('{count}',count),confirmLabel:t('sources.remove')}))return;
  if(load!==editorLoadGeneration||editorMutationBlocked()||!graph.declarations.includes(decl))return;
  const native=nativeSourceIndex().get(decl.id);
  if(sourceReferences(decl.id).length!==count||native&&!native.pending){status(t('live.changed'),true);return;}
  return changeDeclaration(()=>{
    if(action==='restore')delete decl.sourceMissing;
    else if(count)decl.sourceMissing=true;
    else {graph.declarations=graph.declarations.filter(d=>d!==decl);if(selectedInputId===decl.id)selectedInputId=null;}
  });
}
let nativeSourceHint='';
function nativeSourceHintText(){
  return nativeSourceError||(!nativeSourceSnapshot?.enabled?t('sources.enable'):sourceGraphPending()||nativeSourceSnapshot.revision!==revision?t('sources.nativePending'):(nativeSourceSnapshot.issues||[]).map(i=>i.message).join(' '));
}
function showNativeSourceHint(){
  const message=nativeSourceHintText();
  if(message){nativeSourceHint=message;status(message);}
}
function clearNativeSourceHint(){
  if(nativeSourceHint&&$('#status').textContent===nativeSourceHint&&!persistentStatusError)status('');
  nativeSourceHint='';
}
function selectInputSource(id){
  if(!allInputSources().some(d=>d.id===id))return;
  helpContext='node';selectedInputId=id;selected=null;selectedEdge=null;selection.clear();cancelConnection();closeCreator();
  workspaceLayout?.reveal('parameters');render();
  if(allInputSources().find(d=>d.id===id)?.kind&&['uniform','spec_constant','pop_buffer','attribute'].includes(allInputSources().find(d=>d.id===id).kind))showNativeSourceHint();else clearNativeSourceHint();
}
function inputReference(id,x=null,y=null){
  const decl=allInputSources().find(d=>d.id===id),d=decl&&catalog.find(d=>d.key===decl.kind);if(!d)return;
  if(decl.sourceMissing){status(sourceMissingHint(decl),true);return;}
  if(decl.kind==='attribute'&&(editorTarget!=='mat'||stage!=='vertex')){status(t('attribute.vertexOnly'),true);return;}
  const rect=$('#canvas').getBoundingClientRect(),p=graphPoint(x??rect.left+rect.width/2,y??rect.top+rect.height/2);if(!p)return;
  change(()=>{selectedInputId=null;const n=instantiate(d,p.x,p.y,null,{declarationId:id});selectNode(n);});
}
function receiveNativeSources(data,{own=false}={}){
  if(data.revision<revision)return; // A pre-Apply poll must not roll back its result.
  const acceptGraph=!dirty||nativeSourceGraphOnly();
  nativeSourceSnapshot=data;
  if(data.history?.token&&(own||!historyNativeToken))historyNativeToken=data.history.token;
  if((data.revision!==revision||own&&data.workingGraph)&&acceptGraph&&!submitBusy&&data.graph){
    adoptHistoryGraph(own&&data.workingGraph||data.graph);revision=data.revision;render();
    if(data.sourceChanged||data.workingGraph){mark();}else{rememberSavedGraph(graph);dirty=false;renderGraphSaveState();}
  }
  renderNativeSources();
}
async function refreshNativeSources({required=false}={}){
  if(required)nativeSourceRefreshPending=true;
  if(!graph||readonly||nativeSourcePolling||nativeSourceBusy||historyBusy||nativeMutationBusy||document.hidden||submitBusy||Date.now()<nativeSourceRetryAt)return;
  nativeSourcePolling=true;nativeSourceRefreshPending=false;const generation=editorLoadGeneration;
  try{const data=await api('sources');if(generation!==editorLoadGeneration)return;nativeSourceError='';receiveNativeSources(data);}
  catch(e){if(generation!==editorLoadGeneration)return;nativeSourceError=e.status===404?t('sources.connectionUnsupported'):e.message;nativeSourceRetryAt=Date.now()+5000;renderNativeSourceValues();}
  finally{if(generation===editorLoadGeneration){nativeSourcePolling=false;if(nativeSourceRefreshPending&&!nativeSourceError)queueMicrotask(()=>refreshNativeSources());else if(typeof uniformLive!=='undefined')uniformLive.subscribe();}}
}
async function nativeSourceRequest(endpoint,body){
  if(!sourceReady()){showNativeSourceHint();return null;}
  const generation=editorLoadGeneration,before=clone(graph),nativeBefore=nativeSourceSnapshot.history?.token||historyNativeToken;
  nativeSourceBusy=true;nativeMutationBusy=true;nativeValueBusy=endpoint==='source-value';clearTimeout(autoTimer);autoTimer=null;renderGraphEditActions();renderNativeSourceValues();let result=null;
  try{
    result=await api(endpoint,{...body,revision:nativeSourceSnapshot.revision});if(generation!==editorLoadGeneration)return null;
    nativeSourceError='';receiveNativeSources(result,{own:true});
    if(result.proposal)recordGraphHistory(before);
    else recordHistory({kind:'source',before,after:clone(graph),nativeBefore:result.history?.beforeToken||nativeBefore,nativeAfter:result.history?.token||null,nativeApplied:true,sourceIds:body.id?[body.id]:historySourceIds(before,graph)});
    status(t(result.proposal?'sources.formatAdopted':'uniform.updated'),false,{clearError:'operation'});
  }
  catch(e){if(generation!==editorLoadGeneration)return null;nativeSourceError=e.message;status(e.message,true);}
  finally{if(generation===editorLoadGeneration){nativeSourceBusy=false;nativeMutationBusy=false;nativeValueBusy=false;renderGraphEditActions();renderNativeSourceValues();await refreshNativeSources();if(generation===editorLoadGeneration)scheduleGraphApply();}}
  return result;
}
function renderNativeSourceValues(changed=null){
  const ready=sourceReady(true),rows=nativeSourceIndex();
  for(const card of document.querySelectorAll('[data-native-source]')){
    if(changed&&!changed.has(card.dataset.nativeSource))continue;
    const row=rows.get(card.dataset.nativeSource);if(!row)continue;
    for(const grid of card.querySelectorAll('[data-native-components]'))syncNativeComponentControls(grid,row,ready);
    for(const color of card.querySelectorAll('[data-native-color]'))syncNativeColorControls(color,row,ready);
    for(const entry of card.querySelectorAll('[data-matrix-source-component]')){
      const item=row.components[Number(entry.dataset.matrixSourceComponent)],binding=row.matrixBinding;
      entry.disabled=!ready||!binding?.writable||!binding.literalValues;
      if(document.activeElement!==entry&&!entry.numericGestureActive){entry.setSyncedValue(item?.value);entry.sourceExpected=binding?.expected;}
    }
    const matrixEditor=card.querySelector('[data-matrix-binding-editor]');
    if(matrixEditor){
      const binding=row.matrixBinding,mode=matrixEditor.querySelector('select'),entry=matrixEditor.querySelector('input'),apply=matrixEditor.querySelector('button');
      mode.disabled=entry.disabled=apply.disabled=!ready||!binding?.writable;
      if(!matrixEditor.bindingDirty&&!matrixEditor.contains(document.activeElement)){
        mode.value=binding?.mode==='CONSTANT'?'CONSTANT':'EXPRESSION';entry.value=mode.value==='EXPRESSION'?binding?.expression||'':binding?.value||'';matrixEditor.sourceExpected=binding?.expected;
      }
      entry.placeholder=t(mode.value==='EXPRESSION'?'matrix.expression':'matrix.path');
      entry.title=binding?.binding||binding?.expression||binding?.mode||'';
    }
    const bufferEditor=card.querySelector('[data-buffer-binding-editor]');
    if(bufferEditor)bufferEditor.syncBinding(row.bufferBinding,ready);
    const arrayEditor=card.querySelector('[data-array-binding-editor]');
    if(arrayEditor){
      const binding=row.arrayBinding,mode=arrayEditor.querySelector('select'),entry=arrayEditor.querySelector('input'),apply=arrayEditor.querySelector('button');
      mode.disabled=entry.disabled=apply.disabled=!ready||!binding?.writable;
      if(!arrayEditor.bindingDirty&&!arrayEditor.contains(document.activeElement)){
        mode.value=binding?.mode==='CONSTANT'?'CONSTANT':'EXPRESSION';entry.value=mode.value==='EXPRESSION'?binding?.expression||'':binding?.value||'';arrayEditor.sourceExpected=binding?.expected;
      }
      entry.placeholder=t(mode.value==='EXPRESSION'?'matrix.expression':'array.chopPath');entry.title=binding?.binding||binding?.expression||binding?.mode||'';
    }
    for(const label of card.querySelectorAll('[data-source-mode]')){
      const item=row.components[Number(label.dataset.sourceMode)],text=nativeComponentMode(item);if(label.textContent!==text)label.textContent=text;label.title=item?.binding||item?.expression||'';
    }
    for(const entry of card.querySelectorAll('[data-source-expression]')){
      const item=row.components[Number(entry.dataset.sourceExpression)];entry.disabled=!ready||!item?.modeWritable;
      if(document.activeElement!==entry){entry.setSyncedValue(item?.expression||'');entry.sourceExpected=item?.modeExpected;}
    }
    for(const button of card.querySelectorAll('[data-source-freeze]'))button.disabled=!ready||!row.components[Number(button.dataset.sourceFreeze)]?.modeWritable;
    const state=card.querySelector('.native-source-state');if(state){const text=row.pending?t('sources.enable'):row.missing?sourceMissingHint(row):row.bufferBinding?t('buffer.popState'):row.arrayBinding?t('array.bindingState'):row.matrixBinding?!row.matrixBinding.literalValues?t('uniform.driven'):t('uniform.synced'):row.components.slice(0,typeComponents(row.type)||1).some(c=>!c.writable)?t('uniform.driven'):t('uniform.synced');if(state.textContent!==text)state.textContent=text;}
  }
  if(changed)return;
  for(const entry of document.querySelectorAll('#inspector [data-input-name]')){
    const row=rows.get(entry.dataset.inputName);entry.disabled=readonly||(row&&!row.pending&&(!ready||!row.nameWritable));
  }
  for(const entry of document.querySelectorAll('#inspector [data-source-remove]'))entry.disabled=!ready;
  for(const item of $('#sourcecreate').querySelectorAll('input,select,button'))setEditorDisabled(item,editorMutationBlocked(),editorMutationBlocked(true));
  if($('#sourcetype'))setEditorDisabled($('#sourcetype'),editorMutationBlocked()||!['uniform','array','color','texture_buffer','pop_buffer','attribute','constant','spec_constant'].includes($('#sourcekind').value),editorMutationBlocked(true)||!['uniform','array','color','texture_buffer','pop_buffer','attribute','constant','spec_constant'].includes($('#sourcekind').value));
  if($('#sourcekind').value==='top_input'){$('#sourcename').value='sTD2DInputs['+topInputsView().length+']';$('#sourcename').disabled=true;}
  const presetSource=inputPresetSource($('#sourcekind').value);if(presetSource){$('#sourcename').value=presetSource.name;$('#sourcename').disabled=true;}
  $('#sourcecreate button[type=submit]').textContent=t(presetSource?'inputs.useExisting':'inputs.create');
  // Polls may clear this source hint after recovery; they never publish it over another action.
  if(nativeSourceHint&&(!nativeSourceHintText()||!selectedInputId))clearNativeSourceHint();
  for(const item of document.querySelectorAll('[data-input-reference]')){const missing=item.dataset.sourceMissing==='true'||(graph.declarations.find(d=>d.id===item.dataset.inputReference)?.kind==='attribute'&&stage!=='vertex');setEditorDisabled(item,missing||editorMutationBlocked(),missing||editorMutationBlocked(true));}
  for(const item of document.querySelectorAll('[data-input-create]'))setEditorDisabled(item,editorMutationBlocked()||(item.dataset.inputCreate==='top_input'&&topInputsView().length>=16),editorMutationBlocked(true)||(item.dataset.inputCreate==='top_input'&&topInputsView().length>=16));
  for(const item of document.querySelectorAll('[data-source-custom]'))item.disabled=!ready;
}
function specValueField(value,type,commit){return field(t('declaration.value'),typedScalarInput(value,typeFamily(type),commit));}
const nativeMatrixDrafts=new Map();
const nativeArrayDrafts=new Map();
function nativeArrayFields(card,decl,row){
  const binding=row.arrayBinding;
  if(!row.missing&&binding){
    const editor=el('div',{'data-array-binding-editor':'',class:'input-drivers'}),mode=el('select',{'aria-label':t('matrix.bindingMode')}),entry=el('input',{type:'text','aria-label':t('array.chopPath'),spellcheck:'false',maxlength:4096}),apply=el('button',{type:'button'},t('matrix.applySource'));
    mode.append(el('option',{value:'CONSTANT'},t('array.chopPath')),el('option',{value:'EXPRESSION'},t('matrix.expression')));
    const key=editorLoadGeneration+':'+decl.id;for(const old of nativeArrayDrafts.keys())if(!old.startsWith(editorLoadGeneration+':'))nativeArrayDrafts.delete(old);
    const draft=nativeArrayDrafts.get(key);mode.value=draft?.mode||(binding.mode==='CONSTANT'?'CONSTANT':'EXPRESSION');entry.value=draft?.value??(mode.value==='EXPRESSION'?binding.expression||'':binding.value||'');editor.sourceExpected=draft?.expected??binding.expected;editor.bindingDirty=!!draft;
    const remember=()=>{editor.bindingDirty=true;nativeArrayDrafts.set(key,{mode:mode.value,value:entry.value,expected:editor.sourceExpected});};
    mode.onchange=()=>{remember();entry.placeholder=t(mode.value==='EXPRESSION'?'matrix.expression':'array.chopPath');};entry.oninput=remember;entry.hasPendingEdit=()=>!!editor.bindingDirty;
    apply.onclick=()=>nativeSourceRequest('source-edit',{action:'arrayBinding',id:decl.id,mode:mode.value,...(mode.value==='EXPRESSION'?{expression:entry.value}:{value:entry.value}),expected:editor.sourceExpected}).then(result=>{if(result){nativeArrayDrafts.delete(key);editor.bindingDirty=false;inspector();}});
    entry.onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();apply.click();}else if(event.key==='Escape'){nativeArrayDrafts.delete(key);editor.bindingDirty=false;entry.blur();renderNativeSourceValues();}};
    editor.append(field(t('matrix.bindingMode'),mode),field(t('array.chopPath'),entry),apply);card.append(editor);
  }
  card.append(el('p',{class:'muted'},t(decl.type==='samplerBuffer'?'buffer.nativeHint':'array.nativeHint')),el('p',{class:'muted native-source-state'}));renderNativeSourceValues();
}
function nativeMatrixFields(card,decl,row){
  const shape=typeContract.types[decl.type],binding=row.matrixBinding;
  if(!row.missing&&binding){
    if(binding.literalValues){
      const values=el('div',{class:'matrix-parameter-values'});
      for(let column=0;column<shape.columns;column++){
        const group=el('section',{class:'matrix-parameter-column'}),fields=el('div',{class:'components'});
        group.append(el('div',{class:'parameter-value-label'},t('matrix.column').replace('{index}',column)),fields);
        for(let component=0;component<shape.rows;component++){
          const index=column*shape.rows+component,entry=typedScalarInput(row.components[index]?.value,shape.family,value=>{
            const currentRow=nativeSourceRows().find(r=>r.id===decl.id),next=currentRow?.components.map(c=>c.value);
            if(!next||next.length!==shape.components)return;
            next[index]=value;nativeSourceRequest('source-edit',{action:'matrixValue',id:decl.id,value:next,expected:entry.sourceExpected});
          });
          entry.dataset.matrixSourceComponent=String(index);entry.sourceExpected=binding.expected;
          entry.setAttribute('aria-label',decl.name+' '+t('matrix.column').replace('{index}',column)+' '+'XYZW'[component]);
          fields.append(field('XYZW'[component],entry));
        }
        values.append(group);
      }
      card.append(values);
    }
    const editor=el('div',{'data-matrix-binding-editor':'',class:'input-drivers'}),mode=el('select',{'aria-label':t('matrix.bindingMode')}),entry=el('input',{type:'text','aria-label':t('matrix.binding'),spellcheck:'false',maxlength:4096}),apply=el('button',{type:'button'},t('matrix.applySource'));
    mode.append(el('option',{value:'CONSTANT'},t('matrix.path')),el('option',{value:'EXPRESSION'},t('matrix.expression')));
    const draftKey=editorLoadGeneration+':'+decl.id;
    for(const key of nativeMatrixDrafts.keys())if(!key.startsWith(editorLoadGeneration+':'))nativeMatrixDrafts.delete(key);
    const draft=nativeMatrixDrafts.get(draftKey);
    mode.value=draft?.mode||(binding.mode==='CONSTANT'?'CONSTANT':'EXPRESSION');entry.value=draft?.value??(mode.value==='EXPRESSION'?binding.expression||'':binding.value||'');editor.sourceExpected=draft?.expected??binding.expected;editor.bindingDirty=!!draft;
    const remember=()=>{editor.bindingDirty=true;nativeMatrixDrafts.set(draftKey,{mode:mode.value,value:entry.value,expected:editor.sourceExpected});};
    mode.onchange=()=>{remember();entry.placeholder=t(mode.value==='EXPRESSION'?'matrix.expression':'matrix.path');};
    entry.oninput=remember;entry.hasPendingEdit=()=>!!editor.bindingDirty;
    apply.onclick=()=>nativeSourceRequest('source-edit',{action:'matrixBinding',id:decl.id,mode:mode.value,...(mode.value==='EXPRESSION'?{expression:entry.value}:{value:entry.value}),expected:editor.sourceExpected}).then(result=>{if(result){nativeMatrixDrafts.delete(draftKey);editor.bindingDirty=false;inspector();}});
    entry.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();apply.click();}else if(e.key==='Escape'){nativeMatrixDrafts.delete(draftKey);editor.bindingDirty=false;entry.blur();renderNativeSourceValues();}};
    editor.append(field(t('matrix.bindingMode'),mode),field(t('matrix.binding'),entry),apply);card.append(editor,el('p',{class:'muted'},t('matrix.bindingHint')));
  }
  if(shape.family==='double')card.append(el('p',{class:'muted'},t('inputs.doubleUniformHint')));
  card.append(el('p',{class:'muted native-source-state'}));renderNativeSourceValues();
}
// One live component view for Parameter, source cards and graph references.
// Only a mode change replaces a control; numeric updates retain focus and DOM.
function nativeComponentMode(item){
  return item?.mode==='EXPRESSION'?'Expression':item?.mode==='EXPORT'?'CHOP Export':item?.mode==='BIND'?'Bind':item?.mode==='CONSTANT'?t('inputs.valueMode'):item?.mode||'';
}
function currentSourceReferences(id,builtin=null){
  if(builtin)return current().nodes.filter(n=>definition(n)?.key===builtin.key&&(builtin.key!=='builtin_source'||n.params.source===builtin.builtinSource));
  const references=new Set(id?sourceReferences(id):[]);return current().nodes.filter(n=>references.has(n));
}
function selectSourceReferences(id,builtin=null){
  const nodes=currentSourceReferences(id,builtin);if(!nodes.length)return;
  cancelConnection();closeCreator();selectedInputId=null;selectedEdge=null;helpContext='node';selection=new Set(nodes.map(n=>n.id));selected=nodes[0].id;
  for(const button of document.querySelectorAll('.input-source-select[aria-pressed=true]'))button.setAttribute('aria-pressed','false');
  focusGraphCanvas();refreshCanvasSelection();renderGraphEditActions();fitSelection();
}
function nativeSourceSequenceName(sequence){return {color:'Colors',matrix:'Matrices',array:'Arrays',buffer:'Buffers',attr:'Attributes',mattr:'Matrix Attributes',vec:'Vectors',const:'Constants'}[sequence]||sequence;}
function nativeComponentControls(decl,row){
  const count=typeComponents(decl.type)||1,grid=componentGrid(count);
  grid.dataset.nativeComponents=decl.id;grid.nativeDeclaration=decl;
  for(let i=0;i<count;i++)grid.append(el('div',{'data-native-component-slot':i}));
  syncNativeComponentControls(grid,row,sourceReady(true));
  if(decl.kind==='uniform'&&typeof uniformLive!=='undefined')queueMicrotask(()=>{if(grid.isConnected)uniformLive.registerView(grid);});
  return grid;
}
function nativeValueControls(decl,row){
  const compact=nativeComponentControls(decl,row);
  if(row.sequence!=='color'||!['float','vec2','vec3','vec4'].includes(decl.type))return compact;
  const box=el('div',{class:'native-color-controls','data-native-color':decl.id}),line=el('div',{class:'native-color-line'});
  const toggle=el('button',{type:'button',class:'node-values-toggle','aria-expanded':'false','aria-label':t('node.expandValues'),title:t('node.expandValues')},'▸');
  toggle.onclick=e=>{e.stopPropagation();const expanded=compact.classList.toggle('native-color-expanded');toggle.textContent=expanded?'▾':'▸';toggle.setAttribute('aria-expanded',String(expanded));};
  const count=typeComponents(decl.type),read=()=>{const live=nativeSourceIndex().get(decl.id);return [0,1,2,3].map(i=>i<count?Number(live?.components[i]?.value??(i===3?1:0)):i===3?1:0);};
  const swatch=colorPickerSwatch(read,values=>{
    const live=nativeSourceIndex().get(decl.id),items=picker.colorExpected||live?.components;picker.colorExpected=null;
    if(!sourceReady()||!items||editorLoadGeneration!==load)return;
    const components=values.slice(0,Math.min(3,count)).map((value,component)=>({component,value,expected:clone(items[component])})).filter(edit=>edit.value!==edit.expected.value);
    if(components.length)nativeSourceRequest('source-value',{id:decl.id,components});
  }),picker=swatch.querySelector('input'),load=editorLoadGeneration;
  picker.onpointerdown=()=>{picker.value=colorDisplay(read()).hex;picker.colorExpected=clone(nativeSourceIndex().get(decl.id)?.components);};
  picker.onkeydown=e=>{if(['Enter',' '].includes(e.key))picker.onpointerdown();};
  // Native color dialogs may blur before change. Keep the edit snapshot through
  // blur/polling; a new opening recaptures it even if the previous one canceled.
  picker.oninput=()=>{picker.colorExpected??=clone(nativeSourceIndex().get(decl.id)?.components);};
  const commit=picker.onchange;picker.onchange=()=>{try{commit();}finally{picker.colorExpected=null;}};
  line.append(toggle,compact);box.append(line,swatch);box.colorRead=read;syncNativeColorControls(box,row,sourceReady(true));return box;
}
function syncNativeColorControls(box,row,ready){
  const picker=box.querySelector('input[type=color]'),display=colorDisplay(box.colorRead()),count=Math.min(3,typeComponents(box.querySelector('[data-native-components]').nativeDeclaration.type));
  const writable=row.components.slice(0,count).length===count&&row.components.slice(0,count).every(c=>c.writable&&['CONSTANT','BIND'].includes(c.mode));
  picker.disabled=!ready||!writable;picker.title=writable?t('color.choose'):t('color.nativeDriven');
  if(!picker.colorExpected)picker.value=display.hex;
  box.querySelector('.color-ink').style.backgroundColor=display.css;
}
function nativeReferenceControls(node,decl){
  if(!decl||decl.kind!=='uniform'||isMatrixType(decl.type)||!['float','double','int','uint','bool'].includes(typeFamily(decl.type)))return null;
  const row=nativeSourceIndex().get(decl.id);if(!row||row.pending||row.missing)return null;
  const body=el('div',{class:'node-fixed-values native-reference-values','data-native-source':decl.id});
  body.dataset.sourcePresentation=JSON.stringify([decl.id,decl.type,decl.name,row.sequence]);
  body.append(nativeValueControls(decl,row));return body;
}
function syncNativeReferenceControls(){
  const declarations=new Map(graph.declarations.map(d=>[d.id,d])),nodes=new Map(current().nodes.map(n=>[n.id,n])),rows=nativeSourceIndex();
  for(const card of document.querySelectorAll('#cards .node:not(.collapsed)')){
    const node=nodes.get(card.dataset.node),decl=declarations.get(node?.params?.declarationId);if(decl?.kind!=='uniform')continue;
    const row=rows.get(decl.id),body=card.querySelector('.native-reference-values');
    const signature=row&&!row.pending&&!row.missing?JSON.stringify([decl.id,decl.type,decl.name,row.sequence]):null;
    if(body?.dataset.sourcePresentation===signature)continue;
    const replacement=nativeReferenceControls(node,decl);
    if(body){if(replacement)body.replaceWith(replacement);else body.remove();}
    else if(replacement)card.querySelector('.ports').after(replacement);
  }
}
function syncNativeComponentControls(grid,row,ready){
  const decl=grid.nativeDeclaration,count=grid.children.length,names=row.sequence==='color'?'RGBA':'XYZW';
  for(const slot of grid.children){
    const index=Number(slot.dataset.nativeComponentSlot),item=row.components[index];
    const numeric=!!item&&['CONSTANT','BIND'].includes(item.mode),kind=numeric?'numeric':'mode';
    if(slot.dataset.presentation!==kind){
      slot.dataset.presentation=kind;
      let entry;
      if(numeric){
        const commit=value=>{if(!entry.liveCommit?.(value))nativeSourceRequest('source-value',{id:decl.id,component:index,value,expected:entry.sourceExpected});};
        entry=typedScalarInput(item.value,typeFamily(decl.type),commit);
        entry.dataset.sourceComponent=index;
        entry.setAttribute('aria-label',decl.name+(count>1||row.sequence==='color'?' '+names[index]:''));
        if(decl.kind==='uniform'&&typeof uniformLive!=='undefined')uniformLive.attach(entry,decl.id,index);
      }else entry=el('span',{class:'source-component-mode','data-component-mode-label':''});
      slot.replaceChildren(componentField(entry,index,count,'',names));
    }
    const entry=slot.querySelector(numeric?'[data-source-component]':'[data-component-mode-label]');
    slot.dataset.mode=item?.mode||'unknown';
    if(numeric){
      entry.disabled=!ready||!item.writable;
      if(document.activeElement!==entry&&!entry.numericGestureActive){
        if(!Object.is(entry.nativeValue,item.value)||entry.value!==entry.nativeDisplay){entry.setSyncedValue(item.value);entry.nativeValue=item.value;entry.nativeDisplay=entry.value;}
        entry.sourceExpected=clone(item);
      }
      entry.title=[!ready?nativeSourceHintText():'',nativeComponentMode(item),item.binding||''].filter(Boolean).join(' · ');
    }else{
      const mode=nativeComponentMode(item)||'—',text=item?.mode==='EXPRESSION'&&item.expression?mode+': '+item.expression:mode;if(entry.textContent!==text)entry.textContent=text;
      entry.title=item?.expression||nativeComponentMode(item)||text;
    }
  }
}
function bufferConfigurationFields(initial={}){
  const element=el('section',{class:'source-array-fields'}),entries={};
  for(const [key,label]of [['pop','buffer.popPath'],['attrclass','buffer.attributeClass'],['attr','buffer.attribute']]){
    const entry=key==='attrclass'?select(['point','vertex','primitive'].map(value=>[value,t('buffer.'+value)]),initial[key]||'point',()=>{}):el('input',{type:'text',maxlength:4096,spellcheck:'false',value:initial[key]||''});
    entry.dataset.bufferField=key;entry.setAttribute('aria-label',t(label));entries[key]=entry;element.append(field(t(label),entry));
  }
  element.append(el('p',{class:'muted'},t('buffer.configHint')));
  return {element,entries,values:()=>Object.fromEntries(Object.entries(entries).map(([key,entry])=>[key,entry.value]))};
}
function nativeBufferFields(card,decl,row){
  card.append(el('p',{class:'muted'},t('help.pop_buffer')));
  if(!row.missing){
    const fields=bufferConfigurationFields(),editor=fields.element,apply=el('button',{type:'button'},t('matrix.applySource'));
    editor.dataset.bufferBindingEditor=decl.id;
    for(const entry of Object.values(fields.entries))entry.addEventListener('input',()=>{editor.bindingDirty=true;});
    editor.syncBinding=(binding,ready)=>{
      for(const [key,entry]of Object.entries(fields.entries)){
        const state=binding?.fields[key];entry.disabled=!ready||!state?.writable;
        if(!editor.bindingDirty&&!editor.contains(document.activeElement)){
          const value=state?.mode==='EXPRESSION'?state.expression:state?.value||'';if(entry.value!==value)entry.value=value;
        }
        entry.title=[state?.mode,state?.expression].filter(Boolean).join(' · ');
      }
      apply.disabled=!ready||!binding?.writable;
      if(!editor.bindingDirty&&!editor.contains(document.activeElement))editor.sourceExpected=binding?.expected;
    };
    apply.onclick=async()=>{const result=await nativeSourceRequest('source-edit',{action:'bufferBinding',id:decl.id,fields:fields.values(),expected:editor.sourceExpected});if(result){editor.bindingDirty=false;renderNativeSourceValues();}};
    editor.append(apply);card.append(editor);editor.syncBinding(row.bufferBinding,sourceReady());
  }
  card.append(el('p',{class:'muted native-source-state'}));
}
function nativeInputFields(box,decl){
  const row=nativeSourceRows().find(r=>r.id===decl.id);
  const card=el('section',{'data-native-source':decl.id,class:'native-input-fields'});box.append(card);
  card.addEventListener('pointerdown',()=>{if(!sourceReady())showNativeSourceHint();},true);
  if(!row||row.pending){card.append(el('p',{class:'muted'},t('sources.pending')));return;}
  if(decl.kind==='attribute'){nativeAttributeFields(card,decl,row);return;}
  if(decl.kind==='pop_buffer'){nativeBufferFields(card,decl,row);return;}
  if(decl.type==='samplerBuffer'||typeDescriptor(decl.type)?.shape==='array'){nativeArrayFields(card,decl,row);return;}
  if(isMatrixType(decl.type)){nativeMatrixFields(card,decl,row);return;}
  const count=typeContract?.types?.[decl.type]?.components||1;
  if(!row.missing){
    card.append(nativeValueControls(decl,row));
    if(decl.kind==='uniform'&&typeof uniformLive!=='undefined'){
      card.append(el('small',{'data-uniform-live-status':''}));uniformLive.render();
    }
    if(decl.kind==='uniform'&&['int','uint'].includes(typeFamily(decl.type))){
      card.append(el('p',{class:'muted'},t('inputs.integerUniformHint')));
    }
    if(decl.kind==='uniform'&&typeFamily(decl.type)==='double')card.append(el('p',{class:'muted'},t('inputs.doubleUniformHint')));
    if(decl.kind!=='spec_constant'){const drivers=el('details',{class:'input-drivers'});drivers.append(el('summary',{},t('inputs.drivers')));
    row.components.slice(0,count).forEach((item,index)=>{
      const line=el('div',{class:'source-driver'}),expr=input(item.expression||'',expression=>nativeSourceRequest('source-edit',{action:'driver',id:decl.id,component:index,expression,expected:expr.sourceExpected}));
      expr.dataset.sourceExpression=index;expr.sourceExpected=item.modeExpected;expr.placeholder=t('inputs.expression');expr.setAttribute('aria-label',decl.name+' '+'XYZW'[index]+' Python');
      const freeze=el('button',{'data-source-freeze':index},t('inputs.freeze'));
      freeze.onclick=()=>{const live=nativeSourceRows().find(r=>r.id===decl.id)?.components[index];nativeSourceRequest('source-edit',{action:'driver',id:decl.id,component:index,expression:'',expected:live?.modeExpected});};
      line.append(field('XYZW'[index],expr),el('small',{'data-source-mode':index}),freeze);drivers.append(line);
    });drivers.append(el('p',{class:'muted'},t('inputs.driverHint')));card.append(drivers);}
  }
  card.append(el('p',{class:'muted native-source-state'}));renderNativeSourceValues();
}
function nativeAttributeFields(card,decl,row){
  card.append(el('p',{class:'muted'},t('help.attribute')));
  const binding=row.attributeBinding;if(row.missing||!binding)return;
  const types=typeContract.attributeTypes.filter(type=>isMatrixType(type)===(row.sequence==='mattr'));
  const commit=(type,size)=>nativeSourceRequest('source-edit',{action:'attributeConfig',id:decl.id,type,arraySize:size,expected:binding.expected});
  const picker=typeSelect(types.map(type=>[type,type]),binding.type,type=>commit(type,binding.arraySize));
  picker.disabled=!sourceReady()||!binding.writable;card.append(field(t('node.type'),picker));
  if(binding.sizeSupported){
    const size=typedScalarInput(binding.arraySize,'int',value=>commit(binding.type,value));size.disabled=picker.disabled;
    card.append(field(t('array.length'),size));
  }else card.append(el('p',{class:'muted'},t('attribute.noArraySize')));
  if(!binding.writable)card.append(el('p',{class:'muted'},t('attribute.driven')));
}
function inputSourceInspector(box,decl){
  const heading=el('div',{class:'input-inspector-title'});heading.append(el('strong',{},decl.name),el('small',{},(decl.kind==='attribute'?'Attribute':decl.kind==='pop_buffer'?'POP Buffer':decl.kind==='uniform'?'Uniform':decl.kind==='spec_constant'?t('inputs.specConstants'):decl.kind==='constant'?t('inputs.graphConstants'):'Sampler')+' · '+decl.type));box.append(heading);
  const row=nativeSourceRows().find(r=>r.id===decl.id);
  const rename=input(decl.name,name=>{
    if(!/^[A-Za-z][A-Za-z0-9_]{0,47}$/.test(name)||/^(gl_|TD|sg_|sTD)/.test(name)||graph.declarations.some(d=>d.id!==decl.id&&d.name===name)){status(t('inputs.invalidName'),true);inspector();return;}
    if(['uniform','spec_constant','pop_buffer','attribute'].includes(decl.kind)&&row&&!row.pending){nativeSourceRequest('source-edit',{action:'rename',id:decl.id,name,expected:row.expected});}
    else changeDeclaration(()=>decl.name=name);
  });rename.dataset.sourceName='true';rename.dataset.inputName=decl.id;rename.disabled=readonly||(['uniform','spec_constant','pop_buffer','attribute'].includes(decl.kind)&&row&&!row.pending&&(!sourceReady()||!row.nameWritable));box.append(field(t('declaration.name'),rename));
  if(decl.kind==='uniform'){
    if(decl.type==='samplerBuffer'){box.append(field(t('node.type'),el('span',{},decl.type)));nativeInputFields(box,decl);}
    else if(typeDescriptor(decl.type)?.shape==='array'){
      const shape=typeDescriptor(decl.type);
      box.append(field(t('node.type'),el('span',{},displayType(decl.type))),field(t('array.length'),arrayLengthControl(shape.length,value=>changeDeclaration(()=>{decl.type=arrayType(shape.elementType,value);decl.value=null;}),false)),el('small',{class:'muted'},t('array.nativeSpecializationLimit')));nativeInputFields(box,decl);
    }else{
    const color=row?.sequence==='color'||decl.nativeSequence==='color',types=color?['float','vec2','vec3','vec4']:valueTypes().filter(type=>!row||row.pending||isMatrixType(type)===(row.sequence==='matrix'));
    const picker=typeSelect(types.map(v=>[v,v]),decl.type,value=>changeDeclaration(()=>setDeclarationType(decl,value)));
    if(!types.includes(decl.type)){const legacy=el('option',{value:decl.type,disabled:''},decl.type);picker.prepend(legacy);picker.value=decl.type;}
    box.append(field(t('node.type'),picker),el('small',{class:'muted'},t(color?'inputs.nativeColor':isMatrixType(decl.type)?'inputs.nativeMatrix':'inputs.nativeVector')));
    if(color&&!types.includes(decl.type))box.append(el('p',{class:'muted'},t('inputs.legacyColorType')));
    nativeInputFields(box,decl);
    const defaults=el('details',{class:'input-defaults'});defaults.append(el('summary',{},t('uniform.default')),numbers(decl.value,t('uniform.default'),value=>changeDeclaration(()=>decl.value=value),false,'XYZW',decl.type));box.append(defaults);
    if(!isMatrixType(decl.type)){const custom=el('button',{'data-source-custom':decl.id,class:'wide'},t('controls.fromUniform'));custom.onclick=()=>openUniformControl(decl.id);box.append(custom);}
    }
  }else if(decl.kind==='attribute'){
    if(!row||row.pending)box.append(field(t('node.type'),typeSelect(typeContract.attributeTypes.map(v=>[v,v]),decl.type,value=>changeDeclaration(()=>{decl.type=value;decl.nativeSequence=isMatrixType(value)?'mattr':'attr';}))));
    nativeInputFields(box,decl);
  }else if(decl.kind==='pop_buffer'){
    box.append(field(t('buffer.outputType'),typeSelect(typeContract.popBufferTypes.map(v=>[v,v]),decl.type,value=>changeDeclaration(()=>{decl.type=value;}))));nativeInputFields(box,decl);
  }else if(decl.kind==='spec_constant'){
    box.append(field(t('node.type'),typeSelect((typeContract?.specConstantTypes||['int','uint','bool','float']).map(v=>[v,v]),decl.type,value=>changeDeclaration(()=>{decl.type=value;decl.value=specDefaultValue(decl.value,value);}))),el('small',{class:'muted'},'constant_id = '+decl.constantId));
    nativeInputFields(box,decl);
    const defaults=el('details',{class:'input-defaults'});defaults.append(el('summary',{},t('uniform.default')),specValueField(decl.value,decl.type,value=>changeDeclaration(()=>decl.value=value)));box.append(defaults,el('p',{class:'muted'},t('inputs.specHint')));
  }else if(decl.kind==='constant')constantFields(box,decl);
  else declarationFields(box,decl);
  const actions=el('div',{class:'source-actions'}),reference=el('button',{'data-input-reference':decl.id},t('sources.reference'));reference.onclick=()=>inputReference(decl.id);
  reference.disabled=readonly||!!decl.sourceMissing||decl.kind==='attribute'&&stage!=='vertex';reference.dataset.sourceMissing=String(!!decl.sourceMissing);
  actions.append(reference);box.append(actions,el('p',{class:'muted'},t('inputs.references').replace('{count}',sourceReferences(decl.id).length)));
  if(['uniform','spec_constant','pop_buffer','attribute'].includes(decl.kind)&&row&&!row.pending){
    if(row.formatChange){
      const adopt=el('button',{class:'wide','data-source-adopt-format':decl.id},t('sources.adoptFormat'));
      adopt.disabled=!sourceReady();adopt.onclick=()=>nativeSourceAction('adoptFormat',decl).then(()=>inspector());box.append(adopt);
    }
    const sourceAction=action=>{
      const button=el('button',{class:'wide danger','data-source-remove':decl.id,'data-source-action':action},t(action==='restore'?'sources.restore':'sources.remove'));
      button.disabled=!sourceReady();
      button.onclick=()=>nativeSourceAction(action,decl).then(()=>inspector());box.append(button);
    };
    if(row.missing&&!row.formatChange)sourceAction('restore');
    if(!row.missing||!sourceReferences(decl.id).length)sourceAction('remove');
  }
  else {
    if(decl.sourceMissing){
      const restore=el('button',{class:'wide danger','data-input-restore':decl.id},t('sources.restore'));
      restore.onclick=()=>localSourceAction('restore',decl);box.append(restore);
    }
    if(!decl.sourceMissing||!sourceReferences(decl.id).length){
      const remove=el('button',{class:'wide danger','data-input-remove':decl.id},t('sources.remove'));
      remove.onclick=()=>localSourceAction('remove',decl);box.append(remove);
    }
  }
  sourceLocations(box,decl.id);
  if(readonly)for(const field of box.querySelectorAll('input,select,button'))field.disabled=true;
  renderNativeSourceValues();
}
function sourceLocations(box,id){
  const refs=sourceReferences(id);if(!refs.length)return;
  const list=el('details',{class:'source-locations'});list.append(el('summary',{},t('inputs.locate')));
  for(const [st,data]of Object.entries(graph.stages))for(const n of data.nodes.filter(n=>refs.includes(n))){const button=el('button',{},st+' · '+nodeDisplayName(n));button.onclick=()=>{stage=st;graphTrail=[];selectedInputId=null;selected=n.id;selection=new Set([n.id]);render();fit();};list.append(button);}box.append(list);
}
function topInputInspector(box,source){
  const slots=topInputsView(),index=slots.findIndex(s=>s.id===source.id),live=nativeSourceSnapshot?.topInputs?.find(s=>s.id===source.id);
  const edit=fn=>changeDeclaration(()=>{const slot=ensureTopInputs().find(s=>s.id===source.id);fn(slot);if(slot.id===graph.topInputLegacyId)for(const d of graph.declarations.filter(d=>d.source==='input:0'))d.defaultSource=slot.defaultSource;});
  box.append(el('strong',{},'sTD2DInputs['+index+']'),field(t('node.label'),input(source.label||'',name=>{if(name.length<=48&&!/[\x00-\x1f]/.test(name))edit(s=>s.label=name);})),el('p',{class:'muted'},t('inputs.topHint')));
  const value=source.defaultSource;
  box.append(field(t('texture.default'),select(textureOptions().filter(([key])=>key!=='input:0'),value.startsWith('op:')?'external':value,next=>edit(s=>{s.defaultSource=next==='external'?'op:/project1/texture':next;s.matchDefault=true;}))));
  if(value.startsWith('op:'))box.append(field(t('texture.path'),input(value.slice(3),next=>edit(s=>{s.defaultSource='op:'+next;s.matchDefault=true;}))));
  box.append(toggle(t('uniform.expose'),!!source.expose,next=>edit(s=>s.expose=next)));
  if(source.expose)box.append(field(t('uniform.publicName'),input(source.exposeName||'Input '+(index+1)+' Default TOP',next=>edit(s=>s.exposeName=next))));
  if(live)box.append(el('p',{class:'muted'},(live.connected?t('inputs.connected'):t('texture.default'))+' · '+live.path+' · '+live.width+' × '+live.height));
  const actions=el('div',{class:'source-actions'});
  for(const [label,offset]of [['↑',-1],['↓',1]]){const b=el('button',{'aria-label':t(offset<0?'inputs.moveUp':'inputs.moveDown')},label);b.disabled=readonly||index+offset<0||index+offset>=slots.length;b.onclick=()=>changeDeclaration(()=>{const slots=ensureTopInputs();[slots[index],slots[index+offset]]=[slots[index+offset],slots[index]];});actions.append(b);}
  const ref=el('button',{},t('sources.reference'));ref.disabled=readonly;ref.onclick=()=>inputReference(source.id);actions.append(ref);box.append(actions);
  const aliases=source.id===(graph.topInputLegacyId||slots[0].id)&&graph.declarations.some(d=>d.source==='input:0'),used=sourceReferences(source.id).length;
  const remove=el('button',{class:'wide danger'},t('sources.remove'));remove.disabled=readonly||!!used||aliases||!!live?.connected;remove.onclick=()=>changeDeclaration(()=>{graph.topInputs=ensureTopInputs().filter(s=>s.id!==source.id);if(graph.topInputLegacyId===source.id)delete graph.topInputLegacyId;selectedInputId=null;});box.append(remove);
  if(remove.disabled&&!readonly)box.append(el('p',{class:'muted'},t('inputs.topRemoveHint')));
  sourceLocations(box,source.id);
  if(readonly)for(const field of box.querySelectorAll('input,select,button'))field.disabled=true;
}
function installInputDrag(button,id){
  installCanvasItemDrag(button,()=>allInputSources().find(d=>d.id===id)?.name||'',(x,y)=>inputReference(id,x,y),()=>inputReference(id));
}
function installCanvasItemDrag(button,label,dropItem,clickItem){
  // Only the explicit reference handle captures touch; the inventory still scrolls.
  let suppressClick=0;
  button.onclick=()=>{if(performance.now()>suppressClick)clickItem();};
  button.onpointerdown=e=>{
    if(readonly||button.disabled||e.button!==0)return;e.preventDefault();e.stopPropagation();
    const start={x:e.clientX,y:e.clientY},pointer=e.pointerId,ghost=el('div',{class:'input-drag-preview'},label());let moved=false,done=false;
    button.setPointerCapture(pointer);
    const cancel=()=>finish(null),escape=ev=>{if(ev.key==='Escape'){ev.preventDefault();ev.stopImmediatePropagation();cancel();}},second=ev=>{if(ev.pointerId!==pointer)cancel();};
    function finish(ev){
      if(done)return;done=true;const drop=moved&&ev&&document.elementFromPoint(ev.clientX,ev.clientY)?.closest('#canvas');
      button.removeEventListener('pointermove',move);button.removeEventListener('pointerup',finish);button.removeEventListener('pointercancel',cancel);button.removeEventListener('lostpointercapture',cancel);document.removeEventListener('keydown',escape,true);document.removeEventListener('pointerdown',second,true);window.removeEventListener('blur',cancel);ghost.remove();$('#canvas').classList.remove('drop-ready');
      if(button.hasPointerCapture(pointer))button.releasePointerCapture(pointer);
      if(moved||!ev)suppressClick=performance.now()+500;
      if(drop)dropItem(ev.clientX,ev.clientY);
    }
    function move(ev){if(ev.pointerId!==pointer)return;if(Math.hypot(ev.clientX-start.x,ev.clientY-start.y)>8)moved=true;if(!moved)return;if(!ghost.isConnected)document.body.append(ghost);ghost.style.left=(ev.clientX+12)/uiScaleFactor()+'px';ghost.style.top=(ev.clientY+12)/uiScaleFactor()+'px';$('#canvas').classList.toggle('drop-ready',!!document.elementFromPoint(ev.clientX,ev.clientY)?.closest('#canvas'));}
    button.addEventListener('pointermove',move);button.addEventListener('pointerup',finish);button.addEventListener('pointercancel',cancel);button.addEventListener('lostpointercapture',cancel);document.addEventListener('keydown',escape,true);document.addEventListener('pointerdown',second,true);window.addEventListener('blur',cancel);
  };
}
function tdBuiltInEntries(query=''){
  return catalog.filter(d=>['uv','position','builtin_source'].includes(d.key)&&d.stages.includes(stage)).flatMap(d=>d.key==='builtin_source'?builtinSourceEntries(d):[{...d,sourcePath:typeContract.sources.nodeSources[d.key]?.path,sourceAliases:[...(typeContract.sources.nodeSources[d.key]?.aliases||[]),typeContract.sources.nodeSources[d.key]?.commonName||'']}]).filter(d=>normalizeSearch([d.label,d.key,builtInSourceLabel(d),builtInSourceName(d),...d.sourceAliases].join(' ')).includes(query));
}
function addBuiltInReference(d,x=null,y=null){
  const rect=$('#canvas').getBoundingClientRect(),point=graphPoint(x??rect.left+rect.width/2,y??rect.top+rect.height/2);if(!point)return;
  change(()=>{selectedInputId=null;selectNode(instantiate(d,point.x,point.y));});
}
function sourceMenuEntries(query){
  if(sourceBuiltinCache?.query===query&&sourceBuiltinCache.catalog===catalog&&sourceBuiltinCache.contract===typeContract)return sourceBuiltinCache.groups;
  const groups=new Map();
  for(const d of tdBuiltInEntries(query)){
    const path=d.sourcePath?.join('.')||'tdBuiltin.render',rows=groups.get(path)||[];
    const row=el('div',{class:'input-source-row','data-category':nodeCategory(d)}),button=el('button',{class:'input-source-select','data-builtin-reference':d.builtinSource||d.key});
    button.append(el('span',{},builtInSourceName(d)),el('small',{},builtInSourceLabel(d)||displayType(d.outputs.out)));row.sourceDefinition=d;button.disabled=readonly;
    installCanvasItemDrag(button,()=>builtInSourceName(d),(x,y)=>addBuiltInReference(d,x,y),()=>addBuiltInReference(d));
    const more=el('button',{class:'source-card-menu-button','aria-label':t('sources.actions'),'aria-haspopup':'menu'},'⋯');
    more.onclick=e=>openSourceCardMenu(row,null,null,e,d);row.oncontextmenu=e=>openSourceCardMenu(row,null,null,e,d);
    row.append(button,more);rows.push(row);groups.set(path,rows);
  }
  sourceBuiltinCache={query,catalog,contract:typeContract,groups};return groups;
}
// Source presentation is keyed independently from graph selection and native values.
// Reconcile only membership/order; untouched cards keep their controls and focus.
const sourceCardCache=new Map(),sourceGroupCache=new Map(),sourceCardCollapsed=new Map();
let sourcePresentationContext='',sourceBuiltinCache=null;
function reconcileSourceChildren(parent,children){
  const wanted=new Set(children);for(const child of [...parent.children])if(!wanted.has(child))child.remove();
  children.forEach((child,index)=>{if(parent.children[index]!==child)parent.insertBefore(child,parent.children[index]||null);});
}
function sourceGroup(kind,label,children,create=null,query=''){
  let group=sourceGroupCache.get(kind);
  if(!group){
    const section=el('section',{class:'input-group','data-input-group':kind}),head=el('div',{class:'input-group-title'}),list=el('div',{class:'input-group-items',id:'input-group-'+kind}),toggle=el('button',{class:'input-group-toggle','aria-controls':list.id});
    toggle.append(el('span',{class:'input-group-arrow','aria-hidden':'true'},'›'),el('span',{},label));head.append(toggle);section.append(head,list);
    const badges=el('span',{class:'source-counts'});toggle.append(badges);
    group={section,list,toggle,badges,badgeByCategory:new Map(),query};
    toggle.onclick=()=>{list.hidden=!list.hidden;toggle.setAttribute('aria-expanded',String(!list.hidden));if(!group.query)setInputGroupCollapsed(kind,list.hidden);};
    if(create){const add=el('button',{class:'input-group-add','data-input-create':create,'aria-label':t('inputs.addSource').replace('{category}',label),title:t('inputs.addSource').replace('{category}',label)},'＋ '+t('inputs.newShort'));add.onclick=()=>openInputCreate(create);head.append(add);}
    sourceGroupCache.set(kind,group);
  }
  group.query=query;group.list.hidden=!query&&inputCollapsedGroups.has(kind);group.toggle.setAttribute('aria-expanded',String(!group.list.hidden));
  reconcileSourceChildren(group.list,children);
  const counts=new Map(),add=(category,count)=>{if(count)counts.set(category,(counts.get(category)||0)+count);};
  for(const child of children){
    if(child.sourceCounts)for(const [category,count]of child.sourceCounts)add(category,count);
    else if(child.dataset.sourceAvailable==='true'||child.querySelector('[data-builtin-reference]'))add(child.dataset.category,1);
  }
  group.section.sourceCounts=counts;
  const badges=[];for(const [category,count]of counts){
    let badge=group.badgeByCategory.get(category);
    if(!badge){badge=el('span',{class:'source-count','data-category':category});group.badgeByCategory.set(category,badge);}
    const number=String(count);if(badge.textContent!==number)badge.textContent=number;
    const label=t('category.'+category),hint=label+' · '+t('sources.availableCount').replace('{count}',number);badge.title=hint;badge.setAttribute('aria-label',hint);badges.push(badge);
  }
  reconcileSourceChildren(group.badges,badges);return group.section;
}
function sourceUniformGroup(decl,row){
  const sequence=row?.sequence||decl.nativeSequence;
  return sequence==='array'||typeDescriptor(decl.type)?.shape==='array'?'arrays':sequence==='matrix'||isMatrixType(decl.type)?'matrices':'values';
}
function referenceCommonSource(preset,x=null,y=null){
  if(editorMutationBlocked())return;
  const entry=typeContract?.sources?.uniformPresets?.[preset],definition=catalog.find(d=>d.key==='uniform');if(!entry||!definition)return;
  const rect=$('#canvas').getBoundingClientRect(),point=graphPoint(x??rect.left+rect.width/2,y??rect.top+rect.height/2);if(!point)return;
  change(()=>{const decl=createInputDeclaration('uniform',entry.type,{preset});selectedInputId=null;selectNode(instantiate(definition,point.x,point.y,null,{declarationId:decl.id}));});
}
function sourceCardHelp(id,preset){
  if(id)selectInputSource(id);
  if(preset){sourceHelpPreset=preset;helpContext='sourcePreset';renderHelp();}
  workspaceLayout?.reveal('help');
}
function openSourceCardMenu(card,id,preset,event,builtin=null){
  event?.preventDefault();event?.stopPropagation();document.querySelector('#sourcecardmenu')?.remove();
  const menu=el('div',{id:'sourcecardmenu',class:'popup-menu source-card-menu',popover:'auto',role:'menu'}),load=editorLoadGeneration;
  const decl=allInputSources().find(d=>d.id===id),reference=()=>builtin?addBuiltInReference(builtin):preset?referenceCommonSource(preset):inputReference(id);
  const add=(label,action,disabled=false)=>{const item=el('button',{type:'button',role:'menuitem'},label);item.disabled=disabled;item.onclick=()=>{menu.hidePopover();if(load===editorLoadGeneration)action();};menu.append(item);return item;};
  add(t('sources.reference'),reference,editorMutationBlocked()||!!decl?.sourceMissing||decl?.kind==='attribute'&&stage!=='vertex'||card.dataset.sourceState==='conflict');
  const select=add(t('sources.selectReferences'),()=>{menu.returnToCard=false;selectSourceReferences(id,builtin);},!currentSourceReferences(id,builtin).length);select.dataset.sourceSelectReferences='';select.title=t('sources.selectReferencesHint');
  if(decl)add(t('inputs.edit'),()=>selectInputSource(id));
  if(!builtin)add(t('panel.helpTitle'),()=>sourceCardHelp(id,preset));
  const row=nativeSourceIndex().get(id);
  if(decl&&row&&['uniform','spec_constant','pop_buffer','attribute'].includes(decl.kind)){
    menu.append(el('div',{class:'popup-separator',role:'separator'}));
    if(row.formatChange)add(t('sources.adoptFormat'),()=>nativeSourceAction('adoptFormat',decl),!sourceReady());
    if(row.missing&&!row.formatChange)add(t('sources.restore'),()=>nativeSourceAction('restore',decl),!sourceReady());
    if(!row.missing||!sourceReferences(id).length)add(t('sources.remove'),()=>nativeSourceAction('remove',decl),!sourceReady());
  }
  if(decl?.kind==='constant'){
    menu.append(el('div',{class:'popup-separator',role:'separator'}));
    if(decl.sourceMissing)add(t('sources.restore'),()=>localSourceAction('restore',decl),editorMutationBlocked());
    if(!decl.sourceMissing||!sourceReferences(id).length)add(t('sources.remove'),()=>localSourceAction('remove',decl),editorMutationBlocked());
  }
  menu.onkeydown=e=>{const items=[...menu.querySelectorAll('button:not(:disabled)')],i=items.indexOf(document.activeElement);if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();items[e.key==='Home'?0:e.key==='End'?items.length-1:(i+(e.key==='ArrowDown'?1:-1)+items.length)%items.length]?.focus();}};
  menu.addEventListener('toggle',e=>{if(e.newState==='closed'){menu.remove();if(menu.returnToCard!==false&&card.isConnected)card.querySelector('.source-card-menu-button')?.focus({preventScroll:true});}});
  document.body.append(menu);menu.showPopover();const rect=card.getBoundingClientRect(),z=uiScaleFactor(),x=event?.type==='contextmenu'?event.clientX:rect.right,y=event?.type==='contextmenu'?event.clientY:rect.top;
  menu.style.left=Math.max(8,Math.min(x,innerWidth-menu.offsetWidth*z-8))/z+'px';menu.style.top=Math.max(8,Math.min(y,innerHeight-menu.offsetHeight*z-8))/z+'px';menu.querySelector('button:not(:disabled)')?.focus();
}
function sourceCard(decl,preset,issue,row,conflict=false){
  const entry=preset&&typeContract.sources.uniformPresets[preset],key=preset?'preset:'+preset:decl.id,dormant=!decl&&!!entry;
  const signature=JSON.stringify([decl&&[decl.id,decl.name,decl.type,decl.kind,decl.nativeSequence,decl.index,decl.sourceMissing],row&&[row.sequence,row.missing,row.pending],issue,preset,conflict]);
  let cached=sourceCardCache.get(key);
  if(!cached||cached.signature!==signature){
    const id=decl?.id,label=entry?commonPresetLabel(preset):decl.name,type=decl?.type||entry.type;
    const card=el('div',{class:'input-source-row source-card','data-category':decl?.type==='samplerBuffer'?'texture':nodeCategory({key:decl?.kind||'uniform'}),'data-source-card':key}),head=el('div',{class:'source-card-head'}),body=el('div',{class:'source-card-body'}),toggle=el('button',{class:'source-card-toggle','aria-label':t('sources.details')}),pick=el('button',{class:'input-source-select','aria-pressed':'false'}),more=el('button',{class:'source-card-menu-button','aria-label':t('sources.actions'),'aria-haspopup':'menu'},'⋯');
    if(id)card.dataset.inputSource=id;if(preset)card.dataset.preset=preset;
    if(dormant)card.dataset.dormant='true';
    const name=el('span');if(entry){const parts=label.split('.');parts.forEach((part,index)=>{if(index)name.append('.',el('wbr'));name.append(part);});}else name.textContent=label;
    pick.append(name,el('small',{},type));pick.title=label+' · '+type;
    const reference=el('button',{class:'input-reference','aria-label':t('sources.reference')+' '+label,title:t('inputs.dragReference')},'+');
    if(id)reference.dataset.inputReference=id;else reference.dataset.presetReference=preset;
    reference.dataset.sourceMissing=String(!!decl?.sourceMissing||conflict);reference.disabled=editorMutationBlocked()||!!decl?.sourceMissing||conflict;
    const add=(x,y)=>preset?referenceCommonSource(preset,x,y):inputReference(id,x,y);
    installCanvasItemDrag(reference,()=>preset?commonPresetLabel(preset):decl.name,add,()=>add());
    installCanvasItemDrag(pick,()=>preset?commonPresetLabel(preset):decl.name,add,()=>id?selectInputSource(id):sourceCardHelp(null,preset));const pointer=pick.onpointerdown;pick.onpointerdown=e=>{if(e.pointerType==='mouse')pointer(e);};
    toggle.append(el('span',{class:'input-group-arrow','aria-hidden':'true'},'›'));
    let bodyBuilt=false;
    const showBody=collapsed=>{
      body.hidden=collapsed;card.dataset.expanded=String(!collapsed);toggle.setAttribute('aria-expanded',String(!collapsed));
      if(collapsed||bodyBuilt)return;bodyBuilt=true;
      if(entry&&!decl)body.append(el('p',{class:'source-card-meta'},t(entry.labelKey)+' · '+entry.name));
      if(decl&&row&&!row.pending&&!row.missing&&!isResourceType(decl.type)&&!isMatrixType(decl.type)&&typeDescriptor(decl.type)?.shape!=='array'&&['uniform','spec_constant'].includes(decl.kind)){
        body.dataset.nativeSource=id;body.append(nativeValueControls(decl,row));
      }else if(dormant)body.append(el('p',{class:'source-card-meta'},t('sources.presetDormant')));
      if(decl){
        const definition=catalog.find(d=>d.key===decl.kind);
        if(definition){
          const node={id:'source:'+decl.id,definitionUuid:definition.definitionUuid,revisionHash:definition.revisionHash,params:{...clone(definition.defaults),declarationId:decl.id}};
          const outputs=safeConcretePorts(graph,node,currentFunction()).outputs,list=el('div',{class:'ports source-card-outputs'});
          for(const [name,type]of Object.entries(outputs)){
            const output=el('div',{class:'port-row output','data-type':type}),socket=el('button',{type:'button',class:'port','aria-label':t('sources.reference')+' '+label,title:t('inputs.dragReference')});
            socket.dataset.sourceOutput=decl.id;socket.disabled=editorMutationBlocked()||!!decl.sourceMissing||conflict||decl.kind==='attribute'&&stage!=='vertex';
            installCanvasItemDrag(socket,()=>preset?commonPresetLabel(preset):decl.name,add,()=>add());
            output.append(socket,el('span',{class:'port-label'},portLabel(node,'outputs',name)),el('small',{class:'port-type'},displayType(type)));list.append(output);
          }
          body.append(list);
        }
      }
    };
    showBody(sourceCardCollapsed.get(key)??dormant);toggle.onclick=()=>{sourceCardCollapsed.set(key,!body.hidden);showBody(!body.hidden);};
    more.onclick=e=>openSourceCardMenu(card,id,preset,e);head.oncontextmenu=e=>openSourceCardMenu(card,id,preset,e);
    head.append(toggle,pick,reference,more);card.append(head,body);
    const state=el('div',{class:'input-source-status'});card.append(state);
    cached={card,signature,state,decl,preset,issue,conflict};sourceCardCache.set(key,cached);
  }
  const {card,state}=cached,native=decl&&['uniform','spec_constant','pop_buffer','attribute'].includes(decl.kind);
  const sourceState=conflict?'conflict':issue?.status||decl?.sourceMissing&&'missing'||native&&(connectionInterrupted||nativeSourceError)&&'unknown'||native&&(!row||row.pending)&&'pending'||dormant&&'dormant'||'ready';
  const message=conflict?t('sources.presetConflict'):issue?.message||decl?.sourceMissing&&t('sources.missing')||sourceState==='unknown'&&t('sources.connectionUnknown')||sourceState==='pending'&&t('sources.enable')||'';
  card.dataset.sourceState=sourceState;card.dataset.sourceAvailable=String(sourceState==='ready'&&!(decl?.kind==='attribute'&&stage!=='vertex'));state.hidden=!message;const text=message?'⚠ '+message:'';if(state.textContent!==text)state.textContent=text;
  const pick=card.querySelector('.input-source-select'),pressed=String(!!decl&&selectedInputId===decl.id);if(pick.getAttribute('aria-pressed')!==pressed)pick.setAttribute('aria-pressed',pressed);
  for(const socket of card.querySelectorAll('[data-source-output]'))socket.disabled=editorMutationBlocked()||sourceState!=='ready'||decl?.kind==='attribute'&&stage!=='vertex';
  return card;
}
function refreshSourceNames(){
  const text=(element,value)=>{if(element&&element.textContent!==value)element.textContent=value;};
  for(const {card,preset}of sourceCardCache.values())if(preset){
    const label=commonPresetLabel(preset),pick=card.querySelector('.input-source-select');
    text(pick.querySelector('span'),label);pick.title=label+' · '+typeContract.sources.uniformPresets[preset].initialize.expression;
    for(const button of card.querySelectorAll('.input-reference,[data-source-output]'))button.setAttribute('aria-label',t('sources.reference')+' '+label);
  }
  for(const rows of sourceBuiltinCache?.groups.values()||[])for(const row of rows){
    const d=row.sourceDefinition,button=row.querySelector('[data-builtin-reference]'),label=builtInSourceName(d);
    text(button.querySelector('span'),label);button.title=builtInSourceHint(d);
  }
}
function setSourceNameMode(mode){
  if(!['td','common'].includes(mode)||mode===sourceNameMode)return;
  sourceNameMode=mode;$('#sourcenames').value=mode;try{localStorage.setItem(sourceNamesStorageKey,mode);}catch{}
  // Patch labels only: live inputs, selection, source identities and history survive.
  renderSourceCards($('#nativeuniforms'),normalizeSearch($('#inputsearch').value));
  const nodes=new Map(current().nodes.map(node=>[node.id,node]));let resized=false;
  for(const card of document.querySelectorAll('#cards .node')){
    const node=nodes.get(card.dataset.node),name=card.querySelector('.node-function-title');if(!node||!name)continue;
    const label=nodeCanvasTitle(node);if(name.textContent===label)continue;
    name.textContent=label;name.title=label;delete card.dataset.nodeDefaultWidth;applyNodeWidth(card,node);resized=true;
  }
  if(resized)wires();
}
function renderSourceCards(box,query){
  const context=JSON.stringify([language,editorTarget,stage,editorLoadGeneration]);
  if(context!==sourcePresentationContext){sourcePresentationContext=context;sourceCardCache.clear();sourceGroupCache.clear();sourceBuiltinCache=null;}
  const decls=allInputSources(),rows=nativeSourceIndex(),issues=nativeSourceSnapshot?.issues||[],issueById=new Map(issues.filter(i=>i.id).map(i=>[i.id,i]));
  const byDriver=new Map(),byName=new Map();for(const decl of decls){if(decl.initialDriver){const matches=byDriver.get(decl.initialDriver)||[];matches.push(decl);byDriver.set(decl.initialDriver,matches);}const matches=byName.get(decl.name)||[];matches.push(decl);byName.set(decl.name,matches);}
  const used=new Set(),keys=new Set(),sections=[],textureSources=[],common=new Map();
  const matches=(...text)=>normalizeSearch(text.join(' ')).includes(query);
  for(const preset of Object.keys(inputPresets())){
    const entry=typeContract.sources.uniformPresets[preset],candidates=[...new Set([...(byDriver.get(preset)||[]),...(byName.get(entry.name)||[])])],decl=candidates.length===1&&candidates[0].kind==='uniform'&&candidates[0].type===entry.type?candidates[0]:null,conflict=!!candidates.length&&!decl;
    if(decl)used.add(decl.id);keys.add('preset:'+preset);
    if(matches(entry.name,entry.initialize.expression,entry.commonName,t(entry.labelKey),decl?.name,'common uniform')){const path=entry.path.join('.'),cards=common.get(path)||[];cards.push(sourceCard(decl,preset,decl&&issueById.get(decl.id),decl&&rows.get(decl.id),conflict));common.set(path,cards);}
  }
  const menu=new Map([...sourceMenuEntries(query)].map(([path,rows])=>[path,[...rows]]));
  for(const [path,cards]of common)menu.set(path,[...(menu.get(path)||[]),...cards]);
  const addMenu=(path,section)=>{const list=menu.get(path)||[];list.push(section);menu.set(path,list);};
  const groups=new Map();for(const decl of decls){if(used.has(decl.id)||!['uniform','sampler','constant','spec_constant','pop_buffer','attribute','top_input'].includes(decl.kind))continue;keys.add(decl.id);if(!matches(decl.name,decl.kind,decl.type,rows.get(decl.id)?.sequence,decl.nativeSequence))continue;const kind=decl.type==='samplerBuffer'?'texture_buffer':decl.kind,group=groups.get(kind)||[];group.push(decl);groups.set(kind,group);}
  for(const kind of ['top_input','texture_buffer','pop_buffer','attribute','constant','spec_constant','uniform','sampler']){
    const group=groups.get(kind)||[],canCreate=kind==='attribute'?editorTarget==='mat':kind!==(editorTarget==='top'?'sampler':'top_input');if((!canCreate||query)&&!group.length)continue;
    const cards=d=>sourceCard(d,null,issueById.get(d.id),rows.get(d.id));
    const children=kind==='uniform'?['values','matrices','arrays'].map(name=>{const list=group.filter(d=>sourceUniformGroup(d,rows.get(d.id))===name);return list.length?sourceGroup('uniform.'+name,t('sources.'+name),list.map(cards),null,query):null;}).filter(Boolean):group.map(cards);
    if(['texture_buffer','pop_buffer'].includes(kind)&&!group.length&&!query&&nativeSourceSnapshot?.enabled&&!connectionInterrupted&&!nativeSourceError&&!issues.some(i=>i.sequence===(kind==='pop_buffer'?'buffer':'array')))children.push(el('p',{class:'muted'},t('buffer.empty')));
    const section=sourceGroup(kind,inputGroupLabel(kind),children,canCreate?kind:null,query);
    if(['top_input','sampler','texture_buffer'].includes(kind))textureSources.push(section);
    else if(['pop_buffer','attribute'].includes(kind))addMenu('tdBuiltin.'+(kind==='attribute'?'geometry':'buffer'),section);
    else sections.push(section);
  }
  const menuSections=[];
  for(const root of ['common','textures','tdBuiltin']){
    let children=[];
    for(const key of Object.keys(typeContract.sources.menuGroups)){const path=root+'.'+key,rows=menu.get(path);if(rows?.length)children.push(sourceGroup(path,t(typeContract.sources.menuGroups[key]),rows,null,query));}
    if(root==='textures')children=[...textureSources,...(children.length?[sourceGroup('textures.tdInputs',t('sources.tdInputsInfo'),children,null,query)]:[])];
    if(children.length)menuSections.push(sourceGroup(root,t(typeContract.sources.menuGroups[root]),children,null,query));
  }
  sections.unshift(...menuSections);
  const unimported=issues.filter(i=>!i.id&&matches(i.name,i.message));
  if(unimported.length){
    const issueKey=JSON.stringify(unimported),previous=sourceGroupCache.get('issues');let section=previous?.section;
    if(previous?.issueKey!==issueKey){section=el('section',{class:'input-group','data-source-issues':''});section.append(el('div',{class:'input-group-title'},t('sources.unavailable')));for(const issue of unimported){const card=el('div',{class:'input-source-row','data-source-state':issue.status||'invalid','data-source-issue':issue.name||'','data-category':'shader'}),head=el('div',{class:'input-source-select'});head.append(el('span',{},issue.name||t('sources.unavailable')),el('small',{},issue.type||''));card.append(head,el('div',{class:'input-source-status'},'⚠ '+issue.message));section.append(card);}sourceGroupCache.set('issues',{issueKey,section});}sections.push(section);
  }
  if(query&&!sections.length)sections.push(el('p',{class:'muted'},t('create.empty')));
  reconcileSourceChildren(box,sections);refreshSourceNames();for(const key of sourceCardCache.keys())if(!keys.has(key))sourceCardCache.delete(key);
  for(const button of box.querySelectorAll('[data-builtin-reference]'))button.disabled=readonly;
  for(const button of box.querySelectorAll('[data-preset-reference]'))button.disabled=editorMutationBlocked()||button.dataset.sourceMissing==='true';
}

function renderNativeSources(){
  const box=$('#nativeuniforms');if(!box||!graph)return;
  if(typeof StructureUI!=='undefined')StructureUI.render();
  syncNativeReferenceControls();
  renderSourceCards(box,normalizeSearch($('#inputsearch')?.value));
  // Native row availability can arrive after an apply without changing graph revision.
  const active=selectedInputId||current().nodes.find(n=>n.id===selected)?.params?.declarationId;
  const row=nativeSourceRows().find(r=>r.id===active),signature=JSON.stringify([active,row?.missing,row?.pending,row?.sequence,row?.matrixBinding&&[row.matrixBinding.mode,!!row.matrixBinding.literalValues,row.matrixBinding.writable],row?.arrayBinding&&[row.arrayBinding.mode,row.arrayBinding.writable],row?.bufferBinding&&Object.values(row.bufferBinding.fields).map(f=>[f.mode,f.writable]),row?.formatChange,row?.attributeBinding]);
  if($('#inspector').dataset.inputState!==signature&&!$('#inspector').contains(document.activeElement)){$('#inspector').dataset.inputState=signature;if(active)inspector();}
  renderNativeSourceValues();
}
function installNativeSources(){
  try{sourceNameMode=localStorage.getItem(sourceNamesStorageKey)==='common'?'common':'td';}catch{}
  $('#sourcenames').value=sourceNameMode;$('#sourcenames').onchange=()=>setSourceNameMode($('#sourcenames').value);
  const arrayFields=el('section',{id:'sourcearrayfields',class:'source-array-fields'}),arrayLength=el('input',{id:'sourcearraylength',type:'number',min:1,max:1024,step:1,value:4}),arraySource=el('input',{id:'sourcearraypath',type:'text',maxlength:4096,spellcheck:'false',placeholder:'/project1/constant1'});
  const lengthField=field('',arrayLength),pathField=field('',arraySource);lengthField.prepend(el('span',{'data-i18n':'array.length'},t('array.length')));pathField.prepend(el('span',{'data-i18n':'array.chopPath'},t('array.chopPath')));
  const arrayHint=el('p',{class:'muted'});arrayFields.append(lengthField,pathField,arrayHint);arrayFields.hidden=true;$('#sourcepresethint').before(arrayFields);
  const bufferFields=bufferConfigurationFields();bufferFields.element.id='sourcebufferfields';bufferFields.element.hidden=true;$('#sourcepresethint').before(bufferFields.element);
  $('#inputsearch').oninput=renderNativeSources;
  $('#closesourcecreate').onclick=()=>$('#sourcecreatedialog').close();
  $('#sourcekind').onchange=()=>{const kind=$('#sourcekind').value,preset=inputPresets()[kind.slice(7)],types=['sampler','top_input'].includes(kind)?['sampler2D']:['array','color','texture_buffer'].includes(kind)?['float','vec2','vec3','vec4']:kind==='spec_constant'?(typeContract?.specConstantTypes||['int','uint','bool','float']):kind==='attribute'?typeContract.attributeTypes:kind==='pop_buffer'?typeContract.popBufferTypes:valueTypes();$('#sourcename').value=uniqueInputName(preset?.[0]||(kind==='top_input'?'Input'+topInputsView().length:kind==='constant'?'cValue':kind==='spec_constant'?'sValue':kind==='sampler'?'uTexture':kind==='color'?'uColor':kind==='array'?'uArray':kind==='texture_buffer'?'uBuffer':kind==='pop_buffer'?'Data':kind==='attribute'?'Attribute':'uValue'));$('#sourcetype').replaceChildren(...types.map(value=>el('option',{value},value)));$('#sourcetype').value=kind==='color'?'vec4':types[0];arrayFields.hidden=!['array','texture_buffer'].includes(kind);bufferFields.element.hidden=kind!=='pop_buffer';lengthField.hidden=kind==='texture_buffer';arrayHint.textContent=t(kind==='texture_buffer'?'buffer.nativeHint':'array.nativeHint');arrayLength.required=arraySource.required=kind==='array';arrayLength.max=String(typeContract?.composites?.array?.maxTypeLength||typeContract?.composites?.array?.maxLength||1024);$('#sourcepresethint').textContent=preset?preset[1]:kind==='spec_constant'?t('inputs.specHint'):'';$('#sourcecreateerror').textContent='';renderNativeSourceValues();};
  $('#sourcecreate').onsubmit=async e=>{
    e.preventDefault();if(readonly)return;const name=$('#sourcename').value.trim(),kind=$('#sourcekind').value,existing=inputPresetSource(kind);
    if(existing){finishInputCreate(kind,existing.id);return;}
    if(kind!=='top_input'&&(!/^[A-Za-z][A-Za-z0-9_]{0,47}$/.test(name)||/^(gl_|TD|sg_|sTD)/.test(name)||graph.declarations.some(d=>d.name===name&&!(kind.startsWith('preset:')&&d.kind==='uniform'&&d.initialDriver===kind.slice(7))))){$('#sourcecreateerror').textContent=t('inputs.invalidName');return;}
    const count=Number(arrayLength.value),arrayPath=arraySource.value.trim();
    if(kind==='array'&&(!Number.isInteger(count)||count<1||count>(typeContract?.composites?.array?.maxTypeLength||typeContract?.composites?.array?.maxLength||1024)||!arrayPath)){$('#sourcecreateerror').textContent=t('array.invalidSource');return;}
    const buffer=bufferFields.values();if(kind==='pop_buffer'&&(!buffer.pop.trim()||!buffer.attr.trim())){$('#sourcecreateerror').textContent=t('buffer.configHint');return;}
    let id;const changed=changeDeclaration(()=>{id=createInputDeclaration(['sampler','constant','spec_constant','pop_buffer','attribute','top_input'].includes(kind)?kind:'uniform',kind==='texture_buffer'?'samplerBuffer':kind==='array'?$('#sourcetype').value+'['+count+']':kind.startsWith('preset:')?'float':$('#sourcetype').value,{name,...(kind==='pop_buffer'?{popSource:buffer.pop,attributeClass:buffer.attrclass,attribute:buffer.attr}:kind==='texture_buffer'?{nativeSequence:'array',elementType:$('#sourcetype').value,arraySource:arrayPath}:kind==='array'?{nativeSequence:'array',elementType:$('#sourcetype').value,length:count,arraySource:arrayPath}:kind==='color'?{nativeSequence:'color'}:kind.startsWith('preset:')?{preset:kind.slice(7)}:{})}).id;});
    if(changed)finishInputCreate(kind,id);else $('#sourcecreateerror').textContent=$('#status').textContent;
  };
  $('#canvas').addEventListener('pointerdown',()=>{selectedInputId=null;},true);
  setInterval(()=>{
    if(typeof uniformLive!=='undefined'){
      uniformLive.watchVisible();
      if(uniformLive.ready&&nativeSourceSnapshot?.revision===revision&&!nativeSourceError&&!nativeSourceRefreshPending)return;
    }
    refreshNativeSources();
  },1000);
}


/* COMP controls are a peer workspace panel. Native page/group identity and
   metadata come from TD; there is no duplicate browser parameter model. */
let customSnapshot=null,customBusy=false,customPolling=false,customError='',customRetryAt=0,customPage='';
function receiveCustomParameters(data){customSnapshot=data;renderCustomParameters();}
async function refreshCustomParameters(){
  if(!graph||readonly||customBusy||customPolling||historyBusy||nativeMutationBusy||document.hidden||submitBusy||Date.now()<customRetryAt)return;
  customPolling=true;const generation=editorLoadGeneration;
  try{const data=await api('custom-parameters');if(generation!==editorLoadGeneration)return;customError='';receiveCustomParameters(data);}
  catch(e){if(generation!==editorLoadGeneration)return;customError=e.status===404?t('sources.connectionUnsupported'):e.message;customRetryAt=Date.now()+5000;updateCustomValues();}
  finally{if(generation===editorLoadGeneration)customPolling=false;}
}
async function customRequest(body){
  if(customBusy||dirty||submitBusy||editorMutationBlocked()||!customSnapshot)return false;
  customBusy=true;nativeMutationBusy=true;renderGraphEditActions();updateCustomValues();const generation=editorLoadGeneration;
  try{const data=await api('custom-parameters',{revision:customSnapshot.revision,expectedPages:customSnapshot.expectedPages,...body});if(generation!==editorLoadGeneration)return false;customError='';receiveCustomParameters(data);return true;}
  catch(e){if(generation===editorLoadGeneration){customError=e.message;status(e.message,true);}return false;}
  finally{if(generation===editorLoadGeneration){customBusy=false;nativeMutationBusy=false;renderGraphEditActions();updateCustomValues();await refreshNativeSources();if(generation===editorLoadGeneration)scheduleGraphApply();}}
}
function customReady(){return customSnapshot?.enabled&&!customError&&!dirty&&!submitBusy&&!customBusy&&!editorMutationBlocked()&&customSnapshot.revision===revision;}
function customCurrent(name){return customSnapshot?.controls.find(g=>g.name===name);}
function updateCustomValues(){
  const ready=customReady(),box=$('#customcontrols');if(!box)return;
  $('#controlstatus').textContent=customError||(!customSnapshot?.enabled?t('sources.enable'):dirty||customSnapshot.revision!==revision?t('sources.pending'):t('controls.hint'));
  for(const card of box.querySelectorAll('[data-custom-control]')){
    const row=customCurrent(card.dataset.customControl);if(!row)continue;
    for(const entry of card.querySelectorAll('[data-control-field]')){
      const kind=entry.dataset.controlField,index=Number(entry.dataset.controlComponent),item=row.components[index];
      entry.disabled=!ready||(kind==='value'&&!item?.writable)||(kind==='style'&&!row.styleEditable);
      if(document.activeElement!==entry&&!entry.numericGestureActive){
        let value=kind==='value'?item.value:kind==='default'?item.default:kind==='style'?(row.style==='RGBA'?'rgba':'vec4'):row[kind];
        if(entry.setSyncedValue)entry.setSyncedValue(value);else entry.value=value;
        entry.customExpected=row.expected;entry.customExpectedValue=item?clone(item):null;
      }
    }
    for(const b of card.querySelectorAll('button'))b.disabled=!ready;
    card.querySelector('[data-custom-links]').textContent=row.sources.length?t('controls.linked').replace('{count}',row.sources.length):t('controls.unbound');
  }
  for(const element of $('#customcreate').querySelectorAll('input,select,button'))element.disabled=!ready||!customPage;
  $('#customnewpage').disabled=!ready;$('#custompageedit').disabled=!ready||!customPage;
}
function renderCustomParameters(){
  if(!customSnapshot){updateCustomValues();return;}
  const data=customSnapshot,box=$('#customcontrols');
  if(!data.pages.some(p=>p.name===customPage))customPage=data.pages[0]?.name||'';
  const pages=$('#custompage'),pageKey=JSON.stringify(data.pages.map(p=>p.name));
  if(pages.dataset.pages!==pageKey){pages.replaceChildren(...data.pages.map(p=>el('option',{value:p.name},p.name)));pages.dataset.pages=pageKey;}
  pages.value=customPage;
  const key=JSON.stringify([language,customPage,data.pages,data.controls.map(g=>[g.name,g.page,g.style,g.order,g.sources,g.components.map(p=>p.name)])]);
  if(box.dataset.structure===key||box.contains(document.activeElement)){updateCustomValues();return;}
  box.dataset.structure=key;box.replaceChildren();
  for(const row of data.controls.filter(g=>g.page===customPage)){
    const name=row.name,card=el('section',{class:'custom-control-card','data-custom-control':name});
    const heading=el('div',{class:'custom-control-heading'});heading.append(el('strong',{},name),el('small',{},row.style+(row.size>1?' '+row.size:'')));card.append(heading);
    function editField(kind,value,options=null){
      let entry;const commit=value=>customRequest({action:kind,name,[kind]:value,expected:entry.customExpected});
      entry=options?select(options,value,commit):input(value,commit);entry.dataset.controlField=kind;entry.customExpected=row.expected;return entry;
    }
    card.append(field(t('node.label'),editField('label',row.label)),field(t('controls.page'),editField('page',row.page,data.pages.map(p=>[p.name,p.name]))));
    if(row.size===4&&['Float','RGBA'].includes(row.style))card.append(field(t('controls.style'),editField('style',row.style==='RGBA'?'rgba':'vec4',[['vec4','Vector 4'],['rgba','RGBA']])));
    const values=el('div',{class:'custom-control-values'}),defaults=el('div',{class:'custom-control-values'});
    row.components.forEach((item,index)=>{
      for(const [kind,holder]of [['value',values],['default',defaults]]){
        let entry;entry=input(item[kind],value=>customRequest({action:kind,name,component:index,value,expected:entry.customExpected,expectedValue:entry.customExpectedValue}),typeof item[kind]==='number'?'number':'text');
        entry.dataset.controlField=kind;entry.dataset.controlComponent=index;entry.customExpected=row.expected;entry.customExpectedValue=clone(item);
        const label=row.size===1?t(kind==='value'?'controls.value':'controls.default'):row.style==='RGBA'?'RGBA'[index]:'XYZW'[index];entry.setAttribute('aria-label',name+' '+kind+' '+label);holder.append(field(label,entry));
      }
    });
    card.append(values);const details=el('details');details.append(el('summary',{},t('controls.defaults')),defaults);card.append(details);
    const actions=el('div',{class:'custom-control-actions'});
    for(const [direction,label]of [[-1,'↑'],[1,'↓']]){const b=el('button',{'aria-label':t(direction<0?'layout.moveUp':'layout.moveDown')+' '+name},label);b.onclick=()=>customRequest({action:'move',direction,name,expected:customCurrent(name).expected});actions.append(b);}
    if(row.sources.length){const b=el('button',{},t('controls.detach'));b.onclick=()=>customRequest({action:'detach',name,expected:customCurrent(name).expected});actions.append(b);}
    const remove=el('button',{},t('controls.remove'));remove.onclick=()=>{if(confirm(t('controls.removeConfirm').replace('{name}',customCurrent(name).label||name)))customRequest({action:'remove',name,expected:customCurrent(name).expected});};actions.append(remove);
    card.append(el('p',{class:'muted','data-custom-links':'true'}),actions);box.append(card);
  }
  if(!box.children.length)box.append(el('p',{class:'muted'},t('controls.empty')));
  updateCustomValues();
}
function customDialog(title){
  const dialog=$('#customdialog');dialog.replaceChildren();const head=el('div',{class:'custom-dialog-heading'}),close=el('button',{},t('action.close'));close.onclick=()=>dialog.close();head.append(el('strong',{},title),close);dialog.append(head);if(!dialog.open)dialog.showModal();return dialog;
}
function editCustomPage(create=false){
  if(!customReady())return;const dialog=customDialog(t(create?'controls.newPage':'controls.editPage')),page=customSnapshot.pages.find(p=>p.name===customPage),name=input(create?'':customPage,()=>{});
  dialog.append(field(t('controls.page'),name));
  const save=el('button',{},t('controls.save'));save.disabled=!create&&!page?.editable;save.onclick=async()=>{const label=name.value.trim();if(await customRequest({action:create?'page-create':'page-rename',page:customPage,name:label})){customPage=label;dialog.close();renderCustomParameters();}};dialog.append(save);
  if(!create){for(const [direction,label]of [[-1,'↑'],[1,'↓']]){const b=el('button',{'aria-label':t(direction<0?'layout.moveUp':'layout.moveDown')},label);b.disabled=!page.editable;b.onclick=async()=>{if(await customRequest({action:'page-move',page:customPage,direction}))dialog.close();};dialog.append(b);}
    const remove=el('button',{},t('controls.removePage'));remove.disabled=!page.editable||page.empty===false||customSnapshot.controls.some(c=>c.page===customPage);remove.onclick=async()=>{if(await customRequest({action:'page-remove',page:customPage}))dialog.close();};dialog.append(remove);}
}
async function openUniformControl(id){
  await refreshCustomParameters();await refreshNativeSources();
  if(!customReady()){status(customError||t('sources.pending'),true);return;}
  const existing=customSnapshot.controls.find(g=>g.sources.includes(id));
  if(existing){customPage=existing.page;workspaceLayout.reveal('controls');renderCustomParameters();return;}
  const row=nativeSourceRows().find(r=>r.id===id);if(!row||row.missing)return;
  const dialog=customDialog(t('controls.fromUniform')),page=select(customSnapshot.pages.map(p=>[p.name,p.name]),customPage,()=>{});
  dialog.append(el('p',{},row.name),field(t('controls.page'),page));
  const add=el('button',{class:'primary'},t('controls.add'));add.disabled=!customSnapshot.pages.length;add.onclick=async()=>{if(await customRequest({action:'bind',id,page:page.value,sourceExpected:row.expected})){customPage=page.value;dialog.close();workspaceLayout.reveal('controls');renderCustomParameters();}};
  const create=el('button',{},t('controls.newPage'));create.onclick=()=>editCustomPage(true);dialog.append(add,create);
}
function installCustomParameters(){
  $('#custompage').onchange=()=>{customPage=$('#custompage').value;renderCustomParameters();};
  $('#customnewpage').onclick=()=>editCustomPage(true);$('#custompageedit').onclick=()=>editCustomPage(false);
  $('#customcreate').onsubmit=async e=>{e.preventDefault();if(await customRequest({action:'create',name:$('#customname').value.trim(),style:$('#customstyle').value,page:customPage}))$('#customname').value='';};
  setInterval(refreshCustomParameters,1000);
}
