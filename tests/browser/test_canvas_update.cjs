/* Canvas publication: unchanged DOM, correct changed controls and fresh owners. */
const path=require('node:path'),assert=require('node:assert/strict');
const {harness}=require('./test_glsl_code.cjs');
const [source,stateFile,folder]=process.argv.slice(2);
(async()=>{
 const h=await harness(source,stateFile,folder,{skipPreview:true}),{page,checks,errors,settle}=h;
 page.setDefaultTimeout(6000);
 try{
  await page.evaluate(()=>{
   clearTimeout(autoTimer);scheduleGraphApply=()=>{};connectionInterrupted=true;conflicted=false;readonly=false;historyBusy=nativeMutationBusy=false;
   stage='pixel';graphTrail=[];graph.functions=[];graph.declarations=[];past=[];future=[];selected=selectedEdge=null;selection.clear();
   graph.stages.pixel={nodes:[testNode('a','scalar',30,40,{type:'float',value:2}),testNode('b','add',400,40,{type:'float'}),testNode('c','scalar',30,420,{type:'float',value:7}),testNode('d','abs',780,40,{type:'float'})],edges:[{id:'edge_1',from:['b','out'],to:['d','value']}]};
   rememberSavedGraph(graph);render();scale=.8;pan={x:20,y:20};transform();
   window.canvasTest={card:id=>document.querySelector('#cards [data-node="'+id+'"]'),refs:{},nodeRefs:{}};
   for(const n of current().nodes){canvasTest.refs[n.id]=canvasTest.card(n.id);canvasTest.nodeRefs[n.id]=n;}
  });await settle();
  const connect=await page.evaluate(()=>{
   const ok=connectPorts({node:'a',kind:'outputs',port:'out'},{node:'b',kind:'inputs',port:'a'});
   return {ok,unrelated:canvasTest.card('c')===canvasTest.refs.c,downstream:canvasTest.card('d')===canvasTest.refs.d,targetChanged:canvasTest.card('b')!==canvasTest.refs.b,connectedInputHidden:!canvasTest.card('b').querySelector('[data-inline-port="a"]'),otherInputPresent:!!canvasTest.card('b').querySelector('[data-inline-port="b"]')};
  });
  assert.deepEqual(connect,{ok:true,unrelated:true,downstream:true,targetChanged:true,connectedInputHidden:true,otherInputPresent:true});
  checks.push('Wire commit updates the changed input while preserving unrelated and unchanged downstream card DOM');
  const wireUndo=await page.evaluate(async()=>{
   const c=canvasTest.card('c'),d=canvasTest.card('d'),b=canvasTest.card('b');
   const checkpoint=past.at(-1),saved=JSON.stringify([checkpoint.before,checkpoint.after]);
   const ok=await undo(),restored=!!canvasTest.card('b').querySelector('[data-inline-port="a"]');
   const retained=canvasTest.card('c')===c&&canvasTest.card('d')===d,targetRebuilt=canvasTest.card('b')!==b;
   const redone=await undo(true),hidden=!canvasTest.card('b').querySelector('[data-inline-port="a"]');
   return {ok,restored,retained,targetRebuilt,redone,hidden,stillRetained:canvasTest.card('c')===c&&canvasTest.card('d')===d,snapshotsUnchanged:JSON.stringify([checkpoint.before,checkpoint.after])===saved};
  });
  assert.deepEqual(wireUndo,{ok:true,restored:true,retained:true,targetRebuilt:true,redone:true,hidden:true,stillRetained:true,snapshotsUnchanged:true});
  checks.push('Wire Undo/Redo preserves unrelated DOM, updates affected inputs and never mutates history snapshots');
  const repeat=await page.evaluate(()=>{const refs=[...document.querySelectorAll('#cards .node')];render();return refs.every(e=>canvasTest.card(e.dataset.node)===e);});assert.equal(repeat,true);
  checks.push('Publishing an unchanged view preserves every card');
  await page.evaluate(()=>{const c=current().nodes.find(n=>n.id==='c');canvasTest.positionCard=canvasTest.card('c');change(()=>{c.ui.x+=50;c.ui.y+=20;},{localize:false,layout:true});});
  assert.deepEqual(await page.evaluate(()=>({same:canvasTest.card('c')===canvasTest.positionCard,left:canvasTest.card('c').style.left,top:canvasTest.card('c').style.top})),{same:true,left:'80px',top:'440px'});
  checks.push('Position-only publication keeps controls and updates coordinates');
  const movedUndo=await page.evaluate(async()=>{
   const old=canvasTest.card('c');await undo();const undone=canvasTest.card('c')===old&&old.style.left==='30px';
   await undo(true);return {undone,redone:canvasTest.card('c')===old&&old.style.left==='80px'};
  });assert.deepEqual(movedUndo,{undone:true,redone:true});
  checks.push('Movement Undo/Redo updates only coordinates and retains controls');
  const cInput='#cards [data-node="c"] [data-inline-port="$value"]';
  await page.locator(cInput).fill('19');
  await page.evaluate(()=>{canvasTest.draft=document.activeElement;change(()=>{current().edges=current().edges.filter(e=>e.to[0]!=='b');});});
  const draft=await page.evaluate(()=>({same:document.activeElement===canvasTest.draft,connected:canvasTest.draft.isConnected,value:canvasTest.draft.value,targetUpdated:!!canvasTest.card('b').querySelector('[data-inline-port="a"]')}));
  assert.deepEqual(draft,{same:true,connected:true,value:'19',targetUpdated:true});
  await page.locator(cInput).press('Enter');await page.locator(cInput).press('Tab');await settle();
  assert.equal(await page.evaluate(()=>current().nodes.find(n=>n.id==='c').params.value),19);
  checks.push('An unrelated numeric draft survives a topology publication and still commits into the current graph');
  const undo=await page.evaluate(async()=>{
   const old=current().nodes.find(n=>n.id==='c'),card=canvasTest.card('c');const ok=await window.undo();
   return {ok,currentOwner:current().nodes.find(n=>n.id==='c')===old,freshCard:canvasTest.card('c')!==card,value:current().nodes.find(n=>n.id==='c').params.value};
  });assert.deepEqual(undo,{ok:true,currentOwner:true,freshCard:true,value:7});
  await page.locator(cInput).fill('23');await page.locator(cInput).press('Enter');await page.locator(cInput).press('Tab');await settle();
  assert.equal(await page.evaluate(()=>current().nodes.find(n=>n.id==='c').params.value),23);
  checks.push('Undo restores working node content, refreshes changed controls, and subsequent editing writes into the current graph');
  const added=await page.evaluate(()=>{
   const old=canvasTest.card('c');change(()=>current().nodes.push(testNode('new','scalar',500,430,{type:'float',value:4})),{localize:false});
   const inserted=!!canvasTest.card('new'),retained=canvasTest.card('c')===old;
   change(()=>{current().nodes=current().nodes.filter(n=>n.id!=='new');},{localize:false});
   return {inserted,retained,removed:!canvasTest.card('new'),unique:document.querySelectorAll('#cards .node').length===current().nodes.length};
  });assert.deepEqual(added,{inserted:true,retained:true,removed:true,unique:true});
  checks.push('Node insertion and removal do not replace unrelated cards or leave duplicate DOM');
  const controls=await page.evaluate(()=>{
   const old=canvasTest.card('c');readonly=true;render();const disabled=[...canvasTest.card('c').querySelectorAll('[data-inline-node]')].every(e=>e.disabled);const rebuilt=canvasTest.card('c')!==old;
   readonly=false;render();return {disabled,rebuilt,enabled:[...canvasTest.card('c').querySelectorAll('[data-inline-node]')].every(e=>!e.disabled)};
  });assert.deepEqual(controls,{disabled:true,rebuilt:true,enabled:true});
  checks.push('Read-only transitions invalidate control presentation');
  const names=await page.evaluate(()=>{
   const node=current().nodes.find(n=>n.id==='a');change(()=>{node.name='Signal';},{localize:false});
   showCustomNodeNames=true;render();const named=canvasTest.card('a').querySelector('.node-function-title').textContent;
   showCustomNodeNames=false;render();return {named,defaulted:canvasTest.card('a').querySelector('.node-function-title').textContent!=='Signal'};
  });assert.deepEqual(names,{named:'Signal',defaulted:true});
  checks.push('Name-display preference invalidates labels without changing graph values');
  await page.evaluate(()=>{EDITOR_DEV_SETTINGS.nodeCollapseExpandedHint=true;EDITOR_DEV_SETTINGS.nodeCollapseCollapsedHint=true;render();canvasTest.collapseOther=canvasTest.card('c');});
  await page.locator('#cards [data-node="a"] .node-collapse-toggle').click();
  assert.deepEqual(await page.evaluate(()=>({collapsed:canvasTest.card('a').classList.contains('collapsed'),other:canvasTest.card('c')===canvasTest.collapseOther,hasInput:!!canvasTest.card('a').querySelector('[data-inline-port="$value"]')})),{collapsed:true,other:true,hasInput:false});
  await page.evaluate(()=>undo());
  assert.deepEqual(await page.evaluate(()=>({expanded:!canvasTest.card('a').classList.contains('collapsed'),other:canvasTest.card('c')===canvasTest.collapseOther,hasInput:!!canvasTest.card('a').querySelector('[data-inline-port="$value"]')})),{expanded:true,other:true,hasInput:true});
  checks.push('Real collapse button and Undo rebuild the changed card, preserve other cards and restore its input');
  const conversion=await page.evaluate(()=>{
   connectPorts({node:'a',kind:'outputs',port:'out'},{node:'b',kind:'inputs',port:'a'});
   const b=canvasTest.card('b'),d=canvasTest.card('d');
   const ok=change(()=>{current().nodes.find(n=>n.id==='a').params.type='int';},{typeChange:true});
   return {ok,updated:canvasTest.card('b')!==b,conversion:!!canvasTest.card('b').querySelector('[data-source-type="int"]'),downstream:canvasTest.card('d')===d};
  });assert.deepEqual(conversion,{ok:true,updated:true,conversion:true,downstream:true});
  await page.evaluate(()=>undo());
  checks.push('Upstream type changes invalidate the receiving conversion caption but not unchanged downstream cards');
  const failed=await page.evaluate(()=>{const before=JSON.stringify(graph);const ok=change(()=>{current().nodes[0].params.value=999;throw Error('test rollback');});return {ok,restored:JSON.stringify(graph)===before,value:canvasTest.card('a').querySelector('[data-inline-port="$value"]').value};});
  assert.deepEqual(failed,{ok:false,restored:true,value:'2'});
  checks.push('Failed edits republish restored values with no stale card state');
  const chain=await page.evaluate(async()=>{
   const nodes=[testNode('from','vector',20,20,{type:'vec3'}),testNode('replacement','vector',20,300,{type:'vec3'})],edges=[];
   for(let i=0;i<46;i++){nodes.push(testNode('chain'+i,'add',400+i*25,20,{type:'vec3'}));edges.push({from:[i?'chain'+(i-1):'from','out'],to:['chain'+i,'a']});}
   graph.stages.pixel={nodes,edges};past=[];future=[];selection.clear();selected=null;render();
   const old=canvasTest.card('chain45'),before=JSON.stringify(graph);
   const connected=connectPorts({node:'replacement',kind:'outputs',port:'out'},{node:'chain0',kind:'inputs',port:'a'});
   const retained=canvasTest.card('chain45')===old,materialized=!!current().nodes.find(n=>n.id==='chain45').params.operandTypes;
   const undone=await undo();return {connected,retained,materialized,undone,undoRetained:canvasTest.card('chain45')===old,restored:JSON.stringify(graph)===before};
  });assert.deepEqual(chain,{connected:true,retained:true,materialized:false,undone:true,undoRetained:true,restored:true});
  checks.push('Local module wiring leaves downstream stored signatures and DOM untouched, including Undo');
  await page.screenshot({path:path.join(folder,'canvas-update.png')});assert.deepEqual(errors,[]);
  await h.finish();console.log(JSON.stringify({passed:true,count:checks.length}));
 }catch(e){await h.finish(e);throw e;}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
