const {node,edge}=require('./shared_subgraphs.cjs');
const {finish}=require('./logic_nodes.cjs');
const {values}=require('../../src/generated/grape_core.js');
function valueNode(id,type,seed=.4){
 const data=values.reshape([seed,0,1,seed],values.shaped(values.family(type),4));
 return values.count(type)===1?node(id,'scalar',{type,value:data[0]}):node(id,'vector',{type,components:data});
}
function vectorCases(){
 const rows=[],add=(key,type,nodes,edges,result='operation',output=type)=>rows.push({key,type,graph:finish(nodes,edges,result,output)});
 for(const t of values.types){
  add('router',t,[valueNode('source',t,1),node('operation','router',{type:t})],[edge('source','operation','out','value')]);
  for(const to of values.types)if(values.explicit(t,to))add('convert',t+'->'+to,[valueNode('source',t,1),node('operation','convert',{fromType:t,toType:to})],[edge('source','operation','out','value')],'operation',to);
 }
 for(const t of values.vectors){
  add('vector',t,[valueNode('operation',t,1)],[]);
  const family=values.family(t),width=values.count(t);
  for(const key of 'xyzw'.slice(0,width))add('vector_split',t+':'+key,[valueNode('source',t,1),node('splitter','vector_split',{type:t}),node('operation','router',{type:family})],[edge('source','splitter','out','value'),edge('splitter','operation',key,'value')],'operation',family);
  for(const mask of ['x','xy','x'.repeat(4),'xyzw'.slice(0,width)])
   add('swizzle',t+':'+mask,[valueNode('source',t,1),node('operation','swizzle',{type:t,mask})],[edge('source','operation','out','value')],'operation',values.shaped(family,mask.length));
  for(const key of ['combine','replace'])for(const grouped of [false,true]){
   const n=node('operation',key,{type:t,components:values.fill(0,values.shaped(family,4)),groups:grouped?{x:values.shaped(family,2)}:{}}),a=grouped?values.shaped(family,2):family;
   const nodes=[valueNode('override',a,1),n],edges=[edge('override','operation','out','x')];
   if(key==='replace'){nodes.push(valueNode('base',t,.25));edges.push(edge('base','operation','out','value'));}
   add(key,t+':'+grouped,nodes,edges,'operation',t);
  }
 }
 add('rgba','vec4',[valueNode('source','vec3',.4),{...node('operation','rgba'),inputValues:{alpha:.7}}],[edge('source','operation','out','rgb')]);
 for(const full of [false,true]){
  const nodes=[node('base','declaration',{declarationId:'base'}),valueNode('pair','vec2',.2),node('operation','replace',{type:'vec4',groups:full?{x:'vec2',z:'vec2'}:{x:'vec2'},components:[0,0,0,1]})];
  const edges=[edge('base','operation','out','value'),edge('pair','operation','out','x'),...(full?[edge('pair','operation','out','z')]:[])];
  add('replace-uniform','vec4:'+full,nodes,edges,'operation','vec4');
  rows.at(-1).graph.declarations=[{id:'base',kind:'uniform',name:'uBase',type:'vec4',value:[.5,.5,.5,.5]}];
 }
 for(const port of ['rgb','r','g','b','a']){
  const t=port==='rgb'?'vec3':'float';add('split',port,[valueNode('source','vec4',.4),node('splitter','split'),node('operation','router',{type:t})],[edge('source','splitter','out','color'),edge('splitter','operation',port,'value')],'operation',t);
 }
 return rows;
}
module.exports={vectorCases,valueNode};
