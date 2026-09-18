/* Explicit constructors and standard double operations in an isolated editor. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {harness}=require('./test_glsl_code.cjs');
(async()=>{
  const [source,stateFile,folder]=process.argv.slice(2);fs.mkdirSync(folder,{recursive:true});
  const fixture=path.join(folder,'fresh-state.json');execFileSync(process.env.PYTHON_EXECUTABLE||'python',[path.join(__dirname,'export_editor_fixture.py'),stateFile,fixture]);
  const h=await harness(source,fixture,folder),{page,checks,errors,settle}=h;page.setDefaultTimeout(6500);
  const state=()=>page.evaluate(()=>JSON.stringify(graph));
  const pick=async id=>{await page.evaluate(id=>{selected=id;selection=new Set([id]);inspectorTab='parameters';render();},id);await settle();};
  const conversion=parameter=>page.locator('#inspector [data-convert-type="'+parameter+'"]');
  const node=id=>page.evaluate(id=>clone(current().nodes.find(n=>n.id===id)),id);
  const wire=async(from,to,port)=>{const result=await page.evaluate(({from,to,port})=>connectPorts({node:from,kind:'outputs',port:'out'},{node:to,kind:'inputs',port}),{from,to,port});await settle();return result;};
  try{
    await page.selectOption('#language','en');
    await page.evaluate(()=>{
      clearTimeout(autoTimer);connectionInterrupted=true;conflicted=true;readonly=false;historyBusy=nativeMutationBusy=false;graphTrail=[];stage='pixel';past=[];future=[];selected=selectedEdge=null;selection.clear();graph.functions=[];graph.declarations=[];
      graph.stages.pixel={nodes:[testNode('result','pixel_out',1100,70),testNode('cast','convert',50,70),testNode('branch','if',400,70),testNode('matrix','matrix',50,400,{type:'mat3',values:shapedValue(1,'mat3')}),testNode('other','matrix',400,400,{type:'dmat3',values:shapedValue(1,'dmat3')}),testNode('number','scalar',750,400,{type:'double',value:.125}),testNode('vector','vector',750,70,{type:'dvec3',components:[1,2,3,0]})],edges:[]};
      current().nodes.find(n=>n.id==='branch').ui.typeMode='auto';selected='cast';selection=new Set(['cast']);scale=.8;pan={x:25,y:40};rememberSavedGraph(graph);render();transform();
    });await settle();
    const contract=await page.evaluate(()=>clone(typeContract));
    assert.equal(contract.convert.types.length,38);
    assert.deepEqual(await conversion('fromType').locator('option').evaluateAll(es=>es.map(e=>e.value)),contract.convert.types);
    assert.equal(await conversion('fromType').locator('option[value="auto"]').count(),0);
    const consistency=await page.evaluate(()=>{
      const d=catalog.find(d=>d.key==='convert');let accepted=0,rejected=0;
      for(const from of convertTypes())for(const to of convertTypes()){
        const expected=typeContract.convert.pairs[from].includes(to);let actual=true;
        try{resolvedNodePorts(d,{fromType:from,toType:to},null,'outputs');}catch{actual=false;}
        if(expected!==actual)throw Error('Convert mismatch '+from+' -> '+to);if(actual)accepted++;else rejected++;
      }
      for(const from of convertTypes()){
        const variants=creatorVariants(d,{kind:'outputs',type:from});
        if(JSON.stringify(variants.map(v=>v.outputs.out).sort())!==JSON.stringify([...typeContract.convert.pairs[from]].sort()))throw Error('Creator targets '+from);
      }
      if(creatorVariants(d,{kind:'outputs',type:'ivec3'})[0].outputs.out!=='vec3')throw Error('Legacy shape-preserving default');
      if(creatorVariants(d,{kind:'outputs',type:'mat2'})[0].outputs.out!=='mat2')throw Error('Matrix shape-preserving default');
      return {accepted,rejected};
    });assert.deepEqual(consistency,{accepted:1109,rejected:335});
    checks.push('All 38 explicit source choices and 1444 constructor pairs match the core contract; Creator follows the same targets without source Auto');

    for(const from of ['mat2','dmat3x2','vec4','vec2','double','bvec4']){
      await conversion('fromType').selectOption(from);await settle();
      assert.deepEqual(await conversion('toType').locator('option').evaluateAll(es=>es.map(e=>e.value)),contract.convert.pairs[from]);
    }
    await conversion('fromType').selectOption('mat2');await conversion('toType').selectOption('dmat4');await settle();
    const before=await state();await conversion('fromType').selectOption('vec2');await settle();
    assert.equal((await node('cast')).params.toType,'vec2');const changed=await state();
    await page.locator('#undo').click();await settle();assert.equal(await state(),before);
    await page.locator('#redo').click();await settle();assert.equal(await state(),changed);
    checks.push('Convert target choices filter by constructors; an incompatible retained target falls back to the explicitly selected source type with exact Undo/Redo');

    await conversion('fromType').selectOption('mat3');await conversion('toType').selectOption('vec4');await settle();
    assert.deepEqual(await page.evaluate(()=>defaultInput(current().nodes.find(n=>n.id==='cast'),'value','mat3')),[1,0,0,0,1,0,0,0,1]);
    await page.evaluate(()=>change(()=>{current().nodes.find(n=>n.id==='cast').inputValues={value:[1,2,3,4,5,6,7,8,9]};}));await settle();
    await conversion('fromType').selectOption('dmat2x3');await settle();assert.deepEqual((await node('cast')).inputValues.value,[1,2,3,4,5,6]);
    await conversion('fromType').selectOption('dmat3x2');await settle();assert.deepEqual((await node('cast')).inputValues.value,[1,2,4,5,0,0]);
    assert.equal(await page.locator('#inspector [data-parameter-matrix="value"] input:visible').count(),6);
    checks.push('Matrix Convert fallback matches the identity default and changing matrix source dimensions preserves overlapping row/column coordinates');

    await pick('branch');assert.deepEqual(await page.locator('#inspector [data-math-type="branch"] option').evaluateAll(es=>es.map(e=>e.value)),['auto',...contract.valueTypes]);
    assert.equal(await wire('matrix','branch','true'),true);assert.equal((await node('branch')).params.type,'mat3');
    const values=await page.evaluate(()=>{const n=current().nodes.find(n=>n.id==='branch');return {truth:defaultInput(n,'true','mat3'),falsy:defaultInput(n,'false','mat3'),input:ports(n,'inputs'),output:ports(n,'outputs')};});
    assert.deepEqual(values,{truth:[1,0,0,0,1,0,0,0,1],falsy:Array(9).fill(0),input:{condition:'bool',true:'mat3',false:'mat3'},output:{out:'mat3'}});
    assert.equal(await page.locator('#inspector [data-parameter-matrix="false"] input:visible').count(),9);
    const stable=await state();assert.equal(await wire('other','branch','false'),false);assert.equal(await state(),stable);
    assert.equal(await wire('number','branch','false'),false);assert.equal(await state(),stable);
    assert.equal(await wire('number','branch','condition'),false);assert.equal(await state(),stable);
    const falseValue=page.locator('#inspector [data-parameter-matrix="false"] input:visible').nth(4);await falseValue.fill('7.25');await falseValue.press('Enter');await settle();assert.equal((await node('branch')).inputValues.false[4],7.25);
    checks.push('Auto If infers same-type matrix branches with identity/zero defaults and editable columns; matrix cross-family, scalar-to-matrix and numeric-to-bool wires stay rejected');

    await page.evaluate(()=>{change(()=>{current().edges=current().edges.filter(e=>e.to[0]!=='branch');});});await settle();
    assert.equal(await wire('vector','branch','true'),true);assert.equal((await node('branch')).params.type,'dvec3');
    assert.equal(await wire('number','branch','false'),true);assert.equal((await node('branch')).params.type,'dvec3');
    checks.push('Double vector If retains ordinary scalar-to-vector numeric connections while its condition stays bool');

    const doubleKeys=['sqrt','abs','sign','floor','round','ceil','trunc','fract','min','max','clamp','mod','smoothstep','mix','length','dot','normalize','range_from','range_to'];
    const doubleChecks=await page.evaluate(keys=>keys.map((key,index)=>{
      const d=catalog.find(d=>d.key===key),n=testNode('math'+index,key,50,900,{type:'dvec3'});n.ui.typeMode='auto';current().nodes.push(n);
      const inputPort=Object.keys(resolvedNodePorts(d,n.params,null,'inputs'))[0];
      const result=connectPorts({node:'vector',kind:'outputs',port:'out'},{node:n.id,kind:'inputs',port:inputPort});
      const actual=current().nodes.find(item=>item.id===n.id);
      return {key,result,type:actual.params.type,inputs:ports(actual,'inputs'),out:ports(actual,'outputs').out,types:selectableNodeTypes(d)};
    }),doubleKeys);await settle();
    for(const row of doubleChecks){assert.equal(row.result,true,row.key);assert.equal(row.type,'dvec3',row.key);assert.equal(row.out,['length','dot'].includes(row.key)?'double':'dvec3',row.key);for(const type of ['double','dvec2','dvec3','dvec4'])assert.ok(row.types.includes(type),row.key+' '+type);}
    assert.equal(doubleChecks.find(row=>row.key==='mix').inputs.factor,'double');
    const restricted=await page.evaluate(()=>Object.fromEntries(['sin','cos','pow','add','subtract','multiply','divide','compare','remap','loop','zigzag'].map(key=>[key,selectableNodeTypes(catalog.find(d=>d.key===key))])));
    for(const [key,types] of Object.entries(restricted))assert.ok(types.every(type=>!type.startsWith('d')&&!type.includes('mat')),key);
    checks.push('All 19 standard/formula double operations infer dvec3; dot/length return double and Mix factor is double; deferred or unsupported signatures remain absent');

    await pick('cast');await page.evaluate(()=>{readonly=true;render();});await settle();assert.equal(await conversion('fromType').isDisabled(),true);assert.equal(await conversion('toType').isDisabled(),true);
    checks.push('Read-only mode disables both explicit Convert controls');assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,count:checks.length}));
  }catch(error){await h.finish(error);throw error;}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
