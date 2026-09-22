/* Reset only this site's TD-Grape preferences; real browser reload, isolated API. */
const assert=require('node:assert/strict'),path=require('node:path');
const {harness}=require('./test_glsl_code.cjs');
const [source,stateFile,folder]=process.argv.slice(2);
(async()=>{
 const h=await harness(source,stateFile,folder),{page,checks,errors,settle}=h;let posts=0;
 page.on('request',r=>{if(r.method()==='POST')posts++;});
 const prefs=()=>page.evaluate(()=>JSON.stringify({language,uiAppearance,experiments:EDITOR_DEV_SETTINGS,layout:workspaceLayout.snapshot(),showCustomNodeNames,showLinkLines,sourceNameMode,sourceMinimal,autoPreview,header:$('#editorheader').hidden}));
 const stored=()=>page.evaluate(()=>Object.fromEntries(browserPreferenceKeys.map(k=>[k,localStorage.getItem(k)])));
 try{
  const defaults=await prefs();
  await page.evaluate(()=>{clearTimeout(autoTimer);autoTimer=null;connectionInterrupted=true;document.activeElement?.blur();editorFieldDrafts.clear();dirty=false;window.confirm=()=>false;for(const k of browserPreferenceKeys)localStorage.setItem(k,'changed');localStorage.setItem('other-application','keep');sessionStorage.setItem('sgrapeToken','keep-access');sessionStorage.setItem('sgrapeDraft:other','keep-other-draft');});
  const saved=await stored();assert.equal(await page.evaluate(()=>resetBrowserPreferences()),false);assert.deepEqual(await stored(),saved);
  checks.push('Cancel retains every preference and does not reload');
  await page.evaluate(()=>window.confirm=()=>true);
  for(const flag of ['submitBusy','nativeMutationBusy','historyBusy','customBusy','nativeSourceBusy','pendingEditorWrites']){
   assert.equal(await page.evaluate(flag=>{eval(flag+'=true');const result=resetBrowserPreferences();eval(flag+'=false');return result;},flag),false);
   assert.deepEqual(await stored(),saved);
  }
  await page.evaluate(()=>{const entry=$('#custompagecreate input');$('#customdialog').show();entry.value='unfinished';editorFieldDrafts.set(entry,'');});
  assert.equal(await page.evaluate(()=>resetBrowserPreferences()),false);assert.deepEqual(await stored(),saved);await page.evaluate(()=>{$('#customdialog').close();editorFieldDrafts.clear();});
  checks.push('Unfinished fields and in-flight writes block reset before any settings are removed');
  assert.equal(await page.evaluate(()=>{
   const original=Storage.prototype.removeItem;let once=true;
   Storage.prototype.removeItem=function(k){if(this===localStorage&&k==='grapeWorkspaceV1'&&once){once=false;throw Error('test');}return original.call(this,k);};
   try{return resetBrowserPreferences();}finally{Storage.prototype.removeItem=original;}
  }),false);assert.deepEqual(await stored(),saved);
  checks.push('A partial storage failure restores removed preferences and does not reload');
  const draft=await page.evaluate(()=>{graph.stages.pixel.nodes[0].ui.x+=13;dirty=true;return JSON.stringify({graph,revision});});
  assert.equal(await page.evaluate(()=>{
   const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(this===sessionStorage&&k===draftKey)throw Error('test draft failure');return original.call(this,k,v);};
   try{return resetBrowserPreferences();}finally{Storage.prototype.setItem=original;}
  }),false);assert.deepEqual(await stored(),saved);
  checks.push('An unsaved graph must be safely retained before clearing preferences');
  await page.evaluate(()=>{$('#status').textContent='';});
  page.on('dialog',d=>d.dismiss()); // Keep the retained draft for explicit later recovery.
  await page.locator('#editormenu').click();assert.ok(await page.locator('#resetbrowserpreferences').isVisible());
  const navigated=page.waitForEvent('framenavigated',f=>f===page.mainFrame());await page.locator('#resetbrowserpreferences').click();await navigated;await page.waitForSelector('.node');await settle();
  assert.equal(await prefs(),defaults);
  assert.equal(await page.evaluate(()=>localStorage.getItem('other-application')),'keep');
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('sgrapeToken')),'keep-access');
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('sgrapeDraft:other')),'keep-other-draft');
  assert.equal(await page.evaluate(()=>sessionStorage.getItem(draftKey)),draft);
  assert.equal(await page.evaluate(()=>localStorage.getItem('grapeWorkspacePresetsV1')),null);
  assert.equal(await page.evaluate(()=>localStorage.getItem('sgrapeInspectorPanels')),null);
  assert.equal(posts,0);checks.push('Footer action restores factory appearance, language, layout and source/experimental preferences; access, all drafts and unrelated storage survive without a TD write');
  await page.selectOption('#language','zh-Hant');await page.locator('#editormenu').click();assert.equal(await page.locator('#resetbrowserpreferences').innerText(),'重設瀏覽器設定…');
  await page.screenshot({path:path.join(folder,'reset-menu.png')});checks.push('The reset entry is available in the lower-left menu in both languages');
  assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,checks}));
 }catch(e){await h.finish(e);throw e;}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
