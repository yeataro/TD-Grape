import { useReactFlow } from '@xyflow/react';
import type { Editor as EditorSession, EditorState } from './editor';
import { DropdownMenu, type MenuItem } from './DropdownMenu';
import { say, tr, type Message } from './text';
import type { IconName } from './icons';
import type { Layout } from './layout';
import { frameNodes } from './viewport';
import { useFullscreen } from './bars';
import { shortcutText, type Shortcut } from './shortcuts';
import type { CopyPaste } from './copy_paste';

// The right-click menu of the network (Refactor.93; human 2026-10-12: legacy's logic — what shows when, which have icons, which
// are checked — legacy graph_ui.js:2939-3052; content-wide, in our look). Opened by a right press and release that did not move
// (a move is a box select) or a long press (RightDragSelect.tsx); on a wire it is the wire's menu, elsewhere the nodes' menu,
// for the selection (a node pressed is selected first). What the editor cannot do yet is drawn greyed, saying so (human: draw it
// first); the floating toolbar has the same names and icons. Shortcuts come from the one table (shortcuts.ts); `hint` is only a
// submenu's arrow.
// 網路區的右鍵選單（R.93；人類 10-12：邏輯照舊產品——什麼時候出現什麼、哪些有圖示、哪些打勾；照內容寬，符合我們的樣子）。右鍵按下放開
// 沒移動（有移動是框選）或長按打開（RightDragSelect.tsx）；在接線上是接線的選單，其他地方是節點的選單，對著選取（按到的節點先被選取）。
// 還不能做的畫成灰的、說尚未提供（人類：先畫上去）；和浮動工具列同名同圖示。快捷鍵從那一張表來（shortcuts.ts）；hint 只用來畫子選單的箭頭。

/** Where and on what the menu opens. `wire`: the wire it opened on. `selection`: what was selected then, so an item chosen
 * after the selection changed does nothing (legacy sameContext, graph_ui.js:2948). 在哪裡、對什麼打開。wire：在哪條接線上打開；
 * selection：當時選了什麼，選取之後變了，選的項目就不做（照舊產品）。 */
export type CanvasMenuRequest = { x: number; y: number; touch: boolean; host: HTMLElement; wire?: string; selection: string };
export const selectionKey = (state: EditorState) => [...state.projection.nodes.filter(node => node.selected).map(node => node.id), '|',
  ...state.projection.edges.filter(edge => edge.selected).map(edge => edge.id)].join(' ');

type Row = { key: string; label: Message; icon?: IconName; keys?: Shortcut; hint?: string; run?: () => void; disabled?: boolean; checked?: boolean; toggle?: boolean; group: number };

