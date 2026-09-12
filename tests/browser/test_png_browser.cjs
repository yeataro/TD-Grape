// Actual Chromium PNG exchange with an isolated Shader service fixture.
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const [source,snapshotFile,folder,overlay]=process.argv.slice(2),original=JSON.parse(fs.readFileSync(snapshotFile,'utf8').replace(/^\uFEFF/,''));
fs.mkdirSync(folder,{recursive:true});
const ordinaryPng=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNIMGj4DwAEFAIQv7rKSQAAAABJRU5ErkJggg==','base64');
let state=structuredClone(original),applies=0,uniformWrites=0,external=false;const checks=[],errors=[];
const components=[1,1,1,1].map((value,i)=>({parameter:'Tint'+'xyzw'[i],value,mode:'CONSTANT',writable:true}));
const snapshot=()=>({revision:state.state.revision,uniforms:{uniform_tint:{type:'vec4',default:[1,1,1,1],components}},textures:{}});
const server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost');res.setHeader('Cache-Control','no-store');
  if(url.pathname.startsWith('/api/')){
    res.setHeader('Content-Type','application/json');const operation=url.pathname.split('/').at(-1);let text='';for await(const chunk of req)text+=chunk;const body=text?JSON.parse(text):null;
    if(operation==='state')return res.end(JSON.stringify(state));
    if(operation==='uniforms')return res.end(JSON.stringify(snapshot()));
    if(operation==='uniform-value'){
      uniformWrites++;const item=components[body.component];if(external||!item.writable||body.expected.value!==item.value){res.statusCode=409;return res.end('{"error":"TD value changed; preserved"}');}
      item.value=body.value;return res.end(JSON.stringify(snapshot()));
    }
    if(operation==='inspect')return res.end(JSON.stringify({status:'valid',candidate:body.graph,issues:[],repairs:[]}));
    if(operation==='export')return res.end(JSON.stringify({path:'/fixture/graph.json'}));
    if(operation==='apply'){applies++;state.state.graph=body.graph;state.state.revision++;return res.end(JSON.stringify(state));}
    if(operation==='preview'){res.setHeader('Content-Type','image/png');return res.end(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a8xkAAAAASUVORK5CYII=','base64'));}
    res.statusCode=404;return res.end('{}');
  }
  const file=url.pathname.startsWith('/shader/')?'index.html':url.pathname.slice(1);if(!/^[a-z0-9_.-]+$/i.test(file)){res.statusCode=404;return res.end();}
  const target=overlay&&fs.existsSync(path.join(overlay,file))?path.join(overlay,file):path.join(source,file);
  if(!fs.existsSync(target)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'})[path.extname(file)]||'text/plain');res.end(fs.readFileSync(target));
});
let browser;
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE});
 const page=await browser.newPage({viewport:{width:1600,height:1000}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/shader/'+'a'.repeat(32)+'/#fixture');await page.waitForFunction(()=>typeof graph!=='undefined'&&graph);
 const initial=await page.evaluate(()=>JSON.stringify(graph)),view=await page.evaluate(()=>JSON.stringify({pan,scale,stage,graphTrail,past,future}));
 const download=async(name)=>{await page.locator('#export').click();const event=page.waitForEvent('download',{timeout:5000}).catch(async e=>{console.log(await page.locator('#exportstatus').innerText());throw e;});await page.locator('#exportpng').click();const file=await event;await file.saveAs(path.join(folder,name));return fs.readFileSync(path.join(folder,name));};
 const bytes=await download('diagram.png');const decoded=await page.evaluate(async bytes=>{const data=new Uint8Array(bytes),image=await createImageBitmap(new Blob([data],{type:'image/png'})),info={width:image.width,height:image.height,raw:PngGraph.extract(data).raw};image.close();return info;},[...bytes]);assert.equal(decoded.raw,initial);assert.ok(decoded.width<=4096&&decoded.height<=4096);assert.equal(await page.evaluate(()=>JSON.stringify({pan,scale,stage,graphTrail,past,future})),view);assert.equal(applies,0);checks.push('actual PNG download decodes and includes exact full graph without viewport, history or TD writes');
 await page.evaluate(()=>enterFunction(graph.stages.pixel.nodes.find(n=>n.id==='filter')));const nested=await download('function-diagram.png');const extracted=await page.evaluate(bytes=>PngGraph.extract(new Uint8Array(bytes)),[...nested]);assert.equal(extracted.raw,initial);assert.ok(extracted.view.functionIds.length);checks.push('Function-level diagram retains full Shader and nested definitions in metadata');await page.evaluate(()=>navigateGraph(0));
 await page.evaluate(()=>change(()=>graph.name='Before PNG import',{localize:false}));await page.waitForFunction(()=>!dirty);const beforeImport=await page.evaluate(()=>JSON.stringify(graph));
 await page.locator('#file').setInputFiles(path.join(folder,'diagram.png'));await page.waitForFunction(()=>importReview?.candidate);assert.equal(await page.evaluate(()=>JSON.stringify(graph)),beforeImport);assert.equal(await page.locator('#importraw').textContent(),initial);checks.push('PNG import enters existing review without applying the graph');
 const originalDownload=page.waitForEvent('download');await page.locator('#importdownload').click();await (await originalDownload).saveAs(path.join(folder,'original.png'));assert.deepEqual(fs.readFileSync(path.join(folder,'original.png')),bytes);checks.push('original download preserves exact PNG bytes');
 await page.locator('#importaccept').click();await page.waitForFunction(()=>!dirty);assert.equal(await page.evaluate(()=>JSON.stringify(graph)),initial);await page.locator('#undo').click();await page.waitForFunction(()=>!dirty);assert.equal(await page.evaluate(()=>JSON.stringify(graph)),beforeImport);await page.locator('#redo').click();await page.waitForFunction(()=>!dirty);assert.equal(await page.evaluate(()=>JSON.stringify(graph)),initial);checks.push('explicit acceptance, Undo and Redo preserve complete graph');
 await page.locator('#file').setInputFiles({name:'renamed.json',mimeType:'application/json',buffer:bytes});await page.waitForFunction(()=>importReview?.candidate);assert.equal(await page.evaluate(()=>importReview.isPng),true);await page.evaluate(()=>change(()=>graph.name='Concurrent edit',{localize:false}));await page.locator('#importaccept').click();assert.equal(await page.evaluate(()=>graph.name),'Concurrent edit');assert.equal(await page.locator('#importaccept').isDisabled(),true);await page.locator('#closeimport').click();await page.waitForFunction(()=>!dirty);checks.push('signature detection survives rename and concurrent edits block stale acceptance');
 await page.locator('#file').setInputFiles({name:'ordinary.png',mimeType:'image/png',buffer:ordinaryPng});await page.waitForFunction(()=>importReview?.status==='blocked');assert.equal(await page.locator('#importdownload').isDisabled(),false);assert.ok((await page.locator('#importstatus').innerText()).includes('metadata'));await page.locator('#closeimport').click();checks.push('ordinary PNG is blocked with metadata guidance and original file remains available');
 const corrupt=Buffer.from(bytes);corrupt[40]^=1;await page.locator('#file').setInputFiles({name:'damaged.png',mimeType:'image/png',buffer:corrupt});await page.waitForFunction(()=>importReview?.status==='blocked');assert.equal(await page.locator('#importaccept').isDisabled(),true);await page.locator('#closeimport').click();checks.push('damaged image rejected before import inspection');
 let canceledDownloads=0;const countDownload=()=>canceledDownloads++;page.on('download',countDownload);
 await page.evaluate(()=>{window.originalToBlob=HTMLCanvasElement.prototype.toBlob;HTMLCanvasElement.prototype.toBlob=function(cb,...args){return window.originalToBlob.call(this,blob=>setTimeout(()=>cb(blob),1000),...args);};});
 await page.locator('#export').click();await page.locator('#exportpng').click();await page.locator('#closeexport').click();await page.waitForTimeout(1200);assert.equal(canceledDownloads,0);
 await page.evaluate(()=>{HTMLCanvasElement.prototype.toBlob=window.originalToBlob;delete window.originalToBlob;});page.removeListener('download',countDownload);checks.push('closing export during encoding cancels the pending download');
 const bounded=await page.evaluate(()=>{const n=current().nodes[0],saved={...n.ui};try{n.ui.x=100000;n.ui.y=100000;render();const value=graphPngCanvas();return {width:value.canvas.width,height:value.canvas.height,reduced:value.reduced};}finally{n.ui=saved;render();}});assert.ok(bounded.width<=4096&&bounded.height<=4096&&bounded.reduced);checks.push('large graph image dimensions remain bounded while metadata is complete');
 await page.selectOption('#language','en');await page.setViewportSize({width:420,height:720});await page.locator('#export').click();assert.equal(await page.locator('#exporttitle').innerText(),'Export Shader graph');const box=await page.locator('#exportdialog').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=420);await page.screenshot({path:path.join(folder,'export-dialog.png')});await page.locator('#exportjson').click();await page.waitForFunction(()=>!document.querySelector('#exportdialog').open);assert.ok((await page.locator('#status').innerText()).includes('/fixture/graph.json'));checks.push('compact bilingual export chooser preserves existing JSON export');
 assert.deepEqual(errors,[]);checks.push('no browser errors');fs.writeFileSync(path.join(folder,'browser-tests.json'),JSON.stringify({passed:true,count:checks.length,checks,diagramSize:{width:decoded.width,height:decoded.height}},null,2));console.log(JSON.stringify({passed:true,count:checks.length}));
})().catch(e=>{console.error(e);fs.writeFileSync(path.join(folder,'browser-tests.json'),JSON.stringify({passed:false,checks,errors,error:e.message},null,2));process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});
