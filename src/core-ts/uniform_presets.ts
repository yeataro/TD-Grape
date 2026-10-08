// Generated from src/library/uniform_presets.json by tools/build_core.cjs; edit the JSON, not this file.
/** Uniform presets (design-interview Q61): Uniforms whose meaning Grape knows. A Uniform declaration
 * points to one by `entry`; name and type come from here and are locked in the web editor.
 * `expression` is shown to people only: TD reads its own copy from the editor bundle and never runs
 * an expression sent by the editor. `hint` is the English original (translations: locales, code
 * uniformPreset.<entry>, Q34). 預設 Uniform：由 JSON 產生，請改 JSON。 */
export interface UniformPreset {
  readonly entry: string; readonly name: string; readonly type: string;
  readonly expression: string; readonly common: string | null; readonly hint: string;
}
export const uniformPresets: readonly UniformPreset[] = Object.freeze([
  {
    "entry": "absTime",
    "name": "uAbsTime",
    "type": "float",
    "expression": "absTime.seconds",
    "common": "absTime",
    "hint": "Seconds since TouchDesigner started; keeps running."
  },
  {
    "entry": "absFrame",
    "name": "uAbsFrame",
    "type": "float",
    "expression": "absTime.frame",
    "common": "absFrame",
    "hint": "Frames since TouchDesigner started; keeps running."
  },
  {
    "entry": "time",
    "name": "uTime",
    "type": "float",
    "expression": "me.time.seconds",
    "common": null,
    "hint": "Seconds on this Grape OP's timeline; stops and loops with the timeline. For time that keeps running, use uAbsTime."
  },
  {
    "entry": "frame",
    "name": "uFrame",
    "type": "float",
    "expression": "me.time.frame",
    "common": null,
    "hint": "Frame on this Grape OP's timeline; stops and loops with the timeline."
  },
  {
    "entry": "deltaTime",
    "name": "uDeltaTime",
    "type": "float",
    "expression": "absTime.stepSeconds",
    "common": "deltaTime",
    "hint": "Seconds from the previous frame to this one (all of TouchDesigner)."
  },
  {
    "entry": "frameStep",
    "name": "uFrameStep",
    "type": "float",
    "expression": "absTime.step",
    "common": null,
    "hint": "Frames from the previous frame to this one; more than 1 when TouchDesigner drops frames."
  }
].map(entry => Object.freeze(entry)));
