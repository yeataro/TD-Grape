const assert=require('node:assert/strict'),path=require('node:path');
const {harness}=require('./test_glsl_code.cjs');
(async()=>{
 const [source,state,folder]=process.argv.slice(2),h=await harness(source,state,folder,{skipPreview:true}),{page,checks,errors}=h;
 const setup=()=>page.evaluate(()=>{
  nativeSourcePolling=uniformPolling=customPolling=true;uniformLive.disconnect();uniformLive.connect=()=>{};clearTimeout(autoTimer);scheduleGraphApply=()=>{};
  stage='pixel';graphTrail=[];graph.functions=[];graph.declarations=[];readonly=dirty=connectionInterrupted=false;past=[];future=[];selected=selectedEdge=null;selection.clear();
  graph.stages.pixel={nodes:[testNode('s','vector_split',0,100,{type:'vec2'}),testNode('b','add',400,100),testNode('c','add',800,100),testNode('d','add',800,500),testNode('e','scalar',400,500)],edges:[{from:['s','x'],to:['b','a'],ui:{kept:true}},{from:['s','x'],to:['c','a']},{from:['s','y'],to:['b','b']},{from:['b','out'],to:['c','b']},{from:['c','out'],to:['d','a']},{from:['e','out'],to:['d','b']}]};render();fit();window.baseline=JSON.stringify(graph);window.semantic=layoutContent(graph);
 });
 const styles=()=>page.evaluate(()=>current().edges.map(e=>e.ui?.style||'wire'));
 const openNodes=ids=>page.evaluate(ids=>{selectedEdge=null;selection=new Set(ids);selected=ids.at(-1);refreshCanvasSelection();openGraphMenu(600,350,selected);},ids);
 try{
  await setup();await page.evaluate(()=>openGraphMenu(600,350,null,{edge:current().edges[0]}));
  const sourceAction=page.locator('[data-edit=sourceLinks]');assert.equal(await sourceAction.getAttribute('role'),'menuitem');assert.equal(await sourceAction.getAttribute('aria-checked'),null);
  assert.ok(await page.locator('[data-edit=selectDestination]').evaluate(e=>e.nextElementSibling?.dataset.edit==='sourceLinks'));
  await sourceAction.click();assert.deepEqual(await styles(),['link','link','wire','wire','wire','wire']);assert.equal(await page.evaluate(()=>past.length),1);assert.equal(await page.evaluate(()=>layoutContent(graph)===semantic),true);
  await page.evaluate(()=>undo());assert.equal(await page.evaluate(()=>JSON.stringify(graph)===baseline),true);await page.evaluate(()=>undo(true));
  await page.evaluate(()=>openGraphMenu(600,350,null,{edge:current().edges[0]}));assert.equal(await sourceAction.isDisabled(),true);await page.keyboard.press('Escape');
  checks.push('wire menu source action converts all wires of that exact output socket only; action role, one Undo/Redo and no-op disabled');
  for(const ids of [['b'],['b','c']])for(const side of ['to','from'])for(const style of ['link','wire']){
   await setup();if(style==='wire')await page.evaluate(()=>{for(const e of current().edges)e.ui={...e.ui,style:'link'};render();window.baseline=JSON.stringify(graph);window.semantic=layoutContent(graph);});
   const before=await styles();const affected=await page.evaluate(({ids,side})=>current().edges.map((e,i)=>ids.includes(e[side][0])?i:-1).filter(i=>i>=0),{ids,side});
   await openNodes(ids);await page.locator('[data-edit=convertWires]').click();
   assert.deepEqual(await page.locator('#graphwirestylesubmenu button').evaluateAll(es=>es.map(e=>e.dataset.wireConvert)),['to-link','to-wire','from-link','from-wire']);
   await page.locator('[data-wire-convert="'+side+'-'+style+'"]').click();const expected=before.map((v,i)=>affected.includes(i)?style:v);assert.deepEqual(await styles(),expected);
   assert.equal(await page.evaluate(()=>past.length),1);assert.equal(await page.evaluate(()=>layoutContent(graph)===semantic),true);
   await page.evaluate(()=>undo());assert.equal(await page.evaluate(()=>JSON.stringify(graph)===baseline),true);
  }
  checks.push('all four conversions on single and multiple nodes affect only the chosen direction, including internal edges exactly once, and undo atomically');
  await setup();await openNodes(['b','c']);const trigger=page.locator('[data-edit=convertWires]');await trigger.focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('#graphwirestylesubmenu').isVisible(),true);await page.keyboard.press('Escape');assert.equal(await trigger.evaluate(e=>e===document.activeElement),true);
  await page.locator('[data-edit=arrange]').hover();assert.equal(await page.locator('#grapharrangesubmenu').isVisible(),true);await trigger.hover();assert.equal(await page.locator('#grapharrangesubmenu').isVisible(),false);assert.equal(await page.locator('#graphwirestylesubmenu').isVisible(),true);
  await page.screenshot({path:path.join(folder,'submenu.png')});await page.keyboard.press('Escape');
  await openNodes(['b','c']);await page.locator('[data-edit=arrange]').focus();await page.keyboard.press('ArrowRight');await page.locator('#grapharrangesubmenu [data-arrange=left]').click();assert.equal(await page.evaluate(()=>current().nodes.find(n=>n.id==='b').ui.x===current().nodes.find(n=>n.id==='c').ui.x),true);
  checks.push('hover/click/keyboard open exclusive submenus; Escape returns focus; existing Arrange submenu still executes');
  await setup();await page.evaluate(()=>{readonly=true;});await openNodes(['b','c']);assert.equal(await trigger.isDisabled(),true);
  await page.evaluate(()=>openGraphMenu(600,350,null,{edge:current().edges[0]}));assert.equal(await sourceAction.isDisabled(),true);
  await setup();await openNodes(['b','c']);await trigger.click();await page.evaluate(()=>{selection=new Set(['d']);selected='d';});await page.locator('[data-wire-convert=to-link]').click();assert.equal(await page.evaluate(()=>JSON.stringify(graph)===baseline),true);
  await openNodes(['b']);await trigger.click();await page.evaluate(()=>{graph=clone(graph);});await page.locator('[data-wire-convert=to-link]').click();assert.equal(await page.evaluate(()=>JSON.stringify(graph)===baseline),true);
  checks.push('readonly disables writes and stale selection/document menus cannot change the graph');
  assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,count:checks.length}));
 }catch(e){await h.finish(e);throw e;}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
