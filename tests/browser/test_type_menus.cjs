/* Real shared type pickers: option completeness, depth, separators and navigation. */
const assert=require('node:assert/strict'),path=require('node:path');
const {harness}=require('./test_glsl_code.cjs');
const[source,stateFile,folder]=process.argv.slice(2);
(async()=>{
  const h=await harness(source,stateFile,folder,{skipPreview:true}),{page,checks,errors,settle}=h;
  const menu=()=>page.locator('#selectmenu'),panes=()=>menu().locator('.type-select-pane');
  const values=pane=>pane.locator('[data-select-value]').evaluateAll(items=>items.map(item=>item.dataset.selectValue));
  const group=async name=>{await panes().last().locator(`[data-type-group="${name}"]`).click();await settle();};
  const close=async()=>{if(await menu().count()){await page.keyboard.press('Escape');await settle();}};
  const fixture=async()=>{await close();await page.evaluate(()=>{
    document.querySelector('#type-menu-test')?.remove();window.typeEvents=[];
    const entry=typeSelect([['auto','Auto'],...valueTypes().map(type=>[type,type]),['float[4]','float[4]'],['sampler2D','sampler2D']],'auto',value=>typeEvents.push(value));entry.id='type-menu-test';
    Object.assign(entry.style,{position:'fixed',left:'20px',top:'160px',zIndex:10});document.body.append(entry);
  });await page.locator('#type-menu-test').click();await settle();};
  const open=async()=>{await close();await page.locator('#type-menu-test').click();await settle();};
  const fit=async()=>{const box=await menu().boundingBox(),viewport=page.viewportSize();assert.ok(box.x>=-1&&box.y>=-1&&box.x+box.width<=viewport.width+1&&box.y+box.height<=viewport.height+1,JSON.stringify(box));};
  try{
    await page.selectOption('#language','en');await fixture();
    const before=await page.evaluate(()=>JSON.stringify({graph,past,future}));
    assert.deepEqual(await panes().first().locator('[data-type-group]').evaluateAll(items=>items.map(item=>item.dataset.typeGroup)),['Floating','Integer','Boolean','Matrix','Double','Array','Sampler']);
    assert.equal(await panes().first().locator('[data-select-value="auto"] + [role="separator"]').count(),1);
    const families={Floating:['float','vec2','vec3','vec4'],Integer:['int','ivec2','ivec3','ivec4','uint','uvec2','uvec3','uvec4'],Boolean:['bool','bvec2','bvec3','bvec4'],Matrix:['mat2','mat3','mat4','mat2x3','mat2x4','mat3x2','mat3x4','mat4x2','mat4x3']};
    for(const [name,expected]of Object.entries(families)){
      await open();await group(name);assert.deepEqual(await values(panes().last()),expected);await fit();
      assert.equal(await panes().last().locator('[role="separator"]').count(),['Integer','Matrix'].includes(name)?1:0);
      if(name==='Integer')assert.equal(await panes().last().locator('[data-select-value="ivec4"] + [role="separator"]').count(),1);
      if(name==='Matrix')assert.equal(await panes().last().locator('[data-select-value="mat4"] + [role="separator"]').count(),1);
    }
    checks.push('all ordinary scalar/vector/matrix types appear exactly once, with agreed family and square-first matrix ordering and Auto/signed/shape separators');
    for(const name of ['Floating','Matrix']){await open();await group('Double');assert.equal(await panes().count(),2);await group(name);assert.equal(await panes().count(),3);assert.deepEqual(await values(panes().last()),name==='Floating'?['double','dvec2','dvec3','dvec4']:families.Matrix.map(type=>'d'+type));await fit();}
    await page.screenshot({path:path.join(folder,'double-matrix.png')});
    assert.equal(await page.evaluate(()=>JSON.stringify({graph,past,future})),before);assert.deepEqual(await page.evaluate(()=>typeEvents),[]);
    checks.push('Double requires the third level, dmat keeps the same shape separator, navigation never changes graph/history/selection');
    await panes().last().locator('[data-select-value="dmat3"]').click();assert.deepEqual(await page.evaluate(()=>typeEvents),['dmat3']);assert.equal(await page.locator('#type-menu-test').inputValue(),'dmat3');
    await open();await group('Array');assert.deepEqual(await values(panes().last()),['float[4]']);await open();await group('Sampler');assert.deepEqual(await values(panes().last()),['sampler2D']);await close();
    checks.push('leaf commits once; arrays and resources keep their complete identities');
    for(const width of [320,390])for(const scale of [75,125]){
      await page.setViewportSize({width,height:844});await page.evaluate(scale=>setUIAppearance('scale',scale),scale);await settle();await fixture();await group('Double');await group('Matrix');await fit();
      assert.equal(await panes().last().isVisible(),true);assert.equal(await panes().first().isVisible(),false);
      await panes().last().locator('.type-select-back').click();assert.equal(await panes().count(),2);await panes().last().locator('.type-select-back').click();assert.equal(await panes().count(),1);
      await group('Integer');await fit();await panes().last().locator('[data-select-value="uvec4"]').click();assert.deepEqual(await page.evaluate(()=>typeEvents),['uvec4']);
    }
    checks.push('320/390px and75/125% use drill-in/back, stay in viewport and commit the unsigned series correctly');
    await page.setViewportSize({width:1600,height:1100});await page.evaluate(()=>setUIAppearance('scale',100));await settle();await fixture();
    await page.locator('#type-menu-test').evaluate(entry=>entry.querySelector('option[value="dvec3"]').disabled=true);await open();await group('Double');await group('Floating');assert.equal(await panes().last().locator('[data-select-value="dvec3"]').isDisabled(),true);await close();
    await page.locator('#type-menu-test').focus();await page.keyboard.press('Enter');await page.keyboard.press('d');await page.keyboard.press('ArrowRight');await page.keyboard.press('ArrowRight');await page.keyboard.press('End');await page.keyboard.press('Enter');assert.deepEqual(await page.evaluate(()=>typeEvents),['dvec4']);
    checks.push('disabled leaf state survives grouping; keyboard reaches the third level and commits once');
    assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,count:checks.length}));
  }catch(error){await h.finish(error);throw error;}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
