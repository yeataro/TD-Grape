import { memo, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { useConnection, useReactFlow } from '@xyflow/react';
import { core, typeColor, type ComponentStyle, type InterfacePort, type SubgraphData } from './core';
import { Icon } from './icons';
import type { FlowNode, FlowEdge } from './projection';
import { useEditorSlice } from './editor_slice';
import { tr, say } from './text';
import { ValueColumns, ValueFields } from './ValueFields';
import { useSession, TextContext, FloatingContext } from './contexts';
import { Select, useTypedName } from './controls';
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
  const session = useSession(), shown = core.shownName(name), [value, setValue] = useState(shown), typing = useTypedName(setValue);
  useEffect(() => setValue(shown), [shown]);
  const commit = () => { if (value !== shown) session.rename(id, value); setValue(shown); };
  return <input className="params-name" value={value} maxLength={core.NAME_LIMIT} spellCheck={false} autoComplete="off"
    aria-label={say(tr('params.name', 'Name'))}
    {...typing} onBlur={commit}
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
type Tab = 'parameters' | 'settings' | 'subgraph' | 'notes';
let shownTab: Tab = 'parameters';
const TABS: readonly [Tab, ReturnType<typeof tr>][] = [['parameters', tr('params.tabParameters', 'Parameters')],
  ['settings', tr('params.tabSettings', 'Settings')], ['notes', tr('params.notes', 'Notes')]];
// A subgraph call has a fourth tab for its definition (visual notes 7): the same card as inside the subgraph with nothing selected.
// 子圖呼叫多一個「子圖」分頁（外觀意見 7）：和子圖裡無選取時同一張卡。
const CALL_TABS: readonly [Tab, ReturnType<typeof tr>][] = [TABS[0]!, TABS[1]!, ['subgraph', tr('params.tabSubgraph', 'Subgraph')], TABS[2]!];
function Tabs({ tab, tabs, choose }: { tab: Tab; tabs: readonly [Tab, ReturnType<typeof tr>][]; choose(tab: Tab): void }) {
  return <div className="params-tabs" role="tablist">{tabs.map(([key, label]) => <button key={key} type="button" role="tab"
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

// The interface of the subgraph being edited, on its boundary nodes (basic design §3.5; Refactor.110): the Parameters tab holds each
// port's default value; the Settings tab the list — drag to reorder, label, type, remove — and Add. A boundary is known by its module's
// role, as structure.ts knows it; the panel still names no node kind. The ports live on the definition, so every edit is the session's
// interface edit (one step, one Undo; the core keeps every call in step).
// 正在編輯的子圖的介面，在它的邊界節點上（§3.5；R.110）：參數分頁放每個接口的預設值；設定分頁是清單——拖排序、標籤、型別、移除——與新增。
// 邊界節點由模組的 role 辨認，同 structure.ts；面板仍不認節點種類。接口住在定義上，所以每次修改都是 session 的介面修改（一步、一次 Undo；
// 核心讓每個呼叫跟上）。
const boundarySide = (nodeType: string): 'inputs' | 'outputs' | null => {
  const role = core.registry.get(nodeType)?.role;
  return role === 'subgraph-input' ? 'inputs' : role === 'subgraph-output' ? 'outputs' : null;
};
const PORT_TYPES = [...core.values.types, ...core.values.opaque];
type Direction = 'inputs' | 'outputs';

function InterfaceDefaults({ direction, ports }: { direction: Direction; ports: readonly InterfacePort[] }) {
  const session = useSession();
  if (!ports.length) return <p className="hint params-pad">{say(tr('params.noPorts', 'No ports yet: add one on the Settings tab, or drop a wire on the grey port of this node.'))}</p>;
  return <div className="node-body params-grid interface-defaults"><ValueColumns.Provider value={true}>
    {ports.map(port => <div className="port-row input-row" key={port.id} style={{ '--port-color': typeColor(port.type) } as CSSProperties}>
      {core.values.types.includes(port.type)
        ? <ValueFields label={`${port.id} default`} type={port.type} caption={<span className="value-caption">{port.label ?? ''}</span>}
            value={port.default ?? core.values.fill(0, port.type)} commit={value => session.editInterface(direction, { kind: 'update', id: port.id, patch: { default: value } })} />
        // An opaque port (a texture) has no default (basic design §3.4). opaque 接口（貼圖）沒有預設值（§3.4）。
        : <><span className="value-caption">{port.label ?? ''}</span><span className="value-type">{port.type}</span>
          <small className="hint">{say(tr('params.opaqueNoDefault', 'a texture: no default value'))}</small></>}
    </div>)}
  </ValueColumns.Provider></div>;
}

/** A port's label, edited in place (free text, may be empty; §3.3). Enter or leaving commits; Esc puts it back. 接口的標籤，原地編輯
 * （自由文字、可空白；§3.3）。Enter 或離開就存；Esc 還原。 */
function PortLabelField({ direction, port }: { direction: Direction; port: InterfacePort }) {
  const session = useSession(), shown = port.label ?? '', [value, setValue] = useState(shown);
  useEffect(() => setValue(shown), [shown]);
  const commit = () => { if (value !== shown) session.editInterface(direction, { kind: 'update', id: port.id, patch: { label: value } }); };
  return <input value={value} maxLength={80} spellCheck={false} aria-label={say(tr('params.portLabel', 'Label'))} placeholder={say(tr('params.portLabelEmpty', '(no label)'))}
    onChange={event => setValue(event.target.value)} onBlur={commit}
    onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); } else if (event.key === 'Escape') { event.preventDefault(); setValue(shown); } }} />;
}

