import { numericTypes, selectedType, reshapeDefaults, fill, type, type Node, type NodeModule, type NodeControl, type Value } from '../node_sdk';

// The ordered fold owns its dynamic interface, editing rules and presentation.
const operators:Record<string,string>={add:'+',subtract:'-',multiply:'*',divide:'/'};
const symbols:Record<string,string>={add:'+',subtract:'−',multiply:'×',divide:'÷'};
const limit=32;
const hasOperator=(value:string)=>Object.prototype.hasOwnProperty.call(operators,value);
function count(n:Node):number {
  const value=n.params.inputCount??3;
  if(typeof value!=='number'||!Number.isInteger(value)||value<2||value>limit)throw Error('Math supports 2–32 inputs');return value;
}
function stored(n:Node):{operator:string;input:number}[] {
  const total=count(n),steps=n.params.steps??Array.from({length:total-1},(_,i)=>({operator:'add',input:i+1}));
  if(!Array.isArray(steps)||steps.length!==total-1)throw Error('Math requires one operation per additional input');
  for(const raw of steps){const step=raw as {operator?:Value;input?:Value};
    if(!step||typeof step.operator!=='string'||!hasOperator(step.operator)||typeof step.input!=='number'||!Number.isInteger(step.input)||step.input<0||step.input>=total)throw Error('Invalid Math operand');
  }
  return steps as {operator:string;input:number}[];
}
function steps(n:Node){
  const rows=stored(n),mode=n.params.mode??'steps',operation=n.params.operation??'add';
  if(!['steps','shared'].includes(String(mode))||typeof operation!=='string'||!hasOperator(operation))throw Error('Invalid Math operation');
  return mode==='shared'?rows.map((_,i)=>({operator:operation,input:i+1})):rows;
}
function name(index:number){let value=index+1,result='';while(value){value--;result=String.fromCharCode(65+value%26)+result;value=Math.floor(value/26);}return result;}
function ports(n:Node){const t=type(n.params.type??'float');return [...Array.from({length:count(n)},(_,i)=>({key:'input'+i,direction:'input' as const,type:t,default:fill(0,t)})),{key:'out',direction:'output' as const,type:t}];}
function formula(n:Node){const rows=steps(n);return n.params.mode==='shared'?['A',...rows.map(s=>name(s.input))].join(' '+symbols[String(n.params.operation??'add')]+' '):rows.reduce((text,s)=>'('+text+' '+symbols[s.operator]+' '+name(s.input)+')','A');}
const mathModule:NodeModule={
  catalog:{definition:{key:'math',label:'Math',inputs:{input0:'T',input1:'T',input2:'T'},outputs:{out:'T'},stages:['vertex','pixel'],defaults:{type:'float',inputCount:3,mode:'steps',operation:'add'},descriptionKey:'help.math',definitionUuid:'sgrape.builtin.math'},emitter:{id:'math',version:1},browser:{category:'math',source:'editor',aliases:['chain','arithmetic','連加','連減','連乘','連除'],glslName:'',secondaryCategories:[],categoryPath:['math','arithmetic']}},
  role:'value',supports:n=>numericTypes.includes(String(n.params.type??'float')),
  ports,validate:n=>{steps(n);type(n.params.type??'float');},
  configure:(n,selection)=>{const before=ports(n);n.params.type=selectedType(n,selection);return reshapeDefaults(n,before,ports(n));},
  edit:(n,command,payload)=>{
    const value=payload as {value?:Value;index?:number;field?:string}|undefined;
    if(command==='mode'||command==='operation')n.params[command]=value?.value??'';
    else if(command==='step'){
      const rows=stored(n).map(s=>({...s})),index=value?.index;
      if(typeof index!=='number'||!Number.isInteger(index)||index<0||index>=rows.length||!['operator','input'].includes(value?.field||''))throw Error('Invalid Math step');
      n.params.steps=rows.map((s,i)=>i===index?{...s,[value!.field!]:value?.value??null}:s);
    }else if(command==='append'){
      const total=count(n);n.params.steps=[...stored(n),{operator:'add',input:total}];n.params.inputCount=total+1;
    }else if(command==='remove'){
      const total=count(n);n.params.steps=stored(n).slice(0,-1).map((s,i)=>s.input===total-1?{...s,input:i+1}:s);n.params.inputCount=total-1;delete n.inputValues?.['input'+(total-1)];
    }else throw Error('Unknown Math command');
    return n;
  },
  presentation:n=>{
    const total=count(n),mode=String(n.params.mode??'steps'),controls:NodeControl[]=[{kind:'select',key:'mode',command:'mode',label:'math.mode',value:mode,options:['steps','shared'].map(value=>({value,label:'math.'+value}))}];
    if(mode==='shared')controls.push({kind:'select',key:'operation',command:'operation',label:'math.operation',value:String(n.params.operation??'add'),options:Object.keys(operators).map(value=>({value,label:'math.'+value}))});
    else stored(n).forEach((s,i)=>controls.push({kind:'row',key:'step'+i,label:String(i+1),literal:true,prefix:i===0?'A':'math.previous',children:[
      {kind:'select',key:'operator'+i,command:'step',args:{index:i,field:'operator'},label:'math.operation',value:s.operator,options:Object.entries(symbols).map(([value,label])=>({value,label,literal:true}))},
      {kind:'select',key:'operand'+i,command:'step',args:{index:i,field:'input'},label:'math.operand',value:String(s.input),numeric:true,options:Array.from({length:total},(_,j)=>({value:String(j),label:name(j),literal:true}))}
    ]}));
    controls.push({kind:'button',key:'remove',command:'remove',label:'math.removeLast',disabled:total<=2},{kind:'hint',key:'hint',label:'math.noteHint'});
    return {controls,portLabels:{inputs:Object.fromEntries(Array.from({length:total},(_,i)=>['input'+i,name(i)])),outputs:{out:'Result'}},note:{key:'mathFormula',text:formula(n)},spare:{direction:'input',key:'input'+total,type:String(n.params.type??'float'),command:'append',count:total,limit,label:'math.addInput',limitLabel:'math.portLimit'}};
  },
  emit:(n,c)=>({outputs:{out:steps(n).reduce((text,s)=>'('+text+' '+operators[s.operator]+' '+c.input('input'+s.input)+')',c.input('input0'))}})
};
export default mathModule;
