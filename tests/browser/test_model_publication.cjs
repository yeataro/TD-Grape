/* Migrated modules operate through the model; publications scope view work. */
const assert=require('node:assert/strict');
const {harness}=require('./test_glsl_code.cjs');
const [source,stateFile,folder]=process.argv.slice(2);
(async()=>{
 const h=await harness(source,stateFile,folder,{skipPreview:true}),{page,checks,errors}=h;
 try{
  await page.evaluate(()=>{
   clearTimeout(autoTimer);scheduleGraphApply=()=>{};readonly=false;historyBusy=nativeMutationBusy=false;connectionInterrupted=true;
   stage='pixel';graphTrail=[];graph.functions=[];graph.declarations=[];past=[];future=[];selected=null;selection.clear();
   graph.stages.pixel={nodes:[testNode('s','float',20,20,{value:.5}),testNode('m','multiply',370,20,{type:'vec3'}),testNode('other','add',370,400,{type:'vec3'}),testNode('o','pixel_out',730,20)],edges:[]};render();
   window.modelPublicationTest={events:[],legacyCalls:0,compared:[],networkConnects:0};
   const publish=CanvasUpdate.publish;CanvasUpdate.publish=(changes,stamp)=>{modelPublicationTest.events.push({changes:clone(changes),stamp});return publish(changes,stamp);};
   reshapeLegacyTypedInputs=()=>{modelPublicationTest.legacyCalls++;throw Error('Migrated node reached legacy configuration');};
   const connect=GrapeGraph.Network.prototype.connect;GrapeGraph.Network.prototype.connect=function(...args){modelPublicationTest.networkConnects++;return connect.apply(this,args);};
  });
  assert.deepEqual(await page.evaluate(()=>{
   const connected=connectPorts({node:'s',kind:'outputs',port:'out'},{node:'m',kind:'inputs',port:'a'});
   const m=current().nodes.find(n=>n.id==='m'),other=current().nodes.find(n=>n.id==='other');
   return {connected,inputs:ports(m,'inputs'),output:ports(m,'outputs').out,otherUntouched:other.params.operandTypes===undefined,legacy:modelPublicationTest.legacyCalls,model:modelPublicationTest.networkConnects};
  }),{connected:true,inputs:{a:'float',b:'vec3'},output:'vec3',otherUntouched:true,legacy:0,model:1});
  checks.push('Actual editor wiring invokes Network.connect and the module configuration, without legacy type reshaping or unrelated signature writes');
  assert.deepEqual(await page.evaluate(async()=>{
   const changed=setMathType(current().nodes.find(n=>n.id==='m'),'vec4');const chosen=ports(current().nodes.find(n=>n.id==='m'),'outputs').out;
   const undone=await undo(),undoType=ports(current().nodes.find(n=>n.id==='m'),'outputs').out;const redone=await undo(true);
   return {changed,chosen,undone,undoType,redone,redoType:ports(current().nodes.find(n=>n.id==='m'),'outputs').out,legacy:modelPublicationTest.legacyCalls};
  }),{changed:true,chosen:'vec4',undone:true,undoType:'vec3',redone:true,redoType:'vec4',legacy:0});
  checks.push('Manual type selection and Undo/Redo use module state and publish model changes');
  assert.deepEqual(await page.evaluate(()=>{
   const start=modelPublicationTest.events.length,noOp=change(()=>{}, {localize:false});
   const rejected=change(()=>{throw Error('intentional rollback');},{localize:false});
   return {noOp,rejected,published:modelPublicationTest.events.length-start};
  }),{noOp:true,rejected:false,published:0});
  checks.push('No-op and rejected edits emit no successful publication');
  const scoped=await page.evaluate(()=>{
   // Drive the same public transaction/publication/view interfaces directly,
   // so wire drawing and Inspector reads do not pollute the card-query count.
   const originalPorts=ports,read=[];ports=(n,kind)=>{read.push(n.id);return originalPorts(n,kind);};
   const other=document.querySelector('[data-node="other"]'),before=JSON.stringify(graph);
   try{
    const step=GrapeGraph.transact(graph,GrapeGraph.registry,(_before,model)=>{model.networks.get('pixel').node('m').update({name:'Product'});return graph;});
    publishGraphChanges(step.changes);CanvasUpdate.updateCards();
    return {changed:JSON.stringify(graph)!==before,queried:[...new Set(read)],retained:document.querySelector('[data-node="other"]')===other,complete:step.changes.networks[0].complete};
   }finally{ports=originalPorts;}
  });assert.deepEqual(scoped,{changed:true,queried:['m','s'],retained:true,complete:true});
  checks.push('Model publication limits card port queries to the changed node and its input source, preserving unrelated DOM');
  const shape=await page.evaluate(()=>{
   const step=GrapeGraph.transact(graph,GrapeGraph.registry,(_before,model)=>{model.networks.get('pixel').node('m').configure({type:'float'});return graph;});
   const changedPorts=step.changes.networks[0].ports.map(p=>[p.node,p.direction,p.key,p.after]);
   publishGraphChanges(step.changes);CanvasUpdate.updateCards();return changedPorts;
  });assert.ok(shape.some(p=>p[1]==='output'&&p[3]==='float'));
  checks.push('Port interface changes are explicit in the notification rather than inferred by the renderer');
  const result=await page.evaluate(()=>{
   // A usable complete TOP graph, generated entirely by the frontend modules.
   const step=GrapeGraph.transact(graph,GrapeGraph.registry,(_before,model)=>{const n=model.networks.get('pixel');n.connect(n.node('m').outputs[0],n.node('o').inputs[0],{components:{float:1,vec4:4},conversions:[{from:'float',to:'vec4'}]});return graph;});
   publishGraphChanges(step.changes);render();const result=GrapeTopCompiler.compile(graph,typeContract.glslCode);
   return {supported:GrapeTopCompiler.supports(graph),code:result.pixel,legacy:modelPublicationTest.legacyCalls,bindings:result.bindings};
  });assert.equal(result.supported,true);assert.match(result.code,/sg_n_s \* /);assert.equal(result.legacy,0);assert.deepEqual(result.bindings,[]);
  checks.push('The same edited and replayed graph generates a complete frontend TOP shader');
  assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,count:checks.length}));
 }catch(error){await h.finish(error);throw error;}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
