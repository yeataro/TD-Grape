/* Focused Inputs removal regression. Local fixture server; never connects to TD.
 * node test_input_removal.cjs SOURCE_DIR STATE_JSON REPORT_DIR
 * STATE_JSON is a current editor state fixture with the standard node catalog.
 */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const [source,stateFile,folder]=process.argv.slice(2);
const copy=value=>JSON.parse(JSON.stringify(value));
const fixture=JSON.parse(fs.readFileSync(stateFile,'utf8').replace(/^\uFEFF/,''));
fs.mkdirSync(folder,{recursive:true});
const uniform=(id,missing=false)=>({id,kind:'uniform',name:'u'+id,type:'float',value:0,...(missing?{sourceMissing:true}:{})});
const reference=(id,sourceId,kind='uniform')=>{
  const def=fixture.catalog.find(d=>d.key===kind);assert.ok(def,'Fixture needs '+kind);
  return{id,definitionUuid:def.definitionUuid,revisionHash:def.revisionHash,params:{...copy(def.defaults),declarationId:sourceId},ui:{x:80,y:380}};
};
const initial=copy(fixture.state.graph);
initial.declarations=[uniform('Live'),...Array.from({length:4},(_,i)=>uniform('Missing'+i,true)),uniform('Used',true),uniform('Nested',true),uniform('Blocked'),
  {id:'LocalConstant',kind:'constant',name:'LocalConstant',type:'float',value:1,sourceMissing:true},
  {id:'LocalSampler',kind:'sampler',name:'LocalSampler',type:'sampler2D',source:'op:/fixture/texture',sourceMissing:true}];