export function CanvasMenu({ request, session, state, layout, clip, onCreate, onClose }: {
  request: CanvasMenuRequest; session: EditorSession; state: EditorState; layout: Layout; clip: CopyPaste;
  onCreate(at: { x: number; y: number }): void; onClose(): void;
}) {
  const flow = useReactFlow(), fullscreen = useFullscreen();
  const nodes = state.projection.nodes.filter(node => node.selected), edges = state.projection.edges.filter(edge => edge.selected);
  const count = nodes.length, ids = nodes.map(node => node.id);
  const remove = () => void flow.deleteElements({ nodes, edges });
  const params: Row = { key: 'params', group: 9, icon: 'floatingPanel', label: tr('canvasMenu.params', 'Floating Parameter panel'), keys: 'floatingParameter',
    toggle: true, checked: !!layout.floating.params, run: () => layout.toggleFloat('params') };
  const wire = request.wire ? state.projection.edges.find(edge => edge.id === request.wire) : undefined;
  const rows: Row[] = wire ? [
    // The wire's menu (legacy graph_ui.js:2956-2964). 接線的選單。
    { key: 'wireStyle', group: 1, label: tr('canvasMenu.wire', 'Wire'), checked: true },
    { key: 'linkStyle', group: 1, label: tr('canvasMenu.link', 'Link'), checked: false },
    { key: 'source', group: 2, icon: 'arrowLeft', label: tr('canvasMenu.selectSource', 'Select source'), run: () => session.selectNode(wire.source) },
    { key: 'destination', group: 2, icon: 'arrowRight', label: tr('canvasMenu.selectDestination', 'Select destination'), run: () => session.selectNode(wire.target) },
    { key: 'sourceLinks', group: 2, icon: 'convertWires', label: tr('canvasMenu.sourceLinks', 'Source → all Link') },
    { key: 'disconnect', group: 3, icon: 'delete', label: tr('canvasMenu.disconnect', 'Disconnect wire'), run: remove },
    params,
  ] : [
    // The nodes' menu, for the selection (legacy graph_ui.js:2966-2992). Items about subgraphs and groups that cannot exist yet
    // (make independent, rename, move into or out of a group) are not shown, as legacy hides them then. 節點的選單，對著選取（照舊產品）。
    // 子圖與群組相關、現在還不可能出現的（建立獨立副本、重新命名、移入移出群組）不顯示，舊產品這時也不顯示。
    { key: 'add', group: 1, icon: 'plus', label: tr('canvasMenu.nodes', 'Nodes'), keys: 'add', run: () => onCreate(request) },
    // Paste lands where the menu opened (legacy graph_ui.js:2969). 貼在打開選單的地方（照舊產品）。
    { key: 'copy', group: 2, icon: 'copy', label: tr('selection.copy', 'Copy'), keys: 'copy', disabled: !clip.canCopy(nodes), run: clip.copy },
    { key: 'paste', group: 2, icon: 'paste', label: tr('selection.paste', 'Paste'), keys: 'paste', run: () => clip.paste(request) },
    { key: 'duplicate', group: 2, icon: 'duplicate', label: tr('canvasMenu.duplicate', 'Duplicate'), keys: 'duplicate', disabled: !clip.canCopy(nodes), run: clip.duplicate },
    ...count ? [
      { key: 'collapse', group: 3, icon: 'collapseCards', label: tr('selection.collapse', 'Collapse nodes') },
      { key: 'expand', group: 3, icon: 'expandCards', label: tr('selection.expand', 'Expand nodes') },
    ] as Row[] : [],
    ...count > 1 ? [{ key: 'arrange', group: 3, icon: 'arrange', label: tr('selection.arrange', 'Arrange nodes'), hint: '›' }] as Row[] : [],
    ...count ? [{ key: 'convertWires', group: 3, icon: 'convertWires', label: tr('canvasMenu.convertWires', 'Convert wires'), hint: '›' }] as Row[] : [],
    ...count > 1 ? [{ key: 'group', group: 4, icon: 'group', label: tr('selection.group', 'Make group'), keys: 'group' }] as Row[] : [],
    { key: 'subgraph', group: 4, icon: 'subgraph', label: tr('selection.subgraph', 'Selection to subgraph'), keys: 'subgraph' },
    { key: 'linkLines', group: 5, label: tr('canvasMenu.linkLines', 'Show Link lines'), keys: 'linkLines', checked: false },
    { key: 'home', group: 5, icon: 'home', label: tr('canvasMenu.home', 'Home'), keys: 'home', run: () => frameNodes(flow) },
    ...count ? [{ key: 'frame', group: 5, icon: 'fitSelection', label: tr('selection.fit', 'Frame selected'), keys: 'frame', run: () => frameNodes(flow, ids) }] as Row[] : [],
    // Its name says what choosing it does (legacy view.restoreLayout). 名字說選了會怎樣（照舊產品）。
    { key: 'focus', group: 5, icon: layout.focused ? 'unfocus' : 'focus', label: layout.focused ? tr('canvas.restoreLayout', 'Restore layout') : tr('canvasMenu.focus', 'Focus graph'),
      toggle: true, checked: layout.focused, run: () => layout.setFocused(on => !on) },
    // The browser's own full screen, as the foot bar's; not offered where the browser has none (an iPhone). 瀏覽器自己的全螢幕，同底列；
    // 瀏覽器沒有時（iPhone）不能按。
    { key: 'fullscreen', group: 5, icon: 'fullscreen', label: fullscreen ? tr('canvasMenu.exitFullscreen', 'Exit fullscreen') : tr('canvasMenu.fullscreen', 'Fullscreen'),
      toggle: true, checked: fullscreen, disabled: !document.fullscreenEnabled,
      run: () => void (fullscreen ? document.exitFullscreen() : document.documentElement.requestFullscreen()) },
    { key: 'delete', group: 6, icon: 'delete', label: edges.length ? tr('canvasMenu.disconnect', 'Disconnect wire') : tr('canvasMenu.deleteNode', 'Delete node'),
      keys: 'delete', disabled: !count && !edges.length, run: remove },
    params,
  ];
  // Only while the selection is what it was when the menu opened. 只在選取還是打開時那樣時才做。
  const same = () => selectionKey(session.snapshot()) === request.selection;
  const items: MenuItem[] = rows.map((row, i) => ({ key: row.key, icon: row.icon, hint: row.keys ? shortcutText(row.keys) : row.hint, checked: row.checked, toggle: row.toggle,
    divider: i > 0 && rows[i - 1]!.group !== row.group, label: say(row.label),
    disabled: !row.run || row.disabled,
    title: row.run ? undefined : say(tr('selection.notYet', '{action} (not available yet)', { action: say(row.label) })),
    select: () => { if (same()) row.run?.(); } }));
  return <DropdownMenu anchor={request.host} at={request} touch={request.touch} items={items} label={say(tr('canvasMenu.label', 'Graph actions'))} onClose={onClose} />;
}
