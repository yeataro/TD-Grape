// The Ghost mark's motion (Refactor.75.27, human 2026-10-11): the hem as a zigzag with rounded corners (option G) that flows
// one way, and where in its round each ghost starts, from its node's or wire's ID, so ghosts on screen do not move in step.
// Kept apart from React so it can be tested. Ghost 標記的動作（R.75.27，人類）：裙擺是修圓角的鋸齒（G），往一個方向流；
// 每隻幽靈從一輪中的哪裡開始，由節點或線的 ID 決定，畫面上的幽靈才不會一起動。和 React 分開，才能測試。

/** One round of the ghost's motion, ms: every animation of a ghost is offset by the same share of it. 一輪的長度（毫秒）。 */
export const GHOST_ROUND = 4800;

/** The hem, in the ghost icon's 24-unit box: the zigzag of the still icon (points 2 apart, between y 18.5 and 20) from x 2 to
 * 30, so it can slide 4 units left and still fill the body; every corner cut back along both edges by `cut` of the edge and
 * joined by a curve through the corner (a design tool's "round corners"). 裙擺：和靜止圖示同樣的鋸齒，從 x 2 畫到 30（往左滑 4 仍蓋滿身體）；
 * 每個轉角往兩邊各退 cut、用曲線接起來（設計軟體的圓角）。 */
export function roundedHem(cut = 0.3): string {
  const points: [number, number][] = [];
  for (let x = 2; x <= 30; x += 2) points.push([x, x % 4 === 2 ? 20 : 18.5]);
  const at = (from: number, to: number) => +(from + (to - from) * cut).toFixed(3);
  let path = `M2 18.4 L${points[0]![0]} ${points[0]![1]}`;
  for (let i = 1; i < points.length - 1; i++) {
    const [x, y] = points[i]!, [ax, ay] = points[i - 1]!, [bx, by] = points[i + 1]!;
    path += ` L${at(x, ax)} ${at(y, ay)} Q${x} ${y} ${at(x, bx)} ${at(y, by)}`;
  }
  const last = points[points.length - 1]!;
  return path + ` L${last[0]} ${last[1]} L30 18.4Z`;
}

/** Where in its round a ghost starts: the same ID always gives the same place, as a negative CSS delay. 從一輪中的哪裡開始：
 * 同一個 ID 永遠一樣，寫成負的 CSS 延遲。 */
export function ghostDelay(id: string): string {
  let hash = 2166136261; // FNV-1a
  for (let i = 0; i < id.length; i++) hash = Math.imul(hash ^ id.charCodeAt(i), 16777619);
  return -((hash >>> 0) % GHOST_ROUND) + 'ms';
}
