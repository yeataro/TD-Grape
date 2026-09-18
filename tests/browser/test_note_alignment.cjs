/* Persistent canvas Note alignment; isolated fixture API never reaches TD.
 * node test_note_alignment.cjs SOURCE_DIR STATE_JSON REPORT_DIR */
const assert=require('node:assert/strict'),path=require('node:path');
const {harness}=require('./test_glsl_code.cjs');
const[source,stateFile,folder]=process.argv.slice(2);
(async()=>{
  const h=await harness(source,stateFile,folder),{page,checks,errors,settle}=h;
  page.setDefaultTimeout(6000);
  const setting=()=>page.locator('#inspector [data-note-text-align="note"]');
  const card=()=>page.locator('[data-node="note"]');
  const preview=()=>card().locator('.comment-node-preview');
  const saved=()=>page.evaluate(()=>JSON.stringify(graph));
  const alignment=()=>preview().locator('h1').evaluate(e=>getComputedStyle(e).textAlign);
  try{
    await page.selectOption('#language','en');
    await page.evaluate(()=>{
      document.activeElement?.blur();clearTimeout(autoTimer);connectionInterrupted=true;conflicted=true;readonly=false;historyBusy=false;nativeMutationBusy=false;stage='pixel';graphTrail=[];graph.functions=[];graph.declarations=[];
      const note=testNode('note','comment',80,150);Object.assign(note.ui,{width:430,height:300,comment:'# Heading\n\nA short paragraph.\n\n```glsl\nvec3 color = vec3(1.0);\n```'});
      graph.stages.pixel={nodes:[note,testNode('output','pixel_out',700,180)],edges:[]};selected='note';selection=new Set(['note']);selectedInputId=null;inspectorTab='settings';past=[];future=[];dirty=false;rememberSavedGraph(graph);setGraphFocus(false);render();scale=1;pan={x:15,y:20};transform();
    });await settle();
    const original=await saved(),dimensions=await card().evaluate(e=>({width:e.offsetWidth,height:e.offsetHeight}));
    assert.equal(await setting().inputValue(),'left');assert.equal(await alignment(),'left');
    await setting().selectOption('center');await settle();
    assert.equal(await alignment(),'center');assert.equal(await page.evaluate(()=>past.length),1);
    assert.equal(await preview().locator('pre').evaluate(e=>getComputedStyle(e).textAlign),'left');
    assert.equal(await page.evaluate(()=>hasShaderChanges()),false);
    const centered=await saved();await page.locator('#undo').click();await settle();assert.equal(await saved(),original);assert.equal(await setting().inputValue(),'left');
    await page.locator('#redo').click();await settle();assert.equal(await saved(),centered);assert.equal(await alignment(),'center');
    await setting().selectOption('right');await settle();assert.equal(await alignment(),'right');
    assert.deepEqual(await card().evaluate(e=>({width:e.offsetWidth,height:e.offsetHeight})),dimensions);
    checks.push('Settings change canvas text only, preserve code alignment and node size, and use one shader-neutral Undo/Redo step');
    await page.screenshot({path:path.join(folder,'note-alignment-right.png')});

    await preview().dblclick();await settle();
    const editor=card().locator('textarea');assert.equal(await editor.isVisible(),true);assert.ok(['left','start'].includes(await editor.evaluate(e=>getComputedStyle(e).textAlign)));
    await editor.press('Escape');await settle();
    await page.locator('#inspector').getByRole('tab',{name:'Parameters',exact:true}).click();await settle();
    assert.ok(['left','start'].includes(await page.locator('#inspector [data-comment-node]').evaluate(e=>getComputedStyle(e).textAlign)));
    await page.locator('#inspector').getByRole('tab',{name:'Settings',exact:true}).click();
    checks.push('Canvas edit mode and the Parameter raw-text editor keep their original text alignment');

    const persisted=await page.evaluate(()=>{
      document.activeElement?.blur();graph=JSON.parse(JSON.stringify(graph));render();
      const payload=GraphClipboard.decode(GraphClipboard.encode(graph,current(),['note'],shaderId));let ids;
      change(()=>{ids=GraphClipboard.paste(graph,current(),payload,{source:shaderId,stage,target:editorTarget,catalog,types:interfaceTypes(),anchor:{x:550,y:520}});});
      return {original:clone(current().nodes.find(n=>n.id==='note')),copy:clone(current().nodes.find(n=>ids.includes(n.id)))};
    });await settle();
    assert.equal(persisted.original.ui.noteTextAlign,'right');assert.equal(persisted.copy.ui.noteTextAlign,'right');
    assert.equal(persisted.copy.definitionUuid,persisted.original.definitionUuid);assert.equal(persisted.copy.revisionHash,persisted.original.revisionHash);assert.equal(await page.evaluate(()=>hasShaderChanges()),false);
    await page.evaluate(()=>{selected='note';selection=new Set(['note']);inspectorTab='settings';render();});await settle();
    await setting().selectOption('left');await settle();assert.equal(await page.evaluate(()=>Object.hasOwn(current().nodes.find(n=>n.id==='note').ui,'noteTextAlign')),false);
    await page.selectOption('#language','zh-Hant');assert.equal(await setting().getAttribute('aria-label'),'文字對齊');
    await page.evaluate(()=>{readonly=true;render();});assert.equal(await setting().isDisabled(),true);
    const beforeReadonly=await saved();await setting().evaluate(e=>{e.value='center';e.dispatchEvent(new Event('change'));});assert.equal(await saved(),beforeReadonly);
    checks.push('JSON and clipboard preserve alignment without changing definition identity; Left restores the default and readonly blocks changes');
    assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,count:checks.length}));
  }catch(error){await h.finish(error);throw error;}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
