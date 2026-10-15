import { copy, type Node, type Declaration, type ObjectValue, type Value, type Graph, type SubgraphData } from './model';
import { NodePorts, type PortSpec } from './ports';
import type { ComponentStyle } from './component_names';

export interface CatalogDefinition {
  key:string;label:string;inputs:Record<string,string>;outputs:Record<string,string>;
  stages:string[];defaults:ObjectValue;descriptionKey:string;
  nodeType?:string;[key:string]:Value|undefined;
}
export interface CatalogRow {definition:CatalogDefinition;emitter:{id:string;version:number;primitive?:{operator:string;port:string};call?:{operator:string;ports:readonly string[];defaults?:Readonly<Record<string,number>>}};browser:Record<string,Value>}
export interface NodeContext {
  readonly target?:string;
  readonly owner?:SubgraphData;
  declaration(id:string):Declaration|undefined;
  /** Every declaration, e.g. for a reference node offering what it can point to. */
  declarations?():readonly Declaration[];
  subgraph?(id:string):SubgraphData|undefined;
}
export function contextFor(graph:Graph,owner?:SubgraphData):NodeContext {
  return {target:graph.target,owner,declaration:id=>graph.declarations.find(d=>d.id===id),declarations:()=>graph.declarations,
    subgraph:id=>graph.subgraphs?.find(f=>f.id===id)};
}
export interface EmitContext extends NodeContext {
  readonly ports:NodePorts;
  input(key:string):string;
  connected(key:string):boolean;
  /** Marks a declaration as used and returns its GLSL name (any kind, Refactor.40). */
  useDeclaration(id:string):string;
  /** Marks a declaration as used and returns the GLSL of each output a reference gives, as its
   * kind defines (e.g. a TOP texture input: the texture, its size, its pixel size; Refactor.43).
   * 標記使用並依 kind 回傳引用時每個輸出的 GLSL。 */
  referenceDeclaration(id:string):Record<string,string>;
}
/** names: variables the statements declare (Refactor.63.4), so a name in the GLSL leads back to this node.
 * names：statements 宣告的變數，讓 GLSL 裡的名字找回這個節點。 */
/** `outputs`: each output's GLSL expression; `undefined` only for an opaque output that passes nothing on (subgraph_compiler.ts relay).
 * 每個輸出的 GLSL 式子；只有「把沒有往下傳」的 opaque 輸出才是 undefined。 */
export interface Emission {outputs:Record<string,string|undefined>;constant?:boolean;statements?:readonly string[];names?:readonly string[]}
export interface Signature {type:string;inputs:Readonly<Record<string,string>>;outputs:Readonly<Record<string,string>>;operands?:Readonly<Record<string,string>>}
export type Configuration={type:string}|{signature:Signature};
export interface NodeControl {
  kind:'select'|'button'|'row'|'hint';key:string;label:string;literal?:boolean;
  command?:string;value?:string;numeric?:boolean;args?:ObjectValue;
  options?:readonly {value:string;label:string;literal?:boolean}[];
  children?:readonly NodeControl[];prefix?:string;disabled?:boolean;
  /** The label names this component (0-3), so the screen colours it as a component (Refactor.80.3). 標題代表這個分量（0-3），畫面照分量上色（R.80.3）。 */
  component?:number;
}
/** One add-menu entry (design-interview Q37 1-5): a shortcut that creates the node with these params.
 * The graph never records which entry made a node. `literal`: the label is shown as is (a type name),
 * not translated. 新增選單的一個入口：用這些參數建立節點的捷徑；圖不記錄來自哪個入口。literal＝標籤照原樣顯示。 */
