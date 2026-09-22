const assert=require('node:assert/strict'),path=require('node:path');
const {harness}=require('./test_glsl_code.cjs');
(async()=>{
 const [source,state,folder]=process.argv.slice(2),h=await harness(source,state,folder,{skipPreview:true}),{page,checks,errors,settle}=h;
 let calls=0,mode='normal',deferred=[];
 await page.route('**/api/validate',async route=>{
  const id=++calls;
  if(mode==='deferred'){deferred.push({id,route});return;}
  if(mode==='error')return route.fulfill({status:422,json:{error:'Test invalid graph'}});
  await route.fulfill({json:{vertex:'// vertex '+id+'\nvoid main() { gl_Position = vec4(0.0); }',pixel:'// pixel '+id+'\nvoid main() { /* <img src=x> */ }'}});
 });
 const viewer=()=>page.locator('#cards [data-generated-glsl]');
 try{
  await page.evaluate(()=>{nativeSourcePolling=uniformPolling=customPolling=true;uniformLive.disconnect();uniformLive.connect=()=>{};clearTimeout(autoTimer);scheduleGraphApply=()=>{};readonly=dirty=connectionInterrupted=false;past=[];future=[];selection.clear();selected=selectedEdge=null;});
  await page.evaluate(()=>{const r=$('#canvas').getBoundingClientRect();openCreator(r.left+180,r.top+150);});
  await page.locator('#createsearch').fill('Generated GLSL');await page.locator('[data-create-entry="generated_glsl"]').click();
  await viewer().filter({hasText:'// pixel'}).waitFor();
  assert.equal(await viewer().locator('img').count(),0);assert.equal(await viewer().locator('.glsl-type').count()>0,true);
  assert.equal(await page.locator('#cards [data-comment-node]').count(),0);assert.equal(await viewer().evaluate(e=>e.isContentEditable),false);
  const id=await page.evaluate(()=>selected);checks.push('search creates a Note-like read-only stage viewer with safe GLSL highlighting');
  await page.evaluate(()=>{window.before=JSON.stringify(graph);window.beforeHistory=past.length;duplicateSelection();});
  assert.equal(await page.evaluate(()=>JSON.stringify(graph)===before&&past.length===beforeHistory),true);
  await page.evaluate(()=>{window.payload=copyGraphSelection();pasteGraphSelection(payload,{x:600,y:100});});
  assert.equal(await page.evaluate(()=>JSON.stringify(graph)===before&&past.length===beforeHistory),true);
  assert.equal(await page.evaluate(()=>availableEntries().some(d=>d.key==='generated_glsl')),false);
  checks.push('duplicate and paste reject a second viewer atomically; creation entry disappears until removal');
  const card=()=>page.locator('[data-node="'+id+'"]');
  const blackNoteBackground=()=>page.evaluate(()=>{
   const n={id:'note-color-comparison',definitionUuid:'sgrape.builtin.comment',params:{},ui:{noteColor:'#000000'}};
   const card=renderNodeCard(n,$('#cards'),[]),background=getComputedStyle(card).backgroundColor;card.remove();return background;
  });
  for(const theme of ['light','dark']){
   await page.evaluate(theme=>setUIAppearance('theme',theme),theme);
   assert.equal(await card().evaluate(e=>getComputedStyle(e).backgroundColor),await blackNoteBackground());
  }
  await page.evaluate(()=>{inspectorTab='settings';inspector();});
  const font=()=>page.locator('#inspector [data-note-font-scale]');
  assert.equal(await font().getAttribute('min'),'0.1');await font().fill('0.1');await font().press('Enter');await settle();
  assert.equal(await viewer().evaluate(e=>parseFloat(getComputedStyle(e).fontSize)),1.2);
  await font().fill('0');await font().press('Enter');await settle();assert.equal(await font().inputValue(),'0.1');
  await font().fill('1');await font().press('Enter');await settle();
  await page.locator('#inspector [data-note-color-setting]').click();
  assert.equal(await page.locator('.group-frame-palette-grid .group-frame-preset').count(),12);
  assert.equal(await page.locator('[data-frame-color-preset="#000000"]').count(),0);
  assert.equal(await page.locator('[data-note-color-default]').evaluate(e=>getComputedStyle(e).getPropertyValue('--swatch-color')),'#000000');
  await page.locator('[data-note-color-default]').click();
  assert.equal(await card().evaluate(e=>getComputedStyle(e).backgroundColor),await blackNoteBackground());
  await page.evaluate(()=>{const n=current().nodes.find(n=>n.id===selected);n.ui.width=2400;n.ui.height=2400;render();});
  assert.deepEqual(await card().evaluate(e=>[e.offsetWidth,e.offsetHeight,nodeMaximumWidth(e),nodeHeightLimits(e).maximum]),[2400,2400,3000,3000]);
  await page.evaluate(()=>{const n=current().nodes.find(n=>n.id===selected);n.ui.width=480;n.ui.height=300;inspectorTab='parameters';render();});
  checks.push('black default/palette match Note blending in both themes, 0.1 font scale and enlarged two-axis bounds');
  const originalCalls=calls;await page.evaluate(()=>change(()=>{current().nodes.find(n=>n.definitionUuid==='sgrape.builtin.generated_glsl').ui.noteColor='#729ca4';},{localize:false}));
  await page.waitForTimeout(300);assert.equal(calls,originalCalls);assert.equal(await page.locator('[data-node="'+id+'"] .note-color-button').count(),1);
  assert.equal(await page.locator('[data-node="'+id+'"] .node-resize-handle').count(),1);
  const size=await page.locator('[data-node="'+id+'"]').evaluate(e=>[e.style.width,e.style.height]);assert.deepEqual(size,['480px','300px']);
  checks.push('Note title/color/two-axis sizing are reused; presentation changes do not request new code');
  await page.screenshot({path:path.join(folder,'viewer.png')});
  await page.evaluate(()=>change(()=>{const node=current().nodes.find(n=>n.definitionUuid==='sgrape.builtin.color');node.params.value[0]=0.2;},{redraw:false}));
  await page.waitForFunction(()=>generatedGLSLCache.state==='ready'&&generatedGLSLCache.text.startsWith('// pixel 2'));
  assert.equal(calls,originalCalls+1);checks.push('semantic edits update code even when the editor patches controls without a full redraw');
  mode='deferred';await page.evaluate(()=>refreshGeneratedGLSL(true));await page.waitForFunction(()=>generatedGLSLCache.state==='loading');
  await page.waitForTimeout(300);assert.equal(deferred.length,1);
  await page.evaluate(()=>{stage='vertex';graph.target='mat';editorTarget='mat';graph.stages.vertex||={nodes:[],edges:[]};graphTrail=[];render();const d=catalog.find(d=>d.key==='generated_glsl');addNode(d,80,80);});
  await page.waitForTimeout(300);assert.equal(deferred.length,2);
  await deferred[1].route.fulfill({json:{vertex:'// NEW vertex',pixel:'// NEW pixel'}});await viewer().filter({hasText:'// NEW vertex'}).waitFor();
  await deferred[0].route.fulfill({json:{vertex:'// OLD vertex',pixel:'// OLD pixel'}});await settle();assert.equal(await viewer().textContent(),'// NEW vertex');
  checks.push('Vertex and Pixel each allow one viewer; delayed previous-stage response cannot overwrite current code');
  mode='error';await page.evaluate(()=>refreshGeneratedGLSL(true));await viewer().filter({hasText:'Test invalid graph'}).waitFor();assert.ok(!(await viewer().textContent()).includes('NEW'));
  mode='normal';await page.getByRole('button',{name:'Refresh GLSL',exact:true}).click();await viewer().filter({hasText:'// vertex'}).waitFor();
  checks.push('generation errors replace stale code and explicit Refresh recovers');
  await page.evaluate(()=>{stage='pixel';graphTrail=[];render();newFunction();enterFunction(current().nodes.find(n=>n.id===selected));addNode(catalog.find(d=>d.key==='generated_glsl'),80,80);});
  await viewer().filter({hasText:'// pixel'}).waitFor();
  assert.equal(await page.evaluate(()=>current().nodes.filter(n=>n.definitionUuid==='sgrape.builtin.generated_glsl').length),1);
  checks.push('subgraph canvas has its own viewer and displays the containing stage GLSL');
  await page.evaluate(()=>{readonly=true;render();});await viewer().filter({hasText:'// pixel'}).waitFor();assert.equal(await viewer().evaluate(e=>e.isContentEditable),false);
  await page.evaluate(()=>{readonly=false;remove();});assert.equal(await viewer().count(),0);assert.equal(await page.evaluate(()=>availableEntries().some(d=>d.key==='generated_glsl')),true);
  await page.evaluate(()=>undo());await viewer().filter({hasText:'// pixel'}).waitFor();assert.equal(await page.evaluate(()=>availableEntries().some(d=>d.key==='generated_glsl')),false);
  checks.push('readonly display and delete/Undo keep the singleton availability consistent');
  assert.equal(await page.evaluate(()=>JSON.stringify(graph).includes('// pixel')),false);assert.deepEqual(errors,[]);
  await h.finish();console.log(JSON.stringify({passed:true,count:checks.length}));
 }catch(e){for(const item of deferred)await item.route.abort().catch(()=>{});await h.finish(e);throw e;}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});

