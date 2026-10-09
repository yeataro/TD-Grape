import { readPreference, writePreference } from './preferences';
import { tr, type Message } from './text';

// Appearance values a person can tune in the Appearance panel (Refactor.58.2; human 2026-10-09: tune while trying, then
// keep the ones that work; design-interview Q64: values are only theme variables, no extra code paths). One row each;
// a new tunable value is one new row. A tuned value is set on the page root, over every theme, and kept in this browser
// (preferences.ts); its default is whatever the theme says, read from the page, never written here.
// 外觀面板裡可以調的外觀數值（人類：邊試邊調，好的再留下；Q64：數值只是主題變數，不多出程式路徑）。一列一項，新增一項＝多一列。
// 調過的值放在頁面根上、蓋過每個主題，記在這個瀏覽器；預設值就是主題寫的，從頁面讀，這裡不寫。
export type Tunable = { name: string; label: Message } & ({ kind: 'color' } | { kind: 'percent' | 'px'; min: number; max: number; step: number });

export const TUNABLES: readonly Tunable[] = [
  { name: '--palette-select-green', label: tr('tune.select', 'Selection'), kind: 'color' },
  { name: '--tint-select-primary', label: tr('tune.selectPrimary', 'Current among several, brighter by'), kind: 'percent', min: 0, max: 80, step: 1 },
  { name: '--selection-gap', label: tr('tune.selectionGap', 'Multi-selection frame distance'), kind: 'px', min: 0, max: 30, step: 1 },
  { name: '--tint-node-border', label: tr('tune.nodeBorder', 'Node outline and title line'), kind: 'percent', min: 0, max: 40, step: 1 },
  { name: '--tint-layer-shadow', label: tr('tune.layerShadow', 'Layered shadow strength'), kind: 'percent', min: 0, max: 80, step: 1 },
  { name: '--layer-blur', label: tr('tune.layerBlur', 'Layered shadow softness'), kind: 'px', min: 0, max: 30, step: 1 },
  { name: '--layer-offset', label: tr('tune.layerOffset', 'Layered shadow offset'), kind: 'px', min: 0, max: 10, step: 1 },
  { name: '--tint-layer-glow', label: tr('tune.layerGlow', 'Inner glow strength'), kind: 'percent', min: 0, max: 20, step: 1 },
  { name: '--layer-glow-blur', label: tr('tune.layerGlowBlur', 'Inner glow reach'), kind: 'px', min: 0, max: 30, step: 1 },
  { name: '--canvas-shadow', label: tr('tune.canvasShadow', 'Canvas inner shadow reach'), kind: 'px', min: 0, max: 60, step: 1 },
  { name: '--tint-glow-select', label: tr('tune.glowSelect', 'Glow strength: selection'), kind: 'percent', min: 0, max: 100, step: 1 },
  { name: '--glow-select', label: tr('tune.glowSelectReach', 'Glow reach: selection'), kind: 'px', min: 0, max: 40, step: 1 },
  { name: '--tint-glow-title', label: tr('tune.glowTitle', 'Glow strength: node titles'), kind: 'percent', min: 0, max: 100, step: 1 },
  { name: '--glow-title', label: tr('tune.glowTitleReach', 'Glow reach: node titles'), kind: 'px', min: 0, max: 40, step: 1 },
  { name: '--tint-glow-highlight', label: tr('tune.glowHighlight', 'Glow strength: highlights'), kind: 'percent', min: 0, max: 100, step: 1 },
  { name: '--glow-highlight', label: tr('tune.glowHighlightReach', 'Glow reach: highlights'), kind: 'px', min: 0, max: 40, step: 1 },
  { name: '--tint-glow-wires', label: tr('tune.glowWires', 'Glow strength: wires'), kind: 'percent', min: 0, max: 100, step: 1 },
  { name: '--glow-wires', label: tr('tune.glowWiresReach', 'Glow reach: wires'), kind: 'px', min: 0, max: 40, step: 1 },
  { name: '--tint-glow-ports', label: tr('tune.glowPorts', 'Glow strength: wired ports'), kind: 'percent', min: 0, max: 100, step: 1 },
  { name: '--glow-ports', label: tr('tune.glowPortsReach', 'Glow reach: wired ports'), kind: 'px', min: 0, max: 40, step: 1 },
  { name: '--tint-glow-logo', label: tr('tune.glowLogo', 'Glow strength: logo'), kind: 'percent', min: 0, max: 100, step: 1 },
  { name: '--glow-logo', label: tr('tune.glowLogoReach', 'Glow reach: logo'), kind: 'px', min: 0, max: 40, step: 1 },
  { name: '--font-xs', label: tr('tune.fontXs', 'Text size: smallest'), kind: 'px', min: 8, max: 24, step: 1 },
  { name: '--font-sm', label: tr('tune.fontSm', 'Text size: small'), kind: 'px', min: 8, max: 24, step: 1 },
  { name: '--font-md', label: tr('tune.fontMd', 'Text size: medium'), kind: 'px', min: 8, max: 24, step: 1 },
  { name: '--font-base', label: tr('tune.fontBase', 'Text size: body'), kind: 'px', min: 8, max: 24, step: 1 },
  { name: '--font-lg', label: tr('tune.fontLg', 'Text size: large'), kind: 'px', min: 8, max: 24, step: 1 },
];

const key = (name: string) => 'tune.' + name;
const listeners = new Set<() => void>();
let version = 0;
export const tuningSubscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const tuningVersion = () => version;

/** What the page uses now (tuned or the theme's). 頁面現在用的值（調過的或主題的）。 */
export const currentValue = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
/** The tuned value, or null when the theme's is used. 調過的值；用主題的就是 null。 */
export const tunedValue = (name: string) => readPreference(key(name));

/** Tune a value, or give it back to the theme with null. 調一個值；null＝還給主題。 */
export function setTuning(name: string, value: string | null) {
  writePreference(key(name), value);
  if (value === null) document.documentElement.style.removeProperty(name); else document.documentElement.style.setProperty(name, value);
  version++; listeners.forEach(listener => listener());
}

// Tuned values apply as soon as the page opens. 打開頁面時就套用調過的值。
if (typeof document !== 'undefined') for (const { name } of TUNABLES) {
  const value = tunedValue(name);
  if (value !== null) document.documentElement.style.setProperty(name, value);
}