function InterfaceSettings({ direction, ports }: { direction: Direction; ports: readonly InterfacePort[] }) {
  const session = useSession(), list = useRef<HTMLDivElement>(null), [drag, setDrag] = useState<{ from: number; to: number } | null>(null);
  // Drag a row by its handle (basic design §3.5, the simple version: drag, release, one edit): the target is the row under the pointer,
  // before its middle or after. 抓把手拖一列（§3.5 簡單版：拖、放開、一次修改）：目標是指標下那一列，在它中線前或後。
  const startDrag = (index: number) => (event: ReactPointerEvent) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const pointer = event.pointerId; let to = index; setDrag({ from: index, to });
    const rowAt = (y: number) => {
      const rows = [...(list.current?.querySelectorAll<HTMLElement>('[data-port-index]') ?? [])];
      const i = rows.findIndex(row => { const box = row.getBoundingClientRect(); return y < box.top + box.height / 2; });
      return i < 0 ? rows.length : i;
    };
    const move = (moved: PointerEvent) => { if (moved.pointerId !== pointer) return; const next = rowAt(moved.clientY); if (next !== to) { to = next; setDrag({ from: index, to }); } };
    const up = (released: PointerEvent) => {
      if (released.pointerId !== pointer) return;
      removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
      setDrag(null);
      // `to` is where the row is inserted before; the row itself is taken out first. to 是插在哪一列前面；那一列自己先拿掉。
      const final = to > index ? to - 1 : to;
      if (final !== index) session.editInterface(direction, { kind: 'move', id: ports[index]!.id, delta: final - index });
    };
    addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
  };
  const marker = (i: number) => !drag || drag.from === i ? '' : drag.to === i ? ' drop-before' : drag.to === ports.length && i === ports.length - 1 ? ' drop-after' : '';
  return <div className="params-settings interface-settings">
    <div className="interface-list" ref={list}>
      {ports.map((port, i) => <div key={port.id} data-port-index={i} className={'interface-row' + (drag?.from === i ? ' dragging' : '') + marker(i)}
        style={{ '--port-color': typeColor(port.type) } as CSSProperties}>
        <span className="interface-handle" onPointerDown={startDrag(i)} title={say(tr('params.dragToReorder', 'Drag to reorder'))} aria-hidden="true">⋮⋮</span>
        <PortLabelField direction={direction} port={port} />
        <Select label={tr('params.portType', 'Type')} value={port.type} options={PORT_TYPES.map(type => ({ value: type, label: type }))}
          onChange={type => session.editInterface(direction, { kind: 'update', id: port.id, patch: { type } })} />
        <button type="button" className="icon-button narrow" aria-label={say(tr('params.removePort', 'Remove port'))} title={say(tr('params.removePort', 'Remove port'))}
          onClick={() => session.editInterface(direction, { kind: 'remove', id: port.id })}><Icon name="delete" /></button>
      </div>)}
    </div>
    <button type="button" className="interface-add" onClick={() => session.addPort(direction)}>{say(tr('params.addPort', '+ Add port'))}</button>
  </div>;
}

/** Nothing selected inside a subgraph: the subgraph itself (basic design §3.12: its name; read-only and make-local come with the Library
 * round), and how many calls it has. 子圖裡沒選東西：子圖本身（§3.12：名稱；唯讀與轉為本地在 Library 那一輪），以及它有幾個呼叫。 */
/** The definition's fields (visual notes 6, the part this round has): Title, the identifier (grey, "in-graph id" for a local one), and
 * its uses. Description, Category and Credits come with the Library round. 定義的欄位（外觀意見 6，本輪有的部分）：Title、識別碼（本地：
 * 灰字「圖內 id」）、使用數。Description、Category、Credits 在 Library 那一輪。 */
