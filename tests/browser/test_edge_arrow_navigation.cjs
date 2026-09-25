/* Selected connections navigate by their actual endpoints, independently of node navigation preferences. */
const assert=require('node:assert/strict');
const {harness}=require('./test_glsl_code.cjs');
(async()=>{
 const[source,state,folder]=process.argv.slice(2),h=await harness(source,state,folder,{skipPreview:true}),{page,checks,errors}=h;
 try{
  await page.evaluate(()=>{
   nativeSourcePolling=uniformPolling=customPolling=true;uniformLive.disconnect();uniformLive.connect=()=>{};clearTimeout(autoTimer);scheduleGraphApply=()=>{};
   graph.functions=[];graph.declarations=[];stage='pixel';graphTrail=[];readonly=true;dirty=false;past=[];future=[];
   graph.stages.pixel={nodes:[testNode('src','scalar',900,30),testNode('dst','add',0,300),testNode('other','add',450,600)],edges:[{from:['src','out'],to:['dst','a']},{from:['src','out'],to:['other','a'],ui:{style:'link'}}]};
   setUIExperiments({arrowNavigationMode:'spatial',arrowNavigationView:'none',frameWireEndpoint:false,frameDamping:false,canvasDamping:false});render();
   window.edgeSnapshot=JSON.stringify({graph,past,future,dirty});
   window.chooseEdge=(index)=>{stopCanvasMotion();pan={x:100,y:100};scale=.4;transform();selectCanvasEdge(current().edges[index]);};
   window.expectedFrame=ids=>{const saved={...pan,scale};fitNodes(current().nodes.filter(n=>ids.includes(n.id)));const result={...pan,scale};pan={x:saved.x,y:saved.y};scale=saved.scale;transform();return result;};
  });
  for(const index of [0,1])for(const [key,side]of [['ArrowLeft','from'],['ArrowRight','to']]){
   const expected=await page.evaluate(({index,side})=>{chooseEdge(index);const id=current().edges[index][side][0];return{id,view:expectedFrame([id])};},{index,side});
   await page.keyboard.press(key);
   assert.deepEqual(await page.evaluate(()=>({selection:[...selection],selected,edge:selectedEdge,view:{...pan,scale}})),{selection:[expected.id],selected:expected.id,edge:null,view:expected.view});
   assert.equal(await page.evaluate(()=>JSON.stringify({graph,past,future,dirty})===edgeSnapshot),true);
  }
  checks.push('Wire and Link Left/Right select and Frame their true endpoints even when spatial position is reversed, readonly and navigation/context-menu framing preferences are off');
  const multi=await page.evaluate(()=>{chooseEdge(0);selectCanvasEdge(current().edges[1],true);return expectedFrame(['dst','other']);});
  await page.keyboard.press('ArrowRight');assert.deepEqual(await page.evaluate(()=>[...selection]),['dst','other']);assert.deepEqual(await page.evaluate(()=>({...pan,scale})),multi);
  await page.evaluate(()=>{chooseEdge(0);selectCanvasEdge(current().edges[1],true);});await page.keyboard.press('ArrowLeft');assert.deepEqual(await page.evaluate(()=>[...selection]),['src']);
  checks.push('Multiple selected connections Frame unique endpoints together');
  await page.evaluate(()=>chooseEdge(0));await page.locator('#search').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.evaluate(()=>selectedEdge),0);
  await page.evaluate(()=>focusGraphCanvas());await page.locator('#uishortcuts').click();await page.keyboard.press('ArrowLeft');assert.equal(await page.evaluate(()=>selectedEdge),0);await page.keyboard.press('Escape');
  await page.evaluate(()=>focusGraphCanvas());for(const key of ['Shift+ArrowRight','Alt+ArrowRight','ArrowUp','ArrowDown']){await page.keyboard.press(key);assert.equal(await page.evaluate(()=>selectedEdge),0);}
  checks.push('Text fields, dialogs, modified keys and vertical arrows do not trigger endpoint navigation');
  const animated=await page.evaluate(()=>{setUIExperiments({frameDamping:true,frameDampingMs:450});chooseEdge(1);return expectedFrame(['other']);});
  await page.keyboard.press('ArrowRight');assert.deepEqual(await page.evaluate(()=>{const result={setting:canvasMotion?.setting,duration:canvasMotion?.duration,to:canvasMotion?.to};stopCanvasMotion();return result;}),{setting:'frameDamping',duration:450,to:animated});
  checks.push('Endpoint framing uses the existing Frame animation');
  await page.evaluate(()=>{chooseEdge(0);graph=clone(graph);});await page.keyboard.press('ArrowRight');assert.deepEqual(await page.evaluate(()=>[...selection]),[]);assert.equal(await page.evaluate(()=>selectedEdge),null);
  checks.push('Replacing the document invalidates the previous selected connection');
  assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,checks}));
 }catch(e){await h.finish(e);throw e;}
})().catch(e=>{console.error(e);process.exitCode=1;});
