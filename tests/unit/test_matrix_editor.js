/* Matrix editor contracts and geometry-independent value semantics; no DOM or TD. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const payload=JSON.parse(fs.readFileSync(process.argv[2]||0,'utf8').replace(/^\uFEFF/,'')),dir=path.resolve(__dirname,'../../src/editor');
const elements=new Map(),element=key=>{if(!elements.has(key))elements.set(key,{value:'all',textContent:'',title:'',hidden:false,disabled:false,focus(){},replaceChildren(){},setAttribute(){},addEventListener(){},classList:{add(){},remove(){},toggle(){}}});return elements.get(key);};
const context=vm.createContext({assert,payload,console,crypto:globalThis.crypto,location:{pathname:'/',hash:''},history:{replaceState(){}},window:{addEventListener(){},getSelection(){return null;}},document:{addEventListener(){},querySelector:element,querySelectorAll:()=>[]},sessionStorage:{getItem(){return '';},setItem(){}},setTimeout(){return 1;},clearTimeout(){}});
for(const name of ['functions_model.js','functions_ui.js','graph_ui.js','inspector.js'])vm.runInContext(fs.readFileSync(path.join(dir,name),'utf8'),context);
const app=fs.readFileSync(path.join(dir,'app.js'),'utf8');vm.runInContext(app.slice(0,app.indexOf("$('#canvas').addEventListener('dragover'")),context);
vm.runInContext(`
render=()=>{};wires=()=>{};renderGraphEditActions=()=>{};inspector=()=>{};renderNavigation=()=>{};renderNativeSourceValues=()=>{};refreshUniforms=()=>{};
catalog=payload.catalog;setTypeContract(payload.typeContract||payload.contract);editorTarget='top';
const same=(a,b)=>assert.equal(JSON.stringify(a),JSON.stringify(b)),matrixTypes=valueTypes().filter(isMatrixType);
assert.equal(matrixTypes.length,18);assert.equal(typeForShape('float',4),'vec4');assert.equal(typeForShape('double',4),'dvec4');assert.equal(validScalarValue(.125,'double'),true);
same(shapedValue(2,'mat2'),[2,0,0,2]);same(shapedValue(1,'mat2x3'),[1,0,0,0,1,0]);
const conversion=catalog.find(d=>d.key==='convert');
assert.ok(creatorVariants(conversion,{kind:'outputs',type:'mat2'}).some(v=>v.outputs.out==='vec4'));
assert.ok(creatorVariants(conversion,{kind:'inputs',type:'mat2'}).some(v=>v.inputs.value==='vec4'));
same(resolvedNodePorts(conversion,{fromType:'mat2',toType:'vec4'},null,'outputs'),{out:'vec4'});
assert.throws(()=>resolvedNodePorts(conversion,{fromType:'vec3',toType:'mat2'},null,'outputs'));
assert.equal(creatorVariants(conversion,{kind:'outputs',type:'float'}).some(v=>v.outputs.out==='vec4'),true);
same(matrixReshapeValue([1,2,3,4,5,6],'mat2x3','mat3x2'),[1,2,4,5,0,0]);
same(matrixReshapeValue([1,2,3,4],'mat2','dmat4'),[1,2,0,0,3,4,0,0,0,0,1,0,0,0,0,1]);
for(const type of matrixTypes){
  const shape=typeContract.types[type],column=typeForShape(shape.family,shape.rows),all=matrixPorts('matrix_combine',{type});
  assert.equal(Object.keys(all.inputs).length,shape.columns*(shape.rows+1));
  for(let c=0;c<shape.columns;c++){assert.equal(all.inputs['c'+c],column);for(const r of 'xyzw'.slice(0,shape.rows))assert.equal(all.inputs['c'+c+r],shape.family);}
  same(matrixPorts('matrix_split',{type}).outputs,all.inputs);same(matrixPorts('matrix',{type}),{inputs:{},outputs:{out:type}});
  assert.equal(matrixPorts('matrix_replace',{type}).inputs.value,type);
  for(const indexType of ['int','uint'])for(const mode of ['column','element']){
    const read=matrixAccessPorts('matrix_get',{type,mode,indexType}),write=matrixAccessPorts('matrix_set',{type,mode,indexType});
    assert.equal(read.inputs.column,indexType);assert.equal(read.inputs.row,mode==='element'?indexType:undefined);assert.equal(read.outputs.out,mode==='element'?shape.family:column);
    assert.equal(write.inputs.replacement,read.outputs.out);assert.equal(write.outputs.out,type);
  }
  const d=catalog.find(d=>d.key==='matrix'),n={id:'matrix',definitionUuid:d.definitionUuid,params:{type,values:shapedValue(1,type)},ui:{}};
  graph={stages:{pixel:{nodes:[n],edges:[]}},functions:[],declarations:[]};stage='pixel';graphTrail=[];
  same(matrixColumnValues(n,0),shapedValue(1,type).slice(0,shape.rows));
  for(let c=0;c<shape.columns;c++)for(let r=0;r<shape.rows;r++)assert.equal(matrixComponentWritable(n,c,r),true);
}
const d=catalog.find(d=>d.key==='matrix_combine'),n={id:'combine',definitionUuid:d.definitionUuid,params:{type:'mat3',values:[1,2,3,4,5,6,7,8,9]},ui:{}};
graph={stages:{pixel:{nodes:[n],edges:[]}},functions:[],declarations:[]};stage='pixel';graphTrail=[];
const baseline=clone(n.params.values);reshapeTypedInputs(n,d,'mat2');same(n.params.values,[1,2,4,5]);reshapeTypedInputs(n,d,'mat3');same(n.params.values,baseline);
reshapeTypedInputs(n,d,'mat2');n.params.values[1]=22;reshapeTypedInputs(n,d,'mat3');same(n.params.values,[1,22,3,4,5,6,7,8,9]);n.params.values=clone(baseline);
current().edges=[{from:['source','out'],to:[n.id,'c0']}];assert.equal(matrixComponentWritable(n,0,1),false);assert.equal(matrixComponentWritable(n,1,1),true);
current().edges.push({from:['scalar','out'],to:[n.id,'c1y']});assert.equal(matrixComponentWritable(n,1,1),false);assert.equal(matrixComponentWritable(n,1,0),true);
n.definitionUuid=catalog.find(d=>d.key==='matrix_replace').definitionUuid;current().edges.push({from:['base','out'],to:[n.id,'value']});
for(let c=0;c<3;c++)for(let r=0;r<3;r++)assert.equal(matrixComponentWritable(n,c,r),false);
same(n.params.values,baseline);
const invalid=clone(typeContract);invalid.types.mat3.rows=2;assert.throws(()=>setTypeContract(invalid));
const missingPair=clone(typeContract);delete missingPair.convert.pairs.mat3;assert.throws(()=>setTypeContract(missingPair));
const unknownPair=clone(typeContract);unknownPair.convert.pairs.mat3.push('unknown');assert.throws(()=>setTypeContract(unknownPair));
const make=(key,id,params)=>({id,definitionUuid:catalog.find(d=>d.key===key).definitionUuid,params,ui:{}});
const join=make('matrix_combine','join',{type:'mat3',values:shapedValue(1,'mat3'),requireConstant:true}),runtime=make('uniform','runtime',{declarationId:'runtime'}),constant=make('scalar','constant',{type:'float',value:4});
graph={declarations:[{id:'runtime',kind:'uniform',name:'runtime',type:'vec3',value:[0,0,0]}],functions:[],stages:{pixel:{nodes:[join,runtime,constant],edges:[{from:['runtime','out'],to:['join','c0']},...Array.from('xyz',p=>({from:['constant','out'],to:['join','c0'+p]}))]}}};
same(constantRequirementIssues(graph),[]);graph.stages.pixel.edges.pop();assert.equal(constantRequirementIssues(graph).length,1);
assert.throws(()=>matrixAccessPorts('matrix_get',{type:'mat3',mode:'rows'}));assert.throws(()=>matrixAccessPorts('matrix_set',{type:'mat3',indexType:'float'}));
console.log(JSON.stringify({passed:true,matrixTypes:matrixTypes.length,checks:10}));
`,context);
