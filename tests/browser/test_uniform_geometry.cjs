/* Delayed native controls must keep node and group geometry in sync. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {harness}=require('./test_glsl_code.cjs');
(async()=>{
 const [source,state,folder]=process.argv.slice(2),h=await harness(source,state,folder,{skipPreview:true}),{page,checks,errors,settle}=h;
 try{
  await page.evaluate(()=>{
   clearTimeout(autoTimer);autoTimer=null;nativeSourcePolling=uniformPolling=customPolling=true;
   uniformLive.disconnect();uniformLive.connect=()=>{};
   window.resetGeometry=(color=false)=>{
    graph.declarations=[{id:'geometry_uniform',kind:'uniform',name:color?'uColor':'uValue',type:color?'vec4':'float',value:color?[0,0,0,1]:0,nativeSequence:color?'color':'vec'}];
    graph.functions=[];graphTrail=[];stage='pixel';graph.stages.pixel={nodes:[testNode('a','scalar',60,80),testNode('u','uniform',60,300,{declarationId:'geometry_uniform'}),testNode('output','pixel_out',460,280)],edges:[{from:['u','out'],to:['output','color']}]};
    GraphFrames.write(current(),[{id:'geometry_group',name:'inputs',nodes:['a','u']}]);
    nativeSourceSnapshot=null;nativeSourceError='';dirty=false;readonly=false;connectionInterrupted=false;selectedInputId=null;selected=null;selection.clear();past=[];future=[];
    nativeMutationBusy=nativeSourceBusy=nativeValueBusy=submitBusy=false;render();scale=1;pan={x:20,y:20};transform();
    window.geometryGraph=JSON.stringify(graph);
   };
   window.deliverGeometry=()=>receiveNativeSources({revision,enabled:true,graph:clone(graph),declarations:clone(graph.declarations),issues:[],uniforms:graph.declarations.map(d=>({...d,sequence:d.nativeSequence,components:[0,1,2,3].map(i=>({value:i?.5:51.6,parameter:'vec0value'+i,mode:'CONSTANT',writable:true,modeWritable:true}))}))});
   window.geometrySnapshot=()=>{
    const card=$('#cards [data-node="u"]'),frame=$('#groupframes [data-frame="geometry_group"]');
    const node=current().nodes.find(n=>n.id==='u'),port=point(node,'out','outputs'),wire=$('#wires path')?.getPointAtLength(0),layout=nodeLayoutBounds(node);
    return {height:card.offsetHeight,width:card.offsetWidth,bottom:card.offsetTop+card.offsetHeight,frameBottom:frame.offsetTop+frame.offsetHeight,padding:GROUP_FRAME_PADDING,port,wire:wire&&{x:wire.x,y:wire.y},layoutHeight:layout.height};
   };
   resetGeometry();
  });
  const initial=await page.evaluate(()=>geometrySnapshot());
  await page.evaluate(()=>deliverGeometry());await settle();
  const loaded=await page.evaluate(()=>geometrySnapshot());
  const appearance=await page.evaluate(()=>{
   const input=$('#cards [data-node="u"] input'),card=input.closest('.node'),s=getComputedStyle(input),node=getComputedStyle(card);
   return {height:s.height,minHeight:s.minHeight,padding:s.padding,border:s.border,borderRadius:s.borderRadius,font:s.font,lineHeight:s.lineHeight,color:s.color,background:s.backgroundColor,fill:s.getPropertyValue('--numeric-slider-fill'),uniformBg:node.getPropertyValue('--node-uniform-bg'),uniformFg:node.getPropertyValue('--node-uniform-fg'),nodeBackground:node.backgroundColor,uiScale:uiScaleFactor(),inputWidth:input.offsetWidth};
  });
  fs.writeFileSync(path.join(folder,'uniform-appearance.json'),JSON.stringify(appearance,null,2));
  assert(loaded.frameBottom>=loaded.bottom+loaded.padding-1,JSON.stringify({initial,loaded}));
  assert.equal(initial.height,loaded.height,'loading reserves the same scalar control height');
  assert.equal(initial.port.y,loaded.port.y,'control initialization does not shift the output row');
  assert.equal(loaded.height,loaded.layoutHeight,'Frame and Group use the same measured node height');
  assert(Math.abs(loaded.port.x-loaded.wire.x)<1&&Math.abs(loaded.port.y-loaded.wire.y)<1,'wire starts at actual socket center');
  checks.push('delayed source arrival keeps scalar height stable and group encloses it without moving');
  await page.evaluate(()=>{resetGeometry(true);});const colorBefore=await page.evaluate(()=>geometrySnapshot());
  await page.evaluate(()=>deliverGeometry());await settle();const colorAfter=await page.evaluate(()=>geometrySnapshot());
  assert.equal(colorBefore.height,colorAfter.height,'loading reserves the Color palette and compact controls');
  assert(colorAfter.frameBottom>=colorAfter.bottom+colorAfter.padding-1);
  assert.equal(colorBefore.port.y,colorAfter.port.y);
  assert(Math.abs(colorAfter.port.x-colorAfter.wire.x)<1&&Math.abs(colorAfter.port.y-colorAfter.wire.y)<1);
  checks.push('Color source arrival reserves both component row and palette');
  await page.locator('#cards [data-node="u"] .node-values-toggle').click();await settle();
  const expanded=await page.evaluate(()=>geometrySnapshot());assert(expanded.height>colorAfter.height);assert(expanded.frameBottom>=expanded.bottom+expanded.padding-1);
  await page.locator('#cards [data-node="u"] .node-values-toggle').click();await settle();
  assert.equal((await page.evaluate(()=>geometrySnapshot())).height,colorAfter.height);
  checks.push('Color component expansion/collapse updates the enclosing group immediately');
  await page.evaluate(()=>{const card=$('#cards [data-node="u"]');current().nodes.find(n=>n.id==='u').ui.width=310;applyNodeWidth(card,current().nodes.find(n=>n.id==='u'));wires();nativeSourceSnapshot.uniforms[0].components[0].mode='EXPRESSION';nativeSourceSnapshot.uniforms[0].components[0].expression='absTime.seconds';renderNativeSourceValues();});await settle();
  const driven=await page.evaluate(()=>geometrySnapshot());assert.equal(driven.width,310);assert(driven.frameBottom>=driven.bottom+driven.padding-1);assert(Math.abs(driven.port.x-driven.wire.x)<1&&Math.abs(driven.port.y-driven.wire.y)<1);
  await page.evaluate(()=>{nativeSourceSnapshot.uniforms[0].components[0].mode='CONSTANT';renderNativeSourceValues();window.geometryGraph=JSON.stringify(graph);});
  checks.push('mode changes preserve explicit width and keep ports, wires and frame bounds consistent');
  await page.evaluate(()=>{window.geometryCard=$('#cards [data-node="u"]');window.geometryInput=geometryCard.querySelector('input');window.geometryWire=$('#wires path');window.geometryCalls=0;window.originalGeometryWires=wires;wires=()=>{geometryCalls++;return originalGeometryWires();};for(let i=0;i<100;i++){nativeSourceSnapshot.uniforms[0].components[0].value=i;renderNativeSourceValues(new Set(['geometry_uniform']));}});
  assert.deepEqual(await page.evaluate(()=>({calls:geometryCalls,card:geometryCard===$('#cards [data-node="u"]'),input:geometryInput===$('#cards [data-node="u"] input'),wire:geometryWire===$('#wires path'),graph:geometryGraph===JSON.stringify(graph),history:past.length,dirty})),{calls:0,card:true,input:true,wire:true,graph:true,history:0,dirty:false});
  await page.evaluate(()=>{wires=originalGeometryWires;});
  checks.push('100 value updates preserve node/input/wire DOM with no geometry redraw, graph edit or history');
  await page.evaluate(()=>{nativeSourceSnapshot.uniforms[0].missing=true;renderNativeSources();});await settle();const missing=await page.evaluate(()=>geometrySnapshot());
  assert(missing.height<colorAfter.height);assert(missing.frameBottom>=missing.bottom+missing.padding-1);
  await page.evaluate(()=>{nativeSourceSnapshot.uniforms[0].missing=false;renderNativeSources();});await settle();const restored=await page.evaluate(()=>geometrySnapshot());assert.equal(restored.height,colorAfter.height);assert(restored.frameBottom>=restored.bottom+restored.padding-1);
  checks.push('source removal/restoration updates geometry without changing group membership');
  await page.evaluate(()=>{graph.stages.vertex={nodes:[testNode('other','scalar',0,0)],edges:[]};stage='vertex';render();stage='pixel';nativeSourceSnapshot=null;render();deliverGeometry();});await settle();const switched=await page.evaluate(()=>geometrySnapshot());assert(switched.frameBottom>=switched.bottom+switched.padding-1);
  assert.equal(await page.evaluate(()=>past.length),0);
  checks.push('switching away and back with a delayed snapshot keeps the frame correct');
  await page.screenshot({path:path.join(folder,'uniform-group.png')});assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,checks}));
 }catch(error){await h.finish(error);throw error;}
})().catch(error=>{console.error(error);process.exitCode=1;});
