/* PNG exchange: bounded, uncompressed UTF-8 iTXt; no image or text decompression. */
const PngGraph=(()=>{
  const signature=[137,80,78,71,13,10,26,10],keyword='TD-Sgrape' /* Stable PNG metadata key: keep legacy exports importable. */,maxFile=16*1024*1024,maxGraph=512000;
  let crcTable;
  const fail=code=>{throw Error(code);};
  function crc(bytes){
    if(!crcTable)crcTable=Uint32Array.from({length:256},(_,i)=>{for(let n=0;n<8;n++)i=i&1?0xedb88320^(i>>>1):i>>>1;return i>>>0;});
    let value=0xffffffff;for(const byte of bytes)value=crcTable[(value^byte)&255]^(value>>>8);return (value^0xffffffff)>>>0;
  }
  function isPng(bytes){return bytes.length>=8&&signature.every((b,i)=>bytes[i]===b);}
  function chunks(input){
    const bytes=new Uint8Array(input);if(bytes.length>maxFile)fail('png.fileSize');if(!isPng(bytes))fail('png.invalid');
    const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),list=[];let offset=8,header=false,data=false,end=false,dataEnded=false;
    while(offset<bytes.length){
      if(list.length>=65536||offset+12>bytes.length)fail('png.invalid');
      const length=view.getUint32(offset),next=offset+12+length;
      if(length>0x7fffffff||next>bytes.length)fail('png.invalid');
      const type=String.fromCharCode(...bytes.subarray(offset+4,offset+8));
      if(!/^[A-Za-z]{2}[A-Z][A-Za-z]$/.test(type))fail('png.invalid');
      if(crc(bytes.subarray(offset+4,next-4))!==view.getUint32(next-4))fail('png.corrupt');
      if(!header&&type!=='IHDR')fail('png.invalid');
      if(type==='IHDR'){
        if(header||length!==13)fail('png.invalid');header=true;
        const w=view.getUint32(offset+8),h=view.getUint32(offset+12);
        if(!w||!h||w>0x7fffffff||h>0x7fffffff)fail('png.invalid');
      }
      if(type==='IDAT'){if(dataEnded)fail('png.invalid');data=true;}else if(data)dataEnded=true;
      if(type==='IEND'){if(length||!data||next!==bytes.length)fail('png.invalid');end=true;}
      const content=bytes.subarray(offset+8,next-4);list.push({type,content,start:offset,end:next});offset=next;
    }
    if(!header||!data||!end)fail('png.invalid');return {bytes,list};
  }
  function owned(chunk){
    if(!['iTXt','tEXt','zTXt'].includes(chunk.type))return false;
    const zero=chunk.content.indexOf(0);return zero===keyword.length&&String.fromCharCode(...chunk.content.subarray(0,zero))===keyword;
  }
  function extract(input){
    const {list}=chunks(input),found=list.filter(owned);if(!found.length)fail('png.missing');if(found.length!==1)fail('png.duplicate');
    const {type,content}=found[0];let offset=keyword.length+1;
    if(type!=='iTXt')fail('png.unsupported');
    if(content.length<offset+4)fail('png.invalid');
    if(content[offset]!==0)fail('png.compressed');offset+=2;
    for(let i=0;i<2;i++){const zero=content.indexOf(0,offset);if(zero<0)fail('png.invalid');offset=zero+1;}
    const text=content.subarray(offset);if(text.length>maxGraph+8192)fail('graph.size');
    let raw,envelope;
    try{raw=new TextDecoder('utf-8',{fatal:true}).decode(text);envelope=JSON.parse(raw);}catch{fail('png.invalidMetadata');}
    if(envelope?.format!=='td-sgrape.graph-png'||envelope.version!==1)fail('png.version');
    if(!envelope.graph||typeof envelope.graph!=='object'||Array.isArray(envelope.graph))fail('png.invalidMetadata');
    const graphText=JSON.stringify(envelope.graph);if(new TextEncoder().encode(graphText).length>maxGraph)fail('graph.size');
    return {raw:graphText,view:envelope.view};
  }
  function attach(input,graph,view){
    const parsed=chunks(input),encoder=new TextEncoder(),raw=JSON.stringify(graph);
    if(!raw||encoder.encode(raw).length>maxGraph)fail('graph.size');
    const text=encoder.encode(JSON.stringify({format:'td-sgrape.graph-png',version:1,graph,view}));if(text.length>maxGraph+8192)fail('graph.size');
    const key=encoder.encode(keyword),content=new Uint8Array(key.length+5+text.length);content.set(key);content.set(text,key.length+5);
    const chunk=new Uint8Array(content.length+12),dv=new DataView(chunk.buffer);dv.setUint32(0,content.length);chunk.set([105,84,88,116],4);chunk.set(content,8);dv.setUint32(chunk.length-4,crc(chunk.subarray(4,chunk.length-4)));
    const parts=[parsed.bytes.subarray(0,8)];for(const item of parsed.list){if(item.type==='IEND')parts.push(chunk);if(!owned(item))parts.push(parsed.bytes.subarray(item.start,item.end));}
    const length=parts.reduce((n,p)=>n+p.length,0);if(length>maxFile)fail('png.fileSize');
    const result=new Uint8Array(length);let offset=0;for(const part of parts){result.set(part,offset);offset+=part.length;}return result;
  }
  return {isPng,extract,attach,maxFile,maxGraph};
})();

