/* Local wire-creator signatures, fresh commit validation and bounded search work. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {harness}=require('./test_glsl_code.cjs');
const [source,stateFile,folder]=process.argv.slice(2);
(async()=>{
  const h=await harness(source,stateFile,folder),{page,checks,errors,settle}=h,measurements=[];
  page.setDefaultTimeout(6000);
  await page.evaluate(()=>{
    window.optimizedCreatorTypePlan=creatorTypePlan;
    window.creatorCounts={full:0,auto:0,nodes:0};
    const full=planWireTypes,auto=planAutoGraph;
    planWireTypes=function(...args){creatorCounts.full++;return full(...args);};
    planAutoGraph=function(...args){creatorCounts.auto++;creatorCounts.nodes+=args[1].nodes.length;return auto(...args);};
  });
  const reset=async({type='vec3',count=1,constant=false}={})=>{
    await page.evaluate(({type,count,constant})=>{
      closeCreator();cancelValueLadder();document.activeElement?.blur();clearTimeout(autoTimer);connectionInterrupted=true;conflicted=true;readonly=false;historyBusy=false;nativeMutationBusy=false;
      stage='pixel';graphTrail=[];graph.functions=[];graph.declarations=[];selected=null;selectedEdge=null;selection.clear();past=[];future=[];
      const family=typeFamily(type),n=isMatrixType(type)?testNode('source','matrix',40,50,{type,values:matrixReshapeValue([1,0,0,1],'mat2',type)}):typeComponents(type)===1?testNode('source','scalar',40,50,{type,value:family==='bool'?true:1}):testNode('source','vector',40,50,{type,components:family==='bool'?[true,false,true,false]:[1,2,3,4]});
      const nodes=[n],edges=[];
      for(let i=0;i<count;i++){const add=testNode('add'+i,'add',280+i*20,50,{type:typeFamily(type)==='bool'?'float':type});add.ui.typeMode='auto';if(i===0&&constant)add.params.requireConstant=true;nodes.push(add);if(typeFamily(type)!=='bool')edges.push({from:[i?'add'+(i-1):'source','out'],to:['add'+i,'a']});}
      graph.stages.pixel={nodes,edges};rememberSavedGraph(graph);render();scale=.6;pan={x:10,y:10};transform();
    },{type,count,constant});await settle();
  };
  const open=async(kind='outputs',type='vec3',node=kind==='outputs'?'source':'add0',port=kind==='outputs'?'out':'a')=>page.evaluate(({kind,type,node,port})=>{
    closeCreator();creatorCounts={full:0,auto:0,nodes:0};const r=$('#canvas').getBoundingClientRect(),start=performance.now();openCreator(r.left+260,r.top+140,{kind,type,node,port});return {ms:performance.now()-start,...creatorCounts,matches:creatorMatches.length};
  },{kind,type,node,port});
  const compare=async(query='',filter='all',sourceFilter='all')=>{
    const result=await page.evaluate(({query,filter,sourceFilter})=>{
      $('#createsearch').value=query;$('#createtype').value=filter;$('#createsource').value=sourceFilter;
      const before=JSON.stringify({graph,past,future}),read=()=>creatorMatches.map(m=>({key:browserEntryKey(m.d),type:m.type,port:m.port,portType:m.portType,params:m.params,variant:m.variant}));
      creatorTypePlan=optimizedCreatorTypePlan;renderCreator();const actual=read();
      try{creatorTypePlan=(...args)=>optimizedCreatorTypePlan(...args.slice(0,5));renderCreator();return {actual,expected:read(),unchanged:before===JSON.stringify({graph,past,future})};}
      finally{creatorTypePlan=optimizedCreatorTypePlan;}
    },{query,filter,sourceFilter});
    assert.equal(result.unchanged,true);assert.deepEqual(result.actual,result.expected,`${query}/${filter}/${sourceFilter}`);
  };
  try{
    for(const type of ['float','int','uint','bool','vec3','ivec3','bvec3','mat3']){
      await reset({type});await open('outputs',type);await compare();await compare('con');
      if(!['bool','bvec3'].includes(type)){await open('inputs',type);await compare();await compare('mat');}
    }
    checks.push('forward/reverse candidate selection, ports and signatures match the full validator on ordinary scalar/vector/matrix graphs');

    await reset();await open();for(const filter of ['float','int','vec3','ivec3'])await compare('a',filter);
    await compare('convert','all');await compare('scalar','all');
    const sourceFilter=await page.locator('#createsource option').evaluateAll(es=>es.find(e=>e.value!=='all').value);await compare('', 'all',sourceFilter);
    checks.push('query, source and explicit type filters retain the original candidate order and Auto/locked choice');

    await reset();await page.evaluate(()=>{
      const vector=testNode('pair','vector',40,220,{type:'vec2',components:[1,2,0,0]}),combine=testNode('combine','combine',300,220,{type:'vec4',groups:{x:'vec2'},components:[0,0,0,0]}),replace=testNode('replace','replace',580,220,{type:'vec4',groups:{x:'vec2'},components:[0,0,0,0]});
      current().nodes.push(vector,combine,replace);current().edges.push({from:['pair','out'],to:['combine','x']},{from:['pair','out'],to:['replace','x']});render();
    });
    for(const node of ['combine','replace']){await open('inputs','vec2',node,'x');await compare();}
    await open('outputs','vec2','pair');await compare();
    checks.push('assembler overlap replacement and grouped vector ports retain full-validator preview parity');

    await reset({type:'float'});await page.evaluate(()=>{
      const n=testNode('branch','if',500,100,{type:'vec3'});n.ui.typeMode='auto';current().nodes.push(n);render();
    });await open('inputs','bool','branch','condition');await compare();
    checks.push('If Condition remains Boolean even though its result and branch types use Auto');

    await reset();await open();await page.evaluate(()=>{window.firstCreatorContext=creatorState.validation;$('#createsearch').value='mat';creatorCounts={full:0,auto:0,nodes:0};renderCreator();});
    assert.deepEqual(await page.evaluate(()=>creatorCounts),{full:0,auto:0,nodes:0});assert.equal(await page.evaluate(()=>creatorState.validation===firstCreatorContext),true);
    for(const edit of ['constant','default','declaration','library','contract']){
      await page.evaluate(edit=>{
        window.previousCreatorContext=creatorState.validation;
        if(edit==='constant')current().nodes.find(n=>n.id==='add0').params.requireConstant=true;
        if(edit==='default')current().nodes.find(n=>n.id==='add0').inputValues={b:[4,5,6]};
        if(edit==='declaration')graph.declarations.push({id:'newInput',name:'uNew',kind:'uniform',type:'float',value:0});
        if(edit==='library')personalLibrary={...personalLibrary,folder:personalLibrary.folder+' changed'};
        if(edit==='contract')typeContract=clone(typeContract);
        if(edit==='contract')typeContract.creatorTestGeneration=1;
        renderCreator();
      },edit);
      assert.equal(await page.evaluate(()=>creatorState.validation===previousCreatorContext),false,edit);
    }
    await reset();await open();await page.evaluate(()=>{window.firstCreatorContext=creatorState.validation;change(()=>{current().nodes.find(n=>n.id==='source').params.type='ivec3';});renderCreator();});
    assert.equal(await page.evaluate(()=>creatorState.validation===firstCreatorContext),false);await page.evaluate(()=>undo());await settle();await page.evaluate(()=>renderCreator());await compare('con');
    checks.push('typing reuses signatures while graph values, constraints, declarations, libraries, contract changes and Undo invalidate safely');

    await reset({type:'float',constant:true});await page.evaluate(()=>{graph.declarations.push({id:'live',name:'uLive',kind:'uniform',type:'float',value:1});render();});await open('inputs','float');
    const constResult=await page.evaluate(()=>{
      const index=creatorMatches.findIndex(m=>m.d.inputSourceId==='live'),before=JSON.stringify({graph,past,future});
      if(index<0)return {found:false};creatorCounts.full=0;chooseCreator(index);return {found:true,unchanged:before===JSON.stringify({graph,past,future}),full:creatorCounts.full,open:!!creatorState};
    });assert.equal(constResult.found,true);assert.equal(constResult.unchanged,true);assert.ok(constResult.full>0);assert.equal(constResult.open,true);
    checks.push('constant restrictions are deferred to fresh creation validation; a rejected choice leaves the graph and history untouched');

    await reset();await page.evaluate(()=>{const split=testNode('split','vector_split',550,100,{type:'vec3'});split.ui.typeMode='locked';current().nodes.push(split);current().edges.push({from:['add0','out'],to:['split','value']});render();});await open('inputs','vec3');
    const downstream=await page.evaluate(()=>{
      const index=creatorMatches.findIndex(m=>m.d.fixedType==='float'),before=JSON.stringify({graph,past,future});if(index<0)return {found:false};chooseCreator(index);return {found:true,unchanged:before===JSON.stringify({graph,past,future})};
    });assert.equal(downstream.found,true);assert.equal(downstream.unchanged,true);
    checks.push('a locally compatible source can remain searchable while final validation protects locked downstream ports');

    await reset();await open();const stale=await page.evaluate(()=>{
      const index=creatorMatches.findIndex(m=>m.d.key==='add');current().nodes.find(n=>n.id==='source').params.type='bvec3';const before=JSON.stringify({graph,past,future});chooseCreator(index);return {unchanged:before===JSON.stringify({graph,past,future}),open:!!creatorState};
    });assert.equal(stale.unchanged,true);assert.equal(stale.open,true);
    await reset();await open();await page.evaluate(()=>{const index=creatorMatches.findIndex(m=>m.d.key==='add');creatorCounts.full=0;chooseCreator(index);});assert.ok(await page.evaluate(()=>creatorCounts.full>0));assert.equal(await page.evaluate(()=>!!creatorState),false);assert.equal(await page.evaluate(()=>past.length),1);await page.evaluate(()=>undo());await settle();assert.equal(await page.evaluate(()=>current().nodes.length),2);
    checks.push('selection validates again after a stale graph change; successful creation remains one Undo transaction');

    await reset();await page.evaluate(()=>{current().edges.push({from:['add0','out'],to:['add0','b']});});await open();await compare();assert.equal(await page.evaluate(()=>creatorMatches.length),0);
    await page.evaluate(()=>{closeCreator();readonly=true;});await open();assert.equal(await page.evaluate(()=>!!creatorState),false);
    checks.push('cyclic drafts retain the existing no-candidate outcome and read-only state cannot open the creator');

    for(const constant of [false,true])for(const kind of ['outputs','inputs']){
      await reset({count:100,constant});const opening=await open(kind);assert.equal(opening.full,0);assert.ok(opening.nodes<1000,JSON.stringify(opening));
      for(const query of ['a','ad','add','mat','matrix','con','convert','add']){
        const result=await page.evaluate(query=>{creatorCounts={full:0,auto:0,nodes:0};$('#createsearch').value=query;const start=performance.now();renderCreator();return {ms:performance.now()-start,...creatorCounts};},query);
        assert.equal(result.full,0);assert.equal(result.auto,0);measurements.push({kind,constant,query,...result});
      }
      measurements.push({kind,constant,query:'<open>',...opening});
    }
    checks.push('101-node forward/reverse search, with and without constant requirements, avoids per-candidate full-graph trials and all repeated typing trials');
    assert.deepEqual(errors,[]);fs.writeFileSync(path.join(folder,'creator-timings.json'),JSON.stringify(measurements,null,2));await h.finish();console.log(JSON.stringify({passed:true,count:checks.length,openings:measurements.filter(m=>m.query==='<open>')}));
  }catch(error){await h.finish(error);throw error;}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
