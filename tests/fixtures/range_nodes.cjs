const {node,edge}=require('./shared_subgraphs.cjs');
function rangeCases(){
 const cases=[];
 for(const type of ['float','vec2','vec3','vec4'])for(const scalar of type==='float'?[false]:[false,true])for(const key of ['min','max','clamp','smoothstep']){
  const shape=values=>type==='float'?values[0]:values.slice(0,Number(type.slice(-1)));
  const specs={min:[['a',shape([.2,.8,.5,.9]),type],['b',scalar?.4:shape([.6,.3,.7,.45]),scalar?'float':type]],
   max:[['a',shape([.2,.8,.5,.9]),type],['b',scalar?.4:shape([.6,.3,.7,.45]),scalar?'float':type]],
   clamp:[['value',shape([.1,.8,.5,.9]),type],['min',scalar?.2:shape([.1,.2,.3,.4]),scalar?'float':type],['max',scalar?.75:shape([.4,.9,.8,.7]),scalar?'float':type]],
   smoothstep:[['edge0',scalar?.2:shape([.1,.2,.3,.4]),scalar?'float':type],['edge1',scalar?.8:shape([.5,.8,.9,1]),scalar?'float':type],['value',shape([.3,.6,.55,.9]),type]]}[key];
  const graph={schemaVersion:1,target:'top',declarations:[],topInputs:[],functions:[],stages:{pixel:{nodes:[],edges:[]}}},data=graph.stages.pixel;
  for(const [name,value,t]of specs){data.nodes.push(node('input_'+name,t,{value}));data.edges.push(edge('input_'+name,'operation','out',name));}
  data.nodes.push(node('operation',key,{type,inputTypes:Object.fromEntries(specs.map(([name,,t])=>[name,t]))}));
  let output='operation';
  if(type!=='float'&&type!=='vec4'){
   data.nodes.push(node('result_length','length',{type}),{...node('scaled','divide',{type:'float'}),inputValues:{b:Math.sqrt(Number(type.slice(-1)))}});
   data.edges.push(edge(output,'result_length','out','value'),edge('result_length','scaled'));output='scaled';
  }
  data.nodes.push(node('output','pixel_out'));data.edges.push(edge(output,'output','out','color'));
  cases.push({key,type,scalar,graph});
 }
 return cases;
}
module.exports={rangeCases};
