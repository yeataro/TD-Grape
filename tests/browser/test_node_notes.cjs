/* Node notes share one tab across ordinary and source-reference nodes.
 * Uses the isolated fixture API; never connects to TD. */
const assert=require('node:assert/strict');
const {harness}=require('./test_glsl_code.cjs');
const [source,stateFile,folder]=process.argv.slice(2);
(async()=>{
  const h=await harness(source,stateFile,folder),{page,checks,errors,settle}=h;
  page.setDefaultTimeout(6000);
  const tab=index=>page.locator('#inspector .parameter-tabs [role=tab]').nth(index);
  const note=()=>page.locator('#inspector [data-node-comment]');
  const choose=async(id,notes=false)=>{await page.evaluate(({id,notes})=>{document.activeElement?.blur();selected=id;selection=new Set([id]);selectedInputId=null;inspectorTab=notes?'notes':'parameters';render();},{id,notes});await settle();};
  const sourceState=()=>page.evaluate(()=>JSON.stringify({declarations:graph.declarations,topInputs:graph.topInputs,params:current().nodes.map(n=>n.params),edges:current().edges}));
  try{
    await page.evaluate(()=>{
      clearTimeout(autoTimer);connectionInterrupted=true;conflicted=true;readonly=false;historyBusy=false;nativeMutationBusy=false;graphTrail=[];graph.functions=[];stage='pixel';
      graph.declarations=[
        {id:'constant_source',kind:'constant',name:'cValue',type:'float',value:.25},
        {id:'uniform_source',kind:'uniform',name:'uValue',type:'vec4',value:[1,.5,.2,1]},
        {id:'spec_source',kind:'spec_constant',name:'sValue',type:'int',value:2,constantId:0},
        {id:'sampler_source',kind:'sampler',name:'sTexture',type:'sampler2D',source:'builtin:white'}
      ];
      graph.topInputs=[{id:'top_source',name:'sTD2DInputs[0]',defaultSource:'builtin:white'}];
      const sources=[['constant','constant_source'],['uniform','uniform_source'],['spec_constant','spec_source'],['sampler','sampler_source']];
      const nodes=sources.map(([key,id],index)=>testNode(key,key,50+index*220,100,{declarationId:id}));
      nodes.push(testNode('top_input','top_input',50,350,{inputId:'top_source'}),testNode('ordinary','add',300,350),testNode('code','glsl_code',550,350),testNode('comment','comment',850,350));
      for(const n of nodes)n.ui.comment='Existing note for '+n.id;
      graph.stages.pixel={nodes,edges:[]};selected='constant';selection=new Set([selected]);selectedInputId=null;inspectorTab='parameters';past=[];future=[];dirty=false;rememberSavedGraph(graph);render();fit();
    });await settle();
    const originalSources=await sourceState();
    for(const id of ['constant','uniform','spec_constant','sampler','top_input','ordinary','code']){
      await choose(id);assert.equal(await page.locator('#inspector .parameter-tabs [role=tab]').count(),3,id+' has Parameters, Settings and Notes');
      assert.equal(await note().count(),0);assert.equal(await page.locator('#inspector details.node-comment-field').count(),0);
      const parameters=await page.locator('#inspector').innerText();
      await tab(1).click();assert.equal(await note().count(),0,id+' Settings has no duplicate note field');
      await tab(2).click();assert.equal(await note().inputValue(),'Existing note for '+id);assert.equal(await page.locator('#inspector .node-notes-page').count(),1);assert.equal(await page.locator('#inspector .node-comment-field summary').count(),0);
      const history=await page.evaluate(()=>past.length),text='Updated '+id+'\nPlain text **note**';
      await note().fill(text);await note().press('Control+Enter');await settle();assert.equal(await note().inputValue(),text);assert.equal(await page.evaluate(()=>past.length),history+1);
      await page.locator('#undo').click();assert.equal(await note().inputValue(),'Existing note for '+id);await page.locator('#redo').click();assert.equal(await note().inputValue(),text);
      await note().fill('Cancelled draft');await note().press('Escape');assert.equal(await note().inputValue(),text);
      await tab(0).click();assert.equal(await page.locator('#inspector').innerText(),parameters,id+' Parameters content is unchanged');
      assert.equal(await sourceState(),originalSources);
    }
    checks.push('Constant, Uniform, Spec Constant, Sampler, TOP Input, ordinary and GLSL Code share the Notes tab, with no disclosure in Parameters or Settings; edits preserve sources, values and connections and support one-step Undo/Redo/Escape');

    await choose('ordinary',true);await page.evaluate(()=>{selected='constant';selection=new Set([selected]);inspector();});await settle();
    assert.equal(await page.evaluate(()=>inspectorTab),'notes');assert.equal(await note().inputValue(),'Updated constant\nPlain text **note**');
    await page.evaluate(()=>{readonly=true;inspector();});assert.equal(await note().isDisabled(),true);
    await page.selectOption('#language','en');assert.equal(await tab(2).innerText(),'Notes');await page.selectOption('#language','zh-Hant');assert.equal(await tab(2).innerText(),'註記');
    checks.push('switching from an ordinary node to a source node retains the Notes tab; source notes remain readonly-protected and bilingual');

    await page.evaluate(()=>{readonly=false;});await choose('comment',true);
    assert.equal(await page.evaluate(()=>inspectorTab),'parameters');assert.equal(await page.locator('#inspector .parameter-tabs [role=tab]').count(),2);
    assert.equal(await note().count(),0);assert.equal(await page.locator('#inspector .comment-node-preview').count(),0);
    assert.equal(await page.locator('#inspector [data-comment-node="comment"]').inputValue(),'Existing note for comment');assert.equal(await page.locator('#inspector [data-comment-node="comment"]').isVisible(),true);
    checks.push('Comment retains its dedicated raw-text content editor in Parameters and does not acquire a redundant Notes tab or Markdown preview');
    assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,count:checks.length}));
  }catch(error){await h.finish(error);throw error;}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
