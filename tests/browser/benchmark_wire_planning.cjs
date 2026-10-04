/* Isolated browser costs, same fixtures and browser for Legacy and refactor.
 * node benchmark_wire_planning.cjs SOURCE_DIR STATE_JSON REPORT_DIR
 * Compare raw samples; this measures frontend work, never TD/GPU latency.
 */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {harness}=require('./test_glsl_code.cjs');
const [source,stateFile,folder]=process.argv.slice(2);
const uiSamples=Number(process.env.WIRE_UI_SAMPLES||8);
(async()=>{
  const h=await harness(source,stateFile,folder,{skipPreview:true}),{page,checks,errors,settle}=h;
  const samples=[];
  try{
    for(const size of [8,48,128]){
      await page.evaluate(size=>{
        closeCreator();clearTimeout(autoTimer);scheduleGraphApply=()=>{};
        connectionInterrupted=true;conflicted=false;readonly=false;historyBusy=nativeMutationBusy=false;
        stage='pixel';graphTrail=[];graph.functions=[];graph.declarations=[];past=[];future=[];selection.clear();selected=selectedEdge=null;
        const nodes=[testNode('source','vector',30,50,{type:'vec3',components:[1,2,3,4]}),testNode('other','vector',30,320,{type:'vec3',components:[4,3,2,1]})],edges=[];
        for(let i=0;i<size-2;i++){
          const n=testNode('add'+i,'add',350+i*25,50,{type:'vec3'});n.ui.typeMode='auto';nodes.push(n);
          edges.push({from:[i?'add'+(i-1):'source','out'],to:['add'+i,'a']});
        }
        graph.stages.pixel={nodes,edges};rememberSavedGraph(graph);render();scale=.7;pan={x:10,y:10};transform();
      },size);await settle();
      const rows=await page.evaluate(async ({size,uiSamples})=>{
        const rows=[],frame=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
        const from={node:'other',kind:'outputs',port:'out'},to={node:'add0',kind:'inputs',port:'a'};
        const before=JSON.stringify(graph);
        for(let i=0;i<30;i++){const t=performance.now();planWireTypes(from,to);if(i>=5)rows.push({size,operation:'plan',ms:performance.now()-t});}
        for(let i=0;i<uiSamples+2;i++){
          let t=performance.now();if(!connectPorts(from,to))throw Error('wire rejected');let sync=performance.now()-t;await frame();
          if(i>=2)rows.push({size,operation:'connect',ms:sync,paintMs:performance.now()-t});
          t=performance.now();await undo();sync=performance.now()-t;await frame();
          if(i>=2)rows.push({size,operation:'undo',ms:sync,paintMs:performance.now()-t});
          if(JSON.stringify(graph)!==before)throw Error('Undo changed the original graph');
        }
        for(let i=0;i<uiSamples+2;i++){
          const r=$('#canvas').getBoundingClientRect(),t=performance.now();openCreator(r.left+500,r.top+300,from);const sync=performance.now()-t;await frame();
          if(i>=2)rows.push({size,operation:'creator',ms:sync,paintMs:performance.now()-t});closeCreator();
        }
        return rows;
      },{size,uiSamples});
      samples.push(...rows);checks.push(`${size} nodes: plan, replace wire, Undo restores original, Creator`);
    }
    assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(folder,'timings.json'),JSON.stringify({source,browser:await h.browser.version(),viewport:{width:1600,height:1100},uiSamples,samples},null,2));
    await h.finish();console.log(JSON.stringify({passed:true,samples:samples.length}));
  }catch(error){await h.finish(error);throw error;}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
