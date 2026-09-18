/* Real connection plans and edit transactions; only DOM/network work is stubbed. */
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
const edge=(from,to,port,out='out')=>({from:[from,out],to:[to,port]});
function setup(nodes,edges=[]){graph={schemaVersion:1,target:'top',topSourceVersion:1,topInputs:[],declarations:[],functions:[],stages:{pixel:{nodes:[...nodes,node('pixel_out','result')],edges}}};graphTrail=[];past=[];future=[];selected=null;selection.clear();selectedEdge=null;dirty=false;}
const n=id=>current().nodes.find(n=>n.id===id),d=key=>catalog.find(d=>d.key===key);
const info=(id,kind,port)=>({node:id,kind,port,type:ports(n(id),kind)[port]});
const connect=(a,b,p,o='out')=>connectPorts(info(a,'outputs',o),info(b,'inputs',p));
const identical=(a,b)=>assert.equal(JSON.stringify(a),JSON.stringify(b));
function rejectsWire(a,b,p,o='out'){const before=clone({graph,past,future,dirty});assert.equal(connect(a,b,p,o),false);identical({graph,past,future,dirty},before);}

assert.equal(supportsAutoType(d('compare')),true);assert.equal(supportsAutoType(d('if')),true);
// Matrix/double operation overloads follow the additive value-type batch.
const legacyValueTypes=valueTypes().filter(type=>typeFamily(type)!=='double'&&!isMatrixType(type));
identical(selectableNodeTypes(d('compare')),['float','int','uint']);identical(selectableNodeTypes(d('if')),legacyValueTypes);
for(const ty of selectableNodeTypes(d('compare'))){const compare=node('compare','compare',{type:ty});assert.equal(defaultInput(compare,'a',ty),0);assert.equal(defaultInput(compare,'b',ty),0);identical(resolvedNodePorts(d('compare'),compare.params,null,'outputs'),{out:'bool'});}
for(const ty of legacyValueTypes){const branch=node('if','branch',{type:ty});assert.equal(defaultInput(branch,'condition','bool'),false);identical(defaultInput(branch,'true',ty),filledValue(ty,1));identical(defaultInput(branch,'false',ty),filledValue(ty,0));}

// Only an unconnected Auto Compare uses int. Locked/legacy float and the
// remaining Auto operations retain their existing type/default policies.
setup([node('compare','auto'),node('compare','locked'),node('compare','legacy'),node('add','math'),node('if','branch')]);n('locked').ui.typeMode='locked';delete n('legacy').ui.typeMode;
assert.equal(change(()=>current().nodes.push(node('float','value'))),true);
assert.equal(n('auto').params.type,'int');assert.equal(n('locked').params.type,'float');assert.equal(n('legacy').params.type,'float');assert.equal(n('math').params.type,'float');assert.equal(n('branch').params.type,'float');
assert.equal(connect('value','auto','a'),true);assert.equal(n('auto').params.type,'float');
assert.equal(change(()=>setNodeInputValue(n('auto'),'b',1.75)),true);
const floatConnected=clone(graph);assert.equal(change(()=>current().edges=current().edges.filter(e=>e.to[0]!=='auto')),true);
assert.equal(n('auto').params.type,'int');assert.equal(n('auto').inputValues.b,1);
const intDisconnected=clone(graph);undo();identical(graph,floatConnected);undo(true);identical(graph,intDisconnected);
assert.equal(setMathType(n('auto'),'float'),true);assert.equal(n('auto').inputValues.b,1.75);assert.equal(n('auto').ui.typeMode,'locked');
assert.equal(setMathType(n('auto'),'auto'),true);assert.equal(n('auto').params.type,'int');
assert.equal(connect('value','auto','a'),true);assert.equal(n('auto').params.type,'float');assert.equal(n('auto').inputValues.b,1.75);

// Integer sources preserve exact integer comparison, while defaults retain a
// separate cache for each scalar type across automatic promotion/demotion.
for(const ty of ['int','uint']){
  setup([node('spec_constant','source',{declarationId:'source'}),node('compare','compare')]);
  graph.declarations=[{id:'source',kind:'spec_constant',name:'sValue',type:ty,value:2,constantId:0}];
  n('compare').inputValues={a:.75,b:-2.25};const before=clone(graph);
  assert.equal(connect('source','compare','a'),true);assert.equal(n('compare').params.type,ty);assert.equal(n('compare').inputValues.a,0);assert.equal(n('compare').inputValues.b,ty==='int'?-2:0);assert.equal(past.length,1);
  const typed=clone(graph);undo();identical(graph,before);undo(true);identical(graph,typed);
  current().nodes.push(node('convert','boolCast',{fromType:'bool',toType:'vec4'}));assert.equal(connect('compare','boolCast','value'),true);assert.equal(connect('boolCast','result','color'),true);graphs.push(clone(graph));
  assert.equal(change(()=>current().edges=current().edges.filter(e=>e.to[0]!=='compare')),true);assert.equal(n('compare').params.type,'int');
  assert.equal(setMathType(n('compare'),'float'),true);identical(n('compare').inputValues,{a:.75,b:-2.25});assert.equal(setMathType(n('compare'),'auto'),true);
  assert.equal(connect('source','compare','a'),true);assert.equal(n('compare').params.type,ty);assert.equal(n('compare').inputValues.b,ty==='int'?-2:0);
}

