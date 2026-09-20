/* Note-only geometry and optional group selection handles, using an isolated fixture. */
const assert=require('node:assert/strict'),path=require('node:path');
const {harness}=require('./test_glsl_code.cjs');
(async()=>{
 const[source,state,folder]=process.argv.slice(2),h=await harness(source,state,folder,{touch:true,skipPreview:true}),{page,checks,errors,settle}=h;
 try{
  await page.evaluate(()=>{
   clearTimeout(autoTimer);connectionInterrupted=conflicted=true;readonly=false;historyBusy=false;nativeMutationBusy=false;stage='pixel';graphTrail=[];graph.declarations=[];graph.functions=[];
   const note=testNode('note','comment',80,160),a=testNode('a','scalar',440,260),outside=testNode('outside','scalar',780,420);
   Object.assign(note.ui,{width:300,height:200,noteTitleOnSelection:true,noteColor:'#72a6a5',comment:'Group note\n\nNo reserved title row.'});
   graph.stages.pixel={nodes:[note,a,outside],edges:[]};GraphFrames.write(current(),[{id:'test_group',name:'Group',nodes:['note','a']}]);
   selection.clear();selected=selectedInputId=null;past=[];future=[];dirty=false;rememberSavedGraph(graph);setGraphFocus(true);setUIExperiments({groupCornerSelect:true,selectionToolbar:'all'});render();scale=.9;pan={x:50,y:40};transform();
   window.noteGraph=JSON.stringify(graph);window.measureNote=()=>{const rect=e=>({x:e.offsetLeft,y:e.offsetTop,w:e.offsetWidth,h:e.offsetHeight});return{note:rect($('#cards [data-node="note"]')),group:rect($('#groupframes [data-frame="test_group"]'))};};
  });
  const initial=await page.evaluate(()=>measureNote()),corner=page.locator('[data-frame-select="test_group"]'),note=page.locator('#cards [data-node="note"]');
  assert.equal(await note.locator('.node-title').isVisible(),false);await note.hover();assert.equal(await note.locator('.node-title').isVisible(),false);
  await corner.click();await settle();assert.deepEqual(await page.evaluate(()=>[...selection]),['note','a']);assert.deepEqual(await page.evaluate(()=>measureNote()),initial);
  assert.equal(await note.locator('.node-title').isVisible(),true);
  const overlap=await page.evaluate(()=>{const title=$('#cards [data-node="note"] .node-title').getBoundingClientRect(),bar=$('#selectiontoolbar').getBoundingClientRect();return !(bar.bottom<=title.top||bar.top>=title.bottom||bar.right<=title.left||bar.left>=title.right);});assert.equal(overlap,false);
  await page.evaluate(()=>{selection=new Set(['outside']);selected='outside';render();});await corner.focus();await page.keyboard.press('Space');await settle();assert.deepEqual(await page.evaluate(()=>[...selection]),['note','a']);
  await page.evaluate(()=>{readonly=true;selection.clear();selected=null;render();});await corner.tap();await settle();assert.deepEqual(await page.evaluate(()=>[...selection]),['note','a']);assert.deepEqual(await page.evaluate(()=>measureNote()),initial);
  assert.equal(await page.evaluate(()=>JSON.stringify(graph)===noteGraph&&!past.length&&!dirty),true);
  checks.push('click, keyboard and readonly touch select all group members with stable Note/Group bounds, no toolbar overlap and no graph/history edit');
  await page.evaluate(()=>{readonly=false;window.savedNote=$('#cards [data-node="note"]');window.savedCorner=$('[data-frame-select="test_group"]');setUIExperiments({groupCornerSelect:false});});
  assert.equal(await corner.isVisible(),false);assert.equal(await page.evaluate(()=>savedNote===$('#cards [data-node="note"]')&&savedCorner===$('[data-frame-select="test_group"]')),true);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem(experimentsStorageKey)).groupCornerSelect),false);
  await page.evaluate(()=>setUIExperiments({groupCornerSelect:true}));assert.equal(await corner.isVisible(),true);
  const r=await corner.boundingBox();await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.down();await page.mouse.move(r.x+80,r.y+60,{steps:5});await page.mouse.up();await settle();assert.deepEqual(await page.evaluate(()=>measureNote()),initial);
  checks.push('experiment toggles and persists the corner without rebuilding nodes; dragging the selection handle does not resize or move the group');
  for(const theme of ['dark','light'])for(const color of ['#72a6a5','#ffffff','#000000','#ff0000','#ffff00'])for(const tone of [-100,0,100]){
   const ratio=await page.evaluate(({theme,color,tone})=>{
    current().nodes.find(n=>n.id==='note').ui.noteColor=color;render();setUIAppearance('theme',theme);setUIAppearance('tone',tone);
    const rgb=value=>{const m=value.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);return m?m.slice(1).map(Number):value.match(/[\d.]+/g).slice(0,3).map(v=>Number(v)/255);};
    const lum=values=>values.map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
    const a=lum(rgb(getComputedStyle($('#cards [data-node="note"]')).backgroundColor)),b=lum(rgb(getComputedStyle($('#cards [data-node="note"] .comment-node-preview')).color));return(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
   },{theme,color,tone});assert(ratio>=4.5,JSON.stringify({theme,color,tone,ratio}));
  }
  checks.push('stronger Note colors retain at least 4.5:1 reading contrast across pale/dark/saturated choices, both themes and brightness extremes');
  await page.evaluate(()=>{setUIAppearance('theme','dark');setUIAppearance('tone',0);current().nodes.find(n=>n.id==='note').ui.noteColor='#72a6a5';render();});
  await page.screenshot({path:path.join(folder,'note-selected-group.png')});
  await page.evaluate(()=>{selection.clear();selected=null;render();});await page.screenshot({path:path.join(folder,'note-idle-group.png')});
  const creation=await page.evaluate(()=>{const original=current().nodes.find(n=>n.id==='note');delete original.ui.noteTitleOnSelection;const added=instantiate(catalog.find(d=>d.key==='comment'),100,500);return{added:added.ui.noteTitleOnSelection,existing:original.ui.noteTitleOnSelection};});assert.deepEqual(creation,{added:true,existing:undefined});
  checks.push('only newly instantiated Notes default to selection-only titles; existing note metadata is not migrated');
  assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,checks}));
 }catch(e){await h.finish(e);throw e;}
})().catch(e=>{console.error(e);process.exitCode=1;});
