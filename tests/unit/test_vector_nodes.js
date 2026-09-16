/* Real graph edits and connection planning; only DOM/network effects are stubbed. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const payload=JSON.parse(fs.readFileSync(0,'utf8')),dir=path.resolve(__dirname,'../../src/editor');
const elements=new Map();
const element=key=>{if(!elements.has(key))elements.set(key,{value:'all',textContent:'',title:'',hidden:false,disabled:false,focus(){},replaceChildren(){},setAttribute(){},addEventListener(){},classList:{add(){},remove(){},toggle(){}}});return elements.get(key);};
const context=vm.createContext({assert,payload,console,crypto:globalThis.crypto,
  location:{pathname:'/',hash:''},history:{replaceState(){}},
  document:{querySelector:element,querySelectorAll:()=>[]},
  sessionStorage:{getItem(){return '';},setItem(){}},setTimeout(){return 1;},clearTimeout(){}});
for(const name of ['functions_model.js','functions_ui.js','graph_ui.js','inspector.js'])vm.runInContext(fs.readFileSync(path.join(dir,name),'utf8'),context);
const app=fs.readFileSync(path.join(dir,'app.js'),'utf8');
vm.runInContext(app.slice(0,app.indexOf("$('#canvas').addEventListener('dragover'")),context);
vm.runInContext(`
render=()=>{};wires=()=>{};renderGraphEditActions=()=>{};inspector=()=>{};renderNavigation=()=>{};
catalog=payload.catalog;setTypeContract(payload.contract);editorTarget='top';
const graphs=[];
function node(key,id,params={}){const d=catalog.find(d=>d.key===key);return {id,definitionUuid:d.definitionUuid,revisionHash:d.revisionHash,params:{...clone(d.defaults),...params},ui:{x:24,y:24,...(supportsAutoType(d)?{typeMode:'auto'}:{})}};}
const edge=(from,to,port,out='out')=>({from:[from,out],to:[to,port]});
function setup(nodes,edges=[]){graph={schemaVersion:1,target:'top',topSourceVersion:1,topInputs:[],declarations:[],functions:[],stages:{pixel:{nodes:[...nodes,node('pixel_out','result')],edges}}};graphTrail=[];past=[];future=[];selected=null;selection.clear();selectedEdge=null;}
const n=id=>current().nodes.find(n=>n.id===id);
const info=(id,kind,port)=>({node:id,kind,port,type:ports(n(id),kind)[port]});
function connect(a,b,p,o='out'){return connectPorts(info(a,'outputs',o),info(b,'inputs',p));}
const identical=(a,b)=>assert.equal(JSON.stringify(a),JSON.stringify(b));

// Every scalar/vector partition is chosen from the same core contract, by wires.
for(const layout of typeContract.vectors.layouts.vec4){
  setup([...Object.entries(layout.inputs).map(([p,t])=>node(t,p,{value:filledValue(t,.25)})),node('combine','join',{type:'vec4'})]);
  for(const p of Object.keys(layout.inputs))assert.equal(connect(p,'join',p),true);
  identical(n('join').params.groups,layout.groups);assert.equal(connect('join','result','color'),true);graphs.push(clone(graph));
}

// Removing one group restores its prior component values without sliding Z/W.
setup([node('vec2','a'),node('float','b'),node('combine','join',{type:'vec4',components:[.1,.2,.3,.4]})]);
assert.equal(connect('a','join','x'),true);assert.equal(connect('b','join','z'),true);
identical(ports(n('join'),'inputs'),{x:'vec2',z:'float',w:'float'});
let before=clone(graph),historySize=past.length;
assert.equal(connect('a','join','z'),true); // Replacing Z float with ZW vec2 is explicit.
assert.equal(past.length,historySize+1);undo();identical(graph,before);
assert.equal(change(()=>current().edges=current().edges.filter(e=>e.to[1]!=='x')),true);
identical(ports(n('join'),'inputs'),{x:'float',y:'float',z:'float',w:'float'});
identical(n('join').params.components,[.1,.2,.3,.4]);assert.ok(current().edges.some(e=>e.to[1]==='z'));
undo();identical(graph,before);

// A vec3 cannot swallow an existing Z connection; failed edits keep undo/draft.
assert.equal(change(()=>current().nodes.push(node('vec3','large'))),true);
before=clone(graph);historySize=past.length;
assert.equal(connect('large','join','x'),false);identical(graph,before);assert.equal(past.length,historySize);
assert.equal(change(()=>n('join').params.type='vec2'),false);identical(graph,before);

// V-only editing works with direct node shortcut and one-step undo for add + wire.
setup([node('uv','uv')]);addVectorSplit(n('uv'),'out');
let split=n(selected);assert.equal(definition(split).key,'vector_split');assert.equal(split.params.type,'vec2');
assert.equal(split.ui.componentNames,'uv');assert.equal(portLabel(split,'outputs','y'),'V');assert.equal(past.length,1);
const splitId=split.id;addVectorSplit(n('uv'),'out');assert.equal(current().nodes.filter(n=>definition(n).key==='vector_split').length,1);
assert.equal(change(()=>{current().nodes.push(node('add','offset'),node('combine','join'),node('combine','rgba',{type:'vec4'}));n('offset').inputValues={b:.125};}),true);
assert.equal(connect(splitId,'offset','a','y'),true);assert.equal(connect(splitId,'join','x','x'),true);
assert.equal(connect('offset','join','y'),true);assert.equal(connect('join','rgba','x'),true);assert.equal(connect('rgba','result','color'),true);graphs.push(clone(graph));

// Shrinking a Split or a Swizzle cannot silently delete connected components.
setup([node('vec4','source'),node('vector_split','s',{type:'vec4'}),node('combine','join',{type:'vec4'})]);
assert.equal(connect('source','s','value'),true);assert.equal(connect('s','join','x','w'),true);
before=clone(graph);assert.equal(change(()=>{current().nodes.push(node('vec2','small'));current().edges[0].from=['small','out'];}),false);identical(graph,before);
setup([node('vec2','source'),node('swizzle','s',{mask:'yxxy'}),node('combine','join',{type:'vec4'})]);
assert.equal(connect('source','s','value'),true);assert.equal(connect('s','result','color'),true);
before=clone(graph);assert.equal(change(()=>n('s').params.mask='yx'),false);identical(graph,before);
assert.equal(change(()=>n('s').params.mask='xyyx'),true);graphs.push(clone(graph));

// Constant constraints reject before a graph/undo/deployment mutation.
setup([node('vec2','fixed'),node('uniform','runtime',{declarationId:'u'}),node('combine','join',{type:'vec4',requireConstant:true})]);
graph.declarations=[{id:'u',kind:'uniform',name:'uValue',type:'vec2',value:[.2,.3]}];
assert.equal(connect('fixed','join','x'),true);before=clone(graph);historySize=past.length;
assert.equal(connect('runtime','join','x'),false);identical(graph,before);assert.equal(past.length,historySize);
assert.equal(change(()=>delete n('join').params.requireConstant),true);assert.equal(connect('runtime','join','x'),true);
before=clone(graph);assert.equal(change(()=>n('join').params.requireConstant=true),false);identical(graph,before);
assert.equal(connect('join','result','color'),true);graphs.push(clone(graph));

// Context creation finds all shapes, matches output size and ranks relevant tools.
setup([node('vec2','source'),node('combine','dest',{type:'vec4'})]);
const wire=info('source','outputs','out'),combine=catalog.find(d=>d.key==='combine');
const variant=creatorVariants(combine,wire).find(v=>v.type==='vec4');
identical(creatorTypePlan(combine,variant,'y',wire,false).inputs,{x:'float',y:'vec2',w:'float'});
const back=info('dest','inputs','x'),swizzle=catalog.find(d=>d.key==='swizzle');
assert.ok(creatorVariants(swizzle,back).every(v=>v.outputs.out==='float'));
assert.ok(creatorPriority({d:catalog.find(d=>d.key==='vector_split')},wire)<creatorPriority({d:catalog.find(d=>d.key==='add')},wire));
const beforePlan=JSON.stringify(graph);creatorTypePlan(combine,variant,'x',wire,false);assert.equal(JSON.stringify(graph),beforePlan);
console.log(JSON.stringify({passed:true,graphs}));
`,context);
