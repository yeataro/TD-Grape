import {CORE_CONFIG,type CoreConfig} from './config';
import { createSubgraphCompiler } from './subgraph_compiler';
/** Whole-graph orchestration. Concrete node modules are injected by composition. */
import {GraphDocument,GraphError,type Port,type Edge} from './graph';
import {object,formatProblem,type Node,type Graph,type Declaration} from './model';
import {type,literal,policy,opaque} from './values';
import {types} from './numeric';
import type {Registry} from './node_module';
import {appendNodeComments} from './comments';
import {ghostsOf} from './ghosts';
import {declarationKinds} from './declarations';
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
    if(formatProblem(g)||g.target!=='top'||Object.keys(g.stages).join()!=='pixel'||g.subgraphs?.length||g.structDefinitions?.length)return false;
    if(!g.stages.pixel||g.stages.pixel.nodes.length>limits.nodes||g.stages.pixel.edges.length>limits.edges)return false;
    if(g.stages.pixel?.ui?.frames)return false;
    // A kind this build does not know is kept and never read (Q44); its references are ghosts.
    // 不認得的 kind 保留、不讀；引用它的節點是 Ghost。
    if(!g.declarations.every(d=>!declarationKinds.has(d.kind)||declarationKinds.get(d.kind)!.types.includes(d.type)))return false;
    // Legacy allocates collision suffixes for implicit IDs versus explicit
    // names. Keep those whole graphs on its path until symbol allocation moves.
    // Ghost nodes (ghosts.ts) are kept but never emitted, so they neither block this path nor
    // take a symbol. Ghost 節點不產碼：不擋這條路，也不佔名稱。
    const context={declaration:(id:string)=>g.declarations.find(d=>d.id===id)};
    const ghost=(n:Node)=>{const d=registry.get(n.nodeType);
      return !d||!!d.catalog.definition.stages&&!d.catalog.definition.stages.includes('pixel')||!d.supports(n,context as never);};
    const live=g.stages.pixel?.nodes.filter(n=>!ghost(n))||[];
    const symbols=live.filter(n=>registry.get(n.nodeType)?.role!=='output').map(n=>n.name||n.id);
    if(new Set(symbols).size!==symbols.length)return false;
    return live.every(n=>!n.params.requireConstant);
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
    const ghosts=ghostsOf(network,policy);
    const declarations=new Map<string,Declaration>(),names=new Set<string>();
    // Position among declarations of the same ordered kind: the GLSL index (decision 5).
    // 在同種（有順序的）宣告裡的位置＝GLSL 索引。
    const positions=new Map<string,number>(),counts=new Map<string,number>();
    for(const d of g.declarations){
      if(!declarationKinds.has(d.kind))continue;
      if(!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(d.id)||declarations.has(d.id)||!/^[A-Za-z][A-Za-z0-9_]{0,47}$/.test(d.name)||/^(gl_|TD|sg_|sTD)/.test(d.name)||names.has(d.name))throw Error('Invalid declaration identity/name');
      // Old-product fields (initialDriver, nativeSequence, expose, exposeName, sourceMissing) are not read
      // (Q44, Q55: Uniforms have no exposed state). 舊產品欄位不讀；去留由匯入器的對照表處理。
      declarationKinds.get(d.kind)!.validate(d);declarations.set(d.id,d);names.add(d.name);
      if(declarationKinds.get(d.kind)!.ordered){const i=counts.get(d.kind)??0;positions.set(d.id,i);counts.set(d.kind,i+1);}
    }
    const symbols=new Set<string>(),authoredNames=new Set<string>();
    for(const n of data.nodes){
      errorNode=n.id;
      if(!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(n.id)||nodes.has(n.id))throw Error('Invalid or duplicate node ID');
      if(ghosts.nodes.has(n.id))continue;
      if(n.name!==undefined){if(!identifiers||!/^[A-Za-z][A-Za-z0-9_]{0,47}$/.test(n.name)||n.name.includes('__')||/^(gl_|TD|sTD|uTD|sg_|[iu]?sampler|[iu]?image|d?mat[234])/.test(n.name)||identifiers.reservedNames.includes(n.name)||authoredNames.has(n.name))throw Error('Invalid or duplicate node name');authoredNames.add(n.name);}
      const d=registry.get(n.nodeType)!,symbol=n.name||n.id;
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
    const outputs=network.nodes.filter(n=>!ghosts.nodes.has(n.id)&&n.definition!.role==='output');if(outputs.length!==1)throw Error('Exactly one Pixel Output is required');
    const links=new Map<Port,Edge>();
    for(const edge of network.edges){
      // A ghost wire counts as not connected: the input keeps its own value (Q37 1-3).
      if(ghosts.edges.has(edge.id))continue;
      const target=edge.to!,source=edge.from!;errorNode=target.node.id;
      const checked=edge.connection(policy),k=target;
      if(!checked.valid)throw Error(checked.reason==='missing-port'?'Connection endpoint no longer exists':source.type+' cannot connect to '+target.type);
      if(links.has(k))throw Error('An input can only have one connection');links.set(k,edge);
    }
    const inputsUsed=new Map<string,Set<string>>();
    for(const node of network.nodes){
      if(ghosts.nodes.has(node.id))continue;
      const module=node.definition!;
      if(module.inputsUsed){
        const connected=new Set(node.inputs.filter(p=>links.has(p)).map(p=>p.key));
        const used=module.inputsUsed(node.data!,connected,model.context);
        if(used.some(key=>!node.interface.inputs[key]))throw Error('Module uses an unknown input');
        inputsUsed.set(node.id,new Set(used));
      }
    }
    const order=network.order(outputs[0]!.id,e=>!ghosts.edgeData.has(e)&&(!inputsUsed.has(e.to[0])||inputsUsed.get(e.to[0])!.has(e.to[1]))),visited=new Set(order.map(n=>n.id));
    const used=new Set<string>(),lines:string[]=[],lineNodes:string[]=[],expressions=new Map<Port,string>();
    // Which node each variable belongs to (Refactor.63): a name in the GLSL leads back to its node without guessing from
    // the text. 每個變數屬於哪個節點：GLSL 裡的名字不必從文字猜就能找回節點。
    const variables:Record<string,string>={};
    for(const node of order){const n=node.data!,id=node.id,d=node.definition!,p=node.interface;const start=lines.length;
      errorNode=id;
      const input=(key:string)=>{const port=p.inputs[key];if(!port)throw Error('Unknown input port: '+key);
        const edge=links.get(node.port('input',key));if(edge){const source=edge.from!,value=expressions.get(source);
          if(value===undefined)throw Error('Source emitted no output: '+source.key);
          return source.type===port.type?value:port.type+'('+value+')';}
        // Unconnected: the port's fallback expression, else its value. An opaque input has neither,
        // so its module decides what happens without a wire (connected()).
        // 沒接線：用接孔的 fallback 式子，否則用它的值；不透明輸入兩者都沒有，由模組先用 connected() 決定。
        if(port.fallback!==undefined)return port.fallback;
        if(opaque.includes(port.type))throw Error('Nothing is connected to '+key);
        return literal(n.inputValues?.[key]??port.default,type(port.type));};
      if(!d.emit)throw Error('Structural nodes require Subgraph expansion');
      const useDeclaration=(declId:string)=>{
        const declaration=declarations.get(declId);if(!declaration)throw Error('Select a matching declaration');used.add(declId);return declaration.name;
      };
      const referenceDeclaration=(declId:string)=>{
        const declaration=declarations.get(declId),name=useDeclaration(declId),kind=declarationKinds.get(declaration!.kind)!;
        return kind.reference?kind.reference(declaration!,positions.get(declId)!):{out:name};
      };
      const emission=d.emit(n,{...model.context,ports:p,input,connected:key=>links.has(node.port('input',key)),useDeclaration,referenceDeclaration});
      if(Object.keys(emission.outputs).sort().join()!==Object.keys(p.outputs).sort().join())throw Error('Module emitted a different output interface');
      if(emission.statements)lines.push(...emission.statements);
      let passed=false;
      for(const [port,expression] of Object.entries(emission.outputs)){
        // An opaque value cannot live in a local variable: its expression is written where it is used.
        // 不透明的值不能放進區域變數：直接代入使用的地方。
        if(opaque.includes(p.outputs[port]!.type)){expressions.set(node.port('output',port),expression);passed=true;continue;}
        const symbol='sg_n_'+(n.name||id)+(port==='out'?'':'_'+port);
        lines.push('    '+(emission.constant?'const ':'')+p.outputs[port]!.type+' '+symbol+' = '+expression+';');expressions.set(node.port('output',port),symbol);variables[symbol]=id;
      }
      if(lines.length===start&&!passed)throw Error('Node emitted no expression');
      appendNodeComments(lines,start,n.comment);
      while(lineNodes.length<lines.length)lineNodes.push(id);
    }
    // File-scope GLSL comes from each used declaration's kind; only sources go to TD as bindings
    // (a global constant lives in the program, Q41). Ordered kinds (TOP texture inputs) go first, all
    // of them in list order, used or not: each one is an input of the Grape OP (Q44). Uniforms follow,
    // all of them too (`declared`: the TD row lives as long as the declaration).
    // 檔案層級 GLSL 由 kind 產生；只有來源成為綁定交給 TD。有順序的種類（TOP 貼圖輸入）全部照清單順序放前面，
    // 有沒有用到都算：每一筆都是 Grape OP 的輸入接口。Uniform 接著放，也是全部（TD 上那一列跟著宣告存在）。
    const usedDeclarations=[...used].sort().map(id=>declarations.get(id)!);
    const all=[...declarations.values()],kindOf=(d:Declaration)=>declarationKinds.get(d.kind)!;
    const ordered=all.filter(d=>kindOf(d).ordered),declared=all.filter(d=>kindOf(d).declared&&!kindOf(d).ordered);
    const bindings:Declaration[]=[...ordered,...declared,...usedDeclarations.filter(d=>kindOf(d).role==='source'&&!kindOf(d).ordered&&!kindOf(d).declared)]
      .map(d=>JSON.parse(JSON.stringify(d)) as Declaration);
    const headers=usedDeclarations.flatMap(d=>{const kind=declarationKinds.get(d.kind)!;return kind.header?[kind.header(d)]:[];});
    const pixel=[...headers,'layout(location=0) out vec4 fragColor;','void main() {','    vec2 sg_uv = vUV.st;',...lines,'}',''].join('\n');
    const diagnostics=[
      ...data.nodes.filter(n=>!visited.has(n.id)&&!ghosts.nodes.has(n.id)).sort((a,b)=>a.id<b.id?-1:1).map(n=>({node:n.id,stage:'pixel',message:'Disconnected node is not emitted'})),
      ...[...ghosts.nodes].sort(([a],[b])=>a<b?-1:1).map(([node,kind])=>({node,stage:'pixel',message:'Ghost node ('+kind+') is kept but not emitted'})),
      ...data.edges.filter(e=>ghosts.edgeData.has(e)).map(e=>({node:e.to[0],stage:'pixel',message:'Ghost wire to '+e.to[1]+' is treated as not connected'}))];
    const sourceMap={pixel:lineNodes.map((node,i)=>({node,stage:'pixel',trail:[],line:headers.length+4+i})),variables};
    return {vertex:'',pixel,bindings,sourceMap,stages:{pixel:{lines,ports,live:[...visited].sort()}},diagnostics};
    } catch(error) {throw new CompilationError(error instanceof Error?error.message:String(error),error instanceof GraphError?error.node:errorNode);}
  }
  return Object.freeze({protocol,supports,compile});
}

