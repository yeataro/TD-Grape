/* Combine overlap replacement through real pointer gestures; isolated fixture only. */
const assert=require('node:assert/strict'),path=require('node:path');
const {harness}=require('./test_glsl_code.cjs');
const[source,stateFile,folder]=process.argv.slice(2);
(async()=>{
  const h=await harness(source,stateFile,folder),{page,checks,errors,settle}=h;page.setDefaultTimeout(6000);
  const port=(node,kind,name)=>`[data-node="${node}"] .port[data-kind="${kind}"][data-port="${name}"]`;
  const output=()=>port('incoming','outputs','out'),input=name=>port('combine','inputs',name);
  const at=async selector=>{const r=await page.locator(selector).boundingBox();assert.ok(r,selector);return{x:r.x+r.width/2,y:r.y+r.height/2};};
  const snapshot=()=>page.evaluate(()=>JSON.stringify({graph,past,future}));
  const graphOnly=()=>page.evaluate(()=>JSON.stringify(graph));
  const edges=()=>page.evaluate(()=>current().edges.map(e=>e.from.join(':')+'>'+e.to.join(':')).sort());
  const replaced=()=>page.locator('#wires .vector-drop-replaced').evaluateAll(items=>items.map(e=>e.dataset.to).sort());
  const preview=async(start,end)=>{const a=await at(start),b=await at(end);await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:10});await settle();};
  const cancel=async()=>{await page.keyboard.press('Escape');await page.mouse.up();await settle();};
  const release=async()=>{await page.mouse.up();await settle();};
  const reset=async()=>{await page.evaluate(()=>{
    cancelConnection();clearTimeout(autoTimer);connectionInterrupted=true;conflicted=true;readonly=false;historyBusy=false;nativeMutationBusy=false;
    graph.functions=[];graph.declarations=[];graphTrail=[];stage='pixel';selected=selectedEdge=null;selection.clear();
    graph.stages.pixel={nodes:[testNode('incoming','vector',20,20,{type:'vec3',components:[.1,.2,.3,0]}),...['x','y','z','w'].map((c,i)=>testNode('old_'+c,'float',20,220+i*160,{value:i+1})),testNode('combine','combine',490,90,{type:'vec4',components:[.1,.2,.3,.4]})],edges:['x','y','z','w'].map(c=>({from:['old_'+c,'out'],to:['combine',c]}))};
    current().nodes.forEach(n=>n.ui.typeMode='locked');past=[];future=[];dirty=false;rememberSavedGraph(graph);render();scale=.85;pan={x:25,y:20};transform();
  });await settle();};
  try{
    await reset();let before=await snapshot(),baseline=await graphOnly();
    await preview(output(),input('x'));assert.equal(await page.locator('#wires .wire-preview.ready').count(),1);assert.deepEqual(await replaced(),['combine:x','combine:y','combine:z']);assert.equal(await page.locator('#wires path[data-to="combine:w"].vector-drop-replaced').count(),0);assert.equal(await snapshot(),before,'hover preview must not mutate graph or history');await page.screenshot({path:path.join(folder,'replace-xyz-preview.png')});await cancel();assert.equal(await snapshot(),before);assert.equal(await page.locator('.vector-drop-replaced,.vector-drop-range,#wires .wire-preview').count(),0);
    checks.push('vec3 over occupied X previews replacement of X/Y/Z only, keeps W and does not mutate graph/history; Escape cancels every highlight');

    await preview(output(),input('x'));await release();assert.deepEqual(await edges(),['incoming:out>combine:x','old_w:out>combine:w']);assert.deepEqual(await page.evaluate(()=>ports(current().nodes.find(n=>n.id==='combine'),'inputs')),{x:'vec3',w:'float'});assert.equal(await page.evaluate(()=>past.length),1);const committed=await graphOnly();await page.locator('#undo').click();await settle();assert.equal(await graphOnly(),baseline);assert.equal(await page.evaluate(()=>past.length),0);await page.locator('#redo').click();await settle();assert.equal(await graphOnly(),committed);assert.equal(await page.evaluate(()=>past.length),1);
    checks.push('dropping vec3 on X groups XYZ and preserves W in exactly one Undo; Undo restores all original wires and Redo repeats the replacement');

    await reset();before=await snapshot();await preview(output(),input('y'));assert.equal(await page.locator('#wires .wire-preview.ready').count(),1);assert.deepEqual(await replaced(),['combine:w','combine:y','combine:z']);assert.equal(await snapshot(),before);await page.screenshot({path:path.join(folder,'replace-yzw-preview.png')});await release();assert.deepEqual(await edges(),['incoming:out>combine:y','old_x:out>combine:x']);assert.deepEqual(await page.evaluate(()=>ports(current().nodes.find(n=>n.id==='combine'),'inputs')),{x:'float',y:'vec3'});assert.equal(await page.evaluate(()=>past.length),1);
    checks.push('dropping vec3 on occupied Y replaces Y/Z/W, leaves X and exposes the resulting X plus YZW ports');

    await reset();before=await snapshot();await preview(input('y'),output());assert.equal(await page.locator('#wires .wire-preview.ready').count(),1);assert.deepEqual(await replaced(),['combine:w','combine:y','combine:z']);assert.equal(await snapshot(),before);await cancel();assert.equal(await snapshot(),before);await preview(input('y'),output());await release();assert.deepEqual(await edges(),['incoming:out>combine:y','old_x:out>combine:x']);assert.equal(await page.evaluate(()=>past.length),1);
    checks.push('reverse input-to-output drag uses the same replacement preview, cancellability and one-step commit');

    for(const component of['z','w']){await reset();before=await snapshot();await preview(output(),input(component));assert.equal(await page.locator('#wires .wire-preview.ready').count(),0);assert.deepEqual(await replaced(),[]);await release();assert.equal(await snapshot(),before,'overflowing '+component+' drop must preserve every wire and history');}
    checks.push('vec3 cannot overflow beyond vec4 at Z or W; invalid drops neither remove existing wires nor create Undo entries');
    assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,count:checks.length}));
  }catch(error){await h.finish(error);throw error;}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
