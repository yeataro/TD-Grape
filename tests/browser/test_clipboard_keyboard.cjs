/* Real keyboard clipboard events in an isolated browser/API fixture.
 * ClipboardEvent data is redirected to a test-only DataTransfer before app
 * handlers run; no Clipboard API permission or host clipboard read is needed.
 * node test_clipboard_keyboard.cjs SOURCE_DIR STATE_JSON REPORT_DIR
 */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const{harness}=require('./test_glsl_code.cjs');
const[source,stateFile,folder]=process.argv.slice(2);
(async()=>{
  const h=await harness(source,stateFile,folder),{page,checks,errors,settle,at,drag}=h;
  page.setDefaultTimeout(6000);
  const snapshot=()=>page.evaluate(()=>JSON.stringify({graph,past,future}));
  const copy=async()=>{
    await page.evaluate(()=>window.clipboardEvents=[]);
    await page.keyboard.press('Control+c');await settle();
    return page.evaluate(()=>({events:window.clipboardEvents,local:editorClipboard,
      focus:{tag:document.activeElement.tagName,id:document.activeElement.id,classes:document.activeElement.className},
      selected:[...selection],text:window.getSelection().toString()}));
  };
  try{
    await page.selectOption('#language','en');
    await page.evaluate(()=>{
      clearTimeout(autoTimer);connectionInterrupted=true;conflicted=true;readonly=false;historyBusy=false;nativeMutationBusy=false;
      graphTrail=[];stage='pixel';graph.functions=[];graph.declarations=[];
      const note=testNode('note','comment',24,24);note.ui.comment='Clipboard text stays text.';
      graph.stages.pixel={nodes:[note,testNode('scalar','float',420,50,{value:.25}),testNode('other','add',420,270),testNode('output','pixel_out',850,80)],edges:[]};
      selected=null;selection.clear();selectedEdge=null;past=[];future=[];dirty=false;editorClipboard=null;
      rememberSavedGraph(graph);render();scale=1;pan={x:25,y:35};transform();
      window.clipboardEvents=[];window.testClipboard='';window.clipboardApiCalls=0;
      Object.defineProperty(navigator,'clipboard',{configurable:true,value:{
        readText:async()=>{window.clipboardApiCalls++;throw Error('Clipboard API must not be used by keyboard events');},
        writeText:async()=>{window.clipboardApiCalls++;throw Error('Clipboard API must not be used by keyboard events');}
      }});
      for(const kind of ['copy','paste']){
        window.addEventListener(kind,event=>{
          const data=new DataTransfer();if(kind==='paste')data.setData('text/plain',window.testClipboard);
          Object.defineProperty(event,'clipboardData',{value:data});
        },true);
        window.addEventListener(kind,event=>{
          const record={kind,trusted:event.isTrusted,target:event.target.id||event.target.className,
            handled:event.defaultPrevented,text:event.clipboardData.getData('text/plain')};
          if(kind==='copy'&&record.handled)window.testClipboard=record.text;
          window.clipboardEvents.push(record);
          // Block the native clipboard default after observing the app result.
          event.preventDefault();
        });
      }
    });await settle();
    const preview=page.locator('[data-node="note"] .comment-node-preview');
    await preview.evaluate(element=>{
      element.focus();const range=document.createRange();range.selectNodeContents(element);
      const selected=window.getSelection();selected.removeAllRanges();selected.addRange(range);
    });
    const textCopy=await copy();assert.equal(textCopy.events.length,1);assert.equal(textCopy.events[0].trusted,true);
    assert.equal(textCopy.events[0].handled,false);assert.equal(textCopy.local,null);
    assert.ok(textCopy.text.includes('Clipboard text stays text.'));checks.push('real Ctrl+C on selected Note text remains native text copy');

    await page.locator('[data-node="scalar"] .node-title').click();await settle();
    const nodeCopy=await copy();
    fs.writeFileSync(path.join(folder,'click-copy-observation.json'),JSON.stringify(nodeCopy,null,2));
    assert.equal(nodeCopy.events.length,1);assert.equal(nodeCopy.events[0].trusted,true);
    assert.equal(nodeCopy.events[0].handled,true,'Clicking a node after Note text selection must transfer clipboard ownership to the graph');
    assert.equal(JSON.parse(nodeCopy.events[0].text).nodes[0].id,'scalar');
    checks.push('clicking a node after Note text selection makes real Ctrl+C copy the node');

    const beforePaste=await snapshot(),beforeCount=await page.evaluate(()=>current().nodes.length),beforeHistory=await page.evaluate(()=>past.length);
    await page.keyboard.press('Control+v');await settle();
    const pasted=await page.evaluate(()=>window.clipboardEvents.at(-1));
    assert.equal(pasted.kind,'paste');assert.equal(pasted.trusted,true);assert.equal(pasted.handled,true);
    assert.equal(await page.evaluate(()=>current().nodes.length),beforeCount+1);
    assert.equal(await page.evaluate(()=>past.length),beforeHistory+1);
    await page.keyboard.press('Control+z');await settle();assert.equal(await page.evaluate(()=>JSON.stringify(graph)),JSON.stringify(JSON.parse(beforePaste).graph));
    checks.push('real Ctrl+V pastes the captured graph payload once, and Ctrl+Z restores the graph');

    await page.locator('[data-node="scalar"] .node-title').click();await settle();
    await preview.evaluate(element=>{
      element.focus();const range=document.createRange();range.selectNodeContents(element);
      const selected=window.getSelection();selected.removeAllRanges();selected.addRange(range);
    });
    const title=await at('[data-node="scalar"] .node-title');await drag(title,{x:title.x+48,y:title.y+24});
    const dragCopy=await copy();
    fs.writeFileSync(path.join(folder,'drag-copy-observation.json'),JSON.stringify(dragCopy,null,2));
    assert.equal(dragCopy.events.length,1);assert.equal(dragCopy.events[0].handled,true,'Dragging an already selected node must return clipboard ownership to the graph');
    assert.equal(JSON.parse(dragCopy.events[0].text).nodes[0].id,'scalar');
    checks.push('dragging an already selected node after Note text selection restores graph Ctrl+C');

    await page.evaluate(()=>{
      GraphFrames.write(current(),[{id:'clipboard_frame',name:'Clipboard members',nodes:['scalar','other']}]);render();
    });await settle();
    await preview.evaluate(element=>{
      element.focus();const range=document.createRange();range.selectNodeContents(element);
      const selected=window.getSelection();selected.removeAllRanges();selected.addRange(range);
    });
    await page.locator('[data-frame="clipboard_frame"] .group-frame-name').click();await settle();
    const frameCopy=await copy();assert.equal(frameCopy.events[0].handled,true);
    assert.deepEqual(JSON.parse(frameCopy.events[0].text).nodes.map(node=>node.id).sort(),['other','scalar']);
    const beforeFramePaste=await page.evaluate(()=>JSON.stringify(graph));
    await page.keyboard.press('Control+v');await settle();
    assert.equal(await page.evaluate(()=>window.clipboardEvents.at(-1).handled),true);
    assert.equal(await page.evaluate(()=>current().nodes.length),JSON.parse(beforeFramePaste).stages.pixel.nodes.length+2);
    assert.equal(await page.evaluate(()=>GraphFrames.read(current()).length),2);
    await page.keyboard.press('Control+z');await settle();
    assert.equal(await page.evaluate(()=>JSON.stringify(graph)),beforeFramePaste);
    checks.push('clicking a group frame after Note text selection restores Ctrl+C/V for its members and frame, with one Undo');

    await page.locator('[data-node="scalar"] [data-inline-port="$value"]').focus();
    const beforeInput=await snapshot(),inputCopy=await copy();
    assert.equal(inputCopy.events[0].handled,false);
    await page.keyboard.press('Control+v');await settle();
    assert.equal(await page.evaluate(()=>window.clipboardEvents.at(-1).handled),false);
    assert.equal(await snapshot(),beforeInput);checks.push('Ctrl+C/V in an input stays native and leaves graph/history unchanged');

    await preview.evaluate(element=>{
      element.focus();const range=document.createRange();range.selectNodeContents(element);
      const selected=window.getSelection();selected.removeAllRanges();selected.addRange(range);
    });
    const beforeNote=await snapshot(),noteCopy=await copy();assert.equal(noteCopy.events[0].handled,false);
    await page.keyboard.press('Control+v');await settle();
    assert.equal(await page.evaluate(()=>window.clipboardEvents.at(-1).handled),false);
    assert.equal(await snapshot(),beforeNote);checks.push('Note text retains native copy/paste ownership after graph clipboard use');
    assert.equal(await page.evaluate(()=>window.clipboardApiCalls),0);
    checks.push('keyboard copy/paste never calls permission-gated navigator.clipboard');
    assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,count:checks.length}));
  }catch(error){await h.finish(error);throw error;}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