/** Code-generation fingerprint (design-interview Q38 2-1): everything the generated program
 * depends on, minus authored layout and notes. Node `ui` and `comment` only add layout and GLSL
 * comment lines (comments.ts), so by the human's rule B they are outside the chain; edge ids and
 * edge `ui` (Link／Wire style) never reach GLSL, nor do description／comment／userVersion (Q44).
 * Equal keys must mean the same program apart from comment lines; tests/unit/test_codegen_key.cjs
 * checks this on random edit sequences.
 * 產碼指紋：產出的程式所依賴的一切，扣掉版面與註記。節點 ui、comment 只帶來版面與 GLSL 註解（規則 B，不在鏈路）；
 * 線的 id 與樣式、作品說明不進 GLSL。指紋相同＝除註解行外程式相同，由隨機編輯的性質測試把關。 */
export function codegenKey(g:Graph):string {
  const network=(data:{nodes?:unknown[];edges?:unknown[];[key:string]:unknown}|undefined)=>data&&{...data,
    nodes:(data.nodes||[]).map(n=>({...(n as object),ui:undefined,comment:undefined})),
    edges:(data.edges||[]).map(e=>({...(e as object),id:undefined,ui:undefined}))};
  return JSON.stringify({...g,description:undefined,comment:undefined,userVersion:undefined,
    stages:Object.fromEntries(Object.entries(g.stages||{}).map(([k,v])=>[k,network(v as never)])),
    subgraphs:(g.subgraphs||[]).map(f=>({...f,description:undefined,comment:undefined,userVersion:undefined,graph:network(f.graph as never)}))});
}

export function createCompiler(registry:Registry,config:CoreConfig=CORE_CONFIG){
  const flat=createFlatCompiler(registry,{nodes:config.nodesPerNetwork,edges:config.edgesPerNetwork,bytes:config.documentBytes});
  const subgraphs=createSubgraphCompiler(registry,r=>createFlatCompiler(r,{nodes:config.expandedNodes,edges:config.expandedEdges,bytes:config.documentBytes}),config);
  return Object.freeze({protocol,key:codegenKey,
    supports:(g:Graph)=>g.subgraphs?.length?subgraphs.supports(g):flat.supports(g),
    compile:(g:Graph,identifiers?:IdentifierRules)=>g.subgraphs?.length?subgraphs.compile(g,identifiers):flat.compile(g,identifiers)
  });
}
