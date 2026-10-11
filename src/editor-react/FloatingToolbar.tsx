import { useLayoutEffect, useRef, useState } from 'react';
import { getNodesBounds, useReactFlow, useStore } from '@xyflow/react';
import type { FlowNode, FlowEdge } from './projection';
import { say, tr, type Message } from './text';
import { IconButton } from './controls';
import type { IconName } from './icons';
import { frameNodes } from './viewport';
import type { CopyPaste } from './copy_paste';

// The floating toolbar (浮動工具列, Refactor.92; human 2026-10-12; legacy selection_ui.js:106-176, 415-466): the actions on what is
// selected, floating by the selection. Always on, for one node or several (human: the new product settles on "single and
// multiple"). Everything acting on the selection lives here (and, later, in the right-click menu); the network toolbar keeps
// only history, box select, Snap and GLSL. Actions the editor does not have yet are drawn, greyed, saying so (human: draw them
// first). Its place, as legacy: 12px above the selection, centred, inside the canvas 8px from its sides; below it when there is no
// room above; never over the toolbar's row or the canvas controls' row; hidden while the selection is out of view. It follows
// pans, zooms and drags, from React Flow's own state.
// 浮動工具列（R.92；人類 10-12；照舊產品）：對選取的動作，浮在選取旁邊。一直開著，單選複選都有（人類：新產品確定單選與複選）。
// 對選取的動作都在這裡（之後也在右鍵選單）；網路區上方的功能列只留復原重做、框選、Snap、GLSL。還沒有的動作先畫上去、灰的、說尚未提供
// （人類：先把東西畫上去）。位置照舊產品：選取上方 12px、置中、在畫布裡離左右 8px；上方放不下就放下方；不蓋到工具列那一排與畫布控制項那一排；
// 選取看不到時隱藏。平移、縮放、拖曳時跟著走，讀 React Flow 自己的狀態。

/** How far the bar keeps from the selection, and from the canvas's sides (legacy selection_ui.js:160, 166). 離選取多遠、離畫布邊多遠。 */
const OFF_SELECTION = 12, OFF_SIDE = 8;

type Tool = { key: string; icon: IconName; label: Message; run?: () => void; disabled?: boolean; danger?: boolean };

