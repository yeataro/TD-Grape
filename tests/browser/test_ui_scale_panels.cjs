/* Isolated coordinate checks for root UI zoom; never connects to TouchDesigner.
 * node test_ui_scale_panels.cjs SOURCE_DIR STATE_JSON REPORT_DIR
 */
const assert=require('node:assert/strict');
const path=require('node:path');
const {harness}=require('./test_glsl_code.cjs');
const [source,stateFile,folder]=process.argv.slice(2);
(async()=>{
  const h=await harness(source,stateFile,folder,{touch:true}),{page,checks,errors,settle}=h;
  page.setDefaultTimeout(6000);
  const close=(actual,expected,label)=>assert.ok(Math.abs(actual-expected)<1.5,`${label}: ${actual} != ${expected}`);
  const box=selector=>page.locator(selector).boundingBox();
  const center=async selector=>{const r=await box(selector);assert.ok(r,selector);return{x:r.x+r.width/2,y:r.y+r.height/2};};
  const drag=async(selector,dx,dy)=>{const p=await center(selector);await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(p.x+dx,p.y+dy,{steps:6});await page.mouse.up();await settle();};
  const state=()=>page.evaluate(()=>JSON.stringify({graph,past,future,pan,scale,dirty}));
  const reset=async percent=>{
    await page.evaluate(percent=>{
      cancelValueLadder();document.activeElement?.blur();clearTimeout(autoTimer);connectionInterrupted=true;
      readonly=false;historyBusy=false;nativeMutationBusy=false;graphTrail=[];graph.functions=[];graph.declarations=[];stage='pixel';selected=null;selection.clear();past=[];future=[];
      graph.stages.pixel={nodes:[testNode('scale_value','float',45,100,{value:.3})],edges:[]};dirty=false;rememberSavedGraph(graph);
      workspaceLayout.apply({version:1,left:[{panels:['browser','uniforms'],active:'browser',weight:1}],right:[{panels:['parameters','controls'],active:'parameters',weight:5},{panels:['live'],active:'live',weight:3},{panels:['help'],active:'help',weight:2}],widths:{left:220,right:340},visibility:{left:true,right:true}});
      setUIAppearance('size','standard');setUIAppearance('scale',percent);render();scale=1;pan={x:30,y:40};transform();
    },percent);await settle();
  };
  try{
    await page.selectOption('#language','en');
    for(const percent of [75,125]){
      await reset(percent);
      const z=percent/100,before=await state();
      let left=await box('#sidebar-left'),right=await box('#parameter-sidebar');
      await drag('#libraryresize',60,0);close((await box('#sidebar-left')).width,left.width+60,'left sidebar screen movement');
      await drag('#detailsresize',-60,0);close((await box('#parameter-sidebar')).width,right.width+60,'right sidebar screen movement');
      let upper=await box('#parameter-sidebar .workspace-group:first-of-type');
      await drag('#parameter-sidebar .panel-divider:first-of-type',0,35);
      close((await box('#parameter-sidebar .workspace-group:first-of-type')).height,upper.height+35,'panel divider screen movement');
      assert.equal(await state(),before);
      checks.push(`${percent}% sidebar widths and adjacent panel heights follow viewport pointer deltas without graph/history/view edits`);

      await page.locator('#search').fill('Add');await page.locator('[data-entry="add"]').first().click();await settle();
      const detailBefore=await box('#browserdetail');await drag('#browserdetailresize',0,-30);
      close((await box('#browserdetail')).height,detailBefore.height+30,'browser detail screen movement');
      const host=await box('#browserbody'),detail=await box('#browserdetail');
      assert.ok(detail.y>=host.y&&detail.y+detail.height<=host.y+host.height+1.5);
      checks.push(`${percent}% browser description resize uses CSS units and stays inside its panel`);

      await page.locator('#workspacelayout').click();await settle();
      const button=await box('#workspacelayout'),menu=await box('#layoutmenu');
      close(menu.x+menu.width,button.x+button.width,'Layout right anchor');close(menu.y,button.y+button.height+5,'Layout top anchor');
      assert.ok(menu.x>=7&&menu.y>=7&&menu.x+menu.width<=1601&&menu.y+menu.height<=1101);
      await page.keyboard.press('Escape');assert.equal(await state(),before);
      checks.push(`${percent}% Layout menu anchors to its button within the viewport`);

      const p=await center('[data-inline-node="scale_value"]');await page.mouse.move(p.x,p.y);await page.mouse.down({button:'middle'});await page.locator('#valueladder').waitFor();
      const ladder=await box('#valueladder'),field=await box('[data-inline-node="scale_value"]');
      close(ladder.x,Math.max(8,field.x-ladder.width-10),'Ladder left anchor');
      const rung=await box('[data-step="0.1"]');close(rung.y+rung.height/2,p.y,'Ladder initial rung centered on pointer');
      assert.ok(ladder.y>=7&&ladder.y+ladder.height<=1101);
      await page.mouse.move(p.x,rung.y+rung.height/2);await page.mouse.move(p.x+16,rung.y+rung.height/2);
      assert.equal(Number(await page.locator('[data-inline-node="scale_value"]').inputValue()),.5);
      await page.keyboard.press('Escape');await page.mouse.up({button:'middle'});assert.equal(await state(),before);
      checks.push(`${percent}% Value Ladder placement/rung hit testing match pointer coordinates and cancel preserves the graph`);

      const tab=await center('#livetoggle'),target=await box('#sidebar-left .workspace-group');
      const drop={x:target.x+target.width/2,y:target.y+target.height*.85};
      await page.locator('#canvas').focus();await settle();await page.mouse.move(tab.x,tab.y);await page.mouse.down();await page.mouse.move(drop.x,drop.y,{steps:6});await settle();
      let ghost=await box('.workspace-drag-label'),mark=await box('.workspace-drop-mark');
      close(ghost.x,drop.x+14,'dock ghost x');close(ghost.y,drop.y+10,'dock ghost y');
      close(mark.x,target.x+2,'dock mark x');close(mark.width,target.width-4,'dock mark width');close(mark.y+mark.height,target.y+target.height-2,'dock mark bottom');
      await page.mouse.up();await settle();assert.equal(await page.locator('#sidebar-left #pane-live').count(),1);assert.equal(await state(),before);
      // Also cover insertion into a tab strip, whose mark uses a different geometry branch.
      const help=await center('#helptoggle'),bar=await box('#sidebar-left .workspace-group:first-of-type .workspace-tabs');
      const tabDrop={x:bar.x+bar.width*.4,y:bar.y+bar.height/2};
      await page.mouse.move(help.x,help.y);await page.mouse.down();await page.mouse.move(tabDrop.x,tabDrop.y,{steps:6});await settle();
      mark=await box('.workspace-drop-mark');assert.equal(await page.locator('.workspace-drop-mark').getAttribute('data-mode'),'insert');close(mark.y,bar.y+3,'tab mark top');close(mark.height,bar.height-6,'tab mark height');close(mark.width,3,'tab mark width');
      await page.keyboard.press('Escape');await page.mouse.up();assert.equal(await state(),before);
      checks.push(`${percent}% docking ghosts, group drop marks and tab insertion marks align; moving panels leaves graph/history/view unchanged`);

      await page.locator('[data-workspace-panel="uniforms"]').click();await settle();
      await page.locator('[data-builtin-reference="uv"]').scrollIntoViewIfNeeded();await settle();
      const input=await center('[data-builtin-reference="uv"]'),canvas=await box('#canvas'),nodeDrop={x:canvas.x+canvas.width*.65,y:canvas.y+canvas.height*.45};
      const expected=await page.evaluate(p=>{const a=graphPoint(p.x,p.y);return{x:snap(a.x),y:snap(a.y)};},nodeDrop),history=await page.evaluate(()=>past.length);
      await page.mouse.move(input.x,input.y);await page.mouse.down();await page.mouse.move(nodeDrop.x,nodeDrop.y,{steps:6});await settle();
      ghost=await box('.input-drag-preview');close(ghost.x,nodeDrop.x+12,'input ghost x');close(ghost.y,nodeDrop.y+12,'input ghost y');
      await page.mouse.up();await settle();
      const dropped=await page.evaluate(()=>({node:current().nodes.find(n=>definition(n)?.key==='uv'),history:past.length}));
      assert.ok(dropped.node);close(dropped.node.ui.x,expected.x,'input node graph x');close(dropped.node.ui.y,expected.y,'input node graph y');assert.equal(dropped.history,history+1);
      await page.locator('#undo').click();await settle();assert.equal(await page.evaluate(()=>current().nodes.some(n=>definition(n)?.key==='uv')),false);
      checks.push(`${percent}% Inputs ghost follows screen pointer and dropping creates the reference at the correct graph position as one Undo step`);

      // Touch numeric swipes pan by screen pixels instead of being multiplied by root zoom.
      const touchField=await center('[data-inline-node="scale_value"]'),oldPan=await page.evaluate(()=>({...pan}));
      const cdp=await page.context().newCDPSession(page);
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:touchField.x,y:touchField.y}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x:touchField.x+36,y:touchField.y+24}]});
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();await settle();
      const newPan=await page.evaluate(()=>({...pan}));close(newPan.x,oldPan.x+36/z,'touch pan x CSS units');close(newPan.y,oldPan.y+24/z,'touch pan y CSS units');
      assert.equal(await page.evaluate(()=>current().nodes.find(n=>n.id==='scale_value').params.value),.3);
      checks.push(`${percent}% touch swipe from a numeric field pans at pointer speed without changing the value`);
      await page.screenshot({path:path.join(folder,`scale-${percent}.png`)});
    }
    await reset(100);await drag('#libraryresize',80,0);await drag('#detailsresize',-80,0);
    const prefs=()=>page.evaluate(()=>Object.fromEntries(['sgrapeSidebarWidths','grapeWorkspaceV1','grapeWorkspaceSizes-left','grapeWorkspaceSizes-right','grapeBrowserDetailHeight'].map(key=>[key,localStorage.getItem(key)])));
    const preferred=await prefs(),widths={left:(await box('#sidebar-left')).width,right:(await box('#parameter-sidebar')).width};
    await page.setViewportSize({width:960,height:850});await page.evaluate(()=>setUIAppearance('scale',125));await settle();assert.deepEqual(await prefs(),preferred);
    await page.evaluate(()=>setUIAppearance('scale',75));await page.setViewportSize({width:1600,height:1100});await page.evaluate(()=>setUIAppearance('scale',100));await settle();
    assert.deepEqual(await prefs(),preferred);close((await box('#sidebar-left')).width,widths.left,'restored preferred left width');close((await box('#parameter-sidebar')).width,widths.right,'restored preferred right width');
    checks.push('zoom and viewport clamping preserve stored workspace/width/detail preferences and restore the preferred widths when space returns');
    assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,count:checks.length}));
  }catch(error){await h.finish(error);throw error;}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
