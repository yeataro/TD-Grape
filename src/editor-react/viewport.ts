import type { ReactFlowInstance } from '@xyflow/react';

// How the view moves (Refactor.58.2; legacy app.js:545–580, floating-panels.md 14). One place for every framing move so
// they all glide the same way: the Frame selected button, F and H, a double-click on a node, the zoom presets.
// 畫面怎麼移動：所有「對準」都走這裡，滑動的方式一樣——Frame selected 按鈕、F 與 H、雙擊節點、縮放常用值。

/** How long a framing move glides (legacy frameDampingMs default; later a preference with the damping settings).
 * 對準時滑動多久（舊產品 frameDampingMs 的預設；之後和阻尼設定一起成為偏好）。 */
export const FRAME_MS = 333;

/** Frame these nodes, or all of them when none are given (legacy fitSelection / fit). 對準這些節點；沒給就對準全部。 */
export const frameNodes = (flow: Pick<ReactFlowInstance, 'fitView'>, ids?: readonly string[]) =>
  void flow.fitView({ ...(ids?.length ? { nodes: ids.map(id => ({ id })) } : {}), duration: FRAME_MS, padding: .2, maxZoom: 1 });
