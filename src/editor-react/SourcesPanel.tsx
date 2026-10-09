import { useEffect, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { useReactFlow } from '@xyflow/react';
import { core, type Declaration } from './core';
import { tr, say, tdValueHint, type Message } from './text';
import { ValueFields } from './ValueFields';
import { useSession } from './contexts';
import { Badge, FoldSection, Select } from './controls';
import { modesOf } from './declaration_modes';
import type { ComponentState, UniformStates } from './host';

// Shared Sources panel content (design-interview Q41 naming, Q45: the panel is an index — it keeps
// no list of its own, it reads the graph's declarations and the TD built-in value table). For now: TOP
// texture inputs, Uniforms, time (preset Uniforms), global constants and TD built-in values.
// 共用來源面板的內容：面板只是索引，讀圖的宣告與各張表、不另存清單。目前：TOP 貼圖輸入、Uniform、時間、全域常數、TD 內建值。
// Default images (human 2026-10-09: the Samples outputs). 預設圖（Samples 的出口）。
const textureNames: Record<string, Message> = {
  grape: tr('texture.grape', 'Grape'), banana: tr('texture.banana', 'Banana'), jellybeans: tr('texture.jellybeans', 'Jellybeans'),
  white: tr('texture.white', 'White'), black: tr('texture.black', 'Black'), normal: tr('texture.normal', 'Flat normal'),
  custom: tr('texture.custom', 'TOP chosen on Samples'),
};
function NameField({ declaration }: { declaration: Declaration }) {
  const session = useSession(), [draft, setDraft] = useState(declaration.name);
  useEffect(() => setDraft(declaration.name), [declaration.name]);
  const commit = () => { if (draft !== declaration.name && !session.renameDeclaration(declaration.id, draft)) setDraft(declaration.name); };
  return <input className="source-name" aria-label={say(tr('sources.name', 'Name'))} value={draft}
    onChange={event => setDraft(event.target.value)} onBlur={commit}
    onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { setDraft(declaration.name); event.currentTarget.blur(); } }} />;
}

// A source card shows its kind's colour on a strip at its left, as a node title turned on its side (human 2026-10-09
// trial; a handle for reordering may come later). 來源卡片左邊一條是它種類的顏色，像轉了方向的節點標題（人類試驗；之後可能當排序把手）。
const kindColor = (declaration: Declaration) =>
  ({ '--group-color': `var(--group-${core.declarationKinds.get(declaration.kind)?.colorGroup ?? 'function'})` }) as CSSProperties;

