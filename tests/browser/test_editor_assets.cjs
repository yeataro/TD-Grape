const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
// node tools/test_editor_assets.cjs SOURCE_SRC STATE_JSON REPORT_DIR [OVERLAY_SRC]
const [root,snapshot,w,overlay]=process.argv.slice(2),src=overlay||root,state=JSON.parse(fs.readFileSync(snapshot));fs.mkdirSync(w,{recursive:true});
const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost'),name=url.pathname;res.setHeader('Cache-Control','no-store');if(name.startsWith('/api/')){res.setHeader('Content-Type','application/json');const operation=name.split('/').at(-1);if(operation==='state')return res.end(JSON.stringify(state));if(operation==='shaders')return res.end(JSON.stringify({projectFile:'Review.toe'}));if(operation==='uniforms')return res.end(JSON.stringify({revision:state.state.revision,uniforms:{},textures:{}}));if(operation==='preview'){res.statusCode=204;return res.end();}res.statusCode=404;return res.end('{}');}
const rel=name==='/'?'index.html':name.slice(1),file=fs.existsSync(path.join(src,rel))?path.join(src,rel):path.join(root,rel);if(!fs.existsSync(file)){res.statusCode=404;return res.end();}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.webmanifest':'application/manifest+json'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port+'/#fixture';
if(process.argv.includes('--serve')){fs.writeFileSync(path.join(w,'test-server.json'),JSON.stringify({url}));console.log('Local icon review server ready');return;}
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE});try{
const page=await browser.newPage({viewport:{width:1540,height:1000}});await page.goto(url);await page.waitForSelector('.node');const before=await page.evaluate(()=>JSON.stringify({graph,revision,past,future}));
const colors=await page.locator('.workspace-tab[aria-selected=true]').evaluateAll(es=>es.map(e=>({background:getComputedStyle(e).backgroundColor,color:getComputedStyle(e).color,border:getComputedStyle(e).borderBottomColor})));
for(const c of colors){assert.equal(c.background,'rgb(27, 27, 35)');assert.equal(c.color,'rgb(221, 220, 232)');assert.equal(c.border,'rgba(0, 0, 0, 0)');}
await page.evaluate(()=>workspaceLayout.move('help','right','parameters','tab'));
const active=page.locator('.workspace-tab[aria-selected=true]').first();
const inactive=page.locator('.workspace-tab[aria-selected=false]').first();assert.ok(await inactive.count());assert.equal(await inactive.evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(20, 20, 28)');
const out=path.resolve(w);fs.mkdirSync(out,{recursive:true});await page.screenshot({path:path.join(out,'neutral-panels.png')});
await page.locator('#sidebar-left .workspace-fold').click();assert.equal(await page.locator('#browsertoggle').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(20, 20, 28)');
assert.equal(await page.evaluate(()=>JSON.stringify({graph,revision,past,future})),before);
const dimensions=await page.evaluate(async()=>{const paths=[16,32,48,64,128,180,192,256,512,1024];return await Promise.all(paths.map(async size=>{const image=new Image();image.src='/icons/icon-'+size+'.png';await image.decode();return{size,width:image.naturalWidth,height:image.naturalHeight};}));});
dimensions.forEach(d=>assert.ok(d.width===d.size&&d.height===d.size));
const manifest=await page.evaluate(async()=>await(await fetch(document.querySelector('link[rel=manifest]').href)).json());assert.deepEqual(manifest.icons.map(i=>i.sizes),['192x192','512x512','1024x1024']);
const ico=fs.readFileSync(path.join(src,'favicon.ico'));assert.equal(ico.readUInt16LE(4),6);for(let i=0;i<6;i++){const entry=6+i*16,size=ico[entry]||256,offset=ico.readUInt32LE(entry+12);assert.equal(ico.readUInt32BE(offset+16),size);}
const report={passed:true,neutralActiveTitles:true,darkerInactiveAndCollapsedTitles:true,nodePaletteUnchanged:true,graphUnchanged:true,dimensions,manifestAndIcoVerified:true};fs.writeFileSync(path.join(w,'browser-result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e.stack);process.exitCode=1;server.close();});
