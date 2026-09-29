/* Preview inspector is view state; native value edits never change the graph. */
const assert=require('node:assert/strict');
const {harness}=require('./test_glsl_code.cjs');
(async()=>{
 const [source,state,folder]=process.argv.slice(2),h=await harness(source,state,folder,{skipPreview:true}),{page,checks,errors}=h;
 try{
  await page.evaluate(()=>{
   nativeSourcePolling=uniformPolling=customPolling=true;uniformLive.disconnect();uniformLive.connect=()=>{};scheduleGraphApply=()=>{};
   readonly=connectionInterrupted=dirty=false;
   const component=(name,value,writable=true)=>({name,value,writable,mode:writable?'CONSTANT':'EXPRESSION',min:null,max:null});
   const row=(name,label,style,value,writable=true)=>({name,label,style,components:[component(name,value,writable)],menuNames:[],menuLabels:[]});
   window.viewerFixture={viewer:'/remote_panel/mat_viewer',viewerId:41,revision:7,label:'MAT Viewer',controls:[
    row('Selectmat','Select MAT','MAT','/material',false),
    {...row('Geo','Geo','Menu','tours'),menuNames:['tours','sphere'],menuLabels:['Torus','Sphere']},
    {...row('Dimmer','Dimmer','Float',1),section:true},{...row('Home','Home All','Pulse',false),section:true},
   ]};
   window.viewerWrites=[];const panel=$('#preview');panel.state='connected';panel.revision=7;panel.viewerParameters=true;
   panel.requestViewerParameters=async edit=>{
    if(edit){viewerWrites.push(clone(edit));if(edit.revision!==viewerFixture.revision)throw Error('Source changed');const item=viewerFixture.controls.find(r=>r.name===edit.name).components[edit.component];if(edit.name!=='Home')item.value=edit.value;}
    return clone(viewerFixture);
   };
   window.graphBeforeViewer=JSON.stringify({graph,past,future,dirty,selected,selection:[...selection]});
   panel.dispatchEvent(new CustomEvent('panel-focus',{detail:{focused:true}}));
  });
  await page.locator('[data-viewer-control=Dimmer]:enabled').waitFor();
  assert.equal(await page.locator('[data-viewer-control=Selectmat]').isDisabled(),true);
  assert.match(await page.locator('#inspector>.input-inspector-title').innerText(),/MAT Viewer/);
  await page.locator('[data-viewer-control=Geo]').selectOption('sphere');
  const dimmer=page.locator('[data-viewer-control=Dimmer]');await dimmer.fill('0.4');await dimmer.press('Enter');
  await page.waitForFunction(()=>viewerFixture.controls.find(r=>r.name==='Dimmer').components[0].value===.4);
  await page.locator('[data-viewer-control=Home]').click();
  assert.deepEqual(await page.evaluate(()=>viewerWrites.map(w=>[w.name,w.value])),[['Geo','sphere'],['Dimmer',.4],['Home',true]]);
  assert.equal(await page.evaluate(()=>JSON.stringify({graph,past,future,dirty,selected,selection:[...selection]})===graphBeforeViewer),true);
  checks.push('Preview focus shows custom Viewer controls; edits and Home leave graph, history and selection unchanged');
  await dimmer.fill('0.37');
  await page.evaluate(async()=>{viewerFixture.controls.find(r=>r.name==='Dimmer').components[0].value=.6;await refreshViewerParameters();inspector();});
  assert.equal(await dimmer.inputValue(),'0.37');
  await page.locator('[data-viewer-control=Home]').focus();
  await page.evaluate(()=>refreshViewerParameters());
  checks.push('Polling keeps an unfinished field and its original expected value');
  await page.evaluate(()=>{workspaceLayout.setFloatingParameter(true);inspector();});
  assert.equal(await page.locator('#floatingparameters [data-viewer-control=Geo]').count(),1);
  assert.equal(await page.locator('#inspector .parameter-input-port').count(),0);
  checks.push('Floating inspector uses the same controls without graph sockets');
  for(const width of [1500,430]){
   await page.setViewportSize({width,height:950});
   const columns=await page.locator('#inspector .viewer-parameter-row>.parameter-control').evaluateAll(items=>items.map(e=>e.getBoundingClientRect().left));
   assert.ok(Math.max(...columns)-Math.min(...columns)<1);
   assert.equal(await page.locator('#inspector').evaluate(e=>e.scrollWidth<=e.clientWidth+1),true);
  }
  await page.screenshot({path:require('node:path').join(folder,'viewer-inspector.png')});
  checks.push('Viewer fields share aligned columns and fit a narrow floating pane');
  await page.evaluate(()=>{selectNode(current().nodes[0]);inspector();});
  assert.equal(await page.locator('[data-viewer-control]').count(),0);
  await page.evaluate(()=>$('#preview').dispatchEvent(new CustomEvent('panel-focus',{detail:{focused:true}})));
  await page.locator('[data-viewer-control=Dimmer]:enabled').waitFor();
  await page.evaluate(()=>{
   viewerFixture={viewer:'/remote_panel/top_viewer',viewerId:42,revision:8,label:'TOP Viewer',controls:[{name:'Outline',label:'Outline',style:'Toggle',menuNames:[],menuLabels:[],components:[{name:'Outline',value:true,mode:'CONSTANT',writable:true,min:null,max:null}]}]};
   $('#preview').revision=8;$('#preview').dispatchEvent(new CustomEvent('panel-source',{detail:{source:'/image'}}));
  });
  const outline=page.locator('[data-viewer-control=Outline]');await outline.waitFor();await outline.uncheck();
  assert.equal(await page.locator('[data-viewer-control=Dimmer]').count(),0);
  await page.evaluate(()=>{const p=$('#preview');p.state='replaced';p.dispatchEvent(new CustomEvent('panel-state',{detail:{state:'replaced'}}));});
  assert.equal(await outline.isDisabled(),true);
  checks.push('Selecting a node restores its inspector; source changes replace controls and lost ownership disables writes');
  assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,checks}));
 }catch(error){await h.finish(error);throw error;}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
