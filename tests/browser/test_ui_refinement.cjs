// Isolated fixture: node test_creator_palette.cjs SOURCE_DIR STATE_JSON REPORT_DIR [OVERLAY_DIR]
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');const{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const[source,snapshotFile,folder,overlay]=process.argv.slice(2),original=JSON.parse(fs.readFileSync(snapshotFile,'utf8'));let state=structuredClone(original);fs.mkdirSync(folder,{recursive:true});
const server=http.createServer(async(req,res)=>{const name=new URL(req.url,'http://localhost').pathname;res.setHeader('Cache-Control','no-store');if(name.startsWith('/api/')){res.setHeader('Content-Type','application/json');let raw='';for await(const c of req)raw+=c;const body=raw?JSON.parse(raw):null,operation=name.split('/').at(-1);if(operation==='shaders')return res.end(JSON.stringify({projectFile:'Review Project.toe'}));if(operation==='state')return res.end(JSON.stringify(state));if(operation==='apply'){state.state.graph=body.graph;state.state.revision++;return res.end(JSON.stringify(state));}if(operation==='uniforms')return res.end(JSON.stringify({revision:state.state.revision,uniforms:{},textures:{}}));if(operation==='preview'){res.statusCode=204;return res.end();}res.statusCode=404;return res.end('{}');}const filename=name==='/'?'index.html':path.basename(name),candidate=overlay&&path.join(overlay,filename),file=candidate&&fs.existsSync(candidate)?candidate:path.join(source,filename);if(!fs.existsSync(file)){res.statusCode=404;return res.end();}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));});

