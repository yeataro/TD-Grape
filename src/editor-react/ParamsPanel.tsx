import { useContext, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { useConnection, useReactFlow } from '@xyflow/react';
import { core, typeColor, type ComponentStyle } from './core';
import type { EditorState } from './editor';
import type { FlowNode } from './projection';
import { tr, say } from './text';
import { ValueColumns, ValueFields } from './ValueFields';
import { useSession, TextContext, FloatingContext } from './contexts';
import { Select } from './controls';
import { frameNodes } from './viewport';
import { Controls, DeclarationValue, PortLabel, TypeRow, single, sourceKinds } from './NodeCard';

// The Parameter panel (Refactor.76, human 2026-10-11; work/refactor/parameter-panel-scope-2026-10-11.md): the current node,
// drawn like a node card from the same declarations — the head in the node's group colour with its type and its name; every
// control with its label (the card leaves the labels out, Q67); each input's value, or where its wire comes from with
// Disconnect; then the node's note. Nothing selected: one line, the place kept for the Grape OP's own parameters later. The
// panel knows no node by kind. 參數面板（R.76，人類）：目前的節點，照同一份宣告畫成像節點卡片——標頭用節點的群組顏色、寫類型與名稱；
// 每個控制項帶標籤（卡片不帶，Q67）；每個輸入的值，或線從哪來＋斷開；最後是節點的註記。沒選：一行提示，位置留給之後的 Grape OP 自訂參數。
// 面板不認節點種類。

/** The name, as people see it: underscores as spaces; spaces typed become underscores (Refactor.76). Enter or leaving the
 * field renames; Esc puts it back. 名稱，給人看的樣子：底線顯示成空白，輸入的空白存成底線（R.76）。Enter 或離開欄位就改名；Esc 還原。 */
function NodeName({ id, name }: { id: string; name: string }) {
  const session = useSession(), shown = core.shownName(name), [value, setValue] = useState(shown), composing = useRef(false);
  useEffect(() => setValue(shown), [shown]);
  const commit = () => { if (value !== shown) session.rename(id, value); setValue(shown); };
  return <input className="params-name" value={value} maxLength={core.NAME_LIMIT} spellCheck={false} autoComplete="off"
    aria-label={say(tr('params.name', 'Name'))}
    onCompositionStart={() => { composing.current = true; }}
    onCompositionEnd={event => { composing.current = false; setValue(core.typedName(event.currentTarget.value)); }}
    onChange={event => setValue(composing.current ? event.target.value : core.typedName(event.target.value))}
    onBlur={commit}
    onKeyDown={event => {
      if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); }
      else if (event.key === 'Escape') { event.preventDefault(); setValue(shown); requestAnimationFrame(() => (event.target as HTMLInputElement).blur()); }
    }} />;
}

/** The node's note, kept in the graph (its comment): saved when leaving the field or with Ctrl/Cmd+Enter, Esc puts it back
 * (legacy inspector.js:938). 節點的註記，存在圖裡（comment）：離開欄位或 Ctrl／Cmd＋Enter 存、Esc 還原（照舊產品）。 */
function NodeNote({ id, note }: { id: string; note: string }) {
  const session = useSession(), [value, setValue] = useState(note);
  useEffect(() => setValue(note), [note]);
  return <label className="params-note">
    <span className="sr-only">{say(tr('params.notes', 'Notes'))}</span>
    <textarea value={value} rows={6} onChange={event => setValue(event.target.value)} onBlur={() => session.setNote(id, value)}
      onKeyDown={event => {
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) { event.preventDefault(); event.currentTarget.blur(); }
        else if (event.key === 'Escape') { event.preventDefault(); setValue(note); }
      }} />
  </label>;
}

/** The panel's tabs (Refactor.85; legacy inspector.js:1602): Parameters, Settings, Notes. The shown one is shared by every node
 * and kept while the selection changes, not between sessions (legacy inspector.js:305). 面板的分頁（R.85；照舊產品）：參數、設定、
 * 註記。顯示哪一個由所有節點共用，換選取時不變，不跨次保存（照舊產品）。 */
type Tab = 'parameters' | 'settings' | 'notes';
let shownTab: Tab = 'parameters';
const TABS: readonly [Tab, ReturnType<typeof tr>][] = [['parameters', tr('params.tabParameters', 'Parameters')],
  ['settings', tr('params.tabSettings', 'Settings')], ['notes', tr('params.notes', 'Notes')]];
function Tabs({ tab, choose }: { tab: Tab; choose(tab: Tab): void }) {
  return <div className="params-tabs" role="tablist">{TABS.map(([key, label]) => <button key={key} type="button" role="tab"
    aria-selected={tab === key} onClick={() => choose(key)}>{say(label)}</button>)}</div>;
}