export function SourcesPanel({ declarations, references }: {
  declarations: readonly Declaration[]; references: Readonly<Record<string, number>>;
}) {
  const session = useSession(), flow = useReactFlow();
  // TD's states follow on their own, without re-rendering the canvas (Uniform D2). TD 的現況自己更新，不重繪畫布。
  const td = useSyncExternalStore(session.tdSubscribe, session.tdSnapshot);
  const constants = declarations.filter(d => d.kind === 'constant'), inputs = declarations.filter(d => d.kind === 'topInput');
  // Preset Uniforms are listed in the time section. 預設 Uniform 列在時間區。
  const uniforms = declarations.filter(d => d.kind === 'uniform' && d.entry === undefined);
  const presetOf = (entry: string) => declarations.find(d => d.kind === 'uniform' && d.entry === entry);
  const uniformValue = (declaration: Declaration) => <ValueFields label={`${declaration.name} value`} type={declaration.type}
    value={declaration.value ?? 0} color={declaration.color === true} names={declaration.color === true ? 'RGBA' : 'XYZW'}
    modes={modesOf(declaration, td)}
    commit={value => session.setDeclarationValue(declaration.id, value)}
    preview={value => session.previewDeclarationValue(declaration.id, value)} />;
  const center = () => {
    const canvas = document.querySelector('.canvas')!.getBoundingClientRect();
    return flow.screenToFlowPosition({ x: canvas.x + canvas.width / 2, y: canvas.y + canvas.height / 2 });
  };
  const types = core.declarationKinds.get('constant')!.types;
  // The panel is an index of the table beside the td_value node (Q45); TOP for now.
  // 面板只是 td_value 旁邊那張表的索引；目前是 TOP。
  const builtins = core.tdValues.filter(entry => core.usableTdValue(entry, 'top'));
  const actions = (declaration: Declaration) => <div className="source-actions">
    <small>{say(tr('sources.usedBy', 'Used by {count} nodes', { count: references[declaration.id] ?? 0 }))}</small>
    <button onClick={() => session.placeDeclaration(declaration.id, center())}>{say(tr('sources.place', 'Add to graph'))}</button>
    <button onClick={() => session.removeDeclaration(declaration.id)}>{say(tr('sources.remove', 'Delete'))}</button>
  </div>;
  // Each section's count, in its colour group (legacy source counts; Refactor.54: the Sources area is coloured).
  // 每一區的數量，用該區的 colorGroup 上色（照舊產品；來源區上色）。
  const count = (n: number, kind: string) => <Badge count={n} group={core.declarationKinds.get(kind)?.colorGroup ?? 'runtime'}
    title={tr('sources.available', '{count} available', { count: n })} />;
  return <section className="sources">
    <FoldSection title={<>{say(tr('sources.textureInputs', 'TOP texture inputs'))}{count(inputs.length, 'topInput')}</>}
      actions={<button onClick={() => session.addTopInput()}>{say(tr('sources.addInput', '+ Add input'))}</button>}>
    <p className="hint">{say(tr('sources.textureInputsHint', 'Each one is an input of the Grape OP in TD, in this order. When no TOP is connected there, it shows its default image.'))}</p>
    {inputs.map(declaration => <div className="source-row" key={declaration.id} style={kindColor(declaration)}>
      <div className="source-head">
        <NameField declaration={declaration} />
        <Select label={tr('sources.defaultTexture', 'Default image')} title={tr('sources.defaultTexture', 'Default image')}
          value={String(declaration.defaultTexture)} onChange={value => session.setDefaultTexture(declaration.id, value)}
          options={core.defaultTextures.map(texture => ({ value: texture, label: say(textureNames[texture] ?? tr('texture.other', '{name}', { name: texture })) }))} />
      </div>
      {actions(declaration)}
    </div>)}
    </FoldSection>
    {/* A colour or not is chosen when added (Q59). 是不是顏色在新增時決定。 */}
    <FoldSection title={<>{say(tr('sources.uniforms', 'Uniforms'))}{count(uniforms.length, 'uniform')}</>}
      actions={<><button onClick={() => session.addUniform()}>{say(tr('sources.addUniform', '+ Uniform'))}</button>
      <button onClick={() => session.addUniform(true)}>{say(tr('sources.addColorUniform', '+ Colour Uniform'))}</button></>}>
    {!uniforms.length && <p className="hint">{say(tr('sources.noUniforms', 'No Uniforms yet. A Uniform becomes a Uniform parameter of the GLSL OP in TD; changing its value does not recompile the shader.'))}</p>}
    {uniforms.map(declaration => <div className="source-row" key={declaration.id} style={kindColor(declaration)}>
      <div className="source-head">
        <NameField declaration={declaration} />
        {/* A colour stays a colour: vec3 or vec4 (Q59). 顏色只在 vec3、vec4 之間換。 */}
        <Select label={tr('sources.type', 'Type')} value={declaration.type} onChange={value => session.setDeclarationType(declaration.id, value)}
          options={(declaration.color === true ? ['vec3', 'vec4'] : types).map(type => ({ value: type, label: type }))} />
      </div>
      {uniformValue(declaration)}
      {actions(declaration)}
    </div>)}
    </FoldSection>
    {/* Time (preset Uniforms, Q61): all six listed, unused ones grey; placing one creates it the first time.
        Name and type are locked here; in TD it is an ordinary Uniform row with an expression.
        時間（預設 Uniform）：6 筆都列出，沒用到的灰色；第一次放到圖上時建立。名字型別在這裡鎖住；在 TD 是一般的 Uniform 列。 */}
    <FoldSection title={<>{say(tr('sources.time', 'Time'))}{count(core.uniformPresets.filter(preset => presetOf(preset.entry)).length, 'uniform')}</>}>
    <p className="hint">{say(tr('sources.timeHint', 'Uniforms that TouchDesigner drives with an expression. The name is fixed; one of each per graph. Remove the expression in TD to set the value yourself.'))}</p>
    {core.uniformPresets.map(preset => { const declared = presetOf(preset.entry);
      const hint = say({ code: 'uniformPreset.' + preset.entry, source: preset.hint }) + '\n' + preset.expression;
      return <div className={declared ? 'source-row' : 'builtin-row unused'} key={preset.entry} title={hint} style={declared ? kindColor(declared) : undefined}>
        <div className="builtin-row"><code>{preset.name}</code>
          <small>{declared ? say(tr('sources.usedBy', 'Used by {count} nodes', { count: references[declared.id] ?? 0 })) : preset.expression}</small>
          <button onClick={() => session.placePreset(preset.entry, center())}>{say(tr('sources.place', 'Add to graph'))}</button>
          {declared && <button onClick={() => session.removeDeclaration(declared.id)}>{say(tr('sources.remove', 'Delete'))}</button>}</div>
        {declared && uniformValue(declared)}
      </div>; })}
    </FoldSection>
    <FoldSection title={<>{say(tr('sources.constants', 'Global constants'))}{count(constants.length, 'constant')}</>}
      actions={<button onClick={() => session.addConstant()}>{say(tr('sources.addConstant', '+ Add constant'))}</button>}>
    {!constants.length && <p className="hint">{say(tr('sources.noConstants', 'No global constants yet. A constant is written into the shader as const and can be used by many nodes.'))}</p>}
    {constants.map(declaration => <div className="source-row" key={declaration.id} style={kindColor(declaration)}>
      <div className="source-head">
        <NameField declaration={declaration} />
        <Select label={tr('sources.type', 'Type')} value={declaration.type} onChange={value => session.setDeclarationType(declaration.id, value)}
          options={types.map(type => ({ value: type, label: type }))} />
      </div>
      <ValueFields label={`${declaration.name} value`} type={declaration.type} value={declaration.value ?? 0}
        commit={value => session.setDeclarationValue(declaration.id, value)} />
      {actions(declaration)}
    </div>)}
    </FoldSection>
    <FoldSection title={<>{say(tr('sources.tdValues', 'TD built-in values'))}{count(builtins.length, 'tdValue')}</>}>
    <p className="hint">{say(tr('sources.tdValuesHint', 'Values TouchDesigner already provides to the shader. No setup needed; they also work inside subgraphs.'))}</p>
    {builtins.map(entry => <div className="builtin-row" key={entry.id} title={say(tdValueHint(entry))}>
      <code>{entry.name}</code><small>{entry.type}</small>
      <button onClick={() => session.placeTdValue(entry.id, center())}>{say(tr('sources.place', 'Add to graph'))}</button>
    </div>)}
    </FoldSection>
  </section>;
}