// Auto prioritizes an exact input type; mixed signed/unsigned inputs need one
// cast rather than converting both sides to float. A locked type stays available.
setup([node('spec_constant','signed',{declarationId:'signed'}),node('spec_constant','unsigned',{declarationId:'unsigned'}),node('compare','compare')]);
graph.declarations=[{id:'signed',kind:'spec_constant',name:'sSigned',type:'int',value:-1,constantId:0},{id:'unsigned',kind:'spec_constant',name:'sUnsigned',type:'uint',value:4294967295,constantId:1}];
assert.equal(connect('signed','compare','a'),true);assert.equal(n('compare').params.type,'int');assert.equal(connect('unsigned','compare','b'),true);assert.equal(n('compare').params.type,'int');assert.equal(inputTypeDisplay(n('compare'),'a').conversion,null);assert.equal(inputTypeDisplay(n('compare'),'b').conversion,'cast');current().nodes.push(node('convert','boolCast',{fromType:'bool',toType:'vec4'}));assert.equal(connect('compare','boolCast','value'),true);assert.equal(connect('boolCast','result','color'),true);graphs.push(clone(graph));

// Mixed float/integer input order keeps the pre-existing score/tie-break rules.
for(const first of ['float','int','uint'])for(const second of ['float','int','uint']){
  setup([node('scalar','a',{type:first,value:2}),node('scalar','b',{type:second,value:3}),node('compare','compare')]);
  assert.equal(connect('a','compare','a'),true);assert.equal(n('compare').params.type,first);
  assert.equal(connect('b','compare','b'),true);assert.equal(n('compare').params.type,['float','int','uint'].find(type=>type===first||type===second));
}

setup([node('compare','condition'),node('if','branch'),node('vec3','vector',{value:[.1,.2,.3]}),node('float','scalar'),node('length','length')]);
assert.equal(connect('condition','branch','condition'),true);assert.equal(n('branch').params.type,'float');assert.equal(connect('vector','branch','true'),true);assert.equal(connect('scalar','branch','false'),true);assert.equal(n('branch').params.type,'vec3');
assert.equal(inputTypeDisplay(n('branch'),'false').conversion,'splat');assert.equal(connect('branch','length','value'),true);assert.equal(connect('length','result','color'),true);graphs.push(clone(graph));
const conditionRevision=n('condition').revisionHash;
for(const operator of ['>','>=','<','<=','==','!=']){const previous=clone(graph),count=past.length;if(n('condition').params.operator===operator)continue;assert.equal(change(()=>n('condition').params.operator=operator),true);assert.equal(past.length,count+1);assert.equal(n('condition').revisionHash,conditionRevision);const changed=clone(graph);undo();identical(graph,previous);undo(true);identical(graph,changed);graphs.push(clone(graph));}
rejectsWire('scalar','branch','condition');rejectsWire('vector','condition','a');rejectsWire('condition','condition','a');
assert.equal(change(()=>current().nodes.push(node('compare','other'))),true);rejectsWire('condition','other','a');
assert.throws(()=>creatorTypePlan(d('compare'),typeVariants(d('compare'))[0],'a',info('condition','outputs','out'),false));
assert.equal(change(()=>current().nodes.push(node('vec2','pair'))),true);rejectsWire('pair','branch','false');

// Boolean-to-numeric conversion is always explicit; a numeric value cannot
// replace the strict Boolean condition.
rejectsWire('condition','branch','false');current().nodes.push(node('convert','boolCast',{fromType:'bool',toType:'vec3'}));assert.equal(connect('condition','boolCast','value'),true);assert.equal(connect('boolCast','branch','false'),true);assert.equal(n('branch').params.type,'vec3');graphs.push(clone(graph));
setup([node('compare','condition'),node('if','branch',{type:'vec4'}),node('float','scalar')]);n('branch').ui.typeMode='locked';
assert.equal(connect('condition','branch','condition'),true);assert.equal(connect('scalar','branch','true'),true);assert.equal(n('branch').params.type,'vec4');assert.equal(connect('branch','result','color'),true);graphs.push(clone(graph));

// Graph JSON and clipboard use the regular immutable catalog identities.
const exported=JSON.parse(JSON.stringify(graph));identical(exported,graph);const nodeBefore=clone(n('branch'));
const data=GraphClipboard.decode(GraphClipboard.encode(graph,current(),['branch'],shaderId));
assert.equal(change(()=>GraphClipboard.paste(graph,current(),data,{source:shaderId,stage,target:editorTarget,catalog,types:numericTypes(),anchor:{x:400,y:300}})),true);
const duplicate=current().nodes.find(item=>item.definitionUuid===nodeBefore.definitionUuid&&item.id!==nodeBefore.id);assert.equal(duplicate.revisionHash,nodeBefore.revisionHash);identical(duplicate.params,nodeBefore.params);assert.equal(duplicate.ui.typeMode,'locked');graphs.push(clone(graph));
console.log(JSON.stringify({passed:true,graphs}));
`,context);
