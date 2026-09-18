/* Native Matrix source UI against an isolated API; never evaluates TD drivers. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {harness}=require('./test_glsl_code.cjs');
async function run(){
  const [source,stateFile,folder]=process.argv.slice(2);fs.mkdirSync(folder,{recursive:true});
  const fixture=path.join(folder,'fresh-state.json');execFileSync(process.env.PYTHON_EXECUTABLE||'python',[path.join(__dirname,'export_editor_fixture.py'),stateFile,fixture]);
  const h=await harness(source,fixture,folder),{page,checks,errors,settle}=h;page.setDefaultTimeout(6500);
  const requests=[],checkpoints=new Map(),types=JSON.parse(fs.readFileSync(fixture)).typeContract.types;let snapshot,serial=0;
  const row=()=>snapshot.uniforms[0];
  function restamp(){row().matrixBinding.expected='matrix-config-'+(++serial);snapshot.history={token:'matrix-history-'+serial};checkpoints.set(snapshot.history.token,structuredClone(row()));}
  function components(){const shape=types[row().type],values=row().matrixBinding.literalValues;row().components=values?Array.from({length:shape.components},(_,i)=>({parameter:'matrix0value',value:values[Math.floor(i/shape.rows)*4+i%shape.rows],mode:'EXPRESSION',writable:false,column:Math.floor(i/shape.rows),row:i%shape.rows})):[];}
  const send=async(route,data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  const publish=async()=>{await page.evaluate(data=>receiveNativeSources(data),snapshot);await settle();};
  const card=()=>page.locator('#inspector [data-native-source="matrix"]');
  const value=index=>card().locator('[data-matrix-source-component="'+index+'"]');
  const binding=()=>card().locator('[data-matrix-binding-editor]');
  const wait=()=>page.waitForFunction(()=>!nativeSourceBusy&&!nativeMutationBusy&&!nativeSourcePolling&&!historyBusy);
  try{
    await page.selectOption('#language','en');
    const data=await page.evaluate(()=>{
      clearTimeout(autoTimer);connectionInterrupted=false;conflicted=false;readonly=false;historyBusy=false;nativeMutationBusy=false;nativeSourceBusy=false;nativeSourcePolling=false;nativeSourceRetryAt=0;nativeSourceError='';
      graphTrail=[];stage='pixel';graph.functions=[];graph.declarations=[{id:'matrix',kind:'uniform',name:'uMatrix',type:'mat3',value:shapedValue(1,'mat3'),nativeSequence:'matrix'}];
      graph.stages.pixel={nodes:[testNode('pixel','pixel_out',650,80)],edges:[]};selected=null;selection.clear();selectedInputId=null;past=[];future=[];rememberSavedGraph(graph);dirty=false;render();
      return {graph:clone(graph),revision};
    });
    const carrier=Array.from({length:16},(_,i)=>Math.floor(i/4)===i%4?1:0);
    snapshot={...data,enabled:true,sourceChanged:false,declarations:data.graph.declarations,uniforms:[{id:'matrix',kind:'uniform',name:'uMatrix',type:'mat3',sequence:'matrix',index:0,missing:false,pending:false,nameWritable:true,expected:'matrix-row',components:[],matrixBinding:{parameter:'matrix0value',mode:'EXPRESSION',value:'',expression:'tdu.Matrix('+JSON.stringify(carrier)+')',binding:'',writable:true,literalValues:carrier}}],specConstants:[],samplers:[],issues:[]};components();restamp();
    await page.route('**/api/**/sources',route=>send(route,snapshot));
    await page.route('**/api/**/source-edit',async route=>{
      const body=route.request().postDataJSON();requests.push(structuredClone(body));
      if(!row().matrixBinding.writable||body.expected!==row().matrixBinding.expected)return send(route,{error:'Matrix source changed externally; preserved'},409);
      const beforeToken=snapshot.history.token;
      if(body.action==='matrixValue'){
        const shape=types[row().type];assert.equal(body.value.length,shape.components);assert.equal(body.value.every(Number.isFinite),true);assert.ok(row().matrixBinding.literalValues);
        for(let c=0;c<shape.columns;c++)for(let r=0;r<shape.rows;r++)row().matrixBinding.literalValues[c*4+r]=body.value[c*shape.rows+r];
        row().matrixBinding.expression='tdu.Matrix('+JSON.stringify(row().matrixBinding.literalValues)+')';components();
      }else if(body.action==='matrixBinding'){
        assert.ok(['CONSTANT','EXPRESSION'].includes(body.mode));Object.assign(row().matrixBinding,{mode:body.mode,value:body.mode==='CONSTANT'?body.value:'',expression:body.mode==='EXPRESSION'?body.expression:'',literalValues:null});components();
      }else throw Error('Unexpected matrix request '+body.action);
      restamp();snapshot.history.beforeToken=beforeToken;return send(route,snapshot);
    });
    await page.route('**/api/**/history-restore',async route=>{
      const body=route.request().postDataJSON();assert.deepEqual(body.sourceIds,['matrix']);assert.equal(body.fromToken,snapshot.history.token);snapshot.uniforms=[structuredClone(checkpoints.get(body.toToken))];snapshot.history={token:body.toToken};return send(route,snapshot);
    });
    await publish();await page.evaluate(()=>selectInputSource('matrix'));await settle();
    assert.equal(await card().locator('.matrix-parameter-column').count(),3);assert.equal(await card().locator('[data-matrix-source-component]').count(),9);
    assert.deepEqual(await card().locator('.matrix-parameter-column>.parameter-value-label').allTextContents(),['Column 0','Column 1','Column 2']);assert.equal(await value(0).isEnabled(),true);
    assert.equal(await card().locator('[data-source-component]').count(),0);
    checks.push('Native Matrix sources show complete Column groups and active elements rather than a four-component vector subset');
    const graphBefore=await page.evaluate(()=>JSON.stringify(graph)),oldToken=row().matrixBinding.expected,history=await page.evaluate(()=>past.length);
    await value(4).fill('2.1234567890123');await value(4).press('Enter');await wait();
    assert.equal(requests.length,1);assert.equal(requests[0].action,'matrixValue');assert.equal(requests[0].expected,oldToken);assert.deepEqual(requests[0].value,[1,0,0,0,2.1234567890123,0,0,0,1]);
    assert.equal(await page.evaluate(()=>JSON.stringify(graph)),graphBefore);assert.equal(await page.evaluate(()=>past.length),history+1);assert.equal(row().matrixBinding.literalValues[15],1);
    await page.locator('#undo').click();await wait();assert.equal(row().components[4].value,1);await page.locator('#redo').click();await wait();assert.equal(row().components[4].value,2.1234567890123);
    await page.evaluate(()=>selectInputSource('matrix'));
    checks.push('One element edit sends one complete column-major matrix with its configuration token, keeps graph defaults and dormant carrier elements, and uses one source Undo/Redo');
    await binding().locator('select').selectOption('CONSTANT');await binding().locator('input').fill('/project1/matrixDAT');const pathToken=row().matrixBinding.expected;
    await binding().locator('button').click();await wait();assert.equal(requests.at(-1).mode,'CONSTANT');assert.equal(requests.at(-1).value,'/project1/matrixDAT');assert.equal(requests.at(-1).expected,pathToken);
    assert.equal(await card().locator('[data-matrix-source-component]').count(),0);assert.equal(await binding().locator('input').inputValue(),'/project1/matrixDAT');
    await binding().locator('select').selectOption('EXPRESSION');await binding().locator('input').fill("op('movingMatrix')");await binding().locator('input').press('Enter');await wait();
    assert.equal(requests.at(-1).expression,"op('movingMatrix')");assert.equal(await card().locator('[data-matrix-source-component]').count(),0);
    checks.push('DAT/CHOP paths and Python expressions apply through guarded source-edit requests; driven sources never display invented numeric values');
    const draftToken=row().matrixBinding.expected;await binding().locator('input').fill("op('draftMatrix')");
    row().matrixBinding.expression="op('externalMatrix')";restamp();await publish();await page.evaluate(()=>inspector());
    assert.equal(await binding().locator('input').inputValue(),"op('draftMatrix')");assert.equal(await binding().evaluate(e=>e.sourceExpected),draftToken);
    await binding().locator('button').click();await wait();assert.equal(requests.at(-1).expected,draftToken);assert.equal(row().matrixBinding.expression,"op('externalMatrix')");assert.equal(await binding().locator('input').inputValue(),"op('draftMatrix')");
    const requestsBeforeEscape=requests.length;await binding().locator('input').press('Escape');await settle();assert.equal(requests.length,requestsBeforeEscape);assert.equal(await binding().locator('input').inputValue(),"op('externalMatrix')");assert.equal(await binding().evaluate(e=>e.sourceExpected),row().matrixBinding.expected);
    checks.push('Binding drafts survive polling and inspector rebuilds with their original token; stale Apply is rejected and Escape restores the latest external source without a request');
    Object.assign(row().matrixBinding,{mode:'BIND',binding:"parent().par.Matrix",expression:'',value:'',writable:false,literalValues:null});components();restamp();await publish();await page.evaluate(()=>inspector());
    assert.equal(await binding().locator('select').isDisabled(),true);assert.equal(await binding().locator('input').isDisabled(),true);assert.equal(await binding().locator('button').isDisabled(),true);assert.equal(await card().locator('[data-matrix-source-component]').count(),0);
    checks.push('Bind-owned matrix sources remain readonly and cannot be replaced through the source editor');
    Object.assign(row().matrixBinding,{mode:'EXPRESSION',binding:'',expression:'tdu.Matrix('+JSON.stringify(carrier)+')',writable:true,literalValues:carrier});components();restamp();await publish();await page.evaluate(()=>{document.activeElement?.blur();inspector();});
    await page.evaluate(()=>{readonly=true;renderNativeSourceValues();});assert.equal(await value(0).isDisabled(),true);assert.equal(await binding().locator('button').isDisabled(),true);
    await page.evaluate(()=>{readonly=false;renderNativeSourceValues();});assert.equal(await value(0).isEnabled(),true);
    checks.push('Graph readonly state disables both literal matrix values and source binding controls');
    for(const type of ['mat2x3','mat3x2','dmat4']){
      const shape=types[type],decl=snapshot.graph.declarations[0];row().type=type;decl.type=type;decl.value=Array.from({length:shape.components},(_,i)=>Math.floor(i/shape.rows)===i%shape.rows?1:0);snapshot.revision++;components();restamp();await publish();await page.evaluate(()=>inspector());
      assert.equal(await card().locator('.matrix-parameter-column').count(),shape.columns);assert.equal(await card().locator('[data-matrix-source-component]').count(),shape.components);
      for(let c=0;c<shape.columns;c++)assert.equal(await card().locator('.matrix-parameter-column').nth(c).locator('input').count(),shape.rows);
      assert.deepEqual(await card().locator('[data-matrix-source-component]').evaluateAll(inputs=>inputs.map(e=>Number(e.value))),row().components.map(c=>c.value));
    }
    checks.push('Rectangular and double sources render every column and row in column-major order, including all sixteen elements of dmat4');
    await page.screenshot({path:path.join(folder,'matrix-source.png')});assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,count:checks.length}));
  }catch(error){await h.finish(error);throw error;}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
