/* Router geometry and touch edge ownership, isolated from TouchDesigner.
 * node test_router_touch.cjs SOURCE_DIR STATE_JSON REPORT_DIR [chromium|webkit]
 */
const assert=require('node:assert/strict'),path=require('node:path');
const {harness}=require('./test_glsl_code.cjs');
(async()=>{
 const[source,state,folder,engine='chromium']=process.argv.slice(2),h=await harness(source,state,folder,{skipPreview:true,touch:true,engine}),{page,checks,errors,settle}=h;
 try{
  await page.evaluate(()=>{
   nativeSourcePolling=uniformPolling=customPolling=true;uniformLive.disconnect();uniformLive.connect=()=>{};clearTimeout(autoTimer);scheduleGraphApply=()=>{};readonly=dirty=connectionInterrupted=false;graph.functions=[];graph.declarations=[];stage='pixel';graphTrail=[];EDITOR_DEV_SETTINGS.canvasDamping=false;
   window.mobileRouterFixture=(count,links=[])=>{
    touchGraphGesture?.cancel();cancelConnection();closeGraphMenu();
    graph.stages.pixel={nodes:[testNode('src','vector',0,120,{type:'vec4'}),testNode('router','router',250,220,{type:'vec4'}),...Array.from({length:count},(_,i)=>testNode('dst'+i,'normalize',550,i*70,{type:'vec4'}))],edges:[{from:['src','out'],to:['router','value']},...Array.from({length:count},(_,i)=>({from:['router','out'],to:['dst'+i,'value'],...(links.includes(i)?{ui:{style:'link'}}:{})}))]};
    past=[];future=[];selected=null;selectedEdge=null;selection.clear();showLinkLines=true;EDITOR_DEV_SETTINGS.linkArrowDisplay='always';render();
   };
   window.routerAlignment=()=>{
    const center=e=>{const r=e.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2};};
    const painted=(p,at)=>{const q=p.getPointAtLength(at),m=document.createElementNS(p.namespaceURI,'circle');m.setAttribute('cx',q.x);m.setAttribute('cy',q.y);m.setAttribute('r',1);p.parentNode.append(m);const c=center(m);m.remove();return c;};
    const card=$('[data-node="router"]'),input=center(card.querySelector('.router-dot')),outputs=[...card.querySelectorAll('.router-output-dot')].map(center),arrow=card.querySelector('[data-link-kind="outputs"]');
    return [...$('#wires').querySelectorAll('path[data-from]')].map(p=>{const incoming=p.dataset.to==='router:value',end=painted(p,incoming?p.getTotalLength():0),targets=incoming?[input]:p.classList.contains('wire-link')&&arrow?[center(arrow)]:outputs;return Math.min(...targets.map(c=>Math.hypot(c.x-end.x,c.y-end.y)));});
   };
  });
  for(const width of [430,1133]){
   await page.setViewportSize({width,height:932});
   for(const ui of [75,100,125,150])for(const zoom of [.33,1,1.65])for(const count of [1,2,3,4,8]){
    await page.evaluate(({ui,zoom,count})=>{uiAppearance.scale=ui;renderUIAppearance();scale=zoom;pan={x:-45.5,y:43.25};transform();mobileRouterFixture(count,count>1?[1]:[]);},{ui,zoom,count});await settle();
    const distances=await page.evaluate(()=>routerAlignment());assert.ok(distances.every(d=>d<.8),JSON.stringify({engine,width,ui,zoom,count,distances}));
   }
  }
  checks.push('Router incoming/outgoing SVG endpoints meet actual dot/arrow centers across touch layouts, 1–4 tiers/8 edges, graph zoom and interface scale');
  await page.setViewportSize({width:1133,height:932});
  await page.evaluate(()=>{uiAppearance.scale=100;renderUIAppearance();scale=1;pan={x:0,y:20};mobileRouterFixture(3);setGraphFocus(true);});
  const cdp=engine==='chromium'?await page.context().newCDPSession(page):null;
  const touch=async(type,p)=>{
   await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:p?[{id:1,x:p.x,y:p.y}]:[]});
   await settle();
  };
  const tap=async p=>{await page.touchscreen.tap(p.x,p.y);await settle();};
  const at=async selector=>{const r=await page.locator(selector).boundingBox();return{x:r.x+r.width/2,y:r.y+r.height/2};};
  // Chromium exposes real touch hold/drag dispatch; WebKit runs geometry and native taps.
  if(cdp){
  // A selected neighbouring branch must not own the long-press menu.
  const p=await page.locator('#wires path[data-to="dst0:value"]').evaluate(e=>{const q=e.getPointAtLength(e.getTotalLength()*.7),r=$('#world').getBoundingClientRect();return{x:r.left+q.x*r.width,y:r.top+q.y*r.height};});
  await page.evaluate(()=>selectCanvasEdge(current().edges[2]));
  await touch('touchStart',p);await page.waitForTimeout(620);await touch('touchEnd',p);
  await page.locator('#grapheditmenu [data-edit="linkStyle"]').waitFor({timeout:1500});
  assert.ok((await page.locator('#grapheditmenu [data-edit="linkStyle"]').boundingBox()).height>=44);
  await tap(await at('#grapheditmenu [data-edit="linkStyle"]'));
  assert.deepEqual(await page.evaluate(()=>current().edges.map(e=>e.ui?.style||'wire')),['wire','link','wire','wire']);assert.equal(await page.evaluate(()=>past.length),1);
  await page.evaluate(()=>undo());assert.ok(await page.evaluate(()=>current().edges.every(e=>e.ui?.style!=='link')));
  checks.push('Long press replaces an earlier branch selection with the touched edge; Link conversion changes exactly that edge and Undo restores it');
  // Make an adjacent wire overlap the finger radius, but preserve exact path ownership.
  await page.evaluate(()=>{mobileRouterFixture(3,[0]);});
  const linkPoint=await page.locator('#wires path[data-to="dst0:value"]').evaluate(e=>{const q=e.getPointAtLength(e.getTotalLength()*.7),r=$('#world').getBoundingClientRect();return{x:r.left+q.x*r.width,y:r.top+q.y*r.height};});
  await touch('touchStart',linkPoint);await page.waitForTimeout(620);await touch('touchEnd',linkPoint);
  assert.equal(await page.locator('#grapheditmenu [data-edit="linkStyle"]').getAttribute('aria-checked'),'true');
  await tap(await at('#grapheditmenu [data-edit="wireStyle"]'));
  assert.ok(await page.evaluate(()=>current().edges.every(e=>e.ui?.style!=='link')));assert.equal(await page.evaluate(()=>past.length),1);
  checks.push('Holding a Link opens its own Wire/Link menu; changing mode does not affect other Router branches');
  await page.evaluate(()=>mobileRouterFixture(3,[0]));
  await touch('touchStart',linkPoint);
  // Reordering storage does not change which physical connection was held.
  await page.evaluate(()=>{current().edges.reverse();wires();});
  await page.waitForTimeout(620);await touch('touchEnd',linkPoint);
  await tap(await at('#grapheditmenu [data-edit="wireStyle"]'));
  assert.ok(await page.evaluate(()=>current().edges.every(e=>e.ui?.style!=='link')));
  assert.equal(await page.evaluate(()=>past.length),1);
  checks.push('Edge-array reordering during the hold keeps the original connection identity');

  }
  // A one-dot Router exposes both connection directions, including tap-tap input.
  await page.evaluate(()=>{mobileRouterFixture(1);current().edges=[];render();});
  await tap(await at('[data-node="src"] .port[data-kind="outputs"]'));
  await tap(await at('[data-node="router"] .router-dot'));
  assert.deepEqual(await page.evaluate(()=>current().edges.map(e=>[e.from,e.to])),[[['src','out'],['router','value']]]);
  checks.push('Touch tap-tap connects an upstream output to the single Router socket as an input');
  await tap(await at('[data-node="router"] .router-dot'));assert.ok(await page.evaluate(()=>!!linkStart));
  await tap(await at('[data-node="router"] .router-dot'));assert.equal(await page.evaluate(()=>linkStart),null);
  if(cdp){
   const source=await at('[data-node="src"] .port[data-kind="outputs"]'),dot=await at('[data-node="router"] .router-dot');
   await page.evaluate(()=>{current().edges=[];wires();past=[];future=[];});
   await touch('touchStart',source);await touch('touchMove',dot);
   assert.ok(await page.locator('.wire-preview.ready').count());await touch('touchEnd',dot);
   assert.equal(await page.evaluate(()=>current().edges.length),1);assert.equal(await page.evaluate(()=>past.length),1);
   await page.evaluate(()=>{current().edges=[];wires();past=[];future=[];});
   await touch('touchStart',source);await touch('touchMove',dot);await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await settle();
   assert.equal(await page.evaluate(()=>current().edges.length),0);assert.equal(await page.evaluate(()=>past.length),0);assert.equal(await page.locator('.wire-preview').count(),0);
   checks.push('Real touch drag connects the Router in one Undo step; pointer cancellation clears preview without graph changes');
  }
  await page.evaluate(()=>{mobileRouterFixture(4,[1]);scale=1.65;pan={x:-180,y:30};transform();wires();});
  await page.screenshot({path:path.join(folder,'router-touch.png')});assert.deepEqual(errors,[]);await cdp?.detach();await h.finish();console.log(JSON.stringify({passed:true,engine,checks}));
 }catch(e){await h.finish(e);throw e;}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
