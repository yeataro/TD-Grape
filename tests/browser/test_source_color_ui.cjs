const assert=require('node:assert/strict'),path=require('node:path');
const{harness}=require('./test_glsl_code.cjs');
(async()=>{
 const[source,state,folder]=process.argv.slice(2),h=await harness(source,state,folder,{skipPreview:true}),{page,checks,errors}=h;
 try{
 await page.evaluate(()=>{
  nativeSourcePolling=uniformPolling=customPolling=true;uniformLive.disconnect();uniformLive.connect=()=>{};
  graph.declarations=[{id:'tint',name:'uTint',kind:'uniform',type:'vec4',nativeSequence:'color',value:null},{id:'gain',name:'uGain',kind:'uniform',type:'float',value:null},{id:'lost',name:'uLost',kind:'uniform',type:'float',value:null,sourceMissing:true}];
  graph.stages.pixel={nodes:[testNode('colorReference','uniform',50,50,{declarationId:'tint'}),testNode('output','pixel_out',500,50)],edges:[]};graph.functions=[];graphTrail=[];stage='pixel';
  readonly=false;dirty=false;connectionInterrupted=false;selected=null;selection.clear();selectedInputId=null;past=[];future=[];
  nativeSourceSnapshot={revision,enabled:true,declarations:clone(graph.declarations),uniforms:graph.declarations.map(d=>({...d,sequence:d.nativeSequence||'vec',missing:!!d.sourceMissing,pending:false,components:[.2,.4,.6,.7].map((value,i)=>({value,mode:'CONSTANT',writable:true,parameter:'color0'+i}))})),issues:[]};
  sourceCollapsePreferences.defaultCollapsed=false;inputCollapsedGroups.clear();setInputGroupCollapsed('uniform',false);render();workspaceLayout.reveal('uniforms');window.initialGraph=JSON.stringify(graph);
  // The browser fixture substitutes the live transport, not the picker UI. The
  // session models an opening basis, atomic component previews and one seal.
  window.calls=[]; window.sessions=[];
  nativeSourceRequest=async()=>{throw new Error('Color live edits must not fall back to REST');};
  uniformLive.prepareColorSession=async(id,{isValid})=>{
   const row=nativeSourceIndex().get(id),count=typeComponents(row.type),basis=row.components.slice(0,count).map(c=>c.value);
   if(!isValid())return null;
   const session={id,basis:basis.slice(),previews:[],accepted:null};sessions.push(session);
   let last=basis.slice(),closed=false;
   const write=values=>{values.forEach((value,i)=>{row.components[i].value=value;});renderNativeSourceValues(new Set([id]));};
   const owns=()=>row===nativeSourceIndex().get(id)&&row.components.slice(0,count).every((c,i)=>c.writable&&['CONSTANT','BIND'].includes(c.mode)&&c.value===last[i]);
   return {initial:basis.slice(),preview(values){
    if(closed||!isValid()||!owns())return false;
    const next=values.slice(0,count);session.previews.push(next.slice());calls.push({id,values:next.slice()});write(next);last=next;return true;
   },async finish(accepted){
    if(closed)return;closed=true;session.accepted=!!accepted;
    if(!accepted&&owns())write(basis);
    session.commits=accepted&&last.some((value,i)=>value!==basis[i])?1:0;
   }};
  };
 });
 const card=page.locator('[data-input-source="tint"]'),color=card.locator('[data-native-color]'),picker=color.locator('.color-picker-trigger');
 assert.equal(await picker.count(),1);assert.equal(await color.locator('.native-color-line input').count(),4);
 assert.equal(await color.locator('.native-color-expanded').count(),0);await color.locator('.node-values-toggle').click();assert.equal(await color.locator('.native-color-expanded').isVisible(),true);
 await card.locator('.input-source-select').click();assert.equal(await page.locator('#inspector [data-native-color] .color-picker-trigger').count(),1);
 assert.equal(await page.locator('[data-node="colorReference"] [data-native-color] .color-picker-trigger').count(),1);
 checks.push('Color source cards, Parameter and graph references share palette, compact components and expandable component controls');
 const values=()=>page.evaluate(()=>nativeSourceIndex().get('tint').components.map(c=>c.value));
 const editHex=async hex=>{await page.locator('.gcp-hex').fill(hex);};
 const accept=async()=>{await page.mouse.click(4,4);await page.locator('.grape-color-picker').waitFor({state:'detached'});};
 await picker.click();assert.equal(await page.locator('.gcp-apply').isVisible(),false);
 assert.equal(await page.evaluate(()=>calls.length),0,'opening the picker does not write TD');
 await editHex('#ff8000');
 assert.equal(await page.evaluate(()=>calls.length),1);assert.deepEqual(await page.evaluate(()=>calls[0].values),[1,128/255,0,.7]);
 assert.equal((await values())[3],.7);assert.equal(await page.evaluate(()=>JSON.stringify(graph)===initialGraph),true);
 await accept();assert.equal(await page.evaluate(()=>sessions[0].commits),1);
 checks.push('live palette updates all actual RGBA components atomically, preserves Alpha, never changes graph values and seals once on outside close');
 await page.evaluate(()=>{graph.stages.pixel.nodes=graph.stages.pixel.nodes.filter(n=>n.id!=='colorReference');selected=null;selection.clear();selectedInputId=null;render();window.calls=[];window.sessions=[];window.initialGraph=JSON.stringify(graph);});
 await picker.click();await editHex('#00ff00');
 await page.evaluate(()=>renderNativeSourceValues());
 assert.deepEqual(await values(),[0,1,0,.7]);assert.equal(await page.locator('.grape-color-picker').count(),1);
 await editHex('#ff0000');await page.evaluate(()=>renderNativeSourceValues());
 assert.equal(await page.evaluate(()=>calls.length),2);assert.deepEqual(await values(),[1,0,0,.7]);
 await accept();assert.equal(await page.evaluate(()=>sessions[0].previews.length),2);assert.equal(await page.evaluate(()=>sessions[0].commits),1);
 // Cancel restores the complete opening basis; a later popup reads fresh TD state.
 await picker.click();await editHex('#123456');await page.locator('.gcp-close').click();
 assert.deepEqual(await values(),[1,0,0,.7]);assert.equal(await page.evaluate(()=>sessions[1].accepted),false);assert.equal(await page.evaluate(()=>sessions[1].commits),0);
 await page.evaluate(()=>{nativeSourceIndex().get('tint').components[0].value=.5;renderNativeSourceValues();});
 const beforeReopen=await page.evaluate(()=>calls.length);
 await picker.click();assert.equal(await page.locator('.gcp-hex').inputValue(),'#800000B3');
 assert.equal(await page.evaluate(()=>calls.length),beforeReopen);await page.locator('.gcp-hex').press('Escape');
 assert.deepEqual(await values(),[.5,0,0,.7]);assert.equal(await page.evaluate(()=>JSON.stringify(graph)===initialGraph),true);
 checks.push('unreferenced Color survives polling during multiple live previews; one popup seals once, X cancels, Escape is safe and reopen reads fresh TD values without graph edits');
 await page.evaluate(()=>{window.control=document.querySelector('[data-input-source="gain"] input');const row=nativeSourceIndex().get('tint');row.components[1]={...row.components[1],mode:'EXPRESSION',expression:'absTime.seconds',writable:false};renderNativeSourceValues(new Set(['tint']));});
 assert.equal(await picker.isDisabled(),true);assert.match(await color.innerText(),/Expression/);assert.equal(await page.evaluate(()=>control===document.querySelector('[data-input-source="gain"] input')),true);
 await page.evaluate(()=>{const row=nativeSourceIndex().get('tint');row.components[1]={...row.components[1],mode:'BIND',binding:'parent().par.Color',writable:true};renderNativeSourceValues(new Set(['tint']));});assert.equal(await picker.isEnabled(),true);
 checks.push('driven RGB disables palette; supported writable Bind stays editable and unrelated controls retain DOM');
 const badge=page.locator('[data-input-group="uniform"] > .input-group-title .source-count');assert.equal(await badge.innerText(),'2');
 assert.equal(await page.locator('[data-input-group="common.time"] > .input-group-title .source-count').isVisible(),false);
 await page.evaluate(()=>{graph.declarations.find(d=>d.id==='gain').sourceMissing=true;renderNativeSources();});assert.equal(await badge.innerText(),'1');
 await page.selectOption('#language','en');const add=page.locator('[data-input-create="uniform"]');assert.equal(await add.innerText(),'＋ Add');assert.match(await add.getAttribute('title'),/Add source/);assert.equal(await add.evaluate(e=>getComputedStyle(e).borderWidth),'0px');
 checks.push('badges exclude dormant and missing sources, hide zero, and Add has a quiet borderless background and explicit tooltip');
 await page.screenshot({path:path.join(folder,'colors-and-counts.png')});assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,checks}));
 }catch(e){await h.finish(e);throw e;}
})().catch(e=>{console.error(e);process.exitCode=1;});
