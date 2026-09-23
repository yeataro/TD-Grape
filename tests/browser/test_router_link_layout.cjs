/* Router layout changes must preserve graph edges, native controls and natural curves. */
const assert=require('node:assert/strict'),path=require('node:path');
const {harness}=require('./test_glsl_code.cjs');
(async()=>{
  const[source,state,folder]=process.argv.slice(2),h=await harness(source,state,folder,{skipPreview:true}),{page,checks,errors}=h;
  try{
    await page.evaluate(()=>{
      nativeSourcePolling=uniformPolling=customPolling=true;uniformLive.disconnect();uniformLive.connect=()=>{};
      clearTimeout(autoTimer);scheduleGraphApply=()=>{};readonly=dirty=connectionInterrupted=false;
      graph.functions=[];graph.declarations=[];stage='pixel';graphTrail=[];scale=1;pan={x:20,y:80};
      window.routerFixture=(count,links=[Math.floor(count/2)])=>{
        graph.stages.pixel={nodes:[testNode('pixel','pixel_out',850,250),testNode('src','vector',10,200,{type:'vec3'}),testNode('router','router',280,240,{type:'vec3'}),...Array.from({length:count},(_,i)=>testNode('dst'+i,'normalize',570,200+(i-(count-1)/2)*65,{type:'vec3'}))],edges:[{from:['src','out'],to:['router','value']},...Array.from({length:count},(_,i)=>({from:['router','out'],to:['dst'+i,'value'],...(links.includes(i)?{ui:{style:'link'}}:{})}))]};
        past=[];future=[];selection=new Set(['router']);selected='router';selectedEdge=null;showLinkLines=true;EDITOR_DEV_SETTINGS.linkArrowDisplay='always';render();
      };
      window.routerMeasure=()=>{
        const n=current().nodes.find(n=>n.id==='router'),card=$('[data-node="router"]'),layout=routerLayout(n),arrow=card.querySelector('[data-link-kind="outputs"]'),ar=arrow?.getBoundingClientRect(),cr=card.getBoundingClientRect();
        const points=current().edges.filter(e=>e.from[0]===n.id).map(e=>({id:e.to[0],link:e.ui?.style==='link',...point(n,'out','outputs',e)}));
        return {layers:layout.layers,dots:card.querySelectorAll('.router-dot').length,hollow:card.querySelectorAll('.router-hollow').length,solid:card.querySelectorAll('.router-solid').length,points,arrowY:ar?graphPoint(ar.left+ar.width/2,ar.top+ar.height/2).y:null,top:graphPoint(cr.left,cr.top).y,arrowSize:arrow?[arrow.offsetWidth,arrow.offsetHeight]:null};
      };
    });
    for(const count of [1,2,3,4,8,16]){
      await page.evaluate(count=>routerFixture(count),count);
      const m=await page.evaluate(()=>routerMeasure()),layers=Math.min(4,count);
      assert.equal(m.layers,layers);assert.equal(m.dots,layers*(layers+1)/2);assert.equal(m.hollow,1);assert.equal(m.solid,m.dots-1);assert.deepEqual(m.arrowSize,[20,22]);
      assert.equal(m.arrowY,m.top+8+(layers===2?19.5:(11+(layers-1)*14)/2));
      const wires=m.points.filter(p=>!p.link),links=m.points.filter(p=>p.link);
      assert(links.every(p=>p.y===m.arrowY));
      assert(wires.every(p=>p.y===m.top+13.5||(layers>2&&p.y===m.top+13.5+(layers-1)*14)));
      assert(wires.every((p,i)=>!i||p.y>=wires[i-1].y));
      const geometry=await page.evaluate(()=>{
        const button=$('[data-node="router"] [data-link-kind="outputs"]').getBoundingClientRect(),a=graphPoint(button.left,button.top),b=graphPoint(button.right,button.bottom);
        const paths=[...$('#wires').querySelectorAll('path[data-from="router:out"]:not(.wire-link)')];
        return paths.map(p=>({curves:(p.getAttribute('d').match(/C/g)||[]).length,hits:Array.from({length:201},(_,i)=>p.getPointAtLength(p.getTotalLength()*i/200)).filter(q=>q.x>a.x-1.25&&q.x<b.x+1.25&&q.y>a.y-1.25&&q.y<b.y+1.25).length}));
      });
      assert(geometry.every(p=>p.curves===1&&p.hits===0),JSON.stringify({count,geometry}));
    }
    checks.push('1/2/3/4/8/16 outputs retain the tier cap, first-tier hollow dots, native 20×22 arrows and single natural curves clear of the Link button');
    await page.evaluate(()=>routerFixture(8,[1,3,5]));
    const before=await page.evaluate(()=>JSON.stringify(graph));
    for(const mode of ['always','hover','hidden']){
      await page.evaluate(mode=>{EDITOR_DEV_SETTINGS.linkArrowDisplay=mode;showLinkLines=true;wires();},mode);
      assert.equal(await page.locator('[data-node="router"] [data-link-kind="outputs"]').count(),mode==='hidden'?0:1);
      const ok=await page.evaluate(mode=>{
        const n=current().nodes.find(n=>n.id==='router');
        return current().edges.filter(e=>e.from[0]==='router'&&e.ui?.style==='link').every(e=>{
          const endpoint=mode==='always'?linkPortPoint(n,'out','outputs',e):point(n,'out','outputs',e);
          const p=[...$('#wires').querySelectorAll('path.wire-link')].find(p=>p.dataset.to===e.to.join(':'));
          return p?.getAttribute('d').startsWith(`M ${endpoint.x} ${endpoint.y} L `);
        });
      },mode);assert(ok,mode);
    }
    await page.evaluate(()=>{showLinkLines=false;wires();});assert.equal(await page.locator('#wires .wire-link').count(),0);
    assert.equal(await page.locator('[data-node="router"] [data-link-kind="outputs"]').count(),1);
    assert.equal(await page.evaluate(()=>JSON.stringify(graph)),before);
    await page.locator('[data-node="router"] [data-link-kind="outputs"]').click();
    assert.deepEqual(await page.evaluate(()=>[...selection]),['dst1','dst3','dst5']);
    checks.push('Multiple Links share navigation; always/hover/hidden endpoints and hidden-line navigation preserve graph data');
    await page.evaluate(()=>{linksToWires({node:'router',kind:'outputs',ports:['out']});});
    assert.equal(await page.locator('[data-node="router"] [data-link-kind="outputs"]').count(),0);
    assert.equal(new Set((await page.evaluate(()=>routerMeasure())).points.map(p=>p.y)).size,4);
    await page.evaluate(()=>undo());assert.equal(await page.evaluate(()=>JSON.stringify(graph)),before);
    await page.evaluate(()=>undo(true));assert.equal(await page.locator('[data-node="router"] [data-link-kind="outputs"]').count(),0);
    checks.push('Convert all Links back to Wire restores all four output positions; Undo and Redo preserve connections');
    await page.evaluate(()=>{routerFixture(3);change(()=>{current().nodes.find(n=>n.id==='dst0').ui.y=600;},{layout:true});});
    const moved=await page.evaluate(()=>routerMeasure());assert(moved.points.find(p=>p.id==='dst0').y>moved.points.find(p=>p.id==='dst2').y);
    await page.evaluate(()=>undo());const restored=await page.evaluate(()=>routerMeasure());assert(restored.points.find(p=>p.id==='dst0').y<restored.points.find(p=>p.id==='dst2').y);
    checks.push('Moving targets reorders only the Wire bundle by destination Y and supports Undo');
    for(const theme of ['dark','light']){
      await page.evaluate(theme=>{document.documentElement.dataset.uiTheme=theme;routerFixture(4);},theme);
      const colors=await page.evaluate(()=>{
        const handle=$('[data-node="router"] .router-drag-handle'),reference=el('div',{class:'node-title','data-category':'editor'});document.body.append(reference);
        const a=getComputedStyle(handle),b=getComputedStyle(reference),result=[a.backgroundColor,b.backgroundColor,a.color,b.color];reference.remove();return result;
      });assert.equal(colors[0],colors[1]);assert.equal(colors[2],colors[3]);
      await page.screenshot({path:path.join(folder,'router-link-'+theme+'.png')});
    }
    checks.push('Router title uses the same Editor family background/text in dark and light themes');
    assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,checks}));
  }catch(e){await h.finish(e);throw e;}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
