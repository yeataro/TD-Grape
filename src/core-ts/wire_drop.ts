/** The wire-drop table (Refactor.77; design-interview Q37 1-5 supplement, human 2026-10-11). A wire dropped on the blank
 * canvas lists the nodes that can take it. Which ones, in which configuration and on which port, is decided here once, when
 * the build writes the editor contract, by the same rules as a real edit: the module's own `wire` (Combine, Replace) and the
 * same planner the network uses. The editor only looks it up; adding still goes through the real edit, so a wrong row can
 * only list a node that then fails to connect, never make a wrong wire.
 * Assumes what a fresh node accepts depends only on the node and the wire's type, never on the rest of the graph (true for
 * every module now). Things only a document knows (user structs, subgraphs, declarations) are for the same function called
 * with that document's types and context later.
 * 拉線新增的表（R.77；Q37 1-5 補充，人類）：線放到空白處時列出接得住它的節點。哪些節點、用什麼設定、接哪個接孔，在建置寫出
 * 編輯器合約時用真正的規則算一次：模組自己的 `wire`（Combine、Replace）與網路同一個規劃函式。編輯器只查表；新增仍走真正的修改，
 * 表有誤最多列出一個接不上的節點，不會接出錯的線。前提：全新節點接不接得住只看節點本身與線的型別、不看圖的其他部分（目前每個模組都是）。
 * 只有作品知道的東西（自訂結構、子圖、宣告）之後用同一個函式帶那份作品的型別與 context 再算。 */
import {copy,type Node} from './model';
import {configureNode,prepareNodeWire,resolvePorts,type Configuration,type NodeContext,type NodeModule,type Registry} from './node_module';
import {plan} from './wire_planning';
import {offered} from './structure';
import * as values from './values';

/** Where a dropped wire goes on a new node: the configuration to create it in (none: as its entry makes it), the port and
 * that port's type. 線接到新節點的哪裡：用什麼設定建立（沒有＝照入口原樣）、哪個接孔、接孔型別。 */
export type WireFit={port:string;type:string;configure?:Configuration};
/** Per entry (`definitionUuid:entryKey`, as the add menu names it), per side of the wire's existing end, per wire type.
 * 每個入口、線已有那一端的方向、線的型別。 */
export type WireDropTable=Record<string,{output:Record<string,WireFit>;input:Record<string,WireFit>}>;

const WIRE='wire',NEW='new',END='end';

export function wireDropTable(registry:Registry,types:readonly string[],target='top',context:NodeContext={target,declaration:()=>undefined}):WireDropTable {
  const table:WireDropTable={};
  for(const module of registry.modules){
    const definition=module.catalog.definition;
    // What the add menu can offer: placed in a pixel network, not a stage output, not a reference to a declaration.
    // 新增選單能提供的：放在 pixel 網路、不是階段輸出、不是宣告的引用。
    if(module.structural||!offered(module)||!definition.stages.includes('pixel')||module.referencedDeclaration)continue;
    for(const entry of module.entries?.()??[{key:'',label:definition.label,params:{}}]){
      const base:Node={id:NEW,nodeType:definition.definitionUuid!,params:{...copy(definition.defaults),...copy(entry.params)}};
      if(!module.supports(base,context))continue;
      const configurations=configurationsOf(module,base,types,context);
      const row={output:{} as Record<string,WireFit>,input:{} as Record<string,WireFit>};
      for(const type of types)for(const side of ['output','input'] as const){
        const fit=best(module,configurations,type,side,context);
        if(fit)row[side][type]=fit;
      }
      table[definition.definitionUuid+':'+entry.key]=row;
    }
  }
  return table;
}

type Option={node:Node;configure?:Configuration;order:number};
/** Whether one score comes first, compared item by item. 兩個分數逐項比，哪個在前。 */
const before=(a:readonly number[],b:readonly number[])=>{for(let i=0;i<a.length;i++)if(a[i]!==b[i])return a[i]!<b[i]!;return false;};
/** The node as its entry makes it, then each other type it can be set to, unless the entry fixes its type.
 * 入口原樣的節點，再加上它能設成的其他型別；入口固定型別時不換。 */
function configurationsOf(module:NodeModule,base:Node,types:readonly string[],context:NodeContext):Option[] {
  const options:Option[]=[{node:base,order:-1}];
  if(!module.configure||typeof base.params.type!=='string'||base.params.fixedType)return options;
  types.forEach((type,order)=>{
    if(type===base.params.type)return;
    try{options.push({node:configureNode(module,base,{type},context),configure:{type},order});}catch{/* not a type it takes 不接受的型別 */}
  });
  return options;
}

/** The best place for a wire of this type, by the module's preference, then a port of exactly the wire's type, then the
 * node as its entry makes it, then the order of types and ports. 這個型別的線最好接哪裡：模組偏好、型別完全相同的接孔、入口原樣、
 * 型別與接孔順序。 */
function best(module:NodeModule,options:readonly Option[],type:string,side:'output'|'input',context:NodeContext):WireFit|undefined {
  const preferred=module.preferFor?.(type,side);
  let found:{fit:WireFit;score:number[]}|undefined;
  for(const option of options){
    const ports=resolvePorts(module,option.node,context).types();
    Object.keys(side==='output'?ports.inputs:ports.outputs).forEach((port,index)=>{
      const portType=fits(module,option.node,port,type,side,context);
      if(portType===undefined)return;
      const score=[Number(!(preferred&&'type'in preferred&&option.node.params.type===preferred.type)),Number(portType!==type),option.order+1,index];
      if(!found||before(score,found.score))found={fit:{port,type:portType,...(option.configure?{configure:option.configure}:{})},score};
    });
  }
  return found?.fit;
}

/** Whether a wire of this type connects to this port of a fresh node, rehearsed as the network does (the module's `wire`,
 * then the planner); the port's type once connected. 這個型別的線能不能接到全新節點的這個接孔，照網路的做法預演（模組的 `wire`，
 * 再交給規劃）；接上後接孔的型別。 */
function fits(module:NodeModule,node:Node,port:string,type:string,side:'output'|'input',context:NodeContext):string|undefined {
  let prepared=node;
  if(side==='output'&&module.wire){try{prepared=prepareNodeWire(module,node,port,type,context).node;}catch{return undefined;}}
  const stored=resolvePorts(module,prepared,context).types();
  const created={id:NEW,definition:node.nodeType,stored,...(module.signatures?{variants:module.signatures(node,context)}:{})};
  const result=side==='output'
    ? plan({nodes:[{id:WIRE,definition:WIRE,stored:{inputs:{},outputs:{out:type}}},created],edges:[]},values.policy,{kind:'wire',from:{node:WIRE,port:'out'},to:{node:NEW,port}})
    : plan({nodes:[created,{id:END,definition:END,stored:{inputs:{in:type},outputs:{}}}],edges:[]},values.policy,{kind:'wire',from:{node:NEW,port},to:{node:END,port:'in'}});
  if(!result.ok)return undefined;
  return side==='output'?result.inference.ports.get(NEW)?.inputs[port]??stored.inputs[port]:stored.outputs[port];
}
