/** Serializable graph data. Definitions never own editable node/port state.
 * Format (design-interview Q44): `format`＋`version` identify a Grape graph; unknown fields are
 * kept as authored and never read, so `extensions` and newer data survive a round trip.
 * 圖格式（Q44）：以 format＋version 識別；不認得的欄位原樣保留、程式不讀。 */
export type Value = null|boolean|number|string|Value[]|{[key:string]:Value};
export type ObjectValue = {[key:string]:Value};
export const GRAPH_FORMAT = 'grape-graph';
export const GRAPH_VERSION = 1;
export interface Node {id:string;nodeType:string;params:ObjectValue;name?:string;inputValues?:ObjectValue;comment?:string;ui?:ObjectValue;extensions?:ObjectValue}
/** Fields beyond id/kind/name/type belong to the kind module (graph-structure decision 11), e.g.
 * `value` for a constant, `defaultTexture` for a TOP texture input. 其餘欄位由 kind 模組規定。 */
export interface Declaration {id:string;kind:string;name:string;type:string;[key:string]:Value}
export interface Edge {id:string;from:readonly [string,string];to:readonly [string,string];ui?:ObjectValue;extensions?:ObjectValue}
export interface NetworkData {nodes:Node[];edges:Edge[];ui?:ObjectValue}
/** A subgraph port (basic design 2026-10-14 §3.3, Refactor.109): `id` is a generated identity like a node's, never shown;
 * `label` is free text for people; the GLSL name is made from the position at code generation and never stored. An opaque
 * port (sampler2D) has no `default`; a numeric one always has. 接口：id 產生式、不顯示；label 自由文字；產碼名按位置合成不存；
 * opaque 接口沒有 default，數值接口一定有。 */
export interface InterfacePort {id:string;label?:string;type:string;default?:Value}
/** A definition the graph owns (§2). No `scope`/`origin` (Refactor.109): every definition in a graph is local until the
 * Library round defines `libraryId`; a definition carrying `libraryId` is refused until then. `color` is the definition's
 * colour (§3.14). 圖裡的定義：沒有 scope／origin；libraryId 到 Library 那一輪才定義，之前遇到整份拒絕；color 是定義的顏色。 */
export interface SubgraphData {id:string;title:string;color?:string;descriptionKey?:string;
  /** Only on a saved definition (library, export, clipboard), recomputed on load; never in a graph, where they are
   * worked out from the content (Q46, subgraph_stages.ts). 只在存成的定義裡、載入時重算；圖裡不存，由內容推算。 */
  stages?:string[];targets?:string[];inputs:InterfacePort[];outputs:InterfacePort[];graph:NetworkData;
  description?:string;comment?:string;userVersion?:string;extensions?:ObjectValue}
/** `savedBy` (Refactor.66, human 2026-10-10): which editor last saved the graph, written when the graph is sent, for people
 * and for explaining ghosts later; information only — node upgrades never read it (upgrades.ts).
 * savedBy：最後是哪一版編輯器存的，送出時寫上；只是資訊，節點升級不看它。 */
export interface Graph {format:string;version:number;target:string;declarations:Declaration[];subgraphs?:SubgraphData[];structDefinitions?:unknown[];stages:Record<string,NetworkData>;
  description?:string;comment?:string;userVersion?:string;savedBy?:string;extensions?:ObjectValue}
export function object(v:Value|undefined):ObjectValue|undefined {return v!==null&&typeof v==='object'&&!Array.isArray(v)?v:undefined;}
/** Own JSON values at mutation boundaries; callers never retain editable state. */
export function copy<T>(value:T):T {return JSON.parse(JSON.stringify(value)) as T;}

/** Why a document cannot be opened for editing, or null when it can (Q44).
 * Older or foreign formats belong to the importer; a newer version is never written back.
 * 不能編輯的原因：舊格式交給匯入器；比目前新的版本不寫回、請更新 Grape。 */
export type FormatProblem = {code:'not-grape-graph'|'newer-version'|'invalid';message:string};
export function formatProblem(value:unknown):FormatProblem|null {
  const g=value as Partial<Graph>|null;
  if(!g||typeof g!=='object'||Array.isArray(g))return {code:'invalid',message:'The graph is not a JSON object.'};
  if(g.format!==GRAPH_FORMAT)return {code:'not-grape-graph',message:'This is not a grape-graph document (older graphs are opened by the importer).'};
  if(!Number.isSafeInteger(g.version)||g.version!<1)return {code:'invalid',message:'The graph format version is missing or invalid.'};
  if(g.version!>GRAPH_VERSION)return {code:'newer-version',message:`This graph was saved by a newer Grape (format version ${g.version}); update Grape to edit it.`};
  if(typeof g.target!=='string'||!Array.isArray(g.declarations)||!g.stages||typeof g.stages!=='object')return {code:'invalid',message:'The graph is missing target, declarations or stages.'};
  const networks:unknown[]=[...Object.values(g.stages),...(Array.isArray(g.subgraphs)?g.subgraphs.map(f=>f&&f.graph):[])];
  for(const n of networks){
    const data=n as Partial<NetworkData>|undefined;
    if(!data||!Array.isArray(data.nodes)||!Array.isArray(data.edges))return {code:'invalid',message:'A network is missing nodes or edges.'};
    if(data.nodes.some(node=>!node||typeof node.id!=='string'||typeof node.nodeType!=='string'))return {code:'invalid',message:'A node is missing id or nodeType.'};
    if(data.edges.some(edge=>!edge||typeof edge.id!=='string'||!edge.id))return {code:'invalid',message:'An edge is missing its id.'};
  }
  return null;
}
