/** Pure planning. The application supplies capability data and owns mutation,
 * persistence, history, diagnostics translation, and choosing the supported route.
 * The generated namespace keeps the existing classic-script loader usable.
 */
namespace GrapeWirePlanning {
  export interface Ports { inputs: Readonly<Record<string,string>>; outputs: Readonly<Record<string,string>> }
  export interface Signature extends Ports { type: string; operands?: Readonly<Record<string,string>> }
  export interface Node {
    id: string;
    definition: string;
    stored: Ports;
    arithmetic?: {
      automatic: boolean;
      type: string;
      operands?: Readonly<Record<string,string>>;
      variants: readonly Signature[];
      preferMatchingOperands: boolean;
    };
  }
  export interface Edge { from: readonly [string,string]; to: readonly [string,string] }
  export interface Graph { nodes: readonly Node[]; edges: readonly Edge[] }
  export interface Capabilities {
    components: Readonly<Record<string,number>>;
    conversions: readonly {from:string;to:string}[];
  }
  export interface Endpoint { node: string; port: string }
  export type Intent = {kind:'infer'} | {kind:'wire';from:Endpoint;to:Endpoint};
  export interface Diagnostic { code:'cycle'|'missing-port'|'auto-inputs'|'downstream'; node?:string; sourceType?:string; targetType?:string }
  export interface Inference {
    ports: Map<string,Ports>;
    choices: Map<string,string>;
    operands: Map<string,Readonly<Record<string,string>>|null>;
    issues: Map<string,Diagnostic>;
  }
  export type Result = {ok:true;inference:Inference;edges:readonly Edge[];displaced:readonly Edge[]} | {ok:false;diagnostic:Diagnostic};

