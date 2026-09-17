/* Plain-text Comment node, tested through the isolated API harness. */
const assert=require('node:assert/strict');
const {harness}=require('./test_glsl_code.cjs');
const [source,stateFile,folder]=process.argv.slice(2);
(async()=>{
  const h=await harness(source,stateFile,folder),{page,checks,errors,settle,drag,at}=h;
  page.setDefaultTimeout(6000);
  try{
    await page.evaluate(()=>{
      clearTimeout(autoTimer);connectionInterrupted=true;conflicted=true;readonly=false;historyBusy=false;nativeMutationBusy=false;
      graphTrail=[];graph.functions=[];graph.declarations=[];stage='pixel';selectedInputId=null;
      graph.stages.pixel={nodes:[testNode('pixel','pixel_out',600,300)],edges:[]};
      selected=null;selection.clear();past=[];future=[];dirty=false;inspectorTab='parameters';rememberSavedGraph(graph);render();scale=1;pan={x:30,y:40};transform();
      const rect=$('#canvas').getBoundingClientRect();openCreator(rect.left+150,rect.top+140);
    });
    await page.locator('#createsearch').fill('註解');
    assert.equal(await page.locator('[data-create-entry="comment"]').count(),1);
    await page.locator('[data-create-entry="comment"]').click();await settle();
    const id=await page.evaluate(()=>selected),node=()=>page.locator(`[data-node="${id}"]`),body=()=>node().locator('[data-comment-node]'),parameter=()=>page.locator('#inspector [data-comment-node]');
    assert.equal(await node().getAttribute('data-category'),'annotation');assert.equal(await node().locator('.port').count(),0);
    assert.equal(await body().count(),1);assert.equal(await parameter().count(),1);assert.equal(await page.evaluate(()=>past.length),1);
    checks.push('Comment is searchable by its translated alias, created as a neutral card with no ports, and editable on both surfaces');

    const text='First line\n<img src=x onerror=alert(1)>\n**plain text**';
    await body().fill(text);assert.equal(await page.evaluate(()=>nodeComment(current().nodes.find(n=>n.id===selected))),'');
    await body().press('Control+Enter');await settle();
    assert.equal(await body().inputValue(),text);assert.equal(await parameter().inputValue(),text);assert.equal(await node().locator('img').count(),0);assert.equal(await page.evaluate(()=>past.length),2);
    await page.locator('#undo').click();assert.equal(await body().inputValue(),'');await page.locator('#redo').click();assert.equal(await body().inputValue(),text);
    checks.push('Multiline and HTML-looking text remain plain text; one edit synchronizes both surfaces with one Undo/Redo');

    await body().fill('Canvas draft');await page.evaluate(()=>render());
    assert.equal(await body().inputValue(),'Canvas draft');assert.equal(await body().evaluate(e=>e===document.activeElement),true);
    assert.equal(await parameter().inputValue(),text);await body().press('Escape');assert.equal(await body().inputValue(),text);assert.equal(await parameter().inputValue(),text);
    checks.push('A canvas draft keeps focus through a full redraw and does not leak into the other editor when cancelled');

    await parameter().fill('Draft survives a redraw');await page.evaluate(()=>inspector());assert.equal(await parameter().inputValue(),'Draft survives a redraw');
    await parameter().press('Escape');assert.equal(await parameter().inputValue(),text);
    await parameter().fill('Parameter update');await parameter().press('Control+Enter');assert.equal(await body().inputValue(),'Parameter update');
    checks.push('Parameter drafts survive rebuilding the inspector; Escape discards only the draft, and committing updates the canvas');

    const before=await page.evaluate(id=>({...current().nodes.find(n=>n.id===id).ui}),id),start=await at(`[data-node="${id}"] .node-title`);
    await drag(start,{x:start.x+60,y:start.y+48});
    const moved=await page.evaluate(id=>({...current().nodes.find(n=>n.id===id).ui}),id);
    assert.notEqual(moved.x,before.x);assert.equal(moved.comment,'Parameter update');
    await page.evaluate(id=>setNodesCollapsed([id],true),id);assert.equal(await body().count(),0);assert.equal(await node().locator('.port').count(),0);
    await page.evaluate(id=>setNodesCollapsed([id],false),id);assert.equal(await body().inputValue(),'Parameter update');
    checks.push('Header drag and collapse reuse ordinary card behavior and preserve comment text without introducing sockets');

    const pasted=await page.evaluate(id=>{
      const data=current(),text=GraphClipboard.encode(graph,data,[id],shaderId),snapshot=GraphClipboard.decode(text);
      let ids;change(()=>{ids=GraphClipboard.paste(graph,data,snapshot,{source:shaderId,stage,target:editorTarget,catalog,types:numericTypes(),anchor:{x:390,y:420}});});
      return data.nodes.find(n=>n.id!==id&&n.definitionUuid==='sgrape.builtin.comment')?.id;
    },id);
    assert.ok(pasted);assert.equal(await page.locator(`[data-node="${pasted}"] [data-comment-node]`).inputValue(),'Parameter update');
    await page.evaluate(id=>{selectNode(current().nodes.find(n=>n.id===id));remove();},pasted);assert.equal(await page.locator(`[data-node="${pasted}"]`).count(),0);
    await page.locator('#undo').click();assert.equal(await page.locator(`[data-node="${pasted}"] [data-comment-node]`).inputValue(),'Parameter update');
    checks.push('Existing portable selection clipboard copies comment text and appearance; deleting and undoing restores the entire node');

    const grouped=await page.evaluate(id=>{
      current().nodes.push(testNode('group_value','float',300,600,{value:.75}));current().edges.push({from:['group_value','out'],to:['pixel','color']});
      selection=new Set([id,'group_value']);selected=id;groupSelection();
      const call=current().nodes.find(n=>n.id===selected),fn=FunctionModel.find(graph,call.params.functionId);
      return {id:call.id,text:fn.graph.nodes.find(n=>n.definitionUuid==='sgrape.builtin.comment').ui.comment,outputs:fn.outputs.length};
    },id);
    assert.equal(grouped.text,'Parameter update');assert.equal(grouped.outputs,1);
    const portable=await page.evaluate(id=>{
      const payload=GraphClipboard.decode(GraphClipboard.encode(graph,current(),[id],shaderId));
      return payload.functions[0].graph.nodes.find(n=>n.definitionUuid==='sgrape.builtin.comment').ui.comment;
    },grouped.id);
    assert.equal(portable,'Parameter update');
    require('node:fs').writeFileSync(require('node:path').join(folder,'grouped-comment.json'),await page.evaluate(()=>JSON.stringify(graph)));
    await page.locator('#undo').click();assert.equal(await body().inputValue(),'Parameter update');
    checks.push('Subgraph extraction carries the Comment with selected nodes, preserves signal outputs and serializes it in the portable function snapshot; Undo restores the original card');

    await page.evaluate(id=>{selectNode(current().nodes.find(n=>n.id===id));readonly=true;render();},id);
    assert.equal(await body().getAttribute('readonly'),'');assert.equal(await parameter().getAttribute('readonly'),'');
    await page.screenshot({path:require('node:path').join(folder,'comment-node.png')});
    assert.deepEqual(errors,[]);checks.push('Read-only state disables both text editors; no browser errors');
    await h.finish();console.log(JSON.stringify({passed:true,count:checks.length}));
  }catch(e){await h.finish(e);throw e;}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
