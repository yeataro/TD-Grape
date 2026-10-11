import { useMemo, useSyncExternalStore } from 'react';
import { core, type Declaration } from './core';
import type { ComponentState, UniformStates } from './host';
import type { Editor as EditorSession } from './editor';

// Each component's state in TD (Uniform D1, Q60). Before TD has reported, a preset Uniform shows its
// table's expression (the row TD makes gets it). 各分量在 TD 的狀態；TD 還沒回報時，預設 Uniform 顯示表上的 expression。
export function modesOf(declaration: Declaration, reported: UniformStates[string] | undefined): readonly (ComponentState | undefined)[] | undefined {
  if (reported) return reported;
  const preset = core.uniformPresets.find(item => item.entry === declaration.entry);
  return preset ? [{ mode: 'expression', text: preset.expression }] : undefined;
}

/** One declaration's states in TD, followed on their own: when TD or a drag moves one Uniform's value, only that Uniform's
 * fields re-render, not every Uniform on the canvas and in the Sources panel (Refactor.79.4; EDITOR_UI_RULES, continuous
 * interactions). 一個宣告在 TD 的狀態，自己跟著更新：TD 或拖曳改了某個 Uniform 的值，只有它的欄位重繪，不是畫布與共用來源面板上
 * 所有 Uniform（R.79.4；畫面規則「連續互動」）。 */
export function useModes(session: EditorSession, declaration: Declaration) {
  const reported = useSyncExternalStore(session.tdSubscribe, () => session.tdSnapshot()[declaration.id]);
  return useMemo(() => modesOf(declaration, reported), [declaration, reported]);
}
