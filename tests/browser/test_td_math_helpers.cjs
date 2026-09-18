/* TD math wrappers: real creator, type edits and wire transactions in an isolated browser. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {harness}=require('./test_glsl_code.cjs');
const[source,stateFile,folder]=process.argv.slice(2);
(async()=>{
  fs.mkdirSync(folder,{recursive:true});const fixture=path.join(folder,'fresh-state.json');
  execFileSync(process.env.PYTHON_EXECUTABLE||'python',[path.join(__dirname,'export_editor_fixture.py'),stateFile,fixture]);
  const h=await harness(source,fixture,folder),{page,checks,errors,settle}=h;page.setDefaultTimeout(6000);
  const keys=['rgb_to_hsv','hsv_to_rgb','remap','range_from','range_to','loop','zigzag'],ids={};
  const choose=async id=>{await page.evaluate(id=>{document.activeElement?.blur();selected=id;selection=new Set([id]);inspectorTab='parameters';render();},id);await settle();};
  const connect=async(from,to,port)=>{const ok=await page.evaluate(({from,to,port})=>{
    const source=current().nodes.find(n=>n.id===from),target=current().nodes.find(n=>n.id===to);
    return connectPorts({kind:'outputs',node:from,port:'out',type:ports(source,'outputs').out},{kind:'inputs',node:to,port,type:ports(target,'inputs')[port]});
  },{from,to,port});await settle();return ok;};
  try{
    await page.selectOption('#language','en');
    await page.evaluate(()=>{
      clearTimeout(autoTimer);connectionInterrupted=true;conflicted=true;readonly=false;historyBusy=false;nativeMutationBusy=false;
      graph.functions=[];graph.declarations=[];graph.stages.pixel={nodes:[testNode('vector','vec3',30,120,{value:[.2,.4,.6]}),testNode('wrong','vec4',30,380)],edges:[]};
      stage='pixel';graphTrail=[];selected=null;selection.clear();past=[];future=[];dirty=false;rememberSavedGraph(graph);render();scale=.75;pan={x:20,y:30};transform();
    });await settle();
    for(const [key,query] of [['rgb_to_hsv','TDRGBToHSV'],['hsv_to_rgb','HSVtoRGB'],['remap','TDRemap'],['range_from','rangefrom'],['range_to','rangeto'],['loop','TDLoop'],['zigzag','pingpong']]){
      const history=await page.evaluate(()=>past.length);
      await page.locator('#canvas').focus();await page.keyboard.press('Tab');await page.locator('#creator').waitFor({state:'visible'});await page.locator('#createsearch').fill(query);
      const entry=page.locator(`[data-create-entry="${key}"]`);assert.equal(await entry.count(),1);await entry.hover();
      assert.ok((await page.locator('#createdetail .help-markdown').innerText()).length>100);await entry.click();await settle();
      ids[key]=await page.evaluate(()=>selected);assert.equal(await page.evaluate(()=>past.length),history+1);
      assert.equal(await page.evaluate(()=>definition(current().nodes.find(n=>n.id===selected)).key),key);
      const signature=await page.evaluate(()=>ports(current().nodes.find(n=>n.id===selected),'outputs'));
      assert.equal(signature.out,key.includes('_hsv')||key==='hsv_to_rgb'?'vec3':'float');
    }
    checks.push('All seven nodes are searchable with TD function names or familiar aliases, show help, and insert with one Undo step');
    for(const key of keys){
      await choose(ids[key]);
      const typed=!['rgb_to_hsv','hsv_to_rgb'].includes(key);
      assert.equal(await page.locator('#inspector [data-math-type]').count(),typed?1:0);
      const dimensions=await page.locator('#inspector .parameter-row').evaluateAll(es=>es.map(e=>[e.clientWidth,e.scrollWidth]));
      assert.ok(dimensions.every(([width,scroll])=>scroll<=width+1),JSON.stringify({key,dimensions}));
    }
    checks.push('Fixed vec3 color nodes and ordinary Auto range nodes use existing Parameters rows without horizontal overflow');
    await choose(ids.remap);assert.equal(await page.locator('#inspector [data-math-type]').inputValue(),'auto');
    const before=await page.evaluate(()=>JSON.stringify(graph)),history=await page.evaluate(()=>past.length);
    assert.equal(await connect('vector',ids.remap,'value'),true);
    assert.equal(await page.evaluate(id=>current().nodes.find(n=>n.id===id).params.type,ids.remap),'vec3');
    assert.equal(await page.evaluate(()=>past.length),history+1);
    const after=await page.evaluate(()=>JSON.stringify(graph));await page.locator('#undo').click();await settle();assert.equal(await page.evaluate(()=>JSON.stringify(graph)),before);
    await page.locator('#redo').click();await settle();assert.equal(await page.evaluate(()=>JSON.stringify(graph)),after);
    checks.push('Remap infers vec3 from a wire and includes type/connection changes in one Undo/Redo transaction');
    for(const key of ['range_from','range_to','loop','zigzag']){
      await choose(ids[key]);assert.equal(await connect('vector',ids[key],'value'),true);
      assert.equal(await page.locator('#inspector [data-math-type]').inputValue(),'auto');
      assert.equal(await page.evaluate(()=>current().nodes.find(n=>n.id===selected).params.type),'vec3');
      await page.locator('#inspector [data-math-type]').selectOption('vec4');await settle();
      assert.equal(await page.evaluate(()=>current().nodes.find(n=>n.id===selected).ui.typeMode),'locked');
    }
    checks.push('Range From/To and Loop/Zigzag share vector Auto inference and the existing manual type lock controls');
    await choose(ids.rgb_to_hsv);const saved=await page.evaluate(()=>JSON.stringify({graph,past,future}));assert.equal(await connect('wrong',ids.rgb_to_hsv,'rgb'),false);
    assert.equal(await page.evaluate(()=>JSON.stringify({graph,past,future})),saved);assert.equal(await connect('vector',ids.rgb_to_hsv,'rgb'),true);assert.equal(await connect(ids.rgb_to_hsv,ids.hsv_to_rgb,'hsv'),true);
    checks.push('RGB/HSV fixed-width sockets reject vec4 without mutation and connect an RGB→HSV→RGB vec3 chain');
    await choose(ids.remap);await page.screenshot({path:path.join(folder,'remap-parameters.png')});
    fs.writeFileSync(path.join(folder,'helper-graph.json'),await page.evaluate(()=>JSON.stringify(graph)));
    assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,count:checks.length}));
  }catch(error){await h.finish(error);throw error;}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
