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
    if (request.method() === 'POST' && route.startsWith('/api/') && !route.endsWith('/remote-preview')) writes.push(route);
  });
  const appearance = () => page.evaluate(() => ({size:document.documentElement.dataset.uiSize, theme:document.documentElement.dataset.uiTheme}));
  const setAppearance = async (size, theme) => {
    await page.evaluate(({size, theme}) => {setUIAppearance('size', size); setUIAppearance('theme', theme);}, {size, theme});
    await settle();
  };
  const snapshot = () => page.evaluate(() => ({
    graph:JSON.stringify(graph), past:JSON.stringify(past), future:JSON.stringify(future),
    pan:{...pan}, scale, dirty, stage, selected,
    preview:{auto:autoPreview, state:$('#preview').state, source:previewSource, format:previewFormat,
      filter:getComputedStyle($('#preview')).filter, opacity:getComputedStyle($('#preview')).opacity}
  }));
  const inspectButtons = async (size, theme, language) => {
    assert.deepEqual(await appearance(), {size, theme});
    for (const [id, active, word] of [
      ['uisize', size === 'comfortable', language === 'en' ? (size === 'comfortable' ? 'Comfortable' : 'Standard') : (size === 'comfortable' ? '舒適' : '標準')],
      ['uitheme', theme === 'light', language === 'en' ? (theme === 'light' ? 'Light' : 'Dark') : (theme === 'light' ? '淺色' : '深色')]
    ]) {
      const button = page.locator('#' + id), label = await button.getAttribute('aria-label');
      assert.equal(await button.getAttribute('aria-pressed'), String(active));
      assert.equal(await button.getAttribute('title'), label);
      assert.ok(label.includes(word), `${id}: ${label}`);
    }
    assert.equal(await page.locator('#uitheme .theme-moon').isVisible(), theme === 'dark');
    assert.equal(await page.locator('#uitheme .theme-sun').isVisible(), theme === 'light');
  };
  const geometry = () => page.evaluate(() => {
    const measure = e => {
      const css = getComputedStyle(e);
      return {width:e.offsetWidth, height:e.offsetHeight, fontSize:css.fontSize, lineHeight:css.lineHeight};
    };
    return {
      node:measure($('[data-node="appearance_value"]')),
      numeric:measure($('[data-inline-node="appearance_value"]')),
      panelTab:{height:$('.workspace-tab').offsetHeight, fontSize:getComputedStyle($('.workspace-tab')).fontSize},
      panelContent:{fontSize:getComputedStyle($('#parameterbody')).fontSize, padding:getComputedStyle($('#parameterbody')).padding},
      applyHeight:$('#apply').offsetHeight, footerHeight:$('footer').offsetHeight
    };
  });
  try {
    await page.selectOption('#language', 'en');
    await inspectButtons('standard', 'dark', 'en');
    const initial = await snapshot();
    for (const [button, size, theme] of [
      ['uisize','comfortable','dark'], ['uitheme','comfortable','light'],
      ['uisize','standard','light'], ['uitheme','standard','dark']
    ]) {
      await page.locator('#' + button).click(); await settle();
      await inspectButtons(size, theme, 'en');
      assert.deepEqual(await snapshot(), initial, 'appearance clicks must leave the graph and preview state intact');
    }
    checks.push('new browsers start Standard/Dark; clicks cover all four combinations without graph, history, view or preview changes');

    for (const language of ['zh-Hant', 'en']) {
      await page.selectOption('#language', language);
      for (const [size, theme] of [['comfortable','light'], ['standard','dark']]) {
        await setAppearance(size, theme); await inspectButtons(size, theme, language);
      }
    }
    for (const id of ['uisize','uitheme']) {
      const button = page.locator('#' + id);
      await button.focus(); await button.press('Enter');
      assert.equal(await button.getAttribute('aria-pressed'), 'true');
      assert.equal(await button.evaluate(e => document.activeElement === e), true);
      await button.press('Space');
      assert.equal(await button.getAttribute('aria-pressed'), 'false');
    }
    checks.push('both native buttons work with Enter/Space and expose matching localized titles, accessible names, pressed states and icons');

    await setAppearance('comfortable', 'light');
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('sgrapeAppearanceV1'))), {size:'comfortable', theme:'light'});
    await page.reload(); await page.waitForSelector('.node'); await settle();
    await inspectButtons('comfortable', 'light', 'en');
    for (const invalid of ['{broken', JSON.stringify({size:'giant',theme:'pastel'})]) {
      await page.evaluate(value => localStorage.setItem('sgrapeAppearanceV1', value), invalid);
      await page.reload(); await page.waitForSelector('.node'); await settle();
      await inspectButtons('standard', 'dark', 'en');
    }
    checks.push('browser-local choices survive reload; malformed storage and unknown enum values recover to Standard/Dark');

    await page.evaluate(() => {
      clearTimeout(autoTimer); connectionInterrupted=true; nativeSourcePolling=true; uniformPolling=true; customPolling=true;
      window.testNode=(id,key,x,y,params={})=>{const d=catalog.find(d=>d.key===key);return{id,definitionUuid:d.definitionUuid,revisionHash:d.revisionHash,params:{...clone(d.defaults),...params},ui:{x,y}};};
      graph.declarations=[]; graph.functions=[]; graphTrail=[]; stage='pixel'; selected=null; selectedEdge=null; selection.clear();
      graph.stages.pixel={nodes:[
        testNode('appearance_value','float',40,70,{value:1}),
        testNode('appearance_color','color',40,255,{value:[.55,.28,.9,1]}),
        testNode('appearance_vector','vector',330,70,{type:'vec4',components:[.2,.4,.6,1],groups:{}}),
        testNode('appearance_pixel','pixel_out',660,70)
      ],edges:[{from:['appearance_vector','out'],to:['appearance_pixel','color']}]};
      past=[]; future=[]; dirty=false; rememberSavedGraph(graph); renderGraphSaveState(); render(); scale=.8; pan={x:25,y:40}; transform();
    });
    await setAppearance('standard', 'dark');
    const standard = await geometry(), scene = await snapshot();
    await setAppearance('comfortable', 'light');
    const comfortable = await geometry();
    for (const key of ['node','numeric','panelTab','panelContent']) assert.deepEqual(comfortable[key], standard[key], key + ' must not be enlarged by chrome size');
    assert.ok(comfortable.applyHeight > standard.applyHeight, 'Comfortable must visibly enlarge chrome');
    assert.equal(standard.footerHeight, 32); assert.equal(comfortable.footerHeight, 42);
    assert.deepEqual(await snapshot(), scene);
    checks.push('Comfortable enlarges chrome while node, inline field and panel metrics stay unchanged; Standard/Comfortable footer heights are 32/42');

    await page.evaluate(() => {readonly=true;});
    const readOnlyScene = await snapshot();
    await page.locator('#uisize').click(); await page.locator('#uitheme').click(); await settle();
    await inspectButtons('standard', 'dark', 'en');
    assert.deepEqual(await snapshot(), readOnlyScene);
    await page.evaluate(() => {readonly=false;});
    const storageResult = await page.evaluate(() => {
      const original=Storage.prototype.setItem, stored=localStorage.getItem('sgrapeAppearanceV1');
      try {
        Storage.prototype.setItem=function(key,value){if(key==='sgrapeAppearanceV1')throw Error('fixture storage denied');return original.call(this,key,value);};
        setUIAppearance('theme','light');
        return {theme:document.documentElement.dataset.uiTheme,stored:localStorage.getItem('sgrapeAppearanceV1'),before:stored};
      } finally {Storage.prototype.setItem=original;}
    });
    assert.equal(storageResult.theme,'light'); assert.equal(storageResult.stored,storageResult.before);
    checks.push('read-only graphs still allow appearance changes; denied localStorage writes do not break the current page');

    const entry = page.locator('[data-inline-node="appearance_value"]');
    await entry.fill('12.5');
    const field = await entry.elementHandle(), draftScene = await snapshot();
    for (const [size,theme] of [['comfortable','dark'],['standard','light']]) {
      await setAppearance(size,theme);
      assert.equal(await field.evaluate(e => e.isConnected && document.activeElement===e && e.value==='12.5'),true);
      assert.deepEqual(await snapshot(), draftScene);
    }
    // Moving keyboard focus follows the existing blur commit. Appearance must not add another edit.
    await entry.press('Tab'); await settle();
    assert.equal(await page.evaluate(() => current().nodes.find(n=>n.id==='appearance_value').params.value),12.5);
    assert.equal(await page.evaluate(() => past.length),JSON.parse(draftScene.past).length+1);
    const committed = await snapshot();
    const committedField = await page.locator('[data-inline-node="appearance_value"]').elementHandle();
    await page.locator('#uisize').focus(); await page.locator('#uisize').press('Enter'); await settle();
    assert.equal(await committedField.evaluate(e => e.isConnected && e.value==='12.5'),true);
    assert.deepEqual(await snapshot(),committed);
    checks.push('setUIAppearance preserves a focused numeric draft and DOM; Tab commits once and keyboard appearance changes preserve the committed field without extra Undo');

    const layouts=[];
    for (const width of [320,390,960,1600]) {
      await page.setViewportSize({width,height:width<500?844:1050}); await settle();
      for (const size of ['standard','comfortable']) for (const theme of ['dark','light']) {
        await setAppearance(size,theme);
        await page.evaluate(() => status('A deliberately long persistent compile error remains readable through the footer title.',true,{kind:'compile'}));
        const layout=await page.evaluate(() => {
          const rect=selector=>{const r=$(selector).getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};};
          const footerStyle=getComputedStyle($('footer'));
          return {width:innerWidth,footer:rect('footer'),start:rect('.footer-start'),preferences:rect('.footer-preferences'),actions:rect('.footer-actions'),refresh:rect('#editorrefresh'),reload:rect('#reload'),
            rightInset:parseFloat(footerStyle.paddingRight)+parseFloat(footerStyle.borderRightWidth),overflow:document.documentElement.scrollWidth>innerWidth+1,
            clickable:['uisize','uitheme','editorrefresh','reload'].every(id=>{const e=$('#'+id),r=e.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')===e;})};
        });
        assert.equal(layout.overflow,false,JSON.stringify({size,theme,layout}));
        assert.ok(Math.abs(layout.preferences.right-(layout.footer.right-layout.rightInset))<=1,'footer preferences must stay at the right edge');
        assert.ok(layout.start.left>=layout.footer.left-1 && layout.start.right<=layout.preferences.left+1,'left actions and status must not overlap right preferences');
        assert.ok(layout.actions.left>=layout.footer.left-1 && layout.actions.right<=layout.start.right+1,'reload actions must fit in the left footer group');
        assert.ok(layout.refresh.right<=layout.reload.left+1 && layout.reload.right<=layout.preferences.left+1,'refresh and reload must remain ordered on the left without overlap');
        assert.equal(layout.clickable,true,'all four footer actions must remain hit-testable');
        layouts.push({size,theme,...layout});
        if(width===390||width===1600)await page.screenshot({path:path.join(folder,`${width}-${size}-${theme}.png`)});
      }
    }
    fs.writeFileSync(path.join(folder,'appearance-layout.json'),JSON.stringify(layouts,null,2));
    checks.push('all four appearances keep refresh/reload on the left and preferences on the right without overlap, with all four buttons hit-testable at 320, 390, 960 and 1600px');
    assert.deepEqual(writes,[],'appearance controls must not apply, save or write graph/native state');
    assert.deepEqual(errors,[]);
    await h.finish(); console.log(JSON.stringify({passed:true,count:checks.length}));
  } catch(error) {await h.finish(error); throw error;}
}
if(require.main===module)run().catch(error=>{console.error(error.stack);process.exitCode=1;});
