const assert=require('node:assert/strict');
const {harness}=require('./test_glsl_code.cjs');
const [source,stateFile,folder]=process.argv.slice(2);
(async()=>{
 const h=await harness(source,stateFile,folder,{skipPreview:true}),{page,checks,errors,settle}=h;page.setDefaultTimeout(6000);
 try{
  await page.evaluate(()=>{
   clearTimeout(autoTimer);scheduleGraphApply=()=>{};readonly=false;historyBusy=nativeMutationBusy=false;connectionInterrupted=true;
   stage='pixel';graph.target=editorTarget='top';graphTrail=[];graph.functions=[];graph.declarations=[];graph.topInputs=[];
   graph.stages={pixel:{nodes:[testNode('source','scalar',20,20,{type:'float',value:2}),testNode('output','pixel_out',800,20)],edges:[]}};
   past=[];future=[];selected=null;selection.clear();render();scale=.65;pan={x:10,y:10};transform();
   window.modelEditTest={commands:[],fragments:0};
   const edit=GrapeGraph.Node.prototype.edit;GrapeGraph.Node.prototype.edit=function(...args){if(this.network.graph!==editorGraphModel)throw Error('Not the active model transaction');modelEditTest.commands.push(args[0]);return edit.apply(this,args);};
   const insert=GrapeGraph.Network.prototype.insertFragment;GrapeGraph.Network.prototype.insertFragment=function(...args){modelEditTest.fragments++;if(this.graph!==editorGraphModel)throw Error('Not the active model transaction');return insert.apply(this,args);};
   mathStoredSteps=mathSteps=mathPorts=mathFormula=()=>{throw Error('Reached legacy Math behavior');};
   reshapeLegacyTypedInputs=()=>{throw Error('Reached legacy type configuration');};
  });
  await page.locator('#canvas').focus();await page.keyboard.press('Tab');await page.locator('#createsearch').fill('Math');await page.locator('[data-create-entry="math"]').click();await settle();
  const id=await page.evaluate(()=>selected);
  assert.equal(await page.locator('[data-node-control="step0"]').count(),1);
  assert.equal(await page.evaluate(id=>current().nodes.find(n=>n.id===id).ui.comment,id),'((A + B) + C)');
  await page.locator('[data-node-control="operator0"]').selectOption('subtract');
  await page.locator('[data-node-control="operator1"]').selectOption('multiply');
  await page.locator('[data-node-control="operand1"]').selectOption('1');
  assert.equal(await page.evaluate(id=>current().nodes.find(n=>n.id===id).ui.comment,id),'((A − B) × B)');
  checks.push('Math Creator, controls, ports and automatic note use the node module with all legacy Math rule functions disabled');
  const sourceInput='#cards [data-node="source"] [data-inline-port="$value"]';
  await page.locator(sourceInput).fill('7');await page.locator(sourceInput).press('Enter');await page.locator(sourceInput).press('Tab');await settle();
  assert.equal(await page.evaluate(()=>current().nodes.find(n=>n.id==='source').params.value),7);
  await page.locator('#undo').click();assert.equal(await page.evaluate(()=>current().nodes.find(n=>n.id==='source').params.value),2);await page.locator('#redo').click();
  assert.ok((await page.evaluate(()=>modelEditTest.commands)).includes('component'));
  checks.push('Actual scalar inline editing uses the module value command and remains one undoable model transaction');
  const dynamic=await page.evaluate(id=>{
   const connected=connectPorts({node:'source',kind:'outputs',port:'out'},{node:id,kind:'inputs',port:'__add__',add:true});
   const out=connectPorts({node:id,kind:'outputs',port:'out'},{node:'output',kind:'inputs',port:'color'});
   selected=id;selection=new Set([id]);render();
   return {connected,out,count:current().nodes.find(n=>n.id===id).params.inputCount,types:ports(current().nodes.find(n=>n.id===id),'inputs'),compile:GrapeTopCompiler.supports(graph)};
  },id);assert.deepEqual(dynamic,{connected:true,out:true,count:4,types:{input0:'float',input1:'float',input2:'float',input3:'float'},compile:true});
  const beforeRemove=await page.evaluate(()=>JSON.stringify(graph));await page.locator('[data-node-control="remove"]').click();
  assert.equal(await page.evaluate(id=>current().edges.some(e=>e.to[0]===id&&e.to[1]==='input3'),id),false);
  await page.locator('#undo').click();assert.equal(await page.evaluate(()=>JSON.stringify(graph)),beforeRemove);await page.locator('#redo').click();
  checks.push('Append-and-wire and explicit port removal are model commands; one Undo restores the exact interface, note, edge and state');
  await page.locator(`[data-node-selector="${id}"]`).selectOption('vec4');
  await page.locator('[data-node-control="mode"]').selectOption('shared');await page.locator('[data-node-control="operation"]').selectOption('divide');
  assert.equal(await page.evaluate(id=>ports(current().nodes.find(n=>n.id===id),'outputs').out,id),'vec4');
  assert.match(await page.evaluate(()=>GrapeTopCompiler.compile(graph,typeContract.glslCode).pixel),/Comment: A ÷ B ÷ C/);
  checks.push('Manual output choice, shared operation and authored formula compile on the frontend including preserved comments');
  const baseline=await page.evaluate(()=>JSON.stringify(graph));
  await page.evaluate(id=>{selection=new Set(['source',id]);selected=id;selectedEdge=null;duplicateSelection();},id);
  const duplicate=await page.evaluate(()=>({count:selection.size,types:current().nodes.filter(n=>selection.has(n.id)).map(n=>ports(n,'outputs').out),ids:current().edges.map(e=>e.id)}));
  assert.equal(duplicate.count,2);assert.deepEqual(duplicate.types,['float','vec4']);assert.equal(new Set(duplicate.ids).size,duplicate.ids.length);
  await page.locator('#undo').click();assert.equal(await page.evaluate(()=>JSON.stringify(graph)),baseline);
  const text=await page.evaluate(id=>{selection=new Set(['source',id]);selected=id;return copyGraphSelection();},id);
  assert.equal(await page.evaluate(text=>pasteGraphSelection(text,{x:120,y:350}),text),true);
  const pasted=await page.evaluate(()=>({count:selection.size,compiled:GrapeTopCompiler.supports(graph),fragments:modelEditTest.fragments}));assert.deepEqual(pasted,{count:2,compiled:true,fragments:2});
  await page.locator('#undo').click();assert.equal(await page.evaluate(()=>JSON.stringify(graph)),baseline);await page.locator('#redo').click();
  checks.push('Duplicate and portable paste use model fragment ingestion, allocate fresh edge identities and retain output/manual state through Undo/Redo');
  const rejected=await page.evaluate(text=>{
   const data=JSON.parse(text),n=data.nodes.find(n=>n.definitionUuid==='sgrape.builtin.math');n.params.inputCount=99;
   const before=JSON.stringify({graph,past,future}),ok=pasteGraphSelection(JSON.stringify(data),{x:250,y:300});
   return {ok,unchanged:before===JSON.stringify({graph,past,future}),closed:editorGraphModel===null};
  },text);assert.deepEqual(rejected,{ok:false,unchanged:true,closed:true});
  checks.push('Malformed supported module state rolls back paste, history, selection transaction and active model lifetime');
  const saved=await page.evaluate(async()=>{const before=JSON.stringify(graph),code=GrapeTopCompiler.compile(graph,typeContract.glslCode).pixel;await api('apply',{graph:clone(graph)});await load();return {graph:JSON.stringify(graph)===before,code:GrapeTopCompiler.compile(graph,typeContract.glslCode).pixel===code};});assert.deepEqual(saved,{graph:true,code:true});
  checks.push('Saved dynamic graph reloads with identical node/port state and frontend shader');
  assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,count:checks.length}));
 }catch(error){await h.finish(error);throw error;}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
