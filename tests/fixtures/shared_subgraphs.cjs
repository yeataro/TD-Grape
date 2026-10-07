const node=(id,key,params={})=>({id,nodeType:'sgrape.'+(key.startsWith('function.')?key:'builtin.'+key),params,ui:{x:0,y:0}});
// Edges always carry an id (Q44); an input takes one wire, so its endpoint names it.
const edge=(a,b,out='out',input='a')=>({id:'e:'+b+'.'+input,from:[a,out],to:[b,input]});
const port=(id,type='float',value=1)=>({id,name:id,type,default:value});
function sharedGraph(){
 const gain={id:'gain',name:'Gain',scope:'local',stages:['pixel'],inputs:[port('value')],outputs:[port('result')],graph:{
  nodes:[node('in','function.input'),node('mul','multiply',{type:'float'}),node('out','function.output')],
  edges:[edge('in','mul','value','a'),edge('mul','out','out','result')]
 }};
 gain.graph.nodes[1].inputValues={b:3};
 const wrapper={id:'wrapper',name:'Wrapper',scope:'local',stages:['pixel'],inputs:[port('value')],outputs:[port('result')],graph:{
  nodes:[node('in','function.input'),node('inner','function.call',{functionId:'gain'}),node('out','function.output')],
  edges:[edge('in','inner','value','value'),edge('inner','out','result','result')]
 }};
 return {format:'grape-graph',version:1,target:'top',declarations:[],subgraphs:[gain,wrapper],stages:{pixel:{
  nodes:[node('source','float',{value:2}),node('first','function.call',{functionId:'gain'}),node('second','function.call',{functionId:'wrapper'}),node('sum','add',{type:'float'}),node('output','pixel_out')],
  edges:[edge('source','first','out','value'),edge('source','second','out','value'),edge('first','sum','result','a'),edge('second','sum','result','b'),edge('sum','output','out','color')]
 }}};
}
module.exports={sharedGraph,node,edge,port};