export interface NodeEntry { readonly key:string; readonly label:string; readonly literal?:boolean; readonly params:ObjectValue }
export interface NodePresentation {
  label?:string;descriptionKey?:string;
  /** The label is shown as is, not translated (e.g. a fixed type name). 標籤照原樣顯示、不翻譯。 */
  literalLabel?:boolean;
  /** The type cannot be changed here (a fixed entry, Refactor.17.2): no type menu on the card.
   * 型別不能在這裡改（固定入口）：卡片不顯示型別選單。 */
  typeLocked?:boolean;
  /** Which end the type menu chooses (Refactor.81.1, design-interview Q73 rule two): 'output' by default, what the node makes,
   * shown in the title; 'input' when the output is decided otherwise (logic: bool; Swizzle: its components; Split), so the title
   * only shows the output and the menu is a row in the body. 型別選單選的是哪一端（R.81.1，Q73 規則二）：預設 output（節點產生什麼，
   * 在標題列）；輸出由別的東西決定時是 input（邏輯類 bool、Swizzle 的分量、Split），標題列只顯示輸出，選單是本體的一列。 */
  typeOf?:'input'|'output';
  /** The module's own output menu. No name: the card shows it in the title, the panel names the row "Output type" (Refactor.81.1).
   * 模組自己的輸出選單。不帶名稱：卡片放在標題列，面板那一列叫「輸出型別」（R.81.1）。 */
  selector?:{value:string;options:readonly string[];command:string};
  /** The module's own input menu, the input's counterpart of `selector` (Refactor.81.4): drawn as the shared "Input type" row.
   * 模組自己的輸入選單，對應輸出的 selector（R.81.4）：畫成共用的「輸入型別」那一列。 */
  inputSelector?:{value:string;options:readonly string[];command:string};
  inlineControls?:readonly NodeControl[];
  value?:{value:Value;type:string;componentCommand:string;valueCommand:string;names:string;color?:boolean;expandable?:boolean};
  controls?:readonly NodeControl[];
  portLabels?:{inputs?:Record<string,string>;outputs?:Record<string,string>};
  /** Which components (0-3) each port stands for, in the order of its label's letters (Refactor.59): the screen colours
   * them by component. 每個接孔代表哪幾個分量（0-3），順序同標籤字母：畫面依分量上色。 */
  components?:{inputs?:Record<string,readonly number[]>;outputs?:Record<string,readonly number[]>};
  note?:{key:string;text:string};
  spare?:{direction:'input'|'output';key:string;type:string;command:string;count:number;limit:number;label:string;limitLabel:string};
}
/** Trusted developer module. Callbacks read graph-owned data and return values;
 * no DOM, host, graph mutation, persistence or History access. */
