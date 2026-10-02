/* Pixel Preview creation, type inference and singleton behavior; isolated API only. */
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {harness}=require('./test_glsl_code.cjs');
(async()=>{
 const[source,state,folder]=process.argv.slice(2),h=await harness(source,state,folder,{skipPreview:true}),{page,checks,errors,settle}=h;
 try{
  await page.selectOption('#language','en');
  await page.evaluate(()=>{
   clearTimeout(autoTimer);scheduleGraphApply=()=>{};nativeSourcePolling=uniformPolling=customPolling=true;uniformLive.disconnect();uniformLive.connect=()=>{};
   readonly=historyBusy=nativeMutationBusy=false;connectionInterrupted=true;graphTrail=[];graph.functions=[];graph.declarations=[];past=[];future=[];
   editorTarget='mat';graph.target='mat';stage='pixel';graph.stages.vertex={nodes:[testNode('vertex','vertex_out',750,250)],edges:[]};graph.stages.pixel={nodes:[testNode('pixel','pixel_out',750,250)],edges:[]};selected=null;selection.clear();render();scale=1;pan={x:20,y:20};transform();
   window.openPreviewCreator=wire=>{const r=$('#canvas').getBoundingClientRect();openCreator(r.left+300,r.top+220,wire);};
  });
  assert.deepEqual(await page.evaluate(()=>['mat','top'].flatMap(target=>['vertex','pixel'].map(s=>{editorTarget=target;stage=s;return [target,s,availableEntries().some(d=>d.key==='preview')];}))),[['mat','vertex',false],['mat','pixel',true],['top','vertex',false],['top','pixel',true]]);
  await page.evaluate(()=>{editorTarget='mat';stage='pixel';render();openPreviewCreator();});
  assert.equal(await page.locator('#createresults .create-entry').first().getAttribute('data-create-entry'),'preview');
  await page.locator('#createsearch').fill('Preview');
  assert.equal(await page.locator('#createresults .create-entry').first().getAttribute('data-create-entry'),'preview');
  await page.locator('[data-create-entry="preview"]').click();await settle();
  const id=await page.evaluate(()=>selected);
  assert.equal(await page.locator(`[data-node="${id}"]`).getAttribute('data-color-role'),'output');
  assert.equal(await page.locator(`[data-node="${id}"] .node-primary-selector`).count(),0);
  assert.ok(Number(await page.locator(`[data-node="${id}"]`).evaluate(e=>getComputedStyle(e).opacity))<1);
  checks.push('MAT/TOP root Pixel only; Preview is first in blank and exact-name search menus, green and translucent');
  const moved=await page.evaluate(id=>{const n=current().nodes.find(n=>n.id===id);n.ui.comment='keep';change(()=>instantiate(availableEntries().find(d=>d.key==='preview'),501,330));return {ids:current().nodes.filter(n=>n.definitionUuid==='sgrape.builtin.preview').map(n=>n.id),x:n.ui.x,y:n.ui.y,comment:n.ui.comment};},id);
  assert.deepEqual(moved.ids,[id]);assert.equal(moved.x,await page.evaluate(()=>snap(501)));assert.equal(moved.y,await page.evaluate(()=>snap(330)));assert.equal(moved.comment,'keep');
  assert.equal(await page.locator(`[data-node="${id}"] .node-inline-values`).count(),0);
  assert.equal(await page.locator('#inspector [data-input="value"] input').count(),0);
  checks.push('Repeated Create relocates the same singleton and retains its private node state');
  const types=await page.evaluate(()=>typeVariants(catalog.find(d=>d.key==='preview')).map(v=>v.type));assert.equal(types.length,20);
  for(const type of types){
   const result=await page.evaluate(({id,type})=>{
    current().nodes=current().nodes.filter(n=>!['source','bad'].includes(n.id));current().edges=[];
    current().nodes.push(testNode('source',typeDescriptor(type).components===1?'scalar':'vector',70,90,{type}));render();
    openPreviewCreator({node:'source',port:'out',kind:'outputs',type});
    const first=creatorMatches[0],match=creatorMatches.find(m=>m.d.key==='preview');closeCreator();
    const ok=connectPorts({node:'source',port:'out',kind:'outputs'},{node:id,port:'value',kind:'inputs'}),n=current().nodes.find(n=>n.id===id);
    return {first:first?.d.key,port:match?.port,matched:match?.portType,type:n.params.type,ports:ports(n,'inputs'),outputs:ports(n,'outputs'),ok,edge:current().edges.find(e=>e.to[0]===id)};
   },{id,type});
   assert.equal(result.first,'preview',type);assert.equal(result.port,'value',type);assert.equal(result.matched,type,type);assert.equal(result.type,type,type);assert.deepEqual(result.ports,{value:type});assert.deepEqual(result.outputs,{});assert.ok(result.edge,type);
  }
  checks.push('All 20 scalar/vector types, including bool/int/uint/double, rank Preview first and connect without numeric filtering');
  for(const type of ['float','bool','double']){
   await page.evaluate(type=>{current().nodes=current().nodes.filter(n=>n.id!=='source');current().nodes.push(testNode('source','scalar',50,60,{type,value:type==='bool'?true:.4}));current().edges=[];render();scale=1;pan={x:10,y:10};transform();},type);
   const sourcePort=await h.at('[data-node="source"] .output .port'),canvas=await page.locator('#canvas').boundingBox();
   await h.drag(sourcePort,{x:canvas.x+canvas.width-70,y:canvas.y+canvas.height-90});await page.locator('#creator').waitFor({state:'visible'});
   assert.equal(await page.locator('#createresults .create-entry').first().getAttribute('data-create-entry'),'preview',type);
   await page.locator('[data-create-entry="preview"]').click();await settle();
   assert.equal(await page.evaluate(()=>current().nodes.filter(n=>n.definitionUuid==='sgrape.builtin.preview').length),1);
   assert.deepEqual(await page.evaluate(id=>current().edges.find(e=>e.to[0]===id)?.from,id),['source','out']);
   assert.equal(await page.evaluate(id=>current().nodes.find(n=>n.id===id).params.type,id),type);
  }
  checks.push('Actual float/bool/double output-wire drags offer Preview first and reconnect the singleton');
  const placement=await page.evaluate(()=>{
   const before=JSON.stringify(graph),history=past.length,r=$('#canvas').getBoundingClientRect();
   openCreator(r.left+350,r.top+250,{node:'source',port:'out',kind:'outputs',type:'double'},{place:true});
   chooseCreator(creatorMatches.findIndex(m=>m.d.key==='preview'));
   const active=!!nodePlacement,unchanged=before===JSON.stringify(graph)&&history===past.length;
   cancelNodePlacement();closeCreator();return {active,unchanged,cancelled:before===JSON.stringify(graph)&&history===past.length};
  });assert.deepEqual(placement,{active:true,unchanged:true,cancelled:true});
  checks.push('Port-click placement projects the existing Preview without mutation; cancel preserves identity, location, wire and History');
  const rejected=await page.evaluate(id=>{
   const bad=['mat3','float[4]','sampler2D','struct:missing'].map(type=>({type,variants:creatorVariants(catalog.find(d=>d.key==='preview'),{kind:'outputs',type}).length}));
   const before=JSON.stringify(graph),history=past.length;
   const duplicate=change(()=>current().nodes.push(testNode('duplicate','preview',10,10))),unchanged=before===JSON.stringify(graph)&&history===past.length;
   selected=id;selection=new Set([id]);duplicateSelection();const duplicateActionUnchanged=before===JSON.stringify(graph)&&history===past.length;
   const invalid=clone(graph);invalid.stages.vertex.nodes.push(testNode('bad','preview',10,10));let vertex=false;try{resolveAutoEdit(invalid,graph);}catch{vertex=true;}
   const nested=clone(graph);nested.functions=[{id:'nested',scope:'local',inputs:[],outputs:[],graph:{nodes:[testNode('bad','preview',10,10)],edges:[]}}];let fn=false;try{resolveAutoEdit(nested,graph);}catch{fn=true;}
   return {bad,duplicate,unchanged,duplicateActionUnchanged,vertex,fn};
  },id);
  assert.ok(rejected.bad.every(v=>v.variants===0));assert.equal(rejected.duplicate,false);assert.equal(rejected.unchanged,true);assert.equal(rejected.duplicateActionUnchanged,true);assert.equal(rejected.vertex,true);assert.equal(rejected.fn,true);
  checks.push('Composite/resource creator candidates excluded; duplicate and misplaced edits fail atomically without history');
  const wrongWire=await page.evaluate(id=>{
   current().nodes.push(testNode('bad','matrix',50,400,{type:'mat3'}));render();const before=JSON.stringify(graph),history=past.length;
   connectPorts({node:'bad',port:'out',kind:'outputs'},{node:id,port:'value',kind:'inputs'});
   return {unchanged:JSON.stringify(graph)===before,history:history===past.length};
  },id);assert.deepEqual(wrongWire,{unchanged:true,history:true});
  checks.push('Dragging a matrix onto Preview rejects the connection and preserves the prior wire/history');
  await page.evaluate(id=>{selected=id;selection=new Set([id]);inspectorTab='parameters';render();},id);
  for(const locale of await page.locator('#language option').evaluateAll(es=>es.map(e=>e.value))){await page.selectOption('#language',locale);assert.ok((await page.locator('[data-preview-help]').innerText()).length>40);assert.ok((await page.locator('#nodehelp').innerText()).includes('Preview'));}
  await page.selectOption('#language','en');
  const grouped=await page.evaluate(id=>{selected=id;selection=new Set([id]);const before=JSON.stringify(graph);groupSelection();return before===JSON.stringify(graph);},id);assert.equal(grouped,true);
  await page.evaluate(id=>{setUIExperiments({canvasDamping:false,frameDamping:false});const n=current().nodes.find(n=>n.id===id);n.ui.x=350;n.ui.y=240;delete n.ui.comment;selected=id;selection=new Set([id]);render();fit();status('',false,{clearError:true});},id);await settle();
  await page.screenshot({path:path.join(folder,'pixel-preview.png')});
  await page.evaluate(()=>remove());assert.equal(await page.locator(`[data-node="${id}"]`).count(),0);
  await page.evaluate(()=>undo());await settle();assert.equal(await page.locator(`[data-node="${id}"]`).count(),1);
  checks.push('Localized help, no Subgraph extraction, normal delete and Undo restore');
  fs.writeFileSync(path.join(folder,'preview.graph.json'),await page.evaluate(()=>JSON.stringify(graph)));
  assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,count:checks.length}));
 }catch(error){await h.finish(error);throw error;}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