initial.stages.pixel.nodes.push(reference('used_ref','Used'));
initial.functions.push({id:'hidden_function',name:'Hidden reference',scope:'local',stages:['pixel'],inputs:[],outputs:[],graph:{nodes:[reference('nested_ref','Nested')],edges:[]}});
fixture.state.graph=copy(initial);fixture.upgradeReview=null;
let nativeGraph=copy(initial),nativeRevision=fixture.state.revision,sourceChanged=false,applyFailures=0;
const writes=[],errors=[],checks=[],dialogs=[];
const references=(document,id)=>[...Object.values(document.stages),...(document.functions||[]).map(f=>f.graph)].flatMap(g=>g.nodes).filter(n=>n.params?.declarationId===id);
const snapshot=()=>({enabled:true,revision:nativeRevision,sourceChanged,graph:copy(nativeGraph),declarations:copy(nativeGraph.declarations),issues:[],topInputs:[],uniforms:nativeGraph.declarations.filter(d=>d.kind==='uniform').map(d=>({
  id:d.id,name:d.name,type:d.type,missing:!!d.sourceMissing,pending:false,nameWritable:!d.sourceMissing,expected:d.sourceMissing?null:d.id+':'+nativeRevision,sequence:'vector',
  components:[{parameter:'value',value:d.value,mode:'CONSTANT',writable:!d.sourceMissing,modeWritable:true,expression:'',modeExpected:'CONSTANT'}]
}))});
const server=http.createServer(async(req,res)=>{
  try{
    const route=new URL(req.url,'http://localhost').pathname;res.setHeader('Cache-Control','no-store');
    if(route.startsWith('/api/')){
      let raw='';for await(const chunk of req)raw+=chunk;const body=raw?JSON.parse(raw):{},operation=route.split('/').at(-1);
      res.setHeader('Content-Type','application/json');
      if(operation==='state')return res.end(JSON.stringify(fixture));
      if(operation==='sources')return res.end(JSON.stringify(snapshot()));
      if(operation==='shaders')return res.end(JSON.stringify({projectFile:'Inputs-removal.toe',shaders:[]}));
      if(operation==='uniforms')return res.end(JSON.stringify({revision:nativeRevision,uniforms:{},textures:{}}));
      if(operation==='preview'){res.statusCode=204;return res.end();}
      if(operation==='source-edit'){
        assert.equal(body.action,'remove');assert.equal(body.revision,nativeRevision);
        const decl=nativeGraph.declarations.find(d=>d.id===body.id);assert.ok(decl);assert.equal(body.expected,decl.sourceMissing?null:decl.id+':'+nativeRevision);
        assert.equal(references(nativeGraph,body.id).length,0,'This fixture only accepts unreferenced removal');
        writes.push(copy(body));nativeGraph.declarations=nativeGraph.declarations.filter(d=>d.id!==body.id);nativeRevision++;sourceChanged=true;
        return res.end(JSON.stringify(snapshot()));
      }
      if(operation==='apply'){
        assert.equal(body.revision,nativeRevision);
        if(body.graph.declarations.some(d=>d.sourceMissing&&references(body.graph,d.id).length)){
          applyFailures++;res.statusCode=422;return res.end(JSON.stringify({error:'Uniform source missing: uUsed',diagnostics:[]}));
        }
        nativeGraph=copy(body.graph);nativeRevision++;sourceChanged=false;fixture.state={graph:copy(nativeGraph),revision:nativeRevision};
        return res.end(JSON.stringify({state:fixture.state,target:fixture.target}));
      }
      res.statusCode=404;return res.end('{}');
    }
    const name=route==='/'?'index.html':route.slice(1);
    if(!/^[a-z0-9_.-]+$/i.test(name)){res.statusCode=404;return res.end();}
    const file=path.join(source,name);if(!fs.existsSync(file)){res.statusCode=404;return res.end();}
    res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));
  }catch(error){errors.push('fixture: '+error.message);res.statusCode=500;res.end(JSON.stringify({error:error.message}));}
});
(async()=>{
  let browser,page,failure;let acceptDialog=true;
  try{
    await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE});
    page=await browser.newPage({viewport:{width:1560,height:1050}});page.on('pageerror',e=>errors.push(e.message));
    page.on('dialog',async dialog=>{dialogs.push(dialog.message());await(acceptDialog?dialog.accept():dialog.dismiss());});
    await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForSelector('.node');await page.selectOption('#language','en');
    // Control debounce timing only. Explicit failure below still runs the real Apply path.
    await page.evaluate(()=>{clearTimeout(autoTimer);window.removalActualApply=applyGraph;applyGraph=async()=>{clearTimeout(autoTimer);autoTimer=null;};});
    await page.waitForFunction(()=>nativeSourceSnapshot?.enabled);await page.evaluate(()=>workspaceLayout.reveal('uniforms'));
    const selectSource=async id=>{await page.locator('[data-input-source="'+id+'"] .input-source-select').click();};
    const nativeRemove=id=>page.locator('[data-source-remove="'+id+'"][data-source-action=remove]');
    const nativeRestore=id=>page.locator('[data-source-remove="'+id+'"][data-source-action=restore]');
    const state=()=>page.evaluate(()=>JSON.stringify({graph,revision,past,future,selectedInputId}));
    const removed=async id=>{
      await page.waitForFunction(id=>!graph.declarations.some(d=>d.id===id)&&!nativeSourceBusy,id);
      assert.equal(await page.locator('[data-input-source="'+id+'"]').count(),0);
      assert.equal(await page.evaluate(()=>selectedInputId),null);
      assert.deepEqual(await page.evaluate(()=>[past.length,future.length]),[0,0]);
      assert.equal(await page.evaluate(id=>nativeInputHistory.some(d=>d.id===id),id),false);
      assert.equal(await page.evaluate(()=>JSON.stringify(graph)),JSON.stringify(nativeGraph));
    };

    await selectSource('Live');await page.evaluate(()=>{past=[clone(graph)];future=[clone(graph)];});const beforeCancel=await state(),cancelDialogs=dialogs.length;
    acceptDialog=false;await nativeRemove('Live').click();assert.equal(dialogs.length,cancelDialogs+1);assert.equal(writes.length,0);assert.equal(await state(),beforeCancel);
    acceptDialog=true;await nativeRemove('Live').click();await removed('Live');assert.equal(writes.length,1);
    checks.push('Live Uniform with zero references: Cancel preserves graph/history; confirmed Remove adopts the native graph, clears selection and removes the native history identity');

    await selectSource('Missing0');assert.equal(await nativeRestore('Missing0').count(),1);assert.equal(await nativeRemove('Missing0').isEnabled(),true);
    const missingCancel=await state(),missingDialogs=dialogs.length;acceptDialog=false;await nativeRemove('Missing0').click();assert.equal(dialogs.length,missingDialogs+1);assert.equal(await state(),missingCancel);assert.equal(writes.length,1);acceptDialog=true;
    checks.push('Missing Uniform with zero references offers both Restore and Remove; cancelling removal retains the missing source');

    await page.evaluate(()=>removalActualApply());assert.equal(applyFailures,1);assert.equal(await page.evaluate(()=>dirty),true);assert.equal(await page.evaluate(()=>sourceReady()),true);
    assert.match(await page.locator('#status').innerText(),/Uniform source missing/);
    for(let i=0;i<4;i++){
      const id='Missing'+i;await selectSource(id);assert.equal(await nativeRemove(id).isEnabled(),true);await nativeRemove(id).click();await removed(id);
    }
    assert.equal(writes.length,5);assert.equal(await page.evaluate(()=>dirty),true);
    checks.push('An Apply failure caused by another referenced missing Uniform does not block repairing four unreferenced missing sources in sequence');

    for(const [id,count]of [['Used',1],['Nested',1]]){
      await selectSource(id);assert.equal(await page.evaluate(id=>sourceReferences(id).length,id),count);
      assert.equal(await nativeRestore(id).count(),1);assert.equal(await nativeRemove(id).count(),0);
    }
    assert.equal(await page.evaluate(()=>graph.stages.pixel.nodes.some(n=>n.id==='used_ref')&&graph.functions[0].graph.nodes.some(n=>n.id==='nested_ref')),true);
    checks.push('Missing sources referenced from the stage or an unopened Subgraph keep their graph nodes and show Restore without a purge action');

    await page.evaluate(()=>change(()=>graph.stages.pixel.nodes[0].ui.x+=10));await page.locator('#undo').click();
    assert.equal(await page.evaluate(()=>graph.declarations.some(d=>d.id==='Live'||/^Missing[0-3]$/.test(d.id))),false);
    checks.push('Undo of a later graph edit does not resurrect a purged native source through nativeInputHistory');

    await selectSource('Blocked');await page.evaluate(()=>change(()=>graph.stages.pixel.nodes[0].ui.x+=17));const draft=await page.evaluate(()=>JSON.stringify(graph)),draftRevision=await page.evaluate(()=>revision);
    nativeGraph.declarations.push(uniform('External'));nativeRevision++;sourceChanged=true;
    await page.evaluate(()=>refreshNativeSources());assert.equal(await page.evaluate(()=>JSON.stringify(graph)),draft);assert.equal(await page.evaluate(()=>revision),draftRevision);
    assert.equal(await nativeRemove('Blocked').isDisabled(),true);assert.equal(await page.evaluate(()=>sourceReady()),false);assert.equal(writes.length,5);
    checks.push('An additional local layout draft blocks native edits; a newer source poll cannot overwrite that draft or advance its revision');

    for(const id of ['LocalConstant','LocalSampler']){
      await selectSource(id);assert.equal(await page.locator('[data-input-restore="'+id+'"]').count(),1);
      await page.locator('[data-input-remove="'+id+'"]').click();assert.equal(await page.locator('[data-input-source="'+id+'"]').count(),0);
      assert.equal(await page.evaluate(()=>selectedInputId),null);assert.equal(await page.evaluate(id=>graph.declarations.some(d=>d.id===id),id),false);
    }
    assert.equal(writes.length,5);checks.push('Unreferenced missing local Constants and Samplers can be removed from the local draft without a native request');
    assert.deepEqual(errors,[]);await page.screenshot({path:path.join(folder,'inputs-removal.png')});
  }catch(error){failure=error;if(page)await page.screenshot({path:path.join(folder,'failure.png')}).catch(()=>{});}
  finally{
    if(browser)await browser.close();if(server.listening)await new Promise(r=>server.close(r));
    fs.writeFileSync(path.join(folder,'results.json'),JSON.stringify({passed:!failure,count:checks.length,checks,errors,writes,dialogs,...(failure?{error:failure.stack}:{})},null,2));
  }
  if(failure)throw failure;console.log(JSON.stringify({passed:true,count:checks.length,checks}));
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
