const assert=require('node:assert/strict'),path=require('node:path');
const {harness}=require('./test_glsl_code.cjs');
(async()=>{
 const[source,state,folder]=process.argv.slice(2),h=await harness(source,state,folder,{skipPreview:true}),{page,checks,errors}=h;
 try{
  await page.evaluate(()=>{nativeSourcePolling=uniformPolling=customPolling=true;uniformLive.disconnect();uniformLive.connect=()=>{};inputCollapsedGroups.clear();workspaceLayout.reveal('uniforms');stage='vertex';render();});
  assert.equal(await page.locator('[data-input-group="common.coordinates"] [data-builtin-reference="TDTexCoord"]').count(),1);
  assert.equal(await page.locator('[data-input-group="tdBuiltin.geometry"] [data-builtin-reference="TDNormal"]').count(),1);
  assert.equal(await page.locator('[data-input-group="tdBuiltin.geometry"] [data-input-group="attribute"]').count(),1);
  await page.locator('#inputsearch').fill('Normal');
  assert.equal(await page.locator('[data-builtin-reference="TDNormal"]').count(),1);
  await page.locator('[data-builtin-reference="TDNormal"]').click();
  assert.equal(await page.evaluate(()=>current().nodes.find(n=>n.id===selected).params.source),'TDNormal');
  checks.push('MAT Vertex accessors and configured Attributes share Geometry; aliases search and create the original source');
  await page.locator('#inputsearch').fill('');
  await page.evaluate(()=>{stage='pixel';render();});
  assert.equal(await page.locator('[data-builtin-reference="TDNormal"]').count(),0);
  assert.equal(await page.locator('[data-builtin-reference="gl_FragCoord"]').count(),1);
  checks.push('changing Stage removes Vertex-only references while preserving Pixel common sources');
  await page.evaluate(()=>{editorTarget='top';stage='pixel';render();});
  for(const kind of ['2d','3d','2dArray','cube'])assert.equal(await page.locator(`[data-input-group="textures.${kind}"]`).count(),1);
  assert.equal(await page.locator('[data-input-group="textures"] > .input-group-items > [data-input-group="top_input"]').count(),1);
  assert.equal(await page.locator('[data-input-group="textures.tdInputs"] [data-input-group="textures.2d"]').count(),1);
  assert.equal(await page.locator('[data-input-group="textures.1d"]').count(),0);
  assert.equal(await page.locator('[data-input-group="attribute"]').count(),0);
  await page.evaluate(()=>{window.savedBuiltin=document.querySelector('[data-builtin-reference="uTDOutputInfo"]');renderNativeSources();});
  assert.equal(await page.evaluate(()=>savedBuiltin===document.querySelector('[data-builtin-reference="uTDOutputInfo"]')),true);
  checks.push('TOP texture dimensions and info/count come from catalog, with no invented 1D input or MAT Attribute creation; refresh retains entry DOM');
  await page.screenshot({path:path.join(folder,'source-menu.png')});assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,checks}));
 }catch(e){await h.finish(e);throw e;}
})().catch(e=>{console.error(e);process.exitCode=1;});
