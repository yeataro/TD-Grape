/* Actual matrix rows, sockets and numeric edits in an isolated headless editor. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {harness}=require('./test_glsl_code.cjs');
async function run(){
  const [source,stateFile,folder]=process.argv.slice(2);fs.mkdirSync(folder,{recursive:true});
  const fixture=path.join(folder,'fresh-state.json');execFileSync(process.env.PYTHON_EXECUTABLE||'python',[path.join(__dirname,'export_editor_fixture.py'),stateFile,fixture]);
  const h=await harness(source,fixture,folder),{page,checks,errors,settle,at}=h;page.setDefaultTimeout(6500);
  const node=id=>page.evaluate(id=>clone(current().nodes.find(n=>n.id===id)),id);
  const fields=id=>page.locator('[data-node="'+id+'"] input[data-matrix-index]');
  const setup=async()=>{await page.evaluate(()=>{
    clearTimeout(autoTimer);connectionInterrupted=true;conflicted=true;readonly=false;historyBusy=nativeMutationBusy=false;graphTrail=[];graph.functions=[];graph.declarations=[];stage='pixel';past=[];future=[];selected=selectedEdge=null;selection.clear();inspectorTab='parameters';
    graph.stages.pixel={nodes:[testNode('pixel','pixel_out',1500,100)],edges:[]};scale=.8;pan={x:25,y:25};
    for(const [id,key,x,y]of [['literal','matrix',50,70],['combine','matrix_combine',400,70],['replace','matrix_replace',750,70],['split','matrix_split',1100,70]]){const n=instantiate(catalog.find(d=>d.key===key),x,y,'mat3');n.id=id;}
    selected='literal';selection=new Set(['literal']);rememberSavedGraph(graph);render();transform();
  });await settle();};
  try{
    await page.selectOption('#language','en');await setup();
    for(const id of ['literal','combine','replace']){assert.equal(await fields(id).count(),9);assert.equal(await page.locator('[data-node="'+id+'"] .port').last().getAttribute('data-port'),'out');}
    assert.equal(await page.locator('[data-node="literal"] .input .port').count(),0);assert.equal(await page.locator('[data-node="combine"] .input .port').count(),3);
    assert.equal(await page.locator('[data-node="split"] .output .port').count(),3);
    checks.push('Matrix literal, Combine and Replace show three compact column vectors above the bottom output; Split retains three whole-column outputs');
    const before=await node('literal'),history=await page.evaluate(()=>past.length),input=fields('literal').filter({visible:true}).nth(4);
    await input.fill('2.1234567890123');await input.press('Enter');await settle();assert.equal((await node('literal')).params.values[4],2.1234567890123);assert.equal(await page.evaluate(()=>past.length),history+1);
    await page.locator('#undo').click();assert.deepEqual((await node('literal')).params.values,before.params.values);await page.locator('#redo').click();assert.equal((await node('literal')).params.values[4],2.1234567890123);
    checks.push('Compact editing preserves precision and commits one exact Undo/Redo operation');
    const values=(await node('literal')).params.values;await page.locator('[data-node="literal"] [data-matrix-expand="1"]').click();await settle();
    assert.equal(await fields('literal').count(),9);assert.equal(await page.locator('[data-node="literal"] [data-matrix-column="1"] .matrix-component-row').count(),3);assert.deepEqual((await node('literal')).params.values,values);
    assert.deepEqual(await page.locator('[data-node="literal"] [data-matrix-column="1"] .matrix-component-row .port-label').allTextContents(),['X','Y','Z']);
    checks.push('Independent expansion retains the Column parent and exposes XYZ long fields without duplicating values');
    await page.evaluate(()=>{const col=testNode('col','vector',10,440,{type:'vec3',components:[3,4,5,0]}),scalar=testNode('scalar','scalar',260,440,{type:'float',value:7});current().nodes.push(col,scalar);render();connectPorts({node:'col',kind:'outputs',port:'out'},{node:'combine',kind:'inputs',port:'c0'});connectPorts({node:'scalar',kind:'outputs',port:'out'},{node:'combine',kind:'inputs',port:'c0y'});});await settle();
    assert.equal(await fields('combine').count(),6);assert.equal(await page.locator('[data-node="combine"] [data-port="c0"]').count(),1);assert.equal(await page.locator('[data-node="combine"] [data-port="c0y"]').count(),1);
    assert.equal(await page.evaluate(()=>current().edges.filter(e=>e.to[0]==='combine').length),2);
    await page.locator('[data-node="combine"] [data-matrix-expand="0"]').click();await page.locator('[data-node="combine"] [data-matrix-expand="0"]').click();
    assert.equal(await page.locator('[data-node="combine"] [data-port="c0y"]').count(),1);assert.equal(await page.locator('[data-node="combine"] [data-port="c0x"]').count(),0);
    checks.push('Column and scalar override wires coexist; connected children remain anchored when collapsed while overridden fallback values are hidden');
    const saved=(await node('replace')).params.values;
    await page.evaluate(()=>connectPorts({node:'literal',kind:'outputs',port:'out'},{node:'replace',kind:'inputs',port:'value'}));await settle();
    assert.equal(await fields('replace').count(),0);assert.deepEqual((await node('replace')).params.values,saved);assert.equal(await page.locator('[data-node="replace"] .matrix-inherited-value').count(),9);
    await page.evaluate(()=>change(()=>{current().edges=current().edges.filter(e=>e.to[0]!=='replace');}));await settle();assert.equal(await fields('replace').count(),9);assert.deepEqual((await node('replace')).params.values,saved);
    checks.push('Replace baseline disables all manual fallbacks and disconnecting restores the unchanged saved values');
    await page.evaluate(()=>{current().nodes.push(testNode('sink','add',1100,430));render();connectPorts({node:'split',kind:'outputs',port:'c1z'},{node:'sink',kind:'inputs',port:'a'});});await settle();
    assert.equal(await page.locator('[data-node="split"] [data-port="c1z"]').count(),1);assert.equal(await page.locator('[data-node="split"] [data-port="c1"]').count(),1);
    await page.locator('[data-node="split"] [data-matrix-expand="1"]').click();assert.equal(await page.locator('[data-node="split"] .output .port').count(),6);
    await page.locator('[data-node="split"] [data-matrix-expand="1"]').click();assert.equal(await page.locator('[data-node="split"] .output .port').count(),4);
    checks.push('Split exposes whole columns and scalar children together; collapsing preserves all connected output sockets');
    await setup();
    for(const type of await page.evaluate(()=>valueTypes().filter(isMatrixType))){
      await page.locator('[data-node="literal"] [data-node-selector]').selectOption(type);await settle();
      const shape=await page.evaluate(type=>typeContract.types[type],type);assert.equal(await fields('literal').count(),shape.components);assert.equal(await page.locator('[data-node="literal"] [data-matrix-column]').count(),shape.columns);
      const overflow=await page.locator('[data-node="literal"]').evaluate(e=>{const box=e.getBoundingClientRect();return [...e.querySelectorAll('input[data-matrix-index]')].some(input=>{const rect=input.getBoundingClientRect();return rect.left<box.left||rect.right>box.right;});});assert.equal(overflow,false,type+' field overflow');
    }
    checks.push('All 18 float/double square and rectangular shapes expose the correct column and element counts without horizontal overflow');
    await page.locator('[data-node="literal"] [data-node-selector]').selectOption('mat3');
    await page.evaluate(()=>{current().nodes.find(n=>n.id==='literal').params.values=[1,2,3,4,5,6,7,8,9];render();});
    await page.locator('[data-node="literal"] [data-node-selector]').selectOption('mat2');assert.deepEqual((await node('literal')).params.values,[1,2,4,5]);
    await fields('literal').nth(1).fill('22');await fields('literal').nth(1).press('Enter');await settle();
    await page.locator('[data-node="literal"] [data-node-selector]').selectOption('mat3');assert.deepEqual((await node('literal')).params.values,[1,22,3,4,5,6,7,8,9]);
    checks.push('Changing dimensions preserves column/row coordinates and restores dormant cells without discarding edits made in a smaller shape');
    await page.locator('[data-node="literal"] [data-node-selector]').selectOption('dmat3');await settle();
    const field=fields('literal').first(),r=await field.boundingBox(),old=(await node('literal')).params.values;
    await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down({button:'middle'});await page.locator('#valueladder').waitFor();await page.mouse.move(r.x+r.width/2+25,r.y+r.height/2);await page.keyboard.press('Escape');await page.mouse.up({button:'middle'});await settle();assert.deepEqual((await node('literal')).params.values,old);
    await page.evaluate(()=>{readonly=true;render();});assert.equal(await fields('literal').first().isDisabled(),true);
    checks.push('Double matrix fields retain shared middle-button Ladder cancellation and readonly protection');
    await page.evaluate(()=>{readonly=false;render();});
    for(const key of ['matrix_get','matrix_set']){
      await page.evaluate(key=>{const n=instantiate(catalog.find(d=>d.key===key),40,450,'dmat2x3',{locked:true});n.id='access';selected=n.id;selection=new Set([n.id]);render();},key);
      const mode=page.locator('#inspector .parameter-row').filter({has:page.locator('.parameter-value-label',{hasText:/^Access$/})}).locator('select');
      const index=page.locator('#inspector .parameter-row').filter({has:page.locator('.parameter-value-label',{hasText:/^Index type$/})}).locator('select');
      await page.evaluate(key=>{const n=current().nodes.find(n=>n.id==='access');n.inputValues={column:-1,...(key==='matrix_set'?{replacement:[1.25,2.5,3.75]}:{})};render();},key);
      const accessBefore=await node('access');await index.selectOption('uint');assert.equal((await node('access')).inputValues.column,0);await page.locator('#undo').click();assert.deepEqual(await node('access'),accessBefore);
      if(key==='matrix_set'){await mode.selectOption('element');assert.equal((await node('access')).inputValues.replacement,1.25);await page.locator('#undo').click();assert.deepEqual(await node('access'),accessBefore);}
      for(const variant of ['element','column'])for(const integer of ['uint','int']){
        await mode.selectOption(variant);await index.selectOption(integer);await settle();
        const ports=await page.evaluate(()=>{const n=current().nodes.find(n=>n.id==='access');return {inputs:window.ports?window.ports(n,'inputs'):null,outputs:window.ports?window.ports(n,'outputs'):null};});
        assert.equal(ports.inputs.column,integer);assert.equal(ports.inputs.row,variant==='element'?integer:undefined);assert.equal(ports.outputs.out,key==='matrix_set'?'dmat2x3':variant==='element'?'double':'dvec3');
        if(key==='matrix_set')assert.equal(ports.inputs.replacement,variant==='element'?'double':'dvec3');
      }
      await mode.selectOption('element');await page.evaluate(()=>{current().nodes.push(testNode('index','scalar',350,450,{type:'int',value:1}));render();connectPorts({node:'index',kind:'outputs',port:'out'},{node:'access',kind:'inputs',port:'row'});});
      const beforeMode=await page.evaluate(()=>JSON.stringify(graph)),historyBeforeMode=await page.evaluate(()=>past.length);
      await mode.selectOption('column');assert.equal(await page.evaluate(()=>current().edges.some(e=>e.to[0]==='access'&&e.to[1]==='row')),false);assert.equal(await page.evaluate(()=>past.length),historyBeforeMode+1);
      await page.locator('#undo').click();assert.equal(await page.evaluate(()=>JSON.stringify(graph)),beforeMode);
      await page.evaluate(()=>{current().nodes=current().nodes.filter(n=>!['access','index'].includes(n.id));current().edges=current().edges.filter(e=>e.to[0]!=='access'&&e.from[0]!=='index');selected=null;selection.clear();render();});
    }
    checks.push('Matrix Get/Set update their column versus element sockets and signed/unsigned index types without confusing matrix dimensions');
    const entries=await page.evaluate(()=>availableEntries().filter(d=>d.key==='matrix').map(d=>({key:browserEntryKey(d),fixed:d.fixedType||null,label:d.label})));assert.equal(entries.length,19);assert.equal(entries.filter(d=>d.fixed).length,18);
    for(const item of entries.filter(d=>d.fixed)){
      await page.evaluate(key=>{const n=instantiate(availableEntries().find(d=>browserEntryKey(d)===key),30,600);render();},item.key);const id=await page.evaluate(()=>selected),created=await node(id);
      assert.equal(created.params.fixedType,item.fixed);assert.equal(created.params.values.length,await page.evaluate(type=>typeComponents(type),item.fixed));assert.equal(await page.locator('[data-node="'+id+'"] [data-node-selector]').count(),0);assert.equal(await page.locator('[data-node="'+id+'"] .node-function-title').innerText(),item.fixed);
      const copied=await page.evaluate(()=>copyGraphSelection());await page.evaluate(text=>pasteGraphSelection(text,{x:500,y:600}),copied);const cloneId=await page.evaluate(()=>selected);assert.deepEqual((await node(cloneId)).params,created.params);
      await page.evaluate(({id,cloneId})=>{current().nodes=current().nodes.filter(n=>n.id!==id&&n.id!==cloneId);selected=null;selection.clear();render();},{id,cloneId});
    }
    await page.locator('#search').fill('mat3');assert.equal(await page.locator('[data-entry="matrix"] .palette-entry-label').innerText(),'Matrix');assert.equal(await page.locator('[data-entry="mat3"] .palette-entry-label').innerText(),'mat3');
    checks.push('All 18 fixed matrix entries keep their exact type and identity through copy/JSON; generic Matrix remains separately searchable with a stable name');
    for(const type of [...entries.filter(d=>d.fixed).map(d=>d.fixed),'double','dvec2','dvec3','dvec4']){
      await page.locator('#search').fill(type);
      const found=await page.evaluate(query=>browseEntries(browserIndex(),query,{source:'all'}).filter(e=>['matrix','scalar','vector'].includes(e.d.key)).map(e=>({key:browserEntryKey(e.d),fixed:e.d.fixedType||null,label:e.d.label})),type);
      assert.deepEqual(found.filter(d=>d.fixed).map(d=>d.fixed),[type],type+' exact fixed search');
      const generic=type==='double'?'Scalar':type.startsWith('dvec')?'Vector':'Matrix';assert.ok(found.some(d=>!d.fixed&&d.label===generic),type+' generic search');
      assert.equal(await page.locator('[data-entry="'+type+'"] .palette-entry-label').innerText(),type);
    }
    checks.push('Matrix, double and dvec searches return the exact fixed entry plus the stable generic entry without leaking other fixed type aliases');
    // Distinct column-major values expose a flat-stride mistake: mat2x3
    // [1,2,3 | 4,5,6] must become mat3x2 [1,2 | 4,5 | 0,0].
    await setup();
    await page.evaluate(()=>{
      const n=testNode('code','glsl_code',30,500,{functionName:'matrixDefault',inputs:[{id:'matrix',name:'value',type:'mat2x3'}],outputs:[{id:'out',name:'answer',type:'float'}],code:'answer = float(value[0][0]);'});
      n.inputValues={matrix:[1,2,3,4,5,6]};current().nodes.push(n);selected=n.id;selection=new Set([n.id]);render();
    });
    const codeBefore=await node('code'),codeHistory=await page.evaluate(()=>past.length);
    await page.locator('[data-code-port="matrix"] select').selectOption('mat3x2');
    assert.deepEqual((await node('code')).inputValues.matrix,[1,2,4,5,0,0]);assert.equal(await page.evaluate(()=>past.length),codeHistory+1);
    await page.locator('#undo').click();assert.deepEqual(await node('code'),codeBefore);
    await page.locator('#redo').click();assert.deepEqual((await node('code')).inputValues.matrix,[1,2,4,5,0,0]);
    await page.evaluate(()=>{
      const n=testNode('transpose','transpose',30,500,{type:'mat2x3'});n.inputValues={value:[1,2,3,4,5,6]};current().nodes.push(n);selected=n.id;selection=new Set([n.id]);render();
    });
    const transposeBefore=await node('transpose');
    await page.locator('[data-node="transpose"] [data-node-selector]').selectOption('mat3x2');
    assert.deepEqual((await node('transpose')).inputValues.value,[1,2,4,5,0,0]);
    await page.locator('#undo').click();assert.deepEqual(await node('transpose'),transposeBefore);
    await page.locator('#redo').click();
    const matrixInput=page.locator('#inspector .matrix-parameter-values input').filter({visible:true}).nth(2);
    await matrixInput.fill('44');await matrixInput.press('Enter');await settle();
    await page.locator('[data-node="transpose"] [data-node-selector]').selectOption('mat2x3');
    assert.deepEqual((await node('transpose')).inputValues.value,[1,2,3,44,5,6]);
    await page.evaluate(()=>{
      const f={id:'matrixfn',name:'Matrix Default',scope:'local',stages:['pixel'],inputs:[{id:'matrix',name:'Matrix',type:'mat2x3',default:[1,2,3,4,5,6]}],outputs:[{id:'out',name:'Out',type:'float',default:0}],graph:{nodes:[{id:'fnin',definitionUuid:FunctionModel.INPUT,params:{},ui:{x:20,y:30}},{id:'fnout',definitionUuid:FunctionModel.OUTPUT,params:{},ui:{x:400,y:30}}],edges:[]}};
      graph.functions.push(f);current().nodes.push({id:'call',definitionUuid:FunctionModel.CALL,params:{functionId:f.id},inputValues:{matrix:[11,12,13,14,15,16]},ui:{x:300,y:500}});
      graphTrail=[f.id];selected='fnin';selection=new Set(['fnin']);inspectorTab='settings';render();
    });
    const subgraphBefore=await page.evaluate(()=>JSON.stringify(graph)),subgraphHistory=await page.evaluate(()=>past.length);
    await page.locator('#inspector .input-parameter select').selectOption('mat3x2');
    assert.deepEqual(await page.evaluate(()=>currentFunction().inputs[0].default),[1,2,4,5,0,0]);
    assert.deepEqual(await page.evaluate(()=>graph.stages.pixel.nodes.find(n=>n.id==='call').inputValues.matrix),[11,12,14,15,0,0]);
    assert.equal(await page.evaluate(()=>past.length),subgraphHistory+1);
    await page.locator('#undo').click();assert.equal(await page.evaluate(()=>JSON.stringify(graph)),subgraphBefore);
    await page.locator('#redo').click();assert.deepEqual(await page.evaluate(()=>currentFunction().inputs[0].default),[1,2,4,5,0,0]);
    checks.push('GLSL Code, Transpose and Subgraph type edits preserve column/row coordinates and one-step Undo; Transpose restores dormant cells while retaining edits and Subgraph updates caller defaults');
    await setup();await page.locator('[data-node="literal"] [data-matrix-expand="1"]').click();await page.locator('[data-node="split"] [data-matrix-expand="1"]').click();
    await page.evaluate(()=>{for(const[id,x,y]of [['literal',50,70],['combine',430,70],['replace',50,450],['split',430,450]])Object.assign(current().nodes.find(n=>n.id===id).ui,{x,y});render();scale=1;pan={x:25,y:25};transform();});await settle();await page.screenshot({path:path.join(folder,'matrix-nodes.png')});assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,count:checks.length}));
  }catch(error){await h.finish(error);throw error;}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