export function FloatingToolbar({ nodes, edges, clip }: { nodes: readonly FlowNode[]; edges: readonly FlowEdge[]; clip: CopyPaste }) {
  const flow = useReactFlow(), bar = useRef<HTMLDivElement>(null);
  const selected = nodes.filter(node => node.selected), ids = selected.map(node => node.id);
  // The selection's bounds on screen: worked out from React Flow's measured nodes and its view, as a key so the bar draws again only
  // when they change. 選取在螢幕上的範圍：從 React Flow 量到的節點與視角算出，做成字串，變了才重畫。
  const key = useStore(state => {
    if (!ids.length) return '';
    const box = getNodesBounds(ids, { nodeLookup: state.nodeLookup }), [x, y, zoom] = state.transform;
    return [box.x * zoom + x, box.y * zoom + y, (box.x + box.width) * zoom + x, (box.y + box.height) * zoom + y].map(Math.round).join(',');
  });
  // Where it may sit: below the toolbar's row and above the canvas controls' row, measured when they change size, not on every move.
  // 可以放的範圍：工具列那一排之下、畫布控制項那一排之上，大小改變時才量，不是每次移動都量。
  const [room, setRoom] = useState<{ width: number; top: number; bottom: number } | null>(null), [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const element = bar.current, canvas = element?.closest('.react-flow'), host = canvas?.closest('.canvas-host');
    if (!element || !canvas) return;
    const measure = () => {
      const box = canvas.getBoundingClientRect(), row = host?.querySelector('.network-bar-slot')?.getBoundingClientRect(), controls = canvas.querySelector('.react-flow__controls')?.getBoundingClientRect();
      setRoom({ width: box.width, top: (row ? row.bottom - box.top : 0) + OFF_SIDE, bottom: (controls ? controls.top - box.top : box.height) - OFF_SIDE });
      setSize({ width: element.offsetWidth, height: element.offsetHeight });
    };
    measure();
    const watch = new ResizeObserver(measure);
    for (const part of [element, canvas, host?.querySelector('.network-bar-slot'), canvas.querySelector('.react-flow__controls')]) if (part) watch.observe(part);
    return () => watch.disconnect();
  }, [ids.length > 0]);

  if (!ids.length) return null;
  const [left, top, right, bottom] = key.split(',').map(Number) as [number, number, number, number];
  const many = ids.length > 1, wires = edges.filter(edge => edge.selected);
  // Legacy's order and groups (selection_ui.js:433-439): what edits the selection, then what arranges it. 舊產品的順序與分組。
  const edit: Tool[] = [
    // Paste from here lands a third into the canvas (legacy graph_ui.js:2811). 從這裡貼上，貼在畫布三分之一處（照舊產品）。
    { key: 'copy', icon: 'copy', label: tr('selection.copy', 'Copy'), run: clip.copy, disabled: !clip.canCopy(selected) },
    { key: 'paste', icon: 'paste', label: tr('selection.paste', 'Paste'), run: () => clip.paste() },
    // React Flow's own delete path, so the same rules as the Delete key apply. 走 RF 的刪除，與 Delete 鍵同一套規則。
    { key: 'delete', icon: 'delete', danger: true, label: tr('selection.delete', 'Delete selected'), run: () => void flow.deleteElements({ nodes: selected, edges: wires }) },
  ];
  const arrange: Tool[] = [
    { key: 'collapse', icon: 'collapseCards', label: tr('selection.collapse', 'Collapse nodes') },
    { key: 'expand', icon: 'expandCards', label: tr('selection.expand', 'Expand nodes') },
    ...(many ? [
      { key: 'group', icon: 'group', label: tr('selection.group', 'Make group') },
      { key: 'subgraph', icon: 'subgraph', label: tr('selection.subgraph', 'Selection to subgraph') },
      { key: 'arrange', icon: 'arrange', label: tr('selection.arrange', 'Arrange nodes') },
    ] as Tool[] : []),
    { key: 'frame', icon: 'fitSelection', label: tr('selection.fit', 'Frame selected'), run: () => frameNodes(flow, ids) },
  ];
  // Out of view: hidden; else above the selection, or below when there is no room, kept inside. 看不到就藏；否則在上方，放不下在下方，夾在範圍裡。
  const shown = room && right > 0 && left < room.width && bottom > room.top && top < room.bottom;
  const x = room ? Math.max(OFF_SIDE, Math.min(room.width - OFF_SIDE - size.width, (left + right) / 2 - size.width / 2)) : 0;
  const above = top - OFF_SELECTION - size.height, y = room ? Math.max(room.top, Math.min(room.bottom - size.height, above >= room.top ? above : bottom + OFF_SELECTION)) : 0;
  // Not there yet: greyed, its name saying so. 還沒有的：灰的，名字後面說尚未提供。
  const tool = (item: Tool) => <IconButton key={item.key} icon={item.icon} label={item.label} danger={item.danger} disabled={!item.run || item.disabled}
    title={item.run ? undefined : tr('selection.notYet', '{action} (not available yet)', { action: say(item.label) })} onClick={item.run} />;
  // Its own: a press here starts no box selection, a wheel here does not zoom the canvas. 自己的：在這裡按下不會開始框選，滾輪不會縮放畫布。
  return <div ref={bar} className="floating-toolbar network-bar-group nopan nowheel nodrag" role="toolbar" aria-label={say(tr('selection.toolbar', 'Floating toolbar'))}
    style={{ transform: `translate(${Math.round(x)}px, ${Math.round(y)}px)`, visibility: shown ? undefined : 'hidden' }}
    onPointerDown={event => event.stopPropagation()}>
    <div className="tool-group">{edit.map(tool)}</div>
    <div className="tool-group">{arrange.map(tool)}</div>
  </div>;
}
