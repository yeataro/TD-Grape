const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto').webcrypto;
const clone=v=>JSON.parse(JSON.stringify(v));
const row={id:'color',kind:'uniform',type:'vec4',sequence:'color',components:[.1,.2,.3,.4].map((value,i)=>({parameter:'color0'+i,value,writable:true,mode:'CONSTANT'}))};
const c={console,crypto,clone,Set,Map,Date,Promise,setTimeout,clearTimeout,setInterval:()=>0,
 document:{hidden:false,addEventListener(){},querySelectorAll:()=>[]},window:{addEventListener(){}},
 nativeSourceIndex:()=>new Map([[row.id,row]]),nativeSourceValueKey:r=>r&&r.id+':'+r.type,
 typeComponents:t=>t==='float'?1:Number(t?.slice(-1)),uniformValueReady:()=>true,
 editorLoadGeneration:1,graph:{id:'unchanged'},past:[],future:['redo'],historyBusy:false,
 nativeSourceReadEpoch:0,nativeSourceRefreshPending:false,renderNativeSourceValues(){},renderHistoryActions(){},status(){},t:v=>v,
 api:async()=>({receipt:null}),WebSocket:{OPEN:1},cancelAnimationFrame(){},requestAnimationFrame:fn=>{fn();return 1;}
};
c.recordHistory=step=>{c.past.push(step);c.future=[];return step;};vm.createContext(c);
vm.runInContext(fs.readFileSync('src/editor/uniform_live.js','utf8')+'\nglobalThis.live=uniformLive;',c);
const live=c.live,messages=[],receipts=new Map();let values=row.components.map(c=>c.value),basis,lastWritten,release,paused=false;
live.ready=true;live.ownsValues=()=>true;live.subscribe=()=>{};
live.request=async(type,body)=>{
 messages.push({type,...clone(body)});
 if(type==='begin'){basis=values.slice();lastWritten=basis.slice();live.serverId=body.gesture;return {};}
 if(type==='update'){values=body.value.slice();lastWritten=values.slice();if(paused)await new Promise(resolve=>{release=resolve;});return {value:values.slice()};}
 if(type==='commit'){values=body.value.slice();lastWritten=values.slice();const receipt=JSON.stringify(values)===JSON.stringify(basis)?null:live.serverId;if(receipt)receipts.set(receipt,{before:basis,after:values});return {value:values.slice(),receipt};}
 if(type==='cancel'){
   const cancelled=JSON.stringify(values)===JSON.stringify(lastWritten);
   if(cancelled)values=basis.slice();
   const receipt=!cancelled&&JSON.stringify(lastWritten)!==JSON.stringify(basis)?live.serverId:null;
   if(receipt)receipts.set(receipt,{before:basis.slice(),after:lastWritten.slice()});
   const components=row.components.map((item,i)=>({...clone(item),value:values[i]}));
   return {receipt,cancelled,value:values.slice(),components,...(!cancelled?{cancelConflict:'The value or limits changed outside this gesture.'}:{})};
 }
 return {};
};
const settle=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
(async()=>{
 const original=JSON.stringify(c.graph),start=values.slice();
 let session=await live.prepareColorSession('color',{isValid:()=>true});assert.ok(session);assert.ok(live.sources.includes('color'));
 live.watchSources([]);assert.ok(live.sources.includes('color'),'open picker pins a source whose visible card disappears');
 paused=true;session.preview([.6,.7,.8,.9]);await settle();
 for(let i=0;i<100;i++)session.preview([i/100,.4,.5,.6]);
 assert.equal(messages.filter(m=>m.type==='update').length,1);assert.equal(c.past.length,0);
 const done=session.finish(true);assert.equal(c.past.length,1);paused=false;release();const receipt=await done;await settle();
 assert.ok(receipt);assert.deepEqual(values,[.99,.4,.5,.6]);assert.equal(messages.filter(m=>m.type==='commit').length,1);
 assert.equal(c.past.length,1);assert.equal(live.gesture,null);assert.equal(live.colorPins.size,0);assert.equal(JSON.stringify(c.graph),original);
 assert.strictEqual(session.finish(),done,'repeat close returns same receipt promise');assert.equal(session.preview([0,0,0,0]),false);
 assert.deepEqual(receipts.get(receipt).before,start);
 // Cancel reverts the whole popup opening value, not the last individual slider.
 live.ready=true;const opening=values.slice();session=live.colorSession('color');session.preview([.8,.7,.6,.5]);await settle();session.preview([.1,.2,.3,.9]);await settle();
 await session.cancel();await settle();assert.deepEqual(values,opening);assert.deepEqual(row.components.map(item=>item.value),opening);assert.equal(c.past.length,1);
 // A null receipt does not mean Cancel restored the opening value: TD may have
 // changed after opening, without any local edits. Its value was already sent
 // through the subscription, so there may be no later broadcast to repair it.
 live.ready=true;live.watchSources(['color']);
 const conflictErrors=[],conflictStatuses=[],historyBefore=c.past.slice(),receiptsBefore=receipts.size;
 const futureBefore=['external-edit redo'];c.future=futureBefore;
 const oldStatus=c.status;c.status=(...args)=>conflictStatuses.push(args);
 session=live.colorSession('color',{onError:error=>conflictErrors.push(error.message)});await settle();
 values[1]=.876543210987;const outside=values.slice();
 live.acceptValues({color:row.components.map((item,i)=>({...clone(item),value:outside[i]}))});
 assert.deepEqual(row.components.map(item=>item.value),outside,'External value reached the browser before Cancel');
 const sentBeforeCancel=messages.length;
 assert.equal(await session.cancel(),null);await settle();
 assert.deepEqual(messages.slice(sentBeforeCancel).map(message=>message.type),['cancel']);
 assert.deepEqual(values,outside,'TD external value wins the cancel CAS conflict');
 assert.deepEqual(row.components.map(item=>item.value),outside,'Browser must not replace actual TD value with opening value');
 assert.deepEqual(conflictErrors,['The value or limits changed outside this gesture.']);
 assert.equal(conflictStatuses.length,1);assert.equal(conflictStatuses[0][0],conflictErrors[0]);assert.equal(conflictStatuses[0][1],true);
 assert.deepEqual(c.past,historyBefore);assert.strictEqual(c.future,futureBefore);assert.equal(receipts.size,receiptsBefore);
 assert.equal(live.gesture,null);assert.equal(live.colorPins.size,0);assert.equal(JSON.stringify(c.graph),original);
 c.status=oldStatus;
 // Metadata may remove the row before a cancellation reply arrives. The
 // conflict still belongs to this live session and must be reported, but its
 // returned components must not update a detached row or a replacement source.
 live.ready=true;live.watchSources(['color']);
 const missingErrors=[],missingStatuses=[],missingHistory=c.past.slice(),missingFuture=['removed-source redo'];
 const requestBefore=live.request,indexBefore=c.nativeSourceIndex;
 const unrelated={...clone(row),id:'other-color',components:row.components.map(item=>({...clone(item),value:.999}))};
 const unrelatedBefore=clone(unrelated);c.future=missingFuture;
 c.status=(...args)=>missingStatuses.push(args);
 session=live.colorSession('color',{onError:error=>missingErrors.push(error.message)});await settle();
 const detachedBefore=clone(row);values[2]=.765432109876;const missingOutside=values.slice();
 live.request=async(type,body)=>{
   const reply=await requestBefore(type,body);
   if(type==='cancel')c.nativeSourceIndex=()=>new Map([[unrelated.id,unrelated]]);
   return reply;
 };
 assert.equal(await session.cancel(),null);await settle();
 assert.deepEqual(missingErrors,['The value or limits changed outside this gesture.']);
 assert.equal(missingStatuses.length,1);assert.equal(missingStatuses[0][0],missingErrors[0]);assert.equal(missingStatuses[0][1],true);
 assert.deepEqual(values,missingOutside);assert.deepEqual(row,detachedBefore);assert.deepEqual(unrelated,unrelatedBefore);
 assert.deepEqual(c.past,missingHistory);assert.strictEqual(c.future,missingFuture);
 assert.equal(live.gesture,null);assert.equal(live.colorPins.size,0);
 live.request=requestBefore;c.nativeSourceIndex=indexBefore;c.status=oldStatus;
 // A subsequent fresh inventory/value publication restores the current row.
 live.acceptValues({color:row.components.map((item,i)=>({...clone(item),value:values[i]}))});
 // No-op open/close keeps existing redo history; alpha-only edits remain full precision.
 live.ready=true;c.future=['preserved'];session=live.colorSession('color');await session.finish();await settle();assert.deepEqual(c.future,['preserved']);assert.equal(c.past.length,1);
 live.ready=true;session=live.colorSession('color');session.preview([...opening.slice(0,3),.123456789]);await session.finish();await settle();assert.equal(values[3],.123456789);
 // One click can open the next picker while the previous outside-close waits
 // for its final receipt. It must not silently discard that click.
 live.ready=true;live.watchSources(['color']);paused=true;
 session=live.colorSession('color');session.preview([.2,.3,.4,.5]);await settle();
 const closing=session.finish(),nextOpening=live.prepareColorSession('color',{isValid:()=>true});
 assert.equal(live.gesture.closed,true);paused=false;release();await closing;
 const nextSession=await nextOpening;assert.ok(nextSession);await nextSession.cancel();await settle();
 // OP RGBA may map a normal vec2 Uniform; only its real channels are transported.
 live.ready=true;row.sequence='vec';row.type='vec2';row.components=row.components.slice(0,2);values=[.2,.4];row.components.forEach((c,i)=>c.value=values[i]);
 session=live.colorSession('color');assert.ok(session);session.preview([.3,.5,0,1]);await session.finish();await settle();assert.deepEqual(values,[.3,.5]);
 const begin=messages.filter(m=>m.type==='begin').at(-1);assert.deepEqual(begin.components,[0,1]);
 live.ready=true;row.components[1].writable=false;assert.equal(live.colorSession('color'),null);
 // A late old-shader reply must not send the queued commit to the new socket,
 // update its source row, remove its history, display errors or redraw its UI.
 row.components[1].writable=true;live.ready=true;paused=true;let errors=0,renders=0;
 session=live.colorSession('color',{onError:()=>errors++});session.preview([.6,.8]);await settle();
 const late=session.finish();const sent=messages.length;c.editorLoadGeneration++;
 row.components[0].value=.777;c.past=['new document'];c.future=['new redo'];
 c.renderNativeSourceValues=()=>renders++;live.colorPins.add('color');live.colorPinOwners.set('color','new owner');
 paused=false;release();await late;await settle();
 assert.equal(messages.length,sent);assert.equal(row.components[0].value,.777);
 assert.deepEqual(c.past,['new document']);assert.deepEqual(c.future,['new redo']);assert.equal(errors,0);assert.equal(renders,0);
 assert.equal(live.colorPinOwners.get('color'),'new owner');assert.ok(live.colorPins.has('color'));
 console.log('Grouped live Color: popup basis, pin, coalescing, one receipt, cancel/external conflict, no-op redo and real component count passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
