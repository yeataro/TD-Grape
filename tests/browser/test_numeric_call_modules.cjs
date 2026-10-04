const assert=require('node:assert/strict');
const {harness}=require('./test_glsl_code.cjs');
const [source,stateFile,folder]=process.argv.slice(2);
(async()=>{
 const h=await harness(source,stateFile,folder,{skipPreview:true}),{page,checks,errors,settle}=h;page.setDefaultTimeout(6000);
 try{
  await page.evaluate(()=>{
   clearTimeout(autoTimer);scheduleGraphApply=()=>{};readonly=false;historyBusy=nativeMutationBusy=false;connectionInterrupted=true;
   stage='pixel';graph.target='top';editorTarget='top';graphTrail=[];graph.functions=[];graph.declarations=[];graph.topInputs=[];
   graph.stages={pixel:{nodes:[testNode('factor','vector',20,20,{type:'vec4',components:[.1,.2,.3,1]}),testNode('out','pixel_out',780,20)],edges:[]}};
   past=[];future=[];selected=null;selection.clear();render();scale=.6;pan={x:10,y:10};transform();
  });
  const ids={};
  for(const key of ['mix','dot','length','normalize']){
   await page.locator('#canvas').focus();await page.keyboard.press('Tab');await page.locator('#createsearch').fill(key);await page.locator(`[data-create-entry="${key}"]`).click();await settle();ids[key]=await page.evaluate(()=>selected);
   await page.locator(`[data-node-selector="${ids[key]}"]`).selectOption('vec4');await settle();
   const ports=await page.evaluate(id=>{const n=current().nodes.find(n=>n.id===id);return {input:window.ports(n,'inputs'),output:window.ports(n,'outputs')};},ids[key]);
   assert.equal(ports.output.out,['dot','length'].includes(key)?'float':'vec4');
   assert.equal(await page.locator(`[data-node-selector="${ids[key]}"]`).getAttribute('title'),await page.evaluate(key=>t(['dot','length'].includes(key)?'vector.inputType':'vector.outputType'),key));
  }
  checks.push('Four module nodes are creatable; selectors configure declared input/output roles and fixed scalar outputs');
  const wiring=await page.evaluate(ids=>{
   const mix=current().nodes.find(n=>n.id===ids.mix);change(()=>{setNodeInputValue(mix,'a',[0,0,0,1]);setNodeInputValue(mix,'b',[1,1,1,1]);});
   const input=connectPorts({node:'factor',kind:'outputs',port:'out'},{node:ids.mix,kind:'inputs',port:'factor'});
   const output=connectPorts({node:ids.mix,kind:'outputs',port:'out'},{node:'out',kind:'inputs',port:'color'});
   return {input,output,type:mix.params.type,factor:ports(mix,'inputs').factor,supported:GrapeTopCompiler.supports(graph),pixel:GrapeTopCompiler.compile(graph,typeContract.glslCode).pixel};
  },ids);
  assert.equal(wiring.input,true);assert.equal(wiring.output,true);assert.equal(wiring.type,'vec4');assert.equal(wiring.factor,'vec4');assert.equal(wiring.supported,true);
  checks.push('Vector factor selects a native Mix input signature; output and downstream wire remain fixed');
  const gpu=await page.evaluate(pixel=>{
   const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const gl=canvas.getContext('webgl2');if(!gl)throw Error('WebGL2 unavailable');
   function shader(type,text){const s=gl.createShader(type);gl.shaderSource(s,text);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
   // Only adapt TD's host header/finishing to a one-pixel WebGL test harness.
   const p=gl.createProgram();gl.attachShader(p,shader(gl.VERTEX_SHADER,'#version 300 es\nvoid main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.0-1.0,0,1);}'));
   gl.attachShader(p,shader(gl.FRAGMENT_SHADER,'#version 300 es\nprecision highp float;\nconst vec2 vUV=vec2(0);\nvec4 TDOutputSwizzle(vec4 v){return v;}\n'+pixel));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));
   gl.useProgram(p);gl.drawArrays(gl.TRIANGLES,0,3);const bytes=new Uint8Array(4);gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,bytes);gl.deleteProgram(p);return [...bytes];
  },wiring.pixel);
  gpu.forEach((value,i)=>assert.ok(Math.abs(value-[26,51,77,255][i])<=1));
  checks.push('Generated numeric Mix shader executes in actual WebGL2 with adapted TD header; pixel matches per-component factor');
  const state=await page.evaluate(async ids=>{
   const before=JSON.stringify(graph),mix=current().nodes.find(n=>n.id===ids.mix),edge=current().edges.find(e=>e.to[0]===ids.mix&&e.to[1]==='factor');
   change(()=>removeGraphEdges(graph,current(),candidate=>candidate===edge));const retained=ports(mix,'inputs').factor==='vec4'&&mix.params.type==='vec4';await undo();const exact=JSON.stringify(graph)===before;await undo(true);
   // An unmigrated, disconnected node exercises the mixed-network planning adapter.
   change(()=>current().nodes.push(testNode('legacy','uv',30,250)));
   const connected=connectPorts({node:'factor',kind:'outputs',port:'out'},{node:ids.mix,kind:'inputs',port:'factor'});
   const supported=GrapeTopCompiler.supports(graph),factor=ports(current().nodes.find(n=>n.id===ids.mix),'inputs').factor;
   return {retained,exact,connected,supported,factor};
  },ids);
  assert.deepEqual(state,{retained:true,exact:true,connected:true,supported:false,factor:'vec4'});
  checks.push('Disconnect retains selected input tuple; exact Undo/Redo and mixed legacy graph planning preserve native factor');
  // Clear incident lines before a deliberate manual change to an unmigrated type.
  await page.evaluate(id=>change(()=>removeGraphEdges(graph,current(),e=>e.to[0]===id||e.from[0]===id)),ids.mix);
  await page.locator(`[data-node-selector="${ids.mix}"]`).selectOption('dvec4');await settle();
  assert.deepEqual(await page.evaluate(id=>{const n=current().nodes.find(n=>n.id===id);return {type:n.params.type,tuple:n.params.inputTypes??null};},ids.mix),{type:'dvec4',tuple:null});
  await page.locator(`[data-node-selector="${ids.mix}"]`).selectOption('vec4');await settle();
  assert.equal(await page.evaluate(id=>current().nodes.find(n=>n.id===id).params.type,ids.mix),'vec4');
  checks.push('Explicit type selection can leave and re-enter the migrated capability without stale native tuples or a no-op selector');
  const saved=await page.evaluate(async()=>{const before=JSON.stringify(graph);await api('apply',{graph:JSON.parse(before)});await load();return JSON.stringify(graph)===before;});assert.equal(saved,true);
  checks.push('Mixed graph persists and reloads through the isolated API fixture without losing state');
  assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,count:checks.length}));
 }catch(error){await h.finish(error);throw error;}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
