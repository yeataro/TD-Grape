import type { Node } from './model';
import type { NodeModule, NodeContext } from './node_module';

/** Component names (Refactor.59; legacy graph_ui.js:1224-1236): a node shows its vector components as X/Y/Z/W,
 * R/G/B/A, S/T/P/Q or U/V. Stored on the node as `ui.componentNames` (appearance only, never compiled, design-interview
 * Q67); when not stored, the node module's default; nothing said, X/Y/Z/W. Switched only in the parameter panel (later).
 * 分量名稱：節點把向量分量顯示成 X/Y/Z/W、R/G/B/A、S/T/P/Q 或 U/V。存在節點的 ui.componentNames（只是外觀、不產碼）；
 * 沒存時用節點模組的預設，沒說就是 X/Y/Z/W。只在參數面板切換（之後）。 */
export const componentStyles = ['xyzw', 'rgba', 'stpq', 'uv'] as const;
export type ComponentStyle = typeof componentStyles[number];
const isStyle = (value: unknown): value is ComponentStyle => componentStyles.includes(value as ComponentStyle);

/** A node's names when its module says `fallback` by default. 模組預設為 fallback 時這個節點的名稱樣式。 */
export const storedOr = (node: Node, fallback: ComponentStyle): ComponentStyle =>
  isStyle(node.ui?.componentNames) ? node.ui!.componentNames as ComponentStyle : fallback;

/** A node's names, as it shows them. 節點顯示的名稱樣式。 */
export const componentStyle = (module: NodeModule | undefined, node: Node, context: NodeContext): ComponentStyle =>
  storedOr(node, module?.componentNames?.(node, context) ?? 'xyzw');

/** The letters for a style; U/V only with two components, otherwise X/Y/Z/W (legacy vectorNames).
 * 樣式的字母；U/V 只用在兩個分量，否則 X/Y/Z/W（照舊產品）。 */
export const componentLetters = (style: ComponentStyle, count: number) => style === 'uv' ? (count === 2 ? 'UV' : 'XYZW') : style.toUpperCase();
