/* Noise discovery and editing use the real UI, backed by an isolated fixture. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {harness}=require('./test_glsl_code.cjs');
const[source,stateFile,folder]=process.argv.slice(2);
(async()=>{
  fs.mkdirSync(folder,{recursive:true});const fixture=path.join(folder,'fresh-state.json');
  execFileSync(process.env.PYTHON_EXECUTABLE||'python',[path.join(__dirname,'export_editor_fixture.py'),stateFile,fixture],{stdio:'pipe'});
  const h=await harness(source,fixture,folder),{page,checks,errors,settle}=h;page.setDefaultTimeout(6000);
  const state=id=>page.evaluate(id=>clone(current().nodes.find(n=>n.id===id)),id);
  const choose=async id=>{await page.evaluate(id=>{document.activeElement?.blur();selected=id;selection=new Set([id]);selectedInputId=null;inspectorTab='parameters';render();},id);await settle();};
  try{
    await page.selectOption('#language','en');
    await page.evaluate(()=>{
      clearTimeout(autoTimer);connectionInterrupted=true;conflicted=true;readonly=false;historyBusy=false;nativeMutationBusy=false;graphTrail=[];stage='pixel';graph.functions=[];graph.declarations=[];
      graph.stages.pixel={nodes:[testNode('coordinates','vec3',20,180,{value:[.173,-2.41,3.19]}),testNode('output','pixel_out',840,180)],edges:[]};
      selected=null;selection.clear();past=[];future=[];dirty=false;rememberSavedGraph(graph);render();scale=.8;pan={x:20,y:20};transform();
    });await settle();
    const keys=['perlin_noise','simplex_noise'],ids=[];
    for(const [key,query]of [['perlin_noise','TDPerlinNoise'],['simplex_noise','TDSimplexNoise']]){
      await page.locator('#canvas').focus();await page.keyboard.press('Tab');await page.locator('#creator').waitFor({state:'visible'});
      await page.locator('#createsearch').fill(query);const entry=page.locator(`[data-create-entry="${key}"]`);assert.equal(await entry.count(),1);
      assert.equal(await entry.getAttribute('data-browser-category'),'math');await entry.click();await settle();
      const id=await page.evaluate(()=>selected);ids.push(id);const value=await state(id);assert.equal(value.definitionUuid,'sgrape.builtin.'+key);assert.equal(value.params.type,'vec2');assert.equal(value.ui.typeMode,'auto');
      await page.evaluate(({id,index})=>{Object.assign(current().nodes.find(n=>n.id===id).ui,{x:320,y:70+index*340});render();},{id,index:ids.length-1});await settle();
      assert.deepEqual(await page.evaluate(id=>ports(current().nodes.find(n=>n.id===id),'outputs'),id),{out:'float'});
    }
    assert.equal(await page.evaluate(()=>past.length),2);checks.push('TD helper names discover Perlin and Simplex in Math; Create uses Auto vec2 and float output with one Undo');
    const rows=JSON.parse(fs.readFileSync(path.resolve(source,'../library/node_catalog.json'),'utf8')).definitions.filter(row=>keys.includes(row.definition.key));
    for(const row of rows)assert.deepEqual(await page.evaluate(id=>browserData().nodes[id],row.definition.definitionUuid),row.browser);
    const generated=await page.evaluate(()=>JSON.stringify(graph));await page.locator('#canvas').focus();await page.keyboard.press('Tab');await page.locator('#createsearch').fill('noise');
    for(const key of keys)assert.equal(await page.locator(`[data-create-entry="${key}"]`).count(),1);await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>JSON.stringify(graph)),generated);
    checks.push('both shipped browser projections match the catalog and generic Noise search is read-only');

    for(const id of ids){
      await choose(id);const selector=page.locator(`#inspector [data-math-type="${id}"]`);
      assert.deepEqual(await selector.locator('option').evaluateAll(es=>es.map(e=>e.value)),['auto','vec2','vec3','vec4']);
      for(const type of ['vec3','vec4','vec2']){
        const before=await page.evaluate(()=>JSON.stringify(graph));await selector.selectOption(type);await settle();assert.equal((await state(id)).params.type,type);assert.equal((await state(id)).ui.typeMode,'locked');
        assert.equal(await page.locator('#inspector [data-input="position"] input[type="number"]:visible').count(),Number(type.at(-1)));
        const after=await page.evaluate(()=>JSON.stringify(graph));await page.locator('#undo').click();await settle();assert.equal(await page.evaluate(()=>JSON.stringify(graph)),before);await page.locator('#redo').click();await settle();assert.equal(await page.evaluate(()=>JSON.stringify(graph)),after);
      }
      await selector.selectOption('auto');await settle();
    }
    checks.push('both dimension selectors offer only Auto/vec2/vec3/vec4; coordinates and exact Undo/Redo follow dimension changes');

    const id=ids[0];await choose(id);
    const a=await page.locator('[data-node="coordinates"] [data-kind="outputs"][data-port="out"]').boundingBox(),b=await page.locator(`[data-node="${id}"] [data-kind="inputs"][data-port="position"]`).boundingBox();
    assert.ok(a&&b);await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:8});await page.mouse.up();await settle();
    assert.equal((await state(id)).params.type,'vec3');assert.equal(await page.locator('#inspector [data-input="position"] .connection-row').count(),1);
    await page.locator('#inspector [data-input="position"] .connection-row button').click();await settle();assert.equal((await state(id)).params.type,'vec2');
    await page.locator('#undo').click();await settle();assert.equal((await state(id)).params.type,'vec3');
    checks.push('real wire drag infers vec3; disconnect returns to vec2 and Undo restores the connection');

    for(const lang of ['en','zh-Hant']){
      await page.selectOption('#language',lang);await choose(ids[1]);const expected=lang==='en'?'Position':'座標';
      assert.equal(await page.locator('#inspector [data-input="position"] .parameter-value-label').first().innerText(),expected);
      for(const key of keys){const help=await page.evaluate(key=>t('help.'+key),key);assert.ok(help.includes(key==='perlin_noise'?'TDPerlinNoise':'TDSimplexNoise'));assert.ok(!help.startsWith('help.'));}
      const help=await page.evaluate(()=>t('help.simplex_noise'));assert.ok(help.includes('Performance／Quality')||help.includes('Performance/Quality'));
    }
    checks.push('Position and both help pages localize; Simplex help identifies the shared host Quality setting');
    for(const id of ids){await choose(id);const rows=await page.locator('#inspector .parameter-row').evaluateAll(es=>es.map(e=>({width:e.clientWidth,scroll:e.scrollWidth})));assert.ok(rows.every(r=>r.scroll<=r.width+1),JSON.stringify(rows));}
    await page.screenshot({path:path.join(folder,'noise-parameters.png')});checks.push('Noise Parameters retain shared aligned layout without horizontal overflow');
    await page.evaluate(()=>{readonly=true;render();});assert.equal(await page.locator(`#inspector [data-math-type="${ids[1]}"]`).isDisabled(),true);checks.push('read-only mode disables dimension editing');
    assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,count:checks.length}));
  }catch(error){await h.finish(error);throw error;}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
