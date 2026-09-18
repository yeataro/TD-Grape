/* Compound values cross actual Subgraph, clipboard and GLSL Code interfaces. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {harness}=require('./test_glsl_code.cjs');
const [source,stateFile,folder]=process.argv.slice(2);
(async()=>{
  const h=await harness(source,stateFile,folder),{page,checks,errors,settle}=h;
  try{
    await page.evaluate(()=>{
      clearTimeout(autoTimer);connectionInterrupted=true;conflicted=true;readonly=false;historyBusy=false;nativeMutationBusy=false;stage='pixel';graphTrail=[];graph.functions=[];graph.declarations=[];past=[];future=[];
      graph.typeDefinitions=[{id:'sample',name:'Sample',provider:'generated',fields:[{id:'color',name:'tint',type:'vec4'}]}];
      graph.stages.pixel={nodes:[testNode('array','array',20,20,{elementType:'struct:sample',length:3}),testNode('get','array_get',280,20,{type:'struct:sample[3]'}),testNode('field','struct_field',500,20,{type:'struct:sample',field:'color'}),testNode('pixel','pixel_out',760,20)],edges:[{from:['array','out'],to:['get','Array']},{from:['get','out'],to:['field','value']},{from:['field','out'],to:['pixel','color']}]};
      selected='get';selection=new Set(['get','field']);rememberSavedGraph(graph);render();groupSelection();
    });await settle();
    const grouped=await page.evaluate(()=>({graph:clone(graph),function:graph.functions[0]&&clone(graph.functions[0]),history:past.length,status:$('#status').textContent}));
    assert.ok(grouped.function,JSON.stringify({status:grouped.status,nodes:grouped.graph.stages.pixel.nodes.map(n=>n.id)}));
    assert.equal(grouped.function.inputs[0].type,'struct:sample[3]');assert.equal(grouped.function.outputs[0].type,'vec4');
    assert.equal(grouped.function.inputs[0].default.length,3);assert.deepEqual(grouped.function.inputs[0].default[0],{color:[0,0,0,0]});
    assert.equal(grouped.history,1);checks.push('Subgraph extraction keeps structure-array interfaces and zero defaults, including field ID distinct from GLSL name');
    fs.writeFileSync(path.join(folder,'grouped.graph.json'),JSON.stringify(grouped.graph));
    await page.evaluate(()=>undo());await settle();assert.equal(await page.evaluate(()=>graph.functions.length),0);
    await page.evaluate(()=>undo(true));await settle();assert.equal(await page.evaluate(()=>graph.functions.length),1);
    checks.push('compound Subgraph creation is one Undo/Redo operation');
    const copied=await page.evaluate(()=>{
      const call=current().nodes.find(n=>n.definitionUuid===FunctionModel.CALL),payload=GraphClipboard.decode(GraphClipboard.encode(graph,current(),[call.id],'before'));
      const destination=clone(graph);destination.typeDefinitions=[];destination.functions=[];destination.stages.pixel={nodes:[],edges:[]};
      GraphClipboard.paste(destination,destination.stages.pixel,payload,{source:'after',stage,target:editorTarget,catalog,types:interfaceTypes(),anchor:{x:10,y:10}});
      return destination;
    });assert.equal(copied.typeDefinitions[0].fields[0].name,'tint');assert.equal(copied.functions[0].inputs[0].type,'struct:sample[3]');
    checks.push('cross-Shader Function clipboard carries its structure definitions');
    await page.evaluate(()=>{const call=current().nodes.find(n=>n.definitionUuid===FunctionModel.CALL);enterFunction(call);selected=current().nodes.find(n=>n.definitionUuid===FunctionModel.INPUT).id;selection=new Set([selected]);inspectorTab='parameters';inspector();});await settle();
    assert.ok((await page.locator('#inspector').innerText()).includes('Sample[3]'));
    checks.push('Function Parameter displays compound type without creating invalid numeric editors');
    await page.evaluate(()=>{navigateGraph(0);const code=testNode('custom','glsl_code',200,340,{functionName:'readSamples',inputs:[{id:'samples',name:'samples',type:'struct:sample[3]',default:compositeZeroValue('struct:sample[3]')}],outputs:[{id:'color',name:'color',type:'vec4'}],code:'color = samples[0].tint;'});current().nodes.push(code);selected='custom';selection=new Set(['custom']);render();});await settle();
    assert.ok((await page.locator('[data-code-header]').innerText()).includes('samples'));
    const options=await page.locator('[data-code-port="samples"] select').locator('option').evaluateAll(items=>items.map(item=>item.value));assert.ok(options.includes('struct:sample[3]'));
    const codeGraph=await page.evaluate(()=>{
      const data=current();data.edges=data.edges.filter(e=>e.to[0]!=='pixel');data.edges.push({from:['array','out'],to:['custom','samples']},{from:['custom','color'],to:['pixel','color']});return clone(graph);
    });fs.writeFileSync(path.join(folder,'code.graph.json'),JSON.stringify(codeGraph));
    checks.push('GLSL Code exposes compound interface types and retains graph-owned definitions');
    assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,count:checks.length}));
  }catch(error){await h.finish(error);throw error;}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
