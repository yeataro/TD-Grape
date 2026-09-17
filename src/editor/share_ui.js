/* Local sharing: discovery is read-only; credentials remain in the URL fragment. */
let uiShareState={origins:[],selected:'',path:location.pathname,status:'',discovery:'',request:0};
function shareLoopback(origin){
  try{const host=new URL(origin).hostname;return host==='localhost'||host==='[::1]'||/^127\./.test(host);}catch{return false;}
}
function shareOrigin(value){
  try{const url=new URL(value);return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password&&url.pathname==='/'&&!url.search&&!url.hash?url.origin:'';}catch{return '';}
}
function shareLink(){
  const url=new URL(uiShareState.path,uiShareState.selected||location.origin);
  url.hash=token;return url.href;
}
function renderShareQR(url){
  const holder=$('#shareqr');if(holder.dataset.url===url&&holder.firstChild)return;
  holder.replaceChildren();delete holder.dataset.url;
  try{
    const code=qrcode(0,'M');code.addData(url,'Byte');code.make();
    const count=code.getModuleCount(),ns='http://www.w3.org/2000/svg';
    const svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox',`0 0 ${count+8} ${count+8}`);svg.setAttribute('role','img');svg.setAttribute('aria-label',t('share.qr'));svg.setAttribute('shape-rendering','crispEdges');
    const background=document.createElementNS(ns,'rect');background.setAttribute('width','100%');background.setAttribute('height','100%');background.setAttribute('fill','#fff');svg.append(background);
    const path=document.createElementNS(ns,'path');let cells='';
    for(let row=0;row<count;row++)for(let col=0;col<count;col++)if(code.isDark(row,col))cells+=`M${col+4} ${row+4}h1v1h-1z`;
    path.setAttribute('d',cells);path.setAttribute('fill','#111');svg.append(path);holder.append(svg);holder.dataset.url=url;
  }catch{uiShareState.status='share.qrUnavailable';}
}
function renderUIShare(){
  const panel=$('#sharepanel'),opener=$('#uishare');if(!panel||!opener)return;
  opener.title=t('share.title');opener.setAttribute('aria-expanded',String(panel.matches(':popover-open')));
  if(!uiShareState.origins.length)return;
  const select=$('#shareorigin'),items=uiShareState.origins;
  select.replaceChildren(...items.map(item=>el('option',{value:item.origin},item.origin+' · '+t('share.'+item.kind))));
  select.value=uiShareState.selected;
  const url=shareLink();$('#shareurl').value=url;renderShareQR(url);
  $('#shareqr svg')?.setAttribute('aria-label',t('share.qr'));
  const hint=shareLoopback(uiShareState.selected)?'share.localOnly':'share.ready';
  $('#sharehint').textContent=t(hint);
  $('#sharemessage').textContent=uiShareState.status?t(uiShareState.status):'';
  if(panel.matches(':popover-open'))positionAppearancePanel(panel,opener);
}
async function discoverShareLinks(){
  const request=++uiShareState.request,current=location.origin;
  // Show a working current-page link even if discovery is unavailable.
  uiShareState.origins=[{origin:current,kind:shareLoopback(current)?'local':'current'}];
  const previous=uiShareState.selected;uiShareState.selected=current;uiShareState.path=location.pathname;uiShareState.status='';uiShareState.discovery='';renderUIShare();
  try{
    const result=await api('share-links');if(request!==uiShareState.request)return;
    const items=uiShareState.origins,seen=new Set([current]);
    const transferable=!result.tokenRequired||!!token;
    for(const item of Array.isArray(result.origins)?result.origins:[]){
      const origin=shareOrigin(item?.origin);
      if(!origin||seen.has(origin)||!transferable||(item.kind==='lan'&&!result.lanEnabled))continue;
      seen.add(origin);items.push({origin,kind:shareLoopback(origin)?'local':item.kind==='lan'?'lan':'current'});
    }
    if(result.shaderPath==='/'||/^\/shader\/[a-f0-9]{32}\/$/.test(result.shaderPath||''))uiShareState.path=result.shaderPath;
    uiShareState.selected=seen.has(previous)?previous:shareLoopback(current)?(items.find(item=>item.kind==='lan')?.origin||current):current;
    if(!transferable)uiShareState.discovery='share.tokenMissing';
  }catch{if(request!==uiShareState.request)return;uiShareState.discovery='share.currentOnly';}
  uiShareState.status=uiShareState.discovery;renderUIShare();
}
async function copyShareLink(){
  const field=$('#shareurl'),url=field.value;let copied=false;
  try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(url);copied=true;}}catch{}
  // HTTP LAN pages may not have the async Clipboard API.
  if(!copied){field.focus({preventScroll:true});field.select();try{copied=document.execCommand('copy');}catch{}}
  uiShareState.status=copied?'share.copied':'share.copyManual';
  $('#sharemessage').textContent=t(uiShareState.status);
  if(!copied){field.focus({preventScroll:true});field.select();}
}
function installUIShare(){
  const panel=$('#sharepanel'),opener=$('#uishare');
  const position=()=>positionAppearancePanel(panel,opener);
  panel.addEventListener('beforetoggle',event=>{if(event.newState==='open'){position();discoverShareLinks();}else uiShareState.request++;});
  panel.addEventListener('toggle',()=>{opener.setAttribute('aria-expanded',String(panel.matches(':popover-open')));if(panel.matches(':popover-open'))position();});
  opener.onclick=event=>{if(event.detail===0)requestAnimationFrame(()=>{if(panel.matches(':popover-open'))$('#shareorigin').focus({preventScroll:true});});};
  $('#shareorigin').onchange=event=>{uiShareState.selected=event.target.value;uiShareState.status=uiShareState.discovery;renderUIShare();};
  $('#sharecopy').onclick=copyShareLink;
  panel.addEventListener('keydown',event=>{event.stopPropagation();if(event.key==='Escape'){event.preventDefault();panel.hidePopover();opener.focus({preventScroll:true});}});
  window.addEventListener('resize',()=>{if(panel.matches(':popover-open'))position();});
  renderUIShare();
}
