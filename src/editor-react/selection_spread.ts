// Spreading a multi-selection apart or drawing it together by a handle of its frame (Refactor.97; legacy selection_ui.js:180-226,
// the rules followed, the code written anew). Nodes keep their size; the distances between their centres grow or shrink by one
// factor per axis, so the frame's dragged edge follows the pointer while the opposite edge stays where it was. A corner handle works
// both axes, an edge handle one. The move stops where two nodes would newly overlap (an overlap already there does not lock it);
// drawing together keeps up to 8px of a gap that was there. Pure: positions in, positions out.
// 拖多選框的把手把選取拉開或收攏（R.97；照舊產品的規則，程式重寫）。節點大小不變；中心之間的距離每個方向用一個倍數放大或縮小，被拖的那一邊
// 跟著游標、對邊不動。角落的把手兩個方向都動，邊上的只動一個。拖到兩個節點會新重疊的地方就停（原本就重疊的不會卡住）；收攏時保留原本最多
// 8px 的間隙。純函式：給位置、回位置。

export type Box = { id: string; x: number; y: number; width: number; height: number };
export type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
export const HANDLES: readonly Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
/** At most this much of an existing gap is kept while drawing together (legacy). 收攏時最多保留這麼多原本的間隙（照舊產品）。 */
const KEEP_GAP = 8;

type Axis = { start: 'x' | 'y'; size: 'width' | 'height'; direction: -1 | 0 | 1; delta: number };

/** Where each node goes when `handle` is dragged by (dx, dy) in flow units. 把手拖了 (dx, dy)（畫布單位）之後，每個節點的位置。 */
export function spreadPositions(boxes: readonly Box[], handle: Handle, dx: number, dy: number): Map<string, { x: number; y: number }> {
  const axes: Axis[] = [
    { start: 'x', size: 'width', direction: handle.includes('w') ? -1 : handle.includes('e') ? 1 : 0, delta: dx },
    { start: 'y', size: 'height', direction: handle.includes('n') ? -1 : handle.includes('s') ? 1 : 0, delta: dy },
  ];
  const centre = (box: Box, axis: Axis) => box[axis.start] + box[axis.size] / 2;
  // The outer span of the selection when the centres are scaled by f. 中心乘上 f 之後，整個選取的外框長度。
  const span = (axis: Axis, f: number) => Math.max(...boxes.map(box => centre(box, axis) * f + box[axis.size] / 2))
    - Math.min(...boxes.map(box => centre(box, axis) * f - box[axis.size] / 2));
  // The factor that makes the outer span follow the pointer; the span only grows with f, so it is found by halving.
  // 讓外框長度跟著游標的倍數；外框長度隨 f 只增不減，所以用二分法找。
  const factors = axes.map(axis => {
    if (!axis.direction) return 1;
    // One node as long as the whole selection holds the others inside its length: the span does not move at first, so the
    // centres' spread follows the pointer instead, or it would jump (legacy). 一個節點和整個選取一樣長、把其他的包在它的長度裡：外框
    // 一開始不會變，改讓中心之間的距離跟著游標，否則會跳（照舊產品）。
    if (span(axis, 1) <= Math.max(...boxes.map(box => box[axis.size])) + 1e-6) {
      const centres = boxes.map(box => centre(box, axis)), spread = Math.max(...centres) - Math.min(...centres);
      return spread > 0 ? Math.max(0, 1 + axis.direction * axis.delta / spread) : 1;
    }
    // Drawn together, the span stops at the longest node (legacy selection_ui.js:186): the largest factor that gives the span, so a
    // smaller node stops against the longer one's edge rather than going on to its centre (Refactor.100.1, human 2026-10-12: two
    // nodes ended centred). 收攏時外框停在最長的那個節點（照舊產品）：取得到這個外框的最大倍數，所以小的停在長的那一邊的邊上，不會一路縮到
    // 中心（R.100.1，人類：兩個節點最後置中了）。
    const target = Math.max(span(axis, 0), span(axis, 1) + axis.direction * axis.delta);
    let low = 0, high = 1;
    while (span(axis, high) <= target) high *= 2;
    for (let i = 0; i < 50; i++) { const mid = (low + high) / 2; if (span(axis, mid) <= target) low = mid; else high = mid; }
    return low;
  });
  // How far along the way (0 to 1) the move may go before two nodes newly overlap; a gap of up to KEEP_GAP is kept.
  // 往目標走多遠（0 到 1）之前兩個節點會新重疊；保留最多 KEEP_GAP 的間隙。
  let travel = 1;
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i]!, b = boxes[j]!;
    const apart = axes.map(axis => Math.abs(centre(a, axis) - centre(b, axis))), reach = axes.map(axis => (a[axis.size] + b[axis.size]) / 2);
    if (apart.every((distance, k) => distance < reach[k]!)) continue; // already overlapping 原本就重疊
    // Each axis overlaps for t in (enter, leave); both together is a collision. 每個方向在 (enter, leave) 之間重疊；兩個方向同時重疊就是碰撞。
    let enter = 0, leave = 1;
    axes.forEach((axis, k) => {
      const distance = apart[k]!, limit = reach[k]! + Math.min(KEEP_GAP, Math.max(0, distance - reach[k]!));
      if (distance === 0) return;
      const slack = distance - limit, speed = distance * (factors[k]! - 1);
      if (speed === 0) { if (slack >= 0) leave = -1; }
      else if (speed < 0) enter = Math.max(enter, -slack / speed);
      else leave = Math.min(leave, -slack / speed);
    });
    if (enter < leave) travel = Math.min(travel, enter);
  }
  const result = new Map(boxes.map(box => [box.id, { x: box.x, y: box.y }]));
  axes.forEach((axis, k) => {
    if (!axis.direction) return;
    const factor = 1 + (factors[k]! - 1) * travel, moved = boxes.map(box => centre(box, axis) * factor - box[axis.size] / 2);
    // Keep the edge opposite the handle where it was. 把手對面的那一邊留在原處。
    const edge = axis.direction > 0 ? Math.min(...boxes.map(box => box[axis.start])) : Math.max(...boxes.map(box => box[axis.start] + box[axis.size]));
    const after = axis.direction > 0 ? Math.min(...moved) : Math.max(...moved.map((value, i) => value + boxes[i]![axis.size]));
    boxes.forEach((box, i) => { result.get(box.id)![axis.start] = moved[i]! + edge - after; });
  });
  return result;
}
