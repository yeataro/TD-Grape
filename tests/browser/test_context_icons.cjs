/* Canvas context actions reuse toolbar icons and preserve keyboard navigation. */
const assert=require('node:assert/strict'),path=require('node:path');
const {harness}=require('./test_glsl_code.cjs');
const[source,stateFile,folder]=process.argv.slice(2);
(async()=>{
  const h=await harness(source,stateFile,folder),{page,checks,errors,settle}=h;page.setDefaultTimeout(6000);
  const open=async()=>{await page.evaluate(()=>{const r=$('#canvas').getBoundingClientRect();openGraphMenu(r.left+260,r.top+180);});await settle();};
  try{
    await page.selectOption('#language','en');await page.evaluate(()=>{
      clearTimeout(autoTimer);connectionInterrupted=true;conflicted=true;readonly=false;historyBusy=false;nativeMutationBusy=false;graphTrail=[];stage='pixel';graph.functions=[];graph.declarations=[];
      const a=testNode('a','float',100,100),b=testNode('b','float',500,100);b.ui.collapsed=true;
      graph.stages.pixel={nodes:[a,b,testNode('output','pixel_out',1000,150)],edges:[]};selection=new Set(['a','b']);selected='a';past=[];future=[];rememberSavedGraph(graph);render();fit();
    });await settle();const before=await page.evaluate(()=>JSON.stringify({graph,past,future,selection:[...selection]}));await open();
    const items=await page.locator('#grapheditmenu [data-edit]').evaluateAll(es=>es.map(e=>({action:e.dataset.edit,icons:e.querySelectorAll('svg').length,hidden:e.querySelector('svg')?.getAttribute('aria-hidden'),label:e.querySelector('.graph-menu-label').textContent,shortcut:e.querySelector(':scope>small').textContent})));
    assert.deepEqual(items.map(i=>i.action),['add','collapse','expand','copy','paste','duplicate','group','delete']);
    for(const item of items){assert.equal(item.icons,1);assert.equal(item.hidden,'true');assert.ok(item.label);}
    assert.equal(items.find(i=>i.action==='copy').shortcut,'Ctrl＋C');assert.ok(!items[0].label.startsWith('＋'));
    for(const [action,id] of Object.entries({copy:'graphcopy',paste:'graphpaste',group:'graphgroup',delete:'graphdelete',collapse:'graphcollapseselection',expand:'graphexpandselection'}))assert.equal(await page.locator(`#grapheditmenu [data-edit="${action}"] svg`).innerHTML(),await page.locator(`#${id} svg`).innerHTML());
    checks.push('All eight canvas context actions display one decorative icon; shared actions exactly reuse toolbar SVGs and preserve shortcut text');
    await page.screenshot({path:path.join(folder,'context-icons.png')});
    await page.keyboard.press('End');assert.equal(await page.locator('#grapheditmenu [data-edit="delete"]').evaluate(e=>e===document.activeElement),true);await page.keyboard.press('Home');assert.equal(await page.locator('#grapheditmenu [data-edit="add"]').evaluate(e=>e===document.activeElement),true);await page.keyboard.press('Escape');assert.equal(await page.locator('#grapheditmenu').count(),0);assert.equal(await page.evaluate(()=>JSON.stringify({graph,past,future,selection:[...selection]})),before);
    checks.push('Icons do not change selection/history, keyboard Home/End navigation or Escape dismissal');
    await page.evaluate(()=>{newFunction();closeGraphMenu();});await settle();await open();assert.equal(await page.locator('#grapheditmenu [data-edit="rename"] svg').count(),1);await page.keyboard.press('Escape');
    await page.evaluate(()=>{readonly=true;});await open();assert.equal(await page.locator('#grapheditmenu [data-edit="delete"]').isDisabled(),true);assert.equal(await page.locator('#grapheditmenu [data-edit="delete"] svg').count(),1);
    const geometry=await page.locator('#grapheditmenu button').evaluateAll(es=>es.map(e=>({width:e.clientWidth,scroll:e.scrollWidth})));assert.ok(geometry.every(g=>g.scroll<=g.width+1));
    checks.push('Rename has the same pencil as group frames, disabled actions retain icons, and menu contents fit their rows');
    assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,count:checks.length}));
  }catch(error){await h.finish(error);console.error(error);process.exitCode=1;}
})();
