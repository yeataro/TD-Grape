/* Custom color picker contracts and real editor entry points.
 * Runs against an isolated fixture API; never writes to TouchDesigner.
 * node test_custom_color_picker.cjs SOURCE_DIR STATE_JSON REPORT_DIR [widget]
 */
const assert=require('node:assert/strict'),path=require('node:path');
const {harness}=require('./test_glsl_code.cjs');
const [source,state,folder,mode]=process.argv.slice(2);
const closeTo=(actual,expected,message,tolerance=1e-5)=>assert.ok(Math.abs(actual-expected)<=tolerance,`${message}: ${actual} != ${expected}`);
(async()=>{
  const h=await harness(source,state,folder,{skipPreview:true}),{page,checks,errors,settle}=h;
  page.setDefaultTimeout(7000);
  const popup=()=>page.locator('.grape-color-picker');
  const number=channel=>popup().locator(`input[type=number][data-channel="${channel}"]`);
  const normalizedHex=async()=>String(await popup().locator('.gcp-hex').inputValue()).replace(/^#/,'').toLowerCase();
  const hex=async value=>{await popup().locator('.gcp-hex').fill(value);await settle();};
  const close=async()=>{await popup().locator('.gcp-close').click();await settle();};
  const logs=()=>page.evaluate(()=>structuredClone(window.pickerTestLog));
  const outside=async()=>{await page.locator('#picker-test-outside').click();await settle();};
  const open=async(value,live=false)=>{
    await page.evaluate(({value,live})=>{
      window.pickerTestSession?.dispose();
      let anchor=document.querySelector('#picker-test-anchor');
      if(!anchor){anchor=document.createElement('button');anchor.id='picker-test-anchor';anchor.textContent='Color fixture';anchor.style.cssText='position:fixed;left:24px;top:80px;z-index:100000';document.body.append(anchor);}
      let other=document.querySelector('#picker-test-outside');
      if(!other){other=document.createElement('button');other.id='picker-test-outside';other.textContent='Outside';other.style.cssText='position:fixed;right:5px;bottom:5px;z-index:100000';document.body.append(other);}
      window.pickerTestValid=true;
      window.pickerTestLog={commits:[],previews:[],finishes:[]};
      window.pickerTestSession=GrapeColorPicker.open({anchor,value,live,isValid:()=>window.pickerTestValid,
        onCommit:color=>window.pickerTestLog.commits.push([...color]),
        onPreview:color=>window.pickerTestLog.previews.push([...color]),
        onFinish:accepted=>window.pickerTestLog.finishes.push(accepted)});
    },{value,live});await popup().waitFor({state:'visible'});await settle();
  };
  try{
    await page.selectOption('#language','en');
    await page.evaluate(()=>{
      clearTimeout(autoTimer);scheduleGraphApply=()=>{};
      nativeSourcePolling=uniformPolling=customPolling=true;uniformLive.disconnect();uniformLive.connect=()=>{};
      readonly=historyBusy=nativeMutationBusy=false;connectionInterrupted=conflicted=true;
      nativeSourceSnapshot=null;customSnapshot=null;graphTrail=[];graph.functions=[];graph.declarations=[];
      stage='pixel';selected=null;selectedInputId=null;selection.clear();past=[];future=[];
      graph.stages.pixel={nodes:[testNode('output','pixel_out',900,60)],edges:[]};
      render();setUIAppearance('scale',100);scale=1;pan={x:30,y:35};transform();
    });
    assert.equal(await page.evaluate(()=>typeof GrapeColorPicker?.open),'function');

    await open([.2,.4,.6]);
    assert.equal(await number('a').count(),0,'RGB does not offer Alpha');
    assert.equal((await normalizedHex()).length,6);
    assert.equal(await normalizedHex(),'336699');
    assert.equal(await popup().locator('input[type=color]').count(),0);
    await hex('#ff0000');assert.deepEqual((await logs()).commits,[]);
    closeTo(Number(await number('r').inputValue()),1,'red channel');
    closeTo(Number(await number('g').inputValue()),0,'green channel');
    closeTo(Number(await number('b').inputValue()),0,'blue channel');
    await popup().locator('.gcp-apply').click();await settle();
    assert.deepEqual((await logs()).commits,[[1,0,0]]);
    assert.equal(await popup().isVisible().catch(()=>false),false);
    checks.push('RGB has 3 components, 6-digit HEX and no Alpha/native picker; draft commits only on Apply');

    await open([.2,.4,.6,.75]);
    assert.equal(await number('a').count(),1);assert.equal((await normalizedHex()).length,8);
    await hex('#00ff0080');
    closeTo(Number(await number('h').inputValue()),120,'HEX updates HSV hue',.01);
    closeTo(Number(await number('a').inputValue()),128/255,'HEX updates alpha',.001);
    await number('h').fill('240');await settle();
    const blue=await normalizedHex();assert.equal(blue.slice(0,6),'0000ff');assert.equal(blue.slice(6),'80');
    await number('r').fill('1');await settle();
    const magenta=await normalizedHex();assert.equal(magenta.slice(0,6),'ff00ff');
    closeTo(Number(await number('h').inputValue()),300,'RGB updates HSV hue',.01);
    assert.deepEqual((await logs()).commits,[]);await close();assert.deepEqual((await logs()).commits,[]);
    checks.push('RGBA has 8-digit HEX; RGB, HSV and Alpha stay synchronized without premature commit');

    for(const reason of ['outside','Escape','X']){
      await open([.2,.4,.6,.75]);await hex('#abcdef12');
      if(reason==='outside')await outside();else if(reason==='Escape'){await page.keyboard.press('Escape');await settle();}else await close();
      assert.deepEqual((await logs()).commits,[],reason);assert.equal(await popup().isVisible().catch(()=>false),false,reason);
    }
    checks.push('Non-live outside, X and Escape discard a valid draft');

    await open([.2,.4,.6,.75]);
    for(const draft of ['#12','not-a-color','#gg001122']){
      await hex(draft);assert.equal(await popup().locator('.gcp-apply').isDisabled(),true,`invalid HEX ${draft}`);
      assert.deepEqual((await logs()).commits,[]);
    }
    await hex('#11223344');assert.equal(await popup().locator('.gcp-apply').isEnabled(),true);
    await number('r').fill('');await settle();assert.equal(await popup().locator('.gcp-apply').isDisabled(),true,'empty numeric draft');
    await number('r').fill('0.5');await settle();assert.equal(await popup().locator('.gcp-apply').isEnabled(),true);
    await popup().locator('.gcp-apply').click();await settle();
    assert.equal((await logs()).commits.length,1);assert.ok((await logs()).commits[0].every(Number.isFinite));
    checks.push('Invalid HEX and empty numeric drafts cannot commit; a corrected draft recovers without losing the session');

    await open([.2,.4,.6,.75],true);
    await hex('#ff000080');await hex('#00ff0080');
    let liveLog=await logs();assert.equal(liveLog.previews.length,2);assert.deepEqual(liveLog.commits,[]);
    assert.deepEqual(liveLog.previews.at(-1),[0,1,0,128/255]);
    await outside();assert.deepEqual((await logs()).finishes,[true]);
    for(const reason of ['X','Escape']){
      await open([.2,.4,.6,.75],true);await hex('#abcdef12');
      if(reason==='X')await close();else{await page.keyboard.press('Escape');await settle();}
      liveLog=await logs();assert.equal(liveLog.previews.length,1);assert.deepEqual(liveLog.finishes,[false]);
    }
    checks.push('Live valid edits preview immediately; outside accepts, X/Escape request restoration through onFinish(false)');

    // An anchor can disappear after a parameter redraw or graph deletion.
    await open([.2,.4,.6,.75]);await hex('#01020304');
    await page.evaluate(()=>document.querySelector('#picker-test-anchor').remove());await settle();
    if(await popup().isVisible().catch(()=>false)){await popup().locator('.gcp-apply').evaluate(e=>e.click());await settle();}
    assert.deepEqual((await logs()).commits,[]);
    await open([.2,.4,.6,.75]);await hex('#01020304');await page.evaluate(()=>window.pickerTestValid=false);
    if(await popup().isVisible().catch(()=>false)){await popup().locator('.gcp-apply').evaluate(e=>e.click());await settle();}
    assert.deepEqual((await logs()).commits,[]);
    await open([.2,.4,.6,.75]);await page.evaluate(()=>window.pickerTestSession.dispose());await settle();
    assert.equal(await popup().isVisible().catch(()=>false),false);assert.deepEqual((await logs()).commits,[]);
    checks.push('Disconnected anchors, invalidated ownership and disposal cannot commit a stale draft');

    await page.evaluate(()=>{window.originalTestEyeDropper=window.EyeDropper;window.EyeDropper=class{async open(){throw new DOMException('Unavailable in this browser','NotAllowedError');}};});
    await open([.2,.4,.6,.75]);const eyeBefore=await normalizedHex();
    await popup().locator('.gcp-eyedropper').click();await settle();
    assert.equal(await normalizedHex(),eyeBefore);assert.deepEqual((await logs()).commits,[]);
    await hex('#abcdef12');assert.equal(await popup().locator('.gcp-apply').isEnabled(),true);await close();
    await page.evaluate(()=>{window.EyeDropper=class{open(){return new Promise(resolve=>window.resolveTestEyeDropper=resolve);}};});
    await open([.2,.4,.6,.75]);await popup().locator('.gcp-eyedropper').click();await settle();await close();
    await open([.8,.7,.6,.5]);const nextBefore=await normalizedHex();
    await page.evaluate(()=>window.resolveTestEyeDropper({sRGBHex:'#ff0000'}));await settle();
    assert.equal(await normalizedHex(),nextBefore);assert.deepEqual((await logs()).commits,[]);await close();
    await page.evaluate(()=>{window.EyeDropper=undefined;});await open([.2,.4,.6]);
    const noEye=popup().locator('.gcp-eyedropper');assert.ok(await noEye.count()===0||await noEye.isDisabled());
    await close();await page.evaluate(()=>{window.EyeDropper=window.originalTestEyeDropper;});
    checks.push('Missing or rejected EyeDropper remains optional; late results from a closed session cannot alter a later picker');

    await open([.2,.4,.6,.75]);
    const preview=await popup().locator('.gcp-preview-checker').boundingBox();
    closeTo(preview.width,100,'current preview width',.5);closeTo(preview.height,100,'current preview height',.5);
    assert.equal(await popup().locator('.gcp-swatches .gcp-swatch').count(),44);
    assert.equal(await popup().locator('.gcp-saved .gcp-swatch').count(),6);
    const tiles=await popup().locator('.gcp-swatches .gcp-swatch').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {x:Math.round(r.x),y:Math.round(r.y)};}));
    assert.equal(new Set(tiles.map(r=>r.x)).size,11);assert.equal(new Set(tiles.map(r=>r.y)).size,4);
    await popup().locator('[data-view=plane]').click();
    for(const shape of ['square','circle','triangle']){
      await popup().locator(`[data-shape="${shape}"]`).click();
      assert.equal(await popup().locator(`[data-shape="${shape}"]`).getAttribute('aria-pressed'),'true');
      const surface=await popup().locator('.gcp-surface').boundingBox();
      await page.mouse.click(surface.x+surface.width*.5,surface.y+surface.height*.5);await settle();
      assert.ok(/^[0-9a-f]{8}$/.test(await normalizedHex()));
      for(const channel of ['r','g','b','a'])assert.ok(Number.isFinite(Number(await number(channel).inputValue())));
    }
    await popup().locator('[data-view=swatches]').click();assert.equal(await popup().locator('.gcp-swatches').isVisible(),true);
    assert.deepEqual((await logs()).commits,[]);await close();
    checks.push('100×100 current preview, 44 preset colors in 11×4, six session slots and all three interactive planes fit one shared picker');

    if(mode!=='widget'){
      await page.evaluate(()=>{
        document.querySelector('#picker-test-anchor')?.remove();
        graph.stages.pixel={nodes:[testNode('color','color',80,80,{value:[.2,.4,.6,.75]}),testNode('output','pixel_out',650,80)],edges:[]};
        selected='color';selection=new Set(['color']);inspectorTab='parameters';past=[];future=[];render();
      });
      const swatch=()=>page.locator('#inspector .color-picker-trigger');
      const graphJSON=()=>page.evaluate(()=>JSON.stringify(graph));
      const value=()=>page.evaluate(()=>current().nodes.find(n=>n.id==='color').params.value);
      const original=await graphJSON();await swatch().click();await hex('#ff800040');
      assert.equal(await graphJSON(),original);assert.equal(await page.evaluate(()=>past.length),0);
      await popup().locator('.gcp-apply').click();await settle();
      assert.deepEqual(await value(),[1,128/255,0,64/255]);assert.equal(await page.evaluate(()=>past.length),1);
      await page.evaluate(()=>undo());assert.equal(await graphJSON(),original);
      await page.evaluate(()=>undo(true));assert.deepEqual(await value(),[1,128/255,0,64/255]);
      checks.push('Actual Color node applies RGB/Alpha atomically with one complete Undo/Redo and no edits before Apply');

      const keyboardBefore=await graphJSON(),keyboardHistory=await page.evaluate(()=>past.length);
      await swatch().click();await hex('#aabbccdd');
      await popup().locator('.gcp-hex').press('Control+z');await settle();
      assert.equal(await graphJSON(),keyboardBefore,'focused picker Ctrl+Z must not undo graph');
      assert.equal(await page.evaluate(()=>past.length),keyboardHistory);
      await popup().locator('.gcp-hex').press('Delete');await settle();
      assert.equal(await graphJSON(),keyboardBefore,'focused picker Delete must not remove selected node');
      assert.equal(await page.evaluate(()=>past.length),keyboardHistory);
      await popup().locator('.gcp-hex').press('Tab');await settle();
      assert.equal(await popup().isVisible(),true);
      assert.equal(await popup().evaluate(e=>e.contains(document.activeElement)),true,'Tab advances within the visible color controls');
      await close();assert.equal(await graphJSON(),keyboardBefore);
      checks.push('Picker text edits isolate Ctrl+Z/Delete from graph history/selection and Tab moves among picker controls');

      for(const reason of ['outside','X','Escape']){
        const before=await graphJSON(),history=await page.evaluate(()=>past.length);
        await swatch().click();await hex('#aabbccdd');
        if(reason==='outside')await outside();else if(reason==='Escape'){await page.keyboard.press('Escape');await settle();}else await close();
        assert.equal(await graphJSON(),before,reason);assert.equal(await page.evaluate(()=>past.length),history,reason);
      }
      await page.evaluate(()=>{current().nodes.find(n=>n.id==='color').params.value=[1.4,-.2,.25,.123456];past=[];future=[];render();});
      const extended=await graphJSON();await swatch().click();await popup().locator('.gcp-apply').click();await settle();
      assert.equal(await graphJSON(),extended);assert.equal(await page.evaluate(()=>past.length),0);
      checks.push('Cancel/outside do not edit Color; unchanged Apply preserves exact HDR/negative RGB and fractional alpha');

      await swatch().click();await hex('#10203040');
      await page.evaluate(()=>{selected='output';selection=new Set(['output']);inspector();});await settle();
      if(await popup().isVisible().catch(()=>false)){await popup().locator('.gcp-apply').evaluate(e=>e.click());await settle();}
      assert.equal(await graphJSON(),extended);assert.equal(await page.evaluate(()=>past.length),0);
      await page.evaluate(()=>{readonly=true;selected='color';selection=new Set(['color']);inspector();});
      assert.equal(await swatch().isDisabled(),true);
      await page.evaluate(()=>{readonly=false;render();});
      checks.push('A Parameter redraw invalidates the old Color editor; readonly disables the real entry point');

      await page.evaluate(()=>{
        const note=testNode('note','comment',80,360);note.ui.noteColor='#485f8d';note.ui.comment='Color fixture';
        current().nodes.push(note);current().ui||={};current().ui.frames=[{id:'frame',name:'Color frame',nodes:['color','output'],color:'#485f8d'}];
        selected='note';selection=new Set(['note']);inspectorTab='settings';past=[];future=[];render();scale=.8;pan={x:35,y:30};transform();rememberSavedGraph(graph);
      });
      const canvasTarget=[
        ['Note','#inspector [data-note-color-setting]',()=>page.evaluate(()=>current().nodes.find(n=>n.id==='note').ui.noteColor)],
        ['Frame','[data-frame="frame"] [data-frame-color]',()=>page.evaluate(()=>current().ui.frames.find(f=>f.id==='frame').color)],
      ];
      for(const [label,trigger,read] of canvasTarget){
        const before=await graphJSON(),history=await page.evaluate(()=>past.length);
        await page.locator(trigger).click();await page.locator('[data-frame-color-custom]').click();await popup().waitFor({state:'visible'});
        assert.equal(await number('a').count(),0,label);assert.equal((await normalizedHex()).length,6,label);
        await hex('#123456');assert.equal(await graphJSON(),before,label);
        await close();assert.equal(await graphJSON(),before,label);assert.equal(await page.evaluate(()=>past.length),history,label);
        await page.locator(trigger).click();await page.locator('[data-frame-color-custom]').click();await hex('#123456');
        await popup().locator('.gcp-apply').click();await settle();
        assert.equal(await read(),'#123456',label);assert.equal(await page.evaluate(()=>past.length),history+1,label);
        assert.equal(await page.evaluate(()=>hasShaderChanges()),false,label+' is presentation only');
        await page.evaluate(()=>undo());assert.equal(await graphJSON(),before,label);
      }
      assert.equal(await page.locator('input[type=color]').count(),0);
      checks.push('Note/Frame Custom use the shared RGB picker: Cancel preserves graph, Apply is one UI-only Undo, no native color inputs remain');

      await page.evaluate(()=>{
        graph.declarations=[{id:'tint',name:'uTint',kind:'uniform',type:'vec4',nativeSequence:'color',value:null}];
        graph.stages.pixel={nodes:[testNode('reference','uniform',70,70,{declarationId:'tint'}),testNode('output','pixel_out',630,70)],edges:[]};
        selected='reference';selection=new Set(['reference']);inspectorTab='parameters';selectedInputId=null;
        readonly=historyBusy=nativeMutationBusy=connectionInterrupted=conflicted=dirty=false;
        nativeSourceError='';nativeSourceUncertain=false;nativeSourceBusy=false;uniformLive.invalidSources.clear();
        nativeSourceSnapshot={revision,enabled:true,declarations:clone(graph.declarations),uniforms:graph.declarations.map(d=>({...d,sequence:'color',missing:false,pending:false,components:[.2,.4,.6,.75].map((value,i)=>({value,mode:'CONSTANT',writable:true,parameter:'color'+i}))})),issues:[]};
        sourceCollapsePreferences.defaultCollapsed=false;inputCollapsedGroups.clear();setInputGroupCollapsed('uniform',false);past=[];future=[];window.uniformPickerLog=[];
        uniformLive.prepareColorSession=async(id,options)=>{
          const opening=nativeSourceIndex().get(id).components.map(c=>c.value),record={id,opening:[...opening],previews:[],finishes:[]};
          window.uniformPickerLog.push(record);
          return {preview:value=>{
            if(!options.isValid())return;
            record.previews.push([...value]);nativeSourceIndex().get(id).components.forEach((c,i)=>c.value=value[i]);renderNativeSourceValues(new Set([id]));
          },finish:accept=>{
            record.finishes.push(accept);
            if(!accept)nativeSourceIndex().get(id).components.forEach((c,i)=>c.value=opening[i]);
            renderNativeSourceValues(new Set([id]));
          }};
        };
        window.mockColorPreparation=uniformLive.prepareColorSession;
        render();workspaceLayout.reveal('uniforms');scale=.9;pan={x:30,y:35};transform();window.uniformGraphBefore=JSON.stringify(graph);
      });
      for(const trigger of ['[data-input-source="tint"] .color-picker-trigger','#inspector .color-picker-trigger','[data-node="reference"] .color-picker-trigger']){
        await page.locator(trigger).click();await popup().waitFor({state:'visible'});
        assert.equal(await popup().locator('.gcp-apply').isVisible().catch(()=>false),false,'live needs no Apply');
        await hex('#11223344');await hex('#aabbccdd');
        assert.deepEqual(await page.evaluate(()=>nativeSourceIndex().get('tint').components.map(c=>c.value)),[170/255,187/255,204/255,221/255]);
        assert.equal(await page.evaluate(()=>JSON.stringify(graph)===window.uniformGraphBefore),true);
        assert.equal(await page.evaluate(()=>past.length),0);
        await close();
        const entry=await page.evaluate(()=>window.uniformPickerLog.at(-1));
        assert.equal(entry.previews.length,2);assert.deepEqual(entry.finishes,[false]);
        assert.deepEqual(await page.evaluate(()=>nativeSourceIndex().get('tint').components.map(c=>c.value)),entry.opening);
      }
      await page.locator('[data-input-source="tint"] .color-picker-trigger').click();await hex('#ff000080');await outside();
      assert.deepEqual(await page.evaluate(()=>window.uniformPickerLog.at(-1).finishes),[true]);
      assert.deepEqual(await page.evaluate(()=>nativeSourceIndex().get('tint').components.map(c=>c.value)),[1,0,0,128/255]);
      checks.push('Uniform Sources, Parameter and reference nodes use one live adapter session; preview leaves graph history intact, X restores, outside accepts (isolated adapter mock)');

      await page.evaluate(()=>{
        const row=nativeSourceIndex().get('tint');row.components[1]={...row.components[1],mode:'EXPRESSION',writable:false,expression:'absTime.seconds'};
        renderNativeSourceValues(new Set(['tint']));
      });
      for(const trigger of ['[data-input-source="tint"] .color-picker-trigger','#inspector .color-picker-trigger','[data-node="reference"] .color-picker-trigger'])assert.equal(await page.locator(trigger).isDisabled(),true);
      await page.evaluate(()=>{
        const row=nativeSourceIndex().get('tint');row.components[1]={...row.components[1],mode:'BIND',writable:true,binding:'parent().par.Color'};
        renderNativeSourceValues(new Set(['tint']));
        uniformLive.prepareColorSession=()=>new Promise(resolve=>window.resolveColorPreparation=resolve);
      });
      await page.locator('#inspector .color-picker-trigger').click();
      await page.evaluate(()=>{
        selected='output';selection=new Set(['output']);inspector();window.latePreparedFinish=[];
        window.resolveColorPreparation({preview:()=>{throw new Error('stale preparation previewed');},finish:accept=>window.latePreparedFinish.push(accept)});
      });await settle();
      assert.equal(await popup().isVisible().catch(()=>false),false);assert.deepEqual(await page.evaluate(()=>window.latePreparedFinish),[false]);
      assert.equal(await page.evaluate(()=>JSON.stringify(graph)===window.uniformGraphBefore),true);
      checks.push('Driven channels disable all live entries; a late session preparation after Parameter ownership changes is cancelled before opening');

      await page.evaluate(()=>{
        uniformLive.prepareColorSession=window.mockColorPreparation;
        customError='';customBusy=false;dirty=false;
        const source=nativeSourceIndex().get('tint'),values=source.components.map(c=>c.value);
        customSnapshot={enabled:true,operator:'/fixture/Color/glsl',revision,expectedPages:'pages',history:{undo:false,redo:false,expected:'history'},pages:[{name:'Colors',editable:true}],controls:[{
          name:'Tint',label:'Tint',page:'Colors',style:'RGBA',size:4,order:0,section:false,editable:true,menuNames:[],menuLabels:[],sources:[],expected:'same-control-definition',
          components:values.map((value,i)=>({name:'Tint'+'rgba'[i],value,default:value,mode:'CONSTANT',writable:true,enabled:true,readOnly:false,min:0,max:1,normMin:0,normMax:1,clampMin:false,clampMax:false,help:''})),
        }]};
        customPage='Colors';window.customColorCalls=[];
        customRequest=async body=>{window.customColorCalls.push(clone(body));for(const item of body.components||[])customCurrent(body.name).components[item.component].value=item.value;updateCustomValues();return true;};
        refreshCustomParameters=async()=>{renderCustomParameters();return true;};
        window.setTestColorBinding=enabled=>{
          const row=customCurrent('Tint');row.sources=enabled?['tint']:[];
          source.components.forEach((component,i)=>{if(enabled)component.controlPath=customSnapshot.operator+'.par.'+row.components[i].name;else delete component.controlPath;});
          renderCustomParameters();updateCustomValues();
        };
        window.setTestColorBinding(false);workspaceLayout.reveal('controls');
      });
      const opTrigger=()=>page.locator('#customcontrols [data-custom-control="Tint"] .color-picker-trigger');
      await opTrigger().click();await hex('#12345678');assert.equal(await popup().locator('.gcp-apply').isVisible(),true);
      assert.deepEqual(await page.evaluate(()=>window.customColorCalls),[]);
      await page.evaluate(()=>window.setTestColorBinding(true));await settle();
      assert.equal(await popup().isVisible().catch(()=>false),false,'binding invalidates an unbound draft');
      assert.deepEqual(await page.evaluate(()=>window.customColorCalls),[]);
      const beforeBound=await page.evaluate(()=>window.uniformPickerLog.length);
      await opTrigger().click();await hex('#55667788');assert.equal(await popup().locator('.gcp-apply').isVisible().catch(()=>false),false);
      assert.equal(await page.evaluate(()=>window.uniformPickerLog.length),beforeBound+1);
      assert.deepEqual(await page.evaluate(()=>window.customColorCalls),[],'bound OP uses the live adapter');
      await page.evaluate(()=>window.setTestColorBinding(false));await settle();
      assert.equal(await popup().isVisible().catch(()=>false),false,'unbinding invalidates a live draft');
      assert.deepEqual(await page.evaluate(()=>window.uniformPickerLog.at(-1).finishes),[false]);
      const sessions=await page.evaluate(()=>window.uniformPickerLog.length);
      await opTrigger().click();await hex('#aabbccdd');assert.equal(await popup().locator('.gcp-apply').isVisible(),true);
      assert.deepEqual(await page.evaluate(()=>window.customColorCalls),[]);
      await popup().locator('.gcp-apply').click();await settle();
      assert.equal(await page.evaluate(()=>window.customColorCalls.length),1);
      assert.equal(await page.evaluate(()=>window.uniformPickerLog.length),sessions,'unbound OP must not reuse an old source session');
      assert.deepEqual(await page.evaluate(()=>customCurrent('Tint').components.map(c=>c.value)),[170/255,187/255,204/255,221/255]);
      assert.equal(await page.evaluate(()=>JSON.stringify(graph)===window.uniformGraphBefore),true);
      checks.push('OP binding/unbinding reprojects its entry and invalidates stale popups; bound controls are live and unbound controls use explicit Apply');
    }

    await open([.2,.4,.6,.75]);
    await page.screenshot({path:path.join(folder,'custom-color-picker.png')});await close();
    assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,count:checks.length,checks}));
  }catch(error){await h.finish(error);throw error;}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
