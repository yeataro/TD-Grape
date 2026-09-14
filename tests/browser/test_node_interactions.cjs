/* Desktop and Chromium touch coverage for Subgraph spare sockets and body dragging.
 * node test_node_interactions.cjs SOURCE_DIR STATE_JSON REPORT_DIR
 */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {harness}=require('./test_glsl_code.cjs');
const port=(node,kind,id)=>`[data-node="${node}"] .port[data-kind="${kind}"][data-port="${id}"]`;
async function run(){
  const[source,stateFile,folder]=process.argv.slice(2),h=await harness(source,stateFile,folder,{touch:true}),{page,checks,errors,at,drag,settle}=h;
  try{
    const cdp=await page.context().newCDPSession(page);
    const touch=async(type,points=[])=>{await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([id,x,y])=>({id,x,y,radiusX:4,radiusY:4}))});await settle();};
    const start=p=>touch('touchStart',[[1,p.x,p.y]]),move=p=>touch('touchMove',[[1,p.x,p.y]]),end=()=>touch('touchEnd');
    const pos=()=>page.evaluate(()=>clone(current().nodes.find(n=>n.id==='source').ui));
    await page.evaluate(()=>{
      graph.functions=[];graph.declarations=[];graphTrail=[];stage='pixel';past=[];future=[];readonly=false;selection.clear();selected=null;
      graph.stages.pixel={nodes:[testNode('source','float',24,50,{value:.3}),testNode('sum','add',348,80),testNode('pixel','pixel_out',650,80)],edges:[{from:['source','out'],to:['sum','a']},{from:['sum','out'],to:['pixel','color']}]};
      current().nodes[0].ui.comment='Body drag comment';current().nodes[0].ui.label='source label';scale=.9;pan={x:32,y:50};render();
    });
    let p=await at('[data-node="source"] .node-value'),before=await pos(),history=await page.evaluate(()=>past.length);
    await drag(p,{x:p.x+80,y:p.y+38});let after=await pos();assert.notEqual(after.x,before.x);assert.notEqual(after.y,before.y);assert.equal(await page.evaluate(()=>past.length),history+1);
    const geometry=await page.evaluate(()=>{const b=$('[data-node="source"] [data-port="out"]'),r=b.getBoundingClientRect(),q=graphPoint(r.left+r.width/2,r.top+r.height/2),p=point(current().nodes[0],'out','outputs');return Math.hypot(q.x-p.x,q.y-p.y);});assert.ok(geometry<.1);
    await page.locator('#undo').click();assert.deepEqual(await pos(),before);await page.locator('#redo').click();assert.deepEqual(await pos(),after);checks.push('desktop body drag moves a node in one Undo/Redo step; wire endpoint stays on its socket');
    p=await at('[data-node="source"] .node-canvas-comment');before=await pos();await drag(p,{x:p.x+36,y:p.y+22});assert.notEqual((await pos()).x,before.x);
    p=await at('[data-node="source"] .node-value');before=await pos();history=await page.evaluate(()=>past.length);await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(p.x+70,p.y+30,{steps:5});await page.keyboard.press('Escape');await page.mouse.up();assert.deepEqual(await pos(),before);assert.equal(await page.evaluate(()=>past.length),history);checks.push('comments support whole-node dragging; Escape cancels movement without a history entry');
    p=await at('[data-node="source"] .node-alias');before=await pos();await drag(p,{x:p.x+45,y:p.y+20});assert.deepEqual(await pos(),before);
    await page.locator('[data-node="source"] .node-alias').dblclick();assert.ok(await page.evaluate(()=>document.activeElement.matches('input')));checks.push('node Label retains its editing interaction instead of becoming a drag handle');
    await page.evaluate(()=>{Object.assign(current().nodes.find(n=>n.id==='source').ui,{x:24,y:50});render();});
    before=await pos();await drag(await at(port('source','outputs','out')),await at(port('sum','inputs','b')));assert.deepEqual(await pos(),before);assert.ok(await page.evaluate(()=>current().edges.some(e=>e.to.join(':')==='sum:b')));checks.push('dragging a socket still connects wires without moving the node');
    await page.evaluate(()=>{selected=null;selection.clear();render();});p=await at('[data-node="source"] .node-value');before=await pos();await start(p);await move({x:p.x+55,y:p.y+24});await end();assert.notEqual((await pos()).x,before.x);
    p=await at('[data-node="source"] .node-value');before=await pos();await start(p);await move({x:p.x+40,y:p.y+20});await touch('touchCancel');assert.deepEqual(await pos(),before);checks.push('real Chromium touch body drag commits on release and cancels on pointer cancellation');
    p=await at('[data-node="source"] .node-value');before=await pos();await start(p);await move({x:p.x+32,y:p.y+20});await touch('touchStart',[[1,p.x+32,p.y+20],[2,p.x+130,p.y+20]]);await touch('touchMove',[[1,p.x+12,p.y+20],[2,p.x+150,p.y+20]]);await end();assert.deepEqual(await pos(),before);checks.push('two-finger pinch cancels a pending body move and only changes the view');
    await page.evaluate(()=>{readonly=true;render();});p=await at('[data-node="source"] .node-value');before=await pos();await drag(p,{x:p.x+50,y:p.y+20});await start(p);await move({x:p.x+60,y:p.y+20});await end();assert.deepEqual(await pos(),before);checks.push('desktop and touch body drag cannot edit read-only graphs');

    // Source Function deliberately tests copy-on-write while adding its first boundary port.
    await page.evaluate(()=>{
      readonly=false;past=[];future=[];clearCompileDiagnostics();graphTrail=[];selection.clear();selected=null;
      const f={id:'shared',name:'Shared',scope:'library',source:{id:'fixture',version:'1'},stages:['pixel'],inputs:[],outputs:[],graph:{nodes:[
        {id:'in',definitionUuid:FunctionModel.INPUT,params:{},ui:{x:0,y:80}},testNode('calc','add',265,80,{type:'vec4'}),testNode('sample','texture_sample',265,260),
        {id:'out',definitionUuid:FunctionModel.OUTPUT,params:{},ui:{x:570,y:100}}
      ],edges:[]}};
      f.graph.nodes[1].inputValues={a:[.1,.2,.3,1]};graph.functions=[f];graph.declarations=[];
      graph.stages.pixel={nodes:[{id:'call',definitionUuid:FunctionModel.CALL,params:{functionId:f.id},ui:{x:100,y:100}},{id:'call2',definitionUuid:FunctionModel.CALL,params:{functionId:f.id},ui:{x:100,y:300}},testNode('pixel','pixel_out',500,100)],edges:[]};
      window.sourceSnapshot=JSON.stringify(f);graphTrail=[f.id];scale=.85;pan={x:32,y:50};render();
    });
    assert.equal(await page.locator('.port-add').count(),2);assert.equal(await page.evaluate(()=>JSON.stringify(graph).includes('__add__')),false);
    let baseline=await page.evaluate(()=>JSON.stringify(graph));p=await at(port('in','outputs','__add__'));const canvas=await page.locator('#canvas').boundingBox();await drag(p,{x:canvas.x+80,y:canvas.y+430});assert.equal(await page.evaluate(()=>JSON.stringify(graph)),baseline);assert.equal(await page.locator('#creator').isVisible(),false);
    await drag(await at(port('in','outputs','__add__')),await at(port('out','inputs','__add__')));assert.equal(await page.evaluate(()=>JSON.stringify(graph)),baseline);checks.push('grey spare sockets are never serialized; blank drops and grey-to-grey drags do not create ports');
    history=await page.evaluate(()=>past.length);await drag(await at(port('calc','inputs','a')),await at(port('in','outputs','__add__')));
    const added=await page.evaluate(()=>({f:clone(currentFunction()),source:JSON.stringify(FunctionModel.find(graph,'shared')),calls:graph.stages.pixel.nodes.filter(n=>n.definitionUuid===FunctionModel.CALL).map(n=>n.params.functionId)}));
    assert.equal(added.f.inputs.length,1);assert.equal(added.f.inputs[0].name,'a');assert.equal(added.f.inputs[0].type,'vec4');assert.deepEqual(added.f.inputs[0].default,[.1,.2,.3,1]);assert.equal(added.source,await page.evaluate(()=>sourceSnapshot));assert.equal(new Set(added.calls).size,1);assert.notEqual(added.calls[0],'shared');assert.equal(await page.evaluate(()=>past.length),history+1);
    assert.deepEqual(added.f.graph.edges[0],{from:['in',added.f.inputs[0].id],to:['calc','a']});checks.push('dragging an input to the grey source creates a typed named port + wire atomically; source snapshot stays intact and all calls localize together');
    await page.locator('#undo').click();assert.equal(await page.evaluate(()=>JSON.stringify(graph)),baseline);await page.locator('#redo').click();assert.equal(await page.evaluate(()=>FunctionModel.find(graph,graph.stages.pixel.nodes.find(n=>n.id==='call').params.functionId).inputs.length),1);
    // Undo may leave navigation at the stage if its localized Function disappeared; reenter the call.
    await page.evaluate(()=>{if(!currentFunction())enterFunction(graph.stages.pixel.nodes.find(n=>n.id==='call'));scale=.85;pan={x:32,y:50};transform();});
    checks.push('Subgraph port + first connection can be undone/redone in one step');
    p=await at(port('in','outputs','__add__'));let q=await at(port('calc','inputs','b'));await start(p);await move(q);await end();assert.equal(await page.evaluate(()=>currentFunction().inputs.length),2);checks.push('touch can start at the grey socket and create an input by dropping onto a real input');
    p=await at(port('calc','outputs','out'));q=await at(port('out','inputs','__add__'));await start(p);await move(q);await end();
    let ports=await page.evaluate(()=>clone(currentFunction().outputs));assert.equal(ports.length,1);assert.equal(ports[0].type,'vec4');assert.equal(ports[0].name,'out');checks.push('touch creates an output from a real output socket without adding an extra intermediary node');
    await drag(await at(port('in','outputs','__add__')),await at(port('sample','inputs','sampler')));const sampler=await page.evaluate(()=>clone(currentFunction().inputs.at(-1)));assert.equal(sampler.type,'sampler2D');assert.equal(sampler.default,null);checks.push('resource ports infer sampler2D with its existing unconnected fallback');
    const beforeOrder=await page.evaluate(()=>clone(currentFunction())),portId=beforeOrder.inputs[1].id;
    await page.evaluate(()=>{selected='in';selection=new Set(['in']);inspectorTab='settings';inspector();});await page.locator(`[data-port-id="${portId}"][data-port-move="-1"]`).click();
    const afterOrder=await page.evaluate(()=>clone(currentFunction()));assert.equal(afterOrder.inputs[0].id,portId);assert.deepEqual(afterOrder.graph,beforeOrder.graph);assert.deepEqual(afterOrder.outputs,beforeOrder.outputs);checks.push('Parameter Settings reorders existing ports by stable ID without changing connections');
    await page.evaluate(()=>{navigateGraph(0);const call=current().nodes.find(n=>n.id==='call'),f=FunctionModel.find(graph,call.params.functionId);connectPorts({node:call.id,kind:'outputs',port:f.outputs[0].id},{node:'pixel',kind:'inputs',port:'color'});});
    assert.equal(await page.locator('.port-add').count(),0);fs.writeFileSync(path.join(folder,'subgraph-graph.json'),await page.evaluate(()=>JSON.stringify(graph)));checks.push('external call nodes reflect the new interface; this round exposes shortcuts only inside Subgraphs');
    await page.evaluate(()=>{enterFunction(current().nodes.find(n=>n.id==='call'));const f=currentFunction();while(f.inputs.length<16)f.inputs.push({id:'extra'+f.inputs.length,name:'Extra',type:'float',default:0});render();scale=.7;pan={x:20,y:20};transform();});
    assert.equal(await page.locator(port('in','outputs','__add__')).isDisabled(),true);const limited=await page.evaluate(()=>JSON.stringify(graph));assert.equal(await page.evaluate(()=>connectPorts({node:'in',kind:'outputs',port:'__add__',add:true},{node:'calc',kind:'inputs',port:'a'})),false);assert.equal(await page.evaluate(()=>JSON.stringify(graph)),limited);
    await page.evaluate(()=>{readonly=true;render();});assert.equal(await page.locator(port('out','inputs','__add__')).isDisabled(),true);checks.push('interface capacity and read-only rules block shortcut edits');

    await page.evaluate(()=>{readonly=false;graphTrail=[];graph.functions=[];graph.declarations=[{id:'tex',kind:'sampler',name:'uTex',type:'sampler2D',source:'builtin:banana',fallback:'opaque-black'}];graph.stages.pixel={nodes:[testNode('sampler','sampler',0,80,{declarationId:'tex'}),testNode('legacy','texture',300,80,{declarationId:'tex'}),testNode('sample','texture_sample',600,80)],edges:[]};scale=.85;pan={x:24,y:60};selected=null;selection.clear();render();});
    const colors=await page.evaluate(()=>Object.fromEntries(['sampler','legacy','sample'].map(id=>[id,{bg:getComputedStyle($(`[data-node="${id}"] .node-title`)).backgroundColor,type:getComputedStyle($(`[data-node="${id}"] .port[data-kind="outputs"]`)).borderColor}])));
    assert.notEqual(colors.sampler.bg,colors.legacy.bg);assert.equal(colors.legacy.bg,colors.sample.bg);assert.equal(colors.legacy.type,colors.sample.type);assert.equal(await page.evaluate(()=>browserMeta(catalog.find(d=>d.key==='texture')).category),'texture');
    await page.screenshot({path:path.join(folder,'sampler-functions.png')});checks.push('Sampler has a distinct source color; both sampling operations share function color while Texture categorization and vec4 port colors stay consistent');
    assert.deepEqual(errors,[]);await h.finish();
    // Changing the internal flag requires a reload; it never becomes a user preference.
    const legacy=await harness(source,stateFile,path.join(folder,'header-only'),{headerOnly:true,touch:true});
    try{
      await legacy.page.evaluate(()=>{graphTrail=[];graph.functions=[];graph.declarations=[];graph.stages.pixel={nodes:[testNode('source','float',48,80,{value:.2})],edges:[]};scale=1;pan={x:25,y:25};selected=null;selection.clear();readonly=false;render();});
      let p=await legacy.at('[data-node="source"] .node-value'),before=await legacy.page.evaluate(()=>clone(current().nodes[0].ui));await legacy.drag(p,{x:p.x+70,y:p.y+28});assert.deepEqual(await legacy.page.evaluate(()=>current().nodes[0].ui),before);
      p=await legacy.at('[data-node="source"] .node-title');await legacy.drag(p,{x:p.x+70,y:p.y+28});assert.notDeepEqual(await legacy.page.evaluate(()=>current().nodes[0].ui),before);
      const c=await legacy.page.context().newCDPSession(legacy.page);p=await legacy.at('[data-node="source"] .node-value');before=await legacy.page.evaluate(()=>clone(current().nodes[0].ui));
      for(const[type,points]of [['touchStart',[{id:1,x:p.x,y:p.y}]],['touchMove',[{id:1,x:p.x+70,y:p.y+30}]],['touchEnd',[]]]){await c.send('Input.dispatchTouchEvent',{type,touchPoints:points});await legacy.settle();}assert.deepEqual(await legacy.page.evaluate(()=>current().nodes[0].ui),before);
      assert.deepEqual(legacy.errors,[]);legacy.checks.push('internal nodeBodyDrag=false restores header-only dragging for mouse and touch');await legacy.finish();
    }catch(e){await legacy.finish(e);throw e;}
    console.log(JSON.stringify({passed:true,count:checks.length+1}));
  }catch(e){if(page.isClosed())throw e;await h.finish(e);throw e;}
}
run().catch(e=>{console.error(e.stack);process.exitCode=1;});
