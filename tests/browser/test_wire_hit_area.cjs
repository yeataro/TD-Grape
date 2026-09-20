/* Real SVG hit testing in the isolated editor; never connects to TD. */
const assert=require('node:assert/strict');
const {harness}=require('./test_glsl_code.cjs');
const [source,stateFile,folder]=process.argv.slice(2);
(async()=>{const h=await harness(source,stateFile,folder,{skipPreview:true}),{page,checks,errors,settle}=h;
try{
await page.evaluate(()=>{
  stage='pixel';graphTrail=[];graph.functions=[];graph.declarations=[];readonly=false;
  graph.stages.pixel={nodes:[testNode('a','scalar',0,100),testNode('b','add',1400,100),testNode('c','add',1400,100)],edges:[{from:['a','out'],to:['b','a']},{from:['a','out'],to:['c','a']}]};
  past=[];future=[];selected=null;selectedEdge=null;selection.clear();dirty=false;render();setGraphFocus(true);
  const delta=point(current().nodes[0],'out','outputs').y-point(current().nodes[1],'a','inputs').y;
  current().nodes[1].ui.y+=delta;current().nodes[2].ui.y+=delta;render();
});
const before=await page.evaluate(()=>JSON.stringify({graph,past,future,dirty}));
const midpoint=()=>page.locator('#wires path[data-from]').last().evaluate(e=>{
  const p=e.getPointAtLength(e.getTotalLength()/2),r=document.querySelector('#world').getBoundingClientRect();return{x:r.left+p.x*r.width,y:r.top+p.y*r.width,z:r.width};
});
for(const ui of [75,100,125])for(const zoom of [.125,.25,.5,1,2]){
  await page.evaluate(({ui,zoom})=>{uiAppearance.scale=ui;renderUIAppearance();scale=zoom;pan={x:40-zoom*700,y:160};transform();},{ui,zoom});await settle();
  const p=await midpoint(),width=await page.locator('.wire-hit').first().evaluate(e=>parseFloat(getComputedStyle(e).strokeWidth));
  assert.ok(Math.abs(width*p.z-Math.max(2.5,2.5*p.z))<.01);
  const hit=await page.evaluate(({p,width})=>{
    const target=document.elementFromPoint(p.x,p.y+width*p.z*.4),outside=document.elementFromPoint(p.x,p.y+Math.max(width,5)*p.z/2+1);
    return{to:wirePathFromTarget(target)?.dataset.to,outside:!!wirePathFromTarget(outside)};
  },{p,width});assert.equal(hit.to,'c:a');assert.equal(hit.outside,false);
}
checks.push('15 graph/UI scale combinations retain a 2.5 CSS px minimum and grow when zoomed in; overlap chooses the original last wire');
await page.evaluate(()=>{uiAppearance.scale=100;renderUIAppearance();scale=.125;pan={x:30,y:180};transform();});await settle();
let p=await midpoint();await page.mouse.move(p.x,p.y+.9);await settle();
assert.equal(await page.locator('#wires path[data-to="c:a"]').evaluate(e=>e.classList.contains('wire-hover')),true);
await page.mouse.click(p.x,p.y+.9);assert.equal(await page.evaluate(()=>selectedEdge),1);
await page.mouse.click(p.x,p.y+.9,{button:'right'});await page.locator('#grapheditmenu [data-edit="selectDestination"]').click();assert.deepEqual(await page.evaluate(()=>[...selection]),['c']);
checks.push('the transparent extension supports real hover, click and the correct branch context menu at 12.5%');
await page.evaluate(()=>{selection.clear();selected=selectedEdge=null;wires();});
const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true});
await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:p.x,y:p.y+.9}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await settle();
assert.equal(await page.evaluate(()=>selectedEdge),1);await cdp.detach();
await page.evaluate(()=>{EDITOR_DEV_SETTINGS.canvasTrash=true;});
await page.mouse.move(p.x,p.y+.9);await page.mouse.down();await page.mouse.move(p.x+35,p.y+40,{steps:4});
assert.equal(await page.evaluate(()=>!!graphTrash),true);await page.keyboard.press('Escape');await page.mouse.up();
assert.equal(await page.evaluate(()=>current().edges.length),2);await page.evaluate(()=>{EDITOR_DEV_SETTINGS.canvasTrash=false;});
checks.push('touch selects the expanded target and wire dragging/cancellation still uses the original edge');
const styles=await page.evaluate(()=>{document.documentElement.dataset.uiStyle='godlike';const hit=$('.wire-hit');return{stroke:getComputedStyle(hit).stroke,filter:getComputedStyle(hit).filter,metadata:hit.hasAttribute('data-from'),pairs:[...$('#wires').children].map(g=>g.children.length)};});
assert.equal(styles.stroke,'rgba(0, 0, 0, 0)');assert.equal(styles.filter,'none');assert.equal(styles.metadata,false);assert.deepEqual(styles.pairs,[2,2]);
assert.equal(await page.evaluate(()=>JSON.stringify({graph,past,future,dirty})),before);
checks.push('hit paths have no Glow, semantic duplicates, graph edits, dirty state or Undo entries');
await page.evaluate(()=>{const path=$('#wires path[data-from]'),p=path.getPointAtLength(path.getTotalLength()/2),n=testNode('cover','scalar',p.x-90,p.y-45);current().nodes.push(n);render();});await settle();p=await midpoint();
assert.equal(await page.evaluate(p=>document.elementFromPoint(p.x,p.y)?.closest('.node')?.dataset.node,p),'cover');
const port=page.locator('#cards [data-node="a"] .port');const r=await port.boundingBox();assert.equal(await page.evaluate(r=>document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.classList.contains('port'),r),true);
checks.push('nodes and sockets keep priority over both visible and transparent wire surfaces');
await page.evaluate(()=>{current().nodes=current().nodes.filter(n=>n.id!=='cover');current().edges.splice(1,1);render();});
assert.equal(await page.locator('.wire-hit').count(),1);assert.equal(await page.locator('#wires path[data-from]').count(),1);
checks.push('redraw after removing an edge removes its paired hit path');
assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,checks:checks.length}));
}catch(error){await h.finish(error);console.error(error);process.exitCode=1;}})();
