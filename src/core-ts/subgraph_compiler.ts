/** Compile graph-owned subgraphs through a bounded, disposable expansion.
 * Node modules own interfaces; no imported library or DOM state is consulted. */
import { copy, formatProblem, type Graph, type Node, type NetworkData, type SubgraphData } from './model';
import { CORE_CONFIG, type CoreConfig } from './config';
import { createRegistry, contextFor, resolvePorts, type Registry, type NodeModule } from './node_module';
import { numericInterface, requireSubgraph } from './subgraph_interface';
import { types, type } from './values';
import { types as bindingTypes } from './numeric';

interface Location {node:string;stage:string;trail:string[];subgraphId?:string}
interface Compiled {
  vertex:string;pixel:string;bindings:unknown[];
  sourceMap:{pixel:{node:string;stage:string;trail:string[];line:number}[]};
  diagnostics:{node:string;stage:string;message:string}[];
  stages:unknown;
}
interface Engine {supports(g:Graph):boolean;compile(g:Graph,identifiers?:{reservedNames:readonly string[]}):Compiled}

const relay:NodeModule = {
  catalog:{
    definition:{key:'subgraph_relay',definitionUuid:'grape.internal.subgraph_relay',label:'Subgraph value',inputs:{},outputs:{},stages:['pixel'],defaults:{},descriptionKey:''},
    emitter:{id:'subgraph_relay',version:1},browser:{}
  },
  role:'value',
  supports:n=>types.includes(String(n.params.type)),
  ports:n=>[
    {key:'value',direction:'input',type:String(n.params.type)},
    {key:'out',direction:'output',type:String(n.params.type)}
  ],
  validate:n=>{type(n.params.type);},
  emit:(_n,c)=>({outputs:{out:c.input('value')}})
};

