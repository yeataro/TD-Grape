import { copy, type Graph, type Declaration, type Value } from './model';
import { types, literal, fill, type as numericType } from './numeric';
import { reshape } from './values';
import { identifierRules } from './identifier_rules';

/** Declarations (design-interview Q41, Q44, Q45): the graph's shared sources and global constants,
 * one list `declarations`, each entry with a `kind`. A kind module decides its fields, what a
 * reference to it gives (type, whether it is a constant expression) and its GLSL at file scope.
 * A declaration of a kind this build does not know is kept as stored and never read (Q44); the
 * nodes that refer to it are ghosts. Rules shared by every kind (Q41): names are unique among
 * declarations, follow GLSL naming, and are referred to only at the top level of a stage.
 * 宣告：圖裡的共用來源與全域常數，一張清單、每筆有 kind。kind 模組決定欄位、被引用時給什麼、檔案層級的 GLSL。
 * 不認得的 kind 原樣保留、不讀；引用它的節點是 Ghost。共用規則：名稱互不重複、照 GLSL 命名、只在 stage 最外層引用。 */
export interface DeclarationKind {
  readonly kind: string;
  /** source: the value comes from outside (TD); constant: the value lives in the graph (Q41). */
  readonly role: 'source' | 'constant';
  /** Display-only colour group of the nodes that refer to it (Q42); the core never reads it. */
  readonly colorGroup: string;
  readonly types: readonly string[];
  /** Whether a reference is a GLSL constant expression (usable where GLSL needs a constant). */
  readonly constant: boolean;
  validate(declaration: Declaration): void;
  /** File-scope GLSL for a declaration that is used. */
  header(declaration: Declaration): string;
}

const numericValue = (declaration: Declaration) => {
  if (!types.includes(declaration.type)) throw Error('Unsupported declaration type');
  literal(declaration.value, numericType(declaration.type));
};
// Global constant (Q41): `const` at file scope; changing it changes the program, nothing in TD.
const constantKind: DeclarationKind = { kind: 'constant', role: 'constant', colorGroup: 'constant', types, constant: true, validate: numericValue,
  header: (d: Declaration) => 'const ' + d.type + ' ' + d.name + ' = ' + literal(d.value, numericType(d.type)) + ';' };
// Uniform (Q41): its value lives in TD; the Uniform round adds exposure and live values.
const uniformKind: DeclarationKind = { kind: 'uniform', role: 'source', colorGroup: 'uniform', types, constant: false, validate: numericValue,
  header: (d: Declaration) => 'uniform ' + d.type + ' ' + d.name + ';' };
export const declarationKinds: ReadonlyMap<string, DeclarationKind> =
  new Map([constantKind, uniformKind].map(module => [module.kind, Object.freeze(module)]));

/** Why a name cannot be used, or null. GLSL naming, not reserved, unique among declarations.
 * 名稱不能用的原因（沒有問題回傳 null）：GLSL 命名、非保留字、宣告之間不重複。 */
export type NameProblem = 'format' | 'reserved' | 'taken';
export function declarationNameProblem(graph: Graph, name: string, except?: string): NameProblem | null {
  if (!/^[A-Za-z][A-Za-z0-9_]{0,47}$/.test(name) || name.includes('__')) return 'format';
  if (/^(gl_|TD|sTD|uTD|sg_)/.test(name) || identifierRules.reservedNames.includes(name)) return 'reserved';
  if (graph.declarations.some(d => d.name === name && d.id !== except)) return 'taken';
  return null;
}
export class DeclarationError extends Error {
  constructor(readonly problem: NameProblem | 'kind' | 'type' | 'missing', readonly subject?: string) {
    super('Declaration ' + problem + (subject ? ': ' + subject : '')); this.name = 'DeclarationError';
  }
}

const kindOf = (kind: string) => { const module = declarationKinds.get(kind); if (!module) throw new DeclarationError('kind'); return module; };
const requireName = (graph: Graph, name: string, except?: string) => {
  const problem = declarationNameProblem(graph, name, except); if (problem) throw new DeclarationError(problem, name);
};
/** A free name from a base, e.g. constant1, constant2. 從基底找一個沒被用的名字。 */
export function freeDeclarationName(graph: Graph, base: string): string {
  for (let i = 1; ; i++) if (!declarationNameProblem(graph, base + i)) return base + i;
}

/** Commands, used inside GraphDocument.change() on its editable candidate document.
 * 指令：在 GraphDocument.change() 的可編輯候選文件上使用。 */
export function addDeclaration(graph: Graph, entry: { id: string; kind: string; name: string; type: string; value?: Value }): Declaration {
  if (!/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(entry.id) || graph.declarations.some(d => d.id === entry.id)) throw Error('Invalid or duplicate declaration ID');
  const module = kindOf(entry.kind);
  if (!module.types.includes(entry.type)) throw new DeclarationError('type');
  requireName(graph, entry.name);
  const declaration: Declaration = { id: entry.id, kind: entry.kind, name: entry.name, type: entry.type,
    value: entry.value === undefined ? fill(0, numericType(entry.type)) : copy(entry.value) };
  module.validate(declaration);
  graph.declarations.push(declaration);
  return declaration;
}
/** Rename, retype or change the value. A new type reshapes the old value (Q37 1-3: wires that no
 * longer fit become ghost wires, nothing is unplugged). 改名、改型別、改值；改型別時沿用舊值的分量。 */
export function changeDeclaration(graph: Graph, id: string, patch: { name?: string; type?: string; value?: Value }): Declaration {
  const declaration = graph.declarations.find(d => d.id === id); if (!declaration) throw new DeclarationError('missing');
  const module = kindOf(declaration.kind);
  const next: Declaration = { ...copy(declaration) };
  if (patch.name !== undefined && patch.name !== declaration.name) { requireName(graph, patch.name, id); next.name = patch.name; }
  if (patch.type !== undefined && patch.type !== declaration.type) {
    if (!module.types.includes(patch.type)) throw new DeclarationError('type');
    next.type = patch.type; next.value = reshape(declaration.value, patch.type);
  }
  if (patch.value !== undefined) next.value = copy(patch.value);
  module.validate(next);
  Object.assign(declaration, next);
  return declaration;
}
/** Removing a declaration on purpose also removes the nodes that refer to it and their wires, in
 * the same step (one Undo). Ghosts are for what is missing by accident, not for deliberate removals.
 * 刻意刪除宣告時，引用它的節點與線一起刪（同一步、一次 Undo）；Ghost 是給「意外不見」的，不是給刻意刪除。 */
export function removeDeclaration(graph: Graph, id: string, refersTo: (nodeType: string, params: Readonly<Record<string, Value>>) => string | undefined): void {
  if (!graph.declarations.some(d => d.id === id)) throw new DeclarationError('missing');
  graph.declarations = graph.declarations.filter(d => d.id !== id);
  for (const network of Object.values(graph.stages)) {
    const gone = new Set(network.nodes.filter(n => refersTo(n.nodeType, n.params) === id).map(n => n.id));
    if (!gone.size) continue;
    network.nodes = network.nodes.filter(n => !gone.has(n.id));
    network.edges = network.edges.filter(e => !gone.has(e.from[0]) && !gone.has(e.to[0]));
  }
}
