/* Whole-interface scale preferences and native popover gestures. Isolated fixture only.
 * node test_ui_scale.cjs SOURCE_DIR STATE_JSON REPORT_DIR
 */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {harness}=require('./test_glsl_code.cjs');

async function run(){
  const[source,stateFile,folder]=process.argv.slice(2),h=await harness(source,stateFile,folder),{page,checks,errors,settle}=h;
  const writes=[];
  page.on('request',request=>{const route=new URL(request.url()).pathname;if(request.method()==='POST'&&route.startsWith('/api/')&&!route.endsWith('/remote-preview'))writes.push(route);});
  const state=()=>page.evaluate(()=>({size:uiAppearance.size,scale:uiAppearance.scale,theme:uiAppearance.theme,tone:uiAppearance.tone,tones:{...uiAppearance.tones}}));
  const snapshot=()=>page.evaluate(()=>({graph:JSON.stringify(graph),past:JSON.stringify(past),future:JSON.stringify(future),pan:{...pan},scale,dirty,stage,selected,preview:{source:previewSource,format:previewFormat,state:$('#preview').state}}));
  const setScale=async value=>{await page.evaluate(value=>setUIAppearance('scale',value),value);await settle();};
  const setSize=async(size,scale=100)=>{await page.evaluate(({size,scale})=>{setUIAppearance('size',size);setUIAppearance('scale',scale);},{size,scale});await settle();};
  const open=async()=>{if(!await page.locator('#sizepanel').isVisible())await page.locator('#uisize').click();await settle();};
  const close=async()=>{if(await page.locator('#sizepanel').isVisible()){await page.locator('#uiscale').focus();await page.keyboard.press('Escape');await settle();}};
  const choose=async size=>{await open();await page.locator(`[data-ui-size-choice="${size}"]`).click();await settle();};
  const bounds=()=>page.evaluate(()=>{
    const rect=selector=>{const r=$(selector).getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
    return{viewport:{width:innerWidth,height:innerHeight},body:rect('body'),footer:rect('footer'),reload:rect('#reload'),preferences:rect('.footer-preferences'),panel:rect('#sizepanel'),range:rect('#uiscale'),
      overflow:document.documentElement.scrollWidth>innerWidth+2,
      clickable:['editorrefresh','reload','uisize','uitheme','uifullscreen','uiscaleminus','uiscaleplus'].every(id=>{const e=$('#'+id),r=e.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')===e;})};
  });
  const assertBounds=(layout,label)=>{
    assert.equal(layout.overflow,false,label+' must not overflow the viewport');
    assert.ok(Math.abs(layout.body.x)<=1,label+' page must not scroll horizontally when opening controls');
    assert.ok(layout.reload.right<=layout.preferences.x+1,label+' reload must not overlap appearance controls');
    assert.ok(Math.abs(layout.footer.bottom-layout.viewport.height)<=2,label+' footer must meet the viewport bottom');
    assert.ok(layout.panel.x>=0&&layout.panel.right<=layout.viewport.width+1&&layout.panel.y>=0&&layout.panel.bottom<=layout.footer.y+1,label+' popover must fit above the footer: '+JSON.stringify(layout));
    assert.ok(layout.range.x>=layout.panel.x&&layout.range.right<=layout.panel.right&&layout.range.width>=90,label+' range must remain usable');
    assert.equal(layout.clickable,true,label+' all appearance controls must remain hit-testable');
  };
  try{
    await page.selectOption('#language','en');
    assert.equal((await state()).scale,100);
    const initial=await snapshot();await open();
    assert.equal(await page.locator('#uisize').getAttribute('aria-haspopup'),'dialog');
    assert.equal(await page.locator('#uisize').getAttribute('aria-controls'),'sizepanel');
    assert.equal(await page.locator('#uisize').getAttribute('aria-expanded'),'true');
    assert.equal(await page.locator('#uisize').getAttribute('aria-pressed'),null);
    assert.equal(await page.locator('#uiscale').inputValue(),'100');
    for(const id of ['uiscale','uiscaleminus','uiscaleplus'])assert.ok((await page.locator('#'+id).getAttribute('aria-label'))?.trim());
    await page.locator('#uitheme').click();await settle();
    assert.equal(await page.locator('#appearancepanel').isVisible(),true);assert.equal(await page.locator('#sizepanel').isVisible(),false);
    await open();assert.equal(await page.locator('#appearancepanel').isVisible(),false);assert.deepEqual(await snapshot(),initial);
    checks.push('size opens a named nonmodal popover at 100%; theme/size panels dismiss each other and opening them does not change the graph');

    await page.locator('#uiscaleplus').click();await settle();assert.equal((await state()).scale,105);
    await page.locator('#uiscaleminus').click();await settle();assert.equal((await state()).scale,100);
    await page.locator('#uiscale').focus();await page.keyboard.press('ArrowRight');assert.equal((await state()).scale,101);
    await page.keyboard.press('Home');assert.equal((await state()).scale,75);assert.equal(await page.locator('#uiscaleminus').isDisabled(),true);
    await page.keyboard.press('End');assert.equal((await state()).scale,125);assert.equal(await page.locator('#uiscaleplus').isDisabled(),true);
    await page.locator('#uiscale').click({button:'right'});await settle();assert.equal((await state()).scale,100);
    const beforeDrag=await bounds(),r=beforeDrag.range;
    await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();await page.mouse.move(r.x+r.width*.85,r.y+r.height/2,{steps:10});await settle();
    assert.ok((await state()).scale>105,'native drag must update scale before release');
    await page.mouse.up();await settle();assertBounds(await bounds(),'pointer-dragged scale');
    await page.locator('#uiscale').dblclick();await settle();assert.equal((await state()).scale,100);
    await close();assert.equal(await page.locator('#uisize').evaluate(e=>e===document.activeElement),true);
    await page.keyboard.press('Enter');await settle();assert.equal(await page.locator('#sizepanel').isVisible(),true);
    await page.locator('[data-ui-size-choice="comfortable"]').focus();await page.keyboard.press('Space');assert.equal((await state()).size,'comfortable');
    await page.locator('#editorheader').click({position:{x:3,y:3}});await settle();assert.equal(await page.locator('#sizepanel').isVisible(),false);
    assert.deepEqual(await snapshot(),initial);
    checks.push('plus/minus step five, native keys/limits and pointer drag work; right-click/double-click reset100, Escape restores opener focus and outside click dismisses');

    await setSize('standard',87);await choose('comfortable');assert.equal((await state()).scale,87,'switching density preserves the shared adjustment');
    await setScale(116);await choose('comfortable');assert.equal((await state()).scale,116,'active preset preserves the shared adjustment');
    await choose('standard');assert.equal((await state()).scale,116);await page.locator('#uiscale').click({button:'right'});await settle();
    assert.equal((await state()).scale,100);await choose('comfortable');assert.equal((await state()).scale,100,'reset is shared across both densities');await setScale(116);
    await page.evaluate(()=>{setUIAppearance('theme','dark');setUIAppearance('tone',-34);setUIAppearance('theme','light');setUIAppearance('tone',26);});await settle();
    const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('sgrapeAppearanceV1')));
    assert.deepEqual(saved,{size:'comfortable',theme:'light',tones:{dark:-34,light:26},scale:116});
    await page.reload();await page.waitForSelector('.node');await settle();
    assert.deepEqual(await state(),{size:'comfortable',scale:116,theme:'light',tone:26,tones:{dark:-34,light:26}});
    for(const[stored,expected]of[
      [{size:'standard',theme:'dark',tones:{dark:23,light:-12}},100],
      [{size:'comfortable',theme:'light',scales:{standard:87,comfortable:116}},116],
      [{size:'standard',theme:'dark',scales:{standard:87,comfortable:116}},87],
      [{size:'comfortable',theme:'dark',scale:92,scales:{standard:80,comfortable:115}},92],
      [{size:'standard',theme:'dark',scale:'95',scales:{standard:85,comfortable:115}},100],
      [{size:'comfortable',theme:'dark',scale:null,scales:{standard:85,comfortable:115}},100],
      [{size:'standard',theme:'dark',scale:60},75],
      [{size:'comfortable',theme:'light',scale:180},125],
      [{size:'comfortable',theme:'dark',scale:108.2},108]
    ]){
      await page.evaluate(value=>localStorage.setItem('sgrapeAppearanceV1',JSON.stringify(value)),stored);await page.reload();await page.waitForSelector('.node');await settle();
      assert.equal((await state()).scale,expected);await choose(stored.size==='standard'?'comfortable':'standard');assert.equal((await state()).scale,expected);
    }
    checks.push('densities share one scale and reset while theme tones remain independent; reload and legacy active-density migration preserve appearance; invalid/bounded/fractional values normalize');

    await page.setViewportSize({width:1600,height:1050});
    await page.evaluate(()=>{
      clearTimeout(autoTimer);connectionInterrupted=true;nativeSourcePolling=true;uniformPolling=true;customPolling=true;
      window.testNode=(id,key,x,y,params={})=>{const d=catalog.find(d=>d.key===key);return{id,definitionUuid:d.definitionUuid,revisionHash:d.revisionHash,params:{...clone(d.defaults),...params},ui:{x,y}};};
      graph.declarations=[];graph.functions=[];graphTrail=[];stage='pixel';selected=null;selectedEdge=null;selection.clear();
      graph.stages.pixel={nodes:[testNode('scale_value','float',40,70,{value:1}),testNode('scale_color','color',300,70,{value:[.55,.28,.9,1]}),testNode('scale_pixel','pixel_out',600,70)],edges:[]};
      past=[];future=[];dirty=false;rememberSavedGraph(graph);renderGraphSaveState();render();scale=.8;pan={x:25,y:40};transform();
    });
    await setSize('standard');await close();const scene=await snapshot();
    const node=await page.locator('[data-node="scale_value"]').elementHandle();
    const metrics=()=>page.evaluate(()=>{const e=$('[data-node="scale_value"]'),r=e.getBoundingClientRect(),swatch=$('.color-ink');return{width:r.width,height:r.height,layoutWidth:e.offsetWidth,layoutHeight:e.offsetHeight,swatch:getComputedStyle(swatch).backgroundColor};});
    for(const size of ['standard','comfortable']){
      await setSize(size);const baseline=await metrics();
      for(const factor of [75,125,100]){
        await setScale(factor);const actual=await metrics();
        assert.ok(Math.abs(actual.width-baseline.width*factor/100)<1);assert.ok(Math.abs(actual.height-baseline.height*factor/100)<1);
        // CSS zoom may round a one-pixel border differently in offset metrics.
        assert.ok(Math.abs(actual.layoutWidth-baseline.layoutWidth)<=1);assert.ok(Math.abs(actual.layoutHeight-baseline.layoutHeight)<=1);assert.equal(actual.swatch,baseline.swatch);
        assert.equal(await node.evaluate(e=>e.isConnected),true);assert.deepEqual(await snapshot(),scene);
      }
    }
    checks.push('whole-interface scaling changes rendered node size proportionally while preserving layout dimensions, authored colors, DOM identity and graph pan/zoom/history');

    await setSize('standard');const entry=page.locator('[data-inline-node="scale_value"]');await entry.fill('12.5');const field=await entry.elementHandle(),draft=await snapshot();
    for(const percent of [75,125,100]){await setScale(percent);assert.equal(await field.evaluate(e=>e.isConnected&&e===document.activeElement&&e.value==='12.5'),true);assert.deepEqual(await snapshot(),draft);}
    await open();await page.evaluate(()=>{clearTimeout(autoTimer);autoTimer=null;});
    assert.equal(await page.evaluate(()=>current().nodes.find(n=>n.id==='scale_value').params.value),12.5);assert.equal(await page.evaluate(()=>past.length),JSON.parse(draft.past).length+1);
    const committed=await snapshot();await page.locator('#uiscaleplus').click();await settle();assert.deepEqual(await snapshot(),committed);
    await page.evaluate(()=>{readonly=true;});await setScale(90);assert.deepEqual(await snapshot(),committed);await page.evaluate(()=>{readonly=false;});
    const storage=await page.evaluate(()=>{const original=Storage.prototype.setItem,stored=localStorage.getItem('sgrapeAppearanceV1');try{Storage.prototype.setItem=function(key,value){if(key==='sgrapeAppearanceV1')throw Error('fixture denied');return original.call(this,key,value);};setUIAppearance('scale',112);return{scale:uiAppearance.scale,stored:localStorage.getItem('sgrapeAppearanceV1'),before:stored};}finally{Storage.prototype.setItem=original;}});
    assert.equal(storage.scale,112);assert.equal(storage.stored,storage.before);
    checks.push('programmatic scaling preserves focused drafts; normal pointer blur commits once, later scaling adds no edit, and read-only/storage-denied preferences remain usable');

    const layouts=[];
    for(const width of [320,390,1600]){
      await page.setViewportSize({width,height:width<500?844:1050});await settle();
      for(const size of ['standard','comfortable'])for(const percent of [75,100,125]){
        await setSize(size,percent);await open();const layout=await bounds();assertBounds(layout,`${width}/${size}/${percent}`);layouts.push({width,size,percent,...layout});
        if(width!==320&&percent!==100)await page.screenshot({path:path.join(folder,`${width}-${size}-${percent}.png`)});
      }
    }
    fs.writeFileSync(path.join(folder,'scale-layout.json'),JSON.stringify(layouts,null,2));
    checks.push('both densities at75/100/125% keep the range and footer anchored and hit-testable without overflow at320/390/1600px');

    await page.setViewportSize({width:1600,height:1050});await setSize('standard',125);await close();
    const checkFocused=async label=>{
      assert.equal(await page.locator('footer').isVisible(),false);
      const layout=await page.evaluate(()=>{
        const r=$('#canvas').getBoundingClientRect();return{x:r.x,right:r.right,bottom:r.bottom,width:innerWidth,height:innerHeight,
          clickable:['graphfocus','uifullscreen'].every(id=>{const e=$('#'+id),b=e.getBoundingClientRect();return document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)?.closest('button')===e;})};
      });
      assert.ok(layout.x>=-1&&layout.right<=layout.width+1&&Math.abs(layout.bottom-layout.height)<=2,label+' scaled canvas must fit viewport');
      assert.equal(layout.clickable,true,label+' canvas restore/fullscreen buttons must be usable');
    };
    const modes=await snapshot();await page.locator('#graphfocus').click();await settle();await checkFocused('focused graph');
    await page.locator('#uifullscreen').click();await page.waitForFunction(()=>!!document.fullscreenElement);await settle();
    await checkFocused('focused fullscreen');
    await page.locator('#graphfocus').click();await settle();await open();assertBounds(await bounds(),'normal fullscreen');await close();
    await page.locator('#uifullscreen').click();await page.waitForFunction(()=>!document.fullscreenElement);await settle();await open();assertBounds(await bounds(),'restored normal window');
    assert.deepEqual(await snapshot(),modes);assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);
    checks.push('125% UI retains scaled canvas and fullscreen/restore controls in focus, plus anchored settings in normal/fullscreen views, without altering graph state');
    await h.finish();console.log(JSON.stringify({passed:true,count:checks.length}));
  }catch(error){await h.finish(error);throw error;}
}

