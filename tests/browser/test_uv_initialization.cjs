/* Reopen a real startup graph containing the fixed-type UV source. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {harness}=require('./test_glsl_code.cjs');
(async()=>{
 const[source,stateFile,folder]=process.argv.slice(2),state=JSON.parse(fs.readFileSync(stateFile,'utf8').replace(/^\uFEFF/,''));
 const node=(key,id,x,y)=>{const d=state.catalog.find(d=>d.key===key);return{id,definitionUuid:d.definitionUuid,revisionHash:d.revisionHash,params:structuredClone(d.defaults),ui:{x,y}};};
 state.state.graph.stages.pixel={nodes:[node('uv','uv',40,40),node('color','color',40,220),node('pixel_out','pixel',400,220)],edges:[{from:['color','out'],to:['pixel','color']}]};
 fs.mkdirSync(folder,{recursive:true});const fixture=path.join(folder,'startup.json');fs.writeFileSync(fixture,JSON.stringify(state));
 const h=await harness(source,fixture,folder,{skipPreview:true}),{page,checks,errors}=h;
 try{
  for(let pass=0;pass<2;pass++){
   if(pass){await page.reload();await page.waitForSelector('#cards [data-node="uv"]');}
   await page.waitForFunction(()=>graph&&!historyBusy);
   assert.equal(await page.locator('#cards .node').count(),3);
   assert.equal(await page.evaluate(()=>vectorNames(current().nodes.find(n=>n.id==='uv'))),'UV');
   assert.equal(await page.evaluate(()=>current().nodes.find(n=>n.id==='uv').params.type),undefined);
   assert.equal(await page.evaluate(()=>$('#status').textContent===t('contract.invalid')),false);
  }
  checks.push('initial load and page reopen render all nodes with a fixed UV source that has no type parameter');
  await page.evaluate(()=>{connectionInterrupted=conflicted=true;addVectorSplit(current().nodes.find(n=>n.id==='uv'),'out');});
  const id=await page.evaluate(()=>selected);
  assert.deepEqual(await page.locator(`#cards [data-node="${id}"] .output .port-label`).allTextContents(),['U','V']);
  assert.deepEqual(await page.locator(`#cards [data-node="${id}"] .output .port`).evaluateAll(es=>es.map(e=>e.dataset.port)),['x','y']);
  await page.evaluate(()=>{selected='uv';selection=new Set(['uv']);render();});
  assert.equal(await page.locator('#cards .node').count(),4);assert.deepEqual(errors,[]);
  checks.push('UV can be selected and split after reopening, retaining U/V labels and x/y socket identities');
  await page.screenshot({path:path.join(folder,'uv-reopened.png')});await h.finish();console.log(JSON.stringify({passed:true,checks}));
 }catch(e){await h.finish(e);throw e;}
})().catch(e=>{console.error(e);process.exitCode=1;});
