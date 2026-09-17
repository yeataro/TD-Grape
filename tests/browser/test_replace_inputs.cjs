/* Replace Auto follows the base while preserving disconnected manual components. */
const path=require('node:path'),assert=require('node:assert/strict');
const {harness}=require('./test_glsl_code.cjs');
const [source,stateFile,folder]=process.argv.slice(2);
(async()=>{const h=await harness(source,stateFile,folder);const{page,checks,errors,settle}=h;page.setDefaultTimeout(6000);
try{
await page.evaluate(()=>{readonly=false;historyBusy=false;nativeMutationBusy=false;graph.functions=[];graph.declarations=[];graph.stages.pixel={nodes:[],edges:[]};stage='pixel';graphTrail=[];past=[];future=[];selected=null;selection.clear();render();scale=1;pan={x:30,y:30};transform();});
const id=await page.evaluate(()=>{const n=instantiate(catalog.find(d=>d.key==='replace'),310,40);n.params.components=[.1,.2,.3,.4];current().nodes.push(testNode('base','vector',30,40,{type:'vec2',components:[.9,.8,.7,.6]}));selectNode(n);inspectorTab='parameters';render();return n.id;});
const card=()=>page.locator(`[data-node="${id}"]`),selector=()=>card().locator('[data-node-selector]');
assert.equal(await selector().inputValue(),'auto');assert.equal(await card().locator('[data-inline-port]').count(),2);assert.equal(await page.locator('#inspector .input-values input[type="number"]').count(),2);
assert.deepEqual(await card().locator('[data-inline-port]').evaluateAll(items=>items.map(el=>el.value)),['0.1','0.2']);
checks.push('New Replace defaults to Auto and retains manual component editors in both canvas and Parameter when the base is disconnected');
await card().locator('[data-inline-port="x"]').fill('0.25');await card().locator('[data-inline-port="x"]').press('Enter');await card().locator('[data-inline-port="x"]').blur();await settle();
assert.equal(await page.evaluate(id=>current().nodes.find(n=>n.id===id).params.components[0],id),.25);
checks.push('An unconnected Auto Replace still accepts and saves a manually entered component');
const connect=()=>page.evaluate(id=>connectPorts({node:'base',port:'out',kind:'outputs'},{node:id,port:'value',kind:'inputs'}),id);
assert.equal(await connect(),true);assert.equal(await card().locator('[data-inline-port]').count(),0);assert.equal(await page.locator('#inspector .input-values input[type="number"]').count(),0);
for(const type of ['vec3','vec4','vec2']){
  await page.locator('[data-node="base"] [data-node-selector]').selectOption(type);
  const state=await page.evaluate(id=>{const n=current().nodes.find(n=>n.id===id);return{type:n.params.type,mode:n.ui.typeMode,components:n.params.components,base:current().edges.some(e=>e.to[0]===id&&e.to[1]==='value')};},id);
  assert.equal(state.type,type);assert.equal(state.mode,'auto');assert.equal(state.base,true);assert.deepEqual(state.components,[.25,.2,.3,.4]);assert.equal(await selector().inputValue(),'auto');
  assert.equal(await card().locator('[data-kind="inputs"]').count(),Number(type.at(-1))+1);
}
checks.push('Connected Auto Replace follows vec2/vec3/vec4 base changes, keeps the base wire, and never erases dormant manual values');
const before=await page.evaluate(()=>({graph:JSON.stringify(graph),history:past.length}));
assert.equal(await page.evaluate(id=>change(()=>{current().edges=current().edges.filter(e=>!(e.to[0]===id&&e.to[1]==='value'));}),id),true);
assert.deepEqual(await card().locator('[data-inline-port]').evaluateAll(items=>items.map(el=>el.value)),['0.25','0.2']);assert.equal(await page.locator('#inspector .input-values input[type="number"]').count(),2);
assert.equal(await page.evaluate(()=>past.length),before.history+1);await page.evaluate(()=>undo());assert.equal(await page.evaluate(()=>JSON.stringify(graph)),before.graph);assert.equal(await card().locator('[data-inline-port]').count(),0);await page.evaluate(()=>undo(true));assert.equal(await card().locator('[data-inline-port]').count(),2);
checks.push('Disconnecting the Auto base restores the saved values in one Undo/Redo step');
await selector().selectOption('vec4');assert.equal(await page.evaluate(id=>current().nodes.find(n=>n.id===id).ui.typeMode,id),'locked');assert.equal(await card().locator('[data-inline-port]').count(),4);
assert.deepEqual(await card().locator('[data-inline-port]').evaluateAll(items=>items.map(el=>el.value)),['0.25','0.2','0.3','0.4']);
await selector().selectOption('auto');assert.equal(await selector().inputValue(),'auto');assert.equal(await page.evaluate(id=>current().nodes.find(n=>n.id===id).params.type,id),'vec4');
checks.push('Manual vec4 lock and returning to Auto without a base keep the chosen width and all four saved fallback values');
await page.locator('[data-node="base"] [data-node-selector]').selectOption('vec3');assert.equal(await connect(),true);assert.equal(await page.evaluate(id=>current().nodes.find(n=>n.id===id).params.type,id),'vec3');
assert.equal(await page.locator(`#inspector [data-vector-type="${id}"]`).inputValue(),'auto');
checks.push('Reconnect resolves from the base again and Parameter exposes the same Auto selection');
await settle();await page.screenshot({path:path.join(folder,'replace-auto.png')});assert.equal(errors.length,0,errors.join('\n'));console.log(JSON.stringify({checks,errors}));await h.finish();
}catch(error){console.error(error);await h.finish(error);process.exitCode=1;}})();
