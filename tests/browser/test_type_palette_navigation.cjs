/* Type paint and Parameter source navigation, through the real editor DOM. */
const assert=require('node:assert/strict');
const {harness}=require('./test_glsl_code.cjs');
(async()=>{
 const[source,state,folder]=process.argv.slice(2),h=await harness(source,state,folder,{skipPreview:true}),{page,checks,errors,settle}=h;
 page.setDefaultTimeout(6000);
 const snapshot=()=>page.evaluate(()=>JSON.stringify({graph,past,future,dirty}));
 try{
  await page.selectOption('#language','en');
  await page.evaluate(()=>{
   nativeSourcePolling=uniformPolling=customPolling=true;uniformLive.disconnect();uniformLive.connect=()=>{};
   clearTimeout(autoTimer);scheduleGraphApply=()=>{};connectionInterrupted=true;readonly=historyBusy=nativeMutationBusy=false;
   graphTrail=[];graph.functions=[];graph.declarations=[];graph.target=editorTarget='mat';stage='pixel';inspectorTab='parameters';
   graph.typeDefinitions=[{id:'sample',name:'Sample',provider:'generated',fields:[{id:'weight',name:'weight',type:'float'}]}];
   window.paletteCases=[['double','scalar'],['ivec2','vec2'],['vec3[4]','vec3'],['dmat2x3','matrix'],['mat4[2]','matrix'],['TDMatrix','struct'],['struct:sample','struct'],['struct:sample[3]','struct'],['samplerCube','sampler']];
   const nodes=[],edges=[];
   paletteCases.forEach(([type],i)=>{
    nodes.push(testNode('src'+i,'glsl_code',50,i*260,{inputs:[],outputs:[{id:'out',name:'out',type}]}),testNode('dst'+i,'glsl_code',470,i*260,{inputs:[{id:'value',name:'value',type}],outputs:[]}));
    edges.push({from:['src'+i,'out'],to:['dst'+i,'value']});
   });
   graph.stages.pixel={nodes,edges};past=[];future=[];dirty=false;selected=null;selection.clear();
   setUIExperiments({frameDamping:false,canvasDamping:false,frameWireEndpoint:false});render();
  });await settle();
  for(const theme of ['dark','light']){
   const result=await page.evaluate(theme=>{
    document.documentElement.dataset.uiTheme=theme;
    return paletteCases.map(([type,kind],i)=>{
     const output=document.querySelector(`[data-node="src${i}"] .port-row.output`),input=document.querySelector(`[data-node="dst${i}"] .port-row.input`),wire=document.querySelector(`#wires path[data-from="src${i}:out"]`),s=getComputedStyle(wire);
     const id=wire.style.getPropertyValue('--type-paint').match(/#([^\)]+)/)?.[1],gradient=id&&document.getElementById(id);
     return {type,kind,actual:[output.dataset.typeColor,input.dataset.typeColor,wire.dataset.typeColor],stroke:s.stroke,fill:getComputedStyle(output.querySelector('.port')).backgroundColor,border:getComputedStyle(input.querySelector('.port')).borderColor,text:getComputedStyle(input.querySelector('small')).color,textBackground:getComputedStyle(input.querySelector('small')).backgroundImage,gradient:gradient?{units:gradient.getAttribute('gradientUnits'),stops:gradient.children.length}:null,socketImage:getComputedStyle(input.querySelector('.port')).backgroundImage};
    });
   },theme);
   const ordinaryInputFill=await page.locator('[data-node="dst3"] .port-row.input .port').evaluate(e=>getComputedStyle(e).backgroundColor);
   for(const r of result){
    assert.deepEqual(r.actual,[r.kind,r.kind,r.kind],JSON.stringify(r));
    if(r.kind==='struct'){assert.deepEqual(r.gradient,{units:'userSpaceOnUse',stops:4});assert.ok(r.socketImage.startsWith(`linear-gradient(${ordinaryInputFill}, ${ordinaryInputFill})`),r.socketImage);assert.equal(r.textBackground,'none');assert.notEqual(r.text,'rgba(0, 0, 0, 0)');}
    else {assert.equal(r.stroke,r.fill,JSON.stringify(r));assert.equal(r.stroke,r.border,JSON.stringify(r));assert.equal(r.stroke,r.text,JSON.stringify(r));}
    if(r.kind==='matrix')assert.equal(r.stroke,theme==='dark'?'rgb(161, 173, 183)':'rgb(93, 107, 120)');
   }
  }
  checks.push('Both themes share wire/socket/type-text colors for double, integer vectors, arrays, rectangular matrices and resources; built-in/custom structs use gradient paint and plain text');
  await page.evaluate(()=>{
   const e=current().edges[5];selectCanvasEdge(e);
  });
  assert.ok(!(await page.locator('#wires path[data-from="src5:out"]').evaluate(e=>getComputedStyle(e).stroke)).startsWith('url('));
  const active=await page.evaluate(()=>{const p=document.querySelector('#wires path[data-from="src5:out"]');p.classList.add('wire-hover');return getComputedStyle(p).stroke;});assert.ok(!active.startsWith('url('));
  checks.push('Selection and hover override struct gradient paint');
  await page.evaluate(()=>{current().edges[5].ui={style:'link'};setUIExperiments({linkArrowDisplay:'always'});selected=null;selectedEdge=null;selection.clear();setSelectedEdges([]);render();});
  const link=await page.locator('[data-node="src5"] .link-port-arrow').evaluate(e=>({kind:e.dataset.typeColor,gradient:e.querySelectorAll('linearGradient stop').length,stroke:e.style.stroke}));
  assert.equal(link.kind,'struct');assert.equal(link.gradient,4);assert.match(link.stroke,/url\(/);
  checks.push('Struct Link arrows use the same gradient; Link lines retain their existing line style');
  await page.evaluate(()=>{wireDrag={node:'dst6',port:'value',kind:'inputs',type:'struct:sample',q:{x:50,y:200},ready:false,panelProxy:true};wires();});
  const preview=await page.locator('.parameter-wire-preview').evaluate(e=>({gradients:e.querySelectorAll('defs linearGradient').length,stroke:getComputedStyle(e.querySelector('path')).stroke}));
  assert.equal(preview.gradients,1);assert.match(preview.stroke,/url\(/);await page.evaluate(()=>{wireDrag=null;wires();});
  checks.push('Reverse struct wire previews carry their own gradient into the floating Parameter overlay');
  await page.evaluate(()=>{
   graph.stages.pixel={nodes:[testNode('source','scalar',900,30),testNode('target','add',20,300),testNode('matrix','matrix_combine',450,600,{type:'mat3'})],edges:[{from:['source','out'],to:['target','a']},{from:['source','out'],to:['matrix','c0x'],ui:{style:'link'}}]};
   readonly=true;past=[];future=[];dirty=false;render();
   window.pick=(id)=>{stopCanvasMotion();pan={x:100,y:100};scale=.4;selected=id;selection=new Set([id]);selectedEdge=null;inspectorTab='parameters';render();};
   window.expectedSourceFrame=()=>{const saved={...pan,scale};fitNodes([current().nodes.find(n=>n.id==='source')]);const result={...pan,scale};pan={x:saved.x,y:saved.y};scale=saved.scale;transform();return result;};
  });
  for(const floating of [false,true])for(const id of ['target','matrix']){
   const expected=await page.evaluate(({floating,id})=>{workspaceLayout.setFloatingParameter(floating);pick(id);return expectedSourceFrame();},{floating,id});await settle();const before=await snapshot();
   const origin=page.locator('#inspector button.connection-source');assert.equal(await origin.isDisabled(),false);
   assert.equal(await page.locator('#inspector .connection-row button:not(.connection-source)').isDisabled(),true);
   if(id==='target')await origin.click();else{await origin.focus();await page.keyboard.press('Enter');}
   assert.deepEqual(await page.evaluate(()=>({selected,selection:[...selection],edge:selectedEdge,view:{...pan,scale}})),{selected:'source',selection:['source'],edge:null,view:expected});assert.equal(await snapshot(),before);
  }
  checks.push('Click and keyboard navigation select/Frame the source for ordinary and matrix-component inputs, docked/floating and readonly, without graph/history changes');
  await page.evaluate(()=>{pick('target');window.staleSource=$('#inspector button.connection-source');graph=clone(graph);staleSource.click();});assert.equal(await page.evaluate(()=>selected),'target');
  await page.evaluate(()=>{render();pick('target');window.staleSource=$('#inspector button.connection-source');current().edges=[];staleSource.click();});assert.equal(await page.evaluate(()=>selected),'target');
  checks.push('Stale document/connection buttons do not navigate');
  await page.evaluate(()=>{readonly=false;current().edges=[{from:['source','out'],to:['target','a']}];pick('target');});
  await page.locator('#inspector .connection-row button:not(.connection-source)').click();assert.equal(await page.evaluate(()=>current().edges.length),0);await page.locator('#undo').click();assert.equal(await page.evaluate(()=>current().edges.length),1);
  checks.push('Disconnect remains an independent undoable action');
  assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,checks}));
 }catch(e){await h.finish(e);throw e;}
})().catch(e=>{console.error(e);process.exitCode=1;});
