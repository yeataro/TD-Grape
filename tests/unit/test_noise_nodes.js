/* Exercise shared type inference and Undo with the actual editor model. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const payload=JSON.parse(fs.readFileSync(0,'utf8')),dir=path.resolve(__dirname,'../../src/editor');
const elements=new Map(),element=key=>{if(!elements.has(key))elements.set(key,{value:'all',textContent:'',title:'',hidden:false,disabled:false,focus(){},replaceChildren(){},setAttribute(){},addEventListener(){},classList:{add(){},remove(){},toggle(){}}});return elements.get(key);};
const context=vm.createContext({assert,payload,console,TextEncoder,crypto:globalThis.crypto,
  location:{pathname:'/',hash:''},history:{replaceState(){}},window:{addEventListener(){}},
  document:{addEventListener(){},querySelector:element,querySelectorAll:()=>[]},
  sessionStorage:{getItem(){return '';},setItem(){}},setTimeout(){return 1;},clearTimeout(){}});
for(const name of ['functions_model.js','functions_ui.js','graph_ui.js','inspector.js'])vm.runInContext(fs.readFileSync(path.join(dir,name),'utf8'),context);
const app=fs.readFileSync(path.join(dir,'app.js'),'utf8');
vm.runInContext(app.slice(0,app.indexOf("$('#canvas').addEventListener('dragover'")),context);
vm.runInContext(`
render=()=>{};wires=()=>{};renderGraphEditActions=()=>{};inspector=()=>{};renderNavigation=()=>{};renderNativeSourceValues=()=>{};refreshUniforms=()=>{};
catalog=payload.catalog;setTypeContract(payload.contract);editorTarget='top';
const graphs=[];
function node(key,id,params={}){const d=catalog.find(d=>d.key===key);return {id,definitionUuid:d.definitionUuid,revisionHash:d.revisionHash,params:{...clone(d.defaults),...params},ui:{x:24,y:24,...(supportsAutoType(d)?{typeMode:'auto'}:{})}};}
function setup(key){graph={schemaVersion:1,target:'top',topSourceVersion:1,topInputs:[],declarations:[],functions:[],stages:{pixel:{nodes:[node(key,'noise'),node('vec3','coordinates'),node('pixel_out','result')],edges:[]}}};graphTrail=[];past=[];future=[];selected=null;selection.clear();selectedEdge=null;dirty=false;}
const n=id=>current().nodes.find(n=>n.id===id),d=key=>catalog.find(d=>d.key===key);
const info=(id,kind,port)=>({node:id,kind,port,type:ports(n(id),kind)[port]});
const connect=(a,b,p)=>connectPorts(info(a,'outputs','out'),info(b,'inputs',p));
const identical=(a,b)=>assert.equal(JSON.stringify(a),JSON.stringify(b));
for(const key of ['perlin_noise','simplex_noise']){
  assert.equal(supportsAutoType(d(key)),true);identical(selectableNodeTypes(d(key)),['vec2','vec3','vec4']);
  for(const ty of selectableNodeTypes(d(key))){const noise=node(key,'noise',{type:ty});identical(defaultInput(noise,'position',ty),Array(Number(ty.at(-1))).fill(0));identical(resolvedNodePorts(d(key),noise.params,null,'outputs'),{out:'float'});}
  setup(key);n('noise').inputValues={position:[.2,.4]};const before=clone(graph);
  assert.equal(connect('coordinates','noise','position'),true);assert.equal(n('noise').params.type,'vec3');assert.equal(past.length,1);
  const connected=clone(graph);undo();identical(graph,before);undo(true);identical(graph,connected);
  assert.equal(connect('noise','result','color'),true);graphs.push(clone(graph));
  const wired=clone(graph);assert.equal(setMathType(n('noise'),'vec4'),true);assert.equal(n('noise').params.type,'vec4');assert.equal(current().edges.some(e=>e.to[0]==='noise'),false);undo();identical(graph,wired);
  assert.equal(change(()=>current().edges=current().edges.filter(e=>e.to[0]!=='noise')),true);assert.equal(n('noise').params.type,'vec2');identical(n('noise').inputValues.position,[.2,.4]);
  assert.equal(setMathType(n('noise'),'vec4'),true);assert.equal(n('noise').ui.typeMode,'locked');assert.equal(n('noise').params.type,'vec4');
  const locked=clone({graph,past,future});assert.equal(connect('coordinates','noise','position'),false);identical({graph,past,future},locked);
  assert.equal(setMathType(n('noise'),'auto'),true);assert.equal(connect('coordinates','noise','position'),true);assert.equal(n('noise').params.type,'vec3');
  assert.equal(change(()=>{n('noise').params.requireConstant=true;}),false);assert.equal(n('noise').params.requireConstant,undefined);
  graphs.push(clone(graph));
}
globalThis.result={graphs};`,context);
process.stdout.write(JSON.stringify(context.result));
