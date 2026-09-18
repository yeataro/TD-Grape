/* Real graph edits and connection planning; only DOM/network effects are stubbed. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const payload=JSON.parse(fs.readFileSync(0,'utf8')),dir=path.resolve(__dirname,'../../src/editor');
const elements=new Map();
const element=key=>{if(!elements.has(key))elements.set(key,{value:'all',textContent:'',title:'',hidden:false,disabled:false,focus(){},replaceChildren(){},setAttribute(){},addEventListener(){},classList:{add(){},remove(){},toggle(){}}});return elements.get(key);};
const context=vm.createContext({assert,payload,console,crypto:globalThis.crypto,
  location:{pathname:'/',hash:''},history:{replaceState(){}},window:{addEventListener(){},getSelection(){return null;}},
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
const edge=(from,to,port,out='out')=>({from:[from,out],to:[to,port]});
function setup(nodes,edges=[]){graph={schemaVersion:1,target:'top',topSourceVersion:1,topInputs:[],declarations:[],functions:[],stages:{pixel:{nodes:[...nodes,node('pixel_out','result')],edges}}};graphTrail=[];past=[];future=[];selected=null;selection.clear();selectedEdge=null;}
const n=id=>current().nodes.find(n=>n.id===id);
const info=(id,kind,port)=>({node:id,kind,port,type:ports(n(id),kind)[port]});
function connect(a,b,p,o='out'){return connectPorts(info(a,'outputs',o),info(b,'inputs',p));}
const identical=(a,b)=>assert.equal(JSON.stringify(a),JSON.stringify(b));
function rejectsWire(a,b,p,o='out'){
  const snapshot=clone({graph,past,future,dirty});
  assert.equal(connect(a,b,p,o),false);identical({graph,past,future,dirty},snapshot);
}

// Every scalar/vector partition is chosen from the same core contract, by wires.
for(const key of ['combine','replace'])for(const layout of typeContract.vectors.layouts.vec4){
  setup([...Object.entries(layout.inputs).map(([p,t])=>node(t,p,{value:filledValue(t,.25)})),node(key,'join',{type:'vec4'})]);
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

// A direct wider Combine wire replaces all overlapping wires in one undo step.
assert.equal(change(()=>current().nodes.push(node('vec3','large'))),true);
before=clone(graph);historySize=past.length;
assert.equal(connect('large','join','x'),true);assert.equal(past.length,historySize+1);
identical(n('join').params.groups,{x:'vec3'});identical(current().edges,[edge('large','join','x')]);
let combined=clone(graph);undo();identical(graph,before);undo(true);identical(graph,combined);
assert.equal(change(()=>n('join').params.type='vec2'),false);identical(graph,combined);

// XYZ and YZW replacement keep the opposite component, source nodes and fan-outs.
for(const start of ['x','y']){
  setup([...Array.from('xyzw',p=>node('float',p)),node('vec3','large'),node('add','math'),node('combine','join',{type:'vec4',components:[.1,.2,.3,.4]}),node('combine','other',{type:'vec4'})]);
  for(const p of 'xyzw'){assert.equal(connect(p,'join',p),true);assert.equal(connect(p,'other',p),true);}
  before=clone(graph);historySize=past.length;
  assert.equal(connect('large','join',start),true);assert.equal(past.length,historySize+1);
  const remaining=start==='x'?'w':'x',hidden=start==='x'?'y':'z';
  identical(current().edges.filter(e=>e.to[0]==='join'),[edge(remaining,'join',remaining),edge('large','join',start)]);
  identical(current().edges.filter(e=>e.to[0]==='other'),Array.from('xyzw',p=>edge(p,'other',p)));
  identical(n('join').params.groups,{[start]:'vec3'});identical(n('join').params.components,[.1,.2,.3,.4]);
  identical(current().nodes,before.stages.pixel.nodes.map(item=>item.id==='join'?{...item,params:{...item.params,groups:{[start]:'vec3'}}}:item));
  combined=clone(graph);undo();identical(graph,before);undo(true);identical(graph,combined);
  rejectsWire('x','join',hidden); // Covered component is no longer a visible destination.
  rejectsWire('large','join',start==='x'?'w':'z'); // Overflow cannot discard any wires.
  assert.equal(connect('join','math','a'),true);
  rejectsWire('math','join','x'); // A cycle would otherwise displace all four components.
  assert.equal(connect('join','result','color'),true);graphs.push(clone(graph));
}

// A partial overlap removes the entire old grouped wire and releases its tail.
setup([node('float','x'),node('vec2','pair'),node('combine','join',{type:'vec4',components:[1,2,3,4]}),node('combine','other',{type:'vec4'})]);
assert.equal(connect('x','join','x'),true);assert.equal(connect('pair','join','z'),true);assert.equal(connect('pair','other','x'),true);
before=clone(graph);historySize=past.length;
assert.equal(connect('pair','join','y'),true);assert.equal(past.length,historySize+1);
identical(n('join').params.groups,{y:'vec2'});assert.equal(ports(n('join'),'inputs').w,'float');
identical(current().edges,[edge('x','join','x'),edge('pair','other','x'),edge('pair','join','y')]);
identical(n('join').params.components,[1,2,3,4]);assert.ok(n('pair'));
combined=clone(graph);undo();identical(graph,before);undo(true);identical(graph,combined);
assert.equal(connect('join','result','color'),true);graphs.push(clone(graph));

// Constant rejection restores even the wires that the candidate would displace.
setup([...Array.from('xyzw',p=>node('float',p)),node('uniform','runtime',{declarationId:'u'}),node('combine','join',{type:'vec4',requireConstant:true})]);
graph.declarations=[{id:'u',kind:'uniform',name:'uValue',type:'vec3',value:[.1,.2,.3]}];
for(const p of 'xyzw')assert.equal(connect(p,'join',p),true);
assert.equal(change(()=>n('join').params.components[0]=.75),true);undo();assert.equal(future.length,1);
rejectsWire('runtime','join','x');rejectsWire('runtime','join','y');

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
assert.ok(creatorVariants(swizzle,back).every(v=>v.outputs.out===typeFamily(v.type)));
assert.ok(creatorPriority({d:catalog.find(d=>d.key==='vector_split')},wire)<creatorPriority({d:catalog.find(d=>d.key==='add')},wire));
const beforePlan=JSON.stringify(graph);creatorTypePlan(combine,variant,'x',wire,false);assert.equal(JSON.stringify(graph),beforePlan);

// Replace replaces overlapping component wires, never their source nodes.
setup([node('vec4','base'),node('vec2','pair'),node('float','scalar'),node('replace','value',{type:'vec4',components:[1,2,3,4]}),node('combine','other')]);
assert.equal(connect('base','value','value'),true);assert.equal(connect('scalar','value','z'),true);assert.equal(connect('scalar','other','x'),true);
before=clone(graph);historySize=past.length;
assert.equal(connect('pair','value','y'),true);assert.equal(past.length,historySize+1);
identical(ports(n('value'),'inputs'),{value:'vec4',x:'float',y:'vec2',w:'float'});
identical(ports(n('value'),'outputs'),{out:'vec4'});
assert.equal(portLabel(n('value'),'inputs','y'),'YZ');assert.ok(n('scalar'));
assert.ok(current().edges.some(e=>e.from[0]==='scalar'&&e.to[0]==='other'));
assert.ok(current().edges.some(e=>e.from[0]==='base'&&e.to[1]==='value'));
assert.ok(!current().edges.some(e=>e.to[0]==='value'&&e.to[1]==='z'));
let after=clone(graph);assert.equal(connect('scalar','value','z'),false);identical(graph,after); // Hidden Z is not a destination.
undo();identical(graph,before);undo(true);identical(graph,after);
assert.equal(change(()=>current().edges=current().edges.filter(e=>e.to[0]!=='value'||e.to[1]!=='y')),true);
identical(ports(n('value'),'inputs'),{value:'vec4',x:'float',y:'float',z:'float',w:'float'});
identical(n('value').params.components,[1,2,3,4]); // Dormant defaults survive baseline/group disconnects.

// Overlapping a wider old group removes that whole wire and releases its tail.
assert.equal(connect('pair','value','z'),true);assert.equal(connect('pair','value','y'),true);
identical(n('value').params.groups,{y:'vec2'});assert.equal(ports(n('value'),'inputs').w,'float');
assert.equal(connect('value','result','color'),true);graphs.push(clone(graph));

// Invalid widths, cycles, baseline type changes, and upstream inference roll back.
assert.equal(change(()=>current().nodes.push(node('vec3','large'),node('add','math'))),true);
before=clone(graph);historySize=past.length;
assert.equal(connect('large','value','w'),false);identical(graph,before);assert.equal(past.length,historySize);
assert.equal(connect('pair','value','value'),false);identical(graph,before);
assert.equal(connect('value','math','a'),true);before=clone(graph);historySize=past.length;
assert.equal(connect('math','value','x'),false);identical(graph,before);assert.equal(past.length,historySize);
for(const key of ['combine','replace']){
  setup([node('float','f'),node('vec2','wide'),node('add','math'),node('float','z'),node(key,'value',{type:'vec4'})]);
  assert.equal(connect('f','math','a'),true);assert.equal(connect('math','value','y'),true);assert.equal(connect('z','value','z'),true);
  rejectsWire('wide','math','a'); // Unrelated Auto inference cannot evict Z.
}

// A fully overridden runtime baseline is dormant; the single whole output
// becomes constant only when every effective component is constant.
setup([node('uniform','runtime',{declarationId:'u'}),node('vec2','fixed'),node('float','f'),node('replace','value',{type:'vec4'}),node('add','need',{type:'vec4',requireConstant:true})]);
graph.declarations=[{id:'u',kind:'uniform',name:'uValue',type:'vec4',value:[.1,.2,.3,.4]}];
assert.equal(connect('runtime','value','value'),true);assert.equal(connect('fixed','value','x'),true);
before=clone(graph);historySize=past.length;
assert.equal(connect('value','need','a'),false);identical(graph,before);assert.equal(past.length,historySize);
assert.equal(connect('fixed','value','z'),true);assert.equal(change(()=>n('value').params.requireConstant=true),true);
assert.equal(connect('value','need','a'),true);assert.equal(connect('need','result','color'),true);graphs.push(clone(graph));
assert.equal(connect('f','value','y'),false); // Y is hidden inside XY.
before=clone(graph);assert.equal(connect('f','value','x'),false);identical(graph,before); // Would release runtime Y and violate const.

// Context-menu creation and direct drops share the same displacement planner.
for(const key of ['combine','replace']){
  setup([node('float','z'),node(key,'value',{type:'vec4'})]);assert.equal(connect('z','value','z'),true);
  const sourceDefinition=catalog.find(d=>d.key==='vec2'),sourceVariant=typeVariants(sourceDefinition)[0],destination=info('value','inputs','y');
  before=clone(graph);creatorTypePlan(sourceDefinition,sourceVariant,'out',destination,false);identical(graph,before);
  creatorState={x:80,y:80,wire:destination};creatorMatches=[{d:sourceDefinition,type:sourceVariant.type,port:'out',variant:sourceVariant}];historySize=past.length;
  chooseCreator(0);assert.equal(past.length,historySize+1);identical(n('value').params.groups,{y:'vec2'});assert.ok(n('z'));
  assert.ok(!current().edges.some(e=>e.from[0]==='z'));combined=clone(graph);undo();identical(graph,before);undo(true);identical(graph,combined);
  assert.equal(connect('value','result','color'),true);graphs.push(clone(graph));
}
const vector=catalog.find(d=>d.key==='vector');identical(vectorPorts(vector.key,{type:'vec2',components:[0,0,0,0]}).inputs,{});

// Existing Split shortcuts are reused without converting old nodes or defaults.
setup([node('uv','uv'),node('vector_split','old',{type:'vec2'})],[edge('uv','old','value')]);
before=clone(graph);addVectorSplit(n('uv'),'out');assert.equal(selected,'old');identical(graph,before);

// All family/dimension insertion presets share one compiler definition, but retain an
// exact dimension through all creation paths and never serialize UI identities.
const vectorEntries=availableEntries().filter(d=>d.key==='vector');
identical(vectorEntries.map(d=>[browserEntryKey(d),d.label,d.presetType]),typeContract.vectors.types.map(type=>['vector:'+type,'Vector '+typeComponents(type)+(typeFamily(type)==='float'?'':' · '+typeFamily(type)),type]));
for(const entry of vectorEntries){
  identical(creatorVariants(entry,null).map(v=>v.type),[entry.presetType]);
  setup([]);assert.equal(change(()=>instantiate(entry,100,100)),true);
  const created=n(selected);assert.equal(created.params.type,entry.presetType);assert.equal(created.definitionUuid,'sgrape.builtin.vector');
  identical(ports(created,'inputs'),{});identical(ports(created,'outputs'),{out:entry.presetType});
  assert.equal(Object.hasOwn(created,'entryKey'),false);assert.equal(Object.hasOwn(created.params,'presetType'),false);
}
for(const key of ['vec2','vec3','vec4'])assert.ok(!availableEntries().some(d=>d.key===key));
const preset3=vectorEntries.find(d=>d.presetType==='vec3'),preset2=vectorEntries.find(d=>d.presetType==='vec2');
assert.ok(creatorPriority({d:preset3,portType:'vec3'},{kind:'inputs',type:'vec3'})<creatorPriority({d:preset2,portType:'float'},{kind:'inputs',type:'vec3'}));
console.log(JSON.stringify({passed:true,graphs}));
`,context);