  function compatible(source:string|undefined,target:string|undefined,c:Capabilities):boolean {
    return !!source&&!!target&&(source===target&&c.components[source]!==undefined||c.conversions.some(v=>v.from===source&&v.to===target));
  }
  function sameEdge(a:Edge,b:Edge):boolean {return a.from[0]===b.from[0]&&a.from[1]===b.from[1]&&a.to[0]===b.to[0]&&a.to[1]===b.to[1];}
  function adjacency(graph:Graph):Map<string,Edge[]> {
    const incoming=new Map<string,Edge[]>();
    for(const e of graph.edges){let links=incoming.get(e.to[0]);if(!links){links=[];incoming.set(e.to[0],links);}links.push(e);}
    return incoming;
  }
  function infer(graph:Graph,c:Capabilities,previous:Graph):Inference|Diagnostic {
    const nodes=new Map(graph.nodes.map(n=>[n.id,n])),incoming=adjacency(graph);
    const oldNodes=new Map(previous.nodes.map(n=>[n.id,n])),oldIncoming=adjacency(previous);
    const ports=new Map<string,Ports>(),choices=new Map<string,string>(),operands=new Map<string,Readonly<Record<string,string>>|null>(),issues=new Map<string,Diagnostic>();
    // Kahn ordering avoids recursion depth limits on long chains. Original node
    // order breaks ties, preserving variant ranking for disconnected nodes.
    const degrees=new Map<string,number>(),outgoing=new Map<string,string[]>(),ready:Node[]=[];
    for(const n of graph.nodes)degrees.set(n.id,0);
    for(const e of graph.edges)if(nodes.has(e.from[0])&&nodes.has(e.to[0])){
      degrees.set(e.to[0],(degrees.get(e.to[0])||0)+1);
      let peers=outgoing.get(e.from[0]);if(!peers){peers=[];outgoing.set(e.from[0],peers);}peers.push(e.to[0]);
    }
    for(const n of graph.nodes)if(!degrees.get(n.id))ready.push(n);
    for(let i=0;i<ready.length;i++){
      const n=ready[i]!;const policy=n.arithmetic,links=incoming.get(n.id)||[];
      if(!policy)ports.set(n.id,n.stored);
      else {
        const source=(e:Edge)=>ports.get(e.from[0])?.outputs[e.from[1]];
        const lone=links.length===1?source(links[0]!):undefined;
        const prefer=policy.automatic&&policy.preferMatchingOperands&&!!lone;
        const score=(v:Signature)=>links.reduce((sum,e)=>sum+Number(source(e)!==v.inputs[e.to[1]]),0);
        const matching=(v:Signature)=>prefer?Number(v.inputs.a!==lone||v.inputs.b!==lone):0;
        const variants=policy.variants.filter(v=>(policy.automatic||v.type===policy.type)&&links.every(e=>compatible(source(e),v.inputs[e.to[1]],c)));
        variants.sort((a,b)=>score(a)-score(b)||matching(a)-matching(b)||(c.components[a.type]||0)-(c.components[b.type]||0));
        const old=oldNodes.get(n.id),oldLinks=oldIncoming.get(n.id)||[];
        const unchanged=prefer&&old?.definition===n.definition&&old.arithmetic?.automatic&&old.arithmetic.type===policy.type&&JSON.stringify(old.arithmetic.operands)===JSON.stringify(policy.operands)&&oldLinks.length===1&&sameEdge(oldLinks[0]!,links[0]!)&&oldNodes.get(oldLinks[0]!.from[0])?.stored.outputs[oldLinks[0]!.from[1]]===lone&&old.stored.inputs[links[0]!.to[1]]===lone;
        const retained=unchanged?variants.find(v=>v.type===policy.type&&v.inputs.a===old!.stored.inputs.a&&v.inputs.b===old!.stored.inputs.b):undefined;
        const stored=!policy.automatic&&!links.length?variants.find(v=>v.inputs.a===policy.operands?.a&&v.inputs.b===policy.operands?.b):undefined;
        const chosen=retained||stored||variants[0];
        if(chosen){ports.set(n.id,{inputs:chosen.inputs,outputs:chosen.outputs});choices.set(n.id,chosen.type);operands.set(n.id,chosen.operands||null);}
        else {ports.set(n.id,n.stored);issues.set(n.id,{code:'auto-inputs',node:n.id});}
      }
      for(const id of outgoing.get(n.id)||[]){const count=degrees.get(id)!-1;degrees.set(id,count);if(count===0)ready.push(nodes.get(id)!);}
    }
    if(ready.length!==graph.nodes.length)return {code:'cycle'};
    return {ports,choices,operands,issues};
  }
  function invalidEdges(graph:Graph,ports:Map<string,Ports>,c:Capabilities):Map<string,Diagnostic> {
    const invalid=new Map<string,Diagnostic>();
    for(const e of graph.edges){
      const sourceType=ports.get(e.from[0])?.outputs[e.from[1]],targetType=ports.get(e.to[0])?.inputs[e.to[1]];
      if(!compatible(sourceType,targetType,c))invalid.set(JSON.stringify([e.from,e.to,sourceType,targetType]),{code:'downstream',node:e.to[0],sourceType,targetType});
    }
    return invalid;
  }
  export function plan(graph:Graph,c:Capabilities,intent:Intent,previous:Graph=graph):Result {
    let candidate=graph,displaced:readonly Edge[]=[];
    if(intent.kind==='wire'){
      const source=graph.nodes.find(n=>n.id===intent.from.node),target=graph.nodes.find(n=>n.id===intent.to.node);
      if(!source?.stored.outputs[intent.from.port]||!target?.stored.inputs[intent.to.port])return {ok:false,diagnostic:{code:'missing-port'}};
      displaced=graph.edges.filter(e=>e.to[0]===intent.to.node&&e.to[1]===intent.to.port);
      const edges=graph.edges.filter(e=>!displaced.includes(e));
      edges.push({from:[intent.from.node,intent.from.port],to:[intent.to.node,intent.to.port]});
      candidate={nodes:graph.nodes,edges};
    }
    const inference=infer(candidate,c,previous);
    if('code' in inference)return {ok:false,diagnostic:inference};
    if(intent.kind==='wire'){
      const old=infer(previous,c,previous);
      if('code' in old)return {ok:false,diagnostic:old};
      for(const [id,issue] of inference.issues)if(old.issues.get(id)?.code!==issue.code)return {ok:false,diagnostic:issue};
      const retained=invalidEdges(previous,new Map(previous.nodes.map(n=>[n.id,n.stored])),c);
      for(const [key,diagnostic] of invalidEdges(candidate,inference.ports,c))if(!retained.has(key))return {ok:false,diagnostic};
    }
    return {ok:true,inference,edges:candidate.edges,displaced};
  }
}
