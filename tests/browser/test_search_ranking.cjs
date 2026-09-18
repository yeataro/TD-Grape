/* Shared browser/creator relevance tiers; typing never plans the full graph. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const {harness}=require('./test_glsl_code.cjs');
(async()=>{
  const [source,stateFile,folder]=process.argv.slice(2);fs.mkdirSync(folder,{recursive:true});
  const fixture=path.join(folder,'fresh-state.json');execFileSync(process.env.PYTHON_EXECUTABLE||'python',[path.join(__dirname,'export_editor_fixture.py'),stateFile,fixture]);
  const h=await harness(source,fixture,folder),{page,checks,errors,settle}=h;
  try{
    await page.selectOption('#language','en');
    await page.evaluate(()=>{clearTimeout(autoTimer);connectionInterrupted=true;conflicted=true;readonly=false;historyBusy=nativeMutationBusy=false;stage='pixel';graphTrail=[];graph.declarations=[];graph.functions=[];graph.stages.pixel={nodes:[testNode('matrix','matrix',40,70,{type:'mat3'}),testNode('get','matrix_get',400,70,{type:'mat3'}),testNode('result','pixel_out',800,70)],edges:[]};selected=null;selection.clear();render();});
    const ranks=await page.evaluate(()=>{
      const entries=browserIndex();return Object.fromEntries(['mat','mat3','int','vec3','lerp'].map(q=>[q,browseEntries(entries,q).map(e=>({label:e.d.label,key:e.d.key,fixed:e.d.fixedType,score:e.score}))]));
    });
    const mat=ranks.mat,at=label=>mat.findIndex(e=>e.label===label);
    assert.ok(at('mat3')>=0&&at('dmat3')>at('mat3')&&at('Determinant')>at('dmat3'),JSON.stringify(mat));
    for(const q of ['mat3','int','vec3']){assert.ok(ranks[q][0].score===0,JSON.stringify(ranks[q]));assert.ok(ranks[q].some(e=>e.fixed===q&&e.score===0));assert.ok(ranks[q].every(e=>!e.fixed||e.fixed===q));}
    assert.equal(ranks.lerp[0].key,'mix');assert.equal(ranks.lerp[0].score,1);
    checks.push('Name-prefix mat results precede contained dmat and partial aliases; exact typed entries and exact aliases retain priority');
    const tiers=await page.evaluate(()=>{
      const entry=(label,aliases=[])=>({d:{label},meta:{glslName:'',aliases,tags:[],path:[],category:'data',secondary:[],descriptionKey:'none'}});
      return [entry('mat'),entry('Alias',['mat']),entry('Matrix'),entry('dmat3'),entry('Determinant',['matrix determinant'])].map(e=>browserSearchScore(e,'mat'));
    });assert.deepEqual(tiers,[0,1,2,3,4]);
    checks.push('Complete name, complete alias, name prefix, name substring and partial alias have distinct deterministic tiers');
    const before=await page.evaluate(()=>JSON.stringify(graph));
    await page.evaluate(()=>{window.searchFullPlans=0;const original=planWireTypes;planWireTypes=(...args)=>{searchFullPlans++;return original(...args);};const r=$('#canvas').getBoundingClientRect();openCreator(r.left+100,r.top+100);});
    await page.locator('#createsearch').fill('mat');await settle();
    const creator=await page.evaluate(()=>creatorMatches.map(e=>({label:e.d.label,score:browserSearchScore({d:e.d,meta:creatorMeta(e.d)},'mat')})));
    assert.ok(creator.findIndex(e=>e.label==='mat3')<creator.findIndex(e=>e.label==='Determinant'));
    await page.evaluate(()=>{closeCreator();const r=$('#canvas').getBoundingClientRect();openCreator(r.left+100,r.top+100,{node:'matrix',port:'out',kind:'outputs',type:'mat3'});});
    for(const query of ['m','ma','mat','mat3']){await page.locator('#createsearch').fill(query);await settle();}
    assert.equal(await page.evaluate(()=>searchFullPlans),0);
    assert.equal(await page.evaluate(()=>JSON.stringify(graph)),before);
    checks.push('Floating and wire creators use the shared ranking without graph mutation or full-graph planning while typing');
    assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,checks,ranks}));
  }catch(error){await h.finish(error);throw error;}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
