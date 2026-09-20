/* Browser-local view shortcut: preserve drafts, graph and the existing fullscreen lifecycle. */
const assert=require('node:assert/strict');
const {harness}=require('./test_glsl_code.cjs');
(async()=>{
 const [source,state,folder]=process.argv.slice(2),h=await harness(source,state,folder,{skipPreview:true}),{page,checks,errors,settle}=h;
 const view=()=>page.evaluate(()=>JSON.stringify({graph,revision,dirty,pan,scale,past,future,selected,selection:[...selection],layout:workspaceLayout.snapshot()}));
 const toggle=async active=>{await page.keyboard.press('Alt+Enter');await page.waitForFunction(active=>!!document.fullscreenElement===active,active);await settle();};
 try{
  await page.selectOption('#language','en');const before=await view();
  assert.equal(await page.locator('#uifullscreen').getAttribute('aria-keyshortcuts'),'Alt+Enter');
  assert.match(await page.locator('#uifullscreen').getAttribute('title'),/Alt＋Enter$/);
  assert.deepEqual(await page.locator('[data-shortcut="fullscreen"] kbd').allTextContents(),['Alt','Enter']);
  await page.evaluate(()=>{
   window.draftCommits=0;window.fullscreenClicks=0;
   $('#uifullscreen').addEventListener('click',()=>fullscreenClicks++);
   window.draft=input(1,()=>draftCommits++,'number');$('#inspector').append(draft);draft.focus();draft.value='12';
  });
  await toggle(true);assert.match(await page.locator('#uifullscreen').getAttribute('title'),/^Exit fullscreen.*Alt＋Enter$/);
  await page.evaluate(()=>{
   for(const modifiers of [{repeat:true},{isComposing:true},{ctrlKey:true},{metaKey:true},{shiftKey:true}])
    document.body.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,cancelable:true,key:'Enter',altKey:true,...modifiers}));
  });
  assert.equal(await page.evaluate(()=>fullscreenClicks),1);
  await toggle(false);
  assert.deepEqual(await page.evaluate(()=>({commits:draftCommits,value:draft.value,clicks:fullscreenClicks})),{commits:0,value:'12',clicks:2});
  await page.evaluate(()=>draft.remove());assert.equal(await view(),before);
  checks.push('Alt+Enter enters/exits native fullscreen, preserves a numeric draft, and ignores repeat, composition and extra modifiers');
  await page.locator('#graphfocus').click();await toggle(true);
  assert.equal(await page.locator('.canvas-view-tools #uifullscreen').getAttribute('aria-pressed'),'true');
  await toggle(false);assert.equal(await page.locator('#graphfocus').getAttribute('aria-pressed'),'true');
  await page.locator('#graphfocus').click();assert.equal(await view(),before);
  checks.push('focused graph uses the same shortcut and button without changing view, graph, layout or Undo');
  await page.locator('#uishortcuts').click();await toggle(true);await toggle(false);
  assert.equal(await page.locator('#shortcutspanel').isVisible(),true);await page.locator('#shortcutsclose').click();
  await page.selectOption('#language','zh-Hant');
  assert.match(await page.locator('[data-shortcut="fullscreen"] dt').innerText(),/全螢幕/);
  assert.match(await page.locator('#uifullscreen').getAttribute('title'),/全螢幕.*Alt＋Enter$/);
  checks.push('shortcut works in a modal without closing it; help, tooltip and accessible key metadata stay synchronized in both languages');
  await page.evaluate(()=>{window.originalFullscreen=document.documentElement.requestFullscreen;document.documentElement.requestFullscreen=async()=>{throw Error('denied');};});
  await page.keyboard.press('Alt+Enter');await settle();assert.equal(await page.locator('#uifullscreen').isEnabled(),true);
  assert.equal(await page.locator('#uifullscreen').getAttribute('aria-pressed'),'false');
  await page.evaluate(()=>{document.documentElement.requestFullscreen=undefined;renderViewModes();window.clicksBefore=fullscreenClicks;});
  await page.keyboard.press('Alt+Enter');assert.equal(await page.evaluate(()=>fullscreenClicks===clicksBefore),true);
  await page.evaluate(()=>{document.documentElement.requestFullscreen=originalFullscreen;renderViewModes();});
  await toggle(true);await page.evaluate(()=>document.exitFullscreen());await settle();
  assert.equal(await page.locator('#uifullscreen').getAttribute('aria-pressed'),'false');assert.equal(await view(),before);
  checks.push('denied/unsupported requests and external fullscreen exit retain correct button state and leave the graph untouched');
  await page.evaluate(()=>$('#canvas').focus());await page.keyboard.press('Control+Enter');await settle();
  assert.equal(await page.evaluate(()=>graphFocused),true);assert.match(await page.locator('#graphfocus').getAttribute('title'),/Ctrl＋Enter$/);assert.doesNotMatch(await page.locator('#graphfocus').getAttribute('title'),/Esc/);
  await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>graphFocused),true);
  await page.keyboard.press('Tab');assert.equal(await page.locator('#creator').isVisible(),true);await page.keyboard.press('Escape');assert.equal(await page.locator('#creator').isVisible(),false);assert.equal(await page.evaluate(()=>graphFocused),true);
  await page.evaluate(()=>$('#canvas').focus());await page.keyboard.press('Control+Enter');await settle();assert.equal(await page.evaluate(()=>graphFocused),false);assert.equal(await view(),before);
  checks.push('Ctrl Enter toggles graph focus both ways; Escape cancels Creator but never exits focus, without modifying layout, graph or selection');
  await page.evaluate(()=>{
   $('#canvas').focus();
   for(const modifiers of [{repeat:true},{isComposing:true},{shiftKey:true},{altKey:true},{metaKey:true}])
    $('#canvas').dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,cancelable:true,key:'Enter',ctrlKey:true,...modifiers}));
   window.focusTextCommits=0;const e=document.createElement('textarea');e.id='focus-draft';e.value='draft';e.onkeydown=event=>{if(event.ctrlKey&&event.key==='Enter'){focusTextCommits++;event.preventDefault();}};$('#canvas').append(e);e.focus();
  });await page.keyboard.press('Control+Enter');assert.equal(await page.evaluate(()=>focusTextCommits),1);assert.equal(await page.evaluate(()=>graphFocused),false);await page.evaluate(()=>$('#focus-draft').remove());
  await page.locator('#uishortcuts').click();await page.keyboard.press('Control+Enter');assert.equal(await page.evaluate(()=>graphFocused),false);assert.deepEqual(await page.locator('[data-shortcut="focusGraph"] kbd').allTextContents(),['Ctrl','Enter']);await page.keyboard.press('Escape');
  await page.evaluate(()=>{$('#canvas').focus();$('#canvas').onpointermove=()=>{};});await page.keyboard.press('Control+Enter');assert.equal(await page.evaluate(()=>graphFocused),false);await page.evaluate(()=>{$('#canvas').onpointermove=null;});
  await page.keyboard.press('Meta+Enter');assert.equal(await page.evaluate(()=>graphFocused),true);await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>graphFocused),true);await page.keyboard.press('Meta+Enter');assert.equal(await page.evaluate(()=>graphFocused),false);
  assert.equal(await view(),before);
  checks.push('focus shortcut ignores repeat/composition/extra modifiers and active gestures, respects modal Help and preserves Ctrl Enter text commit');
  assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,checks}));
 }catch(error){await h.finish(error);throw error;}
})().catch(error=>{console.error(error);process.exitCode=1;});
