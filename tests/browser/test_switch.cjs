const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');const{harness}=require('./test_glsl_code.cjs');
(async()=>{const[source,state,folder]=process.argv.slice(2),h=await harness(source,state,folder,{skipPreview:true}),{page,checks,errors}=h;try{
await page.selectOption('#language','en');await page.evaluate(()=>{nativeSourcePolling=uniformPolling=customPolling=true;uniformLive.disconnect();uniformLive.connect=()=>{};clearTimeout(autoTimer);scheduleGraphApply=()=>{};readonly=connectionInterrupted=dirty=false;graph.functions=[];graph.declarations=[];graphTrail=[];stage='pixel';graph.stages.pixel={nodes:[testNode('pixel','pixel_out',800,0),testNode('switch','switch',350,0),testNode('scalar','scalar',0,0,{type:'float',value:3}),testNode('vector','vector',0,180,{type:'vec3',components:[1,2,3,0]}),testNode('index','scalar',0,330,{type:'int',value:-1})],edges:[]};past=[];future=[];render();scale=1;pan={x:20,y:20};transform();window.connect=(source,port,add=false)=>connectPorts({node:source,port:'out',kind:'outputs'},{node:'switch',port,kind:'inputs',...(add?{add:true}:{})});});
assert.deepEqual(await page.evaluate(()=>Object.keys(ports(current().nodes.find(n=>n.id==='switch'),'inputs'))),['default','index','case0']);
assert.equal(await page.locator('[data-node=switch] [data-add-port]').count(),1);
assert.equal(await page.evaluate(()=>connect('scalar','index')),false);assert.equal(await page.evaluate(()=>connect('index','index')),true);
assert.equal(await page.evaluate(()=>connect('scalar','default')),true);assert.equal(await page.evaluate(()=>connect('scalar','case0')),true);
assert.equal(await page.evaluate(()=>connect('scalar','__add__',true)),true);
assert.equal(await page.evaluate(()=>current().nodes.find(n=>n.id==='switch').params.caseCount),2);
assert.equal(await page.evaluate(()=>connect('vector','case1')),false);
checks.push('Switch orders Default / int Index / numbered Cases; spare connection adds Case 1 and rejects mismatched types');
const before=await page.evaluate(()=>clone(graph));assert.equal(await page.evaluate(()=>connect('vector','default')),true);
assert.deepEqual(await page.evaluate(()=>{const n=current().nodes.find(n=>n.id==='switch');return{type:n.params.type,cases:current().edges.filter(e=>e.to[0]==='switch'&&e.to[1].startsWith('case')).length,index:current().edges.some(e=>e.to[1]==='index'),out:ports(n,'outputs').out};}),{type:'vec3',cases:0,index:true,out:'vec3'});
await page.locator('#undo').click();assert.deepEqual(await page.evaluate(()=>graph),before);await page.locator('#redo').click();
await page.evaluate(()=>{selected='switch';selection=new Set(['switch']);inspector();});assert.equal(await page.locator('#inspector [data-switch-type]').isDisabled(),true);
assert.equal(await page.evaluate(()=>connect('vector','case0')),true);
await page.evaluate(()=>change(()=>{current().edges=current().edges.filter(e=>!(e.to[0]==='switch'&&e.to[1]==='default'));}));
assert.equal(await page.locator('#inspector [data-switch-type]').isDisabled(),false);
await page.locator('#inspector [data-switch-type]').selectOption('float');assert.equal(await page.evaluate(()=>current().edges.some(e=>e.to[0]==='switch'&&e.to[1]==='case0')),false);
checks.push('Default type owns all cases; incompatible prior case wires detach, Index survives, and one Undo restores the complete change');
await page.evaluate(()=>{selected='switch';selection=new Set(['switch']);duplicateSelection();});
// Verify saved dynamic defaults through the production compiler outside the browser.
fs.writeFileSync(path.join(folder,'graph.json'),JSON.stringify(await page.evaluate(()=>graph)));
await page.locator('[data-node=switch]').screenshot({path:path.join(folder,'switch.png')});assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,checks}));
}catch(e){await h.finish(e);throw e;}})().catch(e=>{console.error(e.stack);process.exitCode=1});
