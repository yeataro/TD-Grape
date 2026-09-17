/* Explicit type edits remove newly incompatible edges in one undo step. */
const assert=require('node:assert/strict');
const {harness}=require('./test_glsl_code.cjs');
const [source,stateFile,folder]=process.argv.slice(2);
(async()=>{const h=await harness(source,stateFile,folder),{page,checks,errors}=h;page.setDefaultTimeout(6000);try{
 await page.evaluate(()=>{
  readonly=false;historyBusy=false;nativeMutationBusy=false;graph.functions=[];graph.declarations=[];stage='pixel';graphTrail=[];
  graph.stages.pixel={nodes:[testNode('vector','vector',20,40,{type:'vec4'}),testNode('split','vector_split',320,40,{type:'vec4'}),testNode('add','add',320,300,{type:'vec4'}),testNode('locked','length',640,300,{type:'vec4'}),testNode('float','float',20,520),testNode('splat','add',320,520,{type:'vec4'}),testNode('old','vector',20,740,{type:'vec2'}),testNode('invalid','length',320,740,{type:'vec3'})],edges:[
   {from:['vector','out'],to:['split','value']},{from:['vector','out'],to:['add','a']},{from:['add','out'],to:['locked','value']},
   {from:['float','out'],to:['splat','a']},{from:['old','out'],to:['invalid','value']}]};
  current().nodes.forEach(n=>n.ui.typeMode=n.id==='add'?'auto':'locked');past=[];future=[];selected='vector';selection=new Set(['vector']);dirty=false;rememberSavedGraph(graph);render();scale=.75;pan={x:20,y:20};transform();
 });
 assert.equal(await page.evaluate(()=>EDITOR_DEV_SETTINGS.autoDisconnectInvalidEdges),true);
 const baseline=await page.evaluate(()=>JSON.stringify(graph));
 await page.locator('[data-node-selector="vector"]').selectOption('vec2');
 assert.deepEqual(await page.evaluate(()=>({type:current().nodes.find(n=>n.id==='add').params.type,edges:current().edges.map(e=>e.to.join(':')),undo:past.length})),{type:'vec2',edges:['add:a','splat:a','invalid:value'],undo:1});
 checks.push('Header type edit infers Auto first, keeps float splat and unrelated invalid draft, and records only one Undo');
 await page.evaluate(()=>undo());assert.equal(await page.evaluate(()=>JSON.stringify(graph)),baseline);
 await page.evaluate(()=>undo(true));assert.deepEqual(await page.evaluate(()=>current().edges.map(e=>e.to.join(':'))),['add:a','splat:a','invalid:value']);
 checks.push('Undo restores both original types and wires; Redo reapplies the same cleanup');
 await page.evaluate(()=>change(()=>{current().nodes.find(n=>n.id==='float').params.value=.25;current().nodes.find(n=>n.id==='vector').ui.x+=12;}));
 assert.equal(await page.evaluate(()=>current().edges.some(e=>e.to[0]==='invalid')),true);
 const beforeWire=await page.evaluate(()=>JSON.stringify(graph));
 assert.equal(await page.evaluate(()=>connectPorts({node:'old',port:'out',kind:'outputs'},{node:'locked',port:'value',kind:'inputs'})),false);
 assert.equal(await page.evaluate(()=>JSON.stringify(graph)),beforeWire);
 assert.equal(await page.evaluate(()=>connectPorts({node:'float',port:'out',kind:'outputs'},{node:'add',port:'b',kind:'inputs'})),true);
 const beforeCycle=await page.evaluate(()=>JSON.stringify(graph));
 assert.equal(await page.evaluate(()=>connectPorts({node:'add',port:'out',kind:'outputs'},{node:'add',port:'a',kind:'inputs'})),false);
 assert.equal(await page.evaluate(()=>JSON.stringify(graph)),beforeCycle);
 checks.push('Ordinary edits never clean old errors; new wires still reject incompatible types and cycles while allowing valid splats');
 await page.evaluate(()=>{editorTarget='mat';graph.stages.pixel={nodes:[testNode('v','vector',30,40,{type:'vec4'}),testNode('output','pixel_out',360,40,{bufferCount:2})],edges:[{from:['v','out'],to:['output','color']},{from:['v','out'],to:['output','buffer1']}]};past=[];future=[];selected='output';selection=new Set(['output']);render();});
 await page.locator('#inspector [data-pixel-buffer-count="output"]').selectOption('1');
 assert.deepEqual(await page.evaluate(()=>current().edges.map(e=>e.to[1])),['color']);assert.equal(await page.evaluate(()=>past.length),1);
 await page.evaluate(()=>undo());assert.equal(await page.evaluate(()=>current().edges.length),2);
 checks.push('Port count shrink removes only the newly missing output endpoint, restored with the count by one Undo');
 assert.equal(errors.length,0,errors.join('\n'));await h.finish();console.log(JSON.stringify({passed:true,checks,errors}));
}catch(error){console.error(error);await h.finish(error);process.exitCode=1;}})();
