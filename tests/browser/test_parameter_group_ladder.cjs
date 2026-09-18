/* Middle-button Parameter name/type gestures, using only a local fixture API. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {harness}=require('./test_glsl_code.cjs');
const [source,stateFile,folder]=process.argv.slice(2);
(async()=>{
  fs.mkdirSync(folder,{recursive:true});const fixture=path.join(folder,'fresh-state.json');
  execFileSync(process.env.PYTHON_EXECUTABLE||'python',[path.join(__dirname,'export_editor_fixture.py'),stateFile,fixture],{stdio:'pipe'});
  const h=await harness(source,fixture,folder),{page,checks,errors,settle}=h;page.setDefaultTimeout(6000);
  const fields=(port='$value',copy='compact')=>page.locator(`#inspector [data-parameter-port="${port}"][data-parameter-copy="${copy}"]`);
  const row=(port='$value')=>page.locator(`#inspector [data-parameter-value="${port}"]>.parameter-value-row`);
  const trigger=(kind='name',port='$value')=>row(port).locator(`[data-parameter-ladder="${kind}"]`);
  const snapshot=()=>page.evaluate(()=>JSON.stringify({graph,past,future}));
  const state=id=>page.evaluate(id=>clone(current().nodes.find(n=>n.id===id)),id);
  const choose=async id=>{await page.evaluate(id=>{cancelValueLadder();document.activeElement?.blur();selected=id;selection=new Set([id]);selectedInputId=null;inspectorTab='parameters';inspector();},id);await settle();};
  const reset=async()=>{await page.evaluate(()=>{
    cancelValueLadder();document.activeElement?.blur();clearTimeout(autoTimer);connectionInterrupted=true;conflicted=true;readonly=false;historyBusy=false;nativeMutationBusy=false;graphTrail=[];stage='pixel';graph.functions=[];
    graph.declarations=[{id:'constant',kind:'constant',name:'cValue',type:'vec3',value:[2,4,8]},{id:'live',kind:'uniform',name:'uValue',type:'vec3',value:[1,2,3]}];
    graph.stages.pixel={nodes:[testNode('vector','vector',30,40,{type:'vec4',components:[1,3,7,11]}),testNode('fixed','vector',30,250,{type:'vec3',fixedType:'vec3',components:[2,4,8,0]}),testNode('integer','scalar',300,40,{type:'int',fixedType:'int',value:12}),testNode('scalar','scalar',300,200,{type:'float',value:.25}),testNode('unsigned','vector',30,420,{type:'uvec4',components:[0,10,100,4294967294]}),testNode('boolean','vector',300,350,{type:'bvec2',components:[true,false,false,false]}),testNode('color','color',600,40,{value:[.1,.3,.7,1]}),testNode('add','add',600,250,{type:'vec3'}),testNode('constant','constant',850,40,{declarationId:'constant'}),testNode('uniform','uniform',850,250,{declarationId:'live'})],edges:[]};
    current().nodes.find(n=>n.id==='add').inputValues={a:[.5,2.5,4.5],b:[2,3,4]};
    selected='vector';selection=new Set(['vector']);selectedInputId=null;selectedEdge=null;inspectorTab='parameters';past=[];future=[];dirty=false;rememberSavedGraph(graph);render();scale=.7;pan={x:20,y:20};transform();
  });await settle();};
  const begin=async(target,dx=40)=>{const b=await target.boundingBox();assert.ok(b);const p={x:b.x+b.width/2,y:b.y+b.height/2};await page.mouse.move(p.x,p.y);await page.mouse.down({button:'middle'});await settle();await page.mouse.move(p.x+dx,p.y,{steps:4});await settle();return p;};
  const release=async()=>{await page.mouse.up({button:'middle'});await settle();};
  const move=async(target,dx=40)=>{await begin(target,dx);await release();};
  const values=async(port='$value',copy='compact')=>(await fields(port,copy).evaluateAll(es=>es.map(e=>Number(e.value))));
  try{
    await reset();const before=await snapshot();await begin(trigger());assert.deepEqual(await values(),[1.5,3.5,7.5,11.5]);assert.equal(await snapshot(),before);
    assert.match(await page.locator('#valueladder .ladder-value').innerText(),/1.5.*3.5.*7.5.*11.5/);await release();
    assert.deepEqual((await state('vector')).params.components,[1.5,3.5,7.5,11.5]);assert.equal(await page.evaluate(()=>past.length),1);
    await page.locator('#undo').click();await settle();assert.deepEqual((await state('vector')).params.components,[1,3,7,11]);await page.locator('#redo').click();await settle();assert.deepEqual((await state('vector')).params.components,[1.5,3.5,7.5,11.5]);
    checks.push('middle-drag on the parameter name previews a shared vector delta without editing the graph, then commits one exact Undo/Redo');

    await reset();await move(trigger('type'),-40);assert.deepEqual((await state('vector')).params.components,[.5,2.5,6.5,10.5]);
    await page.locator('[data-parameter-expand="$value"]').click();const componentName=page.locator('.parameter-component-row').nth(1).locator('[data-parameter-ladder="name"]');
    await move(componentName,40);assert.deepEqual((await state('vector')).params.components,[.5,3,6.5,10.5]);assert.deepEqual(await values('$value','component'),[.5,3,6.5,10.5]);
    checks.push('type-label gestures adjust the whole row while expanded component labels adjust only that component and synchronize both presentations');

    await reset();await choose('fixed');await move(trigger(),40);assert.deepEqual((await state('fixed')).params.components,[2.5,4.5,8.5,0]);
    await choose('scalar');await move(trigger('type'),40);assert.equal((await state('scalar')).params.value,.75);
    await choose('integer');await move(trigger(),24);assert.equal((await state('integer')).params.value,15);
    await page.evaluate(()=>{const n=current().nodes.find(n=>n.id==='vector');n.params.type='ivec3';n.params.components=[-10,10,30,7];});await choose('vector');await move(trigger('type'),24);assert.deepEqual((await state('vector')).params.components,[-7,13,33,7]);
    checks.push('fixed vec3, generic float, fixed int and generic ivec3 share the same gestures, retain dormant components and use integer increments');

    await reset();await choose('add');await move(trigger('type','a'),40);assert.deepEqual((await state('add')).inputValues.a,[1,3,5]);assert.deepEqual((await state('add')).inputValues.b,[2,3,4]);
    await page.evaluate(()=>connectPorts({node:'fixed',kind:'outputs',port:'out'},{node:'add',kind:'inputs',port:'a'}));await settle();
    assert.equal(await page.locator('#inspector [data-input="a"] [data-parameter-ladder]').count(),0);assert.deepEqual((await state('add')).inputValues.a,[1,3,5]);
    await move(trigger('name','b'),40);assert.deepEqual((await state('add')).inputValues.b,[2.5,3.5,4.5]);
    checks.push('unconnected input defaults support group adjustments; connected input rows expose no gesture and keep their dormant defaults');

    await reset();await choose('color');await move(trigger(),40);assert.deepEqual((await state('color')).params.value,[.6,.8,1.2,1.5]);assert.equal(await page.locator('#inspector .color-range-hint').count(),1);
    assert.equal(await page.locator('#inspector input[type=color]').inputValue(),'#99ccff');
    checks.push('Color adjusts RGBA by the same delta without a 0–1 clamp and updates its existing picker/range display');

    await reset();await choose('unsigned');const original=await snapshot();await move(trigger(),-80);assert.equal(await snapshot(),original);
    await move(trigger('type'),80);assert.deepEqual((await state('unsigned')).params.components,[1,11,101,4294967295]);assert.equal(await page.evaluate(()=>past.length),1);
    await move(trigger(),-80);assert.deepEqual((await state('unsigned')).params.components,[0,10,100,4294967294]);
    checks.push('unsigned bounds clamp the shared delta at the first component boundary, preserving differences and avoiding no-op history');

    for(const cancel of ['Escape','blur','pointercancel','rerender','busy','readonly','graph']){
      await reset();const before=await snapshot();await begin(trigger());
      if(cancel==='Escape')await page.keyboard.press('Escape');
      else await page.evaluate(kind=>{
        if(kind==='blur')window.dispatchEvent(new Event('blur'));
        if(kind==='pointercancel')window.dispatchEvent(new PointerEvent('pointercancel',{pointerId:1}));
        if(kind==='rerender'){$('#inspector').replaceChildren();inspector();}
        if(kind==='busy')historyBusy=true;
        if(kind==='readonly'){readonly=true;render();}
        if(kind==='graph'){graph=clone(graph);render();}
      },cancel);
      if(cancel==='busy')await page.mouse.move(1350,300);await release();
      assert.equal(await page.locator('#valueladder').count(),0,cancel);assert.equal(await snapshot(),before,cancel);assert.deepEqual(await values(),[1,3,7,11],cancel);
    }
    checks.push('Escape, blur, pointer cancellation, inspector redraw, busy/read-only transition and graph replacement cancel all previews without edits');

    await reset();await begin(trigger());await page.evaluate(()=>render());await settle();assert.equal(await page.locator('#valueladder').count(),1);assert.deepEqual(await values(),[1.5,3.5,7.5,11.5]);await release();
    assert.deepEqual((await state('vector')).params.components,[1.5,3.5,7.5,11.5]);assert.equal(await page.evaluate(()=>past.length),1);
    checks.push('ordinary renders preserve an active group gesture and its preview until a single commit');

    await reset();await fields().first().focus();await move(trigger(),40);await fields().first().blur();await settle();
    assert.deepEqual(await values(),[1.5,3.5,7.5,11.5]);assert.equal(await fields().evaluateAll(es=>es.some(e=>e.hasPendingEdit?.())),false);assert.equal(await page.evaluate(()=>past.length),1);
    await move(trigger('type'),40);assert.deepEqual(await values(),[2,4,8,12]);assert.deepEqual((await state('vector')).params.components,[2,4,8,12]);assert.equal(await page.evaluate(()=>past.length),2);
    checks.push('a focused unchanged field does not retain an obsolete committed value after group editing, blur or a second gesture');

    for(const dx of [0,40]){
      await reset();await page.evaluate(()=>{current().nodes.find(n=>n.id==='vector').params.components=[.1234567890123456,3,7,11];inspector();});await settle();
      await fields().first().focus();const preciseBefore=await snapshot(),start=await begin(trigger(),dx);
      if(dx)await page.mouse.move(start.x,start.y,{steps:4});await release();
      assert.equal(await fields().first().inputValue(),'0.1234567890123456');
      assert.equal(await fields().evaluateAll(es=>es.some(e=>e.hasPendingEdit?.())),false);await fields().first().blur();await settle();assert.equal(await snapshot(),preciseBefore);
    }
    await reset();await page.evaluate(()=>{current().nodes.find(n=>n.id==='vector').params.components=[Number.MAX_VALUE,Number.MAX_VALUE,Number.MAX_VALUE,Number.MAX_VALUE];inspector();});await settle();
    const finiteBefore=await snapshot();for(const dx of [0,-40,40]){await move(trigger(),dx);assert.equal(await snapshot(),finiteBefore);assert.ok((await values()).every(Number.isFinite));}
    checks.push('zero movement, returning to zero and unchanged huge finite components retain full precision without false drafts or history');

    await reset();await fields().nth(2).fill('8.125');const draftBefore=await snapshot();await move(trigger(),40);assert.equal(await page.locator('#valueladder').count(),0);assert.equal(await snapshot(),draftBefore);assert.equal(await fields().nth(2).inputValue(),'8.125');await fields().nth(2).press('Escape');
    await move(trigger(),40);assert.deepEqual((await state('vector')).params.components,[1.5,3.5,7.5,11.5]);
    checks.push('a pending component text draft blocks the group gesture without submitting or replacing it');

    await reset();await page.evaluate(()=>{const n=current().nodes.find(n=>n.id==='vector');n.ui={...n.ui,vectorExpanded:true};render();});await settle();
    const inline=page.locator('[data-inline-node="vector"][data-inline-port="$value"]').first();await inline.fill('123');const inlineBefore=await snapshot();await move(trigger(),40);
    assert.equal(await inline.inputValue(),'123');assert.equal(await snapshot(),inlineBefore);assert.equal(await page.evaluate(()=>inlineValueEdit?.entry===document.activeElement),true);
    await inline.press('Escape');await move(trigger(),40);assert.deepEqual((await state('vector')).params.components,[1.5,3.5,7.5,11.5]);
    await reset();await choose('add');await fields('b').first().fill('123');const otherRowBefore=await snapshot();await move(trigger('name','a'),40);
    assert.equal(await fields('b').first().inputValue(),'123');assert.equal(await snapshot(),otherRowBefore);await fields('b').first().press('Escape');
    checks.push('drafts on the same node canvas or a different Parameter row prevent group edits without losing focus, text or history');

    await reset();await choose('boolean');assert.equal(await page.locator('#inspector [data-parameter-ladder]').count(),0);
    await choose('constant');const declarations=await page.evaluate(()=>JSON.stringify(graph.declarations));assert.equal(await page.locator('#inspector [data-parameter-ladder]').count(),0);
    await choose('uniform');assert.equal(await page.locator('#inspector [data-parameter-ladder]').count(),0);assert.equal(await page.evaluate(()=>JSON.stringify(graph.declarations)),declarations);
    await choose('vector');await page.evaluate(()=>{readonly=true;render();});assert.equal(await page.locator('#inspector [data-parameter-ladder]').count(),0);
    checks.push('Boolean, source-reference/source-definition forms and read-only rows gain no group edit and source declarations remain unchanged');

    await reset();await move(fields().nth(1),40);assert.deepEqual((await state('vector')).params.components,[1,3.5,7,11]);
    await page.locator('[data-parameter-expand="$value"]').click();await begin(trigger(),40);await page.screenshot({path:path.join(folder,'parameter-group-ladder.png')});await release();
    checks.push('the existing single-field ladder remains independent; the group readout shows every adjusted component');
    assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,count:checks.length}));
  }catch(error){await h.finish(error);throw error;}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
