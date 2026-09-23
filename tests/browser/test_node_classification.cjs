const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {harness}=require('./test_glsl_code.cjs');
(async()=>{
 const [source,fixture,folder]=process.argv.slice(2),h=await harness(source,fixture,folder,{skipPreview:true}),{page,checks,errors}=h;
 try{
  await page.selectOption('#language','en');
  const snapshot=await page.evaluate(()=>JSON.stringify(graph));
  const inventory=await page.evaluate(()=>{
   const result={},previous=[editorTarget,stage],saved=clone(graph);graph.stages.vertex||={nodes:[],edges:[]};
   for(const [target,s]of [['top','pixel'],['mat','vertex'],['mat','pixel']]){
    editorTarget=target;stage=s;
    result[target+'/'+s]=browserIndex().map(e=>({key:browserEntryKey(e.d),path:e.meta.path,source:e.meta.source,creatorPath:creatorMeta(e.d).path}));
   }
   [editorTarget,stage]=previous;graph=saved;return result;
  });
  for(const rows of Object.values(inventory))for(const e of rows){
   assert.notEqual(e.path[0],'uncategorized',e.key);assert.deepEqual(e.creatorPath,e.path,e.key);
   assert(['editor','td','glsl'].includes(e.source),e.key+': '+e.source);
  }
  const top=inventory['top/pixel'];
  for(const [key,category]of [['router','editor'],['comment','editor'],['generated_glsl','editor'],['math','math'],['switch','logic'],['cross','vector'],['texture_grad_2d','texture'],['td_lighting','shader'],['matrix_split','matrix']]){
   const entry=Object.values(inventory).flat().find(e=>e.key===key);assert.equal(entry?.path[0],category,key);
  }
  assert(top.some(e=>e.key==='top_input'&&e.path.join('/')==='inputs/textures/topInputs'));
  assert(!top.some(e=>e.key==='sampler'));assert(inventory['mat/pixel'].some(e=>e.key==='sampler'));
  assert(!top.some(e=>e.key==='td_lighting'));
  checks.push('All available definitions classify in TOP/MAT stages; creator matches sidebar, source and stage filters remain intact');
  for(const lang of ['en','zh-Hant']){
   await page.selectOption('#language',lang);
   const labels=await page.evaluate(()=>browserIndex().flatMap(e=>e.meta.path.map((key,i)=>i?browserBranchLabel(key):browserCategoryLabel(key))));
   assert(labels.every(label=>!label.startsWith('browser.')&&!label.startsWith('sources.')),labels.filter(label=>label.includes('.')));
  }
  await page.selectOption('#language','en');
  await page.locator('#search').fill('sTDNoiseMap');
  await page.locator('#browsersource').selectOption('td');
  const found=await page.locator('#browsersearchitems [data-entry]').evaluateAll(es=>es.map(e=>e.dataset.entry));
  assert(found.includes('builtin:sTDNoiseMap'));
  await page.locator('[data-entry="builtin:sTDNoiseMap"]').click();
  assert.match(await page.locator('#browserdetail .browser-category-path').innerText(),/^Source/);
  await page.locator('#browsersource').selectOption('glsl');
  assert.equal(await page.locator('#browsersearchitems [data-entry="builtin:sTDNoiseMap"]').count(),0);
  await page.locator('#browsersource').selectOption('all');await page.locator('#search').fill('');
  checks.push('Source paths reuse bilingual Sources labels, exact source search and provenance filtering');
  assert.equal(await page.evaluate(()=>JSON.stringify(graph)),snapshot);
  await page.locator('#browser-section-categories > summary').click();
  await page.locator('#nodes [data-branch="editor"] > summary').click();
  assert.deepEqual((await page.locator('#nodes [data-branch="editor"] [data-entry]').evaluateAll(es=>es.map(e=>e.dataset.entry))).sort(),['comment','generated_glsl','router']);
  const count=await page.evaluate(()=>current().nodes.length);
  await page.locator('#nodes [data-add-entry="router"]').click();
  assert.equal(await page.evaluate(()=>definition(current().nodes.find(n=>n.id===selected)).key),'router');
  await page.evaluate(()=>undo());assert.equal(await page.evaluate(()=>current().nodes.length),count);
  checks.push('Editor contains only Router, Note and Generated GLSL; real insertion and Undo preserve existing semantics');
  await page.evaluate(()=>{const r=$('#canvas').getBoundingClientRect();openCreator(r.left+250,r.top+220);});
  await page.locator('[data-create-path=\'["editor"]\']').click();
  assert.deepEqual((await page.locator('#createresults [data-create-entry]').evaluateAll(es=>es.map(e=>e.dataset.createEntry))).sort(),['comment','generated_glsl','router']);
  await page.locator('#createsearch').fill('cross');assert.equal(await page.locator('[data-create-entry="cross"]').getAttribute('data-browser-category'),'vector');
  await page.evaluate(()=>closeCreator());
  await page.locator('#nodes [data-branch="matrix"] > summary').click();
  assert.equal(await page.locator('#nodes [data-branch="matrix"] > .browser-tree-children > details').count(),3);
  checks.push('Floating creator navigates Editor and global search; Matrix retains construction/access, algebra and transform subgroups');
  for(const theme of ['dark','light']){
   await page.evaluate(theme=>{document.documentElement.dataset.uiTheme=theme;},theme);
   await page.screenshot({path:path.join(folder,'classification-'+theme+'.png')});
  }
  fs.writeFileSync(path.join(folder,'inventory.json'),JSON.stringify(inventory,null,2));
  assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,checks}));
 }catch(e){await h.finish(e);throw e;}
})().catch(e=>{console.error(e);process.exitCode=1});
