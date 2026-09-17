/* Canvas name editing must not move sockets or expand the node title. */
const assert=require('node:assert/strict'),path=require('node:path');
const {harness}=require('./test_glsl_code.cjs');
const [source,stateFile,folder]=process.argv.slice(2);
(async()=>{
  const h=await harness(source,stateFile,folder),{page,checks,errors,settle}=h;
  page.setDefaultTimeout(6000);
  const card=id=>page.locator(`[data-node="${id}"]`);
  const name=id=>card(id).locator('.node-function-title');
  const entry=id=>card(id).locator('[data-node-name]');
  const history=()=>page.evaluate(()=>past.length);
  const nodeName=id=>page.evaluate(id=>current().nodes.find(n=>n.id===id).name,id);
  const geometry=id=>card(id).evaluate(node=>{
    const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x/scale,y:r.y/scale,width:r.width/scale,height:r.height/scale};};
    const text=node.querySelector('[data-node-name]')||node.querySelector('.node-function-title'),style=getComputedStyle(text);
    return{card:rect(node),title:rect(node.querySelector('.node-title')),text:rect(text),font:[style.fontFamily,style.fontSize,style.fontWeight,style.lineHeight],
      ports:[...node.querySelectorAll('.port')].map(port=>({kind:port.dataset.kind,port:port.dataset.port,...rect(port)}))};
  });
  const stable=(before,after,{afterCommit=false}={})=>{
    const near=(a,b,label)=>assert.ok(Math.abs(a-b)<.03,`${label}: ${a} -> ${b}`);
    near(before.title.height,41,'original title height');
    near(before.title.height,after.title.height,'title height');
    near(before.card.height,after.card.height,'node height');
    assert.equal(before.ports.length,after.ports.length);
    before.ports.forEach((port,i)=>{near(port.y,after.ports[i].y,`${port.kind}:${port.port} y`);if(!afterCommit)near(port.x,after.ports[i].x,`${port.kind}:${port.port} x`);});
    near(before.text.y,after.text.y,'name y');near(before.text.height,after.text.height,'name line height');
    assert.deepEqual(after.font,before.font,'name typography');
  };
  const reset=async(zoom=1,width=null)=>{
    await page.evaluate(({zoom,width})=>{
      document.activeElement?.blur();clearTimeout(autoTimer);connectionInterrupted=true;readonly=false;historyBusy=false;nativeMutationBusy=false;
      graphTrail=[];graph.functions=[];graph.declarations=[];stage='pixel';selected='split';selection=new Set(['split']);past=[];future=[];
      const split=testNode('split','split',35,45),vector=testNode('vector','vector',370,45,{type:'vec3',components:[0,0,0,0]});
      split.name='Split_RGBA';vector.name='Offset';if(width){split.ui.width=width;vector.ui.width=width;}
      graph.stages.pixel={nodes:[split,vector],edges:[]};showCustomNodeNames=true;dirty=false;rememberSavedGraph(graph);
      render();scale=zoom;pan={x:25,y:35};transform();
    },{zoom,width});await settle();
  };
  try{
    for(const zoom of [.5,1,1.5])for(const width of [null,300]){
      await reset(zoom,width);
      for(const id of ['split','vector']){
        const before=await geometry(id),count=await history(),original=await nodeName(id);
        await name(id).dblclick();stable(before,await geometry(id));
        await entry(id).fill('Longer_Name_While_Typing');stable(before,await geometry(id));
        await entry(id).press('Escape');stable(before,await geometry(id));
        assert.equal(await nodeName(id),original);assert.equal(await history(),count);
      }
    }
    checks.push('Split RGBA and dropdown Vector retain 41px titles, font metrics and socket positions while entering, typing and cancelling, at three zoom levels and default/manual widths');

    await reset(1.5,300);let before=await geometry('split'),count=await history();
    await name('split').dblclick();await entry('split').fill('Renamed Split');stable(before,await geometry('split'));
    await entry('split').press('Enter');stable(before,await geometry('split'),{afterCommit:true});
    assert.equal(await nodeName('split'),'Renamed_Split');assert.equal(await history(),count+1);
    await page.locator('#undo').click();assert.equal(await nodeName('split'),'Split_RGBA');stable(before,await geometry('split'),{afterCommit:true});
    await page.locator('#redo').click();assert.equal(await nodeName('split'),'Renamed_Split');
    checks.push('Enter preserves title geometry and creates one undoable rename');

    before=await geometry('vector');count=await history();await name('vector').dblclick();await entry('vector').fill('Blur Vector');
    await entry('vector').press('Tab');stable(before,await geometry('vector'),{afterCommit:true});
    assert.equal(await nodeName('vector'),'Blur_Vector');assert.equal(await history(),count+1);
    checks.push('Blur commits once without moving the vector sockets');

    await reset(1.5,300);before=await geometry('split');count=await history();await name('split').dblclick();await entry('split').fill('Offset');await entry('split').press('Enter');
    assert.equal(await entry('split').getAttribute('aria-invalid'),'true');stable(before,await geometry('split'));
    assert.equal(await card('split').locator('.node-name-error').isVisible(),true);
    assert.equal(await card('split').locator('.node-name-error').evaluate(e=>getComputedStyle(e).position),'absolute');
    assert.equal(await nodeName('split'),'Split_RGBA');assert.equal(await history(),count);
    await page.screenshot({path:path.join(folder,'rename-validation-dark.png')});
    await entry('split').fill('');await entry('split').press('Enter');stable(before,await geometry('split'));
    assert.equal(await history(),count);await entry('split').press('Escape');stable(before,await geometry('split'));
    checks.push('Duplicate and empty-name errors float below the title without changing title/node height or graph history');

    await name('split').dblclick();const composing=entry('split');await composing.dispatchEvent('compositionstart');
    await composing.evaluate(input=>{input.value='中文';input.dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:true}));input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,isComposing:true}));});
    assert.equal(await composing.inputValue(),'中文');assert.equal(await nodeName('split'),'Split_RGBA');stable(before,await geometry('split'));
    await composing.dispatchEvent('compositionend');assert.equal(await composing.inputValue(),'');stable(before,await geometry('split'));
    await composing.press('Escape');assert.equal(await history(),count);stable(before,await geometry('split'));
    checks.push('IME composition stays intact until completion, does not submit composition Enter, and never expands the title');

    const parameter=page.locator('#inspector [data-node-name]');assert.equal(await parameter.count(),1);
    const parameterStyle=await parameter.evaluate(e=>{const s=getComputedStyle(e);return{padding:s.padding,height:e.getBoundingClientRect().height,font:s.font};});
    assert.equal(parameterStyle.padding,'3px 5px');assert.ok(parameterStyle.height>16);
    await name('split').dblclick();await entry('split').fill('Split_Editable');
    assert.deepEqual(await parameter.evaluate(e=>{const s=getComputedStyle(e);return{padding:s.padding,height:e.getBoundingClientRect().height,font:s.font};}),parameterStyle);
    await page.screenshot({path:path.join(folder,'rename-editing-dark.png')});await entry('split').press('Escape');
    checks.push('Parameter retains its existing padded name editor; only canvas rename gets the title-sized control');

    await page.evaluate(()=>setUIAppearance('theme','light'));before=await geometry('vector');await name('vector').dblclick();stable(before,await geometry('vector'));
    await entry('vector').fill('Split_RGBA');await entry('vector').press('Enter');stable(before,await geometry('vector'));
    await page.screenshot({path:path.join(folder,'rename-validation-light.png')});await entry('vector').press('Escape');
    checks.push('Light theme preserves the same edit/error geometry');
    assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,count:checks.length}));
  }catch(error){await h.finish(error);throw error;}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
