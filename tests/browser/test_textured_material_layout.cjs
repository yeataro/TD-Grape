const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {harness}=require('./test_glsl_code.cjs');
(async()=>{
 const [source,fixture,folder]=process.argv.slice(2),h=await harness(source,fixture,folder,{skipPreview:true});
 const {page,settle,checks,errors}=h;
 const presets=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../src/library/material_presets.json'),'utf8'));
 try {
  await page.selectOption('#language','en');
  for(const key of ['phong_textured','pbr_textured'])for(const st of ['vertex','pixel']){
   await page.evaluate(({g,st})=>{clearTimeout(autoTimer);scheduleGraphApply=()=>{};connectionInterrupted=true;readonly=false;historyBusy=false;nativeMutationBusy=false;graphTrail=[];editorTarget='mat';graph=clone(g);stage=st;selected=null;selection.clear();scale=1;pan={x:0,y:0};render();transform();},{g:presets[key],st});await settle();
   const geometry=await page.evaluate(()=>{
    const nodes=[...document.querySelectorAll('#cards .node')].map(card=>({id:card.dataset.node,x:parseFloat(card.style.left),y:parseFloat(card.style.top),w:card.offsetWidth,h:card.offsetHeight}));
    const collisions=[];
    for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
     const a=nodes[i],b=nodes[j];
     if(Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)>1&&Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y)>1)collisions.push([a.id,b.id]);
    }
    return {nodes,collisions};
   });
   fs.writeFileSync(path.join(folder,key+'-'+st+'-geometry.json'),JSON.stringify(geometry,null,2));
   assert.deepEqual(geometry.collisions,[],key+' '+st+' overlapping cards');
   await page.evaluate(nodes=>{
    const l=Math.min(...nodes.map(n=>n.x))-50,t=Math.min(...nodes.map(n=>n.y))-100,r=Math.max(...nodes.map(n=>n.x+n.w))+50,b=Math.max(...nodes.map(n=>n.y+n.h))+50;
    const canvas=document.querySelector('#canvas');scale=Math.min((canvas.clientWidth-40)/(r-l),(canvas.clientHeight-120)/(b-t),1);pan={x:20-l*scale,y:90-t*scale};transform();
   },geometry.nodes);await settle();
   await page.screenshot({path:path.join(folder,key+'-'+st+'.png')});
   if(st==='pixel'){
    await page.evaluate(()=>{scale=.7;pan={x:45,y:0};transform();});await settle();
    await page.screenshot({path:path.join(folder,key+'-texture-detail.png')});
    await page.evaluate(()=>{scale=.7;pan={x:-2700,y:-200};transform();});await settle();
    await page.screenshot({path:path.join(folder,key+'-material-detail.png')});
   }
   checks.push(key+' '+st+': no overlapping cards; screenshot captured');
  }
  assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,checks}));
 }catch(error){await h.finish(error);throw error;}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
