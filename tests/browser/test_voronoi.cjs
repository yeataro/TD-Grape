const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {harness}=require('./test_glsl_code.cjs');
(async()=>{
  const[source,state,folder]=process.argv.slice(2),h=await harness(source,state,folder,{skipPreview:true,autoDisconnectInvalidEdges:false}),{page,checks,errors}=h;
  try{
    await page.selectOption('#language','en');
    await page.evaluate(()=>{
      nativeSourcePolling=uniformPolling=customPolling=true;uniformLive.disconnect();uniformLive.connect=()=>{};
      clearTimeout(autoTimer);scheduleGraphApply=()=>{};readonly=historyBusy=nativeMutationBusy=false;connectionInterrupted=true;
      stage='pixel';graphTrail=[];past=[];future=[];selection.clear();selected=null;
      graph.stages.pixel={nodes:[testNode('result','pixel_out',650,200)],edges:[]};render();
      const r=$('#canvas').getBoundingClientRect();openCreator(r.left+160,r.top+200);
    });
    await page.locator('#createsearch').fill('Voronoi');
    assert.equal(await page.locator('[data-create-entry="voronoi"]').getAttribute('data-browser-category'),'math');
    await page.locator('[data-create-entry="voronoi"]').click();
    await page.locator('[data-voronoi-option="dimensions"]').waitFor();
    const id=await page.evaluate(()=>selected),card=page.locator(`[data-node="${id}"]`);
    assert.equal(await card.locator('select,[data-voronoi-option]').count(),0);
    checks.push('Voronoi is searchable and creatable; mode controls appear only in Parameter');
    const interfaces=await page.evaluate(()=>clone(typeContract.voronoi.interfaces));
    for(const dim of [1,2,3,4]){
      await page.locator('[data-voronoi-option="dimensions"]').selectOption(String(dim));
      for(const feature of ['f1','f2','smooth_f1','distance_to_edge','n_sphere_radius']){
        await page.locator('[data-voronoi-option="feature"]').selectOption(feature);
        const nearest=['f1','f2','smooth_f1'].includes(feature);
        assert.equal(await page.locator('[data-voronoi-option="metric"]').count(),Number(nearest&&dim!==1));
        assert.equal(await page.locator('[data-voronoi-option="normalize"]').count(),Number(feature!=='n_sphere_radius'));
        for(const metric of nearest&&dim!==1?['euclidean','manhattan','chebyshev','minkowski']:['euclidean']){
          if(nearest&&dim!==1)await page.locator('[data-voronoi-option="metric"]').selectOption(metric);
          const ports=await page.evaluate(id=>{const n=current().nodes.find(n=>n.id===id);return {inputs:window.ports?window.ports(n,'inputs'):ports(n,'inputs'),outputs:ports(n,'outputs')};},id);
          assert.deepEqual(ports,interfaces[`${dim}:${feature}:${metric}`]);
          const actual=await card.locator('.port[data-kind="inputs"]').evaluateAll(es=>Object.fromEntries(es.map(e=>[e.dataset.port,e.dataset.type])));
          assert.deepEqual(actual,ports.inputs);
        }
      }
    }
    checks.push('All dimensions, features and distance metrics expose matching compiler/UI ports');
    await page.locator('[data-voronoi-option="feature"]').selectOption('f1');
    await page.locator('[data-voronoi-option="dimensions"]').selectOption('3');
    await page.locator('[data-voronoi-option="metric"]').selectOption('euclidean');
    await page.evaluate(id=>{const n=current().nodes.find(n=>n.id===id);change(()=>{n.inputValues={vector:[.2,.3,.4],scale:7,detail:2.5};});},id);
    const before=await page.evaluate(()=>clone(graph));
    await page.locator('[data-voronoi-option="feature"]').selectOption('n_sphere_radius');
    assert.deepEqual(await page.evaluate(id=>current().nodes.find(n=>n.id===id).inputValues,id),{vector:[.2,.3,.4],scale:7});
    await page.evaluate(()=>undo());assert.deepEqual(await page.evaluate(()=>clone(graph)),before);
    await page.evaluate(()=>undo(true));
    await page.locator('[data-voronoi-option="feature"]').selectOption('f1');
    assert.equal(await page.evaluate(id=>current().nodes.find(n=>n.id===id).inputValues.detail,id),2.5);
    checks.push('Mode changes cache hidden input values and Undo/Redo restores the entire graph');
    await page.evaluate(id=>{
      current().nodes.push(testNode('level','float',30,500));render();
      connectPorts({node:'level',port:'out',kind:'outputs'},{node:id,port:'scale',kind:'inputs'});
      connectPorts({node:id,port:'distance',kind:'outputs'},{node:'result',port:'color',kind:'inputs'});
    },id);
    await page.locator('[data-voronoi-option="feature"]').selectOption('f2');
    assert.equal(await page.evaluate(()=>current().edges.length),2);
    const wired=await page.evaluate(()=>clone(graph));
    await page.locator('[data-voronoi-option="feature"]').selectOption('n_sphere_radius');
    assert.equal(await page.evaluate(()=>current().edges.length),2);
    assert.equal(await card.locator('.missing-port').count(),1);
    await page.evaluate(()=>undo());assert.deepEqual(await page.evaluate(()=>clone(graph)),wired);
    checks.push('Compatible wires survive; removed output remains visibly invalid; Undo restores it');
    for(const language of ['en','zh-Hant','ja','fr','ko']){
      await page.selectOption('#language',language);
      assert(!(await page.locator('#inspector').innerText()).includes('voronoi.'));
      assert((await page.locator('#nodehelp').innerText()).includes('Blender'));
    }
    checks.push('Parameter controls and Help are translated in all five languages');
    await page.selectOption('#language','zh-Hant');
    await page.evaluate(id=>{const n=current().nodes.find(n=>n.id===id);n.ui.x=170;n.ui.y=120;scale=.9;pan={x:40,y:40};render();},id);
    fs.writeFileSync(path.join(folder,'graph.json'),JSON.stringify(await page.evaluate(()=>clone(graph))));
    await page.screenshot({path:path.join(folder,'voronoi.png')});
    assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,checks:checks.length}));
  }catch(e){await h.finish(e);throw e;}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
