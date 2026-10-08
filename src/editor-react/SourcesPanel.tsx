import { useEffect, useState } from 'react';
import { useReactFlow } from '@xyflow/react';
import { core, type Declaration } from './core';
import { tr, say, tdValueHint, type Message } from './text';
import { ValueFields, useSession } from './NodeCard';

// Shared Sources panel content (design-interview Q41 naming, Q45: the panel is an index — it keeps
// no list of its own, it reads the graph's declarations and the TD built-in value table). For now: TOP
// texture inputs, Uniforms, global constants and TD built-in values.
// 共用來源面板的內容：面板只是索引，讀圖的宣告與 TD 內建值表、不另存清單。目前：TOP 貼圖輸入、Uniform、全域常數、TD 內建值。
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

export function SourcesPanel({ declarations, references }: { declarations: readonly Declaration[]; references: Readonly<Record<string, number>> }) {
  const session = useSession(), flow = useReactFlow();
  const constants = declarations.filter(d => d.kind === 'constant'), inputs = declarations.filter(d => d.kind === 'topInput');
  const uniforms = declarations.filter(d => d.kind === 'uniform');
  const builtinOf = (entry: string) => declarations.find(d => d.kind === 'builtin' && d.entry === entry);
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
  return <section className="sources">
    <header className="sources-section"><span>{say(tr('sources.textureInputs', 'TOP texture inputs'))}</span>
      <button onClick={() => session.addTopInput()}>{say(tr('sources.addInput', '+ Add input'))}</button></header>
    <p className="hint">{say(tr('sources.textureInputsHint', 'Each one is an input of the Grape OP in TD, in this order. When no TOP is connected there, it shows its default image.'))}</p>
    {inputs.map(declaration => <div className="source-row" key={declaration.id}>
      <div className="source-head">
        <NameField declaration={declaration} />
        <select aria-label={say(tr('sources.defaultTexture', 'Default image'))} title={say(tr('sources.defaultTexture', 'Default image'))}
          value={String(declaration.defaultTexture)} onChange={event => session.setDefaultTexture(declaration.id, event.target.value)}>
          {core.defaultTextures.map(texture => <option key={texture} value={texture}>{say(textureNames[texture] ?? tr('texture.other', '{name}', { name: texture }))}</option>)}</select>
      </div>
      {actions(declaration)}
    </div>)}
    <header className="sources-section"><span>{say(tr('sources.uniforms', 'Uniforms'))}</span>
      <button onClick={() => session.addUniform()}>{say(tr('sources.addUniform', '+ Add Uniform'))}</button></header>
    {!uniforms.length && <p className="hint">{say(tr('sources.noUniforms', 'No Uniforms yet. A Uniform becomes a Uniform parameter of the GLSL OP in TD; changing its value does not recompile the shader.'))}</p>}
    {uniforms.map(declaration => <div className="source-row" key={declaration.id}>
      <div className="source-head">
        <NameField declaration={declaration} />
        <select aria-label={say(tr('sources.type', 'Type'))} value={declaration.type}
          onChange={event => session.setDeclarationType(declaration.id, event.target.value)}>
          {types.map(type => <option key={type}>{type}</option>)}</select>
      </div>
      {/* Colour: vec3 and vec4 only (Q51). 顏色只有 vec3、vec4。 */}
      {['vec3', 'vec4'].includes(declaration.type) && <label className="source-flag">
        <input type="checkbox" checked={declaration.color === true}
          onChange={event => session.setDeclarationColor(declaration.id, event.target.checked)} />
        {say(tr('sources.color', 'Colour'))}</label>}
      <ValueFields label={`${declaration.name} value`} type={declaration.type} value={declaration.value ?? 0}
        color={declaration.color === true} names={declaration.color === true ? 'RGBA' : 'XYZW'}
        commit={value => session.setDeclarationValue(declaration.id, value)}
        preview={value => session.previewDeclarationValue(declaration.id, value)} />
      {actions(declaration)}
    </div>)}
    {/* Time (built-in values, Q52): all six listed; placing one creates it the first time.
        時間（內建值）：6 筆都列出；第一次放到圖上時建立。 */}
    <header className="sources-section"><span>{say(tr('sources.time', 'Time'))}</span></header>
    <p className="hint">{say(tr('sources.timeHint', 'Uniforms that TouchDesigner drives for you. The name is fixed; one of each per graph.'))}</p>
    {core.builtinValues.map(entry => { const declared = builtinOf(entry.id);
      return <div className={`builtin-row ${declared ? '' : 'unused'}`} key={entry.id} title={say(entry.hint) + '\n' + entry.td}>
        <code>{entry.name}</code><small>{declared ? say(tr('sources.usedBy', 'Used by {count} nodes', { count: references[declared.id] ?? 0 })) : entry.td}</small>
        <button onClick={() => session.placeBuiltin(entry.id, center())}>{say(tr('sources.place', 'Add to graph'))}</button>
        {declared && <button onClick={() => session.removeDeclaration(declared.id)}>{say(tr('sources.remove', 'Delete'))}</button>}
      </div>; })}
    <header className="sources-section"><span>{say(tr('sources.constants', 'Global constants'))}</span>
      <button onClick={() => session.addConstant()}>{say(tr('sources.addConstant', '+ Add constant'))}</button></header>
    {!constants.length && <p className="hint">{say(tr('sources.noConstants', 'No global constants yet. A constant is written into the shader as const and can be used by many nodes.'))}</p>}
    {constants.map(declaration => <div className="source-row" key={declaration.id}>
      <div className="source-head">
        <NameField declaration={declaration} />
        <select aria-label={say(tr('sources.type', 'Type'))} value={declaration.type}
          onChange={event => session.setDeclarationType(declaration.id, event.target.value)}>
          {types.map(type => <option key={type}>{type}</option>)}</select>
      </div>
      <ValueFields label={`${declaration.name} value`} type={declaration.type} value={declaration.value ?? 0}
        commit={value => session.setDeclarationValue(declaration.id, value)} />
      {actions(declaration)}
    </div>)}
    <header className="sources-section"><span>{say(tr('sources.tdValues', 'TD built-in values'))}</span></header>
    <p className="hint">{say(tr('sources.tdValuesHint', 'Values TouchDesigner already provides to the shader. No setup needed; they also work inside subgraphs.'))}</p>
    {builtins.map(entry => <div className="builtin-row" key={entry.id} title={say(tdValueHint(entry))}>
      <code>{entry.name}</code><small>{entry.type}</small>
      <button onClick={() => session.placeTdValue(entry.id, center())}>{say(tr('sources.place', 'Add to graph'))}</button>
    </div>)}
  </section>;
}
