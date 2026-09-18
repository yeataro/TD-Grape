const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const payload=JSON.parse(fs.readFileSync(0,'utf8'));
const elements={};
function element(id){return elements[id]||=({value:'all',textContent:'',children:[],append(...x){this.children.push(...x);},replaceChildren(...x){this.children=x;}});}
const context=vm.createContext({console,assert,payload,FunctionModel:{CALL:'sgrape.function.call',INPUT:'sgrape.function.input',OUTPUT:'sgrape.function.output'},
 $:element,t:x=>x,el:(tag,attrs={},text='')=>({tag,attrs,text,children:[],append(x){this.children.push(x);}}),availableEntries:()=>payload.catalog});
vm.runInContext(fs.readFileSync(process.argv[2],'utf8'),context);
vm.runInContext(`
assert.equal(compatible('float','float'),false,'no private fallback before the contract loads');
setTypeContract(payload.contract);
for(const a of [...Object.keys(typeContract.types),'?'])for(const b of [...Object.keys(typeContract.types),'?'])
 assert.equal(compatible(a,b),(a===b&&Object.hasOwn(typeContract.types,a))||(numericTypes().includes(a)&&numericTypes().includes(b)&&(typeComponents(a)===1||typeComponents(a)===typeComponents(b)))||(a==='bool'&&['bvec2','bvec3','bvec4'].includes(b)));
for(const row of payload.rows)for(const kind of ['inputs','outputs'])assert.equal(JSON.stringify(resolvedNodePorts(row.definition,row.params,row.declaration,kind)),JSON.stringify(row.expected[kind]));
const uniform=payload.catalog.find(d=>d.key==='uniform');assert.equal(resolvedNodePorts(uniform,{},null,'outputs').out,'?');
const fn={definitionUuid:FunctionModel.CALL,inputs:{x:'vec2'},outputs:{y:'float'}};assert.equal(resolvedNodePorts(fn,{},null,'inputs').x,'vec2');
const original=JSON.stringify(typeContract);payload.contract.numericTypes.push('bad');assert.equal(JSON.stringify(typeContract),original,'consumer owns a defensive copy');
for(const bad of [{}, {...typeContract,version:2},{...typeContract,conversions:[{from:'?',to:'float',kind:'splat'}]}, {...typeContract,definitions:{bad:{selector:'other',variants:[]}}}]){
 assert.throws(()=>setTypeContract(bad));assert.equal(JSON.stringify(typeContract),original,'invalid refresh must leave prior contract intact');
}
for(const type of valueTypes()){
 const descriptor=typeContract.types[type],size=descriptor.components,family=typeFamily(type),quarter=['float','double'].includes(family)?.25:family==='bool'?true:0;
 if(descriptor.shape==='matrix'){
  assert.equal(JSON.stringify(filledValue(type,.25)),JSON.stringify(Array.from({length:size},(_,i)=>Math.floor(i/descriptor.rows)===i%descriptor.rows?.25:0)));
  assert.equal(JSON.stringify(shapedValue([1,2,3,4],type)),JSON.stringify(Array.from({length:size},(_,i)=>[1,2,3,4][i]??0)));
  assert.equal(JSON.stringify(shapedValue([1,2],type)),JSON.stringify(Array.from({length:size},(_,i)=>[1,2][i]??0)));
  continue;
 }
 const values=family==='bool'?[true,true,true,true]:[1,2,3,4],repeat=family==='bool'?[true,true,true,true]:[1,2,1,1];
 assert.equal(typeComponents(type),size);
 assert.equal(JSON.stringify(filledValue(type,.25)),JSON.stringify(size===1?quarter:Array(size).fill(quarter)));
 assert.equal(JSON.stringify(shapedValue([1,2,3,4],type)),JSON.stringify(size===1?values[0]:values.slice(0,size)));
 assert.equal(JSON.stringify(shapedValue([1,2],type)),JSON.stringify(size===1?repeat[0]:repeat.slice(0,size)));
}
for(const type of ['int','uint','bool'])assert.equal(typeComponents(type),1);
for(const type of ['?','toString'])assert.throws(()=>typeComponents(type));
for(const types of [undefined,{}, {...typeContract.types,float:{family:'float',components:0}}, {...typeContract.types,float:{family:'float',components:2.5}}, {...typeContract.types,float:{family:'bool',components:1}}]){
 assert.throws(()=>setTypeContract({...typeContract,types}));assert.equal(JSON.stringify(typeContract),original);
}
// A restricted overload menu must follow the supplied definition, not all numeric types.
const restricted=JSON.parse(original),add=payload.catalog.find(d=>d.key==='add');
restricted.definitions[add.definitionUuid].variants=restricted.definitions[add.definitionUuid].variants.filter(v=>v.type==='vec4');
setTypeContract(restricted);assert.equal(JSON.stringify(selectableNodeTypes(add)),JSON.stringify(['vec4']));setTypeContract(JSON.parse(original));
console.log(payload.rows.length+' port rows match the core contract');
`,context);