async function runTouch(){
  const[source,stateFile,folder]=process.argv.slice(2),h=await harness(source,stateFile,path.join(folder,'touch'),{touch:true}),{page,checks,errors,settle}=h;
  try{
    await page.setViewportSize({width:390,height:844});await settle();
    const before=await page.evaluate(()=>({graph:JSON.stringify(graph),past:JSON.stringify(past),future:JSON.stringify(future),pan:{...pan},scale}));
    await page.locator('#uisize').tap();await settle();
    const r=await page.locator('#uiscale').boundingBox();assert.ok(r.height>=32);
    const cdp=await page.context().newCDPSession(page),touch=async(type,x,y)=>{await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{id:1,x,y,radiusX:5,radiusY:5}]});await settle();};
    await touch('touchStart',r.x+r.width/2,r.y+r.height/2);for(let i=1;i<=6;i++)await touch('touchMove',r.x+r.width*(.5+i*.04),r.y+r.height/2);await touch('touchEnd');
    const dragged=await page.evaluate(()=>uiAppearance.scale);assert.ok(dragged>105,'trusted native touch drag must enlarge UI');
    assert.equal(await page.locator('#sizepanel').isVisible(),true);
    await page.locator('[data-ui-size-choice="comfortable"]').tap();await settle();assert.equal(await page.evaluate(()=>uiAppearance.scale),dragged);
    await page.locator('#uiscaleminus').tap();await settle();assert.equal(await page.evaluate(()=>uiAppearance.scale),dragged-5);
    const p=await page.locator('#sizepanel').boundingBox(),f=await page.locator('footer').boundingBox();assert.ok(p.x>=0&&p.x+p.width<=391&&p.y+p.height<=f.y+1);
    await page.screenshot({path:path.join(folder,'touch','390-scale.png')});
    assert.deepEqual(await page.evaluate(()=>({graph:JSON.stringify(graph),past:JSON.stringify(past),future:JSON.stringify(future),pan:{...pan},scale})),before);
    await page.locator('#editorheader').tap({position:{x:3,y:3}});await settle();assert.equal(await page.locator('#sizepanel').isVisible(),false);
    assert.deepEqual(errors,[]);await cdp.detach();checks.push('390px trusted touch range drag, density selection, minus and outside dismissal retain graph state and panel bounds');
    await h.finish();console.log(JSON.stringify({touchPassed:true,count:checks.length}));
  }catch(error){await h.finish(error);throw error;}
}
if(require.main===module)run().then(runTouch).catch(error=>{console.error(error.stack);process.exitCode=1;});
