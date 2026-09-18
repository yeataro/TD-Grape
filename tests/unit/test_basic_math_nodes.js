/* Shared Auto type planning, value retention and real edit/Undo transactions. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const payload=JSON.parse(fs.readFileSync(0,'utf8')),dir=path.resolve(__dirname,'../../src/editor');
const elements=new Map(),element=key=>{if(!elements.has(key))elements.set(key,{value:'all',textContent:'',title:'',hidden:false,disabled:false,focus(){},replaceChildren(){},setAttribute(){},addEventListener(){},classList:{add(){},remove(){},toggle(){}}});return elements.get(key);};
const context=vm.createContext({assert,payload,console,TextEncoder,crypto:globalThis.crypto,
  location:{pathname:'/',hash:''},history:{replaceState(){}},window:{addEventListener(){}},
  document:{addEventListener(){},querySelector:element,querySelectorAll:()=>[]},
  sessionStorage:{getItem(){return '';},setItem(){}},setTimeout(){return 1;},clearTimeout(){}});
for(const name of ['functions_model.js','functions_ui.js','graph_ui.js','inspector.js'])vm.runInContext(fs.readFileSync(path.join(dir,name),'utf8'),context);
const app=fs.readFileSync(path.join(dir,'app.js'),'utf8');vm.runInContext(app.slice(0,app.indexOf("$('#canvas').addEventListener('dragover'")),context);
vm.runInContext(`
render=()=>{};wires=()=>{};renderGraphEditActions=()=>{};inspector=()=>{};renderNavigation=()=>{};renderNativeSourceValues=()=>{};refreshUniforms=()=>{};
catalog=payload.catalog;setTypeContract(payload.contract);editorTarget='top';stage='pixel';const graphs=[];
function node(key,id,params={}){const d=catalog.find(d=>d.key===key);return {id,definitionUuid:d.definitionUuid,revisionHash:d.revisionHash,params:{...clone(d.defaults),...params},ui:{x:24,y:24,...(supportsAutoType(d)?{typeMode:'auto'}:{})}};}
const n=id=>current().nodes.find(n=>n.id===id),info=(id,kind,port)=>({node:id,kind,port,type:ports(n(id),kind)[port]});
const identical=(a,b)=>assert.equal(JSON.stringify(a),JSON.stringify(b));
const operationTypes=key=>numericTypes().filter(type=>key==='mod'||['float','double'].includes(typeFamily(type))||key==='sign'&&typeFamily(type)==='int');
for(const key of payload.keys){
 const d=catalog.find(d=>d.key===key),port=Object.keys(d.inputs)[0];assert.equal(supportsAutoType(d),true);identical(selectableNodeTypes(d),operationTypes(key));
 assert.ok(typeContract.constantExpressions.includes(key));
 for(const ty of selectableNodeTypes(d))for(const p of Object.keys(d.inputs))identical(defaultInput(node(key,'sample',{type:ty}),p,ty),filledValue(ty,p==='b'?1:0));
 graph={schemaVersion:1,target:'top',topSourceVersion:1,topInputs:[],declarations:[],functions:[],stages:{pixel:{nodes:[node('vec3','source',{value:[.25,.5,.75]}),node(key,'operation'),node('length','measure'),node('pixel_out','result')],edges:[]}}};
 graphTrail=[];past=[];future=[];selected=null;selection.clear();selectedEdge=null;dirty=false;
 n('operation').inputValues={[port]:.375,...(key==='mod'?{b:.75}:{})};const before=clone(graph);
 assert.equal(connectPorts(info('source','outputs','out'),info('operation','inputs',port)),true);assert.equal(n('operation').params.type,'vec3');assert.equal(past.length,1);
 const connected=clone(graph);undo();identical(graph,before);undo(true);identical(graph,connected);
 assert.equal(connectPorts(info('operation','outputs','out'),info('measure','inputs','value')),true);assert.equal(n('measure').params.type,'vec3');
 assert.equal(connectPorts(info('measure','outputs','out'),info('result','inputs','color')),true);graphs.push(clone(graph));
 assert.equal(change(()=>{current().edges=current().edges.filter(e=>e.to[0]!=='operation');}),true);assert.equal(n('operation').params.type,'float');assert.equal(n('operation').inputValues[port],.375);
 assert.equal(change(()=>{n('operation').params.type='vec4';n('operation').ui.typeMode='locked';}),true);
 const locked=clone({graph,past,future});assert.equal(connectPorts(info('source','outputs','out'),info('operation','inputs',port)),false);identical({graph,past,future},locked);
}
console.log(JSON.stringify({passed:true,graphs}));
`,context);
