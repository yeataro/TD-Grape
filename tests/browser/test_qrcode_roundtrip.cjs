/* Independent offline QR encode/decode checks. No real session URLs or tokens. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const [sourceFile,decoderFile,folder]=process.argv.slice(2);
if(!sourceFile||!decoderFile||!folder)throw Error('Usage: test_qrcode_roundtrip.cjs QRCODE_JS JSQR_DECODER REPORT_DIR');
const decode=require(path.resolve(decoderFile));
fs.mkdirSync(folder,{recursive:true});
const syntheticToken='synthetic-test-token-'+('0123456789abcdef'.repeat(4));
const cases=[
  {name:'local-address-and-fragment',url:'http://192.0.2.44:65195/editor/example-node#token='+syntheticToken},
  {name:'long-percent-encoded-path',url:'http://192.0.2.44:65195/editor/'+encodeURIComponent('/project1/Example Component With Spaces/'+('nested_component/'.repeat(7)))+'#token='+syntheticToken},
  {name:'ipv6-and-query',url:'http://[2001:db8::44]:65195/editor/example-node?label='+encodeURIComponent('QR fixture / path ? & #')+'&mode=edit#token='+syntheticToken+'-extra-'+('abcdef'.repeat(30))},
  {name:'long-normalized-unicode-path',url:new URL('https://example.invalid/editor/'+encodeURIComponent('/project1/測試輸入/'+('nested_component_'.repeat(24)))+'#token='+syntheticToken).href}
];
const raster=(matrix,rotate=false)=>{
  const quiet=4,pixelScale=6,n=matrix.length,width=(n+quiet*2)*pixelScale,pixels=new Uint8ClampedArray(width*width*4).fill(255);
  for(let row=0;row<n;row++)for(let col=0;col<n;col++)if(matrix[row][col]){
    const x=(quiet+(rotate?n-1-row:col))*pixelScale,y=(quiet+(rotate?col:row))*pixelScale;
    for(let dy=0;dy<pixelScale;dy++)for(let dx=0;dx<pixelScale;dx++){const at=((y+dy)*width+x+dx)*4;pixels[at]=pixels[at+1]=pixels[at+2]=0;}
  }
  return{pixels,width};
};
(async()=>{
  let browser;const checks=[],errors=[],requests=[],details=[];
  try{
    browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE});
    const page=await browser.newPage();await page.context().setOffline(true);page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
    await page.goto('about:blank');await page.addScriptTag({path:path.resolve(sourceFile)});
    assert.equal(await page.evaluate(()=>typeof qrcode),'function');
    for(const item of cases){
      assert.match(item.url,/^[\x20-\x7e]+$/);
      const matrix=await page.evaluate(url=>{const code=qrcode(0,'M');code.addData(url,'Byte');code.make();const n=code.getModuleCount();return Array.from({length:n},(_,row)=>Array.from({length:n},(_,col)=>code.isDark(row,col)));},item.url);
      const version=(matrix.length-17)/4;assert.ok(Number.isInteger(version)&&version>=1&&version<=40);
      for(const rotated of [false,true]){
        const {pixels,width}=raster(matrix,rotated),result=decode(pixels,width,width,{inversionAttempts:'dontInvert'});
        assert.ok(result,item.name+' not decoded');assert.equal(result.data,item.url,item.name);assert.equal(result.version,version);
      }
      details.push({name:item.name,characters:item.url.length,version,modules:matrix.length});checks.push(item.name+': exact payload round-trip at normal and rotated orientations');
    }
    assert.ok(details.some(d=>d.characters>200)&&details.some(d=>d.characters>500));assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
    checks.push('classic browser global works fully offline without requests and automatically sizes 200+ and 500+ character URLs');
    const result={passed:true,count:checks.length,checks,details,errors,requests,sourceSha256:crypto.createHash('sha256').update(fs.readFileSync(sourceFile)).digest('hex')};
    fs.writeFileSync(path.join(folder,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
  }catch(error){fs.writeFileSync(path.join(folder,'results.json'),JSON.stringify({passed:false,checks,details,errors,requests,error:error.stack},null,2));throw error;}
  finally{await browser?.close();}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
