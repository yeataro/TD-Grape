import { Fragment, memo, useMemo, useRef, useState } from 'react';
import { categoryLabel, searchChoices, sourceLabel, topCategories, type AddChoice } from './add_entries';
import { Badge } from './controls';
import { dragToAdd } from './drag_to_add';
import { Icon } from './icons';
import { ResizeHandle } from './layout';
import { say, tr, useLanguage } from './text';

// The Add Node panel (Refactor.54; floating-panels.md 8, as the legacy left panel): search, the category tree
// with counts, one row per choice (name, source, +). A click selects it and shows its description below (a
// placeholder for now); double-click or + adds it to the middle of the network; dragging it onto the network
// adds it where it is dropped. Same list as Create node (add_entries.ts).
// 新增節點面板（照舊產品左側）：搜尋、帶數量的分類樹、每列名稱＋來源＋「＋」。點一下選中並在下方顯示說明（先佔位）；
// 雙擊或「＋」加到網路區中間；拖到網路區放在放開的位置。與 Create node 同一份清單。
const hint = tr('addNode.rowHint', 'Click to see its description; drag, double-click or press + to add');

// Memoised: a node drag re-renders the workspace every move, and this panel only follows its own props (Refactor.79.4; EDITOR_UI_RULES, continuous interactions).
// memo：拖節點時工作區每動一下都重繪，這個面板只跟著自己的 props（R.79.4；畫面規則「連續互動」）。
export const AddNodePanel = memo(AddNodeList);
function AddNodeList({ choices, onAdd }: { choices: readonly AddChoice[]; onAdd(choice: AddChoice): void }) {
  useLanguage();
  const [query, setQuery] = useState(''), [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());
  const [chosen, setChosen] = useState<string | null>(null), [split, setSplit] = useState(.7);
  const body = useRef<HTMLDivElement>(null), start = useRef(split);
  const found = useMemo(() => searchChoices(choices, query), [choices, query]);
  const toggle = (key: string) => setOpen(old => { const next = new Set(old); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  // Dragged onto the canvas to add it (drag_to_add.tsx): a mouse from anywhere on the row, a finger from its + (human 2026-10-12).
  // 拖到畫布新增（drag_to_add.tsx）：滑鼠從整列哪裡都可以，手指從 +（人類 10-12）。
  const row = (choice: AddChoice) => <div key={choice.id} className={'choice-row' + (choice.id === chosen ? ' chosen' : '')}
    title={choice.label + ' · ' + say(sourceLabel[choice.source]) + '\n' + say(hint)}
    onClick={() => setChosen(choice.id)} onDoubleClick={() => onAdd(choice)} {...dragToAdd(choice.id)}>
    <span className="choice-name">{choice.label}</span><small className="choice-source">{say(sourceLabel[choice.source])}</small>
    <button type="button" className="choice-add" data-drag-handle="" aria-label={say(tr('addNode.add', 'Add {name}', { name: choice.label }))}
      onClick={event => { event.stopPropagation(); onAdd(choice); }}>+</button></div>;
  // Categories below the top level, shown as the next level of the tree. 頂層之下的分類，作為樹的下一層。
  const level = (items: readonly AddChoice[], depth: number, prefix: string) => {
    const groups = new Map<string, AddChoice[]>(), leaves: AddChoice[] = [];
    for (const item of items) { const key = item.path[depth]; if (key) (groups.get(key) ?? groups.set(key, []).get(key)!).push(item); else leaves.push(item); }
    return <>{[...groups].map(([key, members]) => { const id = prefix + '/' + key, shown = open.has(id);
      return <div key={id} className="choice-group">
        <button type="button" className="choice-heading" aria-expanded={shown} onClick={() => toggle(id)}>
          <Icon name="chevronDown" /><span>{say(categoryLabel(key))}</span><Badge count={members.length} /></button>
        {shown && <div className="choice-children">{level(members, depth + 1, id)}</div>}</div>; })}
      {leaves.map(row)}</>;
  };
  const tree = useMemo(() => topCategories(choices).map(top => ({ top, members: choices.filter(choice => choice.path[0] === top) })), [choices]);
  const selected = choices.find(choice => choice.id === chosen);
  return <div className="add-node" ref={body}>
    <input className="add-node-search" type="search" value={query} placeholder={say(tr('addNode.search', 'Search all nodes…'))}
      aria-label={say(tr('addNode.search', 'Search all nodes…'))} onChange={event => setQuery(event.target.value)} />
    <div className="add-node-list" style={{ flexGrow: selected ? split : 1 }}>
      {query.trim() ? (found.length ? found.map(row) : <p className="hint">{say(tr('create.empty', 'Nothing matches.'))}</p>)
        : tree.map(({ top, members }) => <Fragment key={top}>{level(members, 0, '')}</Fragment>)}
    </div>
    {/* The description below, resizable (legacy); a placeholder until node texts exist. 下方說明，可調高度；節點說明做好前先佔位。 */}
    {selected && <div className="add-node-details" style={{ flexGrow: 1 - split }}>
      <ResizeHandle axis="y" label={tr('layout.resizeGroups', 'Resize the panels above and below')} onStart={() => { start.current = split; }}
        onMove={delta => setSplit(Math.max(.25, Math.min(.85, start.current + delta / (body.current?.clientHeight || 1))))} />
      <header><strong>{selected.label}</strong><button type="button" className="icon-button" aria-label={say(tr('create.close', 'Close'))}
        onClick={() => setChosen(null)}><Icon name="close" /></button></header>
      <small>{say(sourceLabel[selected.source])} · {selected.path.map(key => say(categoryLabel(key))).join(' › ')}</small>
      <p className="hint">{say(tr('create.noDescription', 'Descriptions are not available yet.'))}</p>
    </div>}
  </div>;
}
