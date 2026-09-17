/* Browser-local appearance controls. Isolated fixture only; never connects to TD.
 * node test_ui_appearance.cjs SOURCE_DIR STATE_JSON REPORT_DIR
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {harness} = require('./test_glsl_code.cjs');

async function run() {
  const [source, stateFile, folder] = process.argv.slice(2);
  const h = await harness(source, stateFile, folder);
  const {page, checks, errors, settle} = h;
  const writes = [];
  page.on('request', request => {
    const route = new URL(request.url()).pathname;
    // The real preview may negotiate a new display size when chrome resizes.
    if (request.method() === 'POST' && route.startsWith('/api/') && !route.endsWith('/remote-preview')) writes.push({route,after:checks.at(-1)});
  });
  const appearance = () => page.evaluate(() => ({size:document.documentElement.dataset.uiSize, theme:document.documentElement.dataset.uiTheme, tone:uiAppearance.tone}));
  const setAppearance = async (size, theme, tone=0) => {
    await page.evaluate(({size, theme, tone}) => {setUIAppearance('size', size); setUIAppearance('theme', theme); setUIAppearance('tone', tone);}, {size, theme, tone});
    await settle();
  };
  const setTone = async tone => {await page.evaluate(tone => setUIAppearance('tone', tone), tone); await settle();};
  const openPanel = async () => {if (!await page.locator('#appearancepanel').isVisible()) await page.locator('#uitheme').click(); await settle();};
  const closePanel = async () => {if (await page.locator('#appearancepanel').isVisible()) {await page.locator('#uitone').focus(); await page.keyboard.press('Escape'); await settle();}};
  const chooseTheme = async theme => {await openPanel(); await page.locator(`[data-ui-theme-choice="${theme}"]`).click(); await settle();};
  const snapshot = () => page.evaluate(() => ({
    graph:JSON.stringify(graph), past:JSON.stringify(past), future:JSON.stringify(future),
    pan:{...pan}, scale, dirty, stage, selected,
    preview:{auto:autoPreview, state:$('#preview').state, source:previewSource, format:previewFormat,
      filter:getComputedStyle($('#preview')).filter, opacity:getComputedStyle($('#preview')).opacity}
  }));
  const inspectControls = async (size, theme, tone, language) => {
    assert.deepEqual(await appearance(), {size, theme, tone});
    const sizeButton=page.locator('#uisize'), themeButton=page.locator('#uitheme');
    assert.equal(await sizeButton.getAttribute('aria-pressed'), String(size==='comfortable'));
    for (const [button, word] of [
      [sizeButton, language==='en' ? (size==='comfortable'?'Comfortable':'Standard') : (size==='comfortable'?'舒適':'標準')],
      [themeButton, language==='en' ? (theme==='light'?'Light':'Dark') : (theme==='light'?'淺色':'深色')]
    ]) {
      const label=await button.getAttribute('aria-label');
      assert.equal(await button.getAttribute('title'), label);
      assert.ok(label.includes(word), label);
    }
    assert.equal(await themeButton.getAttribute('aria-haspopup'), 'dialog');
    assert.equal(await themeButton.getAttribute('aria-controls'), 'appearancepanel');
    assert.equal(await themeButton.getAttribute('aria-expanded'), String(await page.locator('#appearancepanel').isVisible()));
    assert.equal(await themeButton.getAttribute('aria-pressed'), null, 'the opener is not a theme toggle');
    for (const choice of ['dark','light']) assert.equal(await page.locator(`[data-ui-theme-choice="${choice}"]`).getAttribute('aria-pressed'), String(theme===choice));
    assert.equal(await page.locator('#uitone').inputValue(), String(tone));
    assert.equal(await page.locator('#uitheme .theme-moon').isVisible(), theme==='dark');
    assert.equal(await page.locator('#uitheme .theme-sun').isVisible(), theme==='light');
  };
  const geometry = () => page.evaluate(() => {
    const measure = e => {const css=getComputedStyle(e); return {width:e.offsetWidth,height:e.offsetHeight,fontSize:css.fontSize,lineHeight:css.lineHeight};};
    return {
      node:measure($('[data-node="appearance_value"]')), numeric:measure($('[data-inline-node="appearance_value"]')),
      panelTab:{height:$('.workspace-tab').offsetHeight,fontSize:getComputedStyle($('.workspace-tab')).fontSize},
      panelContent:{fontSize:getComputedStyle($('#parameterbody')).fontSize,padding:getComputedStyle($('#parameterbody')).padding},
      applyHeight:$('#apply').offsetHeight, footerHeight:$('footer').offsetHeight
    };
  });
  const palette = () => page.evaluate(() => {
    const colors=selector=>{const s=getComputedStyle($(selector));return {background:s.backgroundColor,color:s.color,border:s.borderColor};};
    const chain=e=>{const result=[];for(;e;e=e.parentElement){const s=getComputedStyle(e);result.push({filter:s.filter,backdropFilter:s.backdropFilter,opacity:s.opacity});}return result;};
    return {
      surfaces:{header:colors('#editorheader'),canvas:colors('#canvas'),node:colors('[data-node="appearance_value"]'),field:colors('[data-inline-node="appearance_value"]')},
      swatch:{background:getComputedStyle($('.color-ink')).backgroundColor,chain:chain($('.color-ink'))},
      preview:{chain:chain($('#preview')),checkerLight:getComputedStyle(document.documentElement).getPropertyValue('--preview-checker-light'),checkerDark:getComputedStyle(document.documentElement).getPropertyValue('--preview-checker-dark')}
    };
  });
  const lightness = css => {const rgb=css.match(/[\d.]+/g).slice(0,3).map(Number);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
  try {
    await page.selectOption('#language', 'en');
    await inspectControls('standard','dark',0,'en');
    assert.equal(await page.locator('#appearancepanel').isVisible(),false);
    const initial=await snapshot();
    await openPanel();
    assert.deepEqual(await appearance(),{size:'standard',theme:'dark',tone:0},'opening the panel must not change theme');
    await page.locator('#uisize').click(); await chooseTheme('light');
    await inspectControls('comfortable','light',0,'en');
    await closePanel(); await page.locator('#uisize').click(); await chooseTheme('dark');
    await inspectControls('standard','dark',0,'en');
    assert.deepEqual(await snapshot(),initial,'appearance controls must leave graph/history/view/preview state intact');
    checks.push('new browsers start Standard/Dark at neutral tone; the opener only opens a popover and preset/size controls cover all four appearances without changing graph state');

    for (const language of ['zh-Hant','en']) {
      await page.selectOption('#language',language);
      for (const [size,theme] of [['comfortable','light'],['standard','dark']]) {await setAppearance(size,theme);await inspectControls(size,theme,0,language);}
      for (const id of ['uitone','uitoneminus','uitoneplus']) assert.ok((await page.locator('#'+id).getAttribute('aria-label'))?.trim(),`${id} needs an accessible name`);
    }
    await closePanel();
    await page.locator('#uisize').focus(); await page.keyboard.press('Enter');
    assert.equal(await page.locator('#uisize').getAttribute('aria-pressed'),'true');
    await page.keyboard.press('Space');
    assert.equal(await page.locator('#uisize').getAttribute('aria-pressed'),'false');
    await page.locator('#uitheme').focus(); await page.keyboard.press('Enter'); await settle();
    assert.equal(await page.locator('#uitheme').getAttribute('aria-expanded'),'true');
    await page.locator('[data-ui-theme-choice="light"]').focus();await page.keyboard.press('Space');
    await page.locator('#uitone').focus();await page.keyboard.press('ArrowRight');await settle();
    assert.equal((await appearance()).tone,1);
    await page.keyboard.press('Home'); assert.equal((await appearance()).tone,-100);
    await page.keyboard.press('End'); assert.equal((await appearance()).tone,100);
    await page.keyboard.press('Escape'); await settle();
    assert.equal(await page.locator('#appearancepanel').isVisible(),false);
    assert.equal(await page.locator('#uitheme').evaluate(e=>e===document.activeElement),true);
    await page.keyboard.press('Space');await settle();
    assert.equal(await page.locator('#appearancepanel').isVisible(),true);
    await page.locator('#editorheader').click({position:{x:3,y:3}});await settle();
    assert.equal(await page.locator('#appearancepanel').isVisible(),false);
    checks.push('localized controls expose selected/expanded states; Enter/Space, native range arrows/Home/End, click-away and Escape with restored opener focus work');

    await setAppearance('standard','dark'); await openPanel();
    await page.locator('#uitoneplus').click();await settle(); assert.equal((await appearance()).tone,10);
    await page.locator('#uitoneminus').click();await settle(); assert.equal((await appearance()).tone,0);
    const slider=await page.locator('#uitone').boundingBox();assert.ok(slider);
    await page.mouse.move(slider.x+slider.width/2,slider.y+slider.height/2);await page.mouse.down();
    await page.mouse.move(slider.x+slider.width*.8,slider.y+slider.height/2,{steps:8});await settle();
    assert.ok((await appearance()).tone>30,'pointer dragging must update the visible tone before release');
    await page.mouse.up();await settle();
    assert.equal((await page.evaluate(()=>JSON.parse(localStorage.getItem('sgrapeAppearanceV1')))).tone,(await appearance()).tone);
    await page.locator('#uitone').dblclick();await settle();assert.equal((await appearance()).tone,0);
    await setTone(40);await chooseTheme('dark');assert.equal((await appearance()).tone,0,'the active preset restores its baseline');
    await setTone(-40);await chooseTheme('light');assert.equal((await appearance()).tone,0,'changing theme restores its baseline');
    assert.deepEqual(await snapshot(),initial);
    checks.push('plus/minus adjust by ten; native pointer drag updates immediately and persists; double-click or selecting either preset restores its zero baseline');

    await setAppearance('comfortable','light',37);
    assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('sgrapeAppearanceV1'))),{size:'comfortable',theme:'light',tone:37});
    await page.reload();await page.waitForSelector('.node');await settle();await inspectControls('comfortable','light',37,'en');
    for (const [stored,expected] of [
      [JSON.stringify({size:'comfortable',theme:'light'}),{size:'comfortable',theme:'light',tone:0}],
      ['{broken',{size:'standard',theme:'dark',tone:0}],
      [JSON.stringify({size:'giant',theme:'pastel',tone:'45'}),{size:'standard',theme:'dark',tone:0}],
      [JSON.stringify({size:'standard',theme:'dark',tone:null}),{size:'standard',theme:'dark',tone:0}],
      [JSON.stringify({size:'standard',theme:'dark',tone:500}),{size:'standard',theme:'dark',tone:100}],
      [JSON.stringify({size:'standard',theme:'dark',tone:-500}),{size:'standard',theme:'dark',tone:-100}],
      [JSON.stringify({size:'standard',theme:'dark',tone:12.7}),{size:'standard',theme:'dark',tone:13}]
    ]) {
      await page.evaluate(value=>localStorage.setItem('sgrapeAppearanceV1',value),stored);
      await page.reload();await page.waitForSelector('.node');await settle();assert.deepEqual(await appearance(),expected);
    }
    checks.push('tone and presets survive reload; prior two-field preferences remain compatible; malformed/enumerated/string/null values recover and finite numeric tones are bounded/rounded');

    await page.evaluate(()=>{
      clearTimeout(autoTimer);connectionInterrupted=true;nativeSourcePolling=true;uniformPolling=true;customPolling=true;
      window.testNode=(id,key,x,y,params={})=>{const d=catalog.find(d=>d.key===key);return{id,definitionUuid:d.definitionUuid,revisionHash:d.revisionHash,params:{...clone(d.defaults),...params},ui:{x,y}};};
      graph.declarations=[];graph.functions=[];graphTrail=[];stage='pixel';selected=null;selectedEdge=null;selection.clear();
      graph.stages.pixel={nodes:[
        testNode('appearance_value','float',40,70,{value:1}),testNode('appearance_color','color',40,255,{value:[.55,.28,.9,1]}),
        testNode('appearance_vector','vector',330,70,{type:'vec4',components:[.2,.4,.6,1],groups:{}}),testNode('appearance_pixel','pixel_out',660,70)
      ],edges:[{from:['appearance_vector','out'],to:['appearance_pixel','color']}]};
      past=[];future=[];dirty=false;rememberSavedGraph(graph);renderGraphSaveState();render();scale=.8;pan={x:25,y:40};transform();
    });
    await setAppearance('standard','dark');const standard=await geometry(),scene=await snapshot();
    await setAppearance('comfortable','light');const comfortable=await geometry();
    for (const key of ['node','numeric','panelTab','panelContent']) assert.deepEqual(comfortable[key],standard[key],key+' must not be enlarged by chrome size');
    assert.ok(comfortable.applyHeight>standard.applyHeight);assert.equal(standard.footerHeight,32);assert.equal(comfortable.footerHeight,42);
    assert.deepEqual(await snapshot(),scene);
    checks.push('existing Standard/Comfortable chrome sizing remains intact: footer is 32/42px and nodes, fields and panel metrics are unchanged');

    const palettes=[];
    for (const theme of ['dark','light']) {
      await setAppearance('standard',theme);const neutral=await palette(),neutralGeometry=await geometry();
      await setTone(-100);const darker=await palette();
      await setTone(100);const lighter=await palette();
      assert.notDeepEqual(darker.surfaces,neutral.surfaces,'negative tone must visibly affect UI surfaces');
      assert.notDeepEqual(lighter.surfaces,neutral.surfaces,'positive tone must visibly affect UI surfaces');
      for (const key of Object.keys(neutral.surfaces)) {
        assert.ok(lightness(darker.surfaces[key].background)<=lightness(neutral.surfaces[key].background),`${theme} ${key} must not become brighter when moved left`);
        assert.ok(lightness(lighter.surfaces[key].background)>=lightness(neutral.surfaces[key].background),`${theme} ${key} must not become darker when moved right`);
      }
      for (const shifted of [darker,lighter]) {assert.deepEqual(shifted.swatch,neutral.swatch,'actual color display must not be toned');assert.deepEqual(shifted.preview,neutral.preview,'preview pixels/checker and ancestor filters must remain unchanged');}
      assert.deepEqual(await geometry(),neutralGeometry,'tone must not reflow nodes or chrome');
      await setTone(0);assert.deepEqual(await palette(),neutral,'returning to center restores the exact baseline without accumulated transforms');
      assert.deepEqual(await snapshot(),scene);
      palettes.push({theme,darker,neutral,lighter});
    }
    fs.writeFileSync(path.join(folder,'appearance-palette.json'),JSON.stringify(palettes,null,2));
    checks.push('both themes visibly lighten/darken monotonically and restore exact neutral colors, with no reflow or graph changes and no filters/color changes on preview or actual swatches');

    await page.evaluate(()=>{readonly=true;});const readOnlyScene=await snapshot();
    await page.locator('#uisize').click();await chooseTheme('dark');await page.locator('#uitoneplus').click();await settle();
    await inspectControls('comfortable','dark',10,'en');assert.deepEqual(await snapshot(),readOnlyScene);
    await page.evaluate(()=>{readonly=false;});
    const storageResult=await page.evaluate(()=>{
      const original=Storage.prototype.setItem,stored=localStorage.getItem('sgrapeAppearanceV1');
      try {Storage.prototype.setItem=function(key,value){if(key==='sgrapeAppearanceV1')throw Error('fixture storage denied');return original.call(this,key,value);};setUIAppearance('tone',27);return {tone:uiAppearance.tone,stored:localStorage.getItem('sgrapeAppearanceV1'),before:stored};}
      finally {Storage.prototype.setItem=original;}
    });
    assert.equal(storageResult.tone,27);assert.equal(storageResult.stored,storageResult.before);
    checks.push('read-only graphs allow the local panel; unavailable preference storage does not break immediate tone adjustment');

    await closePanel();await setAppearance('standard','dark');
    const entry=page.locator('[data-inline-node="appearance_value"]');await entry.fill('12.5');
    const field=await entry.elementHandle(),draftScene=await snapshot();
    for (const [size,theme,tone] of [['comfortable','dark',45],['standard','light',-45]]) {
      await setAppearance(size,theme,tone);
      assert.equal(await field.evaluate(e=>e.isConnected&&document.activeElement===e&&e.value==='12.5'),true);
      assert.deepEqual(await snapshot(),draftScene);
    }
    // Clicking another native control follows the existing blur commit; appearance adds no graph edit.
    await openPanel();await settle();
    // This deliberate numeric edit normally schedules Apply; stop its timer in the isolated fixture.
    await page.evaluate(()=>{clearTimeout(autoTimer);autoTimer=null;});
    assert.equal(await page.evaluate(()=>current().nodes.find(n=>n.id==='appearance_value').params.value),12.5);
    assert.equal(await page.evaluate(()=>past.length),JSON.parse(draftScene.past).length+1);
    const committed=await snapshot(),committedField=await page.locator('[data-inline-node="appearance_value"]').elementHandle();
    await page.locator('#uitoneplus').click();await page.locator('#uitone').focus();await page.keyboard.press('ArrowLeft');await settle();
    assert.equal(await committedField.evaluate(e=>e.isConnected&&e.value==='12.5'),true);
    assert.deepEqual(await snapshot(),committed);
    checks.push('programmatic appearance updates preserve focused numeric drafts and DOM; pointer blur commits the draft once and subsequent slider changes add no Undo or redraw');

    const layouts=[];
    for (const width of [320,390,960,1600]) {
      await page.setViewportSize({width,height:width<500?844:1050});await settle();
      for (const size of ['standard','comfortable']) for (const theme of ['dark','light']) {
        await setAppearance(size,theme);await openPanel();
        await page.evaluate(()=>status('A deliberately long persistent compile error remains readable through the footer title.',true,{kind:'compile'}));
        const layout=await page.evaluate(()=>{
          const rect=selector=>{const r=$(selector).getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
          const footerStyle=getComputedStyle($('footer'));
          return {width:innerWidth,height:innerHeight,footer:rect('footer'),start:rect('.footer-start'),preferences:rect('.footer-preferences'),actions:rect('.footer-actions'),refresh:rect('#editorrefresh'),reload:rect('#reload'),panel:rect('#appearancepanel'),range:rect('#uitone'),
            rightInset:parseFloat(footerStyle.paddingRight)+parseFloat(footerStyle.borderRightWidth),overflow:document.documentElement.scrollWidth>innerWidth+1,
            clickable:['uisize','uitheme','editorrefresh','reload','uitoneminus','uitoneplus'].every(id=>{const e=$('#'+id),r=e.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')===e;})};
        });
        assert.equal(layout.overflow,false,JSON.stringify({size,theme,layout}));
        assert.ok(Math.abs(layout.preferences.right-(layout.footer.right-layout.rightInset))<=1);
        assert.ok(layout.start.left>=layout.footer.left-1&&layout.start.right<=layout.preferences.left+1);
        assert.ok(layout.actions.left>=layout.footer.left-1&&layout.actions.right<=layout.start.right+1);
        assert.ok(layout.refresh.right<=layout.reload.left+1&&layout.reload.right<=layout.preferences.left+1);
        assert.ok(layout.panel.left>=0&&layout.panel.right<=layout.width&&layout.panel.top>=0&&layout.panel.bottom<=layout.footer.top+1,'popover must fit above the footer at every viewport');
        assert.ok(layout.range.left>=layout.panel.left&&layout.range.right<=layout.panel.right&&layout.range.width>=100,'range must have usable width and fit its panel');
        assert.equal(layout.clickable,true,'footer and popover buttons must remain hit-testable');
        layouts.push({size,theme,...layout});
        if(width===390||width===1600)await page.screenshot({path:path.join(folder,`${width}-${size}-${theme}.png`)});
      }
    }
    fs.writeFileSync(path.join(folder,'appearance-layout.json'),JSON.stringify(layouts,null,2));
    checks.push('both themes and densities fit the popover above the footer at 320/390/960/1600px with usable range width, no overflow/overlap and hit-testable buttons');
    assert.deepEqual(writes,[],'appearance controls must not apply/save/write graph or native state');
    assert.deepEqual(errors,[]);
    await h.finish();console.log(JSON.stringify({passed:true,count:checks.length}));
  } catch(error) {await h.finish(error);throw error;}
}

async function runTouch() {
  const [source,stateFile,folder]=process.argv.slice(2),h=await harness(source,stateFile,path.join(folder,'touch'),{touch:true});
  const {page,checks,errors,settle}=h,writes=[];
  page.on('request',request=>{const route=new URL(request.url()).pathname;if(request.method()==='POST'&&route.startsWith('/api/')&&!route.endsWith('/remote-preview'))writes.push(route);});
  const snapshot=()=>page.evaluate(()=>({graph:JSON.stringify(graph),past:JSON.stringify(past),future:JSON.stringify(future),pan:{...pan},scale,dirty,stage,selected}));
  try {
    await page.setViewportSize({width:390,height:844});
    await page.evaluate(()=>{setUIAppearance('size','standard');setUIAppearance('theme','dark');});await settle();
    assert.equal(await page.evaluate(()=>matchMedia('(pointer:coarse)').matches),true);
    const before=await snapshot();
    await page.locator('#uitheme').tap();await settle();assert.equal(await page.locator('#appearancepanel').isVisible(),true);
    const panel=await page.locator('#appearancepanel').boundingBox(),range=await page.locator('#uitone').boundingBox();
    assert.ok(panel.x>=0&&panel.x+panel.width<=390&&range.height>=32,'coarse slider and panel need usable bounds');
    const cdp=await page.context().newCDPSession(page),send=async(type,x,y)=>{await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{id:1,x,y,radiusX:5,radiusY:5}]});await settle();};
    const drag=async(from,to)=>{await send('touchStart',range.x+range.width*from,range.y+range.height/2);for(let i=1;i<=6;i++)await send('touchMove',range.x+range.width*(from+(to-from)*i/6),range.y+range.height/2);await send('touchEnd');};
    await drag(.5,.82);
    assert.ok(await page.evaluate(()=>uiAppearance.tone)>30,'trusted touch dragging must adjust the native range');
    assert.equal(await page.locator('#appearancepanel').isVisible(),true);
    assert.deepEqual(await snapshot(),before,'touch slider must not pan or edit the graph');
    await page.locator('[data-ui-theme-choice="light"]').tap();await settle();assert.equal(await page.evaluate(()=>uiAppearance.tone),0);
    await drag(.5,.2);const lower=await page.evaluate(()=>uiAppearance.tone);assert.ok(lower< -30);
    await page.locator('#uitoneplus').tap();await settle();assert.equal(await page.evaluate(()=>uiAppearance.tone),lower+10);
    await page.screenshot({path:path.join(folder,'touch','390-light-adjusted.png')});
    await page.locator('#editorheader').tap({position:{x:3,y:3}});await settle();assert.equal(await page.locator('#appearancepanel').isVisible(),false);
    assert.deepEqual(await snapshot(),before);assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);await cdp.detach();
    checks.push('390px coarse-pointer Chromium: native touch opener/presets/plus, bidirectional trusted range drag and outside dismissal work without graph pan/history/writes');
    await h.finish();console.log(JSON.stringify({touchPassed:true,count:checks.length}));
  } catch(error) {await h.finish(error);throw error;}
}
if(require.main===module)run().then(runTouch).catch(error=>{console.error(error.stack);process.exitCode=1;});
