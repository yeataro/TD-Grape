const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {harness}=require('./test_glsl_code.cjs');
(async()=>{
 const[source,state,folder]=process.argv.slice(2),h=await harness(source,state,folder,{skipPreview:true}),{page,checks,errors,settle}=h;
 try{
  const measurements=[];
  for(const size of ['standard','comfortable'])for(const scale of [100,125,175]){
   await page.evaluate(({size,scale})=>{setUIAppearance('size',size);setUIAppearance('scale',scale);}, {size,scale});await settle();
   const result=await page.evaluate(()=>{
    const footer=$('footer'),rect=footer.getBoundingClientRect(),style=getComputedStyle(footer),factor=uiScaleFactor();
    const center=(rect.top+rect.bottom)/2+(parseFloat(style.borderTopWidth)-parseFloat(style.borderBottomWidth))*factor/2;
    return {height:rect.height/factor,buttons:[...footer.querySelectorAll('#editormenu,.footer-preferences button')].filter(b=>b.getClientRects().length).map(b=>{const r=b.getBoundingClientRect();return{id:b.id,width:r.width/factor,height:r.height/factor,offset:((r.top+r.bottom)/2-center)/factor,bottom:(rect.bottom-r.bottom)/factor};})};
   });measurements.push({size,scale,...result});
  }
  fs.writeFileSync(path.join(folder,'measurements.json'),JSON.stringify(measurements,null,2));
  for(const measurement of measurements)for(const button of measurement.buttons){assert(Math.abs(button.offset)<=.6,JSON.stringify({size:measurement.size,scale:measurement.scale,button}));assert(button.bottom>=2);}
  checks.push('menu and all footer controls share the vertical center in Standard/Comfortable at 100/125/175%');
  for(const measurement of measurements){const menu=measurement.buttons.find(b=>b.id==='editormenu'),peer=measurement.buttons.find(b=>b.id==='uisize');assert.equal(menu.height,peer.height);assert(menu.width<peer.width);assert(menu.width<menu.height);}
  checks.push('left menu keeps the footer icon height while using a narrower rectangular hit area');
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{setUIAppearance('scale',100);setUIAppearance('size','standard');});await settle();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false);
  await page.locator('#editormenu').click();assert.equal(await page.locator('#editoractionsmenu').isVisible(),true);await page.keyboard.press('Escape');
  checks.push('narrow layout remains within viewport and menu opens/closes');
  await page.screenshot({path:path.join(folder,'footer-standard.png')});assert.deepEqual(errors,[]);await h.finish();console.log(JSON.stringify({passed:true,checks}));
 }catch(error){await h.finish(error);throw error;}
})().catch(error=>{console.error(error);process.exitCode=1;});
