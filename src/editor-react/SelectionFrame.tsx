import { getNodesBounds, ViewportPortal } from '@xyflow/react';
import type { FlowNode } from './projection';

// Multi-selection frame (Refactor.50.3; human 2026-10-09: shown whenever two or more nodes are selected;
// in the legacy editor it also showed up unexpectedly, as several rules piled up). Looks like the legacy
// one (src/editor/selection_ui.js #selectionbounds: 1px dashed, 6px around the nodes). Only a look for
// now: no handles (resizing is its own round), no pointer events. Drawn in flow coordinates with React
// Flow's public tools, so it follows moves and zoom; it is worked out again only when the nodes change.
// 多選框：選兩個以上節點就顯示（人類；舊產品因為疊了好幾條規則，會出現未預期的表現）。樣子照舊產品（1px 虛線、四周 6px）。
// 目前只有外觀：沒有把手（調大小另一輪）、不吃滑鼠。用 React Flow 的公開工具畫在畫布座標上，跟著移動與縮放；只在節點變了才重算。
// The distance to the nodes is the theme's --selection-gap (style.css); here only the nodes' own bounds.
// 框和節點的距離是主題的 --selection-gap（style.css）；這裡只給節點本身的範圍。

export function SelectionFrame({ nodes }: { nodes: readonly FlowNode[] }) {
  const selected = nodes.filter(node => node.selected);
  if (selected.length < 2) return null;
  const bounds = getNodesBounds(selected);
  return <ViewportPortal>
    <div className="selection-frame" style={{ transform: `translate(${bounds.x}px, ${bounds.y}px)`, width: bounds.width, height: bounds.height }} />
  </ViewportPortal>;
}