let exportRequest=0,exportBusy=false;
function closeExport(){exportRequest++;exportBusy=false;$('#exportdialog').close();}
function openExport(){
  if(typeof savedStateIssue!=='undefined'&&savedStateIssue)return;
  if(!graph)return;
  exportRequest++;exportBusy=false;$('#exportjsondownload').disabled=$('#exportjson').disabled=false;$('#exportpng').disabled=false;$('#exportstatus').textContent='';
  $('#exportview').textContent=[stage==='pixel'?'Pixel':'Vertex',...graphTrail.map(id=>FunctionModel.find(graph,id)?.name||'?')].join(' / ');
  $('#exportdialog').showModal();
}
function graphPngCanvas(){
  const snapshot=clone(graph),view={stage,functionIds:[...graphTrail]},styles=getComputedStyle(document.documentElement),font=styles.fontFamily;
  const color=(name,fallback)=>styles.getPropertyValue(name).trim()||fallback;
  const nodes=current().nodes.map(n=>{
    const card=$('#cards').querySelector(`[data-node="${CSS.escape(n.id)}"]`),title=card?.querySelector('.node-title');
    if(!card||!title)throw Error('png.layout');
    const x=n.ui.x,y=n.ui.y,width=card.offsetWidth,height=card.offsetHeight;
    if(![x,y,width,height].every(Number.isFinite)||!width||!height)throw Error('png.layout');
    return {x,y,width,height,title:nodeTypeLabel(definition(n),n.params),type:title.querySelector('small')?.textContent||'',header:title.offsetHeight,bg:getComputedStyle(card).backgroundColor,headbg:getComputedStyle(title).backgroundColor,
      ports:[...card.querySelectorAll('.port-row')].map(row=>{
        const socket=row.querySelector('.port'),p=point(n,socket.dataset.port,socket.dataset.kind);if(!p)throw Error('png.layout');
        return {x:p.x,y:p.y,output:socket.dataset.kind==='outputs',label:row.querySelector('span').textContent,type:socket.dataset.type,color:getComputedStyle(row).getPropertyValue('--socket').trim()};
      }),
      extras:[...card.querySelectorAll('.node-value,.expose-badge')].map(e=>({text:e.textContent,y:y+e.offsetTop+e.offsetHeight/2,color:getComputedStyle(e).color}))};
  });
  const edges=current().edges.map(edge=>{
    const a=current().nodes.find(n=>n.id===edge.from[0]),b=current().nodes.find(n=>n.id===edge.to[0]);if(!a||!b)return null;
    const p=point(a,edge.from[1],'outputs'),q=point(b,edge.to[1],'inputs');if(!p||!q)return null;
    return {p:{x:p.x,y:p.y},q:{x:q.x,y:q.y},dx:Math.max(70,Math.abs(q.x-p.x)*.5),color:color('--type-'+ports(a,'outputs')[edge.from[1]],color('--purple','#b39cfb'))};
  }).filter(Boolean);
  let minX=0,minY=0,maxX=400,maxY=100;
  if(nodes.length){minX=Math.min(...nodes.map(n=>n.x));minY=Math.min(...nodes.map(n=>n.y));maxX=Math.max(...nodes.map(n=>n.x+n.width));maxY=Math.max(...nodes.map(n=>n.y+n.height));}
  for(const e of edges){minX=Math.min(minX,e.q.x-e.dx);maxX=Math.max(maxX,e.p.x+e.dx);}
  minX-=32;minY-=28;maxX+=32;maxY+=28;
  const w=maxX-minX,h=maxY-minY,ratio=Math.min(1.5,4096/w,3992/h);
  if(!Number.isFinite(ratio)||ratio<=0)throw Error('png.layout');
  const canvas=document.createElement('canvas');canvas.width=Math.max(640,Math.ceil(w*ratio));canvas.height=Math.max(240,Math.ceil(h*ratio)+104);
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('png.encode');
  const text=(value,x,y,max,fontSize=12,fill='#ded8ee',align='left')=>{
    ctx.font=fontSize+'px '+font;ctx.fillStyle=fill;ctx.textAlign=align;ctx.textBaseline='middle';
    let label=String(value);if(ctx.measureText(label).width>max){while(label&&ctx.measureText(label+'…').width>max)label=label.slice(0,-1);label+='…';}ctx.fillText(label,x,y);
  };
  ctx.fillStyle=color('--export-background','#14141c');ctx.fillRect(0,0,canvas.width,canvas.height);
  text('TD-Grape · Grape '+editorTarget.toUpperCase(),24,24,canvas.width-48,17);
  text([stage==='pixel'?'Pixel':'Vertex',...graphTrail.map(id=>FunctionModel.find(snapshot,id)?.name||'?')].join(' / '),24,47,canvas.width-48,11,color('--muted','#9390a5'));
  ctx.save();ctx.translate((canvas.width-w*ratio)/2-minX*ratio,68-minY*ratio);ctx.scale(ratio,ratio);
  for(const e of edges){ctx.beginPath();ctx.moveTo(e.p.x,e.p.y);ctx.bezierCurveTo(e.p.x+e.dx,e.p.y,e.q.x-e.dx,e.q.y,e.q.x,e.q.y);ctx.lineWidth=2.5;ctx.strokeStyle=e.color;ctx.stroke();}
  for(const n of nodes){
    ctx.save();ctx.beginPath();ctx.roundRect(n.x,n.y,n.width,n.height,9);ctx.clip();ctx.fillStyle=n.bg;ctx.fillRect(n.x,n.y,n.width,n.height);ctx.fillStyle=n.headbg;ctx.fillRect(n.x,n.y,n.width,n.header);ctx.restore();
    ctx.beginPath();ctx.roundRect(n.x,n.y,n.width,n.height,9);ctx.lineWidth=1;ctx.strokeStyle=color('--export-node-border','#484253');ctx.stroke();
    text(n.title,n.x+13,n.y+n.header/2,n.width-26-(n.type?37:0),12);if(n.type)text(n.type,n.x+n.width-12,n.y+n.header/2,35,9,color('--muted','#9390a5'),'right');
    for(const p of n.ports){
      ctx.beginPath();ctx.arc(p.x,p.y,5,0,Math.PI*2);ctx.fillStyle=p.output?p.color:n.bg;ctx.fill();ctx.lineWidth=2;ctx.strokeStyle=p.color;ctx.stroke();
      text(p.type,n.x+n.width-13,p.y,43,9,p.color,'right');
      text(p.label,p.output?n.x+n.width-58:n.x+13,p.y,n.width-76,11,'#b9b4c9',p.output?'right':'left');
    }
    for(const extra of n.extras)text(extra.text,n.x+13,extra.y,n.width-26,10,extra.color);
  }
  if(!nodes.length)text(t('png.empty'),minX+32,minY+50,350,13,color('--muted','#9390a5'));
  ctx.restore();text(t('png.footer'),24,canvas.height-18,canvas.width-48,11,color('--muted','#9390a5'));
  return {canvas,snapshot,view,reduced:ratio<1};
}
async function exportPng(){
  if(exportBusy||!graph)return;const request=++exportRequest;exportBusy=true;$('#exportpng').disabled=true;$('#exportjsondownload').disabled=$('#exportjson').disabled=true;
  try{
    const {canvas,snapshot,view,reduced}=graphPngCanvas();$('#exportstatus').textContent=t(reduced?'png.reduced':'png.encoding');
    const raw=await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('png.encode')),'image/png'));
    const bytes=PngGraph.attach(new Uint8Array(await raw.arrayBuffer()),snapshot,view);if(request!==exportRequest)return;
    const blob=new Blob([bytes],{type:'image/png'}),url=URL.createObjectURL(blob),name='Grape-'+(snapshot.target||'mat').toUpperCase()+'-'+view.stage+'.png';
    el('a',{href:url,download:name}).click();setTimeout(()=>URL.revokeObjectURL(url),1000);closeExport();status(t('png.saved'));
  }catch(e){if(request===exportRequest)$('#exportstatus').textContent=t(e.message)===e.message?t('png.encode'):t(e.message);}
  finally{if(request===exportRequest){exportBusy=false;$('#exportpng').disabled=false;$('#exportjsondownload').disabled=$('#exportjson').disabled=false;}}
}
async function exportJson(){
  if(exportBusy||!graph)return;exportBusy=true;$('#exportpng').disabled=true;$('#exportjsondownload').disabled=$('#exportjson').disabled=true;const request=++exportRequest;
  try{const result=await api('export',{graph});if(request===exportRequest){closeExport();status(t('export.saved')+result.path);}}
  catch(e){if(request===exportRequest)$('#exportstatus').textContent=t('export.failed')+e.message;}
  finally{if(request===exportRequest){exportBusy=false;$('#exportpng').disabled=false;$('#exportjsondownload').disabled=$('#exportjson').disabled=false;}}
}

