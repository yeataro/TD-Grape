/* Human-facing slice: actual gestures/UI + proof that the TS planner is used. */
const assert=require('node:assert/strict'),path=require('node:path');
const {harness}=require('./test_glsl_code.cjs');
const [source,stateFile,folder]=process.argv.slice(2);
(async()=>{
  const h=await harness(source,stateFile,folder,{skipPreview:true}),{page,checks,errors,at,drag,settle}=h;
  page.setDefaultTimeout(6000);
  try{
    await page.evaluate(()=>{
      const original=GrapeWirePlanning.plan;window.plannerCalls={wire:0,infer:0};
      GrapeWirePlanning.plan=(g,c,intent,...rest)=>{plannerCalls[intent.kind]++;return original(g,c,intent,...rest);};
      clearTimeout(autoTimer);scheduleGraphApply=()=>{};connectionInterrupted=true;conflicted=false;readonly=false;historyBusy=nativeMutationBusy=false;
      stage='pixel';graph.target='top';graphTrail=[];graph.functions=[];graph.declarations=[];past=[];future=[];selected=selectedEdge=null;selection.clear();
      const op=testNode('op','multiply',450,120,{type:'float'});op.ui.typeMode='auto';op.inputValues={b:7};
      graph.stages.pixel={nodes:[testNode('source','vector',50,60,{type:'vec3',components:[1,2,3,4]}),testNode('scalar','scalar',50,400,{type:'float',value:2}),op],edges:[]};
      rememberSavedGraph(graph);render();scale=.8;pan={x:20,y:20};transform();
    });await settle();
    const port=(id,kind,name)=>`#cards [data-node="${id}"] .port[data-kind="${kind}"][data-port="${name}"]`;
    const snapshot=()=>page.evaluate(()=>JSON.stringify({graph,past,future}));
    const initial=await page.evaluate(()=>JSON.stringify(graph));
    await drag(await at(port('source','outputs','out')),await at(port('op','inputs','a')));
    assert.equal(await page.evaluate(()=>past.length),1);assert.equal(await page.evaluate(()=>ports(current().nodes.find(n=>n.id==='op'),'outputs').out),'vec3');
    const connected=await page.evaluate(()=>JSON.stringify(graph));
    await page.locator('#undo').click();assert.equal(await page.evaluate(()=>JSON.stringify(graph)),initial);
    await page.locator('#redo').click();assert.equal(await page.evaluate(()=>JSON.stringify(graph)),connected);
    checks.push('Actual vector drag uses TypeScript, preserves hand-entered defaults, one Undo/Redo restores exact graphs');
    await drag(await at(port('scalar','outputs','out')),await at(port('op','inputs','a')));
    assert.equal(await page.evaluate(()=>current().edges[0].from[0]),'scalar');assert.equal(await page.evaluate(()=>past.length),2);
    await page.locator('#undo').click();assert.equal(await page.evaluate(()=>JSON.stringify(graph)),connected);
    checks.push('Replacing an occupied input is one transaction and Undo restores the original source and values');
    const before=await snapshot(),a=await at(port('source','outputs','out')),b=await at(port('op','inputs','b'));
    await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:8});await page.keyboard.press('Escape');await page.mouse.up();await settle();
    assert.equal(await snapshot(),before);checks.push('Escape during a real wire gesture leaves the graph and history unchanged');
    await drag(await at(port('op','outputs','out')),await at(port('op','inputs','b')));assert.equal(await snapshot(),before);
    checks.push('A cycle is rejected without graph/history mutation');
    // Use a separate locked receiver to isolate validation of the attempted wire.
    await page.evaluate(()=>{const locked=testNode('locked','add',450,500,{type:'vec2'});locked.ui.typeMode='locked';current().nodes.push(locked);render();});await settle();
    const lockedBefore=await snapshot();await drag(await at(port('source','outputs','out')),await at(port('locked','inputs','a')));assert.equal(await snapshot(),lockedBefore);
    checks.push('Incompatible locked vector input is rejected without edits');
    const createBefore=await page.evaluate(()=>JSON.stringify(graph)),pastBefore=await page.evaluate(()=>past.length);
    await drag(await at(port('source','outputs','out')),{x:1030,y:730});
    await page.locator('#createsearch').fill('multiply');
    await page.locator('[data-create-entry="multiply"]').click();await settle();
    assert.equal(await page.evaluate(()=>past.length),pastBefore+1);
    const created=await page.evaluate(()=>({key:definition(current().nodes.find(n=>n.id===selected)).key,type:ports(current().nodes.find(n=>n.id===selected),'outputs').out}));
    assert.deepEqual(created,{key:'multiply',type:'vec3'});
    await page.screenshot({path:path.join(folder,'wire-creator.png')});
    await page.locator('#undo').click();assert.equal(await page.evaluate(()=>JSON.stringify(graph)),createBefore);
    await page.locator('#redo').click();
    checks.push('Dragging into empty canvas creates Multiply and its wire through the original Creator; one Undo removes both');
    const failure=await page.evaluate(()=>{
      const original=GrapeWirePlanning.plan,before=JSON.stringify({graph,past,future});
      try{GrapeWirePlanning.plan=()=>{throw Error('test planner failure');};return {ok:connectPorts({node:'source',kind:'outputs',port:'out'},{node:'op',kind:'inputs',port:'b'}),unchanged:before===JSON.stringify({graph,past,future})};}
      finally{GrapeWirePlanning.plan=original;}
    });assert.deepEqual(failure,{ok:false,unchanged:true});checks.push('Planner failures do not silently retry legacy or commit an edit');
    const calls=await page.evaluate(()=>plannerCalls);assert.ok(calls.wire>0&&calls.infer>0,JSON.stringify(calls));
    await page.evaluate(()=>{graph.target='mat';editorTarget='mat';graph.stages.vertex={nodes:[],edges:[]};render();});await settle();
    const matBefore=await page.evaluate(()=>JSON.stringify(graph));
    await drag(await at(port('scalar','outputs','out')),await at(port('op','inputs','b')));
    assert.notEqual(await page.evaluate(()=>JSON.stringify(graph)),matBefore);
    await page.locator('#undo').click();assert.equal(await page.evaluate(()=>JSON.stringify(graph)),matBefore);
    assert.deepEqual(await page.evaluate(()=>plannerCalls),calls);
    checks.push('MAT editor mode still connects and undoes through the original planner; TypeScript route stays unused');
    assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,count:checks.length,calls}));
  }catch(error){await h.finish(error);throw error;}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
