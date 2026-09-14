/* Isolated fixture API, never applies edits to TD.
 * node test_glsl_code.cjs SOURCE_DIR STATE_JSON REPORT_DIR
 */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
async function harness(source,stateFile,folder,{headerOnly=false,touch=false}={}){
  const state=JSON.parse(fs.readFileSync(stateFile,'utf8').replace(/^\uFEFF/,''));fs.mkdirSync(folder,{recursive:true});
  const errors=[],checks=[];
  const server=http.createServer(async(req,res)=>{
    const name=new URL(req.url,'http://localhost').pathname;res.setHeader('Cache-Control','no-store');
    if(name.startsWith('/api/')){
      let raw='';for await(const c of req)raw+=c;const operation=name.split('/').at(-1);res.setHeader('Content-Type','application/json');
      if(operation==='state')return res.end(JSON.stringify(state));
      if(operation==='apply'){state.state.graph=JSON.parse(raw).graph;state.state.revision++;return res.end(JSON.stringify(state));}
      if(operation==='uniforms')return res.end(JSON.stringify({revision:state.state.revision,uniforms:{},textures:{}}));
      if(operation==='preview'){res.statusCode=204;return res.end();}
      res.statusCode=404;return res.end('{}');
    }
    const fileName=name==='/'?'index.html':name.slice(1);
    if(!/^[a-z0-9_.-]+$/i.test(fileName)){res.statusCode=404;return res.end();}
    const file=path.join(source,fileName);if(!fs.existsSync(file)){res.statusCode=404;return res.end();}
    res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');
    let body=fs.readFileSync(file);if(headerOnly&&fileName==='graph_ui.js')body=body.toString().replace('nodeBodyDrag: true','nodeBodyDrag: false');res.end(body);
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE});
  const page=await browser.newPage({viewport:{width:1600,height:1100},hasTouch:touch});page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForSelector('.node');await page.evaluate(()=>document.fonts.ready);
  await page.evaluate(()=>{clearTimeout(autoTimer);connectionInterrupted=true;window.testNode=(id,key,x,y,params={})=>{
    const d=catalog.find(d=>d.key===key);return{id,definitionUuid:d.definitionUuid,revisionHash:d.revisionHash,params:{...clone(d.defaults),...params},ui:{x,y}};
  };});
  const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const at=async selector=>{const r=await page.locator(selector).boundingBox();assert.ok(r,selector);return{x:r.x+r.width/2,y:r.y+r.height/2};};
  const drag=async(a,b)=>{await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:8});await settle();await page.mouse.up();await settle();};
  const finish=async(error)=>{
    fs.writeFileSync(path.join(folder,'results.json'),JSON.stringify({passed:!error,count:checks.length,checks,errors,...(error?{error:error.stack}:{} )},null,2));
    if(error)await page.screenshot({path:path.join(folder,'failure.png')}).catch(()=>{});
    await browser.close();await new Promise(r=>server.close(r));
  };
  return{page,browser,checks,errors,at,drag,settle,finish};
}
async function run(){
  const[source,stateFile,folder]=process.argv.slice(2),h=await harness(source,stateFile,folder),{page,checks,errors,settle}=h;
  try{
    await page.evaluate(()=>{graph.declarations=[];graph.functions=[];graph.stages.pixel={nodes:[testNode('pixel','pixel_out',600,80)],edges:[]};stage='pixel';graphTrail=[];past=[];future=[];selected=null;selection.clear();readonly=false;render();scale=1;pan={x:30,y:50};transform();const r=$('#canvas').getBoundingClientRect();openCreator(r.left+160,r.top+200);});
    await page.locator('#createsearch').fill('custom GLSL');
    assert.equal(await page.locator('[data-create-entry="glsl_code"]').getAttribute('data-browser-category'),'shader');
    await page.locator('[data-create-entry="glsl_code"]').click();await page.locator('[data-code-body]').waitFor();
    const id=await page.evaluate(()=>selected);assert.ok(id);assert.ok((await page.locator('[data-code-header]').innerText()).includes('void add(in float a, in float b, out float c)'));
    checks.push('GLSL Code is discoverable by alias in Shader; created and edited in Parameter');
    await page.locator('[data-code-add="outputs"]').click();
    const output=await page.evaluate(()=>current().nodes.find(n=>n.id===selected).params.outputs[1].id);
    const row=()=>page.locator('[data-code-port="'+output+'"]');
    await row().locator('input').fill('colour');await row().locator('input').press('Enter');await row().locator('select').selectOption('vec4');
    await page.locator('[data-code-body]').fill('c = a + b;\ncolour = vec4(c);');await page.locator('[data-code-body]').press('Control+Enter');
    assert.ok((await page.locator('[data-code-header]').innerText()).includes('out vec4 colour'));assert.ok((await page.locator(`[data-node="${id}"]`).innerText()).includes('colour'));
    await page.evaluate(({id,output})=>connectPorts({node:id,kind:'outputs',port:output},{node:'pixel',kind:'inputs',port:'color'}),{id,output});
    await row().locator('[data-code-move="-1"]').click();
    assert.equal(await page.evaluate(()=>current().nodes.find(n=>n.id===selected).params.outputs[0].name),'colour');
    assert.deepEqual(await page.evaluate(()=>current().edges[0].from),[id,output]);checks.push('multiple typed outputs have clear labels; reorder keeps existing wires and stable port IDs');
    const before=await page.evaluate(()=>JSON.stringify(graph)),history=await page.evaluate(()=>past.length);
    await row().locator('[data-code-remove]').click();assert.equal(await page.evaluate(()=>JSON.stringify(graph)),before);assert.equal(await page.evaluate(()=>past.length),history);
    await row().locator('input').fill('a');await row().locator('input').press('Enter');assert.equal(await row().locator('input').inputValue(),'colour');
    await page.locator('[data-code-function]').fill('gl_invalid');await page.locator('[data-code-function]').press('Enter');assert.equal(await page.locator('[data-code-function]').inputValue(),'add');
    checks.push('connected port removal, duplicate names and reserved function names are rejected without changing graph/history');
    await page.locator('[data-code-body]').fill('c = 0.75;\ncolour = vec4(c);');await page.locator('[data-code-body]').press('Control+Enter');
    await page.locator('#undo').click();assert.equal(await page.locator('[data-code-body]').inputValue(),'c = a + b;\ncolour = vec4(c);');await page.locator('#redo').click();assert.equal(await page.locator('[data-code-body]').inputValue(),'c = 0.75;\ncolour = vec4(c);');
    checks.push('body edit is one Undo/Redo operation');
    await page.locator('[data-code-body]').fill('c = 0.25;\ncolour = vec4(c);');await page.evaluate(()=>inspector());assert.equal(await page.locator('[data-code-body]').inputValue(),'c = 0.25;\ncolour = vec4(c);');await page.locator('[data-code-body]').press('Control+Enter');
    checks.push('an uncommitted body survives a Parameter redraw');
    await page.locator('[data-code-body]').fill('c = 0.2;\ncolour = vec4(c);');await page.locator('[data-code-add="inputs"]').click();assert.equal(await page.evaluate(()=>current().nodes.find(n=>n.id===selected).params.inputs.length),3);checks.push('clicking an interface action also commits a pending body without swallowing the click');
    await page.evaluate(id=>{setCompileDiagnostics({error:'test body error',diagnostics:[{node:id,stage:'pixel',trail:[],codeLine:2,message:'test body error'}]},JSON.stringify(graph));locateCompileIssue({node:id,nodeId:id,stage:'pixel',trail:[],codeLine:2});},id);
    const focused=await page.locator('[data-code-body]').evaluate(e=>({focused:e===document.activeElement,selected:e.value.slice(e.selectionStart,e.selectionEnd)}));assert.equal(focused.focused,true);assert.equal(focused.selected,'colour = vec4(c);');checks.push('native body-line diagnostics focus and select the editable failing line');
    await page.setViewportSize({width:1133,height:744});await settle();
    const overflow=await page.locator('.glsl-code-panel').evaluate(e=>({width:e.clientWidth,scroll:e.scrollWidth}));assert.ok(overflow.scroll<=overflow.width+1,JSON.stringify(overflow));
    await page.screenshot({path:path.join(folder,'code-parameter.png')});checks.push('Parameter controls fit the tablet-size viewport without horizontal overflow');
    fs.writeFileSync(path.join(folder,'code-graph.json'),await page.evaluate(()=>JSON.stringify(graph)));
    await page.evaluate(()=>{readonly=true;inspector();});assert.equal(await page.locator('[data-code-body]').getAttribute('readonly'),'');assert.equal(await page.locator('[data-code-add="inputs"]').isDisabled(),true);assert.equal(await page.locator('[data-code-function]').isDisabled(),true);checks.push('read-only graphs disable interface and body editing');
    assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,count:checks.length}));
  }catch(e){await h.finish(e);throw e;}
}
module.exports={harness};if(require.main===module)run().catch(e=>{console.error(e.stack);process.exitCode=1;});
