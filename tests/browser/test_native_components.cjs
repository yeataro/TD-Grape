/* Native component presentation: declared dimensions, modes and local updates. */
const assert=require('node:assert/strict');
const {harness}=require('./test_glsl_code.cjs');
(async()=>{
 const [source,state,folder]=process.argv.slice(2),h=await harness(source,state,folder,{skipPreview:true}),{page,checks,errors}=h;
 try{
  await page.evaluate(()=>{
   clearTimeout(autoTimer);nativeSourcePolling=uniformPolling=customPolling=true;
   uniformLive.disconnect();uniformLive.connect=()=>{};
   graph.declarations=['float','vec2','vec3','vec4'].map((type,i)=>({id:'native'+i,kind:'uniform',name:'uValue'+i,type,value:i?Array(i+1).fill(0):0}));
   graph.functions=[];graphTrail=[];graph.stages.pixel={nodes:[testNode('pixel','pixel_out',400,0)],edges:[]};
   dirty=false;readonly=false;connectionInterrupted=false;selectedInputId='native0';selected=null;selection.clear();past=[];future=[];
   nativeSourceSnapshot={revision,enabled:true,graph:clone(graph),declarations:clone(graph.declarations),issues:[],uniforms:graph.declarations.map(d=>({...d,sequence:'vec',nameWritable:true,components:[0,1,2,3].map(i=>({value:i+.25,parameter:'vec'+d.id+'value'+i,mode:'CONSTANT',writable:true,modeWritable:true}))}))};
   nativeSourceError='';nativeMutationBusy=nativeSourceBusy=nativeValueBusy=false;render();
   window.savedNativeGraph=JSON.stringify(graph);window.savedNativeValues=JSON.stringify(nativeSourceSnapshot.uniforms);
  });
  for(let i=0;i<4;i++){
   await page.evaluate(i=>{selectedInputId='native'+i;inspector();},i);
   assert.equal(await page.locator('#inspector [data-source-component]').count(),i+1);
   assert.equal(await page.locator('#inspector [data-source-expression]').count(),i+1);
  }
  assert.equal(await page.evaluate(()=>JSON.stringify(nativeSourceSnapshot.uniforms)===savedNativeValues),true);
  checks.push('float/vec2/vec3/vec4 show exactly 1/2/3/4 fields, without changing hidden TD components');
  await page.evaluate(()=>{
   const row=nativeSourceSnapshot.uniforms[3];
   Object.assign(row.components[0],{mode:'EXPRESSION',expression:'absTime.seconds',writable:false});
   Object.assign(row.components[1],{mode:'EXPORT',writable:false});
   Object.assign(row.components[2],{mode:'BIND',binding:'parent().par.Value',writable:true});
   row.components[3].hasBindReferences=true;
   renderNativeSourceValues();
   window.componentGridBefore=$('#inspector [data-native-components]');window.driverBefore=$('#inspector .input-drivers');
   window.constantBefore=$('#inspector [data-source-component="3"]');
  });
  assert.deepEqual(await page.locator('#inspector [data-component-mode-label]').allTextContents(),['Expression: absTime.seconds','CHOP Export']);
  assert.equal(await page.locator('#inspector [data-native-component-slot="1"] [data-component-mode-label]').getAttribute('title'),'CHOP Export');
  assert.equal(await page.locator('#inspector [data-source-component]').count(),2);
  assert.equal(await page.locator('#inspector [data-source-component="2"]').isEnabled(),true);
  assert.equal(await page.locator('#inspector [data-source-component="3"]').isEnabled(),true);
  checks.push('mixed modes keep four slots: Expression/CHOP Export labels, Bind and Constant value controls');
  assert.equal(await page.evaluate(()=>{
   const grid=$('#inspector [data-native-components]'),bound=grid.querySelector('[data-source-component="2"]'),master=grid.querySelector('[data-native-component-slot="3"]');
   const probe=el('span');probe.style.color='var(--purple)';grid.append(probe);const color=getComputedStyle(probe).color;probe.remove();
   return getComputedStyle(bound).color===color&&master.dataset.mode==='CONSTANT'&&getComputedStyle(master.querySelector('.field'),'::after').backgroundColor===color&&getComputedStyle(master.querySelector('.field'),'::after').pointerEvents==='none';
  }),true);
  checks.push('Bind values are purple; an editable constant master keeps its own mode and shows a noninteractive purple corner');
  const stable=await page.evaluate(()=>{
   const observer=new MutationObserver(()=>{});observer.observe($('#inspector'),{childList:true,subtree:true});
   nativeSourceSnapshot.uniforms[3].components[0].value=99;
   nativeSourceSnapshot.uniforms[3].components[3].value=7;
   renderNativeSourceValues();
   const records=observer.takeRecords();observer.disconnect();
   return {mutations:records.length,sameGrid:componentGridBefore===$('#inspector [data-native-components]'),sameDriver:driverBefore===$('#inspector .input-drivers'),sameInput:constantBefore===$('#inspector [data-source-component="3"]')};
  });
  assert.deepEqual(stable,{mutations:0,sameGrid:true,sameDriver:true,sameInput:true});
  assert.equal(await page.locator('#inspector [data-source-component="3"]').inputValue(),'7');
  checks.push('live values update in place, without rebuilding controls, labels or the driver description');
  await page.evaluate(()=>{
   const row=nativeSourceSnapshot.uniforms[3];Object.assign(row.components[0],{mode:'CONSTANT',writable:true});renderNativeSourceValues();
  });
  assert.equal(await page.locator('#inspector [data-source-component="0"]').inputValue(),'99');
  assert.equal(await page.evaluate(()=>constantBefore===$('#inspector [data-source-component="3"]')),true);
  assert.equal(await page.locator('#inspector [data-component-mode-label]').count(),1);
  assert.equal(await page.evaluate(()=>JSON.stringify(graph)===savedNativeGraph&&!dirty&&!past.length),true);
  checks.push('a mode switch replaces only its own slot and never changes graph contents or history');
  await page.evaluate(()=>{constantBefore.value='123';renderNativeSourceValues();});
  assert.equal(await page.locator('#inspector [data-source-component="3"]').inputValue(),'7');
  checks.push('an uncommitted or rejected local value returns to the unchanged authoritative TD value');
  const sameStyle=await page.evaluate(()=>{
   const box=numbers([1,2,3,4],'value',()=>{},false,'XYZW','vec4');$('#inspector').append(box);
   const source=$('#inspector [data-source-component="3"]'),ordinary=box.querySelector('input'),a=getComputedStyle(source),b=getComputedStyle(ordinary);
   const equal=['backgroundColor','padding','minHeight','borderRadius'].every(key=>a[key]===b[key]);box.remove();return equal;
  });
  assert.equal(sameStyle,true);
  checks.push('native values reuse the same numeric controls and visual dimensions as ordinary component fields');
  await page.screenshot({path:require('node:path').join(folder,'mixed-modes.png')});
  assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,checks}));
 }catch(error){await h.finish(error);throw error;}
})().catch(error=>{console.error(error);process.exitCode=1;});
