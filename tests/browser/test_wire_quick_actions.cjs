/* Isolated pointer/keyboard integration; never writes to TouchDesigner. */
const assert=require('node:assert/strict'),path=require('node:path');
const {harness}=require('./test_glsl_code.cjs');
(async()=>{
 const[source,state,folder,engine='chromium']=process.argv.slice(2),h=await harness(source,state,folder,{skipPreview:true,touch:true,engine}),{page,checks,errors,settle}=h;
 page.setDefaultTimeout(6000);
 const bar=page.locator('#wirequickactions'),action=name=>bar.locator(`[data-wire-action="${name}"]`);
 try{
  await page.evaluate(()=>{
   nativeSourcePolling=uniformPolling=customPolling=true;uniformLive.disconnect();uniformLive.connect=()=>{};clearTimeout(autoTimer);scheduleGraphApply=()=>{};
   window.setupQuick=()=>{
    cancelConnection();closeGraphMenu();readonly=connectionInterrupted=conflicted=dirty=false;nativeMutationBusy=historyBusy=false;
    graph.functions=[];graph.declarations=[];stage='pixel';graphTrail=[];
    graph.stages.pixel={nodes:[testNode('src','scalar',30,100),testNode('dst','add',530,30),testNode('other','add',530,300)],edges:[{from:['src','out'],to:['dst','a']},{from:['src','out'],to:['other','a'],ui:{style:'link'}}]};
    past=[];future=[];selected=selectedEdge=null;selection.clear();showLinkLines=true;
    setUIExperiments({wireQuickActions:true,canvasDamping:false,frameDamping:false});scale=.85;pan={x:10,y:100};render();
   };
   window.edgeClickPoint=index=>{
    const line=[...$('#wires').querySelectorAll('path[data-from]')].find(p=>p.edgeSelectionItem===current().edges[index]);
    const q=line.getPointAtLength(line.getTotalLength()*.55),probe=document.createElementNS(line.namespaceURI,'circle');
    probe.setAttribute('cx',q.x);probe.setAttribute('cy',q.y);probe.setAttribute('r',1);line.parentNode.append(probe);
    const r=probe.getBoundingClientRect();probe.remove();return{x:r.left+r.width/2,y:r.top+r.height/2};
   };
   setupQuick();
  });
  const clickEdge=async(index=0,touch=false)=>{const p=await page.evaluate(i=>edgeClickPoint(i),index);if(touch)await page.touchscreen.tap(p.x,p.y);else await page.mouse.click(p.x,p.y);await settle();return p;};
  const snapshot=()=>page.evaluate(()=>JSON.stringify({graph,past,future,dirty}));
  const before=await snapshot(),p=await clickEdge();assert.equal(await bar.isVisible(),true);assert.equal(await action('wire').getAttribute('aria-pressed'),'true');assert.equal(await snapshot(),before);
  const rect=await bar.boundingBox();assert.ok(Math.abs(rect.x+rect.width/2-p.x)<2);assert.ok(rect.y+rect.height<p.y);
  assert.equal(await bar.locator('button').count(),5);assert.equal(await bar.locator('[data-wire-action=source] svg').getAttribute('viewBox'),'0 0 24 24');
  checks.push('Default-enabled toolbar opens centered above actual pointer selection without graph/history writes; five approved actions');
  await page.screenshot({path:path.join(folder,'desktop.png')});
  await action('link').click();assert.equal(await page.evaluate(()=>current().edges[0].ui.style),'link');assert.equal(await page.evaluate(()=>past.length),1);assert.equal(await bar.isVisible(),true);
  await action('wire').click();assert.equal(await page.evaluate(()=>current().edges[0].ui?.style||'wire'),'wire');assert.equal(await page.evaluate(()=>past.length),2);
  await page.evaluate(()=>undo());assert.equal(await page.evaluate(()=>current().edges[0].ui.style),'link');assert.equal(await bar.isVisible(),false);
  await page.evaluate(()=>undo(true));assert.equal(await page.evaluate(()=>current().edges[0].ui?.style||'wire'),'wire');
  checks.push('Wire/Link toggles use one history transaction each; Undo/Redo works and invalidates stale toolbar');
  await clickEdge();await page.keyboard.down('Shift');await clickEdge(1);await page.keyboard.up('Shift');
  assert.equal(await page.evaluate(()=>selectedCanvasEdges().length),2);assert.equal(await action('wire').getAttribute('aria-pressed'),'false');assert.equal(await action('link').getAttribute('aria-pressed'),'false');
  await action('link').click();assert.ok(await page.evaluate(()=>current().edges.every(e=>e.ui?.style==='link')));
  await action('disconnect').click();assert.equal(await page.evaluate(()=>current().edges.length),0);assert.equal(await bar.isVisible(),false);
  await page.evaluate(()=>undo());assert.equal(await page.evaluate(()=>current().edges.length),2);
  checks.push('Mixed multi-selection is represented honestly, toggled together and disconnected/restored in one step');
  for(const [name,ids]of [['source',['src']],['target',['dst']]]){
   await page.evaluate(()=>{setupQuick();setUIExperiments({frameWireEndpoint:false});readonly=true;});await clickEdge();
   assert.equal(await action('wire').isDisabled(),true);assert.equal(await action('disconnect').isDisabled(),true);
   const before=await snapshot();await action(name).click();assert.deepEqual(await page.evaluate(()=>[...selection]),ids);assert.equal(await bar.isVisible(),false);assert.equal(await snapshot(),before);
   assert.ok(await page.evaluate(()=>scale!==.85));
  }
  checks.push('Readonly retains source/destination selection and Frame while disabling mutations; Frame is independent of context-menu preference');
  await page.evaluate(()=>setupQuick());await clickEdge();await page.evaluate(()=>{graph=clone(graph);render();});assert.equal(await bar.isVisible(),false);
  await page.evaluate(()=>setupQuick());await clickEdge();await page.evaluate(()=>{stage='vertex';graph.stages.vertex={nodes:[],edges:[]};render();});assert.equal(await bar.isVisible(),false);
  checks.push('Document and stage changes dismiss stale connection actions');
  await page.evaluate(()=>setupQuick());const menuPoint=await clickEdge(1);await page.mouse.click(menuPoint.x,menuPoint.y,{button:'right'});
  assert.equal(await bar.isVisible(),false);assert.equal(await page.locator('#grapheditmenu [data-edit=linkStyle]').getAttribute('aria-checked'),'true');
  await page.locator('#grapheditmenu [data-edit=wireStyle]').click();assert.equal(await page.evaluate(()=>current().edges[1].ui?.style||'wire'),'wire');
  checks.push('Right-click dismisses the quick toolbar and preserves the selected Link identity');
  await page.evaluate(()=>setupQuick());await clickEdge();await action('wire').focus();await page.keyboard.press('ArrowRight');assert.equal(await action('link').evaluate(e=>e===document.activeElement),true);await page.keyboard.press('Escape');assert.equal(await bar.isVisible(),false);
  await clickEdge();await page.locator('#uiexperiments').click();await page.locator('[data-experiment=wireQuickActions]').uncheck();assert.equal(await bar.isVisible(),false);await page.keyboard.press('Escape');await clickEdge();assert.equal(await bar.isVisible(),false);
  await page.reload();await page.waitForSelector('.node');assert.equal(await page.evaluate(()=>EDITOR_DEV_SETTINGS.wireQuickActions),false);
  checks.push('Keyboard toolbar navigation, Escape and persistent experimental opt-out work');
  // Real touch tap, independent of the mouse click path; also check UI zoom conversion.
  await page.evaluate(()=>{
   window.testNode=(id,key,x,y,params={})=>{const d=catalog.find(d=>d.key===key);return{id,definitionUuid:d.definitionUuid,revisionHash:d.revisionHash,params:{...clone(d.defaults),...params},ui:{x,y}};};
   nativeSourcePolling=uniformPolling=customPolling=true;uniformLive.disconnect();uniformLive.connect=()=>{};clearTimeout(autoTimer);scheduleGraphApply=()=>{};
   readonly=connectionInterrupted=conflicted=false;stage='pixel';graphTrail=[];graph.functions=[];graph.declarations=[];
   graph.stages.pixel={nodes:[testNode('src','scalar',0,0),testNode('router','router',220,170),testNode('dst','add',500,50)],edges:[{from:['src','out'],to:['router','value']},{from:['router','out'],to:['dst','a'],ui:{style:'link'}}]};
   setUIExperiments({wireQuickActions:true,canvasDamping:false,frameDamping:false});showLinkLines=true;selected=selectedEdge=null;selection.clear();
  });
  for(const width of [430,320])for(const ui of [80,100,125]){
   await page.setViewportSize({width,height:932});await page.evaluate(ui=>{uiAppearance.scale=ui;renderUIAppearance();setSidebarOpen('left',false);setSidebarOpen('right',false);scale=.35;pan={x:15,y:100};render();},ui);await settle();
   const p=await page.evaluate(()=>{const e=current().edges[1],line=[...$('#wires').querySelectorAll('path[data-from]')].find(p=>p.edgeSelectionItem===e),q=line.getPointAtLength(line.getTotalLength()*.55),m=document.createElementNS(line.namespaceURI,'circle');m.setAttribute('cx',q.x);m.setAttribute('cy',q.y);m.setAttribute('r',1);line.parentNode.append(m);const r=m.getBoundingClientRect();m.remove();return{x:r.left+r.width/2,y:r.top+r.height/2};});
   await page.touchscreen.tap(p.x,p.y);await settle();assert.equal(await bar.isVisible(),true);assert.equal(await action('link').getAttribute('aria-pressed'),'true');
   const box=await bar.boundingBox(),canvas=await page.locator('#canvas').boundingBox();assert.ok(box.x>=canvas.x-1&&box.x+box.width<=canvas.x+canvas.width+1,JSON.stringify({width,ui,box,canvas}));assert.ok(box.y+box.height<p.y+1);
   await action('wire').tap();assert.equal(await page.evaluate(()=>current().edges[1].ui?.style||'wire'),'wire');
   await action('link').tap();assert.equal(await page.evaluate(()=>current().edges[1].ui?.style),'link');
   await page.screenshot({path:path.join(folder,`mobile-${width}-${ui}.png`)});
  }
  checks.push('Real touchscreen selection and toggle on Router Link work at 320/430px and 80/100/125% UI with canvas containment');
  assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,checks}));
 }catch(e){await h.finish(e);throw e;}
})().catch(e=>{console.error(e);process.exitCode=1;});
