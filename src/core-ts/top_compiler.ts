/** First whole-graph compiler slice. No browser, TD or Python dependency. */
namespace GrapeTopCompiler {
  type Type = 'float'|'vec2'|'vec3'|'vec4';
  type Value = null|boolean|number|string|Value[]|{[key:string]:Value};
  type ObjectValue = {[key:string]:Value};
  export interface Node {id:string;definitionUuid:string;params:ObjectValue;name?:string;inputValues?:ObjectValue;ui?:ObjectValue}
  export interface Declaration {id:string;kind:string;name:string;type:string;value:Value;[key:string]:Value}
  export interface Graph {schemaVersion:number;target:string;declarations:Declaration[];functions?:unknown[];topInputs?:unknown[];typeDefinitions?:unknown[];stages:Record<string,{nodes:Node[];edges:GrapeWirePlanning.Edge[];ui?:ObjectValue}>}
  interface Definition {kind:'literal'|'vector'|'uniform'|'binary'|'unary'|'output';type?:Type;operator?:string;port?:string;defaults?:Record<string,number>;constant?:boolean}
  // Ordinary nodes using these primitives extend this one registry. The build
  // also exports its IDs for the receiver; there is no second handwritten list.
  export const definitions:Readonly<Record<string,Definition>>={
    float:{kind:'literal',type:'float'},vec2:{kind:'literal',type:'vec2'},vec3:{kind:'literal',type:'vec3'},vec4:{kind:'literal',type:'vec4',constant:true},color:{kind:'literal',type:'vec4'},
    scalar:{kind:'literal'},vector:{kind:'vector',constant:true},uniform:{kind:'uniform'},
    add:{kind:'binary',operator:'+',defaults:{a:0,b:0}},subtract:{kind:'binary',operator:'-',defaults:{a:0,b:0}},
    multiply:{kind:'binary',operator:'*',defaults:{a:0,b:0}},divide:{kind:'binary',operator:'/',defaults:{a:0,b:1}},
    abs:{kind:'unary',operator:'abs',port:'value'},pixel_out:{kind:'output'}
  };
  export const protocol='grape.top.ts.1';
  const types:readonly string[]=['float','vec2','vec3','vec4'];
  const key=(n:Node)=>n.definitionUuid.replace(/^sgrape\.builtin\./,'');
  function type(value:unknown):Type {if(!types.includes(String(value)))throw Error('Unsupported numeric type');return value as Type;}
  function count(t:Type):number {return t==='float'?1:Number(t.slice(-1));}
  function object(v:Value|undefined):ObjectValue|undefined {return v!==null&&typeof v==='object'&&!Array.isArray(v)?v:undefined;}
  export function supports(g:Graph):boolean {
    if(g.schemaVersion!==1||g.target!=='top'||Object.keys(g.stages).join()!=='pixel'||g.functions?.length||g.topInputs?.length||g.typeDefinitions?.length)return false;
    if(g.stages.pixel?.ui?.frames)return false;
    if(!g.declarations.every(d=>d.kind==='uniform'&&types.includes(d.type)&&!d.initialDriver&&!d.sourceMissing&&!['array','matrix'].includes(String(d.nativeSequence))))return false;
    // Legacy allocates collision suffixes for implicit IDs versus explicit
    // names. Keep those whole graphs on its path until symbol allocation moves.
    const symbols=g.stages.pixel?.nodes.filter(n=>key(n)!=='pixel_out').map(n=>n.name||n.id)||[];
    if(new Set(symbols).size!==symbols.length)return false;
    return !!g.stages.pixel?.nodes.every(n=>{
      const d=definitions[key(n)];if(!n.definitionUuid.startsWith('sgrape.builtin.')||!d)return false;
      if(n.ui?.label||n.ui?.comment||n.params.requireConstant||n.params.nativeFinishing||n.params.convertColorSpace||n.params.dither||n.params.alphaTest||n.params.bufferCount&&n.params.bufferCount!==1)return false;
      if(n.params.type!==undefined&&!types.includes(String(n.params.type)))return false;
      if(key(n)==='scalar'&&n.params.type!==undefined&&n.params.type!=='float')return false;
      if(key(n)==='vector'&&!['vec2','vec3','vec4'].includes(String(n.params.type)))return false;
      return Object.values(object(n.params.operandTypes)||{}).every(t=>types.includes(String(t)));
    });
  }
  function number(value:Value|undefined):string {
    if(typeof value!=='number'||!Number.isFinite(value)||Math.abs(value)>1e20)throw Error('Expected a finite number in supported range');
    // GLSL literals are rounded to the existing compiler's nine significant
    // decimal digits. Exponent padding is textual only, not a numeric change.
    if(Object.is(value,-0))return '-0.0';
    if(value===0)return '0.0';
    const parts=Math.abs(value).toExponential(8).split('e'),exponent=Number(parts[1]);
    let significand=Number(parts[0]!.replace('.',''));
    // JS rounds exact decimal halfway cases away from zero; Python's .9g uses
    // ties-to-even. Correct only an exactly representable halfway value. A
    // rounded binary approximation of a decimal midpoint must not count as one.
    const power=exponent-8,midpoint=2*significand-1;
    const exact=power<0?midpoint%Math.pow(5,-power)===0:midpoint*Math.pow(5,power)<=Number.MAX_SAFE_INTEGER;
    if(significand%2&&exact&&Math.abs(value)===(significand-.5)*Math.pow(10,power))significand--;
    const digits=String(significand).replace(/0+$/,'');
    let s:string;
    if(exponent<-4||exponent>=9)s=digits[0]+(digits.length>1?'.'+digits.slice(1):'')+'e'+(exponent<0?'-':'+')+String(Math.abs(exponent)).padStart(2,'0');
    else if(exponent<0)s='0.'+'0'.repeat(-exponent-1)+digits;
    else s=digits.length<=exponent+1?digits+'0'.repeat(exponent+1-digits.length)+'.0':digits.slice(0,exponent+1)+'.'+digits.slice(exponent+1);
    return (value<0?'-':'')+s;
  }
  function literal(value:Value|undefined,t:Type):string {
    if(t==='float')return number(value);
    if(!Array.isArray(value)||value.length!==count(t))throw Error('Expected '+count(t)+' components');
    return t+'('+value.map(number).join(', ')+')';
  }
  function fill(value:number,t:Type):Value {return t==='float'?value:Array.from({length:count(t)},()=>value);}
  export function compile(g:Graph){
    if(!supports(g))throw Error('Graph is outside the selected frontend compiler capability');
    const data=g.stages.pixel!;if(data.nodes.length>256||data.edges.length>1024||JSON.stringify(g).length>512000)throw Error('Graph is too large');
    const nodes=new Map<string,Node>(),ports:Record<string,{in:Record<string,Type>;out:Record<string,Type>}>=Object.create(null);
    const declarations=new Map<string,Declaration>(),names=new Set<string>();
    for(const d of g.declarations){
      if(!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(d.id)||declarations.has(d.id)||!/^[A-Za-z][A-Za-z0-9_]{0,47}$/.test(d.name)||/^(gl_|TD|sg_|sTD)/.test(d.name)||names.has(d.name))throw Error('Invalid declaration identity/name');
      if(d.id==='grapeFallbackSampler'||d.nativeSequence!==undefined&&!['vec','color'].includes(String(d.nativeSequence))||d.initialDriver!==undefined)throw Error('Unsupported native Uniform source');
      if(d.expose!==undefined&&typeof d.expose!=='boolean')throw Error('Expose must be a boolean');
      if(d.exposeName!==undefined&&(typeof d.exposeName!=='string'||d.exposeName.length>80||/[\x00-\x1f]/.test(d.exposeName)))throw Error('Invalid public Uniform label');
      literal(d.value,type(d.type));declarations.set(d.id,d);names.add(d.name);
    }
    const symbols=new Set<string>();
    for(const n of data.nodes){
      if(!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(n.id)||nodes.has(n.id))throw Error('Invalid or duplicate node ID');
      const symbol=n.name||n.id;if(!/^[A-Za-z][A-Za-z0-9_]*$/.test(symbol)||symbols.has(symbol))throw Error('Invalid or duplicate node name');symbols.add(symbol);nodes.set(n.id,n);
      const d=definitions[key(n)]!;let t=d.type||type(n.params.type||'float');const inputs:Record<string,Type>={};
      if(d.kind==='uniform'){const decl=declarations.get(String(n.params.declarationId));if(!decl)throw Error('Select a matching declaration');t=type(decl.type);}
      if(d.kind==='literal')literal(n.params.value,t);
      if(d.kind==='vector'){if(!Array.isArray(n.params.components)||n.params.components.length!==4)throw Error('Vector needs four stored components');n.params.components.forEach(number);literal(n.params.components.slice(0,count(t)),t);}
      if(d.kind==='binary'){const operand=object(n.params.operandTypes);if(n.params.operandTypes!==undefined&&(!operand||Object.keys(operand).sort().join()!=='a,b'))throw Error('Invalid arithmetic operands');inputs.a=type(operand?.a??t);inputs.b=type(operand?.b??t);if(inputs.a!==inputs.b||t!==inputs.a)throw Error('Invalid arithmetic signature');}
      if(d.kind==='unary')inputs[d.port!]=t;
      if(d.kind==='output'){for(const flag of ['nativeFinishing','convertColorSpace','dither','alphaTest'])if(n.params[flag]!==undefined&&typeof n.params[flag]!=='boolean')throw Error('Output finishing must be a boolean');inputs.color='vec4';}
      ports[n.id]={in:inputs,out:d.kind==='output'?{}:{out:t}};
      for(const [p,v]of Object.entries(n.inputValues||{})){if(!inputs[p])throw Error('Unknown input default');literal(v,inputs[p]);}
    }
    const outputs=data.nodes.filter(n=>definitions[key(n)]!.kind==='output');if(outputs.length!==1)throw Error('Exactly one Pixel Output is required');
    const incoming=new Map<string,GrapeWirePlanning.Edge[]>(),links=new Map<string,GrapeWirePlanning.Edge>();
    for(const e of data.edges){const from=ports[e.from[0]]?.out[e.from[1]],to=ports[e.to[0]]?.in[e.to[1]],k=e.to.join(':');
      if(!from||!to)throw Error('Connection endpoint no longer exists');if(links.has(k))throw Error('An input can only have one connection');
      if(from!==to&&from!=='float')throw Error(from+' cannot connect to '+to);links.set(k,e);
      const list=incoming.get(e.to[0])||[];list.push(e);incoming.set(e.to[0],list);
    }
    const order:string[]=[],visited=new Set<string>(),active=new Set<string>();
    function visit(id:string){if(active.has(id))throw Error('Cycle detected');if(visited.has(id))return;active.add(id);
      for(const e of [...(incoming.get(id)||[])].sort((a,b)=>a.to[1]<b.to[1]?-1:1))visit(e.from[0]);active.delete(id);visited.add(id);order.push(id);}
    // Validate disconnected cycles too, then separately select the live closure.
    for(const id of nodes.keys())visit(id);visited.clear();order.length=0;visit(outputs[0]!.id);
    const used=new Set<string>(),lines:string[]=[],lineNodes:string[]=[],expressions=new Map<string,string>();
    for(const id of order){const n=nodes.get(id)!,d=definitions[key(n)]!,p=ports[id]!,t=p.out.out;const start=lines.length;
      const input=(port:string)=>{const target=p.in[port]!,edge=links.get(id+':'+port);if(edge){const value=expressions.get(edge.from[0])!;return ports[edge.from[0]]!.out.out===target?value:target+'('+value+')';}
        return literal(n.inputValues?.[port]??(d.kind==='output'?[0,0,0,1]:fill(d.defaults?.[port]||0,target)),target);};
      let expression='';
      if(d.kind==='literal')expression=literal(n.params.value,t!);
      if(d.kind==='vector')expression=literal((n.params.components as Value[]).slice(0,count(t!)),t!);
      if(d.kind==='uniform'){const decl=declarations.get(String(n.params.declarationId))!;used.add(decl.id);expression=decl.name;}
      if(d.kind==='binary')expression='('+input('a')+' '+d.operator+' '+input('b')+')';
      if(d.kind==='unary')expression=d.operator+'('+input(d.port!)+')';
      if(d.kind==='output')lines.push('    vec4 sg_color = '+input('color')+';','    fragColor = TDOutputSwizzle(sg_color);');
      else {const symbol='sg_n_'+(n.name||id);lines.push('    '+(d.constant?'const ':'')+t+' '+symbol+' = '+expression+';');expressions.set(id,symbol);}
      while(lineNodes.length<lines.length)lineNodes.push(id);if(lines.length===start)throw Error('Node emitted no expression');
    }
    const bindings:Declaration[]=[...used].sort().map(id=>JSON.parse(JSON.stringify(declarations.get(id)!)) as Declaration);
    const headers=bindings.map(d=>'uniform '+d.type+' '+d.name+';');
    const pixel=[...headers,'layout(location=0) out vec4 fragColor;','void main() {','    vec2 sg_uv = vUV.st;',...lines,'}',''].join('\n');
    const diagnostics=data.nodes.filter(n=>!visited.has(n.id)).sort((a,b)=>a.id<b.id?-1:1).map(n=>({node:n.id,stage:'pixel',message:'Disconnected node is not emitted'}));
    const sourceMap={pixel:lineNodes.map((node,i)=>({node,stage:'pixel',trail:[],line:headers.length+4+i}))};
    return {vertex:'',pixel,bindings,sourceMap,stages:{pixel:{lines,ports,live:[...visited].sort()}},diagnostics};
  }
}