/** Settings: for now only the component names (human 2026-10-11: they are settled; the rest waits to see what goes there; legacy
 * inspector.js:1358). U/V only with two components. 設定：目前只有分量名稱（人類 10-11：分量名稱是確定的，其他之後看哪一項要放過去；
 * 照舊產品）。U/V 只用在兩個分量。 */
function NodeSettings({ id }: { id: string }) {
  const session = useSession(), names = session.componentNamesOf(id);
  if (!names) return <p className="hint params-pad">{say(tr('params.noSettings', 'Nothing to set for this node yet.'))}</p>;
  const options = core.componentStyles.filter(style => style !== 'uv' || names.count === 2)
    .map(style => ({ value: style, label: style === 'uv' ? 'U / V' : style.toUpperCase().split('').join(' / ') }));
  return <div className="params-grid params-settings"><label className="control-field">
    <span>{say(tr('params.componentNames', 'Component names'))}</span>
    <Select label={say(tr('params.componentNames', 'Component names'))} value={names.style} options={options}
      onChange={value => session.setComponentNames(id, value as ComponentStyle)} /></label></div>;
}

function NodeParameters({ node, state }: { node: FlowNode; state: EditorState }) {
  const session = useSession(), text = useContext(TextContext), flow = useReactFlow(), floating = useContext(FloatingContext);
  const [tab, setTab] = useState(shownTab), choose = (next: Tab) => { shownTab = next; setTab(next); };
  // While a wire is dragged from an output, the panel's inputs take it (Refactor.85). 從輸出拉線時，面板的輸入接孔可以接。
  const wiring = useConnection(connection => connection.inProgress && connection.fromHandle?.type === 'source');
  const { id, data } = node, { authored, view, inputs } = data;
  const valued = data.declaration?.kind === 'uniform' || data.declaration?.kind === 'constant' ? data.declaration : undefined;
  // Where a wired input's value comes from: the other node's name (or its type) and port. 接線的輸入：另一端節點的名稱（或類型）與接孔。
  const sourceOf = (port: string) => {
    const edge = state.projection.edges.find(e => e.target === id && e.targetHandle === port);
    if (!edge) return undefined;
    const from = state.projection.nodes.find(n => n.id === edge.source);
    const label = from?.data.authored.name ? core.shownName(from.data.authored.name) : from ? text(from.data.view.label ?? from.data.label) : edge.source;
    return { node: edge.source, text: label + ' · ' + edge.sourceHandle };
  };
  // Clicking it selects that node and frames it, as the legacy editor (inspector.js:1478 parameterConnectionSource →
  // selectEdgeEndpoints; human 2026-10-11); the panel then shows it. 點它就選取那個節點並對準，照舊產品（人類）；面板隨之換成它。
  const goTo = (node: string) => { session.selectNode(node); frameNodes(flow, [node]); };
  // A node standing for a shared source says which kind (Uniform, Global, TOP Input) where others say their type, as its card
  // does (human 2026-10-11: "Shared Source" alone said nothing). 代表共用來源的節點在類型的位置寫是哪一種（Uniform、Global、TOP
  // Input），同它的卡片（人類：只寫 Shared Source 什麼都沒說）。
  const kind = data.declaration && sourceKinds[data.declaration.kind];
  return <article className={`grape-node params-card${data.ghost ? ' ghost' : ''}${floating ? ' floating' : ''}${wiring ? ' wiring' : ''}`}
    style={{ '--group-color': `var(--group-${data.ghost ? 'ghost' : data.colorGroup})` } as CSSProperties}>
    {/* Floating, the node card is the panel (Refactor.85, human 2026-10-11: no frame, no panel title): its head holds the triangle,
        and the menu and close on the right, and moves it. 浮動時節點卡就是面板（R.85，人類：沒有外框、沒有面板標題列）：頭上放三角形、
        右邊放選單與關閉，抓頭搬它。 */}
    <div className="node-title params-title" data-movable={floating ? '' : undefined} onContextMenu={floating?.openMenu} onPointerDown={floating ? event => {
      if (!(event.target as HTMLElement).closest('button, input, select, textarea')) floating.drag(event); } : undefined}>
      {floating?.fold}
      <strong>{kind ? say(kind) : text(data.label)}</strong>
      {/* A node standing for a shared source shows that source's name instead of its own, with its type (legacy
          inspector.js:858). 代表共用來源的節點顯示來源的名字（不是自己的）與型別（照舊產品）。 */}
      {core.takesName(core.registry, authored.nodeType)
        ? <NodeName id={id} name={authored.name ?? ''} />
        : <span className="params-source">{view.literalLabel ? view.label : text(view.label ?? data.label)} <small>{data.outputs[0]?.type}</small></span>}
      {floating?.controls}
    </div>
    {!floating?.collapsed && <Tabs tab={tab} choose={choose} />}
    {!floating?.collapsed && tab === 'settings' && <NodeSettings id={id} />}
    {!floating?.collapsed && tab === 'notes' && <NodeNote id={id} note={typeof authored.comment === 'string' ? authored.comment : ''} />}
    {/* One grid for the whole body, as TD's parameter dialog (Refactor.76.2): expand | names flush right | types | fields;
        every row lines up with the others (subgrid). 整個本體一張格線，照 TD 參數視窗（R.76.2）：展開｜名稱靠右｜型別｜欄位；
        每一列都和其他列對齊。 */}
    {!floating?.collapsed && tab === 'parameters' && !data.ghost && <div className="node-body params-grid"><ValueColumns.Provider value={true}>
      {/* The output menu, then the input menu, each named (Q73 rule two). 輸出選單、再來輸入選單，各有名稱（Q73 規則二）。 */}
      <TypeRow id={id} data={data} end="output" />
      <TypeRow id={id} data={data} end="input" />
      {view.inlineControls && <Controls id={id} controls={view.inlineControls} />}
      {valued && <DeclarationValue declaration={valued} />}
      {view.value && <ValueFields {...view.value} label={`${id} value`} commit={value => session.edit(id, view.value!.valueCommand, { value })} />}
      {inputs.map(port => {
        const source = sourceOf(port.key), label = <PortLabel text={view.portLabels?.inputs?.[port.key] ?? port.key}
          components={view.components?.inputs?.[port.key]} />;
        const head = <><span className="value-caption">{label}</span><span className="value-type">{port.type}</span></>;
        return <div className="port-row input-row" key={port.key} style={{ '--port-color': typeColor(port.type) } as CSSProperties}
          data-component={single(view.components?.inputs?.[port.key])}>
          {/* Floating over the canvas, each input has a port a wire can be dropped on (Refactor.85; legacy inspector.js:1571; dragging a
              wire out of it comes later). 浮在畫布上時每個輸入有接孔，可以把線放上來（R.85；照舊產品；從它往外拉之後再做）。 */}
          {floating && <span className={'params-port' + (source !== undefined ? ' wired' : '')} data-panel-node={id} data-panel-port={port.key}
            title={say(tr('params.dropWire', 'Drop a wire here to connect it'))} />}
          {source !== undefined ? <>{head}<span className="params-wired"><button type="button" className="params-link" onClick={() => goTo(source.node)}
              title={say(tr('params.selectSource', 'Select source · {source}', { source: source.text }))}>{source.text}</button>
            <button type="button" onClick={() => session.disconnectInput(id, port.key)}>{say(tr('params.disconnect', 'Disconnect'))}</button></span></>
            : port.fallback !== undefined ? <>{head}<code className="port-fallback">{port.fallback}</code></>
            : core.values.types.includes(port.type) ? <ValueFields label={`${id} ${port.key}`} type={port.type} defaults={port.default} caption={label}
              names={core.componentLetters(data.componentStyle ?? 'xyzw', core.values.count(port.type))}
              value={authored.inputValues?.[port.key] ?? port.default ?? core.values.fill(0, port.type)} commit={value => session.setInput(id, port.key, value)} />
            : head}
        </div>;
      })}
      {view.controls && <Controls id={id} controls={view.controls} />}
      {view.note && <div className="hint">{view.note.text}</div>}
    </ValueColumns.Provider></div>}
  </article>;
}

