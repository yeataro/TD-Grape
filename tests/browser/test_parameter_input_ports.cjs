/* Proxy Input sockets operate on original nodes; no panel wiring is serialized. */
const assert=require('node:assert/strict'),path=require('node:path');
const {harness}=require('./test_glsl_code.cjs');
(async()=>{
 const[source,state,folder]=process.argv.slice(2),h=await harness(source,state,folder,{skipPreview:true,touch:true}),{page,checks,errors,at,drag,settle}=h;page.setDefaultTimeout(6000);
 const proxy=p=>`#floatingparameters .parameter-input-port[data-port="${p}"]`,output=id=>`#cards .node[data-node="${id}"] .port[data-kind="outputs"]`;
 const snapshot=()=>page.evaluate(()=>JSON.stringify({graph,past,future}));
 const choose=async id=>{await page.evaluate(id=>{document.activeElement?.blur();selectNode(current().nodes.find(n=>n.id===id));inspectorTab='parameters';inspector();},id);await settle();};
 const begin=async(a,b)=>{await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:8});await settle();};
 const previewEnds=()=>page.evaluate(()=>{const p=$('.parameter-wire-preview path'),m=p.getScreenCTM(),a=p.getPointAtLength(0),b=p.getPointAtLength(p.getTotalLength());return[a,b].map(q=>{const v=new DOMPoint(q.x,q.y).matrixTransform(m);return{x:v.x,y:v.y};});});
 const near=(a,b)=>assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<2,JSON.stringify({a,b}));
 try{
  await page.evaluate(()=>{
   nativeSourcePolling=uniformPolling=customPolling=true;uniformLive.disconnect();uniformLive.connect=()=>{};clearTimeout(autoTimer);scheduleGraphApply=()=>{};
   readonly=conflicted=connectionInterrupted=dirty=false;graph.declarations=[];graph.functions=[];stage='pixel';graphTrail=[];
   graph.stages.pixel={nodes:[testNode('one','float',30,80,{value:1}),testNode('two','float',30,290,{value:2}),testNode('target','add',370,120,{type:'float'}),testNode('vector','vector',30,550,{type:'vec4',components:[1,2,3,4]}),testNode('code','glsl_code',650,500)],edges:[]};
   past=[];future=[];selectNode(current().nodes[2]);render();pan={x:20,y:20};scale=.8;transform();workspaceLayout.setFloatingParameter(true);
  });await settle();
  assert.equal(await page.evaluate(()=>parameterInputPorts),true);
  assert.deepEqual(await page.locator('.parameter-input-port').evaluateAll(es=>es.map(e=>e.dataset.port)),['a','b']);
  assert.equal(await page.locator('#parameter-sidebar .parameter-input-port').count(),0);
  const a=await at(output('one')),b=await at(proxy('a'));await begin(a,b);
  assert.equal(await page.locator('.parameter-wire-preview path.ready').count(),1);const ends=await previewEnds();near(ends[0],a);near(ends[1],b);
  await page.screenshot({path:path.join(folder,'drag-to-panel.png')});await page.mouse.up();await settle();
  assert.deepEqual(await page.evaluate(()=>current().edges.map(e=>[e.from,e.to])),[[['one','out'],['target','a']]]);
  assert.equal(await page.evaluate(()=>past.length),1);assert.equal(await page.locator('.parameter-wire-preview').count(),0);
  assert.equal(await page.evaluate(()=>{const p=$('#wires path[data-to="target:a"]'),q=p.getPointAtLength(p.getTotalLength()),expected=point(current().nodes.find(n=>n.id==='target'),'a','inputs');return Math.hypot(q.x-expected.x,q.y-expected.y)<.1;}),true);
  await page.evaluate(()=>undo());assert.equal(await page.evaluate(()=>current().edges.length),0);await page.evaluate(()=>undo(true));assert.equal(await page.evaluate(()=>current().edges.length),1);
  checks.push('Default-on sockets accept canvas Outputs; preview reaches panel but the saved wire ends at the real node, with one Undo/Redo transaction');
  await drag(await at(proxy('b')),await at(output('two')));assert.equal(await page.evaluate(()=>current().edges.length),2);
  const history=await page.evaluate(()=>past.length);await drag(await at(output('two')),await at(proxy('a')));
  assert.equal(await page.evaluate(()=>current().edges.find(e=>e.to[1]==='a').from[0]),'two');assert.equal(await page.evaluate(()=>past.length),history+1);
  await page.evaluate(()=>undo());assert.equal(await page.evaluate(()=>current().edges.find(e=>e.to[1]==='a').from[0]),'one');
  checks.push('Reverse dragging works and replacing an occupied Input is a single undoable edit');
  const stable=await snapshot();await drag(await at(output('target')),await at(proxy('a')));assert.equal(await snapshot(),stable);
  await begin(await at(proxy('a')),await at(output('two')));await page.keyboard.press('Escape');await page.mouse.up();assert.equal(await snapshot(),stable);assert.equal(await page.locator('.parameter-wire-preview').count(),0);
  await begin(await at(proxy('a')),await at(output('two')));await page.evaluate(()=>setParameterInputPorts(false));await page.mouse.up();assert.equal(await snapshot(),stable);assert.equal(await page.locator('.parameter-wire-preview').count(),0);assert.equal(await page.locator('.parameter-input-port').count(),0);
  await page.evaluate(()=>setParameterInputPorts(true));await begin(await at(proxy('a')),await at(output('two')));await choose('vector');await page.mouse.up();assert.equal(await snapshot(),stable);
  assert.equal(await page.locator('.parameter-input-port').count(),0);await choose('one');assert.equal(await page.locator('.parameter-input-port').count(),0);
  checks.push('Cycles are rejected; Escape, preference changes and selection changes cancel a drag; constant value fields never become Input sockets');
  await choose('code');assert.deepEqual(await page.locator('.parameter-input-port').evaluateAll(es=>es.map(e=>e.dataset.port)),await page.evaluate(()=>Object.keys(ports(current().nodes.find(n=>n.id==='code'),'inputs'))));
  await choose('target');await page.locator('#inspector .parameter-tabs [role=tab]').last().click();assert.equal(await page.locator('.parameter-input-port').count(),0);await choose('target');
  await page.evaluate(()=>{readonly=true;inspector();});assert.equal(await page.locator(proxy('a')).isDisabled(),true);
  await page.evaluate(()=>{readonly=false;inspector();workspaceLayout.setFloatingParameter(false);});assert.equal(await page.locator('.parameter-input-port').count(),0);
  await page.evaluate(()=>workspaceLayout.setFloatingParameter(true));assert.equal(await page.locator('.parameter-input-port').count(),2);
  checks.push('Custom GLSL Inputs use their stable port IDs; Notes and docked Parameter have no proxy sockets; readonly sockets cannot connect');
  await page.evaluate(()=>{current().edges=[];past=[];future=[];render();});
  const field=page.locator('#inspector [data-parameter-port="a"][data-parameter-copy="compact"]').first();await field.fill('0.42');
  await page.evaluate(()=>{window.draft=$('#inspector [data-parameter-port="a"][data-parameter-copy="compact"]');setParameterInputPorts(false);setParameterInputPorts(true);});
  assert.equal(await field.inputValue(),'0.42');assert.equal(await field.evaluate(e=>e===draft),true);await field.press('Escape');
  checks.push('Toggling the socket display preserves the numeric draft and its original field DOM');
  await page.evaluate(()=>{
   document.activeElement?.blur();graph.declarations=[{id:'tex',kind:'sampler',name:'uTex',type:'sampler2D',source:'builtin:banana',fallback:'opaque-black'},{id:'live',kind:'uniform',name:'uCount',type:'int',value:3}];
   current().nodes.push(testNode('sampler','sampler',20,750,{declarationId:'tex'}),testNode('live','uniform',260,750,{declarationId:'live'}),testNode('array','array_create',620,750),testNode('matrix','matrix_combine',800,750,{type:'mat3'}));render();
  });await settle();let invalid=await snapshot();await drag(await at(output('sampler')),await at(proxy('a')));assert.equal(await snapshot(),invalid);
  await choose('array');invalid=await snapshot();await drag(await at(output('live')),await at(proxy('length')));assert.equal(await snapshot(),invalid);
  checks.push('Sampler-to-number incompatibility and runtime Uniform-to-constant array length are rejected without graph/history changes');
  await choose('matrix');assert.deepEqual(await page.locator('.parameter-input-port').evaluateAll(es=>es.map(e=>e.dataset.port).sort()),await page.evaluate(()=>Object.keys(ports(current().nodes.find(n=>n.id==='matrix'),'inputs')).sort()));
  await page.locator('#inspector [data-parameter-expand="c0"]').click();await settle();
  await drag(await at(output('one')),await at(proxy('c0x')));assert.equal(await page.evaluate(()=>current().edges.some(e=>e.from[0]==='one'&&e.to[0]==='matrix'&&e.to[1]==='c0x')),true);
  await page.screenshot({path:path.join(folder,'matrix-inputs.png')});
  checks.push('Matrix column and expanded component sockets map to actual graph Inputs and scalar overrides connect through the panel');
  await page.evaluate(()=>{current().nodes=current().nodes.filter(n=>!['sampler','live','array','matrix'].includes(n.id));current().edges=[];});await choose('target');
  const cdp=await page.context().newCDPSession(page);
  for(const ui of [80,100,125]){
   await page.setViewportSize({width:430,height:932});await page.evaluate(ui=>{setSidebarOpen('left',false);setSidebarOpen('right',false);setUIAppearance('scale',ui);current().edges=[];current().nodes.find(n=>n.id==='one').ui={x:10,y:650};past=[];future=[];selectNode(current().nodes.find(n=>n.id==='target'));render();pan={x:10,y:10};scale=.6;transform();},ui);await settle();
   for(const reverse of [false,true]){
    await page.evaluate(()=>{current().edges=[];render();});await settle();const from=await at(reverse?proxy('a'):output('one')),to=await at(reverse?output('one'):proxy('a'));
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,...from}]});
    for(let i=1;i<=8;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x:from.x+(to.x-from.x)*i/8,y:from.y+(to.y-from.y)*i/8}]});await settle();}
    assert.equal(await page.locator('.parameter-wire-preview path.ready').count(),1,JSON.stringify({ui,reverse,from,to}));const ends=await previewEnds();near(ends[0],reverse?to:from);near(ends[1],reverse?from:to);
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await settle();assert.deepEqual(await page.evaluate(()=>current().edges.map(e=>[e.from,e.to])),[[['one','out'],['target','a']]]);
   }
   await page.screenshot({path:path.join(folder,`touch-${ui}.png`)});
  }
  checks.push('Real Chromium touch events connect in both directions on 430px screens at 80/100/125% UI scale, with accurate preview endpoints');
  const beforeCancel=await snapshot(),start=await at(output('one')),end=await at(proxy('a'));
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,...start}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,...end}]});await settle();
  await page.evaluate(()=>workspaceLayout.setFloatingParameter(false));await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await settle();
  assert.equal(await snapshot(),beforeCancel);assert.equal(await page.locator('.parameter-wire-preview').count(),0);assert.equal(await page.evaluate(()=>touchGraphGesture),null);
  checks.push('Closing the panel during a canvas touch drag cancels both the preview and captured gesture without changing a connection');
  assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,checks}));
 }catch(e){await h.finish(e);throw e;}
})().catch(e=>{console.error(e);process.exitCode=1;});
