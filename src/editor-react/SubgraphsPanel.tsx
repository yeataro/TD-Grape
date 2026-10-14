import { GhostMark } from './GhostMark';
import { memo, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type MouseEvent } from 'react';
import { scrollToMiddle } from './scroll_glide';
import { useReactFlow } from '@xyflow/react';
import { core, typeColor, type SubgraphData, type InterfacePort } from './core';
import { tr, say, useLanguage } from './text';
import { useSession } from './contexts';
import { Badge, ConfirmDialog, MenuButton, useTypedName } from './controls';
import { Icon } from './icons';
import { dragToAdd } from './drag_to_add';
import { groupColor } from './SourceCard';

// The subgraph panel (basic design 2026-10-14 §3.12, Q10; Refactor.110): its own panel, by default under Add Node. It is an index of
// the graph's definitions (`subgraphs[]`), one card each: the name (edited in place), how many calls it has over the whole graph (a
// click selects the calls in the network being edited), and a menu — open it, add a call to the graph, select its calls, delete it
// (only with no calls, §3.9: a local definition is never collected). Dragged onto the canvas it adds a call (drag_to_add.tsx). Library
// cards (read-only, missing, available) come with the Library round. The card parts are the Shared Sources panel's (SourceCard.tsx).
// 子圖面板（§3.12，Q10；R.110）：自己一個面板，預設在新增節點下面。它是圖裡定義（subgraphs[]）的索引，一份一張卡：名稱（原地改）、整張圖裡
// 有幾個呼叫（點了選取正在編輯的網路裡的呼叫），以及選單——打開、加到圖上、選取呼叫、刪除（只有沒人呼叫時，§3.9：本地定義永不回收）。
// 拖到畫布上就新增一個呼叫（drag_to_add.tsx）。Library 的卡片（唯讀、失聯、可拉入）在 Library 那一輪。卡片零件沿用共用來源面板的。

/** The add-list id of a definition's call, as the Add Node choices have one (drag_to_add.tsx, main.tsx). 定義的呼叫在新增清單的代號。 */
export const subgraphChoice = (id: string) => 'subgraph:' + id;

function NameField({ definition }: { definition: SubgraphData }) {
  const session = useSession(), [draft, setDraft] = useState(definition.name), typing = useTypedName(setDraft);
  useEffect(() => setDraft(definition.name), [definition.name]);
  const commit = () => { if (draft.trim() && draft !== definition.name) session.renameSubgraph(definition.id, draft); else setDraft(definition.name); };
  return <input className="source-name" aria-label={say(tr('subgraphs.name', 'Name'))} value={draft} maxLength={core.NAME_LIMIT}
    {...typing} onBlur={commit}
    onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { setDraft(definition.name); event.currentTarget.blur(); } }} />;
}

/** The definition drawn as its call node would be (visual notes 14): title, inputs, outputs; a read-only preview, no handles.
 * 定義畫成它的呼叫節點的樣子（外觀意見 14）：標題、輸入、輸出；唯讀預覽，沒有接孔。 */
function DefinitionPreview({ definition }: { definition: SubgraphData }) {
  const row = (port: InterfacePort, side: 'input' | 'output') => <div key={port.id} className={`port-row ${side}-row`} style={{ '--port-color': typeColor(port.type) } as CSSProperties}>
    <span className="preview-dot" aria-hidden="true" />{port.label ?? ''} <small>{port.type}</small></div>;
  return <article className="grape-node subgraph-preview" style={{ '--group-color': definition.color ?? 'var(--group-subgraph)' } as CSSProperties}>
    <div className="node-title"><Icon name="subgraphLocal" /><strong>{definition.name}</strong><small>{definition.outputs[0]?.type ?? ''}</small></div>
    <div className="node-body">{definition.inputs.map(port => row(port, 'input'))}{definition.outputs.map(port => row(port, 'output'))}</div>
  </article>;
}

