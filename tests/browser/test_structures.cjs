const assert=require('node:assert/strict'),path=require('node:path');
const {harness}=require('./test_glsl_code.cjs');
(async()=>{
 const[source,state,folder]=process.argv.slice(2),h=await harness(source,state,folder,{skipPreview:true}),{page,checks,errors}=h;
 try{
  await page.evaluate(()=>{nativeSourcePolling=uniformPolling=customPolling=true;uniformLive.disconnect();uniformLive.connect=()=>{};graph.typeDefinitions=[];graph.stages.pixel={nodes:[testNode('unrelated','color',10,10),testNode('output','pixel_out',600,10)],edges:[]};graph.functions=[];graphTrail=[];stage='pixel';past=[];future=[];render();workspaceLayout.reveal('structures');window.unrelated=document.querySelector('[data-node="unrelated"]');});
  assert.equal(await page.locator('#pane-structures').evaluate(e=>e.closest('[data-workspace-side]').dataset.workspaceSide),'left');
  await page.locator('#newstructure').click();await page.locator('[data-structure-name]').fill('Particle');await page.locator('[data-structure-notes]').fill('Particle data');
  await page.locator('[data-structure-field] input[type=text]').fill('age');await page.locator('[data-structure-save]').click();
  assert.equal(await page.locator('#structuredialog').count(),0);
  const id=await page.evaluate(()=>graph.typeDefinitions[0].id),field=await page.evaluate(()=>graph.typeDefinitions[0].fields[0].id);
  assert.equal(await page.evaluate(()=>unrelated===document.querySelector('[data-node="unrelated"]')),true);
  await page.locator(`[data-structure-reference="${id}"]`).click();const node=await page.evaluate(()=>selected);
  assert.equal(await page.evaluate(({node,field})=>ports(current().nodes.find(n=>n.id===node),'outputs')['f_'+field],{node,field}),'float');
  await page.evaluate(({node,field})=>connectPorts({node,kind:'outputs',port:'f_'+field},{node:'output',kind:'inputs',port:'color'}),{node,field});
  checks.push('new popup creates a graph-owned definition in the left panel without rebuilding unrelated canvas DOM; constructor exposes complete/field outputs');
  await page.evaluate(id=>StructureUI.edit(id),id);await page.locator('[data-structure-notes]').fill('New notes');
  await page.evaluate(()=>window.unrelated=document.querySelector('[data-node="unrelated"]'));
  await page.locator('[data-structure-save]').click();assert.equal(await page.evaluate(()=>unrelated===document.querySelector('[data-node="unrelated"]')),true);
  await page.locator(`[data-structure="${id}"] .input-source-select`).click();assert.match(await page.locator('#nodehelp').innerText(),/New notes/);
  checks.push('notes update Help and only the changed structure card');
  await page.evaluate(id=>StructureUI.edit(id),id);await page.locator('[data-structure-field] input[type=text]').fill('life');await page.locator('[data-structure-save]').click();
  assert.equal(await page.evaluate(({node,field})=>current().edges.some(e=>e.from[0]===node&&e.from[1]==='f_'+field),{node,field}),true);
  assert.match(await page.locator(`[data-node="${node}"]`).innerText(),/life/);
  await page.evaluate(id=>StructureUI.edit(id),id);await page.locator('[data-structure-field] select').selectOption('bool');await page.locator('[data-structure-save]').click();
  assert.equal(await page.evaluate(({node,field})=>current().edges.some(e=>e.from[0]===node&&e.from[1]==='f_'+field),{node,field}),true);
  assert.equal(await page.evaluate(()=>unrelated===document.querySelector('[data-node="unrelated"]')),true);
  await page.evaluate(()=>undo());assert.equal(await page.evaluate(()=>graph.typeDefinitions[0].fields[0].type),'float');
  checks.push('field renaming retains stable wires; incompatible type edits preserve diagnosable wires, update affected cards and undo in one step');
  await page.evaluate(({id,field})=>{
    const nested={id:'container',name:'Container',description:'',fields:[{id:'item',name:'item',type:'struct:'+id}]};StructureUI.apply([...graph.typeDefinitions,nested],'container');
    const cycle=clone(graph.typeDefinitions);cycle[0].fields=[{id:field,name:'next',type:'struct:container'}];window.cycleBlocked=false;try{StructureUI.validate(cycle);}catch{cycleBlocked=true;}
  },{id,field});
  assert.equal(await page.evaluate(()=>cycleBlocked),true);
  assert.ok(await page.evaluate(id=>StructureUI.usages(id).length>=2,id));
  await page.evaluate(id=>StructureUI.edit(id),id);await page.locator('[data-structure-add-field]').click();
  await page.screenshot({path:path.join(folder,'structure-dialog.png')});await page.keyboard.press('Escape');
  checks.push('existing structures are reusable; cycles are rejected before mutation and usage inventory includes dependent structures');
  await page.evaluate(({id,field})=>{const next=clone(graph.typeDefinitions);next[0].fields=[{id:'remaining',name:'remaining',type:'vec2'}];StructureUI.apply(next,id);},{id,field});
  assert.equal(await page.evaluate(({node,field})=>current().edges.some(e=>e.from[0]===node&&e.from[1]==='f_'+field),{node,field}),true);
  await page.evaluate(()=>undo());assert.equal(await page.evaluate(()=>graph.typeDefinitions[0].fields[0].name),'life');
  await page.evaluate(()=>undo(true));assert.equal(await page.evaluate(()=>graph.typeDefinitions[0].fields[0].name),'remaining');
  await page.evaluate(()=>undo());
  await page.evaluate(id=>StructureUI.edit(id),id);await page.locator('[data-structure-add-field]').click();
  await page.locator('[data-structure-field]').last().locator('input[type=checkbox]').check();
  await page.locator('[data-structure-array-size]').last().fill('3');await page.locator('[data-structure-array-size]').last().blur();
  await page.locator('[data-structure-save]').click();assert.equal(await page.evaluate(()=>graph.typeDefinitions[0].fields[1].type),'float[3]');
  const portable=await page.evaluate(()=>clone(graph));await page.evaluate(g=>{graph=JSON.parse(JSON.stringify(g));render();},portable);
  assert.equal(await page.evaluate(()=>graph.typeDefinitions[0].description),'New notes');
  checks.push('removed fields retain wires for diagnosis; undo/redo restores definitions; fixed array fields and notes survive portable graph reload');

  assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,checks}));
 }catch(e){await h.finish(e);throw e;}
})().catch(e=>{console.error(e);process.exitCode=1;});