(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE}),checks=[],errors=[];
try{
 const page=await browser.newPage({viewport:{width:1600,height:1040}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:'+server.address().port+'/#fixture');await page.waitForSelector('.node');await page.selectOption('#language','en');
 const unchanged=()=>page.evaluate(()=>JSON.stringify({graph,revision,dirty,past,future,pan,scale}));const initial=await unchanged();
 const order=()=>page.evaluate(()=>workspaceLayout.snapshot().right[0].panels);
 const drag=async(from,to,edge='left',up=true)=>{const a=await page.locator(from).boundingBox(),b=await page.locator(to).boundingBox();await page.mouse.move(a.x+a.width/2,a.y+a.height/2);await page.mouse.down();await page.mouse.move(edge==='left'?b.x+4:b.x+b.width-4,b.y+b.height/2,{steps:14});if(up)await page.mouse.up();};
 await drag('#controlstoggle','#parametertoggle','left',false);
 assert.equal(await page.locator('.workspace-drop-mark').getAttribute('data-mode'),'insert');await page.screenshot({path:path.join(folder,'tab-insert.png')});await page.mouse.up();
 assert.deepEqual(await order(),['controls','parameters','uniforms']);
 await drag('#helptoggle','#parametertoggle','left');assert.deepEqual(await order(),['controls','help','parameters','uniforms']);
 await drag('#controlstoggle','#uniformstoggle','right');assert.deepEqual(await order(),['help','parameters','uniforms','controls']);
 const saved=await page.evaluate(()=>workspaceLayout.snapshot());assert.equal(await unchanged(),initial);
 await page.reload();await page.waitForSelector('.node');assert.deepEqual(await page.evaluate(()=>workspaceLayout.snapshot()),saved);checks.push('Same-group reorder and cross-group insertion use pointer position and survive reload without changing the graph');
 await page.locator('#workspacelayout').click();await page.getByRole('menuitemcheckbox',{name:'Uniforms',exact:true}).click();
 assert.equal(await page.locator('#uniformstoggle').isVisible(),false);assert.equal(await page.getByRole('menuitemcheckbox',{name:'Uniforms',exact:true}).getAttribute('aria-checked'),'false');
 await page.keyboard.press('Escape');await page.reload();await page.waitForSelector('.node');assert.equal(await page.locator('#uniformstoggle').isVisible(),false);
 await page.evaluate(()=>workspaceLayout.reveal('uniforms'));assert.ok(await page.locator('#uniformstoggle').isVisible());
 await page.locator('#workspacelayout').click();await page.getByRole('menuitem',{name:'Save layout',exact:true}).click();await page.locator('#layoutname').fill('Review');await page.getByRole('button',{name:'Save layout',exact:true}).click();
 await page.locator('.layout-preset').filter({hasText:'Review'}).getByRole('button',{name:'Rename',exact:true}).click();await page.locator('.layout-preset input').fill('Edited');await page.locator('.layout-preset').getByRole('button',{name:'Save layout',exact:true}).click();
 await page.locator('#layoutdialog').getByRole('button',{name:'Close',exact:true}).click();await page.locator('#workspacelayout').click();assert.ok(await page.getByRole('menuitem',{name:'Edited',exact:true}).isVisible());
 await page.getByRole('menuitem',{name:'Default layout',exact:true}).click();checks.push('Panel hide/reveal, persistence, named layout rename and menu presets work');
 await page.evaluate(()=>{const n=current().nodes.find(n=>definition(n)?.key==='multiply');selectNode(n);render();});
 const metrics=await page.evaluate(()=>{const panel=$('#pane-parameters').getBoundingClientRect(),heading=$('.node-inspector-title').getBoundingClientRect(),tabs=$('#parametertoggle').getBoundingClientRect();return {gap:heading.left-panel.left,height:heading.height,tab:tabs.height,underline:getComputedStyle($('#parametertoggle'),'::after').content};});
 assert.equal(metrics.gap,0);assert.equal(metrics.height,metrics.tab);assert.equal(metrics.underline,'none');
 assert.equal(await page.locator('#inspector .parameter-hint').count(),0);assert.equal(await page.locator('.input-parameter input:disabled').count(),0);
 await page.screenshot({path:path.join(folder,'compact-parameter.png')});
 await page.evaluate(()=>{const nodes=current().nodes.filter(n=>['multiply','texture'].includes(definition(n)?.key));for(const n of nodes)n.ui.comment='Plain note <script>inert</script>\nSecond line';render();});
 assert.equal(await page.locator('.node-canvas-comment summary').count(),0);assert.equal(await page.locator('.node-canvas-comment script').count(),0);
 const colors=await page.locator('.node-canvas-comment').evaluateAll(nodes=>nodes.map(n=>getComputedStyle(n).color));assert.equal(new Set(colors).size,1);checks.push('Compact identity reaches pane edges; redundant labels are gone; canvas comments are inert plain text with one shared color');
 await page.evaluate(()=>{selected=null;selection.clear();selectedEdge=0;render();});const edges=await page.evaluate(()=>current().edges.length);
 await page.locator('[data-action=disconnect-wire]').click();assert.equal(await page.evaluate(()=>current().edges.length),edges-1);await page.locator('#undo').click();assert.equal(await page.evaluate(()=>current().edges.length),edges);checks.push('Selected-wire disconnect is visible and supports Undo');
 await page.evaluate(()=>{const f=FunctionModel.importLibrary(graph,functionLibrary[0]);current().nodes.push({id:'source_test',definitionUuid:FunctionModel.CALL,params:{functionId:f.id},ui:{x:100,y:100}});selectNode(current().nodes.at(-1));render();fit();});
 assert.equal(await page.locator('[data-node=source_test] .subgraph-icon').evaluate(e=>getComputedStyle(e).opacity),'0.5');
 const beforeSource=await page.evaluate(()=>JSON.stringify(FunctionModel.find(graph,current().nodes.find(n=>n.id==='source_test').params.functionId)));
 await page.evaluate(()=>openGraphMenu(500,200,'source_test'));await page.locator('[data-edit=independent]').click();assert.equal(await page.locator('[data-node=source_test] .subgraph-icon').evaluate(e=>getComputedStyle(e).opacity),'1');
 assert.equal(await page.evaluate(()=>JSON.stringify(graph.functions.find(f=>f.scope!=='local'))),beforeSource);checks.push('Source Subgraph icon is dimmed; local copy becomes editable while the source stays unchanged');
 for(const width of [1100,800,560,420]){
  await page.setViewportSize({width,height:900});await page.selectOption('#language','zh-Hant');
  const layout=await page.evaluate(()=>{const b=$('header .brand').getBoundingClientRect(),a=$('#apply').getBoundingClientRect(),s=$('header .secondary-actions').getBoundingClientRect();return {sameRow:Math.abs(b.top+b.height/2-a.top-a.height/2)<2,second:s.top>=a.bottom,overflow:document.documentElement.scrollWidth>innerWidth,about:getComputedStyle($('#about')).display};});
  assert.ok(layout.sameRow&&layout.second&&!layout.overflow,JSON.stringify({width,...layout}));assert.equal(layout.about,'none');
  if(width===420)await page.screenshot({path:path.join(folder,'compact-header.png')});
 }
 checks.push('Chinese narrow headers keep brand and Apply together, secondary actions below, without page overflow');
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(folder,'results.json'),JSON.stringify({passed:true,checks},null,2));console.log(JSON.stringify({passed:true,count:checks.length}));
}catch(e){fs.writeFileSync(path.join(folder,'results.json'),JSON.stringify({passed:false,checks,errors,error:e.stack},null,2));console.error(e.stack);process.exitCode=1;}
finally{await browser.close();await new Promise(r=>server.close(r));}})();
