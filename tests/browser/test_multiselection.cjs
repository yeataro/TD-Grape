const assert=require('node:assert/strict');
const {harness}=require('./test_glsl_code.cjs');
(async()=>{
 const[source,state,folder]=process.argv.slice(2),h=await harness(source,state,folder,{skipPreview:true}),{page,checks,errors}=h;
 const setup=()=>page.evaluate(()=>{
  nativeSourcePolling=uniformPolling=customPolling=true;uniformLive.disconnect();uniformLive.connect=()=>{};clearTimeout(autoTimer);scheduleGraphApply=()=>{};
  closeGraphMenu();stage='pixel';graphTrail=[];graph.functions=[];graph.declarations=[];readonly=dirty=connectionInterrupted=false;past=[];future=[];selected=selectedEdge=null;selection.clear();
  graph.stages.pixel={nodes:[testNode('a','scalar',70,130),testNode('b','add',430,130),testNode('c','scalar',70,520),testNode('d','add',430,520)],edges:[{from:['a','out'],to:['b','a']},{from:['a','out'],to:['b','b'],ui:{style:'link'}},{from:['c','out'],to:['d','a']}]};
  GraphFrames.write(current(),[{id:'g1',name:'First',nodes:['a','b'],color:'#667788'},{id:'g2',name:'Second',nodes:['c','d'],color:'#887766'}]);
  showLinkLines=true;setUIExperiments({selectionToolbar:'off',canvasTrash:true,groupCornerSelect:true});render();scale=.6;pan={x:50,y:90};transform();window.baseline=JSON.stringify(graph);
 });
 const ids=()=>page.evaluate(()=>[...selection].sort());
 const edgeIds=()=>page.evaluate(()=>selectedCanvasEdges().map(e=>current().edges.indexOf(e)).sort());
 const node=id=>page.locator('#cards [data-node="'+id+'"] .node-title');
 const group=id=>page.locator('[data-frame="'+id+'"] .group-frame-name');
 const wire=async(i,key)=>{
  const pt=await page.evaluate(i=>{const e=current().edges[i],p=[...document.querySelectorAll('#wires path[data-from]')].find(p=>p.dataset.from===e.from.join(':')&&p.dataset.to===e.to.join(':'));const v=p.getPointAtLength(p.getTotalLength()*.6),q=new DOMPoint(v.x,v.y).matrixTransform(p.getScreenCTM());return {x:q.x,y:q.y};},i);
  if(key)await page.keyboard.down(key);await page.mouse.click(pt.x,pt.y);if(key)await page.keyboard.up(key);
 };
 try{
  for(const key of ['Control','Shift']){
   await setup();await node('a').click();await node('c').click({modifiers:[key]});assert.deepEqual(await ids(),['a','c']);await node('a').click({modifiers:[key]});assert.deepEqual(await ids(),['c']);
   await group('g1').click({modifiers:[key]});assert.deepEqual(await ids(),['a','b','c']);await group('g2').click({modifiers:[key]});assert.deepEqual(await ids(),['a','b','c','d']);assert.equal(await page.locator('.group-frame.selected').count(),2);
   await group('g1').click({modifiers:[key]});assert.deepEqual(await ids(),['c','d']);await group('g2').click({modifiers:[key]});assert.deepEqual(await ids(),[]);
   await page.locator('[data-frame-select=g1]').click({modifiers:[key]});assert.deepEqual(await ids(),['a','b']);await page.locator('[data-frame-select=g1]').click({modifiers:[key]});assert.deepEqual(await ids(),[]);
   assert.equal(await page.evaluate(()=>JSON.stringify(graph)===baseline&&!dirty&&!past.length),true);
  }
  checks.push('real Ctrl/Shift node/title/corner clicks toggle selection, complete partial Groups and preserve other Groups without graph/history edits');
  for(const key of ['Control','Shift'])for(const trash of [true,false]){
   await setup();await page.evaluate(v=>setUIExperiments({canvasTrash:v}),trash);await wire(0);assert.deepEqual(await edgeIds(),[0]);await wire(1,key);assert.deepEqual(await edgeIds(),[0,1]);await wire(2,key);assert.deepEqual(await edgeIds(),[0,1,2]);assert.equal(await page.locator('#wires path.selected').count(),3);
   await wire(1,key);assert.deepEqual(await edgeIds(),[0,2]);await wire(0,key);assert.deepEqual(await edgeIds(),[2]);await wire(2,key);assert.deepEqual(await edgeIds(),[]);
   await wire(0);await wire(2,key);await wire(2);assert.deepEqual(await edgeIds(),[2]);
   assert.equal(await page.evaluate(()=>JSON.stringify(graph)===baseline&&!dirty&&!past.length),true);
  }
  checks.push('real Ctrl/Shift Wire and Link clicks add/remove all selections; plain click replaces; trash mode on/off works');
  await setup();await wire(0);await wire(2,'Control');await page.evaluate(()=>openGraphMenu(600,350,null,{edge:current().edges[0]}));assert.deepEqual(await edgeIds(),[0,2]);await page.locator('[data-edit=linkStyle]').click();assert.deepEqual(await page.evaluate(()=>current().edges.map(e=>e.ui?.style)),['link','link','link']);assert.equal(await page.evaluate(()=>past.length),1);await page.evaluate(()=>undo());assert.equal(await page.evaluate(()=>JSON.stringify(graph)===baseline),true);assert.deepEqual(await edgeIds(),[]);
  await wire(0);await wire(2,'Shift');await page.evaluate(()=>openGraphMenu(600,350,null,{edge:current().edges[0]}));await page.locator('[data-edit=delete]').click();assert.equal(await page.evaluate(()=>current().edges.length),1);await page.evaluate(()=>undo());assert.equal(await page.evaluate(()=>JSON.stringify(graph)===baseline),true);
  checks.push('right-click preserves selected wires, bulk style and disconnect are single Undo steps; history replacement clears stale edge selection');
  await setup();await wire(0);await wire(2,'Control');await page.keyboard.press('Delete');assert.equal(await page.evaluate(()=>current().edges.length),1);await page.evaluate(()=>undo());assert.equal(await page.evaluate(()=>JSON.stringify(graph)===baseline),true);
  await wire(0);await wire(2,'Control');await node('a').click();assert.deepEqual(await edgeIds(),[]);assert.equal(await page.locator('#wires path.selected').count(),0);
  await wire(0);await page.evaluate(()=>{graph=clone(graph);render();});assert.deepEqual(await edgeIds(),[]);
  checks.push('keyboard delete removes all selected edges; selecting a node or replacing graph clears edge state');
  await setup();const marquee=await page.evaluate(()=>{const a=document.querySelector('[data-node=a]').getBoundingClientRect(),c=document.querySelector('#canvas').getBoundingClientRect();return {x:a.left-8,y:a.top-8,endX:a.right+8,endY:a.bottom+8};});await page.keyboard.down('Shift');await page.mouse.move(marquee.x,marquee.y);await page.mouse.down();await page.mouse.move(marquee.endX,marquee.endY,{steps:8});await page.mouse.up();await page.keyboard.up('Shift');assert.deepEqual(await ids(),['a']);
  checks.push('Shift drag on blank canvas still box-selects nodes');
  await setup();const layered=await page.evaluate(()=>{const title=document.querySelector('[data-frame=g1] .group-frame-title'),r=title.getBoundingClientRect(),p=document.querySelector('#wires path[data-from]'),svg=document.querySelector('#wires'),inverse=svg.getScreenCTM().inverse(),a=new DOMPoint(r.left+5,r.top+r.height/2).matrixTransform(inverse),b=new DOMPoint(r.right-5,r.top+r.height/2).matrixTransform(inverse);p.setAttribute('d',`M ${a.x} ${a.y} L ${b.x} ${b.y}`);return document.elementFromPoint(r.left+r.width*.35,r.top+r.height/2)?.closest('.group-frame-title')===title;});assert.equal(layered,true);await page.screenshot({path:require('node:path').join(folder,'group-title-over-wire.png')});
  checks.push('Group title wins actual hit testing over an intersecting wire');
  await setup();await wire(0);await wire(2,'Control');const restored=await page.evaluate(()=>{const before=JSON.stringify(graph);const ok=change(()=>{throw Error('selection rollback probe');});return {ok,same:JSON.stringify(graph)===before,edges:selectedCanvasEdges().map(e=>current().edges.indexOf(e))};});assert.deepEqual(restored,{ok:false,same:true,edges:[0,2]});
  await page.evaluate(()=>{current().edges.splice(1,1);wires();});assert.deepEqual(await edgeIds(),[0,1]);await page.evaluate(()=>{current().edges.splice(0,1);wires();});assert.deepEqual(await edgeIds(),[0]);
  await page.evaluate(()=>{graph.stages.vertex={nodes:[],edges:[]};stage='vertex';render();});assert.deepEqual(await edgeIds(),[]);
  checks.push('failed edits restore the selected edge set; deletion reindexes surviving references and stage changes clear them');
  await setup();await page.evaluate(()=>{readonly=true;});await wire(0);await wire(2,'Shift');assert.deepEqual(await edgeIds(),[0,2]);await page.keyboard.press('Delete');assert.equal(await page.evaluate(()=>JSON.stringify(graph)===baseline),true);await page.evaluate(()=>openGraphMenu(600,350,null,{edge:current().edges[0]}));assert.equal(await page.locator('[data-edit=delete]').isDisabled(),true);await page.keyboard.press('Escape');await group('g1').click();await group('g2').click({modifiers:['Shift']});assert.deepEqual(await ids(),['a','b','c','d']);
  checks.push('readonly graphs allow group/wire multi-selection while blocking delete and conversion');
  await setup();await page.evaluate(()=>{suppressWireClick=true;});await wire(2,'Shift');assert.deepEqual(await edgeIds(),[2]);await page.evaluate(()=>setUIExperiments({nodeBodyDrag:false}));await page.locator('#cards [data-node=a] .ports').click({position:{x:20,y:10}});assert.deepEqual(await edgeIds(),[]);assert.equal(await page.locator('#wires path.selected').count(),0);
  checks.push('a new modified wire click is not swallowed by a previous drag, and non-draggable node-body selection clears wire paint');
  assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,count:checks.length}));
 }catch(e){await h.finish(e);throw e;}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
