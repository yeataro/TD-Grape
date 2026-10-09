import {copy,object,type Node,type Value} from './model';
import type {CatalogRow,NodeModule} from './node_module';
import {input,output,reshapeInputs,values} from './value_nodes';
import {storedOr,componentLetters} from './component_names';

const axes='xyzw';
/** Component partitions are a vector-family concern, never graph-wide inference. */
export function vectorAssembly(catalog:CatalogRow,inherit:boolean):NodeModule {
  function layout(n:Node){
    const t=values.type(n.params.type),width=values.count(t),family=values.family(t),groups=object(n.params.groups)||{};
    if(width<2)throw Error('Expected a vector');
    const parts:{key:string;type:string;start:number;size:number}[]=[];
    for(let start=0;start<width;){
      const key=axes[start]!,type=String(groups[key]||family),size=values.count(values.type(type));
      if(values.family(type)!==family||start+size>width||size===1&&groups[key])throw Error('Invalid component group');
      parts.push({key,type,start,size});start+=size;
    }
    if(Object.keys(groups).some(key=>!parts.some(p=>p.key===key&&p.size>1)))throw Error('Overlapping component groups');
    return parts;
  }
  const components=(n:Node)=>{
    const t=String(n.params.type),v=n.params.components??values.fill(0,values.shaped(values.family(t),4));
    values.literal(v,values.shaped(values.family(t),4));return v as Value[];
  };
  const ports=(n:Node)=>[
    ...(inherit?[input('value',String(n.params.type))]:[]),
    ...layout(n).map(p=>({...input(p.key,p.type),default:p.size===1?components(n)[p.start]:components(n).slice(p.start,p.start+p.size)})),
    output('out',String(n.params.type))
  ];
  return {catalog,role:'value',inheritsComponentNames:true,supports:n=>values.vectors.includes(String(n.params.type)),ports,
    validate:n=>{layout(n);components(n);},
    configure:(n,s)=>{
      if(!('type'in s)||!values.vectors.includes(s.type))throw Error('Invalid assembly output');
      const before=ports(n),old=components(n);n.params.type=s.type;n.params.groups={};
      n.params.components=values.reshape(old,values.shaped(values.family(s.type),4));
      return reshapeInputs(n,before,ports(n));
    },
    wire:(n,key,source)=>{
      if(key==='value'&&inherit)return {node:n,replaceInputs:['value']};
      const parts=layout(n),part=parts.find(p=>p.key===key),size=values.count(values.type(source));
      if(!part||part.start+size>values.count(String(n.params.type)))throw Error('Component group exceeds the output');
      const end=part.start+size,overlap=parts.filter(p=>p.start<end&&p.start+p.size>part.start);
      const groups={...object(n.params.groups)};
      for(const p of overlap)delete groups[p.key];
      if(size>1)groups[key]=values.shaped(values.family(String(n.params.type)),size);
      n.params.groups=groups;
      return {node:n,replaceInputs:overlap.map(p=>p.key)};
    },
    // The wire that made a component group is gone: split it back; the components keep their values (Q65).
    // 造成分量組的線拿掉了：分回去；各分量的值不變（Q65）。
    unwire:(n,key)=>{
      const groups={...object(n.params.groups)};if(!(key in groups))return n;
      delete groups[key];n.params.groups=groups;return n;
    },
    editInput:(n,key,value)=>{
      const part=layout(n).find(p=>p.key===key);
      if(!part){if(!inherit||key!=='value')throw Error('Unknown component');n.inputValues={...n.inputValues,value:copy(value)};return n;}
      values.literal(value,part.type);const next=copy(components(n));
      next.splice(part.start,part.size,...(Array.isArray(value)?value:[value]));n.params.components=next;return n;
    },
    // Each component input reads as the letters it covers, e.g. "RG" for a group (legacy graph_ui.js:1293).
    // 每個分量輸入顯示它涵蓋的字母，例如分組時「RG」（照舊產品）。
    presentation:n=>{
      const parts=layout(n),letters=componentLetters(storedOr(n,'xyzw'),values.count(String(n.params.type)));
      return {selectorLabel:'vector.outputType',
        portLabels:{inputs:Object.fromEntries(parts.map(p=>[p.key,letters.slice(p.start,p.start+p.size)]))},
        components:{inputs:Object.fromEntries(parts.map(p=>[p.key,Array.from({length:p.size},(_,i)=>p.start+i)]))}};
    },
    inputsUsed:(n,connected)=>{
      const parts=layout(n),overrides=parts.filter(p=>connected.has(p.key)).map(p=>p.key);
      return inherit&&connected.has('value')&&overrides.length<parts.length?['value',...overrides]:overrides;
    },
    emit:(n,c)=>{
      const args=layout(n).map(p=>{
        if(!inherit||c.connected(p.key)||!c.connected('value'))return c.input(p.key);
        return '('+c.input('value')+').'+axes.slice(p.start,p.start+p.size);
      });
      return {outputs:{out:String(n.params.type)+'('+args.join(', ')+')'}};
    }
  };
}
