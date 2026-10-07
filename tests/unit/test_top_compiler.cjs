const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),{spawnSync}=require('node:child_process');
const source=fs.readFileSync(path.join(__dirname,'../../src/generated/wire_planning.js'),'utf8');
const context=vm.createContext({});vm.runInContext(source,context);
const compiler=context.GrapeTopCompiler;
const oracle=spawnSync(process.env.PYTHON||'python',[path.join(__dirname,'top_compiler_oracle.py')],{encoding:'utf8',env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}});
assert.equal(oracle.status,0,oracle.stderr||String(oracle.error));
// The oracle is the old Python compiler and emits old-format graphs; convert them with the same
// developer tool that converts real old graphs (tools/dev/old_graph.cjs, Q44).
// 對照組是舊 Python 產碼器、產出舊格式的圖；用轉換真實舊圖的同一支工具轉成新格式。
const {convertOldGraph}=require('../../tools/dev/old_graph.cjs');
const {cases,identifiers}=JSON.parse(oracle.stdout),plain=v=>JSON.parse(JSON.stringify(v));
for(const row of cases)row.graph=convertOldGraph(row.graph).graph;
function freeze(v){if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}

test('frontend compilation matches legacy GLSL, bindings, ports, source map and diagnostics',()=>{
  for(const row of cases){
    assert.equal(compiler.supports(row.graph),true,row.name);
    if(row.error)assert.throws(()=>compiler.compile(freeze(row.graph),identifiers),undefined,row.name);
    else assert.deepEqual(plain(compiler.compile(freeze(row.graph),identifiers)),row.compiled,row.name);
  }
});
test('capability selection excludes whole graphs before execution',()=>{
  const base=cases[0].graph;
  const variants=[
    g=>g.target='mat',g=>g.subgraphs=[{}],g=>g.structDefinitions=[{}],g=>delete g.format,g=>g.version=2,
    g=>g.stages.pixel.nodes.push({id:'dynamic',nodeType:'sgrape.builtin.glsl_code',params:{inputs:[],outputs:[]}}),
    g=>g.stages.pixel.nodes.push({id:'matrix',nodeType:'sgrape.builtin.multiply',params:{type:'mat4'}}),
    g=>g.stages.pixel.nodes=Array.from({length:257},(_,i)=>({...g.stages.pixel.nodes[0],id:'n'+i})),
    g=>g.stages.pixel.edges=Array.from({length:1025},()=>g.stages.pixel.edges[0]),
    g=>g.declarations.push({id:'texture',kind:'sampler',type:'sampler2D',name:'uTexture',value:null}),
  ];
  for(const change of variants){const g=plain(base);change(g);assert.equal(compiler.supports(g),false);assert.throws(()=>compiler.compile(g),/outside/);}
});
test('result and graph do not share mutable binding data',()=>{
  const g=plain(cases.find(c=>c.name==='uniform abs float').graph),before=JSON.stringify(g);
  const result=compiler.compile(g);result.bindings[0].value=999;
  assert.equal(JSON.stringify(g),before);
});
test('invalid supported edits retain node locations for existing diagnostic UI',()=>{
  const g=plain(cases.find(c=>c.name==='uniform abs float').graph);g.declarations=[];
  assert.throws(()=>compiler.compile(g),error=>error.node==='gainNode'&&error.stage==='pixel'&&error.message.includes('declaration'));
  const bad=cases.find(c=>c.name==='disconnected cycle').graph;
  assert.throws(()=>compiler.compile(bad),error=>error.node==='dead'&&error.stage==='pixel');
});
