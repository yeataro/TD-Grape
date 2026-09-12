/* Isolated browser regression; no TouchDesigner connection.
 * node test_wire_geometry.cjs SOURCE_DIR STATE_JSON REPORT_DIR [chromium|webkit] [OVERLAY_DIR]
 * Install Playwright browsers first; CHROME_EXECUTABLE optionally selects desktop Chrome.
 */
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const playwright=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const [source,stateFile,folder,engine='chromium',overlay]=process.argv.slice(2);
const snapshot=JSON.parse(fs.readFileSync(stateFile,'utf8').replace(/^\uFEFF/,''));
const checks=[],errors=[],measurements=[];let writes=0,browser;
fs.mkdirSync(folder,{recursive:true});
const server=http.createServer(async(req,res)=>{
  const name=new URL(req.url,'http://localhost').pathname;res.setHeader('Cache-Control','no-store');
  if(name.startsWith('/api/')){
    let raw='';for await(const chunk of req)raw+=chunk;
    const op=name.split('/').at(-1);res.setHeader('Content-Type','application/json');
    if(op==='state')return res.end(JSON.stringify(snapshot));
    if(op==='uniforms')return res.end(JSON.stringify({revision:snapshot.state.revision,uniforms:{},textures:{}}));
    if(op==='apply'){writes++;snapshot.state.graph=JSON.parse(raw).graph;snapshot.state.revision++;return res.end(JSON.stringify(snapshot));}
    if(op==='preview'){res.statusCode=204;return res.end();}
    res.statusCode=404;return res.end('{}');
  }
  const file=name==='/'?'index.html':name.slice(1);
  if(!/^[a-z0-9_.-]+$/i.test(file)){res.statusCode=404;return res.end();}
  const target=overlay&&fs.existsSync(path.join(overlay,file))?path.join(overlay,file):path.join(source,file);
  if(!fs.existsSync(target)){res.statusCode=404;return res.end();}
  res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.svg':'image/svg+xml'})[path.extname(file)]||'text/plain');
  res.end(fs.readFileSync(target));
});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  browser=await playwright[engine].launch({headless:true,...(engine==='chromium'&&process.env.CHROME_EXECUTABLE?{executablePath:process.env.CHROME_EXECUTABLE}:{})});
  const context=await browser.newContext({viewport:{width:1600,height:1000},deviceScaleFactor:2,hasTouch:true});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForSelector('.node');await page.evaluate(()=>document.fonts.ready);
  const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  await page.evaluate(()=>{
    clearTimeout(autoTimer);dirty=false;past=[];future=[];graphTrail=[];selection.clear();selected=selectedEdge=null;
    const node=(id,key,x,y,params={})=>{const d=catalog.find(d=>d.key===key);return{id,definitionUuid:d.definitionUuid,revisionHash:d.revisionHash,params:{...d.defaults,...params},ui:{x,y,label:'中文標籤',comment:'Two lines\nPlain comment'}};};
    graph.functions=[];graph.declarations=[];graph.stages.pixel={nodes:[node('source','float',-24,36),node('add','add',288,48),node('sum','add',600,120)],edges:[{from:['source','out'],to:['add','a']},{from:['add','out'],to:['sum','b']}]};stage='pixel';
    scale=.68;pan={x:64.5,y:48.25};render();
  });
  const graphBefore=await page.evaluate(()=>JSON.stringify({graph,past,future,dirty}));
  // Compare actual SVG marker bounds at each endpoint to the actual socket bounds.
  // Never use getScreenCTM as the test oracle: that is the browser API under test.
  const aligned=async(label,preview=false)=>{
    await settle();
    const metrics=await page.evaluate(preview=>{
      const center=e=>{const r=e.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2};};
      const socket=(ref,kind)=>{const i=ref.lastIndexOf(':');return document.querySelector(`[data-node="${CSS.escape(ref.slice(0,i))}"] [data-kind="${kind}"][data-port="${CSS.escape(ref.slice(i+1))}"]`);};
      const paintedPoint=(p,at)=>{
        const q=p.getPointAtLength(at),marker=document.createElementNS(p.namespaceURI,'circle');
        marker.setAttribute('cx',q.x);marker.setAttribute('cy',q.y);marker.setAttribute('r','1');p.parentNode.append(marker);
        const result=center(marker);marker.remove();return result;
      };
      const paths=[...document.querySelectorAll(preview?'#wires .wire-preview':'#wires path[data-from]')];
      return paths.map(p=>{
        const a=preview?document.querySelector('[data-node="source"] [data-kind="outputs"]'):socket(p.dataset.from,'outputs');
        const b=preview?document.querySelector('.wire-target'):socket(p.dataset.to,'inputs');
        const start=paintedPoint(p,0),end=paintedPoint(p,p.getTotalLength()),from=center(a),to=center(b);
        return{from:p.dataset.from||'preview',start,end,socketStart:from,socketEnd:to,error:Math.max(Math.hypot(start.x-from.x,start.y-from.y),Math.hypot(end.x-to.x,end.y-to.y))};
      });
    },preview);
    assert.equal(metrics.length,preview?1:2,label+' path count');
    const maxError=Math.max(...metrics.map(m=>m.error));measurements.push({label,maxError});
    assert.ok(maxError<.75,JSON.stringify({label,maxError,metrics}));
  };
  await aligned('initial 68% render');
  for(const zoom of [.25,.333,.68,1,1.25,1.7]){
    await page.evaluate(z=>{scale=z;pan={x:-37.25,y:83.75};transform();wires();},zoom);await aligned('redraw at '+zoom);
    // Navigation changes transforms without recalculating every edge.
    const data=await page.locator('#wires path[data-from]').evaluateAll(es=>es.map(e=>e.getAttribute('d')));
    await page.evaluate(()=>{pan={x:pan.x+137.5,y:pan.y-62.25};transform();});await aligned('pan at '+zoom);
    assert.deepEqual(await page.locator('#wires path[data-from]').evaluateAll(es=>es.map(e=>e.getAttribute('d'))),data);
  }
  checks.push('Endpoints align across graph zoom and fractional/negative pan; pan does not rebuild paths');
  for(const viewport of [{width:744,height:1133},{width:1133,height:744},{width:1600,height:1000}]){
    await page.setViewportSize(viewport);await aligned('viewport '+viewport.width);
    for(const id of ['#togglelibrary','#toggledetails']){
      await page.locator(id).click();await aligned('collapse '+id+' at '+viewport.width);
      await page.locator(id).click();await aligned('restore '+id+' at '+viewport.width);
    }
  }
  checks.push('Portrait/landscape tablet and desktop layout changes preserve endpoints');
  await page.evaluate(()=>{document.body.style.zoom='1.25';wires();});await aligned('CSS zoom 125%');
  await page.evaluate(()=>{document.body.style.zoom='';scale=.68;pan={x:64,y:48};transform();wires();});
  assert.equal(await page.evaluate(()=>JSON.stringify({graph,past,future,dirty})),graphBefore);assert.equal(writes,0);
  checks.push('Display-only navigation and browser layout zoom do not edit the graph or history');
  // Reproduce older WebKit omitting the CSS ancestor scale, even on fixed releases.
  await page.evaluate(()=>{const svg=document.querySelector('#wires'),original=svg.getScreenCTM.bind(svg);svg.getScreenCTM=()=>{const m=original();m.a=m.d=1;return m;};wires();});await aligned('legacy SVG CTM regression');
  checks.push('Rendering does not depend on the legacy WebKit SVG screen matrix');
  const at=async selector=>{const r=await page.locator(selector).boundingBox();return{x:r.x+r.width/2,y:r.y+r.height/2};};
  const sourcePort='[data-node="source"] [data-kind="outputs"]',targetPort='[data-node="add"] [data-kind="inputs"][data-port="b"]';
  const a=await at(sourcePort),b=await at(targetPort);
  await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:8});
  await page.locator('.wire-preview.ready').waitFor();await aligned('drag preview with legacy SVG CTM',true);await page.keyboard.press('Escape');await page.mouse.up();
  await aligned('escape restores existing wires');
  checks.push('Desktop connection preview aligns and Escape preserves existing edges');
  await page.evaluate(()=>{delete document.querySelector('#wires').getScreenCTM;});
  const title='[data-node="add"] .node-title',p=await at(title),before=await page.evaluate(()=>JSON.stringify(current().nodes.find(n=>n.id==='add').ui));
  await page.mouse.move(p.x,p.y);await page.mouse.down();await page.mouse.move(p.x+48,p.y+36,{steps:8});await aligned('desktop node drag');await page.mouse.up();
  assert.notEqual(await page.evaluate(()=>JSON.stringify(current().nodes.find(n=>n.id==='add').ui)),before);
  await page.keyboard.press('Control+z');await aligned('desktop undo');assert.equal(await page.evaluate(()=>JSON.stringify(current().nodes.find(n=>n.id==='add').ui)),before);
  checks.push('Desktop node drag and Undo retain attached endpoints');
  if(engine==='chromium'){
    const cdp=await context.newCDPSession(page),canvas=await page.locator('#canvas').boundingBox(),x=canvas.x+canvas.width/2,y=canvas.y+canvas.height-150;
    const touch=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points.map(([id,x,y])=>({id,x,y}))});
    await touch('touchStart',[[1,x-40,y],[2,x+40,y]]);await touch('touchMove',[[1,x-70,y+15],[2,x+70,y+15]]);await aligned('two finger pinch in progress');await touch('touchEnd',[]);await aligned('two finger release');
    await page.evaluate(()=>wires());await aligned('redraw after touch pinch');await cdp.detach();
    checks.push('Real Chromium multi-touch events keep wires attached during/after pinch (not physical iPad)');
  }
  await page.setViewportSize({width:1133,height:744});await settle();await page.screenshot({path:path.join(folder,'tablet-landscape.png')});
  assert.deepEqual(errors,[]);
  const result={passed:true,engine,checks,measurements,maxError:Math.max(...measurements.map(m=>m.maxError)),scope:'Windows Playwright engine; tablet viewport/touch emulation, not physical iPad Safari.'};
  fs.writeFileSync(path.join(folder,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({passed:true,engine,count:checks.length,maxError:result.maxError}));
})().catch(e=>{fs.writeFileSync(path.join(folder,'results.json'),JSON.stringify({passed:false,engine,checks,measurements,errors,error:e.stack},null,2));console.error(e.stack);process.exitCode=1;}).finally(async()=>{await browser?.close();server.close();});
