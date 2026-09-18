/* Typed scalar/vector frontend integration, using only an isolated fixture API.
 * node test_type_foundation.cjs SOURCE_DIR BASE_STATE_JSON REPORT_DIR
 */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {harness}=require('./test_glsl_code.cjs');
const[source,stateFile,folder]=process.argv.slice(2);
(async()=>{
  fs.mkdirSync(folder,{recursive:true});const fixture=path.join(folder,'fresh-state.json');
  execFileSync(process.env.PYTHON_EXECUTABLE||'python',[path.join(__dirname,'export_editor_fixture.py'),stateFile,fixture],{stdio:'pipe'});
  const h=await harness(source,fixture,folder),{page,checks,errors,settle}=h;page.setDefaultTimeout(6000);
  const choose=async id=>{await page.evaluate(id=>{document.activeElement?.blur();selected=id;selection=new Set([id]);selectedInputId=null;inspectorTab='parameters';render();},id);await settle();};
  const state=id=>page.evaluate(id=>clone(current().nodes.find(n=>n.id===id)),id);
  const reset=async()=>{await page.evaluate(()=>{
    clearTimeout(autoTimer);connectionInterrupted=true;conflicted=true;readonly=false;historyBusy=false;nativeMutationBusy=false;graphTrail=[];stage='pixel';graph.functions=[];graph.declarations=[];
    graph.stages.pixel={nodes:[testNode('output','pixel_out',1100,150)],edges:[]};past=[];future=[];selected=null;selection.clear();rememberSavedGraph(graph);render();scale=.7;pan={x:20,y:30};transform();
    window.addTyped=(id,key,params={},ui={})=>{const node=testNode(id,key,60+current().nodes.length*220,180,params);Object.assign(node.ui,ui);normalizeNodeValues(node,definition(node));current().nodes.push(node);return node;};
  });await settle();};
  const connect=async(from,port,to,target)=>{const result=await page.evaluate(({from,port,to,target})=>connectPorts({kind:'outputs',node:from,port},{kind:'inputs',node:to,port:target}),{from,port,to,target});await settle();return result;};
  try{
    await page.selectOption('#language','en');await reset();
    const values=await page.evaluate(()=>valueTypes());assert.equal(values.length,16);
    const matrix=await page.evaluate(()=>typeContract.vectors.types.map(type=>({type,split:vectorPorts('vector_split',{type}),swizzle:vectorPorts('swizzle',{type,mask:'yx'}),combine:vectorPorts('combine',{type}),replace:vectorPorts('replace',{type})})));
    for(const row of matrix){const family=/^ivec/.test(row.type)?'int':/^uvec/.test(row.type)?'uint':/^bvec/.test(row.type)?'bool':'float',prefix={float:'vec',int:'ivec',uint:'uvec',bool:'bvec'}[family];assert.ok(Object.values(row.split.outputs).every(type=>type===family));assert.equal(row.swizzle.outputs.out,prefix+'2');assert.ok(Object.values(row.combine.inputs).every(type=>type===family));assert.equal(row.replace.inputs.value,row.type);}
    checks.push('Contract exposes all 16 value types; every vector family uses the right scalar ports, Swizzle result family, Combine and Replace layout');
    const browserRows=JSON.parse(fs.readFileSync(path.resolve(source,'../library/node_catalog.json'),'utf8')).definitions.filter(row=>['scalar','convert'].includes(row.definition.key));
    for(const row of browserRows)assert.deepEqual(await page.evaluate(id=>browserData().nodes[id],row.definition.definitionUuid),row.browser);
    await page.evaluate(()=>{const r=$('#canvas').getBoundingClientRect();openCreator(r.left+160,r.top+140);});
    await page.locator('#createsearch').fill('ivec3');assert.equal(await page.locator('[data-create-entry="vector"]').count(),1);assert.equal(await page.locator('[data-create-entry="ivec3"]').count(),1);await page.locator('[data-create-entry="ivec3"]').click();await settle();assert.equal(await page.evaluate(()=>current().nodes.find(n=>n.id===selected).params.type),'ivec3');
    const sourceId=await page.evaluate(()=>selected);await page.evaluate(id=>{const r=$('#canvas').getBoundingClientRect();openCreator(r.left+460,r.top+180,{kind:'outputs',node:id,port:'out',type:'ivec3'});},sourceId);await page.locator('#createsearch').fill('Convert');await page.locator('[data-create-entry="convert"]').click();await settle();
    assert.deepEqual(await page.evaluate(()=>{const n=current().nodes.find(n=>n.id===selected);return n.params;}),{fromType:'ivec3',toType:'vec3'});
    assert.equal(await page.evaluate(id=>current().edges.some(e=>e.from[0]===id&&e.to[0]===selected),sourceId),true);
    checks.push('Scalar/Convert embedded browser metadata matches the catalog; exact ivec3 search and dragged-wire Convert creation preserve concrete types');
    await reset();


    await page.evaluate(()=>{addTyped('s','scalar');selected='s';selection=new Set(['s']);render();});await choose('s');
    const scalarType=()=>page.locator('[data-node="s"] [data-node-selector]');
    await scalarType().selectOption('uint');await settle();
    let entry=page.locator('#inspector [data-parameter-port="$value"]');assert.equal(await entry.getAttribute('max'),'4294967295');
    await entry.fill('4294967295');await entry.press('Enter');await settle();assert.equal((await state('s')).params.value,4294967295);
    const history=await page.evaluate(()=>past.length);
    for(const bad of ['4294967296','-1','1.5']){entry=page.locator('#inspector [data-parameter-port="$value"]');await entry.fill(bad);await entry.press('Enter');assert.equal((await state('s')).params.value,4294967295);assert.equal(await entry.getAttribute('aria-invalid'),'true');assert.equal(await page.evaluate(()=>past.length),history);}
    await page.evaluate(()=>{parameterValueEdit?.entry.cancelParameterValue?.();parameterValueEdit=null;inspector();});
    await scalarType().selectOption('int');await settle();assert.equal((await state('s')).params.value,2147483647);
    entry=page.locator('#inspector [data-parameter-port="$value"]');await entry.fill('-2147483648');await entry.press('Enter');await settle();assert.equal((await state('s')).params.value,-2147483648);
    await scalarType().selectOption('bool');await settle();assert.equal((await state('s')).params.value,true);
    await page.locator('#inspector [data-parameter-port="$value"]').selectOption('false');await settle();assert.equal((await state('s')).params.value,false);
    assert.equal(await page.locator('[data-node="s"] [data-inline-port="$value"]').inputValue(),'false');
    await page.locator('#undo').click();await settle();assert.equal((await state('s')).params.value,true);await page.locator('#redo').click();await settle();assert.equal((await state('s')).params.value,false);
    checks.push('Scalar supports full signed/unsigned 32-bit boundaries, rejects fractions/out-of-range without history entries, and shares Boolean controls with one-step Undo/Redo');

    await reset();await page.evaluate(()=>{for(const [index,type] of typeContract.vectors.types.entries())instantiate(availableEntries().find(d=>d.key==='vector'&&!d.fixedType),80+(index%4)*260,60+Math.floor(index/4)*230,type);render();});await settle();
    const allVectors=await page.evaluate(()=>current().nodes.filter(n=>definition(n).key==='vector').map(n=>({id:n.id,type:n.params.type,components:n.params.components})));
    for(const n of allVectors){assert.equal(n.components.length,4);assert.ok(n.components.every(v=>typeof v===(n.type.startsWith('b')?'boolean':'number')));}
    const b=allVectors.find(n=>n.type==='bvec3');await choose(b.id);assert.equal(await page.locator('#inspector [data-parameter-port="$value"] select').count(),0);
    assert.equal(await page.locator('#inspector select[data-parameter-port="$value"][data-parameter-copy="compact"]').count(),3);
    await page.locator('#inspector select[data-parameter-port="$value"][data-parameter-copy="compact"][data-component="1"]').selectOption('true');await settle();assert.deepEqual((await state(b.id)).params.components,[false,true,false,false]);
    await page.locator(`#inspector [data-vector-type="${b.id}"]`).selectOption('ivec3');await settle();assert.deepEqual((await state(b.id)).params.components,[0,1,0,0]);
    await page.screenshot({path:path.join(folder,'typed-vectors.png')});
    const colors=await page.evaluate(()=>['vec2','ivec2','uvec2','bvec2'].map(type=>{const socket=document.querySelector(`[data-kind="outputs"][data-type="${type}"]`);return socket?getComputedStyle(socket).backgroundColor:null;}));assert.ok(colors.every(c=>c&&c===colors[0]),JSON.stringify(colors));
    checks.push('All 12 generic Vector configurations create family-correct defaults; Boolean components edit individually and convert on type changes; socket dimension colors match across families');

    await reset();await page.evaluate(()=>{addTyped('i','vector',{type:'ivec3',components:[1,2,3,0]});addTyped('add','add',{}, {typeMode:'auto'});addTyped('split','vector_split',{}, {typeMode:'auto'});addTyped('swizzle','swizzle',{mask:'yx'},{typeMode:'auto'});render();});await settle();
    await connect('i','out','add','a');assert.equal((await state('add')).params.type,'ivec3');
    await connect('i','out','split','value');assert.equal((await state('split')).params.type,'ivec3');
    await connect('i','out','swizzle','value');assert.deepEqual(await page.evaluate(()=>ports(current().nodes.find(n=>n.id==='swizzle'),'outputs')),{out:'ivec2'});
    await page.evaluate(()=>{const n=current().nodes.find(n=>n.id==='add');setMathType(n,'vec3');});await settle();
    assert.equal(await page.locator('[data-node="add"] [data-conversion="cast"]').count(),1);assert.match(await page.locator('[data-node="add"] [data-conversion="cast"]').getAttribute('title'),/Convert ivec3 to vec3/);
    checks.push('Auto chooses exact ivec3 before casts; Split/Swizzle preserve family; locked math displays a real numeric cast hint');

    await reset();await page.evaluate(()=>{addTyped('v','vector',{type:'bvec2',components:[true,false,false,false]});addTyped('c','combine',{type:'bvec3'});addTyped('r','replace',{type:'bvec3'},{typeMode:'auto'});addTyped('base','vector',{type:'bvec3'});addTyped('float','float');render();});await settle();
    await connect('v','out','c','x');assert.deepEqual((await state('c')).params.groups,{x:'bvec2'});
    await connect('base','out','r','value');await connect('v','out','r','x');assert.deepEqual((await state('r')).params.groups,{x:'bvec2'});
    const before=await page.evaluate(()=>JSON.stringify({graph,past}));await connect('float','out','c','z');assert.equal(await page.evaluate(()=>JSON.stringify({graph,past})),before);
    checks.push('Boolean Combine and Replace accept exact grouped components and reject implicit numeric-to-Boolean wires atomically');

    await reset();await page.evaluate(()=>{addTyped('convert','convert');render();});await choose('convert');
    assert.equal(await page.locator('#inspector [data-convert-type="fromType"] option').count(),16);
    await page.locator('#inspector [data-convert-type="fromType"]').selectOption('bvec3');await settle();assert.equal((await state('convert')).params.toType,'ivec3');
    assert.deepEqual(await page.locator('#inspector [data-convert-type="toType"] option').evaluateAll(es=>es.map(e=>e.value)),['vec3','ivec3','uvec3','bvec3']);
    await page.locator('#inspector [data-convert-type="toType"]').selectOption('uvec3');await settle();
    assert.deepEqual(await page.evaluate(()=>{const n=current().nodes.find(n=>n.id==='convert');return {input:ports(n,'inputs'),output:ports(n,'outputs')};}),{input:{value:'bvec3'},output:{out:'uvec3'}});
    assert.equal(await page.locator('#inspector select[data-parameter-port="value"][data-parameter-copy="compact"]').count(),3);
    await page.locator('#inspector [data-convert-type="fromType"]').selectOption('int');await settle();assert.equal(await page.locator('#inspector [data-convert-type="toType"] option').count(),16);
    await page.locator('#inspector [data-convert-type="toType"]').selectOption('bvec4');await settle();
    checks.push('Convert uses common input/output selectors and typed inputs, limits vector casts to same-width types, and supports scalar-to-vector conversion');

    await reset();await page.evaluate(()=>{addTyped('code','glsl_code');render();});await choose('code');
    const outputId=await page.evaluate(()=>current().nodes.find(n=>n.id==='code').params.outputs[0].id);
    assert.equal(await page.locator(`[data-code-port="${outputId}"] select option`).count(),16);
    await page.locator(`[data-code-port="${outputId}"] select`).selectOption('bvec4');await settle();
    assert.match(await page.locator('[data-code-header]').innerText(),/out bvec4/);
    const inputId=await page.evaluate(()=>current().nodes.find(n=>n.id==='code').params.inputs[0].id);
    await page.locator(`[data-code-port="${inputId}"] select`).selectOption('uvec3');await settle();assert.equal(await page.locator(`[data-code-port="${inputId}"] select option`).count(),17);
    assert.equal(await page.evaluate(()=>{CustomGLSL.validate(current().nodes.find(n=>n.id==='code').params);return true;}),true);
    checks.push('GLSL Code interfaces expose all value outputs and value/resource inputs; Boolean vectors validate and render in the GLSL header');

    await reset();const declarationChecks=await page.evaluate(()=>{
      const result=[];for(const type of valueTypes()){const decl=createInputDeclaration('constant',type);const box=document.createElement('div');constantFields(box,decl);const control=box.querySelector('.components input,.components select');result.push({type,value:decl.value,options:box.querySelector('select').options.length,tag:control?.tagName,max:control?.max});}
      return result;
    });
    for(const row of declarationChecks){assert.equal(row.options,16);assert.equal(row.tag,/bool|bvec/.test(row.type)?'SELECT':'INPUT');if(/uint|uvec/.test(row.type))assert.equal(row.max,'4294967295');}
    checks.push('Graph Constant declarations share all 16 types and exact integer/Boolean controls');
    const live=await page.evaluate(()=>{
      const previous=nativeSourceSnapshot,request=nativeSourceRequest,requests=[];nativeSourceRequest=(endpoint,body)=>requests.push(clone(body));
      const decl={id:'boolLive',name:'uFlags',kind:'uniform',type:'bvec2',value:[false,false]};
      const raw=[{value:0,mode:'CONSTANT',writable:true,expression:''},{value:1,mode:'CONSTANT',writable:true,expression:''}];
      nativeSourceSnapshot={revision,enabled:true,uniforms:[{id:decl.id,components:raw}],specConstants:[]};
      const box=document.createElement('div');nativeInputFields(box,decl);const inputs=[...box.querySelectorAll('[data-source-component]')];
      const before=inputs.map(e=>({value:e.value,expected:e.sourceExpected.value}));inputs[0].value='true';inputs[0].onchange();
      const exposed=liveUniformFields(decl);nativeSourceSnapshot=previous;nativeSourceRequest=request;
      return {before,request:requests[0],exposed:exposed.querySelectorAll('select[data-component]').length};
    });
    assert.deepEqual(live.before,[{value:'false',expected:0},{value:'true',expected:1}]);assert.equal(live.request.value,true);assert.equal(live.request.expected.value,0);assert.equal(live.exposed,2);
    checks.push('Native and Exposed Boolean vector controls display bool values, submit real booleans, and preserve raw numeric optimistic-concurrency snapshots');

    const liveIntegers=await page.evaluate(()=>{
      const previous=nativeSourceSnapshot,request=nativeSourceRequest,requests=[],rows=[];
      nativeSourceRequest=(endpoint,body)=>requests.push(clone(body));
      try{
        for(const [kind,type,values] of [
          ['uniform','int',[-2147483648,16777217,2147483647]],
          ['uniform','uint',[16777217,2147483649,4294967295]],
          ['uniform','uvec2',[2147483649,4294967295]],
          ['spec_constant','int',[-2147483648,-1,16777217,2147483647]],
          ['spec_constant','uint',[16777217,2147483649,4294967295]]]){
          const decl={id:'integerLive',name:'uInteger',kind,type,value:0},raw={value:16777219,mode:'CONSTANT',writable:true,expression:''};
          nativeSourceSnapshot={revision,enabled:true,uniforms:[],specConstants:[]};
          nativeSourceSnapshot[kind==='uniform'?'uniforms':'specConstants']=[{id:decl.id,components:[raw]}];
          const box=document.createElement('div');nativeInputFields(box,decl);
          const input=box.querySelector('[data-source-component]');
          for(const value of values){input.value=String(value);input.onchange();rows.push({kind,type,value,min:input.min,max:input.max,invalid:input.getAttribute('aria-invalid'),request:requests.at(-1)});}
        }
        return rows;
      }finally{nativeSourceSnapshot=previous;nativeSourceRequest=request;}
    });
    for(const row of liveIntegers){const unsigned=/uint|uvec/.test(row.type);assert.equal(row.min,unsigned?'0':'-2147483648');assert.equal(row.max,unsigned?'4294967295':'2147483647');assert.notEqual(row.invalid,'true');assert.equal(row.request.value,row.value);assert.equal(row.request.expected.value,16777219);}
    checks.push('Native Uniform/Spec inputs accept full int/uint ranges, negative signed Spec values and precision-boundary values without altering raw concurrency snapshots');

    assert.equal(await page.evaluate(()=>{
      const decl=createInputDeclaration('uniform','bvec2'),box=document.createElement('div');
      const payload=clone({revision:0,uniforms:{},textures:{}});
      const entry=typedScalarInput(1,'bool',()=>{});entry.setSyncedValue(0);return entry.value==='false'&&decl.value.every(v=>v===false);
    }),true);

    await reset();await page.evaluate(()=>{const a=addTyped('bool','scalar',{type:'bool',value:true}),b=addTyped('if','if',{type:'bvec2'},{typeMode:'locked'});current().edges=[{from:[a.id,'out'],to:[b.id,'condition']}];selection=new Set(['bool','if']);selected='if';groupSelection();render();});await settle();
    const functionId=await page.evaluate(()=>graph.functions[0].id);assert.ok(functionId);
    assert.equal(await page.evaluate(()=>graph.functions[0].graph.nodes.find(n=>n.id==='bool').params.value),true);
    await page.evaluate(()=>{const call=current().nodes.find(n=>n.definitionUuid===FunctionModel.CALL);enterFunction(call);selected='input';selection=new Set(['input']);inspectorTab='settings';const f=currentFunction();f.inputs=[{id:'flags',name:'Flags',type:'bvec2',default:[true,false]},{id:'index',name:'Index',type:'uint',default:4294967295}];render();});await settle();
    const controls=await page.locator('#inspector .components').evaluateAll(es=>es.map(e=>({boolean:e.querySelectorAll('select').length,maximum:e.querySelector('input')?.max})));assert.deepEqual(controls,[{boolean:2,maximum:undefined},{boolean:0,maximum:'4294967295'}]);
    checks.push('Subgraph grouping preserves typed nodes and Function interfaces expose Boolean vector and full-range uint defaults');

    await reset();await page.evaluate(()=>{const decl=createInputDeclaration('constant','uvec2',{value:[4294967295,2147483649]}),node=addTyped('ref','constant',{declarationId:decl.id});window.typedClipboard=GraphClipboard.decode(GraphClipboard.encode(graph,current(),[node.id],'typed-source'));});
    const copied=await page.evaluate(()=>{const doc=clone(graph);doc.declarations=[];doc.stages.pixel={nodes:[],edges:[]};const ids=GraphClipboard.paste(doc,doc.stages.pixel,typedClipboard,{source:'another',stage:'pixel',target:'top',catalog,types:interfaceTypes(),anchor:{x:0,y:0}});return {ids,value:doc.declarations[0].value,type:doc.declarations[0].type};});assert.equal(copied.ids.length,1);assert.equal(copied.type,'uvec2');assert.deepEqual(copied.value,[4294967295,2147483649]);
    checks.push('Cross-graph clipboard preserves exact unsigned vector declaration values');
    assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,count:checks.length}));
  }catch(error){await h.finish(error);console.error(error);process.exitCode=1;}
})();
