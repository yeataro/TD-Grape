/* Selection spacing changes graph coordinates only. Uses the isolated fixture API. */
const assert=require('node:assert/strict');
const {harness}=require('./test_glsl_code.cjs');
async function run(){
  const[source,stateFile,folder]=process.argv.slice(2),h=await harness(source,stateFile,folder,{touch:true}),{page,checks,errors,settle}=h;
  page.setDefaultTimeout(6000);
  const near=(a,b,message)=>assert.ok(Math.abs(a-b)<.03,`${message}: ${a} vs ${b}`);
  const json=()=>page.evaluate(()=>JSON.stringify(graph));
  const rows=()=>page.evaluate(()=>selectedCanvasNodes().map(n=>({id:n.id,...nodeLayoutBounds(n)})));
  const box=ns=>({left:Math.min(...ns.map(n=>n.x)),top:Math.min(...ns.map(n=>n.y)),right:Math.max(...ns.map(n=>n.x+n.width)),bottom:Math.max(...ns.map(n=>n.y+n.height))});
  const clean=raw=>{const g=JSON.parse(raw);for(const n of g.stages.pixel.nodes){delete n.ui.x;delete n.ui.y;}return g;};
  const handle=dir=>page.locator(`[data-selection-spread="${dir}"]`);
  const reset=async({zoom=.65,uiScale=100,group=false}={})=>{
    await page.evaluate(({zoom,uiScale,group})=>{
      nodeResizeGesture?.cancel();setUIAppearance('scale',uiScale);graph=clone(window.spreadFixture);stage='pixel';graphTrail=[];
      if(group)GraphFrames.write(current(),[{id:'testframe',name:'Group 1',color:'#7f8797',nodes:['a','b','c','d']}]);
      readonly=false;historyBusy=false;nativeMutationBusy=false;selection=new Set(['a','b','c','d']);selected='a';selectedEdge=null;past=[];future=[];dirty=false;rememberSavedGraph(graph);
      setUIExperiments({selectionToolbar:'multiple',persistentSelectionBounds:true,hideGroupedSelectionBounds:false});render();scale=zoom;pan={x:110,y:170};transform();
    },{zoom,uiScale,group});await settle();
  };
  const start=async dir=>{const r=await handle(dir).boundingBox();assert.ok(r,dir);const p={x:r.x+r.width/2,y:r.y+r.height/2};await page.mouse.move(p.x,p.y);await page.mouse.down();return p;};
  const drag=async(dir,dx,dy)=>{const p=await start(dir);await page.mouse.move(p.x+dx,p.y+dy,{steps:6});await page.mouse.up();await settle();};
  try{
    await page.setViewportSize({width:1900,height:1400});
    await page.evaluate(()=>{
      clearTimeout(autoTimer);connectionInterrupted=true;conflicted=true;
      current().nodes=[testNode('a','float',60,90),testNode('b','add',410,120),testNode('c','color',100,400),testNode('d','comment',570,470),testNode('outside','pixel_out',1250,650)];
      current().nodes[1].ui.width=250;Object.assign(current().nodes[3].ui,{width:280,height:160,noteFontScale:1.25,comment:'# Layout note'});
      current().edges=[{from:['a','out'],to:['b','a']}];window.spreadFixture=clone(graph);
    });
    for(const dir of ['nw','n','ne','e','se','s','sw','w']){
      await reset();const before=await json(),initial=await rows(),bounds=box(initial),point=await start(dir);
      const dx=dir.includes('w')?-75:dir.includes('e')?75:0,dy=dir.includes('n')?-45:dir.includes('s')?45:0;
      await page.mouse.move(point.x+dx,point.y+dy,{steps:5});await settle();
      assert.equal(await json(),before,'drag previews must not mutate graph');assert.equal(await page.evaluate(()=>past.length),0);
      assert.equal(await page.evaluate(()=>selectionSpreadActive),true);
      await page.mouse.up();await settle();const after=await json(),next=await rows(),nextBox=box(next);
      assert.equal(await page.evaluate(()=>past.length),1,dir+' must commit one step');assert.equal(await page.evaluate(()=>hasShaderChanges()),false);
      assert.deepEqual(clean(after),clean(before),'sizes, font scale, connectivity and unselected data are unchanged');
      for(const n of next){const old=initial.find(v=>v.id===n.id);near(n.width,old.width,'width');near(n.height,old.height,'height');}
      if(dx){near(nextBox[dx>0?'left':'right'],bounds[dx>0?'left':'right'],'opposite x edge anchored');near(nextBox.right-nextBox.left,bounds.right-bounds.left+Math.abs(dx)/.65,'x span follows pointer');}
      else next.forEach((n,i)=>near(n.x,initial[i].x,'inactive x unchanged'));
      if(dy){near(nextBox[dy>0?'top':'bottom'],bounds[dy>0?'top':'bottom'],'opposite y edge anchored');near(nextBox.bottom-nextBox.top,bounds.bottom-bounds.top+Math.abs(dy)/.65,'y span follows pointer');}
      else next.forEach((n,i)=>near(n.y,initial[i].y,'inactive y unchanged'));
      // Center distances all scale by the same ratio on each affected axis.
      for(const [axis,size,active]of [['x','width',dx],['y','height',dy]])if(active){
        const distance=(ns,i,j)=>ns[i][axis]+ns[i][size]/2-ns[j][axis]-ns[j][size]/2;
        const factor=distance(next,0,1)/distance(initial,0,1);
        near(distance(next,2,3),distance(initial,2,3)*factor,'relative center distribution');
      }
      await page.evaluate(()=>undo());await settle();assert.equal(await json(),before,'exact Undo '+dir);
      await page.evaluate(()=>undo(true));await settle();assert.equal(await json(),after,'exact Redo '+dir);
    }
    checks.push('all eight handles preview coordinates, anchor opposite edges, scale center distances, preserve dimensions/font/connectivity, and commit one exact Undo/Redo without shader changes');

    for(const [zoom,uiScale]of [[.35,100],[.8,125]]){
      await reset({zoom,uiScale});const old=box(await rows());await drag('e',70,0);const next=box(await rows());near(next.right-next.left,old.right-old.left+70/(zoom*uiScale/100),'zoom and UI scale conversion');
    }
    checks.push('nontrivial pan, 35%/80% graph zoom and 125% UI scale preserve pointer-to-world distances');

    await reset();const stable=await json();
    for(const reason of ['Escape','blur','pointercancel','lostpointercapture','secondPointer','resize','wheel','readonly','selection','pan']){
      const p=await start('se');await page.mouse.move(p.x+35,p.y+35,{steps:3});await settle();
      if(reason==='Escape')await page.keyboard.press('Escape');
      else await page.evaluate(reason=>{
        const h=$('[data-selection-spread="se"]');
        if(reason==='pointercancel'||reason==='lostpointercapture')h.dispatchEvent(new PointerEvent(reason,{pointerId:1,bubbles:true}));
        else if(reason==='secondPointer')document.body.dispatchEvent(new PointerEvent('pointerdown',{pointerId:99,pointerType:'touch',bubbles:true}));
        else if(reason==='readonly')readonly=true;
        else if(reason==='selection')selection=new Set(['a']);
        else if(reason==='pan')pan.x++;
        else window.dispatchEvent(new Event(reason));
      },reason);
      await page.mouse.up();await settle();assert.equal(await json(),stable,reason+' restores data');assert.equal(await page.evaluate(()=>past.length),0,reason+' adds no history');assert.equal(await page.evaluate(()=>selectionSpreadActive),false);
      const rendered=await page.evaluate(()=>current().nodes.every(n=>{const card=$('#cards').querySelector(`[data-node="${n.id}"]`);return Math.abs(parseFloat(card.style.left)-(n.ui?.x||0))<.001&&Math.abs(parseFloat(card.style.top)-(n.ui?.y||0))<.001;}));assert.equal(rendered,true,'restored visual positions '+reason);
      await reset();
    }
    checks.push('Escape, blur, lost capture, pointercancel, second touch, resize, wheel, readonly change, selection change and pan change cancel previews without history');

    for(const flag of ['readonly','historyBusy','nativeMutationBusy']){
      await reset();const before=await json();await page.evaluate(flag=>{window.__blockedFlag=flag;eval(flag+'=true');renderSelectionToolbar();},flag);await settle();
      assert.equal(await handle('e').isVisible(),false,flag+' hides handles');
      await page.evaluate(()=>dragSelectionSpread(new PointerEvent('pointerdown',{button:0,clientX:20,clientY:20}),$('[data-selection-spread="e"]')));
      assert.equal(await json(),before);assert.equal(await page.evaluate(()=>nodeResizeGesture),null);
    }
    checks.push('readonly/history/native busy states retain the outline but disable every resize entry point');

    await reset({group:true});const frameBefore=await page.locator('[data-frame="testframe"]').boundingBox();await drag('e',65,0);const frameAfter=await page.locator('[data-frame="testframe"]').boundingBox();near(frameAfter.x,frameBefore.x,'group anchor');near(frameAfter.width-frameBefore.width,65,'group recomputes automatic bounds');
    await page.evaluate(()=>setUIExperiments({hideGroupedSelectionBounds:true}));await settle();assert.equal(await handle('e').isVisible(),false);
    await page.evaluate(()=>setUIExperiments({hideGroupedSelectionBounds:false,persistentSelectionBounds:false}));await page.mouse.move(1,1);await settle();assert.equal(await handle('e').isVisible(),false);
    await page.locator('#selectiontoolbar').hover();await settle();assert.equal(await handle('e').isVisible(),true);const p=await start('e');await page.mouse.move(p.x+30,p.y,{steps:4});await page.mouse.up();await settle();assert.equal(await page.evaluate(()=>past.length),2,'hover revealed handles remain reachable');
    await page.mouse.move(1,1);await settle();assert.equal(await handle('e').isVisible(),false);
    await page.evaluate(()=>{setUIExperiments({persistentSelectionBounds:true});selection=new Set(['a']);selected='a';render();});await settle();assert.equal(await handle('e').isVisible(),false);
    checks.push('group bounds adapt automatically; group visibility, persistent/hover settings and single-selection rules also govern handles, with a reachable hover-only interaction');

    // Solver fixtures exercise contraction and degenerate arrangements without
    // depending on DOM-specific dimensions or mirroring the implementation.
    const models=await page.evaluate(()=>{
      const solve=(items,dir,dx,dy)=>items.map(n=>({...n,...selectionSpreadPositions(items,dir,dx,dy).get(n.id)}));
      const row=[{id:'a',x:0,y:0,width:200,height:100},{id:'b',x:400,y:0,width:300,height:100},{id:'c',x:850,y:0,width:150,height:100}];
      const overlap=[{id:'a',x:0,y:0,width:200,height:100},{id:'b',x:40,y:20,width:200,height:100}];
      const centers=[{id:'a',x:50,y:0,width:200,height:100},{id:'b',x:0,y:260,width:300,height:100}];
      const contained=[{id:'a',x:0,y:0,width:1000,height:100},{id:'b',x:430,y:200,width:200,height:100}];
      const grid=Array.from({length:9},(_,i)=>({id:String(i),x:(i%3)*300,y:Math.floor(i/3)*220,width:150+i*5,height:90+i*3}));
      return {row:solve(row,'e',-5000,0),overlapOriginal:overlap,overlap:solve(overlap,'se',100,80),centersOriginal:centers,centers:solve(centers,'e',200,0),containedOriginal:contained,contained:solve(contained,'e',1,0),containedZero:solve(contained,'e',0,0),grid:solve(grid,'nw',5000,5000),noMovement:solve(grid,'se',0,0),gridOriginal:grid};
    });
    const nonOverlap=ns=>{for(let i=0;i<ns.length;i++)for(let j=i+1;j<ns.length;j++){const a=ns[i],b=ns[j];assert.ok(a.x+a.width<=b.x+.001||b.x+b.width<=a.x+.001||a.y+a.height<=b.y+.001||b.y+b.height<=a.y+.001,'no new overlap');}};
    nonOverlap(models.row);nonOverlap(models.grid);near(models.row[0].x,0,'contracting east keeps left edge');assert.ok(models.row.at(-1).x<850,'contraction is effective');
    assert.ok(models.overlap[1].x>models.overlapOriginal[1].x,'existing overlap does not freeze expansion');
    assert.deepEqual(models.centers,models.centersOriginal,'identical x centers do not acquire arbitrary x offsets');assert.deepEqual(models.noMovement,models.gridOriginal,'zero movement is exact identity');
    assert.deepEqual(models.containedZero,models.containedOriginal,'an enclosing node does not create a zero-delta jump');near(models.contained[1].x,models.containedOriginal[1].x+1,'one pixel input only spreads enclosed centers by one pixel');
    checks.push('contraction keeps nodes from newly overlapping; existing overlaps can expand, coincident centers and enclosed nodes remain stable with no zero-delta or initial jumps');

    const randomized=await page.evaluate(()=>{
      let seed=8192,total=0;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
      const overlaps=(a,b)=>a.x+a.width>b.x+1e-6&&b.x+b.width>a.x+1e-6&&a.y+a.height>b.y+1e-6&&b.y+b.height>a.y+1e-6;
      for(let run=0;run<400;run++){
        const items=Array.from({length:2+Math.floor(random()*10)},(_,id)=>({id,x:random()*800,y:random()*600,width:120+random()*400,height:60+random()*220}));
        for(const direction of ['nw','n','ne','e','se','s','sw','w']){
          const positions=selectionSpreadPositions(items,direction,(random()-.5)*1500,(random()-.5)*1000),next=items.map(n=>({...n,...positions.get(n.id)}));
          for(let i=0;i<next.length;i++){
            if(!Number.isFinite(next[i].x)||!Number.isFinite(next[i].y))throw Error('nonfinite coordinate');
            for(let j=i+1;j<next.length;j++)if(!overlaps(items[i],items[j])&&overlaps(next[i],next[j]))throw Error('new collision at '+run+'/'+direction);
          }
          total++;
        }
      }
      return total;
    });assert.equal(randomized,3200);
    checks.push('3,200 seeded heterogeneous layouts across all handles and mixed expansion/contraction remain finite and introduce no new overlaps');

    await reset();const beforeTouch=await json(),touchPoint=await handle('se').boundingBox(),cdp=await page.context().newCDPSession(page);
    const t={x:touchPoint.x+touchPoint.width/2,y:touchPoint.y+touchPoint.height/2};
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[t]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:t.x+60,y:t.y+40}]});await settle();assert.equal(await json(),beforeTouch,'touch preview remains uncommitted');
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await settle();assert.notEqual(await json(),beforeTouch);assert.equal(await page.evaluate(()=>past.length),1);assert.equal(await page.evaluate(()=>hasShaderChanges()),false);
    checks.push('real touch pointer capture performs one layout-only spacing edit instead of panning, pinch navigation or changing node sizes');
    await page.screenshot({path:folder+'/selection-spacing.png'});assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,count:checks.length}));
  }catch(e){await h.finish(e);throw e;}
}
run().catch(e=>{console.error(e.stack);process.exitCode=1;});
