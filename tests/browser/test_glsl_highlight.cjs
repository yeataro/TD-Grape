/* Browser check of the display-only GLSL view.
 * node test_glsl_highlight.cjs SESSION_JSON REPORT_DIR [OVERLAY_DIR]
 * Only GET and the read-only POST /validate route may reach TD.
 */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const [sessionFile,folder,overlay]=process.argv.slice(2),session=JSON.parse(fs.readFileSync(sessionFile,'utf8'));
fs.mkdirSync(folder,{recursive:true});
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_EXECUTABLE});const checks=[],errors=[],writes=[],external=[];
try{
const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));
await page.route('**/*',route=>{const req=route.request(),url=new URL(req.url()),name=req.resourceType()==='document'?'index.html':path.basename(url.pathname);
 if(url.origin!==new URL(session.url).origin){external.push(url.origin);return route.abort();}
 if(req.method()!=='GET'&&!(req.method()==='POST'&&url.pathname.endsWith('/validate'))){writes.push(req.method()+' '+url.pathname);return route.abort();}
 const file=overlay&&path.join(overlay,name);if(file&&fs.existsSync(file))return route.fulfill({body:fs.readFileSync(file),contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css'})[path.extname(name)]});return route.continue();});
await page.goto(session.url);await page.waitForFunction(()=>typeof graph!=='undefined'&&graph);await page.evaluate(()=>document.fonts.ready);
const before=await page.evaluate(()=>JSON.stringify({graph,revision,dirty,past:past.length,future:future.length}));
const stateBefore=await page.evaluate(()=>api('state'));
const compileResponse=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/validate'));
await page.locator('#code').click();const compiled=await (await compileResponse).json();await page.locator('#source').waitFor({state:'visible'});
const expected=(compiled.vertex?'// VERTEX\n'+compiled.vertex+'\n':'')+'// PIXEL\n'+compiled.pixel;
assert.equal(await page.locator('#sourcecode').textContent(),expected);checks.push('GLSL button opens highlighted source identical to the generated text');
const colored=await page.locator('#sourcecode span').evaluateAll(es=>[...new Set(es.map(e=>e.className))]);
for(const kind of ['comment','type','keyword','function','number'])assert.ok(colored.includes('glsl-'+kind),kind);
const color=await page.locator('#sourcecode .glsl-type').first().evaluate(e=>getComputedStyle(e).color);assert.notEqual(color,await page.locator('#sourcecode').evaluate(e=>getComputedStyle(e).color));checks.push('generated keywords, types, numbers, functions and comments have visible colors');
await page.screenshot({path:path.join(folder,'glsl-highlight.png')});
await page.keyboard.press('Escape');assert.equal(await page.locator('#source').isVisible(),false);assert.equal(await page.evaluate(()=>JSON.stringify({graph,revision,dirty,past:past.length,future:future.length})),before);assert.deepEqual(await page.evaluate(()=>api('state')),stateBefore);checks.push('closing the popup preserves editor state and applied TD Shader state');
const sample='#version 460\r\n// vec4 12 /* <img src=x onerror=alert(1)> */\r\n/* multiline\nif (true) return 1.0; */\n#define LABEL "// literal \\"text\\""\nlayout(location=0) out vec4 color;\nflat in ivec3 value;\nuniform sampler2D sourceTex;\nvoid main() {\n\tfloat a = .5 + 1e-3 + 2.0f; uint mask = 0xAFu;\n\tcolor = TDOutputSwizzle(texture(sourceTex, vec2(a)));\n\tgl_Position = vec4(0.0); if (true) return;\n}\n// 葡萄 & < >';
await page.evaluate(text=>renderGLSL(text),sample);assert.equal(await page.locator('#sourcecode').textContent(),sample);assert.equal(await page.locator('#sourcecode img, #sourcecode script, #sourcecode a').count(),0);checks.push('whitespace, CRLF, Unicode and HTML-like code remain exact inert text');
const tokens=await page.locator('#sourcecode span').evaluateAll(es=>es.map(e=>({kind:e.className,text:e.textContent})));
for(const [kind,value]of [['directive','#version'],['type','sampler2D'],['type','ivec3'],['keyword','layout'],['number','.5'],['number','1e-3'],['number','2.0f'],['number','0xAFu'],['builtin','gl_Position'],['function','TDOutputSwizzle'],['function','texture']])assert.ok(tokens.some(t=>t.kind==='glsl-'+kind&&t.text===value),kind+' '+value);
assert.ok(tokens.some(t=>t.kind==='glsl-comment'&&t.text.includes('if (true) return 1.0;')));assert.ok(tokens.some(t=>t.kind==='glsl-string'&&t.text.includes('// literal')));checks.push('GLSL literals, directives, TD calls and comments or strings are tokenized separately');
await page.evaluate(()=>{document.getElementById('source').showModal();const range=document.createRange();range.selectNodeContents(document.getElementById('sourcecode'));const selection=getSelection();selection.removeAllRanges();selection.addRange(range);});assert.equal((await page.evaluate(()=>getSelection().toString())).replaceAll('\r\n','\n'),sample.replaceAll('\r\n','\n'));await page.keyboard.press('Escape');checks.push('selecting highlighted code preserves the plain source for copying');
await page.evaluate(()=>renderGLSL(''));assert.equal(await page.locator('#sourcecode').textContent(),'');await page.evaluate(()=>renderGLSL('/* unfinished <script>\nvec4'));assert.equal(await page.locator('#sourcecode .glsl-comment').textContent(),'/* unfinished <script>\nvec4');checks.push('empty and unfinished comment text render safely');
await page.setViewportSize({width:420,height:760});await page.locator('#code').click();await page.locator('#source').waitFor({state:'visible'});assert.equal(await page.locator('#sourcecode').textContent(),expected);const bounds=await page.locator('#source').boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=421);await page.locator('#closecode').click();assert.equal(await page.locator('#source').isVisible(),false);checks.push('narrow viewport popup remains usable and reopens cleanly');
assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);assert.deepEqual(external,[]);checks.push('no page errors, state-changing requests or external asset dependencies');
fs.writeFileSync(path.join(folder,'glsl-tests.json'),JSON.stringify({passed:true,count:checks.length,checks},null,2));console.log(JSON.stringify({passed:true,count:checks.length}));
}catch(e){fs.writeFileSync(path.join(folder,'glsl-tests.json'),JSON.stringify({passed:false,checks,errors,error:e.message},null,2));throw e;}
finally{await browser.close();}})().catch(e=>{console.error(e.message.replaceAll(new URL(session.url).hash.slice(1),'[session]'));process.exitCode=1;});
