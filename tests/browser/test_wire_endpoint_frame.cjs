const assert=require('node:assert/strict');
const {harness}=require('./test_glsl_code.cjs');
(async()=>{
 const [source,state,folder]=process.argv.slice(2),h=await harness(source,state,folder,{skipPreview:true}),{page,checks,errors}=h;
 try{
  await page.evaluate(()=>{nativeSourcePolling=uniformPolling=customPolling=true;uniformLive.disconnect();uniformLive.connect=()=>{};clearTimeout(autoTimer);scheduleGraphApply=()=>{};readonly=false;connectionInterrupted=false;graph.declarations=[];graph.functions=[];stage='pixel';graphTrail=[];
   graph.stages.pixel={nodes:[testNode('a','scalar',-800,100),testNode('b','add',1800,500)],edges:[{from:['a','out'],to:['b','a']}]};past=[];future=[];dirty=false;render();});
  assert.equal(await page.evaluate(()=>EDITOR_DEV_SETTINGS.frameWireEndpoint),false);
  await page.locator('#uiexperiments').click();const toggle=page.locator('[data-experiment=frameWireEndpoint]');assert.equal(await toggle.isChecked(),false);await toggle.check();await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(()=>EDITOR_DEV_SETTINGS.frameWireEndpoint),true);
  checks.push('experiment is visible, defaults off and can be enabled through its checkbox');
  for(const style of ['wire','link'])for(const side of ['Source','Destination'])for(const enabled of [false,true])for(const animated of [false,true]){
   const result=await page.evaluate(({style,side,enabled,animated})=>{
    readonly=true;const edge=current().edges[0];edge.ui=style==='link'?{style:'link'}:{};
    setUIExperiments({frameWireEndpoint:enabled,frameDamping:animated,frameDampingMs:450,canvasDamping:!animated});
    stopCanvasMotion();pan={x:21,y:32};scale=.4;transform();
    const origin={...pan,scale},node=current().nodes.find(n=>n.id===(side==='Source'?'a':'b'));
    fitNodes([node]);const expected={...pan,scale};pan={x:21,y:32};scale=.4;transform();
    const before=JSON.stringify({graph,past,future,dirty});openGraphMenu(450,250,null,{edge});
    document.querySelector('[data-edit=select'+side+']').click();
    const motion=canvasMotion&&{setting:canvasMotion.setting,duration:canvasMotion.duration,to:{...canvasMotion.to}};
    const actual={...pan,scale};stopCanvasMotion();
    return{origin,expected,actual,motion,selected,selection:[...selection],unchanged:before===JSON.stringify({graph,past,future,dirty})};
   },{style,side,enabled,animated});
   assert.equal(result.selected,side==='Source'?'a':'b');assert.deepEqual(result.selection,[result.selected]);assert.equal(result.unchanged,true);
   if(!enabled){assert.equal(result.motion,null);assert.deepEqual(result.actual,result.origin);}
   else if(animated){assert.equal(result.motion.setting,'frameDamping');assert.equal(result.motion.duration,450);assert.deepEqual(result.motion.to,result.expected);}
   else{assert.equal(result.motion,null);assert.deepEqual(result.actual,result.expected);}
  }
  checks.push('16 Wire/Link, source/destination, toggle and animation combinations use ordinary Frame settings in readonly graphs without graph edits');
  await page.evaluate(()=>setUIExperiments({frameWireEndpoint:true}));await page.reload();await page.waitForSelector('.node');assert.equal(await page.evaluate(()=>EDITOR_DEV_SETTINGS.frameWireEndpoint),true);
  await page.locator('#uiexperiments').click();await page.locator('#experimentsreset').click();assert.equal(await toggle.isChecked(),false);assert.equal(await page.evaluate(()=>EDITOR_DEV_SETTINGS.frameWireEndpoint),false);
  checks.push('preference survives reload and experimental reset restores off');
  assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,count:checks.length}));
 }catch(e){await h.finish(e);throw e;}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
