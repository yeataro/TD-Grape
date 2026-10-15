/** Compile graph-owned subgraphs through a bounded, disposable expansion.
 * Node modules own interfaces; no imported library or DOM state is consulted. */
import { copy, formatProblem, type Graph, type Node, type NetworkData, type SubgraphData } from './model';
import { CORE_CONFIG, type CoreConfig } from './config';
import { createRegistry, contextFor, resolvePorts, type Registry, type NodeModule } from './node_module';
import { validInterface, requireSubgraph } from './subgraph_interface';
import { subgraphStageTable, subgraphGroups } from './subgraph_stages';
import { types, type, opaque } from './values';
import { declarationKinds } from './declarations';
import { validNodeName } from './node_names';

interface Location {node:string;stage:string;trail:string[];subgraphId?:string}
interface Compiled {
  vertex:string;pixel:string;bindings:unknown[];
  sourceMap:{pixel:{node:string;stage:string;trail:string[];line:number}[];variables:Record<string,string>;declarations:Record<string,string>;
    /** The subgraph path of a variable's node, for the variables inside a subgraph (TECH-6). 子圖裡的變數，其節點所在的子圖路徑。 */
    variableTrails?:Record<string,string[]>};
  diagnostics:{node:string;stage:string;message:string}[];
  stages:unknown;
}
interface Engine {supports(g:Graph):boolean;compile(g:Graph,identifiers?:{reservedNames:readonly string[]}):Compiled}

const relay:NodeModule = {
  catalog:{
    definition:{key:'subgraph_relay',nodeType:'grape.internal.subgraph_relay',label:'Subgraph value',inputs:{},outputs:{},stages:['pixel'],defaults:{},descriptionKey:''},
    emitter:{id:'subgraph_relay',version:1},browser:{}
  },
  role:'value',
  supports:n=>types.includes(String(n.params.type))||opaque.includes(String(n.params.type)),
  ports:n=>[
    {key:'value',direction:'input',type:String(n.params.type)},
    {key:'out',direction:'output',type:String(n.params.type)}
  ],
  validate:n=>{if(!opaque.includes(String(n.params.type)))type(n.params.type);},
  // An opaque relay with nothing wired in passes "nothing" on (its output stays undefined), so the consumer inside or
  // outside sees an unconnected texture and applies its own rule, e.g. Texture 2D's opaque black (amendment B5).
  // 沒接線的 opaque 中繼把「沒有」往下傳（輸出留空），裡面或外面的使用者看到的就是未接貼圖，走它自己的規則（如 Texture 2D 的不透明黑）。
  emit:(n,c)=>({outputs:{out:opaque.includes(String(n.params.type))&&!c.connected('value')?undefined:c.input('value')}})
};

