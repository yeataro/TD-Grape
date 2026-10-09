import { core, type Declaration } from './core';
import type { ComponentState, UniformStates } from './host';

// Each component's state in TD (Uniform D1, Q60). Before TD has reported, a preset Uniform shows its
// table's expression (the row TD makes gets it). 各分量在 TD 的狀態；TD 還沒回報時，預設 Uniform 顯示表上的 expression。
export function modesOf(declaration: Declaration, td: UniformStates): readonly (ComponentState | undefined)[] | undefined {
  const reported = td[declaration.id];
  if (reported) return reported;
  const preset = core.uniformPresets.find(item => item.entry === declaration.entry);
  return preset ? [{ mode: 'expression', text: preset.expression }] : undefined;
}
