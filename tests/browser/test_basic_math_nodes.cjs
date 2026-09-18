/* Browser creator, real controls and Undo against refreshed isolated fixtures. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {harness}=require('./test_glsl_code.cjs');
const[source,stateFile,folder]=process.argv.slice(2);
(async()=>{
  fs.mkdirSync(folder,{recursive:true});const fixture=path.join(folder,'fresh-state.json');
  execFileSync(process.env.PYTHON_EXECUTABLE||'python',[path.join(__dirname,'export_editor_fixture.py'),stateFile,fixture],{stdio:'pipe'});
  const h=await harness(source,fixture,folder),{page,checks,errors,settle}=h;page.setDefaultTimeout(6000);
  const aliases={sign:'signum',sqrt:'square root',floor:'floor(A)',round:'round(A)',ceil:'ceil(A)',trunc:'int(A)',mod:'mod(A,B)'};
  const catalog=JSON.parse(fs.readFileSync(path.resolve(source,'../library/node_catalog.json'),'utf8'));
  const snapshot=()=>page.evaluate(()=>JSON.stringify(graph));
  try{
    await page.selectOption('#language','en');
    await page.evaluate(()=>{
      clearTimeout(autoTimer);connectionInterrupted=true;conflicted=true;readonly=false;historyBusy=false;nativeMutationBusy=false;graphTrail=[];stage='pixel';graph.functions=[];graph.declarations=[];
      graph.stages.pixel={nodes:[testNode('output','pixel_out',900,100)],edges:[]};selected=null;selection.clear();past=[];future=[];dirty=false;rememberSavedGraph(graph);render();scale=.8;pan={x:30,y:50};transform();
    });await settle();
    for(const [key,query] of Object.entries(aliases)){
      const row=catalog.definitions.find(row=>row.definition.key===key);
      assert.deepEqual(await page.evaluate(id=>browserData().nodes[id],row.definition.definitionUuid),row.browser);
      await page.locator('#canvas').focus();await page.keyboard.press('Tab');await page.locator('#creator').waitFor({state:'visible'});await page.locator('#createsearch').fill(query);
      const entry=page.locator(`[data-create-entry="${key}"]`);assert.equal(await entry.count(),1);await entry.hover();
      const help=await page.locator('#createdetail .help-markdown').textContent();assert.ok(help&&!help.includes('help.'+key),key);assert.ok(help.includes('Khronos GLSL'));
      const count=await page.evaluate(()=>past.length);await entry.click();await settle();const id=await page.evaluate(()=>selected);
      assert.equal(await page.evaluate(id=>current().nodes.find(n=>n.id===id).ui.typeMode,id),'auto');assert.equal(await page.evaluate(()=>past.length),count+1);
      await page.evaluate(id=>{current().nodes.find(n=>n.id===id).ui.x=180;current().nodes.find(n=>n.id===id).ui.y=100;inspectorTab='parameters';render();},id);await settle();
      const card=page.locator(`[data-node="${id}"]`),type=page.locator(`#inspector [data-math-type="${id}"]`);
      assert.deepEqual(await type.locator('option').evaluateAll(es=>es.map(e=>e.value)),['auto','float','vec2','vec3','vec4']);
      for(const ty of ['vec2','vec3','vec4','float']){
        await type.selectOption(ty);await settle();assert.equal(await page.evaluate(id=>ports(current().nodes.find(n=>n.id===id),'outputs').out,id),ty);
        assert.equal(await card.locator('[data-math-type]').inputValue(),ty);
      }
      const port=key==='mod'?'a':'value',input=card.locator(`[data-inline-port="${port}"]`);
      const before=await snapshot();await input.fill('0.375');await input.press('Enter');await settle();const edited=await snapshot();assert.notEqual(edited,before);
      assert.equal(await page.locator(`#inspector [data-parameter-node="${id}"][data-parameter-port="${port}"]`).inputValue(),'0.375');
      await page.locator('#undo').click();await settle();assert.equal(await snapshot(),before);await page.locator('#redo').click();await settle();assert.equal(await snapshot(),edited);
      if(key==='mod')assert.equal(await card.locator('[data-inline-port="b"]').inputValue(),'1');
      const rows=await page.locator('#inspector .parameter-row').evaluateAll(es=>es.map(e=>({width:e.clientWidth,scroll:e.scrollWidth})));assert.ok(rows.length);assert.ok(rows.every(r=>r.scroll<=r.width+1));
      checks.push(key+': searchable native alias/help, creator Undo, shared Auto/locked selectors, inline/Parameter edits and exact Undo/Redo');
      if(key==='mod')await page.screenshot({path:path.join(folder,'modulo-parameters.png')});
    }
    await page.evaluate(()=>{readonly=true;render();});assert.equal(await page.locator('#inspector [data-math-type]').isDisabled(),true);
    checks.push('read-only mode disables shared type controls');assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,count:checks.length}));
  }catch(error){await h.finish(error);throw error;}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