export interface NodeModule {
  readonly catalog:CatalogRow;
  readonly role:'value'|'output'|'subgraph-input'|'subgraph-output';
  /** Structural modules are instantiated from a graph definition, not the palette. */
  readonly structural?:boolean;
  /** Add-menu entries (design-interview Q37 1-5); the menu reads only these, never node names. Left
   * out = one entry, the module itself; an empty list = not in the menu (retired, or made elsewhere such
   * as the Sources panel). 新增選單的入口；選單只讀這個、不認節點名字。沒寫＝一個入口（模組本身）；空的＝不在選單。 */
  entries?():readonly NodeEntry[];
  referencedGraph?(node:Node):string;
  /** The declaration this node refers to (the reference node, Q45). 引用的宣告。 */
  referencedDeclaration?(node:Node):string;
  /** Stands for a shared source and shows its name, so takes no name of its own (Refactor.76; legacy functions_ui.js:141).
   * 代表共用來源、顯示來源的名字，所以不取自己的名字（R.76；照舊產品）。 */
  readonly unnamed?:boolean;
  /** Display-only colour group when it cannot be derived from the role (Q42); the core never reads it. */
  readonly colorGroup?:string;
  /** The component names it shows when the node stores none (Refactor.59; component_names.ts). Left out: X/Y/Z/W.
   * 節點沒存時顯示的分量名稱樣式；沒寫＝X/Y/Z/W。 */
  componentNames?(node:Node,context:NodeContext):ComponentStyle;
  /** Its component names are fixed by what it is (Split RGBA, Compose RGBA, a TD value such as UV): no choice in the Settings tab
   * (Refactor.85.1). 分量名稱由它是什麼決定（Split RGBA、Compose RGBA、UV 這類 TD 內建值）：設定分頁沒有這個選擇（R.85.1）。 */
  componentNamesFixed?:true;
  /** Made by dragging a wire, it takes the component names of the node at the other end (legacy graph_ui.js:2346).
   * 由拉線新增時，沿用另一端節點的分量名稱樣式。 */
  readonly inheritsComponentNames?:boolean;
  /** Initial parameters for a new instance of a graph definition. */
  reference?(graphId:string):ObjectValue;
  supports(node:Node,context:NodeContext):boolean;
  ports(node:Node,context:NodeContext):readonly PortSpec[];
  /** Complete native input tuples for the already-selected output interface. */
  signatures?(node:Node,context:NodeContext):readonly Signature[];
  /** Module owns how a manual selection/native tuple becomes persisted state. */
  configure?(node:Node,selection:Configuration,context:NodeContext):Node;
  /** Explicit user commands, including dynamic interface edits, stay local. */
  edit?(node:Node,command:string,value:Value|undefined,context:NodeContext):Node;
  editInput?(node:Node,key:string,value:Value,context:NodeContext):Node;
  /** Local port-layout change for a wire gesture; the graph owns displaced edges. */
  wire?(node:Node,input:string,sourceType:string,context:NodeContext):{node:Node;replaceInputs:readonly string[]};
  /** The configuration this module prefers when it is created from a dropped wire of this type, among those that take it
   * (Refactor.77; human 2026-10-11: the module says it, the editor names no node). `side`: the wire's existing end, 'output'
   * when it comes from an output into the new node. Read once, when the build writes the wire-drop table (wire_drop.ts).
   * 由這個型別的線拉出新增時，在接得住的設定中模組偏好哪一個（R.77，人類：由模組說，編輯器不認節點）。side：線已有那一端，從輸出拉來時是
   * 'output'。只在建置寫拉線新增表時讀一次。 */
  preferFor?(wireType:string,side:'output'|'input'):Configuration|undefined;
  /** The wire into `input` was removed: undo the input-port change that wire made (Q65), e.g. split a component group
   * back. Outputs never change; inputs that still have a wire keep their type.
   * 接進 input 的線被拿掉：還原那條線造成的輸入接孔調整（Q65），例如把分量組分回去。輸出不變；還接著線的輸入型別不變。 */
  unwire?(node:Node,input:string,context:NodeContext):Node;
  /** Creation-time choices may use a dragged wire, before an output is fixed. */
  creations?(wire:{direction:'input'|'output';type:string}|undefined):readonly ObjectValue[]|undefined;
  /** Effective expression inputs; dormant wires still participate in cycle checks. */
  inputsUsed?(node:Node,connected:ReadonlySet<string>,context:NodeContext):readonly string[];
  presentation?(node:Node,context:NodeContext):NodePresentation;
  validate(node:Node,context:NodeContext):void;
  emit?(node:Node,context:EmitContext):Emission;
}
export function createRegistry(modules:readonly NodeModule[]){
  const table=new Map<string,NodeModule>();
  for(const module of modules){
    const d=module.catalog.definition,id=d.nodeType||'sgrape.builtin.'+d.key;
    if(!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(d.key)||table.has(id))throw Error('Invalid or duplicate node definition: '+id);
    if(module.signatures&&!module.configure)throw Error('Signature module needs a configuration operation: '+id);
    const freeze=(value:unknown):void=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}};
    const catalog=JSON.parse(JSON.stringify(module.catalog)) as CatalogRow;
    catalog.definition.nodeType=id;freeze(catalog);
    table.set(id,Object.freeze({...module,catalog}));
  }
  // Do not expose a mutable registration table to a compilation in progress.
  return Object.freeze({modules:Object.freeze([...table.values()]),get:(id:string)=>table.get(id)});
}
export type Registry=ReturnType<typeof createRegistry>;
const sameTypes=(a:Readonly<Record<string,string>>,b:Readonly<Record<string,string>>)=>Object.keys(a).length===Object.keys(b).length&&Object.entries(a).every(([key,value])=>b[key]===value);
/** Pure configuration. Module callbacks cannot partly edit a working node. */
export function configureNode(module:NodeModule,node:Node,selection:Configuration,context:NodeContext):Node {
  if(!module.configure)throw Error('Node does not support configuration');
  const before=resolvePorts(module,node,context).types();
  if('signature' in selection){
    const wanted=selection.signature;
    const declared=module.signatures?.(node,context).find(s=>s.type===wanted.type&&sameTypes(s.inputs,wanted.inputs)&&sameTypes(s.outputs,wanted.outputs));
    if(!sameTypes(before.outputs,wanted.outputs)||!declared)throw Error('Invalid native signature');
    selection={signature:declared};
  }
  const candidate=module.configure(copy(node),copy(selection),context);
  if(candidate.id!==node.id||candidate.nodeType!==node.nodeType)throw Error('Configuration cannot change node identity');
  if(!module.supports(candidate,context))throw Error('Unsupported node configuration');
  module.validate(candidate,context);
  const after=resolvePorts(module,candidate,context).types();
  if('signature' in selection&&(!sameTypes(after.outputs,before.outputs)||!sameTypes(after.inputs,selection.signature.inputs)))throw Error('Module configuration disagrees with its signature');
  return copy(candidate);
}
export function editNode(module:NodeModule,node:Node,command:string,value:Value|undefined,context:NodeContext):Node {
  if(!module.edit)throw Error('Node command is unavailable');
  const candidate=module.edit(copy(node),command,value===undefined?undefined:copy(value),context);
  if(candidate.id!==node.id||candidate.nodeType!==node.nodeType)throw Error('Command cannot change node identity');
  if(!module.supports(candidate,context))throw Error('Unsupported node configuration');
  module.validate(candidate,context);resolvePorts(module,candidate,context);return copy(candidate);
}
export function prepareNodeWire(module:NodeModule,node:Node,key:string,source:string,context:NodeContext){
  if(!module.wire)throw Error('Node has no wire preparation');
  const before=resolvePorts(module,node,context).types(),edit=module.wire(copy(node),key,source,context);
  if(edit.node.id!==node.id||edit.node.nodeType!==node.nodeType||!module.supports(edit.node,context))throw Error('Wire preparation changed identity/capability');
  module.validate(edit.node,context);const after=resolvePorts(module,edit.node,context).types();
  if(!sameTypes(before.outputs,after.outputs)||edit.replaceInputs.some(p=>!before.inputs[p]))throw Error('Wire preparation changed outputs or unknown ports');
  return edit;
}
export function prepareNodeUnwire(module:NodeModule,node:Node,key:string,wired:readonly string[],context:NodeContext):Node {
  if(!module.unwire)throw Error('Node has no unwire preparation');
  const before=resolvePorts(module,node,context).types(),candidate=module.unwire(copy(node),key,context);
  if(candidate.id!==node.id||candidate.nodeType!==node.nodeType||!module.supports(candidate,context))throw Error('Unwire changed identity/capability');
  module.validate(candidate,context);const after=resolvePorts(module,candidate,context).types();
  if(!sameTypes(before.outputs,after.outputs)||wired.some(p=>after.inputs[p]!==before.inputs[p]))throw Error('Unwire changed outputs or a wired input');
  return copy(candidate);
}
const portTemplates=new WeakMap<readonly PortSpec[],NodePorts>();
export function resolvePorts(module:NodeModule,node:Node,context:NodeContext):NodePorts {
  const specs=module.ports(node,context);
  // A frozen declaration is reusable; graph Port handles still own their
  // network/node/key identity. Dynamic declarations get a fresh projection.
  if(Object.isFrozen(specs)){
    let resolved=portTemplates.get(specs);if(!resolved){resolved=new NodePorts(specs);portTemplates.set(specs,resolved);}return resolved;
  }
  return new NodePorts(specs);
}