function SubgraphFields({ definition, uses }: { definition: SubgraphData; uses: { direct: number; expanded: number } }) {
  const session = useSession(), [value, setValue] = useState(definition.name), typing = useTypedName(setValue);
  useEffect(() => setValue(definition.name), [definition.name]);
  const commit = () => { if (value.trim() && value !== definition.name) session.renameSubgraph(definition.id, value); else setValue(definition.name); };
  return <div className="params-grid params-settings subgraph-fields">
    <label className="control-field"><span>{say(tr('params.subgraphTitle', 'Title'))}</span>
      <input value={value} maxLength={core.NAME_LIMIT} spellCheck={false} aria-label={say(tr('params.subgraphTitle', 'Title'))}
        {...typing} onBlur={commit}
        onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); } else if (event.key === 'Escape') { event.preventDefault(); setValue(definition.name); } }} /></label>
    <div className="control-field"><span>{say(tr('params.subgraphIdentifier', 'Identifier'))}</span>
      <code className="subgraph-identifier" title={say(tr('params.subgraphLocalId', 'In-graph id of a local subgraph'))}>{definition.id}<small> {say(tr('params.subgraphLocalIdTag', 'in-graph id'))}</small></code></div>
    <div className="control-field"><span>{say(tr('params.subgraphUsesLabel', 'Uses'))}</span>
      <span className="subgraph-uses">{say(tr('params.subgraphUsesText', '{direct} call(s), {expanded} in effect after expansion; a change here changes all of them', uses))}</span></div>
  </div>;
}
/** Nothing selected inside a subgraph: the subgraph itself as a card (basic design §3.12; visual notes 7). 子圖裡沒選東西：子圖本身的卡
 * （§3.12；外觀意見 7）。 */
function SubgraphSettings({ definition, uses }: { definition: SubgraphData; uses: { direct: number; expanded: number } }) {
  const floating = useContext(FloatingContext);
  return <article className={`grape-node params-card subgraph-settings${floating ? ' floating' : ''}`} style={{ '--group-color': definition.color ?? 'var(--group-subgraph)' } as CSSProperties}>
    <div className="node-title params-title" data-movable={floating ? '' : undefined} onContextMenu={floating?.openMenu} onPointerDown={floating ? event => {
      if (!(event.target as HTMLElement).closest('button, input, select, textarea')) floating.drag(event); } : undefined}>
      {floating?.fold}
      <Icon name="subgraphLocal" />
      <strong>{definition.name}</strong>
      <small>{say(tr('params.subgraph', 'Subgraph'))}</small>
      {floating?.controls}
    </div>
    {!floating?.collapsed && <SubgraphFields definition={definition} uses={uses} />}
    {!floating?.collapsed && <p className="hint params-pad">{say(tr('params.subgraphHint', 'Select a node to edit it; select the Input or Output node to edit the ports.'))}</p>}
  </article>;
}

/** The wire into each input, by `node` + NUL + `port`, and every node by id: made once per version of the graph (Refactor.106; the panel
 * searched every wire and node for each input on every render). 每個輸入的那條線（以「節點＋NUL＋接孔」為鍵）與每個節點（以 id）：
 * 圖每一版做一次（R.106；之前每次重繪、每個輸入都搜尋全部的線與節點）。 */