export function ParamsPanel({ state }: { state: EditorState }) {
  const session = useSession();
  const primary = useSyncExternalStore(session.primarySubscribe, session.primarySnapshot);
  const node = primary === undefined || primary === null ? undefined : state.projection.nodes.find(n => n.id === primary);
  const floating = useContext(FloatingContext);
  // Nothing selected: one line (legacy inspector.js:1592); floating, under a plain head so it can still be moved and closed.
  // 沒選：一行提示（照舊產品）；浮動時放在一個素的頭下面，仍能搬、能關。
  if (!node) return floating ? <article className="grape-node params-card floating params-empty">
    <div className="node-title params-title" data-movable="" onContextMenu={floating.openMenu} onPointerDown={event => { if (!(event.target as HTMLElement).closest('button')) floating.drag(event); }}>
      {floating.fold}<strong>{say(tr('params.title', 'Parameters'))}</strong><span className="spacer" />{floating.controls}</div>
    {!floating.collapsed && <p className="hint params-pad">{say(tr('params.empty', 'Select a node to edit its parameters.'))}</p>}
  </article> : <p className="hint">{say(tr('params.empty', 'Select a node to edit its parameters.'))}</p>;
  // Keyed by node: moving to another node starts its fields afresh. 依節點分開：換節點時欄位重新開始。
  return <NodeParameters key={node.id} node={node} state={state} />;
}