let importReview=null,importRequest=0;
function closeImportReview(){
  importRequest++;importReview=null;
  if($('#importreview').open)$('#importreview').close();
}
function renderImportReview(){
  const review=importReview;if(!review)return;
  $('#importfilename').textContent=review.name;
  $('#importraw').textContent=review.raw||'';
  $('#importstatus').textContent=review.message||t('import.'+review.status);
  $('#importaccept').textContent=t(review.status==='repairable'?'import.acceptRepair':'import.accept');
  $('#importaccept').disabled=!review.candidate||readonly;
  $('#importdownload').disabled=review.raw===undefined&&!(review.file instanceof Blob);
  $('#importrawtitle').textContent=t(review.isPng?'png.metadata':'import.original');
  const list=$('#importissues');list.replaceChildren();
  for(const item of (review.issues||[]))list.append(el('li',{},item.code==='archive'?t('import.archive'):item.message));
  const repairs=review.repairs||[];
  for(const item of repairs.slice(0,40)){
    let detail=[item.path,item.node].filter(Boolean).join(' · ');
    if(item.edge)detail+=' · '+item.edge.from.join('.')+' → '+item.edge.to.join('.');
    list.append(el('li',{},t('import.repair.'+item.code)+' · '+detail));
  }
  if(repairs.length>40)list.append(el('li',{},t('import.more').replace('{count}',repairs.length-40)));
  $('#importproposal').hidden=!repairs.length||!review.candidate;
  $('#importcandidate').textContent=review.candidate?JSON.stringify(review.candidate,null,2):'';
}
async function reviewImportFile(file){
  const request=++importRequest;
  importReview={name:file.name,file,baseGraph:JSON.stringify(graph),target:editorTarget,status:'checking'};
  renderImportReview();if(!$('#importreview').open)$('#importreview').showModal();
  try{
    if(file.size>PngGraph.maxFile)throw Error(t('png.fileSize'));
    const head=file instanceof Blob?new Uint8Array(await file.slice(0,8).arrayBuffer()):new Uint8Array();
    if(request!==importRequest)return;
    const png=PngGraph.isPng(head)||/\.png$/i.test(file.name)||file.type==='image/png';
    importReview.isPng=png;
    if(!png&&file.size>PngGraph.maxGraph)throw Error(t('graph.size'));
    const raw=png?PngGraph.extract(new Uint8Array(await file.arrayBuffer())).raw:await file.text();if(request!==importRequest)return;
    importReview.raw=raw;renderImportReview();
    let document;
    try{document=JSON.parse(raw);}catch{throw Error(t('import.invalidJSON'));}
    const inspected=await api('inspect',{graph:document});if(request!==importRequest)return;
    Object.assign(importReview,inspected);renderImportReview();
  }catch(error){
    if(request!==importRequest)return;
    Object.assign(importReview,{status:'blocked',candidate:null,message:t(error.message)});renderImportReview();
  }
}
function prepareGraphReplacement(document){
  const replacement=clone(document),snapshot=nativeSourceSnapshot;
  const nativeKind=kind=>['uniform','spec_constant','pop_buffer','attribute'].includes(kind);
  if(!snapshot&&graph.declarations.some(d=>nativeKind(d.kind)&&!d.sourceMissing))throw Error(t('sources.nativePending'));
  if(!snapshot?.enabled)return replacement;
  if(snapshot.revision!==revision)throw Error(t('sources.nativePending'));
  const nativeRows=[...(snapshot.uniforms||[]),...(snapshot.specConstants||[])];
  const liveIds=new Set(nativeRows.filter(row=>!row.missing&&!row.pending).map(row=>row.id));
  const live=graph.declarations.filter(d=>nativeKind(d.kind)&&liveIds.has(d.id));
  if(live.length!==liveIds.size)throw Error(t('history.changed'));
  const byId=new Map(live.map(d=>[d.id,d])),byName=new Map(live.map(d=>[d.name,d])),remap=new Map(),retained=new Set();
  for(const declaration of replacement.declarations){
    const sameId=byId.get(declaration.id),sameName=byName.get(declaration.name),existing=sameId||sameName;
    if(!existing)continue;
    if(declaration.kind!==existing.kind||sameId&&sameName&&sameId.id!==sameName.id||retained.has(existing.id))throw Error(t('import.sourceConflict').replace('{name}',declaration.name));
    // The native runtime already reuses a unique source name. Preserve that
    // entity's identity while importing its new graph metadata and references.
    remap.set(declaration.id,existing.id);declaration.id=existing.id;delete declaration.sourceMissing;retained.add(existing.id);
    const sequence=nativeRows.find(row=>row.id===existing.id)?.sequence;
    if(existing.kind==='spec_constant'){declaration.constantId=existing.constantId;declaration.nativeSequence='const';}
    if(sequence==='color')declaration.nativeSequence='color';else if(sequence==='vec')delete declaration.nativeSequence;
  }
  for(const declaration of live)if(!retained.has(declaration.id))replacement.declarations.push(clone(declaration));
  // An imported source is new in this Shader, so allocate its specialization
  // slot here if occupied; existing native sources retain their original IDs.
  const occupied=new Set(live.filter(d=>d.kind==='spec_constant').map(d=>d.constantId));
  const reserved=new Set(replacement.declarations.filter(d=>d.kind==='spec_constant').map(d=>d.constantId));
  for(const declaration of replacement.declarations.filter(d=>d.kind==='spec_constant'&&!liveIds.has(d.id))){
    if(occupied.has(declaration.constantId)){let ident=0;while(reserved.has(ident))ident++;declaration.constantId=ident;reserved.add(ident);}
    occupied.add(declaration.constantId);
  }
  for(const data of [...Object.values(replacement.stages),...(replacement.functions||[]).map(f=>f.graph)]){
    for(const node of data.nodes)if(remap.has(node.params?.declarationId))node.params.declarationId=remap.get(node.params.declarationId);
  }
  return replacement;
}
function acceptImportReview(){
  const review=importReview;if(!review?.candidate||readonly)return false;
  if(review.target!==editorTarget||review.baseGraph!==JSON.stringify(graph)){
    review.candidate=null;review.message=t('import.changed');renderImportReview();return false;
  }
  const changed=change(()=>{
    graph=prepareGraphReplacement(review.candidate);graphTrail=[];selection.clear();selected=null;selectedEdge=null;errorNode=null;
  },{localize:false});
  if(!changed){review.message=$('#status').textContent;renderImportReview();return false;}
  closeImportReview();fit();status(t('graph.loaded'));return true;
}
function downloadImportOriginal(){
  if(!importReview||(importReview.raw===undefined&&!(importReview.file instanceof Blob)))return;
  const original=importReview.file instanceof Blob?importReview.file:new Blob([importReview.raw],{type:'application/json'});
  const url=URL.createObjectURL(original);
  const link=el('a',{href:url,download:importReview.name||'original-graph.json'});link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function installImportUI(){
  $('#closeexport').onclick=closeExport;$('#exportpng').onclick=exportPng;$('#exportjson').onclick=exportJson;$('#exportjsondownload').onclick=downloadGraphJson;
  $('#exportdialog').addEventListener('cancel',e=>{e.preventDefault();closeExport();});
  $('#import').onclick=()=>$('#file').click();
  $('#file').onchange=e=>{const file=e.target.files[0];e.target.value='';if(file)reviewImportFile(file);};
  $('#importaccept').onclick=acceptImportReview;
  $('#importdownload').onclick=downloadImportOriginal;
  $('#closeimport').onclick=closeImportReview;
  $('#importreview').addEventListener('cancel',e=>{e.preventDefault();closeImportReview();});
}


// The empty canvas in this mode is presentation only. It is never exportable or applied.
let savedDownloadRequest=0,savedReadRequest=0;
async function readSavedStateText(){
  const issue=savedStateIssue,request=++savedReadRequest;if(!issue?.downloadable)return;
  $('#savedstatus').textContent=t('saved.reading');
  try{
    const source=await api('state-source');if(request!==savedReadRequest||issue!==savedStateIssue)return;
    if(source.sha256!==issue.sha256)throw Error(t('saved.changed'));
    issue.preview=source.raw.slice(0,12000);issue.truncated=source.raw.length>12000;
    renderSavedStateIssue();$('#savedstatus').textContent='';
  }catch(e){if(request===savedReadRequest&&issue===savedStateIssue){$('#savedstatus').textContent=t('saved.unavailable')+' '+e.message;}}
}
function renderSavedStateIssue(){
  if(typeof savedStateIssue==='undefined')return;
  const locked=!!savedStateIssue;$('#savednotice').hidden=!locked;
  $('#newfunction').disabled=readonly;$('#adduniform').disabled=readonly;
  if(locked)for(const button of document.querySelectorAll('.library button:not([role=tab]):not(.personal-refresh)'))button.disabled=true;
  $('#newfunction').disabled=readonly;$('#adduniform').disabled=readonly;
  if(locked)for(const button of document.querySelectorAll('.library button:not([role=tab]):not(.personal-refresh)'))button.disabled=true;
  for(const id of ['export','code','import'])$('#'+id).disabled=locked;
  if(!locked)return;
  $('#savedpath').textContent=savedStateIssue.datPath||'';
  $('#savedraw').textContent=savedStateIssue.preview||'';
  $('#savedtruncated').hidden=!savedStateIssue.truncated;
  $('#downloadsaved').disabled=!savedStateIssue.downloadable;
  $('#savedissues').replaceChildren(...(savedStateIssue.issues||[]).slice(0,40).map(item=>el('li',{},item.message)));
}
function installSavedStateUI(){
  $('#reviewsaved').onclick=()=>{renderSavedStateIssue();$('#savedstatus').textContent='';$('#savedreview').showModal();readSavedStateText();};
  const close=()=>{savedDownloadRequest++;savedReadRequest++;$('#savedreview').close();};
  $('#closesaved').onclick=close;$('#savedreview').addEventListener('cancel',e=>{e.preventDefault();close();});
  $('#reloadsaved').onclick=async()=>{savedDownloadRequest++;savedReadRequest++;try{await load();renderSavedStateIssue();$('#savedstatus').textContent=savedStateIssue?t('saved.stillLocked'):'';if(savedStateIssue)await readSavedStateText();}catch(e){$('#savedstatus').textContent=e.message;}};
  $('#downloadsaved').onclick=async()=>{
    const issue=savedStateIssue,request=++savedDownloadRequest;if(!issue?.downloadable)return;$('#downloadsaved').disabled=true;
    try{
      const source=await api('state-source');if(request!==savedDownloadRequest||issue!==savedStateIssue)return;
      if(source.sha256!==issue.sha256)throw Error(t('saved.changed'));
      const url=URL.createObjectURL(new Blob([source.raw],{type:'application/json;charset=utf-8'}));
      el('a',{href:url,download:'Grape-'+(shaderId||'Shader')+'-state-original.json'}).click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('#savedstatus').textContent=t('saved.downloaded');
    }catch(e){if(request===savedDownloadRequest)$('#savedstatus').textContent=e.message;}
    finally{if(request===savedDownloadRequest)$('#downloadsaved').disabled=!savedStateIssue?.downloadable;}
  };
}

let upgradePending=null,upgradeDialogReview=null,upgradeRequest=0;
function renderUpgradeNotice(){
  const notice=$('#upgradenotice');if(!notice)return;
  notice.hidden=!upgradePending;
}
function closeUpgradeReview(){
  upgradeRequest++;upgradeDialogReview=null;
  if($('#upgradereview').open)$('#upgradereview').close();
}
function upgradeRow(item){
  const row=el('li',{class:'upgrade-change'});
  const where=[item.savedGraph?t('upgrade.savedGraph'):'',item.stage,item.functionId,item.node].filter(Boolean).join(' / ');
  row.append(el('strong',{},where||'Shader'));
  const key=item.code==='node'?(item.reasons?.includes('behavior')?'behavior':'unknownRevision'):item.code;
  row.append(el('p',{},t('upgrade.'+key)));
  if(item.definitionUuid)row.append(el('code',{},item.definitionUuid));
  if(item.requestedRevision!==undefined||item.currentRevision){
    row.append(el('p',{class:'muted'},t('upgrade.revision')+': '+String(item.requestedRevision??'—').slice(0,64)+' → '+String(item.currentRevision??'—').slice(0,64)));
  }
  if(item.old!==undefined||item.new!==undefined){
    const detail=el('details');detail.append(el('summary',{},t('upgrade.details')));
    for(const [key,value]of [['old',item.old],['new',item.new]]){
      detail.append(el('strong',{},t('upgrade.'+key)),el('pre',{},value==null?t('upgrade.unavailable'):JSON.stringify(value,null,2)));
    }
    row.append(detail);
  }
  return row;
}
function renderUpgradeReview(){
  const review=upgradeDialogReview;if(!review)return;
  $('#upgradetarget').textContent=review.target||$('#target').textContent;
  $('#upgradestatus').textContent=review.message||t(review.checking?'upgrade.checking':review.blocked?'upgrade.blocked':'upgrade.ready');
  $('#upgradeaccept').disabled=!!review.checking||!!review.busy||!!review.blocked||!review.token||!review.candidate;
  $('#upgraderecheck').disabled=!!review.busy;
  $('#closeupgrade').disabled=!!review.busy;
  const list=$('#upgradechanges');list.replaceChildren(...(review.changes||[]).map(upgradeRow));
  for(const f of review.localizedFunctions||[])list.append(el('li',{},t('upgrade.localize').replace('{name}',f.name)));
  for(const issue of review.issues||[])list.append(el('li',{},issue.message));
}
async function reviewUpgrade(){
  if(submitBusy)return;
  clearTimeout(autoTimer);autoTimer=null;
  const request=++upgradeRequest;
  const baseGraph=JSON.stringify(graph),baseRevision=revision;
  upgradeDialogReview={checking:true,baseGraph,baseRevision};renderUpgradeReview();
  if(!$('#upgradereview').open)$('#upgradereview').showModal();
  try{
    const review=await api('inspect',{reviewUpgrade:true,...(dirty&&!savedStateIssue?{graph:clone(graph)}:{})});
    if(request!==upgradeRequest)return;
    upgradeDialogReview={...review,baseGraph,baseRevision};renderUpgradeReview();
  }catch(e){if(request!==upgradeRequest)return;upgradeDialogReview={baseGraph,baseRevision,message:e.message,blocked:true};renderUpgradeReview();}
}
async function acceptUpgradeReview(){
  const review=upgradeDialogReview;
  if(!review?.token||!review.candidate||review.busy||review.blocked||submitBusy||historyBusy||nativeMutationBusy)return false;
  if(review.baseGraph!==JSON.stringify(graph)||review.baseRevision!==revision){
    review.token=null;review.message=t('upgrade.changed');renderUpgradeReview();return false;
  }
  const request=upgradeRequest,previous=clone(graph),generation=editorLoadGeneration,nativeBefore=historyNativeToken;
  const sentEntries=past.filter(entry=>entry.kind==='graph'&&!entry.nativeApplied);
  review.busy=true;submitBusy=true;nativeMutationBusy=true;renderHistoryActions();renderUpgradeReview();$('#apply').disabled=true;$('#reload').disabled=true;
  try{
    const result=await api('apply',{graph:review.candidate,revision:review.revision,upgradeToken:review.token});
    if(generation!==editorLoadGeneration)return false;
    if(!result.ok)throw Error(t('upgrade.changed'));
    // The modal prevents graph edits; still preserve a draft changed by another
    // local callback while the request was in flight instead of overwriting it.
    revision=result.state.revision;
    if(review.baseGraph!==JSON.stringify(graph)){
      conflicted=true;dirty=true;review.token=null;review.message=t('upgrade.localChanged');return false;
    }
    graph=clone(result.state.graph);graphTrail=[];selection.clear();selected=null;selectedEdge=null;errorNode=null;
    sealGraphHistory(sentEntries,result.history?.beforeToken||nativeBefore,result.history?.token||null);
    recordGraphHistory(previous,{nativeBefore:result.history?.beforeToken||nativeBefore,nativeAfter:result.history?.token||null,nativeApplied:true});
    savedStateIssue=null;upgradePending=null;readonly=!!editorReadOnlyReason;dirty=false;conflicted=false;
    sessionStorage.removeItem(draftKey);rememberSavedGraph(graph,'graph.applied');renderGraphSaveState();
    closeUpgradeReview();render();renderUpgradeNotice();fit();preview().catch(e=>status(e.message,true));status(t('upgrade.applied'));return true;
  }catch(e){if(generation===editorLoadGeneration&&request===upgradeRequest){review.token=null;review.message=e.message;}return false;}
  finally{
    if(generation===editorLoadGeneration){submitBusy=false;nativeMutationBusy=false;review.busy=false;$('#apply').disabled=readonly;$('#reload').disabled=false;renderHistoryActions();
      if(request===upgradeRequest)renderUpgradeReview();refreshUniforms();}
  }
}
function installUpgradeUI(){
  $('#reviewupgrade').onclick=reviewUpgrade;$('#closeupgrade').onclick=closeUpgradeReview;
  $('#upgraderecheck').onclick=reviewUpgrade;$('#upgradeaccept').onclick=acceptUpgradeReview;
  $('#upgradereview').addEventListener('cancel',e=>{e.preventDefault();if(!upgradeDialogReview?.busy)closeUpgradeReview();});
}

function downloadGraphJson(){
  if(exportBusy||!graph||savedStateIssue)return;
  try{const snapshot=clone(graph),blob=new Blob([JSON.stringify(snapshot,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob);
    const name='Grape-'+(snapshot.target||editorTarget||'mat').toUpperCase()+'.json';el('a',{href:url,download:name}).click();setTimeout(()=>URL.revokeObjectURL(url),1000);closeExport();status(t('export.jsonDownloaded'));
  }catch(error){$('#exportstatus').textContent=t('export.failed')+error.message;}
}
