import { memo, useContext, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import { Handle, Position, useUpdateNodeInternals, type NodeProps } from '@xyflow/react';
import { core, typeColor, type NodeControl, type NodePresentation } from './core';
import type { FlowNode } from './projection';
import { spareHandle } from './editor';
import { measureHandles, needsHandleUpdate, type Geometry } from './geometry';
import { BoxPreviewContext } from './RightDragSelect';
import { tr, say, type Message } from './text';
import { Select } from './controls';
import { Icon } from './icons';
import { GhostMark } from './GhostMark';
import { appearanceSubscribe, currentConvertPorts } from './appearance';
import { ValueFields } from './ValueFields';
import { useSession, TextContext, BodyDragContext, MergingContext, ErrorNodesContext } from './contexts';
import { useModes } from './declaration_modes';
import type { Declaration } from './core';

/** Choices shown as they are written (type names). 照原樣顯示的選項（型別名）。 */
export const listed = (values: readonly string[]) => values.map(value => ({ value, label: value }));


// `bare`: a control at the head of the body (what the node points to, e.g. its declaration) shows only its choice, as the
// legacy editor (human 2026-10-09: the label wasted space and lined up with nothing). The name stays for assistive tech.
// bare：本體開頭的控制項（節點指向什麼，例如宣告）只顯示選到的值，照舊產品（人類：標籤浪費空間、也對不齊）。名稱仍給輔助工具。
/** The node's type menu (its selector, or its types when there are several), or null when the type is not chosen here.
 * Shared by the card and the Parameter panel (Refactor.81.1). 節點的型別選單（它的 selector，或有好幾種型別時的型別），型別不在
 * 這裡選時是 null。卡片與參數面板共用（R.81.1）。 */
export function TypeChoice({ id, data }: { id: string; data: FlowNode['data'] }) {
  const session = useSession(), { view, authored } = data;
  if (view.typeLocked) return null;
  if (view.selector) return <Select className="nodrag" label={`${id} type`} value={view.selector.value}
    onChange={value => session.edit(id, view.selector!.command, { value })} options={listed(view.selector.options)} />;
  return data.types.length > 1 ? <Select className="nodrag" label={`${id} type`} value={String(authored.params.type)}
    onChange={value => session.configure(id, value)} options={listed(data.types)} /> : null;
}
/** Which end a node's type menu chooses (design-interview Q73 rule two): the title always shows the output; a node whose menu
 * chooses its input shows it as a row named "Input type" on the card and in the Parameter panel (Refactor.81.1).
 * 節點的型別選單選哪一端（Q73 規則二）：標題列永遠顯示輸出；選輸入的節點，選單是卡片與參數面板裡名為「輸入型別」的一列（R.81.1）。 */
export const picksInput = (data: FlowNode['data']) => data.view.typeOf === 'input';
export const hasTypeChoice = (data: FlowNode['data']) => !data.view.typeLocked && (!!data.view.selector || data.types.length > 1);
export const typeRowName = (data: FlowNode['data']) => picksInput(data) ? tr('params.inputType', 'Input type') : tr('params.outputType', 'Output type');

/** The type menu as a row with its name (card and Parameter panel). 型別選單作為一列、有名稱（卡片與參數面板）。 */
export function TypeRow({ id, data }: { id: string; data: FlowNode['data'] }) {
  return hasTypeChoice(data) ? <label className="control-field nodrag"><span>{say(typeRowName(data))}</span><TypeChoice id={id} data={data} /></label> : null;
}

/** A list of a node's controls. Buttons next to each other are one group of equal widths, wherever a module puts them (Refactor.80.3,
 * human 2026-10-11: plus and minus buttons the same everywhere): on a card the group fills its line; in the Parameter panel it
 * starts where the menus start. 節點控制項的清單。相鄰的按鈕是一組、等寬，不管哪個模組放的（R.80.3，人類：加減按鈕到處一樣）：卡片上
 * 一組佔滿那一行；參數面板裡從選單開始的地方開始。 */
export function Controls({ id, controls, bare = false }: { id: string; controls: readonly NodeControl[]; bare?: boolean }) {
  const parts: ReactNode[] = [];
  for (let i = 0; i < controls.length; i++) {
    if (controls[i]!.kind !== 'button') { parts.push(<Control key={controls[i]!.key} id={id} control={controls[i]!} bare={bare} />); continue; }
    const group: NodeControl[] = [];
    while (i < controls.length && controls[i]!.kind === 'button') group.push(controls[i++]!);
    i--;
    parts.push(<div key={'buttons-' + group[0]!.key} className="control-buttons">{group.map(button => <Control key={button.key} id={id} control={button} />)}</div>);
  }
  return <>{parts}</>;
}

export function Control({ id, control, bare = false }: { id: string; control: NodeControl; bare?: boolean }) {
  const session = useSession(), text = useContext(TextContext);
  const words = control.literal ? control.label : text(control.label);
  // A label naming a component takes its colour, as port labels do (Refactor.80.3). 代表分量的標題用分量色，同接孔標籤（R.80.3）。
  const label = control.component === undefined ? words
    : <span className="component-letter letter-slot" data-component={control.component}>{words}</span>;
  if (control.kind === 'row') return <div className="control-row"><Controls id={id} controls={control.children ?? []} /></div>;
  if (control.kind === 'hint') return <div className="hint">{label}</div>;
  if (control.kind === 'button') return <button className="nodrag" disabled={control.disabled}
    onClick={() => session.edit(id, control.command!, control.args ?? {})}>{label}</button>;
  return <label className="control-field nodrag">{!bare && <span>{label}</span>}<Select label={bare ? words : `${id} ${control.key}`}
    value={String(control.value)} disabled={control.disabled} onChange={value => session.edit(id, control.command!, {
      ...control.args, value: control.numeric ? Number(value) : value })}
    options={control.options?.map(option => ({ value: String(option.value), label: option.literal ? option.label : text(option.label) })) ?? []} /></label>;
}

// A Uniform or constant node edits its value on the canvas (legacy uniform node; Refactor.55.2, 55.9): the same value
// widget as the Sources panel, below its output. Its leading text, where the middle button changes the whole value: for a
// Uniform the TD parameter page it lives on (Vectors, or Colors for a colour); for a constant, "Constant" (human 2026-10-09).
// Shows what drives it in TD; only a Uniform is sent to TD while dragging (a constant is compiled in).
// Uniform 或常數節點在畫布上編輯它的值（照舊產品）：和共用來源面板同一個數值 widget，在輸出下面。開頭文字（按中鍵整組調值的地方）：
// Uniform 是它在 TD 所屬的參數頁（Vectors，顏色是 Colors）；常數是「Constant」（人類）。顯示 TD 上的驅動狀態；拖曳中只有
// Uniform 會送到 TD（常數是編進 Shader 的）。
export function DeclarationValue({ declaration }: { declaration: Declaration }) {
  const session = useSession(), modes = useModes(session, declaration);
  return <ValueFields label={`${declaration.name} value`} type={declaration.type} value={declaration.value ?? 0}
    caption={declaration.kind === 'constant' ? say(tr('value.constant', 'Constant')) : declaration.color === true ? 'Colors' : 'Vectors'}
    color={declaration.color === true} names={declaration.color === true ? 'RGBA' : 'XYZW'} modes={modes}
    commit={value => session.setDeclarationValue(declaration.id, value)}
    preview={value => session.previewDeclarationValue(declaration.id, value)} />;
}

// What kind of shared source a reference node is, shown before its type in the title (legacy "Uniform · vec3"; human
// 2026-10-09: "Global · float" for a constant). 引用節點是哪一種共用來源，標題裡寫在型別前（照舊產品；人類：常數寫 Global）。
export const sourceKinds: Record<string, Message> = {
  uniform: tr('sourceKind.uniform', 'Uniform'), constant: tr('sourceKind.constant', 'Global'), topInput: tr('sourceKind.topInput', 'TOP Input') };

// Drawn from the module's spare declaration only; no node-specific branch here.
// 只依模組宣告的 spare 繪製；接線後由 session 執行模組命令，renderer 不認節點。
function SpareInput({ id, spare }: { id: string; spare: NonNullable<NodePresentation['spare']> }) {
  const text = useContext(TextContext), open = spare.count < spare.limit;
  return <div className={`port-row input-row spare-row ${open ? '' : 'full'}`} style={{ '--port-color': typeColor(spare.type) } as CSSProperties}>
    <Handle type="target" position={Position.Left} id={spareHandle} isConnectable={open} aria-label={`${id} ${text(spare.label)}`} />
    <span>{open ? '＋ ' + text(spare.label) : text(spare.limitLabel)}</span>
  </div>;
}

/** The one component a port stands for, if it is one (Refactor.59). 接孔代表的單一分量（若只有一個）。 */
export const single = (components?: readonly number[]) => components?.length === 1 ? components[0] : undefined;
/** A port's label; when its letters are its components, each letter carries its own (e.g. "RG"); a one-component port
 * carries it whole (e.g. "alpha"). The colours are the theme's, under the component-tint switch (style.css).
 * 接孔標籤；字母就是分量時每個字母各帶自己的分量（例如「RG」），單一分量的接孔整個帶（例如「alpha」）。顏色由主題與分量染色開關決定。 */
/** An input's type; under "show the conversion" a wire bringing another type reads "float → vec4", each type in its own colour
 * (Refactor.77.6, as the legacy port caption, graph_ui.js:1213); the explanation is in the title, as legacy's. 輸入的型別；
 * 「顯示轉換型別」時，接進另一種型別寫成「float → vec4」，各用自己的型別色（R.77.6，同舊產品接孔）；說明放在滑鼠提示，同舊產品。 */
function InputType({ type, from }: { type: string; from?: string }) {
  const ports = useSyncExternalStore(appearanceSubscribe, currentConvertPorts);
  if (!from || ports !== 'conversion') return <small>{type}</small>;
  const splat = core.values.types.includes(from) && core.values.count(from) === 1 && core.values.count(type) > 1;
  const title = say(splat ? tr('type.splat', 'The source {source} value is repeated in every component of {target}. The node keeps its selected operation type.', { source: from, target: type })
    : tr('type.cast', 'Convert {source} to {target}; integer conversion truncates fractional parts.', { source: from, target: type }));
  return <small className="port-conversion" title={title}><span style={{ color: typeColor(from) }}>{from}</span><span className="conversion-arrow" aria-hidden="true">→</span><span>{type}</span></small>;
}

export function PortLabel({ text, components }: { text: string; components?: readonly number[] }) {
  // Every letter that names one component takes the letter slot, so X…W and XY / ZW line up down a column (Refactor.76.8,
  // 76.12); the letters of a name stay one piece, so a row's gap falls only before its type.
  // 每個代表一個分量的字母都用字母格，X…W、XY／ZW 上下對齊（R.76.8、76.12）；一個名稱的字母是一整塊，列的間距只落在型別前面。
  if (components?.length === text.length && text.length > 1)
    return <span className="component-letters">{[...text].map((letter, i) => <span key={i} className="component-letter letter-slot" data-component={components[i]}>{letter}</span>)}</span>;
  const one = single(components);
  return one === undefined ? <>{text}</> : <span className={'component-letter' + (text.length === 1 ? ' letter-slot' : '')} data-component={one}>{text}</span>;
}

export const NodeCard = memo(function NodeCard({ id, data, selected }: NodeProps<FlowNode>) {
  const session = useSession(), text = useContext(TextContext), bodyDrag = useContext(BodyDragContext);
  // The primary selection is told from above, never known by the node module (Q33). 主要選取由上往下得知，節點模組不知道。
  const primary = useSyncExternalStore(session.selectionSubscribe, session.primarySnapshot) === id;
  // While a box is dragged: dashed = will be selected on release (Refactor.50.1). The current selection
  // stays as it is until release (50.2, human: no fading; the legacy editor kept it, with a frame around it).
  // 框選拖曳中：虛線＝放開會被選。目前的選取維持原樣到放開（50.2，人類：不淡化；舊產品保留它，外面還有多選框）。
  const preview = useContext(BoxPreviewContext);
  // Hooks stay above the ghost return. hook 都放在 ghost 提早返回之前。
  const mergePreview = useContext(MergingContext), merging = mergePreview?.node === id ? mergePreview.merged : [];
  // The rows a dropped wire would merge into one, the input it lands on among them, shown as one band in the wire's colour
  // (Refactor.76.16, as the legacy editor marked them; human 2026-10-11: one band, no frame per row).
  // 放開後會併成一列的那幾列（含落點那列），畫成線色的一整條（R.76.16，舊產品也標出它們；人類：一整條、不要每列框線）。
  const band = merging.length ? new Set([mergePreview!.port, ...merging]) : null;
  const selection = (selected ? (primary ? 'selected primary' : 'selected') : '') + (preview?.has(id) && !selected ? ' box-in' : '');
  const errorLine = useContext(ErrorNodesContext)?.has(id) ?? false;
  const card = useRef<HTMLElement>(null), measured = useRef<Geometry>(undefined);
  const updateInternals = useUpdateNodeInternals();
  const { authored, view, inputs, outputs } = data;
  const inspect = () => {
    if (!card.current) return;
    const next = measureHandles(card.current);
    if (needsHandleUpdate(measured.current, next)) updateInternals(id);
    measured.current = next;
  };
  // Read actual committed layout, never serialize control values as a geometry key.
  // 僅在該卡片 commit 後檢查實際接孔；非逐幀掃描，外框變大由 RF 量測。
  useLayoutEffect(inspect);
  useEffect(() => {
    if (!card.current) return;
    const observer = new ResizeObserver(inspect);
    observer.observe(card.current);
    return () => observer.disconnect();
  }, [id, updateInternals]);
  // Ghost (Q37 1-1): kept as stored, shown with the ports its wires use, no controls, not compiled.
  // Ghost：原樣保留，只畫它的線用到的接孔，沒有控制項，不參與產碼。
  // The ghost mark (Refactor.64.3, human 2026-10-10: option G4): a ghost on the top-right corner, half outside, drawn beside
  // the card so the card's fading does not dim it. Ghost 標記（人類選 G4）：右上角的幽靈、一半在外；畫在卡片旁邊，不被卡片的淡化一起變淡。
  if (data.ghost) return <><span className="node-ghost-mark" role="img" title={say(tr('node.ghostMark', 'Ghost: kept as it is, left out of the shader.'))}
    aria-label={say(tr('node.ghostMark', 'Ghost: kept as it is, left out of the shader.'))}><GhostMark id={id} on="node" /></span>
  <article ref={card} className={`grape-node ghost ${selection}`}
    style={{ '--group-color': 'var(--group-ghost)' } as CSSProperties}>
    <div className="node-title node-drag-surface"><strong>{authored.name || text(data.label)}</strong><small>Ghost</small></div>
    <div className="node-body node-drag-surface">
      <div className="ghost-note">{say(data.ghost === 'misplaced'
        ? tr('ghost.misplaced', '{type} cannot be used here. Kept as it is, left out of the shader.', { type: authored.nodeType })
        : data.ghost === 'missing'
        ? tr('ghost.missing', 'The shared source it points to no longer exists. Kept as it is, left out of the shader.')
        // A known node type whose stored settings this version cannot use (e.g. a TD built-in value since removed): name what
        // the graph stores, the only clue left (Refactor.64.2, human 2026-10-10; custom node names may help later).
        // 認得的節點種類、但存的設定這一版用不了（例如已拿掉的 TD 內建值）：寫出圖裡存的值，這是唯一的線索（人類；之後自訂名稱或許能幫忙）。
        : core.registry.get(authored.nodeType)
        ? tr('ghost.unsupported', 'This version cannot use what this {label} stores ({settings}). Kept as it is, left out of the shader.',
          { label: text(data.label), settings: Object.entries(authored.params ?? {}).map(([key, value]) => key + ': ' + (typeof value === 'string' ? value : JSON.stringify(value))).join(', ') })
        : tr('ghost.unknown', 'This version does not understand {type}. Kept as it is, left out of the shader.', { type: authored.nodeType }))}</div>
      {inputs.map(port => <div className="port-row input-row" key={port.key}>
        <Handle type="target" position={Position.Left} id={port.key} isConnectable={false} aria-label={`${id} input ${port.key}`} data-connected="true" />
        <span>{port.key}</span></div>)}
      {outputs.map(port => <div className="port-row output-row" key={port.key}>
        <span>{port.key}</span>
        <Handle type="source" position={Position.Right} id={port.key} isConnectable={false} aria-label={`${id} output ${port.key}`} data-connected="true" />
      </div>)}
    </div>
  </article></>;
  // A start node (GLOSSARY: no inputs at all, e.g. source references, TD values, value nodes; later spec constants) shows
  // its outputs first, so it reads from the top down (human 2026-10-09). Judged from the ports, never from the node kind.
  // 起點節點（用語表：沒有任何輸入，例如來源引用、TD 內建值、值節點；之後的 Spec 常量）輸出放最上面，由上往下讀（人類）。
  // 由接孔判斷，不認節點種類。
  const start = !inputs.length && !view.spare;
  const valued = data.declaration?.kind === 'uniform' || data.declaration?.kind === 'constant' ? data.declaration : undefined;
  const kind = data.declaration && sourceKinds[data.declaration.kind], sourceTag = kind ? say(kind) + ' · ' : '';
  const outputRows = outputs.map(port => <div className="port-row output-row" key={port.key} style={{ '--port-color': typeColor(port.type) } as CSSProperties}
    data-component={single(view.components?.outputs?.[port.key])}>
    <span><PortLabel text={view.portLabels?.outputs?.[port.key] ?? port.key} components={view.components?.outputs?.[port.key]} /> <small>{port.type}</small></span>
    {/* Whether a port has a wire is data; how it looks is the theme's (port styles A/B, Refactor.54.2).
        接孔有沒有接線是資料；長什麼樣子由主題決定（接孔樣式 A／B）。 */}
    <Handle type="source" position={Position.Right} id={port.key} aria-label={`${id} output ${port.key}`} data-connected={data.wired.includes(port.key)} />
  </div>);
  return <article ref={card} className={`grape-node ${selection}`}
    style={{ '--group-color': `var(--group-${data.colorGroup})` } as CSSProperties}>
    {/* Trial (Refactor.63.6.1): TD's error mark on a node that wrote a line TD reported. 試驗：TD 回報的錯誤行由它寫的節點，掛 TD 的錯誤標記。 */}
    {errorLine && <span className="node-error-badge" role="img" title={say(tr('node.errorLine', 'TD reported an error on a line this node wrote'))}
      aria-label={say(tr('node.errorLine', 'TD reported an error on a line this node wrote'))}><Icon name="errorBadge" /></span>}
    <div className="node-title node-drag-surface"><strong>{view.literalLabel ? view.label : text(view.label ?? data.label)}</strong>
      {!picksInput(data) && hasTypeChoice(data) ? <TypeChoice id={id} data={data} /> : <small>{sourceTag}{outputs[0]?.type}</small>}
    </div>
    <div className={`node-body ${bodyDrag ? 'node-drag-surface' : ''}`}>
      {start && outputRows}
      {picksInput(data) && <TypeRow id={id} data={data} />}
      {view.inlineControls && <Controls id={id} controls={view.inlineControls} bare />}
      {valued && <DeclarationValue declaration={valued} />}
      {view.value && <ValueFields {...view.value} label={`${id} value`} commit={value => session.edit(id, view.value!.valueCommand, { value })} />}
      {inputs.map(port => { const wired = data.connected.includes(port.key);
        const label = <PortLabel text={view.portLabels?.inputs?.[port.key] ?? port.key} components={view.components?.inputs?.[port.key]} />;
        const inBand = band?.has(port.key);
        return <div className="port-row input-row" key={port.key} data-merge-band={inBand || undefined}
          style={{ '--port-color': typeColor(port.type), ...(inBand ? { '--merge-color': typeColor(mergePreview!.type) } : {}) } as CSSProperties}
          data-component={single(view.components?.inputs?.[port.key])}>
        <Handle type="target" position={Position.Left} id={port.key} aria-label={`${id} input ${port.key}`} data-connected={wired}
          data-merging={merging.includes(port.key) || undefined} />
        {/* An input with a value: its name and type lead the value widget (middle button there changes the whole value).
            有值的輸入：名字與型別是數值 widget 的開頭文字（在上面按中鍵整組調值）。 */}
        {port.fallback === undefined && core.values.types.includes(port.type) ? null
          : <span>{label} <InputType type={port.type} from={data.conversions?.[port.key]} /></span>}
        {/* A fixed expression (e.g. vUV.st) is shown, not edited; a texture has no value. A wire hides the value but keeps
            its place (wiring never changes the height, EDITOR_UI_RULES.md 六). 固定式子只顯示不編輯；貼圖沒有值。接線只藏起值、位置留著。 */}
        {port.fallback !== undefined ? <code className={'port-fallback' + (wired ? ' wired' : '')}>{port.fallback}</code>
          : core.values.types.includes(port.type) && <ValueFields label={`${id} ${port.key}`} type={port.type} wired={wired} defaults={port.default}
          caption={<>{label} <InputType type={port.type} from={data.conversions?.[port.key]} /></>}
          value={authored.inputValues?.[port.key] ?? port.default ?? core.values.fill(0, port.type)} commit={value => session.setInput(id, port.key, value)} />}
      </div>; })}
      {view.spare?.direction === 'input' && <SpareInput id={id} spare={view.spare} />}
      {view.controls && <Controls id={id} controls={view.controls} />}
      {view.note && <div className="hint">{view.note.text}</div>}
      {!start && outputRows}
    </div>
  </article>;
});
