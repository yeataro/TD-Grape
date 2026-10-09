import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type DragEvent, type PointerEvent, type ReactNode } from 'react';
import { useReactFlow } from '@xyflow/react';
import { core, type Declaration } from './core';
import { tr, say, tdValueHint, type Message } from './text';
import { ValueFields } from './ValueFields';
import { useSession } from './contexts';
import { Badge, ConfirmDialog, FoldSection, MenuButton, Select } from './controls';
import { Icon } from './icons';
import { DRAG_TYPE } from './AddNodePanel';
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

// Dragged onto the canvas, a source is added there, the same way as from the Add Node panel (its add-list id; human
// 2026-10-09). Only from the card itself, never from its fields and buttons, so text can still be selected.
// 拖到畫布上就在那裡新增，和 Add Node 面板同一條路（用它在新增清單的代號；人類）。只從卡片本身拖，不從輸入框和按鈕，文字仍可選取。
function useDragToCanvas(choice: string) {
  const grab = useRef(false);
  return { draggable: true,
    onPointerDown: (event: PointerEvent) => { grab.current = !(event.target as Element).closest('input, button, .value-row'); },
    onDragStart: (event: DragEvent) => {
      if (!grab.current) { event.preventDefault(); return; }
      event.dataTransfer.setData(DRAG_TYPE, choice); event.dataTransfer.effectAllowed = 'copy';
    } };
}

// One source card: a triangle, then the head (name and type); the rest only when open. Closed by default, on this page
// only (human 2026-10-09). 一張來源卡片：三角形、名稱與型別；其他的打開才顯示。預設收起，只在這一頁記得（人類）。
// One source card (human 2026-10-09, after the legacy card). Two columns: the triangle alone at the left; the head (name,
// type, use count, "⋯") and, open, the value in the right one, so they share one left edge and one right edge. The count
// is a tag as the section counts and never moves; "⋯" adds to the graph, selects references, deletes. No "+": the menu
// and dragging onto the canvas both add it (human).
// 一張來源卡片（人類，參考舊產品）。兩欄：左欄只有三角形；右欄是名稱列（名稱、型別、使用數、「⋯」）和打開後的數值，左右緣都對齊。
// 使用數是和區段數量一樣的標籤，位置不動；「⋯」加到圖上、選取引用、刪除。不放「＋」：選單和拖到畫布都能加（人類）。
function SourceCard({ declaration, choice, head, children, uses, onAdd, onRemove }: {
  declaration: Declaration; choice: string; head: ReactNode; children?: ReactNode; uses: number; onAdd(): void; onRemove(): void;
}) {
  const session = useSession(), [open, setOpen] = useState(false), drag = useDragToCanvas(choice);
  return <div className="source-row source-card" style={kindColor(declaration)} {...drag}>
    {children ? <button type="button" className="expand-toggle" aria-expanded={open} onClick={() => setOpen(!open)}
      aria-label={say(tr('sources.details', 'Show details'))} title={say(tr('sources.details', 'Show details'))}><Icon name="chevronDown" /></button>
      : <span className="expand-toggle" aria-hidden="true" />}
    <div className="source-head">
      {head}
      {/* Unused: a plain grey tag; in use: the kind's colour. 沒在用：灰色標籤；有在用：種類色。 */}
      <Badge count={uses} group={uses ? core.declarationKinds.get(declaration.kind)?.colorGroup ?? 'runtime' : undefined}
        title={tr('sources.usedBy', 'Used by {count} nodes', { count: uses })} />
      <MenuButton icon="menu" narrow label={tr('sources.more', 'More')} items={[
        { key: 'add', label: say(tr('sources.place', 'Add to graph')), select: onAdd },
        { key: 'select', label: say(tr('sources.selectReferences', 'Select references ({count})', { count: uses })), disabled: !uses,
          select: () => session.selectReferences(declaration.id) },
        { key: 'delete', label: say(tr('sources.remove', 'Delete')), danger: true, divider: true, select: onRemove },
      ]} />
    </div>
    {open && <div className="source-body">{children}</div>}
  </div>;
}

