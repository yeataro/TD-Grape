import { useSyncExternalStore } from 'react';
import { tr, say } from './text';
import { FoldSection, IconButton } from './controls';
import { appearance, appearanceSubscribe, setShadow, shadowOn } from './appearance';
import { TUNABLES, currentValue, setTuning, tunedValue, tuningSubscribe, tuningVersion, type Tunable } from './appearance_tuning';

// The Appearance panel (Refactor.58.2; human 2026-10-09: in the end an appearance panel, opened from the appearance menu
// or the toolbar). For now: the shadow trials and the values being tuned. The permanent settings (theme, light or dark,
// size, language, port style) stay in the appearance menu. 外觀面板（人類：最後是一個外觀面板，從外觀選單或功能列打開）。
// 目前：陰影試驗與正在調的數值。常駐設定（主題、明暗、大小、語言、接孔樣式）留在外觀選單。
const trials = [
  ['layers', tr('appearance.shadowLayers', 'Layered shadows')], ['canvas', tr('appearance.shadowCanvas', 'Canvas inner shadow')],
  ['cards', tr('appearance.shadowCards', 'Card shadows')], ['glow', tr('appearance.shadowGlow', 'Inner glow')],
] as const;

function TuningRow({ tunable }: { tunable: Tunable }) {
  const value = currentValue(tunable.name), tuned = tunedValue(tunable.name) !== null;
  const number = parseFloat(value) || 0, unit = tunable.kind === 'percent' ? '%' : 'px';
  return <div className="tuning-row">
    <span className="tuning-label">{say(tunable.label)}</span>
    {tunable.kind === 'color'
      ? <input type="color" aria-label={say(tunable.label)} value={value} onChange={event => setTuning(tunable.name, event.target.value)} />
      : <><input type="range" aria-label={say(tunable.label)} min={tunable.min} max={tunable.max} step={tunable.step} value={number}
          onChange={event => setTuning(tunable.name, event.target.value + unit)} /><output>{number}{unit}</output></>}
    <IconButton icon="undo" label={tr('tune.reset', 'Back to the theme')} disabled={!tuned} onClick={() => setTuning(tunable.name, null)} />
  </div>;
}

export function AppearancePanel() {
  useSyncExternalStore(tuningSubscribe, tuningVersion);
  useSyncExternalStore(appearanceSubscribe, appearance);
  const changed = TUNABLES.filter(item => tunedValue(item.name) !== null);
  return <section className="appearance-panel">
    <FoldSection remember="appearance.trials" title={say(tr('appearance.trials', 'Trials'))}
      hint={tr('appearance.trialsHint', 'Looks being tried out. Once decided, the chosen ones stay and the switches go.')}>
      {trials.map(([key, label]) => <label key={key} className="check">
        <input type="checkbox" checked={shadowOn(key)} onChange={event => setShadow(key, event.target.checked)} />{say(label)}</label>)}
    </FoldSection>
    <FoldSection remember="appearance.values" title={say(tr('appearance.values', 'Values'))}
      hint={tr('appearance.valuesHint', 'Changes show at once and stay in this browser. The arrow puts one back to the theme.')}>
      {TUNABLES.map(tunable => <TuningRow key={tunable.name} tunable={tunable} />)}
      {/* What has been tuned, readable for writing into the theme later. 調過哪些，之後寫進主題時看得到。 */}
      {changed.length > 0 && <pre className="tuning-changed">{changed.map(item => `${item.name}: ${tunedValue(item.name)};`).join('\n')}</pre>}
    </FoldSection>
  </section>;
}
