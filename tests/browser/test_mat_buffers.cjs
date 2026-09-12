const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const [src,fixture,out]=process.argv.slice(2),state=JSON.parse(fs.readFileSync(fixture));fs.mkdirSync(out,{recursive:true});
const server=http.createServer(async(req,res)=>{
  const route=new URL(req.url,'http://localhost').pathname;
  if(route.startsWith('/api/')){
    res.setHeader('Content-Type','application/json');const op=route.split('/').at(-1);
    if(op==='state')return res.end(JSON.stringify(state));
    if(op==='shaders')return res.end(JSON.stringify({projectFile:'Buffer-test.toe',shaders:[]}));
    if(op==='uniforms')return res.end(JSON.stringify({revision:1,uniforms:{},textures:{}}));
    if(op==='preview'){res.statusCode=204;return res.end();}
    res.statusCode=404;return res.end('{}');
  }
  const file=path.join(src,route==='/'?'index.html':path.basename(route));
  if(!fs.existsSync(file)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));
});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE}),checks=[],errors=[];
  try{
    const page=await browser.newPage({viewport:{width:1540,height:1050}});page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://127.0.0.1:'+server.address().port+'/#fixture');await page.waitForSelector('.node');
    await page.selectOption('#language','en');
    await page.evaluate(()=>{applyGraph=async()=>{clearTimeout(autoTimer);};selectNode(current().nodes.find(n=>n.id==='pixel'));render();fit();});
    assert.equal(await page.locator('[data-pixel-buffer-count]').inputValue(),'1');
    await page.selectOption('[data-pixel-buffer-count]','4');
    assert.equal(await page.locator('[data-node=pixel] .input .port').count(),4);
    assert.deepEqual(await page.locator('[data-node=pixel] .input>span').allTextContents(),['Buffer 0','Buffer 1','Buffer 2','Buffer 3']);
    assert.deepEqual(await page.locator('[data-input=buffer1] input[type=number]').evaluateAll(es=>es.map(e=>Number(e.value))),[0,0,0,0]);
    checks.push('Count selector creates matching named vec4 ports with transparent-zero defaults');
    const source=await page.locator('[data-node=color] .output .port').boundingBox(),target=await page.locator('[data-node=pixel] [data-port=buffer2]').boundingBox();
    await page.mouse.move(source.x+source.width/2,source.y+source.height/2);await page.mouse.down();await page.mouse.move(target.x+target.width/2,target.y+target.height/2,{steps:10});await page.mouse.up();
    assert.equal(await page.evaluate(()=>current().edges.some(e=>e.to[1]==='buffer2')),true);
    await page.selectOption('[data-pixel-buffer-count]','2');
    assert.equal(await page.locator('[data-pixel-buffer-count]').inputValue(),'4');
    assert.equal(await page.evaluate(()=>current().edges.some(e=>e.to[1]==='buffer2')),true);
    checks.push('Real pointer wiring to Buffer 2 succeeds; shrinking cannot silently delete it');
    await page.evaluate(()=>{change(()=>current().edges=current().edges.filter(e=>e.to[1]!=='buffer2'));});
    await page.locator('[data-input=buffer3] input[type=number]').first().fill('0.375');
    await page.locator('[data-input=buffer3] input[type=number]').first().press('Enter');
    await page.selectOption('[data-pixel-buffer-count]','2');await page.selectOption('[data-pixel-buffer-count]','4');
    assert.equal(await page.locator('[data-input=buffer3] input[type=number]').first().inputValue(),'0.375');
    await page.evaluate(()=>undo());assert.equal(await page.locator('[data-pixel-buffer-count]').inputValue(),'2');
    await page.evaluate(()=>undo(true));assert.equal(await page.locator('[data-pixel-buffer-count]').inputValue(),'4');
    checks.push('Resize preserves dormant values and supports undo/redo');
    await page.getByRole('tab',{name:'Settings',exact:true}).click();
    const beforeNames=await page.evaluate(()=>JSON.stringify({declarations:graph.declarations,params:current().nodes.find(n=>n.id==='pixel').params,edges:current().edges}));
    await page.locator('[data-buffer-label=buffer3]').fill('Auxiliary / 輔助');await page.locator('[data-buffer-label=buffer3]').press('Enter');
    assert.equal(await page.locator('[data-node=pixel] .input>span').last().innerText(),'Auxiliary / 輔助');
    assert.equal(await page.evaluate(()=>JSON.stringify({declarations:graph.declarations,params:current().nodes.find(n=>n.id==='pixel').params,edges:current().edges})),beforeNames);
    await page.getByRole('tab',{name:'Parameters',exact:true}).click();await page.selectOption('[data-pixel-buffer-count]','2');await page.selectOption('[data-pixel-buffer-count]','4');
    assert.equal(await page.locator('[data-node=pixel] .input>span').last().innerText(),'Auxiliary / 輔助');
    checks.push('Buffer display names preserve indices and wires, and survive removing/re-adding a slot');

    await page.evaluate(()=>{change(()=>current().edges.push({from:['color','out'],to:['pixel','buffer2']}));openExport();});
    const downloadPromise=page.waitForEvent('download');await page.locator('#exportjsondownload').click();const download=await downloadPromise;
    await download.saveAs(path.join(out,'graph.json'));
    const saved=JSON.parse(fs.readFileSync(path.join(out,'graph.json')));assert.equal(saved.stages.pixel.nodes.find(n=>n.id==='pixel').params.bufferCount,4);
    assert.equal(saved.stages.pixel.nodes.find(n=>n.id==='pixel').ui.bufferLabels.buffer3,'Auxiliary / 輔助');assert.ok(saved.stages.pixel.edges.some(e=>e.to[1]==='buffer2'));checks.push('JSON download preserves the buffer count and additional output wires');
    // Drag-to-create compatibility uses the same actual dynamic output socket.
    await page.evaluate(()=>{const r=$('#canvas').getBoundingClientRect();openCreator(r.left+80,r.top+80,{kind:'inputs',node:'pixel',port:'buffer1',type:'vec4'});});
    await page.fill('#createsearch','Color');assert.ok(await page.locator('#createresults [data-create-entry=color]').count());
    await page.click('#createresults [data-create-entry=color]');assert.equal(await page.evaluate(()=>current().edges.some(e=>e.to[1]==='buffer1')),true);
    checks.push('Floating Add Node creates and connects a compatible value into an additional buffer');
    await page.selectOption('#language','zh-Hant');await page.evaluate(()=>{selectNode(current().nodes.find(n=>n.id==='pixel'));render();fit();});
    assert.match(await page.locator('[data-pixel-buffer-count]').locator('..').innerText(),/數量/);
    await page.screenshot({path:path.join(out,'mat-buffers.png')});
    await page.evaluate(()=>{editorTarget='top';render();});assert.equal(await page.locator('[data-pixel-buffer-count]').count(),0);
    checks.push('Localized control stays MAT-only');
    assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed:true,checks},null,2));console.log(JSON.stringify({passed:true,checks:checks.length}));
  }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