/** A one-line source (a TD value, an unused time Uniform) that can be dragged onto the canvas. 可以拖到畫布的一行來源。 */
function DragRow({ choice, className, title, children }: { choice: string; className: string; title?: string; children: ReactNode }) {
  return <div className={className} title={title} {...useDragToCanvas(choice)}>{children}</div>;
}

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
  // Deleting a source that nodes on the canvas use asks first: those nodes go with it (human 2026-10-09; legacy asked for
  // every source, here only when it is used). 刪掉畫布上有節點在用的來源先問：那些節點會一起刪掉（人類；舊產品每次都問，這裡只在有人用時問）。
  const [confirming, setConfirming] = useState<Declaration | null>(null);
  const remove = (declaration: Declaration) => (references[declaration.id] ?? 0) > 0 ? setConfirming(declaration) : session.removeDeclaration(declaration.id);
  // Each section's count, in its colour group (legacy source counts; Refactor.54: the Sources area is coloured).
  // 每一區的數量，用該區的 colorGroup 上色（照舊產品；來源區上色）。
  const count = (n: number, kind: string) => <Badge count={n} group={core.declarationKinds.get(kind)?.colorGroup ?? 'runtime'}
    title={tr('sources.available', '{count} available', { count: n })} />;
  return <section className="sources">
    {confirming && <ConfirmDialog title={tr('sources.removeTitle', 'Delete {name}?', { name: confirming.name })}
      message={tr('sources.removeConfirm', '{name} is used by {count} nodes on the canvas. Deleting it also deletes those nodes.',
        { name: confirming.name, count: references[confirming.id] ?? 0 })}
      confirmLabel={tr('sources.remove', 'Delete')} onCancel={() => setConfirming(null)}
      onConfirm={() => { session.removeDeclaration(confirming.id); setConfirming(null); }} />}
    <FoldSection title={<>{say(tr('sources.textureInputs', 'TOP texture inputs'))}{count(inputs.length, 'topInput')}</>}
      hint={tr('sources.textureInputsHint', 'Each one is an input of the Grape OP in TD, in this order. When no TOP is connected there, it shows its default image.')}
      actions={<button onClick={() => session.addTopInput()}>{say(tr('sources.addInput', '+ Add input'))}</button>}>
    {inputs.map(declaration => <SourceCard key={declaration.id} declaration={declaration} choice={'declaration:' + declaration.id} uses={references[declaration.id] ?? 0}
      onAdd={() => session.placeDeclaration(declaration.id, center())} onRemove={() => remove(declaration)} head={<>
        <NameField declaration={declaration} />
        <Select label={tr('sources.defaultTexture', 'Default image')} title={tr('sources.defaultTexture', 'Default image')}
          value={String(declaration.defaultTexture)} onChange={value => session.setDefaultTexture(declaration.id, value)}
          options={core.defaultTextures.map(texture => ({ value: texture, label: say(textureNames[texture] ?? tr('texture.other', '{name}', { name: texture })) }))} /></>} />)}
    </FoldSection>
    {/* A colour or not is chosen when added (Q59). 是不是顏色在新增時決定。 */}
    <FoldSection title={<>{say(tr('sources.uniforms', 'Uniforms'))}{count(uniforms.length, 'uniform')}</>}
      actions={<><button onClick={() => session.addUniform()}>{say(tr('sources.addUniform', '+ Uniform'))}</button>
      <button onClick={() => session.addUniform(true)}>{say(tr('sources.addColorUniform', '+ Color'))}</button></>}>
    {!uniforms.length && <p className="hint">{say(tr('sources.noUniforms', 'No Uniforms yet. A Uniform becomes a Uniform parameter of the GLSL OP in TD; changing its value does not recompile the shader.'))}</p>}
    {uniforms.map(declaration => <SourceCard key={declaration.id} declaration={declaration} choice={'declaration:' + declaration.id} uses={references[declaration.id] ?? 0}
      onAdd={() => session.placeDeclaration(declaration.id, center())} onRemove={() => remove(declaration)} head={<>
        <NameField declaration={declaration} />
        {/* A colour stays a colour: vec3 or vec4 (Q59). 顏色只在 vec3、vec4 之間換。 */}
        <Select label={tr('sources.type', 'Type')} value={declaration.type} onChange={value => session.setDeclarationType(declaration.id, value)}
          options={declaration.color === true
            // A colour reads as a colour (human 2026-10-09); the type stays vec3/vec4. 顏色看得出是顏色（人類）；型別仍是 vec3／vec4。
            ? [{ value: 'vec3', label: 'RGB' }, { value: 'vec4', label: 'RGBA' }] : types.map(type => ({ value: type, label: type }))} /></>}>
      {uniformValue(declaration)}
    </SourceCard>)}
    </FoldSection>
    {/* Time (preset Uniforms, Q61): all six listed, unused ones as grey cards (created by Create or by dragging one onto the canvas).
        Name and type are locked here; in TD it is an ordinary Uniform row with an expression.
        時間（預設 Uniform）：6 筆都列出，沒用到的是灰色卡片（Create 或拖到畫布時建立）。名字型別在這裡鎖住；在 TD 是一般的 Uniform 列。 */}
    <FoldSection title={<>{say(tr('sources.time', 'Time'))}{count(core.uniformPresets.filter(preset => presetOf(preset.entry)).length, 'uniform')}</>}
      hint={tr('sources.timeHint', 'Uniforms that TouchDesigner drives with an expression. The name is fixed; one of each per graph. Remove the expression in TD to set the value yourself.')}>
    {core.uniformPresets.map(preset => { const declared = presetOf(preset.entry);
      const hint = say({ code: 'uniformPreset.' + preset.entry, source: preset.hint }) + '\n' + preset.expression;
      return declared ? <SourceCard key={preset.entry} declaration={declared} choice={'preset:' + preset.entry} uses={references[declared.id] ?? 0}
          onAdd={() => session.placePreset(preset.entry, center())} onRemove={() => remove(declared)}
          head={<div className="builtin-row" title={hint}><code>{preset.name}</code><small>{preset.expression}</small></div>}>{uniformValue(declared)}</SourceCard>
        // Not created yet: a grey card with one button, Create; dragged onto the canvas it is created and placed.
        // 還沒建立：灰色卡片、只有 Create；拖到畫布上就建立並放上去。
        : <DragRow key={preset.entry} className="source-row source-card unused" choice={'preset:' + preset.entry} title={hint}>
          <span className="expand-toggle" aria-hidden="true" /><div className="builtin-row"><code>{preset.name}</code><small>{preset.expression}</small>
            <button onClick={() => session.createPreset(preset.entry)}>{say(tr('sources.create', 'Create'))}</button></div></DragRow>; })}
    </FoldSection>
    <FoldSection title={<>{say(tr('sources.constants', 'Global constants'))}{count(constants.length, 'constant')}</>}
      actions={<button onClick={() => session.addConstant()}>{say(tr('sources.addConstant', '+ Add constant'))}</button>}>
    {!constants.length && <p className="hint">{say(tr('sources.noConstants', 'No global constants yet. A constant is written into the shader as const and can be used by many nodes.'))}</p>}
    {constants.map(declaration => <SourceCard key={declaration.id} declaration={declaration} choice={'declaration:' + declaration.id} uses={references[declaration.id] ?? 0}
      onAdd={() => session.placeDeclaration(declaration.id, center())} onRemove={() => remove(declaration)} head={<>
        <NameField declaration={declaration} />
        <Select label={tr('sources.type', 'Type')} value={declaration.type} onChange={value => session.setDeclarationType(declaration.id, value)}
          options={types.map(type => ({ value: type, label: type }))} /></>}>
      <ValueFields label={`${declaration.name} value`} type={declaration.type} value={declaration.value ?? 0}
        commit={value => session.setDeclarationValue(declaration.id, value)} />
    </SourceCard>)}
    </FoldSection>
    <FoldSection title={<>{say(tr('sources.tdValues', 'TD built-in values'))}{count(builtins.length, 'tdValue')}</>}
      hint={tr('sources.tdValuesHint', 'Values TouchDesigner already provides to the shader. No setup needed; they also work inside subgraphs.')}>
    {builtins.map(entry => <DragRow key={entry.id} className="builtin-row" choice={'tdValue:' + entry.id} title={say(tdValueHint(entry))}>
      <code>{entry.name}</code><small>{entry.type}</small>
      <button onClick={() => session.placeTdValue(entry.id, center())}>{say(tr('sources.place', 'Add to graph'))}</button>
    </DragRow>)}
    </FoldSection>
  </section>;
}
