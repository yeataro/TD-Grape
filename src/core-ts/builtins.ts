import { tr, type Message } from './text';

/** Built-in values (graph-structure decision 17; design-interview Q45, Q52): Uniforms whose meaning
 * Grape guarantees — the six legacy time presets. A declaration of kind `builtin` picks one by
 * `entry`; its name is fixed, it has no value and cannot be exposed. `td` is the TD expression,
 * shown to people only: TD keeps its own copy and never runs an expression sent by the editor
 * (next_family.py BUILTIN_EXPRESSIONS). `isf` is the ISF built-in for the ISF export, when one exists.
 * 內建值：語意由 Grape 保證的 Uniform（舊產品的 6 個時間預設）。名稱固定、沒有值、不能公開。
 * td 只給人看：TD 自己保管 expression，不執行編輯器送來的字串。isf 是 ISF 匯出時對應的內建值。 */
export interface BuiltinValue {
  readonly id: string; readonly name: string; readonly type: string;
  readonly td: string; readonly isf: string | null; readonly hint: Message;
}
export const builtinValues: readonly BuiltinValue[] = Object.freeze([
  { id: 'absTime', name: 'uAbsTime', type: 'float', td: 'absTime.seconds', isf: 'TIME',
    hint: tr('builtin.absTime', 'Seconds since TouchDesigner started; keeps running.') },
  { id: 'absFrame', name: 'uAbsFrame', type: 'float', td: 'absTime.frame', isf: 'FRAMEINDEX',
    hint: tr('builtin.absFrame', 'Frames since TouchDesigner started; keeps running.') },
  { id: 'time', name: 'uTime', type: 'float', td: 'me.time.seconds', isf: null,
    hint: tr('builtin.time', "Seconds on this Grape OP's timeline; stops and loops with the timeline. For time that keeps running, use uAbsTime.") },
  { id: 'frame', name: 'uFrame', type: 'float', td: 'me.time.frame', isf: null,
    hint: tr('builtin.frame', "Frame on this Grape OP's timeline; stops and loops with the timeline.") },
  { id: 'deltaTime', name: 'uDeltaTime', type: 'float', td: 'absTime.stepSeconds', isf: 'TIMEDELTA',
    hint: tr('builtin.deltaTime', 'Seconds from the previous frame to this one (all of TouchDesigner).') },
  { id: 'frameStep', name: 'uFrameStep', type: 'float', td: 'absTime.step', isf: null,
    hint: tr('builtin.frameStep', 'Frames from the previous frame to this one; more than 1 when TouchDesigner drops frames.') },
].map(entry => Object.freeze(entry)));