export function createSubgraphCompiler(registry:Registry,engineFactory:(registry:Registry)=>Engine,config:CoreConfig=CORE_CONFIG) {
  const engine = engineFactory(createRegistry([...registry.modules,relay]));
  const identity = /^[A-Za-z][A-Za-z0-9_]{0,63}$/;
  const moduleOf = (node:Node) => registry.get(node.nodeType);
  function supports(g:Graph):boolean {
    if (formatProblem(g) || g.target!=='top' || Object.keys(g.stages).join()!=='pixel' ||
        g.structDefinitions?.length || !Array.isArray(g.subgraphs) || g.subgraphs.length>config.subgraphDefinitions) return false;
    if (!g.declarations.every(d=>d.kind==='uniform'&&bindingTypes.includes(d.type))) return false;
    const scopes:[NetworkData,SubgraphData|undefined][] = [[g.stages.pixel!,undefined],...g.subgraphs.map(f=>[f.graph,f] as [NetworkData,SubgraphData])];
    return scopes.every(([data,owner])=>{
      if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.edges) || data.nodes.length>config.nodesPerNetwork || data.edges.length>config.edgesPerNetwork || data.ui?.frames) return false;
      if (owner && (!numericInterface(owner) || !Array.isArray(owner.stages) || !owner.stages.includes('pixel') || owner.targets&&!owner.targets.includes('top'))) return false;
      const context = contextFor(g,owner);
      return data.nodes.every(n=>{
        const module=moduleOf(n);
        return !!module && !n.params.requireConstant && module.supports(n,context);
      });
    });
  }

  function compile(g:Graph,identifiers?:{reservedNames:readonly string[]}):Compiled {
    if (!supports(g)) throw Error('Graph is outside the selected frontend compiler capability');
    if (JSON.stringify(g).length>config.documentBytes) throw Error('Graph is too large');
    const definitions=new Map<string,SubgraphData>();
    for (const f of g.subgraphs!) {
      if (!identity.test(f.id)||definitions.has(f.id)) throw Error('Invalid or duplicate Subgraph ID');
      if (!['local','library','personal'].includes(f.scope)||typeof f.name!=='string'||!f.name.length||f.name.length>80) throw Error('Invalid Subgraph definition');
      requireSubgraph(contextFor(g),f.id);definitions.set(f.id,f);
    }
    const active=new Set<string>(),done=new Set<string>();
    function visit(id:string):void {
      if (active.has(id)) throw Error('Subgraph reference cycle: '+id);
      if (done.has(id)) return;
      const f=definitions.get(id);if (!f) throw Error('Missing Subgraph: '+id);
      active.add(id);
      for (const n of f.graph.nodes) {const child=moduleOf(n)?.referencedGraph?.(n);if(child)visit(child);}
      active.delete(id);done.add(id);
    }
    for (const id of definitions.keys()) visit(id);

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
        const context=contextFor(g,owner),maps=new Map<string,Endpoints>(),names=new Set<string>();
        let inputCount=0,outputCount=0;
        for (const node of data.nodes) {
          const origin=location(node,path);
          try {
            if(!identity.test(node.id)||maps.has(node.id))throw Error('Invalid or duplicate node ID');
            if(node.name!==undefined){
              if(!identifiers||!/^[A-Za-z][A-Za-z0-9_]{0,47}$/.test(node.name)||node.name.includes('__')||/^(gl_|TD|sTD|uTD|sg_|[iu]?sampler|[iu]?image|d?mat[234])/.test(node.name)||identifiers.reservedNames.includes(node.name)||names.has(node.name))throw Error('Invalid or duplicate node name');
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
                  const endpoint=boundary.outputs[key];if(!endpoint)throw Error('Invalid Subgraph port defaults');
                  flat.nodes.find(n=>n.id===endpoint[0])!.inputValues!.value=copy(value);
                  origins.set(endpoint[0],origin);
                }
              }
            } else if(ref){
              const fn=definitions.get(ref);if(!fn)throw Error('Missing Subgraph: '+ref);
              const mapped:Endpoints={inputs:{},outputs:{}},inside:Endpoints={inputs:{},outputs:{}};
              for(const key of Object.keys(node.inputValues||{}))if(!ports.inputs[key])throw Error('Invalid Subgraph input values');
              for(const direction of ['inputs','outputs'] as const)for(const p of fn[direction]){
                const id=allocate();
                add({id,nodeType:relay.catalog.definition.definitionUuid!,params:{type:p.type},
                  inputValues:{value:copy(direction==='inputs'?node.inputValues?.[p.id]??p.default:p.default)},
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
          const from=maps.get(edge.from[0])?.outputs[edge.from[1]],to=maps.get(edge.to[0])?.inputs[edge.to[1]];
          if(!from||!to)throw Object.assign(Error('Connection endpoint no longer exists'),{node:edge.to[0],stage:'pixel',trail:path,...(owner?{subgraphId:owner.id}:{})});
          flat.edges.push({id:'x'+flat.edges.length,from,to});
        }
      }
      if(probe){
        const inside:Endpoints={inputs:{},outputs:{}};
        for(const direction of ['inputs','outputs'] as const)for(const p of probe[direction]){
          const id=allocate();add({id,nodeType:relay.catalog.definition.definitionUuid!,params:{type:p.type},inputValues:{value:copy(p.default)}},{node:'',stage:'pixel',trail:[probe.id],subgraphId:probe.id});
          inside[direction][p.id]=[id,direction==='inputs'?'out':'value'];
        }
        expand(probe.graph,[probe.id],probe,inside);
        const output=registry.modules.find(m=>m.role==='output')!;
        add({id:allocate(),nodeType:output.catalog.definition.definitionUuid!,params:copy(output.catalog.definition.defaults)},{node:'',stage:'pixel',trail:[]});
      } else expand(g.stages.pixel!,[]);
      const {subgraphs,...rest}=g;
      const document:Graph={...rest,stages:{pixel:flat}};
      try {
        const result=engine.compile(document,identifiers);
        return {...result,
          sourceMap:{pixel:result.sourceMap.pixel.map(row=>({...row,...origins.get(row.node)}))},
          diagnostics:result.diagnostics.map(row=>({...row,...origins.get(row.node)}))};
      } catch(error){
        const e=error as Error&{node?:string};const origin=e.node&&origins.get(e.node);
        if(origin)Object.assign(e,origin);throw e;
      }
    }
    // Retain validation of unused saved definitions; they are editable content.
    for(const fn of definitions.values())expanded(fn);
    return expanded();
  }
  return {supports,compile};
}
