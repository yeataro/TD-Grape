/* Function parity and work counters for presentation edits. Isolated API only.
 * node test_layout_edits.cjs SOURCE_DIR STATE_JSON REPORT_DIR */
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {harness}=require('./test_glsl_code.cjs');
(async()=>{
  const [source,stateFile,folder]=process.argv.slice(2),h=await harness(source,stateFile,folder,{skipPreview:true});
  const {page,checks,errors}=h;
  try{
    const results=await page.evaluate(async()=>{
      const setup=count=>{
        clearTimeout(autoTimer);graph.declarations=[];graph.functions=[];graphTrail=[];stage='pixel';
        graph.stages.pixel={nodes:Array.from({length:count},(_,i)=>testNode('n'+i,'scalar',i*20,100,{type:'float',value:i})),edges:[]};
        past=[];future=[];selection=new Set(['n0']);selected='n0';selectedEdge=null;dirty=false;readonly=false;historyBusy=false;nativeMutationBusy=false;
        render();return clone(graph);
      };
      const saved={resolveAutoEdit,rejectNewConstantIssues,library,declarations,renderNativeSources},calls={};
      for(const [key,fn] of Object.entries(saved))window[key]=function(...args){calls[key]=(calls[key]||0)+1;return fn(...args);};
      const measurements=[];
      for(const count of [16,101]){
        const baseline=setup(count), edit=()=>{current().nodes[0].ui.x=111;current().nodes[0].ui.width=280;current().nodes[0].ui.collapsed=true;};
        for(const layout of [false,true]){
          graph=clone(baseline);past=[];future=[];for(const key of Object.keys(calls))delete calls[key];
          const start=performance.now();const ok=change(edit,{localize:false,layout});const ms=performance.now()-start;
          clearTimeout(autoTimer);autoTimer=null;
          measurements.push({count,layout,ok,ms,calls:{...calls},graph:clone(graph),history:past.map(p=>({before:p.before,after:p.after,sourceIds:p.sourceIds})),draft:JSON.parse(sessionStorage.getItem(draftKey)).graph});
        }
      }
      setup(2);const before=clone(graph);change(()=>{current().nodes[0].ui.x+=40;},{localize:false,layout:true});clearTimeout(autoTimer);
      const moved=clone(graph);await undo();clearTimeout(autoTimer);const undone=clone(graph);await undo(true);clearTimeout(autoTimer);const redone=clone(graph);
      for(const key of Object.keys(calls))delete calls[key];
      change(()=>{current().nodes[0].params.value=7;},{localize:false,layout:true});clearTimeout(autoTimer);
      const semanticFallback={...calls};for(const key of Object.keys(calls))delete calls[key];
      change(()=>{current().nodes[0].ui.label='Visible GLSL label';},{localize:false,layout:true});clearTimeout(autoTimer);
      const labelFallback={...calls};const protectedBefore=JSON.stringify(graph);readonly=true;
      const rejected=change(()=>{current().nodes[0].ui.x=999;},{localize:false,layout:true});readonly=false;
      for(const [key,fn] of Object.entries(saved))window[key]=fn;
      return {measurements,before,moved,undone,redone,semanticFallback,labelFallback,rejected,unchanged:protectedBefore===JSON.stringify(graph)};
    });
    for(let i=0;i<results.measurements.length;i+=2){
      const old=results.measurements[i],next=results.measurements[i+1];assert.equal(next.ok,true);
      assert.deepEqual(next.graph,old.graph);assert.deepEqual(next.history,old.history);assert.deepEqual(next.draft,old.draft);
      assert.ok(old.calls.resolveAutoEdit>0);assert.equal(next.calls.resolveAutoEdit||0,0);assert.equal(next.calls.rejectNewConstantIssues||0,0);
      for(const name of ['library','declarations','renderNativeSources'])assert.equal(next.calls[name]||0,0);
      checks.push(`${next.count} nodes: identical graph, Undo entry and immediate draft; no semantic inference or unrelated sidebar reconstruction`);
    }
    assert.deepEqual(results.undone,results.before);assert.deepEqual(results.redone,results.moved);checks.push('layout edit Undo/Redo restores exact documents');
    assert.ok(results.semanticFallback.resolveAutoEdit>0);assert.ok(results.labelFallback.resolveAutoEdit>0);checks.push('misclassified parameter and GLSL label edits retain the semantic path');
    assert.equal(results.rejected,false);assert.equal(results.unchanged,true);checks.push('read-only layout edits remain inert');
    fs.writeFileSync(path.join(folder,'measurements.json'),JSON.stringify(results.measurements.map(({count,layout,ms,calls})=>({count,layout,ms,calls})),null,2));
    assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,checks}));
  }catch(e){await h.finish(e);throw e;}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
