// The visible list is the selection area; only travel outside it changes values.
// 可見列表就是選級距的區域；離開左右邊界後的水平位移才用來調值。
export const ladderLayout = {
  width: 52,
  rowHeight: 24,
  inset: 5,
  margin: 8,
  pixelsPerStep: 8,
  readoutWidth: 180,
  readoutHeight: 42,
};

export type LadderMotion = {
  left: number;
  top: number;
  steps: number[];
  index: number;
  value: number;
  drag?: { side: -1 | 1; origin: number; base: number };
};

export function ladderPosition(x: number, y: number, rows: number, index: number,
  viewportWidth: number, viewportHeight: number) {
  const { width, rowHeight, inset, margin } = ladderLayout;
  return {
    left: Math.max(margin, Math.min(x - width / 2, viewportWidth - width - margin)),
    top: Math.max(margin, Math.min(y - inset - (index + 0.5) * rowHeight,
      viewportHeight - rows * rowHeight - inset * 2 - margin)),
  };
}

// The adjusting readout sits outside the input, not over the number being edited.
// 調值讀數放在原輸入框下方；下方空間不足時移到上方，不遮住原數值。
export function ladderReadoutPosition(input: { left: number; top: number; bottom: number },
  viewportWidth: number, viewportHeight: number) {
  const { readoutWidth, readoutHeight, margin } = ladderLayout;
  return {
    left: Math.max(margin, Math.min(input.left, viewportWidth - readoutWidth - margin)),
    top: input.bottom + margin + readoutHeight <= viewportHeight - margin
      ? input.bottom + margin
      : Math.max(margin, input.top - margin - readoutHeight),
  };
}

export function moveLadder(state: LadderMotion, x: number, y: number,
  normalize: (value: number) => number) {
  const { width, inset, rowHeight, pixelsPerStep } = ladderLayout;
  const right = state.left + width;

  if (x >= state.left && x <= right) {
    // Returning to the list keeps the current draft and permits another step.
    // 回到列表保留目前草稿；換級距本身不修改數值，也不提交圖。
    state.drag = undefined;
    state.index = Math.max(0, Math.min(state.steps.length - 1,
      Math.floor((y - state.top - inset) / rowHeight)));
    return;
  }

  const side = x < state.left ? -1 : 1;
  if (state.drag?.side !== side) {
    state.drag = { side, origin: side < 0 ? state.left : right, base: state.value };
  }
  const ticks = Math.trunc((x - state.drag.origin) / pixelsPerStep);
  const candidate = state.drag.base + ticks * state.steps[state.index];
  if (Number.isFinite(candidate)) state.value = normalize(Number(candidate.toPrecision(15)));
}
