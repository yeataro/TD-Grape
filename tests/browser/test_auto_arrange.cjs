/* Automatic layout runs against the isolated fixture API, never TD.
 * node test_auto_arrange.cjs SOURCE_DIR STATE_JSON REPORT_DIR */
const assert=require('node:assert/strict'),path=require('node:path');
const {harness}=require('./test_glsl_code.cjs');
async function run(){
  const[source,stateFile,folder]=process.argv.slice(2),h=await harness(source,stateFile,folder),{page,checks,errors,settle}=h;
  page.setDefaultTimeout(6000);
  const graphJSON=()=>page.evaluate(()=>JSON.stringify(graph));
  const bounds=()=>page.evaluate(()=>selectedCanvasNodes().map(n=>({id:n.id,...nodeLayoutBounds(n)})));
  const withoutPositions=raw=>{const g=JSON.parse(raw);for(const level of [...Object.values(g.stages),...(g.functions||[]).map(f=>f.graph)])for(const n of level.nodes)if(n.ui){delete n.ui.x;delete n.ui.y;}return g;};
  const noOverlap=rows=>{for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++){const a=rows[i],b=rows[j];assert.ok(a.x+a.width+47.9<=b.x||b.x+b.width+47.9<=a.x||a.y+a.height+47.9<=b.y||b.y+b.height+47.9<=a.y,`${a.id}/${b.id} need space around their actual bounds`);}};
  const flowsRight=(rows,pairs)=>{const byId=new Map(rows.map(n=>[n.id,n]));for(const[a,b]of pairs){const from=byId.get(a),to=byId.get(b);assert.ok(from.x+from.width+47.9<=to.x,`${a} must precede ${b} from left to right`);}};
  const above=(rows,upper,lower)=>{const a=rows.find(n=>n.id===upper),b=rows.find(n=>n.id===lower);assert.ok(a.y+a.height+47.9<=b.y,`${upper} must be above ${lower}, following socket order`);};
  const separatedGroups=(rows,groups)=>{const boxes=groups.map(ids=>{const ns=rows.filter(n=>ids.includes(n.id));return{top:Math.min(...ns.map(n=>n.y)),bottom:Math.max(...ns.map(n=>n.y+n.height))};}).sort((a,b)=>a.top-b.top);for(let i=1;i<boxes.length;i++)assert.ok(boxes[i-1].bottom+47.9<=boxes[i].top,'disconnected groups occupy separate vertical bands');};
  const install=async(specs,pairs,ids=specs.map(n=>n.id))=>{
    await page.evaluate(({specs,pairs,ids})=>{
      closeArrangeMenu();graph=clone(window.autoArrangeFixture);stage='pixel';graphTrail=[];
      const nodes=specs.map((s,i)=>{const n=testNode(s.id,s.key||'add',s.x??(950-i*175),s.y??(60+(i%3)*170),s.params||{});n.ui.width=s.width||[230,330,280][i%3];if(s.collapsed)n.ui.collapsed=true;if(s.key==='comment'){n.ui.height=s.height||340;n.ui.comment='Layout note\nKept outside the shader flow.';}return n;});
      nodes.push(testNode('outside','color',1800,80,{value:[.1,.2,.3,1]}),testNode('output','pixel_out',2150,80));
      current().nodes=nodes;current().edges=pairs.map(([from,to,port='a',fromPort='out'])=>({from:[from,fromPort],to:[to,port]}));current().edges.push({from:['outside','out'],to:['output','color']});
      selection=new Set(ids);selected=ids.at(-1)||null;selectedEdge=null;selectedInputId=null;past=[];future=[];readonly=false;historyBusy=false;nativeMutationBusy=false;dirty=false;rememberSavedGraph(graph);render();fit();
    },{specs,pairs,ids});await settle();
  };
  const exercise=async(specs,pairs,{ids,menu=false,groups,shortcut=false}={})=>{
    await install(specs,pairs,ids);const original=await graphJSON(),initialBounds=await bounds();
    assert.equal(await page.evaluate(()=>hasShaderChanges()),false);
    if(menu){await page.locator('#grapharrange').click();const action=page.locator('[data-arrange="auto"]');assert.equal(await action.isVisible(),true);assert.equal(await action.isEnabled(),true);assert.ok((await action.innerText()).trim()&&!((await action.innerText()).includes('arrange.auto')),'automatic layout has a translated menu label');await action.click();}
    else if(shortcut){await page.locator('#canvas').focus();await page.keyboard.press('l');}
    else assert.equal(await page.evaluate(()=>arrangeSelection('auto')),true);
    await settle();const arranged=await graphJSON(),rows=await bounds();assert.notEqual(arranged,original,'fixture must require a layout change');
    assert.equal(await page.evaluate(()=>past.length),1,'automatic layout is one Undo operation');
    assert.equal(await page.evaluate(()=>hasShaderChanges()),false,'positions never make the shader semantically dirty');
    assert.deepEqual(withoutPositions(arranged),withoutPositions(original),'layout changes coordinates only');
    const selectedIds=new Set(rows.map(n=>n.id)),before=JSON.parse(original),after=JSON.parse(arranged);
    assert.deepEqual(after.stages.pixel.nodes.filter(n=>!selectedIds.has(n.id)),before.stages.pixel.nodes.filter(n=>!selectedIds.has(n.id)),'unselected nodes retain exact data and positions');
    for(const name of Object.keys(before.stages))if(name!=='pixel')assert.deepEqual(after.stages[name],before.stages[name],'other stages remain unchanged');
    rows.forEach(n=>{assert.ok(Number.isFinite(n.x)&&Number.isFinite(n.y));const old=initialBounds.find(o=>o.id===n.id);assert.equal(n.width,old.width);assert.equal(n.height,old.height);});
    noOverlap(rows);flowsRight(rows,pairs.filter(([a,b])=>selectedIds.has(a)&&selectedIds.has(b)));if(groups)separatedGroups(rows,groups);
    assert.equal(await page.evaluate(()=>arrangeSelection('auto')),true);await settle();assert.equal(await graphJSON(),arranged,'repeated automatic layout is stable');assert.equal(await page.evaluate(()=>past.length),1,'repeating unchanged layout adds no history');
    await page.locator('#undo').click();await settle();assert.equal(await graphJSON(),original,'Undo restores the exact graph');
    await page.locator('#redo').click();await settle();assert.equal(await graphJSON(),arranged,'Redo restores the exact arranged graph');assert.equal(await page.evaluate(()=>hasShaderChanges()),false);
    return rows;
  };
  try{
    await page.evaluate(()=>{clearTimeout(autoTimer);connectionInterrupted=true;conflicted=true;readonly=false;window.autoArrangeFixture=clone(graph);setUIExperiments({selectionToolbar:'off',editToolbar:true});});
    await exercise([{id:'a',key:'float'},{id:'b'},{id:'c'}],[['a','b'],['b','c']],{menu:true});
    checks.push('the translated automatic-layout menu action lays a chain left to right using rendered node sizes; coordinates alone change, with one exact Undo/Redo and stable repeat');

    await exercise([{id:'a',key:'float'},{id:'b'},{id:'c'}],[['a','b'],['b','c']],{shortcut:true});
    checks.push('plain L from the graph invokes the same automatic layout with one exact Undo/Redo, stable repeat, and no shader changes');

    await install([{id:'a',key:'float'},{id:'b'}],[['a','b']]);
    const shortcutBefore=await graphJSON();
    const blocked=await page.evaluate(()=>{
      const results=[],canvas=$('#canvas'),fire=(name,target=canvas,options={})=>{const e=new KeyboardEvent('keydown',{key:'l',code:'KeyL',bubbles:true,cancelable:true,...options});target.dispatchEvent(e);results.push({name,prevented:e.defaultPrevented,graph:JSON.stringify(graph),history:past.length});};
      for(const modifier of ['ctrlKey','shiftKey','altKey','metaKey'])fire(modifier,canvas,{[modifier]:true});
      fire('repeat',canvas,{repeat:true});fire('IME',canvas,{isComposing:true});
      for(const tag of ['input','textarea','select','div']){const control=document.createElement(tag);if(tag==='div')control.contentEditable='true';canvas.append(control);control.focus();fire(tag,control);control.remove();}
      const outside=document.createElement('button');document.body.append(outside);outside.focus();fire('outside graph',outside);outside.remove();
      readonly=true;fire('readonly');readonly=false;
      historyBusy=true;fire('history busy');historyBusy=false;
      nativeMutationBusy=true;fire('native mutation busy');nativeMutationBusy=false;
      selection=new Set(['a']);fire('single selection');selection.clear();fire('empty selection');selection=new Set(['a','b']);
      canvas.onpointermove=()=>{};fire('canvas gesture');canvas.onpointermove=null;
      valueLadder={};fire('value ladder');valueLadder=null;
      pendingValueLadder={};fire('pending value ladder');pendingValueLadder=null;
      numericPresetMenu={};fire('numeric presets');numericPresetMenu=null;
      creatorState={};fire('creator');creatorState=null;
      linkStart={};fire('connection');linkStart=null;
      wireGesture={};fire('wire gesture');wireGesture=null;
      nodeDragGesture={};fire('node drag');nodeDragGesture=null;
      nodeResizeGesture={};fire('node resize');nodeResizeGesture=null;
      touchGraphGesture={};fire('touch gesture');touchGraphGesture=null;
      $('#shortcutspanel').showModal();fire('dialog open');$('#shortcutspanel').close();
      openArrangeMenu();fire('popover open');closeArrangeMenu();
      return results;
    });
    for(const result of blocked){assert.equal(result.graph,shortcutBefore,result.name+' must not edit the graph');assert.equal(result.history,0,result.name+' must not add history');}
    for(const modifier of ['ctrlKey','shiftKey','altKey','metaKey'])assert.equal(blocked.find(r=>r.name===modifier).prevented,false,modifier+'+L remains available to the browser');
    checks.push('L leaves modified browser chords, text/select/contenteditable/IME input, key repeat, out-of-graph focus, modal/popover and active gestures alone; readonly, busy and fewer-than-two selections do not mutate');

    await exercise([{id:'a',key:'float',width:240},{id:'b',width:370},{id:'c',width:280},{id:'d',width:330}],[['a','b'],['a','c'],['b','d','a'],['c','d','b']]);
    await exercise([{id:'a',key:'float'},{id:'b'},{id:'c'},{id:'d'}],[['a','d','a'],['b','d','b'],['b','c']]);
    checks.push('diamond branches, merges, and multiple roots keep every dependency left to right with generous nonoverlapping bounds');

    for(const reverseNodes of [false,true])for(const reverseEdges of [false,true]){
      const specs=[{id:'lower',key:'float'},{id:'upper',key:'float'},{id:'sink'}],pairs=[['lower','sink','b'],['upper','sink','a']];
      const rows=await exercise(reverseNodes?[...specs].reverse():specs,reverseEdges?[...pairs].reverse():pairs);above(rows,'upper','lower');
    }
    checks.push('sources follow the target input socket order a then b regardless of graph creation order or edge insertion order');

    for(const reverseNodes of [false,true])for(const reverseEdges of [false,true]){
      const specs=[{id:'lower'},{id:'upper'},{id:'split',key:'vector_split',params:{type:'vec2'}}],pairs=[['split','lower','a','y'],['split','upper','a','x']];
      const rows=await exercise(reverseNodes?[...specs].reverse():specs,reverseEdges?[...pairs].reverse():pairs);above(rows,'upper','lower');
    }
    checks.push('Split output branches follow logical X then Y socket order regardless of graph creation order or edge insertion order');

    const chained=await exercise([{id:'lowerSource',key:'float'},{id:'lower'},{id:'upperSource',key:'float'},{id:'upper'},{id:'sink'}],[['lowerSource','lower'],['lower','sink','b'],['upperSource','upper'],['upper','sink','a']]);
    above(chained,'upper','lower');above(chained,'upperSource','lowerSource');
    const collapsed=await exercise([{id:'lower',key:'float'},{id:'upper',key:'float'},{id:'sink',collapsed:true}],[['lower','sink','b'],['upper','sink','a']]);above(collapsed,'upper','lower');
    assert.equal(await page.evaluate(()=>current().nodes.find(n=>n.id==='sink').ui.collapsed),true);
    checks.push('final target socket ordering propagates through upstream chains and survives a collapsed target with a shared visual anchor; exact history and semantic invariants still hold');

    const disconnected=await exercise([{id:'a',key:'float'},{id:'b'},{id:'c',key:'float'},{id:'d'},{id:'note',key:'comment',height:380}],[['a','b'],['c','d']],{groups:[['a','b'],['c','d'],['note']]});
    assert.ok(new Set(disconnected.map(n=>n.height)).size>1,'fixture exercises actual variable heights');
    checks.push('disconnected chains and a tall Comment occupy separate vertical bands; Comment text, dimensions, graph content, and shader state stay intact');

    await exercise([{id:'a',key:'float'},{id:'b'},{id:'c'},{id:'d'}],[['a','b'],['b','c'],['c','d']],{ids:['b','c']});
    checks.push('a selected subset uses only its internal dependencies and leaves incoming/outgoing unselected nodes and other graphs untouched');

    const cyclic=await page.evaluate(()=>{
      const items=[{id:'a',x:610,y:170,width:240,height:120},{id:'b',x:180,y:230,width:320,height:190},{id:'c',x:15,y:80,width:260,height:140},{id:'d',x:700,y:900,width:210,height:280}],edges=[{from:['a','out'],to:['b','a']},{from:['b','out'],to:['a','a']},{from:['b','out'],to:['c','a']},{from:['a','out'],to:['a','b']},{from:['missing','out'],to:['b','b']}],original=JSON.stringify({items,edges});
      const positions=autoArrangePositions(items,edges),rows=items.map(n=>({...n,...positions.get(n.id)})),again=autoArrangePositions(rows,edges);
      return{rows,stable:JSON.stringify([...positions])===JSON.stringify([...again]),unchanged:original===JSON.stringify({items,edges}),empty:[...autoArrangePositions([],edges)],single:[...autoArrangePositions([items[0]],edges)]};
    });
    assert.equal(cyclic.unchanged,true,'layout solver does not mutate its inputs');assert.equal(cyclic.stable,true);assert.deepEqual(cyclic.empty,[]);assert.equal(cyclic.single.length,1);noOverlap(cyclic.rows);
    const byId=new Map(cyclic.rows.map(n=>[n.id,n]));assert.equal(byId.get('a').x,byId.get('b').x,'cycle members share a column');flowsRight(cyclic.rows,[['a','c'],['b','c']]);separatedGroups(cyclic.rows,[['a','b','c'],['d']]);
    cyclic.rows.forEach(n=>assert.ok(Number.isFinite(n.x)&&Number.isFinite(n.y)));checks.push('cycles condense into a nonoverlapping column with downstream nodes after them; self/dangling edges, empty input, and single nodes remain finite and repeatable');

    await install([{id:'a',key:'float'},{id:'b'}],[['a','b']]);await page.evaluate(()=>{readonly=true;render();});const locked=await graphJSON();assert.equal(await page.evaluate(()=>arrangeSelection('auto')),false);assert.equal(await graphJSON(),locked);assert.equal(await page.evaluate(()=>past.length),0);
    await page.evaluate(()=>{readonly=false;selection=new Set(['a']);selected='a';render();});assert.equal(await page.evaluate(()=>arrangeSelection('auto')),false);assert.equal(await graphJSON(),locked);assert.equal(await page.evaluate(()=>past.length),0);checks.push('read-only and single-node selections cannot invoke a mutating automatic layout');

    await install([{id:'a',key:'float'},{id:'b'},{id:'c'},{id:'d'},{id:'note',key:'comment'}],[['a','b'],['a','c'],['b','d','a'],['c','d','b']]);await page.evaluate(()=>{arrangeSelection('auto');fit();});await settle();await page.screenshot({path:path.join(folder,'auto-arrange.png')});
    await page.locator('#grapharrange').click();await settle();await page.screenshot({path:path.join(folder,'auto-arrange-menu.png')});assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,count:checks.length}));
  }catch(error){await h.finish(error);throw error;}
}
run().catch(error=>{console.error(error);process.exit(1);});
