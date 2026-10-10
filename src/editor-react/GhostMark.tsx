import { useId, type CSSProperties } from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react';
import { ghostDelay, roundedHem } from './ghost_motion';

// The Ghost mark, alive (Refactor.75.27, human 2026-10-11): on a node the hem flows and the eyes blink; on a wire it also
// floats and looks left and right. Animation effects off (the gear, or the system's reduce motion), it stands still in the same
// rounded shape, the same everywhere (human: not the old sharp zigzag). Ghost 標記會動（R.75.27，人類）：節點上裙擺流動、眼睛眨；
// 線上再加浮動與左右看。動畫效果關閉（齒輪或系統的減少動態）時，以同樣的圓角形狀靜止，各處一樣（人類：不是原本的尖鋸齒）。

const HEM = roundedHem();

export function GhostMark({ id, on }: { id: string; on: 'node' | 'wire' }) {
  const key = useId().replace(/:/g, '');
  return <span className={'ghost-figure ' + on} style={{ '--ghost-delay': ghostDelay(id) } as CSSProperties}>
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <clipPath id={'body' + key}><rect x="6" y="0" width="12" height="24" /></clipPath>
        {/* The outline (the old icon drew it with a stroke), grown from the shape so the moving hem leaves no seam.
            外框（原本的圖示用描邊畫），由形狀外擴而成，流動的裙擺才不會留下接縫。 */}
        <filter id={'edge' + key} x="-20%" y="-20%" width="140%" height="140%">
          <feMorphology in="SourceAlpha" operator="dilate" radius="0.8" result="grown" />
          <feFlood style={{ floodColor: 'var(--node-ghost-edge)' }} />
          <feComposite in2="grown" operator="in" result="edge" />
          <feMerge><feMergeNode in="edge" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <g className="ghost-body"><g filter={`url(#edge${key})`}><g clipPath={`url(#body${key})`}>
        <path className="ghost-fill" d="M6 18.6V10a6 6 0 0 1 12 0v8.6Z" />
        <path className="ghost-fill ghost-hem" d={HEM} />
      </g></g>
        {/* Solid dark eyes, whatever is behind (Refactor.75.29, human 2026-10-11: the eyes should be black; cut-outs showed
            the node or the canvas). 實心的深色眼睛，不管後面是什麼（R.75.29，人類：眼睛要是黑的；挖空會透出節點或畫布）。 */}
        <g className="ghost-eyes"><circle className="ghost-eye" cx="10" cy="10" r="1.3" /><circle className="ghost-eye" cx="14" cy="10" r="1.3" /></g>
      </g>
    </svg>
  </span>;
}

/** A ghost wire (Q37 1-3) drawn as React Flow's own wire, with a small ghost at its middle (Refactor.75.27, human 2026-10-11).
 * Ghost 線：照 React Flow 原本的線畫，中點多一隻小幽靈（R.75.27，人類）。 */
export function GhostEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, markerEnd, interactionWidth }: EdgeProps) {
  const [path, x, y] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  return <>
    <BaseEdge id={id} path={path} style={style} markerEnd={markerEnd} interactionWidth={interactionWidth} />
    <EdgeLabelRenderer>
      <span className="wire-ghost-mark" style={{ transform: `translate(-50%, -50%) translate(${x}px, ${y}px)` }}><GhostMark id={id} on="wire" /></span>
    </EdgeLabelRenderer>
  </>;
}
