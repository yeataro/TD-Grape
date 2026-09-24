const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {harness}=require('./test_glsl_code.cjs');
(async()=>{const[source,state,folder]=process.argv.slice(2),h=await harness(source,state,folder,{skipPreview:true}),{page,checks,errors}=h;try{
 await page.selectOption('#language','en');
 await page.evaluate(()=>{nativeSourcePolling=uniformPolling=customPolling=true;uniformLive.disconnect();uniformLive.connect=()=>{};scheduleGraphApply=()=>{};readonly=dirty=connectionInterrupted=false;stage='pixel';graphTrail=[];past=[];future=[];});
 const original=await page.evaluate(()=>clone(graph));
 const keys=await page.evaluate(()=>catalog.filter(d=>/^(texture_proj_(offset|lod_offset|grad_offset)_|texture_gather_offsets?_)/.test(d.key)).map(d=>d.key));assert.equal(keys.length,13);
 for(const key of keys){
  await page.evaluate(()=>{const r=$('#canvas').getBoundingClientRect();openCreator(r.left+250,r.top+200);});
  await page.locator('#createsearch').fill(key);await page.locator(`[data-create-entry="${key}"]`).click();
  const id=await page.evaluate(()=>selected),card=page.locator(`[data-node="${id}"]`);assert.equal(await card.count(),1);
  const ports=await card.locator('.port[data-kind="inputs"]').evaluateAll(es=>Object.fromEntries(es.map(e=>[e.dataset.port,e.dataset.type])));
  assert(ports.sampler.startsWith('sampler'));assert.equal(ports[key.includes('gather_offsets')?'offsets':'offset'],key.includes('gather_offsets')?'ivec2[4]':key.endsWith('1d')?'int':key.endsWith('3d')?'ivec3':'ivec2');
  assert((await page.locator('#nodehelp').innerText()).includes('compile-time'));
  await page.evaluate(()=>undo());assert.equal(await card.count(),0);await page.evaluate(()=>undo(true));assert.equal(await card.count(),1);await page.evaluate(()=>undo());
 }
 checks.push('All 13 entries searchable and creatable with correct offset ports, Help and Undo/Redo');
 await page.evaluate(original=>{graph=original;past=[];future=[];current().nodes.push(testNode('four','array',60,350,{elementType:'ivec2',length:4}),testNode('three','array',60,500,{elementType:'ivec2',length:3}));render();},original);
 const rejected=await page.evaluate(()=>connectionProblem({node:'three',port:'out',kind:'outputs'},{node:'sample',port:'offsets',kind:'inputs'}));assert(rejected);
 const connected=await page.evaluate(()=>connectPorts({node:'four',port:'out',kind:'outputs'},{node:'sample',port:'offsets',kind:'inputs'}));assert.equal(connected,true);
 assert(await page.evaluate(()=>current().edges.some(e=>e.from[0]==='four'&&e.to[0]==='sample')));await page.evaluate(()=>undo());assert(await page.evaluate(()=>current().edges.some(e=>e.from[0]==='offsets'&&e.to[0]==='sample')));
 checks.push('ivec2[4] Array connects; ivec2[3] is rejected; Undo restores the prior source');
 await page.evaluate(()=>{selected='sample';selection=new Set(['sample']);scale=.8;pan={x:30,y:40};render();});
 for(const language of ['en','zh-Hant','ja','fr','ko']){await page.selectOption('#language',language);const help=await page.locator('#nodehelp').innerText();assert(help.includes('ivec2[4]'));assert(!help.includes('help.texture'));}
 checks.push('Five languages retain signature and translated Help');
 await page.selectOption('#language','en');await page.screenshot({path:path.join(folder,'texture-offsets.png')});
 assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,count:checks.length}));
}catch(e){await h.finish(e);throw e;}})().catch(e=>{console.error(e.stack);process.exitCode=1;});
