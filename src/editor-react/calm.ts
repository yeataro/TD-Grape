// What the foot bar shows (Refactor.73.2, human 2026-10-10: the bar jumped at every edit, three states within ~20 ms).
// Sending is not delayed; only the showing is. A result shows at once; a state that is only "on its way" shows if it is
// still so after `wait`, read then from the latest state, so it never covers a newer result. Kept apart from React so it
// can be tested (audit since R.67, human 2026-10-11).
// 底列顯示什麼（R.73.2，人類：每次修改底列都在約 20 ms 內跳三個狀態）。送出不延後，只有顯示延後。結果立刻顯示；
// 「途中」要過了 wait 仍是如此才顯示，而且那時讀的是最新的狀態，所以不會蓋掉較新的結果。和 React 分開，才能測試。

/** How long the foot bar keeps showing the last result before it says something is on its way (human 2026-10-10: 0.1 s).
 * 底列在說「正在途中」之前，先維持上一個結果多久（人類：0.1 秒）。 */
export const CALM_MS = 100;

export class CalmGate<T> {
  /** What is shown now. 現在顯示的。 */
  shown: T;
  private latest: T;
  private timer?: ReturnType<typeof setTimeout>;
  constructor(first: T, private readonly passing: (state: T) => boolean, private readonly changed: () => void,
    private readonly wait = CALM_MS) { this.shown = this.latest = first; }
  /** A new state. A result, or more of "on its way" while that is already shown, goes up at once; the first "on its way"
   * waits. 新的狀態：結果、或已在顯示途中時的途中，立刻顯示；第一個途中要等。 */
  feed(state: T) {
    this.latest = state;
    if (!this.passing(state) || this.passing(this.shown)) { clearTimeout(this.timer); this.timer = undefined; this.show(state); return; }
    if (this.timer === undefined) this.timer = setTimeout(() => { this.timer = undefined; this.show(this.latest); }, this.wait);
  }
  /** What to show for `state` right now, before it is fed. 拿到 state 的當下要顯示什麼（還沒 feed 之前）。 */
  view(state: T): T { return !this.passing(state) || this.passing(this.shown) ? state : this.shown; }
  dispose() { clearTimeout(this.timer); }
  private show(state: T) { if (state !== this.shown) { this.shown = state; this.changed(); } }
}
