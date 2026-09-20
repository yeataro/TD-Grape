/* Native Buffer UI uses resource ports and source controls, not value sliders. */
const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {execFileSync}=require('node:child_process');
const {harness}=require('./test_glsl_code.cjs');
(async()=>{
 const [source,base,folder]=process.argv.slice(2);fs.mkdirSync(folder,{recursive:true});
 const fixture=path.join(folder,'state.json');execFileSync(process.env.PYTHON_EXECUTABLE||'python',[path.join(__dirname,'export_editor_fixture.py'),base,fixture]);
 const h=await harness(source,fixture,folder,{skipPreview:true}),{page,checks,errors}=h;
 try{
  await page.evaluate(()=>{clearTimeout(autoTimer);nativeSourcePolling=uniformPolling=customPolling=true;uniformLive.disconnect();uniformLive.connect=()=>{};});
  await page.evaluate(()=>openInputCreate('texture_buffer'));
  assert.equal(await page.locator('#sourcename').inputValue(),'uBuffer');
  assert.equal(await page.locator('#sourcearraylength').isVisible(),false);
  assert.equal(await page.locator('#sourcearraypath').getAttribute('required'),null);
  assert.deepEqual(await page.locator('#sourcetype option').evaluateAll(es=>es.map(e=>e.value)),['float','vec2','vec3','vec4']);
  await page.locator('#sourcecreate button[type=submit]').click();
  assert.equal(await page.locator('#sourcecreatedialog').isVisible(),false);
  const decl=await page.evaluate(()=>graph.declarations.find(d=>d.type==='samplerBuffer'));
  assert.ok(decl);assert.equal(decl.value,null);assert.equal(decl.nativeSequence,'array');
  checks.push('Buffer creation has CHOP format/path and no baked length or numeric default');
  await page.evaluate(id=>{
   nativeSourceSnapshot={revision,enabled:true,uniforms:[{id,name:'uBuffer',type:'samplerBuffer',sequence:'array',missing:false,pending:false,nameWritable:true,expected:'source',components:[],arrayBinding:{mode:'CONSTANT',value:'',writable:true,expected:'path',arrayType:'texturebuffer',elementType:'float'}}],issues:[]};
   renderNativeSources();selectInputSource(id);
  },decl.id);
  assert.equal(await page.locator(`[data-input-group="texture_buffer"] [data-input-source="${decl.id}"]`).count(),1);
  assert.equal(await page.locator(`[data-input-group="uniform"] [data-input-source="${decl.id}"]`).count(),0);
  assert.equal(await page.locator(`[data-input-source="${decl.id}"] input`).count(),0);
  assert.equal(await page.locator('#inspector [data-source-custom]').count(),0);
  checks.push('Buffer is separate from Custom Uniforms; source card and inspector have no numeric Uniform controls');
  await page.evaluate(id=>{
   current().nodes=[testNode('buffer','uniform',30,100,{declarationId:id}),testNode('read','buffer_fetch',320,100),testNode('count','buffer_length',320,300),testNode('out','pixel_out',600,100)];
   current().edges=[{from:['buffer','out'],to:['read','buffer']},{from:['read','out'],to:['out','color']},{from:['buffer','out'],to:['count','buffer']}];render();
  },decl.id);
  assert.deepEqual(await page.evaluate(()=>{const ports=(i,kind)=>{const n=current().nodes[i];return resolvedNodePorts(catalog.find(d=>d.definitionUuid===n.definitionUuid),n.params,graph.declarations.find(d=>d.id===n.params.declarationId),kind);};return {source:ports(0,'outputs'),read:ports(1,'inputs'),count:ports(2,'outputs')};}),{source:{out:'samplerBuffer'},read:{buffer:'samplerBuffer',index:'int'},count:{out:'int'}});
  assert.equal(await page.locator('.node [data-native-source] input').count(),0);
  checks.push('reference resolves to samplerBuffer and connects to Fetch/Length without live numeric subscriptions');
  await page.evaluate(id=>{
    dirty=false;nativeSourceError='';nativeSourcePolling=false;past=[];future=[];
    const decl=graph.declarations.find(d=>d.id===id);decl.sourceMissing=true;
    nativeSourceSnapshot.graph=clone(graph);nativeSourceSnapshot.sourceChanged=false;
    Object.assign(nativeSourceSnapshot.uniforms[0],{missing:true,formatChange:{arrayType:'uniformarray',elementType:'float',expected:'format-token'}});
    window.formatBefore=clone(graph);window.formatCalls=[];
    api=async(endpoint,body)=>{formatCalls.push({endpoint,body});const state=clone(nativeSourceSnapshot);if(endpoint==='source-edit'){
      state.workingGraph=clone(graph);const d=state.workingGraph.declarations.find(d=>d.id===id);d.type='float[8]';delete d.elementType;delete d.sourceMissing;state.proposal=true;
    }return state;};
    scheduleGraphApply=()=>{};render();selectInputSource(id);
  },decl.id);
  await page.locator('#inspector [data-source-adopt-format]').click();
  await page.locator('.confirmation-dialog button').first().click();
  assert.equal(await page.evaluate(()=>formatCalls.length),0);
  await page.locator('#inspector [data-source-adopt-format]').click();
  await page.locator('.confirmation-dialog button').last().click();
  await page.waitForFunction(()=>past.length===1);
  assert.deepEqual(await page.evaluate(()=>({type:graph.declarations.find(d=>d.id===formatBefore.declarations.find(d=>d.type==='samplerBuffer').id).type,wires:JSON.stringify(graph.stages)===JSON.stringify(formatBefore.stages),native:!!past[0].nativeApplied,token:formatCalls.find(c=>c.endpoint==='source-edit').body.expected})),{type:'float[8]',wires:true,native:false,token:'format-token'});
  await page.evaluate(()=>undo());
  assert.equal(await page.evaluate(()=>historyGraphKey(graph)===historyGraphKey(formatBefore)),true);
  await page.evaluate(()=>undo(true));
  assert.equal(await page.evaluate(()=>graph.declarations.some(d=>d.type==='float[8]')),true);
  assert.equal(await page.evaluate(()=>formatCalls.some(c=>c.endpoint==='history-restore')),false);
  checks.push('format adoption uses product confirmation, preserves wires, and local Undo/Redo makes no native writes');
  await page.screenshot({path:path.join(folder,'texture-buffer.png')});
  assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,count:checks.length}));
 }catch(e){await h.finish(e);throw e;}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
