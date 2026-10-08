const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const {sharedGraph,node,edge}=require('../fixtures/shared_subgraphs.cjs');
const [legacyRoot,folder]=process.argv.slice(2);assert.ok(legacyRoot&&folder);fs.mkdirSync(folder,{recursive:true});
const c={};vm.runInNewContext(fs.readFileSync(require.resolve('../../src/generated/wire_planning.js'),'utf8'),c);
const cases=[];
for(const type of ['float','vec2','vec3','vec4'])for(const unconnected of [false,true]){
 const g=sharedGraph(),value=t=>t==='float'?.75:Array(Number(t.slice(-1))).fill(.75);
 g.stages.pixel.nodes[0].params.value=.2;
 for(const f of g.functions)for(const p of [...f.inputs,...f.outputs]){p.type=type;p.default=value(type);}
 g.functions[0].graph.nodes[1].params={type};g.functions[0].graph.nodes[1].inputValues={b:value(type)};
 if(unconnected){g.stages.pixel.edges=g.stages.pixel.edges.filter(e=>e.to[0]!=='first');g.stages.pixel.nodes[1].inputValues={value:value(type)};}
 g.stages.pixel.nodes.find(n=>n.id==='sum').params={type};
 if(type!=='float'){
  g.stages.pixel.nodes.push(node('length','length',{type}));
  g.stages.pixel.edges=g.stages.pixel.edges.filter(e=>e.to[0]!=='output');g.stages.pixel.edges.push(edge('sum','length','out','value'),edge('length','output','out','color'));
 }
 cases.push({type,unconnected,graph:g});
}
const uniform=sharedGraph();uniform.stages.pixel.nodes[0].params.value=.1;
uniform.declarations=[{id:'gainValue',name:'uGain',kind:'uniform',type:'float',value:.5}];
uniform.functions[0].graph.nodes.push(node('uniform','uniform',{declarationId:'gainValue'}));uniform.functions[0].graph.edges.push(edge('uniform','mul','out','b'));
cases.push({type:'uniform',graph:uniform});
const python=`import json,sys\nsys.path.insert(0,sys.argv[1])\nimport sgrape_core as c\nprint(json.dumps([c.compile_graph(g) for g in json.load(sys.stdin)],allow_nan=False))`;
const legacy=JSON.parse(execFileSync(process.env.PYTHON||'python',['-B','-c',python,path.resolve(legacyRoot,'src/core')],{input:JSON.stringify(cases.map(c=>c.graph)),encoding:'utf8',env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}}));
cases.forEach((row,i)=>{assert.equal(c.GrapeTopCompiler.supports(row.graph),true);row.compiled=JSON.parse(JSON.stringify(c.GrapeTopCompiler.compile(row.graph)));row.legacy=legacy[i];assert.deepEqual(row.compiled.bindings,row.legacy.bindings);});
assert.equal(cases.at(-1).compiled.bindings.length,1);
fs.writeFileSync(path.join(folder,'cases.json'),JSON.stringify(cases,null,2));
(async()=>{
 const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');const browser=await chromium.launch({executablePath:process.env.CHROME_EXECUTABLE,headless:true});
 let pixels;
 try{
  const page=await browser.newPage();pixels=await page.evaluate(rows=>{
   const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const gl=canvas.getContext('webgl2');if(!gl)throw Error('WebGL2 unavailable');
   function render(compiled){
    const shader=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;};
    const vs=shader(gl.VERTEX_SHADER,'#version 300 es\nvoid main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(p*2.0-1.0,0.,1.);}');
    const ps=shader(gl.FRAGMENT_SHADER,'#version 300 es\nprecision highp float;\nconst vec3 vUV=vec3(0.5);\nvec4 TDOutputSwizzle(vec4 c){return c;}\n'+compiled.pixel);
    const program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,ps);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
    for(const d of compiled.bindings){const loc=gl.getUniformLocation(program,d.name);if(d.type==='float')gl.uniform1f(loc,d.value);else gl['uniform'+d.type.slice(-1)+'fv'](loc,d.value);}
    gl.drawArrays(gl.TRIANGLES,0,3);const rgba=new Uint8Array(4);gl.readPixels(0,0,1,1,gl.RGBA,gl.UNSIGNED_BYTE,rgba);
    gl.deleteProgram(program);gl.deleteShader(vs);gl.deleteShader(ps);return [...rgba];
   }
   return rows.map(row=>({frontend:render(row.compiled),legacy:render(row.legacy)}));
  },cases);
  for(let i=0;i<pixels.length;i++)pixels[i].frontend.forEach((v,k)=>assert.ok(Math.abs(v-pixels[i].legacy[k])<=1,JSON.stringify({i,...pixels[i]})));
  pixels.at(-1).frontend.forEach(v=>assert.ok(Math.abs(v-25.5)<=1));
 }finally{await browser.close();}
 const report={passed:true,cases:cases.length,pixels,comparison:'Actual WebGL2 GPU pixels and exact uniform bindings against the fixed Legacy compiler; generated temporary names intentionally differ',limits:'Numeric TOP subgraphs only. WebGL2 shader harness substitutes the TD wrapper, not proof of a delivered WebGL mode or native TD execution.'};
 fs.writeFileSync(path.join(folder,'results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:true,cases:cases.length}));
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
