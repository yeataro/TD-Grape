import {CORE_CONFIG,type CoreConfig} from './config';
import { createSubgraphCompiler } from './subgraph_compiler';
/** Whole-graph orchestration. Concrete node modules are injected by composition. */
import {GraphDocument,GraphError,type Port,type Edge} from './graph';
import {object,type Node,type Graph,type Declaration} from './model';
import {type,literal,policy} from './values';
import {types} from './numeric';
import type {Registry} from './node_module';
import {appendNodeComments} from './comments';
export type {Graph,Node,Declaration} from './model';
export interface IdentifierRules {reservedNames:readonly string[]}
export class CompilationError extends Error {
  readonly stage='pixel';readonly trail:string[]=[];
  constructor(message:string,readonly node?:string){super(message);this.name='CompilationError';}
}
export const protocol='grape.top.ts.1';
type FlatLimits={nodes:number;edges:number;bytes:number};
function createFlatCompiler(registry:Registry,limits:FlatLimits){
  function supports(g:Graph):boolean {
    if(g.schemaVersion!==1||g.target!=='top'||Object.keys(g.stages).join()!=='pixel'||g.functions?.length||g.topInputs?.length||g.typeDefinitions?.length)return false;
    if(!g.stages.pixel||g.stages.pixel.nodes.length>limits.nodes||g.stages.pixel.edges.length>limits.edges)return false;
    if(g.stages.pixel?.ui?.frames)return false;
    if(!g.declarations.every(d=>d.kind==='uniform'&&types.includes(d.type)&&!d.initialDriver&&!d.sourceMissing&&!['array','matrix'].includes(String(d.nativeSequence))))return false;
    // Legacy allocates collision suffixes for implicit IDs versus explicit
    // names. Keep those whole graphs on its path until symbol allocation moves.
    const symbols=g.stages.pixel?.nodes.filter(n=>registry.get(n.definitionUuid)?.role!=='output').map(n=>n.name||n.id)||[];
    if(new Set(symbols).size!==symbols.length)return false;
    return !!g.stages.pixel?.nodes.every(n=>{
      const d=registry.get(n.definitionUuid);if(!d)return false;
      if(n.params.requireConstant)return false;
      return d.supports(n,{declaration:id=>g.declarations.find(d=>d.id===id)});
    });
  }
  function compile(g:Graph,identifiers?:IdentifierRules){
    let errorNode:string|undefined;
    try {
    if(!supports(g))throw Error('Graph is outside the selected frontend compiler capability');
    // Catalog provenance is checked by the delivery adapter, not graph traversal.
    const {catalogSnapshot,...document}=g as Graph&{catalogSnapshot?:unknown};
    const model=new GraphDocument(document,registry),network=model.networks.get('pixel')!;
    const data=model.document.stages.pixel!;if(data.nodes.length>limits.nodes||data.edges.length>limits.edges||JSON.stringify(g).length>limits.bytes)throw Error('Graph is too large');
    const nodes=new Map<string,Node>(),ports:Record<string,{in:Record<string,string>;out:Record<string,string>}>=Object.create(null);
    const declarations=new Map<string,Declaration>(),names=new Set<string>();
    for(const d of g.declarations){
      if(!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(d.id)||declarations.has(d.id)||!/^[A-Za-z][A-Za-z0-9_]{0,47}$/.test(d.name)||/^(gl_|TD|sg_|sTD)/.test(d.name)||names.has(d.name))throw Error('Invalid declaration identity/name');
      if(d.id==='grapeFallbackSampler'||d.nativeSequence!==undefined&&!['vec','color'].includes(String(d.nativeSequence))||d.initialDriver!==undefined)throw Error('Unsupported native Uniform source');
      if(d.expose!==undefined&&typeof d.expose!=='boolean')throw Error('Expose must be a boolean');
      if(d.exposeName!==undefined&&(typeof d.exposeName!=='string'||d.exposeName.length>80||/[\x00-\x1f]/.test(d.exposeName)))throw Error('Invalid public Uniform label');
      literal(d.value,type(d.type));declarations.set(d.id,d);names.add(d.name);
    }
    const symbols=new Set<string>(),authoredNames=new Set<string>();
    for(const n of data.nodes){
      errorNode=n.id;
      if(!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(n.id)||nodes.has(n.id))throw Error('Invalid or duplicate node ID');
      if(n.name!==undefined){if(!identifiers||!/^[A-Za-z][A-Za-z0-9_]{0,47}$/.test(n.name)||n.name.includes('__')||/^(gl_|TD|sTD|uTD|sg_|[iu]?sampler|[iu]?image|d?mat[234])/.test(n.name)||identifiers.reservedNames.includes(n.name)||authoredNames.has(n.name))throw Error('Invalid or duplicate node name');authoredNames.add(n.name);}
      const d=registry.get(n.definitionUuid)!,symbol=n.name||n.id;
      if(d.role!=='output'){if(symbols.has(symbol))throw Error('Duplicate output symbol');symbols.add(symbol);}nodes.set(n.id,n);
      if(n.inputValues!==undefined&&!object(n.inputValues))throw Error('Invalid input default values');
      if(n.params.requireConstant!==undefined&&typeof n.params.requireConstant!=='boolean')throw Error('Require Constant must be a boolean');
      d.validate(n,model.context);
      const resolved=network.node(n.id).interface;
      const projected=resolved.types();
      ports[n.id]={in:projected.inputs,out:projected.outputs};
      for(const [p,v]of Object.entries(n.inputValues||{})){if(!resolved.inputs[p])throw Error('Unknown input default');literal(v,type(resolved.inputs[p]!.type));}
    }
    errorNode=undefined;
    const outputs=network.nodes.filter(n=>n.definition!.role==='output');if(outputs.length!==1)throw Error('Exactly one Pixel Output is required');
    const links=new Map<Port,Edge>();
    for(const edge of network.edges){
      const target=edge.to!,source=edge.from!;errorNode=target.node.id;
      const checked=edge.connection(policy),k=target;
      if(!checked.valid)throw Error(checked.reason==='missing-port'?'Connection endpoint no longer exists':source.type+' cannot connect to '+target.type);
      if(links.has(k))throw Error('An input can only have one connection');links.set(k,edge);
    }
    const inputsUsed=new Map<string,Set<string>>();
    for(const node of network.nodes){
      const module=node.definition!;
      if(module.inputsUsed){
        const connected=new Set(node.inputs.filter(p=>links.has(p)).map(p=>p.key));
        const used=module.inputsUsed(node.data!,connected,model.context);
        if(used.some(key=>!node.interface.inputs[key]))throw Error('Module uses an unknown input');
        inputsUsed.set(node.id,new Set(used));
      }
    }
    const order=network.order(outputs[0]!.id,e=>!inputsUsed.has(e.to[0])||inputsUsed.get(e.to[0])!.has(e.to[1])),visited=new Set(order.map(n=>n.id));
    const used=new Set<string>(),lines:string[]=[],lineNodes:string[]=[],expressions=new Map<Port,string>();
    for(const node of order){const n=node.data!,id=node.id,d=node.definition!,p=node.interface;const start=lines.length;
      errorNode=id;
      const input=(key:string)=>{const port=p.inputs[key];if(!port)throw Error('Unknown input port: '+key);
        const edge=links.get(node.port('input',key));if(edge){const source=edge.from!,value=expressions.get(source);
          if(value===undefined)throw Error('Source emitted no output: '+source.key);
          return source.type===port.type?value:port.type+'('+value+')';}
        return literal(n.inputValues?.[key]??port.default,type(port.type));};
      if(!d.emit)throw Error('Structural nodes require Subgraph expansion');
      const emission=d.emit(n,{...model.context,ports:p,input,connected:key=>links.has(node.port('input',key)),useUniform:declId=>{
        const declaration=declarations.get(declId);if(!declaration)throw Error('Select a matching declaration');used.add(declId);return declaration.name;
      }});
      if(Object.keys(emission.outputs).sort().join()!==Object.keys(p.outputs).sort().join())throw Error('Module emitted a different output interface');
      if(emission.statements)lines.push(...emission.statements);
      for(const [port,expression] of Object.entries(emission.outputs)){
        const symbol='sg_n_'+(n.name||id)+(port==='out'?'':'_'+port);
        lines.push('    '+(emission.constant?'const ':'')+p.outputs[port]!.type+' '+symbol+' = '+expression+';');expressions.set(node.port('output',port),symbol);
      }
      if(lines.length===start)throw Error('Node emitted no expression');
      appendNodeComments(lines,start,n.ui||{});
      while(lineNodes.length<lines.length)lineNodes.push(id);
    }
    const bindings:Declaration[]=[...used].sort().map(id=>JSON.parse(JSON.stringify(declarations.get(id)!)) as Declaration);
    const headers=bindings.map(d=>'uniform '+d.type+' '+d.name+';');
    const pixel=[...headers,'layout(location=0) out vec4 fragColor;','void main() {','    vec2 sg_uv = vUV.st;',...lines,'}',''].join('\n');
    const diagnostics=data.nodes.filter(n=>!visited.has(n.id)).sort((a,b)=>a.id<b.id?-1:1).map(n=>({node:n.id,stage:'pixel',message:'Disconnected node is not emitted'}));
    const sourceMap={pixel:lineNodes.map((node,i)=>({node,stage:'pixel',trail:[],line:headers.length+4+i}))};
    return {vertex:'',pixel,bindings,sourceMap,stages:{pixel:{lines,ports,live:[...visited].sort()}},diagnostics};
    } catch(error) {throw new CompilationError(error instanceof Error?error.message:String(error),error instanceof GraphError?error.node:errorNode);}
  }
  return Object.freeze({protocol,supports,compile});
}

