/* Compare/If integration against a freshly exported core contract; never TD.
 * node test_control_nodes.cjs SOURCE_DIR BASE_STATE_JSON REPORT_DIR
 * PYTHON_EXECUTABLE optionally selects the Python runtime for fixture export.
 */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {harness}=require('./test_glsl_code.cjs');
const[source,stateFile,folder]=process.argv.slice(2);
(async()=>{
  fs.mkdirSync(folder,{recursive:true});const fixture=path.join(folder,'fresh-state.json');
  execFileSync(process.env.PYTHON_EXECUTABLE||'python',[path.join(__dirname,'export_editor_fixture.py'),stateFile,fixture],{stdio:'pipe'});
  const h=await harness(source,fixture,folder),{page,checks,errors,settle}=h;page.setDefaultTimeout(6000);
  let compareId,ifId;
  const card=id=>page.locator(`[data-node="${id}"]`),snapshot=()=>page.evaluate(()=>JSON.stringify({graph,past,future}));
  const state=id=>page.evaluate(id=>clone(current().nodes.find(n=>n.id===id)),id);
  const choose=async id=>{await page.evaluate(id=>{document.activeElement?.blur();selected=id;selection=new Set([id]);selectedInputId=null;inspectorTab='parameters';render();},id);await settle();};
  const connect=async(from,to,port)=>{const result=await page.evaluate(({from,to,port})=>{
    const a=current().nodes.find(n=>n.id===from),b=current().nodes.find(n=>n.id===to);
    return connectPorts({kind:'outputs',node:from,port:'out',type:ports(a,'outputs').out},{kind:'inputs',node:to,port,type:ports(b,'inputs')[port]});
  },{from,to,port});await settle();return result;};
  const undo=async redo=>{await page.locator(redo?'#redo':'#undo').click();await settle();};
  const reset=async()=>{await page.evaluate(id=>{
    cancelValueLadder();document.activeElement?.blur();clearTimeout(autoTimer);connectionInterrupted=true;conflicted=true;readonly=false;historyBusy=false;nativeMutationBusy=false;
    graph=clone(window.controlFixture);stage='pixel';graphTrail=[];selected=id;selection=new Set([id]);selectedInputId=null;selectedEdge=null;inspectorTab='parameters';past=[];future=[];dirty=false;
    rememberSavedGraph(graph);render();scale=.75;pan={x:20,y:30};transform();
  },compareId);await settle();};
  const operator=()=>page.locator(`#inspector [data-compare-operator="${compareId}"]`);
  const condition=()=>page.locator(`#inspector [data-parameter-node="${ifId}"][data-parameter-port="condition"]`);
  const inlineCondition=()=>card(ifId).locator('[data-inline-port="condition"]');
  try{
    await page.selectOption('#language','en');
    await page.evaluate(()=>{
      clearTimeout(autoTimer);connectionInterrupted=true;conflicted=true;readonly=false;historyBusy=false;nativeMutationBusy=false;graphTrail=[];stage='pixel';graph.functions=[];graph.declarations=[];
      graph.stages.pixel={nodes:[testNode('scalar','float',25,120,{value:.25}),testNode('vector','vec3',25,390,{value:[.2,.4,.6]}),testNode('ordinary','add',820,430),testNode('output','pixel_out',1180,160)],edges:[]};
      selected=null;selection.clear();past=[];future=[];dirty=false;rememberSavedGraph(graph);render();scale=.75;pan={x:20,y:30};transform();
    });await settle();
    for(const key of ['compare','if']){
      await page.locator('#canvas').focus();await page.keyboard.press('Tab');await page.locator('#creator').waitFor({state:'visible'});
      await page.locator('#createsearch').fill(key);await page.locator(`[data-create-entry="${key}"]`).click();await settle();
      const id=await page.evaluate(()=>selected);assert.equal((await state(id)).definitionUuid,'sgrape.builtin.'+key);
      if(key==='compare')compareId=id;else ifId=id;
    }
    assert.equal(await page.evaluate(()=>past.length),2);
    await page.evaluate(({compareId,ifId})=>{
      Object.assign(current().nodes.find(n=>n.id===compareId).ui,{x:310,y:120});Object.assign(current().nodes.find(n=>n.id===ifId).ui,{x:630,y:120});window.controlFixture=clone(graph);render();
    },{compareId,ifId});await settle();
    assert.deepEqual(await page.evaluate(id=>ports(current().nodes.find(n=>n.id===id),'outputs'),compareId),{out:'bool'});
    assert.equal((await state(ifId)).ui.typeMode,'auto');checks.push('Tab creator inserts Compare and If from the fresh core catalog with one Undo each; Compare outputs bool and If starts in Auto');

    await reset();assert.deepEqual(await operator().locator('option').evaluateAll(es=>es.map(e=>e.value)),['>','>=','<','<=','==','!=']);
    for(const value of ['>=','<','<=','==','!=','>']){
      const before=await page.evaluate(()=>JSON.stringify(graph)),count=await page.evaluate(()=>past.length);await operator().selectOption(value);await settle();
      assert.equal((await state(compareId)).params.operator,value);assert.equal(await card(compareId).locator('[data-compare-operator]').inputValue(),value);assert.equal(await page.evaluate(()=>past.length),count+1);
      const after=await page.evaluate(()=>JSON.stringify(graph));await undo();assert.equal(await page.evaluate(()=>JSON.stringify(graph)),before);await undo(true);assert.equal(await page.evaluate(()=>JSON.stringify(graph)),after);
    }
    await card(compareId).locator('[data-compare-operator]').selectOption('==');await settle();assert.equal(await operator().inputValue(),'==');
    checks.push('all six Compare operators synchronize header and Parameters; each selection has exact graph Undo/Redo');

    await reset();await choose(ifId);assert.equal(await condition().inputValue(),'false');assert.equal(await inlineCondition().inputValue(),'false');
    assert.deepEqual(await condition().locator('option').evaluateAll(es=>es.map(e=>e.value)),['false','true']);
    await condition().selectOption('true');await settle();assert.equal((await state(ifId)).inputValues.condition,true);assert.equal(await inlineCondition().inputValue(),'true');assert.equal(await page.evaluate(()=>past.length),1);
    await undo();assert.equal(await condition().inputValue(),'false');await undo(true);assert.equal(await condition().inputValue(),'true');
    await inlineCondition().selectOption('false');await settle();assert.equal((await state(ifId)).inputValues.condition,false);assert.equal(await condition().inputValue(),'false');
    checks.push('unconnected If condition is a real boolean select on canvas and Parameters, synchronized and undoable without numeric coercion');

    await reset();await choose(ifId);
    const output=card(compareId).locator('[data-kind="outputs"][data-port="out"]'),input=card(ifId).locator('[data-kind="inputs"][data-port="condition"]');
    const a=await output.boundingBox(),b=await input.boundingBox();assert.ok(a&&b);await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:10});await page.mouse.up();await settle();
    assert.equal(await page.evaluate(id=>current().edges.some(e=>e.to[0]===id&&e.to[1]==='condition'),ifId),true);
    assert.equal(await condition().count(),0);assert.equal(await inlineCondition().count(),0);assert.equal(await page.locator('#inspector [data-input="condition"] .connection-row').count(),1);
    await page.locator('#inspector [data-input="condition"] .connection-row button').click();await settle();assert.equal(await condition().inputValue(),'false');assert.equal(await inlineCondition().inputValue(),'false');await undo();assert.equal(await condition().count(),0);
    checks.push('real wire drag connects Compare bool output to If condition, replaces manual controls with source/disconnect UI, and disconnect Undo restores the wire');

    await reset();await choose(ifId);await condition().selectOption('true');assert.equal(await connect('vector',ifId,'true'),true);assert.equal((await state(ifId)).params.type,'vec3');assert.equal((await state(ifId)).inputValues.condition,true);
    assert.equal(await connect('scalar',ifId,'false'),true);assert.equal((await state(ifId)).params.type,'vec3');
    assert.deepEqual(await page.evaluate(id=>ports(current().nodes.find(n=>n.id===id),'inputs'),ifId),{condition:'bool',true:'vec3',false:'vec3'});
    assert.equal(await page.locator('#inspector [data-input="false"] .connection-row').count(),1);
    await page.screenshot({path:path.join(folder,'if-auto-connected.png')});
    checks.push('Auto If infers vector branches, accepts a scalar branch conversion, and preserves its independent boolean condition');

    await reset();await choose(ifId);const type=page.locator(`#inspector [data-math-type="${ifId}"]`);await type.selectOption('vec4');await settle();assert.equal((await state(ifId)).ui.typeMode,'locked');
    assert.equal(await connect('scalar',ifId,'true'),true);assert.equal((await state(ifId)).params.type,'vec4');
    const locked=await snapshot();assert.equal(await connect('vector',ifId,'false'),false);assert.equal(await snapshot(),locked);
    await type.selectOption('auto');await settle();assert.equal((await state(ifId)).params.type,'float');assert.equal((await state(ifId)).ui.typeMode,'auto');
    checks.push('If branch type locks keep scalar conversions while rejecting mismatched vector wires; switching back to Auto reinfers float');

    await reset();let before=await snapshot();assert.equal(await connect('vector',compareId,'a'),false);assert.equal(await snapshot(),before);
    assert.equal(await connect('scalar',ifId,'condition'),false);assert.equal(await snapshot(),before);assert.equal(await connect('vector',ifId,'condition'),false);assert.equal(await snapshot(),before);
    await choose(compareId);const compareType=page.locator(`#inspector [data-math-type="${compareId}"]`);
    assert.deepEqual(await compareType.locator('option').evaluateAll(es=>es.map(e=>e.value)),['auto','float','int','uint']);
    for(const numericType of ['int','uint']){
      await compareType.selectOption(numericType);await settle();const entry=card(compareId).locator('[data-inline-port="a"]');assert.equal(await entry.getAttribute('step'),'1');
      assert.equal(await entry.getAttribute('min'),numericType==='uint'?'0':'-2147483648');
      const old=await snapshot();await entry.fill('1.5');await entry.press('Enter');await settle();assert.equal(await snapshot(),old);await entry.press('Escape');
    }
    checks.push('vector comparisons and non-bool If conditions reject without graph/history edits; Compare exposes only float/int/uint and integer editors reject fractional input');

    await reset();for(const id of [compareId,ifId,'ordinary','vector']){
      await choose(id);const rows=await page.locator('#inspector .parameter-row').evaluateAll(es=>es.map(e=>({width:e.clientWidth,scroll:e.scrollWidth})));assert.ok(rows.length);assert.ok(rows.every(r=>r.scroll<=r.width+1),JSON.stringify({id,rows}));
      const pane=await page.locator('#inspector').evaluate(e=>({width:e.clientWidth,scroll:e.scrollWidth}));assert.ok(pane.scroll<=pane.width+1,JSON.stringify({id,pane}));
    }
    await choose(compareId);await page.screenshot({path:path.join(folder,'compare-parameters.png')});await choose(ifId);await page.screenshot({path:path.join(folder,'if-parameters.png')});
    checks.push('Compare, If, ordinary scalar math and vector Parameters keep aligned rows without horizontal overflow');

    await page.evaluate(()=>{readonly=true;render();});assert.equal(await condition().isDisabled(),true);assert.equal(await inlineCondition().isDisabled(),true);await choose(compareId);assert.equal(await operator().isDisabled(),true);assert.equal(await card(compareId).locator('[data-compare-operator]').isDisabled(),true);
    checks.push('read-only mode disables Compare operator and If boolean controls on both surfaces');
    assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,count:checks.length}));
  }catch(error){await h.finish(error);throw error;}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
