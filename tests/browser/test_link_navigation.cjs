const assert=require('node:assert/strict'),path=require('node:path');
const {harness}=require('./test_glsl_code.cjs');
(async()=>{
 const[source,state,folder]=process.argv.slice(2),h=await harness(source,state,folder,{skipPreview:true}),{page,checks,errors,settle}=h;
 try{
  await page.evaluate(()=>{
   nativeSourcePolling=uniformPolling=customPolling=true;uniformLive.disconnect();uniformLive.connect=()=>{};clearTimeout(autoTimer);scheduleGraphApply=()=>{};
   stage='pixel';graphTrail=[];graph.functions=[];graph.declarations=[];readonly=dirty=connectionInterrupted=false;past=[];future=[];selected=selectedEdge=null;selection.clear();
   graph.stages.pixel={nodes:[testNode('a','scalar',0,150),testNode('b','add',600,-100),testNode('c','add',600,220),testNode('d','add',600,550),testNode('result','pixel_out',950,550)],edges:[{from:['a','out'],to:['b','a']},{from:['a','out'],to:['c','a']},{from:['a','out'],to:['d','a']}]};
   EDITOR_DEV_SETTINGS.frameDamping=false;EDITOR_DEV_SETTINGS.canvasDamping=false;render();scale=.65;pan={x:70,y:140};transform();
  });
  const wire=id=>page.locator('#wires path[data-to="'+id+':a"]');
  async function changeStyle(id,key){
   const p=await wire(id).evaluate(e=>{const p=e.getPointAtLength(e.getTotalLength()/2),s=new DOMPoint(p.x,p.y).matrixTransform(e.getScreenCTM());return{x:s.x,y:s.y};});
   await page.mouse.click(p.x,p.y,{button:'right'});await page.locator('#grapheditmenu [data-edit="'+key+'Style"]').click();
  }
  await changeStyle('b','link');assert.ok((await wire('b').getAttribute('d')).includes(' L '));assert.equal(await page.evaluate(()=>past.length),1);
  await page.evaluate(()=>undo());assert.ok((await wire('b').getAttribute('d')).includes(' C '));
  await page.evaluate(()=>undo(true));assert.ok((await wire('b').getAttribute('d')).includes(' L '));
  await changeStyle('c','link');assert.equal(await page.locator('#wires .wire-link').count(),2);assert.ok((await wire('d').getAttribute('d')).includes(' C '));
  assert.equal(await wire('b').evaluate(e=>getComputedStyle(e).strokeDasharray),'4px, 5px');
  checks.push('real wire context menu switches only the chosen connection, keeps ordinary wires, and supports one-step Undo/Redo');
  await page.evaluate(()=>{current().nodes.forEach(n=>n.name='Node_'+n.id);render();});
  for(const id of ['b','c']){
   const arrow=page.locator('.link-direction').filter({has:page.locator('title')}).nth(id==='b'?0:1);
   const hint=await wire(id).locator('title').textContent();assert.match(hint,/Node_a.* · out\n→ .*Node_/);
   assert.equal(await arrow.locator('title').textContent(),hint);
   const geometry=await arrow.evaluate(e=>{const p=e.wirePaintPath,a=p.getPointAtLength(0),b=p.getPointAtLength(p.getTotalLength()),m=e.transform.baseVal.consolidate().matrix;return{mid:[m.e,m.f],expected:[(a.x+b.x)/2,(a.y+b.y)/2],direction:[m.a,m.b],delta:[b.x-a.x,b.y-a.y]};});
   assert.ok(Math.hypot(geometry.mid[0]-geometry.expected[0],geometry.mid[1]-geometry.expected[1])<.01);
   assert.ok(geometry.direction[0]*geometry.delta[0]+geometry.direction[1]*geometry.delta[1]>0);
  }
  const arrow=()=>page.locator('.link-direction').first();
  await arrow().hover();assert.equal(await wire('b').evaluate(e=>e.classList.contains('wire-hover')),true);
  await arrow().click({button:'right'});await page.mouse.move(10,10);
  for(const [key,checked]of [['wireStyle',false],['linkStyle',true],['toggleLinkLines',true]]){
   const item=page.locator('[data-edit="'+key+'"]');assert.equal(await item.getAttribute('aria-checked'),String(checked));
   assert.equal(await item.locator('.menu-check-icon').evaluate(e=>getComputedStyle(e).visibility),checked?'visible':'hidden');
   assert.equal(await item.evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)');
  }
  await page.screenshot({path:path.join(folder,'link-menu.png')});await page.keyboard.press('Escape');
  await arrow().click();assert.equal(await page.evaluate(()=>selectedEdge),0);
  checks.push('midpoint triangles follow source-to-destination direction, share multiline hints and wire interaction; menu state uses left checkmarks without selected fill');
  const outgoing=()=>page.locator('[data-node="a"] .link-port-navigation[data-link-kind="outputs"]');
  assert.equal(await outgoing().count(),0);assert.equal(await page.locator('.link-direction').count(),2);
  await page.evaluate(()=>setLinkLinesVisible(false));
  assert.equal(await outgoing().count(),1);assert.equal(await page.locator('[data-node="d"] .link-port-navigation').count(),0);
  const tooltip=await outgoing().getAttribute('title');assert.match(tooltip,/Node_b/);assert.match(tooltip,/Node_c/);assert.doesNotMatch(tooltip,/Node_d/);
  for(const theme of ['dark','light']){
   await page.evaluate(theme=>{uiAppearance.theme=theme;renderUIAppearance();},theme);await page.mouse.move(10,10);
   const colors=await outgoing().evaluate(e=>[getComputedStyle(e).backgroundColor,getComputedStyle(e.closest('.node')).backgroundColor]);assert.equal(colors[0],colors[1]);
  }
  await page.evaluate(()=>{uiAppearance.theme='dark';renderUIAppearance();fit();});
  await page.screenshot({path:path.join(folder,'links-hidden.png')});
  checks.push('hidden-link navigation has the node body background in both themes and lists every Link endpoint, excluding Wire peers');
  await page.evaluate(()=>{window.beforeNavigation=JSON.stringify(graph);window.historyCount=past.length;window.oldPan=JSON.stringify(pan);});
  await outgoing().click();assert.deepEqual(await page.evaluate(()=>[...selection]),['b','c']);assert.notEqual(await page.evaluate(()=>JSON.stringify(pan)),await page.evaluate(()=>oldPan));
  // Frame moves the source offscreen; fit the whole graph before testing its next button.
  await page.evaluate(()=>fit());await outgoing().click({button:'right'});
  assert.deepEqual(await page.locator('#grapheditmenu [data-link-target]').evaluateAll(es=>es.map(e=>e.dataset.linkTarget)),['b','c']);
  await page.locator('[data-link-target="c"]').click();assert.deepEqual(await page.evaluate(()=>[...selection]),['c']);
  await page.locator('[data-node="c"] .link-port-navigation[data-link-kind="inputs"]').click();assert.deepEqual(await page.evaluate(()=>[...selection]),['a']);
  assert.equal(await page.evaluate(()=>JSON.stringify(graph)===beforeNavigation&&past.length===historyCount),true);
  checks.push('port left-click selects and Frames all Link peers, right-click chooses one, and reverse navigation excludes ordinary Wire peers');
  await page.evaluate(()=>focusGraphCanvas());await page.keyboard.press('x');assert.equal(await outgoing().count(),0);await page.keyboard.press('x');
  assert.equal(await page.locator('#wires .wire-link').count(),0);assert.equal(await page.locator('#wires .wire-hit').count(),1);
  assert.equal(await outgoing().count(),1);await page.evaluate(()=>fit());await outgoing().click();assert.deepEqual(await page.evaluate(()=>[...selection]),['b','c']);
  assert.equal(await page.evaluate(()=>JSON.stringify(graph)===beforeNavigation&&past.length===historyCount),true);
  await page.evaluate(()=>{readonly=true;render();fit();});await outgoing().click();assert.deepEqual(await page.evaluate(()=>[...selection]),['b','c']);
  await page.evaluate(()=>{readonly=false;render();setLinkLinesVisible(true);fit();});
  checks.push('hiding Link lines also removes hit targets, keeps port navigation, and does not edit the graph; navigation works read-only');
  async function clickDisplayToggle(){
   if(!await page.locator('#showlinklines').isVisible())await page.locator('#graphmore').click();
   await page.locator('#showlinklines').click();await settle();
  }
  await clickDisplayToggle();assert.equal(await page.locator('#wires .wire-link').count(),0);
  assert.equal(await page.locator('#showlinklines').getAttribute('aria-pressed'),'false');
  await page.evaluate(()=>{const r=$('#canvas').getBoundingClientRect();openGraphMenu(r.left+40,r.top+160);});
  assert.equal(await page.locator('[data-edit="toggleLinkLines"]').getAttribute('aria-checked'),'false');
  assert.match(await page.locator('[data-edit="toggleLinkLines"]').innerText(),/X/);
  await page.locator('[data-edit="toggleLinkLines"]').click();assert.equal(await page.locator('#wires .wire-link').count(),2);
  await page.locator('#uiexperiments').click();assert.equal(await page.locator('[data-experiment="showLinkLines"]').count(),0);await page.keyboard.press('Escape');
  await page.locator('#uishortcuts').click();assert.match(await page.locator('[data-shortcut="toggleLinkLines"]').innerText(),/X/);
  await page.keyboard.press('x');assert.equal(await page.evaluate(()=>showLinkLines),true);await page.keyboard.press('Escape');
  checks.push('toolbar and context menu share Link visibility; X appears in shortcut help; experimental controls no longer expose it');
  await page.locator('#search').focus();await page.keyboard.press('x');assert.equal(await page.evaluate(()=>showLinkLines),true);
  await page.locator('#search').fill('');await page.evaluate(()=>focusGraphCanvas());
  await page.keyboard.down('x');assert.equal(await page.evaluate(()=>showLinkLines),false);
  await page.keyboard.down('x');assert.equal(await page.evaluate(()=>showLinkLines),false);await page.keyboard.up('x');
  await page.keyboard.press('Control+x');assert.equal(await page.evaluate(()=>showLinkLines),false);
  await page.evaluate(()=>{readonly=true;});await page.keyboard.press('x');assert.equal(await page.evaluate(()=>showLinkLines),true);await page.evaluate(()=>{readonly=false;});
  assert.equal(await page.evaluate(()=>JSON.stringify(graph)===beforeNavigation&&past.length===historyCount),true);
  checks.push('X ignores text fields, dialogs, modifiers and key repeat; view toggling works read-only without graph history');
  await page.setViewportSize({width:600,height:1000});await settle();await clickDisplayToggle();
  assert.equal(await page.evaluate(()=>showLinkLines),false);assert.equal(await outgoing().count(),1);
  assert.equal(await page.evaluate(()=>localStorage.getItem(linkLinesStorageKey)),'false');
  await clickDisplayToggle();await page.setViewportSize({width:1600,height:1100});await settle();
  checks.push('narrow toolbar overflow retains the toggle and arrows, and saves the shared visibility preference');
  await page.evaluate(()=>{setLinkLinesVisible(false);setNodesCollapsed(['a','b','c'],true);fit();});
  await outgoing().click();assert.deepEqual(await page.evaluate(()=>[...selection]),['b','c']);
  await page.locator('[data-node="b"] .link-port-navigation[data-link-kind="inputs"]').click();assert.deepEqual(await page.evaluate(()=>[...selection]),['a']);
  await page.evaluate(()=>{setNodesCollapsed(['a','b','c'],false);selection=new Set(['a','b','c']);selected='c';window.copyPayload=copyGraphSelection();duplicateSelection();});
  assert.equal(await page.evaluate(()=>current().edges.filter(e=>selection.has(e.from[0])&&selection.has(e.to[0])&&e.ui?.style==='link').length),2);
  await page.evaluate(()=>pasteGraphSelection(copyPayload,{x:0,y:900}));
  assert.equal(await page.evaluate(()=>current().edges.filter(e=>selection.has(e.from[0])&&selection.has(e.to[0])&&e.ui?.style==='link').length),2);
  checks.push('collapsed single/aggregate ports navigate correctly; duplicate and clipboard paste preserve Link styles with remapped node IDs');
  await page.evaluate(()=>{graph.stages.pixel.nodes=graph.stages.pixel.nodes.filter(n=>['a','b','c','d','result'].includes(n.id));graph.stages.pixel.edges=graph.stages.pixel.edges.filter(e=>['b','c','d'].includes(e.to[0])&&e.from[0]==='a');render();fit();});
  await outgoing().click({button:'right'});await page.evaluate(()=>{window.oldSelection=[...selection];graph=clone(graph);});await page.locator('[data-link-target="b"]').click();assert.deepEqual(await page.evaluate(()=>[...selection]),await page.evaluate(()=>oldSelection));
  await page.evaluate(()=>{render();setLinkLinesVisible(true);fit();});await changeStyle('b','wire');await page.evaluate(()=>setLinkLinesVisible(false));assert.equal(await page.locator('[data-node="b"] .link-port-navigation').count(),0);assert.equal(await outgoing().count(),1);await page.evaluate(()=>setLinkLinesVisible(true));
  await changeStyle('c','wire');assert.equal(await page.locator('.link-port-navigation').count(),0);
  checks.push('stale navigation menus cannot act on a replaced graph; converting back to Wire removes only obsolete arrows');
  await page.evaluate(()=>{setEdgeStyle(current().edges[0],'link');setEdgeStyle(current().edges[1],'link');fit();});
  await page.evaluate(()=>{selectedEdge=0;remove();});assert.equal(await page.locator('#wires .wire-link').count(),1);
  await page.evaluate(()=>undo());assert.equal(await page.locator('#wires .wire-link').count(),2);
  checks.push('disconnecting a Link uses normal edge deletion and Undo restores both connection and style');
  await page.screenshot({path:path.join(folder,'links.png')});assert.deepEqual(errors,[]);await page.evaluate(()=>{setLinkLinesVisible(false);setUIExperiments({...EDITOR_DEV_DEFAULTS});});
  await page.reload();await page.waitForSelector('.node');assert.equal(await page.evaluate(()=>showLinkLines),false);
  assert.equal(await page.locator('#showlinklines').getAttribute('aria-pressed'),'false');
  await page.evaluate(()=>{localStorage.removeItem(linkLinesStorageKey);localStorage.setItem(experimentsStorageKey,JSON.stringify({showLinkLines:false}));});
  await page.reload();await page.waitForSelector('.node');assert.equal(await page.evaluate(()=>showLinkLines),false);
  await page.evaluate(()=>setUIExperiments({...EDITOR_DEV_DEFAULTS}));await page.reload();await page.waitForSelector('.node');assert.equal(await page.evaluate(()=>showLinkLines),false);
  checks.push('visibility survives reload and experimental reset; legacy hidden preference migrates into independent storage');
  assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,checks}));
 }catch(e){await h.finish(e);throw e;}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
