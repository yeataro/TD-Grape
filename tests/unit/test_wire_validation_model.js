/* Actual connection planner/transactions behind all three candidate modes.
 * Input is the current catalog/type contract, supplied by the Python test.
 * Geometry/rendering/network are test doubles; model/history are product code.
 */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const payload=JSON.parse(fs.readFileSync(0,'utf8')),dir=path.resolve(__dirname,'../../src/editor');
const elements=new Map();
const element=key=>{if(!elements.has(key))elements.set(key,{value:'all',textContent:'',dataset:{},hidden:false,disabled:false,focus(){},replaceChildren(){},setAttribute(){},addEventListener(){},querySelectorAll(){return [];},classList:{add(){},remove(){},toggle(){}},getBoundingClientRect(){return{left:0,top:0,right:800,bottom:600};}});return elements.get(key);};
const context=vm.createContext({assert,payload,console,URLSearchParams,TextEncoder,queueMicrotask:()=>{},crypto:globalThis.crypto,
  location:{pathname:'/',hash:'',search:''},history:{replaceState(){}},window:{addEventListener(){}},
  document:{documentElement:{clientWidth:1200,clientHeight:800},addEventListener(){},removeEventListener(){},querySelector:element,querySelectorAll:()=>[]},
  MutationObserver:class{observe(){}disconnect(){}takeRecords(){return [];}},
  sessionStorage:{getItem(){return '';},setItem(){}},setTimeout(){return 1;},clearTimeout(){}});
for(const name of ['functions_model.js','functions_ui.js','graph_ui.js','inspector.js'])vm.runInContext(fs.readFileSync(path.join(dir,name),'utf8'),context);
const app=fs.readFileSync(path.join(dir,'app.js'),'utf8');
vm.runInContext(app.slice(0,app.indexOf("$('#canvas').addEventListener('dragover'")),context);
vm.runInContext(`
render=()=>{};wires=()=>{};renderHistoryActions=()=>{};renderGraphSaveState=()=>{};
renderNativeSourceValues=()=>{};refreshUniforms=()=>{};clearCompileDiagnostics=()=>{};uiScaleFactor=()=>1;
catalog=payload.catalog;setTypeContract(payload.contract);editorTarget='top';connectionInterrupted=true;
const make=(key,id,params={})=>{const d=catalog.find(d=>d.key===key);return{id,definitionUuid:d.definitionUuid,revisionHash:d.revisionHash,params:{...clone(d.defaults),...params},ui:{x:24,y:24,...(supportsAutoType(d)?{typeMode:'auto'}:{})}};};
function setup(){graph={schemaVersion:1,target:'top',topSourceVersion:1,topInputs:[],declarations:[],functions:[],stages:{pixel:{nodes:[make('float','source'),make('add','target'),make('add','downstream')],edges:[]}}};graphTrail=[];past=[];future=[];selection.clear();selected=null;selectedEdge=null;dirty=false;readonly=false;}
const info=(node,kind,port)=>({node,kind,port,type:ports(current().nodes.find(n=>n.id===node),kind)[port]});
const from=()=>info('source','outputs','out'),to=()=>info('target','inputs','a');
let available=[];
wirePortButtons=()=>available;
const button=details=>({details,isConnected:true,disabled:false,getClientRects:()=>[{}],classList:{contains:()=>false},getBoundingClientRect:()=>({left:300,right:310,top:100,bottom:110})});
portInfo=b=>b.details;
const snapshot=()=>JSON.stringify({graph,past,future,dirty});
for(const mode of ['all','hover','viewport']){
  EDITOR_DEV_SETTINGS.wireValidation=mode;setup();const target=button(to());available=[target];
  const before=snapshot(),session=createWireCandidates(from());
  assert.equal(session.get().includes(target)&&session.accept(target),true,mode+' preflight');
  assert.equal(snapshot(),before,'candidate work must not mutate the graph/history');
  session.dispose();assert.equal(connectPorts(from(),to()),true,mode+' valid commit');assert.equal(past.length,1);assert.equal(current().edges.length,1);
  // Offscreen graph nodes remain part of the planner: adding target -> source
  // would close a path through an offscreen downstream node.
  graph.stages.pixel.nodes[0]=make('add','source');
  graph.stages.pixel.edges=[{from:['source','out'],to:['downstream','a']},{from:['downstream','out'],to:['target','a']}];
  const cycleFrom=info('target','outputs','out'),cycleTo=info('source','inputs','a');
  available=[button(cycleTo)];const cyclic=createWireCandidates(cycleFrom),unchanged=snapshot();
  assert.equal(cyclic.get().includes(available[0])&&cyclic.accept(available[0]),false,mode+' offscreen cycle');
  assert.equal(connectPorts(cycleFrom,cycleTo),false);assert.equal(snapshot(),unchanged);cyclic.dispose();
  // A successful earlier hover never authorizes a later invalid commit.
  setup();available=[button(to())];const pending=createWireCandidates(from());
  assert.equal(pending.get().includes(available[0])&&pending.accept(available[0]),true);
  graph.stages.pixel.nodes[0]=make('add','source');current().edges=[{from:['target','out'],to:['source','a']}];editVersion++;
  const staleBefore=snapshot();assert.equal(connectPorts(from(),to()),false);assert.equal(snapshot(),staleBefore);pending.dispose();
  // A locked incompatible vector destination remains rejected in every mode.
  setup();current().nodes[0]=make('vec3','source');current().nodes[1]=make('add','target',{type:'vec2'});current().nodes[1].ui.typeMode='locked';
  available=[button(to())];const invalid=createWireCandidates(from()),badBefore=snapshot();
  assert.equal(invalid.get().includes(available[0])&&invalid.accept(available[0]),false);
  assert.equal(connectPorts(from(),to()),false);assert.equal(snapshot(),badBefore);invalid.dispose();
}
console.log('wire model: 3 modes x valid commit/history, offscreen cycle, stale preflight, locked type rejection passed');
`,context);
