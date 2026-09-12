// Render each size from the canonical SVG, never from a smaller PNG.
// node tools/generate_editor_icons.cjs [SOURCE_SVG] [OUTPUT_SRC]
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'../..'),source=process.argv[2]||path.join(root,'src/assets/brand/app-icon.svg'),out=process.argv[3]||path.join(root,'src/editor');
const sizes=[16,32,48,64,128,180,192,256,512,1024],icoSizes=[16,32,48,64,128,256];
(async()=>{
  fs.mkdirSync(path.join(out,'icons'),{recursive:true});
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE});
  try {
    const svg=fs.readFileSync(source,'utf8');
    for(const size of sizes){
      const page=await browser.newPage({viewport:{width:size,height:size},deviceScaleFactor:1});
      await page.setContent('<style>html,body{margin:0;background:transparent}svg{display:block;width:100vw;height:100vh}</style>'+svg);
      await page.screenshot({path:path.join(out,'icons',`icon-${size}.png`),omitBackground:true});await page.close();
    }
  } finally {await browser.close();}
  const entries=[],images=[];let offset=6+16*icoSizes.length;
  for(const size of icoSizes){const bytes=fs.readFileSync(path.join(out,'icons',`icon-${size}.png`)),entry=Buffer.alloc(16);entry[0]=entry[1]=size===256?0:size;entry.writeUInt16LE(1,4);entry.writeUInt16LE(32,6);entry.writeUInt32LE(bytes.length,8);entry.writeUInt32LE(offset,12);entries.push(entry);images.push(bytes);offset+=bytes.length;}
  const header=Buffer.alloc(6);header.writeUInt16LE(1,2);header.writeUInt16LE(icoSizes.length,4);
  fs.writeFileSync(path.join(out,'favicon.ico'),Buffer.concat([header,...entries,...images]));
  const manifest={id:'/',name:'TD-Grape Shader Editor',short_name:'TD-Grape',start_url:'/',scope:'/',display:'standalone',background_color:'#19181f',theme_color:'#19181f',icons:[192,512,1024].map(size=>({src:`/icons/icon-${size}.png`,sizes:`${size}x${size}`,type:'image/png',purpose:'any'}))};
  fs.writeFileSync(path.join(out,'manifest.webmanifest'),JSON.stringify(manifest,null,2)+'\n');
  const bundle={};for(const file of [...sizes.map(size=>`icons/icon-${size}.png`),'favicon.ico','manifest.webmanifest'])bundle['/'+file]={type:file.endsWith('.png')?'image/png':file.endsWith('.ico')?'image/x-icon':'application/manifest+json',base64:fs.readFileSync(path.join(out,file)).toString('base64')};
  fs.writeFileSync(path.join(out,'web_icons.json'),JSON.stringify(bundle)+'\n');console.log(JSON.stringify({renderedFrom:source,sizes,icoSizes}));
})().catch(e=>{console.error(e);process.exitCode=1;});
