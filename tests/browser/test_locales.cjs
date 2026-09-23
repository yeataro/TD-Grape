/* Locale switching uses an isolated API fixture and never writes to TD.
 * node test_locales.cjs SOURCE_DIR STATE_JSON REPORT_DIR
 */
const assert=require('node:assert/strict'),path=require('node:path');
const {harness}=require('./test_glsl_code.cjs');
async function run(){
  const[source,stateFile,folder]=process.argv.slice(2),h=await harness(source,stateFile,folder,{skipPreview:true});
  const{page,checks,errors,settle}=h,writes=[];
  page.on('request',r=>{if(r.method()==='POST'&&new URL(r.url()).pathname.startsWith('/api/'))writes.push(r.url());});
  const freeze=()=>page.evaluate(()=>{nativeSourcePolling=uniformPolling=customPolling=true;uniformLive.disconnect();uniformLive.connect=()=>{};clearTimeout(autoTimer);scheduleGraphApply=()=>{};});
  const snapshot=()=>page.evaluate(()=>JSON.stringify({graph,past,future,selected,stage,pan,scale,dirty}));
  const locale=async id=>{await page.selectOption('#language',id);await settle();};
  try{
    await freeze();const before=await snapshot();
    assert.equal(await page.locator('html').getAttribute('lang'),'en');
    for(const selector of ['#language','#sizelanguage'])assert.deepEqual(await page.locator(selector+' option').evaluateAll(es=>es.map(e=>[e.value,e.textContent])),[['zh-Hant','繁體中文'],['en','English'],['ja','日本語'],['fr','Français'],['ko','한국어']]);
    checks.push('English remains the default; both dropdowns offer all five supported languages');
    await locale('ja');
    assert.equal(await page.locator('#sizelanguage').inputValue(),'ja');
    assert.equal(await page.locator('html').getAttribute('lang'),'ja');
    assert.equal(await page.locator('#about').innerText(),'About');
    assert.equal(await page.locator('#projectfile').innerText(),await page.evaluate(()=>t('project.unavailable')));
    const translated=await page.evaluate(()=>({parameter:t('panel.parameterTitle'),help:t('panel.helpTitle'),controls:t('controls.title'),preview:t('preview.material'),stage:$('#stagecaption').textContent,missing:Object.entries(localeData.messages).filter(([,v])=>!v.ja).map(([k])=>k)}));
    assert.deepEqual(translated,{parameter:'パラメーター',help:'ヘルプ',controls:'OP パラメーター',preview:'マテリアルプレビュー',stage:'PIXEL STAGE',missing:[]});
    await page.evaluate(()=>workspaceLayout.reveal('controls'));await settle();
    assert.ok((await page.locator('#pane-controls').innerText()).includes('カスタムパラメーター'));
    await page.screenshot({path:path.join(folder,'japanese-dark.png')});
    checks.push('Japanese panel names, OP parameter actions, help and stage labels render without missing translations');
    await page.locator('#uisize').click();await page.locator('#sizelanguage').selectOption('zh-Hant');await settle();
    assert.equal(await page.locator('#language').inputValue(),'zh-Hant');
    assert.deepEqual(await page.evaluate(()=>['panel.parameterTitle','panel.helpTitle','controls.title','preview.top','preview.material','layout.title'].map(t)),['參數','說明','OP 參數','輸出預覽','材質預覽','Layout']);
    await page.keyboard.press('Escape');
    assert.equal(await snapshot(),before);
    checks.push('The size-menu picker updates both dropdowns; Chinese panel names are localized; graph/history/view remain unchanged');
    await locale('ja');await page.evaluate(()=>setUIAppearance('theme','light'));await page.setViewportSize({width:1133,height:744});await settle();
    await page.locator('#uishortcuts').click();await settle();
    assert.ok((await page.locator('#shortcutspanel').innerText()).includes('キーボードショートカット'));
    let size=await page.locator('#shortcutspanel').evaluate(e=>({client:e.clientWidth,scroll:e.scrollWidth}));assert.ok(size.scroll<=size.client+1,JSON.stringify(size));
    await page.screenshot({path:path.join(folder,'japanese-shortcuts-light.png')});await page.locator('#shortcutsclose').click();
    await page.locator('#uiexperiments').click();await settle();
    size=await page.locator('#experimentspanel').evaluate(e=>({client:e.clientWidth,scroll:e.scrollWidth}));assert.ok(size.scroll<=size.client+1,JSON.stringify(size));
    await page.screenshot({path:path.join(folder,'japanese-experiments-light.png')});await page.keyboard.press('Escape');
    checks.push('Japanese shortcuts and experimental options fit the smaller viewport in light mode');
    await page.reload();await page.waitForSelector('.node');await freeze();
    assert.equal(await page.locator('html').getAttribute('lang'),'ja');assert.equal(await page.locator('#language').inputValue(),'ja');assert.equal(await page.locator('#sizelanguage').inputValue(),'ja');
    checks.push('Japanese persists across reload');
    const categoryKeys=await page.evaluate(()=>Object.keys(localeData.messages).filter(k=>k.startsWith('browser.category.')||k.startsWith('browser.branch.')||k.startsWith('inputs.group.')||k.startsWith('category.')));
    for(const [id,expected] of [
      ['fr',{about:'À propos',layout:'Disposition',stage:'ÉTAPE PIXEL',parameter:'Paramètres',help:'Aide',controls:'Paramètres OP'}],
      ['ko',{about:'About',layout:'Layout',stage:'PIXEL STAGE',parameter:'매개변수',help:'도움말',controls:'OP 매개변수'}]
    ]){
      await page.setViewportSize({width:1600,height:1100});await page.evaluate(()=>setUIAppearance('theme','dark'));
      const stateBefore=await snapshot();await locale(id);
      assert.equal(await page.locator('#sizelanguage').inputValue(),id);
      assert.deepEqual(await page.evaluate(()=>({about:$('#about').textContent,layout:t('layout.title'),stage:$('#stagecaption').textContent,parameter:t('panel.parameterTitle'),help:t('panel.helpTitle'),controls:t('controls.title')})),expected);
      assert.deepEqual(await page.evaluate(({id,keys})=>keys.filter(k=>localeData.messages[k][id]!==localeData.messages[k].en),{id,keys:categoryKeys}),[]);
      assert.equal(await snapshot(),stateBefore);
      await page.screenshot({path:path.join(folder,id+'-dark.png')});
      await page.setViewportSize({width:1133,height:744});await page.evaluate(()=>setUIAppearance('theme','light'));await settle();
      for(const [button,panel,close] of [['#uishortcuts','#shortcutspanel','#shortcutsclose'],['#uiexperiments','#experimentspanel',null]]){
        await page.locator(button).click();await settle();
        const bounds=await page.locator(panel).evaluate(e=>({client:e.clientWidth,scroll:e.scrollWidth}));
        assert.ok(bounds.scroll<=bounds.client+1,id+' '+panel+' '+JSON.stringify(bounds));
        await page.screenshot({path:path.join(folder,id+panel+'-light.png')});
        if(close)await page.locator(close).click();else await page.keyboard.press('Escape');
      }
      await page.locator('#uisize').click();await page.locator('#sizelanguage').selectOption('en');await settle();
      await page.locator('#sizelanguage').selectOption(id);await settle();await page.keyboard.press('Escape');
      assert.equal(await page.locator('#language').inputValue(),id);
      await page.setViewportSize({width:430,height:932});await settle();
      assert.ok(await page.locator('#apply').isVisible());
      await page.screenshot({path:path.join(folder,id+'-phone.png')});
      await page.reload();await page.waitForSelector('.node');await freeze();
      assert.equal(await page.locator('html').getAttribute('lang'),id);
      assert.equal(await page.locator('#language').inputValue(),id);assert.equal(await page.locator('#sizelanguage').inputValue(),id);
      checks.push(id+': translated panels and language exceptions, English categories, both pickers, persistence, graph preservation, dark/light and smaller viewports');
    }
    await locale('en');assert.equal(await page.locator('#about').innerText(),'About');
    assert.equal(await page.evaluate(()=>t('panel.parameterTitle')),'Parameter');
    assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);
    checks.push('Switching back restores English with no graph/API writes or browser errors');
    await h.finish();console.log(JSON.stringify({passed:true,count:checks.length}));
  }catch(e){await h.finish(e);throw e;}
}
run().catch(e=>{console.error(e.stack);process.exitCode=1;});
