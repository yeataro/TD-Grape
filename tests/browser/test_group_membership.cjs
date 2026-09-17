/* Isolated group membership UI; never writes to TouchDesigner.
 * node test_group_membership.cjs SOURCE_DIR STATE_JSON REPORT_DIR */
const assert=require('node:assert/strict');
const {harness}=require('./test_glsl_code.cjs');
async function run(){
  const [source,stateFile,folder]=process.argv.slice(2),h=await harness(source,stateFile,folder),{page,checks,errors,settle}=h;
  const documentJSON=()=>page.evaluate(()=>JSON.stringify(graph));
  const members=()=>page.evaluate(()=>Object.fromEntries(GraphFrames.read(current()).map(f=>[f.id,f.nodes])));
  const select=async ids=>{await page.evaluate(ids=>{selection=new Set(ids);selected=ids.at(-1)||null;selectedEdge=null;render();},ids);await settle();};
  const reset=async()=>{
    await page.evaluate(()=>{document.activeElement?.blur();clearTimeout(autoTimer);connectionInterrupted=true;conflicted=true;readonly=false;historyBusy=false;nativeMutationBusy=false;stage='pixel';graphTrail=[];graph=clone(window.membershipFixture);past=[];future=[];selected=null;selectedEdge=null;selection.clear();rememberSavedGraph(graph);setGraphFocus(true);setUIExperiments({selectionToolbar:'all'});render();fit();});await settle();
  };
  try{
    await page.evaluate(()=>{
      stage='pixel';graphTrail=[];graph.functions=[];graph.declarations=[];
      const specs=[['a',80,160],['b',380,160],['c',680,160],['d',80,500],['e',380,500],['f',680,500],['g',980,500],['u',1100,160]];
      graph.stages.pixel={nodes:specs.map(([id,x,y])=>testNode(id,'float',x,y)),edges:[],ui:{frames:[
        {id:'B',name:'Other group',color:'#9285ad',nodes:['d','e','f','g']},
        {id:'A',name:'Destination',color:'#485f8d',nodes:['a','b','c']}
      ]}};window.membershipFixture=clone(graph);
    });await reset();

    await page.locator('[data-frame="A"] .group-frame-title').click({position:{x:40,y:12}});await settle();assert.deepEqual(new Set(await page.evaluate(()=>[...selection])),new Set(['a','b','c']));
    await page.locator('[data-node="u"] .node-title').click({modifiers:['Control']});await settle();assert.deepEqual(new Set(await page.evaluate(()=>[...selection])),new Set(['a','b','c','u']));
    assert.equal(await page.locator('#graphjoinframe').isVisible(),true);assert.match(await page.locator('#graphjoinframe').getAttribute('title'),/Destination/);
    const before=await documentJSON(),nodeData=await page.evaluate(()=>JSON.stringify({nodes:current().nodes,edges:current().edges}));
    await page.locator('#graphjoinframe').click();await settle();assert.deepEqual((await members()).A,['a','b','c','u']);assert.deepEqual((await members()).B,['d','e','f','g']);
    assert.equal(await page.evaluate(()=>JSON.stringify({nodes:current().nodes,edges:current().edges})),nodeData);assert.equal(await page.evaluate(()=>past.length),1);assert.equal(await page.evaluate(()=>hasShaderChanges()),false);
    assert.equal(await page.locator('#graphjoinframe').isVisible(),false);await page.locator('#undo').click();await settle();assert.equal(await documentJSON(),before);await page.locator('#redo').click();await settle();assert.deepEqual((await members()).A,['a','b','c','u']);
    checks.push('clicking a destination frame then Ctrl-clicking an outside node exposes its named join action; one Undo/Redo preserves node data and selection');

    await reset();await page.locator('[data-frame="A"] .group-frame-title').click({position:{x:40,y:12}});await page.locator('[data-node="d"] .node-title').click({modifiers:['Control']});await settle();
    await page.locator('#canvas').focus();await page.keyboard.press('Alt+Shift+g');await settle();assert.deepEqual((await members()).A,['a','b','c','d']);assert.deepEqual((await members()).B,['e','f','g']);assert.equal(await page.evaluate(()=>past.length),1);
    checks.push('frame plus another group member joins through Alt+Shift+G without moving unselected source members');

    await reset();await select(['a','b','c','d','e']);assert.equal(await page.evaluate(()=>groupFrameJoinTarget()?.id),'A','selected count wins over total group size');
    const majorityBefore=await documentJSON();await page.locator('#graphjoinframe').click();await settle();assert.deepEqual((await members()).A,['a','b','c','d','e']);assert.deepEqual((await members()).B,['f','g']);await page.locator('#undo').click();await settle();assert.equal(await documentJSON(),majorityBefore);
    checks.push('three selected members beat two even when the source group is larger and occurs first in storage');

    await reset();await select(['a','u']);assert.equal(await page.locator('#graphjoinframe').isVisible(),true);await page.locator('#graphjoinframe').click();await settle();assert.deepEqual((await members()).A,['a','b','c','u']);
    for(const ids of [[],['u'],['a','b'],['a','d'],['a','b','d','e','u']]){
      await reset();await select(ids);assert.equal(await page.locator('#graphjoinframe').isVisible(),false,JSON.stringify(ids));assert.equal(await page.evaluate(()=>groupFrameJoinTarget()),null);
      const unchanged=await documentJSON();await page.locator('#canvas').focus();await page.keyboard.press('Alt+Shift+g');await page.evaluate(()=>joinGroupFrameSelection());await settle();assert.equal(await documentJSON(),unchanged);assert.equal(await page.evaluate(()=>past.length),0);
    }
    checks.push('one grouped plus one ungrouped node can join; ties, no destination, and already-grouped selections hide the action and shortcut does nothing');

    await reset();await page.evaluate(()=>{const frames=GraphFrames.read(current());frames.find(f=>f.id==='B').nodes=['d','e'];GraphFrames.write(current(),frames);render();});await select(['a','b','c','d','e']);
    const emptiedBefore=await documentJSON();await page.locator('#graphjoinframe').click();await settle();assert.deepEqual(await members(),{A:['a','b','c','d','e']});await page.locator('#undo').click();await settle();assert.equal(await documentJSON(),emptiedBefore);
    await page.evaluate(()=>{readonly=true;render();});await settle();assert.equal(await page.locator('#graphjoinframe').isEnabled(),false);await page.locator('#canvas').focus();await page.keyboard.press('Alt+Shift+g');await page.evaluate(()=>joinGroupFrameSelection());assert.equal(await documentJSON(),emptiedBefore);
    checks.push('moving all selected source members removes only the empty frame, Undo restores both, and readonly blocks the same action');

    await reset();await select(['a','u']);await page.evaluate(()=>beginGroupFrameRename(GraphFrames.read(current()).find(f=>f.id==='A')));const editingBefore=await documentJSON();await page.locator('[data-frame-name]').press('Alt+Shift+g');assert.equal(await documentJSON(),editingBefore);await page.locator('[data-frame-name]').press('Escape');
    checks.push('membership shortcut cannot fire inside the group name editor');
    assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,count:checks.length}));
  }catch(error){await h.finish(error);throw error;}
}
run().catch(error=>{console.error(error);process.exit(1);});
