/* Isolated Chromium tests for horizontal numeric scrubbing and proportion fills. */
const assert=require('node:assert/strict'),path=require('node:path');
const {harness}=require('./test_glsl_code.cjs');
const [source,stateFile,folder]=process.argv.slice(2);
(async()=>{const h=await harness(source,stateFile,folder,{touch:true}),{page,checks,errors,settle}=h;page.setDefaultTimeout(6000);
const field=(id='float',i=0)=>page.locator(`[data-inline-node="${id}"][data-component="${i}"]`);
const point=async entry=>{const r=await entry.boundingBox();assert.ok(r);return{x:r.x+r.width*.45,y:r.y+r.height/2};};
const width=async entry=>(await entry.boundingBox()).width;
const close=(actual,expected,label='')=>assert.ok(Math.abs(actual-expected)<1e-10,label+': '+actual+' != '+expected);
const value=()=>page.evaluate(()=>current().nodes.find(n=>n.id==='float').params.value);
const snapshot=()=>page.evaluate(()=>JSON.stringify({graph,past,future}));
const begin=async(entry=field())=>{await page.locator('#canvas').focus();await settle();const p=await point(entry);await page.mouse.move(p.x,p.y);await page.mouse.down();return p;};
const move=async(p,dx)=>{await page.mouse.move(p.x+dx,p.y,{steps:4});await settle();};
const end=async()=>{await page.mouse.up();await settle();};
const drag=async(entry,dx)=>{const p=await begin(entry);await move(p,dx);await end();};
const reset=async(scaleValue=.8)=>{await page.evaluate(scaleValue=>{cancelValueLadder();document.activeElement?.blur();clearTimeout(autoTimer);connectionInterrupted=true;readonly=false;historyBusy=false;nativeMutationBusy=false;graphTrail=[];graph.functions=[];graph.declarations=[];stage='pixel';selected=null;selection.clear();past=[];future=[];graph.stages.pixel={nodes:[testNode('float','float',30,40,{value:.3}),testNode('vector','vector',30,245,{type:'vec4',components:[.1,.2,.3,.4]}),testNode('color','color',30,460,{value:[.55,.28,.9,1]}),testNode('combine','combine',360,40,{type:'vec3',components:[.1,.2,.3,0]})],edges:[]};dirty=false;rememberSavedGraph(graph);render();scale=scaleValue;pan={x:25,y:30};transform();},scaleValue);await settle();};
try{
await reset();let before=await snapshot(),p=await begin(),w=await width(field());await move(p,w*.3);assert.equal(Number(await field().inputValue()),.6);assert.equal(await value(),.3);assert.equal(await snapshot(),before);assert.equal(await page.locator('#valueladder').count(),0);assert.equal(await field().evaluate(e=>e.style.getPropertyValue('--numeric-fill')),'60%');await page.evaluate(()=>render());assert.equal(Number(await field().inputValue()),.6);assert.equal(await page.evaluate(()=>!!valueLadder),true);await end();assert.equal(await value(),.6);assert.equal(await page.evaluate(()=>past.length),1);assert.equal(await field().evaluate(e=>e===document.activeElement),false);assert.equal(await page.evaluate(()=>!!valueLadder||!!pendingValueLadder),false);await page.locator('#undo').click();assert.equal(await value(),.3);await page.locator('#redo').click();assert.equal(await value(),.6);checks.push('left drag follows the visible field proportion, previews locally, commits once, supports Undo/Redo, and leaves the field ready for another drag');
await drag(field(),await width(field())*.1);assert.equal(await value(),.7);checks.push('successive drags on the same field keep working');
await reset();await field().click();assert.equal(await field().evaluate(e=>e===document.activeElement),true);before=await snapshot();p=await point(field());await page.mouse.move(p.x,p.y);await page.mouse.down();await move(p,30);await end();assert.equal(await snapshot(),before);await field().fill('.75');await field().press('Enter');assert.equal(await value(),.75);assert.equal(await page.evaluate(()=>past.length),1);await field().fill('');await page.evaluate(()=>render());assert.equal(await field().inputValue(),'');await field().press('Escape');assert.equal(Number(await field().inputValue()),.75);assert.equal(await field().evaluate(e=>e.style.getPropertyValue('--numeric-fill')),'75%');checks.push('click-release enters text editing; selection drags and incomplete drafts remain native, with typed commit and Escape restoration');
const widths=[];for(const [ui,zoom,nodeWidth]of [[75,.35,240],[100,.8,400],[125,1.3,240]]){await reset(zoom);await page.evaluate(({ui,nodeWidth})=>{setUIAppearance('scale',ui);current().nodes[0].ui.width=nodeWidth;render();}, {ui,nodeWidth});await settle();w=await width(field());widths.push(w);await drag(field(),w*.2);assert.equal(await value(),.5);}assert.ok(Math.max(...widths)>Math.min(...widths)*2);await page.evaluate(()=>setUIAppearance('scale',100));checks.push('the same visible field-width fraction gives the same delta across node widths, graph zoom and 75/100/125% UI scale');
for(const [start,fraction,expected]of [[0,.2,.2],[0,1,1],[-.5,.2,-.3],[-.1,.2,.1],[12,.2,32],[-12,.2,-8.2],[100,.1,200],[100.5,.1,200.5]]){await reset();await page.evaluate(start=>{current().nodes[0].params.value=start;render();},start);await settle();await drag(field(),await width(field())*fraction);close(await value(),expected,String(start));}checks.push('signed values and zero use the displayed decimal range; larger magnitudes scale the movement without an absolute-position jump');
for(const [start,first,second]of [[1,4,7],[9.9,39,69],[-9.9,-6.9,-3.9]]){await reset();await page.evaluate(start=>{current().nodes[0].params.value=start;render();},start);await settle();w=await width(field());p=await begin();await move(p,w*.3);close(Number(await field().inputValue()),first);await move(p,w*.6);close(Number(await field().inputValue()),second);await move(p,0);await end();assert.equal(await value(),start);assert.equal(await page.evaluate(()=>past.length),0);}checks.push('one gesture continuously follows each current decimal range and reverses exactly across boundaries without an Undo entry');
// Fractional client coordinates are supported, with one actual pointer move per sample.
const preciseMove=async(p,dx)=>{await page.mouse.move(p.x+dx,p.y);await settle();};

for(const [start,direction,coarse]of [[.3,1,false],[-.3,-1,false],[.3,1,true],[-.3,-1,true]]){
  const outcomes=[];
  for(const packets of[1,60]){await reset();await page.evaluate(start=>{current().nodes[0].params.value=start;current().nodes[0].ui.x=300;current().nodes.find(n=>n.id==='combine').ui.y=750;render();},start);await settle();w=await width(field());before=await snapshot();if(coarse)await page.keyboard.down('Control');p=await begin();const distance=w*(coarse?.27:2.7)*direction;await page.mouse.move(p.x+distance,p.y,{steps:packets});await settle();const preview=Number(await field().inputValue());outcomes.push(preview);close(preview,300*direction,'packet-independent multi-range preview');assert.equal(await snapshot(),before);await end();if(coarse)await page.keyboard.up('Control');assert.equal(await page.evaluate(()=>past.length),1);close(await value(),300*direction);await page.locator('#undo').click();assert.equal(await value(),start);}
  assert.equal(outcomes[0],outcomes[1]);
}
checks.push('positive and negative multi-range travel produces the same result with one or sixty pointer packets, including Ctrl acceleration, and commits one Undo');
await reset();await page.evaluate(()=>{current().nodes[0].ui.x=300;current().nodes.find(n=>n.id==='combine').ui.y=750;render();});await settle();before=await snapshot();w=await width(field());p=await begin();
for(const [fraction,expected]of [[.6,.9],[1.6,10],[2.6,200],[1.6,10],[.6,.9],[0,.3],[-.6,-.3],[-1.6,-4],[-2.6,-50],[0,.3]]){await preciseMove(p,w*fraction);close(Number(await field().inputValue()),expected,'continuous reversal '+fraction);}
await end();assert.equal(await snapshot(),before);checks.push('one uninterrupted drag reverses through several positive ranges, crosses zero into negative ranges and returns exactly without Undo drift');
await reset();await page.evaluate(()=>{current().nodes[0].params.value=.9;render();});await settle();w=await width(field());p=await begin();await preciseMove(p,w*.1);assert.equal(await field().inputValue(),'1');
await page.keyboard.down('Control');await preciseMove(p,w*.1);assert.equal(await field().inputValue(),'1');await preciseMove(p,w*.2);assert.equal(await field().inputValue(),'20');
await page.keyboard.down('Shift');await preciseMove(p,w*.2);assert.equal(await field().inputValue(),'20');await preciseMove(p,w*.3);assert.equal(await field().inputValue(),'20.1');
await page.keyboard.up('Control');await preciseMove(p,w*.3);assert.equal(await field().inputValue(),'20.1');await preciseMove(p,w*.4);assert.equal(await field().inputValue(),'21.1');
await page.keyboard.up('Shift');await preciseMove(p,w*.4);assert.equal(await field().inputValue(),'21.1');await preciseMove(p,w*.3);assert.equal(await field().inputValue(),'11.1');await end();assert.equal(await value(),11.1);assert.equal(await page.evaluate(()=>past.length),1);await page.locator('#undo').click();assert.equal(await value(),.9);
checks.push('modifier switches exactly at a range boundary never jump; coarse and fine movement adapt to the new range and preserve one Undo');
await reset();before=await snapshot();w=await width(field());p=await begin();
await preciseMove(p,w*.2027);assert.equal(await field().inputValue(),'0.503');
await preciseMove(p,w*.2023);assert.equal(await field().inputValue(),'0.502');
for(let i=0;i<12;i++){await preciseMove(p,w*.2033);await preciseMove(p,w*.2023);}
assert.equal(await field().inputValue(),'0.502');assert.equal(await snapshot(),before);
await preciseMove(p,0);assert.equal(await field().inputValue(),'0.3');await end();assert.equal(await snapshot(),before);
p=await begin();await preciseMove(p,-w*.2027);assert.equal(await field().inputValue(),'0.097');await preciseMove(p,-w*.2023);assert.equal(await field().inputValue(),'0.098');await preciseMove(p,0);assert.equal(await field().inputValue(),'0.3');await end();assert.equal(await snapshot(),before);
checks.push('fractional pointer travel rounds symmetrically for both directions; repeated reversals have no decimal tails or Undo drift');
await reset();w=await width(field());p=await begin();await preciseMove(p,w*.2);assert.equal(await field().inputValue(),'0.5');
await page.keyboard.down('Shift');await preciseMove(p,w*.2);assert.equal(await field().inputValue(),'0.5');
await preciseMove(p,w*.4);assert.equal(await field().inputValue(),'0.52');
await page.keyboard.down('Control');await preciseMove(p,w*.4);assert.equal(await field().inputValue(),'0.52');
await preciseMove(p,w*.6);assert.equal(await field().inputValue(),'0.522');
await page.keyboard.up('Shift');await preciseMove(p,w*.6);assert.equal(await field().inputValue(),'0.522');
await preciseMove(p,w*.61);assert.equal(await field().inputValue(),'0.622');
await page.keyboard.up('Control');await preciseMove(p,w*.61);assert.equal(await field().inputValue(),'0.622');
await preciseMove(p,w*.71);assert.equal(await field().inputValue(),'0.722');await end();
assert.equal(await value(),.722);assert.equal(await page.evaluate(()=>past.length),1);
checks.push('modifier changes retain progress without jumps and make Ctrl faster, Shift slower and Ctrl+Shift finest within one Undo');
await reset();await page.keyboard.down('Shift');await page.keyboard.down('Control');w=await width(field());p=await begin();
await preciseMove(p,w*.2);assert.equal(await field().inputValue(),'0.302');await preciseMove(p,w*.21);assert.equal(await field().inputValue(),'0.3021');
await end();await page.keyboard.up('Control');await page.keyboard.up('Shift');assert.equal(await value(),.3021);
checks.push('Shift+Control retains a finer finite decimal increment relative to the current range');
await reset();await field().click();await field().fill('0.12345678912345');await field().press('Enter');
assert.equal(await value(),.12345678912345);assert.equal(await field().inputValue(),'0.12345678912345');
w=await width(field());p=await begin();await preciseMove(p,w*.2);assert.equal(await field().inputValue(),'0.32345678912345');await end();
assert.equal(await value(),.32345678912345);assert.equal(await page.evaluate(()=>past.length),2);
await page.locator('#undo').click();assert.equal(await value(),.12345678912345);
checks.push('manual high-precision input remains accepted, and relative drag increments preserve its existing precision rather than rounding the baseline');
await reset();for(let i=0;i<4;i++)await drag(field('vector',i),await width(field('vector',i))*.4);assert.deepEqual(await page.evaluate(()=>current().nodes.find(n=>n.id==='vector').params.components),[.5,.6,.7,.8]);for(let i=0;i<4;i++)await drag(field('color',i),await width(field('color',i))*.4);assert.deepEqual(await page.evaluate(()=>current().nodes.find(n=>n.id==='color').params.value),[.95,.68,4,5]);await drag(field('combine').first(),await width(field('combine').first())*.4);assert.equal(await page.evaluate(()=>current().nodes.find(n=>n.id==='combine').params.components[0]),.5);checks.push('Vector XYZW, Color RGBA and scalar input defaults all support the same proportion-based gesture');
await reset();await field().evaluate(entry=>{entry.min='0';entry.max='1';});w=await width(field());p=await begin();await move(p,w);assert.equal(await field().inputValue(),'1');await move(p,w*.9);assert.equal(await field().inputValue(),'0.9');await page.keyboard.press('Escape');await end();assert.equal(await value(),.3);assert.equal(await page.evaluate(()=>past.length),0);await field().evaluate(entry=>{entry.min='0';entry.max='1';});p=await begin();await move(p,-w*.5);assert.equal(await field().inputValue(),'0');await move(p,-w*.4);assert.equal(await field().inputValue(),'0.1');await end();assert.equal(await value(),.1);assert.equal(await page.evaluate(()=>past.length),1);checks.push('bounded float inputs clamp both ends, reverse immediately from the limit, cancel cleanly and commit at most once');
for(const start of[1e308,Number.MAX_VALUE]){await reset();await page.evaluate(start=>{current().nodes[0].params.value=start;render();},start);await settle();before=await snapshot();w=await width(field());p=await begin();await move(p,-w*.1);const preview=Number(await field().inputValue());assert.ok(Number.isFinite(preview)&&preview<start&&preview>0,String(preview));await end();assert.ok(Number.isFinite(await value()));assert.equal(await page.evaluate(()=>past.length),1);await page.locator('#undo').click();assert.equal(await value(),start);if(start===Number.MAX_VALUE){before=await snapshot();await drag(field(),await width(field())*.2);assert.ok(Number.isFinite(await value()));assert.equal(await value(),start);assert.equal(await snapshot(),before);w=await width(field());p=await begin();await move(p,w*.2);assert.equal(Number(await field().inputValue()),Number.MAX_VALUE);await move(p,w*.1);assert.ok(Number(await field().inputValue())<Number.MAX_VALUE);await page.keyboard.press('Escape');await end();assert.equal(await snapshot(),before);}}
checks.push('extreme finite magnitudes remain adjustable without an infinite range; overflow clamps finitely and Undo restores the exact starting number');
await reset();await page.evaluate(()=>{current().nodes[0].params.value=1e-200;render();});await settle();before=await snapshot();w=await width(field());p=await begin();await move(p,w*.2);assert.equal(Number(await field().inputValue()),.2);await move(p,0);assert.equal(Number(await field().inputValue()),1e-200);await end();assert.equal(await snapshot(),before);checks.push('returning to zero drag delta restores a tiny finite baseline exactly instead of rounding it to zero');
const cancellations=[['Escape',()=>page.keyboard.press('Escape')],['window blur',()=>page.evaluate(()=>window.dispatchEvent(new Event('blur')))],['pointer cancellation',()=>page.evaluate(()=>valueLadder.entry.dispatchEvent(new PointerEvent('pointercancel',{pointerId:1,bubbles:true})))],['lost pointer capture',()=>page.evaluate(()=>valueLadder.entry.releasePointerCapture(1))],['disabled',()=>page.evaluate(()=>{valueLadder.entry.disabled=true;})],['Tab',()=>page.keyboard.press('Tab')],['graph replacement',()=>page.evaluate(()=>{graph=clone(graph);render();})]];
for(const [name,cancel]of cancellations){await reset();p=await begin();await move(p,20);before=await snapshot();await cancel();await page.waitForFunction(()=>!valueLadder);await end();assert.equal(await snapshot(),before,name);assert.equal(await value(),.3);assert.equal(await page.evaluate(()=>document.body.classList.contains('scrubbing-value')),false);}checks.push('Escape, blur, pointercancel, capture loss, read-only transitions, Tab and graph replacement cancel without history writes');
await reset();await page.evaluate(()=>{readonly=true;render();});p=await point(field());await page.mouse.move(p.x,p.y);await page.mouse.down();await move(p,20);await end();assert.equal(await value(),.3);assert.equal(await page.evaluate(()=>past.length),0);checks.push('read-only numeric fields do not start or commit a drag');
await reset();await page.evaluate(()=>{selected='color';selection=new Set(['color']);inspector();});const param=page.locator('#inspector .color-parameter input[type=number]').first();await drag(param,await width(param)*.2);assert.equal(await page.evaluate(()=>current().nodes.find(n=>n.id==='color').params.value[0]),.75);assert.equal(await page.evaluate(()=>past.length),1);assert.equal(await field('color').evaluate(e=>e.style.getPropertyValue('--numeric-fill')),'75%');checks.push('Parameter and inline controls share the gesture and synchronized value/fill');
await reset();p=await point(field());await page.mouse.move(p.x,p.y);await page.mouse.down({button:'middle'});await page.locator('#valueladder').waitFor();const rung=await page.locator('[data-step="0.1"]').boundingBox(),y=rung.y+rung.height/2;await page.mouse.move(p.x,y);await page.mouse.move(p.x+16,y);assert.equal(Number(await field().inputValue()),.5);await page.mouse.up({button:'middle'});await settle();assert.equal(await value(),.5);assert.equal(await page.evaluate(()=>past.length),1);checks.push('middle-button Ladder retains its increments and single commit');
for(const percent of [75,125]){
  await reset(percent===75?.25:1.2);await page.evaluate(percent=>setUIAppearance('scale',percent),percent);await settle();
  before=await snapshot();p=await point(field());const fieldRect=await field().boundingBox(),helpBefore=await page.locator('#nodehelp').innerHTML();assert.equal((await field().getAttribute('title')).split('\n').length,5);
  await page.mouse.move(p.x,p.y);await page.mouse.down({button:'middle'});await page.locator('#valueladder').waitFor();
  const popup=page.locator('#valueladder'),full=await popup.boundingBox(),z=percent/100;
  assert.ok(Math.abs(full.width/z-84)<1);assert.ok(Math.abs(full.x+full.width/2-p.x)<1);
  const centered=await popup.locator('[data-step="0.1"]').boundingBox();assert.ok(Math.abs(centered.y+centered.height/2-p.y)<1);assert.equal(await popup.locator('strong,small').count(),0);assert.equal(await field().getAttribute('title'),null);
  assert.equal(await popup.locator('[data-step]:visible').count(),5);assert.equal(await popup.locator('.active').getAttribute('data-step'),'0.1');
  assert.equal(await popup.evaluate(e=>getComputedStyle(e).fontSize),'14px');
  const originalRows=await popup.locator('[data-step]').evaluateAll(rows=>Object.fromEntries(rows.map(row=>[row.dataset.step,{y:row.getBoundingClientRect().y+row.getBoundingClientRect().height/2}])));
  await page.mouse.move(p.x,p.y+2);assert.equal(Number(await field().inputValue()),.3);assert.equal(await popup.locator('.active').getAttribute('data-step'),'0.1');
  await page.screenshot({path:path.join(folder,`ladder-full-${percent}.png`)});
  await page.mouse.move(p.x,originalRows['0.1'].y);await page.mouse.move(p.x+16,originalRows['0.1'].y);
  assert.equal(Number(await field().inputValue()),.5);assert.equal(await popup.locator('[data-step]:visible').count(),0);assert.equal(await popup.locator('.ladder-value').innerText(),'0.5');assert.equal(await popup.locator('.ladder-step').innerText(),'Δ 0.1');assert.equal(await popup.locator('.ladder-value').evaluate(e=>getComputedStyle(e).fontSize),'14px');assert.equal(await popup.evaluate(e=>!!e.closest('#world')),false);assert.equal(await page.locator('#nodehelp').innerHTML(),helpBefore);
  const badge=await popup.boundingBox();assert.ok(badge.y+badge.height<=fieldRect.y);assert.ok(badge.height<full.height/3);
  await page.screenshot({path:path.join(folder,`ladder-compact-${percent}.png`)});
  const outside=full.x+full.width+80;await page.mouse.move(outside,originalRows['0.1'].y);
  const horizontal=Number(await field().inputValue());await page.mouse.move(outside,originalRows['0.01'].y);
  assert.equal(Number(await field().inputValue()),horizontal);assert.equal(await popup.locator('.active').getAttribute('data-step'),'0.1');
  assert.deepEqual(await popup.boundingBox(),badge); // The label stays fixed at the field, not the cursor.
  await page.mouse.move(p.x,originalRows['0.01'].y);
  assert.equal(Number(await field().inputValue()),horizontal);assert.equal(await popup.locator('[data-step]:visible').count(),5);
  assert.equal(await popup.locator('.active').getAttribute('data-step'),'0.01');assert.deepEqual(await popup.boundingBox(),full);
  await page.mouse.move(p.x+16,originalRows['0.01'].y);assert.ok(Math.abs(Number(await field().inputValue())-(horizontal+.02))<1e-12);
  assert.equal(await snapshot(),before);await page.keyboard.press('Escape');await page.mouse.up({button:'middle'});
  assert.equal(await snapshot(),before);assert.equal(Number(await field().inputValue()),.3);assert.ok((await field().getAttribute('title')).includes('Value Ladder'));
  checks.push(`${percent}% UI / independent graph zoom: five-step Ladder centers0.1 on the pointer, shows current value and increment at readable UI size while adjusting, hides/restores field help, locks precision and reselects without jumps`);
}
await page.evaluate(()=>setUIAppearance('scale',100));await settle();
await reset();const cdp=await page.context().newCDPSession(page),touch=async(type,p)=>{await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:p?[{id:1,x:p.x,y:p.y}]:[]});await settle();};p=await point(field());await touch('touchStart',p);await touch('touchEnd');assert.equal(await field().evaluate(e=>e===document.activeElement),true);const oldPan=await page.evaluate(()=>clone(pan));p=await point(field());await touch('touchStart',p);await touch('touchMove',{x:p.x+35,y:p.y+20});await touch('touchEnd');assert.notDeepEqual(await page.evaluate(()=>pan),oldPan);assert.equal(await value(),.3);assert.equal(await page.evaluate(()=>past.length),0);p=await point(field());await touch('touchStart',p);await page.locator('#valueladder').waitFor();const touchRung=await page.locator('[data-step="0.1"]').boundingBox(),touchY=touchRung.y+touchRung.height/2;await touch('touchMove',{x:p.x,y:touchY});await touch('touchMove',{x:p.x+16,y:touchY});assert.equal(await value(),.3);await touch('touchEnd');assert.equal(await value(),.5);assert.equal(await page.evaluate(()=>past.length),1);p=await point(field());await touch('touchStart',p);await page.locator('#valueladder').waitFor();await touch('touchCancel');assert.equal(await page.locator('#valueladder').count(),0);assert.equal(await value(),.5);checks.push('touch tap focuses typing, swipe pans, long-press Ladder commits once and touch cancellation preserves the value');
await reset();p=await begin();await page.locator('#valueladder').waitFor();await page.keyboard.press('Escape');await end();assert.equal(await value(),.3);assert.equal(await page.evaluate(()=>past.length),0);await page.keyboard.down('Alt');p=await point(field());await page.mouse.move(p.x,p.y);await page.mouse.down({button:'right'});await page.locator('#valueladder').waitFor();await page.mouse.up({button:'right'});await page.keyboard.up('Alt');assert.equal(await page.locator('#valueladder').count(),0);assert.equal(await value(),.3);checks.push('stationary left hold and Alt+right mouse retain their existing Ladder triggers');
await reset();before=await snapshot();p=await begin();await move(p,20);await move(p,0);await end();assert.equal(await snapshot(),before);checks.push('returning to the starting value produces no Undo entry');
await page.evaluate(()=>{const box=$('#inspector');window.integerWrites=[];const row=specValueField(3,'int',value=>integerWrites.push(value));box.append(row);row.querySelector('input').dataset.testInteger='true';});const integerField=page.locator('[data-test-integer]');await drag(integerField,20);assert.equal(Number(await integerField.inputValue()),5);assert.deepEqual(await page.evaluate(()=>integerWrites),[5]);checks.push('integer fields preserve whole-number steps and submit once');
await page.evaluate(()=>{$('[data-test-integer]').setSyncedValue(3);integerWrites=[];});p=await begin(integerField);
await preciseMove(p,20.25);assert.equal(await integerField.inputValue(),'5');await preciseMove(p,29.75);assert.equal(await integerField.inputValue(),'5');
await preciseMove(p,30.25);assert.equal(await integerField.inputValue(),'6');await preciseMove(p,20.25);assert.equal(await integerField.inputValue(),'5');
await end();assert.deepEqual(await page.evaluate(()=>integerWrites),[5]);
await page.evaluate(()=>{$('[data-test-integer]').setSyncedValue(3);integerWrites=[];});await page.keyboard.down('Shift');p=await begin(integerField);
await preciseMove(p,99.75);assert.equal(await integerField.inputValue(),'3');await preciseMove(p,100.25);assert.equal(await integerField.inputValue(),'4');
await end();await page.keyboard.up('Shift');assert.deepEqual(await page.evaluate(()=>integerWrites),[4]);
await page.evaluate(()=>{$('[data-test-integer]').setSyncedValue(3);integerWrites=[];});await page.keyboard.down('Control');p=await begin(integerField);
await preciseMove(p,5.25);assert.equal(await integerField.inputValue(),'8');await preciseMove(p,5.75);assert.equal(await integerField.inputValue(),'8');
await end();await page.keyboard.up('Control');assert.deepEqual(await page.evaluate(()=>integerWrites),[8]);
await page.evaluate(()=>{$('[data-test-integer]').setSyncedValue(3);integerWrites=[];});await page.keyboard.down('Shift');await page.keyboard.down('Control');p=await begin(integerField);
await preciseMove(p,5.25);assert.equal(await integerField.inputValue(),'8');await end();await page.keyboard.up('Control');await page.keyboard.up('Shift');assert.deepEqual(await page.evaluate(()=>integerWrites),[8]);
checks.push('integer scrubbing stays integral with fractional pointers and uses 10 pixels normally, 100 with Shift, or 1 with Control including Shift+Control');
await page.evaluate(()=>{window.uintWrites=[];const row=specValueField(1,'uint',value=>uintWrites.push(value));$('#inspector').append(row);row.querySelector('input').dataset.testUnsigned='true';});
const unsignedField=page.locator('[data-test-unsigned]');p=await begin(unsignedField);await preciseMove(p,-40);assert.equal(await unsignedField.inputValue(),'0');
await preciseMove(p,-30);assert.equal(await unsignedField.inputValue(),'1');await end();assert.deepEqual(await page.evaluate(()=>uintWrites),[]);
p=await begin(unsignedField);await preciseMove(p,-40);await end();assert.equal(await unsignedField.inputValue(),'0');assert.deepEqual(await page.evaluate(()=>uintWrites),[0]);
checks.push('uint scrubbing respects zero, rebases at the clamp for immediate reversal, and emits no write when the gesture returns to its starting value');
await page.evaluate(()=>{const entry=$('[data-test-integer]');entry.setSyncedValue(.4);});assert.equal(await integerField.evaluate(e=>e.style.getPropertyValue('--numeric-fill')),'40%');checks.push('programmatic source synchronization also updates the proportion fill');
await reset();before=await snapshot();
for(const [number,percent]of [[-100,0],[-20,80],[-10,0],[-2,80],[-1,0],[-.8,20],[-.2,80],[-0,0],[0,0],[.5,50],[1,100],[1.0000000000000002,10],[2,20],[10,100],[10.000000000000002,10],[20,20],[100,100],[1e308,100],[Number.MAX_VALUE,17.976931],[-Number.MAX_VALUE,82.023069]]){
  await field().evaluate((entry,number)=>{entry.value=String(number);entry.refreshNumericSlider();},number);
  assert.equal(await field().evaluate(entry=>entry.style.getPropertyValue('--numeric-fill')),percent+'%',String(number));
  assert.equal(Number(await field().inputValue()),number===0?0:number);
  assert.ok(await field().evaluate(entry=>getComputedStyle(entry).backgroundImage.startsWith('linear-gradient(to right,')),'the bright fill always grows from the left');
}
for(const text of ['', '1e', 'NaN', 'Infinity']){
  await field().evaluate((entry,text)=>{entry.value=text;entry.refreshNumericSlider();},text);
  assert.equal(await field().evaluate(entry=>entry.style.getPropertyValue('--numeric-fill')),'0%');
}
assert.equal(await snapshot(),before);
checks.push('signed decade fills keep a left-to-right gradient, honor exact power-of-ten boundaries, handle maximum finite values without overflow, and leave numeric data/history untouched');
await reset();await page.setViewportSize({width:390,height:640});await page.evaluate(()=>{
  setUIAppearance('scale',125);window.ladderEdgeWrites=[];
  const input=el('input',{id:'ladder-edge',type:'number',value:'.3'});input.style.cssText='position:fixed;right:8px;bottom:8px;width:150px;height:32px;z-index:99';
  document.body.append(input);installValueLadder(input,()=>ladderEdgeWrites.push(input.value));
});
const edgeField=page.locator('#ladder-edge');
for(const location of ['bottom','top']){
  if(location==='top')await edgeField.evaluate(e=>{e.style.bottom='auto';e.style.top='8px';});
  p=await point(edgeField);const inputRect=await edgeField.boundingBox();await page.mouse.move(p.x,p.y);await page.mouse.down({button:'middle'});await page.locator('#valueladder').waitFor();
  const list=await page.locator('#valueladder').boundingBox();assert.ok(list.x>=7&&list.y>=7&&list.x+list.width<=383&&list.y+list.height<=633);
  assert.equal(await page.locator('#valueladder [data-step]').count(),5);assert.equal(await page.locator('#valueladder [data-step="100"]').count(),0);
  assert.equal(await page.locator('#valueladder .active').getAttribute('data-step'),'0.1');
  await page.mouse.move(p.x+16,p.y);const compact=await page.locator('#valueladder').boundingBox();
  assert.equal(await page.locator('#valueladder [data-step]:visible').count(),0);assert.equal(await page.locator('#valueladder .ladder-value').innerText(),'0.5');assert.equal(await page.locator('#valueladder .ladder-step').innerText(),'Δ 0.1');
  if(location==='bottom')assert.ok(compact.y+compact.height<=inputRect.y);else assert.ok(compact.y>=inputRect.y+inputRect.height);
  assert.ok(compact.x>=7&&compact.y>=7&&compact.x+compact.width<=383&&compact.y+compact.height<=633);
  await page.screenshot({path:path.join(folder,`ladder-edge-${location}.png`)});await page.keyboard.press('Escape');await page.mouse.up({button:'middle'});
}
await edgeField.fill('-1234567890.12345');p=await point(edgeField);await page.mouse.move(p.x,p.y);await page.mouse.down({button:'middle'});await page.locator('#valueladder').waitFor();await page.mouse.move(p.x+16,p.y);
const longBadge=page.locator('#valueladder'),longValue=longBadge.locator('.ladder-value');assert.equal(await longValue.innerText(),await edgeField.inputValue());assert.ok(await longValue.evaluate(e=>e.scrollWidth<=e.clientWidth+1));const longRect=await longBadge.boundingBox();assert.ok(longRect.x>=7&&longRect.x+longRect.width<=383);await page.keyboard.press('Escape');await page.mouse.up({button:'middle'});assert.equal(await edgeField.inputValue(),'-1234567890.12345');
assert.deepEqual(await page.evaluate(()=>ladderEdgeWrites),[]);await edgeField.evaluate(e=>e.remove());await page.evaluate(()=>setUIAppearance('scale',100));await page.setViewportSize({width:1600,height:1100});
checks.push('390px viewport at 125% UI clamps the centered list, preserves default increment during horizontal edge gestures, and positions the value/step badge above/below the field, and cancels without submitting');
await reset();await page.screenshot({path:path.join(folder,'numeric-slider-dark.png')});await page.evaluate(()=>setUIAppearance('theme','light'));await page.screenshot({path:path.join(folder,'numeric-slider-light.png')});assert.ok(await field().evaluate(e=>getComputedStyle(e).backgroundImage.includes('linear-gradient')));assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,count:checks.length}));
}catch(error){await h.finish(error);throw error;}})().catch(error=>{console.error(error.stack);process.exitCode=1;});
