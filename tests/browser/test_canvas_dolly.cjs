const assert=require('node:assert/strict');
const {harness}=require('./test_glsl_code.cjs');
(async()=>{const[source,state,folder]=process.argv.slice(2),h=await harness(source,state,folder,{skipPreview:true}),{page,settle,at,checks,errors}=h;
 const view=()=>page.evaluate(()=>({scale,pan:{...pan}})),data=()=>page.evaluate(()=>JSON.stringify({graph,past,future,selection:[...selection],selected,dirty}));
 const near=(a,b)=>assert.ok(Math.abs(a-b)<.02,`${a} != ${b}`);
 const blank=()=>page.evaluate(()=>{const r=$('#canvas').getBoundingClientRect();return{x:r.left+r.width*.55,y:r.top+r.height*.75};});
 const start=async a=>{await page.mouse.move(a.x,a.y);await page.mouse.down({button:'middle'});};
 try{
  await page.evaluate(()=>{nativeSourcePolling=uniformPolling=customPolling=true;uniformLive.disconnect();uniformLive.connect=()=>{};clearTimeout(autoTimer);scheduleGraphApply=()=>{};readonly=conflicted=connectionInterrupted=dirty=false;graph.functions=[];graphTrail=[];stage='pixel';graph.stages.pixel={nodes:[testNode('a','float',20,120,{value:1}),testNode('b','add',400,120,{type:'float'})],edges:[{from:['a','out'],to:['b','a']}]};selectNode(current().nodes[1]);past=[];future=[];render();setUIExperiments({canvasDamping:false});scale=.7;pan={x:20,y:20};transform();});
  const unchanged=await data();
  for(const ui of [80,100,125]){
   await page.evaluate(ui=>{setUIAppearance('scale',ui);scale=.7;pan={x:20,y:20};transform();},ui);await settle();const a=await blank(),p=await page.evaluate(a=>graphPoint(a.x,a.y),a);
   await start(a);await page.mouse.move(a.x+70*ui/100,a.y,{steps:8});near((await view()).scale,.7*Math.exp(.42));
   const q=await page.evaluate(a=>graphPoint(a.x,a.y),a);near(q.x,p.x);near(q.y,p.y);
   await page.mouse.move(a.x,a.y,{steps:8});near((await view()).scale,.7);
   assert.equal(await page.locator('#canvas').evaluate(e=>getComputedStyle(e).cursor),'zoom-out');
   await page.mouse.move(a.x,a.y-70*ui/100,{steps:8});near((await view()).scale,.7*Math.exp(.42));
   assert.equal(await page.locator('#canvas').evaluate(e=>getComputedStyle(e).cursor),'zoom-in');
   const vertical=await page.evaluate(a=>graphPoint(a.x,a.y),a);near(vertical.x,p.x);near(vertical.y,p.y);
   await page.mouse.move(a.x,a.y,{steps:8});near((await view()).scale,.7);
   await page.mouse.move(a.x+35*ui/100,a.y-35*ui/100,{steps:8});near((await view()).scale,.7*Math.exp(.42));
   await page.mouse.move(a.x,a.y,{steps:8});near((await view()).scale,.7);await page.mouse.up({button:'middle'});assert.equal(await data(),unchanged);
   assert.equal(await page.locator('#canvas.canvas-dolly,#canvas.canvas-dolly-out').count(),0);
  }
  checks.push('Right/up enlarge, left/down reduce, diagonal movement combines both axes; zoom cursors follow direction, anchor stays fixed across UI scales and graph/history/selection do not change');
  await page.evaluate(()=>{setUIAppearance('scale',100);scale=1;transform();});await settle();let a=await blank();await start(a);
  await page.mouse.move(a.x+400,a.y);near((await view()).scale,1.7);await page.mouse.move(a.x+380,a.y);assert.ok((await view()).scale<1.7);
  await page.mouse.move(a.x-400,a.y);near((await view()).scale,.25);await page.mouse.move(a.x-380,a.y);assert.ok((await view()).scale>.25);await page.mouse.up({button:'middle'});
  checks.push('Existing 25–170% limits apply and reversing at a limit responds immediately');
  await page.evaluate(()=>{scale=.7;pan={x:20,y:20};transform();});const initial=await view();a=await blank();await start(a);await page.mouse.move(a.x+60,a.y);await page.keyboard.press('Escape');await page.mouse.up({button:'middle'});assert.deepEqual(await view(),initial);
  await start(a);await page.mouse.move(a.x+60,a.y);await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.mouse.up({button:'middle'});assert.deepEqual(await view(),initial);assert.equal(await page.evaluate(()=>!!$('#canvas').onpointermove),false);
  await start(a);await page.mouse.up({button:'middle'});assert.equal(await data(),unchanged);
  checks.push('Escape/blur restore the starting view and clean up capture; a middle click does not clear selection');
  for(const selector of ['#cards [data-node="b"] .node-title','#cards [data-node="b"] .port[data-kind="inputs"][data-port="a"]','#zoom']){
   const p=await at(selector),before=await view();await start(p);await page.mouse.move(p.x+50,p.y);await page.mouse.up({button:'middle'});assert.deepEqual(await view(),before,selector);
  }
  const wire=await page.evaluate(()=>{const p=$('#wires path[data-from]'),q=p.getPointAtLength(p.getTotalLength()/2),v=new DOMPoint(q.x,q.y).matrixTransform(p.getScreenCTM());return{x:v.x,y:v.y};}),wireView=await view();await start(wire);await page.mouse.move(wire.x+50,wire.y);await page.mouse.up({button:'middle'});assert.deepEqual(await view(),wireView);
  await page.evaluate(()=>workspaceLayout.setFloatingParameter(true));const p=await at('#floatingparameters .node-inspector-title'),before=await view();await start(p);await page.mouse.move(p.x+50,p.y);await page.mouse.up({button:'middle'});assert.deepEqual(await view(),before);
  await page.evaluate(()=>workspaceLayout.setFloatingParameter(false));
  const field=await at('#cards [data-node="a"] input');await start(field);assert.equal(await page.evaluate(()=>!!valueLadder||!!pendingValueLadder),true);assert.equal(await page.locator('#canvas.canvas-dolly').count(),0);await page.keyboard.press('Escape');await page.mouse.up({button:'middle'});
  checks.push('Node titles/ports, toolbar and floating Parameter do not start dolly; numeric middle-click retains Value Ladder');
  await page.evaluate(()=>{readonly=true;setUIExperiments({canvasDamping:true});});a=await blank();const s=(await view()).scale;await start(a);await page.mouse.move(a.x+50,a.y,{steps:8});await page.mouse.up({button:'middle'});near((await view()).scale,s*Math.exp(.3));
  checks.push('Readonly navigation works with existing canvas damping');
  await page.evaluate(()=>{setUIExperiments({canvasDamping:false});});a=await blank();const beforePan=await view(),beforeData=await data();await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(a.x+30,a.y+20);await page.mouse.up();near((await view()).pan.x,beforePan.pan.x+30);near((await view()).pan.y,beforePan.pan.y+20);
  const oldScale=(await view()).scale;await page.mouse.wheel(0,100);await settle();near((await view()).scale,oldScale*Math.exp(-.1));assert.equal(await data(),beforeData);
  checks.push('Left-drag pan and wheel zoom retain existing behavior');
  assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,checks}));
 }catch(e){await h.finish(e);throw e;}
})().catch(e=>{console.error(e);process.exitCode=1;});
