const assert=require('node:assert/strict'),path=require('node:path');
const {harness}=require('./test_glsl_code.cjs');
(async()=>{const[source,state,folder]=process.argv.slice(2),h=await harness(source,state,folder,{skipPreview:true}),{page,checks,errors}=h;
try{
await page.selectOption('#language','en');
await page.evaluate(()=>{nativeSourcePolling=uniformPolling=customPolling=true;uniformLive.disconnect();uniformLive.connect=()=>{};clearTimeout(autoTimer);scheduleGraphApply=()=>{};readonly=dirty=connectionInterrupted=false;graph.functions=[];graphTrail=[];stage='pixel';graph.stages.pixel={nodes:[testNode('output','pixel_out',450,0)],edges:[]};graph.declarations=[];selected=null;selection.clear();render();newFunction();});
assert.equal(await page.evaluate(()=>graph.functions.at(-1).name),'Subgraph 1');
await page.evaluate(()=>{const fn=graph.functions.at(-1);window.namingNode=current().nodes.find(n=>n.params.functionId===fn.id);enterFunction(namingNode);});
assert.ok((await page.locator('#cards').innerText()).includes('Subgraph Input'));
assert.ok(!(await page.locator('#cards').innerText()).includes('Function Input'));
await page.evaluate(()=>{navigateGraph(0);const d=functionEntry(graph.functions.at(-1));renderBrowserDetail({d,meta:browserMeta(d)});});
assert.equal(await page.locator('.subgraph-interface').count(),1);assert.equal(await page.evaluate(()=>t('code.function')),'Function name');
assert.ok((await page.locator('#browserdetail').innerText()).includes('Compilation expands'));
assert.ok(!(await page.locator('.subgraph-interface').innerText()).includes('Subgraph 1('));
checks.push('New Subgraph defaults, boundaries and library interface describe expansion without GLSL call syntax');
await page.evaluate(()=>{graph.declarations=[{id:'gain',kind:'uniform',name:'uGain',type:'float',value:.5}];graph.stages.pixel.nodes.push(testNode('gain_node','uniform',0,0,{declarationId:'gain'}));nativeSourceSnapshot={enabled:true,revision,uniforms:[{...graph.declarations[0],sequence:'vec',components:[{value:.5,mode:'BIND',binding:"parent().par.Gain",expression:'',writable:false,modeWritable:false}],nameWritable:true,expected:{id:'gain'}}],specConstants:[],issues:[]};dirty=connectionInterrupted=false;nativeSourceError='';selectedInputId='gain';selected=null;selection.clear();inspector();workspaceLayout.reveal('parameters');document.querySelector('.input-drivers').open=true;document.querySelector('.source-locations').open=true;});
assert.equal(await page.locator('[data-source-expression]').inputValue(),'parent().par.Gain');
assert.equal(await page.locator('[data-source-driver]').innerText(),'Bind Expression');
assert.equal(await page.locator('[data-source-expression]').isDisabled(),true);
assert.equal(await page.locator('[data-source-freeze]').isDisabled(),true);
await page.evaluate(()=>{const c=nativeSourceSnapshot.uniforms[0].components[0];c.mode='EXPRESSION';c.expression='absTime.seconds';c.modeWritable=true;renderNativeSourceValues();});
assert.equal(await page.locator('[data-source-expression]').inputValue(),'absTime.seconds');
assert.equal(await page.locator('[data-source-driver]').innerText(),'Python expression');
assert.equal(await page.locator('[data-source-expression]').isDisabled(),false);
checks.push('Bind expression is visible and protected; live switch to Python Expression restores the existing editing capability');
for(const theme of ['dark','light']){
await page.evaluate(theme=>document.querySelector('[data-ui-theme-choice="'+theme+'"]').click(),theme);
await page.evaluate(()=>{document.querySelector('.source-inspector-content').style.maxWidth='280px';});
const layout=await page.locator('.source-inspector-content').evaluate(box=>{const r=e=>e.getBoundingClientRect(),button=box.querySelector('[data-input-reference]'),section=box.querySelector('.source-reference-section'),locations=box.querySelector('.source-locations'),remove=box.querySelector('[data-source-remove]'),expr=box.querySelector('[data-source-expression]'),badge=box.querySelector('[data-source-driver]');return{overflow:box.scrollWidth>box.clientWidth,referenceInSection:section.contains(button),locationsInSection:section.contains(locations),separation:r(remove).top-r(section).bottom,badgeAbove:r(badge).bottom<=r(expr).top};});
assert.equal(layout.overflow,false);assert.ok(layout.referenceInSection&&layout.locationsInSection&&layout.badgeAbove);assert.ok(layout.separation>=10);
await page.locator('.source-inspector-content').screenshot({path:path.join(folder,'source-'+theme+'.png')});
await page.locator('.source-reference-section').screenshot({path:path.join(folder,'references-'+theme+'.png')});
}
checks.push('Narrow source settings align expression labels and group reference actions, with removal separated in both themes');
assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,checks}));
}catch(e){await h.finish(e);throw e;}})().catch(e=>{console.error(e);process.exitCode=1;});
