import { memo, useEffect, useState, type MouseEvent } from 'react';
import { useReactFlow } from '@xyflow/react';
import type { SubgraphData } from './core';
import { tr, say, useLanguage } from './text';
import { useSession } from './contexts';
import { Badge, ConfirmDialog, MenuButton } from './controls';
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
  const session = useSession(), [draft, setDraft] = useState(definition.name);
  useEffect(() => setDraft(definition.name), [definition.name]);
  const commit = () => { if (draft.trim() && draft !== definition.name) session.renameSubgraph(definition.id, draft); else setDraft(definition.name); };
  return <input className="source-name" aria-label={say(tr('subgraphs.name', 'Name'))} value={draft} maxLength={80}
    onChange={event => setDraft(event.target.value)} onBlur={commit}
    onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { setDraft(definition.name); event.currentTarget.blur(); } }} />;
}

function SubgraphCard({ definition, uses, current, onRemove }: { definition: SubgraphData; uses: number; current: boolean; onRemove(): void }) {
  const session = useSession(), flow = useReactFlow();
  const centre = () => {
    const canvas = document.querySelector('.canvas')!.getBoundingClientRect();
    return flow.screenToFlowPosition({ x: canvas.x + canvas.width / 2, y: canvas.y + canvas.height / 2 });
  };
  // A double-click on the card opens the subgraph, as on its call (legacy: double-click enters). 雙擊卡片打開子圖，同雙擊呼叫節點。
  const open = (event: MouseEvent) => { if (!(event.target as Element).closest('input, button')) session.enterDefinition(definition.id); };
  return <div className={'source-card subgraph-card' + (current ? ' current' : '')} style={groupColor('subgraph')} {...dragToAdd(subgraphChoice(definition.id))} onDoubleClick={open}>
    <span className="expand-toggle subgraph-icon" aria-hidden="true"><Icon name="subgraph" /></span>
    <div className="source-head" data-drag-handle="">
      <NameField definition={definition} />
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
  </div>;
}

// Memoised: a node drag re-renders the workspace every move; this panel follows only its own props (EDITOR_UI_RULES, continuous
// interactions). memo：拖節點時工作區每動一下都重繪，這個面板只跟著自己的 props。
export const SubgraphsPanel = memo(SubgraphsList);
function SubgraphsList({ definitions, counts, current }: { definitions: readonly SubgraphData[]; counts: ReadonlyMap<string, number>; current: string | null }) {
  useLanguage();
  const session = useSession(), [confirming, setConfirming] = useState<SubgraphData | null>(null);
  return <section className="sources subgraphs">
    {confirming && <ConfirmDialog title={tr('subgraphs.removeTitle', 'Delete {name}?', { name: confirming.name })}
      message={tr('subgraphs.removeConfirm', 'The subgraph {name} is not called anywhere. Deleting it removes its definition from this graph.', { name: confirming.name })}
      confirmLabel={tr('subgraphs.remove', 'Delete')} onCancel={() => setConfirming(null)}
      onConfirm={() => { session.removeSubgraph(confirming.id); setConfirming(null); }} />}
    <p className="hint">{say(tr('subgraphs.hint', 'The subgraphs of this graph. Double-click a card or a call node to open one; drag a card onto the canvas to add a call; make one from selected nodes with Selection to subgraph.'))}</p>
    {!definitions.length && <p className="hint">{say(tr('subgraphs.none', 'No subgraphs yet.'))}</p>}
    {definitions.map(definition => <SubgraphCard key={definition.id} definition={definition} uses={counts.get(definition.id) ?? 0}
      current={definition.id === current} onRemove={() => setConfirming(definition)} />)}
  </section>;
}
