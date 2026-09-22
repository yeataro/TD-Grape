const assert=require('node:assert/strict'),path=require('node:path');
const {harness}=require('./test_glsl_code.cjs');
(async()=>{
 const [source,state,folder]=process.argv.slice(2),h=await harness(source,state,folder,{skipPreview:true}),{page,checks,errors,settle}=h;
 const setup=()=>page.evaluate(()=>{
  nativeSourcePolling=uniformPolling=customPolling=true;uniformLive.disconnect();uniformLive.connect=()=>{};clearTimeout(autoTimer);scheduleGraphApply=()=>{};
  stage='pixel';graphTrail=[];graph.functions=[];graph.declarations=[];readonly=dirty=connectionInterrupted=false;past=[];future=[];selection.clear();selected=selectedEdge=null;
  graph.stages.pixel={nodes:[testNode('a','scalar',0,100),testNode('b','add',500,100),testNode('c','add',0,450),testNode('d','add',500,450)],edges:[{from:['a','out'],to:['b','a'],ui:{style:'link',kept:true}},{from:['a','out'],to:['c','a'],ui:{style:'link'}},{from:['a','out'],to:['d','a']},{from:['c','out'],to:['b','b'],ui:{style:'link'}}]};
  setUIExperiments({frameDamping:false});setLinkLinesVisible(false);render();fit();window.originalLinks=JSON.stringify(graph);window.originalContent=layoutContent(graph);
 });
 const outgoing=()=>page.locator('[data-node=a] .link-port-navigation[data-link-kind=outputs]');
 const action=()=>page.locator('[data-link-to-wire]');
 const styles=()=>page.evaluate(()=>current().edges.map(e=>e.ui?.style||'wire'));
 try{
  await setup();await outgoing().click({button:'right'});await action().click();
  assert.deepEqual(await styles(),['wire','wire','wire','link']);assert.equal(await page.evaluate(()=>past.length),1);assert.deepEqual(await page.evaluate(()=>current().edges[0].ui),{kept:true});assert.equal(await outgoing().count(),0);
  assert.equal(await page.evaluate(()=>layoutContent(graph)===originalContent),true);
  await page.evaluate(()=>undo());assert.equal(await page.evaluate(()=>JSON.stringify(graph)===originalLinks),true);assert.equal(await outgoing().count(),1);
  await page.evaluate(()=>undo(true));assert.deepEqual(await styles(),['wire','wire','wire','link']);
  checks.push('outgoing bulk conversion changes only represented Links, preserves other UI/graph semantics and supports one-step Undo/Redo');
  await setup();
  await page.evaluate(()=>openLinkTargets({node:'b',kind:'inputs',ports:['a']},500,250));await action().click();assert.deepEqual(await styles(),['wire','link','wire','link']);
  checks.push('expanded input conversion excludes the other input and unrelated Links');
  await setup();await page.evaluate(()=>{current().nodes.find(n=>n.id==='b').ui.collapsed=true;render();fit();});
  const incoming=()=>page.locator('[data-node=b] .link-port-navigation[data-link-kind=inputs]');
  for(const theme of ['dark','light']){
   await page.evaluate(theme=>setUIAppearance('theme',theme),theme);await incoming().click({button:'right'});
   const marks=await page.locator('[data-link-target] .link-target-category').evaluateAll(es=>es.map(e=>({category:e.dataset.category,color:getComputedStyle(e).backgroundColor,width:e.offsetWidth,height:e.offsetHeight,text:getComputedStyle(e.parentElement).color})));
   assert.equal(marks.length,2);assert.equal(marks[0].width,3);assert.equal(marks[0].height,18);assert.notEqual(marks[0].color,marks[1].color);assert.equal(marks[0].text,marks[1].text);
   if(theme==='dark')await page.screenshot({path:path.join(folder,'menu.png')});await page.keyboard.press('Escape');
  }
  await incoming().click({button:'right'});await action().click();assert.deepEqual(await styles(),['wire','link','wire','wire']);assert.equal(await incoming().count(),0);
  checks.push('collapsed input arrow converts both represented inputs; destination/source entries have small category strips and neutral text in both themes');
  await setup();await page.evaluate(()=>{readonly=true;render();});await outgoing().click({button:'right'});assert.equal(await action().isDisabled(),true);await action().evaluate(e=>e.click());assert.deepEqual(await styles(),['link','link','wire','link']);
  await page.locator('[data-link-target=b]').click();assert.equal(await page.evaluate(()=>selected),'b');
  await setup();await outgoing().click({button:'right'});await page.evaluate(()=>{graph=clone(graph);window.replacedGraph=JSON.stringify(graph);});await action().click();assert.equal(await page.evaluate(()=>JSON.stringify(graph)===replacedGraph),true);
  checks.push('readonly preserves navigation while blocking conversion; stale menu cannot mutate a replaced graph');
  assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,count:checks.length}));
 }catch(e){await h.finish(e);throw e;}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
