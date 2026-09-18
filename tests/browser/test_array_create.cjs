/* Array Create uses existing ports and editors; no TD connection in this suite. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {harness}=require('./test_glsl_code.cjs');
(async()=>{
 const [source,stateFile,folder]=process.argv.slice(2);fs.mkdirSync(folder,{recursive:true});const fixture=path.join(folder,'fresh-state.json');
 execFileSync(process.env.PYTHON_EXECUTABLE||'python',[path.join(__dirname,'export_editor_fixture.py'),stateFile,fixture]);
 const h=await harness(source,fixture,folder,{touch:true}),{page,checks,errors,settle}=h;page.setDefaultTimeout(6500);
 const wire=async(from,to,port)=>{const ok=await page.evaluate(([from,to,port])=>connectPorts({node:from,kind:'outputs',port:'out'},{node:to,kind:'inputs',port}),[from,to,port]);await settle();return ok;};
 const state=()=>page.evaluate(()=>JSON.stringify(graph));
 const output=id=>page.evaluate(id=>ports(current().nodes.find(n=>n.id===id),'outputs').out,id);
 try{
  await page.selectOption('#language','en');await page.evaluate(()=>{
   clearTimeout(autoTimer);connectionInterrupted=true;conflicted=true;readonly=false;historyBusy=nativeMutationBusy=false;graphTrail=[];stage='pixel';past=[];future=[];graph.functions=[];graph.typeDefinitions=[];
   graph.declarations=[{id:'count',kind:'constant',name:'count',type:'int',value:6},{id:'spec',kind:'spec_constant',name:'specSize',type:'int',value:4,constantId:7},{id:'live',kind:'uniform',name:'uValue',type:'int',value:2}];
   graph.stages.pixel={nodes:[testNode('a','array_create',40,80),testNode('get','array_get',400,80),testNode('length','array_length',400,350),testNode('size','scalar',40,350,{type:'int',value:5}),testNode('constant','constant',40,550,{declarationId:'count'}),testNode('spec','spec_constant',40,710,{declarationId:'spec'}),testNode('live','uniform',700,350,{declarationId:'live'}),testNode('sum','add',700,80,{type:'int'}),testNode('result','pixel_out',1000,80)],edges:[]};
   selected='a';selection=new Set(['a']);scale=.8;pan={x:20,y:20};rememberSavedGraph(graph);render();transform();
  });await settle();
  const length=page.locator('[data-inline-node="a"][data-inline-port="length"]');
  assert.equal(await length.inputValue(),'4');assert.equal(await length.getAttribute('step'),'1');assert.equal(await output('a'),'float[4]');
  await length.fill('7');await length.press('Enter');await settle();assert.equal(await output('a'),'float[7]');await page.evaluate(()=>undo());await settle();assert.equal(await output('a'),'float[4]');
  assert.equal(await wire('a','get','Array'),true);assert.equal(await wire('a','length','Array'),true);
  assert.equal(await wire('get','result','color'),true);
  assert.equal(await wire('size','a','length'),true);assert.equal(await output('a'),'float[5]');
  await page.evaluate(()=>change(()=>current().nodes.find(n=>n.id==='size').params.value=8));await settle();
  assert.equal(await output('a'),'float[8]');assert.equal(await page.evaluate(()=>current().nodes.find(n=>n.id==='get').params.type),'float[8]');
  await page.evaluate(()=>undo());await settle();assert.equal(await output('a'),'float[5]');
  assert.equal(await wire('constant','a','length'),true);assert.equal(await output('a'),'float[sg_len_count]');
  assert.equal(await wire('spec','a','length'),true);assert.equal(await output('a'),'float[sg_len_spec]');
  checks.push('Shared INT input edits length with Undo; literal, Graph Constant and Spec Constant wires retain their identities');
  const beforeRuntime=await state();assert.equal(await wire('live','a','length'),false);assert.equal(await state(),beforeRuntime);
  assert.equal(await wire('live','a','value'),true);
  checks.push('Runtime Uniform length is rejected atomically while the same Uniform can fill the array');
  assert.equal(await wire('size','sum','a'),true);assert.equal(await wire('sum','a','length'),true);
  const symbolic=await output('a');assert.match(symbolic,/^float\[sg_extent_/);assert.equal(await page.evaluate(type=>displayType(type),symbolic),'float[N]');assert.equal(await output('get'),'float');
  const graphDocument=await page.evaluate(()=>clone(graph));fs.writeFileSync(path.join(folder,'expression-graph.json'),JSON.stringify(graphDocument));
  const beforePaste=await state();await page.evaluate(()=>{const snapshot=GraphClipboard.decode(GraphClipboard.encode(graph,current(),new Set(['a','get','length','size','sum']),'test'));change(()=>{const ids=GraphClipboard.paste(graph,current(),snapshot,{source:'test',stage:'pixel',target:'top',catalog,types:graphInterfaceTypes(),anchor:{x:1100,y:400}});window.copiedArray=ids.find(id=>current().nodes.find(n=>n.id===id).definitionUuid==='sgrape.builtin.array_create');});});await settle();
  const copied=await page.evaluate(()=>copiedArray);assert.notEqual(await output(copied),symbolic);assert.equal(await page.evaluate(()=>displayType(ports(current().nodes.find(n=>n.id===copiedArray),'outputs').out)),'float[N]');
  await page.evaluate(()=>undo());await settle();assert.equal(await state(),beforePaste);
  checks.push('Constant chains display N and full-selection paste remaps expression sources with one Undo');
  await page.evaluate(()=>{selection=new Set(['a','size','sum']);selected='a';groupSelection();});await settle();
  assert.equal(await page.evaluate(()=>graph.functions.length),1);
  fs.writeFileSync(path.join(folder,'subgraph.json'),await state());
  checks.push('Grouping creation with its length chain preserves array consumers in a Subgraph');
  await page.evaluate(()=>undo());await settle();
  await page.evaluate(()=>{selection=new Set(['a']);selected='a';groupSelection();});await settle();
  assert.equal(await page.evaluate(()=>graph.functions.length),1);
  fs.writeFileSync(path.join(folder,'subgraph-length-input.json'),await state());
  checks.push('Grouping only Array Create keeps its constant length input wired across the Subgraph boundary');
  await page.evaluate(()=>undo());await settle();
  await page.evaluate(()=>{const r=$('#canvas').getBoundingClientRect();openCreator(r.left+300,r.top+220);});await page.locator('#createsearch').fill('Array Create');await settle();
  assert.ok(await page.evaluate(()=>creatorMatches.some(m=>m.d.key==='array_create')));await page.evaluate(()=>chooseCreator(creatorMatches.findIndex(m=>m.d.key==='array_create')));await settle();
  assert.equal(await page.evaluate(()=>definition(current().nodes.find(n=>n.id===selected)).key),'array_create');
  await page.screenshot({path:path.join(folder,'array-create.png')});checks.push('Array Create is searchable independently and uses the existing node type selector and ports');
  assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,checks}));
 }catch(error){await h.finish(error);throw error;}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
