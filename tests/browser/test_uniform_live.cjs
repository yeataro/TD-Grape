const assert=require('node:assert/strict');
const {harness}=require('./test_glsl_code.cjs');
(async()=>{
 const[source,state,folder]=process.argv.slice(2),h=await harness(source,state,folder,{skipPreview:true}),{page,checks,errors}=h;
 try{
  await page.evaluate(()=>{
   clearTimeout(autoTimer);autoTimer=null;nativeSourcePolling=false;uniformPolling=customPolling=true;
   refreshNativeSources=async()=>{nativeSourceRefreshPending=false;};
   uniformLive.disconnect();uniformLive.retryAt=0;
   window.liveMessages=[];window.liveReceipts=new Map();window.liveValue=.25;window.liveBefore=.25;window.liveSequence=-1;window.livePause=false;
   window.WebSocket=class{
    static OPEN=1;
    constructor(){this.readyState=1;window.fakeLiveSocket=this;setTimeout(()=>this.deliver({type:'ready'}),0);}
    close(){this.readyState=3;setTimeout(()=>this.onclose?.(),0);}
    deliver(data){this.onmessage?.({data:JSON.stringify(data)});}
    send(text){const msg=JSON.parse(text);liveMessages.push(msg);let result={};
     if(msg.type==='begin'){liveBefore=liveValue;liveSequence=-1;this.gesture=msg.gesture;}
     if(msg.type==='subscribe')result=msg.sources?{values:Object.fromEntries(msg.sources.map(id=>[id,clone(nativeSourceIndex().get(id).components)]))}:{components:clone(nativeSourceIndex().get(msg.source).components)};
     if(['update','commit'].includes(msg.type)){liveValue=msg.value;liveSequence=msg.sequence;result.value=liveValue;}
     if(msg.type==='commit'){liveReceipts.set(this.gesture,{before:liveBefore,after:liveValue});result.receipt=this.gesture;}
     if(msg.type==='cancel')liveValue=liveBefore;
     const answer=()=>this.deliver({type:'reply',request:msg.request,...result});if(livePause&&msg.type==='update')window.liveRelease=answer;else setTimeout(answer,8);
    }
   };
   const original=api;
   api=async(name,body)=>{
    if(name==='live-ticket')return {port:9999,ticket:'test'};
    if(name==='live-restore'){const r=liveReceipts.get(body.receipt);liveValue=body.undo?r.before:r.after;return {restored:true};}
    if(name==='source-value')throw Error('Unexpected HTTP value write');
    if(name==='live-seal')return {receipt:null};
    return original(name,body);
   };
   graph.declarations=[{id:'live',kind:'uniform',name:'uLive',type:'float',value:.25}];graph.functions=[];graphTrail=[];
   graph.stages.pixel={nodes:[testNode('scalar','scalar',0,0,{type:'float',value:1}),testNode('pixel','pixel_out',400,0)],edges:[]};
   dirty=false;readonly=false;connectionInterrupted=false;selectedInputId='live';selected=null;selection.clear();past=[];future=[];
   nativeSourceSnapshot={revision,enabled:true,sourceChanged:false,graph:clone(graph),declarations:clone(graph.declarations),issues:[],history:{token:'before'},uniforms:[{id:'live',kind:'uniform',name:'uLive',type:'float',nameWritable:true,sequence:'vec',components:[0,1,2,3].map(i=>({value:i?0:.25,parameter:'vec0value'+i,mode:'CONSTANT',writable:true,modeWritable:true}))}]};
   nativeSourceError='';nativeMutationBusy=nativeValueBusy=nativeSourceBusy=false;render();renderGraphEditActions();
   window.savedLiveGraph=JSON.stringify(graph);window.savedLiveRevision=revision;
  });
  await page.waitForFunction(()=>uniformLive.subscribed==='live');
  const selector='#inspector [data-source-component="0"]',p=await h.at(selector);
  await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(p.x+40,p.y,{steps:6});
  await page.waitForFunction(()=>liveMessages.some(m=>m.type==='update')&&liveValue!==.25);
  assert.equal(await page.evaluate(()=>past.length),0);
  assert.equal(await page.evaluate(()=>editorMutationBlocked()||nativeMutationBusy||$('#apply').inert),false);
  assert.equal(await page.evaluate(()=>JSON.stringify(graph)===savedLiveGraph&&revision===savedLiveRevision&&!dirty),true);
  checks.push('pointer held: TD receives values while graph, revision, dirty state and unrelated controls remain unchanged');
  await page.mouse.up();await page.waitForFunction(()=>!uniformLive.gesture&&past.length===1);
  assert.equal(await page.evaluate(()=>liveMessages.filter(m=>m.type==='commit').length),1);
  assert.equal(await page.evaluate(()=>past[0].kind),'liveValue');
  await page.evaluate(()=>undo());assert.equal(await page.evaluate(()=>liveValue),.25);
  await page.evaluate(()=>undo(true));assert.notEqual(await page.evaluate(()=>liveValue),.25);
  checks.push('one gesture creates one history step, and Undo/Redo restores only its Uniform value');
  await page.evaluate(()=>{selectedInputId='live';render();window.beforeCancel=liveValue;});
  const q=await h.at(selector);await page.mouse.move(q.x,q.y);await page.mouse.down();await page.mouse.move(q.x+40,q.y,{steps:6});
  await page.waitForFunction(()=>uniformLive.gesture?.sequence>0);await page.keyboard.press('Escape');await page.mouse.up();
  await page.waitForFunction(()=>!uniformLive.gesture);
  assert.equal(await page.evaluate(()=>liveValue===beforeCancel),true);
  assert.equal(await page.evaluate(()=>past.length),1);
  checks.push('Escape cancels live adjustment without an extra history step or HTTP write');
  await page.evaluate(()=>{livePause=true;window.updateStart=liveMessages.filter(m=>m.type==='update').length;});
  const z=await h.at(selector);await page.mouse.move(z.x,z.y);await page.mouse.down();await page.mouse.move(z.x+15,z.y,{steps:4});
  await page.waitForFunction(()=>typeof liveRelease==='function');
  await page.mouse.move(z.x+60,z.y,{steps:20});await page.mouse.up();
  assert.equal(await page.evaluate(()=>liveMessages.filter(m=>m.type==='update').length-updateStart),1);
  const finalValue=Number(await page.locator(selector).inputValue());
  await page.evaluate(()=>{livePause=false;liveRelease();});await page.waitForFunction(()=>!uniformLive.gesture);
  assert.equal(await page.evaluate(()=>liveValue),finalValue);
  assert.equal(await page.evaluate(()=>past.length),2);
  checks.push('slow acknowledgement coalesces pointer values; commit retains the exact final value and one Undo');
  await page.locator(selector).fill('0.654');await page.locator(selector).press('Enter');await page.waitForFunction(()=>!uniformLive.gesture&&liveValue===.654);
  assert.equal(await page.evaluate(()=>past.length),3);
  checks.push('typed commit also uses the live channel without an HTTP value request');
  await page.evaluate(async()=>{await undo();selectedInputId='live';render();livePause=true;delete window.liveRelease;});
  const c=await h.at(selector);await page.mouse.move(c.x,c.y);await page.mouse.down();await page.mouse.move(c.x+30,c.y,{steps:5});
  await page.waitForFunction(()=>typeof liveRelease==='function');await page.keyboard.press('Escape');await page.mouse.up();
  await page.evaluate(()=>{window.earlyUndo=undo();});
  await page.evaluate(async()=>{livePause=false;liveRelease();await earlyUndo;});
  assert.deepEqual(await page.evaluate(()=>[past.length,future.length]),[1,2]);
  await page.evaluate(async()=>{await undo(true);await undo(true);});
  assert.equal(await page.evaluate(()=>liveValue),.654);
  checks.push('Undo during a delayed cancellation skips the empty gesture and preserves the existing Redo branch');
  await page.evaluate(()=>{fakeLiveSocket.deliver({type:'values',source:'live',components:nativeSourceSnapshot.uniforms[0].components.map((c,i)=>({...c,value:i?0:.876}))});});
  await page.locator(selector).blur();await page.evaluate(()=>renderNativeSourceValues());
  assert.equal(await page.locator(selector).inputValue(),'0.876');
  assert.equal(await page.evaluate(()=>JSON.stringify(graph)===savedLiveGraph&&!dirty),true);
  checks.push('TD value messages update visible controls without graph persistence');
  await page.evaluate(()=>{
   graph.declarations.push({id:'second',kind:'uniform',name:'uSecond',type:'vec2',value:[.1,.2]});
   nativeSourceSnapshot={...nativeSourceSnapshot,uniforms:[...nativeSourceSnapshot.uniforms,{id:'second',kind:'uniform',name:'uSecond',type:'vec2',sequence:'vec',components:[.1,.2].map(value=>({value,mode:'CONSTANT',writable:true}))}]};
   const d=catalog.find(d=>d.key==='uniform');
   instantiate(d,20,40,null,{declarationId:'live'});instantiate(d,230,40,null,{declarationId:'live'});instantiate(d,20,220,null,{declarationId:'second'});
   selected=null;selection.clear();selectedInputId='live';scale=1;pan={x:30,y:30};render();workspaceLayout.reveal('parameters');
   window.multiGraph=JSON.stringify(graph);window.multiList=$('#nativeuniforms').firstElementChild;
  });
  await page.waitForFunction(()=>uniformLive.subscriptions.size===2);
  assert.deepEqual(await page.evaluate(()=>[...uniformLive.subscriptions].sort()),['live','second']);
  assert.equal(await page.locator('#cards [data-native-source="live"] [data-source-component]').count(),2);
  await page.evaluate(()=>{
   fakeLiveSocket.deliver({type:'values',source:'live',components:[{value:.932,mode:'CONSTANT',writable:true}]});
   fakeLiveSocket.deliver({type:'values',source:'second',components:[{value:.123,mode:'CONSTANT',writable:true},{value:.456,mode:'CONSTANT',writable:true}]});
  });
  await page.waitForFunction(()=>[...document.querySelectorAll('[data-native-source="live"] [data-source-component="0"]')].every(e=>e.value==='0.932'));
  assert.deepEqual(await page.locator('#cards [data-native-source="second"] input').evaluateAll(es=>es.map(e=>e.value)),['0.123','0.456']);
  assert.equal(await page.evaluate(()=>JSON.stringify(graph)===multiGraph&&!dirty&&$('#nativeuniforms').firstElementChild===multiList),true);
  checks.push('multiple graph references and Parameter share unique subscriptions; TD values update all copies without graph saves or list rebuilds');
  await page.screenshot({path:require('node:path').join(folder,'uniform-references.png')});
  await page.evaluate(()=>{
   const n=current().nodes.find(n=>n.params?.declarationId==='second');n.ui.x=100000;render();
  });
  await page.waitForFunction(()=>uniformLive.subscriptions.size===1);
  assert.deepEqual(await page.evaluate(()=>[...uniformLive.subscriptions]),['live']);
  checks.push('offscreen controls stop subscribing; duplicate references still use one source');
  await page.evaluate(()=>{uniformLive.disconnect();});
  assert.equal(await page.evaluate(()=>uniformLive.ready),false);
  assert.equal(await page.evaluate(()=>editorMutationBlocked()),false);
  assert.match(await page.locator('[data-uniform-live-status]').innerText(),/中斷|offline/);
  checks.push('live failure is visible and does not disable graph editing');
  assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,count:checks.length,checks}));
 }catch(e){await h.finish(e);throw e;}
})().catch(e=>{console.error(e);process.exitCode=1;});
