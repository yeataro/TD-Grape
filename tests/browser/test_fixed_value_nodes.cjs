/* Real fixed-value insertion, editing and persistence through the isolated API. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {harness}=require('./test_glsl_code.cjs');
async function run(){
  const [source,stateFile,folder]=process.argv.slice(2);fs.mkdirSync(folder,{recursive:true});
  const fixture=path.join(folder,'fresh-state.json');
  execFileSync(process.env.PYTHON_EXECUTABLE||'python',[path.join(__dirname,'export_editor_fixture.py'),stateFile,fixture],{stdio:'pipe'});
  const h=await harness(source,fixture,folder),{page,checks,errors,at,drag,settle}=h;page.setDefaultTimeout(6000);
  const selectedNode=()=>page.evaluate(()=>clone(current().nodes.find(n=>n.id===selected)));
  const reset=async()=>{await page.evaluate(()=>{
    clearTimeout(autoTimer);connectionInterrupted=true;conflicted=true;readonly=false;historyBusy=false;nativeMutationBusy=false;
    closeCreator();graphTrail=[];graph.functions=[];graph.declarations=[];stage='pixel';past=[];future=[];selected=selectedEdge=null;selectedInputId=null;selection.clear();inspectorTab='parameters';showCustomNodeNames=false;
    graph.stages.pixel={nodes:[testNode('pixel','pixel_out',1100,60)],edges:[]};rememberSavedGraph(graph);scale=.7;pan={x:25,y:25};render();transform();
  });await settle();};
  const open=wire=>page.evaluate(wire=>{const r=$('#canvas').getBoundingClientRect();openCreator(r.left+180,r.top+170,wire);},wire);
  try{
    await page.selectOption('#language','en');await reset();
    const entries=await page.evaluate(()=>availableEntries().filter(d=>['scalar','vector'].includes(d.key)).map(d=>({key:browserEntryKey(d),label:d.label,fixed:d.fixedType||null})));
    const types=await page.evaluate(()=>valueTypes());assert.equal(types.length,16);assert.equal(entries.length,18);
    assert.deepEqual(entries.filter(e=>e.fixed).map(e=>e.fixed).sort(),types.slice().sort());
    assert.deepEqual(entries.filter(e=>!e.fixed).map(e=>e.label).sort(),['Scalar','Vector']);
    checks.push('16 fixed types plus generic Scalar and Vector');
    for(const type of types){
      await page.locator('#search').fill(type);
      const row=page.locator(`#browsersearchitems [data-entry="${type}"]`);assert.equal(await row.locator('.palette-entry-label').innerText(),type);
      await row.click();assert.match(await page.locator('#browserdetail .browser-signature').innerText(),new RegExp('→ '+type+'$'));
      await page.locator(`#browsersearchitems [data-add-entry="${type}"]`).click();await settle();
      const node=await selectedNode();assert.equal(node.params.type,type);assert.equal(node.params.fixedType,type);
      assert.equal(await page.locator('#inspector .node-inspector-name').innerText(),type);assert.match(await page.locator('#nodehelp').innerText(),/fixed type/);
      assert.equal(await page.evaluate(()=>nodeTypeLabel(definition(current().nodes.find(n=>n.id===selected)),current().nodes.find(n=>n.id===selected).params)),type);
      assert.equal(await page.locator(`[data-node="${node.id}"] [data-node-selector]`).count(),0);
      assert.equal(await page.evaluate(()=>nodeTypeSelector(current().nodes.find(n=>n.id===selected),definition(current().nodes.find(n=>n.id===selected)))),null);
      await page.locator('#undo').click();assert.equal(await page.evaluate(id=>current().nodes.some(n=>n.id===id),node.id),false);
      await page.locator('#redo').click();assert.deepEqual(await page.evaluate(id=>clone(current().nodes.find(n=>n.id===id).params),node.id),node.params);await reset();
    }
    checks.push('Every fixed type previews and inserts correctly, has no type selector and survives Undo/Redo');
    for(const [query,key,title,defaultType,changedType] of [['int','scalar','Scalar','float','int'],['vec3','vector','Vector','vec2','ivec3']]){
      await page.locator('#search').fill(query);assert.equal(await page.locator(`[data-entry="${key}"] .palette-entry-label`).innerText(),title);
      await page.locator(`[data-add-entry="${key}"]`).click();await settle();
      let node=await selectedNode();assert.equal(node.params.type,defaultType);assert.equal(Object.hasOwn(node.params,'fixedType'),false);
      await page.evaluate(()=>commitNodeName(current().nodes.find(n=>n.id===selected),'MyValue'));const name=(await selectedNode()).name;
      await page.locator(`[data-node="${node.id}"] [data-node-selector]`).selectOption(changedType);await settle();node=await selectedNode();
      assert.equal(node.params.type,changedType);assert.equal(node.name,name);
      assert.equal(await page.evaluate(()=>nodeTypeLabel(definition(current().nodes.find(n=>n.id===selected)),current().nodes.find(n=>n.id===selected).params)),title);
      assert.equal(await page.locator(`[data-node="${node.id}"] .node-function-title`).innerText(),title);
      await page.evaluate(()=>{showCustomNodeNames=true;render();});assert.equal(await page.locator(`[data-node="${node.id}"] .node-function-title`).innerText(),'MyValue');
      await reset();await open(null);await page.locator('#createsearch').fill(query);
      assert.equal((await page.locator(`[data-create-entry="${key}"]`).innerText()).split('\n')[0],title);
      await page.locator(`[data-create-entry="${key}"]`).click();assert.equal((await selectedNode()).params.type,defaultType);await reset();
    }
    checks.push('Search aliases keep generic titles and defaults stable in both Add entry points; changing type never renames');
    await page.locator('#search').fill('vec3');await page.locator('[data-entry="vec3"]').dblclick();assert.equal((await selectedNode()).params.fixedType,'vec3');await reset();
    await page.locator('#search').fill('vec2');const canvas=await page.locator('#canvas').boundingBox();
    await drag(await at('[data-entry="vec2"]'),{x:canvas.x+230,y:canvas.y+300});assert.equal((await selectedNode()).params.fixedType,'vec2');await reset();
    await open(null);await page.locator('#createsearch').fill('ivec3');await page.locator('[data-create-entry="ivec3"]').click();assert.equal((await selectedNode()).params.fixedType,'ivec3');
    checks.push('Double-click, drag and floating Add retain fixed identity');
    const sourceId=(await selectedNode()).id;
    await page.evaluate(()=>{const n=current().nodes.find(n=>n.id===selected);n.params.components=[7,-8,9,10];n.ui.componentNames='rgba';render();});
    await page.locator(`[data-node="${sourceId}"] [data-value-expand]`).click();assert.equal(await page.locator(`[data-node="${sourceId}"] .node-fixed-values input`).count(),3);
    const beforeCopy=await page.evaluate(()=>JSON.stringify(graph));
    await page.evaluate(()=>{const text=copyGraphSelection();pasteGraphSelection(text,{x:500,y:420});});
    const duplicate=await selectedNode();assert.notEqual(duplicate.id,sourceId);assert.equal(duplicate.params.fixedType,'ivec3');assert.deepEqual(duplicate.params.components,[7,-8,9,10]);assert.equal(duplicate.ui.componentNames,'rgba');
    await page.locator('#undo').click();assert.equal(await page.evaluate(()=>JSON.stringify(graph)),beforeCopy);await page.locator('#redo').click();
    await page.evaluate(id=>{graph=JSON.parse(JSON.stringify(graph));selected=id;selection=new Set([id]);render();},duplicate.id);assert.equal((await selectedNode()).params.fixedType,'ivec3');
    await page.locator(`[data-node="${duplicate.id}"] .vector-split-shortcut`).click();const split=await selectedNode();assert.equal(split.definitionUuid,'sgrape.builtin.vector_split');assert.equal(split.params.type,'ivec3');
    assert.deepEqual(await page.evaluate(id=>ports(current().nodes.find(n=>n.id===id),'outputs'),split.id),{x:'int',y:'int',z:'int'});
    checks.push('Clipboard, one-step Undo/Redo, JSON persistence and Split retain fixed type, components and labels');
    await reset();await page.locator('#search').fill('Vector');await page.locator('[data-add-entry="vector"]').click();const generic=(await selectedNode()).id;
    await page.evaluate(()=>{const n=current().nodes.find(n=>n.id===selected);n.params.components=[1,2,3,4];render();});const genericName=(await selectedNode()).name;
    for(const type of ['vec4','vec2','vec4'])await page.locator(`[data-node="${generic}"] [data-node-selector]`).selectOption(type);
    assert.deepEqual((await selectedNode()).params.components,[1,2,3,4]);assert.equal((await selectedNode()).name,genericName);
    checks.push('Generic Vector retains dormant components across dimension changes');
    await reset();await page.locator('#search').fill('bool');await page.locator('[data-add-entry="bool"]').click();const boolean=(await selectedNode()).id;
    const toggle=page.locator(`[data-node="${boolean}"] .node-fixed-values select`);assert.equal(await toggle.count(),1);await toggle.selectOption('true');assert.equal((await selectedNode()).params.value,true);
    await page.evaluate(()=>{readonly=true;render();});assert.equal(await toggle.isDisabled(),true);await reset();
    await page.locator('#search').fill('Color RGBA');await page.locator('[data-add-entry="color"]').click();const color=(await selectedNode()).id;
    assert.equal(await page.locator(`[data-node="${color}"] .node-fixed-values input`).count(),4);assert.equal(await page.locator(`[data-node="${color}"] .node-color input[type=color]`).count(),1);assert.equal(Object.hasOwn((await selectedNode()).params,'fixedType'),false);
    checks.push('Boolean toggle and readonly behavior work; Color RGBA preserves its four values and picker');
    await reset();await page.evaluate(()=>{
      current().nodes=[];const entries=availableEntries();for(const [i,key] of ['float','int','ivec3','bvec3','scalar','vector','color'].entries())instantiate(entries.find(d=>browserEntryKey(d)===key),40+(i%3)*300,40+Math.floor(i/3)*240);
      selected=null;selection.clear();render();fit();
    });await page.locator('#search').fill('vec3');await settle();await page.screenshot({path:path.join(folder,'fixed-values.png')});assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,count:checks.length,checks}));
  }catch(error){await h.finish(error);throw error;}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
