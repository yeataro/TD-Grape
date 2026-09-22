const assert=require('node:assert/strict'),path=require('node:path');
const {harness}=require('./test_glsl_code.cjs');
(async()=>{
 const[source,state,folder]=process.argv.slice(2),h=await harness(source,state,folder,{skipPreview:true}),{page,checks,errors,settle}=h;
 try{
  await page.selectOption('#language','en');
  await page.evaluate(()=>{
   nativeSourcePolling=uniformPolling=customPolling=true;uniformLive.disconnect();uniformLive.connect=()=>{};clearTimeout(autoTimer);scheduleGraphApply=()=>{};
   graph.declarations=[{id:'gain',kind:'uniform',name:'uGain',type:'float',value:.5},{id:'constant',kind:'constant',name:'cValue',type:'vec3',value:[.1,.2,.3]},{id:'spec',kind:'spec_constant',name:'sValue',type:'int',value:3,constantId:0}];
   nativeSourceSnapshot={enabled:true,revision,uniforms:[{...graph.declarations[0],sequence:'vec',components:[{value:.5,mode:'CONSTANT',writable:true}],nameWritable:true,expected:{id:'gain'}}],specConstants:[{...graph.declarations[2],sequence:'const',components:[{value:3,mode:'CONSTANT',writable:true}],nameWritable:true,expected:{id:'spec'}}],issues:[]};
   graph.stages.pixel={nodes:[testNode('output','pixel_out',450,0),testNode('gain_node','uniform',0,0,{declarationId:'gain'})],edges:[]};graphTrail=[];stage='pixel';graph.functions=[];selected=null;selection.clear();selectedInputId=null;readonly=dirty=connectionInterrupted=false;past=[];future=[];inputCollapsedGroups.clear();sourceCardCollapsed.clear();render();workspaceLayout.reveal('uniforms');window.initial=JSON.stringify(graph);
  });
  assert.equal(await page.locator('#uniformstoggle').innerText(),'Sources');
  const layout=await page.evaluate(()=>{const a=$('#inputsearch').getBoundingClientRect(),b=$('#sourcenames').getBoundingClientRect(),p=$('.input-search-tools').getBoundingClientRect();return{searchBottom:a.bottom,nameTop:b.top,width:a.width,parent:p.width};});
  assert.ok(layout.nameTop>=layout.searchBottom);assert.ok(Math.abs(layout.width-layout.parent)<1);
  assert.deepEqual(await page.locator('#nativeuniforms > [data-input-group]').evaluateAll(es=>es.slice(0,3).map(e=>e.dataset.inputGroup)),['uniform','constant','spec_constant']);
  await page.evaluate(()=>{window.keptControl=$('[data-input-source="gain"] input');});
  const note=page.locator('[data-input-source="gain"] .source-card-note');assert.ok(await note.isVisible());
  await page.locator('#sourcenotes').uncheck();assert.equal(await note.isVisible(),false);await page.locator('#sourcenotes').check();
  assert.ok(await page.evaluate(()=>keptControl===$('[data-input-source="gain"] input')));
  assert.ok(await page.evaluate(()=>{const c=$('[data-input-source="gain"]');return c.querySelector('.source-card-outputs').getBoundingClientRect().bottom<=c.querySelector('input').getBoundingClientRect().top;}));
  assert.equal(await page.evaluate(()=>JSON.stringify(graph)===initial&&past.length===0),true);
  checks.push('Sources label, full-width search, separate display row, default category order, notes and top outputs preserve graph and controls');
  await page.evaluate(()=>{selectNode(current().nodes.find(n=>n.id==='gain_node'));inspectorTab='parameters';inspector();workspaceLayout.reveal('parameters');});
  assert.equal(await page.locator('#inspector [data-inspect-input]').count(),0);assert.ok(await page.locator('#inspector [data-native-components]').count());
  await page.locator('.parameter-tabs button').filter({hasText:'Settings'}).click();
  await page.locator('#inspector [data-inspect-input="gain"]').click();assert.equal(await page.evaluate(()=>selectedInputId),'gain');
  checks.push('source editing opens from Settings while live values stay in Parameters');
  await page.screenshot({path:path.join(folder,'sources.png')});assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,checks}));
 }catch(e){await h.finish(e);throw e;}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
