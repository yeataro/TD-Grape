import { memo } from 'react';
import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react';

// A wire's halo (Refactor.105.18, human 2026-10-13: a canvas-coloured edge so crossing wires read clearly): a wider path in the canvas's
// colour drawn just before the wire, in the wire's own group, so a wire drawn later cuts the ones under it where they cross. Not a filter
// (an outline would need one per wire, costly and soft). It takes no pointer. Every kind of wire draws it: a plain one (WireEdge, our
// own in place of React Flow's default — the same Bezier — so it can carry the halo; EDITOR_UI_RULES 六之一), a ghost, a conversion.
// 線的底線（R.105.18，人類 10-13：線邊加一圈畫布色，交疊時比較清楚）：在線之前、同一組裡畫一條較粗的畫布色路徑，後畫的線在交叉處把下面的線切開。
// 不用濾鏡（外框得每條線跑一次，又貴又糊）。不接收指標。每種線都畫：一般線（WireEdge，取代 React Flow 的預設線、同一條貝茲曲線，才能帶底線；
// 畫面規則六之一）、幽靈線、轉換線。

export const WireHalo = ({ path }: { path: string }) => <path className="wire-halo" d={path} />;

/** A plain wire: React Flow's default Bezier wire with its halo. Memoised like React Flow's own (R.105.19, measured: without it every wire
 * re-ran on any selection or node move). 一般線：React Flow 預設的貝茲線加上底線。和 React Flow 自己的一樣包 memo（R.105.19，量過：
 * 沒包時任何選取或移動節點，每條線都白跑一次）。 */
export const WireEdge = memo(function WireEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, markerEnd, interactionWidth }: EdgeProps) {
  const [path] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  return <><WireHalo path={path} /><BaseEdge id={id} path={path} style={style} markerEnd={markerEnd} interactionWidth={interactionWidth} /></>;
});
