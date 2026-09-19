/* Blank canvas gestures must not rebuild the graph or contact TD.
 * node test_canvas_selection.cjs SOURCE_DIR STATE_JSON REPORT_DIR */
const assert=require('node:assert/strict');
const {harness}=require('./test_glsl_code.cjs');
(async()=>{
  const [source,stateFile,folder]=process.argv.slice(2),h=await harness(source,stateFile,folder,{skipPreview:true,touch:true});
  const {page,checks,errors,settle}=h;
  const reset=async(ids=[],edge=null)=>{
    await page.evaluate(({ids,edge})=>{
      closeCreator();cancelConnection();selection=new Set(ids);selected=ids.at(-1)||null;selectedEdge=edge;
      stage='pixel';graphTrail=[];graph.functions=[];graph.declarations=[];
      graph.stages.pixel={nodes:[testNode('a','scalar',30,180,{type:'float',value:1}),testNode('b','add',330,180,{type:'float'})],edges:[{from:['a','out'],to:['b','a']}]};
      GraphFrames.write(current(),[{id:'frame',name:'Test',nodes:['a','b'],color:'#777777'}]);
      past=[];future=[];readonly=false;historyBusy=false;nativeMutationBusy=false;boxSelectMode=false;dirty=false;
      setUIExperiments({selectionToolbar:'all',persistentSelectionBounds:true});render();scale=.6;pan={x:20,y:30};transform();
    },{ids,edge});await settle();
    await page.evaluate(()=>{
      window.beforeState=JSON.stringify({graph,past,future,dirty});
      window.beforeNodes=[...$('#cards').children];window.beforeWires=[...$('#wires').children];window.beforeFrames=[...$('#groupframes').children];
      window.heavyCalls=[];window.savedCalls={render,renderCards,wires,library,renderNativeSources};
      for(const [key,fn] of Object.entries(savedCalls))window[key]=function(...args){heavyCalls.push(key);return fn(...args);};
    });
  };
  const restore=()=>page.evaluate(()=>{for(const [key,fn] of Object.entries(savedCalls))window[key]=fn;});
  const blank=async()=>{const r=await page.locator('#canvas').boundingBox();return{x:r.x+r.width*.8,y:r.y+130};};
  const assertIntact=async()=>{
    const result=await page.evaluate(()=>({
      sameState:beforeState===JSON.stringify({graph,past,future,dirty}),calls:heavyCalls,
      nodes:beforeNodes.every((n,i)=>n===$('#cards').children[i]),wires:beforeWires.every((n,i)=>n===$('#wires').children[i]),frames:beforeFrames.every((n,i)=>n===$('#groupframes').children[i])
    }));assert.deepEqual(result,{sameState:true,calls:[],nodes:true,wires:true,frames:true});
  };
  let requests=[];page.on('request',r=>{if(r.url().includes('/api/'))requests.push(r.url());});
  try{
    for(const ids of [[],['a'],['a','b']]){
      await reset(ids);requests=[];const p=await blank();
      await page.mouse.click(p.x,p.y);await settle();await assertIntact();
      assert.deepEqual(await page.evaluate(()=>({selected,selectedEdge,selection:[...selection]})),{selected:null,selectedEdge:null,selection:[]});
      assert.equal(await page.locator('#cards .selected,#groupframes .selected,#wires .selected').count(),0);
      assert.equal(await page.locator('#graphcopy').isDisabled(),true);assert.equal(await page.locator('#selectiontoolbar').isVisible(),false);
      assert.equal(await page.locator('#selectionbounds').isVisible(),false);assert.deepEqual(requests,[]);await restore();
    }
    checks.push('blank click is a no-op without selection; single/multi/group selection clears without graph DOM rebuild, history or requests');
    await reset([],0);const p=await blank();assert.equal(await page.locator('#wires path.selected').count(),1);
    await page.mouse.click(p.x,p.y);await settle();await assertIntact();assert.equal(await page.locator('#wires path.selected').count(),0);await restore();
    checks.push('deselecting a wire removes its highlight while preserving the path and node DOM');
    await reset(['a']);const start=await blank(),oldPan=await page.evaluate(()=>({...pan}));
    await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(start.x+35,start.y+20,{steps:3});await page.mouse.up();await settle();await assertIntact();
    assert.deepEqual(await page.evaluate(()=>[...selection]),['a']);assert.notDeepEqual(await page.evaluate(()=>pan),oldPan);await restore();
    checks.push('panning retains selection and does not rebuild nodes or wires');
    await reset();
    const cards=await page.locator('#cards').evaluate(e=>[...e.children].map(n=>{const r=n.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom};}));
    await page.keyboard.down('Shift');await page.mouse.move(cards[0].x-5,cards[0].y-5);await page.mouse.down();
    await page.mouse.move(cards[1].right+5,Math.max(...cards.map(r=>r.bottom))+5,{steps:5});await page.mouse.up();await page.keyboard.up('Shift');await settle();
    await assertIntact();assert.deepEqual(await page.evaluate(()=>[...selection]),['a','b']);assert.equal(await page.locator('#groupframes .selected').count(),1);
    assert.equal(await page.locator('#graphcopy').isEnabled(),true);assert.equal(await page.locator('#selectiontoolbar').isVisible(),true);await restore();
    checks.push('marquee release updates node/group highlights and selection controls without rebuilding the graph');
    await reset(['a','b']);const tap=await blank();await page.touchscreen.tap(tap.x,tap.y);await settle();await assertIntact();
    assert.equal(await page.locator('#cards .selected,#groupframes .selected').count(),0);await restore();
    await page.touchscreen.tap(tap.x,tap.y);await settle();assert.equal(await page.locator('#creator').isVisible(),true);
    checks.push('touch blank tap clears selection and double tap still opens the creator');
    await reset();await page.evaluate(()=>{linkStart={node:'a',kind:'outputs',port:'out',type:'float'};});
    const wireDrop=await blank();await page.mouse.click(wireDrop.x,wireDrop.y);await settle();
    assert.equal(await page.locator('#creator').isVisible(),true);await restore();
    checks.push('blank click with an active wire still opens compatible node creation');
    await reset(['a']);await restore();
    const field=page.locator('[data-inline-node="a"][data-inline-port="$value"]');await field.fill('7');
    const commit=await blank();await page.mouse.click(commit.x,commit.y);await settle();
    assert.equal(await page.evaluate(()=>current().nodes.find(n=>n.id==='a').params.value),7);
    assert.equal(await page.evaluate(()=>past.length),1);
    checks.push('clicking the canvas still commits a focused numeric edit as one Undo step');
    assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,count:checks.length}));
  }catch(error){await h.finish(error);throw error;}
})().catch(error=>{console.error(error);process.exitCode=1;});
