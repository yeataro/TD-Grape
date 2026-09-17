/* Keep native select values and change handlers; render their popup outside graph zoom. */
function installSelectMenus(){
  if(installSelectMenus.installed||!HTMLElement.prototype.showPopover)return;
  installSelectMenus.installed=true;
  let active=null,pointerClick=null;
  const eligible=entry=>entry instanceof HTMLSelectElement&&!entry.multiple&&entry.size<=1&&!entry.matches(':disabled')&&entry.isConnected&&entry.getClientRects().length>0;
  const optionDisabled=option=>option.disabled||!!option.closest('optgroup:disabled');
  const rectChanged=(a,b)=>['left','top','width','height'].some(key=>Math.abs(a[key]-b[key])>.25);

  function open(entry,key=''){
    active?.close(false);
    entry.focus({preventScroll:true});
    if(!eligible(entry))return;
    const options=[...entry.options],initialIndex=entry.selectedIndex,anchor=entry.getBoundingClientRect();
    const popup=document.createElement('div');popup.id='selectmenu';popup.className='popup-menu';popup.popover='auto';popup.setAttribute('role','listbox');popup.tabIndex=-1;
    popup.dataset.align=entry.matches('.node-primary-selector')||entry.closest('.node-title')?'right':'left';
    const labelledBy=entry.getAttribute('aria-labelledby');
    if(labelledBy)popup.setAttribute('aria-labelledby',labelledBy);
    else popup.setAttribute('aria-label',entry.getAttribute('aria-label')||entry.labels?.[0]?.textContent.trim()||entry.title||entry.name||entry.selectedOptions[0]?.label||'');
    const controller=new AbortController(),listeners={signal:controller.signal};
    const oldAria=new Map(['aria-expanded','aria-controls','aria-haspopup'].map(name=>[name,entry.getAttribute(name)]));
    entry.setAttribute('aria-expanded','true');entry.setAttribute('aria-controls',popup.id);entry.setAttribute('aria-haspopup','listbox');
    let closed=false,buttons=[],search='',searchAt=0,observer=null,resizeObserver=null;
    const current=()=>eligible(entry)&&entry.selectedIndex===initialIndex&&options.length===entry.options.length&&options.every((option,index)=>entry.options[index]===option);

    function close(focus=false,hide=true){
      if(closed)return;closed=true;controller.abort();observer?.disconnect();resizeObserver?.disconnect();
      if(active?.entry===entry)active=null;
      for(const [name,value]of oldAria){if(value===null)entry.removeAttribute(name);else entry.setAttribute(name,value);}
      if(hide&&popup.matches(':popover-open'))popup.hidePopover();popup.remove();
      if(focus&&eligible(entry))entry.focus({preventScroll:true});
    }
    function choose(index){
      if(!current()||optionDisabled(options[index])){close(false);return;}
      const changed=index!==entry.selectedIndex;close(true);
      if(!changed||!eligible(entry))return;
      entry.selectedIndex=index;
      entry.dispatchEvent(new Event('input',{bubbles:true,composed:true}));
      entry.dispatchEvent(new Event('change',{bubbles:true}));
    }
    function appendOption(option,parent){
      if(option.hidden)return;
      const index=options.indexOf(option),button=document.createElement('button');
      button.type='button';button.setAttribute('role','option');button.setAttribute('aria-selected',String(index===initialIndex));button.tabIndex=-1;
      button.dataset.selectIndex=String(index);button.dataset.selectValue=option.value;button.textContent=option.label;button.disabled=optionDisabled(option);
      if(option.title)button.title=option.title;
      button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();choose(index);},listeners);
      button.addEventListener('pointerenter',event=>{if(event.pointerType==='mouse'&&!button.disabled)button.focus({preventScroll:true});},listeners);
      parent.append(button);if(!button.disabled)buttons.push(button);
    }
    for(const child of entry.children){
      if(child instanceof HTMLOptionElement)appendOption(child,popup);
      else if(child instanceof HTMLOptGroupElement&&!child.hidden){
        const group=document.createElement('div');group.className='select-group';group.setAttribute('role','group');group.setAttribute('aria-label',child.label);
        const heading=document.createElement('div');heading.className='select-group-label';heading.setAttribute('aria-hidden','true');heading.textContent=child.label;group.append(heading);
        for(const option of child.children)if(option instanceof HTMLOptionElement)appendOption(option,group);
        popup.append(group);
      }
    }
    const host=entry.closest('[popover]:popover-open,dialog[open]')||document.body;
    host.append(popup);popup.showPopover();
    const zoom=uiScaleFactor(),margin=8,viewportWidth=innerWidth/zoom,viewportHeight=innerHeight/zoom;
    popup.style.position='fixed';popup.style.margin='0';popup.style.inset='auto';popup.style.maxWidth=Math.max(0,viewportWidth-margin*2)+'px';
    const below=viewportHeight-anchor.bottom/zoom-margin-4,above=anchor.top/zoom-margin-4;
    const upward=popup.scrollHeight>below&&above>below;
    popup.style.maxHeight=Math.max(0,upward?above:below)+'px';
    const left=popup.dataset.align==='right'?anchor.right/zoom-popup.offsetWidth:anchor.left/zoom;
    popup.style.left=Math.max(margin,Math.min(left,viewportWidth-popup.offsetWidth-margin))+'px';
    popup.style.top=Math.max(margin,Math.min(upward?anchor.top/zoom-popup.offsetHeight-4:anchor.bottom/zoom+4,viewportHeight-popup.offsetHeight-margin))+'px';

    function focusButton(button){
      if(!button)return;button.focus({preventScroll:true});button.scrollIntoView({block:'nearest'});
    }
    function typeahead(character){
      const now=performance.now();search=now-searchAt<700?search+character:character;searchAt=now;
      if([...search].every(letter=>letter===search[0]))search=search[0];
      const at=buttons.indexOf(document.activeElement),start=search.length===1?at+1:Math.max(0,at);
      const match=Array.from({length:buttons.length},(_,index)=>buttons[(start+index)%buttons.length]).find(button=>button.textContent.trim().toLocaleLowerCase().startsWith(search));
      focusButton(match);
    }
    function onKey(event){
      event.stopPropagation();
      if(event.isComposing)return;
      const index=buttons.indexOf(document.activeElement);
      if(event.key==='Escape'){event.preventDefault();close(true);}
      else if(event.key==='Tab')close(true);
      else if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
        event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:Math.max(0,Math.min(buttons.length-1,index+(event.key==='ArrowDown'?1:-1)));focusButton(buttons[next]);
      }else if(event.key==='Enter'||event.key===' '){event.preventDefault();if(index>=0)choose(Number(buttons[index].dataset.selectIndex));}
      else if(event.key.length===1&&!event.ctrlKey&&!event.metaKey&&!event.altKey){event.preventDefault();typeahead(event.key.toLocaleLowerCase());}
    }
    active={entry,popup,close,onKey};
    popup.addEventListener('pointerdown',event=>event.stopPropagation(),listeners);
    popup.addEventListener('beforetoggle',event=>{if(event.newState==='closed')close(false,false);},listeners);
    document.addEventListener('pointerdown',event=>{if(event.target!==entry&&!popup.contains(event.target))close(false);},{...listeners,capture:true});
    document.addEventListener('focusin',event=>{if(event.target!==entry&&!popup.contains(event.target))close(false);},listeners);
    document.addEventListener('scroll',event=>{if(!popup.contains(event.target))close(false);},{...listeners,capture:true});
    window.addEventListener('resize',()=>close(false),listeners);
    window.addEventListener('blur',event=>{if(event.target===window)close(false);},listeners);
    const check=()=>{if(!current()||rectChanged(anchor,entry.getBoundingClientRect()))close(false);};
    observer=new MutationObserver(records=>{
      if(records.some(record=>record.target===entry||entry.contains(record.target))){close(false);return;}check();
    });
    observer.observe(entry,{attributes:true,childList:true,subtree:true,characterData:true});
    for(let parent=entry.parentElement;parent;parent=parent.parentElement)observer.observe(parent,{childList:true,attributes:true,attributeFilter:['style','class','hidden','open','disabled']});
    resizeObserver=new ResizeObserver(check);resizeObserver.observe(entry);
    const selected=buttons.find(button=>Number(button.dataset.selectIndex)===initialIndex);
    focusButton(key==='Home'?buttons[0]:key==='End'?buttons.at(-1):selected||buttons[0]);
    if(!buttons.length)popup.focus({preventScroll:true});
    if(key.length===1&&key!==' ')typeahead(key.toLocaleLowerCase());
  }

  document.addEventListener('pointerdown',event=>{
    if(!event.isTrusted)return;pointerClick=null;
    const entry=event.target.closest?.('select');if(event.button!==0||!eligible(entry))return;
    // The numeric preset menu consumes its first outside click to keep a draft.
    // Its transient capture listener runs after this delegated one.
    if(typeof numericPresetMenu!=='undefined'&&numericPresetMenu){pointerClick={entry,skip:true};return;}
    if(typeof valueLadder!=='undefined')valueLadder?.cancel();
    if(typeof pendingValueLadder!=='undefined')pendingValueLadder?.cancel();
    event.preventDefault();event.stopPropagation();
    const skip=active?.entry===entry;pointerClick={entry,skip};
    if(skip)active.close(true);else {active?.close(false);entry.focus({preventScroll:true});}
  },true);
  document.addEventListener('click',event=>{
    if(!event.isTrusted)return;
    const entry=event.target.closest?.('select');if(!eligible(entry))return;
    event.preventDefault();event.stopPropagation();
    // Open after pointerup: an auto popover opened during pointerdown would be
    // light-dismissed by that same pointer sequence before its click arrives.
    if(pointerClick?.entry===entry){const skip=pointerClick.skip;pointerClick=null;if(skip)return;}
    if(active?.entry!==entry)open(entry);
  },true);
  document.addEventListener('keydown',event=>{
    if(!event.isTrusted)return;pointerClick=null;
    if(active&&(event.target===active.entry||active.popup.contains(event.target))){active.onKey(event);return;}
    const entry=event.target.closest?.('select');if(!eligible(entry)||event.isComposing||event.ctrlKey||event.metaKey)return;
    const key=event.key,opens=['ArrowDown','ArrowUp','Enter',' ','Home','End','F4'].includes(key)||key.length===1&&!event.altKey;
    if(!opens)return;event.preventDefault();event.stopPropagation();open(entry,key);
  },true);
}
