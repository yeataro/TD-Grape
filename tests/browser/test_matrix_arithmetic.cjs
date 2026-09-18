/* Real editor transactions: mixed operands, output dimensions, history and creator. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {harness}=require('./test_glsl_code.cjs');
const [source,stateFile,folder]=process.argv.slice(2);
(async()=>{
  const h=await harness(source,stateFile,folder,{skipPreview:true}),{page,checks,errors,settle}=h;
  const reset=async(key='multiply')=>{await page.evaluate(key=>{
    clearTimeout(autoTimer);connectionInterrupted=true;conflicted=true;readonly=false;historyBusy=nativeMutationBusy=false;stage='pixel';graphTrail=[];graph.functions=[];graph.declarations=[];selected=selectedEdge=null;selection.clear();past=[];future=[];
    const op=testNode('op',key,500,180,{type:'float'});op.ui.typeMode='auto';
    graph.stages.pixel={nodes:[testNode('left','matrix',50,60,{type:'mat2x3',values:[1,2,3,4,5,6]}),testNode('right','matrix',50,390,{type:'mat4x2',values:[1,2,3,4,5,6,7,8]}),testNode('scalar','scalar',900,60,{type:'float',value:2}),testNode('vector','vector',900,390,{type:'vec2',components:[1,2,0,0]}),op],edges:[]};
    rememberSavedGraph(graph);render();scale=.7;pan={x:10,y:10};transform();
  },key);await settle();};
  const connect=async(node,port)=>{const ok=await page.evaluate(({node,port})=>connectPorts({node,kind:'outputs',port:'out'},{node:'op',kind:'inputs',port}),{node,port});await settle();return ok;};
  const state=()=>page.evaluate(()=>({params:clone(current().nodes.find(n=>n.id==='op').params),ports:concretePorts(graph,current().nodes.find(n=>n.id==='op'),null),edges:clone(current().edges),history:past.length}));
  try{
    await page.selectOption('#language','en');await reset();await connect('left','a');assert.equal((await state()).ports.outputs.out,'mat2x3');
    await connect('right','b');let seen=await state();assert.deepEqual(seen.ports,{inputs:{a:'mat2x3',b:'mat4x2'},outputs:{out:'mat4x3'}});assert.equal(seen.history,2);
    await page.locator('#undo').click();assert.equal((await state()).ports.outputs.out,'mat2x3');await page.locator('#redo').click();assert.deepEqual((await state()).params,seen.params);
    checks.push('Two matrix wires infer the rectangular product and one Undo restores the previous shape and sockets');
    await connect('vector','b');assert.deepEqual((await state()).ports,{inputs:{a:'mat2x3',b:'vec2'},outputs:{out:'vec3'}});
    await page.screenshot({path:path.join(folder,'matrix-vector.png')});
    await connect('scalar','b');assert.deepEqual((await state()).ports,{inputs:{a:'mat2x3',b:'float'},outputs:{out:'mat2x3'}});
    checks.push('Replacing the second operand changes matrix product to vector product or scalar scaling');
    for(const key of ['add','subtract','divide'])for(const reverse of [false,true]){
      await reset(key);await connect('left',reverse?'b':'a');await connect('scalar',reverse?'a':'b');
      seen=await state();assert.equal(seen.ports.inputs[reverse?'a':'b'],'float');assert.equal(seen.ports.outputs.out,'mat2x3');
      const before=JSON.stringify(seen);await connect('vector',reverse?'a':'b');assert.equal(JSON.stringify(await state()),before);
    }
    checks.push('Scalar operands remain scalar in both orders; illegal matrix/vector addition, subtraction and division leave graph/history unchanged');
    await reset();await page.evaluate(()=>{
      current().nodes=current().nodes.filter(n=>n.id!=='op');render();const r=$('#canvas').getBoundingClientRect();openCreator(r.left+260,r.top+100,{node:'left',kind:'outputs',port:'out',type:'mat2x3'});$('#createsearch').value='multiply';renderCreator();chooseCreator(creatorMatches.findIndex(m=>m.d.key==='multiply'));
    });await settle();
    const created=await page.evaluate(()=>{const n=current().nodes.find(n=>n.id===selected);return {key:definition(n).key,ports:concretePorts(graph,n,null),history:past.length,open:!!creatorState};});
    assert.equal(created.key,'multiply');assert.equal(created.ports.outputs.out,'mat2x3');assert.equal(created.history,1);assert.equal(created.open,false);
    await page.locator('#undo').click();assert.equal(await page.evaluate(()=>current().nodes.length),4);
    checks.push('Wire creator builds a matrix Multiply and its wire in one undoable transaction');
    assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,count:checks.length}));
  }catch(error){await h.finish(error);throw error;}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
