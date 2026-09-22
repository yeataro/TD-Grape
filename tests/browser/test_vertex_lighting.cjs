/* Shared Vertex/Pixel interface, real spare-port drag, history and lighting UI. */
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),{execFileSync}=require('node:child_process');
const {harness}=require('./test_glsl_code.cjs');
(async()=>{
  const[source,base,folder]=process.argv.slice(2);fs.mkdirSync(folder,{recursive:true});
  const fixture=path.join(folder,'state.json');execFileSync(process.env.PYTHON_EXECUTABLE||'python',[path.join(__dirname,'export_editor_fixture.py'),base,fixture]);
  const h=await harness(source,fixture,folder,{skipPreview:true}),{page,checks,errors,settle}=h;
  try{
    await page.selectOption('#language','en');
    await page.evaluate(()=>{
      clearTimeout(autoTimer);scheduleGraphApply=()=>{};connectionInterrupted=true;readonly=false;historyBusy=false;nativeMutationBusy=false;graphTrail=[];editorTarget='mat';graph.target='mat';
      graph.stages={vertex:{nodes:[testNode('source','scalar',60,80,{type:'float',value:.375}),testNode('vertex','vertex_out',450,80)],edges:[]},pixel:{nodes:[testNode('pixel','pixel_out',750,80)],edges:[]}};
      graph.declarations=[];stage='vertex';past=[];future=[];selected=null;selection.clear();dirty=false;rememberSavedGraph(graph);render();scale=1;pan={x:20,y:30};transform();
    });await settle();
    assert.equal(await page.locator('[data-node="vertex"] [data-port="position"]').locator('..').locator('.port-label').innerText(),'gl_Position');
    assert.ok((await page.locator('[data-node="vertex"] [data-port="position"]').getAttribute('title')).includes('not a data port'));
    const before=await page.evaluate(()=>JSON.stringify(graph));
    await h.drag(await h.at('[data-node="source"] [data-kind="outputs"][data-port="out"]'),await h.at('[data-node="vertex"] [data-add-port="true"]'));
    const created=await page.evaluate(()=>({ports:vertexPortList(),nodes:graph.stages.pixel.nodes,edges:current().edges,history:past.length}));
    assert.equal(created.ports.length,1);assert.equal(created.ports[0].type,'float');assert.equal(created.edges.length,1);assert.equal(created.history,1);
    const id=created.ports[0].id,receiver=created.nodes.find(n=>n.definitionUuid==='sgrape.builtin.vertex_input');assert.ok(receiver);
    const after=await page.evaluate(()=>JSON.stringify(graph));await page.locator('#undo').click();await settle();assert.equal(await page.evaluate(()=>JSON.stringify(graph)),before);
    await page.locator('#redo').click();await settle();assert.equal(await page.evaluate(()=>JSON.stringify(graph)),after);
    checks.push('real drag adds paired ports/receiver in one undoable edit; Undo and Redo restore both stages');
    await page.evaluate(({receiver,id})=>{stage='pixel';render();connectPorts({node:receiver,port:id,kind:'outputs'},{node:'pixel',port:'color',kind:'inputs'});}, {receiver:receiver.id,id});await settle();
    assert.equal(await page.evaluate(({receiver,id})=>ports(current().nodes.find(n=>n.id===receiver),'outputs')[id],{receiver:receiver.id,id}),'float');
    // Compile the actual UI-created graph, including its names and paired ports.
    const uiGraph=await page.evaluate(()=>graph);
    execFileSync(process.env.PYTHON_EXECUTABLE||'python',['-c','import sys,json;sys.path.insert(0,sys.argv[1]);import sgrape_core as c;c.compile_graph(json.load(sys.stdin))',path.resolve(__dirname,'../../src/core')],{input:JSON.stringify(uiGraph)});
    fs.writeFileSync(path.join(folder,'ui-created-graph.json'),JSON.stringify(uiGraph));
    checks.push('actual UI-created graph passes compiler validation, including generated node names');
    await page.evaluate(receiver=>{selected=receiver;selection=new Set([receiver]);inspectorTab='settings';render();},receiver.id);await settle();
    await page.locator('#inspector button').filter({hasText:'Remove Port'}).click();await settle();
    assert.deepEqual(await page.evaluate(()=>({count:vertexPortList().length,v:graph.stages.vertex.edges.length,p:graph.stages.pixel.edges.length})),{count:0,v:0,p:0});
    const spare=page.locator(`[data-node="${receiver.id}"] [data-add-port="true"]`);
    assert.equal(await spare.count(),1);assert.equal(await spare.isEnabled(),true);
    await page.mouse.move(5,5);await settle();
    assert.equal(await spare.evaluate(b=>getComputedStyle(b).opacity),'0.5');
    const emptyGraph=await page.evaluate(()=>JSON.stringify(graph));await page.evaluate(()=>render());await settle();
    assert.equal(await page.evaluate(()=>JSON.stringify(graph)),emptyGraph);
    assert.equal(await spare.count(),1);
    checks.push('gl_Position is explicitly labeled; empty Vertex Inputs retains a translucent usable placeholder without creating a serialized port');
    await page.locator('#undo').click();await settle();assert.equal(await page.evaluate(()=>vertexPortList().length),1);
    checks.push('Pixel receiver exposes the same interface; removing a port clears both endpoints and Undo restores their wires');
    await page.locator('.toolbar [data-stage="vertex"]').click();await settle();
    await h.drag(await h.at('[data-node="source"] [data-kind="outputs"][data-port="out"]'),await h.at('[data-node="vertex"] [data-add-port="true"]'));
    assert.equal(await page.evaluate(()=>vertexPortList().length),2);
    await page.locator('.toolbar [data-stage="pixel"]').click();await settle();
    assert.equal(await page.locator(`[data-node="${receiver.id}"] [data-kind="outputs"]:not([data-add-port])`).count(),2);
    checks.push('adding a second Vertex output after visiting Pixel creates a second visible Pixel socket');
    const snapshotTypes=await page.evaluate(receiver=>{const other=clone(graph),boundary=other.stages.vertex.nodes.find(n=>n.definitionUuid==='sgrape.builtin.vertex_out'),input=other.stages.pixel.nodes.find(n=>n.id===receiver);boundary.params.outputs[0].type='vec3';return [Object.values(safeConcretePorts(other,input).outputs)[0],vertexPortList()[0].type];},receiver.id);
    assert.deepEqual(snapshotTypes,['vec3','float']);checks.push('type checks use the supplied graph snapshot instead of the currently displayed stage interface');
    for(const key of ['material_phong','material_pbr']){
      await page.evaluate(key=>{const d=catalog.find(d=>d.key===key);change(()=>instantiate(d,220,100));inspectorTab='parameters';render();},key);await settle();
      const text=await page.locator('#inspector').innerText();assert.ok(text.includes('world'));assert.ok(!text.includes('input.implicitUV'));assert.ok(!text.includes('lighting.automatic.'));
      await page.evaluate(key=>{editorTarget='top';window.hasMatLighting=availableEntries().some(e=>e.key===key);editorTarget='mat';},key);
      assert.equal(await page.evaluate(()=>window.hasMatLighting),false);
    }
    checks.push('Phong/PBR expose material controls and automatic geometry hints, and stay out of TOP menus');
    await page.screenshot({path:path.join(folder,'pbr-material.png')});assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,checks}));
  }catch(error){await h.finish(error);throw error;}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
