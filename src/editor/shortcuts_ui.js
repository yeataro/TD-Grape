/* Existing commands share their displayed shortcuts across help and buttons.
 * Dispatch remains with the graph/field handlers that own each interaction. */
const EDITOR_SHORTCUTS=Object.freeze({
  undo:{label:'action.undo',keys:['Mod+Z'],section:'edit'},
  redo:{label:'action.redo',keys:['Mod+Shift+Z'],section:'edit'},
  copy:{label:'edit.copy',keys:['Mod+C'],section:'edit'},
  paste:{label:'edit.paste',keys:['Mod+V'],section:'edit'},
  duplicate:{label:'edit.duplicate',keys:['Mod+D'],section:'edit'},
  delete:{label:'node.delete',keys:['Delete','Backspace'],section:'edit'},
  selectAll:{label:'shortcuts.selectAll',keys:['Mod+A'],section:'edit'},
  selectLinked:{label:'selection.linked',keys:['Mod+ArrowUp'],section:'edit'},
  selectUpstream:{label:'selection.upstream',keys:['Mod+ArrowLeft'],section:'edit'},
  selectDownstream:{label:'selection.downstream',keys:['Mod+ArrowRight'],section:'edit'},
  selectUnlinked:{label:'selection.unlinked',keys:['Mod+ArrowDown'],section:'edit'},
  groupFrame:{label:'frame.create',keys:['Mod+G'],section:'edit'},
  joinFrame:{label:'frame.join',keys:['Alt+Shift+G'],section:'edit'},
  detachFrame:{label:'frame.detach',keys:['Alt+G'],section:'edit'},
  group:{label:'function.group',keys:['Mod+Shift+G'],section:'edit'},
  autoArrange:{label:'arrange.auto',keys:['L'],section:'edit'},
  autoArrangeReverse:{label:'arrange.autoReverse',keys:['Shift+L'],section:'edit'},
  add:{label:'action.nodes',keys:['Tab'],section:'navigation'},
  toggleLinkLines:{label:'view.showLinkLines',hint:'view.showLinkLines.hint',keys:['X'],section:'navigation'},
  fit:{label:'action.fit',hint:'action.fit.hint',keys:['H'],section:'navigation'},
  fitSelection:{label:'action.fitSelection',hint:'action.fitSelection.hint',keys:['F'],section:'navigation'},
  fullscreen:{label:'view.fullscreen',keys:['Alt+Enter'],section:'navigation'},
  focusGraph:{label:'view.graphFocus',hint:'view.graphFocusShortcut',keys:['Mod+Enter'],section:'navigation'},
  up:{label:'navigation.up',keys:['Alt+ArrowUp'],section:'navigation'},
  arrowPath:{label:'navigation.arrowPath',keys:['ArrowLeft','ArrowRight'],section:'navigation'},
  arrowBranch:{label:'navigation.arrowBranch',keys:['ArrowUp','ArrowDown'],section:'navigation'},
  menu:{label:'edit.menu',keys:['Shift+F10','ContextMenu'],section:'navigation'},
  cancel:{label:'shortcuts.cancel',keys:['Escape'],section:'navigation'},
  valueApply:{label:'shortcuts.valueApply',keys:['Enter'],section:'values'},
  valueCancel:{label:'shortcuts.valueCancel',keys:['Escape'],section:'values'},
  textApply:{label:'shortcuts.textApply',keys:['Mod+Enter'],section:'values'}
});
function shortcutKeyParts(key){
  return key.split('+').map(part=>part==='Mod'?shortcutModifierLabel():({ArrowUp:'↑',ArrowDown:'↓',ArrowLeft:'←',ArrowRight:'→'})[part]|| (part==='Escape'?'Esc':part==='ContextMenu'?t('shortcuts.contextKey'):part));
}
function shortcutLabel(action){return EDITOR_SHORTCUTS[action]?.keys.map(key=>shortcutKeyParts(key).join('＋')).join(' / ')||'';}
function decorateShortcutButton(button,action,labelKey){
  const command=EDITOR_SHORTCUTS[action];if(!button||!command)return;
  const label=t(labelKey||command.hint||command.label)+(button.dataset.shortcutContext?' · '+button.dataset.shortcutContext:''),hint=label+'　'+shortcutLabel(action);
  button.title=hint;button.setAttribute('aria-label',hint);button.dataset.shortcutAction=action;
  if(labelKey)button.dataset.shortcutLabel=labelKey;else delete button.dataset.shortcutLabel;
  button.setAttribute('aria-keyshortcuts',command.keys.flatMap(key=>key.includes('Mod')?[key.replace('Mod','Control'),key.replace('Mod','Meta')]:[key]).join(' '));
}
function renderShortcutButtonHints(){
  for(const [id,action]of Object.entries({undo:'undo',redo:'redo',graphcopy:'copy',graphpaste:'paste',graphgroup:'group',graphdelete:'delete',fit:'fit',graphfitselection:'fitSelection',graphup:'up',group:'group'})){
    const label=id==='graphdelete'&&typeof selectedEdge!=='undefined'&&selectedEdge!==null?'wire.disconnectSelected':undefined;
    decorateShortcutButton(document.getElementById(id),action,label);
  }
  document.querySelectorAll('[data-shortcut-action]').forEach(button=>decorateShortcutButton(button,button.dataset.shortcutAction,button.dataset.shortcutLabel));
}
function renderShortcutHelp(){
  const panel=document.getElementById('shortcutspanel'),opener=document.getElementById('uishortcuts');if(!panel||!opener)return;
  opener.title=t('shortcuts.title');opener.setAttribute('aria-label',t('shortcuts.title'));opener.setAttribute('aria-expanded',String(panel.open));
  document.getElementById('shortcutsclose').title=t('action.close')+'　Esc';
  const contents=document.getElementById('shortcutslist');contents.replaceChildren();
  const columns=[el('div',{class:'shortcuts-column'}),el('div',{class:'shortcuts-column'})];contents.append(...columns);
  for(const section of ['edit','navigation','values']){
    const group=el('section',{class:'shortcuts-section'}),heading=el('h3',{id:'shortcuts-'+section},t('shortcuts.section.'+section)),list=el('dl',{class:'shortcuts-commands'});
    group.setAttribute('aria-labelledby',heading.id);
    for(const [action,command]of Object.entries(EDITOR_SHORTCUTS)){
      if(command.section!==section)continue;
      const row=el('div',{class:'shortcuts-row','data-shortcut':action}),keys=el('dd');
      command.keys.forEach((key,index)=>{if(index)keys.append(el('span',{class:'shortcuts-or'},'/'));const chord=el('span',{class:'shortcuts-chord'});shortcutKeyParts(key).forEach(part=>chord.append(el('kbd',{},part)));keys.append(chord);});
      const spatialLabel=EDITOR_DEV_SETTINGS.arrowNavigationMode==='spatial'&&({arrowPath:'navigation.arrowHorizontalSpatial',arrowBranch:'navigation.arrowVerticalSpatial'})[action];
      const adjacentLabel=EDITOR_DEV_SETTINGS.ctrlArrowAdjacent&&({selectUpstream:'selection.upstreamAdjacent',selectDownstream:'selection.downstreamAdjacent'})[action];
      row.append(el('dt',{},t(spatialLabel||adjacentLabel||command.hint||command.label)),keys);list.append(row);
    }
    group.append(heading,list);columns[section==='edit'?0:1].append(group);
  }
  renderShortcutButtonHints();
}
function installShortcutHelp(){
  const panel=document.getElementById('shortcutspanel'),opener=document.getElementById('uishortcuts');
  opener.onclick=()=>{
    for(const popover of document.querySelectorAll('[popover]:popover-open'))popover.hidePopover();
    renderShortcutHelp();panel.showModal();opener.setAttribute('aria-expanded','true');
  };
  document.getElementById('shortcutsclose').onclick=()=>panel.close();
  panel.addEventListener('close',()=>{opener.setAttribute('aria-expanded','false');opener.focus({preventScroll:true});});
  // Help never dispatches graph editing keys; the dialog keeps Tab navigation.
  panel.addEventListener('keydown',event=>{event.stopPropagation();if(event.key==='Tab'){event.preventDefault();document.getElementById('shortcutsclose').focus({preventScroll:true});}});
  const outside=event=>{const r=panel.getBoundingClientRect();return event.target===panel&&(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom);};
  let backdropPressed=false;
  panel.addEventListener('pointerdown',event=>{backdropPressed=event.button===0&&outside(event);});
  panel.addEventListener('pointercancel',()=>{backdropPressed=false;});
  panel.addEventListener('click',event=>{if(backdropPressed&&outside(event))panel.close();backdropPressed=false;});
  renderShortcutHelp();
}
