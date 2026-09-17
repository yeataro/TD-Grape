/* Comment Markdown, safe code rendering and reader/editor interactions.
 * node test_comment_markdown.cjs SOURCE_DIR STATE_JSON REPORT_DIR */
const assert=require('node:assert/strict'),path=require('node:path');
const {harness}=require('./test_glsl_code.cjs');
async function run(){
  const[source,stateFile,folder]=process.argv.slice(2),h=await harness(source,stateFile,folder,{touch:true}),{page,checks,errors,settle}=h;
  page.setDefaultTimeout(6000);
  const card=()=>page.locator('[data-node="note"]'),preview=()=>card().locator('.comment-node-preview'),entry=()=>card().locator('[data-comment-node]');
  const parameterPreview=()=>page.locator('#inspector .comment-node-preview'),parameterEntry=()=>page.locator('#inspector [data-comment-node]');
  const text=()=>page.evaluate(()=>nodeComment(current().nodes.find(n=>n.id==='note')));
  const graphJSON=()=>page.evaluate(()=>JSON.stringify(graph));
  const reset=async comment=>{await page.evaluate(comment=>{
    document.activeElement?.blur();clearTimeout(autoTimer);connectionInterrupted=true;conflicted=true;readonly=false;historyBusy=false;nativeMutationBusy=false;graphTrail=[];graph.functions=[];graph.declarations=[];stage='pixel';selectedInputId=null;inspectorTab='parameters';
    const note=testNode('note','comment',70,140),value=testNode('value','float',580,160);Object.assign(note.ui,{width:420,height:360,comment});current().nodes=[note,value];current().edges=[];selected='note';selectedEdge=null;selection=new Set(['note']);past=[];future=[];dirty=false;rememberSavedGraph(graph);render();scale=1;pan={x:20,y:20};transform();
  },comment);await settle();};
  try{
    const code='// source <tag> stays literal\nvec3 tint = vec3(0.2, 0.4, 1.0);\nif (tint.x < 0.5) { tint *= 2.0; }';
    const markdown='# Lighting note\n\nUse **Tint** and `uv.x`.\n\n- First input\n- Second input\n\n1. Adjust\n2. Apply\n\n[Reference](https://example.test/reference)\n[HTTP](http://example.test/plain)\n[Mail](mailto:artist@example.test)\n\n```glsl\n'+code+'\n```\n\n```unknown\nconst raw = "<b>literal</b>";\n```';
    await reset(markdown);
    for(const reader of [preview(),parameterPreview()]){
      assert.equal(await reader.locator('h1').innerText(),'Lighting note');assert.equal(await reader.locator('strong').innerText(),'Tint');assert.equal(await reader.locator('ul li').count(),2);assert.equal(await reader.locator('ol li').count(),2);
      assert.equal(await reader.locator('p code').first().innerText(),'uv.x');assert.equal(await reader.locator('pre').first().textContent(),code);
      assert.ok(await reader.locator('pre .glsl-type').count()>0);assert.ok(await reader.locator('pre .glsl-number').count()>0);assert.ok(await reader.locator('pre .glsl-keyword').count()>0);
      assert.equal(await reader.locator('pre').last().locator('span').count(),0,'unknown fences stay plain text');assert.equal(await reader.locator('pre').last().textContent(),'const raw = "<b>literal</b>";');
      assert.deepEqual(await reader.locator('a').evaluateAll(as=>as.map(a=>a.getAttribute('href'))),['https://example.test/reference','http://example.test/plain','mailto:artist@example.test']);
    }
    assert.equal(await entry().isVisible(),false);assert.equal(await parameterEntry().isVisible(),false);assert.equal(await preview().evaluate(e=>getComputedStyle(e).backgroundColor),'rgba(0, 0, 0, 0)');assert.equal(await page.evaluate(()=>past.length),0);
    checks.push('canvas and Parameter share Markdown headings, emphasis, lists, inline code, safe links and exact fenced GLSL tokens; unknown fences stay literal and idle reading uses the node body');

    const hostile='<img src=x onerror="window.__commentXss=1">\n<script>window.__commentXss=2</script>\n\n[JS](javascript:alert(1)) [DATA](data:text/html,boom) [VB](vbscript:msgbox) [relative](/unsafe)\n\n```glsl\n</code><img src=x onerror="window.__commentXss=3">\n```';
    await reset(hostile);assert.equal(await card().locator('img,script,iframe,object').count(),0);assert.equal(await preview().locator('a').count(),0);assert.equal(await parameterPreview().locator('a').count(),0);assert.ok((await preview().innerText()).includes('<img'));assert.equal(await page.evaluate(()=>window.__commentXss),undefined);
    checks.push('raw HTML and HTML-like fenced source remain inert text; javascript/data/vbscript and relative URLs never become active links');

    await reset(markdown);await page.context().route('https://example.test/**',route=>route.fulfill({status:200,contentType:'text/html',body:'<title>Fixture reference</title>'}));
    const link=preview().locator('a[href="https://example.test/reference"]');assert.equal(await link.getAttribute('target'),'_blank');assert.ok((await link.getAttribute('rel')||'').includes('noopener'));
    const beforeLink=await graphJSON(),popupPromise=page.waitForEvent('popup');await link.click();const popup=await popupPromise;await popup.waitForLoadState();assert.equal(await popup.title(),'Fixture reference');await popup.close();assert.equal(await graphJSON(),beforeLink);assert.equal(await entry().isVisible(),false);assert.equal(await page.evaluate(()=>past.length),0);
    await preview().focus();await page.keyboard.press('Tab');assert.equal(await link.evaluate(e=>e===document.activeElement),true,'Tab from the reader focuses its first link');assert.equal(await page.locator('#creator').isVisible(),false);
    const keyboardPopupPromise=page.waitForEvent('popup');await page.keyboard.press('Enter');const keyboardPopup=await keyboardPopupPromise;await keyboardPopup.waitForLoadState();assert.equal(await keyboardPopup.title(),'Fixture reference');await keyboardPopup.close();assert.equal(await entry().isVisible(),false);assert.equal(await page.locator('#creator').isVisible(),false);assert.equal(await graphJSON(),beforeLink);
    const paste=await preview().evaluate(reader=>{const before=JSON.stringify({graph,past,future,dirty}),data=new DataTransfer();data.setData('text/plain',GraphClipboard.encode(graph,current(),['note'],shaderId));const event=new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true});reader.focus();reader.dispatchEvent(event);return{before,after:JSON.stringify({graph,past,future,dirty}),prevented:event.defaultPrevented};});assert.equal(paste.after,paste.before,'pasting a graph payload into the reader must not create nodes or dirty the graph');assert.equal(paste.prevented,false);
    checks.push('safe links work by mouse or Tab/Enter without editing or opening Creator; a graph clipboard payload pasted into the reader never creates nodes or dirty/history changes');

    await reset('Initial **note**');await page.evaluate(()=>{selection.clear();selected=null;render();});await preview().click();assert.equal(await page.evaluate(()=>selected),'note');assert.equal(await entry().isVisible(),false,'single click only selects');
    await preview().focus();await preview().press('Enter');assert.equal(await entry().isVisible(),true);assert.equal(await entry().evaluate(e=>e===document.activeElement),true);
    await entry().fill('# Canvas update\n\n**Saved once**');assert.equal(await text(),'Initial **note**');await entry().press('Control+Enter');await settle();assert.equal(await entry().isVisible(),false);assert.equal(await preview().locator('h1').innerText(),'Canvas update');assert.equal(await parameterPreview().locator('h1').innerText(),'Canvas update');assert.equal(await page.evaluate(()=>past.length),1);assert.equal(await page.evaluate(()=>hasShaderChanges()),false);
    const saved=await graphJSON();await page.locator('#undo').click();await settle();assert.equal(await text(),'Initial **note**');await page.locator('#redo').click();await settle();assert.equal(await graphJSON(),saved);
    await parameterPreview().dblclick();await parameterEntry().fill('## Parameter update');await page.locator('#fit').click();await settle();assert.equal(await parameterEntry().isVisible(),false);assert.equal(await preview().locator('h2').innerText(),'Parameter update');assert.equal(await text(),'## Parameter update');assert.equal(await page.evaluate(()=>past.length),2);assert.equal(await page.evaluate(()=>hasShaderChanges()),false);
    checks.push('single click selects and Enter edits; Ctrl+Enter and Parameter blur each commit one synced Markdown edit, return to reading, Undo/Redo exactly, and never dirty the shader');

    await preview().dblclick();await entry().fill('Uncommitted **draft**');await page.evaluate(()=>render());assert.equal(await entry().inputValue(),'Uncommitted **draft**');assert.equal(await entry().evaluate(e=>e===document.activeElement),true);assert.equal(await parameterPreview().locator('h2').innerText(),'Parameter update');
    await entry().press('Escape');await settle();assert.equal(await entry().isVisible(),false);assert.equal(await text(),'## Parameter update');assert.equal(await page.evaluate(()=>past.length),2);
    await parameterPreview().dblclick();await parameterEntry().fill('Another draft');await page.evaluate(()=>inspector());assert.equal(await parameterEntry().inputValue(),'Another draft');await parameterEntry().press('Escape');assert.equal(await text(),'## Parameter update');assert.equal(await page.evaluate(()=>past.length),2);
    await preview().dblclick();await entry().fill('Temporary change');await entry().fill('## Parameter update');await page.locator('#fit').click();await page.evaluate(()=>render());await settle();assert.equal(await entry().isVisible(),false);assert.equal(await preview().isVisible(),true);assert.equal(await text(),'## Parameter update');assert.equal(await page.evaluate(()=>past.length),2,'a reverted draft creates no history and never reopens after redraw');
    checks.push('canvas and Parameter redraws preserve the active draft and focus; Escape and a draft reverted to its original text restore reading without leaking drafts, reopening after redraw, or adding history');

    const long=Array.from({length:45},(_,i)=>'- Scroll item '+(i+1)).join('\n');await reset(long);
    const zoom=await page.evaluate(()=>scale);await preview().hover();await page.mouse.wheel(0,180);await page.waitForFunction(()=>document.querySelector('[data-node="note"] .comment-node-preview').scrollTop>0);assert.equal(await page.evaluate(()=>scale),zoom);
    await preview().dblclick();await entry().evaluate(e=>{e.scrollTop=0;});await entry().hover();await page.mouse.wheel(0,180);await page.waitForFunction(()=>document.querySelector('[data-node="note"] [data-comment-node]').scrollTop>0);assert.equal(await page.evaluate(()=>scale),zoom);await entry().press('Escape');assert.equal(await page.evaluate(()=>past.length),0);
    checks.push('reader and text editor scroll their own long content without zooming the graph or adding history');

    await reset('Touch **note**');const r=await preview().boundingBox(),point={x:r.x+r.width/2,y:r.y+20};await page.touchscreen.tap(point.x,point.y);assert.equal(await entry().isVisible(),false);await page.touchscreen.tap(point.x,point.y);await settle();assert.equal(await entry().isVisible(),true,'double-tap enters editing');await entry().press('Escape');
    await page.evaluate(()=>{readonly=true;render();});await preview().dblclick();assert.equal(await entry().isVisible(),false);await parameterPreview().focus();await parameterPreview().press('Enter');assert.equal(await parameterEntry().isVisible(),false);assert.equal(await text(),'Touch **note**');assert.equal(await page.evaluate(()=>past.length),0);
    checks.push('touch single tap reads/selects, double tap edits, and readonly keeps both surfaces in readable mode');

    const semantic=await page.evaluate(()=>{
      readonly=false;const base=clone(graph),fnNote=testNode('fn-note','comment',0,0);fnNote.ui.comment='Function note';base.functions.push({id:'notes',name:'Notes',inputs:[],outputs:[],graph:{nodes:[fnNote],edges:[]}});rememberSavedGraph(base);
      const changed=[];for(const location of ['stage','function'])for(const kind of ['edit','add','delete','size']){const candidate=clone(base),level=location==='stage'?candidate.stages.pixel:candidate.functions.at(-1).graph,n=level.nodes.find(n=>n.definitionUuid==='sgrape.builtin.comment');if(kind==='edit')n.ui.comment='## New comment';if(kind==='size'){n.ui.width=710;n.ui.height=600;}if(kind==='add')level.nodes.push(testNode('extra-'+location,'comment',800,400));if(kind==='delete')level.nodes=level.nodes.filter(x=>x!==n);changed.push({location,kind,dirty:hasShaderChanges(candidate)});}
      const ordinary=clone(base);ordinary.stages.pixel.nodes.find(n=>n.id==='value').ui.comment='Generated GLSL note';const ordinaryDirty=hasShaderChanges(ordinary);rememberSavedGraph(graph);return{changed,ordinaryDirty};
    });
    assert.ok(semantic.changed.every(c=>!c.dirty),JSON.stringify(semantic.changed));assert.equal(semantic.ordinaryDirty,true,'ordinary node inline-code comments remain semantic');
    checks.push('main and nested Comment edits/additions/deletions/resizes remain graph-only saves, while ordinary node comments retain shader-dirty semantics');

    await reset(markdown);await page.evaluate(()=>getSelection()?.removeAllRanges());await page.screenshot({path:path.join(folder,'comment-markdown.png')});
    await page.evaluate(()=>setUIAppearance('theme','light'));await settle();await page.screenshot({path:path.join(folder,'comment-markdown-light.png')});
    const colors=await preview().locator('pre').first().evaluate(e=>{
      const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d'),pixel=()=>Array.from(ctx.getImageData(0,0,1,1).data).slice(0,3),fill=color=>{ctx.fillStyle=color;ctx.fillRect(0,0,1,1);},rgb=color=>{ctx.clearRect(0,0,1,1);fill(color);return pixel();};
      const chain=[];for(let at=e;at;at=at.parentElement)chain.unshift(at);fill('#fff');for(const at of chain)fill(getComputedStyle(at).backgroundColor);const background=pixel(),luminance=value=>value.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((total,v,i)=>total+v*[.2126,.7152,.0722][i],0),contrast=color=>{const a=luminance(rgb(color)),b=luminance(background);return(Math.max(a,b)+.05)/(Math.min(a,b)+.05);};
      return{background,plain:getComputedStyle(e).color,plainContrast:contrast(getComputedStyle(e).color),tokens:[...e.querySelectorAll('[class^="glsl-"]')].map(span=>({kind:span.className,color:getComputedStyle(span).color,contrast:contrast(getComputedStyle(span).color),text:span.textContent}))};
    });
    assert.ok(colors.plainContrast>=4.5,'light-mode source text must contrast with its code background');assert.ok(colors.tokens.every(token=>token.contrast>=4.5),'light-mode GLSL token colors remain readable');assert.ok(new Set(colors.tokens.map(token=>token.color)).size>=3,'light-mode GLSL retains visibly distinct token categories');require('node:fs').writeFileSync(path.join(folder,'light-token-colors.json'),JSON.stringify(colors,null,2));
    assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,count:checks.length}));
  }catch(error){await h.finish(error);throw error;}
}
run().catch(error=>{console.error(error);process.exit(1);});
