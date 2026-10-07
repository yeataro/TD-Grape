const {node,edge}=require('./shared_subgraphs.cjs');
const {values}=require('../../src/generated/wire_planning.js');
function finish(nodes,edges,result,t){
 if(t!=='float'&&t!=='vec4'){
  if(values.count(t)>1&&values.family(t)!=='bool'){
   nodes.push(node('test_result','notEqual',{type:t}));edges.push(edge(result,'test_result','out','a'));result='test_result';t=values.shaped('bool',values.count(t));
  }
  if(values.count(t)>1){nodes.push(node('test_any','any',{type:t}));edges.push(edge(result,'test_any','out','value'));result='test_any';t='bool';}
  if(t!=='bool'){nodes.push(node('test_compare','compare',{type:t,operator:'>'}));edges.push(edge(result,'test_compare','out','a'));result='test_compare';}
  nodes.push({...node('test_color','if',{type:'float'}),inputValues:{true:.75,false:.25}});edges.push(edge(result,'test_color','out','condition'));result='test_color';
 }
 nodes.push(node('output','pixel_out'));edges.push(edge(result,'output','out','color'));
 return {format:'grape-graph',version:1,target:'top',declarations:[],subgraphs:[],stages:{pixel:{nodes,edges}}};
}
function logicCases(){
 const rows=[],add=(key,type,nodes,edges,result='operation',output=type)=>rows.push({key,type,graph:finish(nodes,edges,result,output)});
 for(const type of ['float','int','uint'])for(const operator of ['>','>=','<','<=','==','!='])
  add('compare',type,[{...node('operation','compare',{type,operator}),inputValues:{a:3,b:2}}],[],'operation','bool');
 for(const type of values.types)for(const condition of [false,true])
  add('if',type,[{...node('operation','if',{type}),inputValues:{condition,true:values.fill(1,type),false:values.fill(0,type)}}],[]);
 for(const key of ['isnan','isinf'])for(const type of ['float','vec2','vec3','vec4'])
  add(key,type,[{...node('operation',key,{type}),inputValues:{value:values.fill(.4,type)}}],[],'operation',values.shaped('bool',values.count(type)));
 for(const key of ['lessThan','lessThanEqual','greaterThan','greaterThanEqual','equal','notEqual'])for(const type of values.vectors){
  if(values.family(type)==='bool'&&!['equal','notEqual'].includes(key))continue;
  add(key,type,[{...node('operation',key,{type}),inputValues:{a:values.fill(1,type),b:values.fill(0,type)}}],[],'operation',values.shaped('bool',values.count(type)));
 }
 for(const key of ['any','all','not'])for(const type of ['bvec2','bvec3','bvec4'])
  add(key,type,[node('source','scalar',{type:'bool',value:true}),node('operation',key,{type})],[edge('source','operation','out','value')],'operation',key==='not'?type:'bool');
 return rows;
}
module.exports={logicCases,finish};
