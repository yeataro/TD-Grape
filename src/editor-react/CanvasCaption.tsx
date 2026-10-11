import { Panel } from '@xyflow/react';
import { tr, say } from './text';

// The caption on the canvas's lower left, as the legacy editor's (stage, node count, hint; legacy index.html:57 canvas-caption).
// Not shown for now (Refactor.83.4, human 2026-10-11: of little use today, and the floating panels' lower-left corner would
// clash with it); kept so it can come back once the floating panels settle: put <CanvasCaption count={…} /> inside <ReactFlow>.
// 網路區左下角的說明，照舊產品（Stage、節點數、提示）。暫時不顯示（R.83.4，人類 10-11：現在用處不大，浮動面板的左下角會和它衝突）；
// 程式留著，浮動面板定了之後可以放回：在 <ReactFlow> 裡加 <CanvasCaption count={…} />。
export function CanvasCaption({ count }: { count: number }) {
  return <Panel position="bottom-left" className="canvas-caption"><strong>{say(tr('stage.pixel', 'Pixel stage'))}</strong>
    <span>{say(tr('canvas.nodeCount', '{count} node(s)', { count }))}</span>
    <span>{say(tr('canvas.hint', 'Build your Shader from left to right.'))}</span></Panel>;
}