export function createSubgraphCompiler(registry:Registry,engineFactory:(registry:Registry)=>Engine,config:CoreConfig=CORE_CONFIG) {
  const engine = engineFactory(createRegistry([...registry.modules,relay]));
  const identity = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
  const moduleOf = (node:Node) => registry.get(node.nodeType);
  function supports(g:Graph):boolean {
    if (formatProblem(g) || g.target!=='top' || Object.keys(g.stages).join()!=='pixel' ||
        g.structDefinitions?.length || !Array.isArray(g.subgraphs) || g.subgraphs.length>config.subgraphDefinitions) return false;
    // Declarations follow the same rule as the flat compiler (top_compiler.ts): a known kind must carry a type it supports,
    // an unknown kind is kept and never read (Q44). Texture inputs pass through subgraph interfaces as opaque ports (A8 §5 item 8).
    // 宣告規則同平面編譯器：認得的 kind 型別要合、不認得的保留不讀；貼圖輸入以 opaque 接口穿過子圖。
    if (!g.declarations.every(d=>!declarationKinds.has(d.kind)||declarationKinds.get(d.kind)!.types.includes(d.type))) return false;
    const pixel=g.stages.pixel!,stagesOf=stageLookup(g);
    if (!usableNetwork(g,pixel,undefined,stagesOf)) return false;
    // Only the definitions the stage reaches through its instances are checked (amendment A8, TECH-3): an unused one never blocks the
    // graph; its problems are shown in the Subgraphs panel (unusableSubgraphs). 只檢查 Stage 經由實例走得到的定義：沒用到的不擋整張圖；
    // 它的問題在子圖面板顯示。
    // The stage table is built only when an instance reaches something (Codex 3rd check: a graph with no instances reads no definitions).
    // 有實例走得到東西才建 Stage 表（沒有實例的圖不讀任何定義）。
    const used=reachable(g,pixel,stagesOf);
    return [...used].every(id=>{const f=g.subgraphs!.find(item=>item.id===id);return !f||usableDefinition(g,f,stagesOf);});
  }
  /** The stage table, built on first use only (Codex 3rd check: a graph whose instances reach nothing reads no definitions). Stage 表，
   * 第一次用到才建（實例走不到任何定義的圖不讀定義）。 */
  function stageLookup(g:Graph):(id:string)=>string[] {
    let table:((id:string)=>string[])|undefined;
    return id=>(table??=subgraphStageTable(g,registry))(id);
  }
  /** A ghost (design-interview Q37 1-1; the flat compiler's rule, top_compiler.ts supports, and the editor's, connectivity.ts): a node
   * this build does not know, one that does not belong to the pixel stage, an instance whose content cannot run there, one its module does
   * not support, or one whose ports cannot be worked out. It is kept and left out of code generation, never a reason to refuse the
   * graph; its wires count as not connected. Ghost：這一版不認得的節點、不屬於 pixel 的、內容不能在那裡跑的實例、模組不支援的、算不出接孔的。
   * 保留、不產碼，絕不是拒絕整張圖的理由；接到它的線當作沒接。 */
  function ghost(g:Graph,n:Node,owner:SubgraphData|undefined,stagesOf:(id:string)=>string[]):boolean {
    const module=moduleOf(n);
    if (!module) return true;
    const own=module.catalog.definition.stages;
    if (own && !own.includes('pixel')) return true;
    const ref=module.referencedGraph?.(n);
    if (ref!==undefined && !stagesOf(ref).includes('pixel')) return true;
    const context=contextFor(g,owner);
    if (!module.supports(n,context)) return true;
    try { resolvePorts(module,n,context); } catch { return true; }
    return false;
  }
  function usableNetwork(g:Graph,data:NetworkData|undefined,owner:SubgraphData|undefined,stagesOf:(id:string)=>string[]):boolean {
    if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.edges) || data.nodes.length>config.nodesPerNetwork || data.edges.length>config.edgesPerNetwork || data.ui?.frames) return false;
    // Ghosts are kept but never emitted, so they do not block this path (as the flat compiler). Ghost 不產碼，不擋這條路（同平面編譯器）。
    return data.nodes.every(n=>ghost(g,n,owner,stagesOf)||!n.params.requireConstant);
  }
  // Where a subgraph can run comes from its content (Q46); the target is each node's own check. 子圖能用的 Stage 由內容推算；target 由每個節點自己檢查。
  function usableDefinition(g:Graph,f:SubgraphData,stagesOf:(id:string)=>string[]):boolean {
    // The whole interface is checked (types, defaults, IDs, duplicates, count), not the types alone (Codex R115-1): what code
    // generation would refuse is what the Subgraphs panel reports. 驗整個接口（型別、預設值、ID、重複、數量），不只型別：產碼會拒絕的，
    // 就是子圖面板要回報的。
    if (!validInterface(f)) return false;
    try { requireSubgraph(contextFor(g),f.id); } catch { return false; }
    return stagesOf(f.id).includes('pixel') && usableNetwork(g,f.graph,f,stagesOf);
  }
  /** The definitions the network's instances reach, nested instances followed; a ghost instance reaches nothing. 網路的實例走得到的定義，巢狀
   * 一路跟進；Ghost 實例走不到任何東西。 */
  function reachable(g:Graph,data:NetworkData,stagesOf:(id:string)=>string[]):Set<string> {
    const byId=new Map((g.subgraphs??[]).map(f=>[f.id,f])),found=new Set<string>();
    const walk=(nodes:readonly Node[],owner:SubgraphData|undefined)=>{for(const n of nodes){const ref=moduleOf(n)?.referencedGraph?.(n);
      if(ref!==undefined&&!found.has(ref)&&!ghost(g,n,owner,stagesOf)){found.add(ref);const f=byId.get(ref);if(f&&Array.isArray(f.graph?.nodes))walk(f.graph.nodes,f);}}};
    if(Array.isArray(data.nodes))walk(data.nodes,undefined);
    return found;
  }
  /** The definitions that cannot be used in this host (amendment A8): what code generation would refuse, and those on a cycle of
   * instances (R113-1: a cycle cannot be expanded). For the Subgraphs panel, never a reason to refuse the graph. 在目前 host 用不了的定義：
   * 產碼會拒絕的，以及在實例循環上的（循環展不開）。給子圖面板標示，不是拒絕整張圖的理由。 */
  function unusableSubgraphs(g:Graph):Set<string> {
    const {stagesOf,cyclic}=subgraphGroups(g,registry);
    return new Set((g.subgraphs??[]).filter(f=>cyclic.has(f.id)||!usableDefinition(g,f,id=>[...stagesOf(id)])).map(f=>f.id));
  }

  function compile(g:Graph,identifiers?:{reservedNames:readonly string[]}):Compiled {
    if (!supports(g)) throw Error('Graph is outside the selected frontend compiler capability');
    if (JSON.stringify(g).length>config.documentBytes) throw Error('Graph is too large');
    const definitions=new Map<string,SubgraphData>();
    for (const f of g.subgraphs!) {
      if (!identity.test(f.id)||definitions.has(f.id)) throw Error('Invalid or duplicate Subgraph ID');
      if (typeof f.name!=='string'||!f.name.length||f.name.length>80) throw Error('Invalid Subgraph definition');
      definitions.set(f.id,f);
    }
    const stagesOf=stageLookup(g),active=new Set<string>(),done=new Set<string>();
    function visit(id:string):void {
      if (active.has(id)) throw Error('Subgraph reference cycle: '+id);
      if (done.has(id)) return;
      const f=definitions.get(id);if (!f) throw Error('Missing Subgraph: '+id);
      active.add(id);
      for (const n of f.graph.nodes) {const child=moduleOf(n)?.referencedGraph?.(n);if(child&&!ghost(g,n,f,stagesOf))visit(child);}
      active.delete(id);done.add(id);
    }
    const used=reachable(g,g.stages.pixel!,stagesOf);
    // Only the definitions in use have their interface checked here (A8); the rest are the Subgraphs panel's to report.
    // 只有用到的定義在這裡驗接口（A8）；其餘由子圖面板回報。
    for (const id of used) {if(definitions.has(id))requireSubgraph(contextFor(g),id);visit(id);}

    function expanded(probe?:SubgraphData) {
      const flat:NetworkData={nodes:[],edges:[]},origins=new Map<string,Location>();
      const used=new Set(g.stages.pixel!.nodes.flatMap(n=>[n.id,n.name||n.id]));let sequence=0;
      const allocate=()=>{let id;do{id='sgf'+ ++sequence;}while(used.has(id));used.add(id);return id;};
      const location=(n:Node,path:string[]):Location=>({node:n.id,stage:'pixel',trail:[...path],...(path.length?{subgraphId:path[path.length-1]}:{})});
      const add=(n:Node,origin:Location)=>{
        if(flat.nodes.length>=config.expandedNodes)throw Error('Expanded Subgraph graph exceeds '+config.expandedNodes+' nodes');
        flat.nodes.push(n);origins.set(n.id,origin);
      };
      type End=readonly [string,string];
      type Endpoints={inputs:Record<string,End>;outputs:Record<string,End>};
      function expand(data:NetworkData,path:string[],owner?:SubgraphData,boundary?:Endpoints):void {
        const context=contextFor(g,owner),maps=new Map<string,Endpoints>(),names=new Set<string>(),ghosts=new Set<string>();
        let inputCount=0,outputCount=0;
        for (const node of data.nodes) {
          const origin=location(node,path);
          try {
            if(!identity.test(node.id)||maps.has(node.id)||ghosts.has(node.id))throw Error('Invalid or duplicate node ID');
            // A ghost is kept in the graph and left out here (Q37 1-1). Ghost 留在圖裡，這裡跳過。
            if(ghost(g,node,owner,stagesOf)){ghosts.add(node.id);continue;}
            if(node.name!==undefined){
              if(!identifiers||!validNodeName(node.name,identifiers.reservedNames)||names.has(node.name))throw Error('Invalid or duplicate node name');
              names.add(node.name);
            }
            const module=moduleOf(node)!;
            module.validate(node,context);
            const ports=resolvePorts(module,node,context);
            const ref=module.referencedGraph?.(node);
            if(module.role==='subgraph-input'||module.role==='subgraph-output'){
              if(!boundary)throw Error('Subgraph ports belong inside a Subgraph');
              const endpoints=module.role==='subgraph-input'?boundary.inputs:boundary.outputs;
              for(const endpoint of Object.values(endpoints)){
                const target=flat.nodes.find(n=>n.id===endpoint[0])!;
                // A boundary's comment follows its relay so the note stays at the boundary in GLSL.
                // 邊界節點的 comment 跟著中繼節點，GLSL 裡註解仍在邊界的位置。
                if(typeof node.comment==='string'&&node.comment.trim())
                  target.comment=[target.comment,node.comment].filter(Boolean).join('\n');
              }
              if(module.role==='subgraph-input'&&Object.keys(node.inputValues||{}).length)
                throw Error('Invalid Subgraph port defaults');
              if(module.role==='subgraph-input') {inputCount++;maps.set(node.id,{inputs:{},outputs:boundary.inputs});}
              else {
                outputCount++;maps.set(node.id,{inputs:boundary.outputs,outputs:{}});
                for(const [key,value] of Object.entries(node.inputValues||{})){
                  const endpoint=boundary.outputs[key],target=endpoint&&flat.nodes.find(n=>n.id===endpoint[0]);
                  if(!target||!target.inputValues)throw Error('Invalid Subgraph port defaults');
                  target.inputValues.value=copy(value);
                  origins.set(endpoint[0],origin);
                }
              }
            } else if(ref){
              const fn=definitions.get(ref);if(!fn)throw Error('Missing Subgraph: '+ref);
              const mapped:Endpoints={inputs:{},outputs:{}},inside:Endpoints={inputs:{},outputs:{}};
              for(const key of Object.keys(node.inputValues||{}))if(!ports.inputs[key])throw Error('Invalid Subgraph input values');
              for(const direction of ['inputs','outputs'] as const)for(const p of fn[direction]){
                const id=allocate(),value=direction==='inputs'?node.inputValues?.[p.id]??p.default:p.default;
                add({id,nodeType:relay.catalog.definition.nodeType!,params:{type:p.type},
                  ...(value===undefined?{}:{inputValues:{value:copy(value)}}),
                  ...(node.ui?{ui:copy(node.ui)}:{}),...(node.comment?{comment:node.comment}:{})},origin);
                mapped[direction][p.id]=[id,direction==='inputs'?'value':'out'];
                inside[direction][p.id]=[id,direction==='inputs'?'out':'value'];
              }
              maps.set(node.id,mapped);expand(fn.graph,[...path,fn.id],fn,inside);
            } else {
              if(owner&&module.role==='output')throw Error('Use Subgraph boundaries inside a Subgraph');
              const authored=copy(node),id=owner?allocate():node.id;authored.id=id;
              // Authored identifiers are scope-local; generated names remain unique.
              if(owner&&authored.name)authored.name=(id+'_'+authored.name).slice(0,48);
              add(authored,origin);
              maps.set(node.id,{inputs:Object.fromEntries(Object.keys(ports.inputs).map(p=>[p,[id,p]])),outputs:Object.fromEntries(Object.keys(ports.outputs).map(p=>[p,[id,p]]))});
            }
          } catch(error) {throw Object.assign(error instanceof Error?error:Error(String(error)),origin);}
        }
        if(owner&&(inputCount!==1||outputCount!==1))throw Object.assign(Error('Exactly one Subgraph Input and Output are required'),{stage:'pixel',trail:path,subgraphId:owner.id});
        for(const edge of data.edges){
          const source=maps.get(edge.from[0]),target=maps.get(edge.to[0]);
          // A wire from or to a ghost is a ghost wire: not connected here (Q37 1-3). 接到 Ghost 的線是 Ghost 線：這裡當作沒接。
          if((!source&&ghosts.has(edge.from[0]))||(!target&&ghosts.has(edge.to[0])))continue;
          if(!source||!target)throw Object.assign(Error('Connection endpoint no longer exists'),{node:edge.to[0],stage:'pixel',trail:path,...(owner?{subgraphId:owner.id}:{})});
          const from=source.outputs[edge.from[1]],to=target.inputs[edge.to[1]];
          // A wire to a port its node no longer has is a ghost wire (Q37 1-3, TECH-2): kept in the graph, not connected here.
          // 接到節點已經沒有的接孔的線是 Ghost 線：圖裡保留，這裡當作沒接。
          if(!from||!to)continue;
          flat.edges.push({id:'x'+flat.edges.length,from,to});
        }
      }
      if(probe){
        const inside:Endpoints={inputs:{},outputs:{}};
        for(const direction of ['inputs','outputs'] as const)for(const p of probe[direction]){
          const id=allocate();add({id,nodeType:relay.catalog.definition.nodeType!,params:{type:p.type},...(p.default===undefined?{}:{inputValues:{value:copy(p.default)}})},{node:'',stage:'pixel',trail:[probe.id],subgraphId:probe.id});
          inside[direction][p.id]=[id,direction==='inputs'?'out':'value'];
        }
        expand(probe.graph,[probe.id],probe,inside);
        const output=registry.modules.find(m=>m.role==='output')!;
        add({id:allocate(),nodeType:output.catalog.definition.nodeType!,params:copy(output.catalog.definition.defaults)},{node:'',stage:'pixel',trail:[]});
      } else expand(g.stages.pixel!,[]);
      const {subgraphs,...rest}=g;
      const document:Graph={...rest,stages:{pixel:flat}};
      try {
        const result=engine.compile(document,identifiers);
        return {...result,
          sourceMap:{pixel:result.sourceMap.pixel.map(row=>({...row,...origins.get(row.node)})),
            // A variable inside an expanded subgraph leads to the node the person sees. 展開的子圖裡的變數找回人看得到的節點。
            variables:Object.fromEntries(Object.entries(result.sourceMap.variables).map(([name,id])=>[name,origins.get(id)?.node??id])),
            variableTrails:Object.fromEntries(Object.entries(result.sourceMap.variables).flatMap(([name,id])=>{const trail=origins.get(id)?.trail;return trail?.length?[[name,[...trail]]]:[];})),
            declarations:result.sourceMap.declarations},
          diagnostics:result.diagnostics.map(row=>({...row,...origins.get(row.node)}))};
      } catch(error){
        const e=error as Error&{node?:string};const origin=e.node&&origins.get(e.node);
        if(origin)Object.assign(e,origin);throw e;
      }
    }
    // Each reachable definition is also expanded on its own, so a problem inside is reported at the definition (an unused one is
    // the Subgraphs panel's to show, A8). 每份走得到的定義也單獨展開一次，裡面的問題在定義上回報（沒用到的由子圖面板顯示）。
    for(const id of used){const fn=definitions.get(id);if(fn)expanded(fn);}
    return expanded();
  }
  return {supports,compile,unusableSubgraphs};
}