/** Code-generation fingerprint (design-interview Q38 2-1): everything the generated program
 * depends on, minus authored layout and notes. Node `ui` only adds GLSL comment lines and
 * labels (comments.ts), so by the human's rule B it is outside the chain; edge ids and the
 * edge sequence never reach GLSL. Equal keys must mean the same program apart from comment
 * lines; tests/unit/test_codegen_key.cjs checks this on random edit sequences.
 * 產碼指紋：產出的程式所依賴的一切，扣掉版面與註記。節點 ui 只帶來 GLSL 註解與標籤（規則 B，不在鏈路）；
 * 線的 id 與序號不進 GLSL。指紋相同＝除註解行外程式相同，由隨機編輯的性質測試把關。 */
export function codegenKey(g:Graph):string {
  const network=(data:{nodes?:unknown[];edges?:unknown[];[key:string]:unknown}|undefined)=>data&&{...data,edgeSequence:undefined,
    nodes:(data.nodes||[]).map(n=>({...(n as object),ui:undefined})),
    edges:(data.edges||[]).map(e=>({...(e as object),id:undefined}))};
  return JSON.stringify({...g,stages:Object.fromEntries(Object.entries(g.stages||{}).map(([k,v])=>[k,network(v as never)])),
    functions:(g.functions||[]).map(f=>({...f,graph:network(f.graph as never)}))});
}

export function createCompiler(registry:Registry,config:CoreConfig=CORE_CONFIG){
  const flat=createFlatCompiler(registry,{nodes:config.nodesPerNetwork,edges:config.edgesPerNetwork,bytes:config.documentBytes});
  const subgraphs=createSubgraphCompiler(registry,r=>createFlatCompiler(r,{nodes:config.expandedNodes,edges:config.expandedEdges,bytes:config.documentBytes}),config);
  return Object.freeze({protocol,key:codegenKey,
    supports:(g:Graph)=>g.functions?.length?subgraphs.supports(g):flat.supports(g),
    compile:(g:Graph,identifiers?:IdentifierRules)=>g.functions?.length?subgraphs.compile(g,identifiers):flat.compile(g,identifiers)
  });
}