type Lookup = { nodes: ReadonlyMap<string, FlowNode>; inputs: ReadonlyMap<string, FlowEdge> };
const inputKey = (node: string, port: string) => node + '\u0000' + port;
function NodeParameters({ node, lookup }: { node: FlowNode; lookup: Lookup }) {
  const session = useSession(), text = useContext(TextContext), flow = useReactFlow(), floating = useContext(FloatingContext);
  const [tab, setTab] = useState(shownTab), choose = (next: Tab) => { shownTab = next; setTab(next); };
  // While a wire is dragged from an output, the panel's inputs take it (Refactor.85). 從輸出拉線時，面板的輸入接孔可以接。
  const wiring = useConnection(connection => connection.inProgress && connection.fromHandle?.type === 'source');
  const { id, data } = node, { authored, view, inputs } = data;
  const valued = data.declaration?.kind === 'uniform' || data.declaration?.kind === 'constant' ? data.declaration : undefined;
  // Where a wired input's value comes from: the other node's name (or its type) and port. 接線的輸入：另一端節點的名稱（或類型）與接孔。
  const sourceOf = (port: string) => {
    const edge = lookup.inputs.get(inputKey(id, port));
    if (!edge) return undefined;
    const from = lookup.nodes.get(edge.source);
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
  // A boundary node edits the interface of the subgraph being edited (its owner is always the current definition). 邊界節點編輯正在編輯的子圖的介面。
  const side = boundarySide(authored.nodeType), definition = side ? session.currentSubgraph() : null;
  // A call's definition, for its Subgraph tab (visual notes 7); the tab list follows. 呼叫的定義，給它的「子圖」分頁；分頁清單跟著。
  const called = data.subgraph === undefined ? null : session.definitions().find(f => f.id === data.subgraph) ?? null;
  const tabs = called ? CALL_TABS : TABS, shown = tab === 'subgraph' && !called ? 'parameters' : tab;
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
    {!floating?.collapsed && <Tabs tab={shown} tabs={tabs} choose={choose} />}
    {!floating?.collapsed && shown === 'settings' && (side && definition ? <InterfaceSettings direction={side} ports={definition[side]} /> : <NodeSettings id={id} />)}
    {!floating?.collapsed && shown === 'parameters' && side && definition && <InterfaceDefaults direction={side} ports={definition[side]} />}
    {!floating?.collapsed && shown === 'subgraph' && called && <SubgraphFields definition={called} uses={session.useCounts().get(called.id) ?? { direct: 0, expanded: 0 }} />}
    {!floating?.collapsed && shown === 'notes' && <NodeNote id={id} note={typeof authored.comment === 'string' ? authored.comment : ''} />}
    {/* One grid for the whole body, as TD's parameter dialog (Refactor.76.2): expand | names flush right | types | fields;
        every row lines up with the others (subgrid). 整個本體一張格線，照 TD 參數視窗（R.76.2）：展開｜名稱靠右｜型別｜欄位；
        每一列都和其他列對齊。 */}
    {!floating?.collapsed && shown === 'parameters' && !data.ghost && !side && <div className="node-body params-grid"><ValueColumns.Provider value={true}>
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

// Memoised, and reading only the primary node and the graph's version (Refactor.106): a node's data and the wires change only with an
// edit, which moves the version, never with a drag frame or a selection, so the projection is read once per version.
// memo，只讀主要選取與圖的版本（R.106）：節點資料與接線只在修改時變，修改會讓版本前進，拖曳的一格或選取不會，所以投影每一版只讀一次。
export const ParamsPanel = memo(function ParamsPanel() {
  const session = useSession();
  const primary = useSyncExternalStore(session.primarySubscribe, session.primarySnapshot);
  const version = useEditorSlice(session, state => state.version);
  const lookup = useMemo<Lookup>(() => {
    const { nodes, edges } = session.snapshot().projection, inputs = new Map<string, FlowEdge>();
    // The first wire into an input, as the search before found. 進入一個輸入的第一條線，同之前搜尋找到的。
    for (const edge of edges) if (edge.targetHandle && !inputs.has(inputKey(edge.target, edge.targetHandle))) inputs.set(inputKey(edge.target, edge.targetHandle), edge);
    return { nodes: new Map(nodes.map(node => [node.id, node])), inputs };
  }, [session, version]);
  const node = primary === null ? undefined : lookup.nodes.get(primary);
  const floating = useContext(FloatingContext), trail = useEditorSlice(session, state => state.trail);
  // Nothing selected inside a subgraph: the subgraph itself (Refactor.110). 子圖裡沒選東西：子圖本身（R.110）。
  const current = !node && trail.length ? session.currentSubgraph() : null;
  if (current) return <SubgraphSettings key={current.id} definition={current} uses={session.useCounts().get(current.id) ?? { direct: 0, expanded: 0 }} />;
  // Nothing selected: one line (legacy inspector.js:1592); floating, under a plain head so it can still be moved and closed.
  // 沒選：一行提示（照舊產品）；浮動時放在一個素的頭下面，仍能搬、能關。
  if (!node) return floating ? <article className="grape-node params-card floating params-empty">
    <div className="node-title params-title" data-movable="" onContextMenu={floating.openMenu} onPointerDown={event => { if (!(event.target as HTMLElement).closest('button')) floating.drag(event); }}>
      {floating.fold}<strong>{say(tr('params.title', 'Parameters'))}</strong><span className="spacer" />{floating.controls}</div>
    {!floating.collapsed && <p className="hint params-pad">{say(tr('params.empty', 'Select a node to edit its parameters.'))}</p>}
  </article> : <p className="hint">{say(tr('params.empty', 'Select a node to edit its parameters.'))}</p>;
  // Keyed by node: moving to another node starts its fields afresh. 依節點分開：換節點時欄位重新開始。
  return <NodeParameters key={node.id} node={node} lookup={lookup} />;
});
