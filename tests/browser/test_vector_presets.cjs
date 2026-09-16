/* Exact-dimension insertion through the real sidebar and floating creator. */
const assert=require('node:assert/strict');
const {harness}=require('./test_glsl_code.cjs');
async function run(){
  const [source,stateFile,folder]=process.argv.slice(2),h=await harness(source,stateFile,folder),{page,checks,errors,at,drag,settle}=h;
  try{
    await page.selectOption('#language','en');
    const selected=()=>page.evaluate(()=>clone(current().nodes.find(n=>n.id===selected)));
    const reset=()=>page.evaluate(()=>{
      closeCreator();graphTrail=[];graph.functions=[];graph.declarations=[];stage='pixel';past=[];future=[];selected=selectedEdge=null;selection.clear();
      graph.stages.pixel={nodes:[testNode('pixel','pixel_out',650,60)],edges:[]};scale=.8;pan={x:25,y:25};render();
    });
    await reset();await page.locator('#search').fill('Vector');
    for(const size of [2,3,4])assert.equal(await page.locator(`#browsersearchitems [data-entry="vector:vec${size}"]`).count(),1);
    await page.locator('#search').fill('vec3');
    assert.equal(await page.locator('#browsersearchitems [data-entry="vector:vec3"]').count(),1);
    assert.equal(await page.locator('#browsersearchitems [data-entry="vector:vec2"],#browsersearchitems [data-entry="vector:vec4"]').count(),0);
    assert.match(await page.locator('#browsersearchitems [data-entry="vec3"]').innerText(),/Constant/);
    checks.push('sidebar exposes three independent Vector entries, exact dimension search, and distinct legacy constants');
    await page.locator('#search').fill('Vector');
    await page.locator('#browsersearchitems [data-entry="vector:vec3"]').click();
    assert.match(await page.locator('#browserdetail .browser-signature').innerText(),/vec3/);
    await page.locator('#browsersearchitems [data-add-entry="vector:vec3"]').click();
    assert.equal((await selected()).params.type,'vec3');assert.equal((await selected()).definitionUuid,'sgrape.builtin.vector');
    assert.equal(await page.evaluate(()=>past.length),1);await page.locator('#undo').click();
    await page.locator('#browsersearchitems [data-entry="vector:vec4"]').dblclick();assert.equal((await selected()).params.type,'vec4');await page.locator('#undo').click();
    const canvas=await page.locator('#canvas').boundingBox();
    await drag(await at('#browsersearchitems [data-entry="vector:vec2"]'),{x:canvas.x+240,y:canvas.y+300});assert.equal((await selected()).params.type,'vec2');
    await page.locator('#undo').click();await page.locator('#browsersearchitems [data-add-entry="vec3"]').click();
    assert.equal((await selected()).definitionUuid,'sgrape.builtin.vec3');assert.equal(Object.hasOwn((await selected()).params,'type'),false);
    checks.push('sidebar +, double-click and pointer drag instantiate the chosen dimension; constant entries retain their original node semantics');
    await reset();
    const open=wire=>page.evaluate(wire=>{const r=$('#canvas').getBoundingClientRect();openCreator(r.left+180,r.top+170,wire);},wire);
    await open(null);await page.locator('#createsearch').fill('Vector');
    for(const size of [2,3,4])assert.equal(await page.locator(`[data-create-entry="vector:vec${size}"]`).count(),1);
    await page.locator('#createsearch').fill('vec3');assert.equal(await page.locator('[data-create-entry^="vector:"]').count(),1);
    await page.locator('[data-create-entry="vector:vec3"]').click();assert.equal((await selected()).params.type,'vec3');
    checks.push('floating Add has independent Vector 2/3/4 entries and exact vec3 search creates Vector 3 directly');
    await reset();await page.evaluate(()=>{current().nodes.push(testNode('pair','vec2',30,180));render();});
    await open({node:'pair',port:'out',kind:'outputs',type:'vec2'});await page.locator('#createsearch').fill('Vector');
    assert.equal(await page.locator('[data-create-entry^="vector:"]').count(),3);
    await page.locator('[data-create-entry="vector:vec3"]').click();
    const assembled=await selected();assert.equal(assembled.params.type,'vec3');assert.deepEqual(assembled.params.groups,{x:'vec2'});
    assert.ok(await page.evaluate(id=>current().edges.some(e=>e.from[0]==='pair'&&e.to[0]===id&&e.to[1]==='x'),assembled.id));
    await reset();await page.evaluate(()=>{current().nodes.push(testNode('destination','vector',340,150,{type:'vec4'}));render();});
    await open({node:'destination',port:'value',kind:'inputs',type:'vec4'});await page.locator('#createsearch').fill('Vector');
    assert.equal(await page.locator('[data-create-entry^="vector:"]').count(),1);assert.equal(await page.locator('[data-create-entry="vector:vec4"]').count(),1);
    await page.locator('[data-create-entry="vector:vec4"]').click();assert.equal((await selected()).params.type,'vec4');
    checks.push('wire-context entries keep exact preset dimensions, group compatible inputs, and filter incompatible whole-vector outputs');
    await settle();assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,count:checks.length,checks}));
  }catch(error){await h.finish(error);throw error;}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