function SubgraphCard({ definition, uses, current, unusable, onRemove }: { definition: SubgraphData; uses: number; current: boolean; unusable: boolean; onRemove(): void }) {
  const session = useSession(), flow = useReactFlow(), [open, setOpen] = useState(false);
  const centre = () => {
    const canvas = document.querySelector('.canvas')!.getBoundingClientRect();
    return flow.screenToFlowPosition({ x: canvas.x + canvas.width / 2, y: canvas.y + canvas.height / 2 });
  };
  // A double-click on the card opens the subgraph, as on its call (legacy: double-click enters). 雙擊卡片打開子圖，同雙擊呼叫節點。
  const openIt = (event: MouseEvent) => { if (!(event.target as Element).closest('input, button')) session.enterDefinition(definition.id); };
  // Located from the Parameter panel (visual notes 20): scrolled to and given a short cue. 參數面板定位到這張：捲過來並提示一下。
  const focus = useSyncExternalStore(session.definitionFocusSubscribe, session.definitionFocusSnapshot), card = useRef<HTMLDivElement>(null);
  const [located, setLocated] = useState(false);
  useEffect(() => {
    if (focus.id !== definition.id || !focus.n || !card.current) return;
    scrollToMiddle(card.current); setLocated(true);
    const timer = window.setTimeout(() => setLocated(false), 1200);
    return () => window.clearTimeout(timer);
  }, [focus]);
  return <div ref={card} className={'source-card subgraph-card' + (current ? ' current' : '') + (located ? ' located' : '')} style={definition.color ? { '--group-color': definition.color } as CSSProperties : groupColor('subgraph')}
    {...dragToAdd(subgraphChoice(definition.id))} onDoubleClick={openIt}>
    {/* The triangle opens the preview, as every card here (visual notes 15; node folding, when it exists, may take its place). 三角形打開預覽，
        同這裡每張卡（外觀意見 15；節點摺疊做好後或許換成它）。 */}
    <button type="button" className="expand-toggle" aria-expanded={open} onClick={() => setOpen(!open)}
      aria-label={say(tr('subgraphs.preview', 'Show the subgraph as a node'))} title={say(tr('subgraphs.preview', 'Show the subgraph as a node'))}><Icon name="chevronDown" /></button>
    <div className="source-head" data-drag-handle="">
      {/* The icon opens the subgraph (visual notes 13: the icon on a call opens it too; the two are one link). 圖示打開子圖（外觀意見 13：
          呼叫節點上的圖示也是打開；兩邊是同一個 link）。 */}
      <button type="button" className="subgraph-icon icon-button narrow" aria-label={say(tr('subgraphs.open', 'Open'))} title={say(tr('subgraphs.open', 'Open'))}
        disabled={current} onClick={() => session.enterDefinition(definition.id)}><Icon name="subgraphLocal" /></button>
      <NameField definition={definition} />
      {/* A definition this host cannot use carries the Ghost mark (amendment A8): while nothing calls it, it does
          not affect the shader. 這個 host 用不了的定義帶 Ghost 標記（A8）：沒被呼叫時不影響 Shader。 */}
      {unusable && <span className="subgraph-unusable" role="img" title={say(tr('subgraphs.unusable', 'Cannot be used in this host. While nothing calls it, it does not affect the shader.'))}
        aria-label={say(tr('subgraphs.unusable', 'Cannot be used in this host. While nothing calls it, it does not affect the shader.'))}><GhostMark id={definition.id} on="node" /></span>}
      {/* The count over the whole graph; a click selects the calls here, in the network being edited (§3.6 "×N").
          整張圖的呼叫數；點了選取這裡——正在編輯的網路——的呼叫（§3.6「×N」）。 */}
      <Badge count={uses} group={uses ? 'subgraph' : undefined}
        title={tr('subgraphs.usedBySelect', 'Called by {count} node(s) · click to select the calls in this network', { count: uses })}
        onClick={() => session.selectCalls(definition.id)} />
      <MenuButton icon="menu" narrow label={tr('subgraphs.more', 'More')} items={[
        { key: 'open', label: say(tr('subgraphs.open', 'Open')), select: () => session.enterDefinition(definition.id), disabled: current },
        { key: 'add', label: say(tr('subgraphs.place', 'Add a call to the graph')), select: () => session.placeSubgraph(definition.id, centre()) },
        { key: 'select', label: say(tr('subgraphs.selectCalls', 'Select calls ({count})', { count: uses })), disabled: !uses, select: () => session.selectCalls(definition.id) },
        { key: 'delete', label: say(tr('subgraphs.remove', 'Delete')), danger: true, divider: true, disabled: uses > 0,
          title: uses > 0 ? say(tr('subgraphs.removeInUse', 'Still called by {count} node(s); delete the calls first', { count: uses })) : undefined, select: onRemove },
      ]} />
    </div>
    {open && <div className="source-body"><DefinitionPreview definition={definition} /></div>}
  </div>;
}

// Memoised: a node drag re-renders the workspace every move; this panel follows only its own props (EDITOR_UI_RULES, continuous
// interactions). memo：拖節點時工作區每動一下都重繪，這個面板只跟著自己的 props。
export const SubgraphsPanel = memo(SubgraphsList);
function SubgraphsList({ definitions, counts, unusable, current }: { definitions: readonly SubgraphData[]; counts: ReadonlyMap<string, { direct: number; expanded: number }>; unusable: ReadonlySet<string>; current: string | null }) {
  useLanguage();
  const session = useSession(), [confirming, setConfirming] = useState<SubgraphData | null>(null);
  return <section className="sources subgraphs">
    {confirming && <ConfirmDialog title={tr('subgraphs.removeTitle', 'Delete {name}?', { name: confirming.name })}
      message={tr('subgraphs.removeConfirm', 'The subgraph {name} is not called anywhere. Deleting it removes its definition from this graph.', { name: confirming.name })}
      confirmLabel={tr('subgraphs.remove', 'Delete')} onCancel={() => setConfirming(null)}
      onConfirm={() => { session.removeSubgraph(confirming.id); setConfirming(null); }} />}
    <p className="hint">{say(tr('subgraphs.hint', 'The subgraphs of this graph. Double-click a card or a call node to open one; drag a card onto the canvas to add a call; make one from selected nodes with Selection to subgraph.'))}</p>
    {!definitions.length && <p className="hint">{say(tr('subgraphs.none', 'No subgraphs yet.'))}</p>}
    {definitions.map(definition => <SubgraphCard key={definition.id} definition={definition} uses={counts.get(definition.id)?.expanded ?? 0}
      current={definition.id === current} unusable={unusable.has(definition.id)} onRemove={() => setConfirming(definition)} />)}
  </section>;
}
