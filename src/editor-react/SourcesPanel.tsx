import { useState, useSyncExternalStore } from 'react';
import { useReactFlow } from '@xyflow/react';
import { core, type Declaration } from './core';
import { tr, say, tdValueHint, type Message } from './text';
import { NameField, SourceCard, UnusedCard, kindGroup } from './SourceCard';
import { TexturePreview } from './TexturePreview';
import { ValueFields, componentColor } from './ValueFields';
import { useSession } from './contexts';
import { Badge, ConfirmDialog, FoldSection, Select } from './controls';
import { modesOf } from './declaration_modes';

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
// A colour Uniform's type reads as its channels, each letter in its channel's colour, as in the value boxes (human
// 2026-10-09). 顏色 Uniform 的型別寫成通道，每個字母用該通道的顏色，同數值框（人類）。
const colorTypes = ['vec3', 'vec4'] as const;
const channelLabel = (type: string) => {
  const name = type === 'vec3' ? 'RGB' : 'RGBA';
  return <span aria-label={name}>{[...name].map((letter, i) => <span key={i} style={{ color: componentColor(i) }}>{letter}</span>)}</span>;
};

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
  // Every Uniform type select as wide as the widest choice any of them has (RGBA, or a longer type name), so the
  // column lines up (human 2026-10-09). 每個 Uniform 型別選單和所有選項裡最寬的一樣寬（RGBA 或更長的型別名），整欄對齊（人類）。
  const uniformTypeSizes = [...colorTypes.map(channelLabel), ...types];
  // The default-image selects line up the same way (human 2026-10-09). 預設圖選單一樣對齊（人類）。
  const textureOptions = core.defaultTextures.map(texture => ({ value: texture, label: say(textureNames[texture] ?? tr('texture.other', '{name}', { name: texture })) }));
  // The panel is an index of the table beside the td_value node (Q45); TOP for now.
  // 面板只是 td_value 旁邊那張表的索引；目前是 TOP。
  const builtins = core.tdValues.filter(entry => core.usableTdValue(entry, 'top'));
  // Deleting a source that nodes on the canvas use asks first: those nodes go with it (human 2026-10-09; legacy asked for
  // every source, here only when it is used). 刪掉畫布上有節點在用的來源先問：那些節點會一起刪掉（人類；舊產品每次都問，這裡只在有人用時問）。
  const [confirming, setConfirming] = useState<Declaration | null>(null);
  const remove = (declaration: Declaration) => (references[declaration.id] ?? 0) > 0 ? setConfirming(declaration) : session.removeDeclaration(declaration.id);
  // Each section's count, in its colour group (legacy source counts; Refactor.54: the Sources area is coloured).
  // 每一區的數量，用該區的 colorGroup 上色（照舊產品；來源區上色）。
  const count = (n: number, kind: string) => <Badge count={n} group={core.declarationKinds.get(kind)?.colorGroup ?? 'runtime'}
    title={tr('sources.available', '{count} available', { count: n })} />;
  return <section className="sources">
    {confirming && <ConfirmDialog title={tr('sources.removeTitle', 'Delete {name}?', { name: core.declarationLabel(declarations, confirming) })}
      message={tr('sources.removeConfirm', '{name} is used by {count} node(s) on the canvas. Deleting it also deletes them.',
        { name: core.declarationLabel(declarations, confirming), count: references[confirming.id] ?? 0 })}
      confirmLabel={tr('sources.remove', 'Delete')} onCancel={() => setConfirming(null)}
      onConfirm={() => { session.removeDeclaration(confirming.id); setConfirming(null); }} />}
    <FoldSection remember="sources.textureInputs" open={false} title={<>{say(tr('sources.textureInputs', 'TOP texture inputs'))}{count(inputs.length, 'topInput')}</>}
      hint={tr('sources.textureInputsHint', 'Each one is an input of the Grape OP in TD, in this order. When no TOP is connected there, it shows its default image.')}
      actions={<button onClick={() => session.addTopInput()}>{say(tr('sources.addInput', '+ Add input'))}</button>}>
    {inputs.map(declaration => <SourceCard key={declaration.id} group={kindGroup(declaration)} refKey={declaration.id} outputs={core.declarationOutputs(declaration)} choice={'declaration:' + declaration.id} uses={references[declaration.id] ?? 0}
      onAdd={() => session.placeDeclaration(declaration.id, center())} onRemove={() => remove(declaration)} head={<>
        {/* Named by its position, not editable (human 2026-10-09). 照位置命名、不能改（人類）。 */}
        <code className="source-fixed-name" title={say(tr('sources.inputConnector', 'Input {number} of the Grape OP in TD', { number: inputs.indexOf(declaration) + 1 }))}>
          {core.declarationLabel(declarations, declaration)}</code>
        <Select label={tr('sources.defaultTexture', 'Default image')} title={tr('sources.defaultTexture', 'Default image')}
          value={String(declaration.defaultTexture)} onChange={value => session.setDefaultTexture(declaration.id, value)}
          options={textureOptions} sizeTo={textureOptions.map(option => option.label)} /></>}>
      <TexturePreview texture={String(declaration.defaultTexture)} />
    </SourceCard>)}
    </FoldSection>
    {/* A colour or not is chosen when added (Q59). 是不是顏色在新增時決定。 */}
    <FoldSection remember="sources.uniforms" title={<>{say(tr('sources.uniforms', 'Uniforms'))}{count(uniforms.length, 'uniform')}</>}
      hint={tr('sources.uniformsHint', 'Values TD reads as parameters of the GLSL OP: colours on its Colors page, the rest on Vectors. Changing a value does not recompile.')}
      actions={<><button onClick={() => session.addUniform()}>{say(tr('sources.addUniform', '+ Uniform'))}</button>
      <button onClick={() => session.addUniform(true)}>{say(tr('sources.addColorUniform', '+ Color'))}</button></>}>
    {!uniforms.length && <p className="hint">{say(tr('sources.noUniforms', 'No Uniforms yet. A Uniform becomes a Uniform parameter of the GLSL OP in TD; changing its value does not recompile the shader.'))}</p>}
    {uniforms.map(declaration => <SourceCard key={declaration.id} group={kindGroup(declaration)} refKey={declaration.id} outputs={core.declarationOutputs(declaration)} choice={'declaration:' + declaration.id} uses={references[declaration.id] ?? 0}
      onAdd={() => session.placeDeclaration(declaration.id, center())} onRemove={() => remove(declaration)} head={<>
        <NameField declaration={declaration} />
        {/* A colour stays a colour: vec3 or vec4 (Q59). 顏色只在 vec3、vec4 之間換。 */}
        <Select label={tr('sources.type', 'Type')} value={declaration.type} onChange={value => session.setDeclarationType(declaration.id, value)}
          options={declaration.color === true
            // A colour reads as a colour (human 2026-10-09); the type stays vec3/vec4. 顏色看得出是顏色（人類）；型別仍是 vec3／vec4。
            ? colorTypes.map(type => ({ value: type, label: channelLabel(type) })) : types.map(type => ({ value: type, label: type }))}
          sizeTo={uniformTypeSizes} /></>}>
      {uniformValue(declaration)}
    </SourceCard>)}
    </FoldSection>
    {/* Time (preset Uniforms, Q61): all six listed, unused ones as grey cards (created by Create or by dragging one onto the canvas).
        Name and type are locked here; in TD it is an ordinary Uniform row with an expression.
        時間（預設 Uniform）：6 筆都列出，沒用到的是灰色卡片（Create 或拖到畫布時建立）。名字型別在這裡鎖住；在 TD 是一般的 Uniform 列。 */}
    <FoldSection remember="sources.time" open={false} title={<>{say(tr('sources.time', 'Time'))}{count(core.uniformPresets.filter(preset => presetOf(preset.entry)).length, 'uniform')}</>}
      hint={tr('sources.timeHint', 'Uniforms that TouchDesigner drives with an expression. The name is fixed; one of each per graph. Remove the expression in TD to set the value yourself.')}>
    {core.uniformPresets.map(preset => { const declared = presetOf(preset.entry);
      const hint = say({ code: 'uniformPreset.' + preset.entry, source: preset.hint }) + '\n' + preset.expression;
      return declared ? <SourceCard key={preset.entry} group={kindGroup(declared)} refKey={declared.id} outputs={core.declarationOutputs(declared)} choice={'preset:' + preset.entry} uses={references[declared.id] ?? 0}
          onAdd={() => session.placePreset(preset.entry, center())} onRemove={() => remove(declared)}
          head={<div className="builtin-row" title={hint}><code>{preset.name}</code><small>{preset.expression}</small></div>}>{uniformValue(declared)}</SourceCard>
        // Not created yet: a grey card with one button, Create; dragged onto the canvas it is created and placed.
        // 還沒建立：灰色卡片、只有 Create；拖到畫布上就建立並放上去。
        : <UnusedCard key={preset.entry} choice={'preset:' + preset.entry} title={hint}>
          <div className="builtin-row"><code>{preset.name}</code><small>{preset.expression}</small>
            <button onClick={() => session.createPreset(preset.entry)}>{say(tr('sources.create', 'Create'))}</button></div></UnusedCard>; })}
    </FoldSection>
    <FoldSection remember="sources.constants" open={false} title={<>{say(tr('sources.constants', 'Global constants'))}{count(constants.length, 'constant')}</>}
      hint={tr('sources.constantsHint', 'Fixed values written into the shader. Changing one recompiles it.')}
      actions={<button onClick={() => session.addConstant()}>{say(tr('sources.addConstant', '+ Add constant'))}</button>}>
    {!constants.length && <p className="hint">{say(tr('sources.noConstants', 'No global constants yet. A constant is written into the shader as const and can be used by many nodes.'))}</p>}
    {constants.map(declaration => <SourceCard key={declaration.id} group={kindGroup(declaration)} refKey={declaration.id} outputs={core.declarationOutputs(declaration)} choice={'declaration:' + declaration.id} uses={references[declaration.id] ?? 0}
      onAdd={() => session.placeDeclaration(declaration.id, center())} onRemove={() => remove(declaration)} head={<>
        <NameField declaration={declaration} />
        <Select label={tr('sources.type', 'Type')} value={declaration.type} onChange={value => session.setDeclarationType(declaration.id, value)}
          options={types.map(type => ({ value: type, label: type }))} /></>}>
      <ValueFields label={`${declaration.name} value`} type={declaration.type} value={declaration.value ?? 0}
        commit={value => session.setDeclarationValue(declaration.id, value)} />
    </SourceCard>)}
    </FoldSection>
    <FoldSection remember="sources.tdValues" open={false} title={<>{say(tr('sources.tdValues', 'TD built-in values'))}{count(builtins.length, 'tdValue')}</>}
      hint={tr('sources.tdValuesHint', 'Values TouchDesigner already provides to the shader. No setup needed; they also work inside subgraphs.')}>
    {/* Cards like the others; the type in plain text as above. Open, the description, which is what it is, and TD's page
        for it (human 2026-10-09; as the legacy cards). 和其他一樣的卡片；型別同上用一般文字。打開是它的說明（這才是它的內容）
        和 TD 的說明頁（人類；同舊產品卡片）。 */}
    {builtins.map(entry => <SourceCard key={entry.id} group="runtime" refKey={'tdValue:' + entry.id} outputs={core.tdValueOutputs(entry)} choice={'tdValue:' + entry.id}
      uses={references['tdValue:' + entry.id] ?? 0} onAdd={() => session.placeTdValue(entry.id, center())}
      head={<div className="builtin-row"><code>{entry.name}</code><small>{entry.type}</small></div>}>
      <p className="source-text">{say(tdValueHint(entry))}
        {entry.helpUrl && <> <a href={entry.helpUrl} target="_blank" rel="noreferrer">{say(tr('sources.tdDocs', 'TouchDesigner docs'))}</a></>}</p>
    </SourceCard>)}
    </FoldSection>
  </section>;
}
